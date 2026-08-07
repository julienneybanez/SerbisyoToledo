import logo from '../../assets/logo.png';
import { useLanguage } from '../../context/LanguageContext';

function Footer({ className = '' }) {
  const { t } = useLanguage();

  return (
    <footer className={`footer py-4 ${className}`.trim()}>
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand-block">
            <div className="d-flex align-items-center mb-2">
              <img src={logo} alt="SerbisyoToledo Logo" width="40" height="40" className="me-2 footer-logo-static" draggable="false" />
              <span className="text-white fw-bold fs-5">SerbisyoToledo</span>
            </div>
            <p className="footer-muted-text footer-description mb-0">{t('footerTagline')}</p>
          </div>

          <div className="footer-links-block">
            <h6 className="footer-heading">{t('footerQuickLinks')}</h6>
            <a href="/feed" className="footer-link">{t('browseServices')}</a>
            <a href="/about" className="footer-link">{t('about')}</a>
            <a href="/register" className="footer-link">{t('footerBecomeProvider')}</a>
          </div>

          <div className="footer-links-block">
            <h6 className="footer-heading">{t('footerContact')}</h6>
            <span className="footer-muted-text">toledoserbisyo@gmail.com</span>
            <span className="footer-muted-text">Toledo City, Cebu</span>
            <span className="footer-muted-text">{t('footerOfflinePayments')}</span>
          </div>
        </div>

        <div className="footer-bottom-row">
          <p className="footer-muted-text small mb-0">© 2026 SerbisyoToledo. {t('footerCopyright')}</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;