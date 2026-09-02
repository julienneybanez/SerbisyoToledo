import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUser, userProfileAPI, serviceProfileAPI, verificationAPI } from '../services/api';
import SettingsFlash from '../components/settings/SettingsFlash';
import { AppButton, AppInput, AppSelect, PageHeader } from '../components/ui';
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
                <AppInput
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
                <AppInput
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
                    <AppButton
                      variant="secondary"
                      onClick={handleResendVerification}
                      disabled={isSendingVerification}
                    >
                      {isSendingVerification ? t('sending') : t('resendVerificationEmail')}
                    </AppButton>
                  )}
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">{t('providerPersonalPhoneLabel')}</label>
                <AppInput
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
              <AppButton
                variant="secondary"
                onClick={() => navigate('/forgot-password', {
                  state: { fromSettings: true, returnTo: '/provider-settings' },
                })}
              >
                {t('changePassword')}
              </AppButton>
              <small className="settings-help">{t('providerPasswordSecurityHelp')}</small>

              <div className="settings-actions">
                <AppButton onClick={handleSave} disabled={isSaving || isLoadingProfile || !hasAccountChanges}>
                  {isSaving ? t('saving') : t('saveChanges')}
                </AppButton>
                <AppButton variant="secondary" onClick={handleResetAccount} disabled={isSaving || isLoadingProfile || !hasAccountChanges}>
                  {t('reset')}
                </AppButton>
              </div>
            </div>
          )}

          {pageMode === 'credentials' && (
            <div className="provider-credentials-section">
              <div className="credentials-page-stack">
                <section className="credential-form-card" aria-labelledby="credential-form-title">
                  <div className="credential-card-heading">
                    <h2 id="credential-form-title">{t('providerCredentialsCertificatesTitle')}</h2>
                  </div>

                  <div className="credential-form-grid">
                    <div className="credential-field">
                      <label className="settings-label">{t('providerCredentialNameLabel')}</label>
                      <AppInput
                        type="text"
                        className="settings-input"
                        value={newCredential.credentialName}
                        onChange={(e) => setNewCredential((prev) => ({ ...prev, credentialName: e.target.value }))}
                        disabled={credentialSaving}
                      />
                    </div>

                    <div className="credential-field">
                      <label className="settings-label">{t('providerCredentialTypeLabel')}</label>
                      <AppSelect
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
                      </AppSelect>
                    </div>

                    <div className="credential-field">
                      <label className="settings-label">{t('providerIssuingOrganizationLabel')}</label>
                      <AppInput
                        type="text"
                        className="settings-input"
                        value={newCredential.issuingOrganization}
                        onChange={(e) => setNewCredential((prev) => ({ ...prev, issuingOrganization: e.target.value }))}
                        disabled={credentialSaving}
                      />
                    </div>

                    <div className="credential-field">
                      <label className="settings-label">{t('providerCredentialIdLabel')}</label>
                      <AppInput
                        type="text"
                        className="settings-input"
                        value={newCredential.credentialId}
                        onChange={(e) => setNewCredential((prev) => ({ ...prev, credentialId: e.target.value }))}
                        disabled={credentialSaving}
                      />
                    </div>

                    <div className="credential-field">
                      <label className="settings-label">{t('providerIssueDateLabel')}</label>
                      <AppInput
                        type="date"
                        className="settings-input"
                        value={newCredential.issueDate}
                        onChange={(e) => setNewCredential((prev) => ({ ...prev, issueDate: e.target.value }))}
                        disabled={credentialSaving}
                      />
                    </div>

                    <div className="credential-field">
                      <label className="settings-label">{t('providerExpirationDateLabel')}</label>
                      <AppInput
                        type="date"
                        className="settings-input"
                        value={newCredential.expirationDate}
                        onChange={(e) => setNewCredential((prev) => ({ ...prev, expirationDate: e.target.value }))}
                        disabled={credentialSaving || newCredential.doesNotExpire}
                      />
                    </div>

                    <div className="credential-field credential-field-full">
                      <label className="credential-checkbox">
                        <input
                          type="checkbox"
                          checked={newCredential.doesNotExpire}
                          onChange={(e) => setNewCredential((prev) => ({ ...prev, doesNotExpire: e.target.checked }))}
                          disabled={credentialSaving}
                        />
                        <span>{t('providerCredentialDoesNotExpire')}</span>
                      </label>
                    </div>

                    <div className="credential-field credential-field-full">
                      <label className="settings-label">{t('providerCredentialUrlLabel')}</label>
                      <AppInput
                        type="url"
                        className="settings-input"
                        value={newCredential.credentialUrl}
                        onChange={(e) => setNewCredential((prev) => ({ ...prev, credentialUrl: e.target.value }))}
                        disabled={credentialSaving}
                      />
                    </div>

                    <div className="credential-field credential-field-full">
                      <label className="settings-label">{t('providerCredentialDocumentLabel')}</label>
                      <input
                        type="file"
                        className="settings-input credential-file-input"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => setCredentialFile(e.target.files?.[0] || null)}
                        disabled={credentialSaving}
                      />
                    </div>
                  </div>

                  <div className="credential-form-actions">
                    <AppButton onClick={handleCreateCredential} disabled={credentialSaving}>
                      {credentialSaving ? t('saving') : t('providerAddCredential')}
                    </AppButton>
                  </div>
                </section>

                <section className="credential-list-card" aria-labelledby="saved-credentials-title">
                  <div className="credential-card-heading">
                    <h2 id="saved-credentials-title">{t('providerSavedCredentialsTitle')}</h2>
                  </div>

                  {credentialLoading ? (
                    <div className="credential-empty-state">
                      <span className="spinner-small" aria-hidden="true"></span>
                      <p>{t('providerLoadingCredentials')}</p>
                    </div>
                  ) : credentials.length === 0 ? (
                    <div className="credential-empty-state">
                      <i className="bi bi-patch-check" aria-hidden="true"></i>
                      <p>{t('providerNoCredentialsYet')}</p>
                    </div>
                  ) : (
                    <div className="credentials-list">
                      {credentials.map((credential) => (
                        <article key={credential.id} className="credential-list-item">
                          <div className="credential-list-copy">
                            <p className="credential-list-name">{credential.credential_name}</p>
                            <p className="credential-list-meta">
                              {credential.credential_type} • {credential.verification_status}
                            </p>
                            {credential.verification_notes && (
                              <p className="credential-list-note">{credential.verification_notes}</p>
                            )}
                          </div>
                          <div className="settings-credential-actions">
                            <AppButton
                              onClick={() => handleSubmitCredential(credential.id)}
                              disabled={credentialSaving || credential.verification_status === 'pending'}
                            >
                              {credential.verification_status === 'pending'
                                ? t('providerPendingReview')
                                : t('providerSubmitForReview')}
                            </AppButton>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ServiceProviderSettings;
