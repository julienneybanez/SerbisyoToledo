const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const db = require('../config/database');
const app = require('../server');

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

const authUserSql = 'SELECT id, user_type, is_active FROM users WHERE id = ? LIMIT 1';

const CLIENT_ID = 10;
const OUTSIDER_ID = 999;

describe('Request archive', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('denies archiving a request for a non-participant', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: OUTSIDER_ID, user_type: 'client', is_active: 1 }]];
      if (String(sql).includes('FROM service_requests') && String(sql).includes('WHERE id = ? AND (client_id = ? OR provider_id = ?)')) {
        return [[]];
      }
      return [[]];
    });

    const res = await request(app)
      .post('/api/service-requests/55/archive')
      .set('Authorization', `Bearer ${signToken(OUTSIDER_ID)}`);

    expect(res.status).toBe(404);
  });

  it.each(['pending', 'accepted', 'on_the_way', 'in_progress'])(
    'rejects archiving while the request is still open (%s)',
    async (status) => {
      vi.spyOn(db, 'query').mockImplementation(async (sql) => {
        if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
        if (String(sql).includes('FROM service_requests') && String(sql).includes('WHERE id = ? AND (client_id = ? OR provider_id = ?)')) {
          return [[{ id: 55, status }]];
        }
        return [[]];
      });

      const res = await request(app)
        .post('/api/service-requests/55/archive')
        .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`);

      expect(res.status).toBe(409);
    }
  );

  it.each(['completed', 'declined', 'cancelled'])(
    'allows a participant to archive a closed request (%s)',
    async (status) => {
      let insertParams = null;
      vi.spyOn(db, 'query').mockImplementation(async (sql, params) => {
        if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
        if (String(sql).includes('FROM service_requests') && String(sql).includes('WHERE id = ? AND (client_id = ? OR provider_id = ?)')) {
          return [[{ id: 55, status }]];
        }
        if (String(sql).includes('INSERT INTO service_request_archives')) {
          insertParams = params;
          return [{ insertId: 1 }];
        }
        return [[]];
      });

      const res = await request(app)
        .post('/api/service-requests/55/archive')
        .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`);

      expect(res.status).toBe(200);
      expect(insertParams).toEqual([55, CLIENT_ID]);
    }
  );

  it('archiving is scoped per-user (archive row keyed by user_id, not shared)', async () => {
    let insertParams = null;
    vi.spyOn(db, 'query').mockImplementation(async (sql, params) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      if (String(sql).includes('FROM service_requests') && String(sql).includes('WHERE id = ? AND (client_id = ? OR provider_id = ?)')) {
        return [[{ id: 55, status: 'completed' }]];
      }
      if (String(sql).includes('INSERT INTO service_request_archives')) {
        insertParams = params;
        expect(sql).toMatch(/ON DUPLICATE KEY UPDATE/i);
        return [{ insertId: 1 }];
      }
      return [[]];
    });

    const res = await request(app)
      .post('/api/service-requests/55/archive')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`);

    expect(res.status).toBe(200);
    expect(insertParams[1]).toBe(CLIENT_ID);
  });

  it('unarchive restores visibility by deleting only the caller archive row', async () => {
    let deleteParams = null;
    vi.spyOn(db, 'query').mockImplementation(async (sql, params) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      if (String(sql).includes('FROM service_requests') && String(sql).includes('WHERE id = ? AND (client_id = ? OR provider_id = ?)')) {
        return [[{ id: 55, status: 'completed' }]];
      }
      if (String(sql).includes('DELETE FROM service_request_archives')) {
        deleteParams = params;
        return [{ affectedRows: 1 }];
      }
      return [[]];
    });

    const res = await request(app)
      .delete('/api/service-requests/55/archive')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`);

    expect(res.status).toBe(200);
    expect(deleteParams).toEqual([55, CLIENT_ID]);
  });

  it('denies unarchiving for a non-participant', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: OUTSIDER_ID, user_type: 'client', is_active: 1 }]];
      if (String(sql).includes('FROM service_requests') && String(sql).includes('WHERE id = ? AND (client_id = ? OR provider_id = ?)')) {
        return [[]];
      }
      return [[]];
    });

    const res = await request(app)
      .delete('/api/service-requests/55/archive')
      .set('Authorization', `Bearer ${signToken(OUTSIDER_ID)}`);

    expect(res.status).toBe(404);
  });
});
