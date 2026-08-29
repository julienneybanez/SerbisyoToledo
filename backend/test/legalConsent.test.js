const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const db = require('../config/database');
const app = require('../server');

const createConnectionMock = (queryImpl) => ({
  beginTransaction: vi.fn(async () => {}),
  commit: vi.fn(async () => {}),
  rollback: vi.fn(async () => {}),
  release: vi.fn(() => {}),
  query: vi.fn(queryImpl),
});

describe('Legal consent — registration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects registration when acceptedTerms is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Client One',
        email: 'client.noterms@example.com',
        password: 'pass123456',
        userType: 'client',
        acknowledgedPrivacy: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TERMS_ACCEPTANCE_REQUIRED');
  });

  it('rejects registration when acceptedTerms is false', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Client One',
        email: 'client.falseterms@example.com',
        password: 'pass123456',
        userType: 'client',
        acceptedTerms: false,
        acknowledgedPrivacy: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TERMS_ACCEPTANCE_REQUIRED');
  });

  it('rejects registration when acknowledgedPrivacy is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Client One',
        email: 'client.noprivacy@example.com',
        password: 'pass123456',
        userType: 'client',
        acceptedTerms: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PRIVACY_ACKNOWLEDGEMENT_REQUIRED');
  });

  it('creates terms and privacy_notice legal_acceptances rows on successful registration', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql.includes('SELECT id FROM users WHERE email = ?')) return [[]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('INSERT INTO users')) return [{ insertId: 55 }];
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Client One',
        email: 'client.consent@example.com',
        password: 'pass123456',
        userType: 'client',
        acceptedTerms: true,
        acknowledgedPrivacy: true,
      });

    expect(res.status).toBe(201);

    const legalInserts = conn.query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO legal_acceptances'))
      .map(([, params]) => params);

    expect(legalInserts).toHaveLength(2);
    expect(legalInserts).toEqual(
      expect.arrayContaining([
        [55, 'terms', '1.0', 'registration'],
        [55, 'privacy_notice', '1.0', 'registration'],
      ])
    );
  });

  it('rolls back the entire registration if the legal_acceptances insert fails', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql.includes('SELECT id FROM users WHERE email = ?')) return [[]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('INSERT INTO users')) return [{ insertId: 56 }];
      if (sql.includes('INSERT INTO legal_acceptances')) throw new Error('db failure');
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Client Two',
        email: 'client.rollback@example.com',
        password: 'pass123456',
        userType: 'client',
        acceptedTerms: true,
        acknowledgedPrivacy: true,
      });

    expect(res.status).toBe(500);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });
});

describe('Legal consent — provider verification', () => {
  const authUserSql = 'SELECT id, user_type, is_active FROM users WHERE id = ? LIMIT 1';
  const jwt = require('jsonwebtoken');
  const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
  const PROVIDER_ID = 21;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects verification submission when verificationConsent is missing', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      if (sql === 'SELECT id, user_type FROM users WHERE id = ?') return [[{ id: PROVIDER_ID, user_type: 'tradesperson' }]];
      return [[]];
    });

    const res = await request(app)
      .post('/api/user/verification-request')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .field('fullName', 'Provider One')
      .field('phoneNumber', '09171234567')
      .field('address', 'Poblacion, Toledo City')
      .field('serviceDescription', 'Plumbing services')
      .attach('governmentId', PNG_BUFFER, { filename: 'id.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VERIFICATION_CONSENT_REQUIRED');
  });

  it('rejects verification submission when verificationConsent is false', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      if (sql === 'SELECT id, user_type FROM users WHERE id = ?') return [[{ id: PROVIDER_ID, user_type: 'tradesperson' }]];
      return [[]];
    });

    const res = await request(app)
      .post('/api/user/verification-request')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .field('fullName', 'Provider One')
      .field('phoneNumber', '09171234567')
      .field('address', 'Poblacion, Toledo City')
      .field('serviceDescription', 'Plumbing services')
      .field('verificationConsent', 'false')
      .attach('governmentId', PNG_BUFFER, { filename: 'id.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VERIFICATION_CONSENT_REQUIRED');
  });

  it('creates the verification request and a linked verification_data_consent record atomically', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      if (sql === 'SELECT id, user_type FROM users WHERE id = ?') return [[{ id: PROVIDER_ID, user_type: 'tradesperson' }]];
      if (String(sql).includes('FROM verification_requests WHERE user_id')) return [[]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (String(sql).includes('INSERT INTO verification_requests')) return [{ insertId: 777 }];
      if (String(sql).includes('INSERT INTO legal_acceptances')) return [{ insertId: 1 }];
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/user/verification-request')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .field('fullName', 'Provider One')
      .field('phoneNumber', '09171234567')
      .field('address', 'Poblacion, Toledo City')
      .field('serviceDescription', 'Plumbing services')
      .field('verificationConsent', 'true')
      .attach('governmentId', PNG_BUFFER, { filename: 'id.png', contentType: 'image/png' });

    expect(res.status).toBe(201);

    const legalInsert = conn.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO legal_acceptances'));
    expect(legalInsert).toBeTruthy();
    expect(legalInsert[1]).toEqual([PROVIDER_ID, 'verification_data_consent', '1.0', 'provider_verification', 777]);
  });

  it('rolls back the verification request if the legal_acceptances insert fails (no orphaned government ID)', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      if (sql === 'SELECT id, user_type FROM users WHERE id = ?') return [[{ id: PROVIDER_ID, user_type: 'tradesperson' }]];
      if (String(sql).includes('FROM verification_requests WHERE user_id')) return [[]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (String(sql).includes('INSERT INTO verification_requests')) return [{ insertId: 778 }];
      if (String(sql).includes('INSERT INTO legal_acceptances')) throw new Error('db failure');
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/user/verification-request')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .field('fullName', 'Provider One')
      .field('phoneNumber', '09171234567')
      .field('address', 'Poblacion, Toledo City')
      .field('serviceDescription', 'Plumbing services')
      .field('verificationConsent', 'true')
      .attach('governmentId', PNG_BUFFER, { filename: 'id.png', contentType: 'image/png' });

    expect(res.status).toBe(500);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });
});
