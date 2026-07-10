import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getUser, isAuthenticated, serviceProfileAPI, serviceRequestAPI } from "../services/api";
import { categories } from "../data/data";
import ProfileCompletionChecklist from "../components/common/ProfileCompletionChecklist";
import {
  SearchIcon,
  FilterIcon,
  StarIcon,
  CheckIcon,
  LocationIcon,
} from "../components/common/Icons";

export default function Feed() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [serviceProviders, setServiceProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams] = useSearchParams();
  const [clientChecklistLoading, setClientChecklistLoading] = useState(false);
  const [clientChecklistError, setClientChecklistError] = useState('');
  const [hasClientRequest, setHasClientRequest] = useState(false);
  const [filters, setFilters] = useState({
    location: "",
    minPrice: "",
    maxPrice: "",
    minRating: "",
  });
  const navigate = useNavigate();
  const user = getUser();
  const isClient = user?.userType === 'client';

  useEffect(() => {
    const queryValue = (searchParams.get('q') || '').trim();
    setSearchTerm(queryValue);
  }, [searchParams]);

  // Fetch service profiles on component mount or when filters change
  useEffect(() => {
    let isCurrentRequest = true;

    const fetchProfiles = async () => {
      try {
        if (isCurrentRequest) {
          setIsLoading(true);
          setError(null);
        }
        
        const filterParams = {
          category: activeCategory,
          location: filters.location,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          minRating: filters.minRating,
          search: searchTerm,
        };

        const result = await serviceProfileAPI.getAllProfiles(filterParams);
        
        if (!isCurrentRequest) return;

        if (result.success) {
          setServiceProviders(result.data);
        } else {
          setError(result.message || 'Failed to fetch service providers');
        }
      } catch (err) {
        if (!isCurrentRequest) return;
        console.error('Error fetching profiles:', err);
        setError('Failed to load service providers. Please try again.');
      } finally {
        if (isCurrentRequest) {
          setIsLoading(false);
        }
      }
    };

    fetchProfiles();

    // Listen for profile created event
    window.addEventListener('profileCreated', fetchProfiles);
    return () => {
      isCurrentRequest = false;
      window.removeEventListener('profileCreated', fetchProfiles);
    };
  }, [activeCategory, filters, searchTerm]);

  useEffect(() => {
    const fetchClientChecklistData = async () => {
      if (!isAuthenticated() || !isClient) return;

      setClientChecklistLoading(true);
      setClientChecklistError('');

      try {
        const response = await serviceRequestAPI.getClientRequests();
        if (response.success) {
          setHasClientRequest((response.data.requests || []).length > 0);
        }
      } catch (err) {
        setClientChecklistError('Unable to load some onboarding progress right now.');
      } finally {
        setClientChecklistLoading(false);
      }
    };

    fetchClientChecklistData();
  }, [isClient]);

  const clientChecklistTasks = [
    {
      key: 'basic-profile',
      label: 'Complete your basic profile',
      description: 'Make sure your name and email are set.',
      completed: Boolean(user?.fullName && user?.email),
      actionType: 'link',
      to: '/client-settings',
      actionLabel: 'Open Settings',
    },
    {
      key: 'contact-info',
      label: 'Add your contact information',
      description: 'Add a phone number so providers can reach you when needed.',
      completed: Boolean(user?.phone),
      actionType: 'link',
      to: '/client-settings',
      actionLabel: 'Add Contact',
    },
    {
      key: 'location',
      label: 'Add or confirm your location',
      description: 'Set your address to help with nearby service matching.',
      completed: Boolean(user?.address),
      actionType: 'link',
      to: '/client-settings',
      actionLabel: 'Update Location',
    },
    {
      key: 'browse-services',
      label: 'Browse available services',
      description: 'Explore providers and service categories.',
      completed: true,
      actionType: 'link',
      to: '/feed',
      actionLabel: 'Browse',
    },
    {
      key: 'first-booking',
      label: 'Send your first booking request',
      description: 'Open a provider profile and submit a service request.',
      completed: hasClientRequest,
      actionType: 'link',
      to: '/feed',
      actionLabel: 'Find Providers',
    },
  ];

  const clearFilters = () => {
    setFilters({
      location: "",
      minPrice: "",
      maxPrice: "",
      minRating: "",
    });
  };

  const toggleFilters = () => {
    if (showFilters) {
      setIsClosing(true);
      setTimeout(() => {
        setShowFilters(false);
        setIsClosing(false);
      }, 300);
    } else {
      setShowFilters(true);
    }
  };

  return (
    <div className="feed-shell">
      <div className="feed-container">
        <div className="feed-page-header">
          <h2 className="feed-page-title" data-tour="browse-services">Browse Service Providers</h2>

          {isClient && (
            <ProfileCompletionChecklist
              title="Getting Started"
              tasks={clientChecklistTasks}
              loading={clientChecklistLoading}
              error={clientChecklistError}
              initiallyCollapsed={false}
            />
          )}

          <div className="search-filter-row" data-tour="feed-search-filters">
            <div className="search-input-large">
              <SearchIcon />
              <input
                placeholder="Search by name or skills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search by service, provider, or location"
              />
            </div>
            <button 
              className={`btn-filter ${showFilters ? "active" : ""}`}
              onClick={toggleFilters}
            >
              <FilterIcon /> Filters
            </button>
          </div>

          {showFilters && (
            <div className={`advanced-filters ${isClosing ? "closing" : ""}`}>
              <div className="filters-header">
                <span className="filters-title">Advanced Filters</span>
                <button className="clear-filters-btn" onClick={clearFilters}>
                  Clear all
                </button>
              </div>
              <div className="filters-grid">
                <div className="feed-filter-group">
                  <label className="feed-filter-label">Location</label>
                  <input
                    type="text"
                    className="feed-filter-input"
                    placeholder="Enter location"
                    value={filters.location}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  />
                </div>
                <div className="feed-filter-group">
                  <label className="feed-filter-label">Min. Price</label>
                  <input
                    type="number"
                    className="feed-filter-input"
                    placeholder="0"
                    value={filters.minPrice}
                    onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                  />
                </div>
                <div className="feed-filter-group">
                  <label className="feed-filter-label">Max. Price</label>
                  <input
                    type="number"
                    className="feed-filter-input"
                    placeholder="1000"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                  />
                </div>
                <div className="feed-filter-group">
                  <label className="feed-filter-label">Minimum Rating</label>
                  <select
                    className="feed-filter-select"
                    value={filters.minRating}
                    onChange={(e) => setFilters({ ...filters, minRating: e.target.value })}
                  >
                    <option value="">Any rating</option>
                    <option value="4.5">4.5+ stars</option>
                    <option value="4">4+ stars</option>
                    <option value="3.5">3.5+ stars</option>
                    <option value="3">3+ stars</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="category-filters">
            {categories.map((c) => (
              <button
                key={c}
                className={`category-btn ${
                  activeCategory === c ? "active" : ""
                }`}
                onClick={() => setActiveCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="providers-grid">
          {isLoading && (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading service providers...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="error-container">
              <p>⚠️ {error}</p>
            </div>
          )}

          {!isLoading && !error && serviceProviders.length === 0 && (
            <div className="no-providers-container">
              <p>No service providers found. Try adjusting your filters.</p>
            </div>
          )}

          {!isLoading && serviceProviders.map((p) => (
            <div key={p.id} className="provider-card">
              <img src={p.image} className="provider-image" />
              <div className="provider-info">
                <div className="provider-header">
                  <span className="provider-name">{p.name}</span>
                  {p.verified && (
                    <span className="verified-badge">
                      <CheckIcon />
                    </span>
                  )}
                  <span className="provider-rating">
                    <StarIcon /> {p.rating} ({p.reviews})
                  </span>
                </div>

                <div className="provider-meta">
                  <span className="meta-item">
                    <LocationIcon />
                    {p.location}
                  </span>
                  <span
                    className={`provider-status-badge ${p.online ? "online" : "offline"}`}
                  >
                    {p.online ? "Online now" : "Offline"}
                  </span>
                </div>

                <p className="provider-description">
                  {p.description}
                </p>

                {p.tags?.length > 0 && (
                  <div className="provider-tags">
                    {p.tags.map((tag) => (
                      <span className="provider-tag" key={`${p.id}-${tag}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="provider-footer">
                  <div className="price-block">
                    <span className="price-label">Starting at</span>
                    <span className="price">₱{p.startingPrice}</span>
                  </div>
                  <button
                    className="btn-view-profile"
                    data-tour="provider-profile-trigger"
                    onClick={() =>
                      navigate(`/provider/${p.id}`)
                    }
                  >
                    View Profile &amp; Request
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
