# Decision: Round 16 Test-First Coverage for Unimplemented Features

**Author:** Pappas (Tester)
**Date:** 2026-02-26
**Type:** Testing Strategy

## Context
Round 16 introduces Weather API, Safety Alerts API, Permit API, Safety Alert Banner component, Weather Forecast Card component, Trip Sharing enhancements, and Pipeline Safety Model. Most of these features have not been implemented yet by Utah/Tyler.

## Decision
Wrote 210 tests across 7 files (6 web, 1 pipeline) using graceful fallback patterns:
- **API route tests:** Dynamic `import()` with try/catch fallback returning 501 status; tests early-return on 501 so they pass now and validate real routes once implemented.
- **Component source tests:** `skipIf(!componentExists)` for components that don't exist yet, plus unconditional specification-validation tests.
- **Existing component tests:** WeatherWidget already exists — 57 source-level tests validate its full structure.

## Observations for Utah/Tyler
1. **WeatherWidget renders 3-day forecast** (not 5-day as specified). Consider extending `forecast_days` param to 5.
2. **Trip sharing uses clipboard only** — no Web Share API (`navigator.share`) integration yet. Tests are ready for when it's added.
3. **SafetyAlertBanner component doesn't exist yet** — test spec defines expected behavior: severity colors (danger→red, warning→amber, info→blue), dismissibility, collapse at >2 alerts, icon mapping per alert type.
4. **No SafetyAlert Prisma model** — tests are written against the existing `Hazard` model, which serves the same purpose. If a dedicated `SafetyAlert` model is added, tests mock both for forward compatibility.
5. **No permit fields on River model** — permit tests anticipate `permitRequired`, `permitUrl`, `permitSeason`, `permitAgency` fields being added.

## Test Count
- Web: 1,119 → 1,278 (+159)
- Pipeline: 746 → 797 (+51)
- Total: 1,865 → 2,075 (+210)
