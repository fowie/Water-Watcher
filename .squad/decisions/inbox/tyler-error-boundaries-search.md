# FE-005: Error Boundary & Loading State Pattern
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

## Decision
Used Next.js App Router file conventions (`error.tsx`, `loading.tsx`, `not-found.tsx`) for error boundaries and loading states at both global and per-route levels.

## Details
- **Global error boundary** (`app/error.tsx`): "use client" component with `reset()` retry and dashboard fallback link.
- **Per-route boundaries**: rivers/[id] has its own `error.tsx` and `not-found.tsx` with route-specific messaging and back-links.
- **Loading skeletons**: Each route group has a `loading.tsx` with skeleton grids matching the page's card layout shape (6 cards for rivers, 8 for deals, stat cards + tabs for river detail).
- All use existing `Skeleton`, `Card`, and `Button` components — no new primitives needed.

## River Search Filters
- Difficulty filter chips are client-side only (filter on fetched data via `useMemo`), no API changes needed.
- Sort dropdown also client-side. Three options: Name A–Z, Recently Updated, Most Hazards.
- Filter chip colors match `RapidRating` component color scheme for visual consistency.

## Favicon
- Used SVG data URL trick with 🏞️ emoji instead of a static file, avoiding the need for image assets.
