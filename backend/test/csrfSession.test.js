const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'serbisyo_session';
process.env.CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'serbisyo_csrf';

const db = require('../config/database');
const app = require('../server');

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

const authUserSql = 'SELECT id, user_type, is_active FROM users WHERE id = ? LIMIT 1';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME;
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME;

describe('Cookie session auth + CSRF', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('issues a readable CSRF cookie alongside the HttpOnly session cookie on login', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('SELECT * FROM users WHERE email = ?')) {
        const bcrypt = require('bcryptjs');
        return [[{
          id: 5,
          full_name: 'Client One',
          email: 'client@example.com',
          password: await bcrypt.hash('pass1234', 10),
          user_type: 'client',
          is_verified: 1,
          email_verified: 1,
          is_active: 1,
        }]];
      }
      if (String(sql).includes('UPDATE users SET is_online = TRUE')) return [{ affectedRows: 1 }];
      return [[]];
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'client@example.com', password: 'pass1234' });

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] || [];
    const authCookie = cookies.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
    const csrfCookie = cookies.find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`));

    expect(authCookie).toBeTruthy();
    expect(authCookie).toMatch(/HttpOnly/i);
    expect(csrfCookie).toBeTruthy();
    expect(csrfCookie).not.toMatch(/HttpOnly/i);
  });

  it('allows a cookie-authenticated mutation with a matching CSRF header', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 5, user_type: 'client', is_active: 1 }]];
      if (String(sql).includes('UPDATE users SET is_online = FALSE')) return [{ affectedRows: 1 }];
      return [[]];
    });

    const token = signToken(5);
    const csrfToken = 'test-csrf-token-value';

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`, `${CSRF_COOKIE_NAME}=${csrfToken}`])
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(200);
  });

  it('rejects a cookie-authenticated mutation with a missing CSRF header', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 5, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const token = signToken(5);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`, `${CSRF_COOKIE_NAME}=some-csrf-token`]);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('rejects a cookie-authenticated mutation when the CSRF header does not match the cookie', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 5, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const token = signToken(5);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`, `${CSRF_COOKIE_NAME}=cookie-value`])
      .set('x-csrf-token', 'mismatched-header-value');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('does not require CSRF for Bearer-token (non-cookie) API clients', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 5, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${signToken(5)}`);

    expect(res.status).toBe(200);
  });

  it('/auth/me works with a valid session cookie', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 5, user_type: 'client', is_active: 1 }]];
      if (String(sql).includes('SELECT id, full_name, email')) {
        return [[{
          id: 5,
          full_name: 'Client One',
          email: 'client@example.com',
          user_type: 'client',
          is_verified: 1,
          email_verified: 1,
          is_active: 1,
        }]];
      }
      return [[{
        id: 5,
        full_name: 'Client One',
        email: 'client@example.com',
        user_type: 'client',
        is_verified: 1,
        email_verified: 1,
        is_active: 1,
      }]];
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${signToken(5)}`]);

    expect(res.status).toBe(200);
  });

  it('rejects an expired/invalid session cookie with 401/403 and does not leak account state', async () => {
    vi.spyOn(db, 'query').mockImplementation(async () => [[]]);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=not-a-real-jwt`]);

    expect([401, 403]).toContain(res.status);
  });

  it('a suspended/deactivated account cannot keep using protected endpoints', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 5, user_type: 'client', is_active: 0 }]];
      return [[]];
    });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${signToken(5)}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
  });

  it('safe GET requests do not require a CSRF header even with a cookie session present', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 5, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const res = await request(app)
      .get('/api/messages/unread-count')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${signToken(5)}`]);

    expect(res.status).toBe(200);
  });
});
