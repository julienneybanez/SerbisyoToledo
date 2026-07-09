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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getDashboardStats();
      if (response.success) {
        setStats({
          pendingVerifications: response.data.pendingVerifications,
          activeReports: response.data.activeReports,
          verifiedProviders: response.data.verifiedProviders,
          totalUsers: response.data.totalUsers
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const verificationRequests = [
    {
      id: 1,
      name: 'Juan Dela Cruz',
      profession: 'Electrician',
      email: 'juan@example.com',
      phone: '+63 987 523 312',
      submittedDate: '2026-01-21',
      documents: ['Valid ID', 'Certificate', 'Portfolio']
    },
    {
      id: 2,
      name: 'Maria Santos',
      profession: 'Plumber',
      email: 'maria@example.com',
      phone: '+63 988 854 212',
      submittedDate: '2026-01-22',
      documents: ['Valid ID', 'License', 'Portfolio']
    },
    {
      id: 3,
      name: 'Marie Pando',
      profession: 'Carpenter',
      email: 'marie@example.com',
      phone: '+63 957 834 092',
      submittedDate: '2026-01-23',
      documents: ['Valid ID', 'Certificate', 'Portfolio']
    }
  ];

  const userReports = [
    {
      id: 1,
      reportedUser: 'Carlos Yulo',
      status: 'Pending',
      reportedBy: 'Ana Lopez',
      reason: 'Did not complete the service',
      description: 'Service provider did not show up for schedule appointment',
      date: '2026-01-10'
    },
    {
      id: 2,
      reportedUser: 'Jose Reyes',
      status: 'Under Review',
      reportedBy: 'Linda Garcia',
      reason: 'Poor quality work',
      description: 'Work complete but quality was below expectation',
      date: '2026-02-22'
    },
    {
      id: 3,
      reportedUser: 'Miguel Torres',
      status: 'Pending',
      reportedBy: 'Sofia The First',
      reason: 'Unprofessional behavior',
      description: 'Service provider was rude and unprofessional',
      date: '2026-03-20'
    }
  ];

  const getStatusClass = (status) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'under review': return 'status-review';
      case 'resolved': return 'status-resolved';
      default: return '';
    }
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
            {verificationRequests.map((request) => (
              <div key={request.id} className="request-card verification-card">
                <div className="request-avatar">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                
                <div className="request-info">
                  <div className="request-header">
                    <h4 className="request-name">{request.name}</h4>
                    <span className={`profession-badge ${getProfessionClass(request.profession)}`}>
                      {request.profession}
                    </span>
                  </div>
                  <p className="request-detail">Email: {request.email}</p>
                  <p className="request-detail">Submitted: {request.submittedDate}</p>
                  <div className="request-documents">
                    {request.documents.map((doc, idx) => (
                      <span key={idx} className="document-tag">{doc}</span>
                    ))}
                  </div>
                </div>

                <div className="request-contact">
                  <p>Phone: {request.phone}</p>
                </div>

                <div className="request-actions">
                  <button className="btn-approve">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Approve
                  </button>
                  <button className="btn-reject">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="requests-list">
            {userReports.map((report) => (
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
                      {report.status}
                    </span>
                  </div>
                  <p className="request-detail">Reported by: {report.reportedBy}</p>
                  <p className="request-detail">Reason: {report.reason}</p>
                  <p className="report-description">{report.description}</p>
                </div>

                <div className="request-contact">
                  <p>Date: {report.date}</p>
                </div>

                <div className="request-actions report-actions">
                  <button className="btn-investigate">Investigate</button>
                  <button className="btn-dismiss">DISMISS</button>
                  <button className="btn-ban">Ban User</button>
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
