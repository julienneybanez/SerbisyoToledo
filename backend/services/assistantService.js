const SUPPORTED_LOCALES = new Set(['en', 'ceb']);

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
    providerConfigured: Boolean(provider && provider !== 'disabled' && model && apiKey),
    supportedLocales: [...SUPPORTED_LOCALES],
  };
};

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

const generateAssistantReply = async ({ message, locale = 'en', context = {} }) => {
  const normalizedLocale = normalizeLocale(locale);
  const config = getAssistantConfiguration();

  // AI integration seam:
  // When a provider is selected later, implement the provider adapter here.
  // The frontend/backend contract should not need to change.
  if (config.providerConfigured) {
    return {
      mode: 'fallback',
      providerConfigured: true,
      ...getFallbackReply({ message, locale: normalizedLocale }),
      locale: normalizedLocale,
      contextAccepted: {
        route: String(context?.route || '').slice(0, 120),
        role: String(context?.role || 'guest').slice(0, 32),
      },
      notice: 'AI provider is configured but the provider adapter has not been enabled yet.',
    };
  }

  return {
    mode: 'fallback',
    providerConfigured: false,
    ...getFallbackReply({ message, locale: normalizedLocale }),
    locale: normalizedLocale,
    contextAccepted: {
      route: String(context?.route || '').slice(0, 120),
      role: String(context?.role || 'guest').slice(0, 32),
    },
  };
};

module.exports = {
  getAssistantConfiguration,
  generateAssistantReply,
  normalizeLocale,
};
