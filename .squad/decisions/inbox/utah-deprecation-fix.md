# BD-004: datetime.utcnow() Deprecation Fix
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Replaced all `datetime.utcnow()` calls with `datetime.now(timezone.utc)` across the entire pipeline (8 files, ~30 occurrences). This eliminates the Python 3.12+ deprecation warning and produces timezone-aware UTC datetimes, which are safer for cross-system comparisons. For SQLAlchemy column defaults and dataclass `default_factory`, a `_utc_now()` helper function is used as the callable since `datetime.now(timezone.utc)` cannot be passed directly as a function reference.

Also added `_validate_startup()` to `main.py` that hard-fails on missing `DATABASE_URL` and warns on missing VAPID keys, preventing silent misconfigurations.
