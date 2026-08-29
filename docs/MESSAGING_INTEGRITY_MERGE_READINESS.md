# SerbisyoToledo Messaging & Integrity Pass — Merge Readiness Brief

> **Purpose:** This file is the execution brief for validating `feature/messaging-integrity-pass` before it is allowed to merge into `main`.
>
> **Do not redo the architectural audit unless current code contradicts this document. Treat the decisions in this file as established project requirements.**
>
> **Important:** Work on staging only. Do not modify Production, do not run the migration against the production database, and do not merge to `main` without explicit approval.

---

## 1. Branches and Environments

### Git branches

- Working branch: `feature/messaging-integrity-pass`
- Safety backup: `backup/pre-messaging-integrity-20260829`
- Production branch: `main`

Do not make implementation changes directly on `main`.

### Hosting

- Frontend: Vercel
- Backend: Railway
- Database: Railway MySQL
- Railway `staging` environment already exists.

### Required staging topology

```text
Vercel Preview for feature/messaging-integrity-pass
                    ↓
          Railway STAGING backend
                    ↓
            Railway STAGING MySQL
```

A Vercel Preview must never point at the production Railway database during validation.

---

## 2. Established Architecture Decisions

These are already decided. Do not redesign them during merge-readiness work unless the implementation is broken.

### Authentication

- Browser authentication uses an **HttpOnly session cookie**.
- JWTs must not be stored in browser-readable `localStorage`.
- Cookie-authenticated mutations use CSRF protection.
- `/api/auth/me` is the authoritative browser session bootstrap.
- A cached user object may exist only as non-secret display/routing state.
- Normal logout must clear the server-issued session cookie.
- Theme/language and other non-sensitive UI preferences may remain in localStorage.

### Messages

- Messages are **request-bound**, not global/free-form DMs.
- One service request has at most one conversation.
- Only the request client and assigned provider may access its conversation.
- Writable request states:
  - `pending`
  - `accepted`
  - `on_the_way`
  - `in_progress`
- Closed requests are read-only:
  - `completed`
  - `declined`
  - `cancelled`
- REST + MySQL are the source of truth.
- Socket.IO is for realtime delivery, unread state updates, presence, and reconnect behavior.
- A temporary socket failure must not lose messages.
- Message body maximum: 2000 characters.
- Message sending is rate-limited.

### Socket.IO

- Express and Socket.IO share the same HTTP server.
- Socket authentication uses the HttpOnly session cookie.
- A user may only join a conversation room after server-side participant verification.
- User rooms and conversation rooms may be used.
- Presence should use authenticated socket connect/disconnect plus `last_seen_at`.
- Current capstone deployment assumes one Railway backend replica; Redis is not required unless backend replicas are later scaled horizontally.

### AI Assistant vs Messages

- **SerbisyoToledo Assistant** = AI/discovery/help feature.
- **Messages** = private client ↔ provider booking communication.
- They must remain separate concepts and routes.
- Do not place the AI assistant inside private Messages unless separately approved later.

### Phone sharing

- Messages and phone sharing are separate.
- Phone is private by default.
- Client may request provider phone.
- Provider may request client phone.
- The number owner explicitly chooses Share or Decline.
- Official phone sharing is available only after acceptance:
  - `accepted`
  - `on_the_way`
  - `in_progress`
- The actual phone number must be fetched dynamically after authorization.
- Do not hard-code/store the phone number inside notification text or official system chat events.
- Philippine mobile numbers should be normalized/validated (e.g. `0917...` / `+63917...`).

### Service Location

- Booking has a request-owned **Service Location snapshot**.
- It may be prefilled from the client's account address.
- The client may edit it for that booking.
- Changing the account address later must not change an existing request.

### Pricing

- Current application policy is **per-day pricing**.
- Frontend and backend must agree.
- Do not allow `per_hour` or `per_job` in the active booking/listing flow unless the pricing model is deliberately redesigned later.
- Historical request pricing snapshots must remain stable.

### Booking duplicate rule

- Cross-provider conflict prevention is based on the **same service type**, not the entire broad service category.
- Provider double-booking remains time-overlap based.
- Same date with non-overlapping time slots is allowed.

### Availability

- Provider-selected start/end hours represent a usable **time window**.
- Do not treat the configured start time as the only client-facing slot.

### Provider verification and credentials

- Provider identity/marketplace verification and professional credentials are distinct.
- Government-issued ID is required for provider verification.
- Certification/license is optional.
- Professional credentials are reviewed separately through Provider Credential Reviews.
- Generic User Management must not bypass the formal provider verification workflow.

### Portfolio

- Public portfolio work must be tied to completed SerbisyoToledo service requests.
- Standalone arbitrary manual portfolio uploads should not be published as if platform-verified.
- Completed-job photos may be added to linked completed requests.
- Private client job details must not be automatically published.

### Account moderation

- Normal admin moderation should suspend/deactivate users, not hard-delete relational history.
- Suspended providers should be unpublished and excluded from public discovery.
- Booking/report/review/message/moderation history should be preserved.
- Final retention/anonymization design belongs to the later full schema redesign.

### Request Archive

- Archive is server-side per user.
- It must not rely on browser-only hidden request IDs.
- Closed requests can be archived without affecting the other participant's view.

### Rescheduling

- A booking should not have multiple unresolved pending reschedule proposals.
- Response to a proposal must revalidate that the service request is still in `accepted`.
- Moving a request beyond `accepted`, cancelling, or otherwise closing the reschedule window invalidates pending proposals.

---

## 3. Later Full Database Redesign — NOT This Task

The user has explicitly approved a genuine full schema redesign later.

That later overhaul will:

- design the canonical schema from finalized system requirements,
- account for all frontend/backend workflows,
- migrate and validate existing Railway data,
- remove obsolete compatibility fields,
- consolidate redundant concepts,
- intentionally redesign foreign keys, retention, soft deletion, and integrity constraints,
- establish migrations as the authoritative source of truth,
- retire/reduce the current giant `init-db.js`,
- make a fresh database and migrated production database converge on the same canonical schema.

### Therefore, during this merge-readiness task:

Do **not**:

- perform the full database redesign,
- drop legacy columns solely because they are old,
- rewrite all historical migrations,
- destructively restructure the production schema,
- treat the current `init-db.js` as authoritative.

Small additive/compatibility fixes required for the current feature branch are allowed.

---

## 4. Current Additive Migration

Expected migration:

```text
backend/migrations/20260829_001_messaging_integrity_additions.sql
```

It currently covers the additive structures needed for this pass, including:

- conversations
- messages
- reciprocal phone-sharing state
- request archive state
- service location snapshot
- half-star rating compatibility
- nullable optional verification certification
- notification types needed by Messages/contact sharing/credential events

Test this migration against **Railway staging MySQL only** before production.

---

## 5. Merge-Readiness Execution Checklist

Work systematically. Batch related fixes before rerunning large suites.

### A. Dependency and lockfile consistency

At repository root:

```bash
npm install
```

In `backend/`:

```bash
npm install
```

Confirm:

- root `package-lock.json` includes `socket.io-client`
- backend `package-lock.json` includes `socket.io`
- no package/lock mismatch remains

### B. Frontend checks

Run:

```bash
npm run build
npm run lint
npm test
```

Fix:

- JSX/build errors
- missing imports
- missing routes
- stale handlers
- missing translation keys
- ESLint failures
- test failures caused by this branch

### C. Backend checks

From `backend/`:

```bash
npm test
npm start
```

Verify:

- Express starts
- Socket.IO attaches successfully
- database connection succeeds in the intended environment
- no route import/controller syntax errors
- no startup warnings caused by this branch

### D. Stale-code audit

Search the active application for:

```text
authToken
localStorage token/JWT storage
requestDiscussion
acceptDiscussion
discussion_requested
discussion_accepted
provider_phone_revealed
client_email
provider_phone
explicitStartOnly
per_hour
per_job
addPortfolioImage
manual standalone portfolio upload
ProviderSidebar
```

Rules:

- No active frontend/backend behavior should depend on the retired Discussion flow.
- No browser-readable real JWT should remain.
- No provider-facing request API should leak client email.
- No unauthorized request API should leak phone numbers.
- Legacy database columns may remain until the later full database overhaul if inactive.
- Old notification values may remain only for historical compatibility, not new behavior.
- If `ProviderSidebar.jsx` is truly unused beside `WorkspaceSidebar.jsx`, remove/consolidate it only if safe and verified.

### E. Regression tests to add/update

Cover at minimum:

#### Auth and security

- login establishes cookie session
- token is not returned/stored as browser-readable auth state
- `/auth/me` works with valid session
- expired/invalid session returns 401
- cookie-authenticated mutation without valid CSRF is rejected
- mutation with valid CSRF succeeds
- logout clears session
- suspended/deactivated account cannot keep using protected endpoints

#### Messages

- only request participants can open/list/access a conversation
- non-participant cannot read messages
- non-participant cannot send messages
- non-participant cannot join socket conversation room
- pending request can message
- active accepted/on-way/in-progress request can message
- completed/declined/cancelled conversation is read-only
- message limit is enforced
- unread/read state works
- MySQL persistence works independently of socket delivery

#### Privacy/contact

- client email is not exposed to provider request APIs
- provider/client phone is hidden before explicit share
- phone request is rejected while Pending
- phone request works after Accepted
- share/decline is reciprocal
- notification does not contain the raw phone number
- invalid Philippine phone number is rejected

#### Booking/request integrity

- service location is required and stored as a snapshot
- changing account address does not mutate existing service request location
- duplicate cross-provider rule uses same service type, not broad category
- provider time overlap prevention still works
- same day non-overlapping bookings are allowed
- provider availability windows produce valid start slots
- backend enforces per-day pricing
- pricing snapshot remains stable

#### Reschedule

- only one pending proposal
- stale proposal cannot be accepted after request leaves `accepted`
- cancellation invalidates pending proposal
- moving `on_the_way` invalidates pending proposal

#### Admin/provider integrity

- inactive provider excluded from public discovery
- generic User Management cannot directly change provider verification
- deactivate user preserves relational history
- certification/license is optional for identity verification
- credential approval/rejection uses credential-specific notification types
- public portfolio only exposes completed-through-platform work

#### Archive

- only participant can archive their request
- only closed request may be archived
- archived request disappears only for the archiving user
- unarchive restores it

---

## 6. Railway Staging Validation

The `staging` Railway environment already exists.

Before every database or deployment command, verify and print/log:

- selected Railway project
- selected environment = `staging`
- selected backend service
- target database/service

If the target is not clearly staging, stop before making changes.

### Deploy feature backend to staging

Use the authenticated Railway tooling available to VS Code.

Do not deploy this branch to Production.

### Apply migration only to staging

Apply:

```text
backend/migrations/20260829_001_messaging_integrity_additions.sql
```

to the staging MySQL database.

Validate:

- all ALTER statements succeed
- all new tables/indexes/FKs exist
- notification enum/type changes succeed
- existing review values survive decimal conversion
- optional certification columns accept null
- existing records are preserved
- rerun/failure behavior is understood
- no half-applied migration is left after an error

### Inspect staging logs

Check Railway build/runtime logs for:

- database errors
- CORS errors
- cookie/session errors
- CSRF errors
- Socket.IO startup errors
- WebSocket upgrade/reconnect problems
- unexpected 500s

---

## 7. Vercel Preview Validation

Create or inspect the Preview deployment for:

```text
feature/messaging-integrity-pass
```

Confirm the Preview-specific frontend API URL points to the **Railway staging backend**.

Never point the Vercel Preview at the production database/backend for this validation.

Record the exact Preview URL and staging backend URL in the final report.

---

## 8. Production-Like Auth/Cookie Checks

Against Vercel Preview + Railway staging:

Test:

- login
- refresh
- direct protected URL navigation
- `/auth/me`
- multiple tabs
- logout
- expired/invalid session
- forgot password
- reset password
- email verification
- client role redirects
- provider role redirects
- admin login/routes

Browser security expectations:

- no real JWT in localStorage
- auth cookie is HttpOnly
- production-like cookie is Secure
- correct SameSite behavior for Vercel ↔ Railway
- credentialed requests succeed
- CSRF-protected mutations work
- 401 clears stale browser session state

---

## 9. Socket.IO / Realtime Checks

Verify on staging:

- Socket.IO connects from Vercel Preview to Railway staging
- WebSocket upgrade succeeds
- polling fallback does not break messaging
- authenticated user room joins
- authorized conversation room joins
- unauthorized conversation room join is rejected
- message created through REST is persisted first
- realtime recipient receives `message:new`
- unread badge updates
- active thread marks messages read
- reconnect restores useful realtime behavior
- active conversation room is rejoined after reconnect
- temporary disconnect does not lose message history

---

## 10. End-to-End Browser Test Flows

Use Playwright/browser automation if available. Otherwise do manual two-session tests.

### Client flow

```text
Login
→ Browse
→ Book
→ Pending
→ Message Provider
→ Accepted
→ Request/share phone
→ Reschedule
→ On the Way
→ In Progress
→ Completion
→ Review
→ Archive
```

### Provider flow

```text
Login
→ Verification status
→ Service Listing
→ Availability
→ Receive Pending Request
→ Message Client
→ Accept
→ Phone sharing
→ On the Way
→ In Progress
→ Completion
→ Link completed job to portfolio
```

### Failure/edge cases

Test:

- Client A cannot access Client B / Provider B conversation
- Pending request cannot share phone
- second pending reschedule is rejected
- stale reschedule cannot change a progressed/cancelled booking
- suspended provider disappears from Browse
- direct public profile URL for inactive provider is unavailable
- completed conversation is read-only
- archive is per-user
- changing account address does not alter old booking Service Location
- socket disconnect/reconnect does not lose messages
- refresh reloads messages from MySQL

---

## 11. Responsive and UI Review

Check at least:

- 320px
- 360px
- 390px
- 430px
- desktop

Check both:

- light mode
- dark mode

Pay special attention to:

- Messages layout
- mobile conversation/back behavior
- unread badges
- Requests communication section
- phone-sharing states
- Service Location input
- Settings phone privacy helper
- Verification optional credential wording
- completed-job-only portfolio interface
- modals and touch targets
- text wrapping/readability for older/non-technical target users

Do not make the interface look visually disconnected from the existing SerbisyoToledo design.

---

## 12. SerbisyoToledo Cebuano Localization Audit

Run the established **SerbisyoToledo Cebuano Localization Audit** over all additions and changed screens.

Audit:

- natural Cebu/Toledo Cebuano
- sensible Cebuano-English UI mixing where clearer
- consistent terms across client/provider/admin
- no awkward literal translations
- Messages terminology
- phone-sharing terminology
- Service Location
- verification/credentials
- archive
- password/security errors
- notifications
- responsive overflow after translation
- light/dark rendering
- frontend and backend user-facing messages

Do not change application logic merely to rewrite translations.

---

## 13. Known `init-db.js` Rule

`backend/config/init-db.js` is legacy/non-authoritative and may be schema-drifted.

For this branch:

- do not expand it into the new source of truth,
- do not attempt the full retirement now,
- do not use it to recreate production,
- document any current mismatch that directly affects this feature branch.

The later full database redesign will replace the current approach with a canonical migration-based schema.

---

## 14. Actions Forbidden Without Explicit Approval

Do **not** perform any of the following during merge-readiness validation:

- merge into `main`
- push implementation directly to `main`
- run the new migration against Production
- alter the production Railway database
- change production Railway environment variables
- deploy the feature branch as the production backend
- replace the production Vercel deployment
- delete/recreate Railway production services
- delete production data
- perform the full schema redesign
- hard-delete users/data for cleanup

Staging fixes and staging redeployments are allowed.

If a staging/deployment issue requires more than **three substantially different attempts**, stop the loop and report the blocker instead of burning credits indefinitely.

---

## 15. Credit/Agent Efficiency Rules

To reduce Copilot Auto credit usage:

1. Read this file once completely before starting.
2. Do not rediscover decisions already documented here.
3. Inspect only the files relevant to a failing criterion.
4. Batch related fixes before rerunning full build/test/deploy suites.
5. Prefer focused tests while iterating.
6. Run full suites at meaningful checkpoints.
7. Do not repeatedly redeploy after every individual code edit.
8. Stop after three materially different attempts at the same infrastructure blocker.
9. Reuse existing test fixtures/accounts where safe.
10. Do not perform speculative refactors unrelated to merge readiness.

---

## 16. Merge Criteria

The branch is **MERGE-READY** only when all of the following are PASS:

- [ ] root lockfile matches package dependencies
- [ ] backend lockfile matches package dependencies
- [ ] frontend production build passes
- [ ] frontend lint passes
- [ ] frontend tests pass
- [ ] backend tests pass
- [ ] backend starts with Express + Socket.IO
- [ ] no active browser-readable JWT/localStorage auth token remains
- [ ] cookie auth works after refresh
- [ ] logout/session expiry works
- [ ] CSRF behavior passes
- [ ] suspended accounts/providers behave correctly
- [ ] client email/privacy leakage is fixed
- [ ] phone numbers remain private until explicit share
- [ ] request-bound Messages authorization passes
- [ ] Socket.IO authorization and reconnect behavior pass
- [ ] Messages remain recoverable via REST/MySQL
- [ ] service location snapshot works
- [ ] exact-service duplicate rule works
- [ ] availability time-window semantics work
- [ ] per-day pricing is consistent
- [ ] reschedule lifecycle passes
- [ ] provider verification cannot be bypassed by User Management
- [ ] normal account moderation preserves history
- [ ] certifications are optional while identity verification remains required
- [ ] public portfolio is limited to completed platform jobs
- [ ] server-side request Archive works
- [ ] notification routing/types work
- [ ] no raw phone number is stored in official notification text
- [ ] staging migration passes on Railway staging MySQL
- [ ] Railway staging backend deploys successfully
- [ ] Vercel Preview points to Railway staging
- [ ] Socket.IO/WebSocket works between Preview and staging
- [ ] two-account client/provider flow passes
- [ ] mobile + desktop responsive checks pass
- [ ] light + dark checks pass
- [ ] SerbisyoToledo Cebuano Localization Audit passes
- [ ] final diff against `main` contains no accidental unrelated changes
- [ ] production rollout instructions are documented
- [ ] production rollback instructions are documented

If any mandatory item fails, do not call the branch merge-ready.

---

## 17. Required Final Report Format

At the end, provide:

### Summary

- Overall result: `PASS / NOT MERGE-READY`
- Branch tested
- Commit tested
- Railway environment used
- Railway staging backend URL
- Vercel Preview URL
- Migration status

### Checks

Use a concise table:

| Criterion | PASS/FAIL | Evidence / Notes |
|---|---|---|
| Frontend build | | |
| Frontend lint | | |
| Frontend tests | | |
| Backend tests | | |
| Cookie auth | | |
| CSRF | | |
| Messages authorization | | |
| Socket.IO | | |
| Phone privacy | | |
| Booking integrity | | |
| Rescheduling | | |
| Archive | | |
| Provider verification | | |
| Portfolio | | |
| Migration | | |
| Responsive UI | | |
| Cebuano localization | | |

### Remaining blockers

List only actual remaining blockers. Do not restate completed work.

### Production rollout plan

Provide the exact safe sequence, expected to follow this pattern:

```text
1. Confirm merge approval.
2. Backup production Railway MySQL.
3. Apply the already-tested additive migration to Production.
4. Verify migration success.
5. Deploy compatible backend.
6. Smoke-test backend/auth.
7. Deploy frontend/main.
8. Run production smoke tests.
9. Monitor Railway/Vercel logs.
```

### Rollback plan

Specify what to do if:

- migration fails,
- backend deploy fails,
- cookie auth fails,
- Socket.IO fails,
- frontend deployment fails.

Do not perform production rollout or merge as part of this validation task.
