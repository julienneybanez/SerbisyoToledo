const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const mysql = require('mysql2/promise');

const SOCKET_PATH = process.env.CANONICAL_TEST_DB_SOCKET || '\\\\.\\pipe\\serbisyo_canonical_test';
const DB_USER = process.env.CANONICAL_TEST_DB_USER || 'root';
const DB_PASSWORD = process.env.CANONICAL_TEST_DB_PASSWORD || '';
const DB_NAME = process.env.LEGACY_RECONCILIATION_TEST_DB_NAME || 'serbisyo_legacy_reconciliation_test';
const BACKEND_ROOT = path.join(__dirname, '..');
const SCHEMA_PATH = path.join(BACKEND_ROOT, 'migrations', '0000_baseline_canonical_schema.sql');
const RECONCILE_SCRIPT = path.join(BACKEND_ROOT, 'scripts', 'reconcile-production-schema.js');
const AUDIT_SCRIPT = path.join(BACKEND_ROOT, 'scripts', 'audit-runtime-schema.js');
const VERIFY_SCRIPT = path.join(BACKEND_ROOT, 'scripts', 'verify-runtime-sql.js');

const shouldRun = process.env.RECONCILIATION_INTEGRATION_TEST === '1';
const describeOrSkip = shouldRun ? describe : describe.skip;

const runScript = (scriptPath, args = []) => {
  try {
    const stdout = execFileSync('node', [scriptPath, ...args], {
      cwd: BACKEND_ROOT,
      env: {
        ...process.env,
        CANONICAL_INTEGRATION_TEST: '1',
        CANONICAL_TEST_DB_SOCKET: SOCKET_PATH,
        CANONICAL_TEST_DB_USER: DB_USER,
        CANONICAL_TEST_DB_PASSWORD: DB_PASSWORD,
        CANONICAL_TEST_DB_NAME: DB_NAME,
      },
      encoding: 'utf8',
    });
    return { exitCode: 0, stdout };
  } catch (error) {
    return { exitCode: error.status ?? 1, stdout: (error.stdout || '') + (error.stderr || '') };
  }
};

const runReconcile = (extraArgs = [], extraEnv = {}) => {
  try {
    const stdout = execFileSync('node', [RECONCILE_SCRIPT, ...extraArgs], {
      cwd: BACKEND_ROOT,
      env: {
        ...process.env,
        CANONICAL_INTEGRATION_TEST: '1',
        CANONICAL_TEST_DB_SOCKET: SOCKET_PATH,
        CANONICAL_TEST_DB_USER: DB_USER,
        CANONICAL_TEST_DB_PASSWORD: DB_PASSWORD,
        CANONICAL_TEST_DB_NAME: DB_NAME,
        ...extraEnv,
      },
      encoding: 'utf8',
    });
    return { exitCode: 0, stdout };
  } catch (error) {
    return { exitCode: error.status ?? 1, stdout: (error.stdout || '') + (error.stderr || '') };
  }
};

const toIsoDate = (daysFromNow) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
};

describeOrSkip('legacy production reconciliation reproduction', () => {
  let conn;
  let clientId;
  let providerId;
  let profileId;
  let differingProviderId;
  let differingProfileId;
  let oneDayRequestId;
  let continuousRequestId;
  let specificRequestId;
  let rescheduleId;

  beforeAll(async () => {
    let admin = await mysql.createConnection({ socketPath: SOCKET_PATH, user: DB_USER, password: DB_PASSWORD, multipleStatements: true });
    await admin.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\`; CREATE DATABASE \`${DB_NAME}\``);
    await admin.end();

    conn = await mysql.createConnection({ socketPath: SOCKET_PATH, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, multipleStatements: true });
    await conn.query(fs.readFileSync(SCHEMA_PATH, 'utf8'));

    // --- Downgrade to the reported Railway production shape ---
    await conn.query('ALTER TABLE users DROP COLUMN profile_image');
    await conn.query('ALTER TABLE users DROP COLUMN profile_photo');
    await conn.query('ALTER TABLE users ADD COLUMN registration_languages LONGTEXT NULL');
    await conn.query('ALTER TABLE users ADD COLUMN skills LONGTEXT NULL');

    await conn.query('ALTER TABLE service_requests DROP COLUMN booking_type');
    await conn.query('ALTER TABLE service_requests DROP COLUMN start_date');
    await conn.query('ALTER TABLE service_requests DROP COLUMN end_date');
    await conn.query('ALTER TABLE service_requests DROP COLUMN duration_days');
    await conn.query('ALTER TABLE service_requests ADD COLUMN scheduled_date DATE NULL');
    await conn.query('ALTER TABLE service_requests ADD COLUMN scheduled_start_at DATETIME NULL');
    await conn.query('ALTER TABLE service_requests ADD COLUMN scheduled_end_at DATETIME NULL');

    await conn.query('ALTER TABLE portfolio_items DROP COLUMN caption');
    await conn.query('ALTER TABLE service_request_dates DROP COLUMN created_at');
    await conn.query('ALTER TABLE service_request_reschedules DROP COLUMN updated_at');
    await conn.query('ALTER TABLE service_request_reschedule_dates DROP COLUMN created_at');

    await conn.query('ALTER TABLE service_profiles ADD COLUMN service_categories LONGTEXT NULL');

    // --- Seed users/providers ---
    const [client] = await conn.query(
      "INSERT INTO users (full_name, email, password, user_type, is_verified, email_verified) VALUES ('Legacy Client', 'legacy-client@test.local', 'hash', 'client', TRUE, TRUE)"
    );
    clientId = client.insertId;

    const [provider] = await conn.query(
      "INSERT INTO users (full_name, email, password, user_type, is_verified, email_verified) VALUES ('Legacy Provider', 'legacy-provider@test.local', 'hash', 'tradesperson', TRUE, TRUE)"
    );
    providerId = provider.insertId;

    const [profile] = await conn.query(
      "INSERT INTO service_profiles (user_id, barangay_address, starting_price, service_categories) VALUES (?, 'Poblacion, Toledo City', 500, ?)",
      [providerId, JSON.stringify(['Plumbing'])]
    );
    profileId = profile.insertId;

    // Provider whose canonical languages/skills/taxonomy were deliberately
    // edited away from the legacy registration/profile source.
    const [differingProvider] = await conn.query(
      `INSERT INTO users (full_name, email, password, user_type, is_verified, email_verified, registration_languages, skills)
       VALUES ('Edited Provider', 'edited-provider@test.local', 'hash', 'tradesperson', TRUE, TRUE, ?, ?)`,
      [JSON.stringify(['en', 'ceb', 'fil']), JSON.stringify(['Plumbing', 'Carpentry'])]
    );
    differingProviderId = differingProvider.insertId;
    await conn.query('INSERT INTO person_languages (user_id, language_code) VALUES (?, ?)', [differingProviderId, 'en']);
    await conn.query('INSERT INTO provider_skills (user_id, skill_label) VALUES (?, ?)', [differingProviderId, 'Electrical']);

    const [differingProfile] = await conn.query(
      "INSERT INTO service_profiles (user_id, barangay_address, starting_price, service_categories) VALUES (?, 'Poblacion, Toledo City', 700, ?)",
      [differingProviderId, JSON.stringify(['Plumbing'])]
    );
    differingProfileId = differingProfile.insertId;
    await conn.query('INSERT INTO service_profile_categories (service_profile_id, category_key) VALUES (?, ?)', [differingProfileId, 'electrical']);
    await conn.query('INSERT INTO service_profile_types (service_profile_id, service_type_key) VALUES (?, ?)', [differingProfileId, 'electrical_troubleshooting']);

    // --- One historical one-day request: pre-dates service_request_dates,
    // only the legacy single-appointment fields exist. ---
    const oneDayDate = toIsoDate(5);
    const [oneDayRequest] = await conn.query(
      `INSERT INTO service_requests
         (client_id, provider_id, service_profile_id, service_type_key, job_details, service_location,
          start_time, estimated_duration_minutes, pricing_unit_snapshot, daily_rate_snapshot, status,
          scheduled_date, scheduled_start_at, scheduled_end_at)
       VALUES (?, ?, ?, 'leak_repair', 'Legacy one-day job', 'Poblacion', '09:00', 60, 'per_day', 500, 'completed', ?, ?, ?)`,
      [clientId, providerId, profileId, oneDayDate, `${oneDayDate} 09:00:00`, `${oneDayDate} 10:00:00`]
    );
    oneDayRequestId = oneDayRequest.insertId;

    // --- Continuous multi-day request: 3 consecutive service_request_dates rows. ---
    const [continuousRequest] = await conn.query(
      `INSERT INTO service_requests
         (client_id, provider_id, service_profile_id, service_type_key, job_details, service_location,
          start_time, estimated_duration_minutes, pricing_unit_snapshot, daily_rate_snapshot, status)
       VALUES (?, ?, ?, 'leak_repair', 'Legacy continuous job', 'Poblacion', '08:00', 60, 'per_day', 500, 'completed')`,
      [clientId, providerId, profileId]
    );
    continuousRequestId = continuousRequest.insertId;
    const continuousDates = [toIsoDate(10), toIsoDate(11), toIsoDate(12)];
    for (const date of continuousDates) {
      await conn.query('INSERT INTO service_request_dates (service_request_id, service_date) VALUES (?, ?)', [continuousRequestId, date]);
    }

    // --- Non-consecutive specific-dates request: already has estimated_total,
    // which must be preserved rather than recalculated. ---
    const [specificRequest] = await conn.query(
      `INSERT INTO service_requests
         (client_id, provider_id, service_profile_id, service_type_key, job_details, service_location,
          start_time, estimated_duration_minutes, pricing_unit_snapshot, daily_rate_snapshot, estimated_total, status)
       VALUES (?, ?, ?, 'leak_repair', 'Legacy specific-dates job', 'Poblacion', '10:00', 60, 'per_day', 500, 9999.00, 'completed')`,
      [clientId, providerId, profileId]
    );
    specificRequestId = specificRequest.insertId;
    const specificDates = [toIsoDate(20), toIsoDate(23), toIsoDate(27)];
    for (const date of specificDates) {
      await conn.query('INSERT INTO service_request_dates (service_request_id, service_date) VALUES (?, ?)', [specificRequestId, date]);
    }

    // --- Reschedule + reschedule-date rows missing the new timestamp columns. ---
    const [reschedule] = await conn.query(
      `INSERT INTO service_request_reschedules
         (service_request_id, proposed_start_date, proposed_end_date, proposed_start_time,
          proposed_estimated_duration_minutes, proposed_by, reschedule_reason, reschedule_status, responded_at)
       VALUES (?, ?, ?, '09:00', 60, ?, 'Client requested a later date', 'accepted', NOW())`,
      [continuousRequestId, toIsoDate(15), toIsoDate(15), clientId]
    );
    rescheduleId = reschedule.insertId;
    await conn.query('INSERT INTO service_request_reschedule_dates (reschedule_id, proposed_date) VALUES (?, ?)', [rescheduleId, toIsoDate(15)]);
  }, 60000);

  afterAll(async () => {
    if (conn) await conn.end();
  });

  it('dry-run reports planned changes without mutating the database', async () => {
    const before = await conn.query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "service_requests" AND COLUMN_NAME = "booking_type"');
    expect(before[0]).toHaveLength(0);

    const result = runReconcile();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Mode: DRY RUN');
    expect(result.stdout).toContain('add service_requests.booking_type');
    expect(result.stdout).toContain('reconstruct booking_type/start_date/end_date/duration_days');
    expect(result.stdout).toContain('conditionally recover taxonomy/skills/languages');
    expect(result.stdout).toContain('Booking reconstruction preflight');
    expect(result.stdout).toContain('total existing service requests: 3');

    const after = await conn.query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "service_requests" AND COLUMN_NAME = "booking_type"');
    expect(after[0]).toHaveLength(0);
  });

  it('pre-audit reports incompatible with the exact reported missing columns', () => {
    const result = runScript(AUDIT_SCRIPT);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('"compatible": false');
    expect(result.stdout).toContain('"users"');
    expect(result.stdout).toContain('"profile_image"');
    expect(result.stdout).toContain('"booking_type"');
  });

  it('applies the reconciliation and reconstructs booking fields conservatively', () => {
    const result = runReconcile(['--apply', '--confirm-production'], {
      PRODUCTION_DB_BACKUP_CONFIRMED: 'yes',
      PRODUCTION_DB_EXPECTED_NAME: DB_NAME,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Mode: APPLY');
  }, 30000);

  it('reconstructs the one-day request from legacy scheduled_* fields', async () => {
    const [[row]] = await conn.query(
      `SELECT booking_type, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, duration_days
         FROM service_requests WHERE id = ?`,
      [oneDayRequestId]
    );
    const expectedDate = toIsoDate(5);
    expect(row.booking_type).toBe('one_day');
    expect(row.start_date).toBe(expectedDate);
    expect(row.end_date).toBe(expectedDate);
    expect(row.duration_days).toBe(1);
  });

  it('reconstructs the continuous multi-day request from service_request_dates', async () => {
    const [[row]] = await conn.query(
      `SELECT booking_type, multi_day_mode, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, duration_days
         FROM service_requests WHERE id = ?`,
      [continuousRequestId]
    );
    expect(row.booking_type).toBe('multi_day');
    expect(row.multi_day_mode).toBe('continuous');
    expect(row.start_date).toBe(toIsoDate(10));
    expect(row.end_date).toBe(toIsoDate(12));
    expect(row.duration_days).toBe(3);
  });

  it('reconstructs the non-consecutive specific-dates request and preserves its historical total', async () => {
    const [[row]] = await conn.query(
      `SELECT booking_type, multi_day_mode, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, duration_days, estimated_total
         FROM service_requests WHERE id = ?`,
      [specificRequestId]
    );
    expect(row.booking_type).toBe('multi_day');
    expect(row.multi_day_mode).toBe('specific_dates');
    expect(row.start_date).toBe(toIsoDate(20));
    expect(row.end_date).toBe(toIsoDate(27));
    expect(row.duration_days).toBe(3);
    expect(Number(row.estimated_total)).toBe(9999);
  });

  it('does not re-add deliberately removed languages, skills, or taxonomy', async () => {
    const [languages] = await conn.query('SELECT language_code FROM person_languages WHERE user_id = ? ORDER BY language_code', [differingProviderId]);
    expect(languages.map((row) => row.language_code)).toEqual(['en']);

    const [skills] = await conn.query('SELECT skill_label FROM provider_skills WHERE user_id = ?', [differingProviderId]);
    expect(skills.map((row) => row.skill_label)).toEqual(['Electrical']);

    const [categories] = await conn.query('SELECT category_key FROM service_profile_categories WHERE service_profile_id = ?', [differingProfileId]);
    expect(categories.map((row) => row.category_key)).toEqual(['electrical']);

    const [types] = await conn.query('SELECT service_type_key FROM service_profile_types WHERE service_profile_id = ?', [differingProfileId]);
    expect(types.map((row) => row.service_type_key)).toEqual(['electrical_troubleshooting']);
  });

  it('recovers taxonomy for the profile that had zero canonical rows', async () => {
    const [categories] = await conn.query('SELECT category_key FROM service_profile_categories WHERE service_profile_id = ?', [profileId]);
    expect(categories.map((row) => row.category_key)).toContain('plumbing');
  });

  it('reconstructs timestamp metadata from parent historical timestamps rather than "now"', async () => {
    const [[rescheduleDateRow]] = await conn.query(
      `SELECT rrd.created_at, rr.created_at AS parent_created_at
         FROM service_request_reschedule_dates rrd
         JOIN service_request_reschedules rr ON rr.id = rrd.reschedule_id
        WHERE rrd.reschedule_id = ?`,
      [rescheduleId]
    );
    expect(rescheduleDateRow.created_at.getTime()).toBe(rescheduleDateRow.parent_created_at.getTime());

    const [[rescheduleRow]] = await conn.query(
      'SELECT updated_at, responded_at FROM service_request_reschedules WHERE id = ?',
      [rescheduleId]
    );
    expect(rescheduleRow.updated_at.getTime()).toBe(rescheduleRow.responded_at.getTime());

    const [[dateRow]] = await conn.query(
      `SELECT srd.created_at, sr.created_at AS parent_created_at
         FROM service_request_dates srd
         JOIN service_requests sr ON sr.id = srd.service_request_id
        WHERE srd.service_request_id = ?
        LIMIT 1`,
      [continuousRequestId]
    );
    expect(dateRow.created_at.getTime()).toBe(dateRow.parent_created_at.getTime());
  });

  it('is idempotent on a second apply', async () => {
    const before = await conn.query(
      'SELECT id, booking_type, start_date, end_date, duration_days, estimated_total FROM service_requests ORDER BY id'
    );

    const result = runReconcile(['--apply', '--confirm-production'], {
      PRODUCTION_DB_BACKUP_CONFIRMED: 'yes',
      PRODUCTION_DB_EXPECTED_NAME: DB_NAME,
    });
    expect(result.exitCode).toBe(0);

    const after = await conn.query(
      'SELECT id, booking_type, start_date, end_date, duration_days, estimated_total FROM service_requests ORDER BY id'
    );
    expect(JSON.stringify(after[0])).toBe(JSON.stringify(before[0]));

    const [languages] = await conn.query('SELECT language_code FROM person_languages WHERE user_id = ? ORDER BY language_code', [differingProviderId]);
    expect(languages.map((row) => row.language_code)).toEqual(['en']);
  }, 30000);

  it('post-audit reports compatible: true', () => {
    const result = runScript(AUDIT_SCRIPT);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"compatible": true');
  });

  it('db:verify:runtime passes every check', () => {
    const result = runScript(VERIFY_SCRIPT);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('❌');
  });
});
