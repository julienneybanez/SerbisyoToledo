import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { serviceRequestAPI } from '../../services/api';

const ROLE_ITEMS = {
  guest: [
    { to: '/', label: 'Home', icon: 'bi-house-door' },
    { to: '/feed', label: 'Browse', icon: 'bi-search' },
    { to: '/login', label: 'Log In', icon: 'bi-box-arrow-in-right' },
    { to: '/register', label: 'Sign Up', icon: 'bi-person-plus' },
  ],
  client: [
    { to: '/', label: 'Home', icon: 'bi-house-door' },
    { to: '/feed', label: 'Browse', icon: 'bi-search' },
    { to: '/requests', label: 'Requests', icon: 'bi-inbox' },
    { action: 'edit-profile', label: 'Profile', icon: 'bi-person' },
  ],
  tradesperson: [
    { to: '/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
    { to: '/requests', label: 'Requests', icon: 'bi-inbox' },
    { action: 'profile-menu', label: 'Profile', icon: 'bi-person-circle' },
    { to: '/provider-settings', label: 'Settings', icon: 'bi-gear' },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
    { to: '/admin/users', label: 'Users', icon: 'bi-people' },
    { to: '/admin/verifications', label: 'Verify', icon: 'bi-patch-check' },
    { to: '/admin/reports', label: 'Reports', icon: 'bi-flag' },
    { to: '/admin/settings', label: 'More', icon: 'bi-three-dots' },
  ],
};

export default function MobileBottomNav({ role = 'client', profileMenuOpen = false, onProfileTap }) {
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
      {items.map((item) => (
        item.action === 'profile-menu' || item.action === 'edit-profile' ? (
          <button
            key={item.label}
            type="button"
            className={`mobile-bottom-nav-item mobile-bottom-nav-action ${profileMenuOpen ? 'active' : ''}`}
            onClick={onProfileTap}
            aria-label={item.action === 'edit-profile' ? 'Edit profile' : 'Open profile menu'}
          >
            <span className="mobile-bottom-nav-icon-wrap">
              <i className={`bi ${item.icon}`} aria-hidden="true"></i>
            </span>
            <span className="mobile-bottom-nav-label">{item.label}</span>
          </button>
        ) : (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="mobile-bottom-nav-icon-wrap">
              <i className={`bi ${item.icon}`} aria-hidden="true"></i>
              {role === 'tradesperson' && item.label === 'Requests' && pendingRequests > 0 && (
                <span className="mobile-bottom-nav-badge" aria-label={`${pendingRequests} pending requests`}>
                  {pendingRequests > 9 ? '9+' : pendingRequests}
                </span>
              )}
            </span>
            <span className="mobile-bottom-nav-label">{item.label}</span>
          </NavLink>
        )
      ))}
    </nav>
  );
}
