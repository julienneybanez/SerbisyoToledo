# Settings Guide

## Scope and Constraint

This redesign enforces a functional-control rule for settings pages:

- Every visible control must either persist to a real backend field or trigger a real, existing action.
- UI-only toggles and fake global configuration controls were removed.
- No database schema changes were made.

## Route Coverage

- Client settings: `/client-settings`
- Service provider settings: `/provider-settings`
- Admin settings: `/admin/settings`

## Control Audit and Current Behavior

### Client Settings

Functional controls kept:

- Full name, phone, address, bio
  - Persistence: `PATCH /api/user/profile`
  - Frontend API: `userProfileAPI.updateProfile(FormData)`
- Resend verification email
  - Action: `POST /api/auth/resend-verification`
  - Frontend API: `authAPI.resendVerification({ email })`
- Open password reset flow
  - Action: navigate to `/forgot-password`

Nonfunctional controls removed:

- Profile visibility
- Allow messages
- Show contact information
- Push/email/SMS notification toggles not backed by persisted preference fields
- City and postal-code fields that were not persisted

### Service Provider Settings

Functional controls kept:

- Account profile fields (name, phone, address, bio)
  - Persistence: `PATCH /api/user/profile`
- Service profile create/update fields
  - Persistence: `POST /api/service-profiles/create`
  - Required: display name, barangay address, starting price, at least one category
- Publish/unpublish profile
  - Persistence: `PATCH /api/service-profiles/toggle-publish`
- Portfolio detail updates (about me, response time, skills)
  - Persistence: `PATCH /api/service-profiles/portfolio/details`
- Submit provider verification request
  - Action: opens verification request modal, submits to `POST /api/user/verification-request`

Nonfunctional controls removed:

- Auto-accept requests
- Provider-only privacy toggles not backed by persistence
- SMS/email/push preference toggles without stored preferences
- Service area and minimum job amount controls without backend support

### Admin Settings

Functional controls kept:

- Refresh operational metrics
  - Action: loads `dashboard-stats`, users, verifications, reports, and health
- Export operational snapshot JSON
  - Action: client-side JSON export of live status
- Navigation shortcuts to moderation pages
  - `/admin/verifications`, `/admin/reports`, `/admin/users`

Read-only operational status surfaced from real sources:

- `GET /api/admin/dashboard-stats`
- `GET /api/admin/users`
- `GET /api/admin/verification-requests`
- `GET /api/admin/reports`
- `GET /api/health`

Nonfunctional controls removed:

- Fake global settings (maintenance mode, registration toggles, password policy checkboxes, SMS/email system toggles, session timeout) that had no persisted backend implementation

## Backend Adjustment Included

One minimal response enhancement was added for provider settings:

- `GET /api/service-profiles/user/me` now includes `isPublished` from existing `service_profiles.is_published`.

This enables publish state to be shown and toggled accurately in Settings.

## DB Impact Statement

- No schema migrations were created.
- No table structures or columns were added, removed, or changed.
- Existing tables/fields are reused only.

## Post-Defense Recommendations

1. Add persisted user notification preferences if push/email/SMS toggle support is desired.
2. Add dedicated backend-admin config endpoints if true system-level settings are required.
3. Add provider self endpoint for verification request status (pending/approved/rejected) to avoid user guesswork.
4. Add integration tests for settings flows per role in frontend and backend test suites.
