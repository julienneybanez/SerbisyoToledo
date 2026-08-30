const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const db = require('../config/database');
const app = require('../server');

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

const authUserSql = 'SELECT id, user_type, is_active FROM users WHERE id = ? LIMIT 1';

const createConnectionMock = (queryImpl) => ({
  beginTransaction: vi.fn(async () => {}),
  commit: vi.fn(async () => {}),
  rollback: vi.fn(async () => {}),
  release: vi.fn(() => {}),
  query: vi.fn(queryImpl),
});

const CLIENT_ID = 10;
const PROVIDER_ID = 21;

const acceptedRequestRow = (overrides = {}) => ({
  id: 55,
  client_id: CLIENT_ID,
  provider_id: PROVIDER_ID,
  status: 'accepted',
  service_profile_id: 7,
  start_date: '2099-12-31',
  end_date: '2099-12-31',
  start_time: '09:00:00',
  estimated_duration_minutes: 120,
  provider_name: 'Provider One',
  client_name: 'Client One',
  provider_completed: 0,
  client_completed: 0,
  ...overrides,
});

describe('Reschedule integrity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects proposing a new reschedule while one is already pending', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (String(sql).includes('FROM service_requests sr') && String(sql).includes('FOR UPDATE')) {
        return [[acceptedRequestRow()]];
      }
      if (String(sql).includes('FROM service_request_reschedules') && String(sql).includes("reschedule_status = 'pending'")) {
        return [[{ id: 1 }]];
      }
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/service-requests/55/reschedules')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({
        bookingType: 'one_day',
        proposedStartDate: '2099-12-15',
        proposedEndDate: '2099-12-15',
        proposedStartTime: '10:00',
        estimatedDurationMinutes: 120,
        reason: 'Schedule conflict on my end.',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already has a pending reschedule/i);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('rejects proposing a reschedule once the request is no longer Accepted', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (String(sql).includes('FROM service_requests sr') && String(sql).includes('FOR UPDATE')) {
        return [[acceptedRequestRow({ status: 'on_the_way' })]];
      }
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/service-requests/55/reschedules')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({
        bookingType: 'one_day',
        proposedStartDate: '2099-12-15',
        proposedEndDate: '2099-12-15',
        proposedStartTime: '10:00',
        estimatedDurationMinutes: 120,
        reason: 'Need a new schedule.',
      });

    expect(res.status).toBe(409);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('a stale proposal cannot be accepted after the request leaves Accepted', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (String(sql).includes('FROM service_requests sr') && String(sql).includes('FOR UPDATE')) {
        return [[acceptedRequestRow({ status: 'on_the_way' })]];
      }
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/service-requests/55/reschedules/1/respond')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .send({ action: 'accepted' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/no longer valid/i);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('rejects responding to your own reschedule proposal', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (String(sql).includes('FROM service_requests sr') && String(sql).includes('FOR UPDATE')) {
        return [[acceptedRequestRow()]];
      }
      if (String(sql).includes('FROM service_request_reschedules') && String(sql).includes('WHERE id = ? AND service_request_id = ?')) {
        return [[{ id: 1, reschedule_status: 'pending', proposed_by: CLIENT_ID }]];
      }
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/service-requests/55/reschedules/1/respond')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({ action: 'accepted' });

    expect(res.status).toBe(403);
  });

  it('cancelling the request invalidates any pending reschedule proposal', async () => {
    let invalidatedReschedules = false;
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (String(sql).includes('FROM service_requests sr') && String(sql).includes('FOR UPDATE')) {
        return [[acceptedRequestRow()]];
      }
      if (String(sql).includes("UPDATE service_requests") && String(sql).includes("status = 'cancelled'")) {
        return [{ affectedRows: 1 }];
      }
      if (String(sql).includes('UPDATE service_request_reschedules') && String(sql).includes("reschedule_status = 'declined'")) {
        invalidatedReschedules = true;
        return [{ affectedRows: 1 }];
      }
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/service-requests/55/status')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({ status: 'cancelled', cancellationReason: 'Schedule conflict' });

    expect(res.status).toBe(200);
    expect(invalidatedReschedules).toBe(true);
  });

  it('progressing the request to On the Way invalidates any pending reschedule proposal', async () => {
    let invalidatedReschedules = false;
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (String(sql).includes('FROM service_requests sr') && String(sql).includes('FOR UPDATE')) {
        return [[acceptedRequestRow()]];
      }
      if (String(sql).includes('UPDATE service_requests SET status = ?')) {
        return [{ affectedRows: 1 }];
      }
      if (String(sql).includes('UPDATE service_request_reschedules') && String(sql).includes("reschedule_status = 'declined'")) {
        invalidatedReschedules = true;
        return [{ affectedRows: 1 }];
      }
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/service-requests/55/status')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .send({ status: 'on_the_way' });

    expect(res.status).toBe(200);
    expect(invalidatedReschedules).toBe(true);
  });
});
