import { getUser } from '../../services/api';
import ThemeToggle from '../common/ThemeToggle';
import '../../styles/AdminNavbar.css';

function AdminNavbar({ onToggleSidebar, isSidebarOpen = false }) {
  const user = getUser();

  const getInitials = (name) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <nav className="admin-navbar">
      <div className="admin-navbar-left">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle admin sidebar"
          aria-expanded={isSidebarOpen}
          aria-controls="admin-sidebar"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="admin-navbar-right">
        <ThemeToggle compact className="admin-theme-toggle" />
        <div className="admin-profile-panel" aria-label="Signed in administrator">
          <div className="admin-avatar">
            {getInitials(user?.fullName || 'Admin')}
          </div>
          <span className="admin-name">{user?.fullName || 'Admin'}</span>
        </div>
      </div>
    </nav>
  );
}

export default AdminNavbar;
