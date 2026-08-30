import { useEffect, useMemo, useRef, useState } from 'react';
import { assistantAPI, serviceProfileAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import './Chatbot.css';

const RobotIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2m-4.5 11A2.5 2.5 0 005 15.5 2.5 2.5 0 007.5 18a2.5 2.5 0 002.5-2.5A2.5 2.5 0 007.5 13m9 0a2.5 2.5 0 00-2.5 2.5 2.5 2.5 0 002.5 2.5 2.5 2.5 0 002.5-2.5 2.5 2.5 0 00-2.5-2.5z"/>
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
  </svg>
);

const formatMoney = (amount) => `P${Number(amount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

const getPricingUnitLabel = (unit, t) => {
  const normalized = String(unit || 'per_day').toLowerCase();
  if (normalized === 'per_hour') return t('pricingPerHour');
  if (normalized === 'per_job') return t('pricingPerJob');
  return t('pricingPerDay');
};

const SERVICE_KEYWORDS = [
  { keyword: 'plumb', category: 'Plumbing' },
  { keyword: 'tubero', category: 'Plumbing' },
  { keyword: 'electric', category: 'Electrical' },
  { keyword: 'elektrisyan', category: 'Electrical' },
  { keyword: 'carpent', category: 'Carpentry' },
  { keyword: 'karpintero', category: 'Carpentry' },
  { keyword: 'clean', category: 'Cleaning' },
  { keyword: 'limpyo', category: 'Cleaning' },
  { keyword: 'garden', category: 'Gardening & Landscaping' },
  { keyword: 'aircon', category: 'Aircon & Refrigeration' },
  { keyword: 'massage', category: 'Beauty & Wellness' },
  { keyword: 'laundry', category: 'Laundry' },
  { keyword: 'mechanic', category: 'Tech Repair' },
  { keyword: 'repair', category: 'Tech Repair' },
  { keyword: 'locksmith', category: 'Locksmith' },
];

const ALLOWED_RECOMMENDATION_CATEGORIES = new Set([
  'Carpentry',
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Gardening & Landscaping',
  'Appliance Repair',
  'Aircon & Refrigeration',
  'Beauty & Wellness',
  'Locksmith',
  'Laundry',
  'Painting',
  'Masonry & Minor Construction',
  'Welding & Metalwork',
  'Tech Repair',
  'Other Services',
]);

const buildRecommendationFilters = (rawInput, locale) => {
  const input = String(rawInput || '').toLowerCase();
  const serviceMatch = SERVICE_KEYWORDS.find((item) => input.includes(item.keyword));
  const category = serviceMatch?.category;

  const locationMatch = input.match(/(?:in|near|around|sa|duol sa)\s+([a-z\s.-]{3,40})/i);
  const location = locationMatch ? locationMatch[1].trim() : undefined;

  const budgetMatch = input.match(/(?:under|below|max|budget|hangtod)\s*(?:p|php|₱)?\s*(\d{3,6})/i);
  const maxPrice = budgetMatch ? Number(budgetMatch[1]) : undefined;

  const ratingMatch = input.match(/(\d(?:\.\d)?)\s*(?:\+)?\s*(?:stars?|rating)/i);
  const minRating = ratingMatch ? Number(ratingMatch[1]) : undefined;

  const requestedLanguage = input.includes('cebuano') || input.includes('bisaya')
    ? 'ceb'
    : input.includes('filipino') || input.includes('tagalog')
      ? 'fil'
      : input.includes('english')
        ? 'en'
        : undefined;

  let availabilityDate;
  const now = new Date();
  if (input.includes('tomorrow') || input.includes('ugma')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    availabilityDate = tomorrow.toISOString().slice(0, 10);
  } else if (input.includes('today') || input.includes('karon')) {
    availabilityDate = now.toISOString().slice(0, 10);
  }

  return {
    category,
    location,
    maxPrice,
    minRating,
    language: requestedLanguage || (locale === 'ceb' ? undefined : requestedLanguage),
    availabilityDate,
    search: rawInput,
    limit: 3,
  };
};

const buildStructuredRecommendationFilters = (filters, rawInput, locale) => {
  const fallback = buildRecommendationFilters(rawInput, locale);
  const safe = filters && typeof filters === 'object' ? filters : {};
  const allowedLanguages = new Set(['en', 'ceb', 'fil']);
  const safeNumber = (value, min, max) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
  };
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(String(safe.availabilityDate || ''))
    ? safe.availabilityDate
    : undefined;

  return {
    category: ALLOWED_RECOMMENDATION_CATEGORIES.has(safe.category) ? safe.category : fallback.category,
    location: typeof safe.location === 'string' && safe.location.length <= 120 ? safe.location : fallback.location,
    maxPrice: safeNumber(safe.maxPrice, 0, 1000000) ?? fallback.maxPrice,
    minRating: safeNumber(safe.minRating, 0, 5) ?? fallback.minRating,
    language: allowedLanguages.has(safe.language) ? safe.language : fallback.language,
    availabilityDate: safeDate || fallback.availabilityDate,
    duration: safeNumber(safe.duration, 30, 1440) ?? fallback.duration,
    search: typeof safe.search === 'string' && safe.search.length <= 120 ? safe.search : undefined,
    limit: 3,
  };
};

const Chatbot = ({ isOpen, onClose, context = {} }) => {
  const { language, t } = useLanguage();
  const endRef = useRef(null);
  const messagesRef = useRef(null);

  const initialMessage = useMemo(() => ({
    id: 'welcome',
    text: t('chatbotWelcome'),
    sender: 'bot',
    timestamp: new Date(),
  }), [t]);

  const [messages, setMessages] = useState([initialMessage]);
  const [inputValue, setInputValue] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);

  const suggestions = useMemo(() => ([
    { emoji: '🔎', text: t('chatbotSuggestionFindService') },
    { emoji: '📅', text: t('chatbotSuggestionBooking') },
    { emoji: '❓', text: t('chatbotSuggestionHelp') },
  ]), [t]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0]?.id !== 'welcome') return current;
      return [{ ...initialMessage, timestamp: current[0].timestamp }];
    });
  }, [initialMessage]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
      if (messagesRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, messages, isResponding]);

  const addBotMessage = ({ text, recommendations = [] }) => {
    setMessages((prev) => [...prev, {
      id: `bot-${Date.now()}-${prev.length}`,
      text,
      recommendations,
      sender: 'bot',
      timestamp: new Date(),
    }]);
  };

  const loadRecommendations = async (query, aiFilters) => {
    try {
      const response = await serviceProfileAPI.getRecommendations(
        aiFilters ? buildStructuredRecommendationFilters(aiFilters, query, language) : buildRecommendationFilters(query, language)
      );
      const providers = response?.data?.providers || [];

      return {
        providers,
        text: providers.length > 0
          ? t('chatbotRecommendationsFound', { count: providers.length })
          : t('chatbotRecommendationsEmpty'),
      };
    } catch {
      return {
        providers: [],
        text: t('chatbotRecommendationsFailed'),
      };
    }
  };

  const handleSendMessage = async (text) => {
    const messageText = String(text || inputValue || '').trim();
    if (!messageText || isResponding) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsResponding(true);

    try {
      const history = messages
        .filter((item) => item.id !== 'welcome')
        .slice(-8)
        .map((item) => ({
          role: item.sender === 'bot' ? 'assistant' : 'user',
          content: item.text,
        }));

      const response = await assistantAPI.sendMessage({
        message: messageText,
        locale: language,
        context,
        history,
      });
      const payload = response?.data || {};

      if (payload.action?.type === 'recommend_providers') {
        const recommendationResult = await loadRecommendations(
          payload.action.query || messageText,
          payload.action.filters
        );
        addBotMessage({
          text: recommendationResult.text,
          recommendations: recommendationResult.providers,
        });
      } else {
        addBotMessage({
          text: payload.reply || t('chatbotFallbackReply'),
        });
      }
    } catch {
      addBotMessage({ text: t('chatbotUnavailable') });
    } finally {
      setIsResponding(false);
    }
  };

  const handleCopy = async (message) => {
    try {
      await navigator.clipboard?.writeText(message.text);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(null), 1200);
    } catch {
      setCopiedMessageId(null);
    }
  };

  const formatTime = (date) => date.toLocaleTimeString(
    language === 'ceb' ? 'ceb-PH' : 'en-PH',
    { hour: 'numeric', minute: '2-digit' }
  );

  if (!isOpen) return null;

  return (
    <div className="chatbot-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="chatbot-modal" role="dialog" aria-modal="true" aria-labelledby="chatbot-title">
        <div className="chatbot-header">
          <div className="chatbot-header-left">
            <div className="chatbot-robot-icon"><RobotIcon /></div>
            <div className="chatbot-header-info">
              <h3 id="chatbot-title" className="chatbot-title">Serbisyo<span>Toledo</span> {t('chatbotChatLabel')}</h3>
              <div className="chatbot-status">
                <span className="status-dot"></span>
                {t('chatbotStatusReady')}
              </div>
            </div>
          </div>
          <button className="chatbot-close" onClick={onClose} aria-label={t('chatbotCloseAria')}>
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div ref={messagesRef} className="chatbot-messages" aria-live="polite">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chatbot-message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
            >
              {message.sender === 'bot' && (
                <span className="message-time">{formatTime(message.timestamp)}</span>
              )}
              <div className="message-row">
                <div className={`message-avatar ${message.sender === 'user' ? 'user-avatar' : 'bot-avatar'}`}>
                  {message.sender === 'user' ? <UserIcon /> : <RobotIcon />}
                </div>
                <div className="message-content">
                  <div className="message-bubble">
                    <p>{message.text}</p>
                    {Array.isArray(message.recommendations) && message.recommendations.length > 0 && (
                      <div className="chatbot-recommendations">
                        {message.recommendations.map((provider) => (
                          <a key={provider.id} className="chatbot-provider-card" href={`/provider/${provider.id}`}>
                            <div className="chatbot-provider-title-row">
                              <strong>{provider.name}</strong>
                              <span>{Number(provider.rating || 0).toFixed(1)}★</span>
                            </div>
                            <p>{provider.profession || t('serviceProvider')} • {provider.location || t('notSpecified')}</p>
                            {provider.startingPrice != null && (
                              <p>{formatMoney(provider.startingPrice)} / {getPricingUnitLabel(provider.pricingUnit, t)}</p>
                            )}
                            <small>
                              {Array.isArray(provider.languages) && provider.languages.length > 0
                                ? t('chatbotLanguagesList', { languages: provider.languages.join(', ') })
                                : t('chatbotLanguagesNotSpecified')}
                            </small>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="message-meta">
                    {message.sender === 'user' ? (
                      <span className="message-time">
                        {formatTime(message.timestamp)}
                        <CheckIcon />
                      </span>
                    ) : (
                      <div className="message-actions">
                        <button
                          type="button"
                          className="message-action-btn"
                          title={copiedMessageId === message.id ? t('chatbotCopied') : t('chatbotCopy')}
                          aria-label={copiedMessageId === message.id ? t('chatbotCopied') : t('chatbotCopy')}
                          onClick={() => handleCopy(message)}
                        >
                          <CopyIcon />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isResponding && (
            <div className="chatbot-message bot-message chatbot-typing" aria-label={t('chatbotResponding')}>
              <div className="message-row">
                <div className="message-avatar bot-avatar"><RobotIcon /></div>
                <div className="message-bubble chatbot-typing-bubble">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} className="chatbot-scroll-anchor" aria-hidden="true"></div>
        </div>

        <div className="chatbot-suggestions" aria-label={t('chatbotSuggestionsAria')}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.text}
              type="button"
              className="suggestion-chip"
              onClick={() => handleSendMessage(suggestion.text)}
              disabled={isResponding}
            >
              <span aria-hidden="true">{suggestion.emoji}</span>
              {suggestion.text}
            </button>
          ))}
        </div>

        <div className="chatbot-input-area">
          <input
            type="text"
            className="chatbot-input"
            placeholder={t('chatbotInputPlaceholder')}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isResponding}
            maxLength={1200}
            aria-label={t('chatbotInputAria')}
          />
          <button
            type="button"
            className="chatbot-send-btn"
            onClick={() => handleSendMessage()}
            disabled={isResponding || !inputValue.trim()}
            aria-label={t('chatbotSendAria')}
          >
            <SendIcon />
          </button>
        </div>
      </section>
    </div>
  );
};

export default Chatbot;
