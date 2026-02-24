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
**Status:** Temporary — **Date:** 2026-02-24 — **By:** Tyler

`DEMO_USER_ID = "demo-user"` hardcoded. Replace with actual auth when user management is implemented.

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

## BD-009: Hazard Classifier & RSS Parser Bug Fixes
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Fixes for two bugs reported by Pappas (QA-001):

1. **Hazard classifier keyword ordering** — Moved logjam check before strainer check in `_classify_hazard`. Removed ambiguous "log" keyword from strainer list. More specific keywords must precede broader ones to avoid substring false matches.
2. **RSS parser ElementTree truthiness** — Replaced `or`-based element lookups with explicit `is None` checks in Craigslist `_scrape_rss`. ElementTree elements with no children are falsy in Python, breaking truthiness-based patterns.

All 278 pipeline tests pass after both fixes.