"""
Tests for the condition processor.

Tests the core classification logic:
- Flow-rate-based runnability classification (default and per-river thresholds)
- Quality mapping from runnability
- Boundary conditions and edge cases
- Processing pipeline behavior with mocked DB
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

from processors.condition_processor import (
    classify_runnability,
    runnability_to_quality,
    ConditionProcessor,
    DEFAULT_FLOW_RANGES,
    SOURCE_PRIORITY,
)
from scrapers.base import ScrapedItem
from tests.conftest import make_mock_river, make_usgs_scraped_item


# ─── classify_runnability tests (default thresholds) ────────


class TestClassifyRunnabilityDefaults:
    """Tests using the default flow ranges (no per-river thresholds)."""

    def test_none_flow(self):
        assert classify_runnability(None) is None

    def test_zero_flow(self):
        """0 CFS = too_low (still in range 0-200)."""
        assert classify_runnability(0.0) == "too_low"

    def test_too_low(self):
        assert classify_runnability(50.0) == "too_low"
        assert classify_runnability(199.0) == "too_low"

    def test_boundary_too_low_to_low(self):
        """200 CFS boundary — should be 'low'."""
        assert classify_runnability(200.0) == "low"

    def test_low(self):
        assert classify_runnability(300.0) == "low"
        assert classify_runnability(499.0) == "low"

    def test_boundary_low_to_runnable(self):
        """500 CFS boundary — should be 'runnable'."""
        assert classify_runnability(500.0) == "runnable"

    def test_runnable(self):
        assert classify_runnability(800.0) == "runnable"
        assert classify_runnability(1499.0) == "runnable"

    def test_boundary_runnable_to_optimal(self):
        """1500 CFS boundary — should be 'optimal'."""
        assert classify_runnability(1500.0) == "optimal"

    def test_optimal(self):
        assert classify_runnability(2000.0) == "optimal"
        assert classify_runnability(4999.0) == "optimal"

    def test_boundary_optimal_to_high(self):
        """5000 CFS boundary — should be 'high'."""
        assert classify_runnability(5000.0) == "high"

    def test_high(self):
        assert classify_runnability(7500.0) == "high"
        assert classify_runnability(9999.0) == "high"

    def test_boundary_high_to_dangerous(self):
        """10000 CFS boundary — should be 'dangerous'."""
        assert classify_runnability(10000.0) == "dangerous"

    def test_dangerous(self):
        assert classify_runnability(50000.0) == "dangerous"

    def test_negative_flow(self):
        """Negative flow values shouldn't match any range (invalid CFS)."""
        result = classify_runnability(-100.0)
        assert result is None

    def test_very_small_positive_flow(self):
        assert classify_runnability(0.1) == "too_low"

    def test_extremely_high_flow(self):
        assert classify_runnability(1_000_000.0) == "dangerous"


# ─── classify_runnability tests (per-river thresholds) ──────


class TestClassifyRunnabilityPerRiver:
    """Tests using per-river flow thresholds from AW data."""

    def test_below_min_half(self):
        """Flow < min * 0.5 → too_low."""
        result = classify_runnability(200.0, {"min": 600, "max": 2000})
        assert result == "too_low"

    def test_between_half_min_and_min(self):
        """min * 0.5 <= flow < min → low."""
        result = classify_runnability(400.0, {"min": 600, "max": 2000})
        assert result == "low"

    def test_at_min(self):
        """flow = min → optimal."""
        result = classify_runnability(600.0, {"min": 600, "max": 2000})
        assert result == "optimal"

    def test_within_range(self):
        """min <= flow <= max → optimal."""
        result = classify_runnability(1200.0, {"min": 600, "max": 2000})
        assert result == "optimal"

    def test_at_max(self):
        """flow = max → optimal."""
        result = classify_runnability(2000.0, {"min": 600, "max": 2000})
        assert result == "optimal"

    def test_above_max_within_1_5x(self):
        """max < flow <= max * 1.5 → high."""
        result = classify_runnability(2500.0, {"min": 600, "max": 2000})
        assert result == "high"

    def test_above_max_1_5x(self):
        """flow > max * 1.5 → dangerous."""
        result = classify_runnability(4000.0, {"min": 600, "max": 2000})
        assert result == "dangerous"

    def test_none_flow_with_range(self):
        """None flow with per-river range should still return None."""
        result = classify_runnability(None, {"min": 600, "max": 2000})
        assert result is None

    def test_incomplete_flow_range_falls_back(self):
        """Missing max in flow_range should fall back to defaults."""
        result = classify_runnability(1000.0, {"min": 600})  # no max
        assert result == "runnable"  # default thresholds: 500-1500 = runnable


# ─── runnability_to_quality tests ──────────────────────────


class TestRunnabilityToQuality:
    def test_none_input(self):
        assert runnability_to_quality(None) is None

    def test_optimal_is_excellent(self):
        assert runnability_to_quality("optimal") == "excellent"

    def test_runnable_is_good(self):
        assert runnability_to_quality("runnable") == "good"

    def test_high_is_fair(self):
        assert runnability_to_quality("high") == "fair"

    def test_low_is_poor(self):
        assert runnability_to_quality("low") == "poor"

    def test_too_low_is_poor(self):
        assert runnability_to_quality("too_low") == "poor"

    def test_too_high_is_dangerous(self):
        assert runnability_to_quality("too_high") == "dangerous"

    def test_dangerous_is_dangerous(self):
        assert runnability_to_quality("dangerous") == "dangerous"

    def test_unknown_runnability(self):
        """Unknown runnability labels should return None."""
        assert runnability_to_quality("moderate") is None
        assert runnability_to_quality("") is None


# ─── Full pipeline classification ──────────────────────────


class TestClassificationPipeline:
    """End-to-end classification: flow → runnability → quality."""

    @pytest.mark.parametrize(
        "flow, expected_runnability, expected_quality",
        [
            (0, "too_low", "poor"),
            (100, "too_low", "poor"),
            (200, "low", "poor"),
            (500, "runnable", "good"),
            (1000, "runnable", "good"),
            (1500, "optimal", "excellent"),
            (3000, "optimal", "excellent"),
            (5000, "high", "fair"),
            (10000, "dangerous", "dangerous"),
            (50000, "dangerous", "dangerous"),
        ],
    )
    def test_flow_to_quality(self, flow, expected_runnability, expected_quality):
        runnability = classify_runnability(flow)
        quality = runnability_to_quality(runnability)
        assert runnability == expected_runnability
        assert quality == expected_quality


# ─── SOURCE_PRIORITY tests ─────────────────────────────────


class TestSourcePriority:
    def test_usgs_highest(self):
        assert SOURCE_PRIORITY["usgs"] > SOURCE_PRIORITY["aw"]

    def test_aw_above_crowd(self):
        assert SOURCE_PRIORITY["aw"] > SOURCE_PRIORITY["facebook"]

    def test_facebook_lowest(self):
        assert SOURCE_PRIORITY["facebook"] == min(SOURCE_PRIORITY.values())


# ─── ConditionProcessor tests ──────────────────────────────


class TestConditionProcessor:
    @patch("processors.condition_processor.SessionLocal")
    def test_process_with_matching_river(self, mock_session_cls):
        """Should create a RiverCondition when river is found in DB."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        river = make_mock_river(usgs_gauge_id="09380000")
        # _find_river query
        mock_session.query.return_value.filter.return_value.first.return_value = river
        # _merge_with_existing query
        mock_session.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
        # prev_condition query
        mock_session.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

        items = [make_usgs_scraped_item(gauge_id="09380000", flow_rate=2000.0)]
        processor = ConditionProcessor()
        result = processor.process(items, source="usgs")

        assert len(result) == 1
        assert result[0]["river_id"] == "river-1"

    @patch("processors.condition_processor.SessionLocal")
    def test_process_no_matching_river(self, mock_session_cls):
        """Should skip items when no matching river found."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.first.return_value = None

        items = [make_usgs_scraped_item(gauge_id="99999999")]
        processor = ConditionProcessor()
        result = processor.process(items, source="usgs")

        assert len(result) == 0

    @patch("processors.condition_processor.SessionLocal")
    def test_process_empty_items(self, mock_session_cls):
        """Should handle empty input gracefully."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        processor = ConditionProcessor()
        result = processor.process([], source="usgs")

        assert result == []

    @patch("processors.condition_processor.SessionLocal")
    def test_process_logs_scrape(self, mock_session_cls):
        """Should create a ScrapeLog record."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.first.return_value = None

        processor = ConditionProcessor()
        processor.process([], source="usgs")

        assert mock_session.add.called
        mock_session.commit.assert_called()
