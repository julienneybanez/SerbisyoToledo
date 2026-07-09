import './RequestDetailsModal.css';

export default function RequestDetailsModal({ request, isProvider, onClose, onStatusUpdate, onRequestDiscussion, onAcceptDiscussion, onOpenReview, onOpenReport, actionLoading }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

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
          <h2 className="modal-title">{request.job_title}</h2>
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
              {isProvider && request.client_email && (
                <div className="info-row">
                  <span className="info-label">Email</span>
                  <span className="info-value">{request.client_email}</span>
                </div>
              )}
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
                <span className="info-value">{formatDate(request.scheduled_date)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Time</span>
                <span className="info-value">{request.scheduled_time}</span>
              </div>
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

          {/* Client Address (if available) */}
          {request.client_address && (
            <div className="detail-card full-width">
              <div className="detail-card-header">
                <i className="bi bi-geo-alt"></i>
                <h3>Service Location</h3>
              </div>
              <div className="detail-card-body">
                <p className="address-text">{request.client_address}</p>
              </div>
            </div>
          )}

          {/* Contact Information for Active Requests */}
          {['accepted', 'on_the_way', 'in_progress'].includes(request.status) && (
            <div className="detail-card full-width contact-card">
              <div className="detail-card-header">
                <i className="bi bi-telephone"></i>
                <h3>Contact Information</h3>
              </div>
              <div className="detail-card-body">
                {!isProvider && request.discussion_accepted && request.provider_phone ? (
                  <div className="phone-display">
                    <i className="bi bi-telephone-fill"></i>
                    <div>
                      <span className="phone-label">Provider's Phone</span>
                      <a href={`tel:${request.provider_phone}`} className="phone-number">
                        {request.provider_phone}
                      </a>
                    </div>
                  </div>
                ) : isProvider && request.discussion_accepted ? (
                  <div className="contact-shared-notice">
                    <i className="bi bi-check-circle-fill"></i>
                    <span>Your contact information has been shared with the client.</span>
                  </div>
                ) : isProvider && request.discussion_requested ? (
                  <div className="discussion-request-modal">
                    <div className="discussion-request-info">
                      <i className="bi bi-chat-dots-fill"></i>
                      <span>The client wants to discuss details about this job.</span>
                    </div>
                    <button
                      className="btn-accept-discussion-modal"
                      onClick={() => onAcceptDiscussion && onAcceptDiscussion(request.id)}
                      disabled={actionLoading === request.id}
                    >
                      {actionLoading === request.id ? (
                        <><span className="spinner-btn"></span> Accepting...</>
                      ) : (
                        <><i className="bi bi-telephone"></i> Accept & Share Phone Number</>
                      )}
                    </button>
                  </div>
                ) : !isProvider && request.discussion_requested ? (
                  <div className="discussion-pending-modal">
                    <i className="bi bi-hourglass-split"></i>
                    <span>Waiting for provider to accept discussion request...</span>
                  </div>
                ) : !isProvider ? (
                  <div className="discussion-request-modal">
                    <div className="contact-pending-notice">
                      <i className="bi bi-info-circle"></i>
                      <span>Request a discussion to get the provider's contact information.</span>
                    </div>
                    <button
                      className="btn-request-discussion-modal"
                      onClick={() => onRequestDiscussion && onRequestDiscussion(request.id)}
                      disabled={actionLoading === request.id}
                    >
                      {actionLoading === request.id ? (
                        <><span className="spinner-btn"></span> Sending...</>
                      ) : (
                        <><i className="bi bi-chat-dots"></i> Request to Discuss Details</>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="contact-pending-notice">
                    <i className="bi bi-info-circle"></i>
                    <span>Contact information will be available once the client requests a discussion.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="modal-actions">
          <button
            className="action-btn btn-decline"
            onClick={() => onOpenReport && onOpenReport(request)}
          >
            <i className="bi bi-flag"></i> Report User
          </button>

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
                onClick={() => void onStatusUpdate(request.id, 'declined')}
                disabled={actionLoading === request.id}
              >
                <i className="bi bi-x-lg"></i> Decline
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

          {/* Two-way completion: Provider confirm */}
          {isProvider && ['on_the_way', 'in_progress'].includes(request.status) && !request.provider_completed && (
            <button
              className="action-btn btn-complete"
              onClick={() => void onStatusUpdate(request.id, 'completed')}
              disabled={actionLoading === request.id}
            >
              {actionLoading === request.id ? (
                <><span className="spinner-btn"></span> Confirming...</>
              ) : (
                <><i className="bi bi-check-circle"></i> Confirm Completed</>
              )}
            </button>
          )}

          {/* Two-way completion: Client confirm */}
          {!isProvider && ['on_the_way', 'in_progress'].includes(request.status) && !request.client_completed && (
            <button
              className="action-btn btn-complete"
              onClick={() => void onStatusUpdate(request.id, 'completed')}
              disabled={actionLoading === request.id}
            >
              {actionLoading === request.id ? (
                <><span className="spinner-btn"></span> Confirming...</>
              ) : (
                <><i className="bi bi-check-circle"></i> Confirm Completed</>
              )}
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
