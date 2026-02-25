# Utah — Round 9 Decisions

## BD-022: SSE for Real-Time Updates (Not WebSocket)
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Chose Server-Sent Events over WebSocket for real-time river condition updates. SSE is simpler with Next.js App Router (just a GET route returning a ReadableStream), works natively with HTTP/2, auto-reconnects via `retry:` directive, and is sufficient since data flow is server→client only. The endpoint polls the database every 30 seconds rather than using database triggers or pub/sub, keeping infrastructure simple (no Redis/message broker needed). Client-side `useRiverSSE` hook implements exponential backoff (1s–30s max) for reconnection.

## BD-023: Service Worker Caching Strategy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Updated `web/public/sw.js` (previously notifications-only per BD-010) to add caching strategies:
- **Cache-first** for static assets (JS, CSS, fonts, images, `/_next/static/`) — fast repeat loads
- **Network-first** for API calls — fresh data preferred, cached fallback when offline
- **SSE excluded** from caching entirely (streaming connections can't be cached)
- **Cache versioning** via `CACHE_VERSION` constant — old caches cleaned up on activate
- **`skipWaiting()`** on install for immediate activation of new versions

This supersedes BD-010's "no caching" stance. Next.js handles its own build-time caching, but the SW cache layer adds true offline support and faster asset loading. The two strategies don't conflict because the SW cache is keyed by request URL, same as Next.js's cache-busted asset URLs.

## BD-024: Data Export API Design
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Export endpoint at `GET /api/export` supports three formats via query param:
- **JSON**: Structured data with `Content-Disposition: attachment`
- **CSV**: RFC 4180-compliant with proper escaping (commas, quotes, newlines)
- **GPX**: Valid GPX 1.1 XML for GPS devices — only for river waypoints with lat/lng

Scope is user's data only: tracked rivers, conditions (last 30 days), matched deals. The `type` param (rivers|conditions|deals|all) controls which data categories to include. GPX returns 400 for non-river types since waypoints require coordinates.

All formats use Zod validation on query params and `withAuth()` for access control.
