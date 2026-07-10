import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, userProfileAPI } from '../services/api';
import '../styles/UserSettings.css';

function ClientSettings() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('account');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  
  const [settings, setSettings] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    enableNotifications: true,
    enableEmailAlerts: true,
    enableSMS: false,
    profileVisibility: 'public',
    allowMessages: true,
    showContactInfo: false
  });

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.userType !== 'client') {
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
            address: profile.address || '',
          }));
        }
      } catch (err) {
        setSettings(prev => ({
          ...prev,
          fullName: currentUser.fullName || '',
          email: currentUser.email || '',
          phone: currentUser.phone || '',
          address: currentUser.address || '',
        }));
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const submitData = new FormData();
      submitData.append('fullName', settings.fullName || '');
      submitData.append('phone', settings.phone || '');
      submitData.append('address', settings.address || '');

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

  return (
    <div className="user-settings-container">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account and preferences</p>
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
            className={`settings-nav-item ${activeSection === 'address' ? 'active' : ''}`}
            onClick={() => setActiveSection('address')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            Address
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
                <small className="settings-help">Your email address is used for login and notifications</small>
              </div>

              <div className="settings-group">
                <label className="settings-label">Phone Number</label>
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

          {activeSection === 'address' && (
            <div className="settings-section">
              <h2 className="settings-section-title">Address Information</h2>
              
              <div className="settings-group">
                <label className="settings-label">Street Address</label>
                <input
                  type="text"
                  className="settings-input"
                  value={settings.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="123 Main Street"
                  disabled={isLoadingProfile || isSaving}
                />
              </div>

              <div className="settings-row">
                <div className="settings-group">
                  <label className="settings-label">City</label>
                  <input
                    type="text"
                    className="settings-input"
                    value={settings.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="Toledo"
                  />
                </div>

                <div className="settings-group">
                  <label className="settings-label">Postal Code</label>
                  <input
                    type="text"
                    className="settings-input"
                    value={settings.postalCode}
                    onChange={(e) => handleChange('postalCode', e.target.value)}
                    placeholder="6000"
                  />
                </div>
              </div>

              <small className="settings-help">This address is used for service requests and location-based features</small>
            </div>
          )}

          {activeSection === 'privacy' && (
            <div className="settings-section">
              <h2 className="settings-section-title">Privacy Settings</h2>
              
              <div className="settings-toggle-group">
                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Profile Visibility</span>
                    <small>Who can see your profile</small>
                  </label>
                  <select 
                    className="settings-select"
                    value={settings.profileVisibility}
                    onChange={(e) => handleChange('profileVisibility', e.target.value)}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="friends">Friends Only</option>
                  </select>
                </div>

                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Allow Messages from Service Providers</span>
                    <small>Receive direct messages and service offers</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.allowMessages}
                      onChange={(e) => handleChange('allowMessages', e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Show Contact Information</span>
                    <small>Display your phone number and address to service providers</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.showContactInfo}
                      onChange={(e) => handleChange('showContactInfo', e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
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
                    <small>Receive browser notifications for important updates</small>
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
                    <small>Get notified about service requests and messages via email</small>
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
                    <small>Send SMS for urgent service updates (may incur charges)</small>
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

export default ClientSettings;
