# FE-011: OAuth Sign-In Buttons, Notification Preferences UI, Alert History
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

## OAuth Sign-In UI
Added Google and GitHub OAuth buttons to both sign-in and registration pages. Uses `signIn("google")` and `signIn("github")` from next-auth/react. Visual "or" divider separates OAuth from credentials form. Google button: white background with official Google logo SVG. GitHub button: dark `#24292f` background with GitHub Octocat SVG. Both full-width, matching form layout.

**Dependency:** Requires Google/GitHub OAuth providers to be configured in `web/src/lib/auth.ts`. The buttons call `signIn()` which will fail gracefully if providers aren't set up on the backend.

## Notification Preferences UI
Added `GlobalNotificationPreferences` section to Settings page with channel selector (Push/Email/Both radio group) and four toggle switches (Deal Alerts, Condition Alerts, Hazard Alerts, Weekly Digest). Save button with dirty-state tracking — only enabled when local changes differ from fetched state. Calls `GET/PATCH /api/user/notifications` (built by Utah).

## Alert History Page
New route at `/alerts` (protected by AuthGuard). Filter tabs (All/Deals/Conditions/Hazards), paginated card list with Load More, empty states. Uses `GET /api/alerts` with type/limit/offset params.

## Notification Bell
`NotificationBell` component in navigation header (desktop + mobile). Dropdown with 5 most recent alerts, badge with unread count, "View All" link to `/alerts`. Polls every 60s. Added "Alerts" link to `authNavItems` in navigation.

**Note for Utah/Pappas:** Prisma client had to be regenerated (`npx prisma generate`) for `alertLog` and `notificationPreference` to be recognized. If you see type errors on those models, run `npx prisma generate` first.
