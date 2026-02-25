# Utah — Round 11 Decisions

## BD-028: Global Search API Design
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Unified search endpoint at `GET /api/search` searches across rivers, deals, trips, and reviews in a single request. Uses Prisma `contains` with `mode: "insensitive"` for case-insensitive substring matching rather than PostgreSQL full-text search — simpler and sufficient for the current scale.

**Auth strategy:** Rivers and deals are public searches. Trips require authentication and are scoped to the requesting user's trips only. Reviews are public. When `type=all` and user is unauthenticated, trips are silently omitted rather than returning 401 — this keeps the search usable for anonymous users while protecting private data. Requesting `type=trips` explicitly without auth returns 401.

**Result shape:** Grouped by type rather than a flat mixed list, allowing the frontend to render per-section results. Each item includes a `url` field for direct navigation.

---

## BD-029: River Photo Gallery — Max 20 Per User Per River
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Photo uploads enforce a maximum of 20 photos per user per river, checked via `prisma.riverPhoto.count()` before insert. This prevents individual users from flooding a river's gallery while still allowing many users to collectively contribute. Rate limiting at 10 per minute (same `reviewConfig` as review POST) prevents upload spam.

Photo URLs are stored as-is — the API accepts both external URLs and data URLs (base64-encoded). No server-side image processing or cloud storage integration. If image hosting is needed later, a pre-signed upload URL pattern with S3/R2 would replace the direct data URL approach.

Delete is owner-only (403 on mismatch). No admin override — can be added if moderation is needed.

---

## BD-030: Scrape Monitoring — Query-Only, No Schema Changes
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Scrape monitoring API queries the existing `ScrapeLog` model without any schema modifications. Stats are computed at query time via `Promise.all` with parallel Prisma queries (findMany, count, aggregate) rather than pre-computed materialized views. This is acceptable because scrape logs grow slowly (~5 scraper sources × ~6 runs/day = ~30 rows/day) and the admin endpoint is low-traffic.

Both endpoints require authentication but no admin role check — any authenticated user can view scraper stats. If admin-only access is needed, a role field on User would need to be added.
