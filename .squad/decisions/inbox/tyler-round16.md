# Tyler — Round 16 Decisions

## FE-007: Safety Alert Banner Pattern
**Status:** Accepted — **Date:** 2026-02-26 — **By:** Tyler

Safety alert banner uses direct `fetch()` calls internally rather than importing from `api.ts`. This keeps the component self-contained and decoupled from specific API response shapes that may evolve. The banner auto-hides when no alerts are present and uses local state for dismissed alerts with a fire-and-forget POST for acknowledgment.

## FE-008: Comparison View Toggle + CSV Export
**Status:** Accepted — **Date:** 2026-02-26 — **By:** Tyler

River comparison page now has chart/table view toggle. Table view adds Last Updated column and is a flat, sortable-ready layout. CSV export copies to clipboard via `navigator.clipboard.writeText()` rather than creating a Blob download — simpler for the small dataset sizes involved (max 3 rivers). CSV follows RFC 4180 with proper quoting.

## FE-009: Trip Sharing via Web Share API
**Status:** Accepted — **Date:** 2026-02-26 — **By:** Tyler

Trip sharing now uses `navigator.share()` as primary method with rich text summary, falling back to clipboard copy. Share button is always visible (removed the `isPublic` gate) since the summary is useful even for private trip planning coordination.

## FE-010: Weather Forecast vs Weather Widget
**Status:** Accepted — **Date:** 2026-02-26 — **By:** Tyler

Created `weather-forecast.tsx` as a separate component from the existing `weather-widget.tsx`. The forecast card fetches from the app's own `GET /api/rivers/[id]/weather` endpoint, while the widget uses Open-Meteo directly. Both render on the river detail page — forecast in the header area, widget in the Weather tab. This allows Utah's API to provide curated/cached data while the tab still has the live Open-Meteo fallback.
