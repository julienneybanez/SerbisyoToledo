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

**Creative North Star: "The Trusted Local Guide"**

SerbisyoToledo is a clear, practical interface for helping Toledo City residents make dependable local-service decisions. It pairs civic blue for discovery and primary action with trust teal for success, completion, and confidence. The system feels service-oriented rather than corporate: it makes verification, availability, status, and next steps easy to understand without making the screen feel bureaucratic.

The visual rhythm is deliberately operational. Information is organized into readable task surfaces, with short page titles, useful status color, and direct controls. The system accommodates English and Cebuano, light and dark themes, and users with varied technical familiarity. It should feel grounded in local community work, not like a generic SaaS dashboard or social feed.

**Key Characteristics:**
- Cool, readable surfaces with blue discovery and teal confirmation signals.
- Calmly layered working surfaces, not floating page sections.
- Rounded but disciplined controls sized for repeated desktop and mobile use.
- Compact, approachable typography that favors scanning and task completion.
- Clear role-specific navigation without generic-template sterility.

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

The form language is gently rounded, not bubbly. Inputs use 11px corners, standard controls use 12px, cards use 15px, and larger contained surfaces reach 18px. Pills (`999px`) are reserved for compact tags, filters, and status-like affordances. Borders are cool and visible enough to support scanning in both themes.

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