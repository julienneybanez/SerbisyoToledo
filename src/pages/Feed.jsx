import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getUser, serviceProfileAPI } from "../services/api";
import useServiceTaxonomy from '../hooks/useServiceTaxonomy';
import NextStepHelp from "../components/common/NextStepHelp";
import { useLanguage } from "../context/LanguageContext";
import { AppButton, AppInput, AppSelect, Chip } from "../components/ui";
import {
  SearchIcon,
  FilterIcon,
  StarIcon,
  CheckIcon,
  LocationIcon,
} from "../components/common/Icons";

const BROWSE_REQUEST_DEBOUNCE_MS = 300;

const formatProviderAvailability = (provider, t) => {
  if (!provider?.showAvailabilityStatus) return '';

  switch (provider.availabilityStatus) {
    case 'busy':
      return t('availabilityBusyNow');
    case 'unavailable':
      return t('availabilityNotAccepting');
    case 'no_slots':
      return t('availabilityNoBookableDates');
    case 'available':
    case 'accepting_requests':
      return t('availabilityAcceptingRequests');
    default:
      return provider.acceptingRequests ? t('availabilityAcceptingRequests') : '';
  }
};

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
  const [brokenImageIds, setBrokenImageIds] = useState(() => new Set());
  const [filters, setFilters] = useState({
    location: "",
    minPrice: "",
    maxPrice: "",
    minRating: "",
  });
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setDebouncedFilters(filters);
    }, BROWSE_REQUEST_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [filters, searchTerm]);

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
          location: debouncedFilters.location,
          minPrice: debouncedFilters.minPrice,
          maxPrice: debouncedFilters.maxPrice,
          minRating: debouncedFilters.minRating,
          search: debouncedSearchTerm,
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
        if (isCurrentRequest) setIsLoading(false);
      }
    };

    fetchProfiles();
    window.addEventListener('profileCreated', fetchProfiles);

    return () => {
      isCurrentRequest = false;
      window.removeEventListener('profileCreated', fetchProfiles);
    };
  }, [activeCategory, activeServiceType, debouncedFilters, debouncedSearchTerm, t]);

  const clientBrowseGuidance = {
    title: t('feedGuideTitle'),
    description: t('feedGuideDescription'),
    steps: [
      t('feedGuideStepSearch'),
      t('feedGuideStepCompare'),
      t('feedGuideStepRequest'),
    ],
    actionLabel: t('feedGuideAction'),
    onAction: () => {
      document.getElementById('providers-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    targetSelector: '[data-tour="feed-search-filters"]',
  };

  const updateQueryParam = (key, value) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set(key, value);
    else nextParams.delete(key);
    setSearchParams(nextParams, { replace: true });
  };

  const selectCategory = (category) => {
    setActiveCategory(category);
    setActiveServiceType('');

    const nextParams = new URLSearchParams(searchParams);
    if (category === 'All') nextParams.delete('category');
    else nextParams.set('category', category);
    nextParams.delete('serviceType');
    setSearchParams(nextParams, { replace: true });
  };

  const selectServiceType = (serviceType) => {
    setActiveServiceType(serviceType);
    updateQueryParam('serviceType', serviceType);
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
    if (!reviewCount) return t('noReviewsYet');
    return `${reviewCount} ${t(reviewCount === 1 ? 'reviewSingular' : 'reviewPlural')}`;
  };

  const formatPriceLabel = (provider) => {
    const amount = Number(provider.startingPrice ?? provider.dailyRate ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return t('priceOnRequest');

    const normalizedUnit = String(provider.pricingUnit || provider.rateUnit || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    const unitKey = {
      per_day: 'pricingPerDay',
      day: 'pricingPerDay',
      '/day': 'pricingPerDay',
      per_hour: 'pricingPerHour',
      hour: 'pricingPerHour',
      '/hour': 'pricingPerHour',
      per_job: 'pricingPerJob',
      job: 'pricingPerJob',
      '/job': 'pricingPerJob',
    }[normalizedUnit];
    const unitSuffix = unitKey ? `/${t(unitKey)}` : '';

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
    if (showMoreCategories) ordered.push(...moreLabels);
    if (activeCategory && !ordered.includes(activeCategory)) ordered.push(activeCategory);
    return ordered.filter((label, index, self) => self.indexOf(label) === index);
  })();

  const selectedServiceTypeLabel = activeCategoryServiceTypes.find(
    (serviceType) => serviceType.key === activeServiceType,
  )?.label || activeServiceType;

  const activeFilterItems = [
    searchTerm ? { key: 'search', label: `“${searchTerm}”` } : null,
    activeCategory !== 'All' ? { key: 'category', label: activeCategory } : null,
    activeServiceType ? { key: 'serviceType', label: selectedServiceTypeLabel } : null,
    filters.location ? { key: 'location', label: filters.location } : null,
    filters.minPrice ? { key: 'minPrice', label: `₱${Number(filters.minPrice).toLocaleString()}+` } : null,
    filters.maxPrice ? { key: 'maxPrice', label: `≤ ₱${Number(filters.maxPrice).toLocaleString()}` } : null,
    filters.minRating ? { key: 'minRating', label: `${filters.minRating}+ ★` } : null,
  ].filter(Boolean);

  const removeActiveFilter = (key) => {
    if (key === 'search') {
      setSearchTerm('');
      updateQueryParam('q', '');
      return;
    }

    if (key === 'category') {
      selectCategory('All');
      return;
    }

    if (key === 'serviceType') {
      selectServiceType('');
      return;
    }

    setFilters((previous) => ({ ...previous, [key]: '' }));
  };

  const getProviderInitials = (name) => String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'ST';

  const handleImageError = (providerId) => {
    setBrokenImageIds((previous) => {
      const next = new Set(previous);
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
      }, 180);
    } else {
      setShowFilters(true);
    }
  };

  return (
    <div className="feed-shell">
      <div className="feed-container">
        <header className="feed-page-header">
          <div className="feed-heading-block">
            <div className="feed-heading-row">
              <h1 className="feed-page-title" data-tour="browse-services">{t('feedTitle')}</h1>
              {isClient && <NextStepHelp guidance={clientBrowseGuidance} />}
            </div>
            <p className="feed-page-subtitle">{t('feedSubtitle')}</p>
          </div>

          <section className="feed-discovery-panel" aria-label={t('browseServices')}>
            <div className="search-filter-row" data-tour="feed-search-filters">
              <div className="search-input-large">
                <SearchIcon />
                <AppInput
                  className="feed-search-control"
                  placeholder={t('feedSearchPlaceholder')}
                  value={searchTerm}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSearchTerm(value);
                    updateQueryParam('q', value.trim());
                  }}
                  aria-label={t('feedSearchAria')}
                />
              </div>
              <AppButton
                variant="secondary"
                className={`btn-filter ${showFilters ? 'active' : ''}`}
                onClick={toggleFilters}
                aria-expanded={showFilters}
              >
                <FilterIcon />
                <span>{t('filters')}</span>
                {activeFilterItems.length > 0 && (
                  <span className="filter-count" aria-label={t('feedActiveFiltersCount', { count: activeFilterItems.length })}>
                    {activeFilterItems.length}
                  </span>
                )}
              </AppButton>
            </div>

            {showFilters && (
              <div className={`advanced-filters ${isClosing ? 'closing' : ''}`}>
                <div className="filters-header">
                  <span className="filters-title">{t('advancedFilters')}</span>
                  <AppButton variant="ghost" size="sm" className="clear-filters-btn" onClick={clearFilters}>
                    {t('clearFilters')}
                  </AppButton>
                </div>
                <div className="filters-grid">
                  <div className="feed-filter-group">
                    <label htmlFor="feed-filter-location" className="feed-filter-label">{t('location')}</label>
                    <AppInput
                      id="feed-filter-location"
                      type="text"
                      className="feed-filter-input"
                      placeholder={t('feedEnterLocation')}
                      value={filters.location}
                      onChange={(event) => setFilters({ ...filters, location: event.target.value })}
                    />
                  </div>
                  <div className="feed-filter-group">
                    <label htmlFor="feed-filter-min-price" className="feed-filter-label">{t('minPrice')}</label>
                    <AppInput
                      id="feed-filter-min-price"
                      type="number"
                      className="feed-filter-input"
                      placeholder="0"
                      value={filters.minPrice}
                      onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })}
                    />
                  </div>
                  <div className="feed-filter-group">
                    <label htmlFor="feed-filter-max-price" className="feed-filter-label">{t('maxPrice')}</label>
                    <AppInput
                      id="feed-filter-max-price"
                      type="number"
                      className="feed-filter-input"
                      placeholder="1000"
                      value={filters.maxPrice}
                      onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })}
                    />
                  </div>
                  <div className="feed-filter-group">
                    <label htmlFor="feed-filter-rating" className="feed-filter-label">{t('minimumRating')}</label>
                    <AppSelect
                      id="feed-filter-rating"
                      className="feed-filter-select"
                      value={filters.minRating}
                      onChange={(event) => setFilters({ ...filters, minRating: event.target.value })}
                    >
                      <option value="">{t('anyRating')}</option>
                      <option value="4.5">{t('rating45')}</option>
                      <option value="4">{t('rating4')}</option>
                      <option value="3.5">{t('rating35')}</option>
                      <option value="3">{t('rating3')}</option>
                    </AppSelect>
                  </div>
                </div>
              </div>
            )}

            <div className="feed-category-section">
              <div className="feed-filter-section-heading">
                <span>{t('popularServices')}</span>
              </div>
              <div className="category-filters">
                {visiblePrimaryCategories.map((category) => (
                  <Chip
                    key={category}
                    className="category-btn"
                    active={activeCategory === category}
                    onClick={() => selectCategory(category)}
                  >
                    {category}
                  </Chip>
                ))}
                {moreLabels.length > 0 && (
                  <Chip
                    className="category-btn category-more-btn"
                    active={showMoreCategories}
                    onClick={() => setShowMoreCategories((previous) => !previous)}
                    aria-expanded={showMoreCategories}
                    aria-label={t('feedToggleMoreCategories')}
                  >
                    {showMoreCategories ? t('feedLess') : t('feedMore')}
                    <i className={`bi ${showMoreCategories ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true"></i>
                  </Chip>
                )}
              </div>
            </div>

            {activeCategoryServiceTypes.length > 0 && (
              <div className="feed-service-type-section">
                <div className="feed-filter-section-heading">
                  <span>{getCategory(activeCategory)?.label || activeCategory}</span>
                </div>
                <div className="category-filters" aria-label={t('feedServiceTypeFilters')}>
                  <Chip
                    className="category-btn"
                    active={activeServiceType === ''}
                    onClick={() => selectServiceType('')}
                  >
                    {t('all')}
                  </Chip>
                  {activeCategoryServiceTypes.map((serviceType) => (
                    <Chip
                      key={serviceType.key}
                      className="category-btn"
                      active={activeServiceType === serviceType.key}
                      onClick={() => selectServiceType(serviceType.key)}
                    >
                      {serviceType.label}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </section>
        </header>

        <section className="feed-results-section" aria-live="polite">
          <div className="feed-results-toolbar">
            <div className="feed-results-summary">
              <span className="feed-results-number">{isLoading ? '—' : serviceProviders.length}</span>
              <span className="feed-results-label">
                {t(serviceProviders.length === 1 ? 'serviceProvider' : 'serviceProviders')}
              </span>
            </div>
            {activeFilterItems.length > 0 && (
              <button type="button" className="feed-clear-all" onClick={clearFilters}>
                {t('clearFilters')}
              </button>
            )}
          </div>

          {activeFilterItems.length > 0 && (
            <div className="feed-active-filters" aria-label={t('feedActiveFilters')}>
              {activeFilterItems.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className="feed-active-filter-chip"
                  onClick={() => removeActiveFilter(filter.key)}
                  aria-label={t('feedRemoveFilter', { filter: filter.label })}
                >
                  <span>{filter.label}</span>
                  <i className="bi bi-x" aria-hidden="true"></i>
                </button>
              ))}
            </div>
          )}

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
                <div className="feed-empty-icon" aria-hidden="true"><i className="bi bi-search"></i></div>
                <h3>{t('feedNoProvidersTitle')}</h3>
                <p>{t('feedNoProvidersSubtitle')}</p>
                <button type="button" className="btn-view-profile" onClick={clearFilters}>{t('clearFilters')}</button>
              </div>
            )}

            {!isLoading && serviceProviders.map((provider) => {
              const { visible, remaining } = getVisibleServiceTypes(provider);
              const skills = getVisibleSkills(provider);
              const description = String(provider.description || '').trim();
              const availability = formatProviderAvailability(provider, t);

              return (
                <article key={provider.id} className="provider-card">
                  <div className="provider-media">
                    {!brokenImageIds.has(provider.id) && provider.image ? (
                      <img
                        src={provider.image}
                        className="provider-image non-draggable-image"
                        alt={t('feedProviderBannerAlt', { name: provider.name })}
                        draggable="false"
                        loading="lazy"
                        onError={() => handleImageError(provider.id)}
                      />
                    ) : (
                      <div className="provider-image provider-image-fallback" aria-hidden="true">
                        <span className="provider-fallback-initials">{getProviderInitials(provider.name)}</span>
                        <span className="provider-fallback-service">{getPrimaryService(provider)}</span>
                      </div>
                    )}
                    {provider.verified && (
                      <span className="provider-verified-pill">
                        <CheckIcon />
                        <span>{t('verification')}</span>
                      </span>
                    )}
                  </div>

                  <div className="provider-info">
                    <div className="provider-header">
                      <div className="provider-name-wrap">
                        <span className="provider-name">{provider.name}</span>
                      </div>
                      <span className="provider-rating">
                        <StarIcon />
                        {Number(provider.reviews || 0) > 0 ? Number(provider.rating || 0).toFixed(1) : '—'}
                      </span>
                    </div>

                    <p className="provider-service-line">{getPrimaryService(provider)}</p>

                    <div className="provider-meta">
                      <span className="meta-item">
                        <LocationIcon />
                        {provider.location || t('location')}
                      </span>
                      <span className="meta-item provider-reviews-meta">{formatReviewsLabel(provider.reviews)}</span>
                    </div>

                    {availability && (
                      <p className="provider-availability">
                        <i className="bi bi-calendar-check" aria-hidden="true"></i>
                        <span>{availability}</span>
                      </p>
                    )}

                    {description && <p className="provider-description">{description}</p>}

                    {(visible.length > 0 || remaining > 0 || skills.length > 0) && (
                      <div className="provider-tags">
                        {visible.map((tag) => (
                          <span className="provider-tag" key={`${provider.id}-${tag}`}>{tag}</span>
                        ))}
                        {remaining > 0 && (
                          <span className="provider-tag provider-tag-more">{t('feedMoreCount', { count: remaining })}</span>
                        )}
                        {skills.map((skill) => (
                          <span className="provider-tag" key={`${provider.id}-skill-${skill}`}>{skill}</span>
                        ))}
                      </div>
                    )}

                    <div className="provider-footer">
                      <div className="price-block">
                        <span className="price-label">{formatPriceLabel(provider)}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-view-profile tour-provider-request-step"
                        data-tour="provider-profile-trigger"
                        onClick={() => navigate(`/provider/${provider.id}`)}
                      >
                        {t('viewProfile')}
                        <i className="bi bi-arrow-right" aria-hidden="true"></i>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
