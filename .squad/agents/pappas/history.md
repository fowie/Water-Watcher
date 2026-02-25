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

**2026-02-24 (Round 6 cross-agent — from Utah):** Implemented NextAuth.js v5 with Credentials provider, JWT strategy, PBKDF2 hashing. `withAuth()` HOF validates session and injects `x-user-id`. Registration at `POST /api/auth/register` with Zod validation. Public routes: GET rivers/deals. Auth-required: all writes, deal filters, notifications. Key files: `auth.ts`, `auth-utils.ts`, `api-middleware.ts`.

**2026-02-24 (Round 6 cross-agent — from Tyler):** Auth UI complete: sign-in/register pages (full-screen centered cards, no nav chrome), `AuthGuard` (useSession + redirect), `SessionProvider` wrapping app, `UserMenu` in sidebar/header. Settings uses `session.user.id` instead of `DEMO_USER_ID`. 15 routes, build clean.

**2026-02-24:** Round 7 — Scraper + API coverage for new features. Four test files created/rewritten (204 new tests):
- Rewrote `test_blm_scraper.py` (88 tests, replacing 42 skipped stubs): init, advisory type classification, severity classification, river name extraction, date parsing, API response parsing (list/dict with alerts/results/features keys), RSS 2.0 + Atom feed parsing, rate limiting, error handling (timeout/HTTP errors/non-JSON), full scrape integration. Discovered: BLM `ADVISORY_TYPE_MAP` dict ordering means "winter closure" matches "closure" keyword first — reported as behavioral quirk, not bug. Also, `_extract_river_name` regex `(?:\s+[A-Z][a-z]+)*` greedily captures multi-word sequences across combined title+area+description — if the river name appears in multiple fields, it matches a longer-than-expected string.
- Created `test_usfs_scraper.py` (71 tests): init, API key gating (warns/skips when RIDB_API_KEY is missing), alert type classification, severity classification, river name extraction from facility names/descriptions, date parsing, facility alert parsing, rec area alert parsing, HTTP mocked fetch tests for facilities/alerts/rec areas, rate limiting verification, full scrape integration with combined facility+rec area alerts.
- Created `user-profile.test.ts` (22 tests): GET returns profile with river/filter counts, 404 for missing user, no passwordHash leak, correct user ID passed to Prisma; PATCH updates name, email, both, 400 for no fields/empty name/invalid email/non-string types, 409 for duplicate email (allows own email), 401 for unauthenticated, 500 for DB errors.
- Created `user-rivers.test.ts` (23 tests): GET lists tracked rivers with latest conditions/hazard counts/tracker counts, null latestCondition when no conditions, empty array when none tracked; POST adds river (201), 404 for nonexistent river, 409 for duplicate, 400 for missing/invalid riverId, verifies river existence before duplicate check; DELETE removes (204), 404 for non-tracked, 400 for missing riverId, verifies composite key in delete call. All 401 for unauthenticated.
- Final counts: **pipeline 566 passed + 43 skipped = 609 total** (was 407 passed + 80 skipped), **web 345 tests** (was 300).

**2026-02-24 (Round 7 cross-agent — from Utah):** Created BLM scraper (BLM recreation API + RSS, advisory classification, river name regex extraction) and USFS scraper (RIDB API with key gating, facility + rec area alerts). Both on 6-hour schedule. Created `GET/PATCH /api/user/profile`. New settings: `BLM_BASE_URL`, `RIDB_API_KEY`, `LAND_AGENCY_INTERVAL_MINUTES`.

**2026-02-24 (Round 7 cross-agent — from Tyler):** Built `/profile` (inline edit, session refresh), `/rivers/compare` (shareable URLs, 2-3 rivers, desktop table / mobile cards), `/rivers/favorites` (tracked rivers with star toggle). Created `GET/POST/DELETE /api/user/rivers`. Enhanced river cards with star button and compare selection mode. 20 routes.

**2026-02-24:** Round 8 — Email notifier tests + new API endpoint coverage.
- Created `test_email_notifier.py` (70 tests): `_is_configured` guard (API key missing → False + debug log), `_send` success/error/logging, `send_deal_alert` (single/multi subjects, HTML contains title/price/category/region/URL, N/A for null price, correct recipient, branding), `send_condition_alert` (improved=🟢/deteriorated=🔴/changed=🟡, river name in subject+HTML, old/new quality, detail rows for flow_rate/gauge_height/water_temp, river_id link, no-details hides table, unknown quality fallback), `send_hazard_alert` (danger/warning/info emojis, top-severity priority, hazard count pluralization, description truncation at 200 chars, missing description graceful), `send_weekly_digest` (subject, river names, quality badges, flow rate, runnability title-cased, hazard count display, missing flow shows dash, unknown/null quality fallback), template structure (DOCTYPE, footer, header branding), Resend error types (ConnectionError, TimeoutError).
- Created `notification-prefs.test.ts` (22 tests): GET returns defaults when none exist (creates via Prisma), GET returns existing prefs, queries by authenticated user ID, 401 for unauthenticated/no-user-id, 500 on DB error; PATCH updates channel (email/both/push), rejects invalid channel ("sms", empty string), updates boolean fields, rejects non-boolean dealAlerts/conditionAlerts, rejects empty body, ignores unknown fields, only-unknown-fields → 400, upsert called with correct shape, single-field update doesn't touch others, 500 on DB error.
- Created `alerts.test.ts` (24 tests): paginated response shape, empty results, type filter (deal/condition/hazard/digest), no filter returns all, custom limit/offset, limit clamped to [1,100], `limit=0` is falsy → falls to default 20 (edge case documented), negative limit → 1, negative offset → 0, non-numeric params fallback, ordering by sentAt desc, combined type+pagination params, count uses same where clause, 401 for unauthenticated, 500 on DB error.
- Facebook scraper stubs: still 43 `@pytest.mark.skip` stubs — left untouched, scraper not implemented.
- **Edge case found:** Alerts route `parseInt("0") || 20` makes `limit=0` silently become 20 rather than clamping to 1. The `||` fallback treats 0 as falsy. Not a bug per se (0 items is meaningless), but inconsistent with `limit=-5` which gets `Math.max(-5, 1) = 1`.
- Final counts: **pipeline 636 passed + 43 skipped = 679 total** (was 566+43=609), **web 387 tests** (was 345).

**2026-02-24 (Round 8 cross-agent — from Utah):** Built `EmailNotifier` (Resend API) with 4 alert types. Inline HTML templates, graceful skip when no API key. `NotificationPreference` model (channel + per-type booleans) and `AlertLog` model in Prisma + SQLAlchemy. Notification prefs API (`GET/PATCH /api/user/notifications`), alert history API (`GET /api/alerts`). Google + GitHub OAuth providers. Key test file: `pipeline/notifiers/email_notifier.py`.

**2026-02-24 (Round 8 cross-agent — from Tyler):** OAuth buttons on sign-in/register pages. `GlobalNotificationPreferences` section on Settings (channel selector, toggle switches). Alert history page `/alerts` with filter tabs, paginated cards, Load More. `NotificationBell` in nav with unread badge and 60s polling. Key test files: `web/src/__tests__/api/notification-prefs.test.ts`, `web/src/__tests__/api/alerts.test.ts`.

**2026-02-24 (Round 8 cross-agent — from Coordinator):** Fixed alerts API `limit=0` edge case: `parseInt(param) || 20` treats 0 as falsy. Changed to `Number.isFinite(parsed) ? parsed : 20`.

**2026-02-24:** Round 9 — Test coverage for SSE, Export, and SSE client features.
- Created `web/src/__tests__/api/sse-rivers.test.ts` (19 tests): SSE response headers (Content-Type text/event-stream, Cache-Control no-cache, Connection keep-alive, X-Accel-Buffering no), retry:5000 directive sent first, empty DB returns no events, condition-update events with full data shape, multiple conditions as separate events, hazard-alert events, deal-match events, combined initial snapshot, Prisma query structure verification (1-hour window, active-only hazards, take limits), JSON format validation, null field handling (flowRate, gaugeHeight, waterTemp, quality, runnability, description, price, category), Prisma error graceful handling.
- Created `web/src/__tests__/api/export.test.ts` (41 tests): Auth protection (401 without session, 401 without user id), validation (400 for missing/invalid format, missing/invalid type), JSON export (correct Content-Type/Content-Disposition, proper structure for rivers/conditions/deals, type=all includes all sections, empty data), CSV export (correct headers, section headers for rivers/conditions/deals, comma/quote escaping, type=all has all sections, empty data still has headers), GPX export (correct Content-Type application/gpx+xml, valid XML with waypoints, rivers without lat/lng excluded, 400 for conditions-only/deals-only GPX, type=all GPX works, XML special character escaping, desc field combines state|region|difficulty), 30-day condition date range, user scoping (userRiver lookup, riverId filtering, deal filter userId), 500 on DB error.
- Created `web/src/__tests__/lib/sse-client.test.ts` (38 tests): createSSEClient creates EventSource with URL, cleanup closes EventSource, registers onOpen/onError handlers, no listeners for unset handlers, parses condition-update/hazard-alert/deal-match events correctly, silently ignores invalid JSON for all event types, supports all handlers simultaneously. Weather utility logic validation: WMO weather code→description mapping (15 tests covering all code ranges + gaps + unknowns), temperature conversion (0°C→32°F, 100°C→212°F, -40°C→-40°F, rounding), speed conversion (kph→mph), formatDayName (Today/Tomorrow/weekday).
- **Observation:** SSE endpoint is NOT auth-protected — any client can connect and receive all condition updates, hazard alerts, and deal matches including user IDs. This is a potential data leak for deal-match events which expose userId and filter details.
- **Observation:** SSE ReadableStream `cancel()` callback doesn't call the cleanup function stored on `__cleanup` — the polling interval may leak if the client disconnects without the stream being properly cancelled. The `closed` flag prevents enqueuing, but `setInterval` keeps running.
- **Observation:** GPX export rejects `conditions` and `deals` types only inside `gpxExport()` (after data is already fetched). The validation could happen earlier to avoid unnecessary DB queries.
- Final counts: **web 485 tests** (was 387), **pipeline 636 passed + 43 skipped = 679 total** (unchanged).

**2026-02-24 (Round 9 cross-agent — from Utah):** Built SSE endpoint (`GET /api/sse/rivers`) with ReadableStream, 30-second DB polling, three event types (condition-update, hazard-alert, deal-match). Created `useRiverSSE` React hook with exponential backoff. Updated PWA manifest + layout meta tags. Enhanced service worker with cache-first/network-first strategies. Built data export API (`GET /api/export`) supporting JSON, CSV, GPX. Fixed stale alerts test assertion. Key files: `web/src/app/api/sse/rivers/route.ts`, `web/src/lib/sse.ts`, `web/src/app/api/export/route.ts`.

**2026-02-24 (Round 9 cross-agent — from Tyler):** Built interactive map page (`/map`) using vanilla Leaflet (dynamic import, no react-leaflet). Color-coded markers, search, geolocation, desktop sidebar + mobile bottom sheet. `WeatherWidget` using Open-Meteo API (tab on river detail page). Export page (`/export`) with card-based selectors, GPX auto-disable. Nav updated with Map + Export links. Observation: map needs lat/lng on RiverSummary.

**2026-02-24 (Round 9 cross-agent — from Coordinator):** Fixed all 3 bugs found this round: removed userId from SSE deal-match events, added clearInterval in cancel() callback, moved GPX type validation before fetchExportData().

**2026-02-24:** Round 10 — Test coverage for Trip Planner, River Reviews, and Rate Limiting. Four new test files (87 new tests):
- `trips.test.ts` (30 tests): GET list with auth/status/upcoming filters, POST create with validation (missing name, endDate before startDate, invalid status), defaults (status=planning, isPublic), GET by ID with stops+river details, 404/403/401 for non-existent/non-owner/unauthenticated, public trip access by non-owner, PATCH owner-only update with status/name fields, DELETE owner-only with 204/403/404.
- `trip-stops.test.ts` (17 tests): POST add stop with river validation, 400 for missing riverId/invalid dayNumber/bad time format, 404 for missing trip/river, 403 for non-owner, optional notes/putInTime/takeOutTime, DELETE stop with 204/404 (non-existent, wrong trip), 403 non-owner.
- `reviews.test.ts` (20 tests): GET paginated with averageRating, default ordering (createdAt desc), empty reviews → null average, 404 for non-existent river, limit/offset clamping, user info inclusion, POST create/upsert, validation (rating 1-5, non-integer rating, body required/empty), 404 for non-existent river, 401 unauthenticated, optional visitDate/difficulty, 429 when rate limited.
- `rate-limit.test.ts` (20 tests): Token bucket fills to max, consumes tokens, rate limit exceeded returns false, refill over time (vi.advanceTimersByTime), no refill beyond max, separate buckets per IP, x-real-ip fallback, 127.0.0.1 default, stale entry cleanup, withRateLimit 429 with Retry-After + X-RateLimit-Remaining=0 headers, X-RateLimit-Remaining/Reset on success, handler not called when limited, withRateLimit+withAuth composition.
- **Observation:** Reviews GET route has no sort parameter — always orders by `createdAt desc`. Task specified testing sort={recent,highest,lowest} but that feature isn't implemented. Tested the default ordering instead.
- **Observation:** `tripUpdateSchema` uses `.optional()` on all fields but has no `.refine()` for endDate >= startDate on PATCH. You could PATCH endDate to be before startDate without error. The create schema has this refinement but the update schema doesn't.
- Final counts: **web 572 tests** (was 485), **pipeline 636 passed + 43 skipped = 679 total** (unchanged). Grand total: **1,251**.

