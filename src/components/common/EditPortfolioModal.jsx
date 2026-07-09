import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { serviceProfileAPI } from '../../services/api';
import './EditPortfolioModal.css';

export default function EditPortfolioModal({ onClose }) {
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    aboutMe: '',
    responseTime: 'Within 24 hours',
    skills: [],
  });
  const [portfolio, setPortfolio] = useState([]);
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
    } catch (err) {
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
          <h2>Edit Portfolio</h2>
          <p>Update your profile details and showcase your work</p>
        </div>

        {isLoading ? (
          <div className="edit-portfolio-loading">
            <div className="spinner"></div>
            <p>Loading portfolio...</p>
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
            <div className="form-section">
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
            <div className="form-section">
              <h3><i className="bi bi-images"></i> Portfolio Images</h3>
              
              <div className="portfolio-grid">
                {portfolio.map((item) => (
                  <div key={item.id} className="portfolio-item">
                    <img src={item.src} alt="Portfolio image" />
                    <div className="portfolio-item-overlay">
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(item.id)}
                        className="btn-delete-image"
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
