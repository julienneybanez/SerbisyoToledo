import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, getUser } from '../../services/api';
import NotificationDropdown from '../common/NotificationDropdown';
import ThemeToggle from '../common/ThemeToggle';
import { useLanguage } from '../../context/LanguageContext';

export default function WorkspaceTopbar({ role }) {
  const navigate = useNavigate();
  const user = getUser();
  const { language, setLanguage, t } = useLanguage();
  const [searchValue, setSearchValue] = useState('');
  const settingsPath = role === 'tradesperson' ? '/provider-settings' : '/client-settings';
  const searchTarget = role === 'tradesperson' ? '/requests' : '/feed';
  const searchPlaceholder = language === 'ceb' ? 'Pangita...' : 'Search...';

  const handleLogout = async () => {
    await authAPI.logout();
    navigate('/');
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const query = searchValue.trim();
    if (!query) {
      navigate(searchTarget);
      return;
    }
    navigate(`${searchTarget}?search=${encodeURIComponent(query)}`);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ceb' : 'en');
  };

  return (
    <header className="workspace-topbar">
      <form className="workspace-topbar-search" role="search" onSubmit={handleSearch}>
        <i className="bi bi-search" aria-hidden="true"></i>
        <input
          type="search"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder.replace('...', '')}
        />
      </form>

      <div className="workspace-topbar-actions">
        <button
          type="button"
          className="workspace-language-button"
          onClick={toggleLanguage}
          aria-label={language === 'en' ? 'Switch to Cebuano' : 'Switch to English'}
        >
          {language === 'en' ? 'EN' : 'CEB'}
        </button>
        <NotificationDropdown />
        <ThemeToggle className="workspace-theme-toggle" />
        <button type="button" className="workspace-account-button" onClick={() => navigate(settingsPath)} aria-label="Open account settings">
          <span className="workspace-topbar-avatar" aria-hidden="true">
            {user?.profileImage ? <img src={user.profileImage} alt="" draggable="false" /> : (user?.fullName || 'U').slice(0, 1).toUpperCase()}
          </span>
          <span className="workspace-topbar-name">{user?.fullName || (role === 'tradesperson' ? t('serviceProvider') : t('client'))}</span>
          <i className="bi bi-chevron-down" aria-hidden="true"></i>
        </button>
        <button type="button" className="workspace-logout-button" onClick={handleLogout} aria-label="Log out" title="Log out">
          <i className="bi bi-box-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </header>
  );
}
