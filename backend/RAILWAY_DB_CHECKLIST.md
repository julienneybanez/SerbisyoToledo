# Railway DB Migration Checklist (Canonical Phases)

This checklist is for running phased migrations on Railway using backend scripts.

## 0) One-time setup

1. Ensure Railway CLI is authenticated and linked to the correct project.
2. Ensure backend service env contains one of:
   - `MYSQL_PUBLIC_URL` (preferred for migration script)
   - `DATABASE_URL` / `MYSQL_URL` / `DB_URL`

## 1) Backup first

Create a DB snapshot/backup in Railway before any phase.

## 2) Run Phase A (non-destructive add + backfill)

From repo root:

```powershell
cd backend
railway run --service <backend-service-name> "npm run db:phase-a"
```

Rollback if needed:

```powershell
cd backend
railway run --service <backend-service-name> "npm run db:migrate:file -- migrations/20260807_002_canonical_phase_a_add_backfill.rollback.sql"
```

## 3) Deploy canonical-aware app build

Deploy backend/frontend version that reads and writes:
- `service_requests.scheduled_start_at`, `service_requests.scheduled_end_at`
- `user_reports.report_status`, `user_reports.action_taken`
- `users.last_seen_at`

## 4) Run Phase B (non-destructive resync + indexes)

```powershell
cd backend
railway run --service <backend-service-name> "npm run db:phase-b"
```

Rollback if needed:

```powershell
cd backend
railway run --service <backend-service-name> "npm run db:migrate:file -- migrations/20260807_003_canonical_phase_b_indexes_resync.rollback.sql"
```

## 5) Run precheck before Phase C

```powershell
cd backend
railway run --service <backend-service-name> "npm run db:migrate:file -- migrations/20260807_005_phase_c_precheck.sql"
```

Review output and confirm no blockers for destructive cleanup.

## 6) Run Phase C (destructive legacy drop)

Only run after validation window and backup confirmation.

```powershell
cd backend
railway run --service <backend-service-name> "npm run db:phase-c"
```

Rollback file exists, but note this restores schema structure only (not deleted column data):

```powershell
cd backend
railway run --service <backend-service-name> "npm run db:migrate:file -- migrations/20260807_004_canonical_phase_c_drop_legacy.rollback.sql"
```

## 7) Post-migration smoke checks

- Auth login/logout
- Provider availability save
- Request create/respond/reschedule/complete
- Admin reports action flow
- Provider/client settings save

## 8) Troubleshooting notes

- If `railway connect` fails, use `railway run --service ...` with the SQL runner script instead of direct DB tunnel.
- If a migration fails midway, stop and inspect error output; do not run next phase.
- Keep all phase SQL and rollback SQL under version control.
