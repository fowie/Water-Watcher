# BD-004: API Error Helper Pattern

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Created `web/src/lib/api-errors.ts` with two helpers:
- `apiError(status, message)` — standardized JSON error responses
- `handleApiError(error)` — safe 500 handler that logs internally but never leaks stack traces to the client

All API routes should use these instead of inline `NextResponse.json({ error }, { status })` and manual `console.error` + 500 patterns. Refactored rivers and deal filter routes as examples.

---

# BD-005: PATCH Endpoints with Ownership Validation

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

PATCH endpoints follow these conventions:
- Use dedicated `*UpdateSchema` (Zod `.optional()` on each field) rather than `.partial()` on the create schema, to support nullable fields where the Prisma model allows null
- Deal filter PATCH requires `userId` in the request body and checks it against the filter's owner, returning 403 on mismatch
- Rivers PATCH does not require ownership (no auth yet) — just validates input and checks existence

---

# BD-006: Health Check Endpoint

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

GET `/api/health` returns `{ status, timestamp, version }`. Uses `prisma.$queryRaw` with `SELECT 1` to probe DB connectivity. Returns 200/ok or 503/degraded. Version is hardcoded at `"0.1.0"` — should be sourced from `package.json` once we have a release process.
