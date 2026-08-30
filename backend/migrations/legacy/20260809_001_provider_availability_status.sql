-- SerbisyoToledo
-- Keep source-controlled migration history aligned with the Railway database.
-- This migration is intentionally idempotent because these columns may already
-- have been added manually in Railway before this migration is run.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'provider_availability_settings'
      AND COLUMN_NAME = 'availability_status'
  ),
  'SELECT 1',
  'ALTER TABLE provider_availability_settings ADD COLUMN availability_status VARCHAR(255) NOT NULL DEFAULT ''available'' AFTER max_advance_booking_days'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'provider_availability_settings'
      AND COLUMN_NAME = 'show_availability_status'
  ),
  'SELECT 1',
  'ALTER TABLE provider_availability_settings ADD COLUMN show_availability_status BOOLEAN NOT NULL DEFAULT TRUE AFTER availability_status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
