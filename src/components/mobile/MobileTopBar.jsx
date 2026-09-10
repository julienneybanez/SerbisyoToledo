import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function getMobilePageTitle(pathname, role, t, language) {
  if (pathname === '/') return 'SerbisyoToledo';
  if (pathname === '/about') return t('about');
  if (pathname === '/feed') return t('browseServices');
  if (pathname === '/notifications') return t('notifications');
  if (pathname === '/messages') return t('messages');
  if (pathname === '/requests') return role === 'client' ? t('myBookings') : t('requests');
  if (pathname === '/client-dashboard' || pathname === '/dashboard') return t('dashboardShort');
  if (pathname === '/client-settings') return t('clientSettings');
  if (pathname === '/provider-settings') return t('settings');
  if (pathname === '/provider-schedule') return language === 'ceb' ? 'Kalendaryo' : 'Calendar';
  if (pathname === '/provider-availability') return t('providerSettingsNavAvailability');
  if (pathname === '/provider-credentials') return t('profile');
  if (pathname.startsWith('/provider/')) return t('providerProfile');
  if (pathname.startsWith('/admin/users')) return t('usersShort');
  if (pathname.startsWith('/admin/verifications')) return t('verifyShort');
  if (pathname.startsWith('/admin/credentials')) return t('credentials');
  if (pathname.startsWith('/admin/reports')) return t('reports');
  if (pathname.startsWith('/admin/settings')) return role === 'admin' ? 'System Status' : t('settings');
  if (pathname.startsWith('/admin')) return t('dashboardShort');
  if (pathname === '/login') return t('logIn');
  if (pathname === '/register') return t('signUp');
  return 'SerbisyoToledo';
}

export default function MobileTopBar({
  user,
  role = 'guest',
  onMenu,
  profileRoute = '/dashboard',
  settingsRoute,
  onLogout,
  profileMenuOpen,
  onToggleProfileMenu,
  onCloseProfileMenu,
  onEditClientProfile,
  hasServiceProfile = false,
  onPreviewProfile,
}) {
  const location = useLocation();
  const menuRef = useRef(null);
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const isLoggedIn = Boolean(user);
  const pageTitle = getMobilePageTitle(location.pathname, role, t, language);
  const notificationsRoute = !isLoggedIn ? '/login' : role === 'admin' ? '/admin/reports' : '/notifications';
  const adminSystemStatusLabel = language === 'ceb' ? 'Status sa System' : 'System Status';

  useEffect(() => {
    onCloseProfileMenu?.();
  }, [location.pathname, onCloseProfileMenu]);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) onCloseProfileMenu?.();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseProfileMenu?.();
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
          <button type="button" className="mobile-topbar-icon-btn" onClick={onMenu} aria-label={t('openMenu')}>
            <i className="bi bi-list" />
          </button>
        )}
        <div className="mobile-topbar-brand">
          <span className="mobile-topbar-mark" aria-hidden="true"><img src={logo} alt="" className="mobile-topbar-logo non-draggable-image" draggable="false" /></span>
          <div className="mobile-topbar-copy">
            {isLoggedIn ? (
              <>
                <p className="mobile-topbar-app-name">Serbisyo<span>Toledo</span></p>
                <p className="mobile-topbar-page-title">{pageTitle}</p>
              </>
            ) : (
              <p className="mobile-topbar-title mobile-brand-wordmark">Serbisyo<span>Toledo</span></p>
            )}
          </div>
        </div>
      </div>

      <div className="mobile-topbar-actions">
        {!isLoggedIn && (
          <>
            <select className="mobile-profile-language-select" value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={t('language')}>
              <option value="en">EN</option><option value="ceb">CEB</option>
            </select>
            <button type="button" className="mobile-topbar-icon-btn mobile-theme-icon-btn" onClick={toggleTheme} aria-label={t(isDark ? 'switchToLightMode' : 'switchToDarkMode')}>
              <i className={`bi ${isDark ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`} />
            </button>
          </>
        )}

        {isLoggedIn && (
          <>
            <Link to={notificationsRoute} className="mobile-topbar-icon-btn" aria-label={t('openNotifications')}><i className="bi bi-bell" /></Link>
            <button type="button" className="mobile-topbar-avatar" aria-label={t('openProfileMenu')} aria-expanded={profileMenuOpen} onClick={onToggleProfileMenu}>
              {user?.profileImage ? <img src={user.profileImage} alt={t('profileImageAlt')} className="mobile-topbar-avatar-img non-draggable-image" draggable="false" /> : getInitials(user?.fullName)}
            </button>
          </>
        )}

        {profileMenuOpen && (
          <div ref={menuRef} className="mobile-profile-menu" role="menu" aria-label={t('mobileProfileMenuAria')}>
            {!isLoggedIn ? (
              <>
                <Link to="/login" className="mobile-profile-menu-item" role="menuitem" onClick={onCloseProfileMenu}><i className="bi bi-box-arrow-in-right" />{t('logIn')}</Link>
                <Link to="/register" className="mobile-profile-menu-item" role="menuitem" onClick={onCloseProfileMenu}><i className="bi bi-person-plus" />{t('signUp')}</Link>
              </>
            ) : role === 'tradesperson' ? (
              <>
                <Link to="/provider-credentials" className="mobile-profile-menu-item" role="menuitem" onClick={onCloseProfileMenu}>
                  <i className="bi bi-person-vcard" />{t('profile')}
                </Link>
                <Link to="/provider-schedule?tab=availability" className="mobile-profile-menu-item" role="menuitem" onClick={onCloseProfileMenu}>
                  <i className="bi bi-calendar2-check" />{t('providerSettingsNavAvailability')}
                </Link>
                {hasServiceProfile && profileRoute !== '/dashboard' && (
                  <button type="button" className="mobile-profile-menu-item" role="menuitem" onClick={onPreviewProfile}>
                    <i className="bi bi-eye" />{t('viewProfileAsClient')}
                  </button>
                )}
              </>
            ) : role === 'client' ? (
              <button type="button" className="mobile-profile-menu-item" role="menuitem" onClick={onEditClientProfile}>
                <i className="bi bi-pencil-square" />{t('editProfile')}
              </button>
            ) : null}

            {isLoggedIn && (
              <>
                {role === 'admin' && (
                  <Link to="/" className="mobile-profile-menu-item" role="menuitem" onClick={onCloseProfileMenu}><i className="bi bi-box-arrow-up-right" />{language === 'ceb' ? 'Tan-awa ang Site' : 'View Site'}</Link>
                )}
                <Link to={settingsRoute} className="mobile-profile-menu-item" role="menuitem" onClick={onCloseProfileMenu}>
                  <i className="bi bi-gear" />{role === 'admin' ? adminSystemStatusLabel : role === 'client' ? t('clientSettings') : t('settings')}
                </Link>
                <div className="mobile-profile-menu-divider" role="none" />
                <div className="mobile-profile-preferences" role="group" aria-label={t('displayPreferences')}>
                  <label htmlFor="mobile-language-select" className="mobile-profile-preferences-label">{t('language')}</label>
                  <select id="mobile-language-select" className="mobile-profile-language-select" value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={t('language')}>
                    <option value="en">EN</option><option value="ceb">CEB</option>
                  </select>
                  <button type="button" className="mobile-profile-menu-item mobile-profile-theme-item" onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
                    <i className={`bi ${isDark ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`} />{isDark ? t('useLightTheme') : t('useDarkTheme')}
                  </button>
                </div>
                <div className="mobile-profile-menu-divider" role="none" />
                <button type="button" className="mobile-profile-menu-item danger" role="menuitem" onClick={onLogout}><i className="bi bi-box-arrow-right" />{t('logOut')}</button>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
