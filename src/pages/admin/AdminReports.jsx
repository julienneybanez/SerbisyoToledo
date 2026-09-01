import { useCallback, useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { AppButton, AppInput, AppSelect, AppTextarea, IconButton, PageHeader } from '../../components/ui';
import '../../styles/AdminPages.css';

function AdminReports() {
  const { t } = useLanguage();
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

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminAPI.getReports();
      if (response.success) {
        setReports(response.data || []);
      }
    } catch {
      setError(t('adminReportsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

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
        : (needsNotesPrompt ? (window.prompt(t('adminReportsResolutionNotesRequiredPrompt')) || '') : '');
      if (needsResolution && !notes.trim()) {
        alert(t('adminReportsResolutionNotesRequiredAlert'));
        return { success: false, message: t('adminReportsResolutionNotesRequiredMessage') };
      }
      const moderationNotes = typeof payload.moderationNotes === 'string'
        ? payload.moderationNotes
        : (needsResolution ? (window.prompt(t('adminReportsOptionalModerationNotesPrompt')) || '') : '');
      const response = await adminAPI.updateReportStatus(reportId, {
        action,
        resolutionNotes: notes,
        moderationNotes,
      });
      if (response.success) {
        await fetchReports();
        return { success: true };
      }
      return { success: false, message: response.message || t('adminReportsUpdateFailed') };
    } catch (err) {
      alert(err.message || t('adminReportsUpdateFailed'));
      return { success: false, message: err.message || t('adminReportsUpdateFailed') };
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
      setDecisionDialog((prev) => ({ ...prev, error: t('adminReportsDecisionNoteRequired') }));
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

    setDecisionDialog((prev) => ({ ...prev, error: result?.message || t('adminReportsSubmitDecisionFailed') }));
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
  const reviewCount = reports.filter((r) => r.status === 'investigating').length;
  const resolvedCount = reports.filter((r) => ['resolved', 'dismissed'].includes(r.status)).length;

  return (
    <div className="admin-page">
      <PageHeader
        title={t('reports')}
        subtitle={t('adminReportsSubtitle')}
        className="admin-page-header"
        titleClassName="admin-page-title"
        subtitleClassName="admin-page-subtitle"
      />

      <div className="mini-stats">
        <div className="mini-stat">
          <span className="mini-stat-value text-warning">{pendingCount}</span>
          <span className="mini-stat-label">{t('pending')}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value text-orange">{reviewCount}</span>
          <span className="mini-stat-label">{t('adminUnderReview')}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value text-success">{resolvedCount}</span>
          <span className="mini-stat-label">{t('adminProcessed')}</span>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <AppInput
            type="text"
            placeholder={t('adminSearchReportsPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <AppSelect value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label={t('adminFilterReportsByStatus')}>
            <option value="all">{t('allStatuses')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="investigating">{t('adminUnderReview')}</option>
            <option value="dismissed">{t('adminDismissed')}</option>
            <option value="resolved">{t('adminResolved')}</option>
          </AppSelect>
        </div>
      </div>

      {error && <div className="alert alert-danger mt-3">{error}</div>}

      <div className="requests-list">
        {loading ? (
          <div className="text-center py-4">{t('loadingReports')}</div>
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
                  <span className={`status-badge ${report.status === 'pending' ? 'status-pending' : report.status === 'investigating' ? 'status-review' : report.status === 'dismissed' ? 'status-dismissed' : 'status-verified'}`}>
                    {report.status.replace('_', ' ')}
                  </span>
                </div>

                {report.actionTaken && report.actionTaken !== 'none' && (
                  <p className="request-detail"><strong>{t('adminActionTaken')}:</strong> {report.actionTaken}</p>
                )}

                <p className="request-detail">{t('reportedBy')}: {report.reportedBy} ({report.reporterType})</p>
                <p className="request-detail">{t('reason')}: {report.reason}</p>
                <p className="report-description">{report.description}</p>
                <p className="request-detail">{t('requests')}: {report.serviceLabel || 'Service Request'}</p>
                <p className="request-detail">{t('date')}: {new Date(report.date).toLocaleString()}</p>

                {expandedReportId === report.id && (
                  <div className="admin-inline-details">
                    {report.screenshot ? (
                      <>
                        <p className="request-detail admin-evidence-label">{t('adminEvidenceImage')}:</p>
                        <button
                          type="button"
                          className="admin-report-screenshot-button"
                          onClick={() => setPreviewScreenshot(report.screenshot)}
                          aria-label={t('adminViewAttachedEvidenceImage')}
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
                      <p className="resolution-text"><strong>{t('adminResolution')}:</strong> {report.resolution}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="request-actions report-actions">
                {report.status === 'pending' ? (
                  <>
                    <AppButton
                      disabled={actionLoading === `${report.id}-investigate`}
                      onClick={() => handleReportAction(report.id, 'investigate')}
                    >
                      {actionLoading === `${report.id}-investigate` ? t('adminWorking') : t('adminReviewReport')}
                    </AppButton>
                  </>
                ) : null}
                {report.status === 'investigating' ? (
                  <>
                    <AppButton
                      disabled={actionLoading && actionLoading.startsWith(`${report.id}-`)}
                      onClick={() => openDecisionDialog(report.id)}
                    >
                      {t('adminMakeDecision')}
                    </AppButton>
                  </>
                ) : null}
                <AppButton
                  variant="secondary"
                  onClick={() => setExpandedReportId((prev) => (prev === report.id ? null : report.id))}
                >
                  {expandedReportId === report.id ? t('adminHideDetails') : t('viewDetails')}
                </AppButton>
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
          aria-label={t('adminEvidenceImagePreview')}
          onClick={() => setPreviewScreenshot('')}
        >
          <div className="admin-report-preview-dialog" onClick={(event) => event.stopPropagation()}>
            <IconButton
              className="admin-report-preview-close"
              onClick={() => setPreviewScreenshot('')}
              aria-label={t('adminCloseImagePreview')}
            >
              ×
            </IconButton>
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
          <h3>{t('adminNoReportsRequiringAttention')}</h3>
          <p>{t('adminTryAdjustingSearchFilter')}</p>
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
              <h2 id="report-decision-title" className="admin-dialog-title">{t('adminMakeDecision')}</h2>
              <IconButton
                className="admin-dialog-close"
                onClick={closeDecisionDialog}
                aria-label={t('adminCloseDecisionDialog')}
              >
                ×
              </IconButton>
            </div>

            <div className="admin-dialog-body">
              <label htmlFor="report-decision-action" className="settings-label">{t('adminDecision')}</label>
              <AppSelect
                id="report-decision-action"
                className="settings-input"
                value={decisionDialog.action}
                onChange={(event) => setDecisionDialog((prev) => ({ ...prev, action: event.target.value, error: '' }))}
              >
                <option value="dismiss">{t('adminDecisionDismiss')}</option>
                <option value="warn">{t('adminDecisionWarn')}</option>
                <option value="suspend">{t('adminDecisionSuspend')}</option>
                <option value="ban">{t('adminDecisionBan')}</option>
              </AppSelect>

              <label htmlFor="report-decision-note" className="settings-label">{t('adminNote')}</label>
              <AppTextarea
                id="report-decision-note"
                className="settings-textarea"
                rows={4}
                maxLength={800}
                value={decisionDialog.notes}
                onChange={(event) => setDecisionDialog((prev) => ({ ...prev, notes: event.target.value, error: '' }))}
                placeholder={t('adminDecisionReasonPlaceholder')}
              />

              {decisionDialog.error ? <p className="admin-dialog-error">{decisionDialog.error}</p> : null}
            </div>

            <div className="admin-dialog-actions admin-dialog-actions-split">
              <AppButton variant="secondary" onClick={closeDecisionDialog}>{t('requestsCancelAction')}</AppButton>
              <AppButton
                onClick={handleSubmitDecision}
                disabled={Boolean(actionLoading)}
              >
                {actionLoading ? t('adminSubmitting') : t('adminSubmitDecision')}
              </AppButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminReports;
