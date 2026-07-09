import { useState } from 'react';
import '../../styles/AdminPages.css';

function AdminSettings() {
  const [activeSection, setActiveSection] = useState('general');
  
  const [settings, setSettings] = useState({
    siteName: 'SerbisyoToledo',
    siteDescription: 'Local services platform for Toledo City',
    contactEmail: 'admin@serbisyotoledo.com',
    contactPhone: '+63 912 345 6789',
    address: 'Toledo City, Cebu, Philippines',
    maintenanceMode: false,
    allowRegistration: true,
    requireEmailVerification: true,
    autoApproveProviders: false,
    maxReportsBeforeBan: 3,
    sessionTimeout: 30,
    enableNotifications: true,
    enableEmailAlerts: true,
    enableSMS: false
  });

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Save settings to API
    console.log('Saving settings:', settings);
    alert('Settings saved successfully!');
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage system configuration and preferences</p>
      </div>

      <div className="settings-layout">
        {/* Settings Navigation */}
        <div className="settings-nav">
          <button 
            className={`settings-nav-item ${activeSection === 'general' ? 'active' : ''}`}
            onClick={() => setActiveSection('general')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            General
          </button>
          <button 
            className={`settings-nav-item ${activeSection === 'users' ? 'active' : ''}`}
            onClick={() => setActiveSection('users')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Users & Access
          </button>
          <button 
            className={`settings-nav-item ${activeSection === 'security' ? 'active' : ''}`}
            onClick={() => setActiveSection('security')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Security
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
          {activeSection === 'general' && (
            <div className="settings-section">
              <h2 className="settings-section-title">General Settings</h2>
              
              <div className="settings-group">
                <label className="settings-label">Site Name</label>
                <input
                  type="text"
                  className="settings-input"
                  value={settings.siteName}
                  onChange={(e) => handleChange('siteName', e.target.value)}
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Site Description</label>
                <textarea
                  className="settings-textarea"
                  value={settings.siteDescription}
                  onChange={(e) => handleChange('siteDescription', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Contact Email</label>
                <input
                  type="email"
                  className="settings-input"
                  value={settings.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Contact Phone</label>
                <input
                  type="tel"
                  className="settings-input"
                  value={settings.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                />
              </div>

              <div className="settings-group">
                <label className="settings-label">Address</label>
                <input
                  type="text"
                  className="settings-input"
                  value={settings.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                />
              </div>

              <div className="settings-toggle-group">
                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Maintenance Mode</span>
                    <small>Temporarily disable the site for maintenance</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.maintenanceMode}
                      onChange={(e) => handleChange('maintenanceMode', e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'users' && (
            <div className="settings-section">
              <h2 className="settings-section-title">Users & Access Settings</h2>
              
              <div className="settings-toggle-group">
                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Allow New Registrations</span>
                    <small>Enable or disable new user registrations</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.allowRegistration}
                      onChange={(e) => handleChange('allowRegistration', e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Require Email Verification</span>
                    <small>Users must verify email before accessing the platform</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.requireEmailVerification}
                      onChange={(e) => handleChange('requireEmailVerification', e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div className="settings-toggle">
                  <label className="toggle-label">
                    <span>Auto-Approve Service Providers</span>
                    <small>Automatically approve new service provider registrations</small>
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.autoApproveProviders}
                      onChange={(e) => handleChange('autoApproveProviders', e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">Max Reports Before Auto-Ban</label>
                <input
                  type="number"
                  className="settings-input"
                  value={settings.maxReportsBeforeBan}
                  onChange={(e) => handleChange('maxReportsBeforeBan', parseInt(e.target.value))}
                  min={1}
                  max={10}
                />
                <small className="settings-help">Number of reports before a user is automatically suspended</small>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="settings-section">
              <h2 className="settings-section-title">Security Settings</h2>
              
              <div className="settings-group">
                <label className="settings-label">Session Timeout (minutes)</label>
                <input
                  type="number"
                  className="settings-input"
                  value={settings.sessionTimeout}
                  onChange={(e) => handleChange('sessionTimeout', parseInt(e.target.value))}
                  min={5}
                  max={120}
                />
                <small className="settings-help">Time of inactivity before automatic logout</small>
              </div>

              <div className="settings-group">
                <label className="settings-label">Password Requirements</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input type="checkbox" checked readOnly />
                    Minimum 6 characters
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" />
                    Require uppercase letter
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" />
                    Require number
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" />
                    Require special character
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
                    <span>Enable Push Notifications</span>
                    <small>Send browser push notifications to users</small>
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
                    <span>Enable Email Alerts</span>
                    <small>Send email notifications for important events</small>
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
                    <span>Enable SMS Notifications</span>
                    <small>Send SMS for critical alerts (additional charges may apply)</small>
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

export default AdminSettings;
