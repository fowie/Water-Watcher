# Utah — History

## Core Context
- **Project:** Water-Watcher — Whitewater Rafting Tracker
- **User:** Spencer Fowers
- **Stack:** TBD
- **Data sources to scrape:** Facebook posts, BLM, National Forest Service, American Whitewater, Craigslist
- **Data categories:** Rafting quality, hazards, best times, campsites, rapid guides, gear deals
- **Key backend features:** Scraping pipeline, data aggregation, Craigslist monitoring, notification system, job scheduling

## Learnings

<!-- Append learnings below. Format: **YYYY-MM-DD:** what was learned -->

**2026-02-24:** Implemented full scraping pipeline. Key decisions and patterns:

### Architecture
- AW scraper uses their semi-public JSON API at `/content/River/detail/id/{id}/.json` for reach details, plus HTML scraping for gauge data, rapids, trip reports, and hazards
- Craigslist scraper uses RSS feeds (`?format=rss`) as primary method — way less likely to trigger anti-bot measures than HTML scraping. Falls back to HTML when RSS unavailable
- Condition processor merges data across sources using a priority system (USGS=100 > AW=80 > BLM/USFS=70 > Facebook=30). Higher-priority sources fill in missing fields within a 2-hour window
- Deal matcher scores matches 0-100 instead of binary yes/no. Only matches scoring 50+ trigger notifications

### Scraping Patterns
- Rate limiting: configurable `rate_limit_delay` (default 2s) between requests, plus random jitter (0.5-2.0s) for Craigslist
- User-Agent rotation for Craigslist with 5 real browser UA strings
- Craigslist queries grouped into compound OR queries to reduce request count (4 queries per category instead of 20+)
- RSS XML parsing with dual namespace support (RSS 2.0 + RDF 1.0)
- Dedup: Craigslist URLs loaded from DB before scraping to skip known listings

### Data Flow
- Scrapers → `ScrapedItem` → Processors → DB models → Notifiers
- Condition changes detected by comparing new quality against last recorded quality per river
- `PushNotifier` removes expired subscriptions (HTTP 410 Gone) automatically
- Notification types: deal match, condition change, hazard alert

### Key File Paths
- `pipeline/scrapers/american_whitewater.py` — AW scraper (~400 lines)
- `pipeline/scrapers/craigslist.py` — CL scraper (~370 lines)
- `pipeline/processors/condition_processor.py` — condition normalizer with source merging
- `pipeline/processors/deal_matcher.py` — scored matching engine
- `pipeline/notifiers/push_notifier.py` — pywebpush integration
- `pipeline/models/models.py` — added User, UserRiver models to match Prisma schema
- `pipeline/config/settings.py` — added `request_timeout`, `rate_limit_delay` settings

### API Enhancements
- All 5 API routes now have try/catch error handling
- Rivers GET: added pagination (limit/offset), returns total count
- Deals GET: added `search` text filter, input validation for maxPrice
- Deal filters POST: validates user exists before creating
- Notifications subscribe POST: validates user exists before saving
- River detail: returns 20 conditions instead of 10

### Schedule
- River conditions: every 240 minutes (4 hours)
- Raft Watch deals: every 30 minutes

---

## Cross-Agent Updates

**2026-02-24 (from Tyler):** Full frontend built with 10 UI primitives and 8 domain components. Key components consuming API data: `river-card.tsx` (displays conditions, hazard count), `deal-card.tsx` (image, price, location), `condition-badge.tsx` (quality color-coding), `notification-toggle.tsx` (per-river push). Deal filters use `DEMO_USER_ID = "demo-user"` (temporary). API client in `web/src/lib/api.ts` has typed helpers for all endpoints. Pages: rivers dashboard with debounced search, river detail with tabs (conditions/hazards/rapids/campsites), deals grid with filter panel.

**2026-02-24 (from Pappas):** 130 Python tests written and passing (pytest + respx). Covers USGS scraper, base scraper, condition processor (all 6 flow ranges, source merging, runnability scoring), deal matcher (scoring, hard disqualifiers, threshold). Tests in `pipeline/tests/`. Key discovery: `psycopg2-binary` needed in test environments because SQLAlchemy's `create_engine()` runs at import time.

**2026-02-24:** Fixed `datetime.utcnow()` deprecation across entire pipeline (deprecated since Python 3.12). Replaced with `datetime.now(timezone.utc)` in 8 files: `scrapers/base.py`, `scrapers/usgs.py`, `scrapers/american_whitewater.py`, `scrapers/craigslist.py`, `processors/condition_processor.py`, `processors/deal_matcher.py`, `models/models.py`, `main.py`. For SQLAlchemy model defaults and `dataclass` default_factory, used a `_utc_now()` helper function since `datetime.now(timezone.utc)` isn't a bare callable. Added startup validation to `main.py` — `_validate_startup()` exits with critical error if `DATABASE_URL` is unset, and warns if VAPID keys are missing. All 130 tests still pass.

**2026-02-24:** Fixed two bugs found by Pappas during testing:
1. Rivers API (`web/src/app/api/rivers/route.ts`) — `limit` and `offset` query params weren't clamped like the deals route. Added `Math.max(..., 1)` for limit and `Math.max(..., 0)` for offset to prevent negative values reaching Prisma.
2. Deal matcher (`pipeline/processors/deal_matcher.py`) — `$0`/free items bypassed price checks because Python treats `0` as falsy. Changed three truthiness checks (`if f.max_price and deal.price`) to explicit `is not None` checks. This ensures free gear deals are properly scored and can be disqualified when over max price.
All tests pass: 147 Python (pytest), 119 TypeScript (vitest).
**2026-02-24:** Fixed two more bugs found by Pappas:
1. Hazard classifier (`pipeline/scrapers/american_whitewater.py` `_classify_hazard`) — "logjam" was misclassified as "strainer" because the strainer check (containing "log") ran before the logjam check. Fixed by moving logjam check first and removing the ambiguous "log" keyword from strainer keywords (kept "strainer", "tree", "wood", "debris").
2. Craigslist RSS parser (`pipeline/scrapers/craigslist.py` `_scrape_rss`) — ElementTree elements with no children evaluate as falsy even when they exist and have `.text`. The `or` pattern (`item.find("title") or item.find(...)`) would skip valid elements. Fixed by using explicit `is None` checks for all four element lookups (title, link, description, date).
Updated test in `test_aw_scraper.py` — logjam assertion now expects "logjam" instead of "strainer", added "log jam" two-word test case. All 278 tests pass.

**2026-02-24:** Created database seed script, service worker, and DELETE endpoint:

### Seed Script (`web/prisma/seed.ts`)
- Creates demo user (id: "demo-user", name: "Spencer") via upsert
- Seeds 3 rivers: Colorado (Gore Canyon), Salmon (Main Salmon), Arkansas (Browns Canyon) — all with AW IDs and USGS gauges where applicable
- Seeds 6 river conditions (2 per river at different timestamps), 6 hazards (2 per river), 3 campsites, 5 rapids, 3 gear deals (raft/kayak/PFD), and 1 deal filter
- Uses `prisma.*.upsert` for entities with unique constraints (user, rivers by awId, deals by url, filter by id). Uses `deleteMany` + `createMany` for entities without stable unique keys (hazards, campsites, rapids, conditions)
- Idempotent: safe to run multiple times. `package.json` already had `"db:seed": "tsx prisma/seed.ts"`

### Service Worker (`web/public/sw.js`)
- Handles `push` events: parses JSON payload, shows notification with title/body/icon/badge
- Handles `notificationclick`: opens the URL from notification data, focuses existing tab if available
- Handles `activate`: claims all clients for immediate control
- No caching — Next.js handles that

### DELETE Endpoint (`web/src/app/api/rivers/[id]/route.ts`)
- Added `DELETE` handler alongside existing `GET`
- Returns 204 on success, 404 if river not found, 500 on error
- Prisma schema has `onDelete: Cascade` on all river relations, so conditions/hazards/campsites/rapids/trackedBy are automatically cleaned up
- Added 3 tests (success, 404, 500) — all 122 vitest tests pass

**2026-02-24:** Built health endpoint, PATCH APIs, and API error helper:

### API Error Helper (`web/src/lib/api-errors.ts`)
- `apiError(status, message)` — returns `NextResponse.json({ error }, { status })`, replaces inline error construction
- `handleApiError(error)` — logs error, returns safe 500 with "Internal server error" (no stack trace leaking)
- Refactored `rivers/route.ts`, `rivers/[id]/route.ts`, and `deals/filters/route.ts` to use these helpers

### Health Endpoint (`web/src/app/api/health/route.ts`)
- GET `/api/health` returns `{ status: "ok", timestamp, version: "0.1.0" }` on 200
- Tries `prisma.$queryRaw\`SELECT 1\`` to check DB connectivity
- Returns `{ status: "degraded", ... }` with 503 if DB unreachable

### PATCH River (`web/src/app/api/rivers/[id]/route.ts`)
- Added PATCH handler alongside existing GET and DELETE
- Uses `riverUpdateSchema` (in validations.ts) — partial updates to name, state, region, latitude, longitude, difficulty, description, imageUrl
- Nullable fields supported (can set region/description/etc to null)
- Returns updated river, 404 if not found, 400 for validation errors

### PATCH Deal Filter (`web/src/app/api/deals/filters/[id]/route.ts`)
- New route with GET, PATCH, DELETE handlers
- PATCH validates ownership: requires `userId` in body, checks it matches filter's owner
- Returns 403 if wrong user, 404 if not found, 400 for invalid data
- Uses `dealFilterUpdateSchema` — partial updates to name, keywords, categories, maxPrice, regions, isActive

### Validation Schemas (`web/src/lib/validations.ts`)
- Added `riverUpdateSchema` — all fields optional, nullable where Prisma allows null (region, lat, lon, etc)
- Added `dealFilterUpdateSchema` — all fields optional, maxPrice nullable

### API Client (`web/src/lib/api.ts`)
- Added `updateRiver(id, data)`, `updateDealFilter(id, userId, data)`, `getHealth()`
- Added imports for `RiverUpdateInput`, `DealFilterUpdateInput` types

### Test Coverage
- 168 vitest tests passing (up from 135), build clean
- New test files: `health.test.ts` (3 tests), `deals-filters-id.test.ts` (11 tests)
- Added 6 PATCH tests to `rivers.test.ts` (valid update, 404, bad latitude, empty name, nullable fields, DB error)

**2026-02-24 (Round 4 cross-agent — from Tyler):** Built `/settings` page (notification preferences, data management, about), `EditRiverDialog` (pre-fills + PATCH), reusable `MapLink` component, and comprehensive accessibility pass (skip-to-content, aria-labels, aria-expanded, role attributes, page titles, keyboard focus, sr-only labels). Build clean.

**2026-02-24 (Round 4 cross-agent — from Pappas):** Added 51 new web tests (148 → 199) covering api-errors helpers, health endpoint edge cases, PATCH rivers, and PATCH deal filters. Seed script type-checks cleanly. Total: 477 tests (199 web + 278 pipeline).

**2026-02-24 (Round 4 cross-agent — from Coordinator):** Fixed `timeAgo` bugs — added "weeks ago" bucket for 7-27 days, graceful fallback for invalid date inputs.

**2026-02-24:** Docker production config, CI workflow, and README overhaul:

### Docker
- Created `web/Dockerfile` — multi-stage build (deps → build → production). Node 20 Alpine, pnpm install, Prisma generate, Next.js standalone output. Production stage copies `.next/standalone` + static + Prisma client.
- Created `pipeline/Dockerfile` — Python 3.12-slim with system deps (gcc, libpq, libxml2), pip install, Playwright chromium. Runs `python main.py`.
- Updated `docker-compose.yml` — 4 services: `postgres` (unchanged), `db-migrate` (runs `prisma db push` using builder stage, waits for healthy postgres), `web` (depends on migrate, exposes 3000), `pipeline` (depends on migrate, runs scrapers). All env vars passed through with defaults.
- Added `output: "standalone"` to `web/next.config.ts` for Docker-compatible Next.js build.
- Created `.dockerignore` files for both web and pipeline to keep images lean.

### CI
- Created `.github/workflows/ci.yml` with 4 jobs: web-test (vitest), web-build (next build for type checking), web-lint (eslint), pipeline-test (pytest). All use caching (pnpm cache, pip cache). Triggers on push to main/dev and PRs.
- Existing `squad-ci.yml` was a placeholder — new `ci.yml` is the real workflow.

### README
- Rewrote `README.md` — project description, full feature list, tech stack table, getting started (Docker quick start + local dev), project structure, complete API endpoint table (13 routes), testing commands, architecture diagram, contributing guide, MIT license.

### .env.example
- Added Docker Compose DATABASE_URL comment showing `postgres` as hostname instead of `localhost`.

**2026-02-24 (Round 5 cross-agent — from Tyler):** Error boundaries and loading skeletons added at global and per-route levels. Difficulty filter chips and sort dropdown on rivers page (client-side). Open Graph metadata and emoji favicon added.

**2026-02-24 (Round 5 cross-agent — from Pappas):** 166 new tests (pipeline 278→407, web 199→236). Found 3 bugs: USGS non-numeric crash, _find_river drops non-usgs/aw sources, classify_runnability(inf)=None. All fixed by Coordinator.

**2026-02-24 (Round 5 cross-agent — from Coordinator):** Fixed USGS error handling (broad try/except), _find_river name-based fallback, runnability inclusive upper bound. Updated 4 tests.

**2026-02-24:** Implemented NextAuth.js v5 authentication system. Key decisions:

### Auth Architecture
- NextAuth v5 (Auth.js) with Credentials provider and JWT session strategy
- Prisma adapter (`@auth/prisma-adapter`) for future OAuth provider support
- Password hashing via Node.js built-in `crypto.pbkdf2Sync` (100K iterations, SHA-512, 64-byte key) — no native module dependencies
- Constant-time password comparison to prevent timing attacks
- `withAuth()` HOF in `api-middleware.ts` wraps route handlers — injects `x-user-id` header into cloned request so handlers read session user without re-fetching

### Schema Changes
- Added `Account`, `Session`, `VerificationToken` models to Prisma schema (standard NextAuth models for future OAuth/email verification)
- Extended `User` model with `passwordHash`, `emailVerified`, `image` fields
- Existing User records (e.g., demo-user) remain compatible — all new fields are optional

### Route Protection Pattern
- Deal filter routes (GET/POST/PATCH/DELETE) require auth — userId comes from session, not request body
- Notification subscribe POST requires auth
- Rivers GET (list + detail) remain public; POST/PATCH/DELETE require auth
- Filter ownership enforced at handler level: 403 if session user != filter owner

### Key Files
- `web/src/lib/auth.ts` — NextAuth config (credentials provider, JWT callbacks)
- `web/src/lib/auth-utils.ts` — password hashing, `getCurrentUser()`, `requireAuth()`
- `web/src/lib/api-middleware.ts` — `withAuth()` HOF
- `web/src/app/api/auth/[...nextauth]/route.ts` — NextAuth route handler
- `web/src/app/api/auth/register/route.ts` — registration with Zod validation, 409 on duplicate email
- Updated 4 route files + 4 test files. All 239 tests pass, build succeeds.

**2026-02-24 (Round 6 cross-agent — from Tyler):** Built auth UI: sign-in/register pages, `AuthGuard` component, `SessionProvider` wrapper, `UserMenu` component. Settings page now uses `session.user.id` instead of `DEMO_USER_ID`. Navigation conditionally shows Settings when authenticated. 15 routes, build clean.

**2026-02-24 (Round 6 cross-agent — from Pappas):** 61 new auth tests: `auth-register.test.ts` (23), `auth-utils.test.ts` (23), `api-middleware.test.ts` (15). Confirms withAuth injects x-user-id without mutating original request. Registration validation returns `{ error, details }` shape. Also created 80 skipped BLM/Facebook scraper test stubs. Web 300, Pipeline 487 total.

**2026-02-24:** Built BLM scraper, USFS scraper, user profile API, and wired into pipeline:

### BLM Scraper (`pipeline/scrapers/blm.py`)
- Extends `BaseScraper`, name="blm", source priority 70
- Fetches from BLM's recreation API (`BLM_BASE_URL/api/alerts`) and RSS feed (`BLM_BASE_URL/rss/alerts.xml`)
- Extracts: advisory type (closure/fire_restriction/water_advisory/seasonal_access), severity, river name, dates, description
- River name extraction via regex patterns matching "[Name] River/Creek/Canyon/Fork"
- Rate limiting: 2s between requests
- Handles: timeouts, non-JSON responses, missing fields, malformed XML
- RSS parser supports both RSS 2.0 and Atom formats
- All ScrapedItems include `river_name` for `_find_river()` name-based fallback

### USFS Scraper (`pipeline/scrapers/usfs.py`)
- Extends `BaseScraper`, name="usfs", source priority 70
- Uses RIDB API at `https://ridb.recreation.gov/api/v1/` with `RIDB_API_KEY`
- Fetches facility alerts (filtered by water activities) and recreation area alerts
- Same river name extraction and severity classification as BLM
- Rate limiting: 1s between requests
- Graceful skip when `RIDB_API_KEY` not configured

### Pipeline Integration
- New scheduled job `run_land_agency_scrapers()` runs both BLM + USFS every 6 hours (configurable via `LAND_AGENCY_INTERVAL_MINUTES`)
- Added `BLM_BASE_URL`, `RIDB_API_KEY`, `land_agency_interval_minutes` to `pipeline/config/settings.py`
- Updated `.env.example` with new vars
- Updated `pipeline/scrapers/__init__.py` to export both scrapers
- Fixed `test_main.py` assertions (2→3 jobs, all IDs checked)

### User Profile API (`web/src/app/api/user/profile/route.ts`)
- GET: returns user profile with `riverCount` and `filterCount` via `_count` select
- PATCH: updates name/email with duplicate email check (409 on conflict)
- Both protected with `withAuth()` middleware
- Added `getUserProfile()` and `updateUserProfile()` client functions to `web/src/lib/api.ts`

### Test Results
- Pipeline: 407 passed, 80 skipped
- Web: 300 passed

**2026-02-24 (Round 7 cross-agent — from Tyler):** Built profile page (`/profile`), river comparison view (`/rivers/compare`), favorites page (`/rivers/favorites`), and `GET/POST/DELETE /api/user/rivers`. Star button on river cards toggles tracking. Compare mode with checkbox selection (max 3). Navigation: "My Rivers" auth-only link, "Profile" in user menu. 20 routes, build clean.

**2026-02-24 (Round 7 cross-agent — from Pappas):** 204 new tests: BLM scraper 88 (replaced skipped stubs), USFS scraper 71, user profile 22, user rivers 23. Pipeline 566+43 skipped, Web 345, total 954. Discovered BLM advisory type map ordering quirk and river name extraction greedy regex issue — documented as observations.

**2026-02-24:** Implemented email notifications (Resend), OAuth providers, notification preferences, and alert history:

### Email Notifier (`pipeline/notifiers/email_notifier.py`)
- `EmailNotifier` class using Resend API with 4 methods: `send_deal_alert`, `send_condition_alert`, `send_hazard_alert`, `send_weekly_digest`
- Inline HTML templates with responsive CSS (no template engine dependency)
- Graceful skip when `RESEND_API_KEY` is not configured (same pattern as push notifier)
- Added `resend>=2.0,<3.0` to `requirements.txt`
- Settings already had `resend_api_key` and `notification_from_email`

### Pipeline Wiring (`pipeline/main.py`)
- `EmailNotifier` instantiated alongside `PushNotifier` in all 3 scraper jobs
- Helper functions: `_get_email_recipients()` checks NotificationPreference per user — only sends if channel is "email" or "both" AND the specific alert type is enabled
- `_send_condition_emails()` and `_send_deal_emails()` dispatch to tracked river users
- All email dispatch wrapped in try/except to never break the scraping pipeline

### Notification Preferences (Prisma + SQLAlchemy)
- Prisma: `NotificationPreference` model with channel ("push"/"email"/"both"), per-type booleans (dealAlerts, conditionAlerts, hazardAlerts, weeklyDigest), unique on userId
- Prisma: `AlertLog` model for tracking sent notifications (type, channel, title, body, metadata JSON)
- SQLAlchemy: mirrored both models; `AlertLog.extra_data` maps to column named "metadata" (SQLAlchemy reserves `metadata` as attribute name)
- User model updated with `notification_preferences` (one-to-one) and `alert_logs` (one-to-many) relationships

### Notification Preferences API (`web/src/app/api/user/notifications/route.ts`)
- GET: returns prefs, auto-creates defaults (push channel, all alerts on, digest off) if none exist
- PATCH: validates channel enum + boolean fields, upserts to handle first-time + update in one call
- Both protected with `withAuth()`
- Client functions: `getNotificationPreferences()`, `updateNotificationPreferences()` in `api.ts`

### Alert History API (`web/src/app/api/alerts/route.ts`)
- GET: paginated list of past alerts, optional `type` filter, sorted by sentAt desc
- Limit clamped 1–100, offset >= 0
- Protected with `withAuth()`
- Client functions: `getAlerts()` in `api.ts` with `AlertLogRecord` and `AlertsResponse` types

### OAuth Providers (`web/src/lib/auth.ts`)
- Added Google and GitHub providers alongside existing Credentials provider
- `allowDangerousEmailAccountLinking: true` on both OAuth providers so users can link OAuth to existing email accounts
- Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_ID`, `GITHUB_SECRET` added to `.env.example`
- Prisma adapter already handles Account model for OAuth account storage

### Gotcha
- SQLAlchemy reserves `metadata` as a class attribute on declarative models. Used `extra_data = Column("metadata", JSON)` to map Python attr `extra_data` to DB column `metadata`, keeping Prisma schema and DB column name unchanged.

### Test Results
- Pipeline: 566 passed, 43 skipped (unchanged)
- Web: 345 passed (unchanged)

**2026-02-24 (Round 8 cross-agent — from Tyler):** Added OAuth buttons (Google/GitHub) to sign-in and registration pages. Built `GlobalNotificationPreferences` section on Settings page with channel selector (Push/Email/Both) and per-type toggle switches. Alert history page at `/alerts` with filter tabs and pagination. `NotificationBell` component in nav with unread count badge and 60s polling. 21 routes, build clean.

**2026-02-24 (Round 8 cross-agent — from Pappas):** 116 new tests: `test_email_notifier.py` (70), `notification-prefs.test.ts` (22), `alerts.test.ts` (24). Pipeline 636+43skip, Web 387, total 1023+43. Found `limit=0` falsy edge case in alerts route — fixed by Coordinator.

**2026-02-24 (Round 8 cross-agent — from Coordinator):** Fixed alerts API `limit=0` edge case: `parseInt(param) || 20` treats 0 as falsy. Changed to `Number.isFinite(parsed) ? parsed : 20`.

**2026-02-24:** Round 9 — SSE endpoint, PWA manifest & offline caching, data export API:

### Server-Sent Events (`web/src/app/api/sse/rivers/route.ts`)
- GET endpoint returning `ReadableStream` with `text/event-stream` content type
- On connection, sends initial snapshot of recently updated rivers/hazards/deals from the last 1 hour
- Polls database every 30 seconds for new conditions, hazards, and deal matches
- Three event types: `condition-update`, `hazard-alert`, `deal-match`
- Includes `retry: 5000` for auto-reconnect, `X-Accel-Buffering: no` for Nginx compatibility
- Cleanup on connection close via `closed` flag + `clearInterval`

### SSE Client Library (`web/src/lib/sse.ts`)
- `createSSEClient(url, handlers)` — factory that creates an EventSource with typed event handlers for each event type, returns cleanup function
- `useRiverSSE({ riverId?, enabled? })` — React hook that subscribes to SSE, returns live `conditions`, `hazards`, `deals` arrays plus `isConnected` and `error` state
- Auto-reconnect with exponential backoff: 1s → 2s → 4s → … → 30s max
- Optional `riverId` filter to scope condition/hazard events to a single river
- Arrays capped at 100 conditions, 50 hazards, 50 deals to prevent memory bloat

### PWA Manifest (`web/public/manifest.json`)
- name: "Water Watcher", short_name: "WaterWatch", display: standalone
- theme_color: #0ea5e9 (sky-500), background_color: #0f172a (slate-900)
- Icons: 192x192 and 512x512 placeholder references
- Categories: sports, weather, navigation

### Layout Updates (`web/src/app/layout.tsx`)
- Added `<link rel="manifest">`, `<meta name="theme-color">`, `<meta name="apple-mobile-web-app-capable">`, viewport with `viewport-fit=cover`

### Service Worker Updates (`web/public/sw.js`)
- Added `CACHE_VERSION = "ww-cache-v1"` with separate static and API caches
- Cache-first strategy for static assets (CSS, JS, fonts, images, `/_next/static/`)
- Network-first strategy for API calls with cache fallback
- Navigation requests: network-first with offline fallback
- Pre-caches `/`, `/manifest.json`, icon files on install
- Old caches cleaned up on activate
- `self.skipWaiting()` on install for immediate activation
- SSE connections (`/api/sse/`) excluded from caching
- Preserved all existing push notification handlers (push, notificationclick)

### Data Export API (`web/src/app/api/export/route.ts`)
- GET endpoint, auth-protected with `withAuth()`
- Zod validation for query params: `format` (json|csv|gpx), `type` (rivers|conditions|deals|all)
- JSON: structured data with proper `Content-Disposition: attachment` header
- CSV: proper header rows, `csvEscape()` handles commas/quotes/newlines with RFC 4180 quoting
- GPX: valid GPX 1.1 XML with waypoints for rivers that have lat/lng, `gpxEscape()` for XML entities
- Exports user's tracked rivers, conditions (last 30 days), and matched deals
- GPX only valid for `rivers` or `all` types (returns 400 otherwise)

### Bug Fix
- Fixed stale test in `alerts.test.ts`: test expected `limit=0` → 20 (old behavior), but BD-021 fix changed it to `limit=0` → 1 (correct behavior via `Number.isFinite` + `Math.max`). Updated assertion to expect 1.

### Test Results
- Web: 387 passed (stale test fixed, no new failures)
- Pipeline: 636 passed, 43 skipped (unchanged)

### Key File Paths
- `web/src/app/api/sse/rivers/route.ts` — SSE endpoint
- `web/src/lib/sse.ts` — SSE client + React hook
- `web/public/manifest.json` — PWA manifest
- `web/public/sw.js` — Service worker with caching
- `web/src/app/api/export/route.ts` — Data export API

**2026-02-24 (Round 9 cross-agent — from Tyler):** Built interactive map page (`/map`) using vanilla Leaflet with dynamic `import()` to avoid SSR issues — no react-leaflet. Color-coded markers by condition quality, click-to-popup river details, search filter, geolocation button. Desktop: right sidebar. Mobile: bottom sheet. `WeatherWidget` component using Open-Meteo API (current + 3-day forecast, °C→°F, km/h→mph), added as new tab on river detail page. Export page (`/export`) with format/type selectors, GPX auto-disable when type != rivers. Nav updated with Map (public) and Export (auth-only). Observation FE-015: map requires lat/lng on `RiverSummary` — if rivers GET doesn't include coordinates, map will be empty.

**2026-02-24 (Round 9 cross-agent — from Pappas):** 98 new tests (web 387→485, total 1,164). SSE endpoint tests (19): headers, retry directive, event shapes, null fields. Export tests (41): auth, validation, JSON/CSV/GPX formats, escaping, user scoping. SSE client tests (38): factory, event parsing, weather utility logic. Found 3 bugs: (1) SSE deal-match events leaked userId — fixed by removing userId from event data; (2) SSE cancel() didn't call clearInterval — fixed; (3) GPX type validation ran after data fetch — moved before fetch. Also noted CSV `#` section headers are non-standard.

**2026-02-24 (Round 9 cross-agent — from Coordinator):** Fixed all 3 bugs found by Pappas: removed userId from SSE deal-match events, added clearInterval in cancel() callback, moved GPX type validation before fetchExportData(). Updated stale test assertion for limit=0 behavior.

**2026-02-24:** Round 10 — Trip Planner API, River Reviews, Rate Limiting Middleware:

### Trip Planner API
- New Prisma models: `Trip` (with status workflow: planning/active/completed/cancelled) and `TripStop` (per-day river stop with put-in/take-out times)
- Relations: `User.trips`, `River.tripStops` added to both Prisma and SQLAlchemy
- 5 API endpoints: `GET/POST /api/trips`, `GET/PATCH/DELETE /api/trips/:id`
- Trip stops sub-resource: `POST /api/trips/:id/stops`, `DELETE /api/trips/:id/stops/:stopId`
- GET trips supports `status` filter and `upcoming` boolean (startDate >= now)
- GET trip detail returns stops with full river info (name, state, difficulty, lat/lng)
- All endpoints auth-protected with `withAuth()`, owner-only for writes (403 on mismatch)
- Zod schemas: `tripSchema` (with `.refine()` for endDate >= startDate), `tripUpdateSchema`, `tripStopSchema`
- API client: `getTrips()`, `createTrip()`, `getTrip()`, `updateTrip()`, `deleteTrip()`, `addTripStop()`, `removeTripStop()`

### River Reviews/Comments
- New Prisma model: `RiverReview` with `@@unique([riverId, userId])` — one review per river per user
- Relations: `User.reviews`, `River.reviews` added to both Prisma and SQLAlchemy
- 2 API endpoints: `GET /api/rivers/:id/reviews` (public, paginated, includes average rating), `POST /api/rivers/:id/reviews` (auth, upserts on riverId+userId)
- POST uses `prisma.riverReview.upsert()` so submitting again updates rather than errors
- GET returns reviews with user info (id, name, image) and aggregate `averageRating`
- Zod schema: `reviewSchema` (rating 1-5, body required)
- API client: `getRiverReviews(riverId)`, `submitReview(riverId, data)`
- POST rate-limited at 10 per minute

### Rate Limiting Middleware
- New `web/src/lib/rate-limit.ts` — in-memory token bucket algorithm with IP-based keys
- `rateLimit(request, config)` returns `{ success, remaining, reset }`
- Token refill based on elapsed time since last check — smooth rate enforcement
- Stale entry cleanup every 60 seconds (entries older than 5 minutes removed)
- Pre-configured configs: `defaultConfig` (60/min), `authConfig` (10/min), `strictAuthConfig` (5/min), `reviewConfig` (10/min)
- `resetRateLimiter()` exported for test isolation
- New `withRateLimit(handler, config?)` HOF in `api-middleware.ts` — composable with `withAuth()`
- Returns 429 with `Retry-After` header when exceeded, adds `X-RateLimit-Remaining` and `X-RateLimit-Reset` to all responses
- Applied to: auth register (5/min strict), river review POST (10/min)
- Had to mock `@/lib/rate-limit` in `auth-register.test.ts` to prevent token bucket exhaustion across 23 sequential test requests

### SQLAlchemy Mirror
- Added `Trip`, `TripStop`, `RiverReview` models to `pipeline/models/models.py`
- Updated `User.trips`, `User.reviews`, `River.trip_stops`, `River.reviews` relationships
- All indexes match Prisma schema

### Key File Paths
- `web/src/lib/rate-limit.ts` — token bucket rate limiter
- `web/src/app/api/trips/route.ts` — trip list/create
- `web/src/app/api/trips/[id]/route.ts` — trip detail/update/delete
- `web/src/app/api/trips/[id]/stops/route.ts` — add stop
- `web/src/app/api/trips/[id]/stops/[stopId]/route.ts` — remove stop
- `web/src/app/api/rivers/[id]/reviews/route.ts` — river reviews

### Test Results
- Web: 485 passed (no regressions, auth test mock added)
- Pipeline: 636 passed, 43 skipped (no regressions)

**2026-02-24 (Round 10 cross-agent — from Tyler):** Built trip planner pages (`/trips`, `/trips/[id]`) with create dialog, day-by-day itinerary, `RiverPickerDialog` for adding stops, inline editing, status transitions. River reviews component (`river-reviews.tsx`) with `StarRating` (filled/half/empty stars) and `ReviewForm` dialog — added as 6th tab on river detail. Stats dashboard (`/stats`) with CSS `conic-gradient` donut chart. All pages use `Promise.allSettled`. Nav updated with Trips + Stats auth-only links.

**2026-02-24 (Round 10 cross-agent — from Pappas):** 87 new web tests (485→572): trips (30), trip stops (17), reviews (20), rate limiting (20). Grand total 1,251. Found `tripUpdateSchema` missing `endDate >= startDate` refinement — fixed by Coordinator. Also noted reviews GET lacks sort parameter.

**2026-02-24 (Round 10 cross-agent — from Coordinator):** Fixed `tripUpdateSchema` date refinement bug — added `.refine()` to enforce `endDate >= startDate` when both fields present in PATCH.

**2026-02-24:** Round 11 — Global Search API, River Photo Gallery, Scrape Monitoring API:

### Global Search API (`web/src/app/api/search/route.ts`)
- GET `/api/search?q=...&type=...&limit=...` — unified search across rivers, deals, trips, and reviews
- Zod validation on query params: `q` required, `type` enum (rivers|deals|trips|reviews|all, default all), `limit` 1-50 (default 10)
- Rivers: searches name, state, region, description (case-insensitive `contains`), public
- Deals: searches title, description, category (active only), public
- Trips: searches name, notes (user's own only, auth required; silently skipped for `type=all` when unauthenticated; returns 401 for `type=trips` without auth)
- Reviews: searches title, body (includes river name in results), public
- Returns grouped results: `{ rivers, deals, trips, reviews, totalResults }` — each item has `type`, `id`, `title`, `subtitle`, `url`
- Client function: `search({ q, type?, limit? })` in `api.ts`

### River Photo Gallery
- New Prisma model: `RiverPhoto` with `riverId`, `userId`, `url`, `caption`, `takenAt`, cascade deletes, index on `[riverId, createdAt]`
- Added `photos RiverPhoto[]` relation to both `River` and `User` models (Prisma + SQLAlchemy)
- `GET /api/rivers/:id/photos` — public, paginated (limit/offset), includes user info
- `POST /api/rivers/:id/photos` — auth required, rate-limited (10/min via `reviewConfig`), validates river exists, enforces max 20 photos per user per river
- `DELETE /api/rivers/:id/photos/:photoId` — auth required, owner-only (403 on mismatch), returns 204
- Zod schema: `photoSchema` (url required, caption max 500, takenAt optional datetime)
- Client functions: `getRiverPhotos()`, `uploadRiverPhoto()`, `deleteRiverPhoto()` in `api.ts`
- SQLAlchemy `RiverPhoto` model added to `pipeline/models/models.py` with matching index

### Scrape Monitoring API
- `GET /api/admin/scrapers` — auth required. Returns per-source stats for all 5 scrapers (usgs, aw, craigslist, blm, usfs): last scrape time, status, 24h totals (scrapes, successes, items), average duration. Also returns summary: total rivers, 24h conditions, active hazards.
- `GET /api/admin/scrapers/:source` — auth required. Returns last 50 log entries with detailed stats: success rate, avg items/run, total items, avg duration. Validates source against allowed list.
- Uses existing `ScrapeLog` model (no schema changes needed)
- Client functions: `getScraperStats()`, `getScraperDetail(source)` in `api.ts`

### Key File Paths
- `web/src/app/api/search/route.ts` — global search
- `web/src/app/api/rivers/[id]/photos/route.ts` — photo list/upload
- `web/src/app/api/rivers/[id]/photos/[photoId]/route.ts` — photo delete
- `web/src/app/api/admin/scrapers/route.ts` — scraper overview
- `web/src/app/api/admin/scrapers/[source]/route.ts` — scraper detail

### Test Results
- Web: 572 passed (no regressions)
- Pipeline: 636 passed, 43 skipped (no regressions)

**2026-02-24 (Round 11 cross-agent — from Tyler):** Built command palette search (`SearchPalette`) with Cmd/Ctrl+K trigger, grouped results, arrow-key navigation, recent searches in localStorage. Dedicated `/search` page with type filter tabs and Suspense boundary. Photo gallery (`PhotoGallery`) with lightbox (keyboard nav, scroll lock) and Intersection Observer lazy loading. Photo upload (`PhotoUpload`) with base64 data URL strategy, 5MB client-side limit. River detail tabs expanded to 7 columns (Photos tab with count badge). Scrape monitor dashboard at `/admin/scrapers` with traffic light health indicators (green/yellow/red based on interval multipliers), expandable detail cards with scrape history tables.

**2026-02-24 (Round 11 cross-agent — from Pappas):** 96 new web tests (572→668): search (32), river photos (31), scrapers (33). Grand total 1,347. No bugs found. Observations: search `type=all` silently skips trips for anonymous users, scraper VALID_SOURCES is case-sensitive, photo POST rate limit runs before auth check.

**2026-02-24:** Round 12 — Docker Compose fix, Facebook scraper, password reset/email verification, security headers:

### Docker Compose Fix
- Root cause: `db-migrate` service used `target: builder` which required building the entire Next.js app (including `pnpm build`) just to run `prisma db push`. The builder stage needs `DATABASE_URL` at build time for Prisma client generation, which wasn't available.
- Fix: Replaced `db-migrate` with a lightweight `node:20-alpine` image that volume-mounts `web/prisma/` and runs `npx prisma db push --skip-generate` directly — no build step needed.
- Added `DATABASE_URL` build arg to web Dockerfile builder stage with dummy default so Prisma client generates without a real DB connection.
- Added missing env vars to docker-compose.yml: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`, `RIDB_API_KEY`, `FACEBOOK_ACCESS_TOKEN`, `LAND_AGENCY_INTERVAL_MINUTES`. All use `${VAR:-}` pattern for optional ones.
- Made Playwright install optional in pipeline Dockerfile (`|| echo "skipped"`) — non-critical for scraping.
- `.dockerignore` files already existed for both web/ and pipeline/.

### Facebook Scraper (`pipeline/scrapers/facebook.py`)
- Extends `BaseScraper`, `name="facebook"`, source priority 30 (per BD-002)
- Dual strategy: Graph API with access token, or public page scraping via mobile site (no auth)
- Graph API: fetches page posts with fields (message, created_time, from, full_picture, permalink_url), handles 401/403/429 responses
- Public scraping: parses mobile site HTML with BeautifulSoup for post text, images, links, author
- River mention detection: word-boundary regex against all tracked river names from DB, case-insensitive
- Hashtag support: converts `#ColoradoRiver` → `Colorado River` for matching
- One ScrapedItem per river mentioned per post (handles multi-river posts)
- Condition extraction via regex: flow rate (CFS), gauge height (ft), water temp (°F), quality keywords
- Rate limiting: configurable delay between requests, handles `X-App-Usage` headers, backs off at 50%+ API usage
- 48-hour scrape window — skips older posts
- Settings: `facebook_access_token`, `facebook_pages`, `facebook_interval_minutes` added to `config/settings.py`
- Scheduled job `run_facebook_scraper()` added to `main.py` (every 6 hours default)
- Updated `scrapers/__init__.py` to export `FacebookScraper`
- Updated `test_main.py` assertions: 3→4 jobs, facebook_scraper ID check

### Password Reset & Email Verification
- New Prisma model: `PasswordResetToken` with `email`, `token` (unique), `expires`, `createdAt`. Mapped to `password_reset_tokens` table. Compound unique on `[email, token]`.
- SQLAlchemy mirror: `PasswordResetToken` model added to `pipeline/models/models.py` and exported from `__init__.py`
- `POST /api/auth/forgot-password`: public endpoint, takes `email`, generates 32-byte hex token, stores with 1-hour expiry, sends reset email via Resend, always returns 200 (prevents enumeration). Only for credentials users (with passwordHash).
- `POST /api/auth/reset-password`: public endpoint, takes `token` + `newPassword`, validates token not expired, hashes password with existing PBKDF2 `hashPassword()`, updates user + deletes token in transaction.
- `GET /api/auth/verify-email?token=...`: validates VerificationToken, sets `emailVerified` timestamp, deletes token, redirects to signin page with success/error messages.
- `web/src/lib/email.ts`: Resend API utility with `sendPasswordResetEmail()` and `sendVerificationEmail()`. Graceful no-op when `RESEND_API_KEY` not configured (logs warning). Inline HTML templates matching pipeline email style.
- Zod schemas: `forgotPasswordSchema` (email), `resetPasswordSchema` (token + newPassword min 8 chars)
- API client: `forgotPassword(email)`, `resetPassword(token, newPassword)` added to `api.ts`

### Security Headers (`web/next.config.ts`)
- Rewrote as proper TypeScript with `NextConfig` type import
- `headers()` config returns security headers for all routes `/(.*)`
- Headers: X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, X-XSS-Protection: 1; mode=block, Permissions-Policy: camera=(), microphone=(), geolocation=(self), Strict-Transport-Security: max-age=31536000; includeSubDomains
- `output: "standalone"` preserved for Docker compatibility

### Test Results
- Web: 668 passed (no regressions)
- Pipeline: 636 passed, 43 skipped (no regressions)
