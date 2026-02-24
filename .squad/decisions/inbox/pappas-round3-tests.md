# Pappas — Round 3 Test Expansion

**Date:** 2026-02-24  
**Author:** Pappas (Tester)

## Summary

Expanded web test coverage by 29 tests (119 → 148) targeting three areas requested by Spencer:

### 1. `timeAgo` utility — 25 new tests in `web/src/__tests__/utils.test.ts`
- "just now" for 0s, 30s, 59s
- Singular/plural minutes (1, 30, 59)
- Singular/plural hours (1, 12, 23)
- Days (1, 6, 7, 27, 29) — note: no "weeks" bucket exists, 7-29 days all return "X days ago"
- Months (30 days, 90 days, 330 days)
- Years (365, 730 days)
- Invalid inputs: empty string and garbage → produce "NaN years ago" (no graceful fallback)
- Future dates → return "just now" (correct per implementation)

### 2. DELETE `/api/rivers/:id` — already covered (3 tests existed)
- 204 on success, 404 on missing river, 500 on DB error
- No new tests required; verified existing tests pass.

### 3. Deal filter edge cases — 4 new tests in `web/src/__tests__/api/deals-filters.test.ts`
- Non-existent user returns 404 with "User not found" and does not create a filter
- Special ASCII characters in keywords (hyphens, parens, slashes, plus signs) pass validation
- Unicode and emoji keywords pass validation

## Observations

- `timeAgo` lacks a "weeks ago" bucket — may want to add one for UX clarity (7-27 days showing as "27 days ago" is awkward).
- `timeAgo` returns "NaN years ago" for invalid date strings — should fail gracefully with a fallback like "Unknown" or throw.
- Empty keywords array correctly blocked by Zod `.min(1)` validation.

## Test Counts

| Suite    | Before | After | Delta |
|----------|--------|-------|-------|
| Web      | 119    | 148   | +29   |
| Pipeline | 278    | 278   |   0   |
| **Total**| **397**| **426**| **+29** |
