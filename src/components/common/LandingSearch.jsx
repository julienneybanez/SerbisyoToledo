import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { AppButton } from '../ui';
import './LandingSearch.css';

const POPULAR_SEARCHES = ['Plumbing', 'Electrical', 'House Cleaning', 'Appliance Repair'];

export default function LandingSearch() {
  const navigate = useNavigate();
  const { t } = useLanguage();
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
      <form className="search-box-home mt-2" onSubmit={handleSubmit} aria-label={t('findServices')}>
        <label htmlFor="landing-search-input" className="visually-hidden">
          {t('searchServiceProviderLocation')}
        </label>
        <input
          id="landing-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchServiceProviderLocation')}
          aria-label={t('searchServiceProviderLocation')}
        />
        <span className="search-divider" aria-hidden="true"></span>
        <AppButton type="submit" variant="primary" className="home-search-submit" aria-label={t('findServices')}>
          {t('findServices')}
        </AppButton>
      </form>

      <div className="popular-searches" aria-label={t('popularSearches')}>
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
