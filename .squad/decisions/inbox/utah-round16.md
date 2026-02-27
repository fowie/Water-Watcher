# Utah — Round 16 Decisions

## BD-020: Mock Weather Service (No External API)
**Status:** Accepted — **Date:** 2026-02-26 — **By:** Utah

Weather API at `GET /api/rivers/:id/weather` uses a deterministic mock service instead of calling an external API. Generates realistic weather data from latitude, longitude, and day-of-year using sine-based pseudo-random. Same coordinates on same day always return the same weather data — deterministic and testable without API keys. Can be swapped for Open-Meteo or similar later without changing the response contract.

## BD-021: Safety Alert System with Admin-Only Creation
**Status:** Accepted — **Date:** 2026-02-26 — **By:** Utah

Safety alerts use the `requireAdmin()` + `isAdminError()` pattern for POST (same as admin scrapers/users). GET endpoints are public. The `SafetyAlert` model is separate from `Hazard` — hazards are scraper-reported river obstacles, while safety alerts are admin-posted advisories with severity levels (INFO/WARNING/CRITICAL) and time bounds (activeFrom/activeUntil).

## BD-022: HIGH_WATER Auto-Detection via Flow Rate Ratio
**Status:** Accepted — **Date:** 2026-02-26 — **By:** Utah

GET `/api/rivers/:id/safety` includes a `highWaterFlag` computed by comparing the river's latest flow rate to its all-time average. If `currentFlowRate / historicalAverage >= 2.0`, the flag triggers. This is informational only — it does not create a SafetyAlert record automatically. The frontend can use this flag to display warnings.

## BD-023: Permit Fields on River Model
**Status:** Accepted — **Date:** 2026-02-26 — **By:** Utah

Added `permitRequired` (boolean, default false), `permitInfo` (text, nullable), `permitUrl` (string, nullable) directly to the River model. This is simpler than a separate Permit model since permit info is a static attribute of a river, not a time-bounded entity. Mirrored in SQLAlchemy. The `riverUpdateSchema` was extended so existing PATCH `/api/rivers/:id` can update permit fields.
