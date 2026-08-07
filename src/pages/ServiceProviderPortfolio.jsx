import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import BookingModal from '../components/common/BookingModal';
import MobileStickyAction from '../components/mobile/MobileStickyAction';
import { serviceProfileAPI, isAuthenticated } from '../services/api';
import {
  ArrowLeftIcon,
  StarIcon,
  CheckIcon,
  LocationIcon,
  ClockIcon,
} from '../components/common/Icons';

const ReviewSummary = ({ reviews }) => {
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
        <p className="rating-label">Based on {reviews.length} reviews</p>
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

const ProviderCard = ({ provider, profile, onBack, hideBackLink = false }) => {
  const [activeTab, setActiveTab] = useState('portfolio');
  const [showBooking, setShowBooking] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [expandedImage, setExpandedImage] = useState(null);
  const navigate = useNavigate();
  const canRequestService = provider?.isPublished !== false;
  const initials = provider.name
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
  const safeRateUnit = String(profile.rateUnit || '').trim();
  const rateSuffix = safeRateUnit ? ` ${safeRateUnit}` : '';
  const summaryPrice = Number.isFinite(numericRate) && numericRate > 0
    ? `From ₱${numericRate.toLocaleString()}${rateSuffix}`
    : 'Price on request';

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
          <ArrowLeftIcon /> Back to Browse
        </button>
      )}

      <div className="profile-summary">
        <div className="profile-header">
          <div className="profile-avatar-large">{initials}</div>
          <div className="profile-details">
            <div className="profile-name-row">
              <h1>{provider.name}</h1>
              {provider.verified && (
                <span className="verified-badge profile-verified-badge" title="Verified provider" aria-label="Verified provider">
                  <CheckIcon />
                </span>
              )}
            </div>
            <p className="profile-profession">{profile.profession || provider.tags?.[0] || 'Service Provider'}</p>
            <div className="profile-stats">
              <span className="stat-item">
                <StarIcon /> {hasReviews ? `${numericRating.toFixed(1)} · ${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}
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

        <aside className="profile-summary-actions" aria-label="Price and booking actions">
          <p className="profile-summary-price">{summaryPrice}</p>
          <button
            className="btn-request-service profile-summary-request-btn"
            onClick={handleRequestService}
            disabled={!canRequestService}
            data-tour="provider-request-service"
          >
            {canRequestService ? 'Request Service' : 'Currently Unavailable'}
          </button>
        </aside>
      </div>

      <div className="about-section">
        <h3 className="about-title">About</h3>
        {profile.about ? (
          <p className="about-text">{profile.about}</p>
        ) : (
          <p className="compact-empty-text">This provider has not added an about section yet.</p>
        )}
      </div>

      <div className="skills-section">
        <h3 className="skills-title">Services & Skills</h3>
        {profile.skills && profile.skills.length > 0 ? (
          <div className="skills-grid">
            {profile.skills.map((skill) => (
              <span key={skill} className="skill-tag">{skill}</span>
            ))}
          </div>
        ) : (
          <p className="compact-empty-text">No services or skills listed yet.</p>
        )}
      </div>

      <div className="about-section">
        <h3 className="about-title">Languages</h3>
        {Array.isArray(profile.languages) && profile.languages.length > 0 ? (
          <p className="about-text">{profile.languages.join(', ')}</p>
        ) : (
          <p className="compact-empty-text">Not specified.</p>
        )}
      </div>

      <div className="portfolio-tabs" role="tablist" aria-label="Portfolio and reviews tabs">
        <button
          className={`tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => setActiveTab('portfolio')}
          role="tab"
          aria-selected={activeTab === 'portfolio'}
        >
          Portfolio ({profile.portfolio?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
          role="tab"
          aria-selected={activeTab === 'reviews'}
        >
          Reviews ({profile.reviews?.length || 0})
        </button>
      </div>

      {activeTab === 'portfolio' && (
        <>
          {profile.portfolio && profile.portfolio.length > 0 ? (
            <div className="portfolio-grid">
              {profile.portfolio.map((item, index) => (
                <div 
                  key={item.id || index} 
                  className="portfolio-item clickable"
                  onClick={() => setExpandedImage(item.src)}
                >
                  <img src={item.src} alt={`${provider.name} portfolio item`} className="portfolio-image non-draggable-image" draggable="false" />
                  {item.completedThroughPlatform && (
                    <span className="verified-badge portfolio-item-badge">
                      Completed through SerbisyoToledo
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="compact-empty-text portfolio-empty-copy">No portfolio work added yet.</p>
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
            <p className="compact-empty-text">No reviews yet.</p>
          )}
        </div>
      )}

      <div className="contact-section">
        <h3 className="contact-title">Additional Information</h3>
        {[
          {
          icon: <LocationIcon />, label: 'Location', value: profile.location,
          }, {
          icon: <ClockIcon />, label: 'Typical response time', value: profile.response,
          }
        ].map((item) => (
          <div key={item.label} className="contact-item">
            <div className="contact-icon">{item.icon}</div>
            <div>
              <p className="contact-label">{item.label}</p>
              <p className="contact-value">{item.value || 'Not specified'}</p>
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
            <h3>Login Required</h3>
            <p>You need to be logged in to request a service from this provider.</p>
            <div className="login-prompt-actions">
              <button className="btn-login-prompt" onClick={handleLoginRedirect}>
                Log In
              </button>
              <button className="btn-register-prompt" onClick={() => navigate('/register')}>
                Create Account
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

      <MobileStickyAction
        className="provider-mobile-request-bar"
        leftContent={(
          <div className="provider-mobile-rate">
            <p className="provider-mobile-rate-label">Starting at</p>
            <p className="provider-mobile-rate-value">₱{profile.rate}</p>
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
          {canRequestService ? 'Request Service' : 'Unavailable'}
        </button>
      </MobileStickyAction>

      {expandedImage && (
        <div className="image-lightbox-overlay" onClick={() => setExpandedImage(null)}>
          <button className="lightbox-close" onClick={() => setExpandedImage(null)}>
            <i className="bi bi-x-lg"></i>
          </button>
          <img 
            src={expandedImage} 
            alt="Portfolio image" 
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
            tags: apiProfile.categories || apiProfile.tags || [],
            startingPrice: apiProfile.startingPrice,
            dailyRate: apiProfile.dailyRate ?? apiProfile.startingPrice,
            verified: apiProfile.verified || false,
            image: apiProfile.image,
            isPublished: apiProfile.isPublished !== false,
          };
          
          const transformedProfile = {
            profession: apiProfile.profession || apiProfile.categories?.[0] || 'Service Provider',
            jobs: apiProfile.jobsCompleted || apiProfile.reviewsCount || 0,
            about: apiProfile.aboutMe || apiProfile.description || '',
            skills: apiProfile.categories || apiProfile.tags || [],
            portfolio: apiProfile.portfolio || [],
            reviews: apiProfile.reviews || [],
            languages: (apiProfile.languages || []).map((code) => ({ ceb: 'Cebuano', en: 'English', fil: 'Filipino' }[code] || code)),
            location: apiProfile.location,
            response: apiProfile.responseTime || 'Within 24 hours',
            rate: apiProfile.dailyRate ?? apiProfile.startingPrice,
            rateUnit: apiProfile.pricingUnit || (apiProfile.dailyRate != null ? '/day' : ''),
            availabilitySummary: apiProfile.availabilitySummary || apiProfile.nextAvailableLabel || '',
          };
          
          setProvider(transformedProvider);
          setProfile(transformedProfile);
        } else {
          setError('Provider not found');
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load provider profile');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [providerId]);

  if (loading) {
    return (
      <div className="portfolio-shell">
        <div className="portfolio-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !provider || !profile) {
    return (
      <div className="portfolio-shell empty-state">
        <div className="portfolio-container">
          <h2>Provider not found</h2>
          <p>We could not load this profile. Please return to the feed and try again.</p>
          <button className="btn-view-profile" onClick={() => navigate('/feed')}>
            Back to Feed
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
        />
      </div>
    </div>
  );
};

export default ServiceProviderPortfolio;