const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const REQUIRED_TABLES = [
  'users',
  'service_profiles',
  'person_languages',
  'service_profile_categories',
  'service_profile_types',
  'provider_skills',
  'provider_availability_settings',
  'provider_available_slots',
  'provider_availability_blackouts',
  'provider_credentials',
  'verification_requests',
  'legal_acceptances',
  'service_requests',
  'service_request_dates',
  'service_request_reschedules',
  'service_request_reschedule_dates',
  'service_request_status_history',
  'conversations',
  'messages',
  'service_request_contact_shares',
  'service_request_archives',
  'portfolio_items',
  'reviews',
  'notifications',
  'user_reports',
];

const REQUIRED_COLUMNS = {
  users: [
    // 'skills' is intentionally excluded: it is a one-time legacy source that
    // reconcile-production-schema.js reads only if present on historical
    // Railway production (see backfillTaxonomyAndSkills). It is not part of
    // the canonical baseline and no active controller reads/writes it.
    'id', 'full_name', 'email', 'user_type', 'profession',
    'profile_image', 'profile_photo', 'profile_photo_url', 'profile_photo_public_id',
    'phone', 'address', 'bio', 'is_verified', 'is_active', 'last_seen_at', 'email_verified',
  ],
  service_profiles: [
    'id', 'user_id', 'barangay_address', 'starting_price', 'description',
    'about_me', 'response_time', 'banner_image_url', 'banner_image_public_id',
    'is_published', 'taxonomy_needs_review',
  ],
  service_requests: [
    'id', 'client_id', 'provider_id', 'service_profile_id',
    'service_type_key', 'service_type_label', 'job_details', 'service_location',
    'booking_type', 'start_date', 'end_date', 'start_time',
    'estimated_duration_minutes', 'duration_days', 'multi_day_mode',
    'pricing_unit_snapshot', 'daily_rate_snapshot', 'estimated_total',
    'status', 'decline_reason', 'cancelled_by', 'cancellation_reason',
    'cancellation_reason_other', 'cancelled_at',
    'provider_completed', 'provider_completed_at',
    'client_completed', 'client_completed_at', 'created_at', 'updated_at',
  ],
  portfolio_items: [
    'id', 'service_request_id', 'image_url', 'image_public_id',
    'caption', 'is_published', 'is_featured', 'display_order', 'created_at', 'updated_at',
  ],
  reviews: ['id', 'service_request_id', 'rating', 'comment', 'created_at'],
  notifications: ['id', 'user_id', 'type', 'title', 'message', 'related_request_id', 'is_read', 'created_at'],
  verification_requests: [
    'id', 'user_id', 'status', 'is_active_pending', 'rejection_reason', 'admin_notes',
    'reviewed_by', 'reviewed_at', 'certifications_data', 'certifications_mime',
  ],
  service_request_contact_shares: [
    'id', 'service_request_id', 'requester_user_id', 'owner_user_id',
    'contact_type', 'status', 'requested_at', 'responded_at', 'updated_at',
  ],
  provider_availability_settings: [
    'id', 'service_profile_id', 'allow_same_day_booking',
    'min_advance_notice_minutes', 'max_advance_booking_days',
    'availability_status', 'show_availability_status',
  ],
  provider_available_slots: [
    'id', 'service_profile_id', 'available_date', 'start_time', 'end_time',
  ],
  provider_availability_blackouts: [
    'id', 'service_profile_id', 'blackout_date', 'start_time', 'end_time', 'reason',
  ],
  provider_credentials: [
    'id', 'service_profile_id', 'credential_name', 'credential_type',
    'issuing_organization', 'credential_id', 'issue_date', 'expiration_date',
    'does_not_expire', 'credential_url', 'related_skills', 'document_url',
    'document_public_id', 'verification_status', 'verification_notes',
    'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
  ],
  legal_acceptances: [
    'id', 'user_id', 'acceptance_type', 'document_version', 'context',
    'verification_request_id', 'verification_request_key', 'accepted_at', 'created_at',
  ],
  service_request_dates: ['id', 'service_request_id', 'service_date', 'created_at'],
  service_request_reschedules: [
    'id', 'service_request_id', 'original_start_date', 'original_end_date',
    'original_start_time', 'proposed_start_date', 'proposed_end_date',
    'proposed_start_time', 'proposed_estimated_duration_minutes',
    'proposed_multi_day_mode', 'proposed_by', 'reschedule_reason',
    'reschedule_status', 'pending_marker', 'responded_by', 'responded_at', 'created_at', 'updated_at',
  ],
  service_request_reschedule_dates: ['id', 'reschedule_id', 'proposed_date', 'created_at'],
  service_request_status_history: [
    'id', 'service_request_id', 'from_status', 'to_status',
    'changed_by', 'reason', 'record_source', 'created_at',
  ],
  conversations: ['id', 'service_request_id', 'created_at', 'updated_at'],
  messages: ['id', 'conversation_id', 'sender_id', 'message_text', 'read_at', 'created_at'],
  service_request_archives: ['service_request_id', 'user_id', 'archived_at'],
  // Canonical Admin Reports contract. Legacy-only fields (report_status,
  // action_taken, priority, resolution_notes, moderation_notes,
  // screenshot_data, screenshot_mime, handled_at) may still exist in
  // production as preserved compatibility data but are not required here
  // because active code no longer reads or writes them.
  user_reports: [
    'id', 'request_id', 'reporter_id', 'reported_user_id', 'reason', 'description',
    'status', 'resolution', 'screenshot_url', 'handled_by', 'created_at', 'updated_at',
  ],
};

const CANONICAL_REPORT_STATUSES = ['pending', 'investigating', 'resolved', 'dismissed'];

const REQUIRED_VIEWS = ['service_profile_stats'];

const toObjectMap = (rows, key) => rows.reduce((map, row) => {
  const value = row[key];
  if (!map[value]) map[value] = [];
  map[value].push(row);
  return map;
}, {});

async function run() {
  const [databaseRows] = await db.query('SELECT DATABASE() AS database_name, VERSION() AS mysql_version');
  const databaseName = databaseRows[0]?.database_name || null;
  const mysqlVersion = databaseRows[0]?.mysql_version || null;

  if (!databaseName) {
    throw new Error('No database is selected.');
  }

  const [tables] = await db.query(
    `SELECT TABLE_NAME, TABLE_TYPE
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME`,
    [databaseName]
  );

  const [columns] = await db.query(
    `SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, COLUMN_TYPE, DATA_TYPE,
            IS_NULLABLE, COLUMN_DEFAULT, EXTRA
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [databaseName]
  );

  const [indexes] = await db.query(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
    [databaseName]
  );

  const [foreignKeys] = await db.query(
    `SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME,
            REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`,
    [databaseName]
  );

  const [rowCountsRaw] = await db.query(
    `SELECT TABLE_NAME, TABLE_ROWS
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [databaseName]
  );

  const tableNames = new Set(tables.filter((row) => row.TABLE_TYPE === 'BASE TABLE').map((row) => row.TABLE_NAME));
  const viewNames = new Set(tables.filter((row) => row.TABLE_TYPE === 'VIEW').map((row) => row.TABLE_NAME));
  const columnsByTable = toObjectMap(columns, 'TABLE_NAME');

  const missingTables = REQUIRED_TABLES.filter((table) => !tableNames.has(table));
  const missingViews = REQUIRED_VIEWS.filter((view) => !viewNames.has(view));
  const missingColumns = [];

  for (const [table, expected] of Object.entries(REQUIRED_COLUMNS)) {
    const actual = new Set((columnsByTable[table] || []).map((row) => row.COLUMN_NAME));
    for (const column of expected) {
      if (!actual.has(column)) missingColumns.push({ table, column });
    }
  }

  // Column-existence checks above cannot detect a wrong ENUM domain or
  // incompatible stored data shape, so check those separately.
  const incompatibleShapes = [];

  const reportStatusColumn = (columnsByTable.user_reports || []).find((row) => row.COLUMN_NAME === 'status');
  if (reportStatusColumn) {
    const enumMatch = /^enum\((.*)\)$/i.exec(String(reportStatusColumn.COLUMN_TYPE || '').trim());
    const enumValues = enumMatch
      ? enumMatch[1].split(',').map((value) => value.trim().replace(/^'|'$/g, ''))
      : [];
    const missingStatuses = CANONICAL_REPORT_STATUSES.filter((value) => !enumValues.includes(value));
    if (missingStatuses.length > 0 || reportStatusColumn.IS_NULLABLE === 'YES') {
      incompatibleShapes.push({
        table: 'user_reports',
        column: 'status',
        issue: 'enum is missing canonical lifecycle value(s) or the column allows NULL',
        blocking: true,
        details: { columnType: reportStatusColumn.COLUMN_TYPE, nullable: reportStatusColumn.IS_NULLABLE, missingStatuses },
      });
    }
  }

  const hasProfilePhotoUrl = (columnsByTable.users || []).some((row) => row.COLUMN_NAME === 'profile_photo_url');
  if (hasProfilePhotoUrl) {
    const [badPhotoUrlRows] = await db.query(
      `SELECT COUNT(*) AS count FROM users
        WHERE profile_photo_url IS NOT NULL
          AND profile_photo_url NOT LIKE 'http://%'
          AND profile_photo_url NOT LIKE 'https://%'
          AND profile_photo_url NOT LIKE 'data:image/%'`
    );
    const badCount = Number(badPhotoUrlRows[0]?.count || 0);
    if (badCount > 0) {
      incompatibleShapes.push({
        table: 'users',
        column: 'profile_photo_url',
        issue: 'contains value(s) that are not HTTP(S)/data-URL image references',
        blocking: false,
        details: { count: badCount },
      });
    }

    const [orphanPublicIdRows] = await db.query(
      `SELECT COUNT(*) AS count FROM users
        WHERE profile_photo_public_id IS NOT NULL AND profile_photo_url IS NULL`
    );
    const orphanCount = Number(orphanPublicIdRows[0]?.count || 0);
    if (orphanCount > 0) {
      incompatibleShapes.push({
        table: 'users',
        column: 'profile_photo_public_id',
        issue: 'set without a corresponding profile_photo_url',
        blocking: false,
        details: { count: orphanCount },
      });
    }
  }

  const blockingShapeIssues = incompatibleShapes.filter((issue) => issue.blocking);

  const report = {
    generatedAt: new Date().toISOString(),
    database: databaseName,
    mysqlVersion,
    compatible: missingTables.length === 0 && missingColumns.length === 0 && missingViews.length === 0 && blockingShapeIssues.length === 0,
    missingTables,
    missingColumns,
    missingViews,
    incompatibleShapes,
    tables,
    columns,
    indexes,
    foreignKeys,
    estimatedRowCounts: rowCountsRaw,
  };

  const outputArgIndex = process.argv.indexOf('--write');
  if (outputArgIndex >= 0) {
    const supplied = process.argv[outputArgIndex + 1];
    if (!supplied) throw new Error('--write requires an output path.');
    const outputPath = path.resolve(process.cwd(), supplied);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`Schema audit written to ${outputPath}`);
  }

  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    database: report.database,
    mysqlVersion: report.mysqlVersion,
    compatible: report.compatible,
    missingTables: report.missingTables,
    missingColumns: report.missingColumns,
    missingViews: report.missingViews,
    incompatibleShapes: report.incompatibleShapes,
  }, null, 2));

  if (!report.compatible) {
    process.exitCode = 2;
  }
}

run()
  .catch((error) => {
    console.error('Runtime schema audit failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
