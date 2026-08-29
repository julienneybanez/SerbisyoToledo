const request = require('supertest');
const app = require('../server');

describe('Assistant preparation API', () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = 'disabled';
    process.env.AI_MODEL = '';
    process.env.AI_API_KEY = '';
  });

  it('reports fallback capabilities without requiring an AI provider', async () => {
    const res = await request(app).get('/api/assistant/capabilities');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      available: true,
      providerConfigured: false,
      supportsProviderRecommendations: true,
      persistence: 'none',
    });
    expect(res.body.data.supportedLocales).toEqual(expect.arrayContaining(['en', 'ceb']));
  });

  it('returns a structured Cebuano provider-recommendation action', async () => {
    const res = await request(app)
      .post('/api/assistant/message')
      .send({
        message: 'Pangita kog tubero duol sa Toledo',
        locale: 'ceb',
        context: { route: '/feed', role: 'client' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.locale).toBe('ceb');
    expect(res.body.data.mode).toBe('fallback');
    expect(res.body.data.intent).toBe('service_discovery');
    expect(res.body.data.action).toMatchObject({
      type: 'recommend_providers',
    });
    expect(res.body.data.contextAccepted).toEqual({
      route: '/feed',
      role: 'client',
    });
  });

  it('rejects empty assistant messages', async () => {
    const res = await request(app)
      .post('/api/assistant/message')
      .send({ message: '', locale: 'en' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ASSISTANT_MESSAGE_REQUIRED');
  });
});
