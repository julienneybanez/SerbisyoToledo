import { Link } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useLanguage } from '../../context/LanguageContext';

function Footer({ className = '' }) {
  const { language, t } = useLanguage();

  return (
    <footer className={`footer ${className}`.trim()}>
      <div className="footer-grid">
        <div className="footer-brand-block">
          <Link to="/" className="footer-brand-link" aria-label="SerbisyoToledo">
            <img
              src={logo}
              alt={t('footerLogoAlt')}
              width="38"
              height="38"
              className="footer-logo-static"
              draggable="false"
            />
            <span className="footer-wordmark">
              <span className="footer-wordmark-serbisyo">Serbisyo</span>
              <span className="footer-wordmark-toledo">Toledo</span>
            </span>
          </Link>

          <p className="footer-description">{t('footerTagline')}</p>

          <div className="footer-brand-meta" aria-label={t('contactInformationAria')}>
            <a href="mailto:toledoserbisyo@gmail.com">toledoserbisyo@gmail.com</a>
            <span>Toledo City, Cebu</span>
            <span>{t('footerOfflinePayments')}</span>
          </div>
        </div>

        <div className="footer-links-block">
          <h4 className="footer-heading">{t('footerQuickLinks')}</h4>
          <Link to="/feed" className="footer-link">{t('browseServices')}</Link>
          <Link to="/about" className="footer-link">{t('about')}</Link>
        </div>

        <div className="footer-links-block">
          <h4 className="footer-heading">{language === 'ceb' ? 'Impormasyon' : 'Information'}</h4>
          <Link to="/terms" className="footer-link">{t('termsOfService')}</Link>
          <Link to="/privacy" className="footer-link">{t('privacyPolicy')}</Link>
        </div>

        <div className="footer-links-block">
          <h4 className="footer-heading">{t('account')}</h4>
          <Link to="/login" className="footer-link">{t('logIn')}</Link>
          <Link to="/register" className="footer-link">{t('signUp')}</Link>
          <Link to="/register" className="footer-link">{t('footerBecomeProvider')}</Link>
        </div>
      </div>

      <div className="footer-bottom-row">
        <p>© 2026 SerbisyoToledo. {t('footerCopyright')}</p>
      </div>
    </footer>
  );
}

export default Footer;
