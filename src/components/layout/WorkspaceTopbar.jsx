import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clearAuthSession, getUser } from '../../services/api';
import NotificationDropdown from '../common/NotificationDropdown';
import ThemeToggle from '../common/ThemeToggle';

const TITLES = {
  '/client-dashboard': 'Dashboard',
  '/feed': 'Browse Services',
  '/requests': 'Requests',
  '/notifications': 'Notifications',
  '/client-settings': 'Settings',
  '/dashboard': 'Dashboard',
  '/provider-schedule': 'Schedule',
  '/provider-availability': 'Availability',
  '/provider-credentials': 'Profile & Credentials',
  '/provider-settings': 'Settings',
};

export default function WorkspaceTopbar({ role }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const title = useMemo(() => TITLES[location.pathname] || 'Workspace', [location.pathname]);
  const settingsPath = role === 'tradesperson' ? '/provider-settings' : '/client-settings';

  const handleLogout = () => {
    clearAuthSession({ preserveRedirect: false });
    window.dispatchEvent(new Event('authChange'));
    navigate('/');
  };

  return (
    <header className="workspace-topbar">
      <div className="workspace-topbar-title-group">
        <span className="workspace-topbar-kicker">{role === 'tradesperson' ? 'Provider workspace' : 'Client workspace'}</span>
        <h1>{title}</h1>
      </div>
      <div className="workspace-topbar-actions">
        <NotificationDropdown />
        <ThemeToggle compact className="workspace-theme-toggle" />
        <button type="button" className="workspace-account-button" onClick={() => navigate(settingsPath)} aria-label="Open account settings">
          <span className="workspace-topbar-avatar" aria-hidden="true">
            {user?.profileImage ? <img src={user.profileImage} alt="" draggable="false" /> : (user?.fullName || 'U').slice(0, 1).toUpperCase()}
          </span>
          <span className="workspace-topbar-name">{user?.fullName || 'Account'}</span>
          <i className="bi bi-chevron-right" aria-hidden="true"></i>
        </button>
        <button type="button" className="workspace-logout-button" onClick={handleLogout} aria-label="Log out" title="Log out">
          <i className="bi bi-box-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </header>
  );
}
