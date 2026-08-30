-- Migration: Extend notifications.type enum with verification result values.
-- Apply manually on production (example):
--   mysql -u <user> -p <database_name> < backend/migrations/20260725_add_verification_notification_types.sql

ALTER TABLE notifications
MODIFY COLUMN type ENUM(
  'request_received',
  'request_accepted',
  'request_declined',
  'provider_on_way',
  'service_completed',
  'discussion_requested',
  'discussion_accepted',
  'phone_revealed',
  'completion_confirmed',
  'review_received',
  'verification_approved',
  'verification_rejected'
) NOT NULL;

-- Verification query:
--   SHOW COLUMNS FROM notifications LIKE 'type';

-- Rollback (practical, only if no rows use verification_approved/verification_rejected):
--   UPDATE notifications
--   SET type = 'request_declined'
--   WHERE type IN ('verification_approved', 'verification_rejected');
--
--   ALTER TABLE notifications
--   MODIFY COLUMN type ENUM(
--     'request_received',
--     'request_accepted',
--     'request_declined',
--     'provider_on_way',
--     'service_completed',
--     'discussion_requested',
--     'discussion_accepted',
--     'phone_revealed',
--     'completion_confirmed',
--     'review_received'
--   ) NOT NULL;
