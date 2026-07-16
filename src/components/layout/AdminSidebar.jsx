import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  CSidebar,
  CSidebarBrand,
  CSidebarNav,
  CNavItem,
  CNavTitle,
  CBadge
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilSpeedometer,
  cilPeople,
  cilCheckCircle,
  cilFile,
  cilSettings,
  cilAccountLogout,
  cilHome
} from '@coreui/icons';
import { adminAPI, authAPI } from '../../services/api';
import '@coreui/coreui/dist/css/coreui.min.css';
import '../../styles/AdminSidebar.css';
import logo from '../../assets/logo.png';

function AdminSidebar({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const [activeReports, setActiveReports] = useState(0);

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    const fetchSidebarCounts = async () => {
      try {
        const [verificationResponse, reportsResponse] = await Promise.all([
          adminAPI.getVerificationRequests(),
          adminAPI.getReports()
        ]);

        if (verificationResponse.success) {
          const pending = (verificationResponse.data || []).filter(
            (request) => request.status === 'pending'
          ).length;
          setPendingVerifications(pending);
        }

        if (reportsResponse.success) {
          const active = (reportsResponse.data || []).filter(
            (report) => ['pending', 'under_review'].includes(report.status)
          ).length;
          setActiveReports(active);
        }
      } catch {
        setPendingVerifications(0);
        setActiveReports(0);
      }
    };

    fetchSidebarCounts();
  }, [location.pathname]);

  const handleLogout = async () => {
    await authAPI.logout();
    window.dispatchEvent(new Event('authChange'));
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Mobile overlay */}
      <div 
        className={`sidebar-overlay ${isOpen ? 'show' : ''}`} 
        onClick={onClose}
      />

      <CSidebar 
        className={`admin-sidebar-coreui ${isOpen ? 'show' : ''}`}
        visible={true}
      >
        <CSidebarBrand className="sidebar-brand-custom">
          <div className="brand-logo-wrapper">
            <img src={logo} alt="SerbisyoToledo" className="brand-logo-img" />
          </div>
          <button className="sidebar-close-btn d-lg-none" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </CSidebarBrand>

        <CSidebarNav>
          <CNavTitle>Main Navigation</CNavTitle>
          
          <CNavItem>
            <NavLink 
              to="/admin/dashboard" 
              className={`nav-link ${isActive('/admin/dashboard') ? 'active' : ''}`}
              onClick={() => window.innerWidth < 992 && onClose()}
            >
              <CIcon customClassName="nav-icon" icon={cilSpeedometer} />
              Dashboard
            </NavLink>
          </CNavItem>

          <CNavTitle>Management</CNavTitle>

          <CNavItem>
            <NavLink 
              to="/admin/users" 
              className={`nav-link ${isActive('/admin/users') ? 'active' : ''}`}
              onClick={() => window.innerWidth < 992 && onClose()}
            >
              <CIcon customClassName="nav-icon" icon={cilPeople} />
              Users
            </NavLink>
          </CNavItem>

          <CNavItem>
            <NavLink 
              to="/admin/verifications" 
              className={`nav-link ${isActive('/admin/verifications') ? 'active' : ''}`}
              onClick={() => window.innerWidth < 992 && onClose()}
            >
              <CIcon customClassName="nav-icon" icon={cilCheckCircle} />
              Verifications
              <CBadge color="success" className="ms-auto">{pendingVerifications}</CBadge>
            </NavLink>
          </CNavItem>

          <CNavItem>
            <NavLink 
              to="/admin/reports" 
              className={`nav-link ${isActive('/admin/reports') ? 'active' : ''}`}
              onClick={() => window.innerWidth < 992 && onClose()}
            >
              <CIcon customClassName="nav-icon" icon={cilFile} />
              Reports
              <CBadge color="danger" className="ms-auto">{activeReports}</CBadge>
            </NavLink>
          </CNavItem>

          <CNavTitle>System</CNavTitle>

          <CNavItem>
            <NavLink 
              to="/admin/settings" 
              className={`nav-link ${isActive('/admin/settings') ? 'active' : ''}`}
              onClick={() => window.innerWidth < 992 && onClose()}
            >
              <CIcon customClassName="nav-icon" icon={cilSettings} />
              Settings
            </NavLink>
          </CNavItem>

          <div className="sidebar-footer-section">
            <CNavItem>
              <button 
                className="nav-link logout-btn"
                onClick={handleLogout}
              >
                <CIcon customClassName="nav-icon" icon={cilAccountLogout} />
                Logout
              </button>
            </CNavItem>
          </div>
        </CSidebarNav>
      </CSidebar>
    </>
  );
}

export default AdminSidebar;
