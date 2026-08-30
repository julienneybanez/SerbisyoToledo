const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const db = require('../config/database');
const app = require('../server');

const PROVIDER_ID = 21;
const authUserSql = 'SELECT id, user_type, is_active FROM users WHERE id = ? LIMIT 1';
const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

const createConnection = (queries) => ({
  beginTransaction: vi.fn(async () => {}),
  commit: vi.fn(async () => {}),
  rollback: vi.fn(async () => {}),
  release: vi.fn(() => {}),
  query: vi.fn(async (sql) => {
    queries.push(String(sql));
    if (String(sql).includes('INSERT INTO service_profiles')) return [{ insertId: 77 }];
    return [{ affectedRows: 1 }];
  }),
});

const validListingRequest = (agent) => agent
  .field('barangayAddress', 'Poblacion')
  .field('startingPrice', '500')
  .field('description', 'Reliable plumbing services')
  .field('serviceCategories', JSON.stringify(['Plumbing']))
  .field('serviceTypes', JSON.stringify(['leak_repair']));

describe('Service Listing publication and provider languages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts a new verified provider listing as published without overwriting signup languages', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) {
        return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      }
      if (String(sql).includes('SELECT user_type, is_verified, is_active FROM users')) {
        return [[{ user_type: 'tradesperson', is_verified: 1, is_active: 1 }]];
      }
      if (String(sql).includes('SELECT id, banner_image_public_id FROM service_profiles')) {
        return [[]];
      }
      return [[]];
    });

    const queries = [];
    vi.spyOn(db, 'getConnection').mockResolvedValue(createConnection(queries));

    const res = await validListingRequest(
      request(app)
        .post('/api/service-profiles/create')
        .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
    );

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.isPublished).toBe(true);

    const insertSql = queries.find((sql) => sql.includes('INSERT INTO service_profiles'));
    expect(insertSql).toMatch(/VALUES \(\?, \?, \?, \?, \?, \?, TRUE, FALSE\)/i);
    expect(queries.some((sql) => /person_languages/i.test(sql))).toBe(false);
  });

  it('repairs an older unpublished listing by publishing it when the verified provider saves it again', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) {
        return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      }
      if (String(sql).includes('SELECT user_type, is_verified, is_active FROM users')) {
        return [[{ user_type: 'tradesperson', is_verified: 1, is_active: 1 }]];
      }
      if (String(sql).includes('SELECT id, banner_image_public_id FROM service_profiles')) {
        return [[{ id: 77, banner_image_public_id: null }]];
      }
      return [[]];
    });

    const queries = [];
    vi.spyOn(db, 'getConnection').mockResolvedValue(createConnection(queries));

    const res = await validListingRequest(
      request(app)
        .post('/api/service-profiles/create')
        .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isPublished).toBe(true);

    const updateSql = queries.find((sql) => sql.includes('UPDATE service_profiles SET'));
    expect(updateSql).toMatch(/is_published = TRUE/i);
    expect(queries.some((sql) => /person_languages/i.test(sql))).toBe(false);
  });
});
