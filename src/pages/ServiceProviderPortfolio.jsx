import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import BookingModal from '../components/common/BookingModal';
import MobileStickyAction from '../components/mobile/MobileStickyAction';
import { serviceProfileAPI, isAuthenticated } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import {
  ArrowLeftIcon,
  StarIcon,
  CheckIcon,
  LocationIcon,
  ClockIcon,
} from '../components/common/Icons';

const ReviewSummary = ({ reviews }) => {
  const { t } = useLanguage();
  const maxRating = 5;
  const counts = Array.from({ length: maxRating }, () => 0);
  reviews.forEach(({ rating }) => {
    const rounded = Math.round(Number(rating));
    const index = maxRating - rounded;
    if (index >= 0 && index < counts.length) counts[index] += 1;
  });
  const average = (
    reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length
  ).toFixed(1);

  return (
    <div className="rating-summary">
      <div className="rating-score">
        <span className="rating-number">{average}</span>
        <p className="rating-label">{t('providerReviewsBasedOn', { count: reviews.length })}</p>
        <div className="rating-stars">
          {Array.from({ length: 5 }).map((_, idx) => {
            const val = idx + 1;
            const avg = parseFloat(average);
            return (
              <span key={idx} className={val <= Math.floor(avg) ? 'star filled' : val - 0.5 <= avg ? 'star half-filled' : 'star'}>
                ★
              </span>
            );
          })}
        </div>
      </div>
      <div className="rating-bars">
        {counts.map((count, idx) => {
          const ratingValue = maxRating - idx;
          const percentage = reviews.length ? (count / reviews.length) * 100 : 0;
          return (
            <div key={ratingValue} className="rating-bar-row">
              <span className="bar-label">{ratingValue}★</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${percentage}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const formatPublicAvailabilitySummary = (apiProfile, t) => {
  if (!apiProfile?.showAvailabilityStatus) return '';

  const nextDate = apiProfile.nextAvailableDate
    ? new Date(`${apiProfile.nextAvailableDate}T00:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  if (apiProfile.availabilityStatus === 'unavailable') {
    return t('availabilityNotAccepting');
  }

  if (apiProfile.availabilityStatus === 'no_slots') {
    return t('availabilityNoBookableDates');
  }

  if (apiProfile.availabilityStatus === 'busy') {
    return nextDate
      ? t('availabilityBusyNext', { date: nextDate })
      : t('availabilityBusyNow');
  }

  if (nextDate) {
    return t('availabilityNextAvailable', { date: nextDate });
  }

  return apiProfile.acceptingRequests ? t('availabilityAcceptingRequests') : '';
};

const ProviderCard = ({ provider, profile, onBack, hideBackLink = false, isPreviewMode = false }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('portfolio');
  const [showBooking, setShowBooking] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [expandedImage, setExpandedImage] = useState(null);
  const navigate = useNavigate();
  const canRequestService = provider?.isPublished !== false
    && provider?.acceptingRequests !== false
    && provider?.hasFutureBookableSlot !== false;
  const unavailableActionLabel = provider?.acceptingRequests === false
    ? t('currentlyUnavailable')
    : provider?.hasFutureBookableSlot === false
      ? t('availabilityNoBookableDates')
      : t('currentlyUnavailable');
  const initials = String(provider?.name || 'ST')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const reviewCount = profile.reviews?.length || 0;
  const numericRating = Number(provider.rating || 0);
  const hasReviews = reviewCount > 0 && numericRating > 0;
  const availabilitySummary = String(profile.availabilitySummary || '').trim();
  const numericRate = Number(profile.rate);
  const hasRate = Number.isFinite(numericRate) && numericRate > 0;
  const normalizedRateUnit = String(profile.rateUnit || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const rateUnitKey = {
    per_day: 'pricingPerDay',
    day: 'pricingPerDay',
    '/day': 'pricingPerDay',
    per_hour: 'pricingPerHour',
    hour: 'pricingPerHour',
    '/hour': 'pricingPerHour',
    per_job: 'pricingPerJob',
    job: 'pricingPerJob',
    '/job': 'pricingPerJob',
  }[normalizedRateUnit];
  const rateUnitSuffix = rateUnitKey ? `/${t(rateUnitKey)}` : '';
  const rateValue = hasRate ? `₱${numericRate.toLocaleString()}${rateUnitSuffix}` : t('priceOnRequest');
  const summaryPrice = hasRate ? `${t('startingAt')} ${rateValue}` : rateValue;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  const handleRequestService = () => {
    if (!isAuthenticated()) {
      setShowLoginPrompt(true);
    } else {
      setShowBooking(true);
    }
  };

  const handleLoginRedirect = () => {
    // Store the current page to redirect back after login
    sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
    navigate('/login');
  };

  return (
    <section className="provider-section">
      {!hideBackLink && (
        <button type="button" className="back-link" onClick={handleBack}>
          <ArrowLeftIcon /> {t('providerBackToBrowse')}
        </button>
      )}

      <div className="profile-summary">
        <div className="profile-header">
          <div className="profile-avatar-large">{initials}</div>
          <div className="profile-details">
            <div className="profile-name-row">
              <h1>{provider.name}</h1>
              {provider.verified && (
                <span className="verified-badge profile-verified-badge" title={t('providerVerifiedTitle')} aria-label={t('providerVerifiedTitle')}>
                  <CheckIcon />
                </span>
              )}
            </div>
            <p className="profile-profession">{profile.profession || provider.tags?.[0] || t('serviceProvider')}</p>
            <div className="profile-stats">
              <span className="stat-item">
                <StarIcon /> {hasReviews ? `${numericRating.toFixed(1)} · ${reviewCount} ${t(reviewCount === 1 ? 'reviewSingular' : 'reviewPlural')}` : t('noReviewsYet')}
              </span>
              <span className="stat-item">
                <LocationIcon /> {profile.location || provider.location || 'Toledo City'}
              </span>
            </div>
            {availabilitySummary && (
              <p className="profile-availability-note">{availabilitySummary}</p>
            )}
          </div>
        </div>

        <aside className="profile-summary-actions" aria-label={t('providerPriceActionsAria')}>
          <p className="profile-summary-price">{summaryPrice}</p>
          {isPreviewMode ? (
            <span className="provider-preview-badge" role="status">
              <i className="bi bi-eye" aria-hidden="true"></i>
              Preview mode
            </span>
          ) : (
            <button
              className="btn-request-service profile-summary-request-btn"
              onClick={handleRequestService}
              disabled={!canRequestService}
              data-tour="provider-request-service"
            >
              {canRequestService ? t('requestService') : unavailableActionLabel}
            </button>
          )}
        </aside>
      </div>

      <div className="about-section">
        <h3 className="about-title">{t('providerAboutTitle')}</h3>
        {profile.about ? (
          <p className="about-text">{profile.about}</p>
        ) : (
          <p className="compact-empty-text">{t('providerAboutEmpty')}</p>
        )}
      </div>

      <div className="skills-section">
        <h3 className="skills-title">{t('providerServicesOffered')}</h3>
        {profile.serviceTypes && profile.serviceTypes.length > 0 ? (
          <div className="skills-grid">
            {profile.serviceTypes.map((serviceType) => (
              <span key={serviceType.key} className="skill-tag">{serviceType.label}</span>
            ))}
          </div>
        ) : (
          <p className="compact-empty-text">{t('providerServiceDetailsEmpty')}</p>
        )}
      </div>

      <div className="skills-section">
        <h3 className="skills-title">{t('providerSkillsSpecialties')}</h3>
        {profile.skills && profile.skills.length > 0 ? (
          <div className="skills-grid">
            {profile.skills.map((skill) => (
              <span key={skill} className="skill-tag">{skill}</span>
            ))}
          </div>
        ) : (
          <p className="compact-empty-text">{t('providerSkillsEmpty')}</p>
        )}
      </div>

      <div className="about-section">
        <h3 className="about-title">{t('providerLanguagesTitle')}</h3>
        {Array.isArray(profile.languages) && profile.languages.length > 0 ? (
          <p className="about-text">{profile.languages.join(', ')}</p>
        ) : (
          <p className="compact-empty-text">{t('notSpecified')}.</p>
        )}
      </div>

      <div className="portfolio-tabs" role="tablist" aria-label={t('providerPortfolioReviewsTabs')}>
        <button
          className={`tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => setActiveTab('portfolio')}
          role="tab"
          aria-selected={activeTab === 'portfolio'}
        >
          {t('portfolio')} ({profile.portfolio?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
          role="tab"
          aria-selected={activeTab === 'reviews'}
        >
          {t('reviews')} ({profile.reviews?.length || 0})
        </button>
      </div>

      {activeTab === 'portfolio' && (
        <>
          {profile.portfolio && profile.portfolio.length > 0 ? (
            <div className="portfolio-grid">
              {profile.portfolio.map((item, index) => {
                const hasImage = Boolean(item.src);
                const title = item.serviceLabel || item.caption || t('providerCompletedJobFallback');
                const completedDate = item.completedAt
                  ? new Date(item.completedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '';

                return (
                  <div
                    key={item.id || index}
                    className={`portfolio-item ${hasImage ? 'clickable' : 'portfolio-item-no-photo'}`}
                    onClick={hasImage ? () => setExpandedImage(item.src) : undefined}
                    role={hasImage ? 'button' : undefined}
                    tabIndex={hasImage ? 0 : undefined}
                    onKeyDown={hasImage ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setExpandedImage(item.src);
                      }
                    } : undefined}
                  >
                    <div className="portfolio-item-media">
                      {hasImage ? (
                        <img
                          src={item.src}
                          alt={t('providerPortfolioImageAlt', { name: provider.name })}
                          className="portfolio-image non-draggable-image"
                          draggable="false"
                        />
                      ) : (
                        <div className="portfolio-image-placeholder" aria-hidden="true">
                          <i className="bi bi-briefcase-fill"></i>
                          <span>{t('providerCompletedJobFallback')}</span>
                        </div>
                      )}

                      {item.completedThroughPlatform && (
                        <span className="verified-badge portfolio-item-badge">
                          {t('providerCompletedThroughPlatform')}
                        </span>
                      )}
                    </div>

                    <div className="portfolio-item-details">
                      <p className="portfolio-item-title">{title}</p>
                      {completedDate && (
                        <p className="portfolio-item-meta">
                          {t('providerPortfolioCompletedOn', { date: completedDate })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="compact-empty-text portfolio-empty-copy">{t('providerPortfolioEmpty')}</p>
          )}
        </>
      )}

      {activeTab === 'reviews' && (
        <div className="reviews-panel">
          {profile.reviews && profile.reviews.length > 0 ? (
            <>
              <ReviewSummary reviews={profile.reviews} />
              <div className="review-list">
                {profile.reviews.map((review, index) => (
                  <div key={review.id || review.reviewer || index} className="review-card">
                    <div className="review-header">
                      <div>
                        <p className="reviewer-name">{review.reviewer}</p>
                        <p className="review-date">{review.date}</p>
                      </div>
                      <div className="review-rating">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const r = Number(review.rating);
                          return (
                            <span key={i} className={i + 1 <= Math.floor(r) ? 'star filled' : i + 0.5 < r ? 'star half-filled' : 'star'}>★</span>
                          );
                        })}
                        <span className="rating-value">{Number(review.rating).toFixed(1)}</span>
                      </div>
                    </div>
                    <p className="review-text">{review.comment}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="compact-empty-text">{t('noReviewsYet')}.</p>
          )}
        </div>
      )}

      <div className="contact-section">
        <h3 className="contact-title">{t('providerAdditionalInformation')}</h3>
        {[
          {
          icon: <LocationIcon />, label: t('location'), value: profile.location,
          }, {
          icon: <ClockIcon />, label: t('providerTypicalResponseTime'), value: profile.response,
          }
        ].map((item) => (
          <div key={item.label} className="contact-item">
            <div className="contact-icon">{item.icon}</div>
            <div>
              <p className="contact-label">{item.label}</p>
              <p className="contact-value">{item.value || t('notSpecified')}</p>
            </div>
          </div>
        ))}
      </div>

      {showLoginPrompt && (
        <div className="login-prompt-overlay" onClick={() => setShowLoginPrompt(false)}>
          <div className="login-prompt-modal" onClick={(e) => e.stopPropagation()}>
            <button className="login-prompt-close" type="button" onClick={() => setShowLoginPrompt(false)}>
              <i className="bi bi-x-lg"></i>
            </button>
            <div className="login-prompt-icon">
              <i className="bi bi-person-lock"></i>
            </div>
            <h3>{t('providerLoginRequired')}</h3>
            <p>{t('providerLoginRequestMessage')}</p>
            <div className="login-prompt-actions">
              <button className="btn-login-prompt" onClick={handleLoginRedirect}>
                {t('logIn')}
              </button>
              <button className="btn-register-prompt" onClick={() => navigate('/register')}>
                {t('createAccount')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBooking && (
        <BookingModal
          provider={provider}
          onClose={() => setShowBooking(false)}
        />
      )}

      {!isPreviewMode && (
        <MobileStickyAction
          className="provider-mobile-request-bar"
          leftContent={(
            <div className="provider-mobile-rate">
              {hasRate && <p className="provider-mobile-rate-label">{t('startingAt')}</p>}
              <p className="provider-mobile-rate-value">{rateValue}</p>
            </div>
          )}
        >
          <button
            type="button"
            className="btn-request-service provider-mobile-request-btn"
            onClick={handleRequestService}
            disabled={!canRequestService}
            data-tour="provider-request-service"
          >
            {canRequestService ? t('requestService') : unavailableActionLabel}
          </button>
        </MobileStickyAction>
      )}

      {expandedImage && (
        <div className="image-lightbox-overlay" onClick={() => setExpandedImage(null)}>
          <button className="lightbox-close" onClick={() => setExpandedImage(null)}>
            <i className="bi bi-x-lg"></i>
          </button>
          <img 
            src={expandedImage} 
            alt={t('portfolio')} 
            className="lightbox-image"
            draggable="false"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
};

const ServiceProviderPortfolio = () => {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const providerId = Number(id);
  const isPreviewMode = Boolean(
    location.state?.previewMode
    || new URLSearchParams(location.search).get('previewMode')
  );
  
  const [provider, setProvider] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await serviceProfileAPI.getProfileById(providerId);
        
        if (response.success && response.data) {
          const apiProfile = response.data;
          // Transform API data to match component structure
          const transformedProvider = {
            id: apiProfile.id,
            userId: apiProfile.userId,
            name: apiProfile.name,
            rating: apiProfile.rating || 5.0,
            reviews: apiProfile.reviewsCount || 0,
            location: apiProfile.location,
            online: apiProfile.online,
            description: apiProfile.description,
            aboutMe: apiProfile.aboutMe || '',
            tags: apiProfile.tags || [],
            categories: apiProfile.categories || [],
            serviceTypes: apiProfile.serviceTypes || [],
            skills: apiProfile.skills || [],
            startingPrice: apiProfile.startingPrice,
            dailyRate: apiProfile.dailyRate ?? apiProfile.startingPrice,
            verified: apiProfile.verified || false,
            image: apiProfile.image,
            isPublished: apiProfile.isPublished !== false,
            availabilityStatus: apiProfile.availabilityStatus,
            acceptingRequests: apiProfile.acceptingRequests !== false,
            hasFutureBookableSlot: apiProfile.hasFutureBookableSlot !== false,
            nextAvailableDate: apiProfile.nextAvailableDate || null,
          };
          
          const transformedProfile = {
            profession: apiProfile.profession || apiProfile.categories?.[0] || t('serviceProvider'),
            jobs: apiProfile.jobsCompleted || apiProfile.reviewsCount || 0,
            about: apiProfile.aboutMe || apiProfile.description || '',
            categories: apiProfile.categories || [],
            serviceTypes: apiProfile.serviceTypes || [],
            skills: apiProfile.skills || [],
            portfolio: apiProfile.portfolio || [],
            reviews: apiProfile.reviews || [],
            languages: (apiProfile.languages || []).map((code) => ({ ceb: 'Cebuano', en: 'English', fil: 'Filipino' }[code] || code)),
            location: apiProfile.location,
            response: apiProfile.responseTime || t('within24Hours'),
            rate: apiProfile.dailyRate ?? apiProfile.startingPrice,
            rateUnit: apiProfile.pricingUnit || (apiProfile.dailyRate != null ? '/day' : ''),
            availabilitySummary: formatPublicAvailabilitySummary(apiProfile, t),
          };
          
          setProvider(transformedProvider);
          setProfile(transformedProfile);
        } else {
          setError(t('providerNotFound'));
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(t('providerLoadErrorText'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [providerId, t]);

  if (loading) {
    return (
      <div className="portfolio-shell">
        <div className="portfolio-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>{t('providerLoadingProfile')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !provider || !profile) {
    return (
      <div className="portfolio-shell empty-state">
        <div className="portfolio-container">
          <h2>{t('providerNotFound')}</h2>
          <p>{t('providerLoadErrorText')}</p>
          <button className="btn-view-profile" onClick={() => navigate('/feed')}>
            {t('backToFeed')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-shell">
      <div className="portfolio-container">
        <ProviderCard
          provider={provider}
          profile={profile}
          onBack={() => navigate('/feed')}
          hideBackLink={isPreviewMode}
          isPreviewMode={isPreviewMode}
        />
      </div>
    </div>
  );
};

export default ServiceProviderPortfolio;