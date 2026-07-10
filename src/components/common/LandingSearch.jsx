import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingSearch.css';

const POPULAR_SEARCHES = ['Plumbing', 'Electrical', 'House Cleaning', 'Appliance Repair'];

export default function LandingSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const goToFeed = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const params = new URLSearchParams();
    params.set('q', trimmed);
    navigate(`/feed?${params.toString()}`);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    goToFeed(query);
  };

  return (
    <div className="landing-search-wrap">
      <form className="search-box-home mt-2" onSubmit={handleSubmit} aria-label="Find services">
        <label htmlFor="landing-search-input" className="visually-hidden">
          Search for a service, provider, or location
        </label>
        <input
          id="landing-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a service, provider, or location"
          aria-label="Search for a service, provider, or location"
        />
        <span className="search-divider" aria-hidden="true"></span>
        <button type="submit" className="btn-search-home" aria-label="Find Services">
          Find Services
        </button>
      </form>

      <div className="popular-searches" aria-label="Popular searches">
        {POPULAR_SEARCHES.map((item) => (
          <button
            key={item}
            type="button"
            className="popular-search-chip"
            onClick={() => goToFeed(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
