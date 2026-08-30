const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const db = require('../config/database');
const app = require('../server');

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
const authUserSql = 'SELECT id, user_type, is_active FROM users WHERE id = ? LIMIT 1';

const PROVIDER_ID = 21;
const CLIENT_ID = 10;

describe('Provider verification status', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the latest rejection reason so the provider can see it persistently', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) {
        return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      }
      if (String(sql).includes('SELECT id, is_verified FROM users')) {
        return [[{ id: PROVIDER_ID, is_verified: 0 }]];
      }
      if (String(sql).includes('FROM verification_requests')) {
        return [[{
          id: 7,
          status: 'rejected',
          rejection_reason: 'Government ID is too blurry.',
          created_at: '2026-08-30T00:00:00.000Z',
          reviewed_at: '2026-08-30T01:00:00.000Z',
        }]];
      }
      return [[]];
    });

    const res = await request(app)
      .get('/api/user/verification-status')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.rejectionReason).toBe('Government ID is too blurry.');
    expect(res.body.data.canResubmit).toBe(true);
  });

  it('treats the account verification flag as authoritative after approval', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) {
        return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      }
      if (String(sql).includes('SELECT id, is_verified FROM users')) {
        return [[{ id: PROVIDER_ID, is_verified: 1 }]];
      }
      if (String(sql).includes('FROM verification_requests')) {
        return [[{
          id: 8,
          status: 'approved',
          rejection_reason: null,
          created_at: '2026-08-30T00:00:00.000Z',
          reviewed_at: '2026-08-30T01:00:00.000Z',
        }]];
      }
      return [[]];
    });

    const res = await request(app)
      .get('/api/user/verification-status')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.isVerified).toBe(true);
    expect(res.body.data.rejectionReason).toBeNull();
  });

  it('does not expose the provider-only verification status route to clients', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) {
        return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      }
      return [[]];
    });

    const res = await request(app)
      .get('/api/user/verification-status')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`);

    expect(res.status).toBe(403);
  });
});
