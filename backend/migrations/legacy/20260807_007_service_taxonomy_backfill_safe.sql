-- Migration: Add taxonomy review flag for conservative legacy migration workflow.
-- Additive only.

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'service_profiles'
    AND column_name = 'taxonomy_needs_review'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE service_profiles ADD COLUMN taxonomy_needs_review BOOLEAN NOT NULL DEFAULT FALSE AFTER service_types',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'service_profiles'
    AND index_name = 'idx_service_profiles_taxonomy_needs_review'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_service_profiles_taxonomy_needs_review ON service_profiles (taxonomy_needs_review)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Rollback guidance (manual, only when safe):
-- DROP INDEX idx_service_profiles_taxonomy_needs_review ON service_profiles;
-- ALTER TABLE service_profiles DROP COLUMN taxonomy_needs_review;
