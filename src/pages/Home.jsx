import carpenter from '../assets/carpenter.jpg';
import heroCarpentry from '../assets/carpentry.jpg';
import electrician from '../assets/electrician.png';
import plumber from '../assets/plumber.jpg';
import cleaning from '../assets/cleaning.jpg';
import gardening from '../assets/gardening.jpg';
import laundry from '../assets/laundry.webp';
import { useNavigate } from 'react-router-dom';
import LandingSearch from '../components/common/LandingSearch';
import HowItWorks from '../components/common/HowItWorks';
import HomeFaq from '../components/common/HomeFaq';
import { useLanguage } from '../context/LanguageContext';
import useServiceTaxonomy from '../hooks/useServiceTaxonomy';

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

function Home() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { getCategory } = useServiceTaxonomy();

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
            <div className="home-hero-copy">
              <h1 id="home-hero-title" className="home-hero-title">
                {t('homeHeroSubtitle')}
              </h1>
              <p className="home-hero-subtitle">
                {t('feedSubtitle')}
              </p>

              <LandingSearch />

              <div className="home-hero-secondary-action">
                <button
                  type="button"
                  className="btn home-secondary-cta"
                  onClick={() => navigate('/register?role=provider')}
                >
                  {t('howProviderCta')}
                </button>
              </div>
            </div>

            <figure className="home-hero-visual">
              <img
                src={heroCarpentry}
                alt="Two local carpentry workers measuring and building a wooden frame"
                className="home-hero-image non-draggable-image"
                draggable="false"
              />
              <figcaption className="home-hero-caption">
                <i className="bi bi-geo-alt-fill" aria-hidden="true"></i>
                <span>{t('footerTagline')}</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="home-popular-section" aria-labelledby="popular-services-title">
        <div className="container">
          <div className="home-section-heading">
            <div>
              <p className="home-section-kicker">{t('browseServices')}</p>
              <h2 id="popular-services-title" className="section-title">
                {t('popularServices')}
              </h2>
              <p className="section-subtitle">{t('popularServicesSubtitle')}</p>
            </div>
            <button
              type="button"
              className="home-text-action"
              onClick={() => navigate('/feed')}
            >
              {t('browseServices')}
              <i className="bi bi-arrow-right" aria-hidden="true"></i>
            </button>
          </div>

          <div className="home-category-grid">
            {popularServices.map((service) => (
              <button
                key={service.key}
                type="button"
                className="home-category-card"
                onClick={() => openCategory(service.key)}
                aria-label={t('browseProvidersForService', { service: service.name })}
              >
                <img
                  src={service.image}
                  alt=""
                  className="home-category-image non-draggable-image"
                  draggable="false"
                  loading="lazy"
                />
                <span className="home-category-name">{service.name}</span>
                <i className="bi bi-arrow-up-right home-category-arrow" aria-hidden="true"></i>
              </button>
            ))}
          </div>
        </div>
      </section>

      <HowItWorks />

      <HomeFaq />

      <section className="home-provider-section" aria-labelledby="provider-cta-title">
        <div className="container">
          <div className="home-provider-panel">
            <div className="home-provider-icon" aria-hidden="true">
              <i className="bi bi-tools"></i>
            </div>
            <div className="home-provider-copy">
              <p className="home-section-kicker">{t('forServiceProviders')}</p>
              <h2 id="provider-cta-title">{t('howProviderCta')}</h2>
              <p>{t('howProviderStep2Description')}</p>
            </div>
            <button
              type="button"
              className="btn btn-primary home-provider-cta"
              onClick={() => navigate('/register?role=provider')}
            >
              {t('howProviderCta')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
