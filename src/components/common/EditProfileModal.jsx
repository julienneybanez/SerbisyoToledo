import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { userProfileAPI, getUser } from '../../services/api';
import './EditProfileModal.css';

export default function EditProfileModal({ onClose, onProfileUpdated }) {
  const currentUser = getUser();
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    bio: '',
  });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const response = await userProfileAPI.getProfile();
      if (response.success) {
        const { fullName, phone, address, bio, profilePhoto: existingPhoto } = response.data;
        setFormData({
          fullName: fullName || '',
          phone: phone || '',
          address: address || '',
          bio: bio || '',
        });
        if (existingPhoto) {
          setPhotoPreview(existingPhoto);
        }
      }
    } catch (err) {
      setError('Failed to load profile');
      console.error('Profile fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }
      setProfilePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setIsSaving(true);
      const response = await userProfileAPI.removePhoto();
      if (response.success) {
        setPhotoPreview(null);
        setProfilePhoto(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (err) {
      setError('Failed to remove photo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const submitData = new FormData();
      submitData.append('fullName', formData.fullName);
      submitData.append('phone', formData.phone);
      submitData.append('address', formData.address);
      submitData.append('bio', formData.bio);
      
      if (profilePhoto) {
        submitData.append('profilePhoto', profilePhoto);
      }

      const response = await userProfileAPI.updateProfile(submitData);
      
      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          if (onProfileUpdated) {
            onProfileUpdated(response.data);
          }
          onClose();
        }, 1000);
      } else {
        setError(response.message || 'Failed to update profile');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return createPortal(
    <div className="edit-profile-overlay" onClick={onClose}>
      <div className="edit-profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </button>

        <div className="edit-profile-header">
          <h2>Edit Profile</h2>
          <p>Update your personal information</p>
        </div>

        {isLoading ? (
          <div className="edit-profile-loading">
            <div className="spinner"></div>
            <p>Loading profile...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="edit-profile-form">
            {error && (
              <div className="alert alert-error">
                <i className="bi bi-exclamation-circle"></i>
                {error}
              </div>
            )}

            {success && (
              <div className="alert alert-success">
                <i className="bi bi-check-circle"></i>
                Profile updated successfully!
              </div>
            )}

            {/* Profile Photo Section */}
            <div className="photo-section">
              <div className="photo-preview-container">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="photo-preview" />
                ) : (
                  <div className="photo-placeholder">
                    {getInitials(formData.fullName)}
                  </div>
                )}
              </div>
              <div className="photo-actions">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn-photo-upload"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                >
                  <i className="bi bi-camera"></i>
                  {photoPreview ? 'Change Photo' : 'Upload Photo'}
                </button>
                {photoPreview && (
                  <button
                    type="button"
                    className="btn-photo-remove"
                    onClick={handleRemovePhoto}
                    disabled={isSaving}
                  >
                    <i className="bi bi-trash"></i>
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Form Fields */}
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Enter your phone number"
              />
            </div>

            <div className="form-group">
              <label htmlFor="address">Address</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Enter your address"
              />
            </div>

            <div className="form-group">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder="Tell us about yourself..."
                rows="3"
              />
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
