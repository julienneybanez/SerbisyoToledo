import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, removeToken } from '../../services/api';
import '../../styles/AdminNavbar.css';

function AdminNavbar({ onToggleSidebar }) {
  const navigate = useNavigate();
  const user = getUser();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    // No logout action needed per request
  };

  const getInitials = (name) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <nav className="admin-navbar">
      <div className="admin-navbar-left">
        <button className="sidebar-toggle" onClick={onToggleSidebar}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div className="admin-brand">
          <span className="brand-serbisyo">Serbisyo</span>
          <span className="brand-toledo">Toledo</span>
          <span className="brand-admin">Admin</span>
        </div>
      </div>

      <div className="admin-navbar-right">
        <button className="admin-notification-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span className="notification-badge">3</span>
        </button>

        <div className="admin-profile-dropdown">
          <div className="admin-profile-btn">
            <div className="admin-avatar">
              {getInitials(user?.fullName || 'Admin')}
            </div>
            <span className="admin-name">{user?.fullName || 'Admin'}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default AdminNavbar;
