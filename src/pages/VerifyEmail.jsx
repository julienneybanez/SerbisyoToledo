import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verificationAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function VerifyEmail() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('error');
      setMessage(t('noVerificationToken'));
      return;
    }

    const verify = async () => {
      try {
        const response = await verificationAPI.verifyEmail(token);
        setStatus('success');
        setMessage(response.message);
      } catch (err) {
        if (err.message?.includes('expired')) {
          setStatus('expired');
        } else {
          setStatus('error');
        }
        setMessage(err.message || t('verificationFailed'));
      }
    };

    verify();
  }, [searchParams, t]);

  const stateContent = {
    verifying: {
      title: t('verifyingEmail'),
      description: t('verifyEmailPleaseWait'),
      icon: 'spinner',
    },
    success: {
      title: t('emailVerified'),
      description: message,
      icon: 'bi-check-lg',
      actionTo: '/login',
      actionLabel: t('goToLogin'),
    },
    error: {
      title: t('verificationFailedTitle'),
      description: message,
      icon: 'bi-x-lg',
      actionTo: '/register',
      actionLabel: t('backToRegister'),
    },
    expired: {
      title: t('tokenExpired'),
      description: message,
      icon: 'bi-clock-history',
      actionTo: '/login',
      actionLabel: t('goToLogin'),
    },
  };

  const current = stateContent[status];

  return (
    <section className="auth-page auth-page-compact" aria-labelledby="verify-email-title">
      <div className="auth-card auth-compact-card auth-verification-card">
        <div className={`verification-status-icon verification-${status}`} aria-hidden="true">
          {current.icon === 'spinner' ? (
            <span className="spinner-border" role="status">
              <span className="visually-hidden">{t('loading')}</span>
            </span>
          ) : (
            <i className={`bi ${current.icon}`}></i>
          )}
        </div>

        <div className="auth-heading auth-heading-centered">
          <h1 id="verify-email-title">{current.title}</h1>
          <p>{current.description}</p>
        </div>

        {current.actionTo && (
          <Link to={current.actionTo} className="btn btn-primary auth-submit auth-verification-action">
            {current.actionLabel}
          </Link>
        )}
      </div>
    </section>
  );
}
