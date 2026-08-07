-- Rollback for Phase B.
-- Removes indexes added by Phase B.

START TRANSACTION;

DROP INDEX idx_service_requests_provider_schedule_status ON service_requests;
DROP INDEX idx_service_requests_profile_schedule ON service_requests;
DROP INDEX idx_user_reports_status_action ON user_reports;

COMMIT;
