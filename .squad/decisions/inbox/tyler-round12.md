# Tyler — Round 12 Decisions

## FE-025: Password Reset & Email Verification Auth Flow
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Three new auth pages at `/auth/forgot-password`, `/auth/reset-password`, and `/auth/verify-email`, all following the existing auth layout pattern (full-screen centered card, no navigation chrome).

**Forgot Password** — Simple email form, calls `POST /api/auth/forgot-password`. Success state shows confirmation message regardless of whether the email exists (security best practice — no user enumeration).

**Reset Password** — Reads `token` from query params. Zod client-side validation (min 8 chars, passwords match). Password strength indicator uses a 5-segment bar scoring: length (8+, 12+), uppercase, number, special character. Invalid/expired token shows error with link to request a new one. Suspense boundary required for `useSearchParams()` per Next.js App Router.

**Email Verification** — Auto-fires `GET /api/auth/verify-email?token=xxx` on mount. Three state machine: loading → success/error. Success auto-redirects to sign-in after 3 seconds.

Added "Forgot password?" link on sign-in page between password label and input field.

**API functions** `forgotPassword()` and `resetPassword()` were already defined in `api.ts` and `validations.ts` (added in a prior round). No API client changes needed.

---

## FE-026: Comprehensive README Overhaul
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Complete rewrite of `README.md` to reflect all features from Rounds 1–12. Previous README was from Round 5 and only covered 13 API endpoints and basic features. New README covers 37 API endpoints, 13 feature categories, 22 environment variables, and 17 tech stack entries.

Key structural decisions:
- Badges at top (license, test count, language versions)
- Features organized by user-facing category rather than technical module
- API table includes Auth column (Yes/No/Partial)
- Architecture shown as ASCII box diagram rather than plain text flow
- Environment variables presented as a table with Required/Default columns
- Test count updated to 1,304 (668 web + 636 pipeline)

---

## FE-027: PWA SVG Icons & Offline Page
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Replaced placeholder PNG icon references with SVG icons at `web/public/icons/`. SVGs use linear gradients for a water-drop-on-mountain design with sky-blue theme. SVG format chosen over PNG because they scale perfectly to any resolution, have zero quality loss, and smaller file size.

Manifest updated to `type: "image/svg+xml"`. Service worker PRECACHE_ASSETS updated to include `/offline.html` and new icon paths.

**Offline page** (`web/public/offline.html`) is a static HTML file with all CSS inlined — no external dependencies required. Design matches app dark theme (#0f172a background). Includes a "Try Again" button that calls `window.location.reload()`. The existing service worker fetch handler already returns `offline.html` for failed navigation requests (`caches.match(OFFLINE_URL)`). The key SW change was adding `/offline.html` to the precache list so it's available before the user goes offline.

---

## FE-028: Seed Script — Trips & Reviews
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Extended `web/prisma/seed.ts` with sample Trip, TripStops, and RiverReviews while keeping all existing seed data intact.

- **Trip** uses `upsert` with stable `id: "demo-trip"` for idempotent re-runs (matching BD-009 upsert strategy for entities with stable IDs).
- **TripStops** use `deleteMany` + `createMany` (matching BD-009 pattern for child entities without unique constraints).
- **Reviews** use `upsert` on `riverId_userId` compound unique (matching BD-026 one-review-per-user-per-river constraint).

All new seed data references existing demo user (`demo-user`) and demo rivers (Colorado, Salmon, Arkansas). No schema changes needed.
