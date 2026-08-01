import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI, getUser, userProfileAPI } from '../services/api';
import ThemeToggle from '../components/common/ThemeToggle';
import SettingsFlash from '../components/settings/SettingsFlash';
import '../styles/UserSettings.css';

function ClientSettings() {
  const navigate = useNavigate();
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
      setFlash({ type: 'info', message: 'No changes to save.' });
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
        setFlash({ type: 'success', message: 'Profile settings saved successfully.' });
      }
    } catch (err) {
      setFlash({ type: 'error', message: err.message || 'Failed to save profile settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (initialProfile) {
      setSettings(initialProfile);
      setFlash({ type: 'info', message: 'Changes were reset.' });
    }
  };

  const handleResendVerification = async () => {
    if (isVerificationResendDisabled) {
      setFlash({ type: 'info', message: 'Resend verification email is temporarily disabled.' });
      return;
    }

    if (!settings.email) {
      setFlash({ type: 'error', message: 'No email address available for verification.' });
      return;
    }

    try {
      setIsSendingVerification(true);
      setFlash({ type: 'info', message: '' });
      await authAPI.resendVerification({ email: settings.email });
      setFlash({ type: 'success', message: 'Verification email sent. Please check your inbox.' });
    } catch (err) {
      setFlash({ type: 'error', message: err.message || 'Failed to send verification email.' });
    } finally {
      setIsSendingVerification(false);
    }
  };

  return (
    <div className="user-settings-container">
      <div className="page-header">
        <h1 className="page-title">Client Settings</h1>
        <p className="page-subtitle">Update your account details and security actions.</p>
        <div className="settings-theme-row">
          <span className="settings-theme-label">Appearance</span>
          <ThemeToggle />
        </div>
      </div>

      <div className="settings-layout">
        <div className="settings-nav">
          <button
            className={`settings-nav-item ${activeSection === 'account' ? 'active' : ''}`}
            onClick={() => setActiveSection('account')}
          >
            Account
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'contact' ? 'active' : ''}`}
            onClick={() => setActiveSection('contact')}
          >
            Contact
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'security' ? 'active' : ''}`}
            onClick={() => setActiveSection('security')}
          >
            Security
          </button>
        </div>

        <div className="settings-content">
          <SettingsFlash type={flash.type} message={flash.message} />

          {activeSection === 'account' && (
            <div className="settings-section">
              <h2 className="settings-section-title">Account Details</h2>

              <div className="settings-group">
                <label className="settings-label" htmlFor="client-full-name">Full Name</label>
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
                <label className="settings-label" htmlFor="client-email">Email Address</label>
                <input
                  id="client-email"
                  type="email"
                  className="settings-input"
                  value={settings.email}
                  readOnly
                  autoComplete="email"
                  disabled
                />
                <small className="settings-help">Email changes are not supported from settings.</small>
              </div>

              <div className="settings-group">
                <label className="settings-label" htmlFor="client-bio">Bio</label>
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
                  Account created: {new Date(settings.createdAt).toLocaleDateString()}
                </small>
              )}
            </div>
          )}

          {activeSection === 'contact' && (
            <div className="settings-section">
              <h2 className="settings-section-title">Contact Information</h2>

              <div className="settings-group">
                <label className="settings-label" htmlFor="client-phone">Phone Number</label>
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
                <label className="settings-label" htmlFor="client-address">Address</label>
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
              <h2 className="settings-section-title">Security Actions</h2>

              <div className="settings-card">
                <p>
                  Email verification status: <strong>{settings.isVerified ? 'Verified' : 'Not verified'}</strong>
                </p>
                <p className="settings-help">Resend verification email is temporarily disabled.</p>
                {!settings.isVerified && (
                  <div className="settings-inline-actions">
                    <button
                      className="btn-secondary"
                      onClick={handleResendVerification}
                      disabled={isSendingVerification || isVerificationResendDisabled}
                      type="button"
                    >
                      {isSendingVerification ? 'Sending...' : 'Resend Verification Email'}
                    </button>
                  </div>
                )}
              </div>

              <div className="settings-card">
                <p>Need to change your password? Use the secure reset flow.</p>
                <div className="settings-inline-actions">
                  <button className="btn-change-password" onClick={() => navigate('/forgot-password')}>
                    Open Password Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="settings-actions">
            <button className="btn-save" onClick={handleSave} disabled={isSaving || isLoadingProfile || !hasProfileChanges}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn-cancel" onClick={handleReset} disabled={isSaving || isLoadingProfile || !hasProfileChanges}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClientSettings;
