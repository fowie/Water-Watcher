# Bug Fixes: Hazard Classifier & RSS Parser

**Author:** Utah (Backend Dev)  
**Date:** 2026-02-24  
**Status:** Implemented  
**Reported by:** Pappas (QA)

## Bug 1: Hazard Classifier Misclassification

**File:** `pipeline/scrapers/american_whitewater.py`, method `_classify_hazard`

**Problem:** The strainer keyword check ran before the logjam check. Since "logjam" contains the substring "log" (a strainer keyword), any hazard with "logjam" in the text was misclassified as "strainer".

**Fix:**
- Moved logjam check (`"logjam"`, `"log jam"`, `"blockage"`) before strainer check
- Removed `"log"` from strainer keywords (too ambiguous; kept `"strainer"`, `"tree"`, `"wood"`, `"debris"`)
- Updated test assertion and added `"log jam"` two-word test case

**Principle:** More specific keyword checks should always precede broader ones to avoid substring false matches.

## Bug 2: RSS Parser ElementTree Truthiness

**File:** `pipeline/scrapers/craigslist.py`, method `_scrape_rss`

**Problem:** The `or` pattern (`item.find("title") or item.find("{ns}title")`) fails silently when the first `find()` returns an Element with no children. In Python's `xml.etree.ElementTree`, an element with no children evaluates as falsy (`bool(element) == False`), even though it exists and has `.text`. This caused the code to skip the valid element and fall through to the namespaced lookup, which could return `None`.

**Fix:** Replaced all four `or`-based element lookups with explicit `is None` checks:
```python
title_el = item.find("title")
if title_el is None:
    title_el = item.find("{http://purl.org/rss/1.0/}title")
```

**Principle:** Never use truthiness (`or`, `if el:`) with ElementTree elements. Always use `is None` / `is not None`.

## Verification

All 278 pipeline tests pass after both fixes.
