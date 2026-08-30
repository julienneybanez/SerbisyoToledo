# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Toledo City residents looking for trustworthy local service providers and understandable help with hiring them, including people with limited technical familiarity and older adults.
- Local tradespeople who need to present services professionally, manage availability, receive requests, and build credible profiles from completed work.
- Platform administrators who verify providers and credentials, moderate reports, and manage platform integrity.

## Product Purpose

SerbisyoToledo makes local service hiring in Toledo City more structured, transparent, and trustworthy. Clients discover nearby providers, compare factual profiles, and send booking requests only against provider-defined dates and time slots. Providers can manage their listing, work availability, requests, credentials, languages, and completed-work portfolio. Success is a clear, reliable path from service discovery through completed local work.

## Positioning

SerbisyoToledo is a Toledo City-specific community service platform, not a generic freelance marketplace, social media directory, or SaaS booking tool. It brings discovery, trust signals, structured requests, availability, communication, verification, and completed-work evidence into one locally appropriate workflow.

## Operating Context

- Client flow: discover providers, compare services, skills, languages, credentials, reviews, availability, and portfolio work; submit and manage structured booking requests.
- Provider flow: create and publish a verified service listing; manage availability, requests, messages, credentials, languages, and portfolio entries tied to completed jobs.
- Admin flow: review provider verification requests and credentials, investigate user reports, and moderate user activity.
- Payments are handled offline between clients and providers.
- Interfaces support English and Cebuano and must remain clear on desktop and small mobile widths, approximately 320px to 430px.

## Capabilities and Constraints

- Preserve distinct Client, Service Provider, and Admin permissions, workflows, and navigation. Frontend visibility is never a substitute for server-side authorization.
- Preserve availability-backed booking, continuous and non-consecutive dates where supported, conflict prevention, and duplicate active-request safeguards.
- Providers must be verified before publicly offering bookable services.
- Preserve trust information: verification, credentials, languages, skills, ratings, reviews, completed work, and portfolios.
- Preserve email/account security, provider-controlled availability, private identity documents, and consent-based phone-number sharing.
- Preserve the existing React frontend, Node.js/Express backend, MySQL database, JWT authentication, and deployment architecture unless explicitly replaced by a future technical decision.
- Do not change backend contracts, database behavior, routes, authentication, or business logic merely to simplify a visual change.
- Avoid unnecessary dependencies or architectural complexity that does not solve a real service-discovery, trust, booking, communication, verification, or platform-management problem.

## Brand Commitments

- Product name: SerbisyoToledo.
- Preserve the existing blue-and-teal identity, while prioritizing readability and functional hierarchy.
- The product should feel like a practical community service platform for Toledo City.
- Dashboard and sidebar navigation should support role-based work without becoming a generic admin-template experience.
- Avoid excessive card nesting, decorative gradients, oversized headings, status-pill clutter, or whitespace that reduces useful information density.

## Evidence on Hand

- Local service taxonomy and workflow implementation in `backend/config/serviceTaxonomy.js`, `backend/controllers/`, and `src/pages/`.
- English and Cebuano localization in `src/context/LanguageContext.jsx`.
- Product documentation in `docs/`, including UI design, accessibility/localization, settings, and mobile-test guidance.
- Existing provider/profile imagery and brand assets in `src/assets/` and `public/`.
- Do not fabricate providers, reviews, ratings, credentials, availability, service outcomes, user testimonials, or payment guarantees.

## Product Principles

1. Make local service decisions understandable before asking users to act.
2. Earn trust through factual, verifiable information rather than vague claims.
3. Keep booking, availability, and workflow state authoritative and explicit.
4. Make every role's recurring work easy to scan, compare, and complete.
5. Prefer maintainable capstone-scale solutions that improve real community workflows.

## Accessibility & Inclusion

- Support users with varying technical familiarity, including older adults.
- Preserve readable contrast, legible type, clear labels, unambiguous controls, and workflows that do not require prior technical knowledge.
- Account for English and Cebuano string lengths in layouts; do not hard-code English-only assumptions.
- Preserve responsive usability across desktop and small mobile screens and support the existing light and dark themes.