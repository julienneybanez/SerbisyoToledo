import { useLanguage } from '../../context/LanguageContext';
import Reveal from './Reveal';
import './HowItWorks.css';

const COMPARE_PROVIDER_COPY = {
  en: {
    title: 'Compare Providers',
    description: 'Compare services, profiles, availability, location, and reviews.',
  },
  ceb: {
    title: 'Ikumpara ang mga Provider',
    description: 'Ikumpara ang mga serbisyo, profile, availability, lokasyon, ug reviews.',
  },
  fil: {
    title: 'Ihambing ang mga Provider',
    description: 'Ihambing ang mga serbisyo, profile, availability, lokasyon, at reviews.',
  },
};

export default function HowItWorks() {
  const { t, language } = useLanguage();
  const compareCopy = COMPARE_PROVIDER_COPY[language] || COMPARE_PROVIDER_COPY.en;

  const steps = [
    {
      title: t('howClientStep2Title'),
      description: t('howClientStep2Description'),
    },
    {
      title: compareCopy.title,
      description: compareCopy.description,
    },
    {
      title: t('howClientStep3Title'),
      description: t('howClientStep3Description'),
    },
  ];

  return (
    <section className="how-it-works-section" aria-labelledby="how-it-works-title">
      <div className="container">
        <Reveal className="how-it-works-heading">
          <h2 id="how-it-works-title" className="section-title">
            {t('howItWorksTitle')}
          </h2>
          <p className="section-subtitle">{t('howItWorksSubtitle')}</p>
        </Reveal>

        <div className="how-steps-grid">
          {steps.map((step, index) => (
            <Reveal
              as="article"
              className="how-step"
              key={step.title}
              delay={index * 90}
            >
              <span className="how-step-number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="how-step-copy">
                <h3 className="how-step-title">{step.title}</h3>
                <p className="how-step-description">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
