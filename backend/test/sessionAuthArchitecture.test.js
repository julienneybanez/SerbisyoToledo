const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'serbisyo_session';
process.env.CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'serbisyo_csrf';

const db = require('../config/database');
const app = require('../server');

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME;

describe('Session Authentication Architecture & Zero-State APIs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/auth/me succeeds with HttpOnly session cookie', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      const queryStr = String(sql);
      if (queryStr.includes('SELECT id, user_type, is_active FROM users')) {
        return [[{ id: 10, user_type: 'client', is_active: 1 }]];
      }
      if (queryStr.includes('SELECT * FROM users WHERE id = ?')) {
        return [[{
          id: 10,
          full_name: 'Cookie Client',
          email: 'cookieclient@example.com',
          user_type: 'client',
          email_verified: 1,
          is_active: 1,
        }]];
      }
      return [[]];
    });

    const token = signToken(10);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.fullName).toBe('Cookie Client');
  });

  it('ignores Authorization: Bearer cookie-session header and uses session cookie', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      const queryStr = String(sql);
      if (queryStr.includes('SELECT id, user_type, is_active FROM users')) {
        return [[{ id: 10, user_type: 'client', is_active: 1 }]];
      }
      if (queryStr.includes('SELECT * FROM users WHERE id = ?')) {
        return [[{
          id: 10,
          full_name: 'Cookie Client',
          email: 'cookieclient@example.com',
          user_type: 'client',
          email_verified: 1,
          is_active: 1,
        }]];
      }
      return [[]];
    });

    const token = signToken(10);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`])
      .set('Authorization', 'Bearer cookie-session');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/auth/socket-ticket issues short-lived socket ticket for authenticated user', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('SELECT id, user_type, is_active FROM users')) {
        return [[{ id: 10, user_type: 'client', is_active: 1 }]];
      }
      return [[]];
    });

    const token = signToken(10);
    const res = await request(app)
      .get('/api/auth/socket-ticket')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticket).toBeDefined();

    const decoded = jwt.verify(res.body.data.ticket, process.env.JWT_SECRET);
    expect(decoded.userId).toBe(10);
    expect(decoded.scope).toBe('socket');
  });

  it('GET /api/service-requests/client returns success with [] for zero requests', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('SELECT id, user_type, is_active FROM users')) {
        return [[{ id: 20, user_type: 'client', is_active: 1 }]];
      }
      if (String(sql).includes('FROM service_requests sr')) {
        return [[]];
      }
      return [[]];
    });

    const token = signToken(20);
    const res = await request(app)
      .get('/api/service-requests/client')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.requests).toEqual([]);
  });

  it('GET /api/notifications returns success with [] and unreadCount: 0 for zero notifications', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('SELECT id, user_type, is_active FROM users')) {
        return [[{ id: 20, user_type: 'client', is_active: 1 }]];
      }
      if (String(sql).includes('SELECT n.*')) {
        return [[]];
      }
      if (String(sql).includes('COUNT(*) as unread_count')) {
        return [[{ unread_count: 0 }]];
      }
      return [[]];
    });

    const token = signToken(20);
    const res = await request(app)
      .get('/api/notifications')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notifications).toEqual([]);
    expect(res.body.data.unreadCount).toBe(0);
  });

  it('GET /api/messages returns success with [] for user with zero conversations', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('SELECT id, user_type, is_active FROM users')) {
        return [[{ id: 20, user_type: 'client', is_active: 1 }]];
      }
      if (String(sql).includes('INSERT IGNORE INTO conversations')) {
        return [{ affectedRows: 0 }];
      }
      if (String(sql).includes('FROM conversations c')) {
        return [[]];
      }
      return [[]];
    });

    const token = signToken(20);
    const res = await request(app)
      .get('/api/messages')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.conversations).toEqual([]);
  });

  it('GET /api/admin/verification-requests returns success with [] for Admin with zero verifications', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('SELECT id, user_type, is_active FROM users')) {
        return [[{ id: 99, user_type: 'admin', is_active: 1 }]];
      }
      if (String(sql).includes('FROM verification_requests')) {
        return [[]];
      }
      return [[]];
    });

    const token = signToken(99);
    const res = await request(app)
      .get('/api/admin/verification-requests')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/user/onboarding-progress returns role-aware onboarding tasks for client', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('SELECT id, user_type, is_active FROM users')) {
        return [[{ id: 30, user_type: 'client', is_active: 1 }]];
      }
      if (String(sql).includes('SELECT id, user_type, email_verified')) {
        return [[{ id: 30, user_type: 'client', email_verified: 1, phone: '09171234567', address: 'Toledo City' }]];
      }
      if (String(sql).includes('COUNT(*) AS count FROM service_requests')) {
        return [[{ count: 0 }]];
      }
      return [[]];
    });

    const token = signToken(30);
    const res = await request(app)
      .get('/api/user/onboarding-progress')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userType).toBe('client');
    expect(res.body.data.completedCount).toBe(2);
    expect(res.body.data.totalCount).toBe(3);
    expect(res.body.data.isComplete).toBe(false);
  });
});
