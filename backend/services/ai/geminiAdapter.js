const { GoogleGenAI } = require('@google/genai');
const { GEMINI_SYSTEM_INSTRUCTION } = require('./geminiInstruction');

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'intent', 'action'],
  properties: {
    reply: { type: 'string' },
    intent: {
      type: 'string',
      enum: ['general', 'about_platform', 'help', 'booking_help', 'availability_help', 'provider_onboarding', 'service_discovery'],
    },
    action: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'query', 'filters'],
          properties: {
            type: { type: 'string', enum: ['recommend_providers'] },
            query: { type: 'string' },
            filters: {
              type: 'object',
              additionalProperties: false,
              required: ['category', 'location', 'maxPrice', 'minRating', 'language', 'availabilityDate', 'duration', 'search'],
              properties: {
                category: { type: ['string', 'null'] },
                location: { type: ['string', 'null'] },
                maxPrice: { type: ['number', 'null'] },
                minRating: { type: ['number', 'null'] },
                language: { type: ['string', 'null'], enum: ['en', 'ceb', 'fil', null] },
                availabilityDate: { type: ['string', 'null'] },
                duration: { type: ['integer', 'null'] },
                search: { type: ['string', 'null'] },
              },
            },
          },
        },
      ],
    },
  },
};

const createGeminiAdapter = ({ apiKey, model, timeoutMs = 12000, client } = {}) => {
  const gemini = client || new GoogleGenAI({ apiKey });

  return {
    async generate({ message, locale, context, history }) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), timeoutMs);
      const toledoDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      const safeContext = `Locale: ${locale}. Route: ${context.route || '/'}. Role: ${context.role || 'guest'}. Toledo date: ${toledoDate}.`;
      const contents = [
        ...history.map((item) => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] })),
        { role: 'user', parts: [{ text: `${safeContext}\n\nUser message: ${message}` }] },
      ];

      try {
        const response = await gemini.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseJsonSchema: OUTPUT_SCHEMA,
            temperature: 0.2,
            maxOutputTokens: 500,
            abortSignal: abortController.signal,
          },
        });
        const text = String(response.text || '').trim();
        if (!text) throw new Error('empty_response');
        return JSON.parse(text);
      } catch {
        const safeError = new Error(abortController.signal.aborted ? 'timeout' : 'provider_error');
        safeError.category = safeError.message;
        throw safeError;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
};

module.exports = { createGeminiAdapter, OUTPUT_SCHEMA };