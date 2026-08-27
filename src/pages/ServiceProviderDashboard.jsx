import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getUser, serviceProfileAPI, serviceRequestAPI } from '../services/api';
import ProfileCompletionChecklist from '../components/common/ProfileCompletionChecklist';
import ServiceProfileModal from '../components/common/ServiceProfileModal';
import EditPortfolioModal from '../components/common/EditPortfolioModal';
import VerificationRequestModal from '../components/common/VerificationRequestModal';
import RequestDetailsModal from '../components/common/RequestDetailsModal';
import NextStepHelp from '../components/common/NextStepHelp';
import { REQUEST_STATUS } from '../constants/domain';
import './ServiceProviderDashboard.css';

const PROVIDER_TIPS = [
  {
    id: 'service',
    icon: 'bi-chat-heart',
    title: 'Customer Service',
    description: 'Confirm the job details and schedule with the client before starting.',
  },
  {
    id: 'tools',
    icon: 'bi-tools',
    title: 'Job Readiness',
    description: 'Prepare the tools and materials you need before going to the client.',
  },
  {
    id: 'pricing',
    icon: 'bi-cash-coin',
    title: 'Pricing',
    description: 'Discuss extra costs with the client before the work begins.',
  },
];

function getInitials(name) {
  if (!name) return 'SP';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatServiceLabel(request) {
  const label = String(
    request?.service_display_label || request?.service_type_label || 'Service Request'
  ).trim();
  if (!label) return 'Service Request';
  return label.replace(/\b\w/g, (character) => character.toUpperCase());
}

function getScheduledDate(request) {
  const raw = request?.scheduled_start_at
    || (request?.scheduled_date
      ? `${request.scheduled_date}T${request.scheduled_time || '00:00'}`
      : null);

  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatSchedule(request, compact = false) {
  const date = getScheduledDate(request);
  if (!date) return 'Schedule not set';

  const dateLabel = date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    ...(compact ? {} : { year: 'numeric' }),
  });

  const timeLabel = date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${dateLabel} · ${timeLabel}`;
}

export default function ServiceProviderDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showVerificationRequest, setShowVerificationRequest] = useState(false);
  const [requests, setRequests] = useState([]);
  const [requestSummary, setRequestSummary] = useState({
    pending: 0,
    active: 0,
    upcoming: 0,
    nextUpcoming: null,
  });
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [checklistError, setChecklistError] = useState('');
  const [myProfile, setMyProfile] = useState(null);
  const [myPortfolio, setMyPortfolio] = useState(null);
  const [myAvailability, setMyAvailability] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
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
        const activeStatuses = [REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.ON_THE_WAY, REQUEST_STATUS.IN_PROGRESS];
        const queueStatuses = [REQUEST_STATUS.PENDING, ...activeStatuses];

        const pending = allRequests.filter((request) => request.status === REQUEST_STATUS.PENDING).length;
        const active = allRequests.filter((request) => activeStatuses.includes(request.status)).length;

        const upcomingRequests = allRequests
          .filter((request) => {
            if (!activeStatuses.includes(request.status)) return false;
            const startAt = getScheduledDate(request);
            return startAt && startAt > now;
          })
          .sort((a, b) => getScheduledDate(a) - getScheduledDate(b));

        const visibleQueue = allRequests
          .filter((request) => queueStatuses.includes(request.status))
          .slice(0, 4);

        setRequestSummary({
          pending,
          active,
          upcoming: upcomingRequests.length,
          nextUpcoming: upcomingRequests[0] || null,
        });
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

      if (availabilityResponse.status === 'fulfilled' && availabilityResponse.value.success) {
        setMyAvailability(availabilityResponse.value.data || null);
      } else {
        setMyAvailability(null);
      }
    } catch {
      setChecklistError('Unable to load some profile progress right now.');
    } finally {
      setChecklistLoading(false);
    }
  };

  const providerChecklistTasks = [
    {
      key: 'taxonomy-refresh',
      label: 'Review your service taxonomy',
      description: 'Your service listing has legacy or incomplete categories. Select updated categories and service types.',
      completed: !Boolean(myProfile?.taxonomyNeedsReview),
      isApplicable: Boolean(myProfile?.taxonomyNeedsReview),
      actionType: 'button',
      actionLabel: 'Update Services',
      onAction: () => setShowProfileModal(true),
    },
    {
      key: 'service-category',
      label: 'Add your service category',
      description: 'Select at least one service category in your service listing.',
      completed: Boolean(myProfile?.categories?.length),
      actionType: 'button',
      actionLabel: 'Manage Listing',
      onAction: () => setShowProfileModal(true),
    },
    {
      key: 'service-description',
      label: 'Add your service description or experience',
      description: 'Tell clients about your background and services.',
      completed: Boolean((myProfile?.description || myPortfolio?.aboutMe || '').trim()),
      actionType: 'button',
      actionLabel: 'Portfolio & About Me',
      onAction: () => setShowPortfolioModal(true),
    },
    {
      key: 'starting-price',
      label: 'Set your starting price',
      description: 'Set a clear base rate for your services.',
      completed: Number(myProfile?.startingPrice) > 0,
      actionType: 'button',
      actionLabel: 'Manage Listing',
      onAction: () => setShowProfileModal(true),
    },
    {
      key: 'location',
      label: 'Add your location',
      description: 'Set your service barangay/address.',
      completed: Boolean((myProfile?.location || '').trim()),
      actionType: 'button',
      actionLabel: 'Manage Listing',
      onAction: () => setShowProfileModal(true),
    },
    {
      key: 'availability',
      label: 'Set your availability',
      description: 'Choose when clients can request your services.',
      completed: Boolean(
        (Array.isArray(myAvailability?.specificAvailability) && myAvailability.specificAvailability.length > 0)
        || (Array.isArray(myAvailability?.weeklyBlocks) && myAvailability.weeklyBlocks.length > 0)
      ),
      actionType: 'link',
      to: '/provider-schedule',
      actionLabel: 'Schedule',
    },
    {
      key: 'portfolio',
      label: 'Upload portfolio work',
      description: 'Show previous work samples to build trust.',
      completed: Boolean(myPortfolio?.portfolio?.length),
      actionType: 'button',
      actionLabel: 'Add Work',
      onAction: () => setShowPortfolioModal(true),
    },
    {
      key: 'verification',
      label: 'Complete provider verification',
      description: 'Submit your verification request to increase trust.',
      completed: Boolean(user?.isVerified),
      actionType: 'button',
      actionLabel: 'Verification',
      onAction: () => setShowVerificationRequest(true),
    },
  ];

  const applicableProviderChecklistTasks = providerChecklistTasks.filter(
    (task) => task && task.isApplicable !== false,
  );
  const incompleteProviderChecklistTasks = checklistLoading
    ? []
    : applicableProviderChecklistTasks.filter((task) => !task.completed);

  const providerHelpGuidance = (() => {
    if (requestSummary.pending > 0) {
      return {
        title: requestSummary.pending === 1 ? '1 request needs your response' : `${requestSummary.pending} requests need your response`,
        description: 'Review new booking requests before anything else so clients are not left waiting.',
        steps: [
          'Open Requests and review the service details and requested schedule.',
          'Accept the request if you can take the job, or decline it with a reason.',
        ],
        actionLabel: 'Review Requests',
        actionTo: '/requests',
        targetSelector: '.action-banner',
      };
    }

    if (incompleteProviderChecklistTasks.length > 0) {
      return {
        title: 'Continue your profile setup',
        description: `${incompleteProviderChecklistTasks.length} profile item${incompleteProviderChecklistTasks.length === 1 ? '' : 's'} still need attention.`,
        steps: [
          'Open Profile Setup to see the remaining items.',
          'Complete your listing, schedule, portfolio, or verification as needed.',
        ],
        actionLabel: 'Show Profile Setup',
        onAction: () => {
          document.querySelector('.profile-checklist')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
        targetSelector: '.profile-checklist',
      };
    }

    if (requestSummary.upcoming > 0) {
      return {
        title: 'Check your upcoming job',
        description: requestSummary.nextUpcoming
          ? `Your next scheduled job is ${formatSchedule(requestSummary.nextUpcoming, true)}.`
          : 'You have an upcoming accepted job.',
        steps: [
          'Open Requests to review the job details and schedule.',
          'Update the job status when you are on the way or when the work is complete.',
        ],
        actionLabel: 'View Requests',
        actionTo: '/requests',
        targetSelector: '.provider-stats-row',
      };
    }

    return {
      title: 'Nothing urgent right now',
      description: 'Your dashboard has no pending requests or upcoming jobs that need attention.',
      steps: [
        'Keep your service listing and schedule current.',
        'Check Requests when a client sends a new booking.',
      ],
      actionLabel: 'View Requests',
      actionTo: '/requests',
      targetSelector: '.provider-stats-row',
    };
  })();

  const handleStatusUpdate = async (requestId, status, reason = null, options = {}) => {
    const { suppressAlert = false } = options;
    setActionLoading(requestId);
    try {
      const response = await serviceRequestAPI.updateStatus(requestId, status, reason);
      if (response.success) {
        fetchRequests();
        if (!suppressAlert) {
          const messages = {
            accepted: 'Request accepted.',
            declined: 'Request declined.',
            on_the_way: "You're marked as on the way.",
            in_progress: 'Service started.',
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
      in_progress: 'status-active',
      on_the_way: 'status-active',
      pending: 'status-pending',
      accepted: 'status-accepted',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
      declined: 'status-cancelled',
    };
    return statusMap[status] || 'status-pending';
  };

  const formatStatus = (status) => (
    String(status || REQUEST_STATUS.PENDING)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );

  const primaryService = myProfile?.categories?.[0] || 'Local Services';
  const providerLocation = myProfile?.location || 'Toledo City';
  const providerName = user?.fullName || 'Service Provider';

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">
        <section className="welcome-section">
          <div className="provider-welcome-identity">
            <div className="provider-welcome-avatar" aria-hidden={!user?.profileImage}>
              {user?.profileImage ? (
                <img src={user.profileImage} alt={`${providerName} profile`} draggable="false" />
              ) : (
                getInitials(providerName)
              )}
            </div>

            <div className="welcome-content">
              <h1>Good day, <span className="user-name">{providerName}</span></h1>
              <p>Manage your requests, jobs, and service listing.</p>
              <div className="provider-context-row" aria-label="Provider profile summary">
                <span><i className="bi bi-tools" aria-hidden="true"></i>{primaryService}</span>
                <span><i className="bi bi-geo-alt" aria-hidden="true"></i>{providerLocation}</span>
              </div>
            </div>
          </div>

          <div className="provider-welcome-actions">
            <NextStepHelp guidance={providerHelpGuidance} />
            <button
              className="btn-post-service"
              data-tour="provider-profile-setup"
              onClick={() => setShowProfileModal(true)}
            >
              Manage Service Listing
            </button>
          </div>
        </section>

        {requestSummary.pending > 0 && (
          <section className="action-banner" aria-live="polite">
            <div className="action-banner-copy">
              <span className="action-banner-icon" aria-hidden="true">
                <i className="bi bi-inbox"></i>
              </span>
              <div>
                <h2>{requestSummary.pending} request{requestSummary.pending > 1 ? 's' : ''} need your response</h2>
                <p>Clients are waiting for you to accept or decline their booking requests.</p>
              </div>
            </div>
            <button type="button" className="btn-review-requests" onClick={() => navigate('/requests')}>
              Review Requests
            </button>
          </section>
        )}

        <section className="provider-stats-row" aria-label="Provider quick stats">
          <article className="provider-stat-card">
            <span className="provider-stat-icon requests" aria-hidden="true">
              <i className="bi bi-inbox"></i>
            </span>
            <div className="provider-stat-copy">
              <strong>{requestSummary.pending}</strong>
              <p>New Request{requestSummary.pending === 1 ? '' : 's'}</p>
              <small>{requestSummary.pending > 0 ? 'Needs your response' : 'No pending requests'}</small>
            </div>
          </article>

          <article className="provider-stat-card">
            <span className="provider-stat-icon upcoming" aria-hidden="true">
              <i className="bi bi-calendar-event"></i>
            </span>
            <div className="provider-stat-copy">
              <strong>{requestSummary.upcoming}</strong>
              <p>Upcoming Job{requestSummary.upcoming === 1 ? '' : 's'}</p>
              <small>
                {requestSummary.nextUpcoming
                  ? `Next: ${formatSchedule(requestSummary.nextUpcoming, true)}`
                  : 'No upcoming jobs'}
              </small>
            </div>
          </article>

          <article className="provider-stat-card">
            <span className="provider-stat-icon active" aria-hidden="true">
              <i className="bi bi-briefcase"></i>
            </span>
            <div className="provider-stat-copy">
              <strong>{requestSummary.active}</strong>
              <p>Active Job{requestSummary.active === 1 ? '' : 's'}</p>
              <small>Accepted or in progress</small>
            </div>
          </article>
        </section>

        <ProfileCompletionChecklist
          title="Profile Setup"
          tasks={providerChecklistTasks}
          loading={checklistLoading}
          error={checklistError}
          initiallyCollapsed
          enhancedSummary
          continueLabel="Continue Setup"
        />

        <section className="jobs-section">
          <div className="jobs-header">
            <div>
              <h2 className="section-title">Your Work Queue</h2>
              <p className="jobs-subtitle">Review new requests first, then continue accepted jobs.</p>
            </div>
            <Link to="/requests" className="view-all-link">View All Requests</Link>
          </div>

          {loadingRequests ? (
            <div className="jobs-loading">
              <div className="spinner-small"></div>
              <p>Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="jobs-empty">
              <span className="jobs-empty-icon" aria-hidden="true"><i className="bi bi-inbox"></i></span>
              <h3>No jobs in your queue</h3>
              <p>New requests and accepted jobs will appear here.</p>
            </div>
          ) : (
            <div className="jobs-grid">
              {requests.map((job) => (
                <article key={job.id} className="job-card">
                  <div className="job-card-top">
                    <span className="job-service-icon" aria-hidden="true">
                      <i className="bi bi-tools"></i>
                    </span>
                    <div className="job-heading-copy">
                      <h3 className="job-title">{formatServiceLabel(job)}</h3>
                      <p className="job-client">
                        <i className="bi bi-person" aria-hidden="true"></i>
                        {job.client_name || 'Client'}
                      </p>
                    </div>
                    <span className={`job-status ${getStatusClass(job.status)}`}>
                      {formatStatus(job.status)}
                    </span>
                  </div>

                  {job.job_details && (
                    <div className="job-detail-block">
                      <i className="bi bi-card-text" aria-hidden="true"></i>
                      <p>{job.job_details.substring(0, 110)}{job.job_details.length > 110 ? '...' : ''}</p>
                    </div>
                  )}

                  <div className="job-schedule">
                    <span className="job-schedule-icon" aria-hidden="true">
                      <i className="bi bi-calendar3"></i>
                    </span>
                    <div>
                      <span>Scheduled</span>
                      <strong>{formatSchedule(job)}</strong>
                    </div>
                  </div>

                  <div className="job-actions">
                    {job.status === REQUEST_STATUS.PENDING && (
                      <>
                        <button
                          className="job-btn job-btn-primary"
                          onClick={() => handleStatusUpdate(job.id, REQUEST_STATUS.ACCEPTED)}
                          disabled={actionLoading === job.id}
                        >
                          {actionLoading === job.id ? 'Processing...' : 'Accept Request'}
                        </button>
                        <button
                          className="job-btn job-btn-secondary"
                          onClick={() => setSelectedRequest(job)}
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

                    {job.status === REQUEST_STATUS.ACCEPTED && (
                      <>
                        <button
                          className="job-btn job-btn-on-way"
                          onClick={() => handleStatusUpdate(job.id, REQUEST_STATUS.ON_THE_WAY)}
                          disabled={actionLoading === job.id}
                        >
                          <i className="bi bi-truck"></i> I&apos;m On My Way
                        </button>
                        <button
                          className="job-btn job-btn-secondary"
                          onClick={() => setSelectedRequest(job)}
                          disabled={actionLoading === job.id}
                        >
                          View Details
                        </button>
                      </>
                    )}

                    {job.status === REQUEST_STATUS.ON_THE_WAY && (
                      <>
                        <button className="job-btn job-btn-on-way" onClick={() => handleStatusUpdate(job.id, REQUEST_STATUS.IN_PROGRESS)} disabled={actionLoading === job.id}>
                          <i className="bi bi-play-circle"></i> Start Service
                        </button>
                        <button className="job-btn job-btn-secondary" onClick={() => setSelectedRequest(job)} disabled={actionLoading === job.id}>
                          View Details
                        </button>
                      </>
                    )}

                    {job.status === REQUEST_STATUS.IN_PROGRESS && (
                      <>
                        <button className="job-btn job-btn-complete" onClick={() => handleStatusUpdate(job.id, REQUEST_STATUS.COMPLETED)} disabled={actionLoading === job.id}>
                          <i className="bi bi-check-lg"></i> Mark Service Complete
                        </button>
                        <button className="job-btn job-btn-secondary" onClick={() => setSelectedRequest(job)} disabled={actionLoading === job.id}>
                          View Details
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={`level-up-banner ${user?.isVerified ? 'verified' : ''}`}>
          <span className="level-up-icon" aria-hidden="true">
            <i className={`bi ${user?.isVerified ? 'bi-patch-check-fill' : 'bi-shield-check'}`}></i>
          </span>
          <div className="level-up-copy">
            <h2>{user?.isVerified ? 'Verification Approved' : 'Provider Verification'}</h2>
            <p>
              {user?.isVerified
                ? 'Your public profile can display your provider verification badge.'
                : 'Submit a verification request to display a badge after admin approval.'}
            </p>
          </div>
          {!user?.isVerified && (
            <button className="btn-get-verified" onClick={() => setShowVerificationRequest(true)}>
              Get Verified
            </button>
          )}
        </section>

        <section className="tips-section" aria-labelledby="provider-tips-title">
          <div className="tips-section-heading">
            <h2 id="provider-tips-title" className="section-title">Tips for Service Providers</h2>
          </div>

          <div className="tips-grid">
            {PROVIDER_TIPS.map((tip) => (
              <article key={tip.id} className="tip-card">
                <span className="tip-card-icon" aria-hidden="true">
                  <i className={`bi ${tip.icon}`}></i>
                </span>
                <div>
                  <h3>{tip.title}</h3>
                  <p>{tip.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {showProfileModal && (
          <ServiceProfileModal onClose={() => {
            setShowProfileModal(false);
            fetchChecklistData();
          }} />
        )}

        {showPortfolioModal && (
          <EditPortfolioModal onClose={() => {
            setShowPortfolioModal(false);
            fetchChecklistData();
          }} />
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
            onOpenDecline={(request) => openDeclineDialog(request.id)}
            detailsLoading={false}
            actionLoading={actionLoading}
          />
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
