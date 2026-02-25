# Utah Round 12 Decisions

## BD-010: Docker Compose Lightweight Migration
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Replaced the `db-migrate` service from building the full web Dockerfile (target: builder) to using a lightweight `node:20-alpine` image with volume-mounted Prisma schema. This avoids needing `pnpm build` (which requires DATABASE_URL at build time) just to run `prisma db push --skip-generate`. Dummy DATABASE_URL build arg added to web Dockerfile for the builder stage.

## BD-011: Facebook Scraper Dual Strategy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Facebook scraper uses Graph API when `FACEBOOK_ACCESS_TOKEN` is configured, falls back to public mobile site scraping otherwise. Graph API provides structured data (timestamps, author, images), while public scraping is best-effort with limited data. Source priority remains 30 (lowest) per BD-002. Scheduled every 6 hours (configurable via `FACEBOOK_INTERVAL_MINUTES`).

## BD-012: Password Reset Token Model
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Created separate `PasswordResetToken` model rather than reusing `VerificationToken`. The VerificationToken model uses `identifier` (email) + `token` as its compound key and has no primary `id` field, making it awkward for password reset workflows that need deletion by token alone. The new model has its own `id`, `email`, `token` (unique), and `expires` fields. Tokens expire in 1 hour. Anti-enumeration: forgot-password always returns 200 regardless of email existence.

## BD-013: Security Headers via Next.js Config
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection, Permissions-Policy, HSTS) added via `next.config.ts` `headers()` function. Applied to all routes `/(.*).` HSTS set to 1 year with includeSubDomains. Geolocation permitted for self (needed for map features), camera and microphone denied.

## BD-014: Playwright Optional in Docker
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Made Playwright browser install optional in pipeline Dockerfile (`|| echo "skipped"`). Playwright is only needed for JavaScript-heavy scraping targets, and its installation (Chromium + deps) adds significant image size and can fail in constrained environments. Current scrapers (USGS, AW, Craigslist, BLM, USFS, Facebook) all use httpx + BeautifulSoup.

## BD-015: Email Utility for Web (Resend)
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Created `web/src/lib/email.ts` with `sendPasswordResetEmail()` and `sendVerificationEmail()` functions. Uses Resend API via direct `fetch()` (no SDK dependency). Graceful no-op when `RESEND_API_KEY` is not configured — logs warning but never crashes. Matches the pattern established in the pipeline's `EmailNotifier`.
