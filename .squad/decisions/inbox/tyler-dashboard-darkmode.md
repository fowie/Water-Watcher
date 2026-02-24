# FE-005: Dashboard Homepage, River Delete, Dark Mode Toggle

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

## Dashboard Homepage
Replaced the static hero/marketing page (`web/src/app/page.tsx`) with a functional dashboard. Shows quick stats row (rivers tracked, active hazards, gear deals, active filters), recent conditions (last 5 rivers), and latest deals (3 most recent). Client component with `useEffect` + `Promise.allSettled` for resilient multi-endpoint fetching. Loading skeletons and empty states included.

## River Card Delete
Added a delete button (Trash2 icon) to `river-card.tsx` that appears on hover in the top-right corner. Uses `window.confirm()` before calling `DELETE /api/rivers/{id}` via new `deleteRiver(id)` function in `api.ts`. `onDelete` callback prop triggers parent refresh. Rivers page passes `onDelete={fetchRivers}` to all cards.

## API Fix: getRivers Paginated Response
Fixed `getRivers` in `api.ts` — it was treating the API response as a bare array, but the API returns `{ rivers, total, limit, offset }`. Added `RiversResponse` export interface. Added `limit`/`offset` params. Updated rivers page to destructure `.rivers` from the result.

## Dark Mode Toggle
Created `theme-toggle.tsx` — toggles `dark` class on `<html>`, stores preference in `localStorage`, respects system `prefers-color-scheme` on first load. Uses Sun/Moon icons. Added to both desktop sidebar footer and mobile header in `navigation.tsx`. Added `html.dark` CSS custom property block in `globals.css` mirroring the existing `@media (prefers-color-scheme: dark)` variables.

### Files Changed
- `web/src/app/page.tsx` — Full rewrite: hero → dashboard
- `web/src/components/river-card.tsx` — Added delete button + onDelete prop
- `web/src/lib/api.ts` — Fixed getRivers, added RiversResponse, added deleteRiver
- `web/src/app/rivers/page.tsx` — Updated for new getRivers response shape, passes onDelete
- `web/src/components/theme-toggle.tsx` — New file
- `web/src/components/navigation.tsx` — Added ThemeToggle to desktop + mobile nav
- `web/src/app/globals.css` — Added html.dark CSS variables block

### Build Verification
`npx next build` — ✅ compiled successfully, all types valid, no errors.
