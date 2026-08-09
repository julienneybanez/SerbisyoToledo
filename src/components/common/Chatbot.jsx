import { useState } from 'react';
import { serviceProfileAPI } from '../../services/api';
import './Chatbot.css';

const RobotIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2M7.5 13A2.5 2.5 0 005 15.5 2.5 2.5 0 007.5 18a2.5 2.5 0 002.5-2.5A2.5 2.5 0 007.5 13m9 0a2.5 2.5 0 00-2.5 2.5 2.5 2.5 0 002.5 2.5 2.5 2.5 0 002.5-2.5 2.5 2.5 0 00-2.5-2.5z"/>
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
);

const ThumbUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
  </svg>
);

const ThumbDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
  </svg>
);

const formatMoney = (amount) => `P${Number(amount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

const SERVICE_KEYWORDS = [
  { keyword: 'plumb', category: 'Plumbing' },
  { keyword: 'electric', category: 'Electrical' },
  { keyword: 'carpent', category: 'Carpentry' },
  { keyword: 'clean', category: 'Cleaning' },
  { keyword: 'garden', category: 'Gardening & Landscaping' },
  { keyword: 'aircon', category: 'Aircon & Refrigeration' },
  { keyword: 'ac ', category: 'Aircon & Refrigeration' },
  { keyword: 'massage', category: 'Beauty & Wellness' },
  { keyword: 'laundry', category: 'Laundry' },
  { keyword: 'mechanic', category: 'Tech Repair' },
  { keyword: 'locksmith', category: 'Locksmith' },
];

const buildRecommendationFilters = (rawInput) => {
  const input = String(rawInput || '').toLowerCase();

  const serviceMatch = SERVICE_KEYWORDS.find((item) => input.includes(item.keyword));
  const category = serviceMatch ? serviceMatch.category : undefined;

  const locationMatch = input.match(/(?:in|near|around)\s+([a-z\s.-]{3,40})/i);
  const location = locationMatch ? locationMatch[1].trim() : undefined;

  const budgetMatch = input.match(/(?:under|below|max|budget)\s*(?:p|php|₱)?\s*(\d{3,6})/i);
  const maxPrice = budgetMatch ? Number(budgetMatch[1]) : undefined;

  const ratingMatch = input.match(/(\d(?:\.\d)?)\s*(?:\+)?\s*(?:stars?|rating)/i);
  const minRating = ratingMatch ? Number(ratingMatch[1]) : undefined;

  const language = input.includes('cebuano')
    ? 'ceb'
    : input.includes('filipino') || input.includes('tagalog')
      ? 'fil'
      : input.includes('english')
        ? 'en'
        : undefined;

  let availabilityDate;
  const now = new Date();
  if (input.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    availabilityDate = tomorrow.toISOString().slice(0, 10);
  } else if (input.includes('today')) {
    availabilityDate = now.toISOString().slice(0, 10);
  }

  return {
    category,
    location,
    maxPrice,
    minRating,
    language,
    availabilityDate,
    search: rawInput,
    limit: 3,
  };
};

const shouldFetchRecommendations = (rawInput) => {
  const input = String(rawInput || '').toLowerCase();
  return /find|looking for|recommend|need|book|provider|service|plumber|electrician|carpenter|cleaner|massage|aircon|gardener|laundry/.test(input);
};

const Chatbot = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! What can I help you with today?",
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  const suggestions = [
    { emoji: '👋', text: 'What is SerbisyoToledo?' },
    { emoji: '', text: 'Get Started' },
    { emoji: '📚', text: 'FAQs' },
  ];

  const handleSendMessage = async (text) => {
    const messageText = text || inputValue;
    if (messageText.trim() === '') return;

    const userMessage = {
      id: Date.now(),
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsResponding(true);

    try {
      const botPayload = await getBotResponsePayload(messageText);
      const botResponse = {
        id: Date.now() + 1,
        text: botPayload.text,
        recommendations: botPayload.recommendations || [],
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
    } finally {
      setIsResponding(false);
    }
  };

  const getBotResponsePayload = async (userInput) => {
    const input = userInput.toLowerCase();

    if (input.includes('what is serbisyotoledo') || input.includes('what are you')) {
      return {
        text: "I'm SerbisyoToledo's virtual assistant! I'm here to help you find services, book appointments, and answer your questions.",
      };
    }
    if (input.includes('hello') || input.includes('hi') || input.includes('get started')) {
      return {
        text: "Welcome! I can help you find local service providers, book appointments, or answer questions about our platform. What would you like to do?",
      };
    }
    if (input.includes('register') || input.includes('provider')) {
      return {
        text: "To register as a service provider, click the 'Sign Up' button and select 'Service Provider' option. You'll need to provide your skills, experience, and contact information.",
      };
    }
    if (input.includes('faq') || input.includes('help')) {
      return {
        text: 'Here are common topics: 1) How to book a service, 2) Payment methods, 3) Cancellation policy, 4) Provider verification. Which would you like to know more about?',
      };
    }

    if (shouldFetchRecommendations(userInput)) {
      try {
        const filters = buildRecommendationFilters(userInput);
        const response = await serviceProfileAPI.getRecommendations(filters);
        const providers = response?.data?.providers || [];

        if (providers.length === 0) {
          return {
            text: 'I could not find an exact match right now. Try adding the service type, location, or budget so I can refine recommendations.',
            recommendations: [],
          };
        }

        return {
          text: `I found ${providers.length} provider${providers.length > 1 ? 's' : ''} from the live database that match your request.`,
          recommendations: providers,
        };
      } catch {
        return {
          text: 'I could not fetch provider recommendations right now. Please try again in a moment.',
          recommendations: [],
        };
      }
    }

    if (input.includes('price') || input.includes('cost')) {
      return {
        text: 'Pricing varies by service and provider. You can see rates on each provider profile. If you share your budget, I can recommend options.',
      };
    }
    if (input.includes('thank')) {
      return {
        text: "You're welcome! Is there anything else I can help you with?",
      };
    }
    return {
      text: "Thanks for your message! I'd be happy to help. Could you tell me more about what you're looking for?",
    };
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="chatbot-overlay">
      <div className="chatbot-modal">
        <div className="chatbot-header">
          <div className="chatbot-header-left">
            <div className="chatbot-robot-icon">
              <RobotIcon />
            </div>
            <div className="chatbot-header-info">
              <h3 className="chatbot-title">Serbisyo<span>Toledo</span> Chat</h3>
              <div className="chatbot-status">
                <span className="status-dot"></span>
                Online
              </div>
            </div>
          </div>
          <button className="chatbot-close" onClick={onClose} aria-label="Close chatbot">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="chatbot-messages">
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
                            <a
                              key={provider.id}
                              className="chatbot-provider-card"
                              href={`/provider/${provider.id}`}
                            >
                              <div className="chatbot-provider-title-row">
                                <strong>{provider.name}</strong>
                                <span>{Number(provider.rating || 0).toFixed(1)}★</span>
                              </div>
                              <p>{provider.profession || 'Service Provider'} • {provider.location}</p>
                              <p>{formatMoney(provider.dailyRate)} / day</p>
                              <small>
                                {Array.isArray(provider.languages) && provider.languages.length > 0
                                  ? `Languages: ${provider.languages.join(', ')}`
                                  : 'Languages not specified'}
                              </small>
                            </a>
                          ))}
                        </div>
                      )}
                  </div>
                  <div className="message-meta">
                    {message.sender === 'user' && (
                      <span className="message-time">
                        {formatTime(message.timestamp)}
                        <CheckIcon />
                      </span>
                    )}
                    {message.sender === 'bot' && (
                      <div className="message-actions">
                        <button className="message-action-btn" title="Copy">
                          <CopyIcon />
                        </button>
                        <button className="message-action-btn" title="Helpful">
                          <ThumbUpIcon />
                        </button>
                        <button className="message-action-btn" title="Not helpful">
                          <ThumbDownIcon />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="chatbot-suggestions">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              className="suggestion-chip"
              onClick={() => handleSendMessage(suggestion.text)}
            >
              {suggestion.emoji && <span>{suggestion.emoji}</span>}
              {suggestion.text}
            </button>
          ))}
        </div>

        <div className="chatbot-input-area">
          <input
            type="text"
            className="chatbot-input"
            placeholder="Type your message here..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isResponding}
          />
          <button className="chatbot-send-btn" onClick={() => handleSendMessage()} disabled={isResponding}>
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
