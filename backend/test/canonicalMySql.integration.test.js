const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

process.env.CANONICAL_INTEGRATION_TEST = '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'canonical-integration-secret';

const db = require('../config/database');
const serviceRequestController = require('../controllers/serviceRequestController');
const contactSharingController = require('../controllers/contactSharingController');
const adminController = require('../controllers/adminController');

const DATABASE_NAME = process.env.CANONICAL_TEST_DB_NAME || 'serbisyotoledo_canonical_test';
const SOCKET_PATH = process.env.CANONICAL_TEST_DB_SOCKET || '\\\\.\\pipe\\serbisyo_canonical_test';
const SCHEMA_PATH = path.join(__dirname, '..', 'migrations', '0000_baseline_canonical_schema.sql');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const dateAtOffset = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const createRequest = async ({ clientId, providerId, profileId, date, startTime, bookingType = 'one_day', dates, endDate }) => {
  const req = {
    user: { userId: clientId, userType: 'client' },
    body: {
      providerId,
      serviceProfileId: profileId,
      serviceTypeKey: 'leak_repair',
      jobDetails: 'Fix a leaking kitchen pipe.',
      serviceLocation: 'Poblacion, Toledo City',
      bookingType,
      dates,
      startDate: date,
      endDate,
      startTime,
      estimatedDurationMinutes: 60,
    },
  };
  const res = response();
  await serviceRequestController.createRequest(req, res);
  return res;
};

describe('canonical MySQL runtime integration', () => {
  let adminConnection;
  let clientId;
  let providerId;
  let profileId;
  let adminId;
  let availableDate;
  let secondDate;

  beforeAll(async () => {
    adminConnection = await mysql.createConnection({
      socketPath: SOCKET_PATH,
      user: process.env.CANONICAL_TEST_DB_USER || 'root',
      password: process.env.CANONICAL_TEST_DB_PASSWORD || '',
      multipleStatements: true,
    });
    await adminConnection.query(`DROP DATABASE IF EXISTS \`${DATABASE_NAME}\`; CREATE DATABASE \`${DATABASE_NAME}\``);
    await adminConnection.end();
    adminConnection = await mysql.createConnection({
      socketPath: SOCKET_PATH,
      user: process.env.CANONICAL_TEST_DB_USER || 'root',
      password: process.env.CANONICAL_TEST_DB_PASSWORD || '',
      database: DATABASE_NAME,
      multipleStatements: true,
    });
    await adminConnection.query(fs.readFileSync(SCHEMA_PATH, 'utf8'));

    const [client] = await adminConnection.query(
      "INSERT INTO users (full_name, email, password, user_type, is_verified, email_verified) VALUES ('Integration Client', 'client@canonical.test', 'hash', 'client', TRUE, TRUE)"
    );
    clientId = client.insertId;
    const [admin] = await adminConnection.query(
      "INSERT INTO users (full_name, email, password, user_type, is_verified, email_verified) VALUES ('Integration Admin', 'admin@canonical.test', 'hash', 'admin', TRUE, TRUE)"
    );
    adminId = admin.insertId;
    const [provider] = await adminConnection.query(
      "INSERT INTO users (full_name, email, password, user_type, phone, is_verified, email_verified) VALUES ('Integration Provider', 'provider@canonical.test', 'hash', 'tradesperson', '09171234567', TRUE, TRUE)"
    );
    providerId = provider.insertId;
    const [profile] = await adminConnection.query(
      "INSERT INTO service_profiles (user_id, barangay_address, starting_price, is_published) VALUES (?, 'Poblacion', 500, TRUE)",
      [providerId]
    );
    profileId = profile.insertId;
    availableDate = dateAtOffset(10);
    secondDate = dateAtOffset(11);
    await adminConnection.query('INSERT INTO service_profile_categories (service_profile_id, category_key) VALUES (?, ?)', [profileId, 'plumbing']);
    await adminConnection.query('INSERT INTO service_profile_types (service_profile_id, service_type_key) VALUES (?, ?)', [profileId, 'leak_repair']);
    await adminConnection.query(
      "INSERT INTO provider_availability_settings (service_profile_id, allow_same_day_booking, min_advance_notice_minutes, max_advance_booking_days, availability_status) VALUES (?, TRUE, 0, 60, 'available')",
      [profileId]
    );
    await adminConnection.query(
      'INSERT INTO provider_available_slots (service_profile_id, available_date, start_time, end_time) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
      [profileId, availableDate, '08:00:00', '12:00:00', profileId, availableDate, '13:00:00', '17:00:00']
    );
    await adminConnection.query(
      'INSERT INTO provider_available_slots (service_profile_id, available_date, start_time, end_time) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
      [profileId, secondDate, '08:00:00', '12:00:00', profileId, dateAtOffset(12), '08:00:00', '12:00:00']
    );
  });

  afterAll(async () => {
    await db.end();
    if (adminConnection) await adminConnection.end();
  });

  it('uses canonical joins for client requests and request details with exact booking dates', async () => {
    const created = await createRequest({ clientId, providerId, profileId, date: availableDate, startTime: '08:00' });
    expect(created.statusCode).toBe(201);
    const requestId = created.body.data.requestId;

    const listResponse = response();
    await serviceRequestController.getClientRequests({ user: { userId: clientId } }, listResponse);
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body.data.requests[0]).toMatchObject({ id: requestId, provider_name: 'Integration Provider', has_review: false });
    expect(listResponse.body.data.requests[0].booking_dates).toEqual([availableDate]);

    const detailResponse = response();
    await serviceRequestController.getRequestById({ params: { requestId }, user: { userId: clientId } }, detailResponse);
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.body.data.request).toMatchObject({ id: requestId, provider_name: 'Integration Provider', client_name: 'Integration Client' });
  });

  it('enforces configured time windows while allowing same-date non-overlapping bookings', async () => {
    const first = await createRequest({ clientId, providerId, profileId, date: availableDate, startTime: '09:00' });
    expect(first.statusCode).toBe(201);
    await adminConnection.query("UPDATE service_requests SET status = 'accepted' WHERE id = ?", [first.body.data.requestId]);

    const adjacent = await createRequest({ clientId, providerId, profileId, date: availableDate, startTime: '10:00' });
    expect(adjacent.statusCode).toBe(201);
    const overlap = await createRequest({ clientId, providerId, profileId, date: availableDate, startTime: '09:30' });
    expect(overlap.statusCode).toBe(409);
    const afternoon = await createRequest({ clientId, providerId, profileId, date: availableDate, startTime: '13:00' });
    expect(afternoon.statusCode).toBe(201);
    const outside = await createRequest({ clientId, providerId, profileId, date: availableDate, startTime: '12:00' });
    expect(outside.statusCode).toBe(409);
    const unavailableDate = await createRequest({ clientId, providerId, profileId, date: dateAtOffset(20), startTime: '09:00' });
    expect(unavailableDate.statusCode).toBe(409);
  });

  it('persists continuous and specific dates and atomically rejects an unavailable selected date', async () => {
    const thirdDate = dateAtOffset(12);
    const continuous = await createRequest({
      clientId, providerId, profileId, date: secondDate, endDate: thirdDate, startTime: '08:00', bookingType: 'date_range',
    });
    expect(continuous.statusCode).toBe(201);
    const [continuousDates] = await adminConnection.query(
      "SELECT DATE_FORMAT(service_date, '%Y-%m-%d') AS service_date FROM service_request_dates WHERE service_request_id = ? ORDER BY service_date",
      [continuous.body.data.requestId]
    );
    expect(continuousDates.map((row) => row.service_date)).toEqual([secondDate, thirdDate]);

    const specific = await createRequest({
      clientId, providerId, profileId, date: secondDate, startTime: '10:00', bookingType: 'specific_dates', dates: [secondDate, thirdDate],
    });
    expect(specific.statusCode).toBe(201);
    const [specificDates] = await adminConnection.query(
      "SELECT DATE_FORMAT(service_date, '%Y-%m-%d') AS service_date FROM service_request_dates WHERE service_request_id = ? ORDER BY service_date",
      [specific.body.data.requestId]
    );
    expect(specificDates.map((row) => row.service_date)).toEqual([secondDate, thirdDate]);

    const [before] = await adminConnection.query('SELECT COUNT(*) AS count FROM service_requests');
    const rejected = await createRequest({
      clientId, providerId, profileId, date: secondDate, startTime: '11:00', bookingType: 'specific_dates', dates: [secondDate, dateAtOffset(20)],
    });
    expect(rejected.statusCode).toBe(409);
    const [after] = await adminConnection.query('SELECT COUNT(*) AS count FROM service_requests');
    expect(after[0].count).toBe(before[0].count);
  });

  it('persists exactly three continuous and non-consecutive service dates with per-day pricing', async () => {
    const continuousDates = [dateAtOffset(30), dateAtOffset(31), dateAtOffset(32)];
    await adminConnection.query(
      'INSERT INTO provider_available_slots (service_profile_id, available_date, start_time, end_time) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)',
      [profileId, continuousDates[0], '08:00:00', '12:00:00', profileId, continuousDates[1], '08:00:00', '12:00:00', profileId, continuousDates[2], '08:00:00', '12:00:00']
    );
    const continuous = await createRequest({ clientId, providerId, profileId, date: continuousDates[0], endDate: continuousDates[2], startTime: '08:00', bookingType: 'date_range' });
    expect(continuous).toMatchObject({ statusCode: 201, body: { data: { durationDays: 3, estimatedTotal: 1500 } } });
    const [storedContinuous] = await adminConnection.query("SELECT DATE_FORMAT(service_date, '%Y-%m-%d') AS service_date FROM service_request_dates WHERE service_request_id = ? ORDER BY service_date", [continuous.body.data.requestId]);
    expect(storedContinuous.map((row) => row.service_date)).toEqual(continuousDates);

    const specificDates = [dateAtOffset(37), dateAtOffset(40), dateAtOffset(44)];
    await adminConnection.query(
      'INSERT INTO provider_available_slots (service_profile_id, available_date, start_time, end_time) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)',
      [profileId, specificDates[0], '08:00:00', '12:00:00', profileId, specificDates[1], '08:00:00', '12:00:00', profileId, specificDates[2], '08:00:00', '12:00:00']
    );
    const specific = await createRequest({ clientId, providerId, profileId, date: specificDates[0], dates: specificDates, startTime: '10:00', bookingType: 'specific_dates' });
    expect(specific).toMatchObject({ statusCode: 201, body: { data: { bookingType: 'specific_dates', durationDays: 3, estimatedTotal: 1500 } } });
    const [storedSpecific] = await adminConnection.query("SELECT DATE_FORMAT(service_date, '%Y-%m-%d') AS service_date FROM service_request_dates WHERE service_request_id = ? ORDER BY service_date", [specific.body.data.requestId]);
    expect(storedSpecific.map((row) => row.service_date)).toEqual(specificDates);
  });

  it('rejects booking a provider whose verification has been revoked', async () => {
    await adminConnection.query('UPDATE users SET is_verified = FALSE WHERE id = ?', [providerId]);
    const rejected = await createRequest({ clientId, providerId, profileId, date: secondDate, startTime: '09:00' });
    expect(rejected.statusCode).toBe(400);
    await adminConnection.query('UPDATE users SET is_verified = TRUE WHERE id = ?', [providerId]);
  });

  it('enforces same-service restrictions across providers but permits a new request after closure', async () => {
    const [otherProvider] = await adminConnection.query(
      "INSERT INTO users (full_name, email, password, user_type, is_verified, email_verified) VALUES ('Second Provider', 'second@canonical.test', 'hash', 'tradesperson', TRUE, TRUE)"
    );
    const [otherProfile] = await adminConnection.query(
      "INSERT INTO service_profiles (user_id, barangay_address, starting_price, is_published) VALUES (?, 'Poblacion', 600, TRUE)",
      [otherProvider.insertId]
    );
    await adminConnection.query('INSERT INTO service_profile_categories (service_profile_id, category_key) VALUES (?, ?)', [otherProfile.insertId, 'plumbing']);
    await adminConnection.query('INSERT INTO service_profile_types (service_profile_id, service_type_key) VALUES (?, ?)', [otherProfile.insertId, 'leak_repair']);
    await adminConnection.query("INSERT INTO provider_availability_settings (service_profile_id, allow_same_day_booking, min_advance_notice_minutes, max_advance_booking_days, availability_status) VALUES (?, TRUE, 0, 60, 'available')", [otherProfile.insertId]);
    await adminConnection.query('INSERT INTO provider_available_slots (service_profile_id, available_date, start_time, end_time) VALUES (?, ?, ?, ?)', [otherProfile.insertId, dateAtOffset(40), '08:00:00', '12:00:00']);

    const active = await createRequest({ clientId, providerId, profileId, date: dateAtOffset(30), startTime: '11:00' });
    expect(active.statusCode).toBe(201);
    const blocked = await createRequest({ clientId, providerId: otherProvider.insertId, profileId: otherProfile.insertId, date: dateAtOffset(40), startTime: '08:00' });
    expect(blocked.statusCode).toBe(409);
    await adminConnection.query(
      "UPDATE service_requests SET status = 'cancelled' WHERE client_id = ? AND provider_id = ? AND status IN ('pending', 'accepted', 'on_the_way', 'in_progress')",
      [clientId, providerId]
    );
    const allowed = await createRequest({ clientId, providerId: otherProvider.insertId, profileId: otherProfile.insertId, date: dateAtOffset(40), startTime: '08:00' });
    expect(allowed.statusCode).toBe(201);
  });

  it('uses canonical report and phone-share columns', async () => {
    const reportJobDate = dateAtOffset(70);
    const [requestResult] = await adminConnection.query(
      "INSERT INTO service_requests (client_id, provider_id, service_profile_id, service_type_key, job_details, service_location, booking_type, start_date, end_date, duration_days, start_time, estimated_duration_minutes, pricing_unit_snapshot, daily_rate_snapshot, status) VALUES (?, ?, ?, 'leak_repair', 'Completed plumbing job', 'Poblacion', 'one_day', ?, ?, 1, '09:00', 60, 'per_day', 500, 'accepted')",
      [clientId, providerId, profileId, reportJobDate, reportJobDate]
    );
    const requestId = requestResult.insertId;
    const reportResponse = response();
    await serviceRequestController.createReport({ params: { requestId }, user: { userId: clientId }, body: { reportedUserId: providerId, reason: 'Test', description: 'Canonical report insert.' } }, reportResponse);
    expect(reportResponse.statusCode).toBe(201);

    const requestShareResponse = response();
    await contactSharingController.requestPhoneShare({ params: { requestId }, user: { userId: clientId } }, requestShareResponse);
    expect(requestShareResponse.statusCode).toBe(201);
    const respondResponse = response();
    await contactSharingController.respondToPhoneShare({ params: { requestId }, user: { userId: providerId }, body: { action: 'share' } }, respondResponse);
    expect(respondResponse.statusCode).toBe(200);
    const [shares] = await adminConnection.query('SELECT requester_user_id, owner_user_id FROM service_request_contact_shares WHERE service_request_id = ?', [requestId]);
    expect(shares[0]).toMatchObject({ requester_user_id: clientId, owner_user_id: providerId });

    const stateResponse = response();
    await contactSharingController.getPhoneShareState({ params: { requestId }, user: { userId: clientId } }, stateResponse);
    expect(stateResponse.body.data.sharedPhone).toMatchObject({ e164: '+639171234567', display: '09171234567' });
  });

  it('uses canonical report statuses and Admin activity dates', async () => {
    const activityJobDate = dateAtOffset(71);
    const [requestResult] = await adminConnection.query(
      "INSERT INTO service_requests (client_id, provider_id, service_profile_id, service_type_key, job_details, service_location, booking_type, start_date, end_date, duration_days, start_time, estimated_duration_minutes, pricing_unit_snapshot, daily_rate_snapshot, status) VALUES (?, ?, ?, 'leak_repair', 'Activity job', 'Poblacion', 'one_day', ?, ?, 1, '09:00', 60, 'per_day', 500, 'completed')",
      [clientId, providerId, profileId, activityJobDate, activityJobDate]
    );
    await adminConnection.query('INSERT INTO service_request_dates (service_request_id, service_date) VALUES (?, ?)', [requestResult.insertId, secondDate]);
    const [report] = await adminConnection.query("INSERT INTO user_reports (reporter_id, reported_user_id, request_id, reason, description, status) VALUES (?, ?, ?, 'Test', 'Lifecycle', 'pending')", [clientId, providerId, requestResult.insertId]);
    const investigate = response();
    await adminController.updateReportStatus({ params: { id: report.insertId }, user: { userId: adminId }, body: { action: 'investigate' } }, investigate);
    expect(investigate.statusCode).toBe(200);
    const resolve = response();
    await adminController.updateReportStatus({ params: { id: report.insertId }, user: { userId: adminId }, body: { action: 'resolve', resolutionNotes: 'Resolved.' } }, resolve);
    expect(resolve.statusCode).toBe(200);
    const activity = response();
    await adminController.getUserActivity({ params: { id: clientId } }, activity);
    expect(activity.statusCode).toBe(200);
    expect(activity.body.data.recentRequests.some((item) => item.scheduled_date)).toBe(true);
  });

  it('uses canonical completed-job portfolio ownership rows', async () => {
    const portfolioJobDate = dateAtOffset(72);
    const [completed] = await adminConnection.query(
      "INSERT INTO service_requests (client_id, provider_id, service_profile_id, service_type_key, job_details, service_location, booking_type, start_date, end_date, duration_days, start_time, estimated_duration_minutes, pricing_unit_snapshot, daily_rate_snapshot, status) VALUES (?, ?, ?, 'leak_repair', 'Portfolio job', 'Poblacion', 'one_day', ?, ?, 1, '09:00', 60, 'per_day', 500, 'completed')",
      [clientId, providerId, profileId, portfolioJobDate, portfolioJobDate]
    );
    const [portfolio] = await adminConnection.query('INSERT INTO portfolio_items (service_request_id) VALUES (?)', [completed.insertId]);
    const [owned] = await adminConnection.query("SELECT pi.id FROM portfolio_items pi JOIN service_requests sr ON sr.id = pi.service_request_id WHERE pi.id = ? AND sr.provider_id = ? AND sr.status = 'completed'", [portfolio.insertId, providerId]);
    const [notOwned] = await adminConnection.query("SELECT pi.id FROM portfolio_items pi JOIN service_requests sr ON sr.id = pi.service_request_id WHERE pi.id = ? AND sr.provider_id = ? AND sr.status = 'completed'", [portfolio.insertId, clientId]);
    expect(owned).toHaveLength(1);
    expect(notOwned).toHaveLength(0);
  });
});