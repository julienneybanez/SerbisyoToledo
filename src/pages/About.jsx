import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import Reveal from '../components/common/Reveal';

const ABOUT_FEATURES = [
  {
    icon: 'bi-search',
    title: 'Find local services',
    description: 'Browse providers by service category and quickly narrow down the options that fit your needs.',
  },
  {
    icon: 'bi-person-badge',
    title: 'Compare provider details',
    description: 'Review service information, rates, availability, location, previous work, and client feedback before choosing.',
  },
  {
    icon: 'bi-calendar2-check',
    title: 'Book with a clearer process',
    description: 'Send booking requests using provider availability and keep track of request progress in one place.',
  },
];

const About = () => {
  return (
    <div className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <div className="container">
          <div className="about-hero-grid">
            <Reveal className="about-hero-copy" delay={40}>
              <span className="about-kicker">LOCAL SERVICES IN TOLEDO CITY</span>
              <h1 id="about-title">About SerbisyoToledo</h1>
              <p>
                SerbisyoToledo brings local clients and service providers into one practical platform,
                making it easier to discover services, compare providers, and manage booking requests.
              </p>
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
              <span className="about-kicker">OUR PURPOSE</span>
              <h2 id="about-mission-title">Making local service connections simpler.</h2>
            </Reveal>

            <Reveal className="about-mission-copy" delay={100}>
              <p>
                Our mission is to help Toledo City residents find reliable local service providers
                while giving providers a clear place to present their skills, previous work,
                availability, and service rates.
              </p>
              <p>
                The platform is designed around a straightforward flow so clients can make informed
                choices and providers can manage requests without unnecessary complexity.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="about-help-section" aria-labelledby="about-help-title">
        <div className="container">
          <Reveal className="about-section-heading about-help-heading">
            <span className="about-kicker">HOW IT HELPS</span>
            <h2 id="about-help-title">Useful information before you book.</h2>
          </Reveal>

          <div className="about-feature-grid">
            {ABOUT_FEATURES.map((feature, index) => (
              <Reveal
                className="about-feature-card"
                delay={index * 80}
                key={feature.title}
              >
                <span className="about-feature-icon" aria-hidden="true">
                  <i className={`bi ${feature.icon}`} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="about-local-section" aria-labelledby="about-local-title">
        <div className="container">
          <Reveal className="about-local-panel">
            <div className="about-local-copy">
              <span className="about-kicker">BUILT FOR THE COMMUNITY</span>
              <h2 id="about-local-title">Focused on Toledo City.</h2>
              <p>
                SerbisyoToledo is centered on local service discovery and booking for homes and
                communities in Toledo City, Cebu.
              </p>
            </div>

            <div className="about-contact">
              <span className="about-contact-label">Contact</span>
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
              <h2>Ready to find a local service?</h2>
              <p>Browse available providers and compare the details that matter to you.</p>
            </div>
            <Link to="/feed" className="btn btn-primary about-cta-button">
              Browse Services
              <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default About;
