-- Stage 2 Booking Expansion
-- Adds specific-date booking support, request-level pricing unit snapshot, and reschedule duration persistence.

START TRANSACTION;

-- service_requests: pricing snapshot unit and multi-day mode metadata
SET @service_requests_has_pricing_unit_snapshot := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND column_name = 'pricing_unit_snapshot'
);
SET @sql := IF(
  @service_requests_has_pricing_unit_snapshot = 0,
  "ALTER TABLE service_requests ADD COLUMN pricing_unit_snapshot ENUM('per_job', 'per_hour', 'per_day') NULL",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @service_requests_has_multi_day_mode := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND column_name = 'multi_day_mode'
);
SET @sql := IF(
  @service_requests_has_multi_day_mode = 0,
  "ALTER TABLE service_requests ADD COLUMN multi_day_mode ENUM('continuous', 'specific_dates') NOT NULL DEFAULT 'continuous'",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @service_requests_has_requested_dates_count := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND column_name = 'requested_dates_count'
);
SET @sql := IF(
  @service_requests_has_requested_dates_count = 0,
  'ALTER TABLE service_requests ADD COLUMN requested_dates_count INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE service_requests
SET pricing_unit_snapshot = COALESCE(pricing_unit_snapshot, 'per_day')
WHERE pricing_unit_snapshot IS NULL;

SET @service_requests_has_duration_days := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND column_name = 'duration_days'
);
SET @sql := IF(
  @service_requests_has_duration_days = 1,
  'UPDATE service_requests SET requested_dates_count = COALESCE(requested_dates_count, duration_days, 1) WHERE requested_dates_count IS NULL',
  'UPDATE service_requests SET requested_dates_count = COALESCE(requested_dates_count, 1) WHERE requested_dates_count IS NULL'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Explicit scheduled dates table for one-day, continuous, and specific-date bookings
CREATE TABLE IF NOT EXISTS service_request_dates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_request_id INT NOT NULL,
  service_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_request_dates_request
    FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_request_date (service_request_id, service_date),
  INDEX idx_request_dates_date (service_date),
  INDEX idx_request_dates_request (service_request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @service_requests_has_start_date := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND column_name = 'start_date'
);
SET @service_requests_has_end_date := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND column_name = 'end_date'
);
SET @service_requests_has_scheduled_date := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND column_name = 'scheduled_date'
);

SET @sql := IF(
  @service_requests_has_start_date = 1 AND @service_requests_has_end_date = 1 AND @service_requests_has_scheduled_date = 1,
  'INSERT INTO service_request_dates (service_request_id, service_date) SELECT sr.id, d.service_date FROM service_requests sr JOIN (SELECT DATE_ADD(''1970-01-01'', INTERVAL seq DAY) AS service_date, seq FROM (SELECT ones.n + tens.n * 10 + hundreds.n * 100 AS seq FROM (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) ones CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) tens CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) hundreds) s) d ON d.service_date BETWEEN COALESCE(sr.start_date, sr.scheduled_date) AND COALESCE(sr.end_date, sr.scheduled_date) WHERE COALESCE(sr.start_date, sr.scheduled_date) IS NOT NULL AND COALESCE(sr.end_date, sr.scheduled_date) IS NOT NULL AND d.seq <= 365 ON DUPLICATE KEY UPDATE service_date = VALUES(service_date)',
  IF(
    @service_requests_has_start_date = 1 AND @service_requests_has_end_date = 1,
    'INSERT INTO service_request_dates (service_request_id, service_date) SELECT sr.id, d.service_date FROM service_requests sr JOIN (SELECT DATE_ADD(''1970-01-01'', INTERVAL seq DAY) AS service_date, seq FROM (SELECT ones.n + tens.n * 10 + hundreds.n * 100 AS seq FROM (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) ones CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) tens CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) hundreds) s) d ON d.service_date BETWEEN sr.start_date AND sr.end_date WHERE sr.start_date IS NOT NULL AND sr.end_date IS NOT NULL AND d.seq <= 365 ON DUPLICATE KEY UPDATE service_date = VALUES(service_date)',
    IF(
      @service_requests_has_scheduled_date = 1,
      'INSERT INTO service_request_dates (service_request_id, service_date) SELECT sr.id, sr.scheduled_date FROM service_requests sr WHERE sr.scheduled_date IS NOT NULL ON DUPLICATE KEY UPDATE service_date = VALUES(service_date)',
      'SELECT 1'
    )
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- service_request_reschedules: persist proposed duration and specific-date metadata
SET @service_request_reschedules_table_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'service_request_reschedules'
);

SET @reschedules_has_proposed_estimated_duration_minutes := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_request_reschedules'
    AND column_name = 'proposed_estimated_duration_minutes'
);
SET @sql := IF(
  @service_request_reschedules_table_exists = 1 AND @reschedules_has_proposed_estimated_duration_minutes = 0,
  'ALTER TABLE service_request_reschedules ADD COLUMN proposed_estimated_duration_minutes INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @reschedules_has_proposed_multi_day_mode := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_request_reschedules'
    AND column_name = 'proposed_multi_day_mode'
);
SET @sql := IF(
  @service_request_reschedules_table_exists = 1 AND @reschedules_has_proposed_multi_day_mode = 0,
  "ALTER TABLE service_request_reschedules ADD COLUMN proposed_multi_day_mode ENUM('continuous', 'specific_dates') NOT NULL DEFAULT 'continuous'",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @reschedules_has_proposed_specific_dates_json := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_request_reschedules'
    AND column_name = 'proposed_specific_dates_json'
);
SET @sql := IF(
  @service_request_reschedules_table_exists = 1 AND @reschedules_has_proposed_specific_dates_json = 0,
  'ALTER TABLE service_request_reschedules ADD COLUMN proposed_specific_dates_json JSON NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @service_requests_has_estimated_duration_minutes := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND column_name = 'estimated_duration_minutes'
);
SET @sql := IF(
  @service_request_reschedules_table_exists = 1 AND @service_requests_has_estimated_duration_minutes = 1,
  'UPDATE service_request_reschedules srr JOIN service_requests sr ON sr.id = srr.service_request_id SET srr.proposed_estimated_duration_minutes = COALESCE(srr.proposed_estimated_duration_minutes, sr.estimated_duration_minutes, 120) WHERE srr.proposed_estimated_duration_minutes IS NULL',
  IF(
    @service_request_reschedules_table_exists = 1,
    'UPDATE service_request_reschedules SET proposed_estimated_duration_minutes = COALESCE(proposed_estimated_duration_minutes, 120) WHERE proposed_estimated_duration_minutes IS NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE notifications
  MODIFY COLUMN type ENUM(
    'request_received', 'request_accepted', 'request_declined', 'request_cancelled',
    'provider_on_way', 'service_completed', 'discussion_requested', 'discussion_accepted',
    'reschedule_proposed', 'reschedule_accepted', 'reschedule_declined',
    'phone_revealed', 'completion_confirmed', 'review_received',
    'verification_approved', 'verification_rejected'
  ) NOT NULL;

COMMIT;

-- Rollback guidance:
-- DROP TABLE IF EXISTS service_request_dates;
-- ALTER TABLE service_requests
--   DROP COLUMN pricing_unit_snapshot,
--   DROP COLUMN multi_day_mode,
--   DROP COLUMN requested_dates_count;
-- ALTER TABLE service_request_reschedules
--   DROP COLUMN proposed_estimated_duration_minutes,
--   DROP COLUMN proposed_multi_day_mode,
--   DROP COLUMN proposed_specific_dates_json;
