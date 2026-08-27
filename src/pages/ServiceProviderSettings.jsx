import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUser, userProfileAPI, serviceProfileAPI } from '../services/api';
import ThemeToggle from '../components/common/ThemeToggle';
import SettingsFlash from '../components/settings/SettingsFlash';
import { useLanguage } from '../context/LanguageContext';
import '../styles/UserSettings.css';

const LANGUAGE_OPTIONS = [
  { value: 'ceb', labelKey: 'languageOptionCebuano' },
  { value: 'en', labelKey: 'languageOptionEnglish' },
  { value: 'fil', labelKey: 'languageOptionFilipino' },
];

const WEEK_DAYS = [
  { key: 1, labelKey: 'weekdayMonday' },
  { key: 2, labelKey: 'weekdayTuesday' },
  { key: 3, labelKey: 'weekdayWednesday' },
  { key: 4, labelKey: 'weekdayThursday' },
  { key: 5, labelKey: 'weekdayFriday' },
  { key: 6, labelKey: 'weekdaySaturday' },
  { key: 0, labelKey: 'weekdaySunday' },
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
  const [credentials, setCredentials] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [availabilitySettings, setAvailabilitySettings] = useState({
    availabilityStatus: 'available',
    showAvailabilityStatus: true,
    allowSameDayBooking: false,
    minAdvanceNoticeMinutes: 720,
    maxAdvanceBookingDays: 60,
  });
  const [weeklyBlocks, setWeeklyBlocks] = useState([]);
  const [availabilityExceptions, setAvailabilityExceptions] = useState([]);
  const [newException, setNewException] = useState({
    exceptionDate: '',
    exceptionType: 'unavailable',
    startTime: '',
    endTime: '',
    reason: '',
  });
  const [exceptionSaving, setExceptionSaving] = useState(false);
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
  });

  const languagesCredentialsLabel = language === 'ceb'
    ? 'Mga Pinulongan ug Credentials'
    : 'Languages & Credentials';

  const settingsSubtitle = language === 'ceb'
    ? 'Dumalahon ang imong account, schedule, mga pinulongan, ug credentials.'
    : 'Manage your account, schedule, languages, and credentials.';

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
          };
          setSettings(nextSettings);
          setInitialSettings(nextSettings);
        }
      } catch {
        const fallbackSettings = {
          fullName: currentUser.fullName || '',
          email: currentUser.email || '',
          phone: currentUser.phone || '',
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
          setWeeklyBlocks(blocks.map((b) => ({
            dayOfWeek: Number(b.day_of_week ?? b.dayOfWeek),
            startTime: String(b.start_time ?? b.startTime ?? '').slice(0, 5),
            endTime: String(b.end_time ?? b.endTime ?? '').slice(0, 5),
            isAvailable: b.is_available !== false,
          })));

          const exceptions = Array.isArray(availabilityResponse.data.exceptions)
            ? availabilityResponse.data.exceptions
            : [];
          setAvailabilityExceptions(exceptions.map((ex) => ({
            id: ex.id,
            exceptionDate: String(ex.exception_date ?? ex.exceptionDate ?? '').slice(0, 10),
            exceptionType: ex.exception_type ?? ex.exceptionType ?? 'unavailable',
            startTime: String(ex.start_time ?? ex.startTime ?? '').slice(0, 5),
            endTime: String(ex.end_time ?? ex.endTime ?? '').slice(0, 5),
            reason: ex.reason || '',
          })));
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

  const getFriendlyErrorMessage = (fallbackMessage) => fallbackMessage;

  const handleSave = async () => {
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
        weeklyBlocks,
      });
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

  const addWeekDayBlock = (dayOfWeek) => {
    setWeeklyBlocks((prev) => ([
      ...prev,
      { dayOfWeek, startTime: '09:00', endTime: '17:00', isAvailable: true },
    ]));
  };

  const updateWeekDayBlock = (index, key, value) => {
    setWeeklyBlocks((prev) => prev.map((block, i) => (
      i === index ? { ...block, [key]: value } : block
    )));
  };

  const removeWeekDayBlock = (index) => {
    setWeeklyBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAvailabilityException = async () => {
    if (!newException.exceptionDate) {
      setFlash({ type: 'error', message: t('providerExceptionDateRequired') });
      return;
    }

    if ((newException.startTime && !newException.endTime) || (!newException.startTime && newException.endTime)) {
      setFlash({ type: 'error', message: t('providerExceptionTimePairRequired') });
      return;
    }

    try {
      setExceptionSaving(true);
      setFlash({ type: 'info', message: '' });
      await serviceProfileAPI.addAvailabilityException({
        exceptionDate: newException.exceptionDate,
        exceptionType: newException.exceptionType,
        startTime: newException.startTime || null,
        endTime: newException.endTime || null,
        reason: newException.reason.trim() || null,
      });

      const refreshed = await serviceProfileAPI.getMyAvailability();
      if (refreshed.success && refreshed.data) {
        const exceptions = Array.isArray(refreshed.data.exceptions)
          ? refreshed.data.exceptions
          : [];
        setAvailabilityExceptions(exceptions.map((ex) => ({
          id: ex.id,
          exceptionDate: String(ex.exception_date ?? ex.exceptionDate ?? '').slice(0, 10),
          exceptionType: ex.exception_type ?? ex.exceptionType ?? 'unavailable',
          startTime: String(ex.start_time ?? ex.startTime ?? '').slice(0, 5),
          endTime: String(ex.end_time ?? ex.endTime ?? '').slice(0, 5),
          reason: ex.reason || '',
        })));
      }

      setNewException({
        exceptionDate: '',
        exceptionType: 'unavailable',
        startTime: '',
        endTime: '',
        reason: '',
      });
      setFlash({ type: 'success', message: t('providerAvailabilityUpdatedSuccess') });
    } catch {
      setFlash({ type: 'error', message: getFriendlyErrorMessage(t('providerAddExceptionFailed')) });
    } finally {
      setExceptionSaving(false);
    }
  };

  const handleDeleteAvailabilityException = async (exceptionId) => {
    try {
      setExceptionSaving(true);
      setFlash({ type: 'info', message: '' });
      await serviceProfileAPI.deleteAvailabilityException(exceptionId);
      setAvailabilityExceptions((prev) => (
        prev.filter((item) => Number(item.id) !== Number(exceptionId))
      ));
      setFlash({ type: 'success', message: t('providerAvailabilityUpdatedSuccess') });
    } catch {
      setFlash({ type: 'error', message: getFriendlyErrorMessage(t('providerDeleteExceptionFailed')) });
    } finally {
      setExceptionSaving(false);
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
      <div className="page-header">
        <h1 className="page-title">{t('providerSettingsPageTitle')}</h1>
        <p className="page-subtitle">{settingsSubtitle}</p>
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
                {t('providerChangePassword')}
              </button>
              <small className="settings-help">{t('providerPasswordSecurityHelp')}</small>

              <div className="settings-actions">
                <button className="btn-save" onClick={handleSave} disabled={isSaving || isLoadingProfile}>
                  {isSaving ? t('saving') : t('saveChanges')}
                </button>
                <button className="btn-cancel" type="button" onClick={handleResetAccount} disabled={isSaving || isLoadingProfile}>
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
                <label className="settings-label">{t('providerMinAdvanceNoticeLabel')}</label>
                <input
                  type="number"
                  className="settings-input"
                  value={availabilitySettings.minAdvanceNoticeMinutes}
                  onChange={(e) => setAvailabilitySettings((prev) => ({
                    ...prev,
                    minAdvanceNoticeMinutes: Number(e.target.value || 0),
                  }))}
                  min="0"
                  max="20160"
                  disabled={availabilityLoading || isSaving}
                />
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
              <h3 className="settings-subsection-title">{t('providerWeeklyAvailabilityBlocksTitle')}</h3>
              <small className="settings-help">{t('providerWeeklyAvailabilityHelp')}</small>

              <div className="settings-group settings-inline-tag-list">
                {WEEK_DAYS.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    className="btn-cancel"
                    onClick={() => addWeekDayBlock(day.key)}
                    disabled={availabilityLoading || isSaving}
                  >
                    {t('providerAddDayBlock', { day: t(day.labelKey) })}
                  </button>
                ))}
              </div>

              {weeklyBlocks.length === 0 && (
                <small className="settings-help">{t('providerNoWeeklyAvailabilityBlocks')}</small>
              )}

              {weeklyBlocks.map((block, index) => (
                <div key={`${block.dayOfWeek}-${index}`} className="settings-surface-block">
                  <label className="settings-label">{t('providerDayLabel')}</label>
                  <select
                    className="settings-select"
                    value={block.dayOfWeek}
                    onChange={(e) => updateWeekDayBlock(index, 'dayOfWeek', Number(e.target.value))}
                    disabled={availabilityLoading || isSaving}
                  >
                    {WEEK_DAYS.map((day) => (
                      <option key={day.key} value={day.key}>{t(day.labelKey)}</option>
                    ))}
                  </select>

                  <label className="settings-label">{t('requestsStartTime')}</label>
                  <input
                    type="time"
                    className="settings-input"
                    value={block.startTime}
                    onChange={(e) => updateWeekDayBlock(index, 'startTime', e.target.value)}
                    disabled={availabilityLoading || isSaving}
                  />

                  <label className="settings-label">{t('requestsEndTime')}</label>
                  <input
                    type="time"
                    className="settings-input"
                    value={block.endTime}
                    onChange={(e) => updateWeekDayBlock(index, 'endTime', e.target.value)}
                    disabled={availabilityLoading || isSaving}
                  />

                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => removeWeekDayBlock(index)}
                    disabled={availabilityLoading || isSaving}
                  >
                    {t('providerRemoveBlock')}
                  </button>
                </div>
              ))}

              <div className="settings-actions">
                <button className="btn-save" onClick={handleAvailabilitySave} disabled={availabilityLoading || isSaving}>
                  {isSaving ? t('saving') : t('providerSaveAvailability')}
                </button>
              </div>

              <div className="settings-section-divider"></div>
              <h3 className="settings-subsection-title">{t('providerDateExceptionsTitle')}</h3>
              <small className="settings-help">{t('providerDateExceptionsHelp')}</small>

              <div className="settings-surface-block">
                <label className="settings-label">{t('providerExceptionDateLabel')}</label>
                <input
                  type="date"
                  className="settings-input"
                  value={newException.exceptionDate}
                  onChange={(e) => setNewException((prev) => ({ ...prev, exceptionDate: e.target.value }))}
                  disabled={exceptionSaving}
                />

                <label className="settings-label">{t('providerExceptionTypeLabel')}</label>
                <select
                  className="settings-select"
                  value={newException.exceptionType}
                  onChange={(e) => setNewException((prev) => ({ ...prev, exceptionType: e.target.value }))}
                  disabled={exceptionSaving}
                >
                  <option value="available">{t('providerExceptionTypeAvailableOverride')}</option>
                  <option value="unavailable">{t('providerExceptionTypeUnavailable')}</option>
                  <option value="booked">{t('providerExceptionTypeBooked')}</option>
                  <option value="vacation">{t('providerExceptionTypeVacation')}</option>
                </select>

                <label className="settings-label">{t('providerExceptionStartTimeOptional')}</label>
                <input
                  type="time"
                  className="settings-input"
                  value={newException.startTime}
                  onChange={(e) => setNewException((prev) => ({ ...prev, startTime: e.target.value }))}
                  disabled={exceptionSaving}
                />

                <label className="settings-label">{t('providerExceptionEndTimeOptional')}</label>
                <input
                  type="time"
                  className="settings-input"
                  value={newException.endTime}
                  onChange={(e) => setNewException((prev) => ({ ...prev, endTime: e.target.value }))}
                  disabled={exceptionSaving}
                />

                <label className="settings-label">{t('providerExceptionReasonOptional')}</label>
                <input
                  type="text"
                  className="settings-input"
                  value={newException.reason}
                  onChange={(e) => setNewException((prev) => ({ ...prev, reason: e.target.value }))}
                  disabled={exceptionSaving}
                  maxLength={255}
                />

                <button type="button" className="btn-save" onClick={handleAddAvailabilityException} disabled={exceptionSaving}>
                  {exceptionSaving ? t('saving') : t('providerAddException')}
                </button>
              </div>

              <div className="settings-group">
                {availabilityExceptions.length === 0 && (
                  <small className="settings-help">{t('providerNoDateExceptionsConfigured')}</small>
                )}
                {availabilityExceptions.map((exception) => (
                  <div key={exception.id} className="settings-surface-block">
                    <p className="settings-metadata-row settings-metadata-strong">
                      {exception.exceptionDate} • {exception.exceptionType}
                    </p>
                    <small className="settings-help">
                      {exception.startTime && exception.endTime
                        ? `${exception.startTime} - ${exception.endTime}`
                        : t('providerWholeDay')}
                      {exception.reason ? ` • ${exception.reason}` : ''}
                    </small>
                    <div className="settings-credential-actions">
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => handleDeleteAvailabilityException(exception.id)}
                        disabled={exceptionSaving}
                      >
                        {t('providerRemoveException')}
                      </button>
                    </div>
                  </div>
                ))}
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
