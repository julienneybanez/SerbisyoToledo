# SerbisyoToledo Production Database Reconciliation Runbook

This runbook upgrades the existing Railway production MySQL schema to the runtime contract used by the current SerbisyoToledo backend.

It is **not** an automatic deployment migration. The production apply is intentionally manual and guarded.

## Why this is required

The active backend now depends on relational tables and columns that were not present in the last committed Railway schema audit, including provider taxonomy/languages/skills, availability, credentials, booking date tables, Messages, contact sharing, request-linked portfolio data, the modern Admin Reports lifecycle (`status`/`resolution`/`screenshot_url`), and profile-photo compatibility columns (`profile_image`/`profile_photo`).

Deploying newer JavaScript without reconciling the database can produce generic failures such as:

- `Failed to load conversations`
- `Failed to load portfolio`
- Service Listing appearing to save but not becoming publicly usable
- public provider profile requests failing even when a `service_profiles` row exists
- new report submission failing with an unknown-column error (`screenshot_url`)
- Admin Reports "investigate" action failing because the historical `status` enum does not accept `investigating`
- profile/account queries failing with an unknown-column error (`profile_image`/`profile_photo`) on databases provisioned only from the fresh canonical baseline

## Admin Reports reconciliation

Production historically carries a legacy report shape alongside (or instead of) the modern one: `report_status`, `action_taken`, a nullable legacy `status` enum (`pending`/`under_review`/`dismissed`/`resolved`/`banned`), `priority`, `resolution_notes`, `moderation_notes`, `screenshot_data`, and `screenshot_mime`.

The reconciliation script:

- adds the canonical `resolution` and `screenshot_url` columns if missing (no data is fabricated into `screenshot_url` from the legacy blob columns);
- widens `status` to a safe superset, deterministically renames `under_review` -> `investigating` and `banned` -> `resolved` (both are stage/label renames of decisions already made, not new moderation decisions), backfills any `NULL` status to `pending`, then narrows `status` to the canonical `ENUM('pending','investigating','resolved','dismissed') NOT NULL DEFAULT 'pending'`;
- backfills `resolution` from `resolution_notes` (preferred) or `moderation_notes` only when `resolution` is still `NULL`;
- never touches or drops `screenshot_data`/`screenshot_mime`/`report_status`/`action_taken`/`priority`. Migrating historical screenshot blobs to Cloudinary-hosted `screenshot_url` values is a separate, explicit follow-up, not part of this reconciliation.

The read-only audit (`npm run db:audit:runtime`) now also flags an incompatible `user_reports.status` ENUM shape (missing `investigating` or nullable) as a **blocking** compatibility issue, and the real-MySQL verification (`npm run db:verify:runtime`) EXPLAIN-checks the active Admin Reports moderation query and confirms the canonical columns exist.

## Profile-photo compatibility

Active backend code still reads/writes `profile_image` (legacy URL-ish `VARCHAR(500)`) and `profile_photo` (legacy `LONGBLOB`) as compatibility fallbacks alongside the canonical `profile_photo_url`/`profile_photo_public_id` write target. The canonical baseline now declares `profile_image`/`profile_photo` as documented compatibility columns so a fresh install matches the real production shape; the reconciliation script adds them defensively if a target database is missing either one. No photo data is fabricated — only the columns are ensured to exist.

The audit already required these four columns; it and the real-MySQL verification now also flag (non-blocking, informational) any `profile_photo_url` value that is not an `http://`/`https://`/`data:image/` reference, and any `profile_photo_public_id` set without a matching `profile_photo_url`.

## Safety rules

1. Run the read-only audit first.
2. Run the reconciliation in dry-run mode second.
3. Take a Railway production database backup/snapshot **before** apply.
4. Do not merge/deploy the accompanying runtime code changes until the production reconciliation succeeds.
5. Do not run `0000_baseline_canonical_schema.sql` against the existing production database.
6. Do not run the historical `legacy/` migrations one-by-one against production for this repair.
7. If any preflight check fails, stop. The reconciliation deliberately refuses to delete or guess conflicting production data.

## 1. Check out the reconciliation branch

From the repository root:

```bash
git fetch origin
git checkout chore/production-db-reconciliation
git pull origin chore/production-db-reconciliation
cd backend
npm install
```

Make sure the backend environment variables point to the **Railway production MySQL database**, not local MySQL.

The database module accepts `DATABASE_URL`, `MYSQL_URL`, or `DB_URL` (plus the local DB_* fallback variables).

Do not paste database passwords into chat or commit them to Git.

## 2. Run the fresh read-only production schema audit

```bash
npm run db:audit:runtime -- --write ./.runtime-audits/production-before.json
```

This command is read-only. It prints:

- selected database name
- MySQL version
- missing runtime tables
- missing runtime columns
- missing runtime views

An exit code of `2` is expected if production is currently incompatible.

Record the exact database name printed by this command. The historical Railway audit used `railway`, but use the name printed **now**, not the historical value.

## 3. Run the reconciliation dry-run

```bash
npm run db:reconcile:production
```

This is also non-mutating. Review the planned operations.

The script will stop if it finds production data that must not be guessed automatically, including:

- more than one pending verification request for one provider
- duplicate legal acceptance evidence
- more than one pending reschedule proposal for one request

If a preflight fails, do not use forceful SQL to bypass it. Resolve the conflicting rows deliberately first.

## 4. Take a Railway production backup/snapshot

In Railway, take a backup/snapshot of the production MySQL database before continuing.

Do not proceed to Step 5 until the backup exists.

## 5. Apply the production reconciliation

Replace `<DATABASE_NAME_FROM_STEP_2>` with the exact database name printed by the read-only audit.

### macOS / Linux

```bash
PRODUCTION_DB_BACKUP_CONFIRMED=yes \
PRODUCTION_DB_EXPECTED_NAME=<DATABASE_NAME_FROM_STEP_2> \
npm run db:reconcile:production -- --apply --confirm-production
```

### Windows PowerShell

```powershell
$env:PRODUCTION_DB_BACKUP_CONFIRMED="yes"
$env:PRODUCTION_DB_EXPECTED_NAME="<DATABASE_NAME_FROM_STEP_2>"
npm run db:reconcile:production -- --apply --confirm-production
```

### Windows Command Prompt

```bat
set PRODUCTION_DB_BACKUP_CONFIRMED=yes
set PRODUCTION_DB_EXPECTED_NAME=<DATABASE_NAME_FROM_STEP_2>
npm run db:reconcile:production -- --apply --confirm-production
```

The apply command refuses to run unless all three safeguards agree:

- `--apply`
- `--confirm-production`
- `PRODUCTION_DB_BACKUP_CONFIRMED=yes`

It also refuses to run if `PRODUCTION_DB_EXPECTED_NAME` does not exactly match the connected database.

## 6. Re-run the schema audit

```bash
npm run db:audit:runtime -- --write ./.runtime-audits/production-after.json
```

Expected final result:

```text
compatible: true
missingTables: []
missingColumns: []
missingViews: []
incompatibleShapes: []
```

Do not continue to deployment if the post-audit is incompatible. `incompatibleShapes` with `blocking: true` (currently only an out-of-shape `user_reports.status` ENUM) counts as incompatible; entries with `blocking: false` are data-hygiene notes and do not block deployment.

## 7. Run real-MySQL runtime SQL verification

```bash
npm run db:verify:runtime
```

This runs read-only `EXPLAIN` checks against the connected production MySQL schema for representative live query shapes covering:

- Messages
- Provider Profile / completed-job portfolio
- Browse Services / public provider profile
- provider languages and skills
- provider availability
- credentials
- booking and rescheduling
- Admin Reports moderation list and report-creation column shape

It also checks that obsolete compatibility columns no longer block modern inserts, that `user_reports.status` accepts the canonical `investigating` value, and that `profile_photo_url` values are HTTP(S)/data-URL references.

All checks should show `OK` / pass.

## 8. Run backend tests

```bash
npm test
```

Then return to the repository root:

```bash
cd ..
npm test
npm run build
npm run lint
```

## 9. Merge and deploy only after database verification succeeds

Once Steps 6-8 are clean, merge the reconciliation PR into `main`.

The branch also contains runtime fixes that depend on the reconciled schema, including:

- canonical booking date/range persistence
- canonical onboarding availability lookup
- Provider Profile ownership of the SP profile picture
- removal of the duplicate SP Edit Profile action
- safer Provider Profile partial loading
- public-provider preview gating
- canonical baseline alignment

## 10. Production smoke test

Use separate Client and Service Provider sessions and test this exact chain:

```text
Service Provider login
→ verification state
→ Post/Save Service Listing
→ confirm listing can be re-opened
→ Provider Profile loads
→ change profile picture
→ languages persist
→ Browse Services as guest
→ Browse Services as client
→ View Profile as Client
→ Client books provider
→ request appears for both users
→ Messages conversation appears
→ Client sends message
→ Provider replies
→ refresh both sessions
→ messages remain
```

Also verify:

- profile picture appears on public provider profile
- profile picture appears in Messages
- profile picture appears beside the provider name in the app
- Provider Profile, Availability, and Credentials load without generic 500 errors
- only genuinely published + verified + active providers appear in Browse Services

## Data preservation notes

The reconciliation does not intentionally delete existing users, service profiles, service requests, reviews, or legacy portfolio rows.

Legacy standalone portfolio rows without a real completed `service_request_id` are preserved in MySQL but are not fabricated into platform-completed jobs. Current public portfolio behavior remains completed-through-SerbisyoToledo only.

The old verification uniqueness rule `UNIQUE(user_id, status)` is replaced with the canonical "one active pending request" rule so providers may be rejected, correct their documents, and resubmit more than once while historical decisions remain preserved.

## Additional robustness hardening

While validating this runbook end-to-end against a reproduction database, the taxonomy/skill and request-schedule backfill steps (and the read-only audit's `users` column requirements) were found to assume legacy-only columns (`service_profiles.service_categories`, `users.skills`, `service_requests.scheduled_date`/`scheduled_start_at`/`scheduled_end_at`) are always present. Real Railway production has always had these columns, so behavior against production is unchanged. The script now checks for each column's existence first so the reconciliation also runs cleanly and idempotently a second time, or against a database where an earlier partial migration already removed them.
