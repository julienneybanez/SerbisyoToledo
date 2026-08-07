DATABASE AUDIT SUMMARY

Generated: 2026-08-07T05:47:14.980Z
Database: railway
Tables: 10
Source: db_audit_live.json (post-Phase-C live re-audit)

## Executive Summary

- Re-audit completed against live Railway DB after Phase C migration.
- Schema now reflects conservative Phase C cleanup.
- Previously dropped legacy columns are no longer present.
- Compatibility columns intentionally retained are still present.

## Table Row Counts

- notifications: 41
- password_reset_tokens: 4
- portfolio_items: 3
- refresh_tokens: 0
- reviews: 2
- service_profiles: 4
- service_requests: 24
- user_reports: 3
- users: 51
- verification_requests: 3

## Phase C Delta Verification

### Removed from schema (confirmed absent)

- users.last_active
- users.description
- users.tags
- users.starting_price
- users.rating
- users.reviews_count
- users.location
- service_profiles.banner_image
- service_profiles.online
- portfolio_items.image_data

### Retained compatibility columns (confirmed present)

- service_requests.scheduled_date
- service_requests.scheduled_time
- users.profile_image
- users.profile_photo
- users.preferred_services
- service_profiles.full_name

## Canonical Columns Health

- service_requests.scheduled_start_at: populated (0 nulls)
- service_requests.scheduled_end_at: populated (0 nulls)
- user_reports.report_status: populated (0 nulls)
- user_reports.action_taken: populated (0 nulls)
- users.last_seen_at: populated (0 nulls)

## Constraints Snapshot

### Primary keys

- All 10 tables have primary key on id.

### Foreign keys

- notifications.user_id -> users.id
- notifications.related_request_id -> service_requests.id
- password_reset_tokens.user_id -> users.id
- portfolio_items.service_profile_id -> service_profiles.id
- refresh_tokens.user_id -> users.id
- reviews.service_profile_id -> service_profiles.id
- reviews.client_id -> users.id
- service_profiles.user_id -> users.id
- service_requests.client_id -> users.id
- service_requests.provider_id -> users.id
- service_requests.service_profile_id -> service_profiles.id
- user_reports.request_id -> service_requests.id
- user_reports.reporter_id -> users.id
- user_reports.reported_user_id -> users.id
- user_reports.handled_by -> users.id
- verification_requests.user_id -> users.id
- verification_requests.reviewed_by -> users.id

### Unique constraints

- password_reset_tokens.token_hash
- reviews.service_request_id (idx_unique_request_review)
- service_profiles.user_id
- user_reports (request_id, reporter_id, reported_user_id)
- users.email
- verification_requests (user_id, status)

### Check constraints

- service_profiles: json_valid(service_categories)
- users: json_valid(skills)

## Notable Data Conditions (Investigate)

- users.preferred_services is fully null (51/51)
- users.profile_photo is fully null (51/51)
- service_profiles.description is fully null (4/4)
- verification_requests.admin_notes is fully null (3/3)

## Additional Observation

- users.profile_photo_url now has 16 non-null values that look like legacy filenames (for example, mariadacuyan.png).
- This likely came from profile_image backfill and should be normalized to canonical URL format before strict URL assumptions are enforced.

## Risk Notes

- The above full-null fields are not immediate schema integrity issues but are deprecation/data-quality candidates.
- Keep compatibility fields until runtime reads are removed and verified in production.

## Recommended Next Steps

- Add telemetry for reads of compatibility fields:
  - service_requests.scheduled_date
  - service_requests.scheduled_time
  - users.profile_image
  - users.profile_photo
  - users.preferred_services
  - service_profiles.full_name
- Plan Phase D only after telemetry shows zero reads for a full release window.
- Add data-cleanup task for users.profile_photo_url normalization.
