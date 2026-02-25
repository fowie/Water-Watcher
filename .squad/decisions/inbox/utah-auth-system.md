# BD-004: Authentication with NextAuth.js v5

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

## Decision

Implemented real authentication using NextAuth.js v5 (Auth.js) with Credentials provider and JWT session strategy, replacing the hardcoded `DEMO_USER_ID = "demo-user"` pattern.

## Details

| Aspect | Choice |
|--------|--------|
| Auth Library | NextAuth.js v5 (`next-auth@beta`) |
| Session Strategy | JWT (stateless, no DB session lookups) |
| Initial Provider | Credentials (email + password) |
| Password Hashing | Node.js `crypto.pbkdf2Sync` (100K iterations, SHA-512) |
| Adapter | `@auth/prisma-adapter` (stores accounts, enables future OAuth) |

## Route Protection

- **Public:** GET rivers (list + detail), GET deals
- **Auth required:** All write operations (POST/PATCH/DELETE), deal filters (all), notifications subscribe
- **Ownership enforced:** Deal filters check `session.user.id === filter.userId`, return 403 on mismatch

## Why JWT over Database Sessions

JWT is simpler for this app — no session table lookups on every request. The `Session` model is in the schema for future use if we switch to database sessions (e.g., for token revocation).

## Why `crypto.pbkdf2Sync` over bcrypt

Avoids native module compilation issues (bcrypt requires node-gyp). PBKDF2 with SHA-512 at 100K iterations is NIST-recommended and built into Node.js.

## Migration Path

- Existing `demo-user` record still works (no required fields were added)
- Frontend needs to implement login/register flows and send session cookies instead of `userId` in request bodies
- `NEXTAUTH_SECRET` must be set in production (already in `.env.example`)
