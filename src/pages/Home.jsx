import carpenter from '../assets/carpenter.jpg';
import heroCarpentry from '../assets/carpentry.jpg';
import electrician from '../assets/electrician.png';
import plumber from '../assets/plumber.jpg';
import cleaning from '../assets/cleaning.jpg';
import gardening from '../assets/gardening.jpg';
import laundry from '../assets/laundry.webp';
import providerPhoto from '../assets/electrician.png';
import trustPhoto from '../assets/carpenter.jpg';
import { useNavigate } from 'react-router-dom';
import LandingSearch from '../components/common/LandingSearch';
import HowItWorks from '../components/common/HowItWorks';
import HomeFaq from '../components/common/HomeFaq';
import Reveal from '../components/common/Reveal';
import { useLanguage } from '../context/LanguageContext';
import useServiceTaxonomy from '../hooks/useServiceTaxonomy';
import { AppButton } from '../components/ui';

const CATEGORY_VISUALS = {
  plumbing: plumber,
  electrical: electrician,
  cleaning,
  carpentry: carpenter,
  gardening_landscaping: gardening,
  laundry,
};

const POPULAR_CATEGORY_KEYS = [
  'plumbing',
  'electrical',
  'cleaning',
  'carpentry',
  'gardening_landscaping',
  'laundry',
];

const HOME_COPY = {
  en: {
    whyTitle: 'Why use SerbisyoToledo?',
    whySubtitle: 'Find local service providers and compare the details that matter before you book.',
    benefits: [
      {
        icon: 'bi-geo-alt',
        title: 'Local providers',
        description: 'Browse service providers serving Toledo City and its barangays.',
      },
      {
        icon: 'bi-people',
        title: 'Compare before you book',
        description: 'Check services, rates, availability, location, and reviews before choosing.',
      },
      {
        icon: 'bi-calendar2-check',
        title: 'Choose a schedule',
        description: 'Send a booking request with the date and time that works for you.',
      },
    ],
    providerTitle: 'Are you a service provider in Toledo City?',
    providerText: 'Create your service listing, show your previous work, and receive booking requests from clients.',
  },
  ceb: {
    whyTitle: 'Ngano gamiton ang SerbisyoToledo?',
    whySubtitle: 'Pangita ug ikumpara ang lokal nga service providers sa Toledo City sa dili pa ka mag-book.',
    benefits: [
      {
        icon: 'bi-geo-alt',
        title: 'Lokal nga providers',
        description: 'Tan-awa ang service providers nga nagserbisyo sa Toledo City ug mga barangay niini.',
      },
      {
        icon: 'bi-people',
        title: 'Ikumpara una sa pag-book',
        description: 'Tan-awa ang serbisyo, presyo, availability, lokasyon, ug reviews sa provider.',
      },
      {
        icon: 'bi-calendar2-check',
        title: 'Pili og schedule',
        description: 'Pag-request og petsa ug oras nga angay sa imong kinahanglan.',
      },
    ],
    providerTitle: 'Service provider ka sa Toledo City?',
    providerText: 'Paghimo og service listing, ipakita imong previous work, ug dawata ang booking requests sa mga kliyente.',
  },
  fil: {
    whyTitle: 'Bakit gamitin ang SerbisyoToledo?',
    whySubtitle: 'Maghanap at maghambing ng mga lokal na service provider sa Toledo City bago mag-book.',
    benefits: [
      {
        icon: 'bi-geo-alt',
        title: 'Mga lokal na provider',
        description: 'Tingnan ang mga service provider na nagseserbisyo sa Toledo City at mga barangay nito.',
      },
      {
        icon: 'bi-people',
        title: 'Ihambing bago mag-book',
        description: 'Tingnan ang serbisyo, presyo, availability, lokasyon, at reviews bago pumili.',
      },
      {
        icon: 'bi-calendar2-check',
        title: 'Pumili ng schedule',
        description: 'Mag-request ng petsa at oras na akma sa kailangan mo.',
      },
    ],
    providerTitle: 'Service provider ka ba sa Toledo City?',
    providerText: 'Gumawa ng service listing, ipakita ang dati mong trabaho, at tumanggap ng booking requests mula sa mga kliyente.',
  },
};

function Home() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { getCategory } = useServiceTaxonomy();
  const copy = HOME_COPY[language] || HOME_COPY.en;

  const popularServices = POPULAR_CATEGORY_KEYS
    .map((key) => {
      const category = getCategory(key);
      if (!category) return null;

      return {
        key,
        name: category.label,
        image: CATEGORY_VISUALS[key],
      };
    })
    .filter(Boolean);

  const openCategory = (categoryKey) => {
    const resolved = getCategory(categoryKey);
    if (!resolved?.label) {
      navigate('/feed');
      return;
    }

    navigate(`/feed?category=${encodeURIComponent(resolved.label)}`);
  };

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="container">
          <div className="home-hero-grid">
            <Reveal className="home-hero-copy" delay={40}>
              <h1 id="home-hero-title" className="home-hero-title">
                {t('homeHeroSubtitle')}
              </h1>
              <p className="home-hero-subtitle">
                {t('feedSubtitle')}
              </p>

              <LandingSearch />

              <div className="home-hero-secondary-action">
                <AppButton
                  variant="secondary"
                  className="home-secondary-cta"
                  onClick={() => navigate('/register?role=provider')}
                >
                  {t('howProviderCta')}
                  <i className="bi bi-arrow-right" aria-hidden="true"></i>
                </AppButton>
              </div>
            </Reveal>

            <Reveal as="figure" className="home-hero-visual" variant="image" delay={140}>
              <img
                src={heroCarpentry}
                alt={t('homeHeroImageAlt')}
                className="home-hero-image non-draggable-image"
                draggable="false"
              />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="home-popular-section" aria-labelledby="popular-services-title">
        <div className="container">
          <Reveal className="home-section-heading">
            <div>
              <h2 id="popular-services-title" className="section-title">
                {t('popularServices')}
              </h2>
              <p className="section-subtitle">{t('popularServicesSubtitle')}</p>
            </div>
            <AppButton
              variant="ghost"
              size="sm"
              className="home-text-action"
              onClick={() => navigate('/feed')}
            >
              {t('browseServices')}
              <i className="bi bi-arrow-right" aria-hidden="true"></i>
            </AppButton>
          </Reveal>

          <div className="home-category-grid">
            {popularServices.map((service, index) => (
              <Reveal
                as="button"
                key={service.key}
                type="button"
                className="home-category-card"
                delay={index * 70}
                onClick={() => openCategory(service.key)}
                aria-label={t('browseProvidersForService', { service: service.name })}
              >
                <span className="home-category-image-wrap">
                  <img
                    src={service.image}
                    alt=""
                    className="home-category-image non-draggable-image"
                    draggable="false"
                    loading="lazy"
                  />
                </span>
                <span className="home-category-card-footer">
                  <span className="home-category-name">{service.name}</span>
                  <i className="bi bi-arrow-up-right home-category-arrow" aria-hidden="true"></i>
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="home-trust-section" aria-labelledby="home-trust-title">
        <div className="container">
          <div className="home-editorial-split">
            <Reveal className="home-editorial-media" variant="image">
              <img
                src={trustPhoto}
                alt={t('homeTrustImageAlt')}
                className="home-editorial-image non-draggable-image"
                draggable="false"
                loading="lazy"
              />
            </Reveal>

            <Reveal className="home-editorial-copy" delay={120}>
              <h2 id="home-trust-title" className="section-title">{copy.whyTitle}</h2>
              <p className="section-subtitle">{copy.whySubtitle}</p>

              <div className="home-benefit-list">
                {copy.benefits.map((benefit) => (
                  <div className="home-benefit-item" key={benefit.title}>
                    <span className="home-benefit-icon" aria-hidden="true">
                      <i className={`bi ${benefit.icon}`}></i>
                    </span>
                    <div>
                      <h3>{benefit.title}</h3>
                      <p>{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <HowItWorks />

      <section className="home-provider-section" aria-labelledby="provider-cta-title">
        <div className="container">
          <div className="home-provider-split">
            <Reveal className="home-provider-copy">
              <h2 id="provider-cta-title" className="section-title">{copy.providerTitle}</h2>
              <p className="section-subtitle">{copy.providerText}</p>
              <AppButton
                className="home-provider-cta"
                onClick={() => navigate('/register?role=provider')}
              >
                {t('howProviderCta')}
                <i className="bi bi-arrow-right" aria-hidden="true"></i>
              </AppButton>
            </Reveal>

            <Reveal className="home-provider-media" variant="image" delay={120}>
              <img
                src={providerPhoto}
                alt={t('homeProviderImageAlt')}
                className="home-provider-image non-draggable-image"
                draggable="false"
                loading="lazy"
              />
            </Reveal>
          </div>
        </div>
      </section>

      <HomeFaq />
    </div>
  );
}

export default Home;
