import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI, getUser, serviceProfileAPI, serviceRequestAPI, userProfileAPI } from '../services/api';
import ProfileCompletionChecklist from '../components/common/ProfileCompletionChecklist';
import ServiceProfileModal from '../components/common/ServiceProfileModal';
import EditPortfolioModal from '../components/common/EditPortfolioModal';
import VerificationRequestModal from '../components/common/VerificationRequestModal';
import RequestDetailsModal from '../components/common/RequestDetailsModal';
import NextStepHelp from '../components/common/NextStepHelp';
import { AppButton, AppCard, AppTextarea, IconButton, SoftPanel, StatCard } from '../components/ui';
import { REQUEST_STATUS } from '../constants/domain';
import { useLanguage } from '../context/LanguageContext';
import './ServiceProviderDashboard.css';

const PROVIDER_TIPS = [
  {
    id: 'service',
    icon: 'bi-chat-heart',
    titleKey: 'providerTipCustomerServiceTitle',
    descriptionKey: 'providerTipCustomerServiceDescription',
  },
  {
    id: 'tools',
    icon: 'bi-tools',
    titleKey: 'providerTipReadinessTitle',
    descriptionKey: 'providerTipReadinessDescription',
  },
  {
    id: 'pricing',
    icon: 'bi-cash-coin',
    titleKey: 'providerTipPricingTitle',
    descriptionKey: 'providerTipPricingDescription',
  },
];

function formatServiceLabel(request, fallbackLabel) {
  const label = String(
    request?.service_display_label || request?.service_type_label || fallbackLabel
  ).trim();
  if (!label) return fallbackLabel;
  return label.replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeScheduleDateKey(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function parseLocalScheduleDate(dateKey, timeValue = '00:00') {
  const dateMatch = normalizeScheduleDateKey(dateKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;

  const timeMatch = String(timeValue || '00:00').match(/^(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;
  const date = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    hour,
    minute,
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function getRequestScheduleDates(request) {
  const explicitDates = Array.isArray(request?.booking_dates) && request.booking_dates.length > 0
    ? request.booking_dates
    : (Array.isArray(request?.selected_dates) ? request.selected_dates : []);

  const normalizedExplicitDates = [...new Set(
    explicitDates.map(normalizeScheduleDateKey).filter(Boolean)
  )].sort();

  if (normalizedExplicitDates.length > 0) {
    return normalizedExplicitDates;
  }

  const startDate = normalizeScheduleDateKey(request?.start_date || request?.scheduled_date);
  const endDate = normalizeScheduleDateKey(request?.end_date);

  if (startDate) {
    if (endDate && endDate !== startDate && request?.multi_day_mode !== 'specific_dates') {
      return [startDate, endDate];
    }
    return [startDate];
  }

  return [];
}

function getScheduledDate(request) {
  const canonicalDates = getRequestScheduleDates(request);
  if (canonicalDates.length > 0) {
    return parseLocalScheduleDate(
      canonicalDates[0],
      request?.start_time || request?.scheduled_time || '00:00',
    );
  }

  const raw = request?.scheduled_start_at;
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatSchedule(request, compact = false, locale = 'en-PH', unsetLabel = 'Schedule not set') {
  const date = getScheduledDate(request);
  if (!date) return unsetLabel;

  const scheduleDates = getRequestScheduleDates(request);
  const isSpecificDates = request?.booking_mode === 'specific_dates'
    || request?.multi_day_mode === 'specific_dates';

  let dateLabel = date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    ...(compact ? {} : { year: 'numeric' }),
  });

  if (scheduleDates.length > 1) {
    const parsedDates = scheduleDates
      .map((dateKey) => parseLocalScheduleDate(dateKey))
      .filter(Boolean);

    if (isSpecificDates && parsedDates.length > 1) {
      if (compact) {
        dateLabel = `${parsedDates[0].toLocaleDateString(locale, { month: 'short', day: 'numeric' })} +${parsedDates.length - 1} more`;
      } else {
        const visibleDates = parsedDates.slice(0, 3).map((item) => item.toLocaleDateString(locale, {
          month: 'short',
          day: 'numeric',
        }));
        const suffix = parsedDates.length > 3 ? ` +${parsedDates.length - 3} more` : '';
        dateLabel = `${visibleDates.join(', ')}${suffix}`;
      }
    } else if (parsedDates.length > 1) {
      const first = parsedDates[0].toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
      });
      const last = parsedDates[parsedDates.length - 1].toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        ...(compact ? {} : { year: 'numeric' }),
      });
      dateLabel = `${first}–${last}`;
    }
  }

  const timeLabel = date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${dateLabel} · ${timeLabel}`;
}

export default function ServiceProviderDashboard() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const locale = language === 'ceb' ? 'ceb-PH' : 'en-PH';
  const [user, setUser] = useState(() => getUser());
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showVerificationRequest, setShowVerificationRequest] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [requests, setRequests] = useState([]);
  const [requestSummary, setRequestSummary] = useState({
    pending: 0,
    active: 0,
    upcoming: 0,
    completed: 0,
    nextUpcoming: null,
  });
  const [upcomingJobs, setUpcomingJobs] = useState([]);
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
        const completed = allRequests.filter((request) => request.status === REQUEST_STATUS.COMPLETED).length;

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
          completed,
          nextUpcoming: upcomingRequests[0] || null,
        });
        setUpcomingJobs(upcomingRequests.slice(0, 4));
        setRequests(visibleQueue);
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchChecklistData = useCallback(async () => {
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
      setChecklistError(t('providerChecklistLoadError'));
    } finally {
      setChecklistLoading(false);
    }
  }, [t]);

  const fetchVerificationStatus = useCallback(async () => {
    try {
      const response = await userProfileAPI.getVerificationStatus();
      if (response?.success) {
        setVerificationStatus(response.data || null);
        if (response.data?.isVerified && !user?.isVerified) {
          const me = await authAPI.getMe();
          if (me?.success && me.data?.user) {
            setUser(me.data.user);
          }
        }
      }
    } catch {
      setVerificationStatus(null);
    }
  }, [user?.isVerified]);

  useEffect(() => {
    fetchRequests();
    fetchChecklistData();
    fetchVerificationStatus();
  }, [fetchChecklistData, fetchVerificationStatus]);

  const handleOpenServiceListing = async () => {
    if (myProfile?.id) {
      setShowProfileModal(true);
      return;
    }

    let latestUser = user;

    try {
      const response = await authAPI.getMe();
      if (response?.success && response.data?.user) {
        latestUser = response.data.user;
        setUser(latestUser);
      }
    } catch {
      // The service-profile endpoint remains the authoritative verification gate.
    }

    if (!latestUser?.isVerified) {
      setShowVerificationRequest(true);
      return;
    }

    setShowProfileModal(true);
  };

  const serviceListingActionLabel = t(myProfile?.id ? 'manageServiceListing' : 'postServiceListing');

  const providerChecklistTasks = [
    {
      key: 'verification',
      label: t('providerChecklistVerificationLabel'),
      description: verificationStatus?.status === 'pending'
        ? t('providerVerificationPendingDescription')
        : verificationStatus?.status === 'rejected'
          ? t('providerVerificationRejectedDescription')
          : t('providerChecklistVerificationDescription'),
      completed: Boolean(user?.isVerified),
      isApplicable: !myProfile?.id || !user?.isVerified,
      actionType: verificationStatus?.status === 'pending' ? null : 'button',
      actionLabel: verificationStatus?.status === 'rejected'
        ? t('providerVerificationResubmit')
        : t('verification'),
      onAction: verificationStatus?.status === 'pending'
        ? undefined
        : () => setShowVerificationRequest(true),
    },
    {
      key: 'taxonomy-refresh',
      label: t('providerChecklistTaxonomyLabel'),
      description: t('providerChecklistTaxonomyDescription'),
      completed: !myProfile?.taxonomyNeedsReview,
      isApplicable: Boolean(myProfile?.taxonomyNeedsReview),
      actionType: 'button',
      actionLabel: t('providerChecklistUpdateServices'),
      onAction: () => setShowProfileModal(true),
    },
    {
      key: 'service-category',
      isApplicable: Boolean(myProfile?.id || user?.isVerified),
      label: t('providerChecklistCategoryLabel'),
      description: t('providerChecklistCategoryDescription'),
      completed: Boolean(myProfile?.categories?.length),
      actionType: 'button',
      actionLabel: serviceListingActionLabel,
      onAction: handleOpenServiceListing,
    },
    {
      key: 'service-description',
      isApplicable: Boolean(myProfile?.id),
      label: t('providerChecklistPublicProfileLabel'),
      description: t('providerChecklistPublicProfileDescription'),
      completed: Boolean((myProfile?.description || myPortfolio?.aboutMe || '').trim()),
      actionType: 'button',
      actionLabel: t('providerProfile'),
      onAction: () => setShowPortfolioModal(true),
    },
    {
      key: 'starting-price',
      isApplicable: Boolean(myProfile?.id || user?.isVerified),
      label: t('providerChecklistPriceLabel'),
      description: t('providerChecklistPriceDescription'),
      completed: Number(myProfile?.startingPrice) > 0,
      actionType: 'button',
      actionLabel: serviceListingActionLabel,
      onAction: handleOpenServiceListing,
    },
    {
      key: 'location',
      isApplicable: Boolean(myProfile?.id || user?.isVerified),
      label: t('providerChecklistLocationLabel'),
      description: t('providerChecklistLocationDescription'),
      completed: Boolean((myProfile?.location || '').trim()),
      actionType: 'button',
      actionLabel: serviceListingActionLabel,
      onAction: handleOpenServiceListing,
    },
    {
      key: 'availability',
      isApplicable: Boolean(myProfile?.id),
      label: t('providerChecklistAvailabilityLabel'),
      description: t('providerChecklistAvailabilityDescription'),
      completed: Boolean(
        (Array.isArray(myAvailability?.availableSlots) && myAvailability.availableSlots.length > 0)
        || (Array.isArray(myAvailability?.availability) && myAvailability.availability.length > 0)
        || (Array.isArray(myAvailability?.specificAvailability) && myAvailability.specificAvailability.length > 0)
        || (Array.isArray(myAvailability?.weeklyBlocks) && myAvailability.weeklyBlocks.length > 0)
      ),
      actionType: 'link',
      to: '/provider-availability',
      actionLabel: t('providerSettingsNavAvailability'),
    },
    {
      key: 'portfolio',
      isApplicable: Boolean(myProfile?.id),
      label: t('providerChecklistPortfolioLabel'),
      description: t('providerChecklistPortfolioDescription'),
      completed: Boolean(myPortfolio?.portfolio?.length),
      actionType: 'button',
      actionLabel: t('providerChecklistAddWork'),
      onAction: () => setShowPortfolioModal(true),
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
        title: requestSummary.pending === 1 ? t('providerHelpOneRequest') : t('providerHelpManyRequests', { count: requestSummary.pending }),
        description: t('providerHelpRequestsDescription'),
        steps: [
          t('providerHelpRequestStep1'),
          t('providerHelpRequestStep2'),
        ],
        actionLabel: t('providerHelpReviewRequests'),
        actionTo: '/requests',
        targetSelector: '.action-banner',
      };
    }

    if (incompleteProviderChecklistTasks.length > 0) {
      return {
        title: t('providerHelpContinueSetup'),
        description: t('providerHelpSetupDescription', { count: incompleteProviderChecklistTasks.length }),
        steps: [
          t('providerHelpSetupStep1'),
          t('providerHelpSetupStep2'),
        ],
        actionLabel: t('providerHelpShowSetup'),
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
        actionLabel: 'Open Schedule',
        actionTo: '/provider-schedule',
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
      setDeclineDialog((prev) => ({ ...prev, error: t('requestsDeclineReasonRequired') }));
      return;
    }

    const result = await handleStatusUpdate(declineDialog.requestId, 'declined', trimmedReason, { suppressAlert: true });
    if (result?.success) {
      closeDeclineDialog();
      return;
    }

    setDeclineDialog((prev) => ({ ...prev, error: result?.message || t('requestsDeclineFailed') }));
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

  const formatStatus = (status) => {
    const keyByStatus = {
      pending: 'statusPending',
      accepted: 'statusAccepted',
      declined: 'statusDeclined',
      on_the_way: 'statusOnTheWay',
      in_progress: 'statusInProgress',
      completed: 'statusCompleted',
      cancelled: 'statusCancelled',
    };
    return t(keyByStatus[status] || 'statusPending');
  };

  const primaryService = myProfile?.categories?.[0] || t('providerLocalServices');
  const providerName = user?.fullName || t('serviceProvider');

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">
        <SoftPanel className="welcome-section">
          <div className="provider-welcome-identity">
            <div className="welcome-content">
              <h1>{t('providerGoodDay')} <span className="user-name">{providerName}</span></h1>
              <div className="provider-context-row" aria-label={t('providerPrimaryServiceAria')}>
                <span><i className="bi bi-tools" aria-hidden="true"></i>{primaryService}</span>
              </div>
            </div>
          </div>

          <div className="provider-welcome-actions">
            <NextStepHelp guidance={providerHelpGuidance} />
            <AppButton
              className="btn-post-service"
              data-tour="provider-profile-setup"
              onClick={handleOpenServiceListing}
            >
              {serviceListingActionLabel}
            </AppButton>
          </div>
        </SoftPanel>

        {requestSummary.pending > 0 && (
          <section className="action-banner" aria-live="polite">
            <div className="action-banner-copy">
              <span className="action-banner-icon" aria-hidden="true">
                <i className="bi bi-inbox"></i>
              </span>
              <div>
                <h2>{requestSummary.pending === 1 ? t('providerPendingOne') : t('providerPendingMany', { count: requestSummary.pending })}</h2>
                <p>{t('providerPendingDescription')}</p>
              </div>
            </div>
            <AppButton className="btn-review-requests" onClick={() => navigate('/requests')}>
              Review Requests
            </AppButton>
          </section>
        )}

        <section className="provider-stats-row" aria-label={t('providerQuickStatsAria')}>
          <StatCard className="provider-stat-card" label={t(requestSummary.pending === 1 ? 'providerNewRequest' : 'providerNewRequests')} value={requestSummary.pending} icon={<i className="bi bi-inbox"></i>}>
            <small>{requestSummary.pending > 0 ? t('providerNeedsResponse') : t('providerNoPendingRequests')}</small>
          </StatCard>

          <StatCard className="provider-stat-card" label={t(requestSummary.upcoming === 1 ? 'providerUpcomingJob' : 'providerUpcomingJobs')} value={requestSummary.upcoming} icon={<i className="bi bi-calendar-event"></i>}>
            <small>
              {requestSummary.nextUpcoming
                ? t('providerNext', { schedule: formatSchedule(requestSummary.nextUpcoming, true, locale, t('providerScheduleNotSet')) })
                : t('providerNoUpcomingJobs')}
            </small>
          </StatCard>

          <StatCard className="provider-stat-card" label={t(requestSummary.active === 1 ? 'providerActiveJob' : 'providerActiveJobs')} value={requestSummary.active} icon={<i className="bi bi-briefcase"></i>}>
            <small>{t('providerActiveDescription')}</small>
          </StatCard>

          <StatCard className="provider-stat-card" label={t(requestSummary.completed === 1 ? 'providerCompletedJob' : 'providerCompletedJobs')} value={requestSummary.completed} icon={<i className="bi bi-check2-circle"></i>}>
            <small>{t('providerCompletedDescription')}</small>
          </StatCard>
        </section>

        <ProfileCompletionChecklist
          title={t('providerProfileSetup')}
          tasks={providerChecklistTasks}
          loading={checklistLoading}
          error={checklistError}
          initiallyCollapsed
          enhancedSummary
          continueLabel={t('providerContinueSetup')}
        />

        <section className="dashboard-schedule-section">
          <div className="jobs-header">
            <div>
              <h2 className="section-title">{t('providerUpcomingSchedule')}</h2>
              <p className="jobs-subtitle">{t('providerUpcomingScheduleDescription')}</p>
            </div>
            <Link to="/provider-schedule" className="view-all-link">{t('providerOpenCalendar')}</Link>
          </div>

          {loadingRequests ? (
            <div className="dashboard-schedule-list">
              <div className="dashboard-schedule-empty"><div className="spinner-small"></div><p>{t('providerLoadingSchedule')}</p></div>
            </div>
          ) : upcomingJobs.length === 0 ? (
            <div className="dashboard-schedule-list">
              <div className="dashboard-schedule-empty">
                <span className="jobs-empty-icon" aria-hidden="true"><i className="bi bi-calendar2-check"></i></span>
                <h3>{t('providerNoUpcomingAcceptedJobs')}</h3>
                <p>{t('providerUpcomingAcceptedDescription')}</p>
              </div>
            </div>
          ) : (
            <div className="dashboard-schedule-list">
              {upcomingJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className="dashboard-schedule-row"
                  onClick={() => navigate(`/requests?request=${job.id}`)}
                >
                  <span className="dashboard-schedule-date" aria-hidden="true">
                    <i className="bi bi-calendar-event"></i>
                  </span>
                  <span className="dashboard-schedule-copy">
                    <strong>{formatServiceLabel(job, t('providerServiceRequestFallback'))}</strong>
                    <small>{job.client_name || t('client')} · {formatSchedule(job, false, locale, t('providerScheduleNotSet'))}</small>
                  </span>
                  <span className={`job-status ${getStatusClass(job.status)}`}>{formatStatus(job.status)}</span>
                  <i className="bi bi-chevron-right dashboard-schedule-chevron" aria-hidden="true"></i>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="jobs-section">
          <div className="jobs-header">
            <div>
              <h2 className="section-title">{t('providerWorkQueue')}</h2>
              <p className="jobs-subtitle">{t('providerWorkQueueDescription')}</p>
            </div>
            <Link to="/requests" className="view-all-link">{t('providerViewAllRequests')}</Link>
          </div>

          {loadingRequests ? (
            <div className="jobs-loading">
              <div className="spinner-small"></div>
              <p>{t('providerLoadingRequests')}</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="jobs-empty">
              <span className="jobs-empty-icon" aria-hidden="true"><i className="bi bi-inbox"></i></span>
              <h3>{t('providerNoQueueJobs')}</h3>
              <p>{t('providerQueueEmptyDescription')}</p>
            </div>
          ) : (
            <div className="jobs-grid">
              {requests.map((job) => (
                <AppCard as="article" flat key={job.id} className="job-card">
                  <div className="job-card-top">
                    <span className="job-service-icon" aria-hidden="true">
                      <i className="bi bi-tools"></i>
                    </span>
                    <div className="job-heading-copy">
                      <h3 className="job-title">{formatServiceLabel(job, t('providerServiceRequestFallback'))}</h3>
                      <p className="job-client">
                        <i className="bi bi-person" aria-hidden="true"></i>
                        {job.client_name || t('client')}
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
                      <span>{t('providerScheduled')}</span>
                      <strong>{formatSchedule(job, false, locale, t('providerScheduleNotSet'))}</strong>
                    </div>
                  </div>

                  <div className="job-actions">
                    {job.status === REQUEST_STATUS.PENDING && (
                      <>
                        <AppButton
                          onClick={() => handleStatusUpdate(job.id, REQUEST_STATUS.ACCEPTED)}
                          disabled={actionLoading === job.id}
                        >
                          {actionLoading === job.id ? t('requestsProcessing') : t('requestsAcceptRequest')}
                        </AppButton>
                        <AppButton
                          variant="secondary"
                          onClick={() => setSelectedRequest(job)}
                          disabled={actionLoading === job.id}
                        >
                          View Details
                        </AppButton>
                        <AppButton
                          variant="danger"
                          onClick={() => openDeclineDialog(job.id)}
                          disabled={actionLoading === job.id}
                        >
                          Decline Request
                        </AppButton>
                      </>
                    )}

                    {job.status === REQUEST_STATUS.ACCEPTED && (
                      <>
                        <AppButton
                          onClick={() => handleStatusUpdate(job.id, REQUEST_STATUS.ON_THE_WAY)}
                          disabled={actionLoading === job.id}
                          icon={<i className="bi bi-truck" aria-hidden="true"></i>}
                        >
                          {t('requestsImOnMyWay')}
                        </AppButton>
                        <AppButton
                          variant="secondary"
                          onClick={() => setSelectedRequest(job)}
                          disabled={actionLoading === job.id}
                        >
                          View Details
                        </AppButton>
                      </>
                    )}

                    {job.status === REQUEST_STATUS.ON_THE_WAY && (
                      <>
                        <AppButton onClick={() => handleStatusUpdate(job.id, REQUEST_STATUS.IN_PROGRESS)} disabled={actionLoading === job.id} icon={<i className="bi bi-play-circle" aria-hidden="true"></i>}>
                          {t('requestsStartService')}
                        </AppButton>
                        <AppButton variant="secondary" onClick={() => setSelectedRequest(job)} disabled={actionLoading === job.id}>
                          View Details
                        </AppButton>
                      </>
                    )}

                    {job.status === REQUEST_STATUS.IN_PROGRESS && (
                      <>
                        <AppButton onClick={() => handleStatusUpdate(job.id, REQUEST_STATUS.COMPLETED)} disabled={actionLoading === job.id} icon={<i className="bi bi-check-lg" aria-hidden="true"></i>}>
                          {t('requestsMarkServiceComplete')}
                        </AppButton>
                        <AppButton variant="secondary" onClick={() => setSelectedRequest(job)} disabled={actionLoading === job.id}>
                          View Details
                        </AppButton>
                      </>
                    )}
                  </div>
                </AppCard>
              ))}
            </div>
          )}
        </section>

        <section className={`level-up-banner verification-state-${verificationStatus?.status || (user?.isVerified ? 'approved' : 'not_submitted')} ${user?.isVerified ? 'verified' : ''}`}>
          <span className="level-up-icon" aria-hidden="true">
            <i className={`bi ${
              user?.isVerified
                ? 'bi-patch-check-fill'
                : verificationStatus?.status === 'pending'
                  ? 'bi-hourglass-split'
                  : verificationStatus?.status === 'rejected'
                    ? 'bi-shield-x'
                    : 'bi-shield-check'
            }`}></i>
          </span>
          <div className="level-up-copy">
            <h2>
              {user?.isVerified
                ? t('providerVerificationApproved')
                : verificationStatus?.status === 'pending'
                  ? t('providerVerificationPending')
                  : verificationStatus?.status === 'rejected'
                    ? t('providerVerificationRejected')
                    : t('providerVerificationTitle')}
            </h2>
            <p>
              {user?.isVerified
                ? t('providerVerificationApprovedDescription')
                : verificationStatus?.status === 'pending'
                  ? t('providerVerificationPendingDescription')
                  : verificationStatus?.status === 'rejected'
                    ? t('providerVerificationRejectedDescription')
                    : t('providerVerificationListingRequirement')}
            </p>
            {verificationStatus?.status === 'rejected' && verificationStatus?.rejectionReason && (
              <div className="provider-verification-reason" role="status">
                <strong>{t('providerVerificationRejectionReason')}</strong>
                <span>{verificationStatus.rejectionReason}</span>
              </div>
            )}
          </div>
          {!user?.isVerified && verificationStatus?.status !== 'pending' && (
            <AppButton onClick={() => setShowVerificationRequest(true)}>
              {verificationStatus?.status === 'rejected' ? t('providerVerificationResubmit') : t('providerGetVerified')}
            </AppButton>
          )}
        </section>

        <section className="tips-section" aria-labelledby="provider-tips-title">
          <div className="tips-section-heading">
            <h2 id="provider-tips-title" className="section-title">{t('providerTipsTitle')}</h2>
          </div>

          <div className="tips-grid">
            {PROVIDER_TIPS.map((tip) => (
              <article key={tip.id} className="tip-card">
                <span className="tip-card-icon" aria-hidden="true">
                  <i className={`bi ${tip.icon}`}></i>
                </span>
                <div>
                  <h3>{t(tip.titleKey)}</h3>
                  <p>{t(tip.descriptionKey)}</p>
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
          <VerificationRequestModal
            onClose={() => {
              setShowVerificationRequest(false);
              fetchVerificationStatus();
              fetchChecklistData();
            }}
          />
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
                <h2 id="dashboard-decline-dialog-title">{t('requestsDeclineRequest')}</h2>
                <IconButton className="decline-dialog-close" onClick={closeDeclineDialog} aria-label={t('requestsCloseDeclineDialog')}>×</IconButton>
              </div>
              <div className="decline-dialog-body">
                <label htmlFor="dashboard-decline-reason" className="decline-dialog-label">{t('reasonForDeclining')}</label>
                <textarea
                  id="dashboard-decline-reason"
                  className="decline-dialog-textarea"
                  rows={4}
                  value={declineDialog.reason}
                  onChange={(event) => setDeclineDialog((prev) => ({ ...prev, reason: event.target.value, error: '' }))}
                  placeholder={t('providerDeclinePlaceholder')}
                />
                {declineDialog.error ? <p className="decline-dialog-error">{declineDialog.error}</p> : null}
              </div>
              <div className="decline-dialog-actions">
                <AppButton variant="secondary" onClick={closeDeclineDialog} disabled={actionLoading === declineDialog.requestId}>{t('requestsCancelAction')}</AppButton>
                <AppButton variant="danger" onClick={handleConfirmDecline} disabled={actionLoading === declineDialog.requestId}>
                  {actionLoading === declineDialog.requestId ? t('requestsDeclining') : t('requestsDeclineRequest')}
                </AppButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
