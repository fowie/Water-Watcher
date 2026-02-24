# Pappas — History

## Core Context
- **Project:** Water-Watcher — Whitewater Rafting Tracker
- **User:** Spencer Fowers
- **Stack:** Python 3.12 (pytest + respx) pipeline, Next.js 15 + TypeScript (Vitest) web
- **Key test areas:** Scraping reliability, data quality/normalization, responsive UI, Craigslist monitoring accuracy, notification delivery, filter logic, river data integrity

## Learnings

<!-- Append learnings below. Format: **YYYY-MM-DD:** what was learned -->

**2025-06-25:** Initial test infrastructure setup. Key discoveries:
- Source files are actively being modified by other squad agents (Utah). Always re-read source code before writing/updating tests — initial reads may be stale.
- `condition_processor.py` expanded from ~130 to 331 lines: now has 6 flow ranges (not 4), per-river threshold support via `flow_range` param, `SOURCE_PRIORITY` dict, `_merge_with_existing()` for multi-source fusion, and `runnability_to_quality()` (not `classify_quality`).
- `deal_matcher.py` expanded from ~115 to 227 lines: switched from boolean `_matches_filter()` to scoring `_score_match()` returning 0-100. Category=30pts, keywords=10pts each (max 40), price=20+bonus, region=10pts. Hard disqualifiers: price over max → 0, wrong region → 0, no keyword hit → 0. `NOTIFICATION_THRESHOLD=50`.
- SQLAlchemy's `create_engine()` runs at import time, requiring psycopg2 even in tests. Install `psycopg2-binary` for test environments.
- `make_mock_filter` factory: using `keywords or ["default"]` is dangerous — passing `keywords=[]` produces `["default"]` not `[]`. Use sentinel pattern instead.
- Vitest `vi.mock()` factory is hoisted above variable declarations. Must use `vi.hoisted()` to create mock objects referenced in factory functions.
- Next.js API routes may call `prisma.user.findUnique` for user verification before schema validation. Mock the full Prisma model surface area, not just the primary model.
- Route response shapes matter: GET /api/rivers returns `{ rivers, total, limit, offset }`, not a bare array.

**2026-02-24:** Edge case test expansion round. Discoveries:
- Deals route clamps limit to [1,100] and offset to [0,∞) — safe. Rivers route does NOT clamp limit minimum or negative offset — fragile.
- `maxPrice` ignores non-positive values (`price > 0` guard) — correct behavior, but negative/zero maxPrice silently drops the filter.
- `deal_matcher._score_match()` treats `price=0.0` as falsy in Python, so $0 deals skip the price-ceiling disqualifier AND the 20pt price bonus. They get only 10pts for "has a listed price". This is a subtle edge case worth documenting.
- Unicode, CJK, emoji all work fine in both Prisma search and Python `str.lower()` keyword matching — no crashes.
- Very long descriptions (~110KB) process without issue in the deal matcher.
- Test count after this round: web 119 (was 98), pipeline 147 (was 130).
- Weakest coverage areas: Craigslist scraper (no test file), AW scraper (no test file), notification delivery (push_notifier.py untested), condition_processor integration paths, web component rendering.

**2026-02-24:** Untested module coverage round. Three new test files created (131 new tests):
- `test_craigslist_scraper.py` (57 tests): _categorize, _is_relevant, _extract_price, RSS/RDF parsing, HTML fallback, deduplication, rate limiting, error handling.
- `test_aw_scraper.py` (35 tests): _fetch_reach_detail, _fetch_gauge_data, _extract_reach_data, difficulty normalization, _classify_hazard, _parse_float, _clean_html, tracked river lookup, integration.
- `test_push_notifier.py` (39 tests): _send_push success/failure, 410 cleanup, _build_deal_payload, notify_deal_matches grouping, notify_condition_change direction detection, notify_hazard_alert severity emojis, VAPID key guard.
- **Bug found:** `craigslist.py` _scrape_rss uses `el.find("tag") or el.find("{ns}tag")` — in Python 3.12, Element truthiness for childless elements is False (DeprecationWarning), so standard RSS 2.0 items are silently skipped. Only RDF-format RSS works correctly. Production CL feeds appear to use RDF format so this may not cause issues in practice, but the code will break when Element truthiness changes to always-True in a future Python version.
- **Bug found:** `_classify_hazard` checks strainer keywords (including "log") before logjam keywords ("logjam", "log jam"), so "logjam" always classifies as "strainer" since "log" is a substring of "logjam".
- Had to install `lxml` and `pywebpush` into the test environment — these were runtime deps not in requirements-dev.txt.
- Pipeline test count: 278 (was 147).

---

## Cross-Agent Updates

**2026-02-24 (from Tyler):** Frontend component structure: `web/src/components/ui/` (10 primitives), `web/src/components/` (8 domain components). Pages use client-side fetching via `web/src/lib/api.ts`. Types in `web/src/types/index.ts`. Zod validations in `web/src/lib/validations.ts`.

**2026-02-24 (from Utah):** Pipeline modules finalized: `condition_processor.py` (331 lines, 6 flow ranges, source priority merging), `deal_matcher.py` (227 lines, scored matching 0-100). AW scraper ~400 lines, CL scraper ~370 lines. API routes enhanced with pagination, search, user validation. Schedule: conditions every 4h, deals every 30m.
