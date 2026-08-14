import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const TITLES = [
  { test: (path) => path === '/', key: 'home' },
  { test: (path) => path.startsWith('/feed'), key: 'browseServices' },
  { test: (path) => path.startsWith('/provider/'), key: 'providerProfile' },
  { test: (path) => path.startsWith('/requests'), key: 'requests' },
  { test: (path) => path.startsWith('/notifications'), key: 'notifications' },
  { test: (path) => path.startsWith('/dashboard'), key: 'myDashboard' },
  { test: (path) => path.startsWith('/provider-settings'), key: 'providerSettings' },
  { test: (path) => path.startsWith('/client-settings'), key: 'settings' },
  { test: (path) => path.startsWith('/admin/dashboard'), key: 'adminDashboard' },
  { test: (path) => path.startsWith('/admin/users'), key: 'manageUsers' },
  { test: (path) => path.startsWith('/admin/verifications'), key: 'verifications' },
  { test: (path) => path.startsWith('/admin/reports'), key: 'reports' },
  { test: (path) => path.startsWith('/admin/settings'), key: 'adminSettings' },
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

function getTitle(pathname, role, t) {
  if (pathname.startsWith('/requests') && role === 'client') {
    return t('myBookings');
  }

  const match = TITLES.find((item) => item.test(pathname));
  return match ? t(match.key) : 'SerbisyoToledo';
}

export default function MobileTopBar({
  user,
  role = 'guest',
  onMenu,
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
  const { language, setLanguage, t } = useLanguage();
  const title = getTitle(location.pathname, role, t);
  const isLoggedIn = Boolean(user);
  const notificationsRoute = !isLoggedIn
    ? '/login'
    : role === 'admin'
      ? '/admin/reports'
      : '/notifications';

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
            <img src={logo} alt="" className="mobile-topbar-logo non-draggable-image" draggable="false" />
          </span>
          <div>
            <p className="mobile-topbar-title">{title}</p>
            <p className="mobile-topbar-subtitle">SerbisyoToledo</p>
          </div>
        </div>
      </div>

      <div className="mobile-topbar-actions">
        {!isLoggedIn && (
          <>
            <select
              className="mobile-profile-language-select"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              aria-label={t('language')}
            >
              <option value="en">EN</option>
              <option value="ceb">CEB</option>
            </select>
            <button
              type="button"
              className="mobile-topbar-icon-btn mobile-theme-icon-btn"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <i className={`bi ${isDark ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`}></i>
            </button>
          </>
        )}
        {isLoggedIn && (
          <>
            <Link to={notificationsRoute} className="mobile-topbar-icon-btn" aria-label={t('openNotifications')}>
              <i className="bi bi-bell"></i>
            </Link>
            <button
              type="button"
              className="mobile-topbar-avatar"
              aria-label={t('openProfileMenu')}
              aria-expanded={profileMenuOpen}
              onClick={onToggleProfileMenu}
            >
              {user?.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="mobile-topbar-avatar-img non-draggable-image" draggable="false" />
              ) : (
                getInitials(user?.fullName)
              )}
            </button>
          </>
        )}

        {profileMenuOpen && (
          <div ref={menuRef} className="mobile-profile-menu" role="menu" aria-label="Mobile profile menu">
            {!isLoggedIn ? (
              <>
                <Link to="/login" className="mobile-profile-menu-item" role="menuitem" onClick={onCloseProfileMenu}>
                  <i className="bi bi-box-arrow-in-right"></i>
                  {t('logIn')}
                </Link>
                <Link to="/register" className="mobile-profile-menu-item" role="menuitem" onClick={onCloseProfileMenu}>
                  <i className="bi bi-person-plus"></i>
                  {t('signUp')}
                </Link>
              </>
            ) : role === 'tradesperson' ? (
              <>
                <button
                  type="button"
                  className="mobile-profile-menu-item"
                  role="menuitem"
                  onClick={onEditProviderProfile}
                >
                  <i className="bi bi-pencil-square"></i>
                  {t('manageProfile')}
                </button>
                <button
                  type="button"
                  className="mobile-profile-menu-item"
                  role="menuitem"
                  onClick={onManageServiceProfile}
                >
                  <i className={`bi ${hasServiceProfile ? 'bi-images' : 'bi-plus-circle'}`}></i>
                  {hasServiceProfile ? t('editServiceProfile') : t('postServiceProfile')}
                </button>
                <button
                  type="button"
                  className="mobile-profile-menu-item"
                  role="menuitem"
                  onClick={onRequestVerification}
                >
                  <i className="bi bi-shield-check"></i>
                  {t('verification')}
                </button>
                <button
                  type="button"
                  className="mobile-profile-menu-item"
                  role="menuitem"
                  onClick={hasServiceProfile ? onPreviewProfile : onManageServiceProfile}
                >
                  <i className="bi bi-eye"></i>
                  {hasServiceProfile ? t('viewPublicProfile') : t('viewProfilePostFirst')}
                </button>
              </>
            ) : (
              <button type="button" className="mobile-profile-menu-item" role="menuitem" onClick={onEditClientProfile}>
                <i className="bi bi-pencil-square"></i>
                {t('editProfile')}
              </button>
            )}
            {isLoggedIn && (
              <>
                <Link to={settingsRoute} className="mobile-profile-menu-item" role="menuitem" onClick={onCloseProfileMenu}>
                  <i className="bi bi-gear"></i>
                  {t('settings')}
                </Link>
                <div className="mobile-profile-menu-divider" role="none"></div>
                <div className="mobile-profile-preferences" role="group" aria-label="Display preferences">
                  <label htmlFor="mobile-language-select" className="mobile-profile-preferences-label">{t('language')}</label>
                  <select
                    id="mobile-language-select"
                    className="mobile-profile-language-select"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    aria-label={t('language')}
                  >
                    <option value="en">EN</option>
                    <option value="ceb">CEB</option>
                  </select>
                  <button
                    type="button"
                    className="mobile-profile-menu-item mobile-profile-theme-item"
                    onClick={toggleTheme}
                    aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    <i className={`bi ${isDark ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`}></i>
                    {isDark ? t('useLightTheme') : t('useDarkTheme')}
                  </button>
                </div>
                <div className="mobile-profile-menu-divider" role="none"></div>
                <button type="button" className="mobile-profile-menu-item danger" role="menuitem" onClick={onLogout}>
                  <i className="bi bi-box-arrow-right"></i>
                  {t('logOut')}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
