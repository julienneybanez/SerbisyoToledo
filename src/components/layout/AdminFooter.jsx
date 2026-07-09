import { Link } from 'react-router-dom';
import '../../styles/AdminFooter.css';
import logo from '../../assets/logo.png';

function AdminFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="admin-footer">
      <div className="admin-footer-container">
        <div className="footer-left">
          <div className="footer-brand">
            <div className="brand-logo">
              <img src={logo} alt="SerbisyoToledo" className="footer-logo-img" />
            </div>
            <span className="brand-name">
              Serbisyo<span className="highlight">Toledo</span>
            </span>
          </div>
          <span className="admin-label">Admin Portal</span>
        </div>

        <div className="footer-center">
          <nav className="footer-nav">
            <Link to="/admin/dashboard" className="footer-link">Dashboard</Link>
            <span className="separator">•</span>
            <Link to="/admin/users" className="footer-link">Users</Link>
            <span className="separator">•</span>
            <Link to="/admin/settings" className="footer-link">Settings</Link>
            <span className="separator">•</span>
            <Link to="/" className="footer-link">View Site</Link>
          </nav>
        </div>

        <div className="footer-right">
          <div className="footer-stats">
            <div className="stat-item">
              <span className="stat-dot online"></span>
              <span className="stat-text">System Online</span>
            </div>
          </div>
          <span className="footer-copyright">
            © {currentYear} SerbisyoToledo. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}

export default AdminFooter;
