-- Stage 1 Migration 005
-- Links portfolio entries to completed requests and adds normalized provider languages.

ALTER TABLE portfolio_items
  ADD COLUMN IF NOT EXISTS service_request_id INT NULL AFTER service_profile_id,
  ADD COLUMN IF NOT EXISTS job_title VARCHAR(255) NULL AFTER service_request_id,
  ADD COLUMN IF NOT EXISTS job_description TEXT NULL AFTER job_title,
  ADD COLUMN IF NOT EXISTS service_category VARCHAR(120) NULL AFTER job_description,
  ADD COLUMN IF NOT EXISTS completed_at DATETIME NULL AFTER service_category,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE AFTER completed_at,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE AFTER is_published,
  ADD COLUMN IF NOT EXISTS completed_through_platform BOOLEAN NOT NULL DEFAULT FALSE AFTER is_featured,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

SET @portfolio_request_fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_portfolio_items_service_request'
);

SET @portfolio_request_fk_sql := IF(
  @portfolio_request_fk_exists = 0,
  'ALTER TABLE portfolio_items ADD CONSTRAINT fk_portfolio_items_service_request FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE SET NULL',
  'SELECT "fk_portfolio_items_service_request already exists"'
);

PREPARE portfolio_request_fk_stmt FROM @portfolio_request_fk_sql;
EXECUTE portfolio_request_fk_stmt;
DEALLOCATE PREPARE portfolio_request_fk_stmt;

CREATE INDEX IF NOT EXISTS idx_portfolio_items_profile_published ON portfolio_items (service_profile_id, is_published, display_order);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_featured ON portfolio_items (service_profile_id, is_featured);

CREATE TABLE IF NOT EXISTS provider_languages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  service_profile_id INT NOT NULL,
  language_code ENUM('ceb', 'en', 'fil') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_provider_languages_profile
    FOREIGN KEY (service_profile_id) REFERENCES service_profiles(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_provider_language (service_profile_id, language_code),
  INDEX idx_provider_languages_profile (service_profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback guidance:
-- DROP TABLE IF EXISTS provider_languages;
-- ALTER TABLE portfolio_items
--   DROP FOREIGN KEY fk_portfolio_items_service_request,
--   DROP COLUMN service_request_id,
--   DROP COLUMN job_title,
--   DROP COLUMN job_description,
--   DROP COLUMN service_category,
--   DROP COLUMN completed_at,
--   DROP COLUMN is_published,
--   DROP COLUMN is_featured,
--   DROP COLUMN completed_through_platform,
--   DROP COLUMN updated_at;
