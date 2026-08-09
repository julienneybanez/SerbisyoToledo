import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verificationAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function VerifyEmail() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying, success, error, expired
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

  return (
    <div className="gradient-container">
      <div className="container d-flex justify-content-center align-items-center min-vh-100 py-5">
        <div className="card content-card shadow-lg" style={{ maxWidth: '500px', width: '100%' }}>
          <div className="card-body p-4 p-md-5 text-center">
            {status === 'verifying' && (
              <>
                <div className="spinner-border text-primary mb-4" role="status" style={{ width: '3rem', height: '3rem' }}>
                  <span className="visually-hidden">{t('loading')}</span>
                </div>
                <h2 className="mb-3" style={{ fontWeight: 700 }}>{t('verifyingEmail')}</h2>
                <p className="text-muted">{t('verifyEmailPleaseWait')}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="mb-4">
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'var(--brand-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto'
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>
                <h2 className="mb-3" style={{ fontWeight: 700, color: 'var(--brand-accent-dark)' }}>{t('emailVerified')}</h2>
                <p className="text-muted mb-4">{message}</p>
                <Link to="/login" className="btn btn-primary px-5 py-2" style={{ borderRadius: '10px', fontWeight: 600 }}>
                  {t('goToLogin')}
                </Link>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="mb-4">
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: '#dc3545',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto'
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                </div>
                <h2 className="mb-3" style={{ fontWeight: 700, color: '#dc3545' }}>{t('verificationFailedTitle')}</h2>
                <p className="text-muted mb-4">{message}</p>
                <Link to="/register" className="btn btn-primary px-5 py-2" style={{ borderRadius: '10px', fontWeight: 600 }}>
                  {t('backToRegister')}
                </Link>
              </>
            )}

            {status === 'expired' && (
              <>
                <div className="mb-4">
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: '#e0a800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto'
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                </div>
                <h2 className="mb-3" style={{ fontWeight: 700, color: '#e0a800' }}>{t('tokenExpired')}</h2>
                <p className="text-muted mb-4">{message}</p>
                <Link to="/login" className="btn btn-primary px-5 py-2" style={{ borderRadius: '10px', fontWeight: 600 }}>
                  {t('goToLogin')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
