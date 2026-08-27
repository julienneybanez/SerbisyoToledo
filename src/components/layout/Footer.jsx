import logo from '../../assets/logo.png';

function Footer({ className = '' }) {
  return (
    <footer className={`footer ${className}`.trim()}>
      <div className="container">
        <div className="footer-simple">
          <div className="footer-brand">
            <div className="footer-brand-line">
              <img
                src={logo}
                alt="SerbisyoToledo Logo"
                width="44"
                height="44"
                className="footer-logo-static"
                draggable="false"
              />
              <span className="footer-wordmark">
                Serbisyo<span>Toledo</span>
              </span>
            </div>
            <p className="footer-tagline">
              Trusted local services for homes and communities in Toledo City.
            </p>
          </div>

          <p className="footer-copyright">
            © 2026 SerbisyoToledo. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
