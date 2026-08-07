-- Refactor migration: canonical scheduling, profile ownership cleanup, report workflow split, and image storage normalization.
-- Apply only after backing up the production database.

START TRANSACTION;

-- 1) Canonical provider pricing model
ALTER TABLE service_profiles
  ADD COLUMN pricing_unit ENUM('per_job', 'per_hour', 'per_day') NOT NULL DEFAULT 'per_day' AFTER starting_price;

-- 2) Canonical schedule timestamps on service requests
ALTER TABLE service_requests
  ADD COLUMN scheduled_start_at DATETIME NULL AFTER start_time,
  ADD COLUMN scheduled_end_at DATETIME NULL AFTER scheduled_start_at;

-- Backfill schedule timestamps from current stage-1 fields first, then legacy fields.
UPDATE service_requests
SET scheduled_start_at = COALESCE(
  scheduled_start_at,
  CASE
    WHEN start_date IS NOT NULL AND start_time IS NOT NULL
      THEN TIMESTAMP(start_date, start_time)
    WHEN scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL
      THEN TIMESTAMP(scheduled_date, COALESCE(STR_TO_DATE(scheduled_time, '%h:%i %p'), STR_TO_DATE(scheduled_time, '%H:%i:%s'), STR_TO_DATE(scheduled_time, '%H:%i')))
    ELSE NULL
  END
);

UPDATE service_requests
SET scheduled_end_at = COALESCE(
  scheduled_end_at,
  CASE
    WHEN booking_type = 'multi_day' AND end_date IS NOT NULL AND start_time IS NOT NULL
      THEN TIMESTAMP(end_date, start_time)
    WHEN scheduled_start_at IS NOT NULL AND estimated_duration_minutes IS NOT NULL
      THEN DATE_ADD(scheduled_start_at, INTERVAL estimated_duration_minutes MINUTE)
    WHEN scheduled_start_at IS NOT NULL
      THEN DATE_ADD(scheduled_start_at, INTERVAL 120 MINUTE)
    ELSE NULL
  END
);

-- 3) Report workflow split: report lifecycle + moderation action
ALTER TABLE user_reports
  ADD COLUMN report_status ENUM('pending', 'under_review', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending' AFTER screenshot_mime,
  ADD COLUMN action_taken ENUM('none', 'warning', 'suspension', 'ban') NOT NULL DEFAULT 'none' AFTER report_status,
  ADD COLUMN moderation_notes TEXT NULL AFTER resolution_notes;

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
ALTER TABLE users
  ADD COLUMN last_seen_at DATETIME NULL AFTER is_online;

UPDATE users
SET last_seen_at = COALESCE(last_seen_at, last_active, updated_at);

-- 5) Image storage normalization to Cloudinary URL/public_id for public assets.
-- Users: move profile_image url into profile_photo_url if missing.
UPDATE users
SET profile_photo_url = COALESCE(profile_photo_url, profile_image)
WHERE profile_image IS NOT NULL;

-- NOTE: service_profiles.banner_image and portfolio_items.image_data are dropped now because public image delivery is URL/public_id based.
-- If your environment still has non-null BLOBs here, restore from backup before this migration.

ALTER TABLE users
  DROP COLUMN profile_image,
  DROP COLUMN profile_photo,
  DROP COLUMN last_active;

ALTER TABLE service_profiles
  DROP COLUMN banner_image,
  DROP COLUMN online,
  DROP COLUMN full_name;

ALTER TABLE portfolio_items
  DROP COLUMN image_data;

ALTER TABLE service_requests
  DROP COLUMN scheduled_date,
  DROP COLUMN scheduled_time;

-- Keep provider marketplace stats in service_profiles as canonical cache fields.
-- Remove duplicated provider-only market fields from users.
ALTER TABLE users
  DROP COLUMN preferred_services,
  DROP COLUMN description,
  DROP COLUMN tags,
  DROP COLUMN starting_price,
  DROP COLUMN rating,
  DROP COLUMN reviews_count,
  DROP COLUMN location;

-- Indexes for conflict and availability queries
CREATE INDEX idx_service_requests_provider_schedule_status
  ON service_requests(provider_id, status, scheduled_start_at, scheduled_end_at);

CREATE INDEX idx_service_requests_profile_schedule
  ON service_requests(service_profile_id, scheduled_start_at, scheduled_end_at);

CREATE INDEX idx_user_reports_status_action
  ON user_reports(report_status, action_taken, created_at);

COMMIT;
