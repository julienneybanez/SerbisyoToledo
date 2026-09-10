import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { messageAPI, serviceRequestAPI } from '../../services/api';
import { connectMessagingSocket } from '../../services/socket';
import { useLanguage } from '../../context/LanguageContext';

const ROLE_ITEMS = {
  guest: [
    { to: '/', labelKey: 'home', icon: 'bi-house-door' },
    { to: '/feed', labelKey: 'browseShort', icon: 'bi-search' },
    { to: '/login', labelKey: 'authAccessShort', icon: 'bi-person' },
  ],
  client: [
    { to: '/client-dashboard', labelKey: 'home', icon: 'bi-house-door' },
    { to: '/feed', labelKey: 'browseShort', icon: 'bi-search' },
    { to: '/requests', labelKey: 'myBookings', icon: 'bi-inbox' },
    { to: '/messages', labelKey: 'messages', icon: 'bi-chat-dots' },
    { action: 'edit-profile', labelKey: 'profile', icon: 'bi-person' },
  ],
  tradesperson: [
    { to: '/dashboard', labelKey: 'dashboardShort', icon: 'bi-speedometer2' },
    { to: '/requests', labelKey: 'requests', icon: 'bi-inbox' },
    { to: '/provider-schedule', labelEn: 'Calendar', labelCeb: 'Kalendaryo', icon: 'bi-calendar3' },
    { to: '/messages', labelKey: 'messages', icon: 'bi-chat-dots' },
    { to: '/provider-credentials', labelKey: 'profile', icon: 'bi-person-vcard' },
  ],
  admin: [
    { to: '/admin/dashboard', labelKey: 'dashboardShort', icon: 'bi-speedometer2' },
    { to: '/admin/users', labelKey: 'usersShort', icon: 'bi-people' },
    { to: '/admin/verifications', labelKey: 'verifyShort', icon: 'bi-patch-check' },
    { to: '/admin/reports', labelKey: 'reports', icon: 'bi-flag' },
    { to: '/admin/settings', labelKey: 'more', icon: 'bi-three-dots' },
  ],
};

export default function MobileBottomNav({ role = 'client', profileMenuOpen = false, onProfileTap }) {
  const { t, language } = useLanguage();
  const [pendingRequests, setPendingRequests] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const items = useMemo(() => ROLE_ITEMS[role] || ROLE_ITEMS.client, [role]);

  useEffect(() => {
    if (role !== 'tradesperson') return undefined;
    let mounted = true;
    serviceRequestAPI.getProviderRequests()
      .then((response) => {
        if (!mounted || !response?.success) return;
        setPendingRequests((response.data.requests || []).filter((request) => request.status === 'pending').length);
      })
      .catch(() => mounted && setPendingRequests(0));
    return () => { mounted = false; };
  }, [role]);

  useEffect(() => {
    if (!['client', 'tradesperson'].includes(role)) return undefined;
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

    loadUnread();
    const handleUnreadChanged = () => loadUnread();
    connectMessagingSocket()
      .then((connectedSocket) => {
        if (!mounted || !connectedSocket) return;
        socket = connectedSocket;
        socket.on('messages:unread-changed', handleUnreadChanged);
        socket.on('message:new', handleUnreadChanged);
      })
      .catch(() => {});

    return () => {
      mounted = false;
      if (!socket) return;
      socket.off('messages:unread-changed', handleUnreadChanged);
      socket.off('message:new', handleUnreadChanged);
    };
  }, [role]);

  const labelFor = (item) => item.labelKey ? t(item.labelKey) : (language === 'ceb' ? item.labelCeb : item.labelEn);

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => {
        const label = labelFor(item);

        if (item.action === 'edit-profile') {
          return (
            <button
              key={label}
              type="button"
              className={`mobile-bottom-nav-item mobile-bottom-nav-action ${profileMenuOpen ? 'active' : ''}`}
              onClick={onProfileTap}
              aria-label={t('editProfile')}
              aria-pressed={profileMenuOpen}
            >
              <span className="mobile-bottom-nav-icon-wrap"><i className={`bi ${item.icon}`} aria-hidden="true" /></span>
              <span className="mobile-bottom-nav-label">{label}</span>
            </button>
          );
        }

        return (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
            <span className="mobile-bottom-nav-icon-wrap">
              <i className={`bi ${item.icon}`} aria-hidden="true" />
              {role === 'tradesperson' && item.to === '/requests' && pendingRequests > 0 && (
                <span className="mobile-bottom-nav-badge" aria-label={`${pendingRequests} pending requests`}>{pendingRequests > 99 ? '99+' : pendingRequests}</span>
              )}
              {item.to === '/messages' && unreadMessages > 0 && (
                <span className="mobile-bottom-nav-badge" aria-label={`${unreadMessages} unread messages`}>{unreadMessages > 99 ? '99+' : unreadMessages}</span>
              )}
            </span>
            <span className="mobile-bottom-nav-label">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
