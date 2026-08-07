# Canonical Railway Rollout Guide (Phased)

This rollout replaces the one-shot refactor migration with safer production phases.

## Files

1. `20260807_002_canonical_phase_a_add_backfill.sql`
2. `20260807_003_canonical_phase_b_indexes_resync.sql`
3. `20260807_004_canonical_phase_c_drop_legacy.sql`

Each file has a companion rollback SQL.

## Recommended Railway Sequence

1. Create Railway DB backup/snapshot.
2. Apply Phase A.
3. Deploy backend/frontend version that reads/writes canonical columns.
4. Validate critical flows in production:
   - Login/logout and presence
   - Provider availability save
   - Request create/respond/reschedule/completion
   - Admin reports moderation actions
5. Apply Phase B.
6. Monitor for at least one release window.
7. Apply Phase C only when legacy-column reads are fully removed.

## Pre-Phase-C Checks

Run these checks on Railway before dropping legacy columns:

- Confirm no application queries reference:
  - `users.last_active`
  - `service_profiles.banner_image`
  - `service_profiles.online`
  - `portfolio_items.image_data`
  - `users.description`
  - `users.tags`
  - `users.starting_price`
  - `users.rating`
  - `users.reviews_count`
  - `users.location`

- Compatibility columns retained for now (do not drop until runtime reads are removed):
  - `service_requests.scheduled_date`
  - `service_requests.scheduled_time`
  - `users.profile_image`
  - `users.profile_photo`
  - `users.preferred_services`
  - `service_profiles.full_name`

- Confirm canonical columns are populated for active rows:
  - `service_requests.scheduled_start_at`
  - `service_requests.scheduled_end_at`
  - `user_reports.report_status`
  - `user_reports.action_taken`
  - `users.last_seen_at`

## Operational Notes

- Phase C is destructive. Rollback restores columns only, not deleted data.
- If any Phase C precheck fails, stop and keep Phase A/B state.
- Prefer running migrations in low-traffic windows.
