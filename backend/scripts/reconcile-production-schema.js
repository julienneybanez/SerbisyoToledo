const db = require('../config/database');
const {
  normalizeCategoryLabels,
  toCategoryKey,
  getServiceTypesForProfile,
} = require('../config/serviceTaxonomy');

const APPLY = process.argv.includes('--apply');
const CONFIRM_PRODUCTION = process.argv.includes('--confirm-production');
const BACKUP_CONFIRMED = String(process.env.PRODUCTION_DB_BACKUP_CONFIRMED || '').toLowerCase() === 'yes';

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

async function ensureTable(table, ddl) {
  if (await tableExists(table)) return;
  await schedule('create table ' + table, ddl);
}

async function modifyIfNeeded(table, column, targetFragment, ddl) {
  const current = await getColumn(table, column);
  if (!current) return;
  const signature = [current.COLUMN_TYPE, current.IS_NULLABLE, current.COLUMN_DEFAULT].join('|').toLowerCase();
  if (signature.includes(targetFragment.toLowerCase())) return;
  await schedule('modify ' + table + '.' + column, ddl);
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
  const requestColumns = [
    ['service_type_key', 'VARCHAR(120) NULL'],
    ['service_type_label', 'VARCHAR(255) NULL'],
    ['service_location', 'VARCHAR(500) NULL'],
    ['booking_type', "ENUM('one_day','multi_day') NOT NULL DEFAULT 'one_day'"],
    ['start_date', 'DATE NULL'],
    ['end_date', 'DATE NULL'],
    ['start_time', 'TIME NULL'],
    ['estimated_duration_minutes', 'INT NULL'],
    ['duration_days', 'INT NULL'],
    ['multi_day_mode', "ENUM('continuous','specific_dates') NOT NULL DEFAULT 'continuous'"],
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

  await ensureTable('legal_acceptances', `
    CREATE TABLE legal_acceptances (
      id BIGINT NOT NULL AUTO_INCREMENT,
      user_id ${userId} NOT NULL,
      acceptance_type VARCHAR(64) NOT NULL,
      document_version VARCHAR(32) NOT NULL,
      context VARCHAR(64) NOT NULL,
      verification_request_id ${verificationId} NULL,
      accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_legal_acceptance_user_type (user_id, acceptance_type),
      KEY idx_legal_acceptance_verification_request (verification_request_id),
      CONSTRAINT fk_legal_acceptance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_legal_acceptance_verification FOREIGN KEY (verification_request_id) REFERENCES verification_requests(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

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
      responded_by ${userId} NULL,
      responded_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_reschedule_request_status (service_request_id, reschedule_status),
      CONSTRAINT fk_reschedule_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
      CONSTRAINT fk_reschedule_proposed_by FOREIGN KEY (proposed_by) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_reschedule_responded_by FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureColumn('service_request_reschedules', 'proposed_estimated_duration_minutes', 'INT NULL');
  await ensureColumn('service_request_reschedules', 'proposed_multi_day_mode', "ENUM('continuous','specific_dates') NULL");

  const rescheduleId = await idType('service_request_reschedules');
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

  const conversationId = await idType('conversations');
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

async function backfillTaxonomyAndSkills() {
  if (!APPLY) {
    plan.push({ label: 'backfill taxonomy, provider skills, and legacy language sources', sql: '[data backfill]' });
    return;
  }

  const [profiles] = await db.query(
    `SELECT sp.id, sp.user_id, sp.service_categories,
            CASE WHEN EXISTS(
              SELECT 1 FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_profiles' AND COLUMN_NAME = 'service_types'
            ) THEN 1 ELSE 0 END AS ignored
     FROM service_profiles sp`
  );

  for (const row of profiles) {
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

  const [users] = await db.query('SELECT id, skills FROM users');
  for (const user of users) {
    for (const skill of parseJsonArray(user.skills).map((value) => String(value || '').trim()).filter(Boolean)) {
      await db.query(
        'INSERT IGNORE INTO provider_skills (user_id, skill_label) VALUES (?, ?)',
        [user.id, skill]
      );
    }
  }

  if (await tableExists('provider_languages')) {
    await db.query(
      `INSERT IGNORE INTO person_languages (user_id, language_code)
       SELECT sp.user_id, pl.language_code
       FROM provider_languages pl
       JOIN service_profiles sp ON sp.id = pl.service_profile_id`
    );
  }

  const registrationLanguages = await getColumn('users', 'registration_languages');
  if (registrationLanguages) {
    const [rows] = await db.query('SELECT id, registration_languages FROM users WHERE registration_languages IS NOT NULL');
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

  changes.push('backfilled taxonomy, skills, and languages');
}

async function backfillRequestCompatibility() {
  if (!APPLY) {
    plan.push({ label: 'backfill legacy request schedule/pricing/date rows', sql: '[data backfill]' });
    return;
  }

  await db.query(
    `UPDATE service_requests sr
     LEFT JOIN service_profiles sp ON sp.id = sr.service_profile_id
     SET sr.booking_type = COALESCE(sr.booking_type, 'one_day'),
         sr.start_date = COALESCE(sr.start_date, sr.scheduled_date, DATE(sr.scheduled_start_at)),
         sr.end_date = COALESCE(sr.end_date, sr.scheduled_date, DATE(sr.scheduled_end_at), DATE(sr.scheduled_start_at)),
         sr.estimated_duration_minutes = COALESCE(
           sr.estimated_duration_minutes,
           TIMESTAMPDIFF(MINUTE, sr.scheduled_start_at, sr.scheduled_end_at),
           120
         ),
         sr.duration_days = COALESCE(sr.duration_days, 1),
         sr.multi_day_mode = COALESCE(sr.multi_day_mode, 'continuous'),
         sr.pricing_unit_snapshot = COALESCE(sr.pricing_unit_snapshot, 'per_day'),
         sr.daily_rate_snapshot = COALESCE(sr.daily_rate_snapshot, sp.starting_price, 0),
         sr.estimated_total = COALESCE(sr.estimated_total, COALESCE(sr.daily_rate_snapshot, sp.starting_price, 0) * COALESCE(sr.duration_days, 1))
     WHERE sr.start_date IS NULL
        OR sr.end_date IS NULL
        OR sr.estimated_duration_minutes IS NULL
        OR sr.daily_rate_snapshot IS NULL`
  );

  await db.query(
    `INSERT IGNORE INTO service_request_dates (service_request_id, service_date)
     SELECT id, COALESCE(start_date, scheduled_date, DATE(scheduled_start_at))
     FROM service_requests
     WHERE COALESCE(start_date, scheduled_date, DATE(scheduled_start_at)) IS NOT NULL`
  );

  await db.query(
    `INSERT INTO service_request_status_history
       (service_request_id, from_status, to_status, changed_by, record_source, created_at)
     SELECT sr.id, NULL, sr.status, NULL, 'seeded', sr.created_at
     FROM service_requests sr
     LEFT JOIN service_request_status_history h ON h.service_request_id = sr.id
     WHERE h.id IS NULL`
  );

  changes.push('backfilled legacy request compatibility data');
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
  }

  for (const required of ['users', 'service_profiles', 'service_requests', 'portfolio_items', 'reviews', 'notifications', 'verification_requests']) {
    if (!(await tableExists(required))) {
      throw new Error('Production reconciliation requires existing legacy table: ' + required);
    }
  }

  await ensureCoreColumns();
  await ensureSupportingTables();
  await ensureIndexes();
  await backfillTaxonomyAndSkills();
  await backfillRequestCompatibility();
  await ensureStatsView();

  if (!APPLY) {
    console.log('\nPlanned changes (' + plan.length + '):');
    plan.forEach((item, index) => {
      console.log(String(index + 1).padStart(2, '0') + '. ' + item.label);
    });
    console.log('\nDry run only. No database changes were made.');
    console.log('To apply after taking a Railway production backup:');
    console.log('  PRODUCTION_DB_BACKUP_CONFIRMED=yes node scripts/reconcile-production-schema.js --apply --confirm-production');
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
