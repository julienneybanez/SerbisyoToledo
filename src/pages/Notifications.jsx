import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getUser, isAuthenticated, notificationAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import './Notifications.css';

function resolveNotificationDestination(notification) {
  const requestId = notification?.related_request_id;
  const type = String(notification?.type || '').toLowerCase();

  if (requestId && type === 'message_received') {
    return `/messages?request=${encodeURIComponent(requestId)}`;
  }

  if (requestId && [
    'request_received',
    'request_accepted',
    'request_declined',
    'request_cancelled',
    'provider_on_way',
    'service_completed',
    'discussion_requested',
    'discussion_accepted',
    'phone_share_requested',
    'phone_shared',
    'phone_share_declined',
    'reschedule_proposed',
    'reschedule_accepted',
    'reschedule_declined',
    'completion_confirmed',
    'review_received',
  ].includes(type)) {
    return `/requests?request=${encodeURIComponent(requestId)}`;
  }

  if (['credential_approved', 'credential_rejected', 'credential_expired'].includes(type)) {
    return '/provider-credentials';
  }

  if (['verification_approved', 'verification_rejected'].includes(type)) {
    return '/dashboard';
  }

  return '/notifications';
}

function formatTimeAgo(dateString, nowLabel) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return nowLabel;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getNotificationIcon(type) {
  switch (type) {
    case 'request_received':
      return <i className="bi bi-inbox-fill notification-icon icon-received"></i>;
    case 'request_accepted':
      return <i className="bi bi-check-circle-fill notification-icon icon-accepted"></i>;
    case 'request_declined':
      return <i className="bi bi-x-circle-fill notification-icon icon-declined"></i>;
    case 'request_cancelled':
      return <i className="bi bi-slash-circle-fill notification-icon icon-declined"></i>;
    case 'provider_on_way':
      return <i className="bi bi-truck notification-icon icon-on-way"></i>;
    case 'service_completed':
      return <i className="bi bi-star-fill notification-icon icon-completed"></i>;
    case 'discussion_requested':
      return <i className="bi bi-chat-dots-fill notification-icon icon-discussion"></i>;
    case 'discussion_accepted':
      return <i className="bi bi-telephone-fill notification-icon icon-phone"></i>;
    case 'message_received':
      return <i className="bi bi-chat-square-text-fill notification-icon icon-discussion"></i>;
    case 'phone_share_requested':
      return <i className="bi bi-telephone-inbound-fill notification-icon icon-phone"></i>;
    case 'phone_shared':
      return <i className="bi bi-telephone-check-fill notification-icon icon-phone"></i>;
    case 'phone_share_declined':
      return <i className="bi bi-telephone-x-fill notification-icon icon-declined"></i>;
    case 'reschedule_proposed':
      return <i className="bi bi-calendar2-plus-fill notification-icon icon-discussion"></i>;
    case 'reschedule_accepted':
      return <i className="bi bi-calendar2-check-fill notification-icon icon-accepted"></i>;
    case 'reschedule_declined':
      return <i className="bi bi-calendar2-x-fill notification-icon icon-declined"></i>;
    case 'verification_approved':
      return <i className="bi bi-patch-check-fill notification-icon icon-accepted"></i>;
    case 'verification_rejected':
      return <i className="bi bi-shield-x notification-icon icon-declined"></i>;
    case 'credential_approved':
      return <i className="bi bi-award-fill notification-icon icon-accepted"></i>;
    case 'credential_rejected':
      return <i className="bi bi-award notification-icon icon-declined"></i>;
    case 'credential_expired':
      return <i className="bi bi-calendar-x-fill notification-icon icon-declined"></i>;
    default:
      return <i className="bi bi-bell-fill notification-icon"></i>;
  }
}

export default function Notifications() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const user = getUser();
  const userType = user?.userType || null;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const focusRequestId = useMemo(() => {
    const raw = searchParams.get('request');
    if (!raw) return null;

    const asNumber = Number(raw);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : null;
  }, [searchParams]);

  useEffect(() => {
    if (!isAuthenticated() || !userType) {
      navigate('/login', { replace: true });
      return;
    }

    let isMounted = true;

    const loadNotifications = async () => {
      try {
        if (isMounted) {
          setLoading(true);
          setError('');
        }

        const response = await notificationAPI.getNotifications(100, 0);
        if (!isMounted) {
          return;
        }

        if (response.success) {
          setItems(response.data.notifications || []);
        }
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setError(err?.message || t('notificationsLoadError'));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [navigate, userType, t]);

  const handleMarkAllRead = async () => {
    try {
      setBusy(true);
      await notificationAPI.markAllAsRead();
      setItems((prev) => prev.map((entry) => ({ ...entry, is_read: true })));
    } catch (err) {
      setError(err?.message || t('notificationsMarkAllFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleClearAll = async () => {
    try {
      setBusy(true);
      await notificationAPI.clearAll();
      setItems([]);
    } catch (err) {
      setError(err?.message || t('notificationsClearAllFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenRequest = async (notification) => {
    if (!notification.is_read) {
      try {
        await notificationAPI.markAsRead(notification.id);
        setItems((prev) => prev.map((entry) => (
          entry.id === notification.id ? { ...entry, is_read: true } : entry
        )));
      } catch {
        // Non-blocking: continue to request view.
      }
    }

    navigate(resolveNotificationDestination(notification));
  };

  const hasItems = items.length > 0;

  return (
    <div className="notifications-page-shell">
      <div className="notifications-page-container">
        <div className="notifications-page-header">
          <p className="notifications-page-subtitle">{t('notificationsPageSubtitle')}</p>

          {focusRequestId != null && (
            <div className="notifications-request-focus" role="status">
              <span>{t('notificationsFocusedRequest')}</span>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => navigate('/requests')}
              >
                {t('goToRequests')}
              </button>
            </div>
          )}

          {hasItems && (
            <div className="notifications-page-actions">
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleMarkAllRead} disabled={busy}>
                {t('notificationsMarkAllRead')}
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleClearAll} disabled={busy}>
                {t('notificationsClearAll')}
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div className="notifications-state-card">
            <div className="spinner-small"></div>
            <p>{t('notificationsLoading')}</p>
          </div>
        )}

        {!loading && error && (
          <div className="notifications-state-card error" role="alert">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && !hasItems && (
          <div className="notifications-state-card empty">
            <i className="bi bi-bell-slash"></i>
            <p>{t('notificationsEmpty')}</p>
          </div>
        )}

        {!loading && hasItems && (
          <div className="notifications-list-page" role="list">
            {items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={`notification-item page-item ${!notification.is_read ? 'unread' : ''}`}
                role="listitem"
                onClick={() => handleOpenRequest(notification)}
              >
                <div className="notification-icon-wrapper">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="notification-content">
                  <div className="notification-title">{notification.title}</div>
                  <div className="notification-message">{notification.message}</div>
                  <div className="notification-time">{formatTimeAgo(notification.created_at, t('notificationsJustNow'))}</div>
                </div>
                {!notification.is_read && <span className="unread-dot" aria-hidden="true"></span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
