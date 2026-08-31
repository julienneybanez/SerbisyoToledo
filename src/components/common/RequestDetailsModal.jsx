import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import './RequestDetailsModal.css';

export default function RequestDetailsModal({
  request,
  isProvider,
  currentUserId,
  detailsLoading,
  onClose,
  onStatusUpdate,
  onOpenReview,
  onOpenDecline,
  onOpenCancel,
  onOpenReschedule,
  onRespondReschedule,
  onOpenReport,
  actionLoading,
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateSafe = (value) => {
    if (!value) return '-';
    return formatDate(value);
  };

  const formatReason = (value) => {
    if (!value) return '-';
    return String(value).replaceAll('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const requestStartDate = request.start_date || request.scheduled_date;
  const requestEndDate = request.end_date || request.scheduled_date;
  const requestStartTime = request.start_time || request.scheduled_time;
  const selectedDates = Array.isArray(request.selected_dates) ? request.selected_dates : [];
  const isSpecificDateMode = request.booking_type === 'multi_day' && request.multi_day_mode === 'specific_dates';
  const isMultiDay = Boolean(requestEndDate && requestStartDate && requestEndDate !== requestStartDate);

  const reschedules = Array.isArray(request.reschedules) ? request.reschedules : [];

  const formatStatus = (status) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      pending: 'badge-pending',
      accepted: 'badge-accepted',
      declined: 'badge-declined',
      on_the_way: 'badge-on-way',
      in_progress: 'badge-in-progress',
      completed: 'badge-completed',
      cancelled: 'badge-cancelled',
    };
    return statusClasses[status] || 'badge-pending';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: 'bi-hourglass-split',
      accepted: 'bi-check-circle',
      declined: 'bi-x-circle',
      on_the_way: 'bi-truck',
      in_progress: 'bi-gear',
      completed: 'bi-check-circle-fill',
      cancelled: 'bi-x-octagon',
    };
    return icons[status] || 'bi-circle';
  };

  return (
    <div className="request-details-overlay" onClick={onClose}>
      <div className="request-details-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </button>

        <div className="modal-header-section">
          <div className="status-icon-wrapper">
            <i className={`bi ${getStatusIcon(request.status)}`}></i>
          </div>
          <h2 className="modal-title">{request.service_display_label || request.service_type_label || 'Service Request'}</h2>
          <span className={`status-badge-large ${getStatusBadgeClass(request.status)}`}>
            {formatStatus(request.status)}
          </span>
        </div>

        <div className="modal-content-section">
          {/* Client/Provider Info */}
          <div className="detail-card">
            <div className="detail-card-header">
              <i className="bi bi-person-circle"></i>
              <h3>{isProvider ? 'Client Information' : 'Provider Information'}</h3>
            </div>
            <div className="detail-card-body">
              <div className="info-row">
                <span className="info-label">Name</span>
                <span className="info-value">{isProvider ? request.client_name : request.provider_name}</span>
              </div>
              {!isProvider && request.provider_location && (
                <div className="info-row">
                  <span className="info-label">Location</span>
                  <span className="info-value">{request.provider_location}</span>
                </div>
              )}
              {request.service_profile_name && (
                <div className="info-row">
                  <span className="info-label">Service</span>
                  <span className="info-value">{request.service_profile_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Schedule Info */}
          <div className="detail-card">
            <div className="detail-card-header">
              <i className="bi bi-calendar-event"></i>
              <h3>Schedule Details</h3>
            </div>
            <div className="detail-card-body">
              <div className="info-row">
                <span className="info-label">Date</span>
                <span className="info-value">{formatDateSafe(requestStartDate)}</span>
              </div>
              {isSpecificDateMode && selectedDates.length > 0 && (
                <div className="info-row">
                  <span className="info-label">Specific Dates</span>
                  <span className="info-value">{selectedDates.map((value) => formatDateSafe(value)).join(' | ')}</span>
                </div>
              )}
              {isMultiDay && (
                <div className="info-row">
                  <span className="info-label">End Date</span>
                  <span className="info-value">{formatDateSafe(requestEndDate)}</span>
                </div>
              )}
              <div className="info-row">
                <span className="info-label">Time</span>
                <span className="info-value">{requestStartTime || '-'}</span>
              </div>
              {request.estimated_total != null && (
                <div className="info-row">
                  <span className="info-label">Estimated Total</span>
                  <span className="info-value">₱{Number(request.estimated_total).toLocaleString()}</span>
                </div>
              )}
              <div className="info-row">
                <span className="info-label">Request Created</span>
                <span className="info-value">{formatDate(request.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Job Details */}
          <div className="detail-card full-width">
            <div className="detail-card-header">
              <i className="bi bi-file-text"></i>
              <h3>Job Details</h3>
            </div>
            <div className="detail-card-body">
              <p className="job-details-text">
                {request.job_details || 'No additional details provided.'}
              </p>
            </div>
          </div>

          {request.status === 'declined' && request.decline_reason && (
            <div className="detail-card full-width decline-reason-card">
              <div className="detail-card-header">
                <i className="bi bi-exclamation-circle"></i>
                <h3>Reason for declining</h3>
              </div>
              <div className="detail-card-body">
                <p className="job-details-text">{request.decline_reason}</p>
              </div>
            </div>
          )}

          {request.status === 'cancelled' && request.cancellation_reason && (
            <div className="detail-card full-width decline-reason-card">
              <div className="detail-card-header">
                <i className="bi bi-exclamation-circle"></i>
                <h3>Reason for cancellation</h3>
              </div>
              <div className="detail-card-body">
                <p className="job-details-text">{request.cancellation_reason_other || formatReason(request.cancellation_reason)}</p>
              </div>
            </div>
          )}

          <div className="detail-card full-width">
            <div className="detail-card-header">
              <i className="bi bi-arrow-repeat"></i>
              <h3>Reschedule History</h3>
            </div>
            <div className="detail-card-body">
              {detailsLoading ? (
                <p className="job-details-text">Loading schedule history...</p>
              ) : reschedules.length === 0 ? (
                <p className="job-details-text">No reschedule proposals yet.</p>
              ) : (
                <div className="reschedule-list">
                  {reschedules.map((item) => {
                    const isPending = item.reschedule_status === 'pending';
                    const actorCanRespond = isPending && currentUserId && Number(item.proposed_by) !== Number(currentUserId);

                    return (
                      <div className="reschedule-item" key={item.id}>
                        <div className="info-row">
                          <span className="info-label">Proposed Date</span>
                          <span className="info-value">
                            {item.proposed_multi_day_mode === 'specific_dates' && Array.isArray(item.proposed_specific_dates) && item.proposed_specific_dates.length > 0
                              ? item.proposed_specific_dates.map((value) => formatDateSafe(value)).join(' | ')
                              : (
                                <>
                                  {formatDateSafe(item.proposed_start_date)}
                                  {item.proposed_end_date && item.proposed_end_date !== item.proposed_start_date
                                    ? ` to ${formatDateSafe(item.proposed_end_date)}`
                                    : ''}
                                </>
                              )}
                          </span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Proposed Time</span>
                          <span className="info-value">{item.proposed_start_time || '-'}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Reason</span>
                          <span className="info-value">{item.reschedule_reason || '-'}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Status</span>
                          <span className="info-value">{formatReason(item.reschedule_status)}</span>
                        </div>

                        {actorCanRespond && (
                          <div className="reschedule-actions">
                            <button
                              className="action-btn btn-accept"
                              onClick={() => onRespondReschedule && onRespondReschedule(request.id, item.id, 'accepted')}
                              disabled={actionLoading === request.id}
                            >
                              Accept Proposal
                            </button>
                            <button
                              className="action-btn btn-decline"
                              onClick={() => onRespondReschedule && onRespondReschedule(request.id, item.id, 'declined')}
                              disabled={actionLoading === request.id}
                            >
                              Decline Proposal
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Request-owned service location snapshot */}
          {request.service_location && (
            <div className="detail-card full-width">
              <div className="detail-card-header">
                <i className="bi bi-geo-alt"></i>
                <h3>Service Location</h3>
              </div>
              <div className="detail-card-body">
                <p className="address-text">{request.service_location}</p>
              </div>
            </div>
          )}

          {/* Keep booking communication inside Messages; phone sharing lives there too. */}
          {['pending', 'accepted', 'on_the_way', 'in_progress'].includes(request.status) && (
            <div className="detail-card full-width contact-card">
              <div className="detail-card-header">
                <i className="bi bi-chat-dots"></i>
                <h3>{t('requestCommunication')}</h3>
              </div>
              <div className="detail-card-body">
                <div className="discussion-request-modal">
                  <div className="contact-pending-notice">
                    <i className="bi bi-chat-square-text"></i>
                    <span>{t('requestMessagesHelp')}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-request-discussion-modal"
                    onClick={() => {
                      onClose?.();
                      navigate('/messages?request=' + request.id);
                    }}
                  >
                    <i className="bi bi-chat-dots-fill"></i> {isProvider ? t('messageClient') : t('messageProvider')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="modal-actions">
          {onOpenReport && (
            <button className="action-btn btn-decline" onClick={() => onOpenReport(request)}>
              <i className="bi bi-flag"></i> Report User
            </button>
          )}

          {/* Provider-only: pending actions */}
          {isProvider && request.status === 'pending' && (
            <>
              <button
                className="action-btn btn-accept"
                onClick={() => void onStatusUpdate(request.id, 'accepted')}
                disabled={actionLoading === request.id}
              >
                {actionLoading === request.id ? (
                  <><span className="spinner-btn"></span> Processing...</>
                ) : (
                  <><i className="bi bi-check-lg"></i> Accept Request</>
                )}
              </button>
              <button
                className="action-btn btn-decline"
                onClick={() => onOpenDecline && onOpenDecline(request)}
                disabled={actionLoading === request.id}
              >
                <i className="bi bi-x-lg"></i> Decline Request
              </button>
            </>
          )}

          {/* Provider-only: on the way */}
          {isProvider && request.status === 'accepted' && (
            <button
              className="action-btn btn-on-way"
              onClick={() => void onStatusUpdate(request.id, 'on_the_way')}
              disabled={actionLoading === request.id}
            >
              {actionLoading === request.id ? (
                <><span className="spinner-btn"></span> Updating...</>
              ) : (
                <><i className="bi bi-truck"></i> I'm On My Way</>
              )}
            </button>
          )}

          {isProvider && request.status === 'on_the_way' && onStatusUpdate && (
            <button className="action-btn btn-on-way" onClick={() => void onStatusUpdate(request.id, 'in_progress')} disabled={actionLoading === request.id}>
              {actionLoading === request.id ? <><span className="spinner-btn"></span> Updating...</> : <><i className="bi bi-play-circle"></i> Start Service</>}
            </button>
          )}

          {isProvider && request.status === 'in_progress' && !request.provider_completed && onStatusUpdate && (
            <button className="action-btn btn-complete" onClick={() => void onStatusUpdate(request.id, 'completed')} disabled={actionLoading === request.id}>
              {actionLoading === request.id ? <><span className="spinner-btn"></span> Confirming...</> : <><i className="bi bi-check-circle"></i> Mark Service Complete</>}
            </button>
          )}

          {!isProvider && request.status === 'in_progress' && !request.client_completed && onStatusUpdate && (
            <button className="action-btn btn-complete" onClick={() => void onStatusUpdate(request.id, 'completed')} disabled={actionLoading === request.id}>
              {actionLoading === request.id ? <><span className="spinner-btn"></span> Confirming...</> : <><i className="bi bi-check-circle"></i> Mark Service Complete</>}
            </button>
          )}

          {/* Client: Leave a review on completed request */}
          {!isProvider && request.status === 'completed' && !request.has_review && (
            <button
              className="action-btn btn-review"
              onClick={() => onOpenReview && onOpenReview(request)}
            >
              <i className="bi bi-star"></i> Leave a Review
            </button>
          )}
          {!isProvider && request.status === 'completed' && request.has_review && (
            <span className="review-submitted-badge">
              <i className="bi bi-star-fill"></i> Review Submitted
            </span>
          )}

          {!isProvider && request.status === 'pending' && onOpenCancel && (
            <button className="action-btn btn-cancel" onClick={() => onOpenCancel(request)} disabled={actionLoading === request.id}>
              Cancel Request
            </button>
          )}

          {request.status === 'accepted' && onOpenCancel && (
            <button className="action-btn btn-cancel" onClick={() => onOpenCancel(request)} disabled={actionLoading === request.id}>
              Cancel Service Request
            </button>
          )}

          {request.status === 'accepted' && onOpenReschedule && (
            <button className="action-btn btn-on-way" onClick={() => onOpenReschedule(request)} disabled={actionLoading === request.id}>
              Propose Reschedule
            </button>
          )}
        </div>

        {/* Close Button */}
        <div className="modal-footer">
          <button className="btn-close-modal" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
