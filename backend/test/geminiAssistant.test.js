const generate = vi.fn();

const {
  getAssistantConfiguration,
  generateAssistantReply,
  normalizeAiResult,
  setGeminiAdapterFactoryForTests,
} = require('../services/assistantService');

describe('Gemini assistant provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGeminiAdapterFactoryForTests(() => ({ generate }));
    process.env.AI_PROVIDER = 'disabled';
    process.env.AI_MODEL = '';
    process.env.AI_API_KEY = '';
  });

  it('keeps deterministic fallback when provider is disabled', async () => {
    const result = await generateAssistantReply({ message: 'How do I book?', locale: 'en' });
    expect(result.mode).toBe('fallback');
    expect(result.providerConfigured).toBe(false);
    expect(generate).not.toHaveBeenCalled();
  });

  it('reports configured Gemini capabilities without exposing its key', () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.AI_MODEL = 'gemini-test';
    process.env.AI_API_KEY = 'secret-not-returned';
    expect(getAssistantConfiguration()).toMatchObject({ provider: 'gemini', model: 'gemini-test', providerConfigured: true });
  });

  it('returns normalized successful Gemini general output', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.AI_MODEL = 'gemini-test';
    process.env.AI_API_KEY = 'secret';
    generate.mockResolvedValue({ reply: 'Use Browse Services to start.', intent: 'help', action: null });
    const result = await generateAssistantReply({ message: 'Help', locale: 'en', history: [] });
    expect(result).toMatchObject({ mode: 'ai', providerConfigured: true, intent: 'help', reply: 'Use Browse Services to start.', locale: 'en' });
  });

  it('normalizes a service-discovery action against the actual taxonomy', () => {
    const result = normalizeAiResult({ reply: 'I can narrow the search.', intent: 'service_discovery', action: { type: 'recommend_providers', query: 'tubero', filters: { category: 'plumbing', location: 'Poblacion', maxPrice: 900, minRating: 4.5, language: 'ceb', availabilityDate: '2026-09-01', duration: 120, search: null } } });
    expect(result.action.filters).toMatchObject({ category: 'Plumbing', location: 'Poblacion', language: 'ceb', duration: 120 });
  });

  it('keeps Cebuano locale and falls back after provider failure', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.AI_MODEL = 'gemini-test';
    process.env.AI_API_KEY = 'secret';
    generate.mockRejectedValue(Object.assign(new Error('timeout'), { category: 'timeout' }));
    const result = await generateAssistantReply({ message: 'Unsaon nako pag-book?', locale: 'ceb' });
    expect(result).toMatchObject({ mode: 'fallback', providerConfigured: true, locale: 'ceb', intent: 'booking_help' });
  });

  it('rejects malicious action types and invalid categories', () => {
    const result = normalizeAiResult({ reply: 'Safe response', intent: 'general', action: { type: 'drop_database', query: 'x', filters: { category: 'invented' } } });
    expect(result.action).toBeNull();
  });
});