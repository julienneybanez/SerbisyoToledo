import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HowItWorks.css';

const CLIENT_STEPS = [
  {
    title: 'Create an Account',
    description: 'Register as a client using your basic information.',
  },
  {
    title: 'Find a Service Provider',
    description: 'Search by service, provider name, rating, or location.',
  },
  {
    title: 'Send a Booking Request',
    description: 'Select a provider and submit your preferred schedule and service details.',
  },
];

const PROVIDER_STEPS = [
  {
    title: 'Register as a Provider',
    description: 'Create an account and indicate the service you offer.',
  },
  {
    title: 'Complete Your Profile',
    description: 'Add your services, experience, location, rate, availability, and portfolio.',
  },
  {
    title: 'Receive Service Requests',
    description: 'Review incoming booking requests and accept or decline them.',
  },
];

const ROLE_CONTENT = {
  client: {
    heading: 'For Clients',
    steps: CLIENT_STEPS,
    ctaLabel: 'Get Started as a Client',
    ctaPath: '/register?role=client',
    icon: 'bi bi-person-heart',
  },
  provider: {
    heading: 'For Service Providers',
    steps: PROVIDER_STEPS,
    ctaLabel: 'Become a Service Provider',
    ctaPath: '/register?role=provider',
    icon: 'bi bi-briefcase',
  },
};

export default function HowItWorks() {
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState('client');

  const current = ROLE_CONTENT[activeRole];

  return (
    <section className="how-it-works-section py-5" aria-labelledby="how-it-works-title">
      <div className="container">
        <div className="text-center mb-4">
          <h2 id="how-it-works-title" className="section-title mb-2">
            How SerbisyoToledo Works
          </h2>
          <p className="section-subtitle mb-0">
            Choose your role and follow a simple path to start connecting in Toledo City.
          </p>
        </div>

        <div className="how-role-toggle" role="tablist" aria-label="Role guide toggle">
          <button
            type="button"
            role="tab"
            aria-selected={activeRole === 'client'}
            className={`how-role-btn ${activeRole === 'client' ? 'active' : ''}`}
            onClick={() => setActiveRole('client')}
          >
            <i className="bi bi-people me-2" aria-hidden="true"></i>
            For Clients
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeRole === 'provider'}
            className={`how-role-btn ${activeRole === 'provider' ? 'active' : ''}`}
            onClick={() => setActiveRole('provider')}
          >
            <i className="bi bi-tools me-2" aria-hidden="true"></i>
            For Service Providers
          </button>
        </div>

        <div className="card how-role-card border-0 shadow-sm">
          <div className="card-body p-4 p-lg-5">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
              <h3 className="h5 mb-0">
                <i className={`${current.icon} me-2`} aria-hidden="true"></i>
                {current.heading}
              </h3>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate(current.ctaPath)}
              >
                {current.ctaLabel}
              </button>
            </div>

            <div className="row g-3">
              {current.steps.map((step, index) => (
                <div className="col-12 col-md-4" key={step.title}>
                  <article className="how-step h-100">
                    <div className="how-step-number" aria-hidden="true">
                      {index + 1}
                    </div>
                    <h4 className="how-step-title">{step.title}</h4>
                    <p className="how-step-description mb-0">{step.description}</p>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
