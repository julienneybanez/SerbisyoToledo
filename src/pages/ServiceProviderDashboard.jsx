import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUser, serviceProfileAPI, serviceRequestAPI, userProfileAPI } from '../services/api';
import VerificationRequestModal from '../components/common/VerificationRequestModal';
import { AppButton, SoftPanel, StatCard } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { REQUEST_STATUS } from '../constants/domain';
import './ServiceProviderDashboard.css';
import './ProviderDashboardSimple.css';

const COPY = {
  en: {
    greeting: 'Good day', subtitle: 'Manage requests, your calendar, and the profile clients see.', setupTitle: 'Get your provider profile ready', setupHelp: 'Complete these four steps so clients can confidently find and book you.',
    stepVerify: 'Verify your identity', stepVerifyHelp: 'Complete provider verification before publishing services.', stepProfile: 'Complete your provider profile', stepProfileHelp: 'Add services, pricing, About Me, skills, languages, and optional credentials.',
    stepAvailability: 'Set your availability', stepAvailabilityHelp: 'Choose the dates and hours clients are allowed to book.', stepPreview: 'Preview your profile', stepPreviewHelp: 'Check exactly what clients will see before you start receiving bookings.',
    done: 'Done', next: 'Next step', startVerification: 'Start Verification', editProfile: 'Open Profile', setAvailability: 'Set Availability', preview: 'Preview as Client', pendingRequests: 'New Requests', activeJobs: 'Active Jobs', upcomingJobs: 'Upcoming Jobs', completedJobs: 'Completed Jobs',
    needsAttention: 'What needs your attention', noUrgent: 'Nothing urgent right now', noUrgentHelp: 'Keep your profile and availability current. New requests will appear here.', reviewRequests: 'Review Requests', nextJob: 'Next scheduled job', openCalendar: 'Open Calendar', recentRequests: 'Recent requests', noRequests: 'No requests yet', noRequestsHelp: 'Once a client books you, the request will appear here.', viewAll: 'View all requests', scheduleNotSet: 'Schedule not set',
    verificationPending: 'Verification is under review. You can continue preparing your profile while you wait.', verificationRejected: 'Verification needs changes. Open the verification form to submit clearer or corrected information.', resubmitVerification: 'Update Verification',
  },
  ceb: {
    greeting: 'Maayong adlaw', subtitle: 'I-manage ang requests, imong kalendaryo, ug ang profile nga makita sa kliyente.', setupTitle: 'Andama ang imong provider profile', setupHelp: 'Kompletoha kining upat ka lakang aron mas sayon ka makita ug ma-book sa kliyente.',
    stepVerify: 'I-verify ang imong identity', stepVerifyHelp: 'Kompletoha ang provider verification sa dili pa ipakita ang imong mga serbisyo.', stepProfile: 'Kompletoha ang imong provider profile', stepProfileHelp: 'Ibutang ang serbisyo, presyo, About Me, skills, pinulongan, ug opsyonal nga credentials.',
    stepAvailability: 'I-set ang imong availability', stepAvailabilityHelp: 'Pilia ang mga petsa ug oras nga mahimong i-book sa kliyente.', stepPreview: 'Tan-awa ang imong profile', stepPreviewHelp: 'Susiha unsa gyud ang makita sa kliyente sa dili pa ka modawat og booking.',
    done: 'Human', next: 'Sunod nga lakang', startVerification: 'Sugdi ang Verification', editProfile: 'Ablihi ang Profile', setAvailability: 'I-set ang Availability', preview: 'Tan-awa Ingon Kliyente', pendingRequests: 'Bag-ong Requests', activeJobs: 'Active nga Trabaho', upcomingJobs: 'Umaabot nga Trabaho', completedJobs: 'Nahuman nga Trabaho',
    needsAttention: 'Kinahanglan nimong tan-awon', noUrgent: 'Walay urgent karon', noUrgentHelp: 'Padayona nga updated ang imong profile ug availability. Dinhi makita ang bag-ong requests.', reviewRequests: 'Tan-awa ang Requests', nextJob: 'Sunod nga naka-schedule nga trabaho', openCalendar: 'Ablihi ang Kalendaryo', recentRequests: 'Bag-ong requests', noRequests: 'Wala pay request', noRequestsHelp: 'Kung adunay kliyente nga mo-book, dinhi makita ang request.', viewAll: 'Tan-awa tanang request', scheduleNotSet: 'Wala pay schedule',
    verificationPending: 'Gi-review pa ang verification. Mahimo nimong ipadayon ang pag-andam sa profile samtang naghulat.', verificationRejected: 'Kinahanglan usbon ang verification. Ablihi ang verification form ug isumite ang mas klaro o sakto nga impormasyon.', resubmitVerification: 'Usba ang Verification',
  },
};

function normalizeDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function requestStart(request) {
  const dateKey = normalizeDate(request?.booking_dates?.[0] || request?.selected_dates?.[0] || request?.start_date || request?.scheduled_date);
  if (!dateKey) return null;
  const time = String(request?.start_time || request?.scheduled_time || '09:00').slice(0, 5);
  const date = new Date(`${dateKey}T${time}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRequestSchedule(request, locale, fallback) {
  const date = requestStart(request);
  if (!date) return fallback;
  return `${date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })} · ${date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}`;
}

export default function ServiceProviderDashboard() {
  const { language, t } = useLanguage();
  const text = COPY[language === 'ceb' ? 'ceb' : 'en'];
  const locale = language === 'ceb' ? 'ceb-PH' : 'en-PH';
  const user = getUser();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [profile, setProfile] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [verification, setVerification] = useState(null);
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      serviceRequestAPI.getProviderRequests(), serviceProfileAPI.getMyProfile(), serviceProfileAPI.getMyPortfolio(), serviceProfileAPI.getMyAvailability(), userProfileAPI.getVerificationStatus(),
    ]).then((results) => {
      if (!mounted) return;
      const value = (index) => results[index].status === 'fulfilled' && results[index].value?.success ? results[index].value.data : null;
      setRequests(value(0)?.requests || []);
      setProfile(value(1));
      setPortfolio(value(2));
      setAvailability(value(3));
      setVerification(value(4));
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const summary = useMemo(() => {
    const activeStatuses = [REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.ON_THE_WAY, REQUEST_STATUS.IN_PROGRESS];
    const pending = requests.filter((request) => request.status === REQUEST_STATUS.PENDING).length;
    const active = requests.filter((request) => activeStatuses.includes(request.status)).length;
    const completed = requests.filter((request) => request.status === REQUEST_STATUS.COMPLETED).length;
    const now = Date.now();
    const upcoming = requests.filter((request) => activeStatuses.includes(request.status) && requestStart(request)?.getTime() > now).sort((a, b) => requestStart(a) - requestStart(b));
    return { pending, active, completed, upcomingCount: upcoming.length, nextUpcoming: upcoming[0] || null };
  }, [requests]);

  const serviceReady = Boolean(profile?.id && Array.isArray(profile?.categories) && profile.categories.length > 0 && Number(profile?.startingPrice) > 0 && String(profile?.location || '').trim());
  const aboutReady = Boolean(String(portfolio?.aboutMe || profile?.aboutMe || '').trim());
  const profileReady = serviceReady && aboutReady;
  const availabilityEntries = availability?.availableSlots || availability?.availability || availability?.specificAvailability || availability?.weeklyBlocks || [];
  const availabilityReady = Array.isArray(availabilityEntries) && availabilityEntries.length > 0;
  const verified = Boolean(user?.isVerified || verification?.isVerified || verification?.status === 'approved');
  const previewReady = Boolean(profile?.id && profile?.isPublished);
  const publicRoute = previewReady ? `/provider/${profile.id}` : '';
  const verificationPending = verification?.status === 'pending';

  const setupSteps = [
    { key: 'verification', title: text.stepVerify, help: verificationPending ? text.verificationPending : verification?.status === 'rejected' ? text.verificationRejected : text.stepVerifyHelp, complete: verified, onAction: verificationPending ? null : () => setShowVerification(true), action: verification?.status === 'rejected' ? text.resubmitVerification : text.startVerification },
    { key: 'profile', title: text.stepProfile, help: text.stepProfileHelp, complete: profileReady, to: '/provider-credentials', action: text.editProfile },
    { key: 'availability', title: text.stepAvailability, help: text.stepAvailabilityHelp, complete: availabilityReady, to: '/provider-schedule?tab=availability', action: text.setAvailability },
    { key: 'preview', title: text.stepPreview, help: text.stepPreviewHelp, complete: previewReady, to: publicRoute || '/provider-credentials', action: text.preview },
  ];
  const setupComplete = setupSteps.every((step) => step.complete);
  const nextStepKey = setupSteps.find((step) => !step.complete)?.key;
  const recentRequests = requests.filter((request) => [REQUEST_STATUS.PENDING, REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.ON_THE_WAY, REQUEST_STATUS.IN_PROGRESS].includes(request.status)).slice(0, 4);

  return (
    <div className="provider-dashboard-simple">
      <SoftPanel className="provider-dashboard-simple-hero">
        <div>
          <span className="provider-dashboard-eyebrow">{t('serviceProvider')}</span>
          <h1>{text.greeting}, <span>{user?.fullName || t('serviceProvider')}</span></h1>
          <p>{text.subtitle}</p>
        </div>
        <AppButton as={Link} to="/provider-credentials" icon={<i className="bi bi-person-vcard" aria-hidden="true" />}>{text.editProfile}</AppButton>
      </SoftPanel>

      {!setupComplete && (
        <section className="provider-setup-simple-card">
          <div className="provider-setup-simple-heading">
            <div><span>{text.next}</span><h2>{text.setupTitle}</h2><p>{text.setupHelp}</p></div>
            <strong>{setupSteps.filter((step) => step.complete).length}/4</strong>
          </div>
          <div className="provider-setup-simple-steps">
            {setupSteps.map((step, index) => (
              <article key={step.key} className={`${step.complete ? 'complete' : ''} ${step.key === nextStepKey ? 'next' : ''}`}>
                <span className="provider-setup-step-number">{step.complete ? <i className="bi bi-check-lg" /> : index + 1}</span>
                <div><strong>{step.title}</strong><p>{step.help}</p></div>
                {!step.complete && step.key === nextStepKey && step.onAction && <AppButton onClick={step.onAction} size="sm" variant="secondary">{step.action}</AppButton>}
                {!step.complete && step.key === nextStepKey && !step.onAction && step.to && <AppButton as={Link} to={step.to} size="sm" variant="secondary">{step.action}</AppButton>}
                {step.complete && <span className="provider-setup-done">{text.done}</span>}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="provider-dashboard-simple-stats" aria-label={t('providerQuickStatsAria')}>
        <StatCard label={text.pendingRequests} value={summary.pending} icon={<i className="bi bi-inbox" />} />
        <StatCard label={text.activeJobs} value={summary.active} icon={<i className="bi bi-briefcase" />} />
        <StatCard label={text.upcomingJobs} value={summary.upcomingCount} icon={<i className="bi bi-calendar-event" />} />
        <StatCard label={text.completedJobs} value={summary.completed} icon={<i className="bi bi-check-circle" />} />
      </section>

      <section className="provider-dashboard-simple-grid">
        <div className="provider-dashboard-attention-card">
          <div className="provider-dashboard-card-heading"><span><i className="bi bi-lightning-charge" /></span><div><h2>{text.needsAttention}</h2></div></div>
          {summary.pending > 0 ? (
            <div className="provider-dashboard-attention-content">
              <strong>{summary.pending} {summary.pending === 1 ? text.pendingRequests.toLowerCase().replace(/s$/, '') : text.pendingRequests.toLowerCase()}</strong>
              <p>{t('providerPendingDescription')}</p>
              <AppButton as={Link} to="/requests">{text.reviewRequests}</AppButton>
            </div>
          ) : summary.nextUpcoming ? (
            <div className="provider-dashboard-attention-content">
              <span>{text.nextJob}</span>
              <strong>{summary.nextUpcoming.service_display_label || summary.nextUpcoming.service_type_label || t('providerServiceRequestFallback')}</strong>
              <p>{formatRequestSchedule(summary.nextUpcoming, locale, text.scheduleNotSet)}</p>
              <AppButton as={Link} to="/provider-schedule" variant="secondary">{text.openCalendar}</AppButton>
            </div>
          ) : (
            <div className="provider-dashboard-empty-state"><i className="bi bi-check-circle" /><strong>{text.noUrgent}</strong><p>{text.noUrgentHelp}</p></div>
          )}
        </div>

        <div className="provider-dashboard-recent-card">
          <div className="provider-dashboard-card-heading split"><div><span><i className="bi bi-inbox" /></span><div><h2>{text.recentRequests}</h2></div></div><Link to="/requests">{text.viewAll}</Link></div>
          {loading ? (
            <div className="provider-dashboard-empty-state"><span className="spinner-small" /><p>{t('providerLoadingSchedule')}</p></div>
          ) : recentRequests.length === 0 ? (
            <div className="provider-dashboard-empty-state"><i className="bi bi-inbox" /><strong>{text.noRequests}</strong><p>{text.noRequestsHelp}</p></div>
          ) : (
            <div className="provider-dashboard-request-list">
              {recentRequests.map((request) => (
                <Link key={request.id} to={`/requests?request=${request.id}`} className="provider-dashboard-request-row">
                  <span className={`provider-dashboard-request-status status-${request.status}`} />
                  <div><strong>{request.service_display_label || request.service_type_label || t('providerServiceRequestFallback')}</strong><small>{request.client_name || t('client')} · {formatRequestSchedule(request, locale, text.scheduleNotSet)}</small></div>
                  <span className="provider-dashboard-request-badge">{request.status?.replaceAll('_', ' ')}</span>
                  <i className="bi bi-chevron-right" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {showVerification && <VerificationRequestModal onClose={() => setShowVerification(false)} />}
    </div>
  );
}
