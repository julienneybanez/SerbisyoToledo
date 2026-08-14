import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const ForgotPassword = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
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
    <section className="auth-page auth-page-compact" aria-labelledby="forgot-password-title">
      <div className="auth-card auth-compact-card">
        <div className="auth-heading">
          <p className="auth-eyebrow">SerbisyoToledo</p>
          <h1 id="forgot-password-title">{t('forgotPasswordQuestion')}</h1>
          <p>{t('forgotPasswordSubtitle')}</p>
        </div>

        {error && (
          <div className="alert alert-danger auth-alert" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success auth-alert" role="status">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="forgot-email" className="form-label">{t('registeredEmailAddress')}</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="form-control"
              placeholder={t('registeredEmailPlaceholder')}
              autoComplete="email"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                {t('sendingLink')}
              </>
            ) : (
              t('sendResetLink')
            )}
          </button>
        </form>

        <p className="auth-switch-copy">
          {t('rememberedPassword')}{' '}
          <Link to="/login">{t('backToLogin')}</Link>
        </p>
      </div>
    </section>
  );
};

export default ForgotPassword;
