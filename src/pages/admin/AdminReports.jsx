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
  const [decisionDialog, setDecisionDialog] = useState({
    open: false,
    reportId: null,
    action: 'dismiss',
    notes: '',
    error: '',
  });

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminAPI.getReports();
      if (response.success) {
        setReports(response.data || []);
      }
    } catch {
      setError('We could not load reports. Please try again.');
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

  const handleReportAction = async (reportId, action, payload = {}) => {
    try {
      setActionLoading(`${reportId}-${action}`);
      const needsResolution = ['dismiss', 'resolve', 'warn', 'suspend', 'ban'].includes(action);
      const needsNotesPrompt = needsResolution;
      const hasProvidedNotes = typeof payload.resolutionNotes === 'string';
      const notes = hasProvidedNotes
        ? payload.resolutionNotes
        : (needsNotesPrompt ? (window.prompt('Resolution notes (required):') || '') : '');
      if (needsResolution && !notes.trim()) {
        alert('Resolution notes are required for this action.');
        return { success: false, message: 'Resolution notes are required.' };
      }
      const moderationNotes = typeof payload.moderationNotes === 'string'
        ? payload.moderationNotes
        : (needsResolution ? (window.prompt('Optional moderation notes:') || '') : '');
      const response = await adminAPI.updateReportStatus(reportId, {
        action,
        resolutionNotes: notes,
        moderationNotes,
      });
      if (response.success) {
        await fetchReports();
        return { success: true };
      }
      return { success: false, message: response.message || 'Failed to update report' };
    } catch (err) {
      alert(err.message || 'Failed to update report');
      return { success: false, message: err.message || 'Failed to update report' };
    } finally {
      setActionLoading('');
    }
  };

  const openDecisionDialog = (reportId) => {
    setDecisionDialog({ open: true, reportId, action: 'dismiss', notes: '', error: '' });
  };

  const closeDecisionDialog = () => {
    setDecisionDialog({ open: false, reportId: null, action: 'dismiss', notes: '', error: '' });
  };

  const handleSubmitDecision = async () => {
    const notes = decisionDialog.notes.trim();
    if (!notes) {
      setDecisionDialog((prev) => ({ ...prev, error: 'Admin note is required before submitting a decision.' }));
      return;
    }

    const result = await handleReportAction(decisionDialog.reportId, decisionDialog.action, {
      resolutionNotes: notes,
      moderationNotes: '',
    });

    if (result?.success) {
      closeDecisionDialog();
      return;
    }

    setDecisionDialog((prev) => ({ ...prev, error: result?.message || 'Failed to submit decision' }));
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
  const resolvedCount = reports.filter((r) => ['resolved', 'dismissed'].includes(r.status)).length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Reports</h1>
        <p className="admin-page-subtitle">Review reported activity and decide what action should be taken.</p>
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
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filter reports by status">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="dismissed">Dismissed</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger mt-3">{error}</div>}

      <div className="requests-list">
        {loading ? (
          <div className="text-center py-4">Loading reports...</div>
        ) : (
          filteredReports.map((report) => (
            <div key={report.id} className={`request-card report-card ${['dismissed', 'resolved'].includes(report.status) ? 'processed' : ''}`}>
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

                {report.actionTaken && report.actionTaken !== 'none' && (
                  <p className="request-detail"><strong>Action taken:</strong> {report.actionTaken}</p>
                )}

                <p className="request-detail">Reported by: {report.reportedBy} ({report.reporterType})</p>
                <p className="request-detail">Reason: {report.reason}</p>
                <p className="report-description">{report.description}</p>
                <p className="request-detail">Request: {report.jobTitle}</p>
                <p className="request-detail">Date: {new Date(report.date).toLocaleString()}</p>

                {expandedReportId === report.id && (
                  <div className="admin-inline-details">
                    {report.screenshot ? (
                      <>
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
                      </>
                    ) : null}
                    {report.resolution && (
                      <p className="resolution-text"><strong>Resolution:</strong> {report.resolution}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="request-actions report-actions">
                {report.status === 'pending' ? (
                  <>
                    <button
                      className="btn-investigate"
                      disabled={actionLoading === `${report.id}-investigate`}
                      onClick={() => handleReportAction(report.id, 'investigate')}
                    >
                      {actionLoading === `${report.id}-investigate` ? 'Working...' : 'Review Report'}
                    </button>
                  </>
                ) : null}
                {report.status === 'under_review' ? (
                  <>
                    <button
                      className="btn-approve"
                      disabled={actionLoading && actionLoading.startsWith(`${report.id}-`)}
                      onClick={() => openDecisionDialog(report.id)}
                    >
                      Make Decision
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
          <h3>No reports requiring attention.</h3>
          <p>Try adjusting your search or filter criteria.</p>
        </div>
      )}

      {decisionDialog.open && (
        <div
          className="admin-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-decision-title"
          onClick={closeDecisionDialog}
        >
          <div className="admin-dialog-card" onClick={(event) => event.stopPropagation()}>
            <div className="admin-dialog-header">
              <h2 id="report-decision-title" className="admin-dialog-title">Make Decision</h2>
              <button
                type="button"
                className="admin-dialog-close"
                onClick={closeDecisionDialog}
                aria-label="Close decision dialog"
              >
                ×
              </button>
            </div>

            <div className="admin-dialog-body">
              <label htmlFor="report-decision-action" className="settings-label">Decision</label>
              <select
                id="report-decision-action"
                className="settings-input"
                value={decisionDialog.action}
                onChange={(event) => setDecisionDialog((prev) => ({ ...prev, action: event.target.value, error: '' }))}
              >
                <option value="dismiss">No violation - Dismiss</option>
                <option value="warn">Minor violation - Warn</option>
                <option value="suspend">Serious or repeated violation - Suspend</option>
                <option value="ban">Severe violation - Ban</option>
              </select>

              <label htmlFor="report-decision-note" className="settings-label">Admin note</label>
              <textarea
                id="report-decision-note"
                className="settings-textarea"
                rows={4}
                maxLength={800}
                value={decisionDialog.notes}
                onChange={(event) => setDecisionDialog((prev) => ({ ...prev, notes: event.target.value, error: '' }))}
                placeholder="Explain the reason for this decision"
              />

              {decisionDialog.error ? <p className="admin-dialog-error">{decisionDialog.error}</p> : null}
            </div>

            <div className="admin-dialog-actions admin-dialog-actions-split">
              <button type="button" className="btn-view-details" onClick={closeDecisionDialog}>Cancel</button>
              <button
                type="button"
                className="btn-approve"
                onClick={handleSubmitDecision}
                disabled={Boolean(actionLoading)}
              >
                {actionLoading ? 'Submitting...' : 'Submit Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminReports;
