# FE-007: Settings Page, Edit River Dialog, MapLink & Accessibility

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

## Settings Page
New `/settings` route with three sections:
1. **Notification Preferences** — lists deal filters with toggle switches, shows active count badge
2. **Data Management** — DB connection check + clear local cache (preserves theme)
3. **About** — version badge ("Water-Watcher v0.1.0"), GitHub repo link

Settings added to navigation sidebar and mobile tab bar.

## Edit River Dialog
`EditRiverDialog` component opens from river detail page header. Pre-fills form, validates with `riverUpdateSchema` (Zod), calls `PATCH /api/rivers/[id]`, refreshes page data on success.

## MapLink Component
Reusable `MapLink` component replaces inline Google Maps links. Props: `latitude`, `longitude`, `label`, `showLabel`. Used in river detail header and campsites tab.

## Accessibility
- Skip-to-content link in root layout
- `aria-label` on all icon-only buttons (theme toggle, delete, menu, view deal)
- `aria-hidden="true"` on decorative icons
- `aria-expanded` on mobile menu toggle
- `role="group"` on notification toggle, `role="main"` on content wrapper
- Named `<nav>` landmarks via `aria-label`
- Page-level `<title>` via route layouts with template pattern
- Keyboard-focusable delete button (focus:opacity-100)
- Screen-reader-only labels on settings filter toggles
