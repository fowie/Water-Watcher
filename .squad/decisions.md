# Team Decisions

> Canonical decision ledger. Append-only. Agents write to `.squad/decisions/inbox/`, Scribe merges here.

---

## ADR-001: Tech Stack Selection
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Bodhi

| Layer | Choice |
|-------|--------|
| Web Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | PostgreSQL 16 |
| Web ORM | Prisma |
| Scraping Runtime | Python 3.11+ |
| Pipeline ORM | SQLAlchemy 2.0 |
| Scheduling | APScheduler |
| Notifications | Web Push API |
| Package Manager | pnpm (web), pip+venv (pipeline) |

Rejected: full-TypeScript monorepo, SQLite, Redis+Celery, Drizzle, tRPC.

---

## ADR-002: Two-Service Layout
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Bodhi

`web/` (Next.js) + `pipeline/` (Python). PostgreSQL is the shared state. Prisma owns schema; SQLAlchemy mirrors it. No inter-process RPC.

---

## ADR-003: Data Flow Architecture
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Bodhi

Scrapers → ScrapedItem → Processors → PostgreSQL ↔ Next.js API Routes → React Frontend. DealMatcher scores against user filters. PushNotifier sends web push for matches.

---

## ADR-004: Notification Strategy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Bodhi

Primary: Web Push API (service worker). Secondary (future): email via Resend. Opt-in per river and per deal filter.

---

## ADR-005: API Design
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Bodhi

REST via Next.js App Router API routes. Validation via Zod schemas in `web/src/lib/validations.ts`. Key endpoints: GET/POST `/api/rivers`, GET `/api/rivers/:id`, GET `/api/deals`, GET/POST `/api/deals/filters`, POST `/api/notifications/subscribe`.

---

## FE-001: Manual shadcn/ui Component Setup
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Created components manually in `web/src/components/ui/` with CSS custom variables for theming. No dependency on shadcn CLI.

---

## FE-002: Responsive Navigation Pattern
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Desktop: 264px fixed sidebar. Mobile: 56px top header + 64px bottom tab bar. Sheet menu for secondary items. Content offset: `md:pl-64 pt-14 md:pt-0 pb-20 md:pb-0`.

---

## FE-003: Client-Side Data Fetching
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Client components with useEffect + useCallback via `api.ts`. Debounced search (300ms). SSR can be added later if SEO needed.

---

## FE-004: Demo User ID for Filters
**Status:** Superseded by BD-018 — **Date:** 2026-02-24 — **By:** Tyler

`DEMO_USER_ID = "demo-user"` hardcoded. Replaced with real NextAuth.js session-based user IDs in Round 6.

---

## BD-001: Craigslist Scraping via RSS Feeds
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

RSS feeds (`?format=rss`) as primary, HTML fallback when unavailable. Less likely to trigger anti-bot blocks.

---

## BD-002: Source Priority System
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

USGS (100) > AW (80) > BLM/USFS (70) > Facebook (30). Higher-priority sources supplement (not override) within a 2-hour window.

---

## BD-003: Scored Deal Matching (0-100)
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Category=30pts, keywords=10pts each (max 40), price=20+bonus, region=10pts. Threshold: 50+ for notifications. Hard disqualifiers for wrong region, over-price, no keyword hit.

---

## BD-004: Explicit None Checks for Numeric Fields
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

In Python, always use `is not None` instead of truthiness checks when evaluating numeric fields that can legitimately be `0` (e.g., `deal.price`, `f.max_price`). Truthiness checks (`if value:`) treat `0` as falsy, silently skipping logic for $0/free items. Also standardized input validation clamping across all paginated API routes — both `limit` and `offset` use `Math.min`/`Math.max` to prevent negative or excessive values.

---

## FE-005: River Detail UX Enhancements
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

1. **`timeAgo` utility** — Human-friendly relative timestamps in `web/src/lib/utils.ts`. Used on condition and hazard records.
2. **`FlowTrend` component** — Compares two most recent flow readings: ↑ rising >10%, ↓ falling >10%, → stable.
3. **RapidRating color update** — Class II changed from blue to green to match standard rafter convention.
4. **Google Maps links on campsites** — External link for campsites with lat/lng using `https://www.google.com/maps?q=` format.

---

## QA-001: Untested Module Coverage & Bug Discoveries
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Pappas

Added 131 tests across Craigslist scraper (57), AW scraper (35), and Push notifier (39). Pipeline tests: 147 → 278, all passing.

**Bugs found:**
1. **Craigslist RSS ElementTree truthiness** — `item.find("title") or item.find("{ns}title")` fails because childless Elements are falsy in Python 3.12. Fix: use `is not None` checks.
2. **Hazard classification keyword order** — "log" keyword checked before "logjam", causing logjam hazards to classify as strainer. Fix: reorder or use word-boundary matching.

**Note:** `lxml` and `pywebpush` should be added to `requirements-dev.txt` for test environments.

---

## BD-007: SQLAlchemy Models Must Mirror Prisma
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Added User/UserRiver to SQLAlchemy. Prisma is canonical schema. Python models mirror it.

---

## BD-005: Default Schedule Intervals
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

River conditions: every 4 hours. Raft Watch: every 30 minutes.

---

## BD-006: pywebpush for Web Push
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Fixed package name to `pywebpush`. Auto-cleans expired subscriptions (HTTP 410).

---

## TD-001: Pytest + respx for Python Tests
**Status:** Accepted — **Date:** 2025-06-25 — **By:** Pappas

pytest + respx for httpx mocking, unittest.mock for SQLAlchemy session isolation, MagicMock factories with sentinel pattern.

---

## TD-002: Vitest for TypeScript Tests
**Status:** Accepted — **Date:** 2025-06-25 — **By:** Pappas

Vitest v3+ with `vi.hoisted()` for Prisma mocking. Node environment for API route testing.

---

## TD-003: Test Factory Sentinel Pattern
**Status:** Accepted — **Date:** 2025-06-25 — **By:** Pappas

Sentinel object (`_SENTINEL = object()`) as default in mock factories to distinguish `[]` from "not provided".

---

## TD-004: Test Organization
**Status:** Accepted — **Date:** 2025-06-25 — **By:** Pappas

Python: `pipeline/tests/` with conftest.py. TypeScript: `web/src/__tests__/` mirroring API structure. Commands: `pytest tests/`, `npx vitest run`.

---

## BD-008: datetime.utcnow() Deprecation Fix
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Replaced all `datetime.utcnow()` calls with `datetime.now(timezone.utc)` across the entire pipeline (8 files, ~30 occurrences). This eliminates the Python 3.12+ deprecation warning and produces timezone-aware UTC datetimes. A `_utc_now()` helper is used for SQLAlchemy column defaults and dataclass `default_factory`. Also added `_validate_startup()` to `main.py` for missing `DATABASE_URL` / VAPID key warnings.

---

## FE-006: Shared EmptyState + Skeleton + Toast Components
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

EmptyState: reusable component with `icon`, `title`, `description`, `children` props. Skeleton: CSS `animate-pulse` primitive; loading states render card-shaped skeleton grids. Toast: Radix Toast + `useToast` hook with module-level state/listener pattern; three variants (default, destructive, success), wired into root layout. Mobile nav active-route detection confirmed correct.

---

## TST-001: Test Coverage Expansion — Edge Cases
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

Added 38 new edge case tests (21 web, 17 pipeline; totals: 119 web, 147 pipeline). Findings: rivers API lacks input clamping (recommend aligning with deals route pattern); `$0` price is falsy in `deal_matcher._score_match()` (safe but under-scores free items); no test coverage for `craigslist.py`, `american_whitewater.py`, `push_notifier.py`, or component rendering. Next priorities: Craigslist scraper tests, push notifier tests, rivers route validation hardening.

---

## BD-009: Database Seed Script Strategy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Seed script at `web/prisma/seed.ts` uses `upsert` for entities with stable unique keys (user by id, rivers by awId, deals by url, filter by id). For child entities without unique constraints (conditions, hazards, campsites, rapids), uses `deleteMany` + `createMany` to stay idempotent. This avoids duplicates on repeat runs while keeping the script simple. Demo user ID is `"demo-user"` to match FE-004.

---

## BD-010: Service Worker — Notifications Only
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Service worker at `web/public/sw.js` handles only push notifications (push event, notificationclick, activate/claim). No caching or offline strategy — Next.js handles asset caching, and adding a cache layer would conflict with Next.js's own service worker behavior. Notification payloads are JSON with `{ title, body, url, tag }`.

---

## BD-011: River DELETE Endpoint
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Added `DELETE /api/rivers/:id` returning 204 on success, 404 if not found. Cascade deletion handled by Prisma schema (`onDelete: Cascade` on all river child relations). No auth check yet — will need one when user management is implemented (aligns with FE-004 temporary demo user approach).

---

## FE-007: Dashboard Homepage, River Delete, Dark Mode Toggle
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

**Dashboard Homepage** — Replaced static hero/marketing page with a functional dashboard. Quick stats row (rivers tracked, active hazards, gear deals, active filters), recent conditions (last 5 rivers), latest deals (3 most recent). Client component with `useEffect` + `Promise.allSettled`. Loading skeletons and empty states included.

**River Card Delete** — Trash2 icon button on hover in top-right of `river-card.tsx`. `window.confirm()` before calling `DELETE /api/rivers/{id}`. `onDelete` callback triggers parent refresh.

**API Fix: getRivers** — Fixed `getRivers` in `api.ts` to handle paginated response `{ rivers, total, limit, offset }`. Added `RiversResponse` interface and `deleteRiver` function.

**Dark Mode Toggle** — `theme-toggle.tsx` toggles `dark` class on `<html>`, persists in localStorage, respects system `prefers-color-scheme`. Added to both desktop sidebar and mobile header in `navigation.tsx`. CSS `html.dark` block in `globals.css`.

---

## TST-002: Round 3 Test Expansion — timeAgo & Deal Filters
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

Added 29 web tests (119 → 148): 25 `timeAgo` tests covering just-now, minutes, hours, days, months, years, invalid inputs, and future dates; 4 deal filter edge cases (non-existent user 404, special ASCII keywords, unicode/emoji keywords).

**Discoveries:** `timeAgo` lacks a "weeks ago" bucket — 7-29 days all display as "X days ago". Invalid date strings produce "NaN years ago" with no graceful fallback. Both flagged for fix.

---

## BD-012: API Error Helper Pattern
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Created `web/src/lib/api-errors.ts` with two helpers: `apiError(status, message)` for standardized JSON error responses, and `handleApiError(error)` for safe 500 handling that logs internally but never leaks stack traces. All API routes should use these instead of inline error construction. Refactored rivers and deal filter routes as examples.

---

## BD-013: PATCH Endpoints with Ownership Validation
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

PATCH endpoints use dedicated `*UpdateSchema` (Zod `.optional()` on each field) rather than `.partial()` on create schema, to support nullable fields. Deal filter PATCH requires `userId` in request body and checks against filter owner (403 on mismatch). Rivers PATCH does not require ownership (no auth yet).

---

## BD-014: Health Check Endpoint
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

GET `/api/health` returns `{ status, timestamp, version }`. Uses `prisma.$queryRaw` with `SELECT 1` to probe DB connectivity. Returns 200/ok or 503/degraded. Version hardcoded at `"0.1.0"`.

---

## FE-008: Settings Page, Edit River Dialog, MapLink & Accessibility
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

**Settings Page** (`/settings`) — Three sections: Notification Preferences (toggle switches per deal filter), Data Management (DB connection check + clear cache), About (version badge, GitHub link). Added to navigation sidebar and mobile tab bar.

**Edit River Dialog** — Pre-fills form with current river data, validates with `riverUpdateSchema`, calls `PATCH /api/rivers/[id]`, refreshes on success.

**MapLink Component** — Reusable component replacing inline Google Maps links. Props: `latitude`, `longitude`, `label`, `showLabel`.

**Accessibility** — Skip-to-content link, `aria-label` on all icon-only buttons, `aria-hidden` on decorative icons, `aria-expanded` on mobile menu, `role` attributes, page-level `<title>` via template pattern, keyboard-focusable delete button, screen-reader-only labels on settings toggles.

---

## TST-003: Round 4 Test Coverage for New Features
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

Added 51 new web tests (148 → 199) covering: api-errors helpers (13 tests), health endpoint edge cases (6 new), PATCH rivers (6 new — full update, unknown field stripping, imageUrl validation), PATCH deal filters (7 new — schema enforcement, ownership, multi-field updates). Seed script type-checks cleanly. Dashboard component not feasible to test without `@testing-library/react` + `jsdom`. Final counts: 199 web, 278 pipeline, **477 total**.
---

## BD-009: Hazard Classifier & RSS Parser Bug Fixes
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Fixes for two bugs reported by Pappas (QA-001):

1. **Hazard classifier keyword ordering** — Moved logjam check before strainer check in `_classify_hazard`. Removed ambiguous "log" keyword from strainer list. More specific keywords must precede broader ones to avoid substring false matches.
2. **RSS parser ElementTree truthiness** — Replaced `or`-based element lookups with explicit `is None` checks in Craigslist `_scrape_rss`. ElementTree elements with no children are falsy in Python, breaking truthiness-based patterns.

All 278 pipeline tests pass after both fixes.

---

## BD-015: Docker Production Configuration
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Four services in Docker Compose: `postgres` (PostgreSQL 16 Alpine), `db-migrate` (runs Prisma migrations, exits), `web` (Next.js standalone), `pipeline` (Python scrapers). Migration service uses builder stage from web Dockerfile and runs `prisma db push --skip-generate`. Both web and pipeline depend on successful migration before starting.

- **Web Dockerfile:** Multi-stage (deps → builder → runner). Uses pnpm with `--frozen-lockfile`. Standalone output mode. Production image runs as non-root `nextjs` user. Prisma client copied into production stage.
- **Pipeline Dockerfile:** Single stage, Python 3.12-slim. Installs system deps for psycopg2 and lxml compilation. Installs Playwright chromium for JS-rendered pages.
- All env vars use `${VAR:-default}` syntax in compose file so `.env` file is optional for basic local usage. Docker internal hostname is `postgres` (service name), not `localhost`.

---

## BD-016: GitHub Actions CI Workflow
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Four parallel jobs: `web-test` (vitest), `web-build` (next build for type errors), `web-lint` (eslint), `pipeline-test` (pytest). All use official setup actions with caching. Triggers on push to main/dev and PRs. Prisma generate runs before all web jobs since tests and build import Prisma client.

---

## BD-017: README Overhaul
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Comprehensive README with: project description, feature list, tech stack table, Docker quick start, local dev setup, VAPID key generation, project structure, complete API endpoint table (13 routes), testing commands, architecture diagram, contributing guide, MIT license.

---

## FE-007: Error Boundaries, Loading Skeletons & Search Filters
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Used Next.js App Router file conventions (`error.tsx`, `loading.tsx`, `not-found.tsx`) for error boundaries and loading states at both global and per-route levels.

- **Global error boundary** (`app/error.tsx`): "use client" component with `reset()` retry and dashboard fallback link.
- **Per-route boundaries**: rivers/[id] has its own `error.tsx` and `not-found.tsx` with route-specific messaging.
- **Loading skeletons**: Each route group has `loading.tsx` with skeleton grids matching the card layout shape.
- **River search filters**: Difficulty filter chips (client-side, `useMemo`), sort dropdown (Name A–Z / Recently Updated / Most Hazards). Chip colors match `RapidRating` color scheme.
- **Metadata**: Open Graph tags, Twitter card, emoji favicon via SVG data URL trick (🏞️).

---

## QA-002: Round 5 Test Coverage & Bug Discoveries
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Pappas

Added 166 tests across 5 files. Pipeline: 278 → 407. Web: 199 → 236. Total: 643.

**Bugs found:**
1. **USGS scraper lacks broad exception handling** — Only catches `httpx.HTTPError`. Non-numeric values ("Ice"), missing `sourceInfo`, and non-JSON responses cause uncaught `ValueError`, `KeyError`, `JSONDecodeError`.
2. **`_find_river()` only supports usgs/aw sources** — Sources in `SOURCE_PRIORITY` (blm, usfs, facebook) have no lookup logic; items from those sources are silently skipped.
3. **`classify_runnability(inf)` returns None** — Dangerous range uses `< inf` upper bound, so `inf < inf` is False. Logically incomplete.

All three bugs were fixed by the Coordinator in Round 5.

---

## BD-018: Authentication with NextAuth.js v5
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Implemented real authentication using NextAuth.js v5 (Auth.js) with Credentials provider and JWT session strategy, replacing the hardcoded `DEMO_USER_ID = "demo-user"` pattern (FE-004 superseded).

| Aspect | Choice |
|--------|--------|
| Auth Library | NextAuth.js v5 (`next-auth@beta`) |
| Session Strategy | JWT (stateless, no DB session lookups) |
| Initial Provider | Credentials (email + password) |
| Password Hashing | Node.js `crypto.pbkdf2Sync` (100K iterations, SHA-512) |
| Adapter | `@auth/prisma-adapter` (stores accounts, enables future OAuth) |

**Route Protection:** Public: GET rivers/deals. Auth required: all writes, deal filters, notification subscribe. Ownership enforced on deal filters (403 on mismatch).

**Why JWT:** No session table lookups on every request. Session model kept in schema for future database session option.

**Why PBKDF2 over bcrypt:** Avoids native module compilation (node-gyp). NIST-recommended, built into Node.js.

---

## FE-009: Auth UI Pattern
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Client-side session checking via NextAuth `SessionProvider` + `useSession()` rather than Next.js middleware-based auth gating.

- `SessionProvider` wraps entire app in root `layout.tsx` — all client components can access session.
- `AuthGuard` component uses `useSession()` + `useEffect` redirect pattern. Shows skeleton during loading, redirects to `/auth/signin?callbackUrl=…` when unauthenticated.
- Navigation conditionally shows Settings link when authenticated. User menu in sidebar (desktop) and header (mobile).
- Auth pages (`/auth/signin`, `/auth/register`) render without navigation chrome — full-screen centered cards.
- Registration uses Zod client-side validation → `/api/auth/register` → auto-sign-in on success.
- Replaced `DEMO_USER_ID` in settings page with actual `session.user.id`.

---

## TST-004: Auth System Test Coverage
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

61 new auth tests + 80 skipped scraper stubs. Web: 236 → 300. Pipeline: 407 passed + 80 skipped = 487 total.

**New test files:**
- `auth-register.test.ts` (23): registration validation, duplicate email, select clause, error handling.
- `auth-utils.test.ts` (23): hashPassword format/salt-uniqueness, verifyPassword edge cases, getCurrentUser/requireAuth.
- `api-middleware.test.ts` (15): withAuth 401 variants, x-user-id injection, request immutability.
- `test_blm_scraper.py` (42 skipped): init, URL, parsing, rate limiting, normalization stubs.
- `test_facebook_scraper.py` (38 skipped): init, auth, post parsing, date extraction, river mentions stubs.

No behavioral changes to production code.

---

## BD-019: Land Agency Scraper Architecture
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

BLM and USFS scrapers run on a separate 6-hour schedule (`run_land_agency_scrapers()`) rather than being added to the existing 4-hour river scraper cycle.

**Rationale:**
- Land agency advisory data changes much less frequently than USGS gauge data or AW trip reports
- BLM and USFS APIs have stricter rate limits; fewer requests = better citizen behavior
- USFS RIDB API requires an API key (`RIDB_API_KEY`); scraper gracefully skips when key is absent
- Separate schedule allows independent tuning via `LAND_AGENCY_INTERVAL_MINUTES`
- Both scrapers include `river_name` in ScrapedItem data so the condition processor's `_find_river()` name-based fallback can match them to tracked rivers (no `aw_id` or `usgs_gauge_id` available from these sources)

| Setting | Env Var | Default |
|---------|---------|---------|
| `blm_base_url` | `BLM_BASE_URL` | `https://www.blm.gov/services/recreation` |
| `ridb_api_key` | `RIDB_API_KEY` | `""` (empty = skip USFS) |
| `land_agency_interval_minutes` | `LAND_AGENCY_INTERVAL_MINUTES` | `360` (6 hours) |

---

## FE-010: Profile, Compare, Favorites Features
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

**User Profile Page** — Route: `/profile`, protected by `AuthGuard`. Inline edit for name/email via PATCH `/api/user/profile`. Session refreshed after edits so nav reflects changes.

**River Comparison View** — Route: `/rivers/compare?rivers=id1,id2,id3`. Shareable URLs via query params (2-3 rivers max). Desktop: comparison table. Mobile: stacked cards. "Compare" button on rivers page enters selection mode (checkbox UI on cards).

**Tracked Rivers / Favorites** — Route: `/rivers/favorites`, protected by `AuthGuard`. New API: `GET/POST/DELETE /api/user/rivers` — all `withAuth()`-protected. Uses existing `UserRiver` model (already in Prisma schema). Star/heart icon on river cards toggles tracking. "My Rivers" nav link added to `authNavItems` (visible only when authenticated).

**Navigation Changes** — Added "My Rivers" (Star icon) to sidebar/bottom bar (auth-only). Added "Profile" link in user menu dropdown (above Settings). Mobile avatar links to `/profile`.

**Cross-agent notes:** No Prisma schema changes needed (UserRiver model already existed). Three new API route handlers at `/api/user/rivers` use standard `withAuth()` + Prisma patterns.

---

## QA-003: BLM Advisory Type Map Ordering & River Name Extraction
**Status:** Observation — **Date:** 2026-02-24 — **By:** Pappas

**Advisory type map ordering:** BLM scraper's `ADVISORY_TYPE_MAP` dict ordering causes "winter closure" text to match the "closure" keyword before reaching the more specific "winter closure" → "seasonal_access" entry. Same pattern in USFS `ALERT_TYPE_MAP`. Impact is low — both classify as functionally similar (area inaccessible). Fix if distinguishing seasonal vs. emergency closures matters: reorder maps to check longest-match-first.

**River name extraction:** BLM `_extract_river_name` uses a greedy regex that captures all consecutive capitalized words before "River"/"Creek"/"Canyon"/"Fork". When river name appears in multiple fields (title, area, description), combined text can produce duplicate matches like "Salmon Creek Salmon Creek". Per-field extraction or deduplication would be more precise.

---

## TST-005: Round 7 Test Coverage — BLM, USFS, Profile, User Rivers
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

204 new tests across 4 files. Pipeline: 407 → 566 passed (43 skipped). Web: 300 → 345. Total: 954.

**New/rewritten test files:**
- `test_blm_scraper.py` (88 tests, replacing 42 skipped stubs): advisory type/severity classification, river name extraction, date parsing, API+RSS response parsing, rate limiting, error handling, full integration.
- `test_usfs_scraper.py` (71 tests): API key gating, alert type/severity classification, river name extraction, facility/rec area alert parsing, HTTP mocked fetch, rate limiting, full integration.
- `user-profile.test.ts` (22 tests): GET profile with counts, PATCH name/email, 409 duplicate email, validation errors, no passwordHash leak.
- `user-rivers.test.ts` (23 tests): GET tracked rivers, POST add/duplicate/missing, DELETE remove/not-tracked, validation, auth enforcement.

---

## BD-020: Email Notifications via Resend + OAuth Providers
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Added `EmailNotifier` class in `pipeline/notifiers/email_notifier.py` using the Resend API. Runs alongside existing `PushNotifier` — email dispatch is gated by user's `NotificationPreference`:

- **Channel check:** Only sends email if user's channel is `"email"` or `"both"`. Default for new users is `"push"` (no change to existing behavior).
- **Per-type check:** Each alert type (deals, conditions, hazards, digest) can be independently toggled.
- **Graceful degradation:** Missing `RESEND_API_KEY` = all email silently skipped. Email failures never break the scraping pipeline.

New `NotificationPreference` model in both Prisma and SQLAlchemy:
- `channel`: `"push"` | `"email"` | `"both"` (default: `"push"`)
- `dealAlerts`, `conditionAlerts`, `hazardAlerts`: boolean, default true
- `weeklyDigest`: boolean, default false

New `AlertLog` model tracks every notification sent. **SQLAlchemy gotcha:** `metadata` is reserved by SQLAlchemy's Declarative API. Python attribute is `extra_data`, DB column is still `metadata`.

OAuth: Added Google and GitHub providers to NextAuth with `allowDangerousEmailAccountLinking: true`. New env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`.

New API routes: `GET/PATCH /api/user/notifications` (notification prefs), `GET /api/alerts` (paginated alert history with type filter).

---

## FE-011: OAuth Sign-In Buttons, Notification Preferences UI, Alert History
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

OAuth buttons (Google + GitHub) added to sign-in and registration pages. Visual "or" divider separates OAuth from credentials form.

`GlobalNotificationPreferences` section on Settings page with channel selector (Push/Email/Both) and four toggle switches (Deal Alerts, Condition Alerts, Hazard Alerts, Weekly Digest). Save button with dirty-state tracking.

Alert history page at `/alerts` (AuthGuard-protected): filter tabs (All/Deals/Conditions/Hazards), paginated card list with Load More, empty states.

`NotificationBell` component in navigation header (desktop + mobile): dropdown with 5 most recent alerts, badge with unread count, polls every 60s.

**Note:** Prisma client needs `npx prisma generate` for `alertLog` and `notificationPreference` models.

---

## TST-006: Round 8 Test Coverage — Email Notifier, Notification Prefs, Alerts
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

116 new tests across 3 files. Pipeline: 566 → 636 passed (43 skipped). Web: 345 → 387. Total: 1023 + 43 skipped.

- `test_email_notifier.py` (70 tests): all 4 send methods, config guard, Resend error handling, template structure.
- `notification-prefs.test.ts` (22 tests): GET/PATCH `/api/user/notifications` — defaults, validation, auth.
- `alerts.test.ts` (24 tests): GET `/api/alerts` — pagination, type filtering, auth, edge cases.

**Edge case:** `parseInt("0") || 20` treats `limit=0` as falsy → defaults to 20 instead of clamping to 1. Fixed by Coordinator using `Number.isFinite` check.

---

## BD-021: Alerts API limit=0 Edge Case Fix
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Coordinator

Alerts route `GET /api/alerts` used `parseInt(param) || 20` for limit fallback. Since `parseInt("0")` returns `0` (falsy in JS), `limit=0` silently became 20. Fixed to use `Number.isFinite(parsed) ? parsed : 20` so only `NaN` falls to default. `limit=0` now correctly flows to `Math.max(0, 1) = 1`.

---

## BD-022: SSE for Real-Time Updates (Not WebSocket)
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Chose Server-Sent Events over WebSocket for real-time river condition updates. SSE is simpler with Next.js App Router (just a GET route returning a ReadableStream), works natively with HTTP/2, auto-reconnects via `retry:` directive, and is sufficient since data flow is server→client only. The endpoint polls the database every 30 seconds rather than using database triggers or pub/sub, keeping infrastructure simple (no Redis/message broker needed). Client-side `useRiverSSE` hook implements exponential backoff (1s–30s max) for reconnection.

---

## BD-023: Service Worker Caching Strategy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Updated `web/public/sw.js` (previously notifications-only per BD-010) to add caching strategies:
- **Cache-first** for static assets (JS, CSS, fonts, images, `/_next/static/`) — fast repeat loads
- **Network-first** for API calls — fresh data preferred, cached fallback when offline
- **SSE excluded** from caching entirely (streaming connections can't be cached)
- **Cache versioning** via `CACHE_VERSION` constant — old caches cleaned up on activate
- **`skipWaiting()`** on install for immediate activation of new versions

This supersedes BD-010's "no caching" stance. Next.js handles its own build-time caching, but the SW cache layer adds true offline support and faster asset loading. The two strategies don't conflict because the SW cache is keyed by request URL, same as Next.js's cache-busted asset URLs.

---

## BD-024: Data Export API Design
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Export endpoint at `GET /api/export` supports three formats via query param:
- **JSON**: Structured data with `Content-Disposition: attachment`
- **CSV**: RFC 4180-compliant with proper escaping (commas, quotes, newlines)
- **GPX**: Valid GPX 1.1 XML for GPS devices — only for river waypoints with lat/lng

Scope is user's data only: tracked rivers, conditions (last 30 days), matched deals. The `type` param (rivers|conditions|deals|all) controls which data categories to include. GPX returns 400 for non-river types since waypoints require coordinates.

All formats use Zod validation on query params and `withAuth()` for access control.

---

## FE-012: Vanilla Leaflet Over react-leaflet
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Used vanilla Leaflet with `useRef` + `useEffect` + dynamic `import()` instead of react-leaflet for the `/map` page. react-leaflet has known compatibility issues with Next.js App Router SSR (Leaflet requires `window`). The vanilla approach with dynamic import and a cleanup function in useEffect is more robust and avoids adding another dependency. Leaflet CSS loaded from CDN (`unpkg.com/leaflet@1.9.4/dist/leaflet.css`).

---

## FE-013: Weather Widget via Open-Meteo
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Weather data for river detail pages uses the Open-Meteo free API (no API key, no rate limits for personal use). Added as a "Weather" tab on the river detail page rather than an always-visible section, to keep the page scannable and not load weather data until the user clicks the tab (lazy via tab activation → component mount). Converts Celsius to Fahrenheit and km/h to mph for US-centric audience.

---

## FE-014: Export Page — GPX Format Restriction
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

GPX export format is automatically disabled when the user selects a data type other than "Rivers", since GPX requires lat/lng waypoints. If the user changes type while GPX is selected, format auto-switches to JSON to prevent invalid exports. This avoids confusing error states.

---

## FE-015: Map Page River Data Requires lat/lng on RiverSummary
**Status:** Observation — **Date:** 2026-02-24 — **By:** Tyler

The map page fetches rivers via `getRivers()` which returns `RiverSummary` — this type currently does NOT include `latitude`/`longitude`. The API response (`/api/rivers` GET) would need to include these fields for the map to populate markers. Rivers without coordinates are silently excluded from the map. If the API doesn't return lat/lng on the summary endpoint, the map will be empty. The backend (Utah) should ensure the rivers GET API includes `latitude` and `longitude` in its response, or we need a separate endpoint.

---

## QA-004: Round 9 Test Coverage & Security Observations
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

Added 98 new tests across 3 files. Web: 387 → 485. Pipeline unchanged (636 + 43 skipped). Grand total: 1,164.

**New test files:**
- `sse-rivers.test.ts` (19 tests): SSE response headers, retry directive, event data shapes, null field handling, Prisma error graceful handling.
- `export.test.ts` (41 tests): auth protection, format/type validation, JSON/CSV/GPX structure, escaping, user-scoped data, 30-day condition window.
- `sse-client.test.ts` (38 tests): SSE client factory, cleanup, event parsing, weather utility logic (WMO code mapping, temperature/speed conversion).

**Issues found:**
1. **SSE userId leak (Security)** — `GET /api/sse/rivers` has no auth. Deal-match events include `userId`, `filterName`, `filterId`, leaking user-specific data to any listener.
2. **SSE interval leak** — `cancel()` callback on ReadableStream is empty; `setInterval` timer runs forever after client disconnects. The `closed` flag prevents enqueueing but doesn't stop the polling loop.
3. **GPX early validation** — GPX export rejects invalid `type` only inside `gpxExport()`, after `fetchExportData()` already queried the DB. Moving the check before the fetch avoids unnecessary queries.

**Observation:** CSV export uses `# Rivers` section headers — `#` is not standard CSV and may confuse some parsers.

---

## BD-025: Trip Planner API Design
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Trip planner uses two models: `Trip` (container with status/dates) and `TripStop` (per-day river assignments). Stops are a sub-resource of trips rather than a separate top-level entity, matching REST conventions.

**Status workflow:** `planning` → `active` → `completed` (or `cancelled` at any point). Default is `planning`. No automatic status transitions — client controls this via PATCH.

**Access control:** Trips are private by default (`isPublic: false`). GET trip detail allows access to owner or any authenticated user if `isPublic: true`. List endpoint (`GET /api/trips`) only returns the authenticated user's own trips.

**Stop validation:** Adding a stop validates that the referenced river exists (404 if not). Stops include `putInTime`/`takeOutTime` as simple `HH:MM` strings — not DateTime — because they represent planned times without timezone complexity.

---

## BD-026: River Reviews — One Per User Per River (Upsert Pattern)
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Reviews use a `@@unique([riverId, userId])` constraint enforcing one review per user per river. The POST endpoint uses `prisma.riverReview.upsert()` so submitting a review for a river you've already reviewed updates the existing one instead of returning a conflict error. This matches the UX pattern of "edit your review" rather than "you already reviewed this."

GET reviews endpoint is public (no auth required) and includes paginated reviews with user info (id, name, image) plus an aggregate `averageRating` via `prisma.riverReview.aggregate()`.

---

## BD-027: In-Memory Rate Limiting with Token Bucket
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Rate limiting uses an in-memory token bucket algorithm rather than Redis or database-backed counters. Appropriate for single-instance deployment: no external dependencies, sub-millisecond per check.

**Trade-offs:**
- Rate limit state resets on server restart (acceptable for abuse prevention, not for billing)
- Not shared across instances (would need Redis if scaling horizontally)
- Memory growth bounded by stale entry cleanup (entries > 5min old purged every 60s)

**Composition:** `withRateLimit(handler, config)` HOF composes with `withAuth()` — rate limit check runs first (before auth) so unauthenticated flood requests are rejected cheaply.

**Applied limits:** Registration at 5/min (strict), review POST at 10/min (moderate). General API default is 60/min but not yet applied globally.

**Testing:** Token bucket state persists across tests within a single vitest run. Tests for rate-limited endpoints must mock `@/lib/rate-limit` to avoid exhausting tokens.

---

## FE-016: Trip Planner Architecture
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Trip planner uses client-side filtering with tab buttons (All/Upcoming/Past/Cancelled) rather than server-side filtering, since trip counts per user are expected to be low. Trip detail page uses day-by-day card layout where each day's stops are grouped by `dayNumber` from the API. River selection for stops uses a reusable `RiverPickerDialog` with debounced search against `GET /api/rivers`.

---

## FE-017: Star Rating Component Design
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

`StarRating` display component uses filled, half-filled, and empty star icons from lucide-react for fractional ratings. Review form uses a simpler integer-only click-to-set star selector with hover preview. Both are inline (no external star rating library). `StarRating` is exported from `river-reviews.tsx` for reuse on the stats page.

---

## FE-018: Review Tab on River Detail Page
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Added Reviews as a 6th tab (grid-cols-6) on the river detail page rather than a separate section. Lazy-loads review data only when the user clicks the tab. Average rating fetched alongside river data via `Promise.all` and shown in the header area.

---

## FE-019: Stats Dashboard — CSS Donut Chart
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Condition quality breakdown uses a CSS `conic-gradient` donut chart with a transparent center (via `mask: radial-gradient`). No chart library dependency. Color scheme matches existing `qualityColor` utility — green (excellent), blue (good), yellow (fair), orange (poor), red (dangerous).

---

## FE-020: Stats Data Fetching Strategy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Stats page uses `Promise.allSettled` to fetch data from 6 endpoints in parallel. Each section renders independently based on its own resolved/rejected state. Quality breakdown computed client-side from `RiverSummary` data rather than requiring a dedicated API endpoint.

---

## TST-007: Round 10 Test Coverage — Trips, Reviews, Rate Limiting
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

Added 87 new web tests (485 → 572) across 4 files:
- `trips.test.ts` (30): Full CRUD for trip planner API with auth, ownership, and validation coverage.
- `trip-stops.test.ts` (17): Add/remove trip stops with river existence validation, ownership checks, time format validation.
- `reviews.test.ts` (20): Paginated GET (public), POST create/upsert with rating 1-5, rate limiting integration.
- `rate-limit.test.ts` (20): Token bucket algorithm, refill timing, per-IP isolation, stale cleanup, withRateLimit middleware headers.

Pipeline unchanged: 636 passed + 43 skipped. Grand total: 1,251.

**BUG: tripUpdateSchema missing endDate >= startDate refinement** — `tripUpdateSchema` uses `.optional()` on all fields but has no `.refine()` to enforce `endDate >= startDate`. The create schema has this refinement but PATCH requests can set `endDate` before `startDate` without validation error. Fixed by Coordinator.

**Observation:** Reviews GET route has no `sort` query parameter — always orders by `createdAt desc`. Sort by rating would require a `sort` param with `orderBy` switch.

---

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

---

## FE-021: Global Search — Command Palette Pattern
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Search palette uses a full-screen overlay triggered by Cmd/Ctrl+K (global `keydown` listener) or clicking the search icon in navigation. Mounted at the Navigation component level to ensure it's available on all pages. State managed via `open`/`onOpenChange` prop pattern passed down to `DesktopNav`/`MobileNav` via `onSearchOpen` callback.

Results from `GET /api/search?q={query}&limit=8` are grouped by type (rivers, deals, trips, reviews) and displayed in sections. Arrow keys navigate a flat index across all groups. Recent searches stored in localStorage (last 5 entries, keyed by `water-watcher-recent-searches`).

The dedicated `/search` page uses `useSearchParams()` wrapped in a Suspense boundary (required by Next.js for client components using search params) with type filter tabs and card grid results.

---

## FE-022: Photo Gallery — Base64 Upload Strategy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Photos are uploaded as base64 data URLs via the existing `POST /api/rivers/:id/photos` endpoint. Client converts file to data URL using `FileReader.readAsDataURL()`. This avoids needing a separate file upload endpoint or object storage integration. Max file size enforced client-side at 5MB.

Lightbox uses vanilla DOM event listeners for keyboard navigation (arrow keys, Escape) and locks body scroll while open (`document.body.style.overflow = "hidden"`). No external lightbox library needed.

Gallery uses Intersection Observer for lazy loading additional photos beyond the initial 12, with a sentinel div approach.

---

## FE-023: River Detail Tab Grid — 7 Columns
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

River detail page now has 7 tabs: Conditions, Weather, Hazards, Rapids, Campsites, Photos, Reviews. Tab grid expanded from `grid-cols-6` to `grid-cols-7`. On mobile, tab labels hide icons (existing `hidden sm:inline-block` pattern). The Photos tab shows a count badge like "Photos (5)" when photos exist.

---

## FE-024: Scrape Monitor — Interval-Based Health Status
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Scraper health status uses a traffic light system based on the scraper's expected interval:
- **Green** (Healthy): Last scrape within 2x the expected interval
- **Yellow** (Delayed): Last scrape within 2-3x the expected interval
- **Red** (Error): Last scrape older than 3x the expected interval, or never scraped

Intervals are hardcoded in the frontend based on known pipeline settings: USGS/AW = 4 hours, Craigslist = 30 minutes, BLM/USFS = 6 hours. If these change in the pipeline, the frontend config should be updated to match.

The scrapers page is at `/admin/scrapers` rather than a top-level `/scrapers` route, following admin page conventions. Added to `authNavItems` with the Activity icon.

---

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

---

## BD-031: Docker Compose Lightweight Migration
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Replaced the `db-migrate` service from building the full web Dockerfile (target: builder) to using a lightweight `node:20-alpine` image with volume-mounted Prisma schema. This avoids needing `pnpm build` (which requires DATABASE_URL at build time) just to run `prisma db push --skip-generate`. Dummy DATABASE_URL build arg added to web Dockerfile for the builder stage.

---

## BD-032: Facebook Scraper Dual Strategy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Facebook scraper uses Graph API when `FACEBOOK_ACCESS_TOKEN` is configured, falls back to public mobile site scraping otherwise. Graph API provides structured data (timestamps, author, images), while public scraping is best-effort with limited data. Source priority remains 30 (lowest) per BD-002. Scheduled every 6 hours (configurable via `FACEBOOK_INTERVAL_MINUTES`).

---

## BD-033: Password Reset Token Model
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Created separate `PasswordResetToken` model rather than reusing `VerificationToken`. The VerificationToken model uses `identifier` (email) + `token` as its compound key and has no primary `id` field, making it awkward for password reset workflows that need deletion by token alone. The new model has its own `id`, `email`, `token` (unique), and `expires` fields. Tokens expire in 1 hour. Anti-enumeration: forgot-password always returns 200 regardless of email existence.

---

## BD-034: Security Headers via Next.js Config
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection, Permissions-Policy, HSTS) added via `next.config.ts` `headers()` function. Applied to all routes `/(.*).` HSTS set to 1 year with includeSubDomains. Geolocation permitted for self (needed for map features), camera and microphone denied.

---

## BD-035: Playwright Optional in Docker
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Made Playwright browser install optional in pipeline Dockerfile (`|| echo "skipped"`). Playwright is only needed for JavaScript-heavy scraping targets, and its installation (Chromium + deps) adds significant image size and can fail in constrained environments. Current scrapers (USGS, AW, Craigslist, BLM, USFS, Facebook) all use httpx + BeautifulSoup.

---

## BD-036: Email Utility for Web (Resend)
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Created `web/src/lib/email.ts` with `sendPasswordResetEmail()` and `sendVerificationEmail()` functions. Uses Resend API via direct `fetch()` (no SDK dependency). Graceful no-op when `RESEND_API_KEY` is not configured — logs warning but never crashes. Matches the pattern established in the pipeline's `EmailNotifier`.

---

## FE-025: Password Reset & Email Verification Auth Flow
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Three new auth pages at `/auth/forgot-password`, `/auth/reset-password`, and `/auth/verify-email`. Forgot Password shows confirmation regardless of email existence (anti-enumeration). Reset Password uses Zod validation with password strength indicator (5-segment bar). Email Verification auto-fires on mount with three-state machine (loading → success/error), auto-redirects to sign-in after 3 seconds. Added "Forgot password?" link on sign-in page.

---

## FE-026: Comprehensive README Overhaul
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Complete rewrite of `README.md` to reflect all features from Rounds 1–12. Covers 37 API endpoints, 13 feature categories, 22 environment variables, and 17 tech stack entries. Badges at top, ASCII architecture diagram, API table with Auth column, environment variables as table with Required/Default columns.

---

## FE-027: PWA SVG Icons & Offline Page
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Replaced placeholder PNG icon references with SVG icons using water-drop-on-mountain design with sky-blue gradients. Manifest updated to `type: "image/svg+xml"`. Offline page (`web/public/offline.html`) is static HTML with all CSS inlined, matching app dark theme. Service worker `PRECACHE_ASSETS` updated to include `/offline.html` and new icon paths.

---

## FE-028: Seed Script — Trips & Reviews
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Extended `web/prisma/seed.ts` with sample Trip ("Gore Canyon Weekend"), 3 TripStops, and 3 RiverReviews. Trip uses upsert with stable `id: "demo-trip"`, stops use deleteMany + createMany, reviews use upsert on `riverId_userId` compound unique. All new seed data references existing demo user and demo rivers.

---

## TST-009: Round 12 Test Coverage — Facebook Scraper, Password Reset, Email, Security
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

Replaced all 43 skipped Facebook scraper test stubs with 110 working tests. Created 3 new web test files: `auth-password-reset.test.ts` (26), `email.test.ts` (19), `security-headers.test.ts` (9). Pipeline: 636 → 746 passed, 43 → 0 skipped. Web: 668 → 722. Grand total: 1,468. Zero skipped tests in entire project.

**Patterns:** Email tests use `vi.resetModules()` for module re-import due to env var reads at module scope. Security headers tested via direct config import. Facebook scraper tests use `respx` + pre-set `_river_cache` to avoid DB calls.

**Observations:** Facebook `_classify_condition` uses dict insertion order for keyword priority (correct per Python 3.7+). `_extract_river_mentions` hashtag handling only splits CamelCase. `_handle_rate_limit` caps Retry-After at 300 seconds.
---

## BD-037: Admin Role System — JWT-Based Role Propagation
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Added `role` field to User model (Prisma canonical, SQLAlchemy mirror). Role values: `"user"` (default), `"admin"`. Propagated through NextAuth ecosystem: `authorize()` returns role, JWT callback stores `token.role`, session callback copies to `session.user.role`. `requireAdmin()` helper checks session role, returns 401/403 NextResponse.

**Trade-off:** Role is read from DB only at sign-in time and cached in JWT. Role changes don't take effect until JWT expires or user re-authenticates. Acceptable at current scale. Self-demotion prevention: PATCH `/api/admin/users/[id]` prevents admins from removing their own admin role.

---

## BD-038: Next.js Middleware for Server-Side Route Protection
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Created `web/src/middleware.ts` using NextAuth.js v5's `auth()` wrapper. Server-side redirects replace client-side-only AuthGuard as primary gate — faster UX, no flash of protected content. Protected routes redirect to `/auth/signin?callbackUrl=...`. Admin routes redirect non-admins to `/`. Public routes pass through. Matcher excludes API routes (they have their own auth), static assets, and PWA files.

---

## BD-039: River Analytics API — Query-Time Aggregation
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

`GET /api/rivers/[id]/analytics` computes all analytics at query time: flow trends (daily averages), quality distribution (groupBy), best time to visit (month with most excellent/good), reviews (count + avg rating), visits (tripStop count). All five queries run in parallel via `Promise.all`. Public endpoint (no auth). Acceptable because per-river analytics are low-traffic and data volume per river is bounded.

---

## FE-029: Admin User Management Pattern
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Admin user management page at `/admin/users` uses client-side admin role check (`session.user.role`) rather than middleware-level gating. Role dropdown uses native `<select>` over Radix Select — better accessibility for simple two-option choice. Users cannot change their own role (self-demotion prevention). Server-side authorization enforced by API (`PATCH /api/admin/users/[id]`).

---

## FE-030: Keyboard Shortcuts Overlay Component
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

`KeyboardShortcuts` component renders full-screen overlay of all shortcuts, triggered by `?` key (except in inputs/textareas/selects). Mounted at Navigation level alongside SearchPalette. Uses same visual pattern (fixed overlay with backdrop, rounded card).

---

## FE-031: Accessibility Standards Applied
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Comprehensive accessibility audit: all icon-only buttons have `aria-label`, decorative icons have `aria-hidden="true"`, active nav links use `aria-current="page"`, toast viewport has `aria-live="polite"`, expandable elements have `aria-expanded`, dropdowns close on Escape, search palette has focus trap, badge colors verified WCAG AA (4.5:1 minimum).

---

## TST-010: Round 13 Test Coverage — Admin, Middleware, Analytics, Accessibility
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

Added 163 new web tests (722 → 885) across 6 files: `admin-users.test.ts` (+15), `middleware.test.ts` (35, was 2), `river-analytics.test.ts` (+9), `lib/admin.test.ts` (22), `accessibility.test.ts` (42), `scrapers.test.ts` (+3). 0 bugs found. Pipeline 746 unchanged. Grand total: 1,631.

**Observations:** Middleware redirects non-admin to `/` (correct UX for page nav, differs from API 403 pattern). Admin users `POST /api/admin/users` uses `Number(body.limit) || 20` — `limit=0` silently becomes 20 (same pattern as alerts route).

---

## BD-040: Content Security Policy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Added comprehensive CSP header to `web/next.config.ts`. Policy: `default-src 'self'`, `style-src 'self' 'unsafe-inline' unpkg.com` (Tailwind + Leaflet CDN), `img-src 'self' data:` (base64 uploads), `connect-src` allows Open-Meteo and OAuth origins, `frame-src` allows OAuth, `frame-ancestors 'none'`, `worker-src 'self' blob:`, `object-src 'none'`. Violations reported to `POST /api/csp-report` (logs to console). No `unsafe-eval` anywhere — using strict script-src.

---

## BD-041: ETag Caching for Public GET Endpoints
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Created `withETag(handler)` HOF in `web/src/lib/etag.ts`. Uses MD5 hash of response body as weak ETag. Returns 304 Not Modified when `If-None-Match` matches. Sets `Cache-Control: public, max-age=60, stale-while-revalidate=300`. Applied to 4 public GET endpoints: `/api/rivers`, `/api/rivers/[id]`, `/api/deals`, `/api/search`. User-specific endpoints (trips, alerts, user/rivers) intentionally excluded — their data varies per user and should not be publicly cached.

---

## BD-042: Input Sanitization for User Content
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Created `web/src/lib/sanitize.ts` with regex-based HTML stripping (no external library). Strips script/iframe/object tags, event handlers, javascript: URLs. Applied to all user-generated text fields: review title/body, trip name/notes, photo captions. Combined with `truncate()` for length enforcement. Sanitization runs after Zod validation, before DB write.

---

## FE-032: Onboarding Wizard — localStorage Completion Tracking
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Onboarding completion tracked via `localStorage` key `water-watcher-onboarding-complete` rather than a server-side flag on the User model. Rationale: avoids schema changes, instant read (no API call), and the wizard is purely a UX convenience — if localStorage is cleared, the user simply sees the wizard again (no harm). If we later want server-side tracking, we can layer it on without breaking the existing flow.

---

## FE-033: ErrorFallback Component with Variant System
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Created a reusable `ErrorFallback` component with 4 variants (`not-found`, `server-error`, `network-error`, `auth-error`). Each variant has a default icon, title, and description that can be overridden via props. Existing error boundaries (`app/error.tsx`, `rivers/[id]/error.tsx`) refactored to use it. New error boundaries should use `ErrorFallback` instead of building custom Card layouts. The `onRetry` callback enables Try Again behavior, `showReportLink` adds a GitHub issues link.

---

## FE-034: Print Stylesheet Strategy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Print styles live in a single `@media print` block at the end of `globals.css`. Uses role-based and attribute selectors (`[role="tabpanel"]`, `[role="tablist"]`, `a[href^="http"]`) for durability — they work regardless of Tailwind class name changes. Forces light theme via `!important` overrides. River detail tabs are displayed sequentially (all panels visible) in print. Custom `print:hidden` class available for any element that should be hidden when printing.

---

## FE-035: NetworkStatus Offline Banner
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

`NetworkStatus` component mounted in root layout shows a dismissable banner when the browser goes offline. Uses `navigator.onLine` + `online`/`offline` events. Auto-hides on reconnection. z-index 60 places it above all other UI including navigation (z-30) and modals (z-50).

---

## TST-011: Round 14 Test Coverage — CSP, ETag, Input Sanitization
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

Created 3 new test files with 97 tests covering Round 14 features:

- **CSP & Security Headers** (24 tests): Full CSP directive coverage, Leaflet CDN allowance, CSP report endpoint behavior.
- **ETag Caching** (18 tests): withETag HOF — 304 negotiation, Cache-Control, data-dependent hashing, non-200 passthrough.
- **Input Sanitization** (55 tests): sanitizeHtml (XSS prevention), sanitizeFilename (safe downloads), truncate (length enforcement).

### Edge Cases Found

1. `sanitizeFilename` collapses dashes into underscores — `my-file.csv` → `my_file.csv`. Intentional but potentially surprising.
2. `sanitizeFilename("   ")` → `"_"` not `"download"`. Whitespace-only input doesn't trigger the empty fallback.
3. `withETag` consumes response body (single-use). Tests must provide fresh Response objects per invocation.

### Full Suite Status

- **Web:** 982 tests, 0 failures (39 files)
- **Pipeline:** 746 tests, 0 failures (17 files)
- **Grand total: 1,728 tests, 0 failures**

No test failures or regressions detected across the entire codebase.