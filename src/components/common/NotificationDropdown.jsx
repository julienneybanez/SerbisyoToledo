import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import './NotificationDropdown.css';

const resolveNotificationDestination = (notification) => {
  const requestId = notification?.related_request_id;
  const type = String(notification?.type || '').toLowerCase();

  if (requestId && [
    'request_received',
    'request_accepted',
    'request_declined',
    'request_cancelled',
    'provider_on_way',
    'service_completed',
    'discussion_requested',
    'discussion_accepted',
    'reschedule_proposed',
    'reschedule_accepted',
    'reschedule_declined',
    'completion_confirmed',
    'review_received',
  ].includes(type)) {
    return `/requests?request=${encodeURIComponent(requestId)}`;
  }

  if (['verification_approved', 'verification_rejected'].includes(type)) {
    return '/dashboard';
  }

  return '/notifications';
};

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch notifications on mount and periodically
  useEffect(() => {
    fetchUnreadCount();
    
    const interval = setInterval(fetchUnreadCount, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationAPI.getUnreadCount();
      if (response.success) {
        setUnreadCount(response.data.count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationAPI.getNotifications(20, 0);
      if (response.success) {
        setNotifications(response.data.notifications);
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      try {
        await notificationAPI.markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }

    navigate(resolveNotificationDestination(notification));
    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      await notificationAPI.clearAll();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  const getNotificationIcon = (type) => {
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
      default:
        return <i className="bi bi-bell-fill notification-icon"></i>;
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('notificationsJustNow');
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="notification-dropdown" ref={dropdownRef}>
      <button 
        className="notification-bell-btn"
        onClick={handleToggle}
        aria-label={t('notifications')}
      >
        <i className="bi bi-bell"></i>
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown-menu">
          <div className="notification-header">
            <h4>{t('notifications')}</h4>
            {notifications.length > 0 && (
              <div className="notification-actions">
                <button onClick={handleMarkAllAsRead} className="action-btn">
                  {t('notificationsMarkAllRead')}
                </button>
                <button onClick={handleClearAll} className="action-btn clear-btn">
                  {t('notificationsClearAll')}
                </button>
              </div>
            )}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">
                <div className="spinner-small"></div>
                <span>{t('notificationsLoading')}</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <i className="bi bi-bell-slash"></i>
                <p>{t('notificationsEmpty')}</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon-wrapper">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">
                      {formatTimeAgo(notification.created_at)}
                    </div>
                  </div>
                  {!notification.is_read && <div className="unread-dot"></div>}
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-footer">
              <button onClick={() => { navigate('/notifications'); setIsOpen(false); }}>
                {t('notificationsOpenCenter')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
