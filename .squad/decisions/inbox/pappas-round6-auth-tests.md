# Decision: Auth System Test Coverage Strategy

**Author:** Pappas  
**Date:** 2026-02-24  
**Round:** 6  
**Status:** Informational

## Context

Auth system (registration, password hashing, session middleware) was implemented by Utah in Round 6. Tests were needed to verify correctness and catch regressions.

## Decisions

1. **Registration route tests mock Prisma and hashPassword** — no DB or crypto needed. Tests verify the Zod validation layer, duplicate-email check, select clause (passwordHash excluded), and error containment.

2. **Auth utils (hashPassword/verifyPassword) tested with real crypto** — no mocks. These are pure utility functions; real PBKDF2 runs fast enough (~25ms per hash). Confirms salt uniqueness, format correctness, and constant-time comparison.

3. **withAuth middleware tested in isolation** — mock only `auth()` from next-auth. Confirms 401 for all unauthenticated variants (null session, missing user, missing id, empty id). Confirms x-user-id injection without mutating the original Request.

4. **BLM and Facebook scraper stubs use `@pytest.mark.skip`** — appear in test reports as pending work (80 skipped tests total). When scrapers are built, remove the skip decorator and implement the test body. Test class structure mirrors the expected scraper interface.

## Impact

- Web test count: 236 → 300 (+64)
- Pipeline: 407 passed + 80 skipped (new stubs)
- No behavioral changes to production code
