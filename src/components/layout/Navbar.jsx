/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { authAPI, isAuthenticated, getUser, serviceProfileAPI } from '../../services/api';
import NotificationDropdown from '../common/NotificationDropdown';
import EditProfileModal from '../common/EditProfileModal';
import EditPortfolioModal from '../common/EditPortfolioModal';
import ServiceProfileModal from '../common/ServiceProfileModal';
import ThemeToggle from '../common/ThemeToggle';
import { useLanguage } from '../../context/LanguageContext';
import logo from '../../assets/logo.png';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const navbarRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(() => isAuthenticated());
  const [user, setUser] = useState(() => getUser());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditPortfolio, setShowEditPortfolio] = useState(false);
  const [showServiceProfileForm, setShowServiceProfileForm] = useState(false);
  const [hasServiceProfile, setHasServiceProfile] = useState(false);
  const [providerPublicProfileRoute, setProviderPublicProfileRoute] = useState('/dashboard');
  const { language, setLanguage, t } = useLanguage();

  const providerListingLabel = t(hasServiceProfile ? 'serviceListing' : 'postServiceListing');
  const providerPortfolioLabel = t('providerProfile');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;

    const checkServiceProfileStatus = async () => {
      if (!loggedIn || user?.userType !== 'tradesperson') {
        if (isMounted) {
          setHasServiceProfile(false);
          setProviderPublicProfileRoute('/dashboard');
        }
        return;
      }

      try {
        const response = await serviceProfileAPI.getMyProfile();
        if (isMounted) {
          const hasProfile = Boolean(response?.success && response?.data?.id);
          setHasServiceProfile(hasProfile);
          setProviderPublicProfileRoute(hasProfile && response.data.isPublished ? `/provider/${response.data.id}` : '/dashboard');
        }
      } catch {
        if (isMounted) {
          setHasServiceProfile(false);
          setProviderPublicProfileRoute('/dashboard');
        }
      }
    };

    checkServiceProfileStatus();

    return () => {
      isMounted = false;
    };
  }, [loggedIn, user?.id, user?.userType]);

  useEffect(() => {
    const checkAuth = () => {
      setLoggedIn(isAuthenticated());
      setUser(getUser());
    };

    const handleOpenProviderEditProfile = () => {
      const authUser = getUser();
      if (isAuthenticated() && authUser?.userType === 'tradesperson') {
        setDropdownOpen(false);
        setShowEditPortfolio(true);
      }
    };

    const handleCloseProviderEditProfile = () => {
      setShowEditPortfolio(false);
    };

    window.addEventListener('storage', checkAuth);
    window.addEventListener('authChange', checkAuth);
    window.addEventListener('guidedTour:openProviderEditProfile', handleOpenProviderEditProfile);
    window.addEventListener('guidedTour:closeProviderEditProfile', handleCloseProviderEditProfile);

    const handleDocumentPointerDown = (event) => {
      if (navbarRef.current && !navbarRef.current.contains(event.target)) {
        setDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };

    const handleDocumentKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown);
    document.addEventListener('keydown', handleDocumentKeyDown);

    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('authChange', checkAuth);
      window.removeEventListener('guidedTour:openProviderEditProfile', handleOpenProviderEditProfile);
      window.removeEventListener('guidedTour:closeProviderEditProfile', handleCloseProviderEditProfile);
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    await authAPI.logout();
    setLoggedIn(false);
    setUser(null);
    setDropdownOpen(false);
    navigate('/');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleNavClick = () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  const isProvider = loggedIn && user?.userType === 'tradesperson';
  const isAdmin = loggedIn && user?.userType === 'admin';
  const isClient = loggedIn && user?.userType === 'client';
  const brandDestination = isProvider ? '/dashboard' : '/';
  const settingsRoute = isProvider
    ? '/provider-settings'
    : isAdmin
      ? '/admin/settings'
      : '/client-settings';

  return (
    <nav ref={navbarRef} className={`navbar navbar-expand-lg ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="container navbar-shell">
        <Link className="navbar-brand brand-link d-flex align-items-center" to={brandDestination} onClick={handleNavClick}>
          <div className="logo-wrapper" aria-hidden="true">
            <img src={logo} alt="" width="34" height="34" className="non-draggable-image" draggable="false" />
          </div>
          <div className="brand-text" aria-label="SerbisyoToledo">
            <span className="brand-name">Serbisyo</span><span className="brand-location">Toledo</span>
          </div>
        </Link>

        <button
          className={`navbar-toggler ${mobileMenuOpen ? 'is-open' : ''}`}
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={t('toggleNavigation')}
          aria-expanded={mobileMenuOpen}
          aria-controls="serbisyo-navbar"
        >
          <span className="navbar-toggler-icon" aria-hidden="true"></span>
        </button>

        <div id="serbisyo-navbar" className={`collapse navbar-collapse ${mobileMenuOpen ? 'show' : ''}`}>
          <ul className="navbar-nav primary-nav ms-lg-auto align-items-lg-center gap-lg-2">
            {!loggedIn && (
              <li className="nav-item">
                <NavLink
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  to="/"
                  onClick={handleNavClick}
                >
                  {t('home')}
                </NavLink>
              </li>
            )}
            {!loggedIn && (
              <li className="nav-item">
                <NavLink
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  to="/about"
                  onClick={handleNavClick}
                >
                  {t('about')}
                </NavLink>
              </li>
            )}
            {!loggedIn && (
              <li className="nav-item">
                <NavLink
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  to="/feed"
                  onClick={handleNavClick}
                >
                  {t('browseServices')}
                </NavLink>
              </li>
            )}

            {isProvider && (
              <>
                <li className="nav-item">
                  <NavLink
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    to="/dashboard"
                    onClick={handleNavClick}
                  >
                    {t('myDashboard')}
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    to="/requests"
                    data-tour="nav-requests"
                    onClick={handleNavClick}
                  >
                    {t('requests')}
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    to="/provider-schedule"
                    onClick={handleNavClick}
                  >
                    {t('schedule')}
                  </NavLink>
                </li>
              </>
            )}

            {isClient && (
              <>
                <li className="nav-item">
                  <NavLink
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    to="/feed"
                    onClick={handleNavClick}
                  >
                    {t('browseServices')}
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    to="/requests"
                    data-tour="nav-requests"
                    onClick={handleNavClick}
                  >
                    {t('myBookings')}
                  </NavLink>
                </li>
              </>
            )}

            {isAdmin && (
              <li className="nav-item">
                <NavLink
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  to="/admin/dashboard"
                  onClick={handleNavClick}
                >
                  {t('myDashboard')}
                </NavLink>
              </li>
            )}
          </ul>

          <div className="navbar-actions ms-lg-4">
            {loggedIn ? (
              <div className="auth-block logged-in-block">
                <div className="notification-wrap">
                  <NotificationDropdown />
                </div>
                <div className="profile-dropdown">
                  <button
                    className="profile-avatar-btn"
                    onClick={() => setDropdownOpen((open) => !open)}
                    aria-label={t('profileMenuAria')}
                    aria-expanded={dropdownOpen}
                  >
                    {user?.profileImage ? (
                      <img
                        src={user.profileImage}
                        alt={t('profileImageAlt')}
                        className="profile-avatar-img"
                        draggable="false"
                      />
                    ) : (
                      <div className="profile-avatar-placeholder">
                        {getInitials(user?.fullName)}
                      </div>
                    )}
                  </button>

                  {dropdownOpen && (
                    <div className="profile-dropdown-menu" role="menu" aria-label={t('profileMenuAria')}>
                      <div className="dropdown-user-info">
                        <span className="dropdown-user-name" title={user?.fullName || t('profileFallbackUser')}>
                          {user?.fullName}
                        </span>
                        <span className="dropdown-user-type">
                          {isProvider ? t('serviceProvider') : isAdmin ? t('admin') : t('client')}
                        </span>
                      </div>
                      <hr className="dropdown-divider" />

                      {isClient && (
                        <button
                          className="dropdown-item"
                          onClick={() => {
                            setDropdownOpen(false);
                            setShowEditProfile(true);
                          }}
                        >
                          <i className="bi bi-pencil-square"></i>
                          {t('editProfile')}
                        </button>
                      )}

                      {isProvider && hasServiceProfile && providerPublicProfileRoute !== '/dashboard' && (
                        <Link
                          to={providerPublicProfileRoute}
                          state={{ previewMode: window.innerWidth <= 768 ? 'mobile' : 'web' }}
                          className="dropdown-item"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <i className="bi bi-eye"></i>
                          {t('viewProfileAsClient')}
                        </Link>
                      )}

                      {isProvider && (
                        <button
                          className="dropdown-item"
                          onClick={() => {
                            setDropdownOpen(false);
                            setShowServiceProfileForm(true);
                          }}
                        >
                          <i className={`bi ${hasServiceProfile ? 'bi-card-list' : 'bi-plus-circle'}`}></i>
                          {providerListingLabel}
                        </button>
                      )}

                      {isProvider && (
                        <button
                          className="dropdown-item"
                          onClick={() => {
                            setDropdownOpen(false);
                            setShowEditPortfolio(true);
                          }}
                        >
                          <i className="bi bi-images"></i>
                          {providerPortfolioLabel}
                        </button>
                      )}

                      <Link
                        to={settingsRoute}
                        className="dropdown-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <i className="bi bi-gear"></i>
                        {isClient ? t('clientSettings') : isAdmin ? (language === 'ceb' ? 'Status sa System' : 'System Status') : t('settings')}
                      </Link>

                      <hr className="dropdown-divider" />
                      <div className="dropdown-preferences" role="group" aria-label={t('displayPreferences')}>
                        <label className="dropdown-pref-label" htmlFor="navbar-language-select">{t('language')}</label>
                        <select
                          id="navbar-language-select"
                          className="dropdown-language-select"
                          value={language}
                          onChange={(event) => setLanguage(event.target.value)}
                          aria-label={t('language')}
                        >
                          <option value="en">EN</option>
                          <option value="ceb">CEB</option>
                        </select>
                        <ThemeToggle compact className="dropdown-theme-toggle" />
                      </div>

                      <hr className="dropdown-divider" />
                      <button
                        className="dropdown-item logout-item"
                        onClick={handleLogout}
                      >
                        <i className="bi bi-box-arrow-right"></i>
                        {t('logOut')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="auth-block logged-out-block">
                <select
                  className="form-select navbar-language-select"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  aria-label={t('language')}
                >
                  <option value="en">EN</option>
                  <option value="ceb">CEB</option>
                </select>
                <ThemeToggle compact className="navbar-theme-toggle" />
                <NavLink
                  to="/login"
                  className={({ isActive }) => `btn btn-outline-primary login-btn ${isActive ? 'active-btn' : ''}`}
                  onClick={handleNavClick}
                >
                  {t('logIn')}
                </NavLink>
                <NavLink
                  to="/register"
                  className={({ isActive }) => `btn btn-primary signup-btn ${isActive ? 'active-btn' : ''}`}
                  onClick={handleNavClick}
                >
                  {t('signUp')}
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditProfile && (
        <EditProfileModal
          onClose={() => setShowEditProfile(false)}
          onProfileUpdated={() => {
            setShowEditProfile(false);
          }}
        />
      )}

      {showEditPortfolio && (
        <EditPortfolioModal
          onClose={() => setShowEditPortfolio(false)}
        />
      )}

      {showServiceProfileForm && (
        <ServiceProfileModal
          onClose={() => setShowServiceProfileForm(false)}
        />
      )}
    </nav>
  );
}

export default Navbar;
