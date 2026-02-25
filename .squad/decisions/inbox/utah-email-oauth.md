# BD-020: Email Notifications via Resend + OAuth Providers

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

## Email Notifications

Added `EmailNotifier` class in `pipeline/notifiers/email_notifier.py` using the Resend API. Runs alongside existing `PushNotifier` — email dispatch is gated by user's `NotificationPreference`:

- **Channel check:** Only sends email if user's channel is `"email"` or `"both"`. Default for new users is `"push"` (no change to existing behavior).
- **Per-type check:** Each alert type (deals, conditions, hazards, digest) can be independently toggled.
- **Graceful degradation:** Missing `RESEND_API_KEY` = all email silently skipped. Email failures never break the scraping pipeline.

## Notification Preferences Model

New `NotificationPreference` model in both Prisma and SQLAlchemy:
- `channel`: `"push"` | `"email"` | `"both"` (default: `"push"`)
- `dealAlerts`, `conditionAlerts`, `hazardAlerts`: boolean, default true
- `weeklyDigest`: boolean, default false
- Unique per user (one-to-one relation)

New `AlertLog` model tracks every notification sent (type, channel, title, body, JSON metadata).

**SQLAlchemy gotcha:** `metadata` is reserved by SQLAlchemy's Declarative API. Python attribute is `extra_data`, DB column is still `metadata`.

## OAuth Providers

Added Google and GitHub OAuth providers to NextAuth config alongside Credentials:
- `allowDangerousEmailAccountLinking: true` — lets OAuth sign-in link to existing email-based accounts
- Prisma adapter already has `Account` model for storing OAuth tokens
- New env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`

## New API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/user/notifications` | GET | Yes | Get notification preferences (auto-creates defaults) |
| `/api/user/notifications` | PATCH | Yes | Update notification preferences |
| `/api/alerts` | GET | Yes | Paginated alert history with optional type filter |

## Impact on Existing Tests

All existing tests pass unchanged (566 pipeline, 345 web). New code paths are additive and behind configuration flags.
