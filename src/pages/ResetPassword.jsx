import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.resetPassword(token, {
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      setSuccess(response.message || t('passwordResetSuccessRedirecting'));
      setFormData({ password: '', confirmPassword: '' });

      setTimeout(() => {
        navigate('/login');
      }, 1800);
    } catch (err) {
      setError(err.message || t('resetPasswordFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="auth-page auth-page-compact" aria-labelledby="reset-password-title">
      <div className="auth-card auth-compact-card">
        <div className="auth-heading">
          <p className="auth-eyebrow auth-brand-wordmark">Serbisyo<span className="brand-toledo">Toledo</span></p>
          <h1 id="reset-password-title">{t('resetPassword')}</h1>
          <p>{t('resetYourPassword')}</p>
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
            <label htmlFor="reset-password" className="form-label">{t('newPassword')}</label>
            <div className="password-input-wrapper">
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="form-control"
                placeholder={t('enterNewPassword')}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <button
                type="button"
                className="password-toggle password-toggle-text"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={t('togglePasswordVisibility')}
              >
                {showPassword ? t('hide') : t('show')}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="reset-confirm-password" className="form-label">{t('confirmNewPassword')}</label>
            <div className="password-input-wrapper">
              <input
                id="reset-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="form-control"
                placeholder={t('confirmNewPassword')}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <button
                type="button"
                className="password-toggle password-toggle-text"
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                aria-label={t('toggleConfirmPasswordVisibility')}
              >
                {showConfirmPassword ? t('hide') : t('show')}
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
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                {t('updatingPassword')}
              </>
            ) : (
              t('resetPassword')
            )}
          </button>
        </form>

        <p className="auth-switch-copy">
          {t('backTo')}{' '}
          <Link to="/login">{t('logIn')}</Link>
        </p>
      </div>
    </section>
  );
};

export default ResetPassword;
