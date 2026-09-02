import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser } from '../../services/api';
import ThemeToggle from '../common/ThemeToggle';
import NotificationDropdown from '../common/NotificationDropdown';
import { useLanguage } from '../../context/LanguageContext';
import '../../styles/AdminNavbar.css';

function AdminNavbar({ onToggleSidebar, isSidebarOpen = false }) {
  const navigate = useNavigate();
  const user = getUser();
  const { language, setLanguage } = useLanguage();
  const [searchValue, setSearchValue] = useState('');
  const searchPlaceholder = language === 'ceb' ? 'Pangita...' : 'Search...';

  const getInitials = (name) => {
    if (!name) return 'A';
    return name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const query = searchValue.trim();
    navigate(query ? `/admin/users?search=${encodeURIComponent(query)}` : '/admin/users');
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

        <form className="admin-navbar-search" role="search" onSubmit={handleSearch}>
          <i className="bi bi-search" aria-hidden="true"></i>
          <input
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder.replace('...', '')}
          />
        </form>
      </div>

      <div className="admin-navbar-right">
        <button
          type="button"
          className="admin-language-button"
          onClick={() => setLanguage(language === 'en' ? 'ceb' : 'en')}
          aria-label={language === 'en' ? 'Switch to Cebuano' : 'Switch to English'}
        >
          {language === 'en' ? 'EN' : 'CEB'}
        </button>
        <NotificationDropdown />
        <ThemeToggle className="admin-theme-toggle" />
        <div className="admin-profile-panel" aria-label="Signed in administrator">
          <div className="admin-avatar">
            {getInitials(user?.fullName || 'Admin')}
          </div>
          <span className="admin-name">{user?.fullName || 'Admin'}</span>
          <i className="bi bi-chevron-down" aria-hidden="true"></i>
        </div>
      </div>
    </nav>
  );
}

export default AdminNavbar;
