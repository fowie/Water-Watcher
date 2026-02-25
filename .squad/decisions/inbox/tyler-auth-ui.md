# FE-005: Auth UI Pattern

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

## Decision
Built auth UI with client-side session checking via NextAuth's `SessionProvider` + `useSession()` rather than Next.js middleware-based auth gating.

## Details
- `SessionProvider` wraps entire app in root `layout.tsx` — all client components can access session.
- `AuthGuard` component uses `useSession()` + `useEffect` redirect pattern for protected routes. Shows skeleton during loading, redirects to `/auth/signin?callbackUrl=…` when unauthenticated.
- Navigation conditionally shows Settings link only when authenticated. User menu in sidebar (desktop) and header (mobile).
- Auth pages (`/auth/signin`, `/auth/register`) render without navigation chrome — full-screen centered card layout.
- Registration uses Zod client-side validation, then calls `/api/auth/register` + auto-signs-in on success.
- Replaced `DEMO_USER_ID` in settings page with actual `session.user.id`.

## Rationale
Client-side `AuthGuard` is simpler than middleware for our use case (no SSR pages that need protection). Keeps all auth state flowing through one `SessionProvider` context. Easy to wrap any future pages that need protection.

## Impact
- Settings page now requires authentication.
- `DEMO_USER_ID` pattern removed from settings — real user IDs used for deal filter queries.
- Auth pages at `/auth/signin` and `/auth/register` (auth.ts `pages.signIn` updated from "/login").
