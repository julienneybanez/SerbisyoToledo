import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUser, serviceRequestAPI } from '../services/api';
import { PageHeader } from '../components/ui';
import './ClientDashboard.css';

const ACTIVE_STATUSES = new Set(['pending', 'accepted', 'on_the_way', 'in_progress']);

function getRequestDate(request) {
  const raw = request?.scheduled_start_at || (request?.start_date ? `${request.start_date}T${request.start_time || '00:00'}` : request?.scheduled_date ? `${request.scheduled_date}T${request.scheduled_time || '00:00'}` : null);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatSchedule(request) {
  const date = getRequestDate(request);
  if (!date) return 'Schedule to be confirmed';
  return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function serviceLabel(request) {
  return request?.service_display_label || request?.service_type_label || request?.service_profile_name || 'Service Request';
}

export default function ClientDashboard() {
  const user = getUser();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await serviceRequestAPI.getClientRequests();
        if (mounted && response?.success) setRequests(response.data?.requests || []);
      } catch (err) {
        if (mounted) setError(err?.message || 'Unable to load your requests right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

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
          title={`Welcome back${user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}`}
          subtitle="Find a service, check your bookings, and see what needs your attention."
          className="client-dashboard-header"
          action={<Link className="st-button st-button--primary st-button--md" to="/feed"><i className="bi bi-search" aria-hidden="true"></i> Find a Service</Link>}
        />

        <section className="client-dashboard-stats" aria-label="Booking summary">
          <Link to="/requests" className="client-stat-card">
            <span className="client-stat-icon pending"><i className="bi bi-hourglass-split"></i></span>
            <span><strong>{summary.pending}</strong><small>Pending</small></span>
          </Link>
          <Link to="/requests" className="client-stat-card">
            <span className="client-stat-icon active"><i className="bi bi-calendar-check"></i></span>
            <span><strong>{summary.active}</strong><small>Active Requests</small></span>
          </Link>
          <Link to="/requests" className="client-stat-card">
            <span className="client-stat-icon completed"><i className="bi bi-check2-circle"></i></span>
            <span><strong>{summary.completed}</strong><small>Completed</small></span>
          </Link>
        </section>

        <section className="client-dashboard-grid">
          <div className="client-dashboard-panel client-current-panel">
            <div className="client-panel-heading">
              <div><span className="client-panel-kicker">Bookings</span><h2>Current Requests</h2></div>
              <Link to="/requests">View all</Link>
            </div>
            {loading ? (
              <div className="client-dashboard-state"><span className="spinner-small"></span><p>Loading your requests...</p></div>
            ) : error ? (
              <div className="client-dashboard-state error"><i className="bi bi-exclamation-circle"></i><p>{error}</p></div>
            ) : currentRequests.length === 0 ? (
              <div className="client-dashboard-state empty"><i className="bi bi-calendar2-plus"></i><h3>No active requests</h3><p>Browse local providers when you need a service.</p><Link className="st-button st-button--secondary st-button--md" to="/feed">Browse Services</Link></div>
            ) : (
              <div className="client-request-list">
                {currentRequests.map((request) => (
                  <Link key={request.id} to={`/requests?request=${request.id}`} className="client-request-row">
                    <span className="client-request-icon"><i className="bi bi-tools"></i></span>
                    <span className="client-request-main"><strong>{serviceLabel(request)}</strong><small>{request.provider_name || 'Service provider'} · {formatSchedule(request)}</small></span>
                    <span className={`client-request-status status-${request.status}`}>{String(request.status || 'pending').replaceAll('_', ' ')}</span>
                    <i className="bi bi-chevron-right client-request-chevron" aria-hidden="true"></i>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <aside className="client-dashboard-panel client-quick-panel">
            <div className="client-panel-heading"><div><span className="client-panel-kicker">Shortcuts</span><h2>Quick Actions</h2></div></div>
            <div className="client-quick-actions">
              <Link to="/feed"><i className="bi bi-search"></i><span><strong>Browse Services</strong><small>Find providers by category or service.</small></span></Link>
              <Link to="/requests"><i className="bi bi-inbox"></i><span><strong>My Requests</strong><small>Review booking status and details.</small></span></Link>
              <Link to="/notifications"><i className="bi bi-bell"></i><span><strong>Notifications</strong><small>See provider and booking updates.</small></span></Link>
              <Link to="/client-settings"><i className="bi bi-gear"></i><span><strong>Account Settings</strong><small>Manage contact and security details.</small></span></Link>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
