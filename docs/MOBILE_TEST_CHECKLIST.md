# SerbisyoToledo Mobile Test Checklist

## Viewports
- 320px
- 360px
- 375px
- 390px
- 412px
- 768px
- Desktop (>= 1024px)

## Orientation
- Portrait for all viewports
- Landscape for 360px, 390px, and 768px where practical

## Device Emulation Targets
- Small Android phone
- Standard Android phone
- iPhone-sized viewport
- Tablet

## Core Navigation
- Public routes still use desktop navbar on desktop
- Authenticated mobile routes use compact top bar and bottom navigation
- Bottom navigation role mapping is correct for client, tradesperson, and admin
- Active nav state is correct on each route
- Bottom navigation is hidden on login, register, forgot password, verify email, and reset password
- No page content is hidden behind fixed bottom navigation

## Landing and Browse
- Landing search input and button do not overflow
- Browse search bar remains visible and touch-friendly on mobile
- Category chips scroll horizontally and show active state
- Filter button shows active filter count
- Mobile filter sheet opens, traps focus, closes via close button and overlay
- Filter reset and show results actions work

## Provider Cards and Profiles
- Provider cards are compact and readable on 320px
- View Profile action remains easy to tap
- Provider profile sections remain readable on mobile
- Mobile sticky action bar shows starting price and request action
- Request action is disabled when provider is unavailable/unpublished

## Booking Flow
- Booking opens in mobile-friendly sheet/modal on small screens
- Step progress label and progress bar update correctly
- Sticky footer actions remain visible during scroll
- Date, time, details validation still works
- Submit request still uses existing API flow
- Closing booking restores page scroll

## Requests
- Status tabs are horizontally scrollable on mobile
- Request cards do not overflow horizontally
- Request details action remains available and visible
- Client/provider role-specific actions remain intact

## Admin Mobile
- Admin mobile top bar appears on small screens
- Admin mobile bottom nav routes work
- Admin sidebar closes after link tap on small screens
- Admin users mobile cards remain actionable
- Desktop admin tables/layout remain intact on desktop

## Authentication
- Login and register pages have no horizontal overflow
- Input fields are usable with mobile keyboard
- Primary actions remain full width and easy to tap

## Accessibility
- Bottom sheet and modals close with Escape on desktop keyboards
- Focus is trapped inside mobile filter sheet when open
- Icon-only controls have labels
- Interactive controls meet touch target expectations where practical

## States
- Loading, empty, and error states are readable on mobile
- Long names, long locations, and long descriptions do not break layout

## Deploy Verification
- Validate behavior in local dev and deployed Vercel environment
- Verify API-dependent flows against Railway backend
