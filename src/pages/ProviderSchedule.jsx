import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import bootstrap5Plugin from '@fullcalendar/bootstrap5';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/bootstrap5/theme.css';
import { serviceRequestAPI } from '../services/api';
import { AppButton, PageHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import './ProviderSchedule.css';

const VISIBLE_STATUSES = new Set(['pending', 'accepted', 'on_the_way', 'in_progress', 'completed']);

function toDateKey(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function datesBetween(startValue, endValue) {
  const startKey = toDateKey(startValue);
  const endKey = toDateKey(endValue || startValue);
  if (!startKey) return [];
  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [startKey];
  const values = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    values.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
  }
  return values;
}

function requestDates(request) {
  if (Array.isArray(request?.selected_dates) && request.selected_dates.length > 0) {
    return request.selected_dates.map(toDateKey).filter(Boolean);
  }
  return datesBetween(request?.start_date || request?.scheduled_date, request?.end_date || request?.scheduled_date);
}

function serviceLabel(request, fallback) {
  return request?.service_display_label || request?.service_type_label || request?.service_profile_name || fallback;
}

function eventStart(request, dateKey) {
  const time = String(request?.start_time || request?.scheduled_time || '09:00').slice(0, 5);
  return `${dateKey}T${time}:00`;
}

export default function ProviderSchedule() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const locale = language === 'ceb' ? 'ceb-PH' : 'en-PH';
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await serviceRequestAPI.getProviderRequests();
        if (mounted && response?.success) setRequests(response.data?.requests || []);
      } catch {
        if (mounted) setError(t('providerScheduleLoadError'));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [t]);

  const visibleRequests = useMemo(() => requests.filter((item) => VISIBLE_STATUSES.has(item.status)), [requests]);

  const events = useMemo(() => visibleRequests.flatMap((request) => requestDates(request).map((dateKey, index) => ({
    id: `${request.id}-${dateKey}-${index}`,
    title: `${serviceLabel(request, t('providerServiceRequestFallback'))} · ${request.client_name || t('client')}`,
    start: eventStart(request, dateKey),
    extendedProps: { requestId: request.id, status: request.status, clientName: request.client_name || t('client'), service: serviceLabel(request, t('providerServiceRequestFallback')) },
    classNames: [`provider-calendar-event`, `provider-calendar-event-${request.status}`],
  }))), [t, visibleRequests]);

  const now = Date.now();
  const upcoming = useMemo(() => events
    .filter((event) => new Date(event.start).getTime() >= now && ['accepted', 'on_the_way', 'in_progress'].includes(event.extendedProps.status))
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 5), [events, now]);

  const summary = useMemo(() => ({
    pending: requests.filter((item) => item.status === 'pending').length,
    upcoming: upcoming.length,
    active: requests.filter((item) => ['accepted', 'on_the_way', 'in_progress'].includes(item.status)).length,
  }), [requests, upcoming.length]);

  return (
    <div className="provider-schedule-page">
      <div className="provider-schedule-inner">
        <PageHeader
          title={t('schedule')}
          subtitle={t('providerScheduleSubtitle')}
          className="provider-schedule-header"
          action={<AppButton as={Link} to="/provider-availability" variant="secondary" icon={<i className="bi bi-calendar2-check" aria-hidden="true"></i>}>{t('providerScheduleManageAvailability')}</AppButton>}
        />

        <section className="provider-schedule-summary" aria-label={t('providerScheduleSummaryAria')}>
          <div><span className="schedule-summary-icon pending"><i className="bi bi-hourglass-split"></i></span><strong>{summary.pending}</strong><small>{t('providerSchedulePendingRequests')}</small></div>
          <div><span className="schedule-summary-icon upcoming"><i className="bi bi-calendar-event"></i></span><strong>{summary.upcoming}</strong><small>{t('providerScheduleUpcomingDates')}</small></div>
          <div><span className="schedule-summary-icon active"><i className="bi bi-briefcase"></i></span><strong>{summary.active}</strong><small>{t('providerScheduleActiveJobs')}</small></div>
        </section>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <section className="provider-schedule-layout">
          <div className="provider-calendar-card">
            {loading ? (
              <div className="provider-calendar-loading"><span className="spinner-small"></span><p>{t('providerLoadingSchedule')}</p></div>
            ) : (
              <FullCalendar
                plugins={[bootstrap5Plugin, dayGridPlugin, timeGridPlugin]}
                themeSystem="bootstrap5"
                initialView="dayGridMonth"
                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
                buttonText={{ today: t('providerScheduleToday'), month: t('providerScheduleMonth'), week: t('providerScheduleWeek'), day: t('providerScheduleDay') }}
                events={events}
                eventClick={(info) => navigate(`/requests?request=${info.event.extendedProps.requestId}`)}
                eventContent={(info) => (
                  <div className="provider-calendar-event-content">
                    <span className="provider-calendar-event-time">{info.timeText}</span>
                    <span className="provider-calendar-event-title">{info.event.extendedProps.service}</span>
                    <span className="provider-calendar-event-client">{info.event.extendedProps.clientName}</span>
                  </div>
                )}
                dayMaxEvents={3}
                nowIndicator
                allDaySlot={false}
                slotMinTime="06:00:00"
                slotMaxTime="21:00:00"
                height="auto"
              />
            )}
          </div>

          <aside className="provider-upcoming-card">
            <div className="provider-upcoming-heading"><span>{t('providerScheduleNextUp')}</span><h2>{t('providerScheduleUpcomingJobs')}</h2></div>
            {upcoming.length === 0 ? (
              <div className="provider-upcoming-empty"><i className="bi bi-calendar2-check"></i><p>{t('providerScheduleNoAcceptedJobs')}</p></div>
            ) : (
              <div className="provider-upcoming-list">
                {upcoming.map((event) => {
                  const date = new Date(event.start);
                  return (
                    <button key={event.id} type="button" onClick={() => navigate(`/requests?request=${event.extendedProps.requestId}`)} className="provider-upcoming-row">
                      <span className="provider-upcoming-date"><strong>{date.toLocaleDateString(locale, { day: '2-digit' })}</strong><small>{date.toLocaleDateString(locale, { month: 'short' })}</small></span>
                      <span className="provider-upcoming-copy"><strong>{event.extendedProps.service}</strong><small>{event.extendedProps.clientName} · {date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}</small></span>
                      <i className="bi bi-chevron-right" aria-hidden="true"></i>
                    </button>
                  );
                })}
              </div>
            )}
            <Link to="/requests" className="provider-upcoming-footer">{t('providerViewAllRequests')} <i className="bi bi-arrow-right"></i></Link>
          </aside>
        </section>
      </div>
    </div>
  );
}
