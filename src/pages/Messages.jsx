import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getUser, messageAPI } from '../services/api';
import { connectMessagingSocket } from '../services/socket';
import { useLanguage } from '../context/LanguageContext';
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
        setConversation(response.data.conversation);
        setMessages(response.data.messages || []);
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
  }, [activeConversationId, loadConversations, t]);

  useEffect(() => {
    let cancelled = false;
    let socket = null;

    const handleNewMessage = (incoming) => {
      if (Number(incoming.conversationId) === Number(activeConversationId)) {
        setMessages((current) => (
          current.some((message) => Number(message.id) === Number(incoming.id))
            ? current
            : [...current, { ...incoming, mine: Number(incoming.senderId) === Number(user?.id) }]
        ));
        messageAPI.markRead(activeConversationId).catch(() => {});
      }
      loadConversations();
    };

    const handleUnreadChanged = () => {
      loadConversations();
    };

    const connect = async () => {
      try {
        const connectedSocket = await connectMessagingSocket();
        if (cancelled || !connectedSocket) return;

        socket = connectedSocket;
        socket.on('message:new', handleNewMessage);
        socket.on('messages:unread-changed', handleUnreadChanged);

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
    };
  }, [activeConversationId, loadConversations, user?.id]);

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
            : [...current, { ...sent, mine: true }]
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
                <button type="button" className="messages-mobile-back" onClick={closeMobileThread} aria-label={t('messagesBackToConversations')}>
                  <i className="bi bi-chevron-left" aria-hidden="true"></i>
                </button>
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

              <div className="messages-thread">
                {messages.length === 0 ? (
                  <div className="messages-empty">
                    <i className="bi bi-chat-square-heart" aria-hidden="true"></i>
                    <strong>{t('messagesStartConversation')}</strong>
                    <span>{t('messagesKeepBookingDetailsHere')}</span>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className={'message-row ' + (message.mine ? 'mine' : 'theirs')}>
                      <div className="message-bubble">
                        <div className="message-text">{message.text}</div>
                        <div className="message-meta">
                          {formatTime(message.createdAt)}
                          {message.mine && message.readAt ? ' · ' + t('messagesRead') : ''}
                        </div>
                      </div>
                    </div>
                  ))
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
                  <button type="submit" disabled={!draft.trim() || sending} aria-label={t('messagesSend')}>
                    <i className="bi bi-send-fill" aria-hidden="true"></i>
                    <span>{sending ? t('sending') : t('messagesSend')}</span>
                  </button>
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
