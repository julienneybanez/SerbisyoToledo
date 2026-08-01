import { useState, useEffect, useCallback } from 'react';
import { getUser, serviceRequestAPI } from '../services/api';
import RequestDetailsModal from '../components/common/RequestDetailsModal';
import ReviewModal from '../components/common/ReviewModal';
import ReportUserModal from '../components/common/ReportUserModal';
import './Requests.css';

const getHiddenRequestsStorageKey = (user) => {
  if (!user?.id || !user?.userType) {
    return null;
  }

  return `hiddenRequests_${user.id}_${user.userType}`;
};

const getHiddenRequestIds = (user) => {
  const key = getHiddenRequestsStorageKey(user);
  if (!key) {
    return [];
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  } catch {
    return [];
  }
};

const saveHiddenRequestIds = (user, ids) => {
  const key = getHiddenRequestsStorageKey(user);
  if (!key) {
    return;
  }

  localStorage.setItem(key, JSON.stringify(ids));
};

export default function Requests() {
  const user = getUser();
  const isProvider = user?.userType === 'tradesperson';
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewRequest, setReviewRequest] = useState(null);
  const [reportRequest, setReportRequest] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [declineDialog, setDeclineDialog] = useState({
    open: false,
    requestId: null,
    reason: '',
    error: '',
  });
  const [cancelDialog, setCancelDialog] = useState({
    open: false,
    requestId: null,
    cancellationReason: 'Schedule conflict',
    cancellationReasonOther: '',
    error: '',
  });
  const [rescheduleDialog, setRescheduleDialog] = useState({
    open: false,
    requestId: null,
    proposedStartDate: '',
    proposedEndDate: '',
    proposedStartTime: '',
    estimatedDurationMinutes: 60,
    reason: '',
    error: '',
  });

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = isProvider
        ? await serviceRequestAPI.getProviderRequests()
        : await serviceRequestAPI.getClientRequests();
      
      if (response.success) {
        const hiddenIds = new Set(getHiddenRequestIds({ id: user?.id, userType: user?.userType }));
        const visibleRequests = (response.data.requests || []).filter((req) => !hiddenIds.has(Number(req.id)));
        setRequests(visibleRequests);
      }
    } catch (err) {
      setError('Failed to load requests');
      console.error('Fetch requests error:', err);
    } finally {
      setLoading(false);
    }
  }, [isProvider, user?.id, user?.userType]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleStatusUpdate = async (requestId, status, reason = null, options = {}) => {
    const { suppressAlert = false, cancellation = null } = options;
    setActionLoading(requestId);
    try {
      const response = await serviceRequestAPI.updateStatus(requestId, status, reason, cancellation);
      if (response.success) {
        if (status === 'completed' && response.data) {
          // Two-way completion
          if (response.data.fullyCompleted) {
            // Both confirmed — mark as completed
            setRequests(prev =>
              prev.map(req =>
                req.id === requestId ? { ...req, status: 'completed', provider_completed: true, client_completed: true } : req
              )
            );
            if (selectedRequest?.id === requestId) {
              setSelectedRequest(prev => ({ ...prev, status: 'completed', provider_completed: true, client_completed: true }));
            }
            if (!suppressAlert) {
              alert('Service has been completed by both parties!');
            }
          } else {
            // Only one side confirmed
            setRequests(prev =>
              prev.map(req =>
                req.id === requestId 
                  ? { ...req, 
                      provider_completed: response.data.provider_completed, 
                      client_completed: response.data.client_completed 
                    } 
                  : req
              )
            );
            if (selectedRequest?.id === requestId) {
              setSelectedRequest(prev => ({ 
                ...prev, 
                provider_completed: response.data.provider_completed, 
                client_completed: response.data.client_completed 
              }));
            }
            if (!suppressAlert) {
              alert('Completion confirmed! Waiting for the other party to confirm.');
            }
          }
        } else {
          // Normal status update
          setRequests(prev =>
            prev.map(req =>
              req.id === requestId ? { ...req, status, ...(status === 'declined' ? { decline_reason: reason?.trim() || null } : {}) } : req
            )
          );
          if (selectedRequest?.id === requestId) {
            setSelectedRequest(prev => ({ ...prev, status, ...(status === 'declined' ? { decline_reason: reason?.trim() || null } : {}) }));
          }
        }

        if (status === 'cancelled' && cancellation) {
          setRequests(prev =>
            prev.map(req =>
              req.id === requestId
                ? {
                    ...req,
                    status,
                    cancellation_reason: cancellation.cancellationReason,
                    cancellation_reason_other: cancellation.cancellationReasonOther || null,
                  }
                : req
            )
          );
          if (selectedRequest?.id === requestId) {
            setSelectedRequest(prev => prev ? {
              ...prev,
              status,
              cancellation_reason: cancellation.cancellationReason,
              cancellation_reason_other: cancellation.cancellationReasonOther || null,
            } : null);
          }
        }
        return { success: true };
      }
    } catch (err) {
      console.error('Status update error:', err);
      if (!suppressAlert) {
        alert(err.message || 'Failed to update status');
      }
      return { success: false, message: err.message || 'Failed to update status' };
    } finally {
      setActionLoading(null);
    }

    return { success: false, message: 'Failed to update status' };
  };

  const openCancelDialog = (requestId) => {
    setCancelDialog({
      open: true,
      requestId,
      cancellationReason: 'Schedule conflict',
      cancellationReasonOther: '',
      error: '',
    });
  };

  const closeCancelDialog = () => {
    setCancelDialog({
      open: false,
      requestId: null,
      cancellationReason: 'Schedule conflict',
      cancellationReasonOther: '',
      error: '',
    });
  };

  const handleConfirmCancellation = async () => {
    if (cancelDialog.cancellationReason === 'Other' && !cancelDialog.cancellationReasonOther.trim()) {
      setCancelDialog((prev) => ({
        ...prev,
        error: 'Please provide details for cancellation reason.',
      }));
      return;
    }

    const result = await handleStatusUpdate(cancelDialog.requestId, 'cancelled', null, {
      suppressAlert: true,
      cancellation: {
        cancellationReason: cancelDialog.cancellationReason,
        cancellationReasonOther: cancelDialog.cancellationReasonOther.trim() || null,
      },
    });

    if (result?.success) {
      closeCancelDialog();
      return;
    }

    setCancelDialog((prev) => ({
      ...prev,
      error: result?.message || 'Failed to cancel request',
    }));
  };

  const openRescheduleDialog = (request) => {
    const startDate = request.start_date || request.scheduled_date || '';
    const endDate = request.end_date || request.scheduled_date || '';
    const startTime = request.start_time || request.scheduled_time || '09:00';
    const sqlTime = String(startTime).slice(0, 5);

    setRescheduleDialog({
      open: true,
      requestId: request.id,
      proposedStartDate: String(startDate).slice(0, 10),
      proposedEndDate: String(endDate).slice(0, 10),
      proposedStartTime: sqlTime,
      estimatedDurationMinutes: Number(request.estimated_duration_minutes || 60),
      reason: '',
      error: '',
    });
  };

  const closeRescheduleDialog = () => {
    setRescheduleDialog({
      open: false,
      requestId: null,
      proposedStartDate: '',
      proposedEndDate: '',
      proposedStartTime: '',
      estimatedDurationMinutes: 60,
      reason: '',
      error: '',
    });
  };

  const refreshSelectedRequest = async (requestId) => {
    try {
      setDetailsLoading(true);
      const response = await serviceRequestAPI.getRequestById(requestId);
      if (response.success && response.data?.request) {
        setSelectedRequest({
          ...response.data.request,
          reschedules: response.data.reschedules || [],
        });
      }
    } catch (err) {
      console.error('Failed to refresh request details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleViewDetails = async (request) => {
    setSelectedRequest({ ...request, reschedules: [] });
    await refreshSelectedRequest(request.id);
  };

  const handleSubmitReschedule = async () => {
    const trimmedReason = rescheduleDialog.reason.trim();
    if (!trimmedReason) {
      setRescheduleDialog((prev) => ({ ...prev, error: 'Reschedule reason is required.' }));
      return;
    }

    try {
      setActionLoading(rescheduleDialog.requestId);
      await serviceRequestAPI.proposeReschedule(rescheduleDialog.requestId, {
        proposedStartDate: rescheduleDialog.proposedStartDate,
        proposedEndDate: rescheduleDialog.proposedEndDate,
        proposedStartTime: rescheduleDialog.proposedStartTime,
        estimatedDurationMinutes: Number(rescheduleDialog.estimatedDurationMinutes || 0),
        reason: trimmedReason,
      });

      closeRescheduleDialog();
      await fetchRequests();
      await refreshSelectedRequest(rescheduleDialog.requestId);
    } catch (err) {
      setRescheduleDialog((prev) => ({ ...prev, error: err.message || 'Failed to send reschedule proposal.' }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRespondReschedule = async (requestId, rescheduleId, action) => {
    try {
      setActionLoading(requestId);
      await serviceRequestAPI.respondReschedule(requestId, rescheduleId, action);
      await fetchRequests();
      await refreshSelectedRequest(requestId);
    } catch (err) {
      alert(err.message || 'Failed to respond to reschedule proposal');
    } finally {
      setActionLoading(null);
    }
  };

  const openDeclineDialog = (requestId) => {
    setDeclineDialog({
      open: true,
      requestId,
      reason: '',
      error: '',
    });
  };

  const closeDeclineDialog = () => {
    setDeclineDialog({
      open: false,
      requestId: null,
      reason: '',
      error: '',
    });
  };

  const handleConfirmDecline = async () => {
    const trimmedReason = declineDialog.reason.trim();
    if (!trimmedReason) {
      setDeclineDialog((prev) => ({
        ...prev,
        error: 'Reason for declining is required.',
      }));
      return;
    }

    const result = await handleStatusUpdate(declineDialog.requestId, 'declined', trimmedReason, { suppressAlert: true });
    if (result?.success) {
      closeDeclineDialog();
      return;
    }

    setDeclineDialog((prev) => ({
      ...prev,
      error: result?.message || 'Failed to decline request',
    }));
  };

  const handleRequestDiscussion = async (requestId) => {
    setActionLoading(requestId);
    try {
      const response = await serviceRequestAPI.requestDiscussion(requestId);
      if (response.success) {
        setRequests(prev =>
          prev.map(req =>
            req.id === requestId ? { ...req, discussion_requested: true } : req
          )
        );
        alert('Discussion request sent! The provider will be notified.');
      }
    } catch (err) {
      console.error('Request discussion error:', err);
      alert(err.message || 'Failed to request discussion');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptDiscussion = async (requestId) => {
    setActionLoading(requestId);
    try {
      const response = await serviceRequestAPI.acceptDiscussion(requestId);
      if (response.success) {
        setRequests(prev =>
          prev.map(req =>
            req.id === requestId 
              ? { ...req, discussion_accepted: true, provider_phone_revealed: true } 
              : req
          )
        );
        alert('Discussion accepted! Your phone number has been shared with the client.');
      }
    } catch (err) {
      console.error('Accept discussion error:', err);
      if (err.code === 'NO_PHONE') {
        alert('You haven\'t set a phone number yet.\n\nPlease click your profile icon in the navbar → Edit Profile, and add your phone number before accepting a discussion request.');
      } else {
        alert(err.message || 'Failed to accept discussion');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleHideRequest = (requestId) => {
    const shouldHide = window.confirm('Remove this request from your view? You can still see it again on another device/browser session.');
    if (!shouldHide) {
      return;
    }

    const numericRequestId = Number(requestId);
    const currentIds = getHiddenRequestIds(user);
    const nextIds = Array.from(new Set([...currentIds, numericRequestId]));
    saveHiddenRequestIds(user, nextIds);

    setRequests((prev) => prev.filter((req) => Number(req.id) !== numericRequestId));
    setSelectedRequest((prev) => (prev && Number(prev.id) === numericRequestId ? null : prev));
  };

  const handleSubmitReview = async ({ rating, comment }) => {
    if (!reviewRequest) return;
    setReviewLoading(true);
    try {
      const response = await serviceRequestAPI.createReview(reviewRequest.id, { rating, comment });
      if (response.success) {
        setRequests(prev =>
          prev.map(req =>
            req.id === reviewRequest.id ? { ...req, has_review: true } : req
          )
        );
        if (selectedRequest?.id === reviewRequest.id) {
          setSelectedRequest(prev => prev ? { ...prev, has_review: true } : null);
        }
        setReviewRequest(null);
        alert('Review submitted successfully! Thank you for your feedback.');
      }
    } catch (err) {
      console.error('Submit review error:', err);
      alert(err.message || 'Failed to submit review');
    } finally {
      setReviewLoading(false);
    }
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

  const formatStatus = (status) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredRequests = requests.filter(req => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') 
      return ['pending', 'accepted', 'on_the_way', 'in_progress'].includes(req.status);
    if (activeFilter === 'completed') return req.status === 'completed';
    if (activeFilter === 'cancelled') return ['declined', 'cancelled'].includes(req.status);
    return true;
  });

  if (loading) {
    return (
      <div className="requests-container">
        <div className="requests-loading">
          <div className="spinner"></div>
          <p>Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="requests-container">
      <div className="requests-wrapper">
        <div className="requests-header">
          <h1 data-tour={isProvider ? 'incoming-requests' : undefined}>{isProvider ? 'Service Requests' : 'My Requests'}</h1>
          <p>{isProvider ? 'Manage incoming service requests from clients' : 'Track and manage your service requests'}</p>
        </div>

        <div className="requests-filters">
          <button 
            className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${activeFilter === 'active' ? 'active' : ''}`}
            onClick={() => setActiveFilter('active')}
          >
            Active
          </button>
          <button 
            className={`filter-btn ${activeFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveFilter('completed')}
          >
            Completed
          </button>
          <button 
            className={`filter-btn ${activeFilter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setActiveFilter('cancelled')}
          >
            Cancelled
          </button>
        </div>

        {error && (
          <div className="requests-error">
            <i className="bi bi-exclamation-triangle"></i>
            <p>{error}</p>
            <button onClick={fetchRequests}>Try Again</button>
          </div>
        )}

        {filteredRequests.length === 0 ? (
          <div className="requests-empty">
            <i className="bi bi-inbox"></i>
            <h3>No requests found</h3>
            <p>{activeFilter === 'all' 
              ? (isProvider ? 'You haven\'t received any service requests yet' : 'You haven\'t made any service requests yet')
              : `No ${activeFilter} requests`
            }</p>
          </div>
        ) : (
          <div className="requests-grid">
            {filteredRequests.map((request) => (
              <div key={request.id} className="request-card">
                <div className="request-card-header">
                  <div className="request-title-section">
                    <h3 className="request-title">{request.job_title}</h3>
                    <span className={`request-status-badge ${getStatusBadgeClass(request.status)}`}>
                      {formatStatus(request.status)}
                    </span>
                  </div>
                  <button 
                    className="btn-view-details"
                    onClick={() => void handleViewDetails(request)}
                  >
                    <i className="bi bi-eye"></i> View Details
                  </button>
                </div>

                <div className="request-card-body">
                  <div className="request-body-left">
                    <p className="request-details">{request.job_details}</p>
                  </div>
                  
                  <div className="request-meta">
                    <div className="meta-row">
                      <i className="bi bi-person"></i>
                      <span>{isProvider ? request.client_name : request.provider_name}</span>
                    </div>
                    <div className="meta-row">
                      <i className="bi bi-calendar"></i>
                      <span>{formatDate(request.start_date || request.scheduled_date)}</span>
                    </div>
                    {(request.end_date && request.end_date !== request.start_date) && (
                      <div className="meta-row">
                        <i className="bi bi-calendar-range"></i>
                        <span>Until {formatDate(request.end_date)}</span>
                      </div>
                    )}
                    <div className="meta-row">
                      <i className="bi bi-clock"></i>
                      <span>{request.start_time || request.scheduled_time}</span>
                    </div>
                    {request.estimated_total != null && (
                      <div className="meta-row">
                        <i className="bi bi-currency-exchange"></i>
                        <span>Est. ₱{Number(request.estimated_total).toLocaleString()}</span>
                      </div>
                    )}
                    {!isProvider && request.provider_location && (
                      <div className="meta-row">
                        <i className="bi bi-geo-alt"></i>
                        <span>{request.provider_location}</span>
                      </div>
                    )}
                  </div>
                </div>

                {request.status === 'declined' && request.decline_reason && (
                  <p className="request-decline-reason"><strong>Reason for declining:</strong> {request.decline_reason}</p>
                )}
                {request.status === 'cancelled' && request.cancellation_reason && (
                  <p className="request-decline-reason"><strong>Reason for cancellation:</strong> {request.cancellation_reason_other || request.cancellation_reason.replaceAll('_', ' ')}</p>
                )}

                {/* Discussion/Phone Section */}
                {['accepted', 'on_the_way', 'in_progress'].includes(request.status) && (
                  <div className="request-discussion-section">
                    {!isProvider ? (
                      // Client view
                      <>
                        {request.discussion_accepted && request.provider_phone ? (
                          <div className="phone-revealed">
                            <i className="bi bi-telephone-fill"></i>
                            <div>
                              <span className="phone-label">Provider's Phone:</span>
                              <a href={`tel:${request.provider_phone}`} className="phone-number">
                                {request.provider_phone}
                              </a>
                            </div>
                          </div>
                        ) : request.discussion_requested ? (
                          <div className="discussion-pending">
                            <i className="bi bi-hourglass-split"></i>
                            <span>Waiting for provider to accept discussion request...</span>
                          </div>
                        ) : (
                          <button
                            className="btn-request-discussion"
                            onClick={() => handleRequestDiscussion(request.id)}
                            disabled={actionLoading === request.id}
                          >
                            {actionLoading === request.id ? (
                              <><span className="spinner-btn"></span> Sending...</>
                            ) : (
                              <><i className="bi bi-chat-dots"></i> Request to Discuss Details</>
                            )}
                          </button>
                        )}
                      </>
                    ) : (
                      // Provider view
                      <>
                        {request.discussion_accepted ? (
                          <div className="discussion-accepted-badge">
                            <i className="bi bi-check-circle-fill"></i>
                            <span>Phone number shared with client</span>
                          </div>
                        ) : request.discussion_requested ? (
                          <div className="discussion-request-pending">
                            <p><i className="bi bi-chat-dots-fill"></i> Client wants to discuss details</p>
                            <button
                              className="btn-accept-discussion"
                              onClick={() => handleAcceptDiscussion(request.id)}
                              disabled={actionLoading === request.id}
                            >
                              {actionLoading === request.id ? (
                                <><span className="spinner-btn"></span> Accepting...</>
                              ) : (
                                <><i className="bi bi-telephone"></i> Accept & Share Phone</>
                              )}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                )}

                <div className="request-card-actions">
                  {isProvider ? (
                    // Provider actions
                    <>
                      {request.status === 'pending' && (
                        <>
                          <button
                            className="btn-action btn-accept"
                            onClick={() => handleStatusUpdate(request.id, 'accepted')}
                            disabled={actionLoading === request.id}
                          >
                            {actionLoading === request.id ? 'Processing...' : 'Accept'}
                          </button>
                          <button
                            className="btn-action btn-decline"
                            onClick={() => openDeclineDialog(request.id)}
                            disabled={actionLoading === request.id}
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {request.status === 'accepted' && (
                        <button
                          className="btn-action btn-on-way"
                          onClick={() => handleStatusUpdate(request.id, 'on_the_way')}
                          disabled={actionLoading === request.id}
                        >
                          <i className="bi bi-truck"></i> I'm On My Way
                        </button>
                      )}
                      {['on_the_way', 'in_progress'].includes(request.status) && !request.provider_completed && (
                        <button
                          className="btn-action btn-complete"
                          onClick={() => handleStatusUpdate(request.id, 'completed')}
                          disabled={actionLoading === request.id}
                        >
                          <i className="bi bi-check-lg"></i> Confirm Completed
                        </button>
                      )}
                      {request.status === 'completed' && (
                        <button
                          className="btn-action btn-hide"
                          onClick={() => handleHideRequest(request.id)}
                          disabled={actionLoading === request.id}
                        >
                          <i className="bi bi-eye-slash"></i> Remove from View
                        </button>
                      )}
                    </>
                  ) : (
                    // Client actions
                    <>
                      {request.status === 'pending' && (
                        <button
                          className="btn-action btn-cancel"
                          onClick={() => openCancelDialog(request.id)}
                          disabled={actionLoading === request.id}
                        >
                          Cancel Request
                        </button>
                      )}
                      {['accepted', 'on_the_way', 'in_progress'].includes(request.status) && (
                        <button
                          className="btn-action btn-on-way"
                          onClick={() => openRescheduleDialog(request)}
                          disabled={actionLoading === request.id}
                        >
                          <i className="bi bi-calendar2-week"></i> Propose Reschedule
                        </button>
                      )}
                      {['on_the_way', 'in_progress'].includes(request.status) && !request.client_completed && (
                        <button
                          className="btn-action btn-complete"
                          onClick={() => handleStatusUpdate(request.id, 'completed')}
                          disabled={actionLoading === request.id}
                        >
                          <i className="bi bi-check-lg"></i> Confirm Completed
                        </button>
                      )}
                      {request.status === 'completed' && !request.has_review && (
                        <button
                          className="btn-action btn-review"
                          onClick={() => setReviewRequest(request)}
                        >
                          <i className="bi bi-star"></i> Leave a Review
                        </button>
                      )}
                      {request.status === 'completed' && request.has_review && (
                        <div className="review-submitted-badge">
                          <i className="bi bi-star-fill"></i>
                          <span>Review submitted</span>
                        </div>
                      )}
                      {request.status === 'completed' && (
                        <button
                          className="btn-action btn-hide"
                          onClick={() => handleHideRequest(request.id)}
                          disabled={actionLoading === request.id}
                        >
                          <i className="bi bi-eye-slash"></i> Remove from View
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Details Modal */}
      {selectedRequest && (
        <RequestDetailsModal
          request={selectedRequest}
          currentUserId={user?.id || user?.userId || null}
          isProvider={isProvider}
          onClose={() => setSelectedRequest(null)}
          onStatusUpdate={handleStatusUpdate}
          onOpenCancel={(request) => openCancelDialog(request.id)}
          onOpenReschedule={(request) => openRescheduleDialog(request)}
          onRespondReschedule={handleRespondReschedule}
          onRequestDiscussion={async (requestId) => {
            await handleRequestDiscussion(requestId);
            setSelectedRequest(prev => prev ? { ...prev, discussion_requested: true } : null);
          }}
          onAcceptDiscussion={async (requestId) => {
            await handleAcceptDiscussion(requestId);
            setSelectedRequest(prev => prev ? { ...prev, discussion_accepted: true, provider_phone_revealed: true } : null);
          }}
          onOpenReview={(request) => {
            setReviewRequest(request);
          }}
          onOpenDecline={(request) => {
            openDeclineDialog(request.id);
          }}
          onOpenReport={(request) => {
            setReportRequest(request);
          }}
          detailsLoading={detailsLoading}
          actionLoading={actionLoading}
        />
      )}

      {cancelDialog.open && (
        <div className="decline-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title" onClick={closeCancelDialog}>
          <div className="decline-dialog-card" onClick={(event) => event.stopPropagation()}>
            <div className="decline-dialog-header">
              <h2 id="cancel-dialog-title">Cancel Service Request</h2>
              <button type="button" className="decline-dialog-close" onClick={closeCancelDialog} aria-label="Close cancel dialog">
                ×
              </button>
            </div>
            <div className="decline-dialog-body">
              <label htmlFor="cancel-reason-select" className="decline-dialog-label">Reason for cancellation</label>
              <select
                id="cancel-reason-select"
                className="decline-dialog-textarea"
                value={cancelDialog.cancellationReason}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setCancelDialog((prev) => ({
                    ...prev,
                    cancellationReason: nextValue,
                    error: '',
                  }));
                }}
              >
                <option value="Schedule conflict">Schedule conflict</option>
                <option value="No longer need the service">No longer need the service</option>
                <option value="Provider unavailable">Provider unavailable</option>
                <option value="Client unavailable">Client unavailable</option>
                <option value="Incorrect booking information">Incorrect booking information</option>
                <option value="Provider did not respond">Provider did not respond</option>
                <option value="Found another provider">Found another provider</option>
                <option value="Other">Other</option>
              </select>
              {cancelDialog.cancellationReason === 'Other' && (
                <>
                  <label htmlFor="cancel-reason-other" className="decline-dialog-label">Please provide details</label>
                  <textarea
                    id="cancel-reason-other"
                    className="decline-dialog-textarea"
                    rows={3}
                    value={cancelDialog.cancellationReasonOther}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setCancelDialog((prev) => ({
                        ...prev,
                        cancellationReasonOther: nextValue,
                        error: '',
                      }));
                    }}
                    maxLength={500}
                    placeholder="Tell us why you are cancelling"
                  />
                </>
              )}
              {cancelDialog.error ? <p className="decline-dialog-error">{cancelDialog.error}</p> : null}
            </div>
            <div className="decline-dialog-actions">
              <button
                type="button"
                className="decline-btn-cancel"
                onClick={closeCancelDialog}
                disabled={actionLoading === cancelDialog.requestId}
              >
                Keep Request
              </button>
              <button
                type="button"
                className="decline-btn-confirm"
                onClick={handleConfirmCancellation}
                disabled={actionLoading === cancelDialog.requestId}
              >
                {actionLoading === cancelDialog.requestId ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleDialog.open && (
        <div className="decline-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="reschedule-dialog-title" onClick={closeRescheduleDialog}>
          <div className="decline-dialog-card" onClick={(event) => event.stopPropagation()}>
            <div className="decline-dialog-header">
              <h2 id="reschedule-dialog-title">Propose Reschedule</h2>
              <button type="button" className="decline-dialog-close" onClick={closeRescheduleDialog} aria-label="Close reschedule dialog">
                ×
              </button>
            </div>
            <div className="decline-dialog-body">
              <label htmlFor="reschedule-start-date" className="decline-dialog-label">Start date</label>
              <input
                id="reschedule-start-date"
                className="decline-dialog-textarea"
                type="date"
                value={rescheduleDialog.proposedStartDate}
                onChange={(event) => setRescheduleDialog((prev) => ({ ...prev, proposedStartDate: event.target.value, error: '' }))}
              />

              <label htmlFor="reschedule-end-date" className="decline-dialog-label">End date</label>
              <input
                id="reschedule-end-date"
                className="decline-dialog-textarea"
                type="date"
                value={rescheduleDialog.proposedEndDate}
                onChange={(event) => setRescheduleDialog((prev) => ({ ...prev, proposedEndDate: event.target.value, error: '' }))}
              />

              <label htmlFor="reschedule-start-time" className="decline-dialog-label">Start time</label>
              <input
                id="reschedule-start-time"
                className="decline-dialog-textarea"
                type="time"
                value={rescheduleDialog.proposedStartTime}
                onChange={(event) => setRescheduleDialog((prev) => ({ ...prev, proposedStartTime: event.target.value, error: '' }))}
              />

              <label htmlFor="reschedule-duration" className="decline-dialog-label">Estimated duration (minutes)</label>
              <input
                id="reschedule-duration"
                className="decline-dialog-textarea"
                type="number"
                min="1"
                max="1440"
                value={rescheduleDialog.estimatedDurationMinutes}
                onChange={(event) => setRescheduleDialog((prev) => ({ ...prev, estimatedDurationMinutes: event.target.value, error: '' }))}
              />

              <label htmlFor="reschedule-reason" className="decline-dialog-label">Reason</label>
              <textarea
                id="reschedule-reason"
                className="decline-dialog-textarea"
                rows={4}
                value={rescheduleDialog.reason}
                onChange={(event) => setRescheduleDialog((prev) => ({ ...prev, reason: event.target.value, error: '' }))}
                maxLength={1000}
                placeholder="Explain why you are proposing a new schedule"
              />

              {rescheduleDialog.error ? <p className="decline-dialog-error">{rescheduleDialog.error}</p> : null}
            </div>
            <div className="decline-dialog-actions">
              <button type="button" className="decline-btn-cancel" onClick={closeRescheduleDialog} disabled={actionLoading === rescheduleDialog.requestId}>
                Cancel
              </button>
              <button type="button" className="decline-btn-confirm" onClick={handleSubmitReschedule} disabled={actionLoading === rescheduleDialog.requestId}>
                {actionLoading === rescheduleDialog.requestId ? 'Sending...' : 'Send Proposal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {declineDialog.open && (
        <div className="decline-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="decline-dialog-title" onClick={closeDeclineDialog}>
          <div className="decline-dialog-card" onClick={(event) => event.stopPropagation()}>
            <div className="decline-dialog-header">
              <h2 id="decline-dialog-title">Decline Service Request</h2>
              <button type="button" className="decline-dialog-close" onClick={closeDeclineDialog} aria-label="Close decline dialog">
                ×
              </button>
            </div>
            <div className="decline-dialog-body">
              <label htmlFor="decline-reason-text" className="decline-dialog-label">Reason for declining</label>
              <textarea
                id="decline-reason-text"
                className="decline-dialog-textarea"
                value={declineDialog.reason}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDeclineDialog((prev) => ({
                    ...prev,
                    reason: nextValue,
                    error: prev.error ? '' : prev.error,
                  }));
                }}
                rows={4}
                maxLength={500}
                placeholder="Explain why you need to decline this request"
              />
              {declineDialog.error ? <p className="decline-dialog-error">{declineDialog.error}</p> : null}
            </div>
            <div className="decline-dialog-actions">
              <button
                type="button"
                className="decline-btn-cancel"
                onClick={closeDeclineDialog}
                disabled={actionLoading === declineDialog.requestId}
              >
                Cancel
              </button>
              <button
                type="button"
                className="decline-btn-confirm"
                onClick={handleConfirmDecline}
                disabled={actionLoading === declineDialog.requestId || !declineDialog.reason.trim()}
              >
                {actionLoading === declineDialog.requestId ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewRequest && (
        <ReviewModal
          request={reviewRequest}
          onClose={() => setReviewRequest(null)}
          onSubmit={handleSubmitReview}
          loading={reviewLoading}
        />
      )}

      {/* Report Modal */}
      {reportRequest && (
        <ReportUserModal
          request={reportRequest}
          isProvider={isProvider}
          onClose={() => setReportRequest(null)}
          onSubmitted={() => {
            setReportRequest(null);
          }}
        />
      )}
    </div>
  );
}
