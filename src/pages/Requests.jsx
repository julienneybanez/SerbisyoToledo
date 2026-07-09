import { useState, useEffect } from 'react';
import { getUser, serviceRequestAPI } from '../services/api';
import RequestDetailsModal from '../components/common/RequestDetailsModal';
import ReviewModal from '../components/common/ReviewModal';
import './Requests.css';

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
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = isProvider
        ? await serviceRequestAPI.getProviderRequests()
        : await serviceRequestAPI.getClientRequests();
      
      if (response.success) {
        setRequests(response.data.requests);
      }
    } catch (err) {
      setError('Failed to load requests');
      console.error('Fetch requests error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (requestId, status) => {
    setActionLoading(requestId);
    try {
      const response = await serviceRequestAPI.updateStatus(requestId, status);
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
            alert('Service has been completed by both parties!');
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
            alert('Completion confirmed! Waiting for the other party to confirm.');
          }
        } else {
          // Normal status update
          setRequests(prev =>
            prev.map(req =>
              req.id === requestId ? { ...req, status } : req
            )
          );
          if (selectedRequest?.id === requestId) {
            setSelectedRequest(prev => ({ ...prev, status }));
          }
        }
      }
    } catch (err) {
      console.error('Status update error:', err);
      alert(err.message || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
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
          <h1>{isProvider ? 'Service Requests' : 'My Requests'}</h1>
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
                    onClick={() => setSelectedRequest(request)}
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
                      <span>{formatDate(request.scheduled_date)}</span>
                    </div>
                    <div className="meta-row">
                      <i className="bi bi-clock"></i>
                      <span>{request.scheduled_time}</span>
                    </div>
                    {!isProvider && request.provider_location && (
                      <div className="meta-row">
                        <i className="bi bi-geo-alt"></i>
                        <span>{request.provider_location}</span>
                      </div>
                    )}
                  </div>
                </div>

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
                            onClick={() => handleStatusUpdate(request.id, 'declined')}
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
                      {['on_the_way', 'in_progress'].includes(request.status) && request.provider_completed && !request.client_completed && (
                        <div className="completion-pending-badge">
                          <i className="bi bi-hourglass-split"></i>
                          <span>Waiting for client to confirm completion</span>
                        </div>
                      )}
                    </>
                  ) : (
                    // Client actions
                    <>
                      {request.status === 'pending' && (
                        <button
                          className="btn-action btn-cancel"
                          onClick={() => handleStatusUpdate(request.id, 'cancelled')}
                          disabled={actionLoading === request.id}
                        >
                          Cancel Request
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
                      {['on_the_way', 'in_progress'].includes(request.status) && request.client_completed && !request.provider_completed && (
                        <div className="completion-pending-badge">
                          <i className="bi bi-hourglass-split"></i>
                          <span>Waiting for provider to confirm completion</span>
                        </div>
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
          isProvider={isProvider}
          onClose={() => setSelectedRequest(null)}
          onStatusUpdate={handleStatusUpdate}
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
          actionLoading={actionLoading}
        />
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
    </div>
  );
}
