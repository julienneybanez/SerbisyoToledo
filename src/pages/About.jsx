const About = () => {
  return (
    <div className="gradient-container">
      <div className="container d-flex justify-content-center align-items-center min-vh-100 py-5">
        <div className="card content-card shadow-lg">
          <div className="card-body p-4 p-md-5">
            {/* Logo and Header */}
            <div className="text-center mb-4">
              <div className="logo-circle mx-auto mb-3">
                <svg 
                  width="32" 
                  height="32" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="white" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
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
                  <a href="mailto:support@serbisyotoledo.com" className="link text-decoration-none">
                    support@serbisyotoledo.com
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