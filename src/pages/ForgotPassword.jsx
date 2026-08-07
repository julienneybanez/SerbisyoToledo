import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import logo from '../assets/logo.png';
import '../styles/App.css';

const ForgotPassword = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await authAPI.forgotPassword({ email });
      setSuccess(response.message || t('forgotPasswordSuccess'));
      setEmail('');
    } catch (err) {
      setError(err.message || t('forgotPasswordFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="gradient-container">
      <div className="container d-flex justify-content-center align-items-center min-vh-100 py-5">
        <div className="card content-card shadow-lg">
          <div className="card-body p-4 p-md-5">
            <div className="text-center mb-4">
              <img src={logo} alt="SerbisyoToledo" className="logo-img" />
              <h1 className="app-title mb-2">
                Serbisyo<span className="title-green">Toledo</span>
              </h1>
              <p className="subtitle text-muted">{t('forgotPasswordSubtitle')}</p>
            </div>

            {error && (
              <div className="alert alert-danger py-2 mb-3" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="alert alert-success py-2 mb-3" role="alert">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">{t('registeredEmailAddress')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-control"
                  placeholder={t('registeredEmailPlaceholder')}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 mb-3"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    {t('sendingLink')}
                  </>
                ) : (
                  t('sendResetLink')
                )}
              </button>
            </form>

            <div className="text-center">
              <p className="footer-text mb-0">
              {t('rememberedPassword')}{' '}
              <Link to="/login" className="link">{t('backToLogin')}</Link>
              </p>
            </div>

            <div className="text-center mt-4">
              <Link to="/" className="back-link text-decoration-none">
                {t('backToHome')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
