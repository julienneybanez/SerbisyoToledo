import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUser, userProfileAPI, serviceProfileAPI, verificationAPI } from '../services/api';
import ThemeToggle from '../components/common/ThemeToggle';
import SettingsFlash from '../components/settings/SettingsFlash';
import { useLanguage } from '../context/LanguageContext';
import '../styles/UserSettings.css';

const LANGUAGE_OPTIONS = [
  { value: 'ceb', labelKey: 'languageOptionCebuano' },
  { value: 'en', labelKey: 'languageOptionEnglish' },
  { value: 'fil', labelKey: 'languageOptionFilipino' },
];

function ServiceProviderSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useLanguage();
  const [activeSection, setActiveSection] = useState('account');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [flash, setFlash] = useState({ type: 'info', message: '' });
  const [initialSettings, setInitialSettings] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [languageSaving, setLanguageSaving] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(true);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [availabilitySettings, setAvailabilitySettings] = useState({
    availabilityStatus: 'available',
    showAvailabilityStatus: true,
    allowSameDayBooking: false,
    minAdvanceNoticeMinutes: 720,
    maxAdvanceBookingDays: 60,
  });
  const [specificAvailability, setSpecificAvailability] = useState([]);
  const [legacyWeeklyBlocksCount, setLegacyWeeklyBlocksCount] = useState(0);
  const [newAvailabilitySlot, setNewAvailabilitySlot] = useState({
    date: '',
    startTime: '09:00',
    endTime: '10:00',
  });
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

  const languagesCredentialsLabel = language === 'ceb'
    ? 'Mga Pinulongan ug Credentials'
    : 'Languages & Credentials';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    const aliasMap = {
      availability: 'schedule',
      business: 'account',
      notifications: 'account',
      privacy: 'account',
    };
    const normalizedSection = aliasMap[section] || section;
    const allowedSections = new Set(['account', 'schedule', 'profile']);

    if (normalizedSection && allowedSections.has(normalizedSection)) {
      setActiveSection(normalizedSection);
    }
  }, [location.search]);

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
    const loadProviderSettingsData = async () => {
      try {
        setAvailabilityLoading(true);
        setCredentialLoading(true);

        const [availabilityResult, languagesResult, credentialsResult] = await Promise.allSettled([
          serviceProfileAPI.getMyAvailability
            ? serviceProfileAPI.getMyAvailability()
            : Promise.resolve({ success: true, data: { settings: {}, weeklyBlocks: [], exceptions: [] } }),
          serviceProfileAPI.getMyLanguages
            ? serviceProfileAPI.getMyLanguages()
            : Promise.resolve({ success: true, data: { languages: [] } }),
          serviceProfileAPI.getMyCredentials
            ? serviceProfileAPI.getMyCredentials()
            : Promise.resolve({ success: true, data: { credentials: [] } }),
        ]);

        const availabilityResponse = availabilityResult.status === 'fulfilled' ? availabilityResult.value : null;
        const languagesResponse = languagesResult.status === 'fulfilled' ? languagesResult.value : null;
        const credentialsResponse = credentialsResult.status === 'fulfilled' ? credentialsResult.value : null;

        if (availabilityResult.status === 'rejected') {
          console.error('Failed to load provider availability:', availabilityResult.reason);
        }
        if (languagesResult.status === 'rejected') {
          console.error('Failed to load provider languages:', languagesResult.reason);
        }
        if (credentialsResult.status === 'rejected') {
          console.error('Failed to load provider credentials:', credentialsResult.reason);
        }

        if (availabilityResponse?.success && availabilityResponse.data) {
          const s = availabilityResponse.data.settings || {};
          setAvailabilitySettings({
            availabilityStatus: String(
              s.availability_status ?? s.availabilityStatus ?? 'available'
            ).toLowerCase(),
            showAvailabilityStatus: Boolean(
              s.show_availability_status ?? s.showAvailabilityStatus ?? true
            ),
            allowSameDayBooking: Boolean(s.allow_same_day_booking ?? s.allowSameDayBooking),
            minAdvanceNoticeMinutes: Number(s.min_advance_notice_minutes ?? s.minAdvanceNoticeMinutes ?? 720),
            maxAdvanceBookingDays: Number(s.max_advance_booking_days ?? s.maxAdvanceBookingDays ?? 60),
          });

          const blocks = Array.isArray(availabilityResponse.data.weeklyBlocks)
            ? availabilityResponse.data.weeklyBlocks
            : [];
          setLegacyWeeklyBlocksCount(blocks.length);

          const explicitSlots = Array.isArray(availabilityResponse.data.specificAvailability)
            ? availabilityResponse.data.specificAvailability
            : (Array.isArray(availabilityResponse.data.exceptions)
              ? availabilityResponse.data.exceptions
                .filter((item) => (
                  String(item.exception_type ?? item.exceptionType ?? '').toLowerCase() === 'available'
                  && (item.start_time ?? item.startTime)
                  && (item.end_time ?? item.endTime)
                ))
                .map((item) => ({
                  id: item.id,
                  date: String(item.exception_date ?? item.exceptionDate ?? '').slice(0, 10),
                  startTime: String(item.start_time ?? item.startTime ?? '').slice(0, 5),
                  endTime: String(item.end_time ?? item.endTime ?? '').slice(0, 5),
                }))
              : []);

          setSpecificAvailability(
            explicitSlots
              .map((item) => ({
                id: item.id,
                date: String(item.date || '').slice(0, 10),
                startTime: String(item.startTime || '').slice(0, 5),
                endTime: String(item.endTime || '').slice(0, 5),
              }))
              .filter((item) => item.date && item.startTime && item.endTime)
              .sort((a, b) => (
                a.date.localeCompare(b.date)
                || a.startTime.localeCompare(b.startTime)
              ))
          );
        }

        if (languagesResponse?.success) {
          setSelectedLanguages(languagesResponse.data?.languages || []);
        }

        if (credentialsResponse?.success) {
          setCredentials(credentialsResponse.data?.credentials || []);
        }
      } catch (err) {
        console.error('Failed to load provider settings:', err);
      } finally {
        setAvailabilityLoading(false);
        setCredentialLoading(false);
      }
    };

    loadProviderSettingsData();
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

  const handleAvailabilitySave = async () => {
    try {
      setIsSaving(true);
      setFlash({ type: 'info', message: '' });
      await serviceProfileAPI.saveMyAvailability({
        settings: availabilitySettings,
        specificAvailability: specificAvailability.map(({ date, startTime, endTime }) => ({
          date,
          startTime,
          endTime,
        })),
      });
      setLegacyWeeklyBlocksCount(0);
      setFlash({ type: 'success', message: t('providerAvailabilityUpdatedSuccess') });
    } catch {
      setFlash({ type: 'error', message: getFriendlyErrorMessage(t('providerAvailabilitySaveFailed')) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLanguageToggle = (code) => {
    setSelectedLanguages((prev) => (
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    ));
  };

  const handleSaveLanguages = async () => {
    try {
      setLanguageSaving(true);
      setFlash({ type: 'info', message: '' });
      await serviceProfileAPI.updateMyLanguages(selectedLanguages);
      setFlash({ type: 'success', message: t('providerLanguagesUpdatedSuccess') });
    } catch {
      setFlash({ type: 'error', message: getFriendlyErrorMessage(t('providerLanguagesUpdateFailed')) });
    } finally {
      setLanguageSaving(false);
    }
  };

  const getTodayInputValue = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleAddSpecificAvailability = () => {
    const { date, startTime, endTime } = newAvailabilitySlot;

    if (!date) {
      setFlash({ type: 'error', message: t('providerAvailabilityDateRequired') });
      return;
    }

    if (date < getTodayInputValue()) {
      setFlash({ type: 'error', message: t('providerAvailabilityPastDateError') });
      return;
    }

    if (!startTime || !endTime || endTime <= startTime) {
      setFlash({ type: 'error', message: t('providerAvailabilityTimeRangeError') });
      return;
    }

    const overlaps = specificAvailability.some((slot) => (
      slot.date === date
      && startTime < slot.endTime
      && endTime > slot.startTime
    ));

    if (overlaps) {
      setFlash({ type: 'error', message: t('providerAvailabilityOverlapError') });
      return;
    }

    setSpecificAvailability((prev) => ([
      ...prev,
      { date, startTime, endTime },
    ].sort((a, b) => (
      a.date.localeCompare(b.date)
      || a.startTime.localeCompare(b.startTime)
    ))));

    setNewAvailabilitySlot((prev) => ({
      ...prev,
      date: '',
    }));
    setFlash({ type: 'info', message: '' });
  };

  const handleRemoveSpecificAvailability = (index) => {
    setSpecificAvailability((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
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
    <div className="user-settings-container">
      <div className="settings-page-heading">
        <h1 className="settings-page-title">{t('providerSettingsPageTitle')}</h1>
        <ThemeToggle compact className="settings-header-theme-toggle" />
      </div>

      <div className="settings-layout">
        <div className="settings-nav">
          <button
            className={`settings-nav-item ${activeSection === 'account' ? 'active' : ''}`}
            onClick={() => setActiveSection('account')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            {t('account')}
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'schedule' ? 'active' : ''}`}
            data-tour="provider-schedule-tab"
            onClick={() => setActiveSection('schedule')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="17" rx="2"></rect>
              <path d="M8 2v4M16 2v4M3 10h18"></path>
            </svg>
            {t('schedule')}
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveSection('profile')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            {languagesCredentialsLabel}
          </button>
        </div>

        <div className="settings-content">
          <SettingsFlash type={flash.type} message={flash.message} />

          {activeSection === 'account' && (
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
                  disabled={isLoadingProfile || isSaving}
                />
              </div>

              <div className="settings-section-divider"></div>

              <h3 className="settings-subsection-title">{t('providerPasswordSecurityTitle')}</h3>
              <button className="btn-change-password" type="button" onClick={() => navigate('/forgot-password')}>
                {t('openPasswordReset')}
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

          {activeSection === 'schedule' && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t('providerSettingsScheduleTitle')}</h2>
              <small className="settings-help">{t('providerScheduleClientChoiceHelp')}</small>

              <div className="settings-toggle-group">
                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>{t('providerAvailabilityStatusLabel')}</span>
                    <small>{t('providerAvailabilityStatusHelp')}</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={availabilitySettings.availabilityStatus !== 'unavailable'}
                      onChange={(e) => setAvailabilitySettings((prev) => ({
                        ...prev,
                        availabilityStatus: e.target.checked ? 'available' : 'unavailable',
                      }))}
                      disabled={availabilityLoading || isSaving}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>{t('providerShowAvailabilityStatusLabel')}</span>
                    <small>{t('providerShowAvailabilityStatusHelp')}</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={availabilitySettings.showAvailabilityStatus}
                      onChange={(e) => setAvailabilitySettings((prev) => ({
                        ...prev,
                        showAvailabilityStatus: e.target.checked,
                      }))}
                      disabled={availabilityLoading || isSaving}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              <div className="settings-section-divider"></div>
              <h3 className="settings-subsection-title">{t('providerBookingConfigurationTitle')}</h3>
              <small className="settings-help">{t('providerBookingRulesHelp')}</small>

              <div className="settings-group">
                <label className="settings-label">{t('providerAllowSameDayBookingLabel')}</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={availabilitySettings.allowSameDayBooking}
                    onChange={(e) => setAvailabilitySettings((prev) => ({
                      ...prev,
                      allowSameDayBooking: e.target.checked,
                    }))}
                    disabled={availabilityLoading || isSaving}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="settings-group">
                <label className="settings-label">{t('providerMinAdvanceNoticeLabelFriendly')}</label>
                <select
                  className="settings-select"
                  value={availabilitySettings.minAdvanceNoticeMinutes}
                  onChange={(e) => setAvailabilitySettings((prev) => ({
                    ...prev,
                    minAdvanceNoticeMinutes: Number(e.target.value),
                  }))}
                  disabled={availabilityLoading || isSaving}
                >
                  <option value={0}>{t('providerAdvanceNoticeNone')}</option>
                  <option value={60}>{t('providerAdvanceNotice1Hour')}</option>
                  <option value={180}>{t('providerAdvanceNotice3Hours')}</option>
                  <option value={360}>{t('providerAdvanceNotice6Hours')}</option>
                  <option value={720}>{t('providerAdvanceNotice12Hours')}</option>
                  <option value={1440}>{t('providerAdvanceNotice1Day')}</option>
                  <option value={2880}>{t('providerAdvanceNotice2Days')}</option>
                  {![0, 60, 180, 360, 720, 1440, 2880].includes(Number(availabilitySettings.minAdvanceNoticeMinutes)) && (
                    <option value={availabilitySettings.minAdvanceNoticeMinutes}>
                      {t('providerAdvanceNoticeCustom', { minutes: availabilitySettings.minAdvanceNoticeMinutes })}
                    </option>
                  )}
                </select>
              </div>

              <div className="settings-group">
                <label className="settings-label">{t('providerMaxAdvanceBookingDaysLabel')}</label>
                <input
                  type="number"
                  className="settings-input"
                  value={availabilitySettings.maxAdvanceBookingDays}
                  onChange={(e) => setAvailabilitySettings((prev) => ({
                    ...prev,
                    maxAdvanceBookingDays: Number(e.target.value || 1),
                  }))}
                  min="1"
                  max="365"
                  disabled={availabilityLoading || isSaving}
                />
              </div>

              <div className="settings-section-divider"></div>
              <h3 className="settings-subsection-title">{t('providerSpecificAvailabilityTitle')}</h3>
              <p className="settings-help">{t('providerSpecificAvailabilityHelp')}</p>

              {legacyWeeklyBlocksCount > 0 && (
                <div className="settings-flash info" role="status">
                  {t('providerLegacyAvailabilityNotice')}
                </div>
              )}

              <div className="settings-surface-block">
                <label className="settings-label">{t('providerAvailableDateLabel')}</label>
                <input
                  type="date"
                  className="settings-input"
                  value={newAvailabilitySlot.date}
                  min={getTodayInputValue()}
                  onChange={(e) => setNewAvailabilitySlot((prev) => ({
                    ...prev,
                    date: e.target.value,
                  }))}
                  disabled={availabilityLoading || isSaving}
                />

                <label className="settings-label">{t('requestsStartTime')}</label>
                <input
                  type="time"
                  className="settings-input"
                  value={newAvailabilitySlot.startTime}
                  onChange={(e) => setNewAvailabilitySlot((prev) => ({
                    ...prev,
                    startTime: e.target.value,
                  }))}
                  disabled={availabilityLoading || isSaving}
                />

                <label className="settings-label">{t('requestsEndTime')}</label>
                <input
                  type="time"
                  className="settings-input"
                  value={newAvailabilitySlot.endTime}
                  onChange={(e) => setNewAvailabilitySlot((prev) => ({
                    ...prev,
                    endTime: e.target.value,
                  }))}
                  disabled={availabilityLoading || isSaving}
                />

                <button
                  type="button"
                  className="btn-save"
                  onClick={handleAddSpecificAvailability}
                  disabled={availabilityLoading || isSaving}
                >
                  {t('providerAddTimeSlot')}
                </button>
              </div>

              <div className="settings-group">
                {specificAvailability.length === 0 && (
                  <small className="settings-help">{t('providerNoSpecificAvailability')}</small>
                )}

                {specificAvailability.map((slot, index) => (
                  <div key={`${slot.date}-${slot.startTime}-${index}`} className="settings-surface-block">
                    <p className="settings-metadata-row settings-metadata-strong">
                      {slot.date} • {slot.startTime} - {slot.endTime}
                    </p>
                    <small className="settings-help">
                      {t('providerClientSeesStartTime', { time: slot.startTime })}
                    </small>
                    <div className="settings-credential-actions">
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => handleRemoveSpecificAvailability(index)}
                        disabled={availabilityLoading || isSaving}
                      >
                        {t('providerRemoveException')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="settings-actions">
                <button className="btn-save" onClick={handleAvailabilitySave} disabled={availabilityLoading || isSaving}>
                  {isSaving ? t('saving') : t('providerSaveAvailability')}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'profile' && (
            <div className="settings-section">
              <h2 className="settings-section-title">{languagesCredentialsLabel}</h2>

              <h3 className="settings-subsection-title">{t('languagesSpoken')}</h3>
              <div className="settings-group">
                {LANGUAGE_OPTIONS.map((option) => (
                  <label key={option.value} className="settings-help" style={{ display: 'block', marginBottom: '0.35rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedLanguages.includes(option.value)}
                      onChange={() => handleLanguageToggle(option.value)}
                      disabled={languageSaving}
                      style={{ marginRight: '0.45rem' }}
                    />
                    {t(option.labelKey)}
                  </label>
                ))}
              </div>

              <div className="settings-actions">
                <button className="btn-save" onClick={handleSaveLanguages} disabled={languageSaving}>
                  {languageSaving ? t('saving') : t('providerSaveLanguages')}
                </button>
              </div>

              <div className="settings-section-divider"></div>
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
                <input
                  type="text"
                  className="settings-input"
                  value={newCredential.credentialType}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, credentialType: e.target.value }))}
                  disabled={credentialSaving}
                />

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
