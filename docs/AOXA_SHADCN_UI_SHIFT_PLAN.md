# SerbisyoToledo Aoxa-inspired shadcn/ui UI Shift Plan

Baseline: `main` at `65c2a1c6d3f8260357582d03ac5ca19d20bf7cf7`

Backup branch: `backup/main-before-aoxa-shadcn-ui-shift-20260901`

Working branch: `ui/aoxa-shadcn-visual-shift`

## Goal

Move SerbisyoToledo toward the visual direction shown in the approved Aoxa references while preserving SerbisyoToledo's identity, workflows, code-backed features, permissions, localization, responsiveness, and backend contracts.

The visual target is:
- stronger, larger typography and clearer hierarchy;
- white and softly tinted blue/cream working surfaces;
- confident civic-blue primary actions and restrained trust-teal confirmation states;
- larger, better-composed real SerbisyoToledo imagery/assets on public discovery surfaces;
- rounded but substantial panels rather than thin Bootstrap-like cards;
- less visual clutter and less nested-card styling;
- clean, spacious public pages and more compact operational dashboards;
- shadcn/ui-style component consistency without turning the product into a generic SaaS template.

This is a visual-system migration, not a feature redesign.

## Non-negotiable feature-preservation rules

1. No route present on the baseline may be removed or made unreachable.
2. No existing user action may disappear. If a visible action is moved, the replacement location must be at least as discoverable and must be recorded in the parity checklist before merge.
3. No backend route, request payload, database behavior, permission rule, status transition, Socket.IO behavior, notification behavior, or business rule may be changed merely to support the visual redesign.
4. Existing role separation remains intact: guest, client, service provider, and admin each keep their current routes and controls.
5. Existing English/Cebuano localization remains supported. New UI chrome must use the localization system instead of hard-coded English where the current surface is localized.
6. Existing light/dark-theme behavior remains supported.
7. Existing mobile navigation and small-width usability (roughly 320–430px) remain supported.
8. Real repository assets and real user/provider uploads remain the image source. Do not fabricate provider ratings, reviews, credentials, testimonials, availability, or marketplace statistics.
9. The chatbot keeps its current route/role visibility rules. It must not become globally visible.
10. Public/footer/auth shell rules remain behaviorally equivalent to the baseline.
11. Bootstrap, FullCalendar, react-day-picker, Bootstrap Icons, and existing component code must not be removed until each dependent surface has been migrated and regression-tested.
12. No migration phase is merged to `main` with known feature-parity regressions.

## Technical migration strategy

Use an incremental component migration instead of rewriting pages from scratch.

### Shared component layer

Introduce shadcn/ui-style primitives progressively for:
- Button
- Input / Textarea
- Select
- Checkbox / Radio
- Card / surface container
- Badge
- Alert
- Avatar
- Dialog
- Sheet / mobile drawer
- Tabs
- Dropdown menu
- Accordion
- Separator
- Tooltip
- Skeleton
- Table where appropriate

Existing SerbisyoToledo wrappers in `src/components/ui` should either become adapters around the new primitives or remain stable until their callers are migrated. This prevents a page-by-page API break.

### Keep specialized working components

Do not replace specialized behavior just to make it look shadcn:
- FullCalendar stays for provider schedule.
- react-day-picker stays for booking and provider availability unless a proven drop-in replacement preserves all current booking modes and interactions.
- Messaging Socket.IO logic stays untouched.
- Existing API service modules remain the data boundary.
- Existing modals may be visually converted to Dialog/Sheet while retaining their current state and submit logic.

### Bootstrap transition

Bootstrap must remain installed during the migration. New visual primitives can coexist while pages are converted one group at a time. Bootstrap can only be considered for removal after a final dependency audit proves no live route, modal, responsive behavior, icon, or test still depends on it.

## Visual direction

### Public experience

Public pages should feel closest to the Aoxa references:
- strong hero typography;
- large real service imagery;
- bold search and category discovery;
- broad white space with deliberate content blocks;
- soft blue/cream panels;
- large service/provider visuals;
- clean FAQ treatment;
- confident provider CTA.

Do not add Aoxa-only features such as provider tracking, app-store badges, Trustpilot, payments, earnings, bidding, or fabricated scale metrics.

### Auth experience

Login/register/recovery/verification stay focused and distraction-free:
- preserve current no-public-navbar/no-footer rule;
- use real SerbisyoToledo brand imagery;
- improve hierarchy, spacing, field grouping, error states, and responsive presentation;
- preserve every authentication action and link.

### Client workspace

Use a cleaner Aoxa-like dashboard shell but keep operational density:
- Dashboard
- Browse Services
- Requests / My Bookings
- Messages
- Notifications
- Edit Profile
- Settings

Primary actions should be obvious without hiding secondary actions in ambiguous menus.

### Service-provider workspace

Keep all provider work visible:
- Dashboard
- Requests
- Messages
- Schedule
- Notifications
- Service Listing / Post Service Listing
- Provider Profile
- Availability
- Credentials
- View Profile as Client
- Settings

Provider onboarding/profile-completion tasks remain visible until completed.

### Admin workspace

Use the same visual language but with higher information density. Do not copy the public-page spacing. Admin must preserve:
- Dashboard
- Users
- Verification Requests
- Provider Credential Reviews
- Reports
- System Status

Tables/lists, filters, status labels, review actions, evidence previews, and moderation actions must remain easy to scan.

## Migration phases

### Phase 0 — Baseline and parity lock

Before visual code changes:
- freeze the baseline commit and backup branch;
- complete the route/action parity inventory;
- record all current page-level primary and secondary actions;
- record conditional actions by role/status;
- identify all modal/sheet flows;
- capture desktop/mobile light/dark screenshots of representative surfaces;
- note current expected test failures separately from new regressions.

Exit gate: every route and feature in `UI_FEATURE_PARITY_CHECKLIST.md` has an owner and test method.

### Phase 1 — Foundations only

Add the new visual primitives, tokens, utilities, and layout conventions without changing page behavior.

Work:
- adapt `DESIGN.md` to the approved Aoxa-inspired SerbisyoToledo direction;
- create semantic tokens for page, surface, soft-blue, soft-cream, border, text, primary, teal/success, warning, and danger;
- establish heading/body/label scales;
- implement focus states, touch targets, and dark-theme equivalents;
- adapt existing `src/components/ui` wrappers.

Exit gate:
- no route-level visual migration yet;
- frontend lint/test/build pass at the same or better state as baseline.

### Phase 2 — Public + auth surfaces

Migrate:
- Home
- About
- Browse Services / Feed
- Public provider profile
- Terms
- Privacy
- Login
- Register
- Forgot Password
- Reset Password
- Verify Email

Preserve:
- landing search;
- popular service categories;
- How It Works;
- FAQ;
- provider CTA;
- actual service-category assets;
- provider listing images;
- all feed filters;
- provider profile ratings/reviews/portfolio/languages/skills/services/availability;
- booking entry point;
- chatbot visibility;
- footer rules;
- all auth actions.

Exit gate:
- guest and client can reach every public flow from the baseline;
- provider profile and booking entry controls remain visible at desktop and mobile widths.

### Phase 3 — Booking flow

Visually migrate `BookingModal` without changing logic.

Must preserve:
- one-day booking;
- continuous date range;
- non-consecutive/specific dates when enabled;
- disabled unavailable dates;
- drag/click range behavior;
- provider-defined available dates;
- common available time slots;
- estimated duration;
- daily rate and estimated total;
- service type selection;
- service location;
- job details;
- login requirement;
- submit success state;
- duplicate/conflict safeguards enforced by existing backend.

Exit gate:
- current booking tests pass;
- manual pointer and touch checks cover all three selection modes.

### Phase 4 — Client workspace

Migrate:
- Client Dashboard
- Requests
- Request Details
- Messages
- Notifications
- Client Settings
- client profile editing

Must preserve:
- onboarding/profile completion;
- request counts/current requests;
- request detail access;
- statuses;
- cancellation;
- reschedule proposal/response;
- review submission;
- reporting;
- archive/unarchive if currently surfaced;
- message conversations;
- unread state;
- provider/client messaging;
- consent-based phone-number request/share/decline;
- notification mark-read/mark-all/clear behavior;
- settings account/contact/security sections;
- email verification resend;
- password-change path.

Exit gate:
- every client action in the parity checklist is visible or conditionally visible exactly when applicable.

### Phase 5 — Service-provider workspace

Migrate:
- Service Provider Dashboard
- Requests / Request Details
- Messages
- Schedule
- Availability
- Notifications
- Service Listing modal
- Provider Profile editor
- Verification Request modal
- Credentials
- Provider Settings
- public-profile preview

Must preserve:
- profile setup/progress checklist;
- verification gating;
- create/edit service listing;
- categories and service types;
- per-day starting price;
- listing banner;
- provider public profile image;
- About Me;
- languages;
- response time;
- skills;
- completed-request-linked portfolio;
- optional completed-job photo;
- availability accepting-bookings toggle;
- availability presets;
- selected dates;
- per-date time overrides;
- schedule calendar;
- request acceptance/decline;
- on-the-way/start/complete statuses;
- rescheduling;
- reporting;
- messaging;
- phone sharing;
- credentials add/upload/submit for review;
- credential review status;
- view-profile-as-client;
- account settings and password/email-verification actions.

Exit gate:
- no provider checklist step or sidebar/profile action is missing;
- a verified provider can complete the full listing → availability → request → completion → portfolio path.

### Phase 6 — Admin workspace

Migrate:
- Admin Dashboard
- Users
- Verification Requests
- Provider Credential Reviews
- Reports
- System Status

Must preserve:
- dashboard summaries;
- user search/filter;
- user details;
- user activity;
- active/suspended status actions;
- verification request search/filter;
- ID/document preview;
- approve/reject with reasons;
- credential search/filter;
- credential document review;
- credential approve/reject/expire actions;
- report search/filter;
- report evidence screenshot preview;
- investigating/dismiss/resolve/warn/suspend/ban workflows supported by current code;
- required moderation notes;
- system health refresh/read-only status.

Exit gate:
- every admin moderation action is accessible without relying on hover-only UI.

### Phase 7 — Responsive, localization, accessibility, and theme audit

Run a cross-cutting pass across all migrated surfaces:
- 320 / 360 / 390 / 430px;
- tablet;
- desktop;
- light and dark;
- English and Cebuano;
- keyboard-only;
- visible focus;
- 44–46px+ touch targets;
- no text clipping;
- no off-screen dialogs;
- no hidden primary actions;
- no icon-only critical actions without labels/tooltips;
- no horizontal page overflow except intentional data tables with accessible scrolling.

Exit gate: all critical workflows can be completed on 360px and desktop in both languages/themes.

### Phase 8 — Regression and merge gate

Required before PR approval:
- `npm run lint`
- `npm test`
- `npm run build`
- backend `npm test`
- compare failures to the baseline and reject any new unexplained failures;
- route-by-route manual smoke test;
- parity checklist fully checked;
- browser console free of new route/render errors;
- no backend/database migration required for visual work;
- main is merged only after the backup branch and working branch are confirmed.

## Feature-visibility rule

A redesign may change layout, grouping, button shape, or responsive placement, but it may not silently demote an existing action.

For every existing button/control:
- Primary recurring task → visible button or direct navigation item.
- Important conditional task → visible when its current condition is true.
- Low-frequency secondary task → may be placed in a clearly labeled dropdown only if discoverability is equal or better.
- Destructive task → may be visually de-emphasized but must remain findable.
- Mobile-only relocation → must be documented in the parity checklist.
- Hover-only access is not acceptable for critical actions.

## Merge strategy

Do not perform the redesign as one giant PR.

Recommended PR sequence:
1. Foundations and primitives
2. Public + auth
3. Booking
4. Client workspace
5. Provider workspace
6. Admin workspace
7. Responsive/theme/localization/accessibility cleanup
8. Final parity/regression cleanup

Each PR must be mergeable on its own and must not leave a role with an incomplete navigation shell.

## Definition of done

The UI shift is done only when:
- all baseline routes still resolve;
- all code-backed features/actions remain available;
- no Aoxa-only feature has been added;
- real public images/assets remain present;
- role-based permissions and backend contracts are unchanged;
- booking behavior is unchanged;
- messages/notifications/realtime behavior is unchanged;
- provider verification, availability, credentials, portfolio, and listing workflows are unchanged;
- admin moderation workflows are unchanged;
- English/Cebuano and light/dark are intact;
- mobile critical flows work;
- frontend/backend regression gates show no new failures;
- `UI_FEATURE_PARITY_CHECKLIST.md` is fully completed.
