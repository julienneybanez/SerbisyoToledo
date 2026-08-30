-- Migration: Add decline_reason column to service_requests.
-- Safe for repeated runs on MySQL 8+ using information_schema check.
-- Apply manually on production (example):
--   mysql -u <user> -p <database_name> < backend/migrations/20260725_add_service_request_decline_reason.sql

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'service_requests'
    AND COLUMN_NAME = 'decline_reason'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE service_requests ADD COLUMN decline_reason TEXT DEFAULT NULL',
  'SELECT "decline_reason already exists"'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verification query:
--   SHOW COLUMNS FROM service_requests LIKE 'decline_reason';

-- Rollback (practical):
--   ALTER TABLE service_requests DROP COLUMN decline_reason;
