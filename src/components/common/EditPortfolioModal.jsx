import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { serviceProfileAPI, userProfileAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { AppButton, IconButton } from '../ui';
import './EditPortfolioModal.css';

const LANGUAGE_OPTIONS = [
  { value: 'ceb', labelKey: 'languageOptionCebuano' },
  { value: 'en', labelKey: 'languageOptionEnglish' },
  { value: 'fil', labelKey: 'languageOptionFilipino' },
];

export default function EditPortfolioModal({ onClose }) {
  const { t } = useLanguage();
  const profilePhotoInputRef = useRef(null);
  const completedJobPhotoInputRef = useRef(null);
  const linkedJobPhotoInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    aboutMe: '',
    responseTime: 'Within 24 hours',
    skills: [],
  });
  const [portfolio, setPortfolio] = useState([]);
  const [accountName, setAccountName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null);
  const [isRemovingProfilePhoto, setIsRemovingProfilePhoto] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [eligibleCompletedRequests, setEligibleCompletedRequests] = useState([]);
  const [selectedCompletedRequestId, setSelectedCompletedRequestId] = useState('');
  const [completedJobPhoto, setCompletedJobPhoto] = useState(null);
  const [linkedJobPhotoTargetId, setLinkedJobPhotoTargetId] = useState(null);
  const [isLinkingCompletedRequest, setIsLinkingCompletedRequest] = useState(false);
  const [isUpdatingLinkedJobPhoto, setIsUpdatingLinkedJobPhoto] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const RESPONSE_TIME_OPTIONS = [
    'Within 1 hour',
    'Within 2 hours',
    'Within 6 hours',
    'Within 12 hours',
    'Within 24 hours',
    'Same day confirmation',
    '1-2 business days'
  ];

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    setIsLoading(true);
    setError(null);

    const [portfolioResult, completedResult, languagesResult, accountResult] = await Promise.allSettled([
      serviceProfileAPI.getMyPortfolio(),
      serviceProfileAPI.getEligibleCompletedRequests(),
      serviceProfileAPI.getMyLanguages(),
      userProfileAPI.getProfile(),
    ]);

    if (portfolioResult.status === 'fulfilled' && portfolioResult.value?.success) {
      const response = portfolioResult.value;
      setFormData({
        aboutMe: response.data.aboutMe || '',
        responseTime: response.data.responseTime || 'Within 24 hours',
        skills: response.data.skills || [],
      });
      setPortfolio(response.data.portfolio || []);
    } else {
      const reason = portfolioResult.status === 'rejected' ? portfolioResult.reason : null;
      if (reason?.status === 404) {
        setError('Please create a Service Listing first before editing your Provider Profile.');
      } else {
        setError('Some Provider Profile details could not be loaded. You can still manage the available sections below.');
      }
      console.error('Provider profile details fetch error:', reason);
    }

    if (completedResult.status === 'fulfilled' && completedResult.value?.success) {
      setEligibleCompletedRequests(completedResult.value.data?.requests || []);
    } else if (completedResult.status === 'rejected') {
      console.error('Completed-job portfolio fetch error:', completedResult.reason);
    }

    if (languagesResult.status === 'fulfilled' && languagesResult.value?.success) {
      setSelectedLanguages(languagesResult.value.data?.languages || []);
    } else if (languagesResult.status === 'rejected') {
      console.error('Provider language fetch error:', languagesResult.reason);
    }

    if (accountResult.status === 'fulfilled' && accountResult.value?.success) {
      const account = accountResult.value.data || {};
      setAccountName(account.fullName || '');
      setProfilePhoto(account.profilePhoto || null);
      setProfilePhotoPreview(account.profilePhoto || null);
      setProfilePhotoFile(null);
    } else if (accountResult.status === 'rejected') {
      console.error('Provider account photo fetch error:', accountResult.reason);
    }

    setIsLoading(false);
  };

  const handleLinkCompletedRequest = async () => {
    if (!selectedCompletedRequestId) {
      setError('Please select a completed job to link.');
      return;
    }

    const selectedRequest = eligibleCompletedRequests.find(
      (request) => Number(request.id) === Number(selectedCompletedRequestId)
    );

    if (!selectedRequest) {
      setError('Selected completed request could not be found.');
      return;
    }

    try {
      setIsLinkingCompletedRequest(true);
      setError(null);

      const payload = new FormData();
      payload.append('serviceRequestId', String(Number(selectedCompletedRequestId)));
      payload.append('caption', selectedRequest.service_type_label || 'Completed service');
      payload.append('description', '');
      payload.append('serviceCategory', '');
      payload.append('isPublished', 'true');
      payload.append('isFeatured', 'false');
      if (completedJobPhoto) {
        payload.append('portfolioImage', completedJobPhoto);
      }

      const response = await serviceProfileAPI.createPortfolioFromRequest(payload);

      if (response.success) {
        setSelectedCompletedRequestId('');
        setCompletedJobPhoto(null);
        if (completedJobPhotoInputRef.current) {
          completedJobPhotoInputRef.current.value = '';
        }
        await fetchPortfolio();
      }
    } catch (err) {
      setError(err.message || 'Failed to link completed request');
    } finally {
      setIsLinkingCompletedRequest(false);
    }
  };

  const validatePortfolioPhoto = (file) => {
    if (!file) return false;
    if (!file.type?.startsWith('image/')) {
      setError('Please choose an image file.');
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return false;
    }
    return true;
  };

  const handleCompletedJobPhotoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setCompletedJobPhoto(null);
      return;
    }
    if (!validatePortfolioPhoto(file)) {
      event.target.value = '';
      return;
    }
    setError(null);
    setCompletedJobPhoto(file);
  };

  const openLinkedJobPhotoPicker = (itemId) => {
    setLinkedJobPhotoTargetId(itemId);
    if (linkedJobPhotoInputRef.current) {
      linkedJobPhotoInputRef.current.value = '';
      linkedJobPhotoInputRef.current.click();
    }
  };

  const handleLinkedJobPhotoSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !linkedJobPhotoTargetId) return;

    if (!validatePortfolioPhoto(file)) {
      event.target.value = '';
      return;
    }

    setIsUpdatingLinkedJobPhoto(true);
    setError(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('portfolioImage', file);
      const response = await serviceProfileAPI.updateCompletedPortfolioItemImage(
        linkedJobPhotoTargetId,
        formDataUpload
      );

      if (response.success) {
        await fetchPortfolio();
      }
    } catch (err) {
      setError(err.message || 'Failed to update completed job photo');
    } finally {
      setIsUpdatingLinkedJobPhoto(false);
      setLinkedJobPhotoTargetId(null);
      event.target.value = '';
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSkill = () => {
    const trimmedSkill = newSkill.trim();
    if (trimmedSkill && !formData.skills.includes(trimmedSkill)) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, trimmedSkill]
      }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const getProfileInitials = () => {
    const initials = String(accountName || 'SP')
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return initials || 'SP';
  };

  const handleProfilePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type?.startsWith('image/')) {
      setError('Please choose an image file for your profile picture.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Profile picture must be less than 5MB.');
      event.target.value = '';
      return;
    }

    setError(null);
    setProfilePhotoFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setProfilePhotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProfilePhoto = async () => {
    if (!profilePhoto && !profilePhotoPreview) return;
    if (!confirm('Remove your profile picture?')) return;

    try {
      setIsRemovingProfilePhoto(true);
      setError(null);
      const response = await userProfileAPI.removePhoto();
      if (response.success) {
        setProfilePhoto(null);
        setProfilePhotoPreview(null);
        setProfilePhotoFile(null);
        if (profilePhotoInputRef.current) profilePhotoInputRef.current.value = '';
      }
    } catch (err) {
      setError(err.message || 'Failed to remove profile picture.');
    } finally {
      setIsRemovingProfilePhoto(false);
    }
  };

  const handleLanguageToggle = (code) => {
    setSelectedLanguages((current) => (
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code]
    ));
  };

  const handleDeleteImage = async (imageId) => {
    if (!confirm('Delete this image from your portfolio?')) return;

    try {
      const response = await serviceProfileAPI.deletePortfolioImage(imageId);
      if (response.success) {
        setPortfolio(prev => prev.filter(img => img.id !== imageId));
      }
    } catch {
      setError('Failed to delete image');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const saveOperations = [
        serviceProfileAPI.updatePortfolioDetails({
          aboutMe: formData.aboutMe,
          responseTime: formData.responseTime,
          skills: formData.skills,
        }),
        serviceProfileAPI.updateMyLanguages(selectedLanguages),
      ];

      if (profilePhotoFile) {
        const photoData = new FormData();
        photoData.append('profilePhoto', profilePhotoFile);
        saveOperations.push(userProfileAPI.updateProfile(photoData));
      }

      const responses = await Promise.all(saveOperations);
      const failedResponse = responses.find((response) => !response?.success);

      if (!failedResponse) {
        const photoResponse = profilePhotoFile ? responses[2] : null;
        if (photoResponse?.data?.profilePhoto) {
          setProfilePhoto(photoResponse.data.profilePhoto);
          setProfilePhotoPreview(photoResponse.data.profilePhoto);
          setProfilePhotoFile(null);
        }
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setError(failedResponse.message || 'Failed to update provider profile');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="edit-portfolio-overlay" onClick={onClose}>
      <div className="edit-portfolio-modal" onClick={(e) => e.stopPropagation()}>
        <IconButton className="modal-close-btn" onClick={onClose} aria-label="Close provider profile editor">
          <i className="bi bi-x-lg"></i>
        </IconButton>

        <div className="edit-portfolio-header">
          <h2>Edit Provider Profile</h2>
          <p>Update the information clients see about you and showcase your work.</p>
        </div>

        {isLoading ? (
          <div className="edit-portfolio-loading">
            <div className="spinner"></div>
            <p>Loading profile...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="edit-portfolio-form">
            {error && (
              <div className="alert alert-error">
                <i className="bi bi-exclamation-circle"></i>
                {error}
              </div>
            )}

            {success && (
              <div className="alert alert-success">
                <i className="bi bi-check-circle"></i>
                Provider profile updated successfully!
              </div>
            )}

            {/* Provider Profile Picture */}
            <div className="form-section provider-profile-photo-section">
              <h3><i className="bi bi-person-circle"></i> Profile Picture</h3>
              <p className="completed-job-linker-help">
                This picture appears on your public provider profile, Messages, and beside your name in the app.
              </p>
              <div className="provider-profile-photo-row">
                <div className="provider-profile-photo-preview" aria-label="Current provider profile picture">
                  {profilePhotoPreview ? (
                    <img src={profilePhotoPreview} alt="Provider profile" className="non-draggable-image" draggable="false" />
                  ) : (
                    <span>{getProfileInitials()}</span>
                  )}
                </div>
                <div className="provider-profile-photo-actions">
                  <input
                    ref={profilePhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="portfolio-hidden-file-input"
                    onChange={handleProfilePhotoSelect}
                  />
                  <AppButton
                    variant="secondary"
                    onClick={() => profilePhotoInputRef.current?.click()}
                    disabled={isSaving || isRemovingProfilePhoto}
                    icon={<i className="bi bi-camera" aria-hidden="true"></i>}
                  >
                    {profilePhotoPreview ? 'Change Photo' : 'Upload Photo'}
                  </AppButton>
                  {profilePhotoPreview && (
                    <AppButton
                      variant="danger"
                      onClick={handleRemoveProfilePhoto}
                      disabled={isSaving || isRemovingProfilePhoto}
                      icon={<i className="bi bi-trash" aria-hidden="true"></i>}
                    >
                      {isRemovingProfilePhoto ? 'Removing...' : 'Remove Photo'}
                    </AppButton>
                  )}
                  {profilePhotoFile && (
                    <span className="provider-profile-photo-pending">New photo will be saved with your Provider Profile.</span>
                  )}
                </div>
              </div>
            </div>

            {/* About Me Section */}
            <div className="form-section">
              <h3><i className="bi bi-person-lines-fill"></i> About Me</h3>
              <textarea
                name="aboutMe"
                value={formData.aboutMe}
                onChange={handleInputChange}
                placeholder="Tell clients about yourself, your experience, and what makes you unique..."
                rows="4"
              />
            </div>

            {/* Languages */}
            <div className="form-section">
              <h3><i className="bi bi-translate"></i> {t('languagesSpoken')}</h3>
              <p className="completed-job-linker-help">
                These are the languages shown on your provider profile. Languages selected during sign-up are loaded here automatically.
              </p>
              <div className="provider-profile-language-options">
                {LANGUAGE_OPTIONS.map((option) => (
                  <label key={option.value} className="provider-profile-language-option">
                    <input
                      type="checkbox"
                      checked={selectedLanguages.includes(option.value)}
                      onChange={() => handleLanguageToggle(option.value)}
                      disabled={isSaving}
                    />
                    <span>{t(option.labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Response Time */}
            <div className="form-section" data-tour="provider-response-time">
              <h3><i className="bi bi-clock"></i> Response Time</h3>
              <select
                name="responseTime"
                value={formData.responseTime}
                onChange={handleInputChange}
              >
                {RESPONSE_TIME_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* Skills Section */}
            <div className="form-section">
              <h3><i className="bi bi-tools"></i> Skills</h3>
              <div className="skills-container">
                {formData.skills.map((skill, index) => (
                  <span key={index} className="skill-tag">
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="skill-remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="add-skill-row">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="Add a skill..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                />
                <AppButton type="button" variant="secondary" size="sm" onClick={handleAddSkill}>
                  Add
                </AppButton>
              </div>
            </div>

            {/* Portfolio Images Section */}
            <div className="form-section" data-tour="provider-portfolio-images">
              <h3><i className="bi bi-images"></i> Portfolio Images</h3>

              <div className="completed-job-linker">
                <label className="completed-job-linker-title">Link Completed Job</label>
                <select
                  value={selectedCompletedRequestId}
                  onChange={(e) => setSelectedCompletedRequestId(e.target.value)}
                  disabled={isLinkingCompletedRequest || eligibleCompletedRequests.length === 0}
                >
                  <option value="">
                    {eligibleCompletedRequests.length > 0 ? 'Select a completed request' : 'No completed requests available'}
                  </option>
                  {eligibleCompletedRequests.map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.service_type_label || 'Completed service'} ({new Date(request.created_at).toLocaleDateString()})
                    </option>
                  ))}
                </select>

                <input
                  ref={completedJobPhotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCompletedJobPhotoSelect}
                  className="portfolio-hidden-file-input"
                />

                <div className="completed-job-photo-row">
                  <AppButton
                    variant="secondary"
                    onClick={() => completedJobPhotoInputRef.current?.click()}
                    disabled={isLinkingCompletedRequest}
                    icon={<i className="bi bi-image" aria-hidden="true"></i>}
                  >
                    {completedJobPhoto ? 'Change optional photo' : 'Add optional work photo'}
                  </AppButton>
                  {completedJobPhoto && (
                    <span className="completed-job-photo-name" title={completedJobPhoto.name}>
                      {completedJobPhoto.name}
                    </span>
                  )}
                </div>

                <AppButton
                  onClick={handleLinkCompletedRequest}
                  disabled={isLinkingCompletedRequest || !selectedCompletedRequestId}
                >
                  {isLinkingCompletedRequest ? 'Linking...' : 'Link Job to Portfolio'}
                </AppButton>
                <p className="completed-job-linker-help">
                  The photo is optional. Linked jobs are still shown as verified completed-work cards when no photo is added. Private client request details are not published automatically.
                </p>
              </div>

              <input
                ref={linkedJobPhotoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLinkedJobPhotoSelect}
                className="portfolio-hidden-file-input"
              />

              <div className="portfolio-grid">
                {portfolio.map((item) => (
                  <div
                    key={item.id}
                    className={`portfolio-item ${!item.src ? 'portfolio-item-no-photo' : ''}`}
                  >
                    {item.src ? (
                      <img src={item.src} alt={item.serviceLabel || item.caption || 'Portfolio image'} />
                    ) : (
                      <div className="edit-portfolio-job-placeholder">
                        <i className="bi bi-briefcase-fill" aria-hidden="true"></i>
                        <strong>{item.serviceLabel || item.caption || 'Completed job'}</strong>
                        {item.completedThroughPlatform && (
                          <span>Completed through SerbisyoToledo</span>
                        )}
                      </div>
                    )}

                    <div className="portfolio-item-overlay">
                      {item.completedThroughPlatform && !item.src && (
                        <AppButton
                          variant="secondary"
                          size="sm"
                          onClick={() => openLinkedJobPhotoPicker(item.id)}
                          disabled={isUpdatingLinkedJobPhoto}
                          icon={<i className="bi bi-image" aria-hidden="true"></i>}
                        >
                          <span>Add photo</span>
                        </AppButton>
                      )}
                      <IconButton
                        className="portfolio-delete-icon"
                        onClick={() => handleDeleteImage(item.id)}
                        aria-label="Remove portfolio item"
                      >
                        <i className="bi bi-trash"></i>
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>

              <p className="completed-job-linker-help">
                Portfolio work must be linked to a completed SerbisyoToledo request. Standalone manual uploads are no longer published.
              </p>
            </div>

            {/* Actions */}
            <div className="form-actions">
              <AppButton
                variant="secondary"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </AppButton>
              <AppButton
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="spinner-small"></span>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </AppButton>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
