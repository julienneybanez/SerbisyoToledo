import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getUser, messageAPI, serviceRequestAPI } from '../services/api';
import { connectMessagingSocket } from '../services/socket';
import { useLanguage } from '../context/LanguageContext';
import { AppButton, AppTextarea, IconButton } from '../components/ui';
import './Messages.css';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatSystemEvent = (event, t) => {
  const name = event.actorName || t('user');
  const keyByType = {
    request_accepted: 'messagesEventRequestAccepted',
    request_declined: 'messagesEventRequestDeclined',
    phone_requested: 'messagesEventPhoneRequested',
    phone_shared: 'messagesEventPhoneShared',
    phone_declined: 'messagesEventPhoneDeclined',
  };
  const key = keyByType[event.eventType];
  return key ? t(key, { name }) : '';
};

export default function Messages() {
  const { t } = useLanguage();
  const user = getUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestFromUrl = searchParams.get('request');
  const conversationFromUrl = Number(searchParams.get('conversation') || 0);

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(conversationFromUrl || null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [requestActionLoading, setRequestActionLoading] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [phoneShare, setPhoneShare] = useState(null);
  const [phoneShareLoading, setPhoneShareLoading] = useState(false);
  const [phoneShareError, setPhoneShareError] = useState('');
  const bottomRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const response = await messageAPI.listConversations();
      if (response?.success) {
        const items = response.data?.conversations || [];
        setConversations(items);
        return items;
      }
    } catch (err) {
      setError(err.message || t('messagesLoadFailed'));
    } finally {
      setListLoading(false);
    }
    return [];
  }, [t]);

  const loadPhoneShare = useCallback(async (requestId, requestStatus) => {
    if (!requestId || !['accepted', 'on_the_way', 'in_progress'].includes(requestStatus)) {
      setPhoneShare(null);
      setPhoneShareError('');
      return null;
    }

    setPhoneShareLoading(true);
    setPhoneShareError('');
    try {
      const response = await serviceRequestAPI.getPhoneShare(requestId);
      const nextState = response?.success ? response.data : null;
      setPhoneShare(nextState);
      return nextState;
    } catch (err) {
      setPhoneShare(null);
      setPhoneShareError(err.message || t('phoneShareLoadFailed'));
      return null;
    } finally {
      setPhoneShareLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const items = await loadConversations();
      if (!mounted) return;

      if (requestFromUrl) {
        try {
          const response = await messageAPI.openRequestConversation(requestFromUrl);
          if (response?.success && mounted) {
            const id = Number(response.data.conversationId);
            setActiveConversationId(id);
            setSearchParams({ conversation: String(id) }, { replace: true });
            await loadConversations();
          }
        } catch (err) {
          if (mounted) setError(err.message || t('messagesOpenFailed'));
        }
        return;
      }

      if (!activeConversationId && items.length > 0) {
        setActiveConversationId(items[0].id);
        setSearchParams({ conversation: String(items[0].id) }, { replace: true });
      }
    };

    initialize();
    return () => {
      mounted = false;
    };
  }, [requestFromUrl, loadConversations, setSearchParams, activeConversationId, t]);

  useEffect(() => {
    if (!activeConversationId) {
      setConversation(null);
      setMessages([]);
      return undefined;
    }

    let mounted = true;
    const loadThread = async () => {
      setThreadLoading(true);
      setError('');
      try {
        const response = await messageAPI.getMessages(activeConversationId);
        if (!mounted || !response?.success) return;
        const nextConversation = response.data.conversation;
        setConversation(nextConversation);
        setMessages(response.data.timeline || response.data.messages || []);
        setDeclineOpen(false);
        setDeclineReason('');
        await loadPhoneShare(nextConversation?.serviceRequestId, nextConversation?.requestStatus);
        await messageAPI.markRead(activeConversationId);
        await loadConversations();
      } catch (err) {
        if (mounted) setError(err.message || t('messagesThreadLoadFailed'));
      } finally {
        if (mounted) setThreadLoading(false);
      }
    };

    loadThread();
    return () => {
      mounted = false;
    };
  }, [activeConversationId, loadConversations, loadPhoneShare, t]);

  useEffect(() => {
    let cancelled = false;
    let socket = null;

    const handleNewMessage = (incoming) => {
      if (Number(incoming.conversationId) === Number(activeConversationId)) {
        setMessages((current) => (
          current.some((message) => message.kind === 'message' && Number(message.id) === Number(incoming.id))
            ? current
            : [...current, { ...incoming, kind: 'message', mine: Number(incoming.senderId) === Number(user?.id) }]
        ));
        messageAPI.markRead(activeConversationId).catch(() => {});
      }
      loadConversations();
    };

    const handleUnreadChanged = () => {
      loadConversations();
    };

    const handleConversationUpdated = async (payload) => {
      loadConversations();
      if (Number(payload?.conversationId) !== Number(activeConversationId)) return;

      try {
        const response = await messageAPI.getMessages(activeConversationId);
        if (!response?.success) return;
        const nextConversation = response.data.conversation;
        setConversation(nextConversation);
        setMessages(response.data.timeline || response.data.messages || []);
        await loadPhoneShare(nextConversation?.serviceRequestId, nextConversation?.requestStatus);
      } catch {
        // The next normal thread refresh will recover if this realtime refresh fails.
      }
    };

    const connect = async () => {
      try {
        const connectedSocket = await connectMessagingSocket();
        if (cancelled || !connectedSocket) return;

        socket = connectedSocket;
        socket.on('message:new', handleNewMessage);
        socket.on('messages:unread-changed', handleUnreadChanged);
        socket.on('conversation:updated', handleConversationUpdated);

        if (activeConversationId) {
          socket.emit('conversation:join', activeConversationId);
        }
      } catch {
        // REST messaging remains usable even if realtime connection is temporarily unavailable.
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (!socket) return;

      if (activeConversationId) {
        socket.emit('conversation:leave', activeConversationId);
      }
      socket.off('message:new', handleNewMessage);
      socket.off('messages:unread-changed', handleUnreadChanged);
      socket.off('conversation:updated', handleConversationUpdated);
    };
  }, [activeConversationId, loadConversations, loadPhoneShare, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, activeConversationId]);

  const selectedItem = useMemo(
    () => conversations.find((item) => Number(item.id) === Number(activeConversationId)) || null,
    [conversations, activeConversationId]
  );

  const selectConversation = (id) => {
    setActiveConversationId(id);
    setSearchParams({ conversation: String(id) });
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeConversationId || sending || !conversation?.writable) return;

    setSending(true);
    setError('');
    try {
      const response = await messageAPI.sendMessage(activeConversationId, text);
      if (response?.success && response.data?.message) {
        const sent = response.data.message;
        setMessages((current) => (
          current.some((message) => Number(message.id) === Number(sent.id))
            ? current
            : [...current, { ...sent, kind: 'message', mine: true }]
        ));
        setDraft('');
        await loadConversations();
      }
    } catch (err) {
      setError(err.message || t('messagesSendFailed'));
    } finally {
      setSending(false);
    }
  };

  const refreshConversation = useCallback(async () => {
    if (!activeConversationId) return;
    const response = await messageAPI.getMessages(activeConversationId);
    if (!response?.success) return;
    const nextConversation = response.data.conversation;
    setConversation(nextConversation);
    setMessages(response.data.timeline || response.data.messages || []);
    await loadPhoneShare(nextConversation?.serviceRequestId, nextConversation?.requestStatus);
    await loadConversations();
  }, [activeConversationId, loadConversations, loadPhoneShare]);

  const handleRequestDecision = async (status) => {
    if (!conversation?.serviceRequestId || requestActionLoading) return;

    const reason = status === 'declined' ? declineReason.trim() : null;
    if (status === 'declined' && !reason) {
      setError(t('requestsDeclineReasonRequired'));
      return;
    }

    setRequestActionLoading(true);
    setError('');
    try {
      await serviceRequestAPI.updateStatus(conversation.serviceRequestId, status, reason);
      setDeclineOpen(false);
      setDeclineReason('');
      await refreshConversation();
    } catch (err) {
      setError(err.message || t('requestsStatusUpdateFailed'));
    } finally {
      setRequestActionLoading(false);
    }
  };

  const handleRequestPhone = async () => {
    if (!conversation?.serviceRequestId || phoneShareLoading) return;
    setPhoneShareLoading(true);
    setPhoneShareError('');
    try {
      await serviceRequestAPI.requestPhoneShare(conversation.serviceRequestId);
      await refreshConversation();
    } catch (err) {
      setPhoneShareError(err.message || t('phoneShareRequestFailed'));
    } finally {
      setPhoneShareLoading(false);
    }
  };

  const handlePhoneResponse = async (action) => {
    if (!conversation?.serviceRequestId || phoneShareLoading) return;
    setPhoneShareLoading(true);
    setPhoneShareError('');
    try {
      await serviceRequestAPI.respondPhoneShare(conversation.serviceRequestId, action);
      await refreshConversation();
    } catch (err) {
      setPhoneShareError(err.message || t('phoneShareResponseFailed'));
    } finally {
      setPhoneShareLoading(false);
    }
  };

  const closeMobileThread = () => {
    setActiveConversationId(null);
    setSearchParams({});
  };

  return (
    <div className="messages-page">
      {error && <div className="alert alert-danger messages-alert">{error}</div>}

      <div className="messages-shell">
        <aside className={'messages-list-panel ' + (activeConversationId ? 'has-selection' : '')} aria-label={t('messagesConversations')}>
          <div className="messages-list-header">
            <strong>{t('messagesConversations')}</strong>
          </div>

          {listLoading ? (
            <div className="messages-empty">{t('loading')}</div>
          ) : conversations.length === 0 ? (
            <div className="messages-empty">
              <i className="bi bi-chat-square-text" aria-hidden="true"></i>
              <strong>{t('messagesNoConversations')}</strong>
              <span>{t('messagesNoConversationsHelp')}</span>
            </div>
          ) : (
            <div className="messages-conversation-list">
              {conversations.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={'messages-conversation-item ' + (Number(item.id) === Number(activeConversationId) ? 'active' : '')}
                  onClick={() => selectConversation(item.id)}
                >
                  <span className="messages-avatar" aria-hidden="true">
                    {item.otherUser?.profilePhoto ? (
                      <img src={item.otherUser.profilePhoto} alt="" className="messages-avatar-image non-draggable-image" draggable="false" />
                    ) : (
                      (item.otherUser?.name || 'U').slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="messages-conversation-copy">
                    <span className="messages-conversation-topline">
                      <strong>{item.otherUser?.name || t('user')}</strong>
                      {item.unreadCount > 0 && (
                        <span className="messages-unread-badge" aria-label={String(item.unreadCount) + ' ' + t('messagesUnread')}>
                          {item.unreadCount > 99 ? '99+' : item.unreadCount}
                        </span>
                      )}
                    </span>
                    <span className="messages-service-label">{item.serviceLabel}</span>
                    <span className="messages-preview">{item.lastMessage || t('messagesStartConversation')}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="messages-thread-panel" aria-live="polite">
          {!activeConversationId ? (
            <div className="messages-empty messages-thread-empty">
              <i className="bi bi-chat-dots" aria-hidden="true"></i>
              <strong>{t('messagesChooseConversation')}</strong>
              <span>{t('messagesChooseConversationHelp')}</span>
            </div>
          ) : threadLoading ? (
            <div className="messages-empty">{t('loading')}</div>
          ) : (
            <>
              <header className="messages-thread-header">
                <IconButton className="messages-mobile-back" onClick={closeMobileThread} aria-label={t('messagesBackToConversations')}>
                  <i className="bi bi-chevron-left" aria-hidden="true"></i>
                </IconButton>
                <span className="messages-thread-avatar" aria-hidden="true">
                  {(conversation?.otherUser?.profilePhoto || selectedItem?.otherUser?.profilePhoto) ? (
                    <img
                      src={conversation?.otherUser?.profilePhoto || selectedItem?.otherUser?.profilePhoto}
                      alt=""
                      className="messages-avatar-image non-draggable-image"
                      draggable="false"
                    />
                  ) : (
                    (conversation?.otherUser?.name || selectedItem?.otherUser?.name || 'U').slice(0, 1).toUpperCase()
                  )}
                </span>
                <div>
                  <strong>{conversation?.otherUser?.name || selectedItem?.otherUser?.name || t('user')}</strong>
                  <span>{conversation?.serviceLabel || selectedItem?.serviceLabel}</span>
                </div>
                <span className={'messages-status-pill status-' + (conversation?.requestStatus || selectedItem?.requestStatus || 'closed')}>
                  {String(conversation?.requestStatus || selectedItem?.requestStatus || '').replaceAll('_', ' ')}
                </span>
              </header>

              {conversation && (
                <div className="messages-booking-actions">
                  {conversation.viewerRole === 'provider' && conversation.requestStatus === 'pending' && (
                    <div className="messages-request-decision">
                      <div className="messages-action-copy">
                        <strong>{t('messagesPendingRequestTitle')}</strong>
                        <span>{t('messagesPendingRequestHelp')}</span>
                      </div>
                      {!declineOpen ? (
                        <div className="messages-action-buttons">
                          <AppButton
                            onClick={() => handleRequestDecision('accepted')}
                            disabled={requestActionLoading}
                            icon={<i className="bi bi-check-lg" aria-hidden="true"></i>}
                          >
                            {t('requestsAcceptRequest')}
                          </AppButton>
                          <AppButton
                            variant="danger"
                            onClick={() => setDeclineOpen(true)}
                            disabled={requestActionLoading}
                            icon={<i className="bi bi-x-lg" aria-hidden="true"></i>}
                          >
                            {t('requestsDeclineRequest')}
                          </AppButton>
                        </div>
                      ) : (
                        <div className="messages-decline-form">
                          <label htmlFor="messages-decline-reason">{t('requestsDeclineReasonLabel')}</label>
                          <AppTextarea
                            id="messages-decline-reason"
                            rows="2"
                            maxLength={500}
                            value={declineReason}
                            onChange={(event) => setDeclineReason(event.target.value)}
                            placeholder={t('requestsDeclineReasonPlaceholder')}
                          />
                          <div className="messages-action-buttons">
                            <AppButton
                              variant="danger"
                              onClick={() => handleRequestDecision('declined')}
                              disabled={requestActionLoading || !declineReason.trim()}
                            >
                              {t('requestsConfirmDecline')}
                            </AppButton>
                            <AppButton
                              variant="secondary"
                              onClick={() => {
                                setDeclineOpen(false);
                                setDeclineReason('');
                              }}
                              disabled={requestActionLoading}
                            >
                              {t('cancel')}
                            </AppButton>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {['accepted', 'on_the_way', 'in_progress'].includes(conversation.requestStatus) && (
                    <div className="messages-phone-share">
                      <div className="messages-action-copy">
                        <strong>{t('messagesPhoneShareTitle')}</strong>
                        <span>{t('messagesPhoneShareHelp')}</span>
                      </div>

                      {phoneShareError && <div className="messages-inline-error">{phoneShareError}</div>}

                      {phoneShare?.requestedFromMe?.status === 'pending' && (
                        <div className="messages-phone-request-card">
                          <span><i className="bi bi-telephone-inbound" aria-hidden="true"></i>{t('phoneShareIncomingRequest')}</span>
                          <div className="messages-action-buttons">
                            <AppButton
                              onClick={() => handlePhoneResponse('share')}
                              disabled={phoneShareLoading}
                            >
                              {t('sharePhoneNumber')}
                            </AppButton>
                            <AppButton
                              variant="secondary"
                              onClick={() => handlePhoneResponse('decline')}
                              disabled={phoneShareLoading}
                            >
                              {t('decline')}
                            </AppButton>
                          </div>
                        </div>
                      )}

                      {phoneShare?.sharedPhone ? (
                        <div className="messages-shared-phone">
                          <i className="bi bi-telephone-fill" aria-hidden="true"></i>
                          <div>
                            <span>{conversation.viewerRole === 'provider' ? t('clientPhone') : t('providerPhone')}</span>
                            <a href={'tel:' + phoneShare.sharedPhone.e164}>{phoneShare.sharedPhone.display}</a>
                          </div>
                        </div>
                      ) : phoneShare?.requestedFromMe?.status === 'pending' ? null : phoneShare?.requestedByMe?.status === 'pending' ? (
                        <div className="messages-phone-pending">
                          <i className="bi bi-hourglass-split" aria-hidden="true"></i>
                          <span>{t('phoneSharePending')}</span>
                        </div>
                      ) : (
                        <AppButton
                          onClick={handleRequestPhone}
                          disabled={phoneShareLoading}
                          icon={<i className="bi bi-telephone-plus" aria-hidden="true"></i>}
                        >
                          {phoneShareLoading ? t('loading') : t('requestPhoneNumber')}
                        </AppButton>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="messages-thread">
                {messages.length === 0 ? (
                  <div className="messages-empty">
                    <i className="bi bi-chat-square-heart" aria-hidden="true"></i>
                    <strong>{t('messagesStartConversation')}</strong>
                    <span>{t('messagesKeepBookingDetailsHere')}</span>
                  </div>
                ) : (
                  messages.map((message) => {
                    if (message.kind === 'system') {
                      const eventText = formatSystemEvent(message, t);
                      if (!eventText) return null;
                      return (
                        <div key={message.id} className="message-system-event" role="status">
                          <span>{eventText}</span>
                          <time>{formatTime(message.createdAt)}</time>
                        </div>
                      );
                    }

                    const rowPhoto = message.mine
                      ? user?.profileImage
                      : (conversation?.otherUser?.profilePhoto || selectedItem?.otherUser?.profilePhoto);
                    const rowName = message.mine
                      ? user?.fullName
                      : (conversation?.otherUser?.name || selectedItem?.otherUser?.name);

                    return (
                      <div key={message.id} className={'message-row ' + (message.mine ? 'mine' : 'theirs')}>
                        <span className="message-row-avatar" aria-hidden="true">
                          {rowPhoto ? (
                            <img src={rowPhoto} alt="" className="messages-avatar-image non-draggable-image" draggable="false" />
                          ) : (
                            (rowName || 'U').slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <div className="message-bubble">
                          <div className="message-text">{message.text}</div>
                          <div className="message-meta">
                            {formatTime(message.createdAt)}
                            {message.mine && message.readAt ? ' · ' + t('messagesRead') : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {conversation?.writable ? (
                <form className="messages-composer" onSubmit={sendMessage}>
                  <label htmlFor="message-draft" className="visually-hidden">{t('messagesWriteMessage')}</label>
                  <textarea
                    id="message-draft"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value.slice(0, 2000))}
                    placeholder={t('messagesWriteMessage')}
                    rows="2"
                    maxLength={2000}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                  <AppButton type="submit" disabled={!draft.trim() || sending} aria-label={t('messagesSend')} icon={<i className="bi bi-send-fill" aria-hidden="true"></i>}>
                    <span>{sending ? t('sending') : t('messagesSend')}</span>
                  </AppButton>
                </form>
              ) : (
                <div className="messages-readonly-note">
                  <i className="bi bi-lock" aria-hidden="true"></i>
                  <span>{t('messagesReadOnly')}</span>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
