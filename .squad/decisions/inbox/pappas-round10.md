# Pappas — Round 10 Decisions & Observations

## TST-007: Round 10 Test Coverage — Trips, Reviews, Rate Limiting
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

Added 87 new web tests (485 → 572) across 4 files:
- `trips.test.ts` (30): Full CRUD for trip planner API with auth, ownership, and validation coverage.
- `trip-stops.test.ts` (17): Add/remove trip stops with river existence validation, ownership checks, time format validation.
- `reviews.test.ts` (20): Paginated GET (public), POST create/upsert with rating 1-5, rate limiting integration.
- `rate-limit.test.ts` (20): Token bucket algorithm, refill timing, per-IP isolation, stale cleanup, withRateLimit middleware headers (Retry-After, X-RateLimit-Remaining), composition with withAuth.

Pipeline unchanged: 636 passed + 43 skipped. Grand total: 1,251.

---

## BUG: tripUpdateSchema missing endDate >= startDate refinement
**Status:** Open — **Date:** 2026-02-24 — **By:** Pappas

`tripUpdateSchema` in `web/src/lib/validations.ts` uses `.optional()` on all fields but has no `.refine()` to enforce `endDate >= startDate`. The create schema (`tripSchema`) has this refinement, but PATCH requests can set `endDate` before `startDate` without validation error. This inconsistency could produce trips with invalid date ranges.

**Recommendation:** Add a refinement to `tripUpdateSchema` that checks endDate >= startDate when both are provided, or validate against the existing trip's dates when only one of the two is updated.

---

## OBSERVATION: Reviews route lacks sort parameter
**Status:** Observation — **Date:** 2026-02-24 — **By:** Pappas

`GET /api/rivers/:id/reviews` always orders by `createdAt desc` with no `sort` query parameter support. If sorting by rating (highest/lowest) or date is desired, the route handler needs a `sort` param with an `orderBy` switch. Currently tested the default ordering behavior only.
