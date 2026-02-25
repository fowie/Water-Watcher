# Utah — Round 10 Decisions

## BD-025: Trip Planner API Design
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Trip planner uses two models: `Trip` (container with status/dates) and `TripStop` (per-day river assignments). Stops are a sub-resource of trips rather than a separate top-level entity, matching REST conventions.

**Status workflow:** `planning` → `active` → `completed` (or `cancelled` at any point). Default is `planning`. No automatic status transitions — client controls this via PATCH.

**Access control:** Trips are private by default (`isPublic: false`). GET trip detail allows access to owner or any authenticated user if `isPublic: true`. List endpoint (`GET /api/trips`) only returns the authenticated user's own trips.

**Stop validation:** Adding a stop validates that the referenced river exists (404 if not). Stops include `putInTime`/`takeOutTime` as simple `HH:MM` strings — not DateTime — because they represent planned times without timezone complexity.

## BD-026: River Reviews — One Per User Per River (Upsert Pattern)
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Reviews use a `@@unique([riverId, userId])` constraint enforcing one review per user per river. The POST endpoint uses `prisma.riverReview.upsert()` so submitting a review for a river you've already reviewed updates the existing one instead of returning a conflict error. This matches the UX pattern of "edit your review" rather than "you already reviewed this."

GET reviews endpoint is public (no auth required) and includes paginated reviews with user info (id, name, image) plus an aggregate `averageRating` via `prisma.riverReview.aggregate()`.

## BD-027: In-Memory Rate Limiting with Token Bucket
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Rate limiting uses an in-memory token bucket algorithm rather than Redis or database-backed counters. This is appropriate for a single-instance deployment: no external dependencies, sub-millisecond per check, and sufficient for abuse prevention.

**Trade-offs:**
- Rate limit state resets on server restart (acceptable for abuse prevention, not for billing)
- Not shared across instances in a multi-server deployment (would need Redis upgrade if scaling horizontally)
- Memory growth bounded by stale entry cleanup (entries > 5min old are purged every 60s)

**Composition pattern:** `withRateLimit(handler, config)` is a HOF that composes with `withAuth()`:
```typescript
export const POST = withRateLimit(withAuth(handler), strictAuthConfig);
```
Rate limit check runs first (before auth), so unauthenticated flood requests are rejected cheaply without hitting the auth/DB layer.

**Applied limits:** Registration at 5/min (strict — prevents credential stuffing), review POST at 10/min (moderate — prevents spam). General API default is 60/min but not yet applied globally.

**Testing impact:** Token bucket state persists across tests within a single vitest run. Tests for rate-limited endpoints must mock `@/lib/rate-limit` to avoid exhausting tokens. Added mock to `auth-register.test.ts`.
