import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { serviceRequestAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

const ROLE_ITEMS = {
  guest: [
    { to: '/', labelKey: 'home', icon: 'bi-house-door' },
    { to: '/feed', labelKey: 'browseShort', icon: 'bi-search' },
    { to: '/login', labelKey: 'authAccessShort', icon: 'bi-person' },
  ],
  client: [
    { to: '/', labelKey: 'home', icon: 'bi-house-door' },
    { to: '/feed', labelKey: 'browseShort', icon: 'bi-search' },
    { to: '/requests', labelKey: 'myBookings', icon: 'bi-inbox' },
    { action: 'edit-profile', labelKey: 'profile', icon: 'bi-person' },
  ],
  tradesperson: [
    { to: '/dashboard', labelKey: 'dashboardShort', icon: 'bi-speedometer2' },
    { to: '/requests', labelKey: 'requests', icon: 'bi-inbox' },
    { to: '/provider-schedule', labelKey: 'schedule', icon: 'bi-calendar3' },
    { action: 'profile-menu', labelKey: 'profile', icon: 'bi-person-circle' },
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
  const { t } = useLanguage();
  const [pendingRequests, setPendingRequests] = useState(0);
  const items = useMemo(() => ROLE_ITEMS[role] || ROLE_ITEMS.client, [role]);

  useEffect(() => {
    let mounted = true;

    const loadPending = async () => {
      if (role !== 'tradesperson') {
        if (mounted) setPendingRequests(0);
        return;
      }

      try {
        const response = await serviceRequestAPI.getProviderRequests();
        if (!mounted || !response?.success) {
          return;
        }

        const pending = (response.data.requests || []).filter((req) => req.status === 'pending').length;
        setPendingRequests(pending);
      } catch {
        if (mounted) {
          setPendingRequests(0);
        }
      }
    };

    loadPending();

    return () => {
      mounted = false;
    };
  }, [role]);

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => {
        const label = t(item.labelKey || item.label || '');

        if (item.action === 'profile-menu' || item.action === 'edit-profile') {
          return (
          <button
            key={label}
            type="button"
            className={`mobile-bottom-nav-item mobile-bottom-nav-action ${profileMenuOpen ? 'active' : ''}`}
            onClick={onProfileTap}
            aria-label={item.action === 'edit-profile' ? t('editProfile') : t('openProfileMenu')}
            aria-pressed={profileMenuOpen}
          >
            <span className="mobile-bottom-nav-icon-wrap">
              <i className={`bi ${item.icon}`} aria-hidden="true"></i>
            </span>
            <span className="mobile-bottom-nav-label">{label}</span>
          </button>
          );
        }

        return (
          <NavLink
            key={label}
            to={item.to}
            className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="mobile-bottom-nav-icon-wrap">
              <i className={`bi ${item.icon}`} aria-hidden="true"></i>
              {role === 'tradesperson' && item.labelKey === 'requests' && pendingRequests > 0 && (
                <span className="mobile-bottom-nav-badge" aria-label={`${pendingRequests} pending requests`}>
                  {pendingRequests > 99 ? '99+' : pendingRequests}
                </span>
              )}
            </span>
            <span className="mobile-bottom-nav-label">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
