# Pappas — History

## Core Context
- **Project:** Water-Watcher — Whitewater Rafting Tracker
- **User:** Spencer Fowers
- **Stack:** Python 3.12 (pytest + respx) pipeline, Next.js 15 + TypeScript (Vitest) web
- **Key test areas:** Scraping reliability, data quality/normalization, responsive UI, Craigslist monitoring accuracy, notification delivery, filter logic, river data integrity

## Learnings

<!-- Append learnings below. Format: **YYYY-MM-DD:** what was learned -->

**2025-06-25:** Initial test infrastructure setup. Key discoveries:
- Source files are actively being modified by other squad agents (Utah). Always re-read source code before writing/updating tests — initial reads may be stale.
- `condition_processor.py` expanded from ~130 to 331 lines: now has 6 flow ranges (not 4), per-river threshold support via `flow_range` param, `SOURCE_PRIORITY` dict, `_merge_with_existing()` for multi-source fusion, and `runnability_to_quality()` (not `classify_quality`).
- `deal_matcher.py` expanded from ~115 to 227 lines: switched from boolean `_matches_filter()` to scoring `_score_match()` returning 0-100. Category=30pts, keywords=10pts each (max 40), price=20+bonus, region=10pts. Hard disqualifiers: price over max → 0, wrong region → 0, no keyword hit → 0. `NOTIFICATION_THRESHOLD=50`.
- SQLAlchemy's `create_engine()` runs at import time, requiring psycopg2 even in tests. Install `psycopg2-binary` for test environments.
- `make_mock_filter` factory: using `keywords or ["default"]` is dangerous — passing `keywords=[]` produces `["default"]` not `[]`. Use sentinel pattern instead.
- Vitest `vi.mock()` factory is hoisted above variable declarations. Must use `vi.hoisted()` to create mock objects referenced in factory functions.
- Next.js API routes may call `prisma.user.findUnique` for user verification before schema validation. Mock the full Prisma model surface area, not just the primary model.
- Route response shapes matter: GET /api/rivers returns `{ rivers, total, limit, offset }`, not a bare array.

**2026-02-24:** Edge case test expansion round. Discoveries:
- Deals route clamps limit to [1,100] and offset to [0,∞) — safe. Rivers route does NOT clamp limit minimum or negative offset — fragile.
- `maxPrice` ignores non-positive values (`price > 0` guard) — correct behavior, but negative/zero maxPrice silently drops the filter.
- `deal_matcher._score_match()` treats `price=0.0` as falsy in Python, so $0 deals skip the price-ceiling disqualifier AND the 20pt price bonus. They get only 10pts for "has a listed price". This is a subtle edge case worth documenting.
- Unicode, CJK, emoji all work fine in both Prisma search and Python `str.lower()` keyword matching — no crashes.
- Very long descriptions (~110KB) process without issue in the deal matcher.
- Test count after this round: web 119 (was 98), pipeline 147 (was 130).
- Weakest coverage areas: Craigslist scraper (no test file), AW scraper (no test file), notification delivery (push_notifier.py untested), condition_processor integration paths, web component rendering.

**2026-02-24:** Untested module coverage round. Three new test files created (131 new tests):
- `test_craigslist_scraper.py` (57 tests): _categorize, _is_relevant, _extract_price, RSS/RDF parsing, HTML fallback, deduplication, rate limiting, error handling.
- `test_aw_scraper.py` (35 tests): _fetch_reach_detail, _fetch_gauge_data, _extract_reach_data, difficulty normalization, _classify_hazard, _parse_float, _clean_html, tracked river lookup, integration.
- `test_push_notifier.py` (39 tests): _send_push success/failure, 410 cleanup, _build_deal_payload, notify_deal_matches grouping, notify_condition_change direction detection, notify_hazard_alert severity emojis, VAPID key guard.
- **Bug found:** `craigslist.py` _scrape_rss uses `el.find("tag") or el.find("{ns}tag")` — in Python 3.12, Element truthiness for childless elements is False (DeprecationWarning), so standard RSS 2.0 items are silently skipped. Only RDF-format RSS works correctly. Production CL feeds appear to use RDF format so this may not cause issues in practice, but the code will break when Element truthiness changes to always-True in a future Python version.
- **Bug found:** `_classify_hazard` checks strainer keywords (including "log") before logjam keywords ("logjam", "log jam"), so "logjam" always classifies as "strainer" since "log" is a substring of "logjam".
- Had to install `lxml` and `pywebpush` into the test environment — these were runtime deps not in requirements-dev.txt.
- Pipeline test count: 278 (was 147).

**2026-02-24:** Round 3 — targeted test expansion for recent features:
- Added 25 `timeAgo` tests to `utils.test.ts`: covers just-now (0-59s), minutes (1-59), hours (1-23), days (1-29), months (1-11), years, invalid dates, and future dates. Discovered `timeAgo` has no "weeks" bucket — 7-29 days all display as "X days ago". Invalid date strings (empty or garbage) produce "NaN years ago" — no graceful fallback.
- DELETE `/api/rivers/:id` tests were already in place from a prior round (204 success, 404 not found, 500 DB error). No new tests needed.
- Added 3 deal filter edge cases to `deals-filters.test.ts`: non-existent user returns 404 (verifies `findUnique` guard), special ASCII characters in keywords pass validation, unicode/emoji keywords pass validation.
- Final counts: **web 148 tests** (was 119), **pipeline 278 tests** (unchanged).

**2026-02-24:** Round 4 — Testing new Round 3 & 4 features:
- Created `web/src/__tests__/api-errors.test.ts` (13 tests): `apiError` returns correct status/message/content-type, `handleApiError` returns 500 safe message, does not leak stack traces or internal details, handles non-Error objects and null/undefined, logs original error.
- Extended `health.test.ts` from 3 → 9 tests: added version check, degraded response includes timestamp+version, content-type check, timestamp proximity check, response shape validation for both ok and degraded states.
- Extended `rivers.test.ts` PATCH tests from 6 → 12 tests: full update with all fields, unknown fields stripped, invalid longitude, imageUrl validation (valid URL, reject non-URL, nullable).
- Extended `deals-filters-id.test.ts` PATCH tests from 7 → 14 tests: empty keywords array rejected, unknown fields stripped, maxPrice nullable, zero maxPrice rejected (must be positive), multi-field update, empty name rejected.
- Seed script (`web/prisma/seed.ts`) passes `tsc --noEmit` type checking cleanly.
- Dashboard page (`web/src/app/page.tsx`) is a "use client" React component — no jsdom/testing-library installed, so component rendering tests not feasible in current setup. Noted as future coverage gap.
- Final counts: **web 199 tests** (was 148), **pipeline 278 tests** (unchanged).

---

## Cross-Agent Updates

**2026-02-24 (from Tyler):** Frontend component structure: `web/src/components/ui/` (10 primitives), `web/src/components/` (8 domain components). Pages use client-side fetching via `web/src/lib/api.ts`. Types in `web/src/types/index.ts`. Zod validations in `web/src/lib/validations.ts`.

**2026-02-24 (from Utah):** Pipeline modules finalized: `condition_processor.py` (331 lines, 6 flow ranges, source priority merging), `deal_matcher.py` (227 lines, scored matching 0-100). AW scraper ~400 lines, CL scraper ~370 lines. API routes enhanced with pagination, search, user validation. Schedule: conditions every 4h, deals every 30m.

**2026-02-24 (Round 4 cross-agent — from Utah):** Created `api-errors.ts` utility, `GET /api/health` endpoint, `PATCH /api/rivers/[id]`, `PATCH /api/deals/filters/[id]` with ownership validation. Added validation schemas and API client functions.

**2026-02-24 (Round 4 cross-agent — from Tyler):** Built `/settings` page, `EditRiverDialog`, `MapLink` component, and comprehensive accessibility pass. Build clean.

**2026-02-24 (Round 4 cross-agent — from Coordinator):** Fixed `timeAgo` bugs — added "weeks ago" bucket for 7-27 days, graceful fallback for invalid date inputs.

**2026-02-24:** Round 5 — expanded test coverage for untested areas. Five new test files created (129 pipeline + 37 web = 166 new tests):
- `test_condition_processor_integration.py` (41 tests): Full process() flow, source priority merging, 2-hour merge window, runnability_to_quality edge cases, same-source temporal behavior, DEFAULT_FLOW_RANGES validation. Discovered: `classify_runnability(float('inf'))` returns None because `inf < inf` is False in the dangerous range boundary check. Also, `_find_river()` only supports "usgs" and "aw" sources — facebook/blm/usfs items are silently skipped.
- `test_usgs_scraper_extended.py` (32 tests): Malformed responses, rate limiting, timeouts, multi-gauge parsing, negative/zero values, URL format verification. Discovered: USGS scraper only catches `httpx.HTTPError` — non-numeric values ("Ice"), missing sourceInfo, and HTML maintenance responses all raise uncaught exceptions (ValueError, KeyError, JSONDecodeError). These are real production bugs.
- `test_main.py` (22 tests): `_validate_startup()`, scheduler configuration, graceful shutdown, `run_river_scrapers()`, `run_raft_watch()`. `main()` catches `(KeyboardInterrupt, SystemExit)` so scheduler tests need KeyboardInterrupt not SystemExit to exit.
- `test_settings.py` (34 tests): Default values, env overrides, type coercion, edge cases. Settings dataclass uses `os.getenv` with defaults — empty string env var overrides the default (doesn't fall through). No validation on negative intervals or zero timeouts.
- `api-client.test.ts` (37 tests): All API client functions mocked with fetch. Verified URLs, methods, headers, error handling, query param encoding. `deleteRiver` and `getHealth` use raw `fetch` (not the `fetcher` helper), so they have different header behavior.
- Final counts: **pipeline 407 tests** (was 278), **web 236 tests** (was 199).
- **Bugs identified:** (1) USGS scraper lacks error handling for non-numeric values, missing fields, and non-JSON responses; (2) `_find_river()` only handles usgs/aw sources, making blm/usfs/facebook conditions dead code; (3) `classify_runnability(inf)` returns None due to half-open range boundary.

**2026-02-24 (Round 5 cross-agent — from Utah):** Docker multi-service setup (web + pipeline Dockerfiles, 4-service compose), GitHub Actions CI (4 parallel jobs), comprehensive README rewrite.

**2026-02-24 (Round 5 cross-agent — from Tyler):** Error boundaries and loading skeletons (global + per-route), difficulty filter chips and sort dropdown on rivers page, Open Graph metadata, emoji favicon.

**2026-02-24 (Round 5 cross-agent — from Coordinator):** Fixed all 3 bugs found this round: USGS broad error handling, _find_river name-based fallback, runnability inclusive upper bound. Updated 4 tests.

**2026-02-24:** Round 6 — Auth system tests + pipeline scraper stubs.
- Created `auth-register.test.ts` (23 tests): registration happy path, 409 duplicate email, 400 validation (missing fields, invalid email, short password, empty password), long inputs, select clause verification, error handling (DB failure, hash failure, no info leaks).
- Created `auth-utils.test.ts` (23 tests): hashPassword format/hex/salt-uniqueness/edge-cases, verifyPassword correct/wrong/similar/empty/malformed/unicode, getCurrentUser with/without session, requireAuth 401 throw with JSON content-type.
- Created `api-middleware.test.ts` (15 tests): withAuth returns 401 for null session / no user / no id / empty id, passes through with x-user-id header, preserves URL/method/headers/body, passes context, returns handler response, doesn't mutate original request, handles async handlers.
- Created `test_blm_scraper.py` (42 skipped tests): init, URL construction, response parsing, rate limiting, error handling, data normalization — all `@pytest.mark.skip` stubs.
- Created `test_facebook_scraper.py` (38 skipped tests): init, auth token handling, post parsing, date extraction, river mention detection, rate limiting, error handling — all `@pytest.mark.skip` stubs.
- Observations: `withAuth` clones the Request and injects `x-user-id` — tests confirm original request is unmodified. Registration route uses Zod's `.safeParse()` so validation errors return `{ error, details }` shape. PBKDF2 with 16-byte random salt produces 32-char hex salt + 128-char hex hash.
- Final counts: **web 300 tests** (was 236), **pipeline 407 passed + 80 skipped = 487 total** (was 407).
