# Utah Round 14 Decisions

## BD-034: Content Security Policy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Added comprehensive CSP header to `web/next.config.ts`. Policy: `default-src 'self'`, `style-src 'self' 'unsafe-inline' unpkg.com` (Tailwind + Leaflet CDN), `img-src 'self' data:` (base64 uploads), `connect-src` allows Open-Meteo and OAuth origins, `frame-src` allows OAuth, `frame-ancestors 'none'`, `worker-src 'self' blob:`, `object-src 'none'`. Violations reported to `POST /api/csp-report` (logs to console). No `unsafe-eval` anywhere — using strict script-src.

## BD-035: ETag Caching for Public GET Endpoints
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Created `withETag(handler)` HOF in `web/src/lib/etag.ts`. Uses MD5 hash of response body as weak ETag. Returns 304 Not Modified when `If-None-Match` matches. Sets `Cache-Control: public, max-age=60, stale-while-revalidate=300`. Applied to 4 public GET endpoints: `/api/rivers`, `/api/rivers/[id]`, `/api/deals`, `/api/search`. User-specific endpoints (trips, alerts, user/rivers) intentionally excluded — their data varies per user and should not be publicly cached.

## BD-036: Input Sanitization for User Content
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Created `web/src/lib/sanitize.ts` with regex-based HTML stripping (no external library). Strips script/iframe/object tags, event handlers, javascript: URLs. Applied to all user-generated text fields: review title/body, trip name/notes, photo captions. Combined with `truncate()` for length enforcement. Sanitization runs after Zod validation, before DB write.
