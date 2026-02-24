# FE-005: River Detail UX Enhancements
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

## Changes

1. **`timeAgo` utility** — New function in `web/src/lib/utils.ts` for human-friendly relative timestamps. Used on condition and hazard records in the river detail page.

2. **`FlowTrend` component** — New component at `web/src/components/flow-trend.tsx`. Compares the two most recent flow rate readings and shows ↑ (rising >10%), ↓ (falling >10%), or → (stable within 10%).

3. **RapidRating color update** — Class II difficulty changed from blue to green to match standard rafter convention: I-II = green (easy), III = yellow (intermediate), IV = orange (advanced), V+ = red (expert).

4. **Google Maps links on campsites** — External link icon added next to campsite name (in header) for campsites with lat/lng. URLs use canonical `https://www.google.com/maps?q=` format.

## Impact on Other Agents
- **Pappas (QA):** New `timeAgo` function in utils.ts should get test coverage. `FlowTrend` component is a new testable unit.
- **Utah (Backend):** No API changes needed. Existing condition/hazard data shapes are unchanged.
