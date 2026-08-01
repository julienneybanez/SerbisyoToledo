import logo from '../../assets/logo.png';
import { useLanguage } from '../../context/LanguageContext';

function Footer({ className = '' }) {
  const { t } = useLanguage();

  return (
    <footer className={`footer py-4 ${className}`.trim()}>
      <div className="container">
        <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center">
            <img src={logo} alt="SerbisyoToledo Logo" width="36" height="36" className="me-2" />
            <span className="text-white fw-bold">SerbisyoToledo</span>
          </div>

          <p className="footer-muted-text small mb-0">© 2026 SerbisyoToledo. {t('footerCopyright')}</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;