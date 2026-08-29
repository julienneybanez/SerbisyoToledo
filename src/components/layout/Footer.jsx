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
              <img src={logo} alt={t('footerLogoAlt')} width="40" height="40" className="me-2 footer-logo-static" draggable="false" />
              <span className="footer-wordmark">Serbisyo<span>Toledo</span></span>
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
            <div className="footer-contact-list" aria-label={t('contactInformationAria')}>
              <a className="footer-link footer-contact-link" href="mailto:toledoserbisyo@gmail.com">toledoserbisyo@gmail.com</a>
              <p className="footer-muted-text footer-contact-line">Toledo City, Cebu</p>
              <p className="footer-muted-text footer-contact-line">{t('footerOfflinePayments')}</p>
            </div>
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