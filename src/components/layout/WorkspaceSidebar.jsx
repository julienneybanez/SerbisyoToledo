import { Link, NavLink } from 'react-router-dom';
import { getUser } from '../../services/api';
import logo from '../../assets/logo.png';

const ROLE_ITEMS = {
  client: [
    { to: '/client-dashboard', label: 'Dashboard', icon: 'bi-grid-1x2' },
    { to: '/feed', label: 'Browse Services', icon: 'bi-search' },
    { to: '/requests', label: 'My Requests', icon: 'bi-inbox' },
    { to: '/notifications', label: 'Notifications', icon: 'bi-bell' },
  ],
  tradesperson: [
    { to: '/dashboard', label: 'Dashboard', icon: 'bi-grid-1x2' },
    { to: '/requests', label: 'Requests', icon: 'bi-inbox' },
    { to: '/provider-schedule', label: 'Schedule', icon: 'bi-calendar3' },
    { to: '/notifications', label: 'Notifications', icon: 'bi-bell' },
  ],
};

function initials(name, fallback) {
  if (!name) return fallback;
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export default function WorkspaceSidebar({ role, hasServiceProfile = false, publicProfileRoute = '/dashboard' }) {
  const user = getUser();
  const isProvider = role === 'tradesperson';
  const items = ROLE_ITEMS[role] || ROLE_ITEMS.client;
  const name = user?.fullName || (isProvider ? 'Service Provider' : 'Client');

  return (
    <aside className="workspace-sidebar" aria-label={`${isProvider ? 'Service provider' : 'Client'} workspace navigation`}>
      <Link to={isProvider ? '/dashboard' : '/client-dashboard'} className="workspace-brand">
        <img src={logo} alt="" draggable="false" className="workspace-brand-logo" />
        <span className="workspace-brand-wordmark"><strong>Serbisyo</strong><strong>Toledo</strong></span>
      </Link>

      {isProvider ? (
        <div className="workspace-role-card">
          <i className="bi bi-person-workspace" aria-hidden="true"></i>
          <strong>Service Provider</strong>
        </div>
      ) : (
        <div className="workspace-account-card">
          <span className="workspace-account-avatar" aria-hidden="true">
            {user?.profileImage ? <img src={user.profileImage} alt="" draggable="false" /> : initials(name, 'CL')}
          </span>
          <span className="workspace-account-copy">
            <strong title={name}>{name}</strong>
            <small>Client</small>
          </span>
        </div>
      )}

      <nav className="workspace-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}
            data-tour={item.to === '/requests' ? 'nav-requests' : undefined}
          >
            <i className={`bi ${item.icon}`} aria-hidden="true"></i>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="workspace-sidebar-spacer" />
      <div className="workspace-sidebar-divider" />

      <nav className="workspace-nav workspace-nav-secondary">
        {isProvider && (
          <>
            <NavLink to="/provider-availability" className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}>
              <i className="bi bi-calendar2-check" aria-hidden="true"></i><span>Availability</span>
            </NavLink>
            <NavLink to="/provider-credentials" className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}>
              <i className="bi bi-translate" aria-hidden="true"></i><span>Language & Credentials</span>
            </NavLink>
          </>
        )}
        <NavLink to={isProvider ? '/provider-settings' : '/client-settings'} className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}>
          <i className="bi bi-gear" aria-hidden="true"></i><span>Settings</span>
        </NavLink>
        {isProvider && hasServiceProfile && publicProfileRoute !== '/dashboard' && (
          <Link
            to={`${publicProfileRoute}${publicProfileRoute.includes('?') ? '&' : '?'}previewMode=desktop`}
            className="workspace-nav-link"
          >
            <i className="bi bi-eye" aria-hidden="true"></i><span>Preview Provider Page</span>
          </Link>
        )}
      </nav>
    </aside>
  );
}
