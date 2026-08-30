-- Phase C (destructive): drop legacy columns only after runtime validation on canonical fields.
-- Preconditions:
-- 1) A backup snapshot exists.
-- 2) App version no longer depends on dropped columns.
-- 3) Validation queries show no unresolved data dependencies.

START TRANSACTION;

-- Optional data hygiene: populate canonical URL field from legacy URL when missing.
UPDATE users
SET profile_photo_url = COALESCE(profile_photo_url, profile_image)
WHERE profile_image IS NOT NULL;

-- Drop deprecated image/blob and stale presence fields that are not used in runtime paths.
ALTER TABLE users
  DROP COLUMN last_active;

ALTER TABLE service_profiles
  DROP COLUMN banner_image,
  DROP COLUMN online;

ALTER TABLE portfolio_items
  DROP COLUMN image_data;

-- Remove provider-marketplace duplicated fields from users
-- after ownership is shifted to service_profiles and runtime reads are removed.
ALTER TABLE users
  DROP COLUMN description,
  DROP COLUMN tags,
  DROP COLUMN starting_price,
  DROP COLUMN rating,
  DROP COLUMN reviews_count,
  DROP COLUMN location;

COMMIT;
