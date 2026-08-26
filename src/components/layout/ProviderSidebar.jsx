import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

const PRIMARY_ITEMS = [
  { key: 'dashboard', to: '/dashboard', labelKey: 'dashboardShort', icon: 'bi-speedometer2' },
  { key: 'requests', to: '/requests', labelKey: 'requests', icon: 'bi-inbox' },
  { key: 'settings', to: '/provider-settings', labelKey: 'settings', icon: 'bi-gear' },
];

const QUICK_ITEMS = [
  { key: 'schedule', to: '/provider-settings?section=schedule', labelKey: 'schedule', icon: 'bi-calendar3' },
  { key: 'profile-details', to: '/provider-settings?section=profile', labelKey: 'providerSettingsNavProfileDetails', icon: 'bi-person-vcard' },
];

function ProviderSidebar({ hasServiceProfile = false, publicProfileRoute = '/dashboard' }) {
  const location = useLocation();
  const { t } = useLanguage();

  const isPrimaryActive = (item) => {
    if (item.key === 'settings') {
      return location.pathname === '/provider-settings';
    }
    return location.pathname === item.to;
  };

  return (
    <aside className="provider-workspace-sidebar" aria-label={`${t('serviceProvider')} navigation`}>
      <div className="provider-workspace-sidebar-heading">
        <span className="provider-workspace-sidebar-icon" aria-hidden="true">
          <i className="bi bi-tools"></i>
        </span>
        <span>{t('serviceProvider')}</span>
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
        {QUICK_ITEMS.map((item) => (
          <Link key={item.key} to={item.to} className="provider-workspace-quick-link">
            <i className={`bi ${item.icon}`} aria-hidden="true"></i>
            <span>{t(item.labelKey)}</span>
          </Link>
        ))}

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
