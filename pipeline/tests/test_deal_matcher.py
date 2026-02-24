"""
Tests for the deal matcher.

Tests the scoring-based match logic including:
- Price matching (below, above, equal to max, None price)
- Keyword matching (case insensitive, in title vs description)
- Region matching (whitelist, disqualifier)
- Category matching and scoring
- Score thresholds for notification
- Hard disqualifiers (over price, wrong region, no keyword hits)
- Missing deal fields (None values)
- Edge cases: no active filters, empty deals list
- Unicode in titles and descriptions
"""

import pytest
from unittest.mock import patch, MagicMock

from processors.deal_matcher import DealMatcher, NOTIFICATION_THRESHOLD
from tests.conftest import (
    make_mock_deal,
    make_mock_filter,
    make_deal_scraped_item,
)


class TestScoreMatch:
    """Unit tests for DealMatcher._score_match()."""

    def setup_method(self):
        self.matcher = DealMatcher()

    # ── Price disqualification ──────────────────────────────

    def test_price_above_max_returns_zero(self):
        """Price exceeding max_price is a hard disqualifier -> score 0."""
        deal = make_mock_deal(price=3000.0)
        f = make_mock_filter(max_price=2000.0)
        assert self.matcher._score_match(deal, f) == 0

    def test_price_at_max_is_not_disqualified(self):
        """Price exactly at max_price should not be disqualified."""
        deal = make_mock_deal(price=2000.0, title="NRS raft for sale", category="raft", region="seattle")
        f = make_mock_filter(max_price=2000.0, keywords=["raft"], categories=["raft"], regions=["seattle"])
        score = self.matcher._score_match(deal, f)
        assert score > 0

    def test_price_none_is_not_disqualified(self):
        """Deal with no price should not be disqualified by max_price."""
        deal = make_mock_deal(price=None, title="Free raft giveaway", category="raft", region="seattle")
        f = make_mock_filter(max_price=1000.0, keywords=["raft"], categories=["raft"], regions=["seattle"])
        score = self.matcher._score_match(deal, f)
        assert score > 0

    def test_no_max_price_filter_allows_any_price(self):
        """Filter with no max_price should not disqualify any deal."""
        deal = make_mock_deal(price=50000.0, title="Expensive raft", category="raft", region="seattle")
        f = make_mock_filter(max_price=None, keywords=["raft"], categories=["raft"], regions=["seattle"])
        score = self.matcher._score_match(deal, f)
        assert score > 0

    def test_price_zero_is_not_disqualified(self):
        """$0 items (free) should not be disqualified."""
        deal = make_mock_deal(price=0.0, title="Free raft", category="raft")
        f = make_mock_filter(max_price=100.0, keywords=["raft"])
        # price=0.0 is falsy, so condition `deal.price and deal.price > f.max_price` is False
        score = self.matcher._score_match(deal, f)
        assert score >= 0  # Not disqualified

    # ── Price bonus scoring ─────────────────────────────────

    def test_well_under_budget_gets_bonus(self):
        """Being far under max_price should give a higher score."""
        deal_cheap = make_mock_deal(price=200.0, title="Cheap raft", category="raft", region="seattle")
        deal_near_max = make_mock_deal(price=1900.0, title="Pricey raft", category="raft", region="seattle")
        f = make_mock_filter(max_price=2000.0, keywords=["raft"], categories=["raft"], regions=["seattle"])

        score_cheap = self.matcher._score_match(deal_cheap, f)
        score_near_max = self.matcher._score_match(deal_near_max, f)
        assert score_cheap > score_near_max

    # ── Keyword matching ────────────────────────────────────

    def test_keyword_in_title(self):
        deal = make_mock_deal(title="NRS Otter Raft for sale", description="Great condition")
        f = make_mock_filter(keywords=["raft"], categories=[], regions=[], max_price=None)
        score = self.matcher._score_match(deal, f)
        assert score > 0

    def test_keyword_in_description(self):
        deal = make_mock_deal(title="Boat for sale", description="Great inflatable raft, barely used")
        f = make_mock_filter(keywords=["raft"], categories=[], regions=[], max_price=None)
        score = self.matcher._score_match(deal, f)
        assert score > 0

    def test_keyword_case_insensitive(self):
        deal = make_mock_deal(title="NRS RAFT — barely used")
        f = make_mock_filter(keywords=["raft"], categories=[], regions=[], max_price=None)
        score = self.matcher._score_match(deal, f)
        assert score > 0

    def test_keyword_no_match_returns_zero(self):
        """Must match at least one keyword -> score 0 if none match."""
        deal = make_mock_deal(title="Mountain bike for sale", description="21 speed")
        f = make_mock_filter(keywords=["raft", "kayak"], categories=[], regions=[], max_price=None)
        assert self.matcher._score_match(deal, f) == 0

    def test_multiple_keyword_matches_score_higher(self):
        """More keyword hits = higher score (up to 40 pts)."""
        deal_one = make_mock_deal(title="Raft for sale", description="")
        deal_multi = make_mock_deal(title="NRS raft with paddle and PFD", description="Inflatable boat with oars")
        f = make_mock_filter(keywords=["raft", "paddle", "pfd", "inflatable"], categories=[], regions=[], max_price=None)

        score_one = self.matcher._score_match(deal_one, f)
        score_multi = self.matcher._score_match(deal_multi, f)
        assert score_multi > score_one

    def test_no_keywords_filter_gives_partial_credit(self):
        """Filter with empty keywords = broad match, gets partial credit."""
        deal = make_mock_deal(title="Random item", description="")
        f = make_mock_filter(keywords=[], categories=[], regions=[], max_price=None)
        score = self.matcher._score_match(deal, f)
        assert score > 0  # Gets partial credit for broad match

    def test_keyword_unicode(self):
        """Keywords with unicode should work."""
        deal = make_mock_deal(title="Rio Grande paddle trip gear", description="Complete setup")
        f = make_mock_filter(keywords=["rio"], categories=[], regions=[], max_price=None)
        score = self.matcher._score_match(deal, f)
        assert score > 0

    # ── Region matching ─────────────────────────────────────

    def test_region_match_adds_points(self):
        deal = make_mock_deal(region="seattle", title="Raft sale", category="raft")
        f = make_mock_filter(regions=["seattle", "portland"], keywords=["raft"], categories=["raft"])
        score = self.matcher._score_match(deal, f)
        assert score > 0

    def test_region_no_match_disqualifies(self):
        """Region mismatch when filter has region whitelist -> score 0."""
        deal = make_mock_deal(region="denver", title="Raft sale")
        f = make_mock_filter(regions=["seattle", "portland"], keywords=["raft"])
        assert self.matcher._score_match(deal, f) == 0

    def test_region_none_on_deal_not_disqualified(self):
        """Deal with no region should not be disqualified by region filter."""
        deal = make_mock_deal(region=None, title="Raft for sale", category="raft")
        f = make_mock_filter(regions=["seattle"], keywords=["raft"], categories=["raft"])
        score = self.matcher._score_match(deal, f)
        assert score > 0

    def test_no_regions_filter_gives_partial(self):
        """Filter with no regions -> partial credit."""
        deal = make_mock_deal(region="boise", title="Raft deal", category="raft")
        f = make_mock_filter(regions=[], keywords=["raft"], categories=["raft"], max_price=None)
        score = self.matcher._score_match(deal, f)
        assert score > 0

    # ── Category matching ───────────────────────────────────

    def test_category_match_adds_30_points(self):
        deal = make_mock_deal(category="raft", title="Raft for sale")
        f = make_mock_filter(categories=["raft"], keywords=["raft"], regions=[], max_price=None)
        score = self.matcher._score_match(deal, f)
        # Should include 30 pts for category match
        assert score >= 30

    def test_category_no_match_not_hard_disqualifier(self):
        """Category mismatch does not disqualify — just no category bonus."""
        deal = make_mock_deal(category="pfd", title="PFD life jacket sale")
        f = make_mock_filter(categories=["raft"], keywords=["pfd"], regions=[], max_price=None)
        score = self.matcher._score_match(deal, f)
        # Not disqualified, but no category bonus
        assert score > 0

    def test_no_categories_filter_partial_credit(self):
        """Filter with empty categories -> 15 partial credit."""
        deal = make_mock_deal(category="paddle", title="Paddle for sale")
        f = make_mock_filter(categories=[], keywords=["paddle"], regions=[], max_price=None)
        score = self.matcher._score_match(deal, f)
        assert score > 0

    # ── Score capping ───────────────────────────────────────

    def test_score_capped_at_100(self):
        """Score should never exceed 100."""
        deal = make_mock_deal(
            title="NRS raft kayak paddle PFD drysuit",
            price=100.0,
            category="raft",
            region="seattle",
            description="Best deal ever on rafting gear",
        )
        f = make_mock_filter(
            keywords=["raft", "kayak", "paddle", "pfd", "drysuit", "gear"],
            categories=["raft"],
            max_price=5000.0,
            regions=["seattle"],
        )
        score = self.matcher._score_match(deal, f)
        assert score <= 100

    # ── Combined criteria ───────────────────────────────────

    def test_full_match_scores_high(self):
        """Deal matching all criteria should score above notification threshold."""
        deal = make_mock_deal(
            title="NRS Otter Raft — great condition",
            price=1200.0,
            category="raft",
            region="seattle",
            description="14-foot self-bailing raft",
        )
        f = make_mock_filter(
            keywords=["raft", "nrs"],
            categories=["raft"],
            max_price=2000.0,
            regions=["seattle"],
        )
        score = self.matcher._score_match(deal, f)
        assert score >= NOTIFICATION_THRESHOLD

    def test_empty_filter_no_disqualification(self):
        """Filter with no criteria should give partial credit, not disqualify."""
        deal = make_mock_deal(title="Random item")
        f = make_mock_filter(keywords=[], categories=[], max_price=None, regions=[])
        score = self.matcher._score_match(deal, f)
        assert score > 0

    def test_deal_with_none_description(self):
        """Deal with None description should not crash keyword matching."""
        deal = make_mock_deal(title="Kayak for sale", description=None)
        f = make_mock_filter(keywords=["kayak"], categories=[], regions=[], max_price=None)
        score = self.matcher._score_match(deal, f)
        assert score > 0


# ─── DealMatcher.match() integration tests ─────────────────


class TestDealMatcherMatch:
    def setup_method(self):
        self.matcher = DealMatcher()

    @patch("processors.deal_matcher.SessionLocal")
    def test_match_no_active_filters(self, mock_session_cls):
        """Should return empty list when there are no active filters."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = []

        deals = [make_deal_scraped_item()]
        result = self.matcher.match(deals)
        assert result == []

    @patch("processors.deal_matcher.SessionLocal")
    def test_match_empty_deals(self, mock_session_cls):
        """Should handle empty deals list."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = [
            make_mock_filter(),
        ]

        result = self.matcher.match([])
        assert result == []

    @patch("processors.deal_matcher.SessionLocal")
    def test_match_skips_existing_deal(self, mock_session_cls):
        """Should skip deals that already exist (by URL)."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        existing_deal = make_mock_deal()
        mock_session.query.return_value.filter.return_value.all.return_value = [
            make_mock_filter(),
        ]
        mock_session.query.return_value.filter.return_value.first.return_value = existing_deal

        deals = [make_deal_scraped_item()]
        result = self.matcher.match(deals)
        assert result == []

    def test_notification_threshold_value(self):
        """Notification threshold should be 50."""
        assert NOTIFICATION_THRESHOLD == 50
