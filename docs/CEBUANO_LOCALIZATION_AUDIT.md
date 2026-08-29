# Cebuano Localization Audit

## Goal

User-facing SerbisyoToledo interface text should switch consistently between English and Cebuano without changing database values or API domain identifiers.

## Audited recent flows

The current audit covers the major recent additions and high-impact provider/client paths:

- Provider Availability presets, calendar instructions, validation, custom hours, and save states
- Service Listing creation/editing
- Provider Verification Request
- Provider Dashboard onboarding, verification, stats, schedule, work queue, actions, decline flow, and tips
- Provider/client workspace navigation
- Mobile provider navigation
- Registration/Login email verification states and resend actions
- Requests rescheduling `Reason` label and missing availability/rescheduling error strings
- Chatbot launcher, interface, recommendations, fallback states, and Cebuano assistant replies

## Guardrail

`LanguageContextAudit.test.jsx` requires English and Cebuano dictionaries to have identical key sets.

At the time of this audit:

- English keys: 1,045
- Cebuano keys: 1,045
- Missing keys: 0
- Duplicate keys: 0

If a new user-facing translation key is added to only one language, the parity test should fail.

## What remains canonical

Internal/API values should not be translated. Examples include:

- role identifiers such as `client` and `tradesperson`
- request status values such as `in_progress`
- service type keys
- database column values
- URLs and route names

Service taxonomy names may remain canonical where they are stored/queried by their English labels. If localized category display names are desired later, add a display-label mapping rather than changing persisted taxonomy values.

## Implementation rule

For React UI copy, use `useLanguage()` and `t('key')` instead of new hardcoded English strings.

Dynamic copy should use placeholders:

```jsx
t('someKey', { count })
```

Backend validation/domain messages do not replace localized frontend feedback when the frontend already knows the action outcome and can provide a translated user-facing message.
