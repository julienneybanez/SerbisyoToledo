import { useCallback, useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { AppButton, AppInput, AppSelect, IconButton, PageHeader } from '../../components/ui';
import '../../styles/AdminPages.css';

function AdminUsers() {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [dialog, setDialog] = useState({
    open: false,
    title: '',
    lines: [],
    tone: 'info',
  });

  const openDialog = ({ title, lines, tone = 'info' }) => {
    setDialog({ open: true, title, lines: lines || [], tone });
  };

  const closeDialog = () => {
    setDialog((prev) => ({ ...prev, open: false }));
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminAPI.getAllUsers();
      if (response.success) {
        setUsers(response.data || []);
      }
    } catch (err) {
      setError(err.message || t('failedLoadUsers'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleViewDetails = async (userId) => {
    try {
      const response = await adminAPI.getUserById(userId);
      if (response.success) {
        const u = response.data;
        openDialog({
          title: t('adminUserDetailsOverview'),
          lines: [
            `${t('fullName')}: ${u.name}`,
            `${t('emailLabel')}: ${u.email}`,
            `${t('adminType')}: ${u.type}`,
            `${t('profession')}: ${u.profession || t('adminNotAvailableShort')}`,
            `${t('phoneLabel')}: ${u.phone || t('adminNotAvailableShort')}`,
            `${t('address')}: ${u.address || t('adminNotAvailableShort')}`,
            `${t('verified')}: ${u.isVerified ? t('adminYes') : t('adminNo')}`,
            `${t('active')}: ${u.isActive ? t('adminYes') : t('adminNo')}`,
          ],
        });
      }
    } catch (err) {
      openDialog({
        title: t('unableLoadDetails'),
        lines: [err.message || t('failedFetchUserDetails')],
        tone: 'danger',
      });
    }
  };

  const handleToggleActive = async (user) => {
    try {
      setActionLoading(`active-${user.id}`);
      const response = await adminAPI.updateUserStatus(user.id, { isActive: !user.isActive });
      if (response.success) {
        await fetchUsers();
      }
    } catch (err) {
      openDialog({
        title: t('updateFailed'),
        lines: [err.message || t('failedUpdateUserStatus')],
        tone: 'danger',
      });
    } finally {
      setActionLoading('');
    }
  };

  const handleViewActivity = async (userId) => {
    try {
      const response = await adminAPI.getUserActivity(userId);
      if (response.success) {
        const summary = response.data.summary;
        openDialog({
          title: t('adminUserActivitySummary'),
          lines: [
            `${t('adminTotalRequests')}: ${summary.totalRequests}`,
            `${t('adminCompletedRequests')}: ${summary.completedRequests}`,
            `${t('adminActiveRequests')}: ${summary.activeRequests}`,
            `${t('adminReportsSubmitted')}: ${summary.reportsSubmitted}`,
            `${t('adminReportsReceived')}: ${summary.reportsReceived}`,
            `${t('adminLastRequestActivity')}: ${summary.lastRequestActivity || t('adminNotAvailableShort')}`,
            `${t('adminLastReportActivity')}: ${summary.lastReportActivity || t('adminNotAvailableShort')}`,
          ],
        });
      }
    } catch (err) {
      openDialog({
        title: t('unableLoadActivity'),
        lines: [err.message || t('failedFetchUserActivity')],
        tone: 'danger',
      });
    }
  };

  const filteredUsers = users.filter((user) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query);

    const matchesType = filterType === 'all' || user.type === filterType;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && user.isActive) ||
      (filterStatus === 'verified' && user.isActive && user.isVerified) ||
      (filterStatus === 'pending' && !user.isVerified && user.isActive) ||
      (filterStatus === 'suspended' && !user.isActive);

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="admin-page admin-users-page">
      <PageHeader
        title={t('userManagement')}
        subtitle={t('userManagementSubtitle')}
        className="admin-page-header"
        titleClassName="admin-page-title"
        subtitleClassName="admin-page-subtitle"
      />

      <div className="filters-bar">
        <div className="search-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <AppInput
            type="text"
            placeholder={t('searchUsersPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <AppSelect value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label={t('filterUsersByRole')}>
            <option value="all">{t('allTypes')}</option>
            <option value="client">{t('clients')}</option>
            <option value="tradesperson">{t('serviceProviders')}</option>
            <option value="admin">{t('admins')}</option>
          </AppSelect>

          <AppSelect value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label={t('filterUsersByStatus')}>
            <option value="all">{t('allStatuses')}</option>
            <option value="active">{t('active')}</option>
            <option value="verified">{t('verified')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="suspended">{t('suspended')}</option>
          </AppSelect>
        </div>
      </div>

      {error && <div className="alert alert-danger mt-3">{error}</div>}

      {!loading && (
        <div className="admin-users-mobile-list" aria-label={t('adminUsersListMobileAria')}>
          {filteredUsers.map((user) => (
            <div key={`mobile-${user.id}`} className="admin-user-mobile-card">
              <div className="admin-user-mobile-header">
                <div className="user-cell">
                  <div className="user-avatar-small">
                    {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="user-info-cell">
                    <span className="user-name">{user.name}</span>
                    <span className="user-email">{user.email}</span>
                  </div>
                </div>
              </div>

              <div className="admin-user-mobile-body">
                <p className="request-detail"><strong>{t('adminType')}:</strong> {user.type === 'tradesperson' ? t('serviceProvider') : user.type}</p>
                <p className="request-detail"><strong>{t('profession')}:</strong> {user.profession || '—'}</p>
                <p className="request-detail"><strong>{t('statusLabel')}:</strong> {!user.isActive ? t('suspended') : user.isVerified ? t('verified') : t('active')}</p>
                <p className="request-detail"><strong>{t('adminVerification')}:</strong> {user.isVerified ? t('verified') : t('notVerified')}</p>
                <p className="request-detail"><strong>{t('adminJoinDate')}:</strong> {new Date(user.joinDate).toLocaleDateString()}</p>
              </div>

              <div className="table-actions-stack admin-user-mobile-actions">
                <AppButton variant="secondary" className="admin-user-action" onClick={() => handleViewDetails(user.id)}>
                  {t('viewDetails')}
                </AppButton>
                <AppButton
                  variant={user.isActive ? "danger" : "secondary"}
                  className="admin-user-action"
                  disabled={actionLoading === `active-${user.id}`}
                  onClick={() => handleToggleActive(user)}
                >
                  {actionLoading === `active-${user.id}`
                    ? t('updating')
                    : user.isActive
                      ? t('deactivate')
                      : t('reactivate')}
                </AppButton>
                <AppButton variant="ghost" className="admin-user-action" onClick={() => handleViewActivity(user.id)}>
                  {t('viewActivity')}
                </AppButton>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="table-container">
        {loading ? (
          <div className="text-center py-4">{t('loadingUsers')}</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('adminUser')}</th>
                <th>{t('adminType')}</th>
                <th>{t('profession')}</th>
                <th>{t('statusLabel')}</th>
                <th>{t('adminJoinDate')}</th>
                <th>{t('adminActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar-small">
                        {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="user-info-cell">
                        <span className="user-name">{user.name}</span>
                        <span className="user-email">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`type-badge ${user.type}`}>
                      {user.type === 'tradesperson' ? t('serviceProvider') : user.type}
                    </span>
                  </td>
                  <td>{user.profession || '—'}</td>
                  <td>
                    <span className={`status-badge ${!user.isActive ? 'status-suspended' : user.isVerified ? 'status-verified' : 'status-pending'}`}>
                      {!user.isActive ? t('suspended') : user.isVerified ? t('verified') : t('active')}
                    </span>
                  </td>
                  <td>{new Date(user.joinDate).toLocaleDateString()}</td>
                  <td>
                    <div className="table-actions table-actions-stack">
                      <AppButton variant="secondary" className="admin-user-action" onClick={() => handleViewDetails(user.id)}>
                        {t('viewDetails')}
                      </button>
                      <AppButton
                        variant={user.isActive ? "danger" : "secondary"}
                        className="admin-user-action"
                        disabled={actionLoading === `active-${user.id}`}
                        onClick={() => handleToggleActive(user)}
                      >
                        {actionLoading === `active-${user.id}`
                          ? t('updating')
                          : user.isActive
                            ? t('deactivate')
                            : t('reactivate')}
                      </AppButton>
                      <AppButton variant="ghost" className="admin-user-action" onClick={() => handleViewActivity(user.id)}>
                        {t('viewActivity')}
                      </AppButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dialog.open && (
        <div className="admin-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
          <div className={`admin-dialog-card ${dialog.tone === 'danger' ? 'danger' : ''}`}>
            <div className="admin-dialog-header">
              <h2 id="admin-dialog-title" className="admin-dialog-title">{dialog.title}</h2>
              <IconButton
                className="admin-dialog-close"
                onClick={closeDialog}
                aria-label={t('adminCloseDialog')}
              >
                ×
              </IconButton>
            </div>

            <div className="admin-dialog-body">
              {dialog.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>

            <div className="admin-dialog-actions">
              <AppButton onClick={closeDialog}>
                {t('adminOkay')}
              </AppButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsers;
