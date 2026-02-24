# BD-004: Explicit None Checks for Numeric Fields

**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

In Python, always use `is not None` instead of truthiness checks when evaluating numeric fields that can legitimately be `0` (e.g., `deal.price`, `f.max_price`). Truthiness checks (`if value:`) treat `0` as falsy, silently skipping logic for $0/free items.

Also standardized input validation clamping across all paginated API routes — both `limit` and `offset` should use `Math.min`/`Math.max` to prevent negative or excessive values. Rivers route now matches the deals route pattern.
