import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useTheme } from '../../context/ThemeContext';

const TITLES = [
  { test: (path) => path === '/', title: 'Home' },
  { test: (path) => path.startsWith('/feed'), title: 'Browse Services' },
  { test: (path) => path.startsWith('/provider/'), title: 'Provider Profile' },
  { test: (path) => path.startsWith('/requests'), title: 'Requests' },
  { test: (path) => path.startsWith('/dashboard'), title: 'Dashboard' },
  { test: (path) => path.startsWith('/provider-settings'), title: 'Provider Settings' },
  { test: (path) => path.startsWith('/client-settings'), title: 'Settings' },
  { test: (path) => path.startsWith('/admin/dashboard'), title: 'Admin Dashboard' },
  { test: (path) => path.startsWith('/admin/users'), title: 'Manage Users' },
  { test: (path) => path.startsWith('/admin/verifications'), title: 'Verifications' },
  { test: (path) => path.startsWith('/admin/reports'), title: 'Reports' },
  { test: (path) => path.startsWith('/admin/settings'), title: 'Admin Settings' },
];

function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getTitle(pathname) {
  const match = TITLES.find((item) => item.test(pathname));
  return match ? match.title : 'SerbisyoToledo';
}

export default function MobileTopBar({
  user,
  role = 'client',
  onMenu,
  profileRoute,
  settingsRoute,
  onLogout,
  profileMenuOpen,
  onToggleProfileMenu,
  onCloseProfileMenu,
  onEditClientProfile,
  hasServiceProfile = false,
  onEditProviderProfile,
  onManageServiceProfile,
  onRequestVerification,
  onPreviewProfile,
}) {
  const location = useLocation();
  const menuRef = useRef(null);
  const { isDark, toggleTheme } = useTheme();
  const title = getTitle(location.pathname);
  const notificationsRoute = role === 'admin' ? '/admin/reports' : '/requests';

  useEffect(() => {
    onCloseProfileMenu?.();
  }, [location.pathname, onCloseProfileMenu]);

  useEffect(() => {
    if (!profileMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onCloseProfileMenu?.();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCloseProfileMenu?.();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCloseProfileMenu, profileMenuOpen]);

  return (
    <header className="mobile-topbar" role="banner">
      <div className="mobile-topbar-left">
        {role === 'admin' && (
          <button
            type="button"
            className="mobile-topbar-icon-btn"
            onClick={onMenu}
            aria-label="Open menu"
          >
            <i className="bi bi-list"></i>
          </button>
        )}
        <div className="mobile-topbar-brand">
          <span className="mobile-topbar-mark" aria-hidden="true">
            <img src={logo} alt="" className="mobile-topbar-logo" />
          </span>
          <div>
            <p className="mobile-topbar-title">{title}</p>
            <p className="mobile-topbar-subtitle">SerbisyoToledo</p>
          </div>
        </div>
      </div>

      <div className="mobile-topbar-actions">
        <button
          type="button"
          className="mobile-topbar-icon-btn mobile-theme-icon-btn"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <i className={`bi ${isDark ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`}></i>
        </button>
        <Link to={notificationsRoute} className="mobile-topbar-icon-btn" aria-label="Open notifications">
          <i className="bi bi-bell"></i>
        </Link>
        <button
          type="button"
          className="mobile-topbar-avatar"
          aria-label="Open profile menu"
          aria-expanded={profileMenuOpen}
          onClick={onToggleProfileMenu}
        >
          {user?.profileImage ? (
            <img src={user.profileImage} alt="Profile" className="mobile-topbar-avatar-img" />
          ) : (
            getInitials(user?.fullName)
          )}
        </button>

        {profileMenuOpen && (
          <div ref={menuRef} className="mobile-profile-menu" role="menu" aria-label="Mobile profile menu">
            {role === 'tradesperson' ? (
              <>
                <button
                  type="button"
                  className="mobile-profile-menu-item"
                  role="menuitem"
                  onClick={onEditProviderProfile}
                >
                  <i className="bi bi-pencil-square"></i>
                  Edit Profile
                </button>
                <button
                  type="button"
                  className="mobile-profile-menu-item"
                  role="menuitem"
                  onClick={onManageServiceProfile}
                >
                  <i className={`bi ${hasServiceProfile ? 'bi-images' : 'bi-plus-circle'}`}></i>
                  {hasServiceProfile ? 'Edit Service Profile' : 'Post Service Profile'}
                </button>
                <button
                  type="button"
                  className="mobile-profile-menu-item"
                  role="menuitem"
                  onClick={onRequestVerification}
                >
                  <i className="bi bi-shield-check"></i>
                  Request Verification
                </button>
                <button
                  type="button"
                  className="mobile-profile-menu-item"
                  role="menuitem"
                  onClick={hasServiceProfile ? onPreviewProfile : onManageServiceProfile}
                >
                  <i className="bi bi-eye"></i>
                  {hasServiceProfile ? 'View Profile as Client' : 'View Profile as Client (Post first)'}
                </button>
              </>
            ) : (
              <button type="button" className="mobile-profile-menu-item" role="menuitem" onClick={onEditClientProfile}>
                <i className="bi bi-pencil-square"></i>
                Edit Profile
              </button>
            )}
            <Link to={settingsRoute} className="mobile-profile-menu-item" role="menuitem" onClick={onCloseProfileMenu}>
              <i className="bi bi-gear"></i>
              Settings
            </Link>
            <button type="button" className="mobile-profile-menu-item danger" role="menuitem" onClick={onLogout}>
              <i className="bi bi-box-arrow-right"></i>
              Log Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
