import logo from '../assets/logo.png';

const About = () => {
  return (
    <div className="about-page-shell">
      <div className="about-page-container">
        <header className="about-hero">
          <div className="about-brand-row">
            <img src={logo} alt="SerbisyoToledo" className="about-logo non-draggable-image" draggable="false" />
            <h1>About SerbisyoToledo</h1>
          </div>
          <p>
            Connecting Toledo City residents with trusted local service providers.
          </p>
        </header>

        <section className="about-section-block">
          <h2>Our Mission</h2>
          <p>
            SerbisyoToledo helps local clients discover reliable service providers while giving providers a clear platform to present their skills, schedule, and rates.
          </p>
        </section>

        <section className="about-section-block">
          <h2>How SerbisyoToledo Helps</h2>
          <ul>
            <li>Browse verified providers by service category.</li>
            <li>Compare ratings, location, and pricing at a glance.</li>
            <li>Send booking requests and track progress in one place.</li>
          </ul>
        </section>

        <section className="about-section-block">
          <h2>Contact Us</h2>
          <p>
            Email: <a href="mailto:toledoserbisyo@gmail.com" className="about-inline-link">toledoserbisyo@gmail.com</a>
          </p>
          <p>Location: Toledo City, Cebu</p>
        </section>

        <div className="about-back-row">
          <a href="/" className="about-back-link">← Back to home</a>
        </div>
      </div>
    </div>
  );
};

export default About;