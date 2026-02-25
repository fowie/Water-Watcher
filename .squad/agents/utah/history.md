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