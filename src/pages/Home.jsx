import carpenter from '../assets/carpenter.jpg';
import masseuse from '../assets/masseuse.jpg';
import caregiver from '../assets/caregiver.jpg';
import mechanic from '../assets/mechanic.jpg';
import plumber from '../assets/plumber.jpg';
import priest from '../assets/priest.png';
import manghihilot from '../assets/manghihilot.jpg';
import electrician from '../assets/electrician.png';
import panday from '../assets/panday.png';
import tubo from '../assets/tubo.png';
import cleaning from '../assets/cleaning.jpg';
import gardening from '../assets/gardening.jpg';
import locksmith from '../assets/locksmith.jpg';
import laundry from '../assets/laundry.webp';
import { useNavigate } from 'react-router-dom';
import LandingSearch from '../components/common/LandingSearch';
import HowItWorks from '../components/common/HowItWorks';

function Home() {
  const navigate = useNavigate();

  const trendingServices = [
    { name: 'Manghihilot', image: manghihilot, category: 'Beauty' },
    { name: 'Electrician', image: electrician, category: 'Electrical' },
    { name: 'Panday', image: panday, category: 'Carpentry' },
    { name: 'Tubo', image: tubo, category: 'Plumbing' },
    { name: 'Cleaning', image: cleaning, category: 'Cleaning' },
    { name: 'Gardening', image: gardening, category: 'Gardening' },
    { name: 'Locksmith', image: locksmith, category: 'Repair' },
    { name: 'Laundry', image: laundry, category: 'Others' },
  ];

  const openCategory = (category) => {
    navigate(`/feed?category=${encodeURIComponent(category)}`);
  };

  return (
    <>
      <section className="hero-section">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-5">
              <div className="hero-content-stack">
                <h1 className="hero-title">What service do you need?</h1>
                <p className="hero-subtitle">
                  Find trusted local service providers in Toledo City.
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
                    <img src={priest} alt="Local community ceremonial service" className="img-fluid rounded non-draggable-image" draggable="false" />
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
                <h3 className="feature-title">Skilled Professionals</h3>
                <p className="feature-text">Connect with a vast selection of verified and experienced local service providers in Toledo City.</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect width="40" height="40" rx="8" fill="#4A9FF5"/>
                    <path d="M20 10L22.5 17.5H30L24 22L26.5 30L20 25L13.5 30L16 22L10 17.5H17.5L20 10Z" fill="white"/>
                  </svg>
                </div>
                <h3 className="feature-title">Build Trust</h3>
                <p className="feature-text">View ratings, past accomplished jobs, and profiles to find the right service provider for you.</p>
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
                <h3 className="feature-title">Quick Response</h3>
                <p className="feature-text">Track your requests and connect with verified service providers fast and easily using the service requests tab.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <HowItWorks />

      <section className="trending-section py-5">
        <div className="container">
          <div className="text-center mb-4">
            <h2 className="section-title">Popular Services</h2>
            <p className="section-subtitle">Choose a category to start browsing providers.</p>
          </div>
          <div className="services-scroll">
            {trendingServices.map((service) => (
              <button
                key={service.name}
                type="button"
                className="service-card"
                onClick={() => openCategory(service.category)}
                aria-label={`Browse ${service.name} providers`}
              >
                <img src={service.image} alt={`${service.name} service category`} className="service-image non-draggable-image" draggable="false" />
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
          <div className="cta-box text-center">
            <h2 className="cta-title">Need help today?</h2>
            <button className="btn btn-primary btn-lg mt-3" onClick={() => navigate('/register')}>Join Serbisyo Toledo</button>
          </div>
        </div>
      </section>
    </>
  );
}

export default Home;