import logo from '../assets/logo.png';

const About = () => {
  return (
    <div className="gradient-container">
      <div className="container d-flex justify-content-center align-items-center min-vh-100 py-5">
        <div className="card content-card shadow-lg">
          <div className="card-body p-4 p-md-5">
            {/* Logo and Header */}
            <div className="text-center mb-4">
              <img src={logo} alt="SerbisyoToledo" className="logo-img" />
              <h1 className="app-title mb-2">
                Serbisyo<span className="title-green">Toledo</span>
              </h1>
              <p className="subtitle text-muted">About our platform</p>
            </div>

            {/* About Content */}
            <div className="about-content">
              {/* Mission Section */}
              <div className="about-section mb-4">
                <h2 className="section-title h5 fw-bold mb-3">Our Mission</h2>
                <p className="section-text text-secondary">
                  SerbisyoToledo connects service providers with clients in Toledo City, 
                  making it easier to find trusted professionals for all your needs.
                </p>
              </div>

              {/* Contact Section */}
              <div className="about-section mb-4">
                <h2 className="section-title h5 fw-bold mb-3">Contact Us</h2>
                <p className="section-text text-secondary">
                  Have questions? Reach out to us at{' '}
                  <a href="mailto:toledoserbisyo@gmail.com" className="link text-decoration-none">
                    toledoserbisyo@gmail.com
                  </a>
                </p>
              </div>
            </div>

            {/* Footer Links */}
            <div className="text-center mt-4">
              <a href="/" className="back-link text-decoration-none text-secondary">
                ← Back to home
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;