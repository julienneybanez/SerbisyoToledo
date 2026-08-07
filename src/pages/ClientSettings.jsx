import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI, getUser, userProfileAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import ThemeToggle from '../components/common/ThemeToggle';
import SettingsFlash from '../components/settings/SettingsFlash';
import '../styles/UserSettings.css';

function ClientSettings() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const isVerificationResendDisabled = true;

  const [activeSection, setActiveSection] = useState('account');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [flash, setFlash] = useState({ type: 'info', message: '' });

  const [initialProfile, setInitialProfile] = useState(null);
  const [settings, setSettings] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    createdAt: '',
    isVerified: false,
  });

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.userType !== 'client') {
      navigate('/');
      return;
    }

    const loadProfile = async () => {
      setIsLoadingProfile(true);
      setFlash({ type: 'info', message: '' });
      try {
        const response = await userProfileAPI.getProfile();
        if (response.success) {
          const profile = response.data;
          const nextState = {
            fullName: profile.fullName || currentUser.fullName || '',
            email: profile.email || currentUser.email || '',
            phone: profile.phone || '',
            address: profile.address || '',
            bio: profile.bio || '',
            createdAt: profile.createdAt || '',
            isVerified: Boolean(currentUser.isVerified),
          };
          setSettings(nextState);
          setInitialProfile(nextState);
        }
      } catch {
        const fallbackState = {
          fullName: currentUser.fullName || '',
          email: currentUser.email || '',
          phone: currentUser.phone || '',
          address: currentUser.address || '',
          bio: currentUser.bio || '',
          createdAt: '',
          isVerified: Boolean(currentUser.isVerified),
        };
        setSettings(fallbackState);
        setInitialProfile(fallbackState);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, [navigate]);

  useEffect(() => {
    const section = searchParams.get('section');
    const validSections = ['account', 'contact', 'security'];

    if (section && validSections.includes(section)) {
      setActiveSection(section);
    }
  }, [searchParams]);

  const hasProfileChanges = useMemo(() => {
    if (!initialProfile) {
      return false;
    }

    return (
      settings.fullName !== initialProfile.fullName
      || settings.phone !== initialProfile.phone
      || settings.address !== initialProfile.address
      || settings.bio !== initialProfile.bio
    );
  }, [initialProfile, settings.address, settings.bio, settings.fullName, settings.phone]);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!hasProfileChanges) {
      setFlash({ type: 'info', message: t('noChangesToSave') });
      return;
    }

    try {
      setIsSaving(true);
      setFlash({ type: 'info', message: '' });
      const submitData = new FormData();
      submitData.append('fullName', settings.fullName || '');
      submitData.append('phone', settings.phone || '');
      submitData.append('address', settings.address || '');
      submitData.append('bio', settings.bio || '');

      const response = await userProfileAPI.updateProfile(submitData);
      if (response.success) {
        const updated = {
          ...settings,
          fullName: response.data.fullName || settings.fullName,
          phone: response.data.phone || '',
          address: response.data.address || '',
          bio: response.data.bio || '',
        };
        setSettings(updated);
        setInitialProfile(updated);
        setFlash({ type: 'success', message: t('profileSettingsSaved') });
      }
    } catch (err) {
      setFlash({ type: 'error', message: err.message || t('failedSaveProfileSettings') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (initialProfile) {
      setSettings(initialProfile);
      setFlash({ type: 'info', message: t('changesWereReset') });
    }
  };

  const handleResendVerification = async () => {
    if (isVerificationResendDisabled) {
      setFlash({ type: 'info', message: t('resendVerificationDisabled') });
      return;
    }

    if (!settings.email) {
      setFlash({ type: 'error', message: t('noEmailForVerification') });
      return;
    }

    try {
      setIsSendingVerification(true);
      setFlash({ type: 'info', message: '' });
      await authAPI.resendVerification({ email: settings.email });
      setFlash({ type: 'success', message: t('verificationEmailSent') });
    } catch (err) {
      setFlash({ type: 'error', message: err.message || t('failedSendVerificationEmail') });
    } finally {
      setIsSendingVerification(false);
    }
  };

  return (
    <div className="user-settings-container">
      <div className="page-header">
        <h1 className="page-title">{t('clientSettings')}</h1>
        <p className="page-subtitle">{t('clientSettingsSubtitle')}</p>
        <div className="settings-theme-row">
          <span className="settings-theme-label">{t('appearance')}</span>
          <ThemeToggle />
        </div>
      </div>

      <div className="settings-layout">
        <div className="settings-nav">
          <button
            className={`settings-nav-item ${activeSection === 'account' ? 'active' : ''}`}
            onClick={() => setActiveSection('account')}
          >
            {t('account')}
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'contact' ? 'active' : ''}`}
            onClick={() => setActiveSection('contact')}
          >
            {t('contact')}
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'security' ? 'active' : ''}`}
            onClick={() => setActiveSection('security')}
          >
            {t('security')}
          </button>
        </div>

        <div className="settings-content">
          <SettingsFlash type={flash.type} message={flash.message} />

          {activeSection === 'account' && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t('accountDetails')}</h2>

              <div className="settings-group">
                <label className="settings-label" htmlFor="client-full-name">{t('fullName')}</label>
                <input
                  id="client-full-name"
                  type="text"
                  className="settings-input"
                  value={settings.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  autoComplete="name"
                  disabled={isLoadingProfile || isSaving}
                />
              </div>

              <div className="settings-group">
                <label className="settings-label" htmlFor="client-email">{t('emailAddress')}</label>
                <input
                  id="client-email"
                  type="email"
                  className="settings-input"
                  value={settings.email}
                  readOnly
                  autoComplete="email"
                  disabled
                />
                <small className="settings-help">{t('emailChangesNotSupported')}</small>
              </div>

              <div className="settings-group">
                <label className="settings-label" htmlFor="client-bio">{t('bio')}</label>
                <textarea
                  id="client-bio"
                  className="settings-textarea"
                  value={settings.bio}
                  onChange={(e) => handleChange('bio', e.target.value)}
                  rows={4}
                  autoComplete="off"
                  disabled={isLoadingProfile || isSaving}
                />
              </div>

              {!!settings.createdAt && (
                <small className="settings-help">
                  {t('accountCreatedOn', { date: new Date(settings.createdAt).toLocaleDateString() })}
                </small>
              )}
            </div>
          )}

          {activeSection === 'contact' && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t('contactInformation')}</h2>

              <div className="settings-group">
                <label className="settings-label" htmlFor="client-phone">{t('phoneNumber')}</label>
                <input
                  id="client-phone"
                  type="tel"
                  className="settings-input"
                  value={settings.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+63 912 345 6789"
                  autoComplete="tel"
                  disabled={isLoadingProfile || isSaving}
                />
              </div>

              <div className="settings-group">
                <label className="settings-label" htmlFor="client-address">{t('address')}</label>
                <input
                  id="client-address"
                  type="text"
                  className="settings-input"
                  value={settings.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  autoComplete="street-address"
                  disabled={isLoadingProfile || isSaving}
                />
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t('securityActions')}</h2>

              <div className="settings-card">
                <p>
                  {t('emailVerificationStatus')}: <strong>{settings.isVerified ? t('verified') : t('notVerified')}</strong>
                </p>
                <p className="settings-help">{t('resendVerificationDisabled')}</p>
                {!settings.isVerified && (
                  <div className="settings-inline-actions">
                    <button
                      className="btn-secondary"
                      onClick={handleResendVerification}
                      disabled={isSendingVerification || isVerificationResendDisabled}
                      type="button"
                    >
                      {isSendingVerification ? t('sending') : t('resendVerificationEmail')}
                    </button>
                  </div>
                )}
              </div>

              <div className="settings-card">
                <p>{t('needChangePassword')}</p>
                <div className="settings-inline-actions">
                  <button className="btn-change-password" onClick={() => navigate('/forgot-password')}>
                    {t('openPasswordReset')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="settings-actions">
            <button className="btn-save" onClick={handleSave} disabled={isSaving || isLoadingProfile || !hasProfileChanges}>
              {isSaving ? t('saving') : t('saveChanges')}
            </button>
            <button className="btn-cancel" onClick={handleReset} disabled={isSaving || isLoadingProfile || !hasProfileChanges}>
              {t('reset')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClientSettings;
