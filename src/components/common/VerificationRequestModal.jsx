import { useState } from 'react';
import { createPortal } from 'react-dom';
import { userProfileAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import './ServiceProfileModal.css';

export default function VerificationRequestModal({ onClose }) {
  const { t } = useLanguage();
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
        setError(t('verificationRequiredFieldsError'));
        setIsLoading(false);
        return;
      }

      if (!formData.governmentId) {
        setError(t('verificationRequiredDocumentsError'));
        setIsLoading(false);
        return;
      }

      const submitData = new FormData();
      submitData.append('fullName', formData.fullName.trim());
      submitData.append('phoneNumber', formData.phoneNumber.trim());
      submitData.append('address', formData.address.trim());
      submitData.append('serviceDescription', formData.serviceDescription.trim());
      submitData.append('governmentId', formData.governmentId);
      if (formData.certifications) {
        submitData.append('certifications', formData.certifications);
      }

      await userProfileAPI.submitVerificationRequest(submitData);

      setSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch {
      setError(t('verificationSubmitFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('verificationCloseAria')}>
          ×
        </button>

        <form onSubmit={handleSubmit} className="service-profile-form" noValidate>
          <div className="modal-header">
            <h2 className="modal-title">{t('verificationRequestTitle')}</h2>
            <p className="modal-subtitle">
              {t('verificationRequestSubtitle')}
            </p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">✓ {t('verificationRequestSuccess')}</div>}

          <section className="form-section">
            <div className="form-group">
              <label htmlFor="fullName" className="form-label">{t('verificationFullName')}<span className="required">*</span></label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                className="form-input"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder={t('verificationFullNamePlaceholder')}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phoneNumber" className="form-label">{t('verificationPhoneNumber')}<span className="required">*</span></label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                className="form-input"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder={t('verificationPhonePlaceholder')}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="address" className="form-label">{t('verificationAddress')}<span className="required">*</span></label>
              <input
                id="address"
                name="address"
                type="text"
                className="form-input"
                value={formData.address}
                onChange={handleInputChange}
                placeholder={t('verificationAddressPlaceholder')}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="serviceDescription" className="form-label">{t('verificationDescribeServices')}<span className="required">*</span></label>
              <textarea
                id="serviceDescription"
                name="serviceDescription"
                className="form-input"
                rows="4"
                value={formData.serviceDescription}
                onChange={handleInputChange}
                placeholder={t('verificationDescribeServicesPlaceholder')}
                required
              />
            </div>
          </section>

          <section className="form-section important-notes">
            <h4>{t('verificationRequiredDocuments')}</h4>
            <p className="section-description">{t('verificationUploadDocumentsDescription')}</p>

            <div className="form-group">
              <label htmlFor="governmentId" className="form-label">{t('verificationGovernmentId')}<span className="required">*</span></label>
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
              <label htmlFor="certifications" className="form-label">{t('verificationCertificationsLicense')} <span className="optional-label">({t('optional')})</span></label>
              <input
                id="certifications"
                name="certifications"
                type="file"
                className="form-input"
                accept="image/*,.pdf"
                onChange={handleFileChange}
              />
              <p className="form-help">{t('verificationCertificationsOptionalHelp')}</p>
            </div>
          </section>

          <section className="form-section important-notes">
            <h4>{t('importantNotes')}</h4>
            <ul>
              <li>{t('verificationClearDocumentsNote')}</li>
              <li>{t('verificationAuthenticDocumentsNote')}</li>
              <li>{t('verificationIncompleteDelayNote')}</li>
            </ul>
          </section>

          <button type="submit" className="btn-submit" disabled={isLoading || success}>
            {isLoading ? t('verificationSubmitting') : t('verificationSubmitRequest')}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
