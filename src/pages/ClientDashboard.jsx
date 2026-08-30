import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUser, serviceRequestAPI, userProfileAPI } from '../services/api';
import { PageHeader } from '../components/ui';
import ProfileCompletionChecklist from '../components/common/ProfileCompletionChecklist';
import { useLanguage } from '../context/LanguageContext';
import './ClientDashboard.css';

const ACTIVE_STATUSES = new Set(['pending', 'accepted', 'on_the_way', 'in_progress']);

function getRequestDate(request) {
  const raw = request?.scheduled_start_at || (request?.start_date ? `${request.start_date}T${request.start_time || '00:00'}` : request?.scheduled_date ? `${request.scheduled_date}T${request.scheduled_time || '00:00'}` : null);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatSchedule(request, locale, fallback) {
  const date = getRequestDate(request);
  if (!date) return fallback;
  return date.toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function serviceLabel(request, fallback) {
  return request?.service_display_label || request?.service_type_label || request?.service_profile_name || fallback;
}

export default function ClientDashboard() {
  const { t, language } = useLanguage();
  const locale = language === 'ceb' ? 'ceb-PH' : 'en-PH';
  const user = getUser();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onboardingData, setOnboardingData] = useState(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await serviceRequestAPI.getClientRequests();
        if (mounted && response?.success) setRequests(response.data?.requests || []);
      } catch {
        if (mounted) setError(t('clientDashboardLoadError'));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [t]);

  useEffect(() => {
    let mounted = true;
    const loadOnboarding = async () => {
      try {
        setOnboardingLoading(true);
        setOnboardingError('');
        const response = await userProfileAPI.getOnboardingProgress();
        if (mounted && response?.success) {
          setOnboardingData(response.data);
        }
      } catch {
        if (mounted) setOnboardingError(t('feedChecklistLoadError', 'Unable to load onboarding progress right now.'));
      } finally {
        if (mounted) setOnboardingLoading(false);
      }
    };
    loadOnboarding();
    return () => { mounted = false; };
  }, [t]);

  const checklistTasks = useMemo(() => {
    if (!onboardingData?.tasks) return [];
    return onboardingData.tasks.map((task) => ({
      key: task.id,
      label: t(task.titleKey, task.defaultTitle),
      description: task.id === 'email_verified'
        ? t('feedChecklistBasicProfileDescription', 'Ensure your email address is verified')
        : task.id === 'profile_info'
        ? t('feedChecklistContactDescription', 'Add contact phone and Toledo address')
        : t('feedChecklistFirstBookingDescription', 'Submit your first service request'),
      completed: task.completed,
      actionType: 'link',
      to: task.actionPath === '/feed' ? '/feed' : '/settings',
      actionLabel: task.id === 'first_request' ? t('feedChecklistFindProviders', 'Find Providers') : t('feedChecklistOpenSettings', 'Open Settings'),
    }));
  }, [onboardingData, t]);

  const summary = useMemo(() => {
    const pending = requests.filter((item) => item.status === 'pending').length;
    const active = requests.filter((item) => ACTIVE_STATUSES.has(item.status)).length;
    const completed = requests.filter((item) => item.status === 'completed').length;
    return { pending, active, completed };
  }, [requests]);

  const currentRequests = useMemo(() => requests
    .filter((item) => ACTIVE_STATUSES.has(item.status))
    .sort((a, b) => (getRequestDate(a)?.getTime() || Number.MAX_SAFE_INTEGER) - (getRequestDate(b)?.getTime() || Number.MAX_SAFE_INTEGER))
    .slice(0, 4), [requests]);

  return (
    <div className="client-dashboard-page">
      <div className="client-dashboard-inner">
        <PageHeader
          title={t('clientDashboardWelcomeBack', { name: user?.fullName ? `, ${user.fullName.split(' ')[0]}` : '' })}
          subtitle={t('clientDashboardSubtitle')}
          className="client-dashboard-header"
          action={<Link className="st-button st-button--primary st-button--md" to="/feed"><i className="bi bi-search" aria-hidden="true"></i> {t('clientDashboardFindService')}</Link>}
        />

        {onboardingData && !onboardingData.isComplete && (
          <div className="client-dashboard-onboarding">
            <ProfileCompletionChecklist
              title={t('feedGettingStarted', 'Getting Started as a Client')}
              tasks={checklistTasks}
              loading={onboardingLoading}
              error={onboardingError}
              initiallyCollapsed={false}
            />
          </div>
        )}

        <section className="client-dashboard-stats" aria-label={t('clientDashboardBookingSummary')}>
          <Link to="/requests" className="client-stat-card">
            <span className="client-stat-icon pending"><i className="bi bi-hourglass-split"></i></span>
            <span><strong>{summary.pending}</strong><small>{t('clientDashboardPending')}</small></span>
          </Link>
          <Link to="/requests" className="client-stat-card">
            <span className="client-stat-icon active"><i className="bi bi-calendar-check"></i></span>
            <span><strong>{summary.active}</strong><small>{t('clientDashboardActiveRequests')}</small></span>
          </Link>
          <Link to="/requests" className="client-stat-card">
            <span className="client-stat-icon completed"><i className="bi bi-check2-circle"></i></span>
            <span><strong>{summary.completed}</strong><small>{t('clientDashboardCompleted')}</small></span>
          </Link>
        </section>

        <section className="client-dashboard-grid">
          <div className="client-dashboard-panel client-current-panel">
            <div className="client-panel-heading">
              <div><h2>{t('clientDashboardCurrentRequests')}</h2></div>
              <Link to="/requests">{t('clientDashboardViewAll')}</Link>
            </div>
            {loading ? (
              <div className="client-dashboard-state"><span className="spinner-small"></span><p>{t('clientDashboardLoadingRequests')}</p></div>
            ) : error ? (
              <div className="client-dashboard-state error"><i className="bi bi-exclamation-circle"></i><p>{error}</p></div>
            ) : currentRequests.length === 0 ? (
              <div className="client-dashboard-state empty"><i className="bi bi-calendar2-plus"></i><h3>{t('clientDashboardNoActiveRequests')}</h3><p>{t('clientDashboardNoActiveDescription')}</p><Link className="st-button st-button--secondary st-button--md" to="/feed">{t('browseServices')}</Link></div>
            ) : (
              <div className="client-request-list">
                {currentRequests.map((request) => (
                  <Link key={request.id} to={`/requests?request=${request.id}`} className="client-request-row">
                    <span className="client-request-icon"><i className="bi bi-tools"></i></span>
                    <span className="client-request-main"><strong>{serviceLabel(request, t('clientDashboardServiceFallback'))}</strong><small>{request.provider_name || t('serviceProvider')} · {formatSchedule(request, locale, t('clientDashboardScheduleUnconfirmed'))}</small></span>
                    <span className={`client-request-status status-${request.status}`}>{t({ pending: 'statusPending', accepted: 'statusAccepted', on_the_way: 'statusOnTheWay', in_progress: 'statusInProgress', completed: 'statusCompleted', cancelled: 'statusCancelled', declined: 'statusDeclined' }[request.status] || 'statusPending')}</span>
                    <i className="bi bi-chevron-right client-request-chevron" aria-hidden="true"></i>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <aside className="client-dashboard-panel client-quick-panel">
            <div className="client-panel-heading"><div><h2>{t('clientDashboardQuickActions')}</h2></div></div>
            <div className="client-quick-actions">
              <Link to="/feed"><i className="bi bi-search"></i><span><strong>{t('browseServices')}</strong><small>{t('clientDashboardBrowseDescription')}</small></span></Link>
              <Link to="/requests"><i className="bi bi-inbox"></i><span><strong>{t('clientSidebarRequests')}</strong><small>{t('clientDashboardRequestsDescription')}</small></span></Link>
              <Link to="/notifications"><i className="bi bi-bell"></i><span><strong>{t('notifications')}</strong><small>{t('clientDashboardNotificationsDescription')}</small></span></Link>
              <Link to="/client-settings"><i className="bi bi-gear"></i><span><strong>{t('clientDashboardAccountSettings')}</strong><small>{t('clientDashboardSettingsDescription')}</small></span></Link>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
