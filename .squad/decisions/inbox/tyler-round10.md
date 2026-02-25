# Tyler — Round 10 Decisions

## FE-016: Trip Planner Architecture
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Trip planner uses client-side filtering with tab buttons (All/Upcoming/Past/Cancelled) rather than server-side filtering, since trip counts per user are expected to be low. Trip detail page uses day-by-day card layout where each day's stops are grouped by `dayNumber` from the API. River selection for stops uses a reusable `RiverPickerDialog` with debounced search against the existing `GET /api/rivers` endpoint.

## FE-017: Star Rating Component Design
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

`StarRating` display component uses filled, half-filled, and empty star icons from lucide-react for fractional ratings. The review form uses a simpler integer-only click-to-set star selector with hover preview. Both are inline (no external star rating library). `StarRating` is exported from `river-reviews.tsx` for reuse on the stats page.

## FE-018: Review Tab on River Detail Page
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Added Reviews as a 6th tab (grid-cols-6) on the river detail page rather than a separate section below tabs. This keeps the page scannable and lazy-loads review data only when the user clicks the tab. Average rating is fetched alongside river data via `Promise.all` and shown in the header area for immediate visibility.

## FE-019: Stats Dashboard — CSS Donut Chart
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Condition quality breakdown uses a CSS `conic-gradient` donut chart with a transparent center (via `mask: radial-gradient`). No chart library dependency needed. Color scheme matches existing `qualityColor` utility — green for excellent, blue for good, yellow for fair, orange for poor, red for dangerous. Legend shown alongside the chart.

## FE-020: Stats Data Fetching Strategy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Stats page uses `Promise.allSettled` to fetch data from 6 different endpoints in parallel. Each section renders independently based on its own resolved/rejected state. This avoids one failed endpoint from breaking the whole dashboard. Quality breakdown is computed client-side from `RiverSummary` data rather than requiring a dedicated API endpoint.
