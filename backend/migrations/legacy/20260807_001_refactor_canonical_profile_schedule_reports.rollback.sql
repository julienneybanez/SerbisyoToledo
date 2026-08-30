-- Rollback for 20260807_001_refactor_canonical_profile_schedule_reports.sql
-- This rollback restores dropped columns but cannot restore dropped data without backups.

START TRANSACTION;

-- Restore removed columns (data will be NULL/default unless recovered from backup)
ALTER TABLE users
  ADD COLUMN profile_image VARCHAR(500) NULL AFTER registration_languages,
  ADD COLUMN profile_photo LONGBLOB NULL AFTER profile_photo_public_id,
  ADD COLUMN last_active TIMESTAMP NULL DEFAULT NULL AFTER is_online,
  ADD COLUMN preferred_services VARCHAR(255) NULL AFTER user_type,
  ADD COLUMN description TEXT NULL AFTER location,
  ADD COLUMN tags JSON NULL AFTER description,
  ADD COLUMN starting_price DECIMAL(10,2) NULL AFTER tags,
  ADD COLUMN rating DECIMAL(2,1) DEFAULT 0.0 AFTER starting_price,
  ADD COLUMN reviews_count INT DEFAULT 0 AFTER rating,
  ADD COLUMN location VARCHAR(255) NULL AFTER updated_at;

ALTER TABLE service_profiles
  ADD COLUMN banner_image LONGBLOB NULL AFTER service_categories,
  ADD COLUMN online BOOLEAN DEFAULT FALSE AFTER reviews_count,
  ADD COLUMN full_name VARCHAR(255) NOT NULL DEFAULT '' AFTER user_id;

ALTER TABLE portfolio_items
  ADD COLUMN image_data LONGBLOB NULL AFTER image_public_id;

ALTER TABLE service_requests
  ADD COLUMN scheduled_date DATE NULL AFTER job_details,
  ADD COLUMN scheduled_time VARCHAR(50) NULL AFTER scheduled_date;

ALTER TABLE user_reports
  DROP COLUMN moderation_notes,
  DROP COLUMN action_taken,
  DROP COLUMN report_status;

ALTER TABLE users
  DROP COLUMN last_seen_at;

ALTER TABLE service_requests
  DROP COLUMN scheduled_start_at,
  DROP COLUMN scheduled_end_at;

ALTER TABLE service_profiles
  DROP COLUMN pricing_unit;

DROP INDEX idx_service_requests_provider_schedule_status ON service_requests;
DROP INDEX idx_service_requests_profile_schedule ON service_requests;
DROP INDEX idx_user_reports_status_action ON user_reports;

COMMIT;
