import { Link, Outlet, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useLanguage } from '../../context/LanguageContext';

export default function AuthLayout() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const useMinimalHeader = pathname === '/login' || pathname === '/register';

  return (
    <div className="auth-layout">
      <header className={`auth-layout-header ${useMinimalHeader ? 'auth-layout-header-minimal' : ''}`}>
        {!useMinimalHeader && (
          <Link to="/" className="auth-layout-brand" aria-label="SerbisyoToledo home">
            <img
              src={logo}
              alt=""
              className="auth-layout-logo non-draggable-image"
              draggable="false"
            />
            <span className="auth-layout-brand-name">
              Serbisyo<span>Toledo</span>
            </span>
          </Link>
        )}

        <Link to="/" className="auth-layout-back">
          <i className="bi bi-arrow-left" aria-hidden="true"></i>
          <span>{t('backToHome').replace(/^←\s*/, '')}</span>
        </Link>
      </header>

      <main className="auth-layout-main">
        <Outlet />
      </main>
    </div>
  );
}
