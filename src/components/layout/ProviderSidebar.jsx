import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { getUser } from '../../services/api';

const PRIMARY_ITEMS = [
  { key: 'dashboard', to: '/dashboard', labelKey: 'dashboardShort', icon: 'bi-speedometer2' },
  { key: 'requests', to: '/requests', labelKey: 'requests', icon: 'bi-inbox' },
  { key: 'schedule', to: '/provider-schedule', labelKey: 'schedule', icon: 'bi-calendar3' },
  { key: 'settings', to: '/provider-settings', labelKey: 'settings', icon: 'bi-gear' },
];

function getInitials(name) {
  if (!name) return 'SP';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function ProviderSidebar({ hasServiceProfile = false, publicProfileRoute = '/dashboard' }) {
  const location = useLocation();
  const { language, t } = useLanguage();
  const user = getUser();
  const providerName = user?.fullName || t('serviceProvider');

  const languagesCredentialsLabel = language === 'ceb'
    ? 'Mga Pinulongan ug Credentials'
    : 'Languages & Credentials';

  const isPrimaryActive = (item) => {
    return location.pathname === item.to;
  };

  return (
    <aside className="provider-workspace-sidebar" aria-label={`${t('serviceProvider')} navigation`}>
      <div className="provider-workspace-sidebar-heading">
        <span className="provider-workspace-sidebar-avatar" aria-hidden="true">
          {user?.profileImage ? (
            <img src={user.profileImage} alt="" draggable="false" />
          ) : (
            getInitials(providerName)
          )}
        </span>
        <span className="provider-workspace-sidebar-identity">
          <strong title={providerName}>{providerName}</strong>
          <small>{t('serviceProvider')}</small>
        </span>
      </div>

      <nav className="provider-workspace-nav" aria-label={t('serviceProvider')}>
        {PRIMARY_ITEMS.map((item) => {
          const active = isPrimaryActive(item);
          return (
            <Link
              key={item.key}
              to={item.to}
              className={`provider-workspace-nav-link ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
              data-tour={item.key === 'requests' ? 'nav-requests' : undefined}
            >
              <i className={`bi ${item.icon}`} aria-hidden="true"></i>
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="provider-workspace-sidebar-divider" aria-hidden="true"></div>

      <div className="provider-workspace-quick-links">
        <span className="provider-workspace-section-label">{t('more')}</span>

        <Link
          to="/provider-credentials"
          className={`provider-workspace-quick-link ${location.pathname === '/provider-credentials' ? 'active' : ''}`}
          aria-current={location.pathname === '/provider-credentials' ? 'page' : undefined}
        >
          <i className="bi bi-patch-check" aria-hidden="true"></i>
          <span>{languagesCredentialsLabel}</span>
        </Link>

        {hasServiceProfile && publicProfileRoute !== '/dashboard' && (
          <Link to={publicProfileRoute} className="provider-workspace-quick-link">
            <i className="bi bi-eye" aria-hidden="true"></i>
            <span>{t('viewPublicProfile')}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}

export default ProviderSidebar;
