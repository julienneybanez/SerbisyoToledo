import carpenter from '../assets/carpenter.jpg';
import masseuse from '../assets/masseuse.jpg';
import caregiver from '../assets/caregiver.jpg';
import mechanic from '../assets/mechanic.jpg';
import plumber from '../assets/plumber.jpg';
import electrician from '../assets/electrician.png';
import panday from '../assets/panday.png';
import tubo from '../assets/tubo.png';
import cleaning from '../assets/cleaning.jpg';
import gardening from '../assets/gardening.jpg';
import locksmith from '../assets/locksmith.jpg';
import laundry from '../assets/laundry.webp';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingSearch from '../components/common/LandingSearch';
import HowItWorks from '../components/common/HowItWorks';
import { useLanguage } from '../context/LanguageContext';
import useServiceTaxonomy from '../hooks/useServiceTaxonomy';

function Home() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { getCategory } = useServiceTaxonomy();
  const servicesScrollRef = useRef(null);

  const trendingServices = [
    { name: 'Manghihilot', image: masseuse, categoryKey: 'beauty_wellness' },
    { name: 'Electrician', image: electrician, categoryKey: 'electrical' },
    { name: 'Panday', image: panday, categoryKey: 'carpentry' },
    { name: 'Tubo', image: tubo, categoryKey: 'plumbing' },
    { name: 'Cleaning', image: cleaning, categoryKey: 'cleaning' },
    { name: 'Gardening', image: gardening, categoryKey: 'gardening_landscaping' },
    { name: 'Locksmith', image: locksmith, categoryKey: 'locksmith' },
    { name: 'Laundry', image: laundry, categoryKey: 'laundry' },
  ];

  const openCategory = (categoryKey) => {
    const resolved = getCategory(categoryKey);
    const categoryLabel = resolved?.label || String(categoryKey || '').trim();
    navigate(`/feed?category=${encodeURIComponent(categoryLabel)}`);
  };

  const scrollServicesBy = (direction) => {
    const scroller = servicesScrollRef.current;
    if (!scroller) {
      return;
    }

    const cardWidth = 324;
    scroller.scrollBy({
      left: direction * cardWidth,
      behavior: 'smooth',
    });
  };

  return (
    <>
      <section className="hero-section">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-5">
              <div className="hero-content-stack">
                <h1 className="hero-title">{t('homeHeroTitle')}</h1>
                <p className="hero-subtitle">
                  {t('homeHeroSubtitle')}
                </p>
                <LandingSearch />
              </div>
            </div>
            <div className="col-lg-7">
              <div className="image-grid">
                <div className="row g-2">
                  <div className="col-6">
                    <img src={carpenter} alt="Carpenter working on wood cabinetry" className="img-fluid rounded non-draggable-image" draggable="false" />
                  </div>
                  <div className="col-6">
                    <img src={masseuse} alt="Massage therapist providing home service" className="img-fluid rounded non-draggable-image" draggable="false" />
                  </div>
                  <div className="col-6">
                    <img src={caregiver} alt="Caregiver assisting a client at home" className="img-fluid rounded non-draggable-image" draggable="false" />
                  </div>
                  <div className="col-6">
                    <img src={mechanic} alt="Mechanic checking motorcycle engine" className="img-fluid rounded non-draggable-image" draggable="false" />
                  </div>
                  <div className="col-6">
                    <img src={plumber} alt="Plumber fixing a sink pipe" className="img-fluid rounded non-draggable-image" draggable="false" />
                  </div>
                  <div className="col-6">
                    <img src={gardening} alt="Gardener preparing plants for residential service" className="img-fluid rounded non-draggable-image" draggable="false" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section py-5">
        <div className="container">
          <div className="row g-4">
            <div className="col-md-4">
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect width="40" height="40" rx="8" fill="#4A9FF5"/>
                    <path d="M20 12L14 20H20L18 28L26 18H20L22 12H20Z" fill="white" stroke="white" strokeWidth="1.5"/>
                  </svg>
                </div>
                <h3 className="feature-title">{t('homeFeature1Title')}</h3>
                <p className="feature-text">{t('homeFeature1Text')}</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect width="40" height="40" rx="8" fill="#22B8A5"/>
                    <path d="M20 10L22.5 17.5H30L24 22L26.5 30L20 25L13.5 30L16 22L10 17.5H17.5L20 10Z" fill="white"/>
                  </svg>
                </div>
                <h3 className="feature-title">{t('homeFeature2Title')}</h3>
                <p className="feature-text">{t('homeFeature2Text')}</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect width="40" height="40" rx="8" fill="#4A9FF5"/>
                    <rect x="12" y="14" width="16" height="12" rx="2" fill="white"/>
                    <rect x="15" y="11" width="10" height="3" fill="white"/>
                  </svg>
                </div>
                <h3 className="feature-title">{t('homeFeature3Title')}</h3>
                <p className="feature-text">{t('homeFeature3Text')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <HowItWorks />

      <section className="trending-section py-5">
        <div className="container">
          <div className="trending-head mb-4">
            <div className="text-center text-lg-start">
              <h2 className="section-title">{t('popularServices')}</h2>
              <p className="section-subtitle mb-0">{t('popularServicesSubtitle')}</p>
            </div>
            <div className="trending-controls" aria-label="Popular services navigation">
              <button
                type="button"
                className="trending-nav-btn"
                aria-label="Previous services"
                onClick={() => scrollServicesBy(-1)}
              >
                <span aria-hidden="true">&#8249;</span>
              </button>
              <button
                type="button"
                className="trending-nav-btn"
                aria-label="Next services"
                onClick={() => scrollServicesBy(1)}
              >
                <span aria-hidden="true">&#8250;</span>
              </button>
            </div>
          </div>
          <div className="services-scroll" ref={servicesScrollRef} tabIndex={0} aria-label="Popular service categories">
            {trendingServices.map((service) => (
              <button
                key={service.name}
                type="button"
                className="service-card"
                onClick={() => openCategory(service.categoryKey)}
                aria-label={t('browseProvidersForService', { service: service.name })}
              >
                <img src={service.image} alt={`${service.name} service category`} className="service-image non-draggable-image" draggable="false" loading="lazy" />
                <div className="service-overlay">
                  <h3 className="service-name">{service.name}</h3>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section py-5">
        <div className="container">
          <div className="cta-box cta-box-compact">
            <div className="cta-copy">
              <h2 className="cta-title mb-2">{t('homeCtaTitle')}</h2>
              <p className="cta-text mb-0">Create an account and connect with trusted local service providers in Toledo City.</p>
            </div>
            <button className="btn btn-primary cta-btn" onClick={() => navigate('/register')}>
              {t('homeCtaButton')}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export default Home;