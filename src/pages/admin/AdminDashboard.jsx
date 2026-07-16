import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import '../../styles/AdminPages.css';

function AdminDashboard() {
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
      case 'under_review': return 'status-review';
      case 'under review': return 'status-review';
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
        <div className="stat-card">
          <span className="stat-label">Pending Verifications</span>
          <span className="stat-value text-warning">
            {loading ? '...' : stats.pendingVerifications}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Reports</span>
          <span className="stat-value text-orange">
            {loading ? '...' : stats.activeReports}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Verified Providers</span>
          <span className="stat-value text-success">
            {loading ? '...' : stats.verifiedProviders}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Users</span>
          <span className="stat-value text-primary">
            {loading ? '...' : stats.totalUsers}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button 
          className={`admin-tab ${activeTab === 'verifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('verifications')}
        >
          Verifications Request
        </button>
        <button 
          className={`admin-tab ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Users Reports
        </button>
      </div>

      {/* Content */}
      <div className="admin-tab-content">
        {activeTab === 'verifications' ? (
          <div className="requests-list">
            {tabLoading ? (
              <div className="text-center py-4">Loading verification requests...</div>
            ) : topVerificationRequests.length === 0 ? (
              <div className="empty-state">
                <h3>No verification requests found</h3>
                <p>There are currently no verification requests in the database.</p>
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
                  <p className="request-detail">Email: {request.email}</p>
                  <p className="request-detail">Submitted: {new Date(request.createdAt).toLocaleString()}</p>
                  <p className="request-detail">Status: {formatStatusLabel(request.status)}</p>
                </div>

                <div className="request-contact">
                  <p>Phone: {request.phoneNumber || 'N/A'}</p>
                </div>

                <div className="request-actions">
                  <Link to="/admin/verifications" className="btn-view-details">
                    Review Request
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="requests-list">
            {tabLoading ? (
              <div className="text-center py-4">Loading reports...</div>
            ) : topUserReports.length === 0 ? (
              <div className="empty-state">
                <h3>No reports found</h3>
                <p>There are currently no user reports in the database.</p>
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
                  <p className="request-detail">Reported by: {report.reportedBy}</p>
                  <p className="request-detail">Reason: {report.reason}</p>
                  <p className="report-description">{report.description}</p>
                </div>

                <div className="request-contact">
                  <p>Date: {new Date(report.date).toLocaleDateString()}</p>
                </div>

                <div className="request-actions report-actions">
                  <Link to="/admin/reports" className="btn-view-details">View Report</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="quick-links">
        <Link to="/admin/verifications" className="quick-link">
          View All Verifications →
        </Link>
        <Link to="/admin/reports" className="quick-link">
          View All Reports →
        </Link>
      </div>
    </div>
  );
}

export default AdminDashboard;
