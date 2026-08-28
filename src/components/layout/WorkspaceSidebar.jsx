import { Link, NavLink } from 'react-router-dom';
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

export default function WorkspaceSidebar({
  role,
  hasServiceProfile = false,
  publicProfileRoute = '/dashboard',
  onEditClientProfile,
  onEditProviderProfile,
  onManageServiceProfile,
}) {
  const isProvider = role === 'tradesperson';
  const items = ROLE_ITEMS[role] || ROLE_ITEMS.client;

  return (
    <aside className="workspace-sidebar" aria-label={`${isProvider ? 'Service provider' : 'Client'} workspace navigation`}>
      <Link to={isProvider ? '/dashboard' : '/client-dashboard'} className="workspace-brand">
        <img src={logo} alt="" draggable="false" className="workspace-brand-logo" />
        <span className="workspace-brand-wordmark"><strong>Serbisyo</strong><strong>Toledo</strong></span>
      </Link>

      <div className="workspace-role-card">
        <i className={`bi ${isProvider ? 'bi-person-workspace' : 'bi-person'}`} aria-hidden="true"></i>
        <strong>{isProvider ? 'Service Provider' : 'Client'}</strong>
      </div>

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
        {!isProvider && (
          <button type="button" className="workspace-nav-link workspace-nav-action" onClick={onEditClientProfile}>
            <i className="bi bi-pencil-square" aria-hidden="true"></i><span>Edit Profile</span>
          </button>
        )}
        {isProvider && (
          <>
            <button type="button" className="workspace-nav-link workspace-nav-action" onClick={onManageServiceProfile}>
              <i className={`bi ${hasServiceProfile ? 'bi-card-list' : 'bi-plus-circle'}`} aria-hidden="true"></i>
              <span>{hasServiceProfile ? 'Edit Service Listing' : 'Post Service Listing'}</span>
            </button>
            <button type="button" className="workspace-nav-link workspace-nav-action" onClick={onEditProviderProfile}>
              <i className="bi bi-person-lines-fill" aria-hidden="true"></i><span>Profile & About Me</span>
            </button>
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
