## BD-004: Database Seed Script Strategy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Seed script at `web/prisma/seed.ts` uses `upsert` for entities with stable unique keys (user by id, rivers by awId, deals by url, filter by id). For child entities without unique constraints (conditions, hazards, campsites, rapids), uses `deleteMany` + `createMany` to stay idempotent. This avoids duplicates on repeat runs while keeping the script simple. Demo user ID is `"demo-user"` to match FE-004.

---

## BD-005: Service Worker — Notifications Only
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Service worker at `web/public/sw.js` handles only push notifications (push event, notificationclick, activate/claim). No caching or offline strategy — Next.js handles asset caching, and adding a cache layer would conflict with Next.js's own service worker behavior. Notification payloads are JSON with `{ title, body, url, tag }`.

---

## BD-006: River DELETE Endpoint
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Added `DELETE /api/rivers/:id` returning 204 on success, 404 if not found. Cascade deletion handled by Prisma schema (`onDelete: Cascade` on all river child relations). No auth check yet — will need one when user management is implemented (aligns with FE-004 temporary demo user approach).
