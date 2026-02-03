import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BookingModal from '../components/common/BookingModal';
import { serviceProviders } from '../data/data';
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

const providerProfiles = {
  1: {
    profession: 'Gardener',
    jobs: 72,
    about: 'I have been helping elders keep their blooms healthy all year round for years, along with occasional landscaping projects and even event floral styling. Basta garden, kaya nako!',
    skills: ['Flower Arrangement', 'Ornamental Gardening', 'Shrub Pruning', 'Outdoor Styling'],
    portfolio: [
      { src: 'https://i.imgur.com/rpp0NaG.jpg', caption: 'Courtyard planting' },
      { src: 'https://i.imgur.com/LDhVqmg.jpeg', caption: 'Event floral styling' },
      { src: 'https://i.imgur.com/6eyglNb.jpeg', caption: 'Backyard garden' },
      { src: 'https://i.imgur.com/fxK431w.jpeg', caption: 'Garden makeover' },
    ],
    reviews: [
      { reviewer: 'Alma Cudiamat', date: 'January 15, 2026', rating: 5, comment: 'Maria revived our garden in just two visits. She shows up early and gives easy maintenance tips.' },
      { reviewer: 'Tin Santos', date: 'December 28, 2025', rating: 4, comment: 'Creative floral setups for our fiesta stage. Minor delay on day 1 but still delivered beautifully.' },
    ],
    location: 'Barangay Poblacion, Toledo City',
    response: 'Within 12 hours',
    rate: 350,
    rateUnit: '/ visit',
  },
  2: {
    profession: 'Maintenance Specialist',
    jobs: 54,
    about: 'Aircraft maintenance specialist turned neighborhood handyman focused on precision repairs.',
    skills: ['Engine Diagnostics', 'Preventive Maintenance', 'Auto Detailing', 'Safety Inspection'],
    portfolio: [
      { src: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&h=420&fit=crop', caption: 'Engine tune-up and detailing' },
      { src: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&h=420&fit=crop', caption: 'Full systems check' },
      { src: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?w=600&h=420&fit=crop', caption: 'Hydraulics hose replacement' },
      { src: 'https://images.unsplash.com/photo-1514315384763-ba401779410f?w=600&h=420&fit=crop', caption: 'Hangar inspection support' },
    ],
    reviews: [
      { reviewer: 'Pilot Kay Rivera', date: 'January 09, 2026', rating: 5, comment: 'Lord France double-checked our aircraft before a Cebu hop. Very thorough and calm under pressure.' },
      { reviewer: 'Eric Dela Cruz', date: 'December 18, 2025', rating: 5, comment: 'Explained every repair option and kept the schedule tight. Worth the premium rate.' },
    ],
    location: 'Airport Road, Toledo City',
    response: 'Same day confirmation',
    rate: 648,
    rateUnit: '/ job',
  },
  3: {
    profession: 'Mason',
    jobs: 447,
    about: 'Family-owned masonry shop crafting new builds and rehabilitating heritage homes.',
    skills: ['Concrete Casting', 'Tiling', 'Exterior Finishing', 'Structural Repair'],
    portfolio: [
      { src: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&h=420&fit=crop', caption: 'Facade restoration' },
      { src: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?w=600&h=420&fit=crop', caption: 'Residential driveway pour' },
      { src: 'https://images.unsplash.com/photo-1503389152951-9f343605f61e?w=600&h=420&fit=crop', caption: 'Farmhouse interior wall' },
      { src: 'https://images.unsplash.com/photo-1437419764061-2473afe69fc2?w=600&h=420&fit=crop', caption: 'Accent stone cladding' },
    ],
    reviews: [
      { reviewer: 'Engr. Mae Banes', date: 'January 05, 2026', rating: 5, comment: 'Warren’s team kept our project on budget and documented every milestone. Heavy rain didn’t stop them.' },
      { reviewer: 'Romy Seno', date: 'November 30, 2025', rating: 4, comment: 'Solid workmanship. Took an extra day for curing but finish is top-notch.' },
    ],
    location: 'Sangi Road, Toledo City',
    response: 'Within 24 hours',
    rate: 602,
    rateUnit: '/ day',
  },
  4: {
    profession: 'Carpenter',
    jobs: 150,
    about: 'Cabinet maker specializing in bespoke furniture for small condos and parish offices.',
    skills: ['Custom Furniture', 'Cabinet Making', 'Door Installation', 'Wood Repair'],
    portfolio: [
      { src: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=420&fit=crop', caption: 'Kitchen cabinet refresh' },
      { src: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=600&h=420&fit=crop', caption: 'Custom dining bench' },
      { src: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?w=600&h=420&fit=crop', caption: 'Library shelving' },
      { src: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=420&fit=crop', caption: 'Media cabinet with LED' },
    ],
    reviews: [
      { reviewer: 'Ricardo Tan', date: 'January 20, 2026', rating: 5, comment: 'Excellent work. Joel translated my sketches exactly and cleaned up after every visit.' },
      { reviewer: 'Mariz Uy', date: 'December 10, 2025', rating: 4, comment: 'Arrived with samples and was honest about lead times. Worth waiting for the finish.' },
    ],
    location: 'Cabitoonan, Toledo City',
    response: 'Within 24 hours',
    rate: 674,
    rateUnit: '/ project',
  },
};

const buildFallbackProfile = (provider) => ({
  profession: provider.tags?.[0] || 'Service Provider',
  jobs: provider.reviews,
  about: 'Profile details will be updated soon.',
  skills: provider.tags?.length ? provider.tags : ['General Service'],
  portfolio: [],
  reviews: [],
  location: provider.location || 'Toledo City',
  response: 'Within 24 hours',
  rate: provider.startingPrice,
  rateUnit: '/job',
});

const ReviewSummary = ({ reviews }) => {
  const maxRating = 5;
  const counts = Array.from({ length: maxRating }, () => 0);
  reviews.forEach(({ rating }) => {
    const index = maxRating - rating;
    if (counts[index] !== undefined) counts[index] += 1;
  });
  const average = (
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
  ).toFixed(1);

  return (
    <div className="rating-summary">
      <div className="rating-score">
        <span className="rating-number">{average}</span>
        <p className="rating-label">Based on {reviews.length} reviews</p>
        <div className="rating-stars">
          {Array.from({ length: 5 }).map((_, idx) => (
            <span key={idx} className={idx < Math.round(average) ? 'star filled' : 'star'}>
              ★
            </span>
          ))}
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
        <p className="about-text">{profile.about}</p>
      </div>

      <div className="skills-section">
        <h3 className="skills-title">Skills and Expertise</h3>
        <div className="skills-grid">
          {profile.skills.map((skill) => (
            <div key={skill} className="skill-tag">• {skill}</div>
          ))}
        </div>
      </div>

      <div className="portfolio-tabs">
        <button
          className={`tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => setActiveTab('portfolio')}
        >
          Portfolio and Past Jobs ({profile.portfolio.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Ratings and Reviews ({profile.reviews.length})
        </button>
      </div>

      {activeTab === 'portfolio' && (
        <div className="portfolio-grid">
          {profile.portfolio.map((item) => (
            <div key={item.caption} className="portfolio-item">
              <img src={item.src} alt={item.caption} className="portfolio-image" />
              <p className="portfolio-caption">{item.caption}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="reviews-panel">
          {profile.reviews.length > 0 ? (
            <>
              <ReviewSummary reviews={profile.reviews} />
              <div className="review-list">
                {profile.reviews.map((review) => (
                  <div key={review.reviewer} className="review-card">
                    <div className="review-header">
                      <div>
                        <p className="reviewer-name">{review.reviewer}</p>
                        <p className="review-date">{review.date}</p>
                      </div>
                      <div className="review-rating">{'★'.repeat(review.rating)}</div>
                    </div>
                    <p className="review-text">{review.comment}</p>
                    <div className="review-actions">
                      <button className="chip-outline">High quality</button>
                      <button className="chip-outline">Fast response</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="no-reviews">
              <p>No reviews yet. Book this provider to share the first rating.</p>
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

      <button className="btn-request-service" onClick={() => setShowBooking(true)}>
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

      {showBooking && (
        <BookingModal
          provider={provider}
          onClose={() => setShowBooking(false)}
        />
      )}
    </section>
  );
};

const ServiceProviderPortfolio = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const providerId = Number(id);
  const provider = serviceProviders.find((p) => p.id === providerId) || serviceProviders[0];
  const profile = providerProfiles[provider?.id] || (provider ? buildFallbackProfile(provider) : null);

  if (!provider || !profile) {
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