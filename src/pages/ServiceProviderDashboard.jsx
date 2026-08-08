import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getUser, serviceProfileAPI, serviceRequestAPI } from '../services/api';
import ProfileCompletionChecklist from '../components/common/ProfileCompletionChecklist';
import ServiceProfileModal from '../components/common/ServiceProfileModal';
import VerificationRequestModal from '../components/common/VerificationRequestModal';
import RequestDetailsModal from '../components/common/RequestDetailsModal';
import ReportUserModal from '../components/common/ReportUserModal';
import './ServiceProviderDashboard.css';

const hasValidAvailabilityBlock = (availabilityPayload) => {
  const blocks = Array.isArray(availabilityPayload?.weeklyBlocks) ? availabilityPayload.weeklyBlocks : [];
  return blocks.some((block) => {
    const enabled = block.is_available !== false && block.isAvailable !== false;
    const startTime = String(block.start_time ?? block.startTime ?? '').slice(0, 5);
    const endTime = String(block.end_time ?? block.endTime ?? '').slice(0, 5);
    return enabled && startTime && endTime && startTime < endTime;
  });
};

export default function ServiceProviderDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showVerificationRequest, setShowVerificationRequest] = useState(false);
  const [requests, setRequests] = useState([]);
  const [requestSummary, setRequestSummary] = useState({ pending: 0, active: 0, upcoming: 0 });
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [checklistError, setChecklistError] = useState('');
  const [myProfile, setMyProfile] = useState(null);
  const [myPortfolio, setMyPortfolio] = useState(null);
  const [availabilityData, setAvailabilityData] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [reportRequest, setReportRequest] = useState(null);
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
  const [declineDialog, setDeclineDialog] = useState({
    open: false,
    requestId: null,
    reason: '',
    error: '',
  });

  useEffect(() => {
    fetchRequests();
    fetchChecklistData();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoadingRequests(true);
      const response = await serviceRequestAPI.getProviderRequests();
      if (response.success) {
        const allRequests = response.data.requests || [];
        const now = new Date();
        const activeStatuses = ['accepted', 'on_the_way', 'in_progress'];
        const queueStatuses = ['pending', ...activeStatuses];

        const pending = allRequests.filter((request) => request.status === 'pending').length;
        const active = allRequests.filter((request) => activeStatuses.includes(request.status)).length;
        const upcoming = allRequests.filter((request) => {
          if (!activeStatuses.includes(request.status)) {
            return false;
          }

          const startAtRaw = request.scheduled_start_at
            || (request.scheduled_date ? `${request.scheduled_date}T${request.scheduled_time || '00:00'}` : null);

          if (!startAtRaw) {
            return false;
          }

          const startAt = new Date(startAtRaw);
          return !Number.isNaN(startAt.getTime()) && startAt > now;
        }).length;

        const visibleQueue = allRequests
          .filter((request) => queueStatuses.includes(request.status))
          .slice(0, 4);

        setRequestSummary({ pending, active, upcoming });
        setRequests(visibleQueue);
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchChecklistData = async () => {
    setChecklistLoading(true);
    setChecklistError('');

    try {
      const [profileResponse, portfolioResponse, availabilityResponse] = await Promise.allSettled([
        serviceProfileAPI.getMyProfile(),
        serviceProfileAPI.getMyPortfolio(),
        serviceProfileAPI.getMyAvailability(),
      ]);

      if (profileResponse.status === 'fulfilled' && profileResponse.value.success) {
        setMyProfile(profileResponse.value.data);
      } else {
        setMyProfile(null);
      }

      if (portfolioResponse.status === 'fulfilled' && portfolioResponse.value.success) {
        setMyPortfolio(portfolioResponse.value.data);
      } else {
        setMyPortfolio(null);
      }

      if (availabilityResponse && availabilityResponse.status === 'fulfilled' && availabilityResponse.value.success) {
        setAvailabilityData(availabilityResponse.value.data);
      } else {
        setAvailabilityData(null);
      }
    } catch {
      setChecklistError('Unable to load some profile progress right now.');
    } finally {
      setChecklistLoading(false);
    }
  };

  const providerChecklistTasks = [
    {
      key: 'service-category',
      label: 'Add your service category',
      description: 'Select at least one service category in your profile.',
      completed: Boolean(myProfile?.categories?.length),
      actionType: 'button',
      actionLabel: 'Post Profile',
      onAction: () => setShowProfileModal(true),
    },
    {
      key: 'service-description',
      label: 'Add your service description or experience',
      description: 'Tell clients about your background and services.',
      completed: Boolean((myProfile?.description || myPortfolio?.aboutMe || '').trim()),
      actionType: 'button',
      actionLabel: 'Edit Portfolio',
      onAction: () => navigate('/provider-settings'),
    },
    {
      key: 'starting-price',
      label: 'Set your starting price',
      description: 'Set a clear base rate for your services.',
      completed: Number(myProfile?.startingPrice) > 0,
      actionType: 'button',
      actionLabel: 'Post Profile',
      onAction: () => setShowProfileModal(true),
    },
    {
      key: 'location',
      label: 'Add your location',
      description: 'Set your service barangay/address.',
      completed: Boolean((myProfile?.location || '').trim()),
      actionType: 'button',
      actionLabel: 'Post Profile',
      onAction: () => setShowProfileModal(true),
    },
    {
      key: 'availability',
      label: 'Set your availability',
      description: 'Configure at least one active weekly schedule block.',
      completed: hasValidAvailabilityBlock(availabilityData),
      actionType: 'link',
      to: '/provider-settings',
      actionLabel: 'Availability',
    },
    {
      key: 'portfolio',
      label: 'Upload portfolio work',
      description: 'Show previous work samples to build trust.',
      completed: Boolean(myPortfolio?.portfolio?.length),
      actionType: 'link',
      to: '/provider-settings',
      actionLabel: 'Add Work',
    },
    {
      key: 'verification',
      label: 'Complete provider verification',
      description: 'Submit your verification request to increase trust.',
      completed: Boolean(user?.isVerified),
      actionType: 'button',
      actionLabel: 'Verify',
      onAction: () => setShowVerificationRequest(true),
    },
  ];

  const handleStatusUpdate = async (requestId, status, reason = null, options = {}) => {
    const { suppressAlert = false } = options;
    setActionLoading(requestId);
    try {
      const response = await serviceRequestAPI.updateStatus(requestId, status, reason);
      if (response.success) {
        // Refresh the requests list
        fetchRequests();
        if (!suppressAlert) {
          const messages = {
            accepted: 'Request accepted.',
            declined: 'Request declined.',
            on_the_way: "You're marked as on the way.",
            completed: 'Service marked complete.',
          };
          alert(messages[status] || 'Status updated successfully.');
        }
        return { success: true };
      }
      return { success: false, message: response.message || 'Failed to update status' };
    } catch (err) {
      console.error('Status update error:', err);
      if (!suppressAlert) {
        alert(err.message || 'Failed to update status');
      }
      return { success: false, message: err.message || 'Failed to update status' };
    } finally {
      setActionLoading(null);
    }
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

  const handleAcceptDiscussion = async (requestId) => {
    setActionLoading(requestId);
    try {
      const response = await serviceRequestAPI.acceptDiscussion(requestId);
      if (response.success) {
        setRequests((prev) => prev.map((req) => (
          req.id === requestId ? { ...req, discussion_accepted: true, provider_phone_revealed: true } : req
        )));
        await refreshSelectedRequest(requestId);
      }
    } catch (err) {
      if (err.code === 'NO_PHONE') {
        alert('Please set your phone number in Edit Profile before accepting discussion requests.');
      } else {
        alert(err.message || 'Failed to accept discussion request.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const openRescheduleDialog = (request) => {
    const startDate = request.start_date || request.scheduled_date || '';
    const endDate = request.end_date || request.scheduled_date || '';
    const startTime = request.start_time || request.scheduled_time || '09:00';

    setRescheduleDialog({
      open: true,
      requestId: request.id,
      proposedStartDate: String(startDate).slice(0, 10),
      proposedEndDate: String(endDate).slice(0, 10),
      proposedStartTime: String(startTime).slice(0, 5),
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

  const handleSubmitReschedule = async () => {
    const trimmedReason = rescheduleDialog.reason.trim();
    if (!trimmedReason) {
      setRescheduleDialog((prev) => ({ ...prev, error: 'Reason is required.' }));
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
      alert(err.message || 'Failed to respond to reschedule proposal.');
    } finally {
      setActionLoading(null);
    }
  };

  const openDeclineDialog = (requestId) => {
    setDeclineDialog({ open: true, requestId, reason: '', error: '' });
  };

  const closeDeclineDialog = () => {
    setDeclineDialog({ open: false, requestId: null, reason: '', error: '' });
  };

  const handleConfirmDecline = async () => {
    const trimmedReason = declineDialog.reason.trim();
    if (!trimmedReason) {
      setDeclineDialog((prev) => ({ ...prev, error: 'Reason for declining is required.' }));
      return;
    }

    const result = await handleStatusUpdate(declineDialog.requestId, 'declined', trimmedReason, { suppressAlert: true });
    if (result?.success) {
      closeDeclineDialog();
      return;
    }

    setDeclineDialog((prev) => ({ ...prev, error: result?.message || 'Failed to decline request' }));
  };

  const getStatusClass = (status) => {
    const statusMap = {
      'in_progress': 'status-active',
      'on_the_way': 'status-active',
      'pending': 'status-pending',
      'accepted': 'status-accepted',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled',
      'declined': 'status-cancelled',
    };
    return statusMap[status] || 'status-pending';
  };

  const formatStatus = (status) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const [tips] = useState([
    {
      id: 1,
      title: '10 Essential Tips for Excellent Customer Service',
      description: 'Learn how to exceed customer expectations and build lasting relationships',
      readTime: '8 min read',
      image: 'https://wp.sfdcdigital.com/en-us/wp-content/uploads/sites/4/2025/03/what-is-customer-support-1680x1120-1.jpg'
    },
    {
      id: 2,
      title: '10 Essential Tools You Should Own',
      description: 'Discover the must-have tools that will improve quality and efficiency',
      readTime: '5 min read',
      image: 'https://www.kellerinsurance.com/wp-content/uploads/2023/09/consutrction-tools.jpg'
    },
    {
      id: 3,
      title: 'Pricing Your Services: A Complete Guide to Fair and Competitive Rates',
      description: 'Master the art of pricing your services to attract clients while ensuring profitability',
      readTime: '8 min read',
      image: 'https://img.freepik.com/premium-vector/buy-idea-business-transaction-light-bulb-as-symbol-innovation-money-hold-hand-crowdfunding-concept-investment-cost-innovations-vector-illustration-flat-design-isolated-background_153097-728.jpg'
    },
    {
      id: 4,
      title: 'Safety First: Best Practices for Service Providers',
      description: 'Stay safe on the job with this comprehensive guide to personal safety protocols',
      readTime: '7 min read',
      image: 'https://images.pexels.com/photos/8487776/pexels-photo-8487776.jpeg'
    },
  ]);

  const checklistVisibleTasks = providerChecklistTasks.filter((task) => task && task.isApplicable !== false);
  const checklistCompleted = checklistVisibleTasks.filter((task) => task.completed).length;
  const checklistRemaining = checklistVisibleTasks.length - checklistCompleted;
  const checklistProgress = checklistVisibleTasks.length > 0
    ? Math.round((checklistCompleted / checklistVisibleTasks.length) * 100)
    : 100;
  const nextChecklistTasks = checklistVisibleTasks.filter((task) => !task.completed).slice(0, 3);

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">
        <section className="welcome-section">
          <div className="welcome-content">
            <h1>Good day, <span className="user-name">{user?.fullName || 'Service Provider'}</span></h1>
            <p>Here is what needs your attention today.</p>
          </div>
          <button 
            className="btn-post-service"
            data-tour="provider-profile-setup"
            onClick={() => setShowProfileModal(true)}
          >
            Manage Service Profile
          </button>
        </section>

        {requestSummary.pending > 0 && (
          <section className="action-banner" aria-live="polite">
            <div>
              <h2>{requestSummary.pending} request{requestSummary.pending > 1 ? 's' : ''} need your response</h2>
              <p>Clients are waiting for you to accept or decline their booking requests.</p>
            </div>
            <button type="button" className="btn-review-requests" onClick={() => navigate('/requests')}>
              Review Requests
            </button>
          </section>
        )}

        <section className="provider-stats-row" aria-label="Provider quick stats">
          <article className="provider-stat-card">
            <p>New Requests</p>
            <strong>{requestSummary.pending}</strong>
          </article>
          <article className="provider-stat-card">
            <p>Upcoming Jobs</p>
            <strong>{requestSummary.upcoming}</strong>
          </article>
          <article className="provider-stat-card">
            <p>Active Jobs</p>
            <strong>{requestSummary.active}</strong>
          </article>
        </section>

        <ProfileCompletionChecklist
          title="Complete Your Profile"
          tasks={providerChecklistTasks}
          loading={checklistLoading}
          error={checklistError}
          initiallyCollapsed
        />

        {!checklistLoading && !checklistError && (
          <section className="profile-setup-summary" aria-label="Profile setup summary">
            <div className="profile-setup-summary-head">
              <h2>Complete Your Profile - {checklistProgress}%</h2>
              <p>{checklistRemaining} item{checklistRemaining === 1 ? '' : 's'} remaining</p>
            </div>
            <div className="profile-setup-summary-progress" role="progressbar" aria-valuenow={checklistProgress} aria-valuemin="0" aria-valuemax="100">
              <span style={{ width: `${checklistProgress}%` }}></span>
            </div>
            {nextChecklistTasks.length > 0 && (
              <ul className="profile-setup-next-tasks">
                {nextChecklistTasks.map((task) => (
                  <li key={task.key}>{task.label}</li>
                ))}
              </ul>
            )}
            <div className="profile-setup-actions">
              <button type="button" className="btn-post-service" onClick={() => navigate('/provider-settings')}>
                Continue Setup
              </button>
            </div>
          </section>
        )}

        <section className="jobs-section">
          <div className="jobs-header">
            <div>
              <h2 className="section-title">Your Work Queue</h2>
              <p className="jobs-subtitle">Review new requests first, then continue accepted jobs.</p>
            </div>
            <Link to="/requests" className="view-all-link">View All</Link>
          </div>
          
          {loadingRequests ? (
            <div className="jobs-loading">
              <div className="spinner-small"></div>
              <p>Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="jobs-empty">
              <i className="bi bi-inbox"></i>
              <p>No active job requests yet. Once clients book your services, they'll appear here.</p>
            </div>
          ) : (
            <div className="jobs-grid">
              {requests.map((job) => (
                <div key={job.id} className="job-card">
                  <div className="job-header">
                    <h3 className="job-title">{job.job_title}</h3>
                    <span className={`job-status ${getStatusClass(job.status)}`}>
                      {formatStatus(job.status)}
                    </span>
                  </div>
                  <p className="job-client">From: {job.client_name}</p>
                  <p className="job-description">{job.job_details?.substring(0, 80)}{job.job_details?.length > 80 ? '...' : ''}</p>
                  <div className="job-meta">
                    <div className="meta-item">
                      <div className="meta-label">Date</div>
                      <div className="meta-value">{new Date(job.scheduled_date).toLocaleDateString()}</div>
                    </div>
                    <div className="meta-item">
                      <div className="meta-label">Time</div>
                      <div className="meta-value">{job.scheduled_time}</div>
                    </div>
                  </div>
                  <div className="job-actions">
                    {job.status === 'pending' && (
                      <>
                        <button 
                            className="job-btn job-btn-primary"
                            onClick={() => handleStatusUpdate(job.id, 'accepted')}
                          disabled={actionLoading === job.id}
                        >
                          {actionLoading === job.id ? 'Processing...' : 'Accept Request'}
                        </button>
                        <button
                          className="job-btn job-btn-secondary"
                          onClick={() => void handleViewDetails(job)}
                          disabled={actionLoading === job.id}
                        >
                          View Details
                        </button>
                        <button 
                            className="job-btn job-btn-decline-subtle"
                            onClick={() => openDeclineDialog(job.id)}
                          disabled={actionLoading === job.id}
                        >
                          Decline Request
                        </button>
                      </>
                    )}
                    {job.status === 'accepted' && (
                      <>
                        <button 
                          className="job-btn job-btn-on-way"
                          onClick={() => handleStatusUpdate(job.id, 'on_the_way')}
                          disabled={actionLoading === job.id}
                        >
                          <i className="bi bi-truck"></i> I'm On My Way
                        </button>
                        <button
                          className="job-btn job-btn-secondary"
                          onClick={() => void handleViewDetails(job)}
                          disabled={actionLoading === job.id}
                        >
                          View Details
                        </button>
                      </>
                    )}
                    {['on_the_way', 'in_progress'].includes(job.status) && (
                      <>
                        <button 
                          className="job-btn job-btn-complete"
                          onClick={() => handleStatusUpdate(job.id, 'completed')}
                          disabled={actionLoading === job.id}
                        >
                          <i className="bi bi-check-lg"></i> Mark Service Complete
                        </button>
                        <button
                          className="job-btn job-btn-secondary"
                          onClick={() => void handleViewDetails(job)}
                          disabled={actionLoading === job.id}
                        >
                          View Details
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="level-up-banner">
          <p className="level-up-copy">Get verified to build more trust with clients.</p>
          <button className="btn-get-verified" onClick={() => setShowVerificationRequest(true)}>Get Verified</button>
        </section>

        <section className="tips-section">
          <h2 className="section-title">Tips for Service Providers</h2>
          <ul className="tips-list">
            {tips.slice(0, 3).map((tip) => (
              <li key={tip.id} className="tips-list-item">
                <span className="tip-title">{tip.title}</span>
                <span className="read-time">{tip.readTime}</span>
              </li>
            ))}
          </ul>
          <p className="tips-view-all">View all tips</p>
        </section>

        {showProfileModal && (
          <ServiceProfileModal onClose={() => setShowProfileModal(false)} />
        )}

        {showVerificationRequest && (
          <VerificationRequestModal onClose={() => setShowVerificationRequest(false)} />
        )}

        {selectedRequest && (
          <RequestDetailsModal
            request={selectedRequest}
            currentUserId={user?.id || user?.userId || null}
            isProvider
            onClose={() => setSelectedRequest(null)}
            onStatusUpdate={handleStatusUpdate}
            onOpenCancel={() => {}}
            onOpenReschedule={(request) => openRescheduleDialog(request)}
            onRespondReschedule={handleRespondReschedule}
            onRequestDiscussion={() => {}}
            onAcceptDiscussion={handleAcceptDiscussion}
            onOpenReview={() => {}}
            onOpenDecline={(request) => openDeclineDialog(request.id)}
            onOpenReport={(request) => setReportRequest(request)}
            detailsLoading={detailsLoading}
            actionLoading={actionLoading}
          />
        )}

        {reportRequest && (
          <ReportUserModal
            request={reportRequest}
            isProvider
            onClose={() => setReportRequest(null)}
            onSubmitted={() => {
              setReportRequest(null);
            }}
          />
        )}

        {rescheduleDialog.open && (
          <div className="decline-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="provider-reschedule-dialog-title" onClick={closeRescheduleDialog}>
            <div className="decline-dialog-card" onClick={(event) => event.stopPropagation()}>
              <div className="decline-dialog-header">
                <h2 id="provider-reschedule-dialog-title">Propose Reschedule</h2>
                <button type="button" className="decline-dialog-close" onClick={closeRescheduleDialog} aria-label="Close reschedule dialog">×</button>
              </div>
              <div className="decline-dialog-body">
                <label htmlFor="provider-reschedule-start-date" className="decline-dialog-label">Start date</label>
                <input
                  id="provider-reschedule-start-date"
                  className="decline-dialog-textarea"
                  type="date"
                  value={rescheduleDialog.proposedStartDate}
                  onChange={(event) => setRescheduleDialog((prev) => ({ ...prev, proposedStartDate: event.target.value, error: '' }))}
                />

                <label htmlFor="provider-reschedule-end-date" className="decline-dialog-label">End date</label>
                <input
                  id="provider-reschedule-end-date"
                  className="decline-dialog-textarea"
                  type="date"
                  value={rescheduleDialog.proposedEndDate}
                  onChange={(event) => setRescheduleDialog((prev) => ({ ...prev, proposedEndDate: event.target.value, error: '' }))}
                />

                <label htmlFor="provider-reschedule-start-time" className="decline-dialog-label">Start time</label>
                <input
                  id="provider-reschedule-start-time"
                  className="decline-dialog-textarea"
                  type="time"
                  value={rescheduleDialog.proposedStartTime}
                  onChange={(event) => setRescheduleDialog((prev) => ({ ...prev, proposedStartTime: event.target.value, error: '' }))}
                />

                <label htmlFor="provider-reschedule-duration" className="decline-dialog-label">Estimated duration (minutes)</label>
                <input
                  id="provider-reschedule-duration"
                  className="decline-dialog-textarea"
                  type="number"
                  min="1"
                  max="1440"
                  value={rescheduleDialog.estimatedDurationMinutes}
                  onChange={(event) => setRescheduleDialog((prev) => ({ ...prev, estimatedDurationMinutes: event.target.value, error: '' }))}
                />

                <label htmlFor="provider-reschedule-reason" className="decline-dialog-label">Reason</label>
                <textarea
                  id="provider-reschedule-reason"
                  className="decline-dialog-textarea"
                  rows={4}
                  value={rescheduleDialog.reason}
                  onChange={(event) => setRescheduleDialog((prev) => ({ ...prev, reason: event.target.value, error: '' }))}
                  maxLength={1000}
                  placeholder="Explain why this new schedule works better"
                />

                {rescheduleDialog.error ? <p className="decline-dialog-error">{rescheduleDialog.error}</p> : null}
              </div>
              <div className="decline-dialog-actions">
                <button type="button" className="decline-btn-cancel" onClick={closeRescheduleDialog} disabled={actionLoading === rescheduleDialog.requestId}>Cancel</button>
                <button type="button" className="decline-btn-confirm" onClick={handleSubmitReschedule} disabled={actionLoading === rescheduleDialog.requestId}>
                  {actionLoading === rescheduleDialog.requestId ? 'Sending...' : 'Send Proposal'}
                </button>
              </div>
            </div>
          </div>
        )}

        {declineDialog.open && (
          <div className="decline-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="dashboard-decline-dialog-title" onClick={closeDeclineDialog}>
            <div className="decline-dialog-card" onClick={(event) => event.stopPropagation()}>
              <div className="decline-dialog-header">
                <h2 id="dashboard-decline-dialog-title">Decline Request</h2>
                <button type="button" className="decline-dialog-close" onClick={closeDeclineDialog} aria-label="Close decline dialog">×</button>
              </div>
              <div className="decline-dialog-body">
                <label htmlFor="dashboard-decline-reason" className="decline-dialog-label">Reason for declining</label>
                <textarea
                  id="dashboard-decline-reason"
                  className="decline-dialog-textarea"
                  rows={4}
                  value={declineDialog.reason}
                  onChange={(event) => setDeclineDialog((prev) => ({ ...prev, reason: event.target.value, error: '' }))}
                  placeholder="Tell the client why you can't take this request"
                />
                {declineDialog.error ? <p className="decline-dialog-error">{declineDialog.error}</p> : null}
              </div>
              <div className="decline-dialog-actions">
                <button type="button" className="decline-btn-cancel" onClick={closeDeclineDialog} disabled={actionLoading === declineDialog.requestId}>Cancel</button>
                <button type="button" className="decline-btn-confirm" onClick={handleConfirmDecline} disabled={actionLoading === declineDialog.requestId}>
                  {actionLoading === declineDialog.requestId ? 'Declining...' : 'Decline Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
