# Pappas — Untested Modules Testing Report

**Date:** 2026-02-24  
**By:** Pappas (Tester)

## Summary

Added 131 tests across three previously untested pipeline modules (Craigslist scraper, AW scraper, Push notifier). Pipeline test count went from 147 → 278. All 278 pass.

## Bugs Found (for Utah)

1. **Craigslist RSS parsing — ElementTree `or` truthiness bug:**  
   `_scrape_rss` uses `item.find("title") or item.find("{ns}title")`. In Python 3.12, childless Elements are falsy (with DeprecationWarning), so `find("title")` on an RSS 2.0 `<title>text</title>` returns False → the `or` falls through to the namespaced version → None for non-RDF feeds. Standard RSS 2.0 items are silently dropped. Fix: use `is not None` checks instead of `or`. This will *also* break differently when Python changes Element truthiness to always-True in a future version.

2. **Hazard classification keyword order:**  
   `_classify_hazard()` checks strainer keywords (including "log") before logjam keywords ("logjam"). Since "log" is a substring of "logjam", logjam hazards always classify as "strainer". Fix: reorder keyword checks or use word-boundary matching.

## Environment Notes

`lxml` and `pywebpush` are runtime dependencies used by the scrapers/notifiers but weren't in `requirements-dev.txt`. Tests that import those modules fail without them. Recommend adding them to dev deps.
