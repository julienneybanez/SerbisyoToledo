import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsFlash from '../../components/settings/SettingsFlash';
import { adminAPI, API_BASE_URL } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import '../../styles/AdminPages.css';

function AdminSettings() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [flash, setFlash] = useState({ type: 'info', message: '' });

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [health, setHealth] = useState({ status: 'unknown', timestamp: null, database: 'unknown', message: '' });

  const loadOperationalData = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setFlash({ type: 'info', message: '' });

    const [statsResult, usersResult, verificationsResult, reportsResult, healthResult] = await Promise.allSettled([
      adminAPI.getDashboardStats(),
      adminAPI.getAllUsers(),
      adminAPI.getVerificationRequests(),
      adminAPI.getReports(),
      fetch(`${API_BASE_URL}/health`).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}`);
        }

        return response.json();
      }),
    ]);

    let failures = 0;

    if (statsResult.status === 'fulfilled' && statsResult.value.success) {
      setStats(statsResult.value.data);
    } else {
      failures += 1;
    }

    if (usersResult.status === 'fulfilled' && usersResult.value.success) {
      setUsers(usersResult.value.data || []);
    } else {
      failures += 1;
    }

    if (verificationsResult.status === 'fulfilled' && verificationsResult.value.success) {
      setVerificationRequests(verificationsResult.value.data || []);
    } else {
      failures += 1;
    }

    if (reportsResult.status === 'fulfilled' && reportsResult.value.success) {
      setReports(reportsResult.value.data || []);
    } else {
      failures += 1;
    }

    if (healthResult.status === 'fulfilled') {
      const payload = healthResult.value || {};
      const resolvedStatus =
        payload.status ||
        (payload.success === true ? 'healthy' : payload.success === false ? 'unhealthy' : 'unknown');

      setHealth({
        status: resolvedStatus,
        timestamp: payload.timestamp || payload.generatedAt || new Date().toISOString(),
        database: payload.database || 'unknown',
        message: payload.message || '',
      });
    } else {
      failures += 1;
      setHealth({ status: 'unavailable', timestamp: null, database: 'unknown', message: '' });
    }

    if (failures === 0 && silent) {
      setFlash({ type: 'success', message: t('adminOperationalDataRefreshed') });
    } else if (failures > 0) {
      setFlash({
        type: 'error',
        message: t('adminOperationalDataPartialError'),
      });
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, [t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOperationalData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadOperationalData]);

  const derivedStatus = useMemo(() => {
    const suspendedUsers = users.filter((user) => !user.isActive).length;
    const unverifiedProviders = users.filter(
      (user) => user.type === 'tradesperson' && !user.isVerified
    ).length;

    const pendingVerifications = verificationRequests.filter((req) => req.status === 'pending').length;
    const rejectedVerifications = verificationRequests.filter((req) => req.status === 'rejected').length;

    const reportPending = reports.filter((report) => report.status === 'pending').length;
    const reportReview = reports.filter((report) => report.status === 'under_review').length;

    return {
      suspendedUsers,
      unverifiedProviders,
      pendingVerifications,
      rejectedVerifications,
      reportPending,
      reportReview,
    };
  }, [reports, users, verificationRequests]);

  const exportSnapshot = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      health,
      stats,
      derivedStatus,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-settings-snapshot-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setFlash({ type: 'success', message: t('adminOperationalSnapshotExported') });
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">{t('adminSettings')}</h1>
        <p className="admin-page-subtitle">{t('adminSettingsSubtitle')}</p>
      </div>

      <div className="settings-layout">
        <div className="settings-nav">
          <button
            className={`settings-nav-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveSection('overview')}
          >
            {t('adminOverview')}
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'moderation' ? 'active' : ''}`}
            onClick={() => setActiveSection('moderation')}
          >
            {t('adminModeration')}
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'security' ? 'active' : ''}`}
            onClick={() => setActiveSection('security')}
          >
            {t('adminSecurityHealth')}
          </button>
        </div>

        <div className="settings-content">
          <SettingsFlash type={flash.type} message={flash.message} />

          {activeSection === 'overview' && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t('adminPlatformOperationsOverview')}</h2>

              <div className="settings-inline-actions">
                <button className="btn-save" onClick={() => loadOperationalData({ silent: true })} disabled={isLoading || isRefreshing}>
                  {isRefreshing ? t('adminRefreshing') : t('adminRefreshMetrics')}
                </button>
                <button className="btn-cancel" onClick={exportSnapshot} disabled={isLoading}>
                  {t('adminExportSnapshotJson')}
                </button>
              </div>

              <div className="settings-stat-grid" style={{ marginTop: '1rem' }}>
                <div className="settings-stat-card">
                  <h4>{stats?.totalUsers ?? '-'}</h4>
                  <p>{t('totalUsers')}</p>
                </div>
                <div className="settings-stat-card">
                  <h4>{stats?.totalTradespersons ?? '-'}</h4>
                  <p>{t('serviceProviders')}</p>
                </div>
                <div className="settings-stat-card">
                  <h4>{stats?.pendingVerifications ?? '-'}</h4>
                  <p>{t('pendingVerifications')}</p>
                </div>
                <div className="settings-stat-card">
                  <h4>{stats?.activeReports ?? '-'}</h4>
                  <p>{t('activeReports')}</p>
                </div>
              </div>

              <div className="settings-card">
                <h3>{t('adminLiveTotals')}</h3>
                <table className="settings-status-table">
                  <tbody>
                    <tr>
                      <td>{t('clients')}</td>
                      <td>{stats?.totalClients ?? '-'}</td>
                    </tr>
                    <tr>
                      <td>{t('admins')}</td>
                      <td>{stats?.totalAdmins ?? '-'}</td>
                    </tr>
                    <tr>
                      <td>{t('verifiedProviders')}</td>
                      <td>{stats?.verifiedProviders ?? '-'}</td>
                    </tr>
                    <tr>
                      <td>{t('adminSuspendedUsers')}</td>
                      <td>{derivedStatus.suspendedUsers}</td>
                    </tr>
                    <tr>
                      <td>{t('adminUnverifiedProviders')}</td>
                      <td>{derivedStatus.unverifiedProviders}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'moderation' && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t('adminModerationQueues')}</h2>

              <div className="settings-stat-grid">
                <div className="settings-stat-card">
                  <h4>{derivedStatus.pendingVerifications}</h4>
                  <p>{t('adminVerificationRequestsPending')}</p>
                </div>
                <div className="settings-stat-card">
                  <h4>{derivedStatus.rejectedVerifications}</h4>
                  <p>{t('adminRejectedVerificationRequests')}</p>
                </div>
                <div className="settings-stat-card">
                  <h4>{derivedStatus.reportPending}</h4>
                  <p>{t('adminReportsPending')}</p>
                </div>
                <div className="settings-stat-card">
                  <h4>{derivedStatus.reportReview}</h4>
                  <p>{t('adminReportsUnderReview')}</p>
                </div>
              </div>

              <div className="settings-card">
                <h3>{t('adminModerationActions')}</h3>
                <p>{t('adminModerationActionsHelp')}</p>
                <div className="settings-inline-actions">
                  <button className="btn-save" onClick={() => navigate('/admin/verifications')}>
                    {t('adminOpenVerificationQueue')}
                  </button>
                  <button className="btn-save" onClick={() => navigate('/admin/reports')}>
                    {t('adminOpenReportsQueue')}
                  </button>
                  <button className="btn-save" onClick={() => navigate('/admin/users')}>
                    {t('adminOpenUserManagement')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t('adminSecurityHealthStatus')}</h2>

              <div className="settings-card">
                <h3>{t('adminApiHealth')}</h3>
                <table className="settings-status-table">
                  <tbody>
                    <tr>
                      <td>{t('statusLabel')}</td>
                      <td>{health.status || 'unknown'}</td>
                    </tr>
                    <tr>
                      <td>{t('adminTimestamp')}</td>
                      <td>{health.timestamp ? new Date(health.timestamp).toLocaleString() : t('adminNotAvailable')}</td>
                    </tr>
                    <tr>
                      <td>{t('adminEndpoint')}</td>
                      <td>/api/health</td>
                    </tr>
                    <tr>
                      <td>{t('adminDatabase')}</td>
                      <td>{health.database || 'unknown'}</td>
                    </tr>
                  </tbody>
                </table>
                {health.message && <p style={{ marginTop: '0.75rem' }}>{health.message}</p>}
              </div>

              <div className="settings-card">
                <h3>{t('adminOperationalNotes')}</h3>
                <p>{t('adminOperationalNotesLine1')}</p>
                <p>{t('adminOperationalNotesLine2')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminSettings;
