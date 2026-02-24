# Pappas — Round 5 Test Findings

**Date:** 2026-02-24  
**By:** Pappas (Tester)

## Bugs Found During Testing

### BUG-1: USGS scraper lacks broad exception handling
**Severity:** Medium  
**File:** `pipeline/scrapers/usgs.py`  
The scraper only catches `httpx.HTTPError`. Malformed responses cause uncaught exceptions:
- Non-numeric values (e.g., "Ice" for frozen gauges) → `ValueError`
- Missing `sourceInfo` in timeSeries → `KeyError`
- Non-JSON responses (maintenance pages) → `JSONDecodeError`

**Recommendation:** Wrap the parsing loop in a `try/except Exception` or add individual field-level error handling.

### BUG-2: `_find_river()` only supports usgs and aw sources
**Severity:** Low  
**File:** `pipeline/processors/condition_processor.py`  
Sources listed in `SOURCE_PRIORITY` (blm, usfs, facebook) have no corresponding lookup logic in `_find_river()`. Items from these sources are silently skipped. Either add lookup support or remove them from `SOURCE_PRIORITY`.

### BUG-3: `classify_runnability(inf)` returns None
**Severity:** Low  
**File:** `pipeline/processors/condition_processor.py`  
The "dangerous" range is `(10000, float('inf'))` — uses `<` for the upper bound, so `inf < inf` is False. Practically unlikely but logically incomplete.

## Test Coverage Summary
- Pipeline: 278 → 407 tests (+129)
- Web: 199 → 236 tests (+37)
- Total new: 166 tests across 5 files
