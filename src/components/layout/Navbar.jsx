import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import logo from '../../assets/logo.png';

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
            
            <li className="nav-item">
              <NavLink 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                to="/feed"
              >
                Browse Services
              </NavLink>
            </li>
          </ul>
          
          <div className="navbar-actions d-flex align-items-center gap-3 ms-lg-4">
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
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;