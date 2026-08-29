import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI, verificationAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import loginServiceImage from '../assets/man-installs-heating-system-house-checks-pipes-with-wrench.jpg';
import logo from '../assets/logo.png';

const DEFAULT_ROUTE_BY_ROLE = {
  admin: '/admin/dashboard',
  tradesperson: '/dashboard',
  client: '/client-dashboard',
};

const isRoleSafeRedirect = (userType, redirectPath) => {
  if (!redirectPath || !redirectPath.startsWith('/')) return false;

  const pathname = redirectPath.split('?')[0];
  const isProviderProfile = /^\/provider\/[^/]+\/?$/.test(pathname);

  if (userType === 'admin') {
    return pathname === '/admin' || pathname.startsWith('/admin/');
  }

  if (userType === 'tradesperson') {
    return [
      '/dashboard',
      '/requests',
      '/notifications',
      '/provider-settings',
      '/provider-schedule',
      '/provider-availability',
      '/provider-credentials',
    ].includes(pathname) || isProviderProfile;
  }

  if (userType === 'client') {
    return [
      '/client-dashboard',
      '/feed',
      '/requests',
      '/notifications',
      '/client-settings',
    ].includes(pathname) || isProviderProfile;
  }

  return false;
};

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language } = useLanguage();
  const loginHeading = language === 'en' ? 'Welcome back' : t('logIn');
  const loginSubtitle = language === 'en' ? 'Log in to your account' : t('loginSubtitle');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationNotice, setVerificationNotice] = useState(() => (
    searchParams.get('verification') === 'pending'
      ? (searchParams.get('sent') === '0'
        ? t('emailVerificationCreatedSendFailed')
        : t('emailVerificationCreatedPending'))
      : ''
  ));
  const [verificationEmail, setVerificationEmail] = useState(() => searchParams.get('email') || '');
  const [resendingVerification, setResendingVerification] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setVerificationNotice('');
    setIsLoading(true);

    try {
      const response = await authAPI.login({
        email: formData.email,
        password: formData.password,
      });

      const userType = response.data.user.userType;
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      sessionStorage.removeItem('redirectAfterLogin');

      if (isRoleSafeRedirect(userType, redirectPath)) {
        navigate(redirectPath, { replace: true });
        return;
      }

      navigate(DEFAULT_ROUTE_BY_ROLE[userType] || '/', { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      if (err?.code === 'EMAIL_NOT_VERIFIED') {
        setVerificationEmail(formData.email);
        setVerificationNotice(t('emailVerificationRequiredLogin'));
        setError('');
      } else {
        setError(err.message || t('loginFailedCheckCredentials'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="auth-page auth-page-login" aria-labelledby="login-title">
      <div className="auth-split-card">
        <div className="auth-form-pane">
          <div className="auth-heading">
            <img
              src={logo}
              alt="SerbisyoToledo logo"
              width="84"
              height="84"
              className="auth-page-logo non-draggable-image"
              draggable="false"
            />
            <p className="auth-eyebrow auth-brand-wordmark">Serbisyo<span className="brand-toledo">Toledo</span></p>
            <h1 id="login-title">{loginHeading}</h1>
            <p>{loginSubtitle}</p>
          </div>

          {error && (
            <div className="alert alert-danger auth-alert" role="alert">
              {error}
            </div>
          )}

          {verificationNotice && (
            <div className="alert alert-info auth-alert auth-verification-notice" role="status">
              <p className="mb-2">{verificationNotice}</p>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                disabled={resendingVerification || !verificationEmail}
                onClick={async () => {
                  setResendingVerification(true);
                  setError('');
                  try {
                    const response = await verificationAPI.resendVerification({ email: verificationEmail });
                    setVerificationNotice(t('emailVerificationSent'));
                  } catch (err) {
                    setError(t('emailVerificationResendFailed'));
                  } finally {
                    setResendingVerification(false);
                  }
                }}
              >
                {resendingVerification ? t('sending') : t('resendVerificationEmail')}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="login-email" className="form-label">{t('emailAddress')}</label>
              <input
                id="login-email"
                type="email"
                name="email"
                placeholder={t('loginEmailPlaceholder')}
                value={formData.email}
                onChange={handleInputChange}
                className="form-control"
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="login-password" className="form-label">{t('password')}</label>
                <Link to="/forgot-password" className="auth-inline-link">
                  {t('forgotPasswordQuestion')}
                </Link>
              </div>
              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder={t('password')}
                  value={formData.password}
                  onChange={handleInputChange}
                  className="form-control"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={t('togglePasswordVisibility')}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true"></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  {t('loggingIn')}
                </>
              ) : (
                t('logIn')
              )}
            </button>

            <p className="auth-switch-copy">
              {t('dontHaveAccount')}{' '}
              <Link to="/register">{t('registerHere')}</Link>
            </p>
          </form>
        </div>

        <aside className="auth-visual-pane" aria-label={t('localServicesVisualAria')}>
          <img
            src={loginServiceImage}
            alt={t('loginVisualAlt')}
            className="auth-visual-image auth-login-visual-image non-draggable-image"
            draggable="false"
          />
        </aside>
      </div>
    </section>
  );
};

export default Login;
