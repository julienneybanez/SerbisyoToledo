-- Stage 1 Migration 001
-- Adds booking date-range and pricing snapshot fields while keeping legacy scheduled_date/scheduled_time columns.
-- Apply manually; do not run automatically on production.

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS booking_type ENUM('one_day', 'multi_day') NOT NULL DEFAULT 'one_day' AFTER job_details,
  ADD COLUMN IF NOT EXISTS start_date DATE NULL AFTER booking_type,
  ADD COLUMN IF NOT EXISTS end_date DATE NULL AFTER start_date,
  ADD COLUMN IF NOT EXISTS start_time TIME NULL AFTER end_date,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INT NULL AFTER start_time,
  ADD COLUMN IF NOT EXISTS duration_days INT NULL AFTER estimated_duration_minutes,
  ADD COLUMN IF NOT EXISTS daily_rate_snapshot DECIMAL(10,2) NULL AFTER duration_days,
  ADD COLUMN IF NOT EXISTS estimated_total DECIMAL(10,2) NULL AFTER daily_rate_snapshot,
  ADD COLUMN IF NOT EXISTS cancelled_by INT NULL AFTER client_completed,
  ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(120) NULL AFTER cancelled_by,
  ADD COLUMN IF NOT EXISTS cancellation_reason_other TEXT NULL AFTER cancellation_reason,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP NULL DEFAULT NULL AFTER cancellation_reason_other;

-- Backfill legacy rows where possible.
UPDATE service_requests
SET
  booking_type = COALESCE(booking_type, 'one_day'),
  start_date = COALESCE(start_date, scheduled_date),
  end_date = COALESCE(end_date, scheduled_date),
  duration_days = COALESCE(duration_days, 1)
WHERE start_date IS NULL OR end_date IS NULL OR duration_days IS NULL;

-- Foreign key for cancelled_by is optional and added only once.
SET @cancelled_by_fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_service_requests_cancelled_by'
);

SET @cancelled_by_fk_sql := IF(
  @cancelled_by_fk_exists = 0,
  'ALTER TABLE service_requests ADD CONSTRAINT fk_service_requests_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT "fk_service_requests_cancelled_by already exists"'
);

PREPARE cancelled_by_fk_stmt FROM @cancelled_by_fk_sql;
EXECUTE cancelled_by_fk_stmt;
DEALLOCATE PREPARE cancelled_by_fk_stmt;

-- Indexes for date-range conflict checks.
CREATE INDEX IF NOT EXISTS idx_service_requests_provider_date_range ON service_requests (provider_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_service_requests_status_date_range ON service_requests (status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_service_requests_profile_job ON service_requests (service_profile_id, job_title(100));

-- Rollback guidance (manual and only after verifying dependent code):
-- ALTER TABLE service_requests
--   DROP FOREIGN KEY fk_service_requests_cancelled_by,
--   DROP COLUMN booking_type,
--   DROP COLUMN start_date,
--   DROP COLUMN end_date,
--   DROP COLUMN start_time,
--   DROP COLUMN estimated_duration_minutes,
--   DROP COLUMN duration_days,
--   DROP COLUMN daily_rate_snapshot,
--   DROP COLUMN estimated_total,
--   DROP COLUMN cancelled_by,
--   DROP COLUMN cancellation_reason,
--   DROP COLUMN cancellation_reason_other,
--   DROP COLUMN cancelled_at;
