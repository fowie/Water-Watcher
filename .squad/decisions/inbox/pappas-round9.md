# Pappas — Round 9 Observations

## Test Files Created
- `web/src/__tests__/api/sse-rivers.test.ts` — 19 tests for SSE rivers endpoint
- `web/src/__tests__/api/export.test.ts` — 41 tests for data export API
- `web/src/__tests__/lib/sse-client.test.ts` — 38 tests for SSE client library + weather utility logic

## Final Test Counts
- **Web:** 485 tests (was 387, +98)
- **Pipeline:** 636 passed + 43 skipped = 679 total (unchanged)
- **Grand total:** 1,164

## Issues Found

### SSE Endpoint Missing Auth (Security Concern)
`GET /api/sse/rivers` has no authentication. Any client can connect and receive all condition updates, hazard alerts, and — critically — deal-match events which include `userId`, `filterName`, and `filterId`. This leaks user-specific data. Consider wrapping with `withAuth` or at minimum filtering deal-match events to only send to the owning user's connection.

### SSE Polling Interval Leak
The SSE route stores a cleanup function on `(controller).__cleanup` but the `cancel()` callback on the ReadableStream is empty (just a comment). The `closed` flag prevents enqueueing after disconnect, but the `setInterval` timer continues running indefinitely. This is a memory/resource leak in long-running deployments.

### GPX Format Validation Ordering
The GPX export validates that `type` is "rivers" or "all" only inside `gpxExport()`, after `fetchExportData()` has already queried the database. Moving the check before the data fetch would avoid unnecessary DB queries for `format=gpx&type=conditions` or `format=gpx&type=deals`.

### Export CSV Section Comments
CSV export uses `# Rivers`, `# Conditions (last 30 days)`, `# Matched Deals` as section headers. The `#` prefix is not standard CSV — some parsers may treat these as data rows. Consider omitting them or using a different separator.
