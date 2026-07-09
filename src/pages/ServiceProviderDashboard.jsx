import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getUser, serviceRequestAPI } from '../services/api';
import ServiceProfileModal from '../components/common/ServiceProfileModal';
import './ServiceProviderDashboard.css';

export default function ServiceProviderDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoadingRequests(true);
      const response = await serviceRequestAPI.getProviderRequests();
      if (response.success) {
        const activeJobs = response.data.requests.filter(
          r => ['pending', 'accepted', 'on_the_way', 'in_progress'].includes(r.status)
        );
        setRequests(activeJobs.slice(0, 4)); // Show max 4 on dashboard
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleStatusUpdate = async (requestId, status) => {
    setActionLoading(requestId);
    try {
      const response = await serviceRequestAPI.updateStatus(requestId, status);
      if (response.success) {
        // Refresh the requests list
        fetchRequests();
      }
    } catch (err) {
      console.error('Status update error:', err);
      alert('Failed to update status');
    } finally {
      setActionLoading(null);
    }
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

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">
        <section className="welcome-section">
          <div className="welcome-content">
            <h1>Welcome back, <span className="user-name">{user?.fullName || 'Service Provider'}!</span></h1>
            <p>Keep track of your ongoing jobs and continue building your reputation.</p>
          </div>
          <button 
            className="btn-post-service"
            onClick={() => setShowProfileModal(true)}
          >
            Post Service Profile
          </button>
        </section>

        <section className="tips-section">
          <h2 className="section-title">Weekly Tips for Service Providers</h2>
          <div className="tips-grid">
            {tips.map((tip) => (
              <div key={tip.id} className="tip-card">
                <img src={tip.image} alt={tip.title} className="tip-image" />
                <div className="tip-content">
                  <h3 className="tip-title">{tip.title}</h3>
                  <p className="tip-description">{tip.description}</p>
                  <div className="tip-footer">
                    <span>Read More</span>
                    <span className="read-time">{tip.readTime}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="jobs-section">
          <div className="jobs-header">
            <h2 className="section-title">Ongoing Jobs</h2>
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
                          {actionLoading === job.id ? 'Processing...' : 'Accept'}
                        </button>
                        <button 
                          className="job-btn job-btn-secondary"
                          onClick={() => handleStatusUpdate(job.id, 'declined')}
                          disabled={actionLoading === job.id}
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {job.status === 'accepted' && (
                      <button 
                        className="job-btn job-btn-on-way"
                        onClick={() => handleStatusUpdate(job.id, 'on_the_way')}
                        disabled={actionLoading === job.id}
                      >
                        <i className="bi bi-truck"></i> On My Way
                      </button>
                    )}
                    {['on_the_way', 'in_progress'].includes(job.status) && (
                      <button 
                        className="job-btn job-btn-complete"
                        onClick={() => handleStatusUpdate(job.id, 'completed')}
                        disabled={actionLoading === job.id}
                      >
                        <i className="bi bi-check-lg"></i> Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="level-up-banner">
          <h2>Ready to Level Up?</h2>
          <p>Complete your profile and get verified to increase your reliability to clients and unlock more opportunities.</p>
          <button className="btn-get-verified">GET VERIFIED NOW</button>
        </section>

        {showProfileModal && (
          <ServiceProfileModal onClose={() => setShowProfileModal(false)} />
        )}
      </div>
    </div>
  );
}
