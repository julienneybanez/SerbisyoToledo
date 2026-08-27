import { useCallback, useEffect, useState } from 'react';
import SettingsFlash from '../../components/settings/SettingsFlash';
import { AppButton, PageHeader } from '../../components/ui';
import { API_BASE_URL } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import '../../styles/AdminPages.css';

function AdminSettings() {
  const { language, t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [flash, setFlash] = useState({ type: 'info', message: '' });
  const [health, setHealth] = useState({
    status: 'unknown',
    timestamp: null,
    database: 'unknown',
    message: '',
  });

  const pageTitle = language === 'ceb' ? 'Status sa System' : 'System Status';
  const pageSubtitle = language === 'ceb'
    ? 'Tan-awa kung available ang SerbisyoToledo API ug database.'
    : 'Check whether the SerbisyoToledo API and database are available.';
  const refreshLabel = language === 'ceb' ? 'I-refresh ang Status' : 'Refresh Status';
  const refreshingLabel = language === 'ceb' ? 'Nag-refresh...' : 'Refreshing...';

  const loadHealth = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setFlash({ type: 'info', message: '' });

    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      const payload = await response.json();
      const resolvedStatus =
        payload.status
        || (payload.success === true ? 'healthy' : payload.success === false ? 'unhealthy' : 'unknown');

      setHealth({
        status: resolvedStatus,
        timestamp: payload.timestamp || payload.generatedAt || new Date().toISOString(),
        database: payload.database || 'unknown',
        message: payload.message || '',
      });

      if (silent) {
        setFlash({ type: 'success', message: t('adminOperationalDataRefreshed') });
      }
    } catch {
      setHealth({
        status: 'unavailable',
        timestamp: null,
        database: 'unknown',
        message: '',
      });
      setFlash({
        type: 'error',
        message: t('adminOperationalDataPartialError'),
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  return (
    <div className="admin-page">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        className="admin-page-header"
        titleClassName="admin-page-title"
        subtitleClassName="admin-page-subtitle"
      />

      <div className="settings-content">
        <SettingsFlash type={flash.type} message={flash.message} />

        <div className="settings-section">
          <div className="settings-inline-actions">
            <AppButton
              className="btn-save"
              onClick={() => loadHealth({ silent: true })}
              disabled={isLoading || isRefreshing}
            >
              {isRefreshing ? refreshingLabel : refreshLabel}
            </AppButton>
          </div>

          <div className="settings-card" style={{ marginTop: '1rem' }}>
            <h3>{t('adminApiHealth')}</h3>
            <table className="settings-status-table">
              <tbody>
                <tr>
                  <td>{t('statusLabel')}</td>
                  <td>{isLoading ? t('loading') : health.status || 'unknown'}</td>
                </tr>
                <tr>
                  <td>{t('adminDatabase')}</td>
                  <td>{isLoading ? t('loading') : health.database || 'unknown'}</td>
                </tr>
                <tr>
                  <td>{t('adminTimestamp')}</td>
                  <td>
                    {health.timestamp
                      ? new Date(health.timestamp).toLocaleString()
                      : t('adminNotAvailable')}
                  </td>
                </tr>
                <tr>
                  <td>{t('adminEndpoint')}</td>
                  <td>/api/health</td>
                </tr>
              </tbody>
            </table>
            {health.message && <p style={{ marginTop: '0.75rem' }}>{health.message}</p>}
          </div>

          <div className="settings-card">
            <h3>{t('adminOperationalNotes')}</h3>
            <p>
              {language === 'ceb'
                ? 'Read-only kini nga page. Ang user management, verification, ug reports naa gihapon sa ilang kaugalingong admin pages.'
                : 'This page is read-only. User management, verifications, and reports remain in their dedicated admin pages.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminSettings;
