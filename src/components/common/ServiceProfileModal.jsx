import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { serviceProfileAPI } from '../../services/api';
import './ServiceProfileModal.css';

const SERVICE_CATEGORIES = [
  'Carpentry',
  'Masonry',
  'House Cleaning',
  'Plumbing',
  'Wiring',
  'Repair',
  'Installation',
  'Electrical',
  'Painting',
  'Gardening',
  'Beauty',
  'Others'
];

export default function ServiceProfileModal({ onClose }) {
  const [formData, setFormData] = useState({
    fullName: '',
    barangayAddress: '',
    startingPrice: '',
    serviceCategories: [],
    bannerImage: null,
  });

  const [bannerPreview, setBannerPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchExistingProfile = async () => {
      setIsFetchingProfile(true);

      try {
        const response = await serviceProfileAPI.getMyProfile();

        if (response.success && response.data) {
          const profile = response.data;
          setIsEditMode(true);
          setFormData(prev => ({
            ...prev,
            fullName: profile.name || '',
            barangayAddress: profile.location || '',
            startingPrice: profile.startingPrice ? String(profile.startingPrice) : '',
            serviceCategories: Array.isArray(profile.categories) ? profile.categories : [],
            bannerImage: null,
          }));

          if (profile.image) {
            setBannerPreview(profile.image);
          }
        }
      } catch (err) {
        // No existing profile is a normal state for first-time posting.
      } finally {
        setIsFetchingProfile(false);
      }
    };

    fetchExistingProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCategoryToggle = (category) => {
    setFormData(prev => ({
      ...prev,
      serviceCategories: prev.serviceCategories.includes(category)
        ? prev.serviceCategories.filter(c => c !== category)
        : [...prev.serviceCategories, category]
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, bannerImage: file });
      const reader = new FileReader();
      reader.onloadend = () => setBannerPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate service categories
      if (formData.serviceCategories.length === 0) {
        setError('Please select at least one service category');
        setIsLoading(false);
        return;
      }

      // Prepare form data with file
      const submitData = new FormData();
      submitData.append('fullName', formData.fullName);
      submitData.append('barangayAddress', formData.barangayAddress);
      submitData.append('startingPrice', parseFloat(formData.startingPrice));
      submitData.append('serviceCategories', JSON.stringify(formData.serviceCategories));
      if (formData.bannerImage) {
        submitData.append('bannerImage', formData.bannerImage);
      }

      // Submit to backend
      const result = await serviceProfileAPI.createProfile(submitData);

      if (result.success) {
        setSuccess(true);
        // Close modal after success
        setTimeout(() => {
          onClose();
          // Notify parent to refresh data
          window.dispatchEvent(new Event('profileCreated'));
        }, 1500);
      } else {
        setError(result.message || 'Failed to save service profile');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while saving your service profile');
      console.error('Error submitting profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="modal-close" onClick={onClose}>×</button>

        {isFetchingProfile ? (
          <div className="edit-profile-loading">
            <div className="spinner"></div>
            <p>Loading service profile...</p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="service-profile-form">
          {/* Modal Header */}
          <div className="modal-header">
            <h2 className="modal-title">{isEditMode ? 'Edit Service Profile' : 'Post Service Profile'}</h2>
            <p className="modal-subtitle">
              {isEditMode
                ? 'Update your posted service profile details below.'
                : 'Create your service profile to connect with customers. Fill out the information below and showcase your services.'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="alert alert-success">
              ✓ Service profile saved successfully!
            </div>
          )}
          {/* Service Information Section */}
          <section className="form-section">
            <h3 className="section-header">Service Information</h3>
            
            <div className="form-group">
              <label htmlFor="fullName" className="form-label">Full Name<span className="required">*</span></label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={handleInputChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="barangayAddress" className="form-label">Barangay Address<span className="required">*</span></label>
                <input
                  type="text"
                  id="barangayAddress"
                  name="barangayAddress"
                  placeholder="Enter your barangay/area"
                  value={formData.barangayAddress}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="startingPrice" className="form-label">Starting Price<span className="required">*</span></label>
                <input
                  type="number"
                  id="startingPrice"
                  name="startingPrice"
                  placeholder="e.g. 500"
                  value={formData.startingPrice}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>
            </div>
          </section>

          {/* Service Categories Section */}
          <section className="form-section">
            <h3 className="section-header">Service Categories<span className="required">*</span></h3>
            <p className="section-description">Select all services you provide</p>
            
            <div className="categories-grid">
              {SERVICE_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`category-pill ${formData.serviceCategories.includes(category) ? 'active' : ''}`}
                  onClick={() => handleCategoryToggle(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </section>

          {/* Banner Image Upload Section */}
          <section className="form-section">
            <div className="upload-area">
              <input
                type="file"
                id="bannerImage"
                name="bannerImage"
                accept="image/*"
                onChange={handleImageUpload}
                className="file-input"
              />
              <label htmlFor="bannerImage" className="upload-label">
                {bannerPreview ? (
                  <img src={bannerPreview} alt="Banner preview" className="banner-preview" />
                ) : (
                  <>
                    <div className="upload-icon">⬆️</div>
                    <h4>Click to Upload Banner Image</h4>
                    <p>JPG, PNG (Max 5MB)</p>
                  </>
                )}
              </label>
            </div>
          </section>

          {/* Important Notes */}
          <section className="form-section important-notes">
            <h4>Important Notes:</h4>
            <ul>
              <li>All fields marked with * are required</li>
              <li>Banner image should be professional and represent your service</li>
              <li>Select all applicable service categories to reach more customers</li>
            </ul>
          </section>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="btn-submit"
            disabled={isLoading || success}
          >
            {isLoading ? 'Saving Profile...' : isEditMode ? 'Save Service Profile' : 'Post Service Profile'}
          </button>

          {/* Terms Agreement */}
          <p className="terms-text">
            By posting this, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
          </p>
        </form>
        )}
      </div>
    </div>,
    document.body
  );
}
