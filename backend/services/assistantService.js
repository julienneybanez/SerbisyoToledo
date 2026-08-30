const { createGeminiAdapter } = require('./ai/geminiAdapter');
const { toCategoryKey, getCategoryByKey } = require('../config/serviceTaxonomy');

const SUPPORTED_LOCALES = new Set(['en', 'ceb']);
const SUPPORTED_FILTER_LANGUAGES = new Set(['en', 'ceb', 'fil']);
const SUPPORTED_INTENTS = new Set(['general', 'about_platform', 'help', 'booking_help', 'availability_help', 'provider_onboarding', 'service_discovery']);
const CATEGORY_INFERENCE_RULES = [
  { key: 'plumbing', pattern: /\b(plumbing|plumber|tubero)\b/i },
  { key: 'electrical', pattern: /\b(electrical|electrician|elektrisyan)\b/i },
  { key: 'carpentry', pattern: /\b(carpentry|carpenter|karpintero)\b/i },
  { key: 'cleaning', pattern: /\b(cleaning|cleaner|limpyo|pagpanglimpyo)\b/i },
  { key: 'gardening_landscaping', pattern: /\b(gardening|gardener|landscaping)\b/i },
  { key: 'aircon_refrigeration', pattern: /\b(aircon|air conditioning|refrigeration)\b/i },
  { key: 'laundry', pattern: /\blaundry\b/i },
  { key: 'locksmith', pattern: /\blocksmith\b/i },
  { key: 'beauty_wellness', pattern: /\b(massage|hilot)\b/i },
  { key: 'tech_repair', pattern: /\b(computer repair|laptop repair|phone repair|tech repair)\b/i },
];
let geminiAdapterFactory = createGeminiAdapter;

const normalizeLocale = (locale) => (
  SUPPORTED_LOCALES.has(String(locale || '').toLowerCase())
    ? String(locale).toLowerCase()
    : 'en'
);

const getAssistantConfiguration = () => {
  const provider = String(process.env.AI_PROVIDER || 'disabled').trim().toLowerCase();
  const model = String(process.env.AI_MODEL || '').trim();
  const apiKey = String(process.env.AI_API_KEY || '').trim();

  return {
    provider,
    model,
    providerConfigured: provider === 'gemini' && Boolean(model && apiKey),
    supportedLocales: [...SUPPORTED_LOCALES],
  };
};

const stringOrNull = (value, maxLength) => {
  const normalized = String(value || '').trim().slice(0, maxLength);
  return normalized || null;
};

const numberOrNull = (value, min, max) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= min && normalized <= max ? normalized : null;
};

const dateOrNull = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null);

const inferCategoryFromText = (...values) => {
  const text = values.map((value) => String(value || '')).join(' ');
  const match = CATEGORY_INFERENCE_RULES.find((rule) => rule.pattern.test(text));
  return match ? getCategoryByKey(match.key)?.label || null : null;
};

const normalizeAiResult = (value, { message = '' } = {}) => {
  if (!value || typeof value !== 'object') throw new Error('malformed_output');
  const reply = stringOrNull(value.reply, 1200);
  const intent = SUPPORTED_INTENTS.has(value.intent) ? value.intent : 'general';
  if (!reply) throw new Error('malformed_output');
  if (!value.action) return { reply, intent, action: null };
  if (value.action.type !== 'recommend_providers' || typeof value.action !== 'object') {
    return { reply, intent, action: null };
  }
  const filters = value.action.filters && typeof value.action.filters === 'object' ? value.action.filters : {};
  const categoryKey = toCategoryKey(filters.category);
  const category = categoryKey
    ? getCategoryByKey(categoryKey)?.label || null
    : inferCategoryFromText(filters.search, value.action.query, message);
  const language = SUPPORTED_FILTER_LANGUAGES.has(filters.language) ? filters.language : null;
  const action = {
    type: 'recommend_providers',
    query: stringOrNull(value.action.query, 300) || stringOrNull(filters.search, 120) || '',
    filters: {
      category,
      location: stringOrNull(filters.location, 120),
      maxPrice: numberOrNull(filters.maxPrice, 0, 1000000),
      minRating: numberOrNull(filters.minRating, 0, 5),
      language,
      availabilityDate: dateOrNull(filters.availabilityDate),
      duration: numberOrNull(filters.duration, 30, 1440),
      search: stringOrNull(filters.search, 120),
    },
  };
  return { reply, intent: intent === 'service_discovery' ? intent : 'service_discovery', action };
};

const getContextAccepted = (context, history) => ({
  route: String(context?.route || '').slice(0, 120),
  role: String(context?.role || 'guest').slice(0, 32),
  historyCount: Array.isArray(history) ? history.length : 0,
});

const getFallbackReply = ({ message, locale }) => {
  const input = String(message || '').trim().toLowerCase();
  const isCebuano = locale === 'ceb';

  if (/what is serbisyotoledo|what are you|unsa ang serbisyotoledo|kinsa ka/.test(input)) {
    return {
      reply: isCebuano
        ? 'Ako ang SerbisyoToledo assistant. Makatabang ko sa pagpangita og local services, pagsabot sa booking flow, ug basic questions bahin sa platform.'
        : 'I am the SerbisyoToledo assistant. I can help with finding local services, understanding the booking flow, and basic questions about the platform.',
      action: null,
      intent: 'about_platform',
    };
  }

  if (/register|sign up|provider account|become.*provider|service provider.*account|rehistro|mag-provider/.test(input)) {
    return {
      reply: isCebuano
        ? 'Sa Sign Up, pilia ang Service Provider. Kinahanglan ma-verify ang imong email ug provider verification una ka maka-post sa imong unang Service Listing.'
        : 'During Sign Up, choose Service Provider. Your email must be verified, and provider verification is required before posting your first Service Listing.',
      action: null,
      intent: 'provider_onboarding',
    };
  }

  if (/availability|schedule|available dates|time slots|eskedyul|available nga petsa|kanus-a/.test(input)) {
    return {
      reply: isCebuano
        ? 'Ang provider mopili sa iyang available dates ug oras sa Availability page. Ang kliyente makakita ra sa dates ug time slots nga gi-set sa provider.'
        : 'Providers choose their available dates and hours on the Availability page. Clients only see dates and time slots the provider has made available.',
      action: null,
      intent: 'availability_help',
    };
  }

  if (/how.*book|booking.*work|booking flow|send.*request|unsaon.*booking|unsaon.*pag-book|booking.*unsaon/.test(input)) {
    return {
      reply: isCebuano
        ? 'Para mag-book, ablihi ang provider profile, pilia ang Request Service, dayon pagpili og available date ug oras ug isumite ang detalye sa serbisyo. Kinahanglan dawaton sa provider ang request una kini ma-confirm.'
        : 'To book, open a provider profile, choose Request Service, select an available date and time, then submit the service details. The provider must accept the request before it is confirmed.',
      action: null,
      intent: 'booking_help',
    };
  }

  if (/faq|help|tabang/.test(input)) {
    return {
      reply: isCebuano
        ? 'Makatabang ko sa pagpangita og serbisyo, booking, provider verification, availability, ug basic paggamit sa SerbisyoToledo. Unsay gusto nimong mahibal-an?'
        : 'I can help with finding services, booking, provider verification, availability, and basic SerbisyoToledo usage. What would you like to know?',
      action: null,
      intent: 'help',
    };
  }

  const recommendationIntent = /find|looking for|recommend|need|provider near|service near|plumb|tubero|electric|elektrisyan|carpent|karpintero|clean|limpyo|massage|aircon|garden|laundry|repair|mechanic|locksmith|pangita|kinahanglan.*serbisyo/.test(input);

  if (recommendationIntent) {
    return {
      reply: isCebuano
        ? 'Makatabang ko pagpangita og service provider. Isulti ang serbisyo, lugar, o budget aron mas tukma ang recommendations.'
        : 'I can help you find a service provider. Tell me the service, location, or budget so I can narrow the recommendations.',
      action: {
        type: 'recommend_providers',
        query: String(message || '').trim(),
      },
      intent: 'service_discovery',
    };
  }

  return {
    reply: isCebuano
      ? 'Salamat sa imong mensahe. Isulti pa gamay ang imong kinahanglan aron matabangan tika.'
      : 'Thanks for your message. Tell me a little more about what you need so I can help.',
    action: null,
    intent: 'general',
  };
};

const generateAssistantReply = async ({ message, locale = 'en', context = {}, history = [] }) => {
  const normalizedLocale = normalizeLocale(locale);
  const config = getAssistantConfiguration();

  if (config.providerConfigured) {
    try {
      const adapter = geminiAdapterFactory({ apiKey: process.env.AI_API_KEY, model: config.model });
      const result = normalizeAiResult(
        await adapter.generate({ message, locale: normalizedLocale, context: getContextAccepted(context, history), history }),
        { message }
      );
      return { mode: 'ai', providerConfigured: true, ...result, locale: normalizedLocale, contextAccepted: getContextAccepted(context, history) };
    } catch (error) {
      console.warn('Assistant provider fallback:', { provider: config.provider, category: error.category || 'invalid_response', timeout: error.category === 'timeout' });
    }
  }

  return {
    mode: 'fallback',
    providerConfigured: config.providerConfigured,
    ...getFallbackReply({ message, locale: normalizedLocale }),
    locale: normalizedLocale,
    contextAccepted: getContextAccepted(context, history),
  };
};

module.exports = {
  getAssistantConfiguration,
  generateAssistantReply,
  normalizeLocale,
  normalizeAiResult,
  inferCategoryFromText,
  setGeminiAdapterFactoryForTests: (factory) => {
    geminiAdapterFactory = factory || createGeminiAdapter;
  },
};
