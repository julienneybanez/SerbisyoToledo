import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { serviceProfileAPI } from '../../services/api';
import './EditPortfolioModal.css';

export default function EditPortfolioModal({ onClose }) {
  const fileInputRef = useRef(null);
  const completedJobPhotoInputRef = useRef(null);
  const linkedJobPhotoInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    aboutMe: '',
    responseTime: 'Within 24 hours',
    skills: [],
  });
  const [portfolio, setPortfolio] = useState([]);
  const [eligibleCompletedRequests, setEligibleCompletedRequests] = useState([]);
  const [selectedCompletedRequestId, setSelectedCompletedRequestId] = useState('');
  const [completedJobPhoto, setCompletedJobPhoto] = useState(null);
  const [linkedJobPhotoTargetId, setLinkedJobPhotoTargetId] = useState(null);
  const [isLinkingCompletedRequest, setIsLinkingCompletedRequest] = useState(false);
  const [isUpdatingLinkedJobPhoto, setIsUpdatingLinkedJobPhoto] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
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
    try {
      setIsLoading(true);
      const response = await serviceProfileAPI.getMyPortfolio();
      if (response.success) {
        setFormData({
          aboutMe: response.data.aboutMe || '',
          responseTime: response.data.responseTime || 'Within 24 hours',
          skills: response.data.skills || [],
        });
        setPortfolio(response.data.portfolio || []);
      }

      const completedResponse = await serviceProfileAPI.getEligibleCompletedRequests();
      if (completedResponse.success && completedResponse.data) {
        setEligibleCompletedRequests(completedResponse.data.requests || []);
      }
    } catch (err) {
      if (err.status === 404) {
        setError('Please create a service profile first before editing your portfolio.');
      } else {
        setError('Failed to load portfolio');
      }
      console.error('Portfolio fetch error:', err);
    } finally {
      setIsLoading(false);
    }
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

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setIsUploadingImage(true);
    setError(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('portfolioImage', file);
      formDataUpload.append('caption', 'Portfolio image');

      const response = await serviceProfileAPI.addPortfolioImage(formDataUpload);
      
      if (response.success) {
        // Refresh portfolio to get the new image with proper data
        await fetchPortfolio();
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
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
      const response = await serviceProfileAPI.updatePortfolioDetails({
        aboutMe: formData.aboutMe,
        responseTime: formData.responseTime,
        skills: formData.skills,
      });
      
      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setError(response.message || 'Failed to update portfolio');
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
        <button className="modal-close-btn" onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </button>

        <div className="edit-portfolio-header">
          <h2>Edit Profile</h2>
          <p>Update your profile details and showcase your work</p>
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
                Portfolio updated successfully!
              </div>
            )}

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
                <button type="button" onClick={handleAddSkill} className="btn-add-skill">
                  Add
                </button>
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
                  <button
                    type="button"
                    className="btn-completed-job-photo"
                    onClick={() => completedJobPhotoInputRef.current?.click()}
                    disabled={isLinkingCompletedRequest}
                  >
                    <i className="bi bi-image"></i>
                    {completedJobPhoto ? 'Change optional photo' : 'Add optional work photo'}
                  </button>
                  {completedJobPhoto && (
                    <span className="completed-job-photo-name" title={completedJobPhoto.name}>
                      {completedJobPhoto.name}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="btn-upload-image"
                  onClick={handleLinkCompletedRequest}
                  disabled={isLinkingCompletedRequest || !selectedCompletedRequestId}
                >
                  {isLinkingCompletedRequest ? 'Linking...' : 'Link Job to Portfolio'}
                </button>
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
                        <button
                          type="button"
                          onClick={() => openLinkedJobPhotoPicker(item.id)}
                          className="btn-add-linked-job-photo"
                          disabled={isUpdatingLinkedJobPhoto}
                        >
                          <i className="bi bi-image"></i>
                          <span>Add photo</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(item.id)}
                        className="btn-delete-image"
                        aria-label="Remove portfolio item"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="add-image-section">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn-upload-image"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? (
                    <>
                      <span className="spinner-small"></span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-cloud-upload"></i>
                      Upload Image
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-save"
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
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
