# Pappas — Round 12 Test Coverage Report

**Date:** 2026-02-24
**Agent:** Pappas (Tester)

## Summary

Replaced all 43 skipped Facebook scraper test stubs with 110 working tests. Created 3 new web test files covering password reset, email verification, email utility, and security headers.

## Files Created/Rewritten

| File | Tests | Type |
|------|-------|------|
| `pipeline/tests/test_facebook_scraper.py` | 110 (was 43 skipped) | Rewrite |
| `web/src/__tests__/api/auth-password-reset.test.ts` | 26 | New |
| `web/src/__tests__/lib/email.test.ts` | 19 | New |
| `web/src/__tests__/lib/security-headers.test.ts` | 9 | New |

## Test Counts

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| Pipeline passed | 636 | 746 | +110 |
| Pipeline skipped | 43 | 0 | -43 |
| Web | 668 | 722 | +54 |
| **Grand Total** | **1,347** | **1,468** | **+121** |

## Decisions

- **No rate-limit test changes:** `rate-limit.ts` had no new changes in Round 12. Existing 20 tests from Round 10 remain adequate.
- **Email tests use `vi.resetModules()`:** Because `email.ts` reads `RESEND_API_KEY` at module scope, tests that vary the env var must re-import the module each time. This pattern is necessary for testing the no-op behavior.
- **Security headers tested via config import:** Since `next.config.ts` exports headers as a function returning data, we import and verify the values directly rather than making HTTP requests.
- **Facebook scraper test patterns:** Uses `respx` for httpx mocking, `unittest.mock` for SessionLocal, and pre-set `_river_cache` to avoid DB calls in unit tests. Consistent with `test_blm_scraper.py` and `test_usfs_scraper.py`.

## Observations

- Facebook scraper's `_classify_condition` uses dict iteration order for quality keywords — "excellent" always wins over "dangerous" if both present. This is correct per Python 3.7+ insertion-order dicts.
- `_extract_river_mentions` hashtag handling only converts CamelCase hashtags (e.g., `#ColoradoRiver` → `Colorado River`). All-lowercase hashtags like `#coloradoriver` won't be split but still match via case-insensitive word boundary check on the original text.
- `_handle_rate_limit` caps Retry-After at 300 seconds (5 min) — sensible for a scraper that runs on a schedule.
