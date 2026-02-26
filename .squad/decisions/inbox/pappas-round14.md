# Pappas — Round 14 Decision Notes

**Date:** 2026-02-24
**By:** Pappas (Tester)

## TST-002: CSP, ETag, and Input Sanitization Test Coverage

Created 3 new test files with 97 tests covering Round 14 features:

- **CSP & Security Headers** (24 tests): Full CSP directive coverage, Leaflet CDN allowance, CSP report endpoint behavior.
- **ETag Caching** (18 tests): withETag HOF — 304 negotiation, Cache-Control, data-dependent hashing, non-200 passthrough.
- **Input Sanitization** (55 tests): sanitizeHtml (XSS prevention), sanitizeFilename (safe downloads), truncate (length enforcement).

### Edge Cases Found

1. `sanitizeFilename` collapses dashes into underscores — `my-file.csv` → `my_file.csv`. Intentional but potentially surprising.
2. `sanitizeFilename("   ")` → `"_"` not `"download"`. Whitespace-only input doesn't trigger the empty fallback.
3. `withETag` consumes response body (single-use). Tests must provide fresh Response objects per invocation.

### Full Suite Status

- **Web:** 982 tests, 0 failures (39 files)
- **Pipeline:** 746 tests, 0 failures (17 files)
- **Grand total: 1,728 tests, 0 failures**

No test failures or regressions detected across the entire codebase.
