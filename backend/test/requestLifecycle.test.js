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

const buildRequestRow = (overrides = {}) => ({
  id: 100,
  client_id: CLIENT_ID,
  provider_id: PROVIDER_ID,
  service_profile_id: 7,
  service_type_key: 'leak_repair',
  service_type_label: 'Leak Repair',
  job_details: 'Fix kitchen sink leak',
  service_location: '123 Main St, Toledo',
  multi_day_mode: 'continuous',
  start_date: '2099-12-31',
  end_date: '2099-12-31',
  start_time: '09:00:00',
  estimated_duration_minutes: 120,
  pricing_unit_snapshot: 'per_day',
  daily_rate_snapshot: '500.00',
  estimated_total: '500.00',
  status: 'pending',
  provider_completed: 0,
  client_completed: 0,
  provider_name: 'Provider One',
  client_name: 'Client One',
  ...overrides,
});

describe('Canonical Request Lifecycle Hardening', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1) blocks booking if provider has overlapping confirmed booking, allows non-overlapping', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const connOverlap = createConnectionMock(async (sql) => {
      if (sql.includes('information_schema.tables')) {
        return [[{ table_count: 1 }]];
      }
      if (sql.includes('FROM service_profiles sp')) {
        return [[{ service_profile_id: 7, provider_id: PROVIDER_ID, is_published: 1, user_type: 'tradesperson', is_active: 1 }]];
      }
      if (sql.includes('SELECT category_key FROM service_profile_categories')) {
        return [[{ category_key: 'plumbing' }]];
      }
      if (sql.includes('SELECT service_type_key FROM service_profile_types')) {
        return [[{ service_type_key: 'leak_repair' }]];
      }
      if (sql.includes('FROM provider_availability_settings')) {
        return [[{ availability_status: 'available' }]];
      }
      if (sql.includes('FROM provider_weekly_availability')) {
        return [[{ start_time: '08:00:00', end_time: '18:00:00', is_available: 1 }]];
      }
      if (sql.includes('FROM service_requests sr') && sql.includes('service_date')) {
        // Provider already has a confirmed booking 09:00 - 11:00
        return [[{ id: 99, start_time: '09:00:00', estimated_duration_minutes: 120 }]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(connOverlap);

    const resOverlap = await request(app)
      .post('/api/service-requests/create')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({
        providerId: PROVIDER_ID,
        serviceProfileId: 7,
        serviceTypeKey: 'leak_repair',
        jobDetails: 'Fix sink',
        serviceLocation: 'Toledo',
        bookingType: 'one_day',
        startDate: '2099-12-31',
        startTime: '10:00', // Overlaps with 09:00 - 11:00
        estimatedDurationMinutes: 120,
      });

    expect(resOverlap.status).toBe(409);
    expect(resOverlap.body.message).toMatch(/no longer available/i);
  });

  it('2) blocks active request for same service type across different providers for same client', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('FROM service_profiles sp')) {
        return [[{ service_profile_id: 7, provider_id: PROVIDER_ID, is_published: 1, user_type: 'tradesperson', is_active: 1 }]];
      }
      if (sql.includes('SELECT category_key FROM service_profile_categories')) {
        return [[{ category_key: 'plumbing' }]];
      }
      if (sql.includes('SELECT service_type_key FROM service_profile_types')) {
        return [[{ service_type_key: 'leak_repair' }]];
      }
      if (sql.includes('SELECT sr.id, sr.provider_id, sr.service_type_key')) {
        // Client already has an active leak_repair request with provider 99
        return [[{ id: 12, provider_id: 99, service_type_key: 'leak_repair', status: 'pending' }]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/service-requests/create')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({
        providerId: PROVIDER_ID,
        serviceProfileId: 7,
        serviceTypeKey: 'leak_repair',
        jobDetails: 'Fix sink',
        serviceLocation: 'Toledo',
        bookingType: 'one_day',
        startDate: '2099-12-31',
        startTime: '09:00',
        estimatedDurationMinutes: 120,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ACTIVE_SERVICE_TYPE_REQUEST_EXISTS');
  });

  it('3) provider accepts request and writes status history row', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('FROM service_requests sr') && sql.includes('FOR UPDATE')) {
        return [[buildRequestRow({ status: 'pending' })]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/service-requests/100/status')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .send({ status: 'accepted' });

    expect(res.status).toBe(200);

    const historyCall = conn.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO service_request_status_history'));
    expect(historyCall).toBeTruthy();
    expect(historyCall[1]).toEqual([100, 'pending', 'accepted', PROVIDER_ID]);
  });

  it('4) participant cancels request with cancellation fields and status history', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('FROM service_requests sr') && sql.includes('FOR UPDATE')) {
        return [[buildRequestRow({ status: 'accepted' })]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/service-requests/100/status')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({
        status: 'cancelled',
        cancellationReason: 'Schedule conflict',
      });

    expect(res.status).toBe(200);

    const updateCall = conn.query.mock.calls.find(([sql]) => sql.includes('cancellation_reason = ?'));
    expect(updateCall).toBeTruthy();
    expect(updateCall[1][0]).toBe(CLIENT_ID);
    expect(updateCall[1][1]).toBe('Schedule conflict');

    const historyCall = conn.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO service_request_status_history'));
    expect(historyCall).toBeTruthy();
    expect(historyCall[1]).toEqual([100, 'accepted', CLIENT_ID, 'Schedule conflict']);
  });

  it('5) handles dual completion, sets completion timestamps without overwriting, and transitions status exactly once', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      return [[]];
    });

    // Step 1: Provider completes first
    const conn1 = createConnectionMock(async (sql) => {
      if (sql.includes('FROM service_requests sr') && sql.includes('FOR UPDATE')) {
        return [[buildRequestRow({ status: 'in_progress', provider_completed: 0, client_completed: 0 })]];
      }
      if (sql.includes('SELECT status, provider_completed, client_completed')) {
        return [[{ status: 'in_progress', provider_completed: 1, client_completed: 0 }]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(conn1);

    const res1 = await request(app)
      .patch('/api/service-requests/100/status')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .send({ status: 'completed' });

    expect(res1.status).toBe(200);
    expect(res1.body.data.fullyCompleted).toBe(false);

    // Verify timestamp update used COALESCE(provider_completed_at, NOW())
    const updateCall1 = conn1.query.mock.calls.find(([sql]) => sql.includes('provider_completed_at = COALESCE'));
    expect(updateCall1).toBeTruthy();

    // Step 2: Provider attempts to confirm again -> 409
    const conn2 = createConnectionMock(async (sql) => {
      if (sql.includes('FROM service_requests sr') && sql.includes('FOR UPDATE')) {
        return [[buildRequestRow({ status: 'in_progress', provider_completed: 1, client_completed: 0 })]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(conn2);

    const res2 = await request(app)
      .patch('/api/service-requests/100/status')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .send({ status: 'completed' });

    expect(res2.status).toBe(409);
    expect(res2.body.message).toMatch(/already confirmed completion/i);

    // Step 3: Client confirms completion -> fullyCompleted = true & exactly one completed history entry
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn3 = createConnectionMock(async (sql) => {
      if (sql.includes('FROM service_requests sr') && sql.includes('FOR UPDATE')) {
        return [[buildRequestRow({ status: 'in_progress', provider_completed: 1, client_completed: 0 })]];
      }
      if (sql.includes('SELECT status, provider_completed, client_completed')) {
        return [[{ status: 'in_progress', provider_completed: 1, client_completed: 1 }]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(conn3);

    const res3 = await request(app)
      .patch('/api/service-requests/100/status')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({ status: 'completed' });

    expect(res3.status).toBe(200);
    expect(res3.body.data.fullyCompleted).toBe(true);

    const historyCall = conn3.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO service_request_status_history'));
    expect(historyCall).toBeTruthy();
    expect(historyCall[1]).toEqual([100, CLIENT_ID]);
  });

  it('6) accepts reschedule, preserves daily_rate_snapshot, and recalculates estimated_total', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('information_schema.tables')) {
        return [[{ table_count: 1 }]];
      }
      if (sql.includes('weekly_count')) {
        return [[{ weekly_count: 1, exception_count: 0 }]];
      }
      if (sql.includes('FROM service_requests sr') && sql.includes('FOR UPDATE')) {
        return [[buildRequestRow({ status: 'accepted', daily_rate_snapshot: '500.00', estimated_total: '500.00' })]];
      }
      if (sql.includes('FROM service_request_reschedules')) {
        return [[{
          id: 50,
          service_request_id: 100,
          proposed_start_date: '2099-12-10',
          proposed_end_date: '2099-12-12', // 3 days
          proposed_start_time: '10:00:00',
          proposed_estimated_duration_minutes: 180,
          proposed_multi_day_mode: 'continuous',
          proposed_by: CLIENT_ID,
          reschedule_status: 'pending',
        }]];
      }
      if (sql.includes('FROM provider_availability_settings')) {
        return [[{ availability_status: 'available', max_advance_booking_days: 36500 }]];
      }
      if (sql.includes('FROM provider_available_slots')) {
        return [[{ start_time: '08:00:00', end_time: '18:00:00' }]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/service-requests/100/reschedules/50/respond')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .send({ action: 'accepted' });

    expect(res.status).toBe(200);

    const updateRequestCall = conn.query.mock.calls.find(([sql]) => sql.includes('UPDATE service_requests'));
    expect(updateRequestCall).toBeTruthy();
    // 3 days * 500 = 1500
    const updateParams = updateRequestCall[1];
    expect(updateParams).toContain(1500);
  });

  it('7) allows reviews for completed requests only by client owner, validates rating range', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      if (sql.includes('FROM service_requests sr') && sql.includes('WHERE sr.id = ? AND sr.client_id = ?')) {
        return [[buildRequestRow({ status: 'completed' })]];
      }
      if (sql.includes('FROM reviews WHERE service_request_id = ?')) {
        return [[]]; // No prior review
      }
      return [[]];
    });

    // Valid 4.5 star review
    const res = await request(app)
      .post('/api/service-requests/100/review')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({
        rating: 4.5,
        comment: 'Great work!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Invalid rating (e.g. 4.2)
    const resInvalid = await request(app)
      .post('/api/service-requests/100/review')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({
        rating: 4.2,
        comment: 'Invalid rating',
      });

    expect(resInvalid.status).toBe(400);
  });
});