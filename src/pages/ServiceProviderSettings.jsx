import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, userProfileAPI, serviceProfileAPI } from '../services/api';
import ThemeToggle from '../components/common/ThemeToggle';
import '../styles/UserSettings.css';

const LANGUAGE_OPTIONS = [
  { value: 'ceb', label: 'Cebuano' },
  { value: 'en', label: 'English' },
  { value: 'fil', label: 'Filipino' },
];

const WEEK_DAYS = [
  { key: 1, label: 'Monday' },
  { key: 2, label: 'Tuesday' },
  { key: 3, label: 'Wednesday' },
  { key: 4, label: 'Thursday' },
  { key: 5, label: 'Friday' },
  { key: 6, label: 'Saturday' },
  { key: 0, label: 'Sunday' },
];

function ServiceProviderSettings() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('account');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [languageSaving, setLanguageSaving] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(true);
  const [credentials, setCredentials] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [availabilitySettings, setAvailabilitySettings] = useState({
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
    businessName: '',
    businessAddress: '',
    businessCity: '',
    businessPhone: '',
    serviceArea: 'Toledo City',
    availability: 'available',
    enableNotifications: true,
    enableEmailAlerts: true,
    enableSMS: false,
    profileVisibility: 'public',
    allowDirectMessages: true,
    autoAcceptRequests: false,
    showAvailability: true,
    minimumJobAmount: ''
  });

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.userType !== 'tradesperson') {
      navigate('/');
      return;
    }

    const loadProfile = async () => {
      setIsLoadingProfile(true);
      try {
        const response = await userProfileAPI.getProfile();
        if (response.success) {
          const profile = response.data;
          setSettings(prev => ({
            ...prev,
            fullName: profile.fullName || '',
            email: profile.email || currentUser.email || '',
            phone: profile.phone || '',
            businessAddress: profile.address || '',
          }));
        }
      } catch {
        setSettings(prev => ({
          ...prev,
          fullName: currentUser.fullName || '',
          email: currentUser.email || '',
          phone: currentUser.phone || '',
          businessAddress: currentUser.address || '',
        }));
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, [navigate]);

  useEffect(() => {
    const loadStageOneData = async () => {
      try {
        setAvailabilityLoading(true);
        setCredentialLoading(true);

        const [availabilityResponse, languagesResponse, credentialsResponse] = await Promise.all([
          serviceProfileAPI.getMyAvailability(),
          serviceProfileAPI.getMyLanguages(),
          serviceProfileAPI.getMyCredentials(),
        ]);

        if (availabilityResponse.success && availabilityResponse.data) {
          const s = availabilityResponse.data.settings || {};
          setAvailabilitySettings({
            allowSameDayBooking: Boolean(s.allow_same_day_booking ?? s.allowSameDayBooking),
            minAdvanceNoticeMinutes: Number(s.min_advance_notice_minutes ?? s.minAdvanceNoticeMinutes ?? 720),
            maxAdvanceBookingDays: Number(s.max_advance_booking_days ?? s.maxAdvanceBookingDays ?? 60),
          });

          const blocks = Array.isArray(availabilityResponse.data.weeklyBlocks) ? availabilityResponse.data.weeklyBlocks : [];
          setWeeklyBlocks(blocks.map((b) => ({
            dayOfWeek: Number(b.day_of_week ?? b.dayOfWeek),
            startTime: String(b.start_time ?? b.startTime ?? '').slice(0, 5),
            endTime: String(b.end_time ?? b.endTime ?? '').slice(0, 5),
            isAvailable: b.is_available !== false,
          })));

          const exceptions = Array.isArray(availabilityResponse.data.exceptions) ? availabilityResponse.data.exceptions : [];
          setAvailabilityExceptions(exceptions.map((ex) => ({
            id: ex.id,
            exceptionDate: String(ex.exception_date ?? ex.exceptionDate ?? '').slice(0, 10),
            exceptionType: ex.exception_type ?? ex.exceptionType ?? 'unavailable',
            startTime: String(ex.start_time ?? ex.startTime ?? '').slice(0, 5),
            endTime: String(ex.end_time ?? ex.endTime ?? '').slice(0, 5),
            reason: ex.reason || '',
          })));
        }

        if (languagesResponse.success) {
          setSelectedLanguages(languagesResponse.data?.languages || []);
        }

        if (credentialsResponse.success) {
          setCredentials(credentialsResponse.data?.credentials || []);
        }
      } catch (err) {
        console.error('Failed to load provider settings extensions:', err);
      } finally {
        setAvailabilityLoading(false);
        setCredentialLoading(false);
      }
    };

    loadStageOneData();
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const submitData = new FormData();
      submitData.append('fullName', settings.fullName || '');
      submitData.append('phone', settings.phone || '');
      submitData.append('address', settings.businessAddress || '');

      const response = await userProfileAPI.updateProfile(submitData);
      if (response.success) {
        alert('Settings saved successfully!');
      }
    } catch (err) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvailabilitySave = async () => {
    try {
      setIsSaving(true);
      await serviceProfileAPI.saveMyAvailability({
        settings: availabilitySettings,
        weeklyBlocks,
      });
      alert('Availability updated successfully.');
    } catch (err) {
      alert(err.message || 'Failed to save availability settings');
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
      await serviceProfileAPI.updateMyLanguages(selectedLanguages);
      alert('Languages updated successfully.');
    } catch (err) {
      alert(err.message || 'Failed to update languages');
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
    setWeeklyBlocks((prev) => prev.map((block, i) => (i === index ? { ...block, [key]: value } : block)));
  };

  const removeWeekDayBlock = (index) => {
    setWeeklyBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAvailabilityException = async () => {
    if (!newException.exceptionDate) {
      alert('Please choose an exception date.');
      return;
    }

    if ((newException.startTime && !newException.endTime) || (!newException.startTime && newException.endTime)) {
      alert('Provide both start and end time, or leave both blank for whole-day exception.');
      return;
    }

    try {
      setExceptionSaving(true);
      await serviceProfileAPI.addAvailabilityException({
        exceptionDate: newException.exceptionDate,
        exceptionType: newException.exceptionType,
        startTime: newException.startTime || null,
        endTime: newException.endTime || null,
        reason: newException.reason.trim() || null,
      });

      const refreshed = await serviceProfileAPI.getMyAvailability();
      if (refreshed.success && refreshed.data) {
        const exceptions = Array.isArray(refreshed.data.exceptions) ? refreshed.data.exceptions : [];
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
    } catch (err) {
      alert(err.message || 'Failed to add availability exception');
    } finally {
      setExceptionSaving(false);
    }
  };

  const handleDeleteAvailabilityException = async (exceptionId) => {
    try {
      setExceptionSaving(true);
      await serviceProfileAPI.deleteAvailabilityException(exceptionId);
      setAvailabilityExceptions((prev) => prev.filter((item) => Number(item.id) !== Number(exceptionId)));
    } catch (err) {
      alert(err.message || 'Failed to delete exception');
    } finally {
      setExceptionSaving(false);
    }
  };

  const handleCreateCredential = async () => {
    if (!newCredential.credentialName.trim() || !newCredential.credentialType.trim()) {
      alert('Credential name and type are required.');
      return;
    }

    try {
      setCredentialSaving(true);
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
      alert('Credential saved successfully. Submit it for review when ready.');
    } catch (err) {
      alert(err.message || 'Failed to create credential');
    } finally {
      setCredentialSaving(false);
    }
  };

  const handleSubmitCredential = async (credentialId) => {
    try {
      setCredentialSaving(true);
      await serviceProfileAPI.submitCredentialForReview(credentialId);
      const updated = await serviceProfileAPI.getMyCredentials();
      if (updated.success) {
        setCredentials(updated.data?.credentials || []);
      }
      alert('Credential submitted for review.');
    } catch (err) {
      alert(err.message || 'Failed to submit credential');
    } finally {
      setCredentialSaving(false);
    }
  };

  return (
    <div className="user-settings-container">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your business and account preferences</p>
        <div className="settings-theme-row">
          <span className="settings-theme-label">Appearance</span>
          <ThemeToggle />
        </div>
      </div>

      <div className="settings-layout">
        {/* Settings Navigation */}
        <div className="settings-nav">
          <button 
            className={`settings-nav-item ${activeSection === 'account' ? 'active' : ''}`}
            onClick={() => setActiveSection('account')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Account
          </button>
          <button 
            className={`settings-nav-item ${activeSection === 'business' ? 'active' : ''}`}
            data-tour="provider-business-tab"
            onClick={() => setActiveSection('business')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path>
            </svg>
            Business
          </button>
          <button 
            className={`settings-nav-item ${activeSection === 'availability' ? 'active' : ''}`}
            data-tour="provider-availability-tab"
            onClick={() => setActiveSection('availability')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1"></circle>
              <path d="M12 1v6m0 6v6"></path>
              <path d="M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24"></path>
              <path d="M1 12h6m6 0h6"></path>
              <path d="M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"></path>
            </svg>
            Availability
          </button>
          <button 
            className={`settings-nav-item ${activeSection === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveSection('notifications')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            Notifications
          </button>
          <button 
            className={`settings-nav-item ${activeSection === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveSection('privacy')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Privacy
          </button>
        </div>

        {/* Settings Content */}
        <div className="settings-content">
          {activeSection === 'account' && (
            <div className="settings-section">
              <h2 className="settings-section-title">Account Settings</h2>
              
              <div className="settings-group">
                <label className="settings-label">Full Name</label>
                <input
                  type="text"
                  className="settings-input"
                  value={settings.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  placeholder="Your full name"
                  disabled={isLoadingProfile || isSaving}
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Email Address</label>
                <input
                  type="email"
                  className="settings-input"
                  value={settings.email}
                  readOnly
                  placeholder="your.email@example.com"
                  disabled
                />
                <small className="settings-help">Your email address is used for login and service notifications</small>
              </div>

              <div className="settings-group">
                <label className="settings-label">Personal Phone Number</label>
                <input
                  type="tel"
                  className="settings-input"
                  value={settings.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+63 912 345 6789"
                  disabled={isLoadingProfile || isSaving}
                />
              </div>

              <div className="settings-section-divider"></div>

              <h3 className="settings-subsection-title">Password & Security</h3>
              <button className="btn-change-password">
                Change Password
              </button>
              <small className="settings-help">Keep your account secure by using a strong, unique password</small>
            </div>
          )}

          {activeSection === 'business' && (
            <div className="settings-section">
              <h2 className="settings-section-title">Business Information</h2>
              
              <div className="settings-group">
                <label className="settings-label">Business Name</label>
                <input
                  type="text"
                  className="settings-input"
                  value={settings.businessName}
                  onChange={(e) => handleChange('businessName', e.target.value)}
                  placeholder="Your business name"
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Business Phone Number</label>
                <input
                  type="tel"
                  className="settings-input"
                  value={settings.businessPhone}
                  onChange={(e) => handleChange('businessPhone', e.target.value)}
                  placeholder="+63 912 345 6789"
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Business Address</label>
                <input
                  type="text"
                  className="settings-input"
                  value={settings.businessAddress}
                  onChange={(e) => handleChange('businessAddress', e.target.value)}
                  placeholder="123 Business Street"
                  disabled={isLoadingProfile || isSaving}
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Business City</label>
                <input
                  type="text"
                  className="settings-input"
                  value={settings.businessCity}
                  onChange={(e) => handleChange('businessCity', e.target.value)}
                  placeholder="Toledo"
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Minimum Job Amount (₱)</label>
                <input
                  type="number"
                  className="settings-input"
                  value={settings.minimumJobAmount}
                  onChange={(e) => handleChange('minimumJobAmount', e.target.value)}
                  placeholder="500"
                  min="0"
                />
                <small className="settings-help">Leave blank for no minimum. Clients can still request, but you can decline.</small>
              </div>

              <div className="settings-group">
                <label className="settings-label">Service Area</label>
                <select 
                  className="settings-select"
                  value={settings.serviceArea}
                  onChange={(e) => handleChange('serviceArea', e.target.value)}
                >
                  <option value="Toledo City">Toledo City</option>
                  <option value="Toledo City + Barangays">Toledo City + Barangays</option>
                  <option value="Extended Area">Extended Area (30km)</option>
                  <option value="Province-wide">Province-wide</option>
                </select>
              </div>
            </div>
          )}

          {activeSection === 'availability' && (
            <div className="settings-section">
              <h2 className="settings-section-title">Availability & Job Settings</h2>
              
              <div className="settings-toggle-group">
                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Availability Status</span>
                    <small>Let clients know if you're currently accepting jobs</small>
                  </label>
                  <select 
                    className="settings-select"
                    value={settings.availability}
                    onChange={(e) => handleChange('availability', e.target.value)}
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy (Limited)</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>

                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Show Availability Status</span>
                    <small>Display your availability on your profile</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.showAvailability}
                      onChange={(e) => handleChange('showAvailability', e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Auto-Accept Service Requests</span>
                    <small>Automatically accept requests from verified clients</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.autoAcceptRequests}
                      onChange={(e) => handleChange('autoAcceptRequests', e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              <div className="settings-section-divider"></div>
              <h3 className="settings-subsection-title">Booking Configuration</h3>

              <div className="settings-group">
                <label className="settings-label">Allow same-day booking</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={availabilitySettings.allowSameDayBooking}
                    onChange={(e) => setAvailabilitySettings((prev) => ({ ...prev, allowSameDayBooking: e.target.checked }))}
                    disabled={availabilityLoading || isSaving}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="settings-group">
                <label className="settings-label">Minimum advance notice (minutes)</label>
                <input
                  type="number"
                  className="settings-input"
                  value={availabilitySettings.minAdvanceNoticeMinutes}
                  onChange={(e) => setAvailabilitySettings((prev) => ({ ...prev, minAdvanceNoticeMinutes: Number(e.target.value || 0) }))}
                  min="0"
                  max="20160"
                  disabled={availabilityLoading || isSaving}
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Maximum advance booking days</label>
                <input
                  type="number"
                  className="settings-input"
                  value={availabilitySettings.maxAdvanceBookingDays}
                  onChange={(e) => setAvailabilitySettings((prev) => ({ ...prev, maxAdvanceBookingDays: Number(e.target.value || 1) }))}
                  min="1"
                  max="365"
                  disabled={availabilityLoading || isSaving}
                />
              </div>

              <div className="settings-section-divider"></div>
              <h3 className="settings-subsection-title">Weekly Availability Blocks</h3>

              <div className="settings-group">
                {WEEK_DAYS.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    className="btn-cancel"
                    style={{ marginRight: '0.5rem', marginBottom: '0.5rem' }}
                    onClick={() => addWeekDayBlock(day.key)}
                    disabled={availabilityLoading || isSaving}
                  >
                    Add {day.label}
                  </button>
                ))}
              </div>

              {weeklyBlocks.length === 0 && (
                <small className="settings-help">No weekly availability blocks yet.</small>
              )}

              {weeklyBlocks.map((block, index) => (
                <div key={`${block.dayOfWeek}-${index}`} className="settings-group" style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.75rem' }}>
                  <label className="settings-label">Day</label>
                  <select
                    className="settings-select"
                    value={block.dayOfWeek}
                    onChange={(e) => updateWeekDayBlock(index, 'dayOfWeek', Number(e.target.value))}
                    disabled={availabilityLoading || isSaving}
                  >
                    {WEEK_DAYS.map((day) => (
                      <option key={day.key} value={day.key}>{day.label}</option>
                    ))}
                  </select>

                  <label className="settings-label">Start time</label>
                  <input
                    type="time"
                    className="settings-input"
                    value={block.startTime}
                    onChange={(e) => updateWeekDayBlock(index, 'startTime', e.target.value)}
                    disabled={availabilityLoading || isSaving}
                  />

                  <label className="settings-label">End time</label>
                  <input
                    type="time"
                    className="settings-input"
                    value={block.endTime}
                    onChange={(e) => updateWeekDayBlock(index, 'endTime', e.target.value)}
                    disabled={availabilityLoading || isSaving}
                  />

                  <button type="button" className="btn-cancel" onClick={() => removeWeekDayBlock(index)} disabled={availabilityLoading || isSaving}>
                    Remove Block
                  </button>
                </div>
              ))}

              <div className="settings-actions" style={{ paddingLeft: 0, paddingRight: 0 }}>
                <button className="btn-save" onClick={handleAvailabilitySave} disabled={availabilityLoading || isSaving}>
                  {isSaving ? 'Saving...' : 'Save Availability'}
                </button>
              </div>

              <div className="settings-section-divider"></div>
              <h3 className="settings-subsection-title">Date Exceptions</h3>

              <div className="settings-group" style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.75rem' }}>
                <label className="settings-label">Exception date</label>
                <input
                  type="date"
                  className="settings-input"
                  value={newException.exceptionDate}
                  onChange={(e) => setNewException((prev) => ({ ...prev, exceptionDate: e.target.value }))}
                  disabled={exceptionSaving}
                />

                <label className="settings-label">Exception type</label>
                <select
                  className="settings-select"
                  value={newException.exceptionType}
                  onChange={(e) => setNewException((prev) => ({ ...prev, exceptionType: e.target.value }))}
                  disabled={exceptionSaving}
                >
                  <option value="available">Available override</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="booked">Booked</option>
                  <option value="vacation">Vacation</option>
                </select>

                <label className="settings-label">Start time (optional)</label>
                <input
                  type="time"
                  className="settings-input"
                  value={newException.startTime}
                  onChange={(e) => setNewException((prev) => ({ ...prev, startTime: e.target.value }))}
                  disabled={exceptionSaving}
                />

                <label className="settings-label">End time (optional)</label>
                <input
                  type="time"
                  className="settings-input"
                  value={newException.endTime}
                  onChange={(e) => setNewException((prev) => ({ ...prev, endTime: e.target.value }))}
                  disabled={exceptionSaving}
                />

                <label className="settings-label">Reason (optional)</label>
                <input
                  type="text"
                  className="settings-input"
                  value={newException.reason}
                  onChange={(e) => setNewException((prev) => ({ ...prev, reason: e.target.value }))}
                  disabled={exceptionSaving}
                  maxLength={255}
                />

                <button type="button" className="btn-save" onClick={handleAddAvailabilityException} disabled={exceptionSaving}>
                  {exceptionSaving ? 'Saving...' : 'Add Exception'}
                </button>
              </div>

              <div className="settings-group">
                {availabilityExceptions.length === 0 && <small className="settings-help">No date exceptions configured.</small>}
                {availabilityExceptions.map((exception) => (
                  <div key={exception.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.75rem', marginBottom: '0.5rem' }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{exception.exceptionDate} • {exception.exceptionType}</p>
                    <small className="settings-help">
                      {exception.startTime && exception.endTime ? `${exception.startTime} - ${exception.endTime}` : 'Whole day'}
                      {exception.reason ? ` • ${exception.reason}` : ''}
                    </small>
                    <div style={{ marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => handleDeleteAvailabilityException(exception.id)}
                        disabled={exceptionSaving}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="settings-section-divider"></div>
              <h3 className="settings-subsection-title">Languages</h3>

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
                    {option.label}
                  </label>
                ))}
              </div>

              <div className="settings-actions" style={{ paddingLeft: 0, paddingRight: 0 }}>
                <button className="btn-save" onClick={handleSaveLanguages} disabled={languageSaving}>
                  {languageSaving ? 'Saving...' : 'Save Languages'}
                </button>
              </div>

              <div className="settings-section-divider"></div>
              <h3 className="settings-subsection-title">Credentials and Certificates</h3>

              <div className="settings-group">
                <label className="settings-label">Credential name</label>
                <input
                  type="text"
                  className="settings-input"
                  value={newCredential.credentialName}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, credentialName: e.target.value }))}
                  disabled={credentialSaving}
                />

                <label className="settings-label">Credential type</label>
                <input
                  type="text"
                  className="settings-input"
                  value={newCredential.credentialType}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, credentialType: e.target.value }))}
                  disabled={credentialSaving}
                />

                <label className="settings-label">Issuing organization</label>
                <input
                  type="text"
                  className="settings-input"
                  value={newCredential.issuingOrganization}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, issuingOrganization: e.target.value }))}
                  disabled={credentialSaving}
                />

                <label className="settings-label">Credential ID</label>
                <input
                  type="text"
                  className="settings-input"
                  value={newCredential.credentialId}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, credentialId: e.target.value }))}
                  disabled={credentialSaving}
                />

                <label className="settings-label">Issue date</label>
                <input
                  type="date"
                  className="settings-input"
                  value={newCredential.issueDate}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, issueDate: e.target.value }))}
                  disabled={credentialSaving}
                />

                <label className="settings-label">Expiration date</label>
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
                  This credential does not expire
                </label>

                <label className="settings-label">Credential URL</label>
                <input
                  type="url"
                  className="settings-input"
                  value={newCredential.credentialUrl}
                  onChange={(e) => setNewCredential((prev) => ({ ...prev, credentialUrl: e.target.value }))}
                  disabled={credentialSaving}
                />

                <label className="settings-label">Document (PDF/JPG/PNG)</label>
                <input
                  type="file"
                  className="settings-input"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setCredentialFile(e.target.files?.[0] || null)}
                  disabled={credentialSaving}
                />
              </div>

              <div className="settings-actions" style={{ paddingLeft: 0, paddingRight: 0 }}>
                <button className="btn-save" onClick={handleCreateCredential} disabled={credentialSaving}>
                  {credentialSaving ? 'Saving...' : 'Add Credential'}
                </button>
              </div>

              <div className="settings-group">
                <h4 className="settings-subsection-title" style={{ marginBottom: '0.5rem' }}>Saved Credentials</h4>
                {credentialLoading && <small className="settings-help">Loading credentials...</small>}
                {!credentialLoading && credentials.length === 0 && <small className="settings-help">No credentials yet.</small>}
                {credentials.map((credential) => (
                  <div key={credential.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.75rem', marginBottom: '0.6rem' }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{credential.credential_name}</p>
                    <small className="settings-help">{credential.credential_type} • {credential.verification_status}</small>
                    {credential.verification_notes && <p style={{ marginTop: '0.35rem' }}>{credential.verification_notes}</p>}
                    <div style={{ marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn-save"
                        onClick={() => handleSubmitCredential(credential.id)}
                        disabled={credentialSaving || credential.verification_status === 'pending'}
                        style={{ minHeight: '40px' }}
                      >
                        {credential.verification_status === 'pending' ? 'Pending Review' : 'Submit for Review'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="settings-section">
              <h2 className="settings-section-title">Notification Settings</h2>
              
              <div className="settings-toggle-group">
                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Push Notifications</span>
                    <small>Receive browser notifications for new service requests</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.enableNotifications}
                      onChange={(e) => handleChange('enableNotifications', e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Email Alerts</span>
                    <small>Get notified about new requests and messages via email</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.enableEmailAlerts}
                      onChange={(e) => handleChange('enableEmailAlerts', e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>SMS Notifications</span>
                    <small>Get urgent alerts via SMS (may incur charges)</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.enableSMS}
                      onChange={(e) => handleChange('enableSMS', e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'privacy' && (
            <div className="settings-section">
              <h2 className="settings-section-title">Privacy Settings</h2>
              
              <div className="settings-toggle-group">
                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Profile Visibility</span>
                    <small>Who can see your profile and services</small>
                  </label>
                  <select 
                    className="settings-select"
                    value={settings.profileVisibility}
                    onChange={(e) => handleChange('profileVisibility', e.target.value)}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private (By Appointment)</option>
                    <option value="verified-only">Verified Clients Only</option>
                  </select>
                </div>

                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Allow Direct Messages</span>
                    <small>Allow clients to send you direct messages</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.allowDirectMessages}
                      onChange={(e) => handleChange('allowDirectMessages', e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="settings-actions">
            <button className="btn-save" onClick={handleSave} disabled={isSaving || isLoadingProfile}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn-cancel" onClick={() => window.location.reload()}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServiceProviderSettings;
