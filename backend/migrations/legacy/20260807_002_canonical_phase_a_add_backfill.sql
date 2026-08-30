-- Phase A (non-destructive): add canonical columns and backfill from legacy fields.
-- Safe for first production rollout before code fully switches.

START TRANSACTION;

-- 1) Canonical provider pricing model
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_profiles'
    AND column_name = 'pricing_unit'
);
SET @sql = IF(
  @col_exists = 0,
  "ALTER TABLE service_profiles ADD COLUMN pricing_unit ENUM('per_job', 'per_hour', 'per_day') NOT NULL DEFAULT 'per_day' AFTER starting_price",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Canonical schedule timestamps on service requests
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND column_name = 'scheduled_start_at'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE service_requests ADD COLUMN scheduled_start_at DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND column_name = 'scheduled_end_at'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE service_requests ADD COLUMN scheduled_end_at DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill schedule timestamps from legacy scheduled_date/scheduled_time fields.
UPDATE service_requests
SET scheduled_start_at = COALESCE(
  scheduled_start_at,
  CASE
    WHEN scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL
      THEN TIMESTAMP(
        scheduled_date,
        COALESCE(
          STR_TO_DATE(scheduled_time, '%h:%i %p'),
          STR_TO_DATE(scheduled_time, '%H:%i:%s'),
          STR_TO_DATE(scheduled_time, '%H:%i')
        )
      )
    ELSE NULL
  END
);

UPDATE service_requests
SET scheduled_end_at = COALESCE(
  scheduled_end_at,
  CASE
    WHEN scheduled_start_at IS NOT NULL
      THEN DATE_ADD(scheduled_start_at, INTERVAL 120 MINUTE)
    ELSE NULL
  END
);

-- 3) Report lifecycle and moderation action split
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'user_reports'
    AND column_name = 'report_status'
);
SET @sql = IF(
  @col_exists = 0,
  "ALTER TABLE user_reports ADD COLUMN report_status ENUM('pending', 'under_review', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending' AFTER screenshot_mime",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'user_reports'
    AND column_name = 'action_taken'
);
SET @sql = IF(
  @col_exists = 0,
  "ALTER TABLE user_reports ADD COLUMN action_taken ENUM('none', 'warning', 'suspension', 'ban') NOT NULL DEFAULT 'none' AFTER report_status",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'user_reports'
    AND column_name = 'moderation_notes'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE user_reports ADD COLUMN moderation_notes TEXT NULL AFTER resolution_notes',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE user_reports
SET
  report_status = CASE
    WHEN status = 'pending' THEN 'pending'
    WHEN status = 'under_review' THEN 'under_review'
    WHEN status = 'dismissed' THEN 'dismissed'
    WHEN status = 'resolved' THEN 'resolved'
    WHEN status = 'banned' THEN 'resolved'
    ELSE 'pending'
  END,
  action_taken = CASE
    WHEN status = 'banned' THEN 'ban'
    ELSE 'none'
  END,
  moderation_notes = COALESCE(moderation_notes, resolution_notes);

-- 4) Presence normalization
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'last_seen_at'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE users ADD COLUMN last_seen_at DATETIME NULL AFTER is_online',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE users
SET last_seen_at = COALESCE(last_seen_at, last_active, updated_at);

COMMIT;
