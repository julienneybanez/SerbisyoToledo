-- Migration: Add normalized service type fields for provider profiles and service requests.
-- Additive only. No destructive changes.

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_profiles'
    AND column_name = 'service_types'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE service_profiles ADD COLUMN service_types JSON NULL AFTER service_categories',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND column_name = 'service_type_key'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE service_requests ADD COLUMN service_type_key VARCHAR(120) NULL AFTER service_profile_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND column_name = 'service_type_label'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE service_requests ADD COLUMN service_type_label VARCHAR(255) NULL AFTER service_type_key',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND index_name = 'idx_service_requests_service_type_key'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_service_requests_service_type_key ON service_requests (service_type_key)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'service_requests'
    AND index_name = 'idx_service_requests_client_service_type_status'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_service_requests_client_service_type_status ON service_requests (client_id, service_type_key, status)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Rollback guidance (manual, only when confirmed safe):
-- DROP INDEX idx_service_requests_client_service_type_status ON service_requests;
-- DROP INDEX idx_service_requests_service_type_key ON service_requests;
-- ALTER TABLE service_requests DROP COLUMN service_type_label, DROP COLUMN service_type_key;
-- ALTER TABLE service_profiles DROP COLUMN service_types;
