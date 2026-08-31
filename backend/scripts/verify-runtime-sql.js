const db = require('../config/database');

const CHECKS = [
  {
    name: 'Messages conversation list SQL',
    sql: `SELECT c.id, c.service_request_id, c.updated_at,
                 sr.status AS request_status,
                 sr.service_type_label,
                 CASE WHEN sr.client_id = 1 THEN provider.full_name ELSE client.full_name END AS other_user_name,
                 CASE WHEN sr.client_id = 1
                      THEN COALESCE(provider.profile_photo_url, provider.profile_image)
                      ELSE COALESCE(client.profile_photo_url, client.profile_image)
                 END AS other_user_photo,
                 (SELECT m.message_text
                    FROM messages m
                   WHERE m.conversation_id = c.id
                   ORDER BY m.id DESC LIMIT 1) AS last_message
            FROM conversations c
            JOIN service_requests sr ON sr.id = c.service_request_id
            JOIN users client ON client.id = sr.client_id
            JOIN users provider ON provider.id = sr.provider_id
           WHERE sr.client_id = 1 OR sr.provider_id = 1`,
  },
  {
    name: 'Provider Profile / completed portfolio SQL',
    sql: `SELECT pi.id, pi.image_url, pi.caption, pi.display_order,
                 pi.is_published, pi.is_featured,
                 sr.id AS service_request_id, sr.service_type_key, sr.service_type_label
            FROM portfolio_items pi
            JOIN service_requests sr ON sr.id = pi.service_request_id
           WHERE sr.provider_id = 1
           ORDER BY pi.display_order`,
  },
  {
    name: 'Browse Services / public provider SQL',
    sql: `SELECT sp.id, sp.user_id, sp.barangay_address, sp.starting_price,
                 sp.taxonomy_needs_review, sp.is_published,
                 u.full_name, u.is_verified, u.is_active,
                 stats.rating, stats.reviews_count, stats.jobs_completed,
                 COALESCE(pas.availability_status, 'available') AS availability_status
            FROM service_profiles sp
            JOIN users u ON u.id = sp.user_id
            LEFT JOIN service_profile_stats stats ON stats.service_profile_id = sp.id
            LEFT JOIN provider_availability_settings pas ON pas.service_profile_id = sp.id
           WHERE sp.is_published = TRUE
             AND u.is_verified = TRUE
             AND u.is_active = TRUE
             AND EXISTS (
               SELECT 1 FROM service_profile_categories spc
                WHERE spc.service_profile_id = sp.id
             )
             AND EXISTS (
               SELECT 1 FROM service_profile_types spt
                WHERE spt.service_profile_id = sp.id
             )`,
  },
  {
    name: 'Provider languages and skills SQL',
    sql: `SELECT sp.id,
                 (SELECT COUNT(*) FROM person_languages pl WHERE pl.user_id = sp.user_id) AS language_count,
                 (SELECT COUNT(*) FROM provider_skills ps WHERE ps.user_id = sp.user_id) AS skill_count
            FROM service_profiles sp`,
  },
  {
    name: 'Availability SQL',
    sql: `SELECT sp.id, pas.availability_status,
                 av.available_date, av.start_time, av.end_time,
                 b.blackout_date
            FROM service_profiles sp
            LEFT JOIN provider_availability_settings pas ON pas.service_profile_id = sp.id
            LEFT JOIN provider_available_slots av ON av.service_profile_id = sp.id
            LEFT JOIN provider_availability_blackouts b ON b.service_profile_id = sp.id`,
  },
  {
    name: 'Credential SQL',
    sql: `SELECT pc.id, pc.credential_name, pc.credential_type,
                 pc.issuing_organization, pc.related_skills,
                 pc.document_url, pc.document_public_id,
                 pc.verification_status, pc.verification_notes
            FROM provider_credentials pc
           WHERE pc.service_profile_id = 1`,
  },
  {
    name: 'Booking/reschedule SQL',
    sql: `SELECT sr.id, sr.service_type_key, sr.service_type_label,
                 sr.service_location, sr.booking_type,
                 sr.start_date, sr.end_date, sr.start_time,
                 sr.estimated_duration_minutes, sr.duration_days,
                 sr.multi_day_mode, sr.pricing_unit_snapshot,
                 sr.daily_rate_snapshot, sr.estimated_total,
                 d.service_date,
                 rr.proposed_start_date, rr.proposed_end_date,
                 rr.proposed_start_time, rr.proposed_estimated_duration_minutes,
                 rr.proposed_multi_day_mode
            FROM service_requests sr
            LEFT JOIN service_request_dates d ON d.service_request_id = sr.id
            LEFT JOIN service_request_reschedules rr ON rr.service_request_id = sr.id`,
  },
];

async function checkCompatibilityColumns() {
  const checks = [
    ['service_profiles', 'full_name', true],
    ['service_profiles', 'service_categories', true],
    ['service_requests', 'job_title', true],
    ['service_requests', 'scheduled_date', true],
    ['service_requests', 'scheduled_time', true],
    ['portfolio_items', 'service_profile_id', true],
    ['portfolio_items', 'caption', true],
    ['reviews', 'service_profile_id', true],
    ['reviews', 'client_id', true],
  ];

  const results = [];
  for (const [table, column, shouldBeNullable] of checks) {
    const [rows] = await db.query(
      `SELECT IS_NULLABLE, COLUMN_TYPE
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1`,
      [table, column]
    );

    if (rows.length === 0) {
      results.push({ name: table + '.' + column, ok: true, note: 'legacy column absent' });
      continue;
    }

    const nullable = rows[0].IS_NULLABLE === 'YES';
    results.push({
      name: table + '.' + column,
      ok: shouldBeNullable ? nullable : true,
      note: rows[0].COLUMN_TYPE + ', nullable=' + rows[0].IS_NULLABLE,
    });
  }

  const [notificationTypeRows] = await db.query(
    `SELECT DATA_TYPE, COLUMN_TYPE
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'notifications'
        AND COLUMN_NAME = 'type'
      LIMIT 1`
  );

  if (notificationTypeRows.length) {
    results.push({
      name: 'notifications.type',
      ok: String(notificationTypeRows[0].DATA_TYPE).toLowerCase() !== 'enum',
      note: notificationTypeRows[0].COLUMN_TYPE,
    });
  }

  return results;
}

async function run() {
  const [databaseRows] = await db.query('SELECT DATABASE() AS database_name, VERSION() AS mysql_version');
  console.log('Runtime SQL verification target:', databaseRows[0]?.database_name);
  console.log('MySQL:', databaseRows[0]?.mysql_version);

  const results = [];

  for (const check of CHECKS) {
    try {
      await db.query('EXPLAIN ' + check.sql);
      results.push({ name: check.name, ok: true });
    } catch (error) {
      results.push({ name: check.name, ok: false, error: error.message });
    }
  }

  results.push(...await checkCompatibilityColumns());

  console.log('\nResults:');
  for (const result of results) {
    console.log(
      (result.ok ? '✅ ' : '❌ ') + result.name
      + (result.note ? ' — ' + result.note : '')
      + (result.error ? ' — ' + result.error : '')
    );
  }

  if (results.some((result) => !result.ok)) {
    process.exitCode = 2;
  }
}

run()
  .catch((error) => {
    console.error('Runtime SQL verification failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
