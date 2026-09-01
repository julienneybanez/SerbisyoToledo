import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import Reveal from '../components/common/Reveal';
import { useLanguage } from '../context/LanguageContext';
import { AppButton } from '../components/ui';

const ABOUT_FEATURES = [
  { icon: 'bi-search', titleKey: 'aboutFeatureFindTitle', descriptionKey: 'aboutFeatureFindDescription' },
  { icon: 'bi-person-badge', titleKey: 'aboutFeatureCompareTitle', descriptionKey: 'aboutFeatureCompareDescription' },
  { icon: 'bi-calendar2-check', titleKey: 'aboutFeatureBookTitle', descriptionKey: 'aboutFeatureBookDescription' },
];

const About = () => {
  const { t } = useLanguage();

  return (
    <div className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <div className="container">
          <div className="about-hero-grid">
            <Reveal className="about-hero-copy" delay={40}>
              <h1 id="about-title">{t('aboutPageTitle')}</h1>
              <p>{t('aboutPageIntro')}</p>
            </Reveal>

            <Reveal className="about-brand-visual" variant="image" delay={140}>
              <div className="about-brand-mark" aria-hidden="true">
                <img
                  src={logo}
                  alt=""
                  className="about-logo non-draggable-image"
                  draggable="false"
                />
                <div className="about-visual-wordmark">
                  <span className="about-visual-serbisyo">Serbisyo</span>
                  <span className="about-visual-toledo">Toledo</span>
                </div>
              </div>
              <div className="about-visual-accent about-visual-accent-one" aria-hidden="true" />
              <div className="about-visual-accent about-visual-accent-two" aria-hidden="true" />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="about-mission-section" aria-labelledby="about-mission-title">
        <div className="container">
          <div className="about-mission-grid">
            <Reveal className="about-section-heading">
              <h2 id="about-mission-title">{t('aboutMissionTitle')}</h2>
            </Reveal>

            <Reveal className="about-mission-copy" delay={100}>
              <p>{t('aboutMissionOne')}</p>
              <p>{t('aboutMissionTwo')}</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="about-help-section" aria-labelledby="about-help-title">
        <div className="container">
          <Reveal className="about-section-heading about-help-heading">
            <h2 id="about-help-title">{t('aboutHelpTitle')}</h2>
          </Reveal>

          <div className="about-feature-grid">
            {ABOUT_FEATURES.map((feature, index) => (
              <Reveal
                className="about-feature-card"
                delay={index * 80}
                key={feature.titleKey}
              >
                <span className="about-feature-icon" aria-hidden="true">
                  <i className={`bi ${feature.icon}`} />
                </span>
                <h3>{t(feature.titleKey)}</h3>
                <p>{t(feature.descriptionKey)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="about-local-section" aria-labelledby="about-local-title">
        <div className="container">
          <Reveal className="about-local-panel">
            <div className="about-local-copy">
              <h2 id="about-local-title">{t('aboutLocalTitle')}</h2>
              <p>{t('aboutLocalDescription')}</p>
            </div>

            <div className="about-contact">
              <span className="about-contact-label">{t('aboutContact')}</span>
              <a href="mailto:toledoserbisyo@gmail.com">toledoserbisyo@gmail.com</a>
              <span>Toledo City, Cebu</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="about-cta-section">
        <div className="container">
          <Reveal className="about-cta-row">
            <div>
              <h2>{t('aboutCtaTitle')}</h2>
              <p>{t('aboutCtaDescription')}</p>
            </div>
            <AppButton as={Link} to="/feed" className="about-cta-button">
              {t('browseServices')}
              <i className="bi bi-arrow-right" aria-hidden="true" />
            </AppButton>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default About;
