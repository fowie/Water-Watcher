# Utah — Round 13 Decisions

## BD-037: Admin Role System — JWT-Based Role Propagation
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Added `role` field to User model (Prisma canonical, SQLAlchemy mirror). Role values: `"user"` (default), `"admin"`. Propagated through NextAuth ecosystem:

1. **Credentials authorize()** returns `role` alongside user fields
2. **JWT callback** stores `token.role` on initial sign-in
3. **Session callback** copies `token.role` to `session.user.role`
4. **`requireAdmin()` helper** (`web/src/lib/admin.ts`) checks session role, returns 401/403 NextResponse

**Trade-off:** Role is read from DB only at sign-in time and cached in the JWT. If an admin promotes/demotes a user, the change won't take effect until the affected user's JWT expires or they re-authenticate. This is acceptable for the current scale. For instant role revocation, a database session strategy or token blacklist would be needed.

**Self-demotion safety:** PATCH `/api/admin/users/[id]` prevents admins from removing their own admin role, avoiding lockout.

---

## BD-038: Next.js Middleware for Server-Side Route Protection
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Created `web/src/middleware.ts` using NextAuth.js v5's `auth()` wrapper. This replaces client-side-only `AuthGuard` component protection with server-side redirects — faster UX, no flash of protected content.

| Route Category | Behavior |
|---|---|
| Protected (`/trips`, `/settings`, `/profile`, `/alerts`, `/export`, `/rivers/favorites`, `/rivers/compare`) | Redirect to `/auth/signin?callbackUrl=...` |
| Admin (`/admin/*`) | Redirect to signin if unauth, redirect to `/` if non-admin |
| Public (everything else) | Pass through |

The `AuthGuard` component (Tyler's domain) still provides client-side session checking as a fallback. The middleware provides the primary server-side gate.

**Matcher pattern** excludes API routes (they have their own auth via `withAuth()`/`requireAdmin()`), static assets, and PWA files.

---

## BD-039: River Analytics API — Query-Time Aggregation
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

`GET /api/rivers/[id]/analytics` computes all analytics at query time rather than maintaining materialized views or pre-computed tables:

- **Flow trends:** Groups conditions by date, averages flow/gauge/temp per day
- **Quality distribution:** Uses Prisma `groupBy` on quality column
- **Best time to visit:** Counts excellent/good conditions by month, picks highest
- **Reviews:** `aggregate()` for count + avg rating
- **Visits:** `tripStop.count()` for river

All five queries run in parallel. This is acceptable because per-river analytics are low-traffic (viewed on detail page) and the data volume per river is bounded. If analytics become a hot path, consider caching or pre-computed summaries.

The endpoint is public (no auth) since analytics are informational. This matches the pattern of GET `/api/rivers/[id]` and GET `/api/rivers/[id]/reviews` being public.
