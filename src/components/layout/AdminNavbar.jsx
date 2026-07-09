import { getUser } from '../../services/api';
import '../../styles/AdminNavbar.css';

function AdminNavbar({ onToggleSidebar }) {
  const user = getUser();

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
