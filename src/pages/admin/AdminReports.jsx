import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import '../../styles/AdminPages.css';

function AdminReports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [previewScreenshot, setPreviewScreenshot] = useState('');

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminAPI.getReports();
      if (response.success) {
        setReports(response.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPreviewScreenshot('');
      }
    };

    if (previewScreenshot) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }

    return undefined;
  }, [previewScreenshot]);

  const handleReportAction = async (reportId, action) => {
    try {
      setActionLoading(`${reportId}-${action}`);
      const notes = window.prompt('Optional admin notes:') || '';
      const response = await adminAPI.updateReportStatus(reportId, {
        action,
        resolutionNotes: notes,
      });
      if (response.success) {
        await fetchReports();
      }
    } catch (err) {
      alert(err.message || 'Failed to update report');
    } finally {
      setActionLoading('');
    }
  };

  const filteredReports = reports.filter((report) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      report.reportedUser.toLowerCase().includes(query) ||
      report.reportedBy.toLowerCase().includes(query) ||
      report.reason.toLowerCase().includes(query);

    const normalized = report.status.toLowerCase();
    const matchesStatus = filterStatus === 'all' || normalized === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = reports.filter((r) => r.status === 'pending').length;
  const reviewCount = reports.filter((r) => r.status === 'under_review').length;
  const resolvedCount = reports.filter((r) => ['resolved', 'dismissed', 'banned'].includes(r.status)).length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">User Reports</h1>
        <p className="admin-page-subtitle">Review and manage user complaints and reports</p>
      </div>

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
          <span className="mini-stat-label">Processed</span>
        </div>
      </div>

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
            <option value="under_review">Under Review</option>
            <option value="dismissed">Dismissed</option>
            <option value="resolved">Resolved</option>
            <option value="banned">Banned</option>
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger mt-3">{error}</div>}

      <div className="requests-list">
        {loading ? (
          <div className="text-center py-4">Loading reports...</div>
        ) : (
          filteredReports.map((report) => (
            <div key={report.id} className={`request-card report-card ${['dismissed', 'resolved', 'banned'].includes(report.status) ? 'processed' : ''}`}>
              <div className="request-avatar report-avatar">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>

              <div className="request-info">
                <div className="request-header">
                  <h4 className="request-name">{report.reportedUser}</h4>
                  <span className="document-tag">{report.reportedUserType}</span>
                  <span className={`status-badge ${report.status === 'pending' ? 'status-pending' : report.status === 'under_review' ? 'status-review' : report.status === 'dismissed' ? 'status-dismissed' : 'status-verified'}`}>
                    {report.status.replace('_', ' ')}
                  </span>
                </div>

                <p className="request-detail">Reported by: {report.reportedBy} ({report.reporterType})</p>
                <p className="request-detail">Reason: {report.reason}</p>
                <p className="report-description">{report.description}</p>
                <p className="request-detail">Request: {report.jobTitle}</p>
                <p className="request-detail">Date: {new Date(report.date).toLocaleString()}</p>

                {report.screenshot ? (
                  <div className="admin-inline-details">
                    <p className="request-detail admin-evidence-label">Evidence image:</p>
                    <button
                      type="button"
                      className="admin-report-screenshot-button"
                      onClick={() => setPreviewScreenshot(report.screenshot)}
                      aria-label="View attached evidence image"
                    >
                      <img
                        src={report.screenshot}
                        alt="Reported evidence"
                        className="admin-report-screenshot"
                        onClick={() => setPreviewScreenshot(report.screenshot)}
                      />
                    </button>
                  </div>
                ) : null}

                {expandedReportId === report.id && (
                  <div className="admin-inline-details">
                    {report.resolution && (
                      <p className="resolution-text"><strong>Resolution:</strong> {report.resolution}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="request-actions report-actions">
                {['pending', 'under_review'].includes(report.status) ? (
                  <>
                    <button
                      className="btn-investigate"
                      disabled={actionLoading === `${report.id}-investigate`}
                      onClick={() => handleReportAction(report.id, 'investigate')}
                    >
                      {actionLoading === `${report.id}-investigate` ? 'Working...' : 'Investigate'}
                    </button>
                    <button
                      className="btn-dismiss"
                      disabled={actionLoading === `${report.id}-dismiss`}
                      onClick={() => handleReportAction(report.id, 'dismiss')}
                    >
                      {actionLoading === `${report.id}-dismiss` ? 'Working...' : 'Dismiss'}
                    </button>
                    <button
                      className="btn-ban"
                      disabled={actionLoading === `${report.id}-ban`}
                      onClick={() => handleReportAction(report.id, 'ban')}
                    >
                      {actionLoading === `${report.id}-ban` ? 'Working...' : 'Ban User'}
                    </button>
                  </>
                ) : null}
                <button
                  className="btn-view-details"
                  onClick={() => setExpandedReportId((prev) => (prev === report.id ? null : report.id))}
                >
                  {expandedReportId === report.id ? 'Hide Details' : 'View Details'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {previewScreenshot ? (
        <div
          className="admin-report-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Evidence image preview"
          onClick={() => setPreviewScreenshot('')}
        >
          <div className="admin-report-preview-dialog" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="admin-report-preview-close"
              onClick={() => setPreviewScreenshot('')}
              aria-label="Close image preview"
            >
              ×
            </button>
            <img
              src={previewScreenshot}
              alt="Attached evidence preview"
              className="admin-report-preview-image"
            />
          </div>
        </div>
      ) : null}

      {!loading && filteredReports.length === 0 && (
        <div className="empty-state">
          <h3>No reports found</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
}

export default AdminReports;
