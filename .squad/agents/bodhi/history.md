# Bodhi — History

## Core Context
- **Project:** Water-Watcher — Whitewater Rafting Tracker
- **User:** Spencer Fowers
- **Stack:** Next.js 15 (TypeScript) + Python 3.11+ + PostgreSQL 16
- **Key data sources:** Facebook posts, BLM, National Forest Service, American Whitewater, USGS, Craigslist
- **Features:** River tracking, condition scraping, hazard alerts, campsite info, rapid guides, Raft Watch (gear deals)

## Learnings

<!-- Append learnings below. Format: **YYYY-MM-DD:** what was learned -->

**2026-02-24:** Chose two-service architecture (web/ + pipeline/) sharing PostgreSQL. Prisma is the canonical schema owner; Python SQLAlchemy models mirror it. This lets Tyler (frontend) and Utah (backend) work independently with clear ownership boundaries.

**2026-02-24:** Stack: Next.js 15 App Router + Tailwind v4 + Prisma for web; Python + SQLAlchemy + APScheduler + httpx/BeautifulSoup for pipeline. Rejected full-TypeScript approach because Python's scraping ecosystem is much stronger.

**2026-02-24:** Key file paths:
- Prisma schema (canonical DB schema): `web/prisma/schema.prisma`
- TypeScript types: `web/src/types/index.ts`
- API routes: `web/src/app/api/`
- Python models: `pipeline/models/models.py`
- Scraper base class: `pipeline/scrapers/base.py`
- Pipeline config: `pipeline/config/settings.py`
- Environment template: `.env.example`

**2026-02-24:** Database is the integration contract between web and pipeline. No RPC, no message queue — PostgreSQL serves as the shared state layer. This keeps things simple for a solo developer.

**2026-02-24:** USGS scraper is the most complete — real API with JSON responses. AW and Craigslist scrapers are scaffolded with TODOs for Utah to implement the parsing logic.

**2026-02-24:** Notifications use Web Push API (browser service worker). No third-party notification service needed. Email via Resend is planned as a secondary channel.

---

## Cross-Agent Updates

**2026-02-24 (from Tyler):** Full frontend complete — 10 UI primitives, 8 domain components, 4 pages. Mobile-first responsive design with bottom tab bar navigation. Client-side data fetching with typed API client. Temporary `DEMO_USER_ID` for deal filters until auth is implemented.

**2026-02-24 (from Utah):** Full pipeline implemented — AW scraper (JSON + HTML), Craigslist (RSS + fallback), condition processor with source priority merging, scored deal matcher (50+ threshold), push notifier with pywebpush. All 5 API routes enhanced with pagination, search, validation, error handling. SQLAlchemy models mirroring Prisma schema.

**2026-02-24 (from Pappas):** 228 tests total (130 Python + 98 TypeScript), all passing. Full coverage of scrapers, processors, deal matcher, models, validations, and API routes.

**2026-02-24 (Round 4 cross-agent — from Utah):** Created api-errors utility, health endpoint, PATCH APIs for rivers and deal filters. 168 web tests.

**2026-02-24 (Round 4 cross-agent — from Tyler):** Built settings page, edit river dialog, MapLink component, comprehensive accessibility pass. Build clean.

**2026-02-24 (Round 4 cross-agent — from Pappas):** 51 new web tests (199 total). 477 total tests (199 web + 278 pipeline).

**2026-02-24 (Round 4 cross-agent — from Coordinator):** Fixed timeAgo bugs — added weeks bucket, graceful invalid input handling.
