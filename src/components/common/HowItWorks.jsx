import { useLanguage } from '../../context/LanguageContext';
import './HowItWorks.css';

export default function HowItWorks() {
  const { t } = useLanguage();

  const steps = [
    {
      icon: 'bi-search',
      title: t('howClientStep2Title'),
      description: t('howClientStep2Description'),
    },
    {
      icon: 'bi-person-check',
      title: t('viewProfile'),
      description: t('feedSubtitle'),
    },
    {
      icon: 'bi-calendar2-check',
      title: t('howClientStep3Title'),
      description: t('howClientStep3Description'),
    },
  ];

  return (
    <section className="how-it-works-section" aria-labelledby="how-it-works-title">
      <div className="container">
        <div className="how-it-works-heading">
          <p className="home-section-kicker">{t('howItWorksTitle')}</p>
          <h2 id="how-it-works-title" className="section-title">
            {t('howItWorksTitle')}
          </h2>
          <p className="section-subtitle">{t('howItWorksSubtitle')}</p>
        </div>

        <div className="how-steps-grid">
          {steps.map((step, index) => (
            <article className="how-step-card" key={step.title}>
              <div className="how-step-topline">
                <span className="how-step-number" aria-hidden="true">{index + 1}</span>
                <i className={`bi ${step.icon} how-step-icon`} aria-hidden="true"></i>
              </div>
              <h3 className="how-step-title">{step.title}</h3>
              <p className="how-step-description">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
