import { useCallback, useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import '../../styles/AdminPages.css';

function AdminVerifications() {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [verifications, setVerifications] = useState([]);
  const [providerCredentials, setProviderCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [error, setError] = useState('');
  const [credentialsError, setCredentialsError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [credentialActionLoading, setCredentialActionLoading] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [credentialFilterStatus, setCredentialFilterStatus] = useState('pending');
  const [rejectDialog, setRejectDialog] = useState({
    open: false,
    requestId: null,
    reason: '',
    error: '',
  });
  const [credentialRejectDialog, setCredentialRejectDialog] = useState({
    open: false,
    credentialId: null,
    reason: '',
    error: '',
  });

  const fetchVerifications = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminAPI.getVerificationRequests();
      if (response.success) {
        setVerifications(response.data || []);
      }
    } catch (err) {
      setError(err.message || t('failedLoadVerificationRequests'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchProviderCredentials = useCallback(async () => {
    try {
      setCredentialsLoading(true);
      setCredentialsError('');
      const response = await adminAPI.getProviderCredentials();
      if (response.success) {
        setProviderCredentials(response.data || []);
      }
    } catch (err) {
      setCredentialsError(err.message || t('failedLoadProviderCredentials'));
    } finally {
      setCredentialsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchVerifications();
    fetchProviderCredentials();
  }, [fetchProviderCredentials, fetchVerifications]);

  useEffect(() => {
    if (!documentPreview && !rejectDialog.open && !credentialRejectDialog.open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (documentPreview) {
          setDocumentPreview(null);
          setIsImageZoomed(false);
          return;
        }

        if (rejectDialog.open) {
          setRejectDialog({
            open: false,
            requestId: null,
            reason: '',
            error: '',
          });
          return;
        }

        if (credentialRejectDialog.open) {
          setCredentialRejectDialog({
            open: false,
            credentialId: null,
            reason: '',
            error: '',
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [documentPreview, rejectDialog.open, credentialRejectDialog.open]);

  const getDocumentType = (dataUrl) => {
    if (!dataUrl || typeof dataUrl !== 'string') {
      return { kind: 'unknown', mime: '' };
    }

    const mimeMatch = dataUrl.match(/^data:([^;,]+)[;,]/i);
    const mime = (mimeMatch?.[1] || '').toLowerCase();

    if (mime === 'application/pdf') {
      return { kind: 'pdf', mime };
    }

    if (mime.startsWith('image/')) {
      return { kind: 'image', mime };
    }

    return { kind: 'unknown', mime };
  };

  const openDocumentPreview = (dataUrl, label) => {
    if (!dataUrl) {
      return;
    }

    const { kind, mime } = getDocumentType(dataUrl);
    setIsImageZoomed(false);
    setDocumentPreview({
      dataUrl,
      label,
      kind,
      mime,
    });
  };

  const closeDocumentPreview = () => {
    setDocumentPreview(null);
    setIsImageZoomed(false);
  };

  const openRejectDialog = (requestId) => {
    setRejectDialog({
      open: true,
      requestId,
      reason: '',
      error: '',
    });
  };

  const closeRejectDialog = () => {
    setRejectDialog({
      open: false,
      requestId: null,
      reason: '',
      error: '',
    });
  };

  const handleReview = async (requestId, action, rejectionReasonInput = '') => {
    try {
      setActionLoading(`${requestId}-${action}`);
      let payload = { action };

      if (action === 'reject') {
        const trimmedReason = rejectionReasonInput.trim();
        if (!trimmedReason) {
          setRejectDialog((prev) => ({
            ...prev,
            error: t('rejectionReasonRequired'),
          }));
          return;
        }
        payload = { ...payload, rejectionReason: trimmedReason };
      }

      const response = await adminAPI.reviewVerificationRequest(requestId, payload);
      if (response.success) {
        if (action === 'reject') {
          closeRejectDialog();
        }
        await fetchVerifications();
      }
    } catch (err) {
      if (action === 'reject') {
        setRejectDialog((prev) => ({
          ...prev,
          error: err.message || t('failedRejectRequest'),
        }));
      } else {
        alert(err.message || t('failedReviewRequest'));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const openCredentialRejectDialog = (credentialId) => {
    setCredentialRejectDialog({
      open: true,
      credentialId,
      reason: '',
      error: '',
    });
  };

  const closeCredentialRejectDialog = () => {
    setCredentialRejectDialog({
      open: false,
      credentialId: null,
      reason: '',
      error: '',
    });
  };

  const handleCredentialReview = async (credentialId, action, reasonInput = '') => {
    try {
      setCredentialActionLoading(`${credentialId}-${action}`);
      let payload = { action };

      if (action === 'reject') {
        const trimmedReason = reasonInput.trim();
        if (!trimmedReason) {
          setCredentialRejectDialog((prev) => ({
            ...prev,
            error: t('rejectionReasonRequired'),
          }));
          return;
        }
        payload = { ...payload, reason: trimmedReason };
      }

      const response = await adminAPI.reviewProviderCredential(credentialId, payload);
      if (response.success) {
        if (action === 'reject') {
          closeCredentialRejectDialog();
        }
        await fetchProviderCredentials();
      }
    } catch (err) {
      if (action === 'reject') {
        setCredentialRejectDialog((prev) => ({
          ...prev,
          error: err.message || t('failedRejectCredential'),
        }));
      } else {
        alert(err.message || t('failedReviewCredential'));
      }
    } finally {
      setCredentialActionLoading(null);
    }
  };

  const filteredVerifications = verifications.filter((v) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      v.fullName.toLowerCase().includes(query) ||
      v.email.toLowerCase().includes(query) ||
      (v.profession || '').toLowerCase().includes(query);

    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = verifications.filter((v) => v.status === 'pending').length;
  const approvedCount = verifications.filter((v) => v.status === 'approved').length;
  const rejectedCount = verifications.filter((v) => v.status === 'rejected').length;

  const filteredCredentials = providerCredentials.filter((credential) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      (credential.provider?.name || '').toLowerCase().includes(query) ||
      (credential.credentialName || '').toLowerCase().includes(query) ||
      (credential.credentialType || '').toLowerCase().includes(query);

    const status = credential.verificationStatus || 'unverified';
    const matchesStatus = credentialFilterStatus === 'all' || status === credentialFilterStatus;
    return matchesSearch && matchesStatus;
  });

  const credentialPendingCount = providerCredentials.filter((c) => c.verificationStatus === 'pending').length;
  const credentialVerifiedCount = providerCredentials.filter((c) => c.verificationStatus === 'verified').length;
  const credentialRejectedCount = providerCredentials.filter((c) => c.verificationStatus === 'rejected').length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">{t('verificationRequests')}</h1>
        <p className="admin-page-subtitle">{t('verificationRequestsSubtitle')}</p>
      </div>

      <div className="mini-stats">
        <div className="mini-stat">
          <span className="mini-stat-value text-warning">{pendingCount}</span>
          <span className="mini-stat-label">{t('pending')}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value text-success">{approvedCount}</span>
          <span className="mini-stat-label">{t('approved')}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value text-danger">{rejectedCount}</span>
          <span className="mini-stat-label">{t('rejected')}</span>
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
            placeholder={t('searchVerificationPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">{t('allStatuses')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="approved">{t('approved')}</option>
            <option value="rejected">{t('rejected')}</option>
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger mt-3">{error}</div>}

      <div className="requests-list">
        {loading ? (
          <div className="text-center py-4">{t('loadingVerificationRequests')}</div>
        ) : (
          filteredVerifications.map((request) => (
            <div key={request.id} className={`request-card verification-card ${request.status !== 'pending' ? 'processed' : ''}`}>
              <div className="request-avatar">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>

              <div className="request-info">
                <div className="request-header">
                  <h4 className="request-name">{request.fullName}</h4>
                  {request.profession && <span className="document-tag">{request.profession}</span>}
                  <span className={`status-badge status-${request.status === 'approved' ? 'verified' : request.status === 'rejected' ? 'suspended' : 'pending'}`}>
                    {request.status}
                  </span>
                </div>

                <p className="request-detail">Email: {request.email}</p>
                <p className="request-detail">Phone: {request.phoneNumber}</p>
                <p className="request-detail">Address: {request.address}</p>
                <p className="request-detail">Submitted: {new Date(request.createdAt).toLocaleString()}</p>
                <p className="request-detail">Service Details: {request.serviceDescription}</p>

                {request.rejectionReason && (
                  <p className="rejection-reason"><strong>{t('adminRejectionReason')}:</strong> {request.rejectionReason}</p>
                )}

                <div className="request-documents">
                  <button
                    className="btn-view-details"
                    onClick={() => openDocumentPreview(request.documents?.governmentId, 'Government ID')}
                    disabled={!request.documents?.governmentId}
                    aria-label={t('adminPreviewGovernmentIdDocument')}
                  >
                    {t('adminViewGovernmentId')}
                  </button>
                  <button
                    className="btn-view-details"
                    onClick={() => openDocumentPreview(request.documents?.certifications, 'Certifications')}
                    disabled={!request.documents?.certifications}
                    aria-label={t('adminPreviewCertificationsDocument')}
                  >
                    {t('adminViewCertifications')}
                  </button>
                </div>

                {!request.documents?.governmentId && !request.documents?.certifications && (
                  <p className="request-detail">{t('adminNoDocumentSubmitted')}</p>
                )}
              </div>

              <div className="request-actions">
                {request.status === 'pending' ? (
                  <>
                    <button
                      className="btn-approve"
                      disabled={actionLoading === `${request.id}-approve`}
                      onClick={() => handleReview(request.id, 'approve')}
                    >
                      {actionLoading === `${request.id}-approve` ? t('adminApproving') : t('adminApproveVerification')}
                    </button>
                    <button
                      className="btn-reject"
                      disabled={actionLoading === `${request.id}-reject`}
                      onClick={() => openRejectDialog(request.id)}
                    >
                      {actionLoading === `${request.id}-reject` ? t('requestsDeclining') : t('adminRejectVerification')}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-view-details"
                    onClick={() => openDocumentPreview(request.documents?.governmentId || request.documents?.certifications, 'Verification Document')}
                    disabled={!request.documents?.governmentId && !request.documents?.certifications}
                    aria-label={t('adminPreviewVerificationDocument')}
                  >
                    {t('viewDetails')}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && filteredVerifications.length === 0 && (
        <div className="empty-state">
          <h3>{t('noVerificationRequestsFound')}</h3>
          <p>{t('adminTryAdjustingSearchFilter')}</p>
        </div>
      )}

      <div className="admin-page-header" style={{ marginTop: '2rem' }}>
        <h2 className="admin-page-title" style={{ fontSize: '1.4rem' }}>{t('adminProviderCredentialReviews')}</h2>
        <p className="admin-page-subtitle">{t('adminReviewSubmittedCredentials')}</p>
      </div>

      <div className="mini-stats">
        <div className="mini-stat">
          <span className="mini-stat-value text-warning">{credentialPendingCount}</span>
          <span className="mini-stat-label">{t('pending')}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value text-success">{credentialVerifiedCount}</span>
          <span className="mini-stat-label">{t('verified')}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value text-danger">{credentialRejectedCount}</span>
          <span className="mini-stat-label">{t('rejected')}</span>
        </div>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <select value={credentialFilterStatus} onChange={(e) => setCredentialFilterStatus(e.target.value)}>
            <option value="all">{t('allStatuses')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="verified">{t('verified')}</option>
            <option value="rejected">{t('rejected')}</option>
            <option value="expired">{t('adminExpired')}</option>
            <option value="unverified">{t('adminUnverified')}</option>
          </select>
        </div>
      </div>

      {credentialsError && <div className="alert alert-danger mt-3">{credentialsError}</div>}

      <div className="requests-list">
        {credentialsLoading ? (
          <div className="text-center py-4">{t('adminLoadingProviderCredentials')}</div>
        ) : (
          filteredCredentials.map((credential) => (
            <div key={credential.id} className={`request-card verification-card ${credential.verificationStatus !== 'pending' ? 'processed' : ''}`}>
              <div className="request-avatar">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>

              <div className="request-info">
                <div className="request-header">
                  <h4 className="request-name">{credential.provider?.name || t('adminUnknownProvider')}</h4>
                  <span className="document-tag">{credential.credentialType || t('adminCredentialLabel')}</span>
                  <span className={`status-badge status-${credential.verificationStatus === 'verified' ? 'verified' : credential.verificationStatus === 'rejected' ? 'suspended' : 'pending'}`}>
                    {credential.verificationStatus || 'unverified'}
                  </span>
                </div>

                <p className="request-detail">{t('adminCredentialField')}: {credential.credentialName || t('adminUnnamedCredential')}</p>
                <p className="request-detail">{t('adminIssuerField')}: {credential.issuingOrganization || t('adminNotProvided')}</p>
                <p className="request-detail">{t('providerCredentialIdLabel')}: {credential.credentialId || t('adminNotProvided')}</p>
                <p className="request-detail">{t('submittedLabel')}: {new Date(credential.createdAt).toLocaleString()}</p>
                {credential.verificationNotes && (
                  <p className="rejection-reason"><strong>{t('adminReviewNote')}:</strong> {credential.verificationNotes}</p>
                )}

                <div className="request-documents">
                  <button
                    className="btn-view-details"
                    onClick={() => openDocumentPreview(credential.document, 'Credential Document')}
                    disabled={!credential.document}
                    aria-label={t('adminPreviewCredentialDocument')}
                  >
                    {t('adminViewCredentialDocument')}
                  </button>
                </div>
              </div>

              <div className="request-actions">
                {credential.verificationStatus === 'pending' || credential.verificationStatus === 'unverified' ? (
                  <>
                    <button
                      className="btn-approve"
                      disabled={credentialActionLoading === `${credential.id}-approve`}
                      onClick={() => handleCredentialReview(credential.id, 'approve')}
                    >
                      {credentialActionLoading === `${credential.id}-approve` ? t('adminApproving') : t('adminApproveCredential')}
                    </button>
                    <button
                      className="btn-reject"
                      disabled={credentialActionLoading === `${credential.id}-reject`}
                      onClick={() => openCredentialRejectDialog(credential.id)}
                    >
                      {credentialActionLoading === `${credential.id}-reject` ? t('requestsDeclining') : t('adminRejectCredential')}
                    </button>
                    <button
                      className="btn-view-details"
                      disabled={credentialActionLoading === `${credential.id}-expire`}
                      onClick={() => handleCredentialReview(credential.id, 'expire')}
                    >
                      {credentialActionLoading === `${credential.id}-expire` ? t('adminExpiring') : t('adminMarkExpired')}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-view-details"
                    onClick={() => openDocumentPreview(credential.document, 'Credential Document')}
                    disabled={!credential.document}
                    aria-label={t('adminPreviewCredentialDocument')}
                  >
                    {t('viewDetails')}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {!credentialsLoading && filteredCredentials.length === 0 && (
        <div className="empty-state">
          <h3>{t('adminNoProviderCredentialsFound')}</h3>
          <p>{t('adminTryAdjustingSearchFilter')}</p>
        </div>
      )}

      {documentPreview && (
        <div
          className="admin-document-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${documentPreview.label} preview`}
          onClick={closeDocumentPreview}
        >
          <div className="admin-document-preview-dialog" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="admin-document-preview-close"
              onClick={closeDocumentPreview}
              aria-label={t('adminCloseDocumentPreview')}
            >
              ×
            </button>

            {documentPreview.kind === 'image' ? (
              <div className="admin-document-image-container">
                <button
                  type="button"
                  className="admin-document-zoom-toggle"
                  onClick={() => setIsImageZoomed((prev) => !prev)}
                  aria-label={isImageZoomed ? t('adminResetImageZoom') : t('adminEnlargeImage')}
                >
                  {isImageZoomed ? t('adminResetZoom') : t('adminEnlarge')}
                </button>
                <img
                  src={documentPreview.dataUrl}
                  alt={`${documentPreview.label} document`}
                  className={`admin-document-preview-image ${isImageZoomed ? 'zoomed' : ''}`}
                  onClick={() => setIsImageZoomed((prev) => !prev)}
                />
              </div>
            ) : null}

            {documentPreview.kind === 'pdf' ? (
              <div className="admin-document-pdf-container">
                <iframe
                  src={documentPreview.dataUrl}
                  title={`${documentPreview.label} PDF preview`}
                  className="admin-document-preview-pdf"
                />
                <p className="admin-document-preview-fallback">
                  {t('adminPdfPreviewFallback')}
                </p>
              </div>
            ) : null}

            {documentPreview.kind === 'unknown' ? (
              <div className="admin-document-preview-unsupported">
                <p>{t('adminPreviewUnavailableForType')}</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {rejectDialog.open && (
        <div
          className="admin-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="verification-reject-title"
          onClick={closeRejectDialog}
        >
          <div className="admin-dialog-card danger" onClick={(event) => event.stopPropagation()}>
            <div className="admin-dialog-header">
              <h2 id="verification-reject-title" className="admin-dialog-title">{t('adminRejectVerificationRequest')}</h2>
              <button
                type="button"
                className="admin-dialog-close"
                onClick={closeRejectDialog}
                aria-label={t('adminCloseRejectionDialog')}
              >
                ×
              </button>
            </div>

            <div className="admin-dialog-body">
              <label htmlFor="verification-rejection-reason" className="settings-label">
                {t('adminRejectionReason')}
              </label>
              <textarea
                id="verification-rejection-reason"
                className="settings-textarea admin-reject-textarea"
                value={rejectDialog.reason}
                onChange={(event) => {
                  const value = event.target.value;
                  setRejectDialog((prev) => ({
                    ...prev,
                    reason: value,
                    error: prev.error ? '' : prev.error,
                  }));
                }}
                rows={4}
                maxLength={500}
                aria-required="true"
              />
              {rejectDialog.error && <p className="admin-dialog-error">{rejectDialog.error}</p>}
            </div>

            <div className="admin-dialog-actions admin-dialog-actions-split">
              <button
                type="button"
                className="btn-view-details"
                onClick={closeRejectDialog}
                disabled={actionLoading === `${rejectDialog.requestId}-reject`}
              >
                {t('requestsCancelAction')}
              </button>
              <button
                type="button"
                className="btn-reject"
                onClick={() => handleReview(rejectDialog.requestId, 'reject', rejectDialog.reason)}
                disabled={actionLoading === `${rejectDialog.requestId}-reject` || !rejectDialog.reason.trim()}
              >
                {actionLoading === `${rejectDialog.requestId}-reject` ? t('requestsDeclining') : t('adminConfirmRejection')}
              </button>
            </div>
          </div>
        </div>
      )}

      {credentialRejectDialog.open && (
        <div
          className="admin-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="credential-reject-title"
          onClick={closeCredentialRejectDialog}
        >
          <div className="admin-dialog-card danger" onClick={(event) => event.stopPropagation()}>
            <div className="admin-dialog-header">
              <h2 id="credential-reject-title" className="admin-dialog-title">{t('adminRejectCredential')}</h2>
              <button
                type="button"
                className="admin-dialog-close"
                onClick={closeCredentialRejectDialog}
                aria-label={t('adminCloseCredentialRejectionDialog')}
              >
                ×
              </button>
            </div>

            <div className="admin-dialog-body">
              <label htmlFor="credential-rejection-reason" className="settings-label">
                {t('adminRejectionReason')}
              </label>
              <textarea
                id="credential-rejection-reason"
                className="settings-textarea admin-reject-textarea"
                value={credentialRejectDialog.reason}
                onChange={(event) => {
                  const value = event.target.value;
                  setCredentialRejectDialog((prev) => ({
                    ...prev,
                    reason: value,
                    error: prev.error ? '' : prev.error,
                  }));
                }}
                rows={4}
                maxLength={500}
                aria-required="true"
              />
              {credentialRejectDialog.error && <p className="admin-dialog-error">{credentialRejectDialog.error}</p>}
            </div>

            <div className="admin-dialog-actions admin-dialog-actions-split">
              <button
                type="button"
                className="btn-view-details"
                onClick={closeCredentialRejectDialog}
                disabled={credentialActionLoading === `${credentialRejectDialog.credentialId}-reject`}
              >
                {t('requestsCancelAction')}
              </button>
              <button
                type="button"
                className="btn-reject"
                onClick={() => handleCredentialReview(credentialRejectDialog.credentialId, 'reject', credentialRejectDialog.reason)}
                disabled={credentialActionLoading === `${credentialRejectDialog.credentialId}-reject` || !credentialRejectDialog.reason.trim()}
              >
                {credentialActionLoading === `${credentialRejectDialog.credentialId}-reject` ? t('requestsDeclining') : t('adminConfirmRejection')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminVerifications;
