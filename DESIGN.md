---
name: SerbisyoToledo
description: A trustworthy local-services platform for Toledo City.
colors:
  civic-blue: "#2f80ed"
  civic-blue-hover: "#1f6fd8"
  civic-blue-soft: "#e2efff"
  trust-teal: "#0aa68f"
  trust-teal-hover: "#078775"
  trust-teal-soft: "#e2f7f3"
  page-bg: "#eaf2fa"
  surface: "#ffffff"
  surface-secondary: "#edf3f8"
  text-primary: "#162238"
  text-secondary: "#40546d"
  border: "#c9d7e6"
  danger: "#dc2626"
  warning: "#d97706"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.55rem, 2vw, 1.9rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  sm: "10px"
  input: "11px"
  control: "12px"
  md: "14px"
  card: "15px"
  lg: "18px"
  pill: "999px"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  8: "2rem"
  10: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.civic-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.civic-blue-hover}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.5}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.input}"
    height: "46px"
---

# Design System: SerbisyoToledo

## Overview

**Creative North Star: "Confident Local Service"**

SerbisyoToledo uses the approved Aoxa references as a visual-direction benchmark while keeping SerbisyoToledo's own product, assets, permissions, and workflows. The target is a confident local-service product: large readable headings, strong image composition, generous public-page spacing, white and softly tinted blue/cream surfaces, direct civic-blue actions, and restrained teal trust signals.

Public discovery surfaces may feel editorial and spacious, but authenticated workspaces remain more compact because users need to scan requests, schedules, verification states, reports, and messages efficiently. The redesign must never hide a code-backed action merely to make a screen look cleaner.

The system accommodates English and Cebuano, light and dark themes, older and less technical users, and small mobile widths. Real repository assets and real provider/user uploads remain the visual source of truth.

**Key Characteristics:**
- Strong black/ink typography with clearer hierarchy and fewer weak grey headings.
- Large real service/provider imagery on public discovery surfaces.
- Soft blue, mint, and cream editorial panels used selectively rather than decorative gradients everywhere.
- Rounded, substantial shadcn-style primitives with visible labels and reliable focus states.
- Civic blue for primary actions; teal for trust/success rather than as a competing primary color.
- Spacious public pages, denser client/provider/admin workspaces.
- Direct role-specific navigation with no disappearing features or hover-only critical controls.

## Colors

Clear Civic Blue and Trust Teal give the system its recognizable functional language: blue directs, teal confirms, and cool neutrals keep dense operational content calm.

### Primary
- **Clear Civic Blue** (`#2f80ed`): Primary actions, active links, discovery controls, and client-facing navigation.
- **Deep Civic Blue** (`#1f6fd8`): Hover and active response for blue controls.
- **Soft Civic Blue** (`#e2efff`): Selected, informational, and low-emphasis blue surfaces.

### Secondary
- **Trust Teal** (`#0aa68f`): Success, completion, verification-adjacent confirmation, and positive availability signals.
- **Deep Trust Teal** (`#078775`): Hover response for teal actions and emphasis.
- **Soft Trust Teal** (`#e2f7f3`): Positive background states.

### Neutral
- **Cool Page Blue** (`#eaf2fa`): Light-theme application canvas.
- **Clean Surface** (`#ffffff`): Cards, fields, and raised working surfaces.
- **Quiet Surface** (`#edf3f8`): Secondary bands, grouped content, and subtle separation.
- **Ink Navy** (`#162238`): Primary reading text.
- **Slate Supporting Text** (`#40546d`): Secondary labels and explanatory content.
- **Soft Structural Border** (`#c9d7e6`): Inputs, cards, dividers, and contained control edges.

**The Signal-Not-Decoration Rule.** Use blue and teal to explain state, action, or trust. Do not add accent color merely to decorate neutral operational content.

Dark theme preserves the same semantic roles through dark navy surfaces (`#0f172a`, `#1e293b`, `#26374d`) and lightened functional signals (`#74baf5`, `#4cd5c4`).

## Typography

**Display Font:** Inter (with system sans-serif fallbacks)

**Body Font:** Inter (with system sans-serif fallbacks)

**Character:** A single, highly legible sans-serif family keeps service information compact and familiar. Weight and spacing, rather than decorative type pairing, establish hierarchy for bilingual operational screens.

### Hierarchy
- **Display** (700, `clamp(1.55rem, 2vw, 1.9rem)`, 1.2): Page titles and primary workspace headings.
- **Title** (600-700, `1.125rem` to `1.5rem`, 1.3): Card, modal, and section titles.
- **Body** (400, `1rem`, 1.5): Requests, instructions, descriptions, and form content.
- **Supporting Text** (400, `0.875rem`, 1.5): Dates, metadata, helper text, and secondary facts.
- **Label** (600, `0.875rem`, 1.5): Form labels, controls, and compact operational headings.

**The Plain-Language Rule.** Interface language must remain legible and direct for users with varied technical familiarity; use hierarchy to clarify work, not to create visual drama.

## Layout

The application uses constrained content widths for scanning: pages cap at `1180px`, primary content at `1100px`, and reading content at `720px`. The base rhythm is a 4px-derived spacing scale from `0.25rem` through `2.5rem`, with `1rem` and `1.5rem` doing most of the daily layout work.

Desktop surfaces favor structured sidebars, page headers, filter rows, lists, and compact grids. Mobile layouts preserve task order, turn header actions into full-width controls where needed, and reserve fixed vertical space for the 72px mobile navigation and 74px sticky actions. Keep controls at least 46px high, and use 50px for large primary actions.

## Elevation & Depth

The system is calmly layered and reassuring. Page regions stay part of the canvas; only working surfaces such as cards, dialogs, dropdowns, and interactive controls receive lift. Light theme uses a two-part soft shadow vocabulary, while dark theme uses stronger diffuse shadows to separate charcoal surfaces without adding bright borders.

### Shadow Vocabulary
- **Working Surface** (`0 2px 0 rgba(15, 23, 42, 0.04), 0 8px 20px rgba(15, 23, 42, 0.10)`): Standard cards, contained tools, and low elevation.
- **Active Surface** (`0 3px 0 rgba(15, 23, 42, 0.05), 0 16px 34px rgba(15, 23, 42, 0.15)`): Dialogs and stronger contextual elevation.

**The Working-Surface Rule.** Lift only elements that users work in or actively manipulate. Do not turn whole page sections into floating cards.

## Shapes

The form language is rounded and substantial without becoming bubbly. Inputs and buttons remain around 12px, repeated work cards stay disciplined, and major editorial/public panels may reach 24–32px. Pills (`999px`) are reserved for compact tags, filters, and status-like affordances. Borders remain visible enough to support scanning in both themes.

## Components

### Buttons
- **Character:** Clear, approachable, and dependable.
- **Shape:** Gently rounded controls (12px; 14px for larger primary actions) with 46px or 50px minimum height.
- **Primary:** Civic blue background with white text and medium-to-bold weight.
- **Hover / Focus:** Darken blue on hover; use a 3px translucent blue focus outline with 2px offset.
- **Secondary / Ghost:** Use neutral surfaces and borders for lower-emphasis actions; reserve danger red for irreversible or destructive actions.

### Chips
- **Style:** Compact, pill-shaped controls for filters, categories, suggestions, and status context.
- **State:** Use blue or teal-tinted surfaces only when state, selection, or positive outcome requires emphasis.

### Cards / Containers
- **Character:** Compact working surfaces rather than decorative page furniture.
- **Corner Style:** 15px card corners.
- **Background:** Clean Surface on Cool Page Blue; use Quiet Surface for secondary grouping.
- **Shadow Strategy:** Working Surface elevation by default; Flat variants remove it when structural grouping is enough.
- **Border:** Soft Structural Border supports separation and dark-theme parity.

### Inputs / Fields
- **Style:** Clean Surface background, Ink Navy text, Soft Structural Border, 11px corners, and 46px minimum height.
- **Focus:** Blue-tinted border and soft blue focus ring.
- **Error / Disabled:** Use the semantic danger or muted token; never rely on color alone to explain a validation state.

### Navigation
- **Style:** Role-aware navigation with direct labels, an active blue state, and compact controls.
- **Mobile Treatment:** Persistent 72px bottom navigation preserves main route access without hiding core tasks behind gestures.

### Status States
- **Style:** Pair a quiet tinted background with a strong readable text color for pending, accepted, attention, in-progress, completed, and danger states.
- **Rule:** Status wording remains explicit; color accelerates scanning but does not replace the label.

## Do's and Don'ts

### Do:
- **Do** use Civic Blue for discovery and primary action, and Trust Teal for confirmed positive state.
- **Do** preserve clear visual hierarchy with short page titles, direct labels, and compact supporting metadata.
- **Do** keep working surfaces readable in both light and dark themes.
- **Do** preserve 46px minimum interactive controls and account for longer Cebuano strings on small screens.
- **Do** use borders, tonal separation, and restrained shadows to make repeated operational content easy to scan.

### Don't:
- **Don't** make the product resemble a generic SaaS dashboard, social feed, or impersonal national marketplace.
- **Don't** use decorative gradients, nested card stacks, oversized headings, or status-pill clutter to compensate for weak information hierarchy.
- **Don't** use low contrast, very small type, or ambiguous icon-only controls for critical workflows.
- **Don't** let brand color override accessibility, readable grouping, or role-specific task clarity.

## Aoxa-reference boundary

The Aoxa screenshots are a visual reference only. Do not add Aoxa-only capabilities such as in-app payments, earnings/withdrawals, provider tracking, an open-job bidding marketplace, app-store badges, Trustpilot blocks, or fabricated marketplace statistics. A SerbisyoToledo UI migration may alter composition and styling, but it must preserve every route, button, conditional action, and code-backed workflow recorded in `docs/UI_FEATURE_PARITY_CHECKLIST.md`.

## Canonical Aoxa mockup source

For the `ui/aoxa-shadcn-visual-shift` branch, the standalone **SerbisyoToledo — Aoxa × shadcn UI Mockup** supplied by the project owner is the authoritative visual reference for most interface geometry and component presentation.

Implementation rule:
- The mockup defines the visual system: public navbar proportions, buttons, icon buttons, hero sizing, section width/spacing, cards, sidebars, workspace topbar, page headers, stats, soft panels, list rows, filters/chips, provider cards, profile layout, request cards, messages, availability, settings, admin tables, auth split layout, dialogs, and footer composition.
- The real SerbisyoToledo application defines functionality and content: routes, permissions, API calls, request lifecycle, booking rules, real assets/uploads, localization, notifications, messaging, verification, moderation, availability, and database contracts.
- Do not invent mockup-only functionality.
- Do not remove existing code-backed actions for visual cleanliness.
- Mobile may use app-native chrome (fixed top app bar, bottom navigation, sheets) while reusing the same mockup component language, spacing, colors, cards, buttons, inputs, chips, and status treatments.
- When an older page stylesheet conflicts with the mockup design, `src/styles/MockupUI.css` is authoritative for the redesigned branch.
