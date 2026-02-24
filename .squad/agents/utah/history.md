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