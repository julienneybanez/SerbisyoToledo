import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BookingModal from '../components/common/BookingModal';
import { serviceProfileAPI, isAuthenticated } from '../services/api';
import {
  ArrowLeftIcon,
  StarIcon,
  BriefcaseIcon,
  CommentIcon,
  PhoneIcon,
  EmailIcon,
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

const ProviderCard = ({ provider, profile, onBack }) => {
  const [activeTab, setActiveTab] = useState('portfolio');
  const [showBooking, setShowBooking] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [expandedImage, setExpandedImage] = useState(null);
  const navigate = useNavigate();
  const initials = provider.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
      <div className="back-link" onClick={handleBack}>
        <ArrowLeftIcon /> Back to Browse
      </div>

      <div className="profile-header">
        <div className="profile-avatar-large">{initials}</div>
        <div className="profile-details">
          <h1>{provider.name}</h1>
          <p className="profile-profession">{profile.profession || provider.tags?.[0] || 'Service Provider'}</p>
          <div className="profile-stats">
            <span className="stat-item">
              <StarIcon /> {provider.rating} Rating
            </span>
            <span className="stat-item">
              <BriefcaseIcon /> {profile.jobs} Jobs Complete
            </span>
            <span className="stat-item">
              <CommentIcon /> {profile.reviews.length} Reviews
            </span>
          </div>
        </div>
      </div>

      <div className="about-section">
        <h3 className="about-title">About Me</h3>
        {profile.about ? (
          <p className="about-text">{profile.about}</p>
        ) : (
          <div className="about-empty">
            <p className="empty-text">This provider hasn't added their bio yet.</p>
          </div>
        )}
      </div>

      <div className="skills-section">
        <h3 className="skills-title">Skills and Expertise</h3>
        {profile.skills && profile.skills.length > 0 ? (
          <div className="skills-grid">
            {profile.skills.map((skill) => (
              <div key={skill} className="skill-tag">• {skill}</div>
            ))}
          </div>
        ) : (
          <div className="skills-empty">
            <p className="empty-text">No skills listed yet.</p>
          </div>
        )}
      </div>

      <div className="portfolio-tabs">
        <button
          className={`tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => setActiveTab('portfolio')}
        >
          Portfolio and Past Jobs ({profile.portfolio?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Ratings and Reviews ({profile.reviews?.length || 0})
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
                  <img src={item.src} alt="Portfolio image" className="portfolio-image" />
                </div>
              ))}
            </div>
          ) : (
            <div className="portfolio-empty">
              <div className="empty-portfolio-grid">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="portfolio-placeholder">
                    <i className="bi bi-image"></i>
                    <span>No image</span>
                  </div>
                ))}
              </div>
              <p className="empty-text">This provider hasn't uploaded portfolio items yet.</p>
            </div>
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
            <div className="no-reviews">
              <i className="bi bi-chat-square-text"></i>
              <p>No reviews yet. Be the first to book and review this provider!</p>
            </div>
          )}
        </div>
      )}

      <div className="pricing-section">
        <div className="price-display">
          <span className="price-currency">₱</span>
          {profile.rate}
          <span className="price-unit"> {profile.rateUnit}</span>
        </div>
        <p className="price-label">Average rate</p>
      </div>

      <button className="btn-request-service" onClick={handleRequestService}>
        Request Service
      </button>

      <div className="contact-section">
        <h3 className="contact-title">Contact Information</h3>
        {[{
          icon: <PhoneIcon />, label: 'Phone', value: 'Book first to see contact details',
        }, {
          icon: <EmailIcon />, label: 'Email', value: 'Book first to see contact details',
        }, {
          icon: <LocationIcon />, label: 'Location', value: profile.location,
        }, {
          icon: <ClockIcon />, label: 'Typical response time', value: profile.response,
        }].map((item) => (
          <div key={item.label} className="contact-item">
            <div className="contact-icon">{item.icon}</div>
            <div>
              <p className="contact-label">{item.label}</p>
              <p className="contact-value">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {showLoginPrompt && (
        <div className="login-prompt-overlay" onClick={() => setShowLoginPrompt(false)}>
          <div className="login-prompt-modal" onClick={(e) => e.stopPropagation()}>
            <button className="login-prompt-close" onClick={() => setShowLoginPrompt(false)}>
              ÁE
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

      {expandedImage && (
        <div className="image-lightbox-overlay" onClick={() => setExpandedImage(null)}>
          <button className="lightbox-close" onClick={() => setExpandedImage(null)}>
            <i className="bi bi-x-lg"></i>
          </button>
          <img 
            src={expandedImage} 
            alt="Portfolio image" 
            className="lightbox-image"
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
  const providerId = Number(id);
  
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
            verified: apiProfile.verified || false,
            image: apiProfile.image,
          };
          
          const transformedProfile = {
            profession: apiProfile.profession || apiProfile.categories?.[0] || 'Service Provider',
            jobs: apiProfile.jobsCompleted || apiProfile.reviewsCount || 0,
            about: apiProfile.aboutMe || apiProfile.description || '',
            skills: apiProfile.categories || apiProfile.tags || [],
            portfolio: apiProfile.portfolio || [],
            reviews: apiProfile.reviews || [],
            location: apiProfile.location,
            response: apiProfile.responseTime || 'Within 24 hours',
            rate: apiProfile.startingPrice,
            rateUnit: '/job',
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
        />
      </div>
    </div>
  );
};

export default ServiceProviderPortfolio;