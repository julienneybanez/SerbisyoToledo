const request = require('supertest');
const bcrypt = require('bcryptjs');

const previousVerificationFlag = process.env.EMAIL_VERIFICATION_ENABLED;
const previousJwtSecret = process.env.JWT_SECRET;
const TEST_PASSWORD = 'pass1234';
const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.EMAIL_VERIFICATION_ENABLED = 'false';

const db = require('../config/database');
const app = require('../server');

const restoreEnvironment = () => {
  if (previousVerificationFlag === undefined) {
    delete process.env.EMAIL_VERIFICATION_ENABLED;
  } else {
    process.env.EMAIL_VERIFICATION_ENABLED = previousVerificationFlag;
  }

  if (previousJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousJwtSecret;
  }
};

const buildUser = (overrides = {}) => ({
  id: overrides.id || 1,
  full_name: overrides.full_name || 'Test User',
  email: overrides.email || 'user@example.com',
  password: overrides.password || TEST_PASSWORD_HASH,
  user_type: overrides.user_type || 'client',
  preferred_services: null,
  profession: null,
  skills: null,
  profile_image: null,
  profile_photo_url: null,
  profile_photo: null,
  phone: null,
  address: null,
  bio: null,
  is_verified: overrides.is_verified ?? 0,
  email_verified: overrides.email_verified ?? 0,
  is_active: overrides.is_active ?? 1,
});

describe('Auth verification policy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(restoreEnvironment);

  it('allows verified admin login', async () => {
    const admin = buildUser({
      id: 2,
      email: 'serbisyotoledo@gmail.com',
      user_type: 'admin',
      is_verified: 1,
      email_verified: 1,
    });

    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql.includes('SELECT * FROM users WHERE email = ?')) return [[admin]];
      if (sql.includes('UPDATE users SET is_online = TRUE')) return [{ affectedRows: 1 }];
      return [[]];
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.userType).toBe('admin');
    expect(res.body.data.user.emailVerified).toBe(true);
  });

  it('blocks verified-state disclosure for wrong password on unverified client', async () => {
    const user = buildUser({
      email: 'client.unverified@example.com',
      user_type: 'client',
      email_verified: 0,
    });

    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql.includes('SELECT * FROM users WHERE email = ?')) return [[user]];
      return [[]];
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
    expect(res.body.code).toBeUndefined();
  });

  it('blocks unverified client after correct password even when the legacy verification flag is false', async () => {
    const user = buildUser({
      email: 'client.pending@example.com',
      user_type: 'client',
      email_verified: 0,
    });

    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql.includes('SELECT * FROM users WHERE email = ?')) return [[user]];
      return [[]];
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('blocks unverified provider after correct password', async () => {
    const user = buildUser({
      email: 'provider.pending@example.com',
      user_type: 'tradesperson',
      profession: 'Plumber',
      email_verified: 0,
    });

    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql.includes('SELECT * FROM users WHERE email = ?')) return [[user]];
      return [[]];
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('allows verified legacy client login', async () => {
    const user = buildUser({
      email: 'client.verified@example.com',
      user_type: 'client',
      email_verified: 1,
    });

    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql.includes('SELECT * FROM users WHERE email = ?')) return [[user]];
      if (sql.includes('UPDATE users SET is_online = TRUE')) return [{ affectedRows: 1 }];
      return [[]];
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.userType).toBe('client');
  });

  it('allows verified legacy provider login', async () => {
    const user = buildUser({
      email: 'provider.verified@example.com',
      user_type: 'tradesperson',
      profession: 'Electrician',
      email_verified: 1,
    });

    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql.includes('SELECT * FROM users WHERE email = ?')) return [[user]];
      if (sql.includes('UPDATE users SET is_online = TRUE')) return [{ affectedRows: 1 }];
      return [[]];
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.userType).toBe('tradesperson');
  });

  it('rejects public admin registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Unauthorized Admin',
        email: 'unauthorized.admin@example.com',
        password: 'pass1234',
        userType: 'admin',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.some((error) => String(error.msg).includes('client or tradesperson'))).toBe(true);
  });
});
