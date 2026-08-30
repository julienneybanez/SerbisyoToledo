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

  it.each([
    ['asks English users to describe a generic service need', 'Help me choose a service', 'en', /leaking pipe/i],
    ['asks Cebuano users to describe a generic service need', 'Tabangi ko pagpili og serbisyo', 'ceb', /leaking nga tubo/i],
    ['gives concrete booking steps', 'How do I book a service?', 'en', /Request Service/i],
    ['explains provider verification accurately', 'What does Verified mean?', 'en', /reviewed and approved/i],
  ])('%s', async (_name, message, locale, expectedReply) => {
    const result = await generateAssistantReply({ message, locale });
    expect(result.mode).toBe('fallback');
    expect(result.reply).toMatch(expectedReply);
    expect(result.action).toBeNull();
  });

  it('uses a discovery action only after recognizable service evidence is present', async () => {
    const result = await generateAssistantReply({ message: 'I need a plumber', locale: 'en' });
    expect(result).toMatchObject({ intent: 'service_discovery', action: { type: 'recommend_providers' } });
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

  it.each([
    ['infers Plumbing from a Cebuano tubero message', null, 'Unsaon nako pagpangita og tubero duol sa Poblacion?', 'Plumbing'],
    ['replaces an invalid category using a Cebuano tubero message', 'Pipe Wizardry', 'Unsaon nako pagpangita og tubero duol sa Poblacion?', 'Plumbing'],
    ['infers Plumbing from an English plumber message', null, 'I need a plumber near Poblacion', 'Plumbing'],
    ['infers Electrical from Cebuano', null, 'Pangita kog elektrisyan', 'Electrical'],
    ['infers Carpentry from Cebuano', null, 'Kinahanglan kog karpintero', 'Carpentry'],
    ['leaves ambiguous repair requests uncategorized', null, 'I need someone to repair something', null],
    ['rejects malicious categories without service evidence', 'DROP TABLE users', 'I need help with something', null],
  ])('%s', (_name, category, message, expectedCategory) => {
    const result = normalizeAiResult({
      reply: 'I can help find a provider.',
      intent: 'service_discovery',
      action: {
        type: 'recommend_providers',
        query: '',
        filters: { category, location: 'Poblacion', maxPrice: 900, minRating: 4.5, language: 'ceb', availabilityDate: '2026-09-01', duration: 120, search: null },
      },
    }, { message });

    expect(result.action.filters.category).toBe(expectedCategory);
    expect(result.action.filters.location).toBe('Poblacion');
    expect(result.action.filters.maxPrice).toBe(900);
    expect(result.action.filters.language).toBe('ceb');
    expect(result.action.filters.duration).toBe(120);
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