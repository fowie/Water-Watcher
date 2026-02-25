# FE-010: Profile, Compare, Favorites Features

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

## User Profile Page
- Route: `/profile`, protected by `AuthGuard`
- Inline edit for name/email via PATCH `/api/user/profile` (already existed from Utah)
- Session refreshed after edits so nav reflects changes

## River Comparison View
- Route: `/rivers/compare?rivers=id1,id2,id3`
- Shareable URLs via query params (2-3 rivers max)
- Desktop: comparison table. Mobile: stacked cards.
- "Compare" button on rivers page enters selection mode (checkbox UI on cards)

## Tracked Rivers / Favorites
- Route: `/rivers/favorites`, protected by `AuthGuard`
- New API: `GET/POST/DELETE /api/user/rivers` — all `withAuth()`-protected
- Uses existing `UserRiver` model (already in Prisma schema)
- Star/heart icon on river cards toggles tracking
- "My Rivers" nav link added to `authNavItems` (visible only when authenticated)

## Navigation Changes
- Added "My Rivers" (Star icon) to sidebar/bottom bar (auth-only)
- Added "Profile" link in user menu dropdown (above Settings)
- Mobile avatar now links to `/profile`

## For Utah: No schema changes needed. The `UserRiver` model was already in Prisma. Three new API route handlers at `/api/user/rivers` use standard `withAuth()` + Prisma patterns.

## For Pappas: New test targets — `/api/user/rivers` (GET/POST/DELETE), profile page rendering, compare page rendering, favorites page rendering.
