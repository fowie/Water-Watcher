"""
Integration-style tests for the ConditionProcessor.

Tests the full process() flow with multiple sources, source priority merging,
the 2-hour merge window, runnability_to_quality edge cases, and same-source
temporal behavior.
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock, call

from processors.condition_processor import (
    classify_runnability,
    runnability_to_quality,
    ConditionProcessor,
    SOURCE_PRIORITY,
    DEFAULT_FLOW_RANGES,
)
from scrapers.base import ScrapedItem
from tests.conftest import make_mock_river, make_usgs_scraped_item


# ─── Helpers ────────────────────────────────────────────────


def _make_aw_item(aw_id="aw-123", flow_rate=1200.0, gauge_height=None,
                  water_temp=None, flow_range=None):
    """Create an AW ScrapedItem for integration testing."""
    data = {
        "aw_id": aw_id,
        "flow_rate": flow_rate,
        "gauge_height": gauge_height,
        "water_temp": water_temp,
    }
    if flow_range:
        data["flow_range"] = flow_range
    return ScrapedItem(
        source="aw",
        source_url=f"https://www.americanwhitewater.org/content/River/view/{aw_id}",
        data=data,
        scraped_at=datetime.now(timezone.utc),
    )


def _make_usgs_item(gauge_id="09380000", flow_rate=2000.0, gauge_height=6.5,
                    water_temp=48.0, scraped_at=None):
    """Create a USGS ScrapedItem for integration testing."""
    return ScrapedItem(
        source="usgs",
        source_url=f"https://waterdata.usgs.gov/nwis/uv?site_no={gauge_id}",
        data={
            "usgs_gauge_id": gauge_id,
            "flow_rate": flow_rate,
            "gauge_height": gauge_height,
            "water_temp": water_temp,
            "raw": {"site_code": gauge_id},
        },
        scraped_at=scraped_at or datetime.now(timezone.utc),
    )


def _make_mock_condition(source="usgs", flow_rate=3000.0, gauge_height=7.0,
                         water_temp=50.0, quality="excellent",
                         scraped_at=None):
    """Create a mock RiverCondition row (as returned by DB query)."""
    cond = MagicMock()
    cond.source = source
    cond.flow_rate = flow_rate
    cond.gauge_height = gauge_height
    cond.water_temp = water_temp
    cond.quality = quality
    cond.scraped_at = scraped_at or datetime.now(timezone.utc)
    return cond


def _setup_processor_mocks(mock_session_cls, rivers, existing_conditions=None,
                           prev_condition=None):
    """Wire up the standard mock chain for ConditionProcessor.process()."""
    mock_session = MagicMock()
    mock_session_cls.return_value = mock_session

    # _find_river: query().filter().first()
    def find_river_side_effect(*args, **kwargs):
        """Return a chainable filter mock that looks up rivers."""
        filter_mock = MagicMock()

        def first_side_effect():
            # Match by the filter arguments
            if rivers:
                return rivers.pop(0) if isinstance(rivers, list) else rivers
            return None

        filter_mock.first.return_value = first_side_effect()
        return filter_mock

    # We need separate call tracking for different query patterns
    # This mock setup handles the three query paths:
    # 1. _find_river: session.query(River).filter(...).first()
    # 2. _merge_with_existing: session.query(RC).filter(...).order_by(...).limit(...).all()
    # 3. prev_condition: session.query(RC).filter(...).order_by(...).first()

    query_mock = MagicMock()
    mock_session.query.return_value = query_mock

    filter_mock = MagicMock()
    query_mock.filter.return_value = filter_mock

    # _find_river path
    filter_mock.first.return_value = rivers[0] if isinstance(rivers, list) and rivers else rivers

    # _merge_with_existing path
    order_mock = MagicMock()
    filter_mock.order_by.return_value = order_mock
    limit_mock = MagicMock()
    order_mock.limit.return_value = limit_mock
    limit_mock.all.return_value = existing_conditions or []

    # prev_condition path
    order_mock.first.return_value = prev_condition

    return mock_session


# ─── Full process() flow with multiple sources ──────────────


class TestProcessMultipleSources:
    """Test the full process() flow with items from different scrapers."""

    @patch("processors.condition_processor.SessionLocal")
    def test_process_usgs_items_sets_correct_source(self, mock_session_cls):
        """USGS items should be processed with source='usgs'."""
        river = make_mock_river(usgs_gauge_id="09380000")
        mock_session = _setup_processor_mocks(mock_session_cls, river)

        items = [_make_usgs_item(gauge_id="09380000", flow_rate=3000.0)]
        processor = ConditionProcessor()
        result = processor.process(items, source="usgs")

        assert len(result) == 1
        assert result[0]["source"] == "usgs"

    @patch("processors.condition_processor.SessionLocal")
    def test_process_aw_items_sets_correct_source(self, mock_session_cls):
        """AW items should be processed with source='aw'."""
        river = make_mock_river(aw_id="aw-123")
        mock_session = _setup_processor_mocks(mock_session_cls, river)

        items = [_make_aw_item(aw_id="aw-123", flow_rate=800.0)]
        processor = ConditionProcessor()
        result = processor.process(items, source="aw")

        assert len(result) == 1
        assert result[0]["source"] == "aw"

    @patch("processors.condition_processor.SessionLocal")
    def test_process_multiple_items_same_source(self, mock_session_cls):
        """Processing multiple items from the same source should work."""
        river = make_mock_river(usgs_gauge_id="09380000")
        mock_session = _setup_processor_mocks(mock_session_cls, river)

        items = [
            _make_usgs_item(gauge_id="09380000", flow_rate=1000.0),
            _make_usgs_item(gauge_id="09380000", flow_rate=1500.0),
        ]
        processor = ConditionProcessor()
        result = processor.process(items, source="usgs")

        assert len(result) == 2

    @patch("processors.condition_processor.SessionLocal")
    def test_process_classifies_runnability(self, mock_session_cls):
        """Flow rate should be classified into runnability."""
        river = make_mock_river(usgs_gauge_id="09380000")
        mock_session = _setup_processor_mocks(mock_session_cls, river)

        items = [_make_usgs_item(gauge_id="09380000", flow_rate=2000.0)]
        processor = ConditionProcessor()
        result = processor.process(items, source="usgs")

        assert result[0]["runnability"] == "optimal"
        assert result[0]["quality"] == "excellent"

    @patch("processors.condition_processor.SessionLocal")
    def test_process_with_per_river_flow_range(self, mock_session_cls):
        """AW items with flow_range should use per-river thresholds."""
        river = make_mock_river(aw_id="aw-123")
        mock_session = _setup_processor_mocks(mock_session_cls, river)

        items = [_make_aw_item(aw_id="aw-123", flow_rate=800.0,
                               flow_range={"min": 500, "max": 2000})]
        processor = ConditionProcessor()
        result = processor.process(items, source="aw")

        assert result[0]["runnability"] == "optimal"

    @patch("processors.condition_processor.SessionLocal")
    def test_process_no_flow_rate_gives_none_runnability(self, mock_session_cls):
        """Items without flow_rate should have None runnability."""
        river = make_mock_river(aw_id="aw-123")
        mock_session = _setup_processor_mocks(mock_session_cls, river)

        items = [_make_aw_item(aw_id="aw-123", flow_rate=None)]
        processor = ConditionProcessor()
        result = processor.process(items, source="aw")

        assert result[0]["runnability"] is None
        assert result[0]["quality"] is None

    @patch("processors.condition_processor.SessionLocal")
    def test_process_detects_quality_change(self, mock_session_cls):
        """Should flag quality_changed when quality differs from previous."""
        river = make_mock_river(usgs_gauge_id="09380000")
        prev = _make_mock_condition(quality="poor")
        mock_session = _setup_processor_mocks(mock_session_cls, river,
                                               prev_condition=prev)

        items = [_make_usgs_item(gauge_id="09380000", flow_rate=2000.0)]
        processor = ConditionProcessor()
        result = processor.process(items, source="usgs")

        assert result[0].get("quality_changed") is True
        assert result[0]["old_quality"] == "poor"
        assert result[0]["new_quality"] == "excellent"

    @patch("processors.condition_processor.SessionLocal")
    def test_process_no_quality_change_flag_when_same(self, mock_session_cls):
        """Should NOT flag quality_changed when quality is unchanged."""
        river = make_mock_river(usgs_gauge_id="09380000")
        prev = _make_mock_condition(quality="excellent")
        mock_session = _setup_processor_mocks(mock_session_cls, river,
                                               prev_condition=prev)

        items = [_make_usgs_item(gauge_id="09380000", flow_rate=2000.0)]
        processor = ConditionProcessor()
        result = processor.process(items, source="usgs")

        assert "quality_changed" not in result[0]

    @patch("processors.condition_processor.SessionLocal")
    def test_process_commits_and_creates_scrape_log(self, mock_session_cls):
        """Should commit and create a ScrapeLog on success."""
        river = make_mock_river(usgs_gauge_id="09380000")
        mock_session = _setup_processor_mocks(mock_session_cls, river)

        items = [_make_usgs_item(gauge_id="09380000", flow_rate=2000.0)]
        processor = ConditionProcessor()
        processor.process(items, source="usgs")

        mock_session.commit.assert_called()
        # add() called for RiverCondition + ScrapeLog
        assert mock_session.add.call_count >= 2

    @patch("processors.condition_processor.SessionLocal")
    def test_process_handles_exception_gracefully(self, mock_session_cls):
        """Should rollback and log error ScrapeLog on exception."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        # Make query raise an exception
        mock_session.query.side_effect = RuntimeError("DB connection lost")

        processor = ConditionProcessor()
        result = processor.process(
            [_make_usgs_item(gauge_id="09380000")], source="usgs"
        )

        assert result == []
        mock_session.rollback.assert_called()


# ─── Source Priority Merging ────────────────────────────────


class TestSourcePriorityMerging:
    """Test that higher-priority sources take precedence in merging."""

    @patch("processors.condition_processor.SessionLocal")
    def test_usgs_data_not_overridden_by_lower_source(self, mock_session_cls):
        """When processing AW data, existing USGS data should fill gaps."""
        river = make_mock_river(aw_id="aw-123")
        existing_usgs = _make_mock_condition(
            source="usgs", flow_rate=5000.0, gauge_height=8.0, water_temp=55.0,
            scraped_at=datetime.now(timezone.utc) - timedelta(minutes=30)
        )
        mock_session = _setup_processor_mocks(
            mock_session_cls, river, existing_conditions=[existing_usgs]
        )

        # AW item with no flow_rate — should get filled from USGS
        items = [_make_aw_item(aw_id="aw-123", flow_rate=None,
                               gauge_height=None, water_temp=None)]
        processor = ConditionProcessor()
        result = processor.process(items, source="aw")

        assert len(result) == 1
        # With merge, AW's None flow should be filled by USGS's 5000
        assert result[0]["flow_rate"] == 5000.0

    @patch("processors.condition_processor.SessionLocal")
    def test_usgs_source_uses_own_values_not_lower(self, mock_session_cls):
        """USGS data should always keep its own values, not merge from lower sources."""
        river = make_mock_river(usgs_gauge_id="09380000")
        existing_aw = _make_mock_condition(
            source="aw", flow_rate=800.0, gauge_height=4.0,
            scraped_at=datetime.now(timezone.utc) - timedelta(minutes=30)
        )
        mock_session = _setup_processor_mocks(
            mock_session_cls, river, existing_conditions=[existing_aw]
        )

        items = [_make_usgs_item(gauge_id="09380000", flow_rate=3000.0)]
        processor = ConditionProcessor()
        result = processor.process(items, source="usgs")

        # USGS should use its own 3000, not AW's 800
        assert result[0]["flow_rate"] == 3000.0

    @patch("processors.condition_processor.SessionLocal")
    def test_aw_fills_missing_from_usgs_but_keeps_own(self, mock_session_cls):
        """AW should keep its own flow_rate if it has one, not replace with USGS."""
        river = make_mock_river(aw_id="aw-123")
        existing_usgs = _make_mock_condition(
            source="usgs", flow_rate=5000.0, gauge_height=8.0, water_temp=55.0,
            scraped_at=datetime.now(timezone.utc) - timedelta(minutes=30)
        )
        mock_session = _setup_processor_mocks(
            mock_session_cls, river, existing_conditions=[existing_usgs]
        )

        # AW has its own flow_rate
        items = [_make_aw_item(aw_id="aw-123", flow_rate=1200.0)]
        processor = ConditionProcessor()
        result = processor.process(items, source="aw")

        # AW keeps 1200 because it has a value; merge only fills None fields
        assert result[0]["flow_rate"] == 1200.0

    @patch("processors.condition_processor.SessionLocal")
    def test_facebook_source_skipped_without_matching_id(self, mock_session_cls):
        """Facebook source doesn't match _find_river (only usgs/aw supported)."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        # _find_river returns None for facebook source
        mock_session.query.return_value.filter.return_value.first.return_value = None

        fb_item = ScrapedItem(
            source="facebook",
            source_url="https://facebook.com/groups/riverreports/123",
            data={"aw_id": "aw-123", "flow_rate": None, "gauge_height": None,
                  "water_temp": None},
            scraped_at=datetime.now(timezone.utc),
        )
        processor = ConditionProcessor()
        result = processor.process([fb_item], source="facebook")

        # Facebook items get skipped because _find_river only handles usgs/aw
        assert result == []

    def test_source_priority_ordering(self):
        """Verify the priority ordering is maintained."""
        assert SOURCE_PRIORITY["usgs"] > SOURCE_PRIORITY["aw"]
        assert SOURCE_PRIORITY["aw"] > SOURCE_PRIORITY["blm"]
        assert SOURCE_PRIORITY["blm"] == SOURCE_PRIORITY["usfs"]
        assert SOURCE_PRIORITY["usfs"] > SOURCE_PRIORITY["facebook"]


# ─── 2-Hour Merge Window ───────────────────────────────────


class TestMergeWindow:
    """Test the 2-hour cutoff for considering existing condition data."""

    @patch("processors.condition_processor.SessionLocal")
    def test_recent_data_within_window_is_used(self, mock_session_cls):
        """Conditions from 1 hour ago should be within the merge window."""
        river = make_mock_river(aw_id="aw-123")
        recent = _make_mock_condition(
            source="usgs", flow_rate=6000.0,
            scraped_at=datetime.now(timezone.utc) - timedelta(hours=1)
        )
        mock_session = _setup_processor_mocks(
            mock_session_cls, river, existing_conditions=[recent]
        )

        items = [_make_aw_item(aw_id="aw-123", flow_rate=None)]
        processor = ConditionProcessor()
        result = processor.process(items, source="aw")

        assert result[0]["flow_rate"] == 6000.0

    @patch("processors.condition_processor.SessionLocal")
    def test_old_data_outside_window_not_returned(self, mock_session_cls):
        """The DB query uses a cutoff — data older than 2 hours is excluded.
        When the DB returns no rows (because they're outside the window),
        the merge produces None for missing fields."""
        river = make_mock_river(aw_id="aw-123")
        # Empty existing_conditions simulates the DB filtering out old data
        mock_session = _setup_processor_mocks(
            mock_session_cls, river, existing_conditions=[]
        )

        items = [_make_aw_item(aw_id="aw-123", flow_rate=None)]
        processor = ConditionProcessor()
        result = processor.process(items, source="aw")

        # No higher-priority data available → stays None
        assert result[0]["flow_rate"] is None

    @patch("processors.condition_processor.SessionLocal")
    def test_data_exactly_at_boundary_included(self, mock_session_cls):
        """Edge condition at exactly 2 hours should be included (>= cutoff)."""
        river = make_mock_river(aw_id="aw-123")
        boundary = _make_mock_condition(
            source="usgs", flow_rate=7000.0,
            scraped_at=datetime.now(timezone.utc) - timedelta(hours=2)
        )
        # The DB query uses >= cutoff, so exactly-2h data is returned
        mock_session = _setup_processor_mocks(
            mock_session_cls, river, existing_conditions=[boundary]
        )

        items = [_make_aw_item(aw_id="aw-123", flow_rate=None)]
        processor = ConditionProcessor()
        result = processor.process(items, source="aw")

        assert result[0]["flow_rate"] == 7000.0


# ─── runnability_to_quality edge cases ──────────────────────


class TestRunnabilityToQualityEdges:
    """Edge cases for the runnability → quality mapping."""

    def test_empty_string(self):
        """Empty string should return None (no match in mapping)."""
        assert runnability_to_quality("") is None

    def test_none(self):
        assert runnability_to_quality(None) is None

    def test_case_sensitive(self):
        """Mapping is case-sensitive — uppercase should return None."""
        assert runnability_to_quality("Optimal") is None
        assert runnability_to_quality("DANGEROUS") is None

    def test_all_known_mappings(self):
        """Verify every mapping in the mapping dict."""
        expected = {
            "optimal": "excellent",
            "runnable": "good",
            "high": "fair",
            "low": "poor",
            "too_low": "poor",
            "too_high": "dangerous",
            "dangerous": "dangerous",
        }
        for runnability, quality in expected.items():
            assert runnability_to_quality(runnability) == quality

    def test_unknown_label_returns_none(self):
        """Unmapped labels should return None gracefully."""
        assert runnability_to_quality("moderate") is None
        assert runnability_to_quality("extreme") is None
        assert runnability_to_quality("perfect") is None

    def test_whitespace_label(self):
        """Whitespace-only labels should return None."""
        assert runnability_to_quality(" ") is None
        assert runnability_to_quality("  optimal  ") is None

    def test_numeric_string(self):
        """Numeric string should return None."""
        assert runnability_to_quality("100") is None

    def test_special_characters(self):
        assert runnability_to_quality("optimal!") is None
        assert runnability_to_quality("too-low") is None


# ─── classify_runnability edge cases ────────────────────────


class TestClassifyRunnabilityEdges:
    """Edge cases for classify_runnability."""

    def test_float_boundary_precision(self):
        """Floating point near boundaries."""
        # Just below 200 → too_low
        assert classify_runnability(199.999) == "too_low"
        # Exactly 200.0 → low
        assert classify_runnability(200.0) == "low"

    def test_infinity_flow(self):
        """Infinite flow is classified as dangerous (boundary-inclusive)."""
        assert classify_runnability(float("inf")) == "dangerous"

    def test_very_small_positive(self):
        assert classify_runnability(0.001) == "too_low"

    def test_per_river_with_zero_min(self):
        """Per-river range with min=0 should handle correctly."""
        assert classify_runnability(0.0, {"min": 0, "max": 100}) == "optimal"
        assert classify_runnability(150.0, {"min": 0, "max": 100}) == "high"

    def test_per_river_with_very_narrow_range(self):
        """Very narrow optimal range."""
        assert classify_runnability(999.0, {"min": 1000, "max": 1001}) == "low"
        assert classify_runnability(1000.0, {"min": 1000, "max": 1001}) == "optimal"
        assert classify_runnability(1001.0, {"min": 1000, "max": 1001}) == "optimal"

    def test_per_river_equal_min_max(self):
        """When min equals max, only that exact flow is optimal."""
        assert classify_runnability(500.0, {"min": 500, "max": 500}) == "optimal"
        assert classify_runnability(501.0, {"min": 500, "max": 500}) == "high"
        assert classify_runnability(499.0, {"min": 500, "max": 500}) == "low"

    def test_per_river_none_min_falls_back(self):
        """If min is None in flow_range, should fall back to defaults."""
        result = classify_runnability(1000.0, {"min": None, "max": 2000})
        assert result == "runnable"  # default: 500-1500

    def test_per_river_empty_dict_falls_back(self):
        """Empty dict should fall back to defaults."""
        result = classify_runnability(1000.0, {})
        assert result == "runnable"

    def test_per_river_string_values_coerced(self):
        """Flow range values as strings should be coerced to float."""
        result = classify_runnability(800.0, {"min": "500", "max": "2000"})
        assert result == "optimal"


# ─── Same-source temporal behavior ─────────────────────────


class TestSameSourceTemporal:
    """Test what happens when conditions from the same source arrive at different times."""

    @patch("processors.condition_processor.SessionLocal")
    def test_later_reading_sees_earlier_as_previous(self, mock_session_cls):
        """A second USGS reading should detect quality change from the first."""
        river = make_mock_river(usgs_gauge_id="09380000")
        prev = _make_mock_condition(source="usgs", quality="excellent",
                                    flow_rate=2000.0)
        mock_session = _setup_processor_mocks(
            mock_session_cls, river, prev_condition=prev
        )

        # New reading with dangerous flow
        items = [_make_usgs_item(gauge_id="09380000", flow_rate=15000.0)]
        processor = ConditionProcessor()
        result = processor.process(items, source="usgs")

        assert result[0]["runnability"] == "dangerous"
        assert result[0].get("quality_changed") is True
        assert result[0]["old_quality"] == "excellent"
        assert result[0]["new_quality"] == "dangerous"

    @patch("processors.condition_processor.SessionLocal")
    def test_same_quality_no_change_flag(self, mock_session_cls):
        """Same quality from same source should not flag a change."""
        river = make_mock_river(usgs_gauge_id="09380000")
        prev = _make_mock_condition(source="usgs", quality="excellent",
                                    flow_rate=2000.0)
        mock_session = _setup_processor_mocks(
            mock_session_cls, river, prev_condition=prev
        )

        items = [_make_usgs_item(gauge_id="09380000", flow_rate=3000.0)]
        processor = ConditionProcessor()
        result = processor.process(items, source="usgs")

        assert result[0]["runnability"] == "optimal"
        assert "quality_changed" not in result[0]

    @patch("processors.condition_processor.SessionLocal")
    def test_same_source_no_merge_needed(self, mock_session_cls):
        """Same-source existing conditions should not override (same priority)."""
        river = make_mock_river(usgs_gauge_id="09380000")
        existing_same = _make_mock_condition(
            source="usgs", flow_rate=9000.0, gauge_height=10.0,
            scraped_at=datetime.now(timezone.utc) - timedelta(minutes=30)
        )
        mock_session = _setup_processor_mocks(
            mock_session_cls, river, existing_conditions=[existing_same]
        )

        items = [_make_usgs_item(gauge_id="09380000", flow_rate=2000.0,
                                 gauge_height=6.5)]
        processor = ConditionProcessor()
        result = processor.process(items, source="usgs")

        # Same priority → no merge → keeps own values
        assert result[0]["flow_rate"] == 2000.0

    @patch("processors.condition_processor.SessionLocal")
    def test_none_old_quality_no_change_flag(self, mock_session_cls):
        """If there's no previous condition (first reading), no change flag."""
        river = make_mock_river(usgs_gauge_id="09380000")
        mock_session = _setup_processor_mocks(
            mock_session_cls, river, prev_condition=None
        )

        items = [_make_usgs_item(gauge_id="09380000", flow_rate=2000.0)]
        processor = ConditionProcessor()
        result = processor.process(items, source="usgs")

        assert "quality_changed" not in result[0]

    @patch("processors.condition_processor.SessionLocal")
    def test_none_new_quality_no_change_flag(self, mock_session_cls):
        """If new quality is None (no flow data), no change flag."""
        river = make_mock_river(aw_id="aw-123")
        prev = _make_mock_condition(quality="good")
        mock_session = _setup_processor_mocks(
            mock_session_cls, river, prev_condition=prev
        )

        items = [_make_aw_item(aw_id="aw-123", flow_rate=None)]
        processor = ConditionProcessor()
        result = processor.process(items, source="aw")

        # new quality is None — the code checks `if old_quality and quality`
        assert "quality_changed" not in result[0]


# ─── DEFAULT_FLOW_RANGES validation ────────────────────────


class TestDefaultFlowRanges:
    """Validate the DEFAULT_FLOW_RANGES dictionary structure."""

    def test_ranges_are_contiguous(self):
        """Each range should start where the previous one ends."""
        sorted_ranges = sorted(DEFAULT_FLOW_RANGES.items(), key=lambda x: x[1][0])
        for i in range(len(sorted_ranges) - 1):
            _, (_, high) = sorted_ranges[i]
            _, (low, _) = sorted_ranges[i + 1]
            assert high == low, f"Gap between {sorted_ranges[i]} and {sorted_ranges[i+1]}"

    def test_ranges_cover_from_zero(self):
        """Lowest range should start at 0."""
        min_low = min(r[0] for r in DEFAULT_FLOW_RANGES.values())
        assert min_low == 0

    def test_ranges_cover_to_infinity(self):
        """Highest range should go to infinity."""
        max_high = max(r[1] for r in DEFAULT_FLOW_RANGES.values())
        assert max_high == float("inf")

    def test_all_six_ranges_exist(self):
        """Should have exactly 6 flow ranges."""
        assert len(DEFAULT_FLOW_RANGES) == 6
        expected_keys = {"too_low", "low", "runnable", "optimal", "high", "dangerous"}
        assert set(DEFAULT_FLOW_RANGES.keys()) == expected_keys
