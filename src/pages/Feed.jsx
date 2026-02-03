import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { serviceProviders, categories } from "../data/data";
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
  const [filters, setFilters] = useState({
    location: "",
    minPrice: "",
    maxPrice: "",
    minRating: "",
  });
  const navigate = useNavigate();

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
        <div className="page-header">
          <h2 className="page-title">Browse Service Providers</h2>

          <div className="search-filter-row">
            <div className="search-input-large">
              <SearchIcon />
              <input placeholder="Search by name or skills..." />
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
                <div className="filter-group">
                  <label className="filter-label">Location</label>
                  <input
                    type="text"
                    className="filter-input"
                    placeholder="Enter location"
                    value={filters.location}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  />
                </div>
                <div className="filter-group">
                  <label className="filter-label">Min. Price</label>
                  <input
                    type="number"
                    className="filter-input"
                    placeholder="0"
                    value={filters.minPrice}
                    onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                  />
                </div>
                <div className="filter-group">
                  <label className="filter-label">Max. Price</label>
                  <input
                    type="number"
                    className="filter-input"
                    placeholder="1000"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                  />
                </div>
                <div className="filter-group">
                  <label className="filter-label">Minimum Rating</label>
                  <select
                    className="filter-select"
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
          {serviceProviders.map((p) => (
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
                    className={`status-badge ${p.online ? "online" : "offline"}`}
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
