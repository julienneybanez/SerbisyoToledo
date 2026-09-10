import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useLanguage } from '../../context/LanguageContext';
import { authAPI, messageAPI } from '../../services/api';
import { connectMessagingSocket } from '../../services/socket';

const CLIENT_ITEMS = [
  { to: '/client-dashboard', labelKey: 'dashboardShort', icon: 'bi-grid-1x2' },
  { to: '/feed', labelKey: 'browseServices', icon: 'bi-search' },
  { to: '/requests', labelKey: 'clientSidebarRequests', icon: 'bi-inbox' },
  { to: '/messages', labelKey: 'messages', icon: 'bi-chat-dots' },
  { to: '/notifications', labelKey: 'notifications', icon: 'bi-bell' },
];

const PROVIDER_ITEMS = [
  { to: '/dashboard', labelKey: 'dashboardShort', icon: 'bi-grid-1x2' },
  { to: '/requests', labelKey: 'requests', icon: 'bi-inbox' },
  { to: '/provider-schedule', labelEn: 'Calendar', labelCeb: 'Kalendaryo', icon: 'bi-calendar3' },
  { to: '/messages', labelKey: 'messages', icon: 'bi-chat-dots' },
  { to: '/provider-credentials', labelKey: 'profile', icon: 'bi-person-vcard' },
];

export default function WorkspaceSidebar({
  role,
  onEditClientProfile,
}) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isProvider = role === 'tradesperson';
  const items = isProvider ? PROVIDER_ITEMS : CLIENT_ITEMS;
  const [unreadMessages, setUnreadMessages] = useState(0);

  const handleLogout = async () => {
    await authAPI.logout();
    navigate('/');
  };

  useEffect(() => {
    if (!['client', 'tradesperson'].includes(role)) {
      setUnreadMessages(0);
      return undefined;
    }

    let mounted = true;
    let socket = null;

    const loadUnread = async () => {
      try {
        const response = await messageAPI.getUnreadCount();
        if (mounted && response?.success) setUnreadMessages(Number(response.data?.count || 0));
      } catch {
        if (mounted) setUnreadMessages(0);
      }
    };

    const handleUnreadChanged = () => loadUnread();
    loadUnread();

    connectMessagingSocket()
      .then((connectedSocket) => {
        if (!mounted || !connectedSocket) return;
        socket = connectedSocket;
        socket.on('message:new', handleUnreadChanged);
        socket.on('messages:unread-changed', handleUnreadChanged);
      })
      .catch(() => {});

    return () => {
      mounted = false;
      if (!socket) return;
      socket.off('message:new', handleUnreadChanged);
      socket.off('messages:unread-changed', handleUnreadChanged);
    };
  }, [role]);

  const getLabel = (item) => {
    if (item.labelKey) return t(item.labelKey);
    return language === 'ceb' ? item.labelCeb : item.labelEn;
  };

  return (
    <aside className="workspace-sidebar" aria-label={`${t(isProvider ? 'serviceProvider' : 'client')} ${t('navigation')}`}>
      <Link to={isProvider ? '/dashboard' : '/client-dashboard'} className="workspace-brand">
        <img src={logo} alt="" draggable="false" className="workspace-brand-logo" />
        <span className="workspace-brand-wordmark"><strong>Serbisyo</strong><strong>Toledo</strong></span>
      </Link>

      <div className="workspace-sidebar-scroll">
        <div className="workspace-role-card">
          <i className={`bi ${isProvider ? 'bi-person-workspace' : 'bi-person'}`} aria-hidden="true" />
          <strong>{t(isProvider ? 'serviceProvider' : 'client')}</strong>
        </div>

        <nav className="workspace-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}
              data-tour={item.to === '/requests' ? 'nav-requests' : undefined}
            >
              <i className={`bi ${item.icon}`} aria-hidden="true" />
              <span>{getLabel(item)}</span>
              {item.to === '/messages' && unreadMessages > 0 && (
                <span className="workspace-nav-badge" aria-label={`${unreadMessages} ${t('messagesUnread')}`}>
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {!isProvider && (
          <>
            <div className="workspace-nav-section-label">{t('profile')}</div>
            <nav className="workspace-nav workspace-nav-secondary">
              <button type="button" className="workspace-nav-link workspace-nav-action" onClick={onEditClientProfile}>
                <i className="bi bi-pencil-square" aria-hidden="true" /><span>{t('editProfile')}</span>
              </button>
            </nav>
          </>
        )}
      </div>

      <div className="workspace-sidebar-footer">
        <div className="workspace-sidebar-divider" />
        <nav className="workspace-nav workspace-nav-secondary">
          <NavLink to={isProvider ? '/provider-settings' : '/client-settings'} className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}>
            <i className="bi bi-gear" aria-hidden="true" /><span>{t('settings')}</span>
          </NavLink>
          <button type="button" className="workspace-nav-link workspace-nav-action workspace-logout-link" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right" aria-hidden="true" /><span>{t('logOut')}</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
