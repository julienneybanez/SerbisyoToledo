-- Rollback for Phase A.
-- Removes newly introduced canonical columns.

START TRANSACTION;

ALTER TABLE users
  DROP COLUMN last_seen_at;

ALTER TABLE user_reports
  DROP COLUMN moderation_notes,
  DROP COLUMN action_taken,
  DROP COLUMN report_status;

ALTER TABLE service_requests
  DROP COLUMN scheduled_start_at,
  DROP COLUMN scheduled_end_at;

ALTER TABLE service_profiles
  DROP COLUMN pricing_unit;

COMMIT;
