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
      { src: 'https://www.dutchpickle.com/wp-content/uploads/2007/10/summers-garden-catbalogan-4.jpg', caption: 'Courtyard planting' },
      { src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTGqPR_PFZ-le6xuIVlpcwYkaCoBHKaVW5opw&s', caption: 'Event floral styling' },
      { src: 'https://files01.pna.gov.ph/ograph/2022/11/07/bgo-backyard-garden-in-rooftop-baguio-2020pio-photo.jpg', caption: 'Backyard garden' },
      { src: 'https://storage.googleapis.com/msgsndr/rmfv9ue5178FjFTboURV/media/a1edc731-2225-4cfc-95ef-7fcd3adc4c30.jpeg', caption: 'Garden makeover' },
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
    about: 'Auto maintenance specialist turned neighborhood handyman focused on precision repairs.',
    skills: ['Engine Diagnostics', 'Preventive Maintenance', 'Auto Detailing', 'Safety Inspection'],
    portfolio: [
      { src: 'https://primer.com.ph/blog/wp-content/uploads/sites/14/2022/09/sanesu1-e1484630689158.jpg', caption: 'Engine tune-up and detailing' },
      { src: 'https://www.autodeal.com.ph/custom/blog-post/header/kia-ph-promotes-early-pms-booking-with-affordable-service-longer-intervals-and-35-service-centers-nationwide-68ec710d935c2.jpg', caption: 'Full systems check' },
      { src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTFba4iBY0CbryH4RdiGXL5PhAExa_hi03M5A&s', caption: 'Brake hose replacement' },
      { src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRRzYxL63F8tKLCAOOWAZ1NyjVsPTO7vZb9YQ&s', caption: 'Garage inspection support' },
    ],
    reviews: [
      { reviewer: 'Driver Kay Rivera', date: 'January 09, 2026', rating: 5, comment: 'Lord France double-checked my car before a long drive. Very thorough and calm under pressure.' },
      { reviewer: 'Eric Dela Cruz', date: 'December 18, 2025', rating: 5, comment: 'Explained every repair option and kept the schedule tight. Worth the premium rate.' },
    ],
    location: 'Highway Road, Toledo City',
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
      { src: 'https://raegophilippines.com/wp-content/uploads/2025/11/viber_image_2025-10-23_13-23-50-632.jpg', caption: 'Facade restoration' },
      { src: 'https://i.redd.it/redoing-my-driveway-and-pouring-concrete-in-a-couple-days-v0-ohuh3jb6qgpb1.jpg?width=3024&format=pjpg&auto=webp&s=076c03a6acc7537b405e2039b585b1eb8fd541a8', caption: 'Residential driveway pour' },
      { src: 'https://i.pinimg.com/736x/28/28/2a/28282a8ce1a1d83a32329b8a9e79d0c7.jpg', caption: 'Farmhouse interior wall' },
      { src: 'data:image/jpeg;base64,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', caption: 'Accent stone cladding' },
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
      { src: 'https://images.squarespace-cdn.com/content/v1/5a3231f41f318d37f3626913/1e087d70-455c-4c67-9cce-3b6769ae1cb0/Filipino+Kitchen+Design+%281%29.jpg', caption: 'Kitchen cabinet refresh' },
      { src: 'https://i.etsystatic.com/9980567/r/il/75e5f8/1791070176/il_340x270.1791070176_4tru.jpg', caption: 'Custom dining bench' },
      { src: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?w=600&h=420&fit=crop', caption: 'Library shelving' },
      { src: 'https://i.pinimg.com/236x/ae/d6/60/aed6605e19f4bad32609d5a12c99cae7.jpg', caption: 'Media cabinet with LED' },
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