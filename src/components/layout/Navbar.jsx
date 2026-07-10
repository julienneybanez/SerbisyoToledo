import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { isAuthenticated, getUser, removeToken, serviceProfileAPI } from '../../services/api';
import NotificationDropdown from '../common/NotificationDropdown';
import EditProfileModal from '../common/EditProfileModal';
import EditPortfolioModal from '../common/EditPortfolioModal';
import ServiceProfileModal from '../common/ServiceProfileModal';
import VerificationRequestModal from '../common/VerificationRequestModal';
import logo from '../../assets/logo.png';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const navbarRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditPortfolio, setShowEditPortfolio] = useState(false);
  const [showServiceProfileForm, setShowServiceProfileForm] = useState(false);
  const [hasServiceProfile, setHasServiceProfile] = useState(false);
  const [showVerificationRequest, setShowVerificationRequest] = useState(false);

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
        }
        return;
      }

      try {
        const response = await serviceProfileAPI.getMyProfile();
        if (isMounted) {
          setHasServiceProfile(Boolean(response?.success && response?.data?.id));
        }
      } catch (error) {
        if (isMounted) {
          setHasServiceProfile(false);
        }
      }
    };

    checkServiceProfileStatus();

    return () => {
      isMounted = false;
    };
  }, [loggedIn, user?.id, user?.userType]);

  // Check auth status on mount and when storage changes
  useEffect(() => {
    const checkAuth = () => {
      setLoggedIn(isAuthenticated());
      setUser(getUser());
    };
    
    checkAuth();
    
    // Listen for storage changes (login/logout from other tabs)
    window.addEventListener('storage', checkAuth);
    
    // Custom event for same-tab updates
    window.addEventListener('authChange', checkAuth);

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
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, []);

  const handleLogout = () => {
    removeToken();
    setLoggedIn(false);
    setUser(null);
    setDropdownOpen(false);
    window.dispatchEvent(new Event('authChange'));
    navigate('/');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  };

  const handleNavClick = () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <nav ref={navbarRef} className={`navbar navbar-expand-lg ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="container navbar-shell">
        <Link className="navbar-brand brand-link d-flex align-items-center" to="/" onClick={handleNavClick}>
          <div className="logo-wrapper" aria-hidden="true">
            <img src={logo} alt="" width="56" height="56" />
          </div>
          <div className="brand-text ms-3">
            <div className="brand-name">Serbisyo</div>
            <div className="brand-location">Toledo</div>
          </div>
        </Link>

        <button 
          className={`navbar-toggler ${mobileMenuOpen ? 'is-open' : ''}`} 
          type="button" 
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label="Toggle navigation"
          aria-expanded={mobileMenuOpen}
          aria-controls="serbisyo-navbar"
        >
          <span className="navbar-toggler-icon" aria-hidden="true"></span>
        </button>

        <div id="serbisyo-navbar" className={`collapse navbar-collapse ${mobileMenuOpen ? 'show' : ''}`}>
          <ul className="navbar-nav primary-nav ms-lg-auto align-items-lg-center gap-lg-2">
            <li className="nav-item">
              <NavLink 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                to="/"
                onClick={handleNavClick}
              >
                Home
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                to="/about"
                onClick={handleNavClick}
              >
                About
              </NavLink>
            </li>
            
            {loggedIn && user?.userType === 'tradesperson' ? (
              <li className="nav-item">
                <NavLink 
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  to="/dashboard"
                  onClick={handleNavClick}
                >
                  My Dashboard
                </NavLink>
              </li>
            ) : (
              <li className="nav-item">
                <NavLink 
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  to="/feed"
                  onClick={handleNavClick}
                >
                  Browse Services
                </NavLink>
              </li>
            )}
          </ul>
          
          <div className="navbar-actions ms-lg-4">
            {loggedIn ? (
              <div className="auth-block logged-in-block">
                <NavLink 
                  to="/requests" 
                  className={({ isActive }) => `nav-link requests-link ${isActive ? 'active' : ''}`}
                  data-tour="nav-requests"
                  onClick={handleNavClick}
                >
                  Requests
                </NavLink>
                <div className="notification-wrap">
                  <NotificationDropdown />
                </div>
                <div className="profile-dropdown">
                  <button 
                    className="profile-avatar-btn"
                    onClick={() => setDropdownOpen((open) => !open)}
                    aria-label="Profile menu"
                    aria-expanded={dropdownOpen}
                  >
                    {user?.profileImage ? (
                      <img 
                        src={user.profileImage} 
                        alt="Profile" 
                        className="profile-avatar-img"
                      />
                    ) : (
                      <div className="profile-avatar-placeholder">
                        {getInitials(user?.fullName)}
                      </div>
                    )}
                  </button>
                  {dropdownOpen && (
                    <div className="profile-dropdown-menu" role="menu" aria-label="Profile menu">
                      <div className="dropdown-user-info">
                        <span className="dropdown-user-name" title={user?.fullName || 'User'}>{user?.fullName}</span>
                        <span className="dropdown-user-type">{user?.userType === 'tradesperson' ? 'Service Provider' : user?.userType === 'admin' ? 'Admin' : 'Client'}</span>
                      </div>
                      <hr className="dropdown-divider" />
                      <button 
                        className="dropdown-item"
                        onClick={() => {
                          setDropdownOpen(false);
                          if (user?.userType === 'tradesperson') {
                            setShowEditPortfolio(true);
                          } else {
                            setShowEditProfile(true);
                          }
                        }}
                      >
                        <i className="bi bi-pencil-square"></i>
                        Edit Profile
                      </button>
                      {user?.userType === 'tradesperson' && hasServiceProfile && (
                        <button 
                          className="dropdown-item"
                          onClick={() => {
                            setDropdownOpen(false);
                            setShowServiceProfileForm(true);
                          }}
                        >
                          <i className="bi bi-images"></i>
                          Edit Service Profile
                        </button>
                      )}
                      {user?.userType === 'tradesperson' && !hasServiceProfile && (
                        <button 
                          className="dropdown-item"
                          onClick={() => {
                            setDropdownOpen(false);
                            setShowServiceProfileForm(true);
                          }}
                        >
                          <i className="bi bi-plus-circle"></i>
                          Post Service Profile
                        </button>
                      )}
                      {user?.userType === 'tradesperson' && (
                        <button
                          className="dropdown-item"
                          onClick={() => {
                            setDropdownOpen(false);
                            setShowVerificationRequest(true);
                          }}
                        >
                          <i className="bi bi-shield-check"></i>
                          Request Verification
                        </button>
                      )}
                      <Link 
                        to={user?.userType === 'tradesperson' ? '/provider-settings' : '/client-settings'} 
                        className="dropdown-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <i className="bi bi-gear"></i>
                        Settings
                      </Link>
                      <hr className="dropdown-divider" />
                      <button 
                        className="dropdown-item logout-item"
                        onClick={handleLogout}
                      >
                        <i className="bi bi-box-arrow-right"></i>
                        Log Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="auth-block logged-out-block">
                <NavLink 
                  to="/login" 
                  className={({ isActive }) => `btn btn-outline-primary login-btn ${isActive ? 'active-btn' : ''}`}
                  onClick={handleNavClick}
                >
                  Log In
                </NavLink>
                <NavLink 
                  to="/register" 
                  className={({ isActive }) => `btn btn-primary signup-btn ${isActive ? 'active-btn' : ''}`}
                  onClick={handleNavClick}
                >
                  Sign Up
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal (for clients) */}
      {showEditProfile && (
        <EditProfileModal 
          onClose={() => setShowEditProfile(false)}
          onProfileUpdated={() => {
            // Profile updates are handled via authChange event in the API
            setShowEditProfile(false);
          }}
        />
      )}

      {/* Edit Portfolio Modal (for tradesperson Edit Profile action) */}
      {showEditPortfolio && (
        <EditPortfolioModal 
          onClose={() => setShowEditPortfolio(false)}
        />
      )}

      {/* Service Profile Modal (for posted service profile editing) */}
      {showServiceProfileForm && (
        <ServiceProfileModal
          onClose={() => setShowServiceProfileForm(false)}
        />
      )}

      {showVerificationRequest && (
        <VerificationRequestModal
          onClose={() => setShowVerificationRequest(false)}
        />
      )}
    </nav>
  );
}

export default Navbar;