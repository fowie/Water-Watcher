# Test Coverage Expansion — Edge Cases
**Status:** Informational — **Date:** 2026-02-24 — **By:** Pappas

## Summary
Added 38 new edge case tests across web (21 new → 119 total) and pipeline (17 new → 147 total).

## Key Findings
1. **Rivers API lacks input clamping:** `GET /api/rivers` doesn't clamp `limit` to a minimum of 1 or `offset` to 0. Negative offset or `limit=0` could produce unexpected Prisma behavior. Deals API correctly clamps both. Recommend aligning rivers route with deals route pattern.
2. **$0 price is falsy in Python:** `deal_matcher._score_match()` treats `price=0.0` as falsy, which means free items skip both the price-ceiling check and the 20pt price bonus. This is safe (not a bug) but could under-score legitimate free gear postings.
3. **No test coverage exists for:** `craigslist.py` scraper, `american_whitewater.py` scraper, `push_notifier.py`, or any web component rendering tests. These are the biggest coverage gaps.

## Recommendation
Next testing priorities: (1) Craigslist scraper unit tests with mocked RSS/HTML responses, (2) Push notifier tests, (3) Rivers route input validation hardening.
