import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import './HowItWorks.css';

export default function HowItWorks() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeRole, setActiveRole] = useState('client');

  const roleContent = {
    client: {
      heading: t('forClients'),
      steps: [
        {
          title: t('howClientStep1Title'),
          description: t('howClientStep1Description'),
        },
        {
          title: t('howClientStep2Title'),
          description: t('howClientStep2Description'),
        },
        {
          title: t('howClientStep3Title'),
          description: t('howClientStep3Description'),
        },
      ],
      ctaLabel: t('howClientCta'),
      ctaPath: '/register?role=client',
      icon: 'bi bi-person-heart',
    },
    provider: {
      heading: t('forServiceProviders'),
      steps: [
        {
          title: t('howProviderStep1Title'),
          description: t('howProviderStep1Description'),
        },
        {
          title: t('howProviderStep2Title'),
          description: t('howProviderStep2Description'),
        },
        {
          title: t('howProviderStep3Title'),
          description: t('howProviderStep3Description'),
        },
      ],
      ctaLabel: t('howProviderCta'),
      ctaPath: '/register?role=provider',
      icon: 'bi bi-briefcase',
    },
  };

  const current = roleContent[activeRole];

  return (
    <section className="how-it-works-section py-5" aria-labelledby="how-it-works-title">
      <div className="container">
        <div className="text-center mb-4">
          <h2 id="how-it-works-title" className="section-title mb-2">
            {t('howItWorksTitle')}
          </h2>
          <p className="section-subtitle mb-0">
            {t('howItWorksSubtitle')}
          </p>
        </div>

        <div className="how-role-toggle" role="tablist" aria-label={t('roleGuideToggle')}>
          <button
            type="button"
            role="tab"
            aria-selected={activeRole === 'client'}
            className={`how-role-btn ${activeRole === 'client' ? 'active' : ''}`}
            onClick={() => setActiveRole('client')}
          >
            <i className="bi bi-people me-2" aria-hidden="true"></i>
            {t('forClients')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeRole === 'provider'}
            className={`how-role-btn ${activeRole === 'provider' ? 'active' : ''}`}
            onClick={() => setActiveRole('provider')}
          >
            <i className="bi bi-tools me-2" aria-hidden="true"></i>
            {t('forServiceProviders')}
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
