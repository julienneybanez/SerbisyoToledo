import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUser, userProfileAPI, serviceProfileAPI, verificationAPI } from '../services/api';
import SettingsFlash from '../components/settings/SettingsFlash';
import { PageHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import '../styles/UserSettings.css';

function ServiceProviderSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [flash, setFlash] = useState({ type: 'info', message: '' });
  const [initialSettings, setInitialSettings] = useState(null);
  const [credentialLoading, setCredentialLoading] = useState(true);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [newCredential, setNewCredential] = useState({
    credentialName: '',
    credentialType: '',
    issuingOrganization: '',
    credentialId: '',
    issueDate: '',
    expirationDate: '',
    doesNotExpire: false,
    credentialUrl: '',
  });
  const [credentialFile, setCredentialFile] = useState(null);
  const [credentialSaving, setCredentialSaving] = useState(false);

  const [settings, setSettings] = useState({
    fullName: '',
    email: '',
    phone: '',
    emailVerified: false,
  });

  const pageMode = location.pathname === '/provider-credentials'
    ? 'credentials'
    : 'account';

  const pageTitle = pageMode === 'credentials'
    ? t('credentials')
    : t('providerSettingsPageTitle');

  useEffect(() => {
    if (location.pathname !== '/provider-settings') {
      return;
    }

    const section = new URLSearchParams(location.search).get('section');
    if (section === 'schedule' || section === 'availability') {
      navigate('/provider-availability', { replace: true });
    } else if (section === 'profile') {
      navigate('/provider-credentials', { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.userType !== 'tradesperson') {
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
          const nextSettings = {
            fullName: profile.fullName || '',
            email: profile.email || currentUser.email || '',
            phone: profile.phone || '',
            emailVerified: Boolean(profile.emailVerified ?? currentUser.emailVerified),
          };
          setSettings(nextSettings);
          setInitialSettings(nextSettings);
        }
      } catch {
        const fallbackSettings = {
          fullName: currentUser.fullName || '',
          email: currentUser.email || '',
          phone: currentUser.phone || '',
          emailVerified: Boolean(currentUser.emailVerified),
        };
        setSettings(fallbackSettings);
        setInitialSettings(fallbackSettings);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, [navigate]);

  useEffect(() => {
    const loadProviderToolData = async () => {
      try {
        setCredentialLoading(true);

        const credentialsResult = await Promise.resolve(
          serviceProfileAPI.getMyCredentials
            ? serviceProfileAPI.getMyCredentials()
            : { success: true, data: { credentials: [] } },
        );

        if (!credentialsResult?.success) {
          console.error('Failed to load provider credentials');
        }

        if (credentialsResult?.success) {
          setCredentials(credentialsResult.data?.credentials || []);
        }
      } catch (err) {
        console.error('Failed to load provider credentials:', err);
      } finally {
        setCredentialLoading(false);
      }
    };

    loadProviderToolData();
  }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const hasAccountChanges = Boolean(
    initialSettings
    && (
      settings.fullName !== initialSettings.fullName
      || settings.phone !== initialSettings.phone
    )
  );

  const getFriendlyErrorMessage = (fallbackMessage) => fallbackMessage;

  const handleSave = async () => {
    if (!hasAccountChanges) {
      setFlash({ type: 'info', message: t('noChangesToSave') });
      return;
    }

    try {
      setIsSaving(true);
      setFlash({ type: 'info', message: '' });
      const submitData = new FormData();
      submitData.append('fullName', settings.fullName || '');
      submitData.append('phone', settings.phone || '');

      const response = await userProfileAPI.updateProfile(submitData);
      if (response.success) {
        const nextSettings = {
          ...settings,
          fullName: response.data.fullName || settings.fullName,
          phone: response.data.phone || '',
        };
        setSettings(nextSettings);
        setInitialSettings(nextSettings);
        setFlash({ type: 'success', message: t('providerSettingsSavedSuccess') });
      }
    } catch {
      setFlash({ type: 'error', message: getFriendlyErrorMessage(t('providerSettingsSaveFailed')) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendVerification = async () => {
    if (!settings.email) {
      setFlash({ type: 'error', message: t('noEmailForVerification') });
      return;
    }

    try {
      setIsSendingVerification(true);
      setFlash({ type: 'info', message: '' });
      await verificationAPI.resendVerification({ email: settings.email });
      setFlash({ type: 'success', message: t('verificationEmailSent') });
    } catch (err) {
      setFlash({
        type: 'error',
        message: err?.message || t('failedSendVerificationEmail'),
      });
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleCreateCredential = async () => {
    if (!newCredential.credentialName.trim() || !newCredential.credentialType.trim()) {
      setFlash({ type: 'error', message: t('providerCredentialNameTypeRequired') });
      return;
    }

    try {
      setCredentialSaving(true);
      setFlash({ type: 'info', message: '' });
      const formData = new FormData();
      formData.append('credentialName', newCredential.credentialName.trim());
      formData.append('credentialType', newCredential.credentialType.trim());
      formData.append('issuingOrganization', newCredential.issuingOrganization.trim());
      formData.append('credentialId', newCredential.credentialId.trim());
      formData.append('issueDate', newCredential.issueDate || '');
      formData.append('expirationDate', newCredential.expirationDate || '');
      formData.append('doesNotExpire', String(newCredential.doesNotExpire));
      formData.append('credentialUrl', newCredential.credentialUrl.trim());
      if (credentialFile) {
        formData.append('document', credentialFile);
      }

      await serviceProfileAPI.createCredential(formData);
      const updated = await serviceProfileAPI.getMyCredentials();
      if (updated.success) {
        setCredentials(updated.data?.credentials || []);
      }

      setNewCredential({
        credentialName: '',
        credentialType: '',
        issuingOrganization: '',
        credentialId: '',
        issueDate: '',
        expirationDate: '',
        doesNotExpire: false,
        credentialUrl: '',
      });
      setCredentialFile(null);
      setFlash({ type: 'success', message: t('providerCredentialSavedSuccess') });
    } catch {
      setFlash({ type: 'error', message: getFriendlyErrorMessage(t('providerCredentialCreateFailed')) });
    } finally {
      setCredentialSaving(false);
    }
  };

  const handleSubmitCredential = async (credentialId) => {
    try {
      setCredentialSaving(true);
      setFlash({ type: 'info', message: '' });
      await serviceProfileAPI.submitCredentialForReview(credentialId);
      const updated = await serviceProfileAPI.getMyCredentials();
      if (updated.success) {
        setCredentials(updated.data?.credentials || []);
      }
      setFlash({ type: 'success', message: t('providerCredentialSubmittedSuccess') });
    } catch {
      setFlash({ type: 'error', message: getFriendlyErrorMessage(t('providerCredentialSubmitFailed')) });
    } finally {
      setCredentialSaving(false);
    }
  };

  const handleResetAccount = () => {
    if (!initialSettings) {
      return;
    }

    setSettings(initialSettings);
    setFlash({ type: 'info', message: t('changesWereReset') });
  };

  return (
    <div className={`user-settings-container provider-tool-page provider-tool-${pageMode}`}>
      <PageHeader
        title={pageTitle}
        className="settings-page-heading"
        titleClassName="settings-page-title"
      />

      <div className="settings-layout settings-layout-single">
        <div className="settings-content">
          <SettingsFlash type={flash.type} message={flash.message} />

          {pageMode === 'account' && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t('providerAccountSettingsTitle')}</h2>

              <div className="settings-group">
                <label className="settings-label">{t('fullName')}</label>
                <input
                  type="text"
                  className="settings-input"
                  value={settings.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  placeholder={t('providerPlaceholderFullName')}
                  disabled={isLoadingProfile || isSaving}
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">{t('emailAddress')}</label>
                <input
                  type="email"
                  className="settings-input"
                  value={settings.email}
                  readOnly
                  placeholder={t('providerPlaceholderEmail')}
                  disabled
                />
                <small className="settings-help">{t('providerEmailHelpText')}</small>
              </div>

              <div className="settings-card">
                <div className="settings-card-row">
                  <div className="settings-card-main">
                    <p className="settings-card-title">{t('emailVerificationStatus')}</p>
                    <p className="settings-card-description">
                      <strong>{settings.emailVerified ? t('verified') : t('notVerified')}</strong>
                    </p>
                  </div>
                  {!settings.emailVerified && (
                    <button
                      type="button"
                      className="btn-change-password"
                      onClick={handleResendVerification}
                      disabled={isSendingVerification}
                    >
                      {isSendingVerification ? t('sending') : t('resendVerificationEmail')}
                    </button>
                  )}
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">{t('providerPersonalPhoneLabel')}</label>
                <input
                  type="tel"
                  className="settings-input"
                  value={settings.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder={t('providerPlaceholderPhone')}
                  inputMode="tel"
                  maxLength={20}
                  disabled={isLoadingProfile || isSaving}
                />
                <small className="settings-help">{t('phonePrivacyHelp')}</small>
              </div>

              <div className="settings-section-divider"></div>

              <h3 className="settings-subsection-title">{t('providerPasswordSecurityTitle')}</h3>
              <button
                className="btn-change-password"
                type="button"
                onClick={() => navigate('/forgot-password', {
                  state: { fromSettings: true, returnTo: '/provider-settings' },
                })}
              >
                {t('changePassword')}
              </button>
              <small className="settings-help">{t('providerPasswordSecurityHelp')}</small>

              <div className="settings-actions">
                <button className="btn-save" onClick={handleSave} disabled={isSaving || isLoadingProfile || !hasAccountChanges}>
                  {isSaving ? t('saving') : t('saveChanges')}
                </button>
                <button className="btn-cancel" type="button" onClick={handleResetAccount} disabled={isSaving || isLoadingProfile || !hasAccountChanges}>
                  {t('reset')}
                </button>
              </div>
            </div>
          )}

          {pageMode === 'credentials' && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t('credentials')}</h2>
              
              <h3 className="settings-subsection-title">{t('providerCredentialsCertificatesTitle')}</h3>

              <div className="settings-group">
                <label className="settings-label">{t('providerCredentialNameLabel')}</label>
                <input
                  type="text"
                  className="settings-input"
                  value={newCredential.credentialName}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, credentialName: e.target.value }))}
                  disabled={credentialSaving}
                />

                <label className="settings-label">{t('providerCredentialTypeLabel')}</label>
                <select
                  className="settings-input"
                  value={newCredential.credentialType}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, credentialType: e.target.value }))}
                  disabled={credentialSaving}
                >
                  <option value="">{t('providerCredentialTypePlaceholder')}</option>
                  <option value="professional_license">{t('providerCredentialTypeProfessionalLicense')}</option>
                  <option value="tesda_certification">{t('providerCredentialTypeTesda')}</option>
                  <option value="safety_training">{t('providerCredentialTypeSafetyTraining')}</option>
                  <option value="technical_certification">{t('providerCredentialTypeTechnicalCertification')}</option>
                  <option value="government_accreditation">{t('providerCredentialTypeGovernmentAccreditation')}</option>
                  <option value="manufacturer_certification">{t('providerCredentialTypeManufacturerCertification')}</option>
                  <option value="training_certificate">{t('providerCredentialTypeTrainingCertificate')}</option>
                  <option value="other">{t('providerCredentialTypeOther')}</option>
                </select>

                <label className="settings-label">{t('providerIssuingOrganizationLabel')}</label>
                <input
                  type="text"
                  className="settings-input"
                  value={newCredential.issuingOrganization}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, issuingOrganization: e.target.value }))}
                  disabled={credentialSaving}
                />

                <label className="settings-label">{t('providerCredentialIdLabel')}</label>
                <input
                  type="text"
                  className="settings-input"
                  value={newCredential.credentialId}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, credentialId: e.target.value }))}
                  disabled={credentialSaving}
                />

                <label className="settings-label">{t('providerIssueDateLabel')}</label>
                <input
                  type="date"
                  className="settings-input"
                  value={newCredential.issueDate}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, issueDate: e.target.value }))}
                  disabled={credentialSaving}
                />

                <label className="settings-label">{t('providerExpirationDateLabel')}</label>
                <input
                  type="date"
                  className="settings-input"
                  value={newCredential.expirationDate}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, expirationDate: e.target.value }))}
                  disabled={credentialSaving || newCredential.doesNotExpire}
                />

                <label className="settings-help" style={{ display: 'block' }}>
                  <input
                    type="checkbox"
                    checked={newCredential.doesNotExpire}
                    onChange={(e) => setNewCredential((prev) => ({ ...prev, doesNotExpire: e.target.checked }))}
                    disabled={credentialSaving}
                    style={{ marginRight: '0.45rem' }}
                  />
                  {t('providerCredentialDoesNotExpire')}
                </label>

                <label className="settings-label">{t('providerCredentialUrlLabel')}</label>
                <input
                  type="url"
                  className="settings-input"
                  value={newCredential.credentialUrl}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, credentialUrl: e.target.value }))}
                  disabled={credentialSaving}
                />

                <label className="settings-label">{t('providerCredentialDocumentLabel')}</label>
                <input
                  type="file"
                  className="settings-input"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setCredentialFile(e.target.files?.[0] || null)}
                  disabled={credentialSaving}
                />
              </div>

              <div className="settings-actions">
                <button className="btn-save" onClick={handleCreateCredential} disabled={credentialSaving}>
                  {credentialSaving ? t('saving') : t('providerAddCredential')}
                </button>
              </div>

              <div className="settings-group">
                <h4 className="settings-subsection-title" style={{ marginBottom: '0.5rem' }}>
                  {t('providerSavedCredentialsTitle')}
                </h4>
                {credentialLoading && (
                  <small className="settings-help">{t('providerLoadingCredentials')}</small>
                )}
                {!credentialLoading && credentials.length === 0 && (
                  <small className="settings-help">{t('providerNoCredentialsYet')}</small>
                )}
                {credentials.map((credential) => (
                  <div key={credential.id} className="settings-surface-block">
                    <p className="settings-metadata-row settings-metadata-strong">
                      {credential.credential_name}
                    </p>
                    <small className="settings-help">
                      {credential.credential_type} • {credential.verification_status}
                    </small>
                    {credential.verification_notes && (
                      <p className="settings-metadata-row">{credential.verification_notes}</p>
                    )}
                    <div className="settings-credential-actions">
                      <button
                        type="button"
                        className="btn-save"
                        onClick={() => handleSubmitCredential(credential.id)}
                        disabled={credentialSaving || credential.verification_status === 'pending'}
                        style={{ minHeight: '40px' }}
                      >
                        {credential.verification_status === 'pending'
                          ? t('providerPendingReview')
                          : t('providerSubmitForReview')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ServiceProviderSettings;
