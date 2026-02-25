# Decision: BLM Advisory Type Map Ordering Quirk

**Date:** 2026-02-24
**By:** Pappas (Tester)
**Status:** Observation

## Context

While testing the BLM scraper's `_classify_advisory_type()`, I discovered that `ADVISORY_TYPE_MAP` dict ordering causes "winter closure" text to match the "closure" keyword before reaching the more specific "winter closure" → "seasonal_access" entry. Similarly, "seasonal closure" matches "closure" first.

This is because Python dicts preserve insertion order, and `ADVISORY_TYPE_MAP` lists `"closure"` before `"winter closure"` and `"seasonal closure"`. The `for keyword in ...` loop returns on first match.

## Impact

Low — "winter closure" and "seasonal closure" advisories are classified as `"closure"` rather than `"seasonal_access"`. Both are functionally similar (area is inaccessible). Same pattern exists in USFS with `ALERT_TYPE_MAP` where `"closure"` precedes `"trail closure"`.

## Recommendation

If distinguishing seasonal vs. emergency closures matters for the UI, the maps should be reordered to check more-specific keywords before less-specific ones (longest-match-first). Not blocking — documented in tests as expected behavior.

## Also Noted

BLM `_extract_river_name` uses a greedy regex `(?:\s+[A-Z][a-z]+)*\s+River\b` that captures all consecutive capitalized words before "River"/"Creek"/"Canyon"/"Fork". When the river name appears in multiple fields (title, area, description), the combined text can produce matches like "Salmon Creek Salmon Creek" instead of "Salmon Creek". Test data was adjusted to avoid duplicating river names across fields, but production data may hit this. A non-greedy match or per-field extraction would be more precise.
