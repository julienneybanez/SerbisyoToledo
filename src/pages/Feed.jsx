import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getUser, isAuthenticated, serviceProfileAPI, serviceRequestAPI } from "../services/api";
import useServiceTaxonomy from '../hooks/useServiceTaxonomy';
import ProfileCompletionChecklist from "../components/common/ProfileCompletionChecklist";
import { useLanguage } from "../context/LanguageContext";
import {
  SearchIcon,
  FilterIcon,
  StarIcon,
  CheckIcon,
  LocationIcon,
} from "../components/common/Icons";

export default function Feed() {
  const { t } = useLanguage();
  const {
    prominentCategories,
    moreCategories,
    getCategory,
    getServiceTypesForCategory,
  } = useServiceTaxonomy();
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeServiceType, setActiveServiceType] = useState('');
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [serviceProviders, setServiceProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [clientChecklistLoading, setClientChecklistLoading] = useState(false);
  const [clientChecklistError, setClientChecklistError] = useState('');
  const [hasClientRequest, setHasClientRequest] = useState(false);
  const [brokenImageIds, setBrokenImageIds] = useState(() => new Set());
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

    const categoryValue = (searchParams.get('category') || '').trim();
    setActiveCategory(categoryValue || 'All');

    const serviceTypeValue = (searchParams.get('serviceType') || '').trim();
    setActiveServiceType(serviceTypeValue);
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
          serviceType: activeServiceType,
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
          setError(result.message || t('feedFetchFailed'));
        }
      } catch (err) {
        if (!isCurrentRequest) return;
        console.error('Error fetching profiles:', err);
        setError(t('feedLoadError'));
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
  }, [activeCategory, activeServiceType, filters, searchTerm, t]);

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
      } catch {
        setClientChecklistError(t('feedChecklistLoadError'));
      } finally {
        setClientChecklistLoading(false);
      }
    };

    fetchClientChecklistData();
  }, [isClient, t]);

  const clientChecklistTasks = [
    {
      key: 'basic-profile',
      label: t('feedChecklistBasicProfileLabel'),
      description: t('feedChecklistBasicProfileDescription'),
      completed: Boolean(user?.fullName && user?.email),
      actionType: 'link',
      to: '/client-settings',
      actionLabel: t('feedChecklistOpenSettings'),
    },
    {
      key: 'contact-info',
      label: t('feedChecklistContactLabel'),
      description: t('feedChecklistContactDescription'),
      completed: Boolean(user?.phone),
      actionType: 'link',
      to: '/client-settings',
      actionLabel: t('feedChecklistAddContact'),
    },
    {
      key: 'location',
      label: t('feedChecklistLocationLabel'),
      description: t('feedChecklistLocationDescription'),
      completed: Boolean(user?.address),
      actionType: 'link',
      to: '/client-settings?section=address',
      actionLabel: t('feedChecklistUpdateLocation'),
    },
    {
      key: 'browse-services',
      label: t('feedChecklistBrowseLabel'),
      description: t('feedChecklistBrowseDescription'),
      completed: true,
      actionType: 'link',
      to: '/feed',
      actionLabel: t('browseShort'),
    },
    {
      key: 'first-booking',
      label: t('feedChecklistFirstBookingLabel'),
      description: t('feedChecklistFirstBookingDescription'),
      completed: hasClientRequest,
      actionType: 'button',
      onAction: () => {
        const providerList = document.getElementById('providers-list');
        providerList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      actionLabel: t('feedChecklistFindProviders'),
    },
  ];

  const updateQueryParam = (key, value) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setActiveCategory('All');
    setActiveServiceType('');
    setFilters({
      location: "",
      minPrice: "",
      maxPrice: "",
      minRating: "",
    });
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const formatReviewsLabel = (reviews) => {
    const reviewCount = Number(reviews || 0);
    if (!reviewCount) return 'No reviews yet';
    return `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}`;
  };

  const formatPriceLabel = (provider) => {
    const amount = Number(provider.startingPrice ?? provider.dailyRate ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return 'Price on request';
    }

    const unitRaw = provider.pricingUnit || provider.rateUnit || '';
    const unit = String(unitRaw).trim();
    const unitSuffix = unit ? `/${unit.replace(/^per\s+/i, '')}` : '';

    return `${t('startingAt')} ₱${amount.toLocaleString()}${unitSuffix}`;
  };

  const getPrimaryService = (provider) => {
    if (provider.profession) return provider.profession;
    if (provider.categories?.length) return provider.categories[0];
    return t('generalServices');
  };

  const getVisibleServiceTypes = (provider) => {
    const serviceTypeLabels = Array.isArray(provider.serviceTypes)
      ? provider.serviceTypes.map((item) => item.label).filter(Boolean)
      : [];
    const visible = serviceTypeLabels.slice(0, 3);
    const remaining = Math.max(0, serviceTypeLabels.length - visible.length);
    return { visible, remaining };
  };

  const getVisibleSkills = (provider) => {
    const skills = Array.isArray(provider.skills) ? provider.skills.filter(Boolean) : [];
    return skills.slice(0, 2);
  };

  const activeCategoryServiceTypes = activeCategory && activeCategory !== 'All'
    ? getServiceTypesForCategory(activeCategory)
    : [];

  const prominentLabels = prominentCategories.map((category) => category.label);
  const moreLabels = moreCategories.map((category) => category.label);

  const visiblePrimaryCategories = (() => {
    const ordered = ['All', ...prominentLabels];

    if (showMoreCategories) {
      ordered.push(...moreLabels);
    }

    if (activeCategory && !ordered.includes(activeCategory)) {
      ordered.push(activeCategory);
    }

    return ordered.filter((label, index, self) => self.indexOf(label) === index);
  })();

  const getProviderInitials = (name) => {
    return String(name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'ST';
  };

  const handleImageError = (providerId) => {
    setBrokenImageIds((prev) => {
      const next = new Set(prev);
      next.add(providerId);
      return next;
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
          <h2 className="feed-page-title" data-tour="browse-services">{t('feedTitle')}</h2>
          <p className="feed-page-subtitle">{t('feedSubtitle')}</p>

          {isClient && (
            <ProfileCompletionChecklist
              title={t('feedGettingStarted')}
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
                placeholder={t('feedSearchPlaceholder')}
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);
                  updateQueryParam('q', value.trim());
                }}
                aria-label={t('feedSearchAria')}
              />
            </div>
            <button 
              className={`btn-filter ${showFilters ? "active" : ""}`}
              onClick={toggleFilters}
            >
              <FilterIcon /> {t('filters')}
            </button>
          </div>

          {showFilters && (
            <div className={`advanced-filters ${isClosing ? "closing" : ""}`}>
              <div className="filters-header">
                <span className="filters-title">{t('advancedFilters')}</span>
                <button className="clear-filters-btn" onClick={clearFilters}>
                  {t('clearFilters')}
                </button>
              </div>
              <div className="filters-grid">
                <div className="feed-filter-group">
                  <label className="feed-filter-label">{t('location')}</label>
                  <input
                    type="text"
                    className="feed-filter-input"
                    placeholder={t('feedEnterLocation')}
                    value={filters.location}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  />
                </div>
                <div className="feed-filter-group">
                  <label className="feed-filter-label">{t('minPrice')}</label>
                  <input
                    type="number"
                    className="feed-filter-input"
                    placeholder="0"
                    value={filters.minPrice}
                    onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                  />
                </div>
                <div className="feed-filter-group">
                  <label className="feed-filter-label">{t('maxPrice')}</label>
                  <input
                    type="number"
                    className="feed-filter-input"
                    placeholder="1000"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                  />
                </div>
                <div className="feed-filter-group">
                  <label className="feed-filter-label">{t('minimumRating')}</label>
                  <select
                    className="feed-filter-select"
                    value={filters.minRating}
                    onChange={(e) => setFilters({ ...filters, minRating: e.target.value })}
                  >
                    <option value="">{t('anyRating')}</option>
                    <option value="4.5">{t('rating45')}</option>
                    <option value="4">{t('rating4')}</option>
                    <option value="3.5">{t('rating35')}</option>
                    <option value="3">{t('rating3')}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="category-filters">
            {visiblePrimaryCategories.map((c) => (
              <button
                key={c}
                className={`category-btn ${
                  activeCategory === c ? "active" : ""
                }`}
                onClick={() => {
                  setActiveCategory(c);
                  setActiveServiceType('');
                  updateQueryParam('category', c === 'All' ? '' : c);
                  updateQueryParam('serviceType', '');
                }}
              >
                {c}
              </button>
            ))}
            {moreLabels.length > 0 && (
              <button
                type="button"
                className={`category-btn ${showMoreCategories ? 'active' : ''}`}
                onClick={() => setShowMoreCategories((prev) => !prev)}
                aria-expanded={showMoreCategories}
                aria-label="Toggle more service categories"
              >
                {showMoreCategories ? 'Less' : 'More'}
              </button>
            )}
          </div>

          {activeCategoryServiceTypes.length > 0 && (
            <div className="category-filters" aria-label="Service type filters">
              <button
                className={`category-btn ${activeServiceType === '' ? 'active' : ''}`}
                onClick={() => {
                  setActiveServiceType('');
                  updateQueryParam('serviceType', '');
                }}
              >
                All {getCategory(activeCategory)?.label || activeCategory}
              </button>
              {activeCategoryServiceTypes.map((serviceType) => (
                <button
                  key={serviceType.key}
                  className={`category-btn ${activeServiceType === serviceType.key ? 'active' : ''}`}
                  onClick={() => {
                    setActiveServiceType(serviceType.key);
                    updateQueryParam('serviceType', serviceType.key);
                  }}
                >
                  {serviceType.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="providers-grid" id="providers-list">
          {isLoading && (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>{t('feedLoadingProviders')}</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="error-container">
              <p>⚠️ {error}</p>
            </div>
          )}

          {!isLoading && !error && serviceProviders.length === 0 && (
            <div className="no-providers-container">
              <h3>{t('feedNoProvidersTitle')}</h3>
              <p>{t('feedNoProvidersSubtitle')}</p>
              <button type="button" className="btn-view-profile" onClick={clearFilters}>{t('clearFilters')}</button>
            </div>
          )}

          {!isLoading && serviceProviders.map((p) => (
            <div key={p.id} className="provider-card">
              {!brokenImageIds.has(p.id) && p.image ? (
                <img
                  src={p.image}
                  className="provider-image non-draggable-image"
                  alt={`${p.name} service banner`}
                  draggable="false"
                  onError={() => handleImageError(p.id)}
                />
              ) : (
                <div className="provider-image provider-image-fallback" aria-hidden="true">
                  <span className="provider-fallback-initials">{getProviderInitials(p.name)}</span>
                  <span className="provider-fallback-service">{getPrimaryService(p)}</span>
                </div>
              )}
              <div className="provider-info">
                <div className="provider-header">
                  <div className="provider-name-wrap">
                    <span className="provider-name">{p.name}</span>
                    {p.verified && (
                      <span className="verified-badge" aria-label={t('verification')}>
                        <CheckIcon />
                      </span>
                    )}
                  </div>
                  <span className="provider-rating">
                    <StarIcon /> {Number(p.reviews || 0) > 0 ? Number(p.rating || 0).toFixed(1) : '—'}
                  </span>
                </div>

                <p className="provider-service-line">{getPrimaryService(p)}</p>

                <div className="provider-meta">
                  <span className="meta-item provider-reviews-meta">{formatReviewsLabel(p.reviews)}</span>
                  <span className="meta-item">
                    <LocationIcon />
                    {p.location || t('location')}
                  </span>
                </div>

                {String(p.availabilitySummary || p.nextAvailableLabel || '').trim() && (
                  <p className="provider-availability">{String(p.availabilitySummary || p.nextAvailableLabel).trim()}</p>
                )}

                <p className="provider-description">
                  {p.description}
                </p>

                {(() => {
                  const { visible, remaining } = getVisibleServiceTypes(p);
                  const skills = getVisibleSkills(p);
                  if (!visible.length && !remaining && !skills.length) return null;
                  return (
                  <div className="provider-tags">
                    {visible.map((tag) => (
                      <span className="provider-tag" key={`${p.id}-${tag}`}>
                        {tag}
                      </span>
                    ))}
                    {remaining > 0 && (
                      <span className="provider-tag provider-tag-more">+{remaining} more</span>
                    )}
                    {skills.map((skill) => (
                      <span className="provider-tag" key={`${p.id}-skill-${skill}`}>
                        {skill}
                      </span>
                    ))}
                  </div>
                  );
                })()}

                <div className="provider-footer">
                  <div className="price-block">
                    <span className="price-label">{formatPriceLabel(p)}</span>
                  </div>
                  <button
                    className="btn-view-profile tour-provider-request-step"
                    data-tour="provider-profile-trigger"
                    onClick={() =>
                      navigate(`/provider/${p.id}`)
                    }
                  >
                    {t('viewProfile')}
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
