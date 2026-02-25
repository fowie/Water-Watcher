# Tyler — Round 11 Decisions

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
- **Green** (Healthy): Last scrape within 2× the expected interval
- **Yellow** (Delayed): Last scrape within 2-3× the expected interval
- **Red** (Error): Last scrape older than 3× the expected interval, or never scraped

Intervals are hardcoded in the frontend based on known pipeline settings: USGS/AW = 4 hours, Craigslist = 30 minutes, BLM/USFS = 6 hours. If these change in the pipeline, the frontend config should be updated to match.

The scrapers page is at `/admin/scrapers` rather than a top-level `/scrapers` route, following admin page conventions. Added to `authNavItems` with the Activity icon.
