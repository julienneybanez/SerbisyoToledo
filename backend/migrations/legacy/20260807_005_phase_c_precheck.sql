-- Precheck queries before Phase C destructive cleanup.
-- Review all rows returned before applying 20260807_004_canonical_phase_c_drop_legacy.sql.

-- Canonical schedule coverage for active requests
SELECT
  COUNT(*) AS missing_scheduled_start_at
FROM service_requests
WHERE status IN ('pending', 'accepted', 'on_the_way', 'in_progress', 'completed')
  AND scheduled_start_at IS NULL;

SELECT
  COUNT(*) AS missing_scheduled_end_at
FROM service_requests
WHERE status IN ('pending', 'accepted', 'on_the_way', 'in_progress', 'completed')
  AND scheduled_end_at IS NULL;

-- Canonical report fields coverage
SELECT
  COUNT(*) AS missing_report_status
FROM user_reports
WHERE report_status IS NULL;

SELECT
  COUNT(*) AS missing_action_taken
FROM user_reports
WHERE action_taken IS NULL;

-- Presence canonical field coverage
SELECT
  COUNT(*) AS missing_last_seen_at
FROM users
WHERE is_active = 1
  AND last_seen_at IS NULL;

-- Legacy columns with still-populated values (for visibility before drop)
SELECT
  SUM(CASE WHEN profile_image IS NOT NULL AND profile_image <> '' THEN 1 ELSE 0 END) AS users_profile_image_non_null,
  SUM(CASE WHEN profile_photo IS NOT NULL THEN 1 ELSE 0 END) AS users_profile_photo_non_null,
  SUM(CASE WHEN last_active IS NOT NULL THEN 1 ELSE 0 END) AS users_last_active_non_null,
  SUM(CASE WHEN preferred_services IS NOT NULL AND preferred_services <> '' THEN 1 ELSE 0 END) AS users_preferred_services_non_null,
  SUM(CASE WHEN description IS NOT NULL AND description <> '' THEN 1 ELSE 0 END) AS users_description_non_null,
  SUM(CASE WHEN tags IS NOT NULL THEN 1 ELSE 0 END) AS users_tags_non_null,
  SUM(CASE WHEN starting_price IS NOT NULL THEN 1 ELSE 0 END) AS users_starting_price_non_null,
  SUM(CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) AS users_rating_non_null,
  SUM(CASE WHEN reviews_count IS NOT NULL THEN 1 ELSE 0 END) AS users_reviews_count_non_null,
  SUM(CASE WHEN location IS NOT NULL AND location <> '' THEN 1 ELSE 0 END) AS users_location_non_null
FROM users;

SELECT
  SUM(CASE WHEN scheduled_date IS NOT NULL THEN 1 ELSE 0 END) AS requests_scheduled_date_non_null,
  SUM(CASE WHEN scheduled_time IS NOT NULL AND scheduled_time <> '' THEN 1 ELSE 0 END) AS requests_scheduled_time_non_null
FROM service_requests;

SELECT
  SUM(CASE WHEN banner_image IS NOT NULL THEN 1 ELSE 0 END) AS profiles_banner_image_non_null,
  SUM(CASE WHEN online IS NOT NULL THEN 1 ELSE 0 END) AS profiles_online_non_null,
  SUM(CASE WHEN full_name IS NOT NULL AND full_name <> '' THEN 1 ELSE 0 END) AS profiles_full_name_non_null
FROM service_profiles;

SELECT
  SUM(CASE WHEN image_data IS NOT NULL THEN 1 ELSE 0 END) AS portfolio_image_data_non_null
FROM portfolio_items;
