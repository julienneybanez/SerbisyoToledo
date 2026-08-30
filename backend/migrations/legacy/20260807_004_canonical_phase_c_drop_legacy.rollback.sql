-- Rollback for Phase C.
-- Restores dropped columns structurally only. Dropped data cannot be recovered without backups.

START TRANSACTION;

ALTER TABLE users
  ADD COLUMN last_active TIMESTAMP NULL DEFAULT NULL AFTER is_online;

ALTER TABLE service_profiles
  ADD COLUMN banner_image LONGBLOB NULL AFTER service_categories,
  ADD COLUMN online BOOLEAN DEFAULT FALSE AFTER reviews_count;

ALTER TABLE portfolio_items
  ADD COLUMN image_data LONGBLOB NULL AFTER image_public_id;

ALTER TABLE users
  ADD COLUMN description TEXT NULL AFTER bio,
  ADD COLUMN tags JSON NULL AFTER description,
  ADD COLUMN starting_price DECIMAL(10,2) NULL AFTER tags,
  ADD COLUMN rating DECIMAL(2,1) DEFAULT 0.0 AFTER starting_price,
  ADD COLUMN reviews_count INT DEFAULT 0 AFTER rating,
  ADD COLUMN location VARCHAR(255) NULL AFTER updated_at;

COMMIT;
