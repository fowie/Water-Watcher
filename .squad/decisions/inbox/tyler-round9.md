# Tyler Round 9 Decisions

## FE-012: Vanilla Leaflet Over react-leaflet

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Used vanilla Leaflet with `useRef` + `useEffect` + dynamic `import()` instead of react-leaflet for the `/map` page. react-leaflet has known compatibility issues with Next.js App Router SSR (Leaflet requires `window`). The vanilla approach with dynamic import and a cleanup function in useEffect is more robust and avoids adding another dependency. Leaflet CSS loaded from CDN (`unpkg.com/leaflet@1.9.4/dist/leaflet.css`).

## FE-013: Weather Widget via Open-Meteo

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Weather data for river detail pages uses the Open-Meteo free API (no API key, no rate limits for personal use). Added as a "Weather" tab on the river detail page rather than an always-visible section, to keep the page scannable and not load weather data until the user clicks the tab (lazy via tab activation → component mount). Converts Celsius to Fahrenheit and km/h to mph for US-centric audience.

## FE-014: Export Page — GPX Format Restriction

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

GPX export format is automatically disabled when the user selects a data type other than "Rivers", since GPX requires lat/lng waypoints. If the user changes type while GPX is selected, format auto-switches to JSON to prevent invalid exports. This avoids confusing error states.

## FE-015: Map Page River Data Requires lat/lng on RiverSummary

**Status:** Observation — **Date:** 2026-02-24 — **By:** Tyler

The map page fetches rivers via `getRivers()` which returns `RiverSummary` — this type currently does NOT include `latitude`/`longitude`. The API response (`/api/rivers` GET) would need to include these fields for the map to populate markers. Rivers without coordinates are silently excluded from the map. If the API doesn't return lat/lng on the summary endpoint, the map will be empty. The backend (Utah) should ensure the rivers GET API includes `latitude` and `longitude` in its response, or we need a separate endpoint.
