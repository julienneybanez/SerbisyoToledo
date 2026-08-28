import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { adminAPI, authAPI } from '../../services/api';
import '../../styles/AdminSidebar.css';
import logo from '../../assets/logo.png';

const NAV_SECTIONS = [
  {
    title: 'Main Navigation',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
    ],
  },
  {
    title: 'Management',
    items: [
      { to: '/admin/users', label: 'Users', icon: 'bi-people' },
      { to: '/admin/verifications', label: 'Verification Requests', icon: 'bi-patch-check' },
      { to: '/admin/credentials', label: 'Provider Credential Reviews', icon: 'bi-person-badge' },
      { to: '/admin/reports', label: 'Reports', icon: 'bi-flag' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/admin/settings', label: 'System Status', icon: 'bi-activity' },
    ],
  },
];

function AdminSidebar({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const [pendingCredentials, setPendingCredentials] = useState(0);
  const [activeReports, setActiveReports] = useState(0);

  useEffect(() => {
    let mounted = true;

    const fetchSidebarCounts = async () => {
      try {
        const [verificationResponse, credentialResponse, reportsResponse] = await Promise.all([
          adminAPI.getVerificationRequests(),
          adminAPI.getProviderCredentials(),
          adminAPI.getReports(),
        ]);

        if (!mounted) return;

        if (verificationResponse.success) {
          setPendingVerifications((verificationResponse.data || []).filter(
            (request) => request.status === 'pending',
          ).length);
        }

        if (credentialResponse.success) {
          setPendingCredentials((credentialResponse.data || []).filter(
            (credential) => credential.verificationStatus === 'pending',
          ).length);
        }

        if (reportsResponse.success) {
          setActiveReports((reportsResponse.data || []).filter(
            (report) => ['pending', 'under_review'].includes(report.status),
          ).length);
        }
      } catch {
        if (mounted) {
          setPendingVerifications(0);
          setPendingCredentials(0);
          setActiveReports(0);
        }
      }
    };

    fetchSidebarCounts();
    return () => { mounted = false; };
  }, [location.pathname]);

  const closeOnMobile = () => {
    if (window.innerWidth < 992) onClose?.();
  };

  const handleLogout = async () => {
    await authAPI.logout();
    window.dispatchEvent(new Event('authChange'));
    navigate('/login', { replace: true });
  };

  const badgeFor = (path) => {
    if (path === '/admin/verifications') {
      return pendingVerifications > 0
        ? <span className="admin-nav-badge success">{pendingVerifications}</span>
        : null;
    }

    if (path === '/admin/credentials') {
      return pendingCredentials > 0
        ? <span className="admin-nav-badge success">{pendingCredentials}</span>
        : null;
    }

    if (path === '/admin/reports') {
      return activeReports > 0
        ? <span className="admin-nav-badge danger">{activeReports}</span>
        : null;
    }

    return null;
  };

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'show' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        id="admin-sidebar"
        className={`admin-sidebar ${isOpen ? 'show' : ''}`}
        aria-label="Admin sidebar"
      >
        <div className="sidebar-brand-custom">
          <NavLink to="/admin/dashboard" className="admin-sidebar-brand-link" onClick={closeOnMobile}>
            <img src={logo} alt="" className="brand-logo-img" draggable="false" />
            <span className="admin-sidebar-wordmark">
              <span><strong>Serbisyo</strong><strong>Toledo</strong></span>
              <small>Admin</small>
            </span>
          </NavLink>

          <button type="button" className="sidebar-close-btn" onClick={onClose} aria-label="Close sidebar">
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section) => (
            <div className="admin-nav-section" key={section.title}>
              <div className="nav-title">{section.title}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={closeOnMobile}
                >
                  <i className={`bi ${item.icon} nav-icon`} aria-hidden="true"></i>
                  <span>{item.label}</span>
                  {badgeFor(item.to)}
                </NavLink>
              ))}
            </div>
          ))}

          <div className="sidebar-footer-section">
            <button type="button" className="nav-link logout-btn" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right nav-icon" aria-hidden="true"></i>
              <span>Logout</span>
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}

export default AdminSidebar;
