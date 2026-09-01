import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { AppButton, Chip, StatCard } from '../../components/ui';
import '../../styles/AdminPages.css';

function AdminDashboard() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('verifications');
  const [stats, setStats] = useState({
    pendingVerifications: 0,
    activeReports: 0,
    verifiedProviders: 0,
    totalUsers: 0
  });
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setTabLoading(true);

      const [statsResponse, verificationResponse, reportsResponse] = await Promise.all([
        adminAPI.getDashboardStats(),
        adminAPI.getVerificationRequests(),
        adminAPI.getReports()
      ]);

      if (statsResponse.success) {
        setStats({
          pendingVerifications: Number(statsResponse.data.pendingVerifications || 0),
          activeReports: Number(statsResponse.data.activeReports || 0),
          verifiedProviders: Number(statsResponse.data.verifiedProviders || 0),
          totalUsers: Number(statsResponse.data.totalUsers || 0)
        });
      }

      if (verificationResponse.success) {
        const verificationRows = verificationResponse.data || [];
        setVerificationRequests(verificationRows);
        setStats((prev) => ({
          ...prev,
          pendingVerifications: verificationRows.filter((row) => row.status === 'pending').length
        }));
      }

      if (reportsResponse.success) {
        setUserReports(reportsResponse.data || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setVerificationRequests([]);
      setUserReports([]);
    } finally {
      setLoading(false);
      setTabLoading(false);
    }
  };

  const topVerificationRequests = verificationRequests.slice(0, 3);
  const topUserReports = userReports.slice(0, 3);

  const getStatusClass = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'investigating': return 'status-review';
      case 'resolved': return 'status-resolved';
      default: return '';
    }
  };

  const formatStatusLabel = (status) => {
    if (!status) return 'pending';
    return status.replace(/_/g, ' ');
  };

  const getProfessionClass = (profession) => {
    switch (profession.toLowerCase()) {
      case 'electrician': return 'profession-electrician';
      case 'plumber': return 'profession-plumber';
      case 'carpenter': return 'profession-carpenter';
      default: return '';
    }
  };

  return (
    <div className="admin-page">
      {/* Stats Cards */}
      <div className="stats-grid">
        <StatCard className="stat-card" label={t('pendingVerifications')} value={loading ? '...' : stats.pendingVerifications} />
        <StatCard className="stat-card" label={t('activeReports')} value={loading ? '...' : stats.activeReports} />
        <StatCard className="stat-card" label={t('verifiedProviders')} value={loading ? '...' : stats.verifiedProviders} />
        <StatCard className="stat-card" label={t('totalUsers')} value={loading ? '...' : stats.totalUsers} />
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <Chip
          className="admin-tab"
          active={activeTab === 'verifications'}
          onClick={() => setActiveTab('verifications')}
        >
          {t('verificationRequests')}
        </Chip>
        <Chip
          className="admin-tab"
          active={activeTab === 'reports'}
          onClick={() => setActiveTab('reports')}
        >
          {t('userReports')}
        </Chip>
      </div>

      {/* Content */}
      <div className="admin-tab-content">
        {activeTab === 'verifications' ? (
          <div className="requests-list">
            {tabLoading ? (
              <div className="text-center py-4">{t('loadingVerificationRequests')}</div>
            ) : topVerificationRequests.length === 0 ? (
              <div className="empty-state">
                <h3>{t('noVerificationRequestsFound')}</h3>
                <p>{t('noVerificationRequestsInDatabase')}</p>
              </div>
            ) : topVerificationRequests.map((request) => (
              <div key={request.id} className="request-card verification-card">
                <div className="request-avatar">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                
                <div className="request-info">
                  <div className="request-header">
                    <h4 className="request-name">{request.fullName}</h4>
                    {request.profession && (
                      <span className={`profession-badge ${getProfessionClass(request.profession)}`}>
                        {request.profession}
                      </span>
                    )}
                  </div>
                  <p className="request-detail">{t('emailLabel')}: {request.email}</p>
                  <p className="request-detail">{t('submittedLabel')}: {new Date(request.createdAt).toLocaleString()}</p>
                  <p className="request-detail">{t('statusLabel')}: {formatStatusLabel(request.status)}</p>
                </div>

                <div className="request-contact">
                  <p>{t('phoneLabel')}: {request.phoneNumber || 'N/A'}</p>
                </div>

                <div className="request-actions">
                  <AppButton as={Link} to="/admin/verifications" variant="ghost">
                    {t('reviewRequest')}
                  </AppButton>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="requests-list">
            {tabLoading ? (
              <div className="text-center py-4">{t('loadingReports')}</div>
            ) : topUserReports.length === 0 ? (
              <div className="empty-state">
                <h3>{t('noReportsFound')}</h3>
                <p>{t('noReportsInDatabase')}</p>
              </div>
            ) : topUserReports.map((report) => (
              <div key={report.id} className="request-card report-card">
                <div className="request-avatar report-avatar">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                
                <div className="request-info">
                  <div className="request-header">
                    <h4 className="request-name">{report.reportedUser}</h4>
                    <span className={`status-badge ${getStatusClass(report.status)}`}>
                      {formatStatusLabel(report.status)}
                    </span>
                  </div>
                  <p className="request-detail">{t('reportedBy')}: {report.reportedBy}</p>
                  <p className="request-detail">{t('reason')}: {report.reason}</p>
                  <p className="report-description">{report.description}</p>
                </div>

                <div className="request-contact">
                  <p>{t('date')}: {new Date(report.date).toLocaleDateString()}</p>
                </div>

                <div className="request-actions report-actions">
                  <AppButton as={Link} to="/admin/reports" variant="ghost">{t('viewReport')}</AppButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="quick-links">
        <Link to="/admin/verifications" className="quick-link">
          {t('viewAllVerifications')}
        </Link>
        <Link to="/admin/reports" className="quick-link">
          {t('viewAllReports')}
        </Link>
      </div>
    </div>
  );
}

export default AdminDashboard;
