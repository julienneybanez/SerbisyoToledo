import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { serviceProfileAPI } from '../../services/api';
import useServiceTaxonomy from '../../hooks/useServiceTaxonomy';
import { useLanguage } from '../../context/LanguageContext';
import './ServiceProfileModal.css';

export default function ServiceProfileModal({ onClose }) {
  const { t } = useLanguage();
  const { categories, getCategory, getServiceTypesForCategory } = useServiceTaxonomy();
  const [formData, setFormData] = useState({
    fullName: '',
    barangayAddress: '',
    startingPrice: '',
    serviceCategories: [],
    serviceTypes: [],
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
          const safeCategories = (Array.isArray(profile.categories) ? profile.categories : [])
            .filter((category) => Boolean(getCategory(category)))
            .map((category) => getCategory(category).label);

          const allowedServiceTypeKeys = new Set(
            safeCategories.flatMap((category) => getServiceTypesForCategory(category).map((item) => item.key))
          );

          const safeServiceTypeKeys = (Array.isArray(profile.serviceTypes)
            ? profile.serviceTypes.map((item) => item.key).filter(Boolean)
            : [])
            .filter((key) => allowedServiceTypeKeys.has(key));

          setIsEditMode(true);
          setFormData(prev => ({
            ...prev,
            fullName: profile.name || '',
            barangayAddress: profile.location || '',
            startingPrice: profile.startingPrice ? String(profile.startingPrice) : '',
            serviceCategories: safeCategories,
            serviceTypes: safeServiceTypeKeys,
            bannerImage: null,
          }));

          if (profile.image) {
            setBannerPreview(profile.image);
          }
        }
      } catch {
        // No existing profile is a normal state for first-time posting.
      } finally {
        setIsFetchingProfile(false);
      }
    };

    fetchExistingProfile();
  }, [getCategory, getServiceTypesForCategory]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (!['barangayAddress', 'startingPrice'].includes(name)) return;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCategoryToggle = (category) => {
    setFormData((prev) => {
      const nextCategories = prev.serviceCategories.includes(category)
        ? prev.serviceCategories.filter(c => c !== category)
        : [...prev.serviceCategories, category];

      const allowedServiceTypeKeys = new Set(
        nextCategories.flatMap((selectedCategory) => getServiceTypesForCategory(selectedCategory).map((item) => item.key))
      );

      const nextServiceTypes = prev.serviceTypes.filter((key) => allowedServiceTypeKeys.has(key));

      return {
        ...prev,
        serviceCategories: nextCategories,
        serviceTypes: nextServiceTypes,
      };
    });
  };

  const handleServiceTypeToggle = (serviceTypeKey) => {
    setFormData((prev) => ({
      ...prev,
      serviceTypes: prev.serviceTypes.includes(serviceTypeKey)
        ? prev.serviceTypes.filter((key) => key !== serviceTypeKey)
        : [...prev.serviceTypes, serviceTypeKey],
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormData((prev) => ({ ...prev, bannerImage: file }));
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setBannerPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate service categories
      if (formData.serviceCategories.length === 0) {
        setError(t('serviceListingSelectCategoryError'));
        setIsLoading(false);
        return;
      }

      // Prepare form data with file
      const submitData = new FormData();
      submitData.append('barangayAddress', formData.barangayAddress);
      submitData.append('startingPrice', String(parseFloat(formData.startingPrice)));
      submitData.append('pricingUnit', 'per_day');
      submitData.append('serviceCategories', JSON.stringify(formData.serviceCategories));
      submitData.append('serviceTypes', JSON.stringify(formData.serviceTypes));
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
        setError(t('serviceListingSaveFailed'));
      }
    } catch (err) {
      setError(t('serviceListingSaveFailed'));
      console.error('Error submitting profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const visibleServiceTypes = formData.serviceCategories.flatMap((selectedCategory) => {
    const category = getCategory(selectedCategory);
    const serviceTypes = getServiceTypesForCategory(selectedCategory);

    return serviceTypes.map((item) => ({
      ...item,
      categoryLabel: category?.label || selectedCategory,
    }));
  });

  const dedupedServiceTypes = Array.from(
    new Map(visibleServiceTypes.map((item) => [item.key, item])).values()
  );

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="modal-close" onClick={onClose} aria-label={t('serviceListingCloseAria')}>×</button>

        {isFetchingProfile ? (
          <div className="edit-profile-loading">
            <div className="spinner"></div>
            <p>{t('serviceListingLoading')}</p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="service-profile-form">
          {/* Modal Header */}
          <div className="modal-header">
            <h2 className="modal-title">{t(isEditMode ? 'editServiceListing' : 'postServiceListing')}</h2>
            <p className="modal-subtitle">
              {isEditMode
                ? t('serviceListingEditSubtitle')
                : t('serviceListingPostSubtitle')}
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
              ✓ {t('serviceListingSaved')}
            </div>
          )}
          {/* Service Information Section */}
          <section className="form-section">
            <h3 className="section-header">{t('serviceListingServiceInformation')}</h3>
            
            <p className="section-description">{t('serviceListingAccountNameNote')}</p>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="barangayAddress" className="form-label">{t('serviceListingBarangayAddress')}<span className="required">*</span></label>
                <input
                  type="text"
                  id="barangayAddress"
                  name="barangayAddress"
                  placeholder={t('serviceListingBarangayPlaceholder')}
                  value={formData.barangayAddress}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="startingPrice" className="form-label">{t('serviceListingDailyRate')}<span className="required">*</span></label>
                <input
                  type="number"
                  id="startingPrice"
                  name="startingPrice"
                  placeholder={t('serviceListingDailyRatePlaceholder')}
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
            <h3 className="section-header">{t('serviceListingCategories')}<span className="required">*</span></h3>
            <p className="section-description">{t('serviceListingSelectServices')}</p>
            
            <div className="categories-grid">
              {categories.map((category) => (
                <label
                  key={category.key}
                  className={`category-pill ${formData.serviceCategories.includes(category.label) ? 'active' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={formData.serviceCategories.includes(category.label)}
                    onChange={() => handleCategoryToggle(category.label)}
                    aria-label={category.label}
                  />
                  <span>{category.label}</span>
                </label>
              ))}
            </div>
          </section>

          {dedupedServiceTypes.length > 0 && (
            <section className="form-section">
              <h3 className="section-header">{t('serviceListingServicesOffered')}</h3>
              <p className="section-description">{t('serviceListingServicesOfferedDescription')}</p>

              <div className="categories-grid">
                {dedupedServiceTypes.map((serviceType) => (
                  <label
                    key={serviceType.key}
                    className={`category-pill ${formData.serviceTypes.includes(serviceType.key) ? 'active' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.serviceTypes.includes(serviceType.key)}
                      onChange={() => handleServiceTypeToggle(serviceType.key)}
                      aria-label={`${serviceType.label} (${serviceType.categoryLabel})`}
                    />
                    <span>{serviceType.label}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

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
                  <img src={bannerPreview} alt={t('serviceListingBannerPreviewAlt')} className="banner-preview" />
                ) : (
                  <>
                    <div className="upload-icon">⬆️</div>
                    <h4>{t('serviceListingUploadBanner')}</h4>
                    <p>{t('serviceListingUploadHint')}</p>
                  </>
                )}
              </label>
            </div>
          </section>

          {/* Important Notes */}
          <section className="form-section important-notes">
            <h4>{t('importantNotes')}</h4>
            <ul>
              <li>{t('serviceListingRequiredFieldsNote')}</li>
              <li>{t('serviceListingBannerNote')}</li>
              <li>{t('serviceListingCategoryNote')}</li>
            </ul>
          </section>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="btn-submit"
            disabled={isLoading || success}
          >
            {isLoading ? t('serviceListingSaving') : t(isEditMode ? 'serviceListingSave' : 'postServiceListing')}
          </button>

          {/* Terms Agreement */}
          <p className="terms-text">
            {t('serviceListingTermsPrefix')} <a href="#">{t('termsOfService')}</a> {t('and')} <a href="#">{t('privacyPolicy')}</a>.
          </p>
        </form>
        )}
      </div>
    </div>,
    document.body
  );
}
