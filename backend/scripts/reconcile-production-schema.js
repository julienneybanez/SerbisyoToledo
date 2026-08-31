const db = require('../config/database');
const {
  normalizeCategoryLabels,
  toCategoryKey,
  getServiceTypesForProfile,
} = require('../config/serviceTaxonomy');

const APPLY = process.argv.includes('--apply');
const CONFIRM_PRODUCTION = process.argv.includes('--confirm-production');
const BACKUP_CONFIRMED = String(process.env.PRODUCTION_DB_BACKUP_CONFIRMED || '').toLowerCase() === 'yes';
const EXPECTED_DATABASE_NAME = String(process.env.PRODUCTION_DB_EXPECTED_NAME || '').trim();

const plan = [];
const changes = [];
let databaseName = null;

const quote = (name) => '`' + String(name).replace(/`/g, '``') + '`';

async function getColumn(table, column) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows[0] || null;
}

async function tableExists(table) {
  const [rows] = await db.query(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND TABLE_TYPE = 'BASE TABLE'
     LIMIT 1`,
    [table]
  );
  return rows.length > 0;
}

async function viewExists(view) {
  const [rows] = await db.query(
    `SELECT 1
     FROM information_schema.VIEWS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [view]
  );
  return rows.length > 0;
}

async function indexExists(table, index) {
  const [rows] = await db.query(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    [table, index]
  );
  return rows.length > 0;
}

async function schedule(label, sql) {
  plan.push({ label, sql });
  if (!APPLY) return;
  console.log('APPLY:', label);
  await db.query(sql);
  changes.push(label);
}

async function ensureColumn(table, column, definition) {
  if (await getColumn(table, column)) return;
  await schedule(
    'add ' + table + '.' + column,
    'ALTER TABLE ' + quote(table) + ' ADD COLUMN ' + quote(column) + ' ' + definition
  );
}

async function ensureIndex(table, index, expression, unique = false) {
  if (await indexExists(table, index)) return;
  await schedule(
    'add index ' + table + '.' + index,
    'CREATE ' + (unique ? 'UNIQUE ' : '') + 'INDEX ' + quote(index) + ' ON ' + quote(table) + ' ' + expression
  );
}

async function dropIndexIfExists(table, index) {
  if (!(await indexExists(table, index))) return;
  await schedule(
    'drop obsolete index ' + table + '.' + index,
    'ALTER TABLE ' + quote(table) + ' DROP INDEX ' + quote(index)
  );
}

async function ensureTable(table, ddl) {
  if (await tableExists(table)) return;
  await schedule('create table ' + table, ddl);
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function idType(table) {
  const column = await getColumn(table, 'id');
  if (!column) throw new Error('Required parent table is missing: ' + table);
  return String(column.COLUMN_TYPE || 'int').toUpperCase();
}

async function preflightProductionData() {
  const [duplicatePendingVerification] = await db.query(
    `SELECT user_id, COUNT(*) AS pending_count
       FROM verification_requests
      WHERE status = 'pending'
      GROUP BY user_id
     HAVING COUNT(*) > 1`
  );

  if (duplicatePendingVerification.length > 0) {
    throw new Error(
      'Preflight failed: duplicate pending verification requests exist for user(s): '
      + duplicatePendingVerification.map((row) => row.user_id).join(', ')
      + '. Resolve these before production reconciliation.'
    );
  }

  if (await tableExists('legal_acceptances')) {
    const [duplicateLegalEvents] = await db.query(
      `SELECT user_id, acceptance_type, document_version, context,
              COALESCE(verification_request_id, 0) AS verification_request_key,
              COUNT(*) AS duplicate_count
         FROM legal_acceptances
        GROUP BY user_id, acceptance_type, document_version, context,
                 COALESCE(verification_request_id, 0)
       HAVING COUNT(*) > 1`
    );

    if (duplicateLegalEvents.length > 0) {
      throw new Error(
        'Preflight failed: duplicate legal acceptance evidence exists. '
        + 'No rows will be deleted automatically; resolve duplicates manually before reconciliation.'
      );
    }
  }

  if (await tableExists('service_request_reschedules')) {
    const [duplicatePendingReschedules] = await db.query(
      `SELECT service_request_id, COUNT(*) AS pending_count
         FROM service_request_reschedules
        WHERE reschedule_status = 'pending'
        GROUP BY service_request_id
       HAVING COUNT(*) > 1`
    );

    if (duplicatePendingReschedules.length > 0) {
      throw new Error(
        'Preflight failed: duplicate pending reschedule proposals exist for request(s): '
        + duplicatePendingReschedules.map((row) => row.service_request_id).join(', ')
        + '. Resolve these before production reconciliation.'
      );
    }
  }

  if (await tableExists('user_reports') && (await getColumn('user_reports', 'status'))) {
    const [unexpectedReportStatuses] = await db.query(
      `SELECT DISTINCT status FROM user_reports
        WHERE status IS NOT NULL
          AND status NOT IN ('pending','under_review','investigating','resolved','dismissed','banned')`
    );

    if (unexpectedReportStatuses.length > 0) {
      throw new Error(
        'Preflight failed: user_reports.status contains value(s) not covered by the safe migration mapping: '
        + unexpectedReportStatuses.map((row) => row.status).join(', ')
        + '. Resolve these manually before production reconciliation.'
      );
    }
  }
}

// Read-only aggregate counts only (no customer names/addresses/descriptions)
// so the exact scope of the booking reconstruction below can be reviewed
// before an apply is ever run.
async function reportBookingReconstructionAggregates() {
  if (!(await tableExists('service_requests'))) return;

  const [[totals]] = await db.query('SELECT COUNT(*) AS total FROM service_requests');
  const hasDatesTable = await tableExists('service_request_dates');

  const dateAgg = hasDatesTable
    ? (await db.query(
        `SELECT
           SUM(CASE WHEN agg.date_count = 1 THEN 1 ELSE 0 END) AS one_date_row,
           SUM(CASE WHEN agg.date_count > 1 THEN 1 ELSE 0 END) AS multi_date_rows,
           SUM(CASE WHEN agg.date_count IS NULL OR agg.date_count = 0 THEN 1 ELSE 0 END) AS zero_date_rows
           FROM service_requests sr
           LEFT JOIN (
             SELECT service_request_id, COUNT(DISTINCT service_date) AS date_count
               FROM service_request_dates
              GROUP BY service_request_id
           ) agg ON agg.service_request_id = sr.id`
      ))[0][0]
    : { one_date_row: 0, multi_date_rows: 0, zero_date_rows: totals.total };

  const hasScheduledDate = Boolean(await getColumn('service_requests', 'scheduled_date'));
  const hasScheduledStartAt = Boolean(await getColumn('service_requests', 'scheduled_start_at'));
  let legacyFallbackAvailable = 0;
  let noHistoricalEvidence = Number(dateAgg?.zero_date_rows || 0);

  if ((hasScheduledDate || hasScheduledStartAt) && Number(dateAgg?.zero_date_rows || 0) > 0) {
    const legacyConditions = [];
    if (hasScheduledDate) legacyConditions.push('sr.scheduled_date IS NOT NULL');
    if (hasScheduledStartAt) legacyConditions.push('sr.scheduled_start_at IS NOT NULL');
    const legacyPredicate = legacyConditions.join(' OR ');
    const zeroDatesPredicate = hasDatesTable
      ? 'NOT EXISTS (SELECT 1 FROM service_request_dates srd WHERE srd.service_request_id = sr.id)'
      : '1 = 1';

    const [[legacyAgg]] = await db.query(
      `SELECT
         SUM(CASE WHEN (${legacyPredicate}) THEN 1 ELSE 0 END) AS with_legacy_fields,
         SUM(CASE WHEN NOT (${legacyPredicate}) THEN 1 ELSE 0 END) AS without_legacy_fields
         FROM service_requests sr
        WHERE ${zeroDatesPredicate}`
    );
    legacyFallbackAvailable = Number(legacyAgg?.with_legacy_fields || 0);
    noHistoricalEvidence = Number(legacyAgg?.without_legacy_fields || 0);
  }

  console.log('\nBooking reconstruction preflight (aggregate counts only, no customer data):');
  console.log(' - total existing service requests: ' + Number(totals?.total || 0));
  console.log(' - requests with exactly one service_request_dates row: ' + Number(dateAgg?.one_date_row || 0));
  console.log(' - requests with multiple service_request_dates rows: ' + Number(dateAgg?.multi_date_rows || 0));
  console.log(' - requests with no service_request_dates rows: ' + Number(dateAgg?.zero_date_rows || 0));
  console.log('   - of those, with legacy scheduling fields available as fallback: ' + legacyFallbackAvailable);
  console.log('   - of those, with no historical scheduling evidence at all (falls back to request created_at): ' + noHistoricalEvidence);
}

async function ensureCoreColumns() {
  // service_profiles: current code no longer writes legacy full_name/service_categories.
  await ensureColumn('service_profiles', 'taxonomy_needs_review', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureColumn('service_profiles', 'about_me', 'TEXT NULL');
  await ensureColumn('service_profiles', 'response_time', "VARCHAR(100) NULL DEFAULT 'Within 24 hours'");
  await ensureColumn('service_profiles', 'banner_image_url', 'VARCHAR(500) NULL');
  await ensureColumn('service_profiles', 'banner_image_public_id', 'VARCHAR(255) NULL');

  const fullName = await getColumn('service_profiles', 'full_name');
  if (fullName && fullName.IS_NULLABLE === 'NO') {
    await schedule(
      'allow service_profiles.full_name to be nullable',
      'ALTER TABLE service_profiles MODIFY COLUMN full_name VARCHAR(255) NULL'
    );
  }

  const legacyCategories = await getColumn('service_profiles', 'service_categories');
  if (legacyCategories && legacyCategories.IS_NULLABLE === 'NO') {
    await schedule(
      'allow service_profiles.service_categories to be nullable',
      'ALTER TABLE service_profiles MODIFY COLUMN service_categories LONGTEXT NULL'
    );
  }

  // Current request creation no longer writes the retired job-title or scheduled_* fields.
  // booking_type/start_date/end_date/duration_days start nullable so a NOT NULL
  // DEFAULT cannot masquerade as historical evidence before reconstruction runs;
  // reconstructBookingFields() and normalizeBookingFieldShapes() tighten them later.
  const requestColumns = [
    ['service_type_key', 'VARCHAR(120) NULL'],
    ['service_type_label', 'VARCHAR(255) NULL'],
    ['service_location', 'VARCHAR(500) NULL'],
    ['booking_type', "ENUM('one_day','multi_day') NULL"],
    ['start_date', 'DATE NULL'],
    ['end_date', 'DATE NULL'],
    ['start_time', 'TIME NULL'],
    ['estimated_duration_minutes', 'INT NULL'],
    ['duration_days', 'INT NULL'],
    ['multi_day_mode', "ENUM('continuous','specific_dates') NULL"],
    ['pricing_unit_snapshot', "ENUM('per_job','per_hour','per_day') NULL"],
    ['daily_rate_snapshot', 'DECIMAL(10,2) NULL'],
    ['estimated_total', 'DECIMAL(10,2) NULL'],
    ['cancelled_by', 'INT NULL'],
    ['cancellation_reason', 'VARCHAR(64) NULL'],
    ['cancellation_reason_other', 'VARCHAR(500) NULL'],
    ['cancelled_at', 'TIMESTAMP NULL DEFAULT NULL'],
    ['provider_completed_at', 'TIMESTAMP NULL DEFAULT NULL'],
    ['client_completed_at', 'TIMESTAMP NULL DEFAULT NULL'],
  ];
  for (const [column, definition] of requestColumns) {
    await ensureColumn('service_requests', column, definition);
  }

  for (const [column, definition] of [
    ['job_title', 'VARCHAR(255) NULL'],
    ['scheduled_date', 'DATE NULL'],
    ['scheduled_time', 'VARCHAR(50) NULL'],
  ]) {
    const current = await getColumn('service_requests', column);
    if (current && current.IS_NULLABLE === 'NO') {
      await schedule(
        'allow service_requests.' + column + ' to be nullable',
        'ALTER TABLE service_requests MODIFY COLUMN ' + quote(column) + ' ' + definition
      );
    }
  }

  // Portfolio and review writes now use service_request_id as the canonical link.
  const portfolioColumns = [
    ['service_request_id', 'INT NULL'],
    ['caption', 'VARCHAR(255) NULL'],
    ['is_published', 'BOOLEAN NOT NULL DEFAULT TRUE'],
    ['is_featured', 'BOOLEAN NOT NULL DEFAULT FALSE'],
    ['updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ];
  for (const [column, definition] of portfolioColumns) {
    await ensureColumn('portfolio_items', column, definition);
  }

  for (const [column, definition] of [
    ['service_profile_id', 'INT NULL'],
    ['caption', 'VARCHAR(255) NULL'],
  ]) {
    const current = await getColumn('portfolio_items', column);
    if (current && current.IS_NULLABLE === 'NO') {
      await schedule(
        'allow portfolio_items.' + column + ' to be nullable',
        'ALTER TABLE portfolio_items MODIFY COLUMN ' + quote(column) + ' ' + definition
      );
    }
  }

  for (const [column, definition] of [
    ['service_profile_id', 'INT NULL'],
    ['client_id', 'INT NULL'],
  ]) {
    const current = await getColumn('reviews', column);
    if (current && current.IS_NULLABLE === 'NO') {
      await schedule(
        'allow reviews.' + column + ' to be nullable',
        'ALTER TABLE reviews MODIFY COLUMN ' + quote(column) + ' ' + definition
      );
    }
  }

  const rating = await getColumn('reviews', 'rating');
  if (rating && String(rating.COLUMN_TYPE).toLowerCase() !== 'decimal(2,1)') {
    await schedule('normalize reviews.rating precision', 'ALTER TABLE reviews MODIFY COLUMN rating DECIMAL(2,1) NOT NULL');
  }

  // Avoid repeatedly expanding an ENUM every time a new notification is added.
  const notificationType = await getColumn('notifications', 'type');
  if (notificationType && String(notificationType.DATA_TYPE || notificationType.COLUMN_TYPE).toLowerCase().startsWith('enum')) {
    await schedule(
      'convert notifications.type enum to varchar',
      'ALTER TABLE notifications MODIFY COLUMN type VARCHAR(64) NOT NULL'
    );
  }

  const certificationsData = await getColumn('verification_requests', 'certifications_data');
  if (certificationsData && certificationsData.IS_NULLABLE === 'NO') {
    await schedule(
      'make verification certifications optional',
      'ALTER TABLE verification_requests MODIFY COLUMN certifications_data LONGBLOB NULL'
    );
  }
  const certificationsMime = await getColumn('verification_requests', 'certifications_mime');
  if (certificationsMime && certificationsMime.IS_NULLABLE === 'NO') {
    await schedule(
      'make verification certification mime optional',
      'ALTER TABLE verification_requests MODIFY COLUMN certifications_mime VARCHAR(100) NULL'
    );
  }

  // Historical production enforced UNIQUE(user_id, status), which prevents a
  // provider from being rejected more than once. Canonical behavior permits
  // unlimited reviewed history while allowing only one active pending request.
  await dropIndexIfExists('verification_requests', 'uniq_user_pending_request');
  await ensureColumn(
    'verification_requests',
    'is_active_pending',
    "TINYINT(1) GENERATED ALWAYS AS (CASE WHEN status = 'pending' THEN 1 ELSE NULL END) STORED"
  );
  await ensureIndex(
    'verification_requests',
    'uq_verification_active_pending',
    '(user_id, is_active_pending)',
    true
  );
}

function parseEnumValues(columnType) {
  const match = /^enum\((.*)\)$/i.exec(String(columnType || '').trim());
  if (!match) return [];
  return match[1].split(',').map((value) => value.trim().replace(/^'|'$/g, ''));
}

const CANONICAL_REPORT_STATUSES = ['pending', 'investigating', 'resolved', 'dismissed'];
const LEGACY_REPORT_STATUS_SUPERSET = ['pending', 'under_review', 'investigating', 'resolved', 'dismissed', 'banned'];

// Active code still reads/writes these legacy compatibility columns
// unconditionally, so they must exist on every reconciled database. No photo
// data is fabricated here; existing values (or their absence) are preserved.
async function ensureUserProfilePhotoCompatibility() {
  await ensureColumn('users', 'profile_image', 'VARCHAR(500) NULL');
  await ensureColumn('users', 'profile_photo', 'LONGBLOB NULL');
}

// Bring the historical Railway `user_reports` shape up to the modern
// Admin Reports contract (status/resolution/screenshot_url/handled_by)
// without deleting any legacy column or fabricating moderation decisions.
async function ensureReportsSchema() {
  if (!(await tableExists('user_reports'))) return;

  await ensureColumn('user_reports', 'resolution', 'TEXT NULL');
  await ensureColumn('user_reports', 'screenshot_url', 'VARCHAR(500) NULL');
  await ensureColumn('user_reports', 'handled_by', 'BIGINT NULL');

  const statusColumn = await getColumn('user_reports', 'status');
  if (statusColumn) {
    const currentValues = parseEnumValues(statusColumn.COLUMN_TYPE);
    const isCanonicalShape = statusColumn.IS_NULLABLE === 'NO'
      && currentValues.length === CANONICAL_REPORT_STATUSES.length
      && CANONICAL_REPORT_STATUSES.every((value) => currentValues.includes(value));

    if (!isCanonicalShape) {
      if (!APPLY) {
        plan.push({
          label: 'normalize user_reports.status to canonical lifecycle enum (pending/investigating/resolved/dismissed)',
          sql: '[widen enum, backfill NULL/under_review/banned -> investigating/resolved, narrow enum]',
        });
      } else {
        // Widen first so every existing legacy value stays valid while rows are remapped.
        await db.query(
          "ALTER TABLE user_reports MODIFY COLUMN status ENUM('" + LEGACY_REPORT_STATUS_SUPERSET.join("','") + "') NULL DEFAULT 'pending'"
        );
        await db.query("UPDATE user_reports SET status = 'pending' WHERE status IS NULL");
        // Deterministic stage-label renames only; no new moderation decision is invented.
        await db.query("UPDATE user_reports SET status = 'investigating' WHERE status = 'under_review'");
        await db.query("UPDATE user_reports SET status = 'resolved' WHERE status = 'banned'");
        await db.query(
          "ALTER TABLE user_reports MODIFY COLUMN status ENUM('" + CANONICAL_REPORT_STATUSES.join("','") + "') NOT NULL DEFAULT 'pending'"
        );
        changes.push('normalized user_reports.status to canonical lifecycle enum (pending/investigating/resolved/dismissed)');
      }
    }
  }

  // Copy legacy free-text moderation notes into the canonical `resolution`
  // field without inventing new resolution text. screenshot_data/screenshot_mime
  // are intentionally left untouched; migrating those blobs to Cloudinary is a
  // separate, explicit follow-up (see PRODUCTION_RECONCILIATION_RUNBOOK.md).
  const hasResolutionNotes = await getColumn('user_reports', 'resolution_notes');
  const hasModerationNotes = await getColumn('user_reports', 'moderation_notes');
  if (hasResolutionNotes || hasModerationNotes) {
    if (!APPLY) {
      plan.push({
        label: 'backfill user_reports.resolution from legacy resolution_notes/moderation_notes',
        sql: '[data backfill]',
      });
    } else {
      await db.query(
        `UPDATE user_reports
            SET resolution = COALESCE(resolution, resolution_notes, moderation_notes)
          WHERE resolution IS NULL AND (resolution_notes IS NOT NULL OR moderation_notes IS NOT NULL)`
      );
      changes.push('backfilled user_reports.resolution from legacy resolution_notes/moderation_notes');
    }
  }
}

async function ensureSupportingTables() {
  const userId = await idType('users');
  const profileId = await idType('service_profiles');
  const requestId = await idType('service_requests');
  const verificationId = await idType('verification_requests');

  await ensureTable('person_languages', `
    CREATE TABLE person_languages (
      user_id ${userId} NOT NULL,
      language_code ENUM('en','ceb','fil') NOT NULL,
      PRIMARY KEY (user_id, language_code),
      CONSTRAINT fk_person_language_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureTable('service_profile_categories', `
    CREATE TABLE service_profile_categories (
      service_profile_id ${profileId} NOT NULL,
      category_key VARCHAR(80) NOT NULL,
      PRIMARY KEY (service_profile_id, category_key),
      KEY idx_service_profile_categories_key (category_key),
      CONSTRAINT fk_spc_profile FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureTable('service_profile_types', `
    CREATE TABLE service_profile_types (
      service_profile_id ${profileId} NOT NULL,
      service_type_key VARCHAR(120) NOT NULL,
      PRIMARY KEY (service_profile_id, service_type_key),
      KEY idx_service_profile_types_key (service_type_key),
      CONSTRAINT fk_spt_profile FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureTable('provider_skills', `
    CREATE TABLE provider_skills (
      user_id ${userId} NOT NULL,
      skill_label VARCHAR(120) NOT NULL,
      PRIMARY KEY (user_id, skill_label),
      CONSTRAINT fk_provider_skill_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureTable('provider_availability_settings', `
    CREATE TABLE provider_availability_settings (
      id INT NOT NULL AUTO_INCREMENT,
      service_profile_id ${profileId} NOT NULL,
      allow_same_day_booking BOOLEAN NOT NULL DEFAULT FALSE,
      min_advance_notice_minutes INT NOT NULL DEFAULT 720,
      max_advance_booking_days INT NOT NULL DEFAULT 60,
      availability_status ENUM('available','unavailable') NOT NULL DEFAULT 'available',
      show_availability_status BOOLEAN NOT NULL DEFAULT TRUE,
      PRIMARY KEY (id),
      UNIQUE KEY uq_availability_settings_profile (service_profile_id),
      CONSTRAINT fk_availability_settings_profile FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureColumn('provider_availability_settings', 'availability_status', "ENUM('available','unavailable') NOT NULL DEFAULT 'available'");
  await ensureColumn('provider_availability_settings', 'show_availability_status', 'BOOLEAN NOT NULL DEFAULT TRUE');

  await ensureTable('provider_available_slots', `
    CREATE TABLE provider_available_slots (
      id BIGINT NOT NULL AUTO_INCREMENT,
      service_profile_id ${profileId} NOT NULL,
      available_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_available_slot (service_profile_id, available_date, start_time, end_time),
      KEY idx_available_slots_profile_date (service_profile_id, available_date),
      CONSTRAINT fk_available_slot_profile FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureTable('provider_availability_blackouts', `
    CREATE TABLE provider_availability_blackouts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      service_profile_id ${profileId} NOT NULL,
      blackout_date DATE NOT NULL,
      start_time TIME NULL,
      end_time TIME NULL,
      reason VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_blackouts_profile_date (service_profile_id, blackout_date),
      CONSTRAINT fk_blackout_profile FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureTable('provider_credentials', `
    CREATE TABLE provider_credentials (
      id INT NOT NULL AUTO_INCREMENT,
      service_profile_id ${profileId} NOT NULL,
      credential_name VARCHAR(255) NOT NULL,
      credential_type ENUM('professional_license','tesda_certification','safety_training','technical_certification','government_accreditation','manufacturer_certification','training_certificate','other') NOT NULL,
      issuing_organization VARCHAR(255) NULL,
      credential_id VARCHAR(120) NULL,
      issue_date DATE NULL,
      expiration_date DATE NULL,
      does_not_expire BOOLEAN NOT NULL DEFAULT FALSE,
      credential_url VARCHAR(500) NULL,
      related_skills JSON NULL,
      document_url VARCHAR(500) NULL,
      document_public_id VARCHAR(255) NULL,
      verification_status ENUM('unverified','pending','verified','rejected','expired') NOT NULL DEFAULT 'unverified',
      verification_notes TEXT NULL,
      reviewed_by ${userId} NULL,
      reviewed_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_credentials_profile_status (service_profile_id, verification_status),
      CONSTRAINT fk_credential_profile FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
      CONSTRAINT fk_credential_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const issuingOrganization = await getColumn('provider_credentials', 'issuing_organization');
  if (issuingOrganization && issuingOrganization.IS_NULLABLE === 'NO') {
    await schedule(
      'allow provider_credentials.issuing_organization to be nullable',
      'ALTER TABLE provider_credentials MODIFY COLUMN issuing_organization VARCHAR(255) NULL'
    );
  }

  await ensureTable('legal_acceptances', `
    CREATE TABLE legal_acceptances (
      id BIGINT NOT NULL AUTO_INCREMENT,
      user_id ${userId} NOT NULL,
      acceptance_type VARCHAR(64) NOT NULL,
      document_version VARCHAR(32) NOT NULL,
      context VARCHAR(64) NOT NULL,
      verification_request_id ${verificationId} NULL,
      verification_request_key ${verificationId} GENERATED ALWAYS AS (COALESCE(verification_request_id, 0)) STORED NOT NULL,
      accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_legal_acceptance_event
        (user_id, acceptance_type, document_version, context, verification_request_key),
      KEY idx_legal_acceptance_user_type (user_id, acceptance_type),
      KEY idx_legal_acceptance_verification_request (verification_request_id),
      CONSTRAINT fk_legal_acceptance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_legal_acceptance_verification FOREIGN KEY (verification_request_id) REFERENCES verification_requests(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureColumn(
    'legal_acceptances',
    'verification_request_key',
    verificationId + ' GENERATED ALWAYS AS (COALESCE(verification_request_id, 0)) STORED NOT NULL'
  );
  await ensureIndex(
    'legal_acceptances',
    'uq_legal_acceptance_event',
    '(user_id, acceptance_type, document_version, context, verification_request_key)',
    true
  );

  await ensureTable('service_request_dates', `
    CREATE TABLE service_request_dates (
      id BIGINT NOT NULL AUTO_INCREMENT,
      service_request_id ${requestId} NOT NULL,
      service_date DATE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_request_date (service_request_id, service_date),
      KEY idx_request_dates_date (service_date),
      CONSTRAINT fk_service_request_dates_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureTable('service_request_reschedules', `
    CREATE TABLE service_request_reschedules (
      id BIGINT NOT NULL AUTO_INCREMENT,
      service_request_id ${requestId} NOT NULL,
      original_start_date DATE NULL,
      original_end_date DATE NULL,
      original_start_time TIME NULL,
      proposed_start_date DATE NOT NULL,
      proposed_end_date DATE NOT NULL,
      proposed_start_time TIME NOT NULL,
      proposed_estimated_duration_minutes INT NOT NULL,
      proposed_multi_day_mode ENUM('continuous','specific_dates') NULL,
      proposed_by ${userId} NOT NULL,
      reschedule_reason VARCHAR(1000) NOT NULL,
      reschedule_status ENUM('pending','accepted','declined','cancelled') NOT NULL DEFAULT 'pending',
      pending_marker TINYINT(1) GENERATED ALWAYS AS (CASE WHEN reschedule_status = 'pending' THEN 1 ELSE NULL END) STORED,
      responded_by ${userId} NULL,
      responded_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_reschedule_pending (service_request_id, pending_marker),
      KEY idx_reschedule_request_status (service_request_id, reschedule_status),
      CONSTRAINT fk_reschedule_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
      CONSTRAINT fk_reschedule_proposed_by FOREIGN KEY (proposed_by) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_reschedule_responded_by FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureColumn('service_request_reschedules', 'proposed_estimated_duration_minutes', 'INT NULL');
  await ensureColumn('service_request_reschedules', 'proposed_multi_day_mode', "ENUM('continuous','specific_dates') NULL");
  await ensureColumn(
    'service_request_reschedules',
    'pending_marker',
    "TINYINT(1) GENERATED ALWAYS AS (CASE WHEN reschedule_status = 'pending' THEN 1 ELSE NULL END) STORED"
  );
  await ensureIndex(
    'service_request_reschedules',
    'uq_reschedule_pending',
    '(service_request_id, pending_marker)',
    true
  );

  const rescheduleId = await tableExists('service_request_reschedules') ? await idType('service_request_reschedules') : 'BIGINT';
  await ensureTable('service_request_reschedule_dates', `
    CREATE TABLE service_request_reschedule_dates (
      id BIGINT NOT NULL AUTO_INCREMENT,
      reschedule_id ${rescheduleId} NOT NULL,
      proposed_date DATE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_reschedule_date (reschedule_id, proposed_date),
      CONSTRAINT fk_reschedule_date_parent FOREIGN KEY (reschedule_id) REFERENCES service_request_reschedules(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureTable('service_request_status_history', `
    CREATE TABLE service_request_status_history (
      id BIGINT NOT NULL AUTO_INCREMENT,
      service_request_id ${requestId} NOT NULL,
      from_status VARCHAR(20) NULL,
      to_status VARCHAR(20) NOT NULL,
      changed_by ${userId} NULL,
      reason VARCHAR(500) NULL,
      record_source ENUM('live','seeded') NOT NULL DEFAULT 'live',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_status_history_request_created (service_request_id, created_at),
      CONSTRAINT fk_status_history_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
      CONSTRAINT fk_status_history_actor FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureTable('conversations', `
    CREATE TABLE conversations (
      id INT NOT NULL AUTO_INCREMENT,
      service_request_id ${requestId} NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_conversation_request (service_request_id),
      KEY idx_conversation_updated (updated_at),
      CONSTRAINT fk_conversation_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const conversationId = await tableExists('conversations') ? await idType('conversations') : 'INT';
  await ensureTable('messages', `
    CREATE TABLE messages (
      id BIGINT NOT NULL AUTO_INCREMENT,
      conversation_id ${conversationId} NOT NULL,
      sender_id ${userId} NOT NULL,
      message_text VARCHAR(2000) NOT NULL,
      read_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_message_conversation_created (conversation_id, created_at),
      KEY idx_message_conversation_read (conversation_id, read_at),
      CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureTable('service_request_contact_shares', `
    CREATE TABLE service_request_contact_shares (
      id INT NOT NULL AUTO_INCREMENT,
      service_request_id ${requestId} NOT NULL,
      requester_user_id ${userId} NOT NULL,
      owner_user_id ${userId} NOT NULL,
      contact_type ENUM('phone') NOT NULL DEFAULT 'phone',
      status ENUM('pending','shared','declined','revoked') NOT NULL DEFAULT 'pending',
      requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      responded_at TIMESTAMP NULL DEFAULT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_contact_share_direction (service_request_id, requester_user_id, owner_user_id, contact_type),
      KEY idx_contact_share_owner_status (owner_user_id, status),
      CONSTRAINT fk_contact_share_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
      CONSTRAINT fk_contact_share_requester FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_contact_share_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  if (await tableExists('service_request_contact_shares')) {
    const requesterUserId = await getColumn('service_request_contact_shares', 'requester_user_id');
    const legacyRequesterId = await getColumn('service_request_contact_shares', 'requester_id');

    if (!requesterUserId && legacyRequesterId) {
      // The historical messaging migration called this requester_id. Rename it
      // in place so existing rows, FK/index metadata, and future inserts all use
      // the same canonical column instead of keeping two competing fields.
      await schedule(
        'rename service_request_contact_shares.requester_id to requester_user_id',
        'ALTER TABLE service_request_contact_shares CHANGE COLUMN requester_id requester_user_id ' + userId + ' NOT NULL'
      );
    } else if (!requesterUserId) {
      await ensureColumn('service_request_contact_shares', 'requester_user_id', userId + ' NOT NULL');
    } else if (legacyRequesterId) {
      // Defensive recovery for a partially-reconciled table containing both
      // columns: preserve values but stop the legacy NOT NULL field from
      // blocking current inserts that only provide requester_user_id.
      if (APPLY) {
        await db.query(
          'UPDATE service_request_contact_shares SET requester_user_id = COALESCE(requester_user_id, requester_id)'
        );
      } else {
        plan.push({
          label: 'backfill canonical requester_user_id from duplicate legacy requester_id',
          sql: '[data backfill]',
        });
      }

      if (legacyRequesterId.IS_NULLABLE === 'NO') {
        await schedule(
          'make duplicate legacy requester_id nullable',
          'ALTER TABLE service_request_contact_shares MODIFY COLUMN requester_id ' + userId + ' NULL'
        );
      }
    }
  }

  await ensureTable('service_request_archives', `
    CREATE TABLE service_request_archives (
      service_request_id ${requestId} NOT NULL,
      user_id ${userId} NOT NULL,
      archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (service_request_id, user_id),
      CONSTRAINT fk_archive_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
      CONSTRAINT fk_archive_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

async function ensureIndexes() {
  await ensureIndex('service_requests', 'idx_sr_client_type_status', '(client_id, service_type_key, status)');
  await ensureIndex('service_requests', 'idx_sr_provider_status', '(provider_id, status)');
  await ensureIndex('portfolio_items', 'idx_portfolio_request', '(service_request_id)');
}

// CREATE TABLE only supplies these columns on brand-new tables; existing
// production tables never receive them without an explicit ADD COLUMN, so
// timestamps are reconstructed from their parent row's real historical time
// instead of defaulting to the moment reconciliation happens to run.
async function ensureHistoricalTimestampColumn(table, column, finalDefinition, backfillSql) {
  if (!(await tableExists(table))) return;

  const current = await getColumn(table, column);
  const alreadyNormalized = current
    && current.IS_NULLABLE === 'NO'
    && /CURRENT_TIMESTAMP/i.test(String(current.COLUMN_DEFAULT || ''));
  if (alreadyNormalized) return;

  if (!current) {
    await ensureColumn(table, column, 'TIMESTAMP NULL');
  }

  if (!APPLY) {
    plan.push({
      label: 'reconstruct ' + table + '.' + column + ' from historical parent timestamp, then normalize to NOT NULL',
      sql: '[data backfill + schema normalize]',
    });
    return;
  }

  await db.query(backfillSql);
  // Any row a historical source could not resolve (e.g. an orphaned child
  // row) is timestamped now rather than left NULL, since no earlier fact exists.
  await db.query('UPDATE ' + quote(table) + ' SET ' + quote(column) + ' = CURRENT_TIMESTAMP WHERE ' + quote(column) + ' IS NULL');
  await db.query('ALTER TABLE ' + quote(table) + ' MODIFY COLUMN ' + quote(column) + ' ' + finalDefinition);
  changes.push('reconstructed ' + table + '.' + column + ' from historical parent timestamp and normalized to ' + finalDefinition);
}

async function ensureHistoricalTimestampColumns() {
  await ensureHistoricalTimestampColumn(
    'service_request_dates',
    'created_at',
    'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    `UPDATE service_request_dates srd
     JOIN service_requests sr ON sr.id = srd.service_request_id
        SET srd.created_at = sr.created_at
      WHERE srd.created_at IS NULL`
  );

  await ensureHistoricalTimestampColumn(
    'service_request_reschedule_dates',
    'created_at',
    'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    `UPDATE service_request_reschedule_dates rrd
     JOIN service_request_reschedules rr ON rr.id = rrd.reschedule_id
        SET rrd.created_at = rr.created_at
      WHERE rrd.created_at IS NULL`
  );

  await ensureHistoricalTimestampColumn(
    'service_request_reschedules',
    'updated_at',
    'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    `UPDATE service_request_reschedules
        SET updated_at = COALESCE(responded_at, created_at)
      WHERE updated_at IS NULL`
  );
}

async function backfillTaxonomyAndSkills() {
  if (!APPLY) {
    plan.push({
      label: 'conditionally recover taxonomy/skills/languages from legacy sources, only for profiles or users with zero existing canonical rows',
      sql: '[conditional data recovery]',
    });
    return;
  }

  // Legacy one-time source; absent on fresh canonical databases and on
  // production installs where this backfill already ran previously.
  if (await getColumn('service_profiles', 'service_categories')) {
    const [profiles] = await db.query(
      `SELECT sp.id, sp.service_categories,
              (SELECT COUNT(*) FROM service_profile_categories spc WHERE spc.service_profile_id = sp.id) AS category_count,
              (SELECT COUNT(*) FROM service_profile_types spt WHERE spt.service_profile_id = sp.id) AS type_count
       FROM service_profiles sp`
    );

    for (const row of profiles) {
      // A profile with any canonical rows already reflects the provider's
      // current (possibly deliberately edited) taxonomy; never reintroduce
      // legacy values over an existing canonical selection.
      if (Number(row.category_count) > 0 || Number(row.type_count) > 0) continue;

      const legacyCategories = parseJsonArray(row.service_categories);
      const normalizedLabels = normalizeCategoryLabels(legacyCategories, { preserveUnknown: true });
      const canonicalLabels = normalizeCategoryLabels(normalizedLabels, { preserveUnknown: false });
      const categoryKeys = canonicalLabels.map(toCategoryKey).filter(Boolean);
      const derivedTypes = getServiceTypesForProfile({ categoryLabels: canonicalLabels, serviceTypeKeys: [] });

      for (const key of categoryKeys) {
        await db.query(
          'INSERT IGNORE INTO service_profile_categories (service_profile_id, category_key) VALUES (?, ?)',
          [row.id, key]
        );
      }
      for (const type of derivedTypes) {
        await db.query(
          'INSERT IGNORE INTO service_profile_types (service_profile_id, service_type_key) VALUES (?, ?)',
          [row.id, type.key]
        );
      }

      await db.query(
        'UPDATE service_profiles SET taxonomy_needs_review = ? WHERE id = ?',
        [categoryKeys.length === 0 || derivedTypes.length === 0 ? 1 : 0, row.id]
      );
    }
  }

  // Legacy one-time source; absent on fresh canonical databases and on
  // production installs where this backfill already ran previously.
  if (await getColumn('users', 'skills')) {
    const [users] = await db.query(
      `SELECT u.id, u.skills
         FROM users u
        WHERE u.skills IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM provider_skills ps WHERE ps.user_id = u.id)`
    );
    for (const user of users) {
      for (const skill of parseJsonArray(user.skills).map((value) => String(value || '').trim()).filter(Boolean)) {
        await db.query(
          'INSERT IGNORE INTO provider_skills (user_id, skill_label) VALUES (?, ?)',
          [user.id, skill]
        );
      }
    }
  }

  if (await tableExists('provider_languages')) {
    await db.query(
      `INSERT IGNORE INTO person_languages (user_id, language_code)
       SELECT sp.user_id, pl.language_code
       FROM provider_languages pl
       JOIN service_profiles sp ON sp.id = pl.service_profile_id
       WHERE NOT EXISTS (SELECT 1 FROM person_languages existing WHERE existing.user_id = sp.user_id)`
    );
  }

  const registrationLanguages = await getColumn('users', 'registration_languages');
  if (registrationLanguages) {
    const [rows] = await db.query(
      `SELECT u.id, u.registration_languages
         FROM users u
        WHERE u.registration_languages IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM person_languages pl WHERE pl.user_id = u.id)`
    );
    for (const row of rows) {
      for (const code of parseJsonArray(row.registration_languages)) {
        const normalized = String(code || '').trim().toLowerCase();
        if (!['en', 'ceb', 'fil'].includes(normalized)) continue;
        await db.query(
          'INSERT IGNORE INTO person_languages (user_id, language_code) VALUES (?, ?)',
          [row.id, normalized]
        );
      }
    }
  }

  changes.push('conditionally recovered taxonomy, skills, and languages for profiles/users with zero canonical rows');
}


// service_request_dates is the authoritative historical source for what a
// client actually booked; legacy scheduled_* fields (a single appointment,
// never multi-day) are only used when no service_request_dates rows exist.
// booking_type/start_date/end_date/duration_days start nullable (see
// ensureCoreColumns) specifically so this reconstruction can distinguish
// "never recorded" from "already correct" and never overwrite a real value.
async function reconstructBookingFields() {
  if (!APPLY) {
    plan.push({
      label: 'reconstruct booking_type/start_date/end_date/duration_days/estimated_total from service_request_dates (preferred) or legacy scheduled_* fields',
      sql: '[conditional data reconstruction]',
    });
    return;
  }

  const hasScheduledDate = Boolean(await getColumn('service_requests', 'scheduled_date'));
  const hasScheduledStartAt = Boolean(await getColumn('service_requests', 'scheduled_start_at'));
  const hasScheduledEndAt = Boolean(await getColumn('service_requests', 'scheduled_end_at'));

  // DATE_FORMAT converts every date to a plain 'YYYY-MM-DD' string inside
  // MySQL itself, so no JS Date/timezone conversion can shift a calendar day.
  const legacySelect = [
    hasScheduledDate ? "DATE_FORMAT(sr.scheduled_date, '%Y-%m-%d') AS scheduled_date" : 'NULL AS scheduled_date',
    hasScheduledStartAt ? "DATE_FORMAT(sr.scheduled_start_at, '%Y-%m-%d') AS scheduled_start_at" : 'NULL AS scheduled_start_at',
    hasScheduledEndAt ? "DATE_FORMAT(sr.scheduled_end_at, '%Y-%m-%d') AS scheduled_end_at" : 'NULL AS scheduled_end_at',
  ].join(', ');

  const [rows] = await db.query(
    `SELECT sr.id,
            DATE_FORMAT(sr.start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(sr.end_date, '%Y-%m-%d') AS end_date,
            sr.booking_type, sr.multi_day_mode,
            sr.duration_days, sr.estimated_total, sr.daily_rate_snapshot,
            DATE_FORMAT(sr.created_at, '%Y-%m-%d') AS created_at_date,
            sp.starting_price,
            agg.date_count,
            DATE_FORMAT(agg.min_date, '%Y-%m-%d') AS min_date,
            DATE_FORMAT(agg.max_date, '%Y-%m-%d') AS max_date,
            ${legacySelect}
       FROM service_requests sr
       LEFT JOIN service_profiles sp ON sp.id = sr.service_profile_id
       LEFT JOIN (
         SELECT service_request_id, COUNT(DISTINCT service_date) AS date_count,
                MIN(service_date) AS min_date, MAX(service_date) AS max_date
           FROM service_request_dates
          GROUP BY service_request_id
       ) agg ON agg.service_request_id = sr.id
      WHERE sr.start_date IS NULL OR sr.end_date IS NULL OR sr.booking_type IS NULL OR sr.duration_days IS NULL`
  );

  for (const row of rows) {
    let startDate = row.start_date || null;
    let endDate = row.end_date || null;
    let bookingType = row.booking_type;
    let multiDayMode = row.multi_day_mode;
    let durationDays = row.duration_days;
    const dateCount = Number(row.date_count || 0);
    // service_requests.multi_day_mode already existed pre-migration as
    // NOT NULL DEFAULT 'continuous', so a non-NULL value here proves nothing
    // by itself; only trust it when booking_type also already had a real
    // (non-defaulted) value, meaning canonical-aware code actually wrote it.
    const bookingTypeWasRecorded = bookingType != null;

    if (dateCount > 0) {
      const minDate = row.min_date || null;
      const maxDate = row.max_date || null;
      startDate = startDate || minDate;
      endDate = endDate || maxDate;
      if (durationDays == null) durationDays = dateCount;
      if (bookingType == null) {
        bookingType = (dateCount > 1 || (minDate && maxDate && maxDate > minDate)) ? 'multi_day' : 'one_day';
      }
      if (!bookingTypeWasRecorded && bookingType === 'multi_day' && minDate && maxDate) {
        const spanDays = Math.round((new Date(maxDate + 'T00:00:00Z') - new Date(minDate + 'T00:00:00Z')) / 86400000) + 1;
        multiDayMode = spanDays === dateCount ? 'continuous' : 'specific_dates';
      }
    } else {
      // No service_request_dates evidence; the legacy schema only ever
      // recorded a single appointment, never a multi-day span.
      const legacyStart = row.scheduled_date || row.scheduled_start_at || null;
      const legacyEnd = row.scheduled_date || row.scheduled_end_at || row.scheduled_start_at || null;
      startDate = startDate || legacyStart || row.created_at_date;
      endDate = endDate || legacyEnd || startDate;
      if (durationDays == null) durationDays = 1;
      if (bookingType == null) bookingType = 'one_day';
    }

    if (multiDayMode == null) multiDayMode = 'continuous';
    if (durationDays == null) durationDays = 1;

    const dailyRate = row.daily_rate_snapshot != null
      ? row.daily_rate_snapshot
      : (row.starting_price != null ? row.starting_price : 0);

    // Never recompute a total that already exists; only derive one after the
    // real duration above has been established.
    const estimatedTotal = row.estimated_total != null
      ? row.estimated_total
      : Number(dailyRate) * Number(durationDays);

    await db.query(
      `UPDATE service_requests
          SET start_date = COALESCE(start_date, ?),
              end_date = COALESCE(end_date, ?),
              booking_type = COALESCE(booking_type, ?),
              multi_day_mode = ?,
              duration_days = COALESCE(duration_days, ?),
              daily_rate_snapshot = COALESCE(daily_rate_snapshot, ?),
              estimated_total = COALESCE(estimated_total, ?)
        WHERE id = ?`,
      [startDate, endDate, bookingType, multiDayMode, durationDays, dailyRate, estimatedTotal, row.id]
    );
  }

  changes.push('reconstructed booking_type/start_date/end_date/duration_days for ' + rows.length + ' legacy request(s)');
}

// Only tightens nullability/defaults after reconstruction has given every
// row a real value; a second run sees NOT NULL columns already and no-ops.
async function normalizeBookingFieldShapes() {
  const normalizations = [
    ['booking_type', "ENUM('one_day','multi_day') NOT NULL DEFAULT 'one_day'"],
    ['start_date', 'DATE NOT NULL'],
    ['end_date', 'DATE NOT NULL'],
    ['duration_days', 'INT NOT NULL DEFAULT 1'],
    ['multi_day_mode', "ENUM('continuous','specific_dates') NOT NULL DEFAULT 'continuous'"],
  ];

  for (const [column, definition] of normalizations) {
    const current = await getColumn('service_requests', column);
    if (!current || current.IS_NULLABLE === 'NO') continue;
    await schedule(
      'normalize service_requests.' + column + ' to ' + definition,
      'ALTER TABLE service_requests MODIFY COLUMN ' + quote(column) + ' ' + definition
    );
  }
}

async function backfillRequestCompatibility() {
  if (!APPLY) {
    plan.push({
      label: 'backfill remaining legacy request duration/pricing metadata and derive missing service_request_dates rows',
      sql: '[data backfill]',
    });
    return;
  }

  // Legacy one-time sources; absent on fresh canonical databases and on
  // production installs where this backfill already ran previously.
  const hasScheduledStartAt = Boolean(await getColumn('service_requests', 'scheduled_start_at'));
  const hasScheduledEndAt = Boolean(await getColumn('service_requests', 'scheduled_end_at'));

  const durationSources = ['estimated_duration_minutes'];
  if (hasScheduledStartAt && hasScheduledEndAt) {
    durationSources.push('TIMESTAMPDIFF(MINUTE, scheduled_start_at, scheduled_end_at)');
  }
  durationSources.push('120');

  await db.query(
    `UPDATE service_requests
        SET estimated_duration_minutes = COALESCE(${durationSources.join(', ')}),
            pricing_unit_snapshot = COALESCE(pricing_unit_snapshot, 'per_day')
      WHERE estimated_duration_minutes IS NULL OR pricing_unit_snapshot IS NULL`
  );

  // Requests that still have zero service_request_dates rows (typically ones
  // that predate that table entirely) get a single entry for their
  // reconstructed start_date so availability/busy-date checks stay accurate.
  // Requests that already have date rows are never touched.
  await db.query(
    `INSERT IGNORE INTO service_request_dates (service_request_id, service_date)
     SELECT sr.id, sr.start_date
       FROM service_requests sr
      WHERE sr.start_date IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM service_request_dates srd WHERE srd.service_request_id = sr.id)`
  );

  await db.query(
    `INSERT INTO service_request_status_history
       (service_request_id, from_status, to_status, changed_by, record_source, created_at)
     SELECT sr.id, NULL, sr.status, NULL, 'seeded', sr.created_at
     FROM service_requests sr
     LEFT JOIN service_request_status_history h ON h.service_request_id = sr.id
     WHERE h.id IS NULL`
  );

  changes.push('backfilled remaining request duration/pricing metadata and derived missing service_request_dates rows');
}

async function ensureStatsView() {
  if (await viewExists('service_profile_stats')) return;
  await schedule(
    'create service_profile_stats view',
    `CREATE VIEW service_profile_stats AS
     SELECT
       sp.id AS service_profile_id,
       COALESCE(review_stats.rating, 0) AS rating,
       COALESCE(review_stats.reviews_count, 0) AS reviews_count,
       COALESCE(job_stats.jobs_completed, 0) AS jobs_completed
     FROM service_profiles sp
     LEFT JOIN (
       SELECT sr.service_profile_id,
              AVG(r.rating) AS rating,
              COUNT(*) AS reviews_count
       FROM reviews r
       JOIN service_requests sr ON sr.id = r.service_request_id
       GROUP BY sr.service_profile_id
     ) review_stats ON review_stats.service_profile_id = sp.id
     LEFT JOIN (
       SELECT service_profile_id, COUNT(*) AS jobs_completed
       FROM service_requests
       WHERE status = 'completed'
       GROUP BY service_profile_id
     ) job_stats ON job_stats.service_profile_id = sp.id`
  );
}

async function verifyCriticalRuntime() {
  const checks = [
    ['messages', "SELECT COUNT(*) AS count FROM conversations"],
    ['provider profile', "SELECT COUNT(*) AS count FROM service_profile_stats"],
    ['taxonomy', "SELECT COUNT(*) AS count FROM service_profile_categories"],
    ['languages', "SELECT COUNT(*) AS count FROM person_languages"],
    ['availability', "SELECT COUNT(*) AS count FROM provider_available_slots"],
    ['admin reports', "SELECT COUNT(*) AS count FROM user_reports WHERE status IN ('pending','investigating','resolved','dismissed')"],
    ['profile photo compatibility', "SELECT COUNT(*) AS count FROM users WHERE profile_photo_url IS NOT NULL OR profile_image IS NOT NULL OR profile_photo IS NOT NULL"],
    ['booking reconstruction remaining gaps', "SELECT COUNT(*) AS count FROM service_requests WHERE start_date IS NULL OR end_date IS NULL OR booking_type IS NULL OR duration_days IS NULL"],
  ];

  const results = [];
  for (const [name, sql] of checks) {
    try {
      const [rows] = await db.query(sql);
      results.push({ name, ok: true, count: Number(rows[0]?.count || 0) });
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
    }
  }
  return results;
}

async function run() {
  const [databaseRows] = await db.query('SELECT DATABASE() AS database_name, VERSION() AS mysql_version');
  databaseName = databaseRows[0]?.database_name;
  const mysqlVersion = databaseRows[0]?.mysql_version;

  if (!databaseName) throw new Error('No database selected.');

  console.log('SerbisyoToledo production schema reconciliation');
  console.log('Database:', databaseName);
  console.log('MySQL:', mysqlVersion);
  console.log('Mode:', APPLY ? 'APPLY' : 'DRY RUN');

  if (APPLY) {
    if (!CONFIRM_PRODUCTION) {
      throw new Error('Refusing to apply without --confirm-production.');
    }
    if (!BACKUP_CONFIRMED) {
      throw new Error('Refusing to apply until PRODUCTION_DB_BACKUP_CONFIRMED=yes is set after taking a Railway backup/snapshot.');
    }
    if (!EXPECTED_DATABASE_NAME) {
      throw new Error('Refusing to apply without PRODUCTION_DB_EXPECTED_NAME set to the database name printed by the read-only audit.');
    }
    if (EXPECTED_DATABASE_NAME !== databaseName) {
      throw new Error(
        'Refusing to apply: connected database "' + databaseName
        + '" does not match PRODUCTION_DB_EXPECTED_NAME="' + EXPECTED_DATABASE_NAME + '".'
      );
    }
  }

  for (const required of ['users', 'service_profiles', 'service_requests', 'portfolio_items', 'reviews', 'notifications', 'verification_requests', 'user_reports']) {
    if (!(await tableExists(required))) {
      throw new Error('Production reconciliation requires existing legacy table: ' + required);
    }
  }

  await preflightProductionData();
  await reportBookingReconstructionAggregates();
  await ensureCoreColumns();
  await ensureUserProfilePhotoCompatibility();
  await ensureReportsSchema();
  await ensureSupportingTables();
  await ensureIndexes();
  await ensureHistoricalTimestampColumns();
  await backfillTaxonomyAndSkills();
  await reconstructBookingFields();
  await backfillRequestCompatibility();
  await normalizeBookingFieldShapes();
  await ensureStatsView();

  if (!APPLY) {
    console.log('\nPlanned changes (' + plan.length + '):');
    plan.forEach((item, index) => {
      console.log(String(index + 1).padStart(2, '0') + '. ' + item.label);
    });
    console.log('\nDry run only. No database changes were made.');
    console.log('To apply after taking a Railway production backup:');
    console.log('  PRODUCTION_DB_BACKUP_CONFIRMED=yes PRODUCTION_DB_EXPECTED_NAME=' + databaseName + ' node scripts/reconcile-production-schema.js --apply --confirm-production');
    return;
  }

  const verification = await verifyCriticalRuntime();
  console.log('\nApplied changes:', changes.length);
  changes.forEach((change) => console.log(' - ' + change));
  console.log('\nRuntime verification:');
  verification.forEach((result) => {
    console.log(' - ' + result.name + ': ' + (result.ok ? 'OK' : 'FAILED - ' + result.error));
  });

  if (verification.some((result) => !result.ok)) {
    process.exitCode = 2;
  }
}

run()
  .catch((error) => {
    console.error('Production reconciliation failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
