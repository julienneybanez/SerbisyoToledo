# Settings Guide

## Scope

The settings UI follows one rule: visible controls should either persist to a real backend field or trigger a real, existing action. Controls that only changed temporary React state were removed from the user-facing settings pages.

No database schema changes are required for this cleanup.

## Routes

- Client settings: `/client-settings`
- Service provider settings: `/provider-settings`
- Admin system status: `/admin/settings`

## Client Settings

### Kept

- Full name
- Email (read-only)
- Phone number
- Address
- Email verification status
- Resend verification email
- Password reset flow
- Appearance/theme

Profile changes persist through `PATCH /api/user/profile`.

Verification resend uses `POST /api/auth/resend-verification`.

### Removed

- Client bio from Settings and the quick Edit Profile modal

The client does not currently have a public profile where a bio has a clear user-facing purpose.

## Service Provider Settings

The provider settings page is intentionally limited to three areas:

1. Account
2. Schedule
3. Languages & Credentials

### Account

Kept:

- Full name
- Email (read-only)
- Personal phone number
- Password reset flow
- Appearance/theme

Full name and phone persist through `PATCH /api/user/profile`.

Provider phone remains important because it is used by the booking discussion/contact-sharing workflow.

### Schedule

Kept:

- Availability status
- Show availability status
- Same-day booking
- Minimum advance notice
- Maximum advance booking window
- Weekly availability blocks
- Date exceptions

These use the existing provider availability APIs.

### Languages & Credentials

Kept:

- Languages spoken
- Credential/certificate creation
- Credential document upload
- Submit credential for admin review
- Existing credential status/notes

These use the existing provider language and credential APIs and the existing admin credential-review workflow.

### Removed

The old Business section was removed because most of its fields were not persisted:

- Business name
- Business phone
- Business city
- Minimum job amount
- Service area

Provider marketplace information such as service location, starting price, categories, service types, and banner belongs to the Service Listing editor instead.

The old Notifications section was removed because its Push, Email, and SMS toggles did not persist and were not consumed by the notification system.

The old Privacy section was removed because Profile Visibility and Allow Direct Messages did not persist and the app does not have a general direct-message feature.

Old deep links such as `?section=business`, `?section=notifications`, and `?section=privacy` safely fall back to Account instead of leaving the page in an invalid state.

## Profile Menus

### Client

The profile menu is kept focused on:

- Edit Profile
- Client Settings
- Language/theme
- Logout

The quick Edit Profile modal now contains only profile photo, full name, phone, and address.

### Service Provider

The profile menu is simplified to:

- View Public Profile (when a service listing exists)
- Edit/Post Service Listing
- Portfolio & About Me
- Settings
- Language/theme
- Logout

Verification is intentionally not duplicated in this menu because the provider Dashboard already exposes the verification action as part of profile completion.

### Admin

Desktop Admin keeps the simple signed-in identity header and uses the sidebar for actions.

The mobile Admin profile menu no longer shows the client-only Edit Profile action. It contains only System Status, display preferences, and Logout.

## Admin System Status

`/admin/settings` is now a focused, read-only System Status page instead of duplicating Dashboard and moderation controls.

It shows:

- API health
- Database health/status
- Last health-check timestamp
- Health endpoint
- Refresh action

User management, verification review, and reports remain in their dedicated Admin pages.

## Rollback

The pre-cleanup code is preserved on:

`backup/pre-settings-cleanup-2026-08-26`

This branch points to the exact `main` state before the settings/profile-menu cleanup.
