import logo from '../../assets/logo.png';
import './InitialLoadingScreen.css';
import { useLanguage } from '../../context/LanguageContext';

export default function InitialLoadingScreen() {
  const { t } = useLanguage();

  return (
    <div
      className="initial-loading-screen"
      role="status"
      aria-live="polite"
      aria-label={t('initialLoadingAria')}
    >
      <div className="initial-loading-content">
        <div className="initial-loading-brand" aria-hidden="true">
          <img
            src={logo}
            alt=""
            className="initial-loading-logo non-draggable-image"
            draggable="false"
          />
          <div className="initial-loading-copy">
            <div className="initial-loading-name">
              Serbisyo<span>Toledo</span>
            </div>
            <p className="initial-loading-tagline">{t('initialLoadingTagline')}</p>
          </div>
        </div>

        <div className="initial-loading-track" aria-hidden="true">
          <span className="initial-loading-bar" />
        </div>

        <span className="initial-loading-sr-only">{t('initialLoadingAria')}</span>
      </div>
    </div>
  );
}
