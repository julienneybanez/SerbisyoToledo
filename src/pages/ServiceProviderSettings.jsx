import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VerificationRequestModal from '../components/common/VerificationRequestModal';
import ThemeToggle from '../components/common/ThemeToggle';
import SettingsFlash from '../components/settings/SettingsFlash';
import { getUser, serviceProfileAPI, userProfileAPI } from '../services/api';
import '../styles/UserSettings.css';

const toCommaSeparated = (value) => (Array.isArray(value) ? value.join(', ') : '');
const fromCommaSeparated = (value) => (
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);

function ServiceProviderSettings() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('account');

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPortfolio, setIsSavingPortfolio] = useState(false);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const [showVerificationRequest, setShowVerificationRequest] = useState(false);
  const [flash, setFlash] = useState({ type: 'info', message: '' });

  const [accountDraft, setAccountDraft] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    isVerified: false,
  });
  const [initialAccountDraft, setInitialAccountDraft] = useState(null);

  const [serviceProfileDraft, setServiceProfileDraft] = useState({
    fullName: '',
    barangayAddress: '',
    startingPrice: '',
    description: '',
    serviceCategories: '',
    isPublished: false,
  });

  const [portfolioDraft, setPortfolioDraft] = useState({
    aboutMe: '',
    responseTime: 'Within 24 hours',
    skills: '',
    portfolioCount: 0,
  });

  const [hasServiceProfile, setHasServiceProfile] = useState(false);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.userType !== 'tradesperson') {
      navigate('/');
      return;
    }

    const loadSettings = async () => {
      setIsLoading(true);
      setFlash({ type: 'info', message: '' });

      const [profileResult, serviceProfileResult, portfolioResult] = await Promise.allSettled([
        userProfileAPI.getProfile(),
        serviceProfileAPI.getMyProfile(),
        serviceProfileAPI.getMyPortfolio(),
      ]);

      if (profileResult.status === 'fulfilled' && profileResult.value.success) {
        const profile = profileResult.value.data;
        const accountData = {
          fullName: profile.fullName || currentUser.fullName || '',
          email: profile.email || currentUser.email || '',
          phone: profile.phone || '',
          address: profile.address || '',
          bio: profile.bio || '',
          isVerified: Boolean(currentUser.isVerified),
        };
        setAccountDraft(accountData);
        setInitialAccountDraft(accountData);
      } else {
        const fallback = {
          fullName: currentUser.fullName || '',
          email: currentUser.email || '',
          phone: currentUser.phone || '',
          address: currentUser.address || '',
          bio: currentUser.bio || '',
          isVerified: Boolean(currentUser.isVerified),
        };
        setAccountDraft(fallback);
        setInitialAccountDraft(fallback);
      }

      if (serviceProfileResult.status === 'fulfilled' && serviceProfileResult.value.success) {
        const data = serviceProfileResult.value.data;
        setHasServiceProfile(true);
        setServiceProfileDraft({
          fullName: data.name || '',
          barangayAddress: data.location || '',
          startingPrice: data.startingPrice ? String(data.startingPrice) : '',
          description: data.description || '',
          serviceCategories: toCommaSeparated(data.categories),
          isPublished: Boolean(data.isPublished),
        });
      } else {
        setHasServiceProfile(false);
      }

      if (portfolioResult.status === 'fulfilled' && portfolioResult.value.success) {
        const data = portfolioResult.value.data;
        setPortfolioDraft({
          aboutMe: data.aboutMe || '',
          responseTime: data.responseTime || 'Within 24 hours',
          skills: toCommaSeparated(data.skills),
          portfolioCount: Array.isArray(data.portfolio) ? data.portfolio.length : 0,
        });
      }

      setIsLoading(false);
    };

    loadSettings();
  }, [navigate]);

  const accountChanged = useMemo(() => {
    if (!initialAccountDraft) {
      return false;
    }

    return (
      accountDraft.fullName !== initialAccountDraft.fullName
      || accountDraft.phone !== initialAccountDraft.phone
      || accountDraft.address !== initialAccountDraft.address
      || accountDraft.bio !== initialAccountDraft.bio
    );
  }, [accountDraft, initialAccountDraft]);

  const handleAccountSave = async () => {
    if (!accountChanged) {
      setFlash({ type: 'info', message: 'No account changes to save.' });
      return;
    }

    try {
      setIsSavingAccount(true);
      setFlash({ type: 'info', message: '' });
      const submitData = new FormData();
      submitData.append('fullName', accountDraft.fullName || '');
      submitData.append('phone', accountDraft.phone || '');
      submitData.append('address', accountDraft.address || '');
      submitData.append('bio', accountDraft.bio || '');

      const response = await userProfileAPI.updateProfile(submitData);
      if (response.success) {
        const updated = {
          ...accountDraft,
          fullName: response.data.fullName || accountDraft.fullName,
          phone: response.data.phone || '',
          address: response.data.address || '',
          bio: response.data.bio || '',
        };
        setAccountDraft(updated);
        setInitialAccountDraft(updated);
        setFlash({ type: 'success', message: 'Account profile saved successfully.' });
      }
    } catch (err) {
      setFlash({ type: 'error', message: err.message || 'Failed to save account profile.' });
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleServiceProfileSave = async () => {
    const categories = fromCommaSeparated(serviceProfileDraft.serviceCategories);

    if (!serviceProfileDraft.fullName.trim() || !serviceProfileDraft.barangayAddress.trim() || !serviceProfileDraft.startingPrice || categories.length === 0) {
      setFlash({
        type: 'error',
        message: 'Service profile requires full name, barangay address, starting price, and at least one category.',
      });
      return;
    }

    try {
      setIsSavingProfile(true);
      setFlash({ type: 'info', message: '' });

      const formData = new FormData();
      formData.append('fullName', serviceProfileDraft.fullName.trim());
      formData.append('barangayAddress', serviceProfileDraft.barangayAddress.trim());
      formData.append('startingPrice', serviceProfileDraft.startingPrice);
      formData.append('description', serviceProfileDraft.description.trim());
      formData.append('serviceCategories', JSON.stringify(categories));

      const response = await serviceProfileAPI.createProfile(formData);
      if (response.success) {
        setHasServiceProfile(true);
        setFlash({ type: 'success', message: 'Service profile saved successfully.' });
      }
    } catch (err) {
      setFlash({ type: 'error', message: err.message || 'Failed to save service profile.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!hasServiceProfile) {
      setFlash({ type: 'error', message: 'Create your service profile before publishing.' });
      return;
    }

    try {
      setIsTogglingPublish(true);
      setFlash({ type: 'info', message: '' });
      const nextStatus = !serviceProfileDraft.isPublished;
      const response = await serviceProfileAPI.togglePublish(nextStatus);
      if (response.success) {
        setServiceProfileDraft((prev) => ({ ...prev, isPublished: nextStatus }));
        setFlash({
          type: 'success',
          message: nextStatus ? 'Profile is now published to clients.' : 'Profile has been unpublished.',
        });
      }
    } catch (err) {
      setFlash({ type: 'error', message: err.message || 'Failed to update publish status.' });
    } finally {
      setIsTogglingPublish(false);
    }
  };

  const handlePortfolioSave = async () => {
    if (!hasServiceProfile) {
      setFlash({ type: 'error', message: 'Create your service profile before saving portfolio details.' });
      return;
    }

    try {
      setIsSavingPortfolio(true);
      setFlash({ type: 'info', message: '' });
      const response = await serviceProfileAPI.updatePortfolioDetails({
        aboutMe: portfolioDraft.aboutMe,
        responseTime: portfolioDraft.responseTime,
        skills: fromCommaSeparated(portfolioDraft.skills),
      });

      if (response.success) {
        setFlash({ type: 'success', message: 'Portfolio details saved successfully.' });
      }
    } catch (err) {
      setFlash({ type: 'error', message: err.message || 'Failed to save portfolio details.' });
    } finally {
      setIsSavingPortfolio(false);
    }
  };

  return (
    <>
      <div className="user-settings-container">
        <div className="page-header">
          <h1 className="page-title">Service Provider Settings</h1>
          <p className="page-subtitle">Maintain your provider profile, publishing, and verification workflow.</p>
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
              className={`settings-nav-item ${activeSection === 'service' ? 'active' : ''}`}
              onClick={() => setActiveSection('service')}
            >
              Service Profile
            </button>
            <button
              className={`settings-nav-item ${activeSection === 'portfolio' ? 'active' : ''}`}
              onClick={() => setActiveSection('portfolio')}
            >
              Portfolio
            </button>
            <button
              className={`settings-nav-item ${activeSection === 'verification' ? 'active' : ''}`}
              onClick={() => setActiveSection('verification')}
            >
              Verification
            </button>
          </div>

          <div className="settings-content">
            <SettingsFlash type={flash.type} message={flash.message} />

            {activeSection === 'account' && (
              <div className="settings-section">
                <h2 className="settings-section-title">Account Profile</h2>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="provider-full-name">Full Name</label>
                  <input
                    id="provider-full-name"
                    type="text"
                    className="settings-input"
                    value={accountDraft.fullName}
                    onChange={(e) => setAccountDraft((prev) => ({ ...prev, fullName: e.target.value }))}
                    autoComplete="name"
                    disabled={isLoading || isSavingAccount}
                  />
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="provider-email">Email Address</label>
                  <input
                    id="provider-email"
                    type="email"
                    className="settings-input"
                    value={accountDraft.email}
                    readOnly
                    autoComplete="email"
                    disabled
                  />
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="provider-phone">Phone Number</label>
                  <input
                    id="provider-phone"
                    type="tel"
                    className="settings-input"
                    value={accountDraft.phone}
                    onChange={(e) => setAccountDraft((prev) => ({ ...prev, phone: e.target.value }))}
                    autoComplete="tel"
                    disabled={isLoading || isSavingAccount}
                  />
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="provider-address">Address</label>
                  <input
                    id="provider-address"
                    type="text"
                    className="settings-input"
                    value={accountDraft.address}
                    onChange={(e) => setAccountDraft((prev) => ({ ...prev, address: e.target.value }))}
                    autoComplete="street-address"
                    disabled={isLoading || isSavingAccount}
                  />
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="provider-bio">Bio</label>
                  <textarea
                    id="provider-bio"
                    className="settings-textarea"
                    rows={4}
                    value={accountDraft.bio}
                    onChange={(e) => setAccountDraft((prev) => ({ ...prev, bio: e.target.value }))}
                    autoComplete="off"
                    disabled={isLoading || isSavingAccount}
                  />
                </div>

                <div className="settings-actions">
                  <button className="btn-save" onClick={handleAccountSave} disabled={isLoading || isSavingAccount || !accountChanged}>
                    {isSavingAccount ? 'Saving...' : 'Save Account'}
                  </button>
                  <button
                    className="btn-cancel"
                    onClick={() => initialAccountDraft && setAccountDraft(initialAccountDraft)}
                    disabled={isLoading || isSavingAccount || !accountChanged}
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'service' && (
              <div className="settings-section">
                <h2 className="settings-section-title">Service Profile</h2>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="provider-display-name">Display Name</label>
                  <input
                    id="provider-display-name"
                    type="text"
                    className="settings-input"
                    value={serviceProfileDraft.fullName}
                    onChange={(e) => setServiceProfileDraft((prev) => ({ ...prev, fullName: e.target.value }))}
                    autoComplete="organization"
                    disabled={isLoading || isSavingProfile}
                  />
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="provider-barangay-address">Barangay Address</label>
                  <input
                    id="provider-barangay-address"
                    type="text"
                    className="settings-input"
                    value={serviceProfileDraft.barangayAddress}
                    onChange={(e) => setServiceProfileDraft((prev) => ({ ...prev, barangayAddress: e.target.value }))}
                    autoComplete="street-address"
                    disabled={isLoading || isSavingProfile}
                  />
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="provider-starting-price">Starting Price (PHP)</label>
                  <input
                    id="provider-starting-price"
                    type="number"
                    className="settings-input"
                    value={serviceProfileDraft.startingPrice}
                    onChange={(e) => setServiceProfileDraft((prev) => ({ ...prev, startingPrice: e.target.value }))}
                    min="0"
                    disabled={isLoading || isSavingProfile}
                  />
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="provider-service-categories">Service Categories</label>
                  <input
                    id="provider-service-categories"
                    type="text"
                    className="settings-input"
                    value={serviceProfileDraft.serviceCategories}
                    onChange={(e) => setServiceProfileDraft((prev) => ({ ...prev, serviceCategories: e.target.value }))}
                    placeholder="Plumbing, Electrical, Carpentry"
                    autoComplete="off"
                    disabled={isLoading || isSavingProfile}
                  />
                  <small className="settings-help">Separate categories with commas.</small>
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="provider-service-description">Service Description</label>
                  <textarea
                    id="provider-service-description"
                    className="settings-textarea"
                    rows={4}
                    value={serviceProfileDraft.description}
                    onChange={(e) => setServiceProfileDraft((prev) => ({ ...prev, description: e.target.value }))}
                    autoComplete="off"
                    disabled={isLoading || isSavingProfile}
                  />
                </div>

                <div className="settings-card">
                  <p>
                    Current visibility: <strong>{serviceProfileDraft.isPublished ? 'Published' : 'Unpublished'}</strong>
                  </p>
                  <div className="settings-inline-actions">
                    <button className="btn-secondary" onClick={handleTogglePublish} disabled={isLoading || isTogglingPublish}>
                      {isTogglingPublish
                        ? 'Updating...'
                        : serviceProfileDraft.isPublished
                          ? 'Unpublish Profile'
                          : 'Publish Profile'}
                    </button>
                  </div>
                </div>

                <div className="settings-actions">
                  <button className="btn-save" onClick={handleServiceProfileSave} disabled={isLoading || isSavingProfile}>
                    {isSavingProfile ? 'Saving...' : hasServiceProfile ? 'Update Service Profile' : 'Create Service Profile'}
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'portfolio' && (
              <div className="settings-section">
                <h2 className="settings-section-title">Portfolio Details</h2>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="provider-about-me">About Me</label>
                  <textarea
                    id="provider-about-me"
                    className="settings-textarea"
                    rows={4}
                    value={portfolioDraft.aboutMe}
                    onChange={(e) => setPortfolioDraft((prev) => ({ ...prev, aboutMe: e.target.value }))}
                    autoComplete="off"
                    disabled={isLoading || isSavingPortfolio}
                  />
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="provider-response-time">Typical Response Time</label>
                  <input
                    id="provider-response-time"
                    type="text"
                    className="settings-input"
                    value={portfolioDraft.responseTime}
                    onChange={(e) => setPortfolioDraft((prev) => ({ ...prev, responseTime: e.target.value }))}
                    placeholder="Within 24 hours"
                    autoComplete="off"
                    disabled={isLoading || isSavingPortfolio}
                  />
                </div>

                <div className="settings-group">
                  <label className="settings-label" htmlFor="provider-skills">Skills</label>
                  <input
                    id="provider-skills"
                    type="text"
                    className="settings-input"
                    value={portfolioDraft.skills}
                    onChange={(e) => setPortfolioDraft((prev) => ({ ...prev, skills: e.target.value }))}
                    placeholder="Installations, Repairs, Maintenance"
                    autoComplete="off"
                    disabled={isLoading || isSavingPortfolio}
                  />
                  <small className="settings-help">Separate skills with commas.</small>
                </div>

                <div className="settings-card">
                  <p>
                    Portfolio images uploaded: <strong>{portfolioDraft.portfolioCount}</strong>
                  </p>
                  <p>Image uploads are managed through your provider dashboard tools.</p>
                  <div className="settings-inline-actions">
                    <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
                      Open Provider Dashboard
                    </button>
                  </div>
                </div>

                <div className="settings-actions">
                  <button className="btn-save" onClick={handlePortfolioSave} disabled={isLoading || isSavingPortfolio}>
                    {isSavingPortfolio ? 'Saving...' : 'Save Portfolio Details'}
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'verification' && (
              <div className="settings-section">
                <h2 className="settings-section-title">Provider Verification</h2>

                <div className="settings-card">
                  <p>
                    Account verification status: <strong>{accountDraft.isVerified ? 'Verified' : 'Not verified'}</strong>
                  </p>
                  <p>Verification helps clients trust your profile and can improve your booking chances.</p>
                  {!accountDraft.isVerified && (
                    <div className="settings-inline-actions">
                      <button className="btn-change-password" onClick={() => setShowVerificationRequest(true)}>
                        Submit Verification Request
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showVerificationRequest && (
        <VerificationRequestModal onClose={() => setShowVerificationRequest(false)} />
      )}
    </>
  );
}

export default ServiceProviderSettings;
