import { useState } from 'react';
import '../../styles/AdminPages.css';

function AdminReports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Mock data - replace with API calls
  const reports = [
    {
      id: 1,
      reportedUser: 'Carlos Yulo',
      reportedUserType: 'tradesperson',
      status: 'Pending',
      reportedBy: 'Ana Lopez',
      reporterType: 'client',
      reason: 'Did not complete the service',
      description: 'Service provider did not show up for schedule appointment',
      date: '2026-01-10',
      priority: 'high'
    },
    {
      id: 2,
      reportedUser: 'Jose Reyes',
      reportedUserType: 'tradesperson',
      status: 'Under Review',
      reportedBy: 'Linda Garcia',
      reporterType: 'client',
      reason: 'Poor quality work',
      description: 'Work complete but quality was below expectation',
      date: '2026-02-22',
      priority: 'medium'
    },
    {
      id: 3,
      reportedUser: 'Miguel Torres',
      reportedUserType: 'tradesperson',
      status: 'Pending',
      reportedBy: 'Sofia The First',
      reporterType: 'client',
      reason: 'Unprofessional behavior',
      description: 'Service provider was rude and unprofessional',
      date: '2026-03-20',
      priority: 'high'
    },
    {
      id: 4,
      reportedUser: 'Mark Villanueva',
      reportedUserType: 'tradesperson',
      status: 'Resolved',
      reportedBy: 'Juan Santos',
      reporterType: 'client',
      reason: 'Overcharging',
      description: 'Charged more than the agreed amount',
      date: '2026-01-05',
      priority: 'medium',
      resolution: 'Refund issued to client'
    },
    {
      id: 5,
      reportedUser: 'Elena Cruz',
      reportedUserType: 'client',
      status: 'Dismissed',
      reportedBy: 'Pedro Painter',
      reporterType: 'tradesperson',
      reason: 'False complaint',
      description: 'Client made false claims about service',
      date: '2025-12-28',
      priority: 'low',
      resolution: 'Report found to be unfounded'
    }
  ];

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.reportedUser.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.reportedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || report.status.toLowerCase().replace(' ', '-') === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusClass = (status) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'under review': return 'status-review';
      case 'resolved': return 'status-verified';
      case 'dismissed': return 'status-dismissed';
      default: return '';
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  };

  const pendingCount = reports.filter(r => r.status === 'Pending').length;
  const reviewCount = reports.filter(r => r.status === 'Under Review').length;
  const resolvedCount = reports.filter(r => r.status === 'Resolved').length;

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">User Reports</h1>
        <p className="page-subtitle">Review and manage user complaints and reports</p>
      </div>

      {/* Stats Summary */}
      <div className="mini-stats">
        <div className="mini-stat">
          <span className="mini-stat-value text-warning">{pendingCount}</span>
          <span className="mini-stat-label">Pending</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value text-orange">{reviewCount}</span>
          <span className="mini-stat-label">Under Review</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value text-success">{resolvedCount}</span>
          <span className="mini-stat-label">Resolved</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="under-review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {/* Reports List */}
      <div className="requests-list">
        {filteredReports.map((report) => (
          <div key={report.id} className={`request-card report-card ${report.status === 'Resolved' || report.status === 'Dismissed' ? 'processed' : ''}`}>
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
                <span className={`priority-badge ${getPriorityClass(report.priority)}`}>
                  {report.priority}
                </span>
              </div>
              <p className="request-detail">Reported by: {report.reportedBy} ({report.reporterType})</p>
              <p className="request-detail">Reason: {report.reason}</p>
              <p className="report-description">{report.description}</p>
              {report.resolution && (
                <p className="resolution-text">
                  <strong>Resolution:</strong> {report.resolution}
                </p>
              )}
            </div>

            <div className="request-contact">
              <p>Date: {report.date}</p>
              <p>Reported: {report.reportedUserType}</p>
            </div>

            <div className="request-actions report-actions">
              {report.status === 'Pending' || report.status === 'Under Review' ? (
                <>
                  <button className="btn-investigate">Investigate</button>
                  <button className="btn-dismiss">DISMISS</button>
                  <button className="btn-ban">Ban User</button>
                </>
              ) : (
                <button className="btn-view-details">View Details</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <h3>No reports found</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
}

export default AdminReports;
