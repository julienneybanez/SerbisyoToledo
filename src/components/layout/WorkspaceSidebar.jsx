import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useLanguage } from '../../context/LanguageContext';
import { messageAPI } from '../../services/api';
import { connectMessagingSocket } from '../../services/socket';

const ROLE_ITEMS = {
  client: [
    { to: '/client-dashboard', labelKey: 'dashboardShort', icon: 'bi-grid-1x2' },
    { to: '/feed', labelKey: 'browseServices', icon: 'bi-search' },
    { to: '/requests', labelKey: 'clientSidebarRequests', icon: 'bi-inbox' },
    { to: '/messages', labelKey: 'messages', icon: 'bi-chat-dots' },
    { to: '/notifications', labelKey: 'notifications', icon: 'bi-bell' },
  ],
  tradesperson: [
    { to: '/dashboard', labelKey: 'dashboardShort', icon: 'bi-grid-1x2' },
    { to: '/requests', labelKey: 'requests', icon: 'bi-inbox' },
    { to: '/messages', labelKey: 'messages', icon: 'bi-chat-dots' },
    { to: '/provider-schedule', labelKey: 'schedule', icon: 'bi-calendar3' },
    { to: '/notifications', labelKey: 'notifications', icon: 'bi-bell' },
  ],
};

export default function WorkspaceSidebar({
  role,
  hasServiceProfile = false,
  publicProfileRoute = '/dashboard',
  onEditClientProfile,
  onEditProviderProfile,
  onManageServiceProfile,
}) {
  const { t } = useLanguage();
  const isProvider = role === 'tradesperson';
  const items = ROLE_ITEMS[role] || ROLE_ITEMS.client;
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!['client', 'tradesperson'].includes(role)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset badge for roles without Messages
      setUnreadMessages(0);
      return undefined;
    }

    let mounted = true;
    let socket = null;

    const loadUnread = async () => {
      try {
        const response = await messageAPI.getUnreadCount();
        if (mounted && response?.success) {
          setUnreadMessages(Number(response.data?.count || 0));
        }
      } catch {
        if (mounted) setUnreadMessages(0);
      }
    };

    const handleUnreadChanged = () => {
      loadUnread();
    };

    loadUnread();

    const connect = async () => {
      try {
        const connectedSocket = await connectMessagingSocket();
        if (!mounted || !connectedSocket) return;
        socket = connectedSocket;
        socket.on('message:new', handleUnreadChanged);
        socket.on('messages:unread-changed', handleUnreadChanged);
      } catch {
        // REST count remains the fallback if realtime is unavailable.
      }
    };

    connect();

    return () => {
      mounted = false;
      if (!socket) return;
      socket.off('message:new', handleUnreadChanged);
      socket.off('messages:unread-changed', handleUnreadChanged);
    };
  }, [role]);

  return (
    <aside className="workspace-sidebar" aria-label={`${t(isProvider ? 'serviceProvider' : 'client')} ${t('navigation')}`}>
      <Link to={isProvider ? '/dashboard' : '/client-dashboard'} className="workspace-brand">
        <img src={logo} alt="" draggable="false" className="workspace-brand-logo" />
        <span className="workspace-brand-wordmark"><strong>Serbisyo</strong><strong>Toledo</strong></span>
      </Link>

      <div className="workspace-role-card">
        <i className={`bi ${isProvider ? 'bi-person-workspace' : 'bi-person'}`} aria-hidden="true"></i>
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
            <i className={`bi ${item.icon}`} aria-hidden="true"></i>
            <span>{t(item.labelKey)}</span>
            {item.to === '/messages' && unreadMessages > 0 && (
              <span className="workspace-nav-badge" aria-label={String(unreadMessages) + ' ' + t('messagesUnread')}>
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {isProvider ? (
        <>
          <div className="workspace-nav-section-label">{t('profile')}</div>
          <nav className="workspace-nav workspace-nav-secondary">
            <button type="button" className="workspace-nav-link workspace-nav-action" onClick={onManageServiceProfile}>
              <i className={`bi ${hasServiceProfile ? 'bi-card-list' : 'bi-plus-circle'}`} aria-hidden="true"></i>
              <span>{t(hasServiceProfile ? 'serviceListing' : 'postServiceListing')}</span>
            </button>

            {hasServiceProfile && (
              <>
                <button type="button" className="workspace-nav-link workspace-nav-action" onClick={onEditProviderProfile}>
                  <i className="bi bi-person-lines-fill" aria-hidden="true"></i><span>{t('providerProfile')}</span>
                </button>
                <NavLink to="/provider-availability" className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}>
                  <i className="bi bi-calendar2-check" aria-hidden="true"></i><span>{t('providerSettingsNavAvailability')}</span>
                </NavLink>
                <NavLink to="/provider-credentials" className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}>
                  <i className="bi bi-patch-check" aria-hidden="true"></i><span>{t('credentials')}</span>
                </NavLink>
                {publicProfileRoute !== '/dashboard' && (
                  <Link
                    to={`${publicProfileRoute}${publicProfileRoute.includes('?') ? '&' : '?'}previewMode=desktop`}
                    className="workspace-nav-link"
                  >
                    <i className="bi bi-eye" aria-hidden="true"></i><span>{t('viewProfileAsClient')}</span>
                  </Link>
                )}
              </>
            )}
          </nav>
        </>
      ) : (
        <>
          <div className="workspace-nav-section-label">{t('profile')}</div>
          <nav className="workspace-nav workspace-nav-secondary">
            <button type="button" className="workspace-nav-link workspace-nav-action" onClick={onEditClientProfile}>
              <i className="bi bi-pencil-square" aria-hidden="true"></i><span>{t('editProfile')}</span>
            </button>
          </nav>
        </>
      )}

      <div className="workspace-sidebar-spacer" />
      <div className="workspace-sidebar-divider" />

      <nav className="workspace-nav workspace-nav-secondary">
        <NavLink to={isProvider ? '/provider-settings' : '/client-settings'} className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}>
          <i className="bi bi-gear" aria-hidden="true"></i><span>{t('settings')}</span>
        </NavLink>
      </nav>
    </aside>
  );
}
