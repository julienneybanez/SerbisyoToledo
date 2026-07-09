import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser } from '../services/api';
import '../styles/UserSettings.css';

function ServiceProviderSettings() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('account');
  const [user, setUser] = useState(null);
  
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
    setUser(currentUser);
    
    setSettings(prev => ({
      ...prev,
      fullName: currentUser.fullName || '',
      email: currentUser.email || '',
      phone: currentUser.phone || '',
      businessName: currentUser.businessName || '',
      businessAddress: currentUser.businessAddress || '',
      businessCity: currentUser.businessCity || '',
      businessPhone: currentUser.businessPhone || ''
    }));
  }, [navigate]);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Save settings to API
    console.log('Saving service provider settings:', settings);
    alert('Settings saved successfully!');
  };

  return (
    <div className="user-settings-container">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your business and account preferences</p>
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
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Email Address</label>
                <input
                  type="email"
                  className="settings-input"
                  value={settings.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="your.email@example.com"
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
            <button className="btn-save" onClick={handleSave}>
              Save Changes
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
