# SerbisyoToledo UI Design System

This guide defines the UI rules for new frontend work and gradual refactors.

## Stack ownership

- **React** builds application components and behavior.
- **Bootstrap** remains the layout, grid, form, and utility foundation.
- **SerbisyoToledo shared UI components** are the preferred layer for repeated product UI.
- **Bootstrap Icons** are the default icon system for public, client, provider, and mobile UI.
- Do not add another UI framework or icon library without a specific need.

## Design tokens

Use values from `src/styles/tokens.css` instead of introducing one-off colors, spacing, radii, shadows, typography sizes, or motion timings.

Prefer semantic tokens such as:

- `--color-primary`
- `--color-surface`
- `--color-surface-secondary`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-border`
- `--radius-control`
- `--radius-card`
- `--shadow-sm`
- `--control-height`
- `--motion-normal`

Light and dark theme values belong in the token file. Avoid page-specific dark-mode colors unless a page has a genuinely unique visual need.

## Typography

Inter is the single application font through `--font-sans`.

Use existing type tokens before creating new sizes:

- `--text-xs`
- `--text-sm`
- `--text-base`
- `--text-lg`
- `--text-xl`
- `--text-page-title`

## Shared React primitives

Shared components live in `src/components/ui/`.

Available primitives:

- `AppButton`
- `AppCard`
- `PageContainer`
- `PageHeader`
- `SectionCard`
- `StatusBadge`
- `FormField`
- `EmptyState`

Import from the barrel when possible:

```jsx
import { AppButton, PageHeader, SectionCard } from '../components/ui';
```

Existing page class names may be retained during migration to avoid visual regressions.

## Buttons

Use one of the shared variants:

- `primary` — main action
- `secondary` / `outline` — supporting action
- `ghost` — low-emphasis action
- `danger` — destructive action

Avoid inventing new button shapes, heights, or radii in page CSS.

## Cards and sections

Use `AppCard` or `SectionCard` for repeated application surfaces.

Provider/service cards may remain specialized, but settings panels, generic dashboard blocks, empty states, and utility sections should share the same radius, border, surface, and shadow vocabulary.

## Page structure

New product pages should prefer:

```jsx
<PageContainer>
  <PageHeader title="Page title" />
  <SectionCard>
    ...
  </SectionCard>
</PageContainer>
```

Existing pages can migrate incrementally. Do not rewrite a stable page only to adopt shared wrappers.

## Responsive behavior

Use shared page/container spacing and Bootstrap breakpoints before adding page-specific breakpoints.

Always verify:

- desktop light
- desktop dark
- mobile light
- mobile dark

Mobile navigation and bottom tabs are product behavior and must not be removed during visual refactors.

## Motion

Use the shared motion variables and `Motion.css`. Respect `prefers-reduced-motion`.

Animations should clarify hierarchy or state changes, not delay navigation or interaction.

## Refactor rules

1. Preserve routes, API calls, state behavior, and authorization logic during UI-only work.
2. Prefer shared tokens/components over new one-off CSS.
3. Use Bootstrap Icons across public, client, provider, and admin UI.
4. Keep admin styling within the same SerbisyoToledo token system instead of introducing a separate UI framework.
5. Do not introduce Tailwind, MUI, shadcn/ui, CoreUI, or another UI framework into the current capstone version.
6. Migrate incrementally and test each page in desktop/mobile and light/dark modes.
