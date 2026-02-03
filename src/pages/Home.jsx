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

function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-5">
              <h1 className="hero-title">Quick and Easy Connection to Local Services</h1>
              <div className="search-box-home mt-4">
                <input type="text" placeholder="Browse local services" />
                <span className="search-divider"></span>
                <button className="btn-search-home">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="col-lg-7">
              <div className="image-grid">
                <div className="row g-2">
                  <div className="col-6">
                    <img src={carpenter} alt="Service 1" className="img-fluid rounded" />
                  </div>
                  <div className="col-6">
                    <img src={masseuse} alt="Service 2" className="img-fluid rounded" />
                  </div>
                  <div className="col-6">
                    <img src={caregiver} alt="Service 3" className="img-fluid rounded" />
                  </div>
                  <div className="col-6">
                    <img src={mechanic} alt="Service 4" className="img-fluid rounded" />
                  </div>
                  <div className="col-6">
                    <img src={plumber} alt="Service 5" className="img-fluid rounded" />
                  </div>
                  <div className="col-6">
                    <img src={priest} alt="Service 6" className="img-fluid rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
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

      {/* Trending Services */}
      <section className="trending-section py-5">
        <div className="container">
          <div className="text-center mb-4">
            <h2 className="section-title">Trending Services</h2>
            <p className="section-subtitle">Over 50 active services</p>
          </div>
          <div className="services-scroll">
            <div className="service-card">
              <img src={manghihilot} alt="Manghihilot" className="service-image" />
              <div className="service-overlay">
                <h3 className="service-name">Manghihilot</h3>
              </div>
            </div>
            <div className="service-card">
              <img src={electrician} alt="Electrician" className="service-image" />
              <div className="service-overlay">
                <h3 className="service-name">Electrician</h3>
              </div>
            </div>
            <div className="service-card">
              <img src={panday} alt="Panday" className="service-image" />
              <div className="service-overlay">
                <h3 className="service-name">Panday</h3>
              </div>
            </div>
            <div className="service-card">
              <img src={tubo} alt="Tubo" className="service-image" />
              <div className="service-overlay">
                <h3 className="service-name">Tubo</h3>
              </div>
            </div>
            <div className="service-card">
              <img src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=500" alt="Cleaning" className="service-image" />
              <div className="service-overlay">
                <h3 className="service-name">Cleaning</h3>
              </div>
            </div>
            <div className="service-card">
              <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500" alt="Gardening" className="service-image" />
              <div className="service-overlay">
                <h3 className="service-name">Gardening</h3>
              </div>
            </div>
            <div className="service-card">
              <img src="https://images.unsplash.com/photo-1581092918484-f0b1285e2a69?w=500" alt="Locksmith" className="service-image" />
              <div className="service-overlay">
                <h3 className="service-name">Locksmith</h3>
              </div>
            </div>
            <div className="service-card">
              <img src="https://images.unsplash.com/photo-1621905250918-48416bd8575a?w=500" alt="Laundry" className="service-image" />
              <div className="service-overlay">
                <h3 className="service-name">Laundry</h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section py-5">
        <div className="container">
          <div className="cta-box text-center">
            <h2 className="cta-title">Connect with local service providers with just a few clicks</h2>
            <button className="btn btn-primary btn-lg mt-3">Join Serbisyo Toledo</button>
          </div>
        </div>
      </section>
    </>
  );
}

export default Home;