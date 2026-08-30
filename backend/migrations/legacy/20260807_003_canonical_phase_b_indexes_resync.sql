-- Phase B (non-destructive): resync/backfill pass and add canonical indexes.
-- Run after app version that writes canonical fields is deployed.

START TRANSACTION;

-- Re-run backfill to catch rows created between Phase A and app rollout.
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
)
WHERE scheduled_start_at IS NULL;

UPDATE service_requests
SET scheduled_end_at = COALESCE(
  scheduled_end_at,
  CASE
    WHEN scheduled_start_at IS NOT NULL
      THEN DATE_ADD(scheduled_start_at, INTERVAL 120 MINUTE)
    ELSE NULL
  END
)
WHERE scheduled_end_at IS NULL;

UPDATE user_reports
SET
  report_status = CASE
    WHEN status = 'pending' THEN 'pending'
    WHEN status = 'under_review' THEN 'under_review'
    WHEN status = 'dismissed' THEN 'dismissed'
    WHEN status = 'resolved' THEN 'resolved'
    WHEN status = 'banned' THEN 'resolved'
    ELSE COALESCE(report_status, 'pending')
  END,
  action_taken = CASE
    WHEN status = 'banned' THEN 'ban'
    ELSE COALESCE(action_taken, 'none')
  END,
  moderation_notes = COALESCE(moderation_notes, resolution_notes);

UPDATE users
SET last_seen_at = COALESCE(last_seen_at, updated_at)
WHERE last_seen_at IS NULL;

-- Indexes for canonical schedule/report queries
CREATE INDEX idx_service_requests_provider_schedule_status
  ON service_requests(provider_id, status, scheduled_start_at, scheduled_end_at);

CREATE INDEX idx_service_requests_profile_schedule
  ON service_requests(service_profile_id, scheduled_start_at, scheduled_end_at);

CREATE INDEX idx_user_reports_status_action
  ON user_reports(report_status, action_taken, created_at);

COMMIT;
