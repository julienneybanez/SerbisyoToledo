import { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import BookingModal from '../components/common/BookingModal';
import MobileStickyAction from '../components/mobile/MobileStickyAction';
import { serviceProfileAPI, isAuthenticated } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { AppButton, IconButton } from '../components/ui';
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

const padDatePart = (value) => String(value).padStart(2, '0');

const toDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
};

const fromDateKey = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const addCalendarDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const formatAvailabilityTime = (value) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value || '';
  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const ProviderCard = ({ provider, profile, onBack, hideBackLink = false, isPreviewMode = false }) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('portfolio');
  const [showBooking, setShowBooking] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [expandedImage, setExpandedImage] = useState(null);
  const [availableDateKeys, setAvailableDateKeys] = useState([]);
  const [selectedAvailabilityDate, setSelectedAvailabilityDate] = useState(provider?.nextAvailableDate || '');
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [selectedPreviewTime, setSelectedPreviewTime] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(
    () => fromDateKey(provider?.nextAvailableDate) || new Date()
  );
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

  useEffect(() => {
    let mounted = true;

    const loadPublicAvailability = async () => {
      if (!provider?.id || provider?.acceptingRequests === false) {
        setAvailableDateKeys([]);
        setSelectedAvailabilityDate('');
        setAvailabilitySlots([]);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = addCalendarDays(today, 60);

      try {
        setAvailabilityLoading(true);
        setAvailabilityError('');
        const response = await serviceProfileAPI.getAvailableDates(provider.id, {
          fromDate: toDateKey(today),
          toDate: toDateKey(end),
          duration: 120,
        });

        if (!mounted) return;

        const dates = response?.success && Array.isArray(response.data?.dates)
          ? response.data.dates
          : [];
        setAvailableDateKeys(dates);

        const preferred = dates.includes(provider.nextAvailableDate)
          ? provider.nextAvailableDate
          : dates[0] || '';

        setSelectedAvailabilityDate(preferred);
        if (preferred) {
          const preferredDate = fromDateKey(preferred);
          if (preferredDate) setCalendarMonth(preferredDate);
        }
      } catch {
        if (!mounted) return;
        setAvailableDateKeys([]);
        setSelectedAvailabilityDate('');
        setAvailabilitySlots([]);
        setAvailabilityError(
          language === 'ceb'
            ? 'Dili ma-load ang availability karon.'
            : 'Availability could not be loaded right now.'
        );
      } finally {
        if (mounted) setAvailabilityLoading(false);
      }
    };

    loadPublicAvailability();
    return () => { mounted = false; };
  }, [language, provider?.acceptingRequests, provider?.id, provider?.nextAvailableDate]);

  useEffect(() => {
    let mounted = true;

    const loadTimes = async () => {
      if (!provider?.id || !selectedAvailabilityDate) {
        setAvailabilitySlots([]);
        setSelectedPreviewTime('');
        return;
      }

      try {
        setSlotLoading(true);
        const response = await serviceProfileAPI.getAvailableSlots(provider.id, {
          date: selectedAvailabilityDate,
          duration: 120,
          bookingType: 'one_day',
        });

        if (!mounted) return;

        const slots = response?.success && Array.isArray(response.data?.slots)
          ? response.data.slots
          : [];
        setAvailabilitySlots(slots);
        setSelectedPreviewTime(slots[0]?.time || '');
      } catch {
        if (!mounted) return;
        setAvailabilitySlots([]);
        setSelectedPreviewTime('');
      } finally {
        if (mounted) setSlotLoading(false);
      }
    };

    loadTimes();
    return () => { mounted = false; };
  }, [provider?.id, selectedAvailabilityDate]);

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
        <AppButton variant="ghost" size="sm" onClick={handleBack} icon={<ArrowLeftIcon />}>
          {t('providerBackToBrowse')}
        </AppButton>
      )}

      <div className="profile-summary">
        <div className="profile-header">
          <div className="profile-avatar-large">
            {provider.profilePhoto ? (
              <img src={provider.profilePhoto} alt={`${provider.name} profile`} className="profile-avatar-image non-draggable-image" draggable="false" />
            ) : initials}
          </div>
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
            <AppButton
              className="profile-summary-request-btn"
              onClick={handleRequestService}
              disabled={!canRequestService}
              data-tour="provider-request-service"
            >
              {canRequestService ? t('requestService') : unavailableActionLabel}
            </AppButton>
          )}
        </aside>
      </div>

      <aside className="provider-availability-panel" aria-label={t('availabilityPageTitle')}>
        <div className="provider-availability-heading">
          <div>
            <h2>{t('availabilityPageTitle')}</h2>
            <p>{availabilitySummary || t('availabilityAcceptingRequests')}</p>
          </div>
          <span className="provider-availability-status" aria-hidden="true">
            <i className="bi bi-calendar-check"></i>
          </span>
        </div>

        <div className="provider-profile-calendar">
          {availabilityLoading ? (
            <div className="provider-availability-state">
              <span className="spinner-small" aria-hidden="true"></span>
              <span>{t('bookingLoadingAvailability')}</span>
            </div>
          ) : availabilityError ? (
            <div className="provider-availability-state provider-availability-state-error">
              <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
              <span>{availabilityError}</span>
            </div>
          ) : availableDateKeys.length === 0 ? (
            <div className="provider-availability-state">
              <i className="bi bi-calendar-x" aria-hidden="true"></i>
              <span>{t('availabilityNoBookableDates')}</span>
            </div>
          ) : (
            <DayPicker
              mode="single"
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              selected={fromDateKey(selectedAvailabilityDate)}
              onSelect={(date) => {
                const key = toDateKey(date);
                if (key && availableDateKeys.includes(key)) {
                  setSelectedAvailabilityDate(key);
                }
              }}
              disabled={(date) => !availableDateKeys.includes(toDateKey(date))}
              modifiers={{ available: availableDateKeys.map(fromDateKey).filter(Boolean) }}
              showOutsideDays={false}
            />
          )}
        </div>

        <div className="provider-available-times">
          <h3>{language === 'ceb' ? 'Available nga oras' : 'Available times'}</h3>
          {slotLoading ? (
            <div className="provider-time-state">
              <span className="spinner-small" aria-hidden="true"></span>
              <span>{t('bookingLoadingAvailability')}</span>
            </div>
          ) : availabilitySlots.length > 0 ? (
            <div className="provider-time-chips">
              {availabilitySlots.map((slot) => (
                <button
                  key={`${selectedAvailabilityDate}-${slot.time}`}
                  type="button"
                  className={`provider-time-chip ${selectedPreviewTime === slot.time ? 'active' : ''}`}
                  onClick={() => setSelectedPreviewTime(slot.time)}
                  aria-pressed={selectedPreviewTime === slot.time}
                >
                  {formatAvailabilityTime(slot.time)}
                </button>
              ))}
            </div>
          ) : (
            <p className="provider-time-empty">
              {selectedAvailabilityDate
                ? (language === 'ceb' ? 'Walay available nga oras niini nga petsa.' : 'No available times for this date.')
                : t('availabilityNoBookableDates')}
            </p>
          )}
        </div>

        {!isPreviewMode && canRequestService && (
          <AppButton className="provider-availability-request" onClick={handleRequestService}>
            {t('requestService')}
          </AppButton>
        )}
      </aside>

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
            <IconButton className="login-prompt-close" onClick={() => setShowLoginPrompt(false)} aria-label={t('close')}>
              <i className="bi bi-x-lg"></i>
            </IconButton>
            <div className="login-prompt-icon">
              <i className="bi bi-person-lock"></i>
            </div>
            <h3>{t('providerLoginRequired')}</h3>
            <p>{t('providerLoginRequestMessage')}</p>
            <div className="login-prompt-actions">
              <AppButton variant="secondary" onClick={handleLoginRedirect}>
                {t('logIn')}
              </AppButton>
              <AppButton onClick={() => navigate('/register')}>
                {t('createAccount')}
              </AppButton>
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
          <AppButton
            className="provider-mobile-request-btn"
            onClick={handleRequestService}
            disabled={!canRequestService}
            data-tour="provider-request-service"
          >
            {canRequestService ? t('requestService') : unavailableActionLabel}
          </AppButton>
        </MobileStickyAction>
      )}

      {expandedImage && (
        <div className="image-lightbox-overlay" onClick={() => setExpandedImage(null)}>
          <IconButton className="lightbox-close" onClick={() => setExpandedImage(null)} aria-label={t('close')}>
            <i className="bi bi-x-lg"></i>
          </IconButton>
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
            profilePhoto: apiProfile.profilePhoto || null,
            isPublished: apiProfile.isPublished !== false,
            availabilityStatus: apiProfile.availabilityStatus,
            acceptingRequests: apiProfile.acceptingRequests !== false,
            hasFutureBookableSlot: apiProfile.hasFutureBookableSlot !== false,
            nextAvailableDate: apiProfile.nextAvailableDate || null,
            nextAvailableTime: apiProfile.nextAvailableTime || null,
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
          <AppButton variant="secondary" onClick={() => navigate('/feed')}>
            {t('backToFeed')}
          </AppButton>
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