import { useState } from 'react';
import { createPortal } from 'react-dom';
import { userProfileAPI } from '../../services/api';
import './ServiceProfileModal.css';

export default function VerificationRequestModal({ onClose }) {
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    address: '',
    serviceDescription: '',
    governmentId: null,
    certifications: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFormData((prev) => ({ ...prev, [name]: files[0] || null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!formData.fullName.trim() || !formData.phoneNumber.trim() || !formData.address.trim() || !formData.serviceDescription.trim()) {
        setError('Please fill in all required fields.');
        setIsLoading(false);
        return;
      }

      if (!formData.governmentId || !formData.certifications) {
        setError('Please upload both required documents.');
        setIsLoading(false);
        return;
      }

      const submitData = new FormData();
      submitData.append('fullName', formData.fullName.trim());
      submitData.append('phoneNumber', formData.phoneNumber.trim());
      submitData.append('address', formData.address.trim());
      submitData.append('serviceDescription', formData.serviceDescription.trim());
      submitData.append('governmentId', formData.governmentId);
      submitData.append('certifications', formData.certifications);

      await userProfileAPI.submitVerificationRequest(submitData);

      setSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err.message || 'Unable to submit your verification request.');
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close verification request modal">
          ×
        </button>

        <form onSubmit={handleSubmit} className="service-profile-form" noValidate>
          <div className="modal-header">
            <h2 className="modal-title">Request Verification</h2>
            <p className="modal-subtitle">
              Submit a request to be reviewed by the admin team. We will reach out once your account is verified.
            </p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">✓ Verification request submitted successfully!</div>}

          <section className="form-section">
            <div className="form-group">
              <label htmlFor="fullName" className="form-label">Full Name<span className="required">*</span></label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                className="form-input"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phoneNumber" className="form-label">Phone Number<span className="required">*</span></label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                className="form-input"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder="e.g. 09123456789"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="address" className="form-label">Address<span className="required">*</span></label>
              <input
                id="address"
                name="address"
                type="text"
                className="form-input"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Enter your home or business address"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="serviceDescription" className="form-label">Describe Your Services<span className="required">*</span></label>
              <textarea
                id="serviceDescription"
                name="serviceDescription"
                className="form-input"
                rows="4"
                value={formData.serviceDescription}
                onChange={handleInputChange}
                placeholder="Tell us what services you offer and your experience"
                required
              />
            </div>
          </section>

          <section className="form-section important-notes">
            <h4>Required Documents</h4>
            <p className="section-description">Please upload the documents below so we can review your application.</p>

            <div className="form-group">
              <label htmlFor="governmentId" className="form-label">Government-issued ID<span className="required">*</span></label>
              <input
                id="governmentId"
                name="governmentId"
                type="file"
                className="form-input"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="certifications" className="form-label">Certifications / License<span className="required">*</span></label>
              <input
                id="certifications"
                name="certifications"
                type="file"
                className="form-input"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                required
              />
            </div>
          </section>

          <section className="form-section important-notes">
            <h4>Important Notes:</h4>
            <ul>
              <li>Please upload clear and valid documents.</li>
              <li>Only verified and authentic certifications will be accepted.</li>
              <li>Incomplete submissions may delay the review process.</li>
            </ul>
          </section>

          <button type="submit" className="btn-submit" disabled={isLoading || success}>
            {isLoading ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
