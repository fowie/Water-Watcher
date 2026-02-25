# Pappas — Round 8 Test Observations

**Date:** 2026-02-24  
**By:** Pappas (Tester)

## Test Coverage Added
- `test_email_notifier.py`: 70 tests covering all 4 send methods, config guard, Resend error handling, template structure.
- `notification-prefs.test.ts`: 22 tests for GET/PATCH `/api/user/notifications` — defaults, validation, auth.
- `alerts.test.ts`: 24 tests for GET `/api/alerts` — pagination, type filtering, auth, edge cases.

## Edge Case: alerts route `limit=0` behavior
The alerts route uses `parseInt(param) || 20` for the limit fallback. Since `parseInt("0")` returns `0` (falsy in JS), `limit=0` silently becomes 20 instead of clamping to 1. This differs from negative-limit behavior where `Math.max(-5, 1) = 1` works correctly. Not a bug (requesting 0 items is meaningless), but worth noting if the pattern is reused elsewhere. The same `|| 20` pattern means `limit=NaN` also falls to 20, which is actually good default behavior.

## Facebook Scraper Stubs
43 tests remain `@pytest.mark.skip` — scraper not yet implemented. No changes made.
