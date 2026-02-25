## TST-008: Round 11 Test Coverage — Search, Photos, Scrapers
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

Added 96 new web tests across 3 files. Web: 572 → 668. Pipeline unchanged (636 + 43 skipped). Grand total: 1,347.

**New test files:**
- `search.test.ts` (32 tests): Global search API — q param validation, grouped result shapes, type filters (rivers/deals/trips/reviews/all), auth enforcement for trips, limit clamping, case-insensitive search, no-match empty arrays, null field subtitle fallbacks.
- `river-photos.test.ts` (31 tests): GET paginated photos (public), POST create with auth/validation/20-photo-limit/rate-limiting, DELETE owner-only with 403/404 handling.
- `scrapers.test.ts` (33 tests): Admin scraper summary (auth-required, 5 sources, 24h stats, system stats), per-source detail (log entries, aggregate stats, success rate, valid source enforcement).

**Observations:**
- Search route's `type=all` silently skips trips when user is unauthenticated — correct behavior but undocumented for API consumers.
- Scraper stats `VALID_SOURCES` array is case-sensitive — "USGS" returns 400. This is consistent but could trip up API callers.
- River photos POST uses `withRateLimit(withAuth(...))` composition — rate limit check runs before auth, so unauthenticated flood requests consume rate limit tokens.
