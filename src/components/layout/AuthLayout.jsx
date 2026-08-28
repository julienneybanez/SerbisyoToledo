import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useLanguage } from '../../context/LanguageContext';
import { isAuthenticated } from '../../services/api';

export default function AuthLayout() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
  const useMinimalHeader = pathname === '/login' || pathname === '/register';
  const fromSettings = Boolean(location.state?.fromSettings && isAuthenticated());
  const returnTo = location.state?.returnTo || null;

  const handleContextBack = () => {
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }
    navigate(-1);
  };

  return (
    <div className="auth-layout">
      <header className={`auth-layout-header ${useMinimalHeader ? 'auth-layout-header-minimal' : ''}`}>
        {!useMinimalHeader && (
          fromSettings ? (
            <div className="auth-layout-brand" aria-label="SerbisyoToledo">
              <img
                src={logo}
                alt=""
                className="auth-layout-logo non-draggable-image"
                draggable="false"
              />
              <span className="auth-layout-brand-name">
                Serbisyo<span>Toledo</span>
              </span>
            </div>
          ) : (
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
          )
        )}

        {fromSettings ? (
          <button type="button" className="auth-layout-back" onClick={handleContextBack}>
            <i className="bi bi-arrow-left" aria-hidden="true"></i>
            <span>{t('back')}</span>
          </button>
        ) : (
          <Link to="/" className="auth-layout-back">
            <i className="bi bi-arrow-left" aria-hidden="true"></i>
            <span>{t('backToHome').replace(/^←\s*/, '')}</span>
          </Link>
        )}
      </header>

      <main className="auth-layout-main">
        <Outlet />
      </main>
    </div>
  );
}
