import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import caregiver from '../assets/caregiver.jpg';
import logo from '../assets/logo.png';

const Login = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [loginAs, setLoginAs] = useState('client');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
    setIsLoading(true);

    try {
      const response = await authAPI.login({
        email: formData.email,
        password: formData.password,
        loginAs,
      });

      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath);
        return;
      }

      const userType = response.data.user.userType;
      if (userType === 'admin') {
        navigate('/admin/dashboard');
      } else if (userType === 'tradesperson') {
        navigate('/dashboard');
      } else {
        navigate('/feed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || t('loginFailedCheckCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  const loginRoles = [
    { value: 'client', label: t('client'), description: t('loginClientDesc') },
    { value: 'tradesperson', label: t('serviceProvider'), description: t('loginProviderDesc') },
    { value: 'admin', label: t('admin'), description: t('loginAdminDesc') },
  ];

  return (
    <section className="auth-page auth-page-login" aria-labelledby="login-title">
      <div className="auth-split-card">
        <div className="auth-form-pane">
          <div className="auth-heading">
            <img
              src={logo}
              alt="SerbisyoToledo logo"
              className="auth-page-logo non-draggable-image"
              draggable="false"
            />
            <p className="auth-eyebrow">SerbisyoToledo</p>
            <h1 id="login-title">{t('logIn')}</h1>
            <p>{t('loginSubtitle')}</p>
          </div>

          {error && (
            <div className="alert alert-danger auth-alert" role="alert">
              {error}
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

            <fieldset className="login-role-fieldset">
              <legend>{t('loginAs')}</legend>
              <div className="login-role-list">
                {loginRoles.map((role) => (
                  <label
                    key={role.value}
                    className={`login-role-option ${loginAs === role.value ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="loginAs"
                      value={role.value}
                      checked={loginAs === role.value}
                      onChange={(event) => setLoginAs(event.target.value)}
                    />
                    <span>
                      <strong>{role.label}</strong>
                      <small>{role.description}</small>
                    </span>
                    <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
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

        <aside className="auth-visual-pane" aria-label="SerbisyoToledo local services">
          <img
            src={caregiver}
            alt="Local caregiver providing a home service"
            className="auth-visual-image non-draggable-image"
            draggable="false"
          />
          <div className="auth-visual-overlay">
            <p>{t('homeHeroSubtitle')}</p>
            <span>{t('footerTagline')}</span>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default Login;
