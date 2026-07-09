import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { isAuthenticated, getUser, removeToken } from '../../services/api';
import NotificationDropdown from '../common/NotificationDropdown';
import EditProfileModal from '../common/EditProfileModal';
import EditPortfolioModal from '../common/EditPortfolioModal';
import VerificationRequestModal from '../common/VerificationRequestModal';
import logo from '../../assets/logo.png';

function Navbar() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showServiceProfile, setShowServiceProfile] = useState(false);
  const [showVerificationRequest, setShowVerificationRequest] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    
    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('authChange', checkAuth);
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

  return (
    <nav className={`navbar navbar-expand-lg ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center" to="/">
          <div className="logo-wrapper">
            <img src={logo} alt="Serbisyo Toledo Logo" width="45" height="45" />
          </div>
          <div className="brand-text ms-3">
            <div className="brand-name">Serbisyo</div>
            <div className="brand-location">Toledo</div>
          </div>
        </Link>

        <button 
          className="navbar-toggler" 
          type="button" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className={`collapse navbar-collapse ${mobileMenuOpen ? 'show' : ''}`}>
          <ul className="navbar-nav ms-lg-auto align-items-lg-center gap-lg-3">
            <li className="nav-item">
              <NavLink 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                to="/"
              >
                Home
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                to="/about"
              >
                About
              </NavLink>
            </li>
            
            {loggedIn && user?.userType === 'tradesperson' ? (
              <li className="nav-item">
                <NavLink 
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  to="/dashboard"
                >
                  My Dashboard
                </NavLink>
              </li>
            ) : (
              <li className="nav-item">
                <NavLink 
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  to="/feed"
                >
                  Browse Services
                </NavLink>
              </li>
            )}
          </ul>
          
          <div className="navbar-actions d-flex align-items-center gap-3 ms-lg-4">
            {loggedIn ? (
              <>
                <NavLink 
                  to="/requests" 
                  className={({ isActive }) => `nav-link requests-link ${isActive ? 'active' : ''}`}
                >
                  Requests
                </NavLink>
                <NotificationDropdown />
                <div className="profile-dropdown">
                  <button 
                    className="profile-avatar-btn"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    aria-label="Profile menu"
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
                    <div className="profile-dropdown-menu">
                      <div className="dropdown-user-info">
                        <span className="dropdown-user-name">{user?.fullName}</span>
                        <span className="dropdown-user-type">{user?.userType === 'tradesperson' ? 'Service Provider' : user?.userType === 'admin' ? 'Admin' : 'Client'}</span>
                      </div>
                      <hr className="dropdown-divider" />
                      <button 
                        className="dropdown-item"
                        onClick={() => {
                          setDropdownOpen(false);
                          if (user?.userType === 'tradesperson') {
                            setShowServiceProfile(true);
                          } else {
                            setShowEditProfile(true);
                          }
                        }}
                      >
                        <i className="bi bi-pencil-square"></i>
                        Edit Profile
                      </button>
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
              </>
            ) : (
              <>
                <NavLink 
                  to="/login" 
                  className={({ isActive }) => `btn btn-outline-primary login-btn ${isActive ? 'active-btn' : ''}`}
                >
                  Log In
                </NavLink>
                <NavLink 
                  to="/register" 
                  className={({ isActive }) => `btn btn-primary signup-btn ${isActive ? 'active-btn' : ''}`}
                >
                  Sign Up
                </NavLink>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <EditProfileModal 
          onClose={() => setShowEditProfile(false)}
          onProfileUpdated={() => {
            // Profile updates are handled via authChange event in the API
            setShowEditProfile(false);
          }}
        />
      )}

      {/* Edit Portfolio Modal (for tradesperson) */}
      {showServiceProfile && (
        <EditPortfolioModal 
          onClose={() => setShowServiceProfile(false)}
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