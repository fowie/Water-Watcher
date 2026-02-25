# BD-004: Land Agency Scraper Architecture

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

## Decision

BLM and USFS scrapers run on a separate 6-hour schedule (`run_land_agency_scrapers()`) rather than being added to the existing 4-hour river scraper cycle.

## Rationale

- Land agency advisory data changes much less frequently than USGS gauge data or AW trip reports
- BLM and USFS APIs have stricter rate limits; fewer requests = better citizen behavior
- USFS RIDB API requires an API key (`RIDB_API_KEY`); scraper gracefully skips when key is absent
- Separate schedule allows independent tuning via `LAND_AGENCY_INTERVAL_MINUTES`
- Both scrapers include `river_name` in ScrapedItem data so the condition processor's `_find_river()` name-based fallback can match them to tracked rivers (no `aw_id` or `usgs_gauge_id` available from these sources)

## Config Added

| Setting | Env Var | Default |
|---------|---------|---------|
| `blm_base_url` | `BLM_BASE_URL` | `https://www.blm.gov/services/recreation` |
| `ridb_api_key` | `RIDB_API_KEY` | `""` (empty = skip USFS) |
| `land_agency_interval_minutes` | `LAND_AGENCY_INTERVAL_MINUTES` | `360` (6 hours) |
