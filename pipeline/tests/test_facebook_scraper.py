"""
Tests for the Facebook scraper.

Mocks HTTP responses with respx and verifies:
- Initialization and base properties
- Post parsing from Graph API and public HTML
- Condition classification from post text
- Flow rate / gauge height / water temp extraction
- River mention detection with word boundaries
- Timestamp parsing (ISO 8601 + relative time strings)
- Rate limiting and usage header handling
- Error handling (timeouts, HTTP errors, auth failures)
- scrape() integration: Graph API path and public path
"""

import httpx
import respx
import pytest
import time
import json
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock, PropertyMock

from scrapers.facebook import (
    FacebookScraper,
    FLOW_RATE_PATTERNS,
    GAUGE_HEIGHT_PATTERNS,
    WATER_TEMP_PATTERNS,
    CONDITION_KEYWORDS,
    RELATIVE_TIME_PATTERNS,
    DEFAULT_PAGES,
)
from scrapers.base import BaseScraper, ScrapedItem
from config.settings import settings


# ─── Dynamic timestamp helpers ──────────────────────────────

def _recent_ts(hours_ago: int = 1) -> str:
    """Return an ISO 8601 timestamp `hours_ago` hours in the past (always inside the 48-h window)."""
    return (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%S+0000")


def _old_ts() -> str:
    """Return a timestamp well outside the 48-h scrape window."""
    return (datetime.now(timezone.utc) - timedelta(days=60)).strftime("%Y-%m-%dT%H:%M:%S+0000")


# ─── Sample Graph API responses ─────────────────────────────

def _make_graph_response():
    return {
        "data": [
            {
                "id": "post-1",
                "message": "Great day on the Colorado River! Flow was about 12,000 cfs. Conditions are excellent.",
                "created_time": _recent_ts(2),
                "from": {"name": "River Runner Joe", "id": "user-1"},
                "full_picture": "https://example.com/photo1.jpg",
                "permalink_url": "https://www.facebook.com/page/posts/post-1",
            },
            {
                "id": "post-2",
                "message": "Salmon River is running low, very bony. Gauge at 3.5 ft stage. Water temp: 55\u00b0F",
                "created_time": _recent_ts(4),
                "from": {"name": "Kayaker Kate", "id": "user-2"},
                "permalink_url": "https://www.facebook.com/page/posts/post-2",
            },
            {
                "id": "post-3",
                "message": "Just had lunch at the taco stand. No rivers involved.",
                "created_time": _recent_ts(6),
                "from": {"name": "Random Person", "id": "user-3"},
            },
        ]
    }


# Lazy-evaluated module-level reference (regenerated each test run)
SAMPLE_GRAPH_RESPONSE = _make_graph_response()

SAMPLE_GRAPH_EMPTY = {"data": []}

SAMPLE_GRAPH_NO_MESSAGE = {
    "data": [
        {
            "id": "post-no-msg",
            "created_time": _recent_ts(1),
            "from": {"name": "Silent Bob"},
            "full_picture": "https://example.com/photo-only.jpg",
        },
    ]
}

SAMPLE_GRAPH_OLD_POST = {
    "data": [
        {
            "id": "old-post",
            "message": "Colorado River trip from last month was amazing!",
            "created_time": _old_ts(),
            "from": {"name": "Old Timer"},
        },
    ]
}


# ─── Sample HTML pages ──────────────────────────────────────

SAMPLE_HTML_PAGE = """
<html>
<body>
<div data-ft='{"tn":"K"}'>
    <h3><strong>River Runners Club</strong></h3>
    <div class="story_body">
        <p>Amazing day on the Green River! Flow: 5000 cfs conditions are good.</p>
    </div>
    <img src="https://example.com/river-photo.jpg" />
    <a href="https://riverreport.com/green">Check report</a>
</div>
<div data-ft='{"tn":"K"}'>
    <h3><strong>Paddler Page</strong></h3>
    <div class="userContent">
        <p>#ColoradoRiver was perfect today. Gauge height 6.2 ft gauge reading.</p>
    </div>
</div>
<div data-ft='{"tn":"K"}'>
    <div class="story_body"></div>
</div>
</body>
</html>
"""

SAMPLE_HTML_EMPTY = "<html><body></body></html>"


# ─── Mock rivers ────────────────────────────────────────────

MOCK_RIVERS = [
    {"id": "river-1", "name": "Colorado River", "state": "CO", "region": "West"},
    {"id": "river-2", "name": "Salmon River", "state": "ID", "region": "Northwest"},
    {"id": "river-3", "name": "Green River", "state": "UT", "region": "West"},
]


def _make_mock_river(r: dict) -> MagicMock:
    """Create a mock SQLAlchemy River object from a dict."""
    mock = MagicMock()
    mock.id = r["id"]
    mock.name = r["name"]
    mock.state = r["state"]
    mock.region = r["region"]
    return mock


# ─── Init & Properties ──────────────────────────────────────

class TestFacebookScraperInit:
    """Tests for Facebook scraper initialization."""

    def test_scraper_name_is_facebook(self):
        scraper = FacebookScraper()
        assert scraper.name == "facebook"

    def test_inherits_base_scraper(self):
        assert issubclass(FacebookScraper, BaseScraper)

    def test_has_http_client(self):
        scraper = FacebookScraper()
        assert isinstance(scraper._client, httpx.Client)

    def test_rate_limit_delay_from_settings(self):
        scraper = FacebookScraper()
        assert scraper._rate_limit_delay == settings.rate_limit_delay

    def test_client_has_mobile_user_agent(self):
        scraper = FacebookScraper()
        ua = scraper._client.headers.get("User-Agent", "")
        assert "Mobile" in ua

    def test_client_follows_redirects(self):
        scraper = FacebookScraper()
        assert scraper._client.follow_redirects is True

    def test_scrape_window_is_48_hours(self):
        scraper = FacebookScraper()
        assert scraper._scrape_window_hours == 48

    def test_reads_access_token_from_settings(self):
        scraper = FacebookScraper()
        assert scraper._access_token == settings.facebook_access_token

    def test_river_cache_starts_none(self):
        scraper = FacebookScraper()
        assert scraper._river_cache is None


# ─── Condition Classification ────────────────────────────────

class TestFacebookConditionClassification:
    """Tests for _classify_condition text parsing."""

    def setup_method(self):
        self.scraper = FacebookScraper()

    # ── Flow rate extraction ──

    def test_extracts_cfs_flow_rate(self):
        result = self.scraper._classify_condition("River is at 12,000 cfs today.")
        assert result["flow_rate"] == 12000.0

    def test_extracts_cubic_feet_flow_rate(self):
        result = self.scraper._classify_condition("Running about 850 cubic feet per second.")
        assert result["flow_rate"] == 850.0

    def test_extracts_ft3s_flow_rate(self):
        result = self.scraper._classify_condition("Measured 3200 ft\u00b3/s at the bridge.")
        assert result["flow_rate"] == 3200.0

    def test_extracts_flow_colon_format(self):
        result = self.scraper._classify_condition("Flow: 1500 at the put-in.")
        assert result["flow_rate"] == 1500.0

    def test_no_flow_rate(self):
        result = self.scraper._classify_condition("Beautiful day on the river.")
        assert "flow_rate" not in result

    # ── Gauge height extraction ──

    def test_extracts_gauge_height_feet(self):
        result = self.scraper._classify_condition("Gauge reading at 6.5 feet gauge.")
        assert result["gauge_height"] == 6.5

    def test_extracts_gage_stage_format(self):
        result = self.scraper._classify_condition("Stage: 4.2 ft")
        assert result["gauge_height"] == 4.2

    def test_no_gauge_height(self):
        result = self.scraper._classify_condition("The water was cold today.")
        assert "gauge_height" not in result

    # ── Water temp extraction ──

    def test_extracts_water_temp_f(self):
        result = self.scraper._classify_condition("Water temp: 55\u00b0F at the put-in.")
        assert result["water_temp"] == 55.0

    def test_extracts_water_temp_reverse_format(self):
        result = self.scraper._classify_condition("It was 62\u00b0F water today.")
        assert result["water_temp"] == 62.0

    def test_no_water_temp(self):
        result = self.scraper._classify_condition("Great flow for kayaking.")
        assert "water_temp" not in result

    # ── Quality classification ──

    def test_quality_excellent(self):
        result = self.scraper._classify_condition("Conditions are excellent right now!")
        assert result["quality"] == "excellent"

    def test_quality_good(self):
        result = self.scraper._classify_condition("Had a great time on the river.")
        assert result["quality"] == "good"

    def test_quality_fair(self):
        result = self.scraper._classify_condition("River was okay today, moderate flow.")
        assert result["quality"] == "fair"

    def test_quality_poor(self):
        result = self.scraper._classify_condition("Very low water, bony and scrapy.")
        assert result["quality"] == "poor"

    def test_quality_dangerous(self):
        result = self.scraper._classify_condition("FLOOD WARNING: Extremely dangerous conditions!")
        assert result["quality"] == "dangerous"

    def test_no_quality_keywords(self):
        result = self.scraper._classify_condition("Did some paddling upstream of the bridge.")
        assert "quality" not in result

    def test_first_quality_wins(self):
        """If multiple quality keywords present, first category in dict order wins."""
        result = self.scraper._classify_condition("Excellent conditions but a bit dangerous near the dam.")
        assert result["quality"] == "excellent"

    # ── Combined extraction ──

    def test_extracts_all_fields(self):
        text = "Colorado River at 12000 cfs, gauge: 6.5 ft, water temp: 55\u00b0F. Conditions excellent!"
        result = self.scraper._classify_condition(text)
        assert result["flow_rate"] == 12000.0
        assert result["gauge_height"] == 6.5
        assert result["water_temp"] == 55.0
        assert result["quality"] == "excellent"

    def test_empty_text_returns_empty_dict(self):
        result = self.scraper._classify_condition("")
        assert result == {}


# ─── Timestamp Parsing ───────────────────────────────────────

class TestFacebookTimestampParsing:
    """Tests for _parse_timestamp."""

    def setup_method(self):
        self.scraper = FacebookScraper()

    def test_parses_iso_8601_utc(self):
        dt = self.scraper._parse_timestamp("2026-02-24T10:00:00+0000")
        assert dt is not None
        assert dt.year == 2026 and dt.month == 2 and dt.day == 24

    def test_parses_iso_8601_z(self):
        dt = self.scraper._parse_timestamp("2026-02-24T10:00:00Z")
        assert dt is not None
        assert dt.tzinfo is not None

    def test_converts_to_utc(self):
        dt = self.scraper._parse_timestamp("2026-02-24T10:00:00-05:00")
        assert dt is not None
        assert dt.tzinfo == timezone.utc
        assert dt.hour == 15  # 10 AM EST = 3 PM UTC

    def test_naive_datetime_gets_utc(self):
        dt = self.scraper._parse_timestamp("2026-02-24T10:00:00")
        assert dt is not None
        assert dt.tzinfo == timezone.utc

    def test_relative_minutes_ago(self):
        dt = self.scraper._parse_timestamp("30 minutes ago")
        assert dt is not None
        expected = datetime.now(timezone.utc) - timedelta(minutes=30)
        assert abs((dt - expected).total_seconds()) < 5

    def test_relative_hours_ago(self):
        dt = self.scraper._parse_timestamp("2 hours ago")
        assert dt is not None
        expected = datetime.now(timezone.utc) - timedelta(hours=2)
        assert abs((dt - expected).total_seconds()) < 5

    def test_relative_days_ago(self):
        dt = self.scraper._parse_timestamp("3 days ago")
        assert dt is not None
        expected = datetime.now(timezone.utc) - timedelta(days=3)
        assert abs((dt - expected).total_seconds()) < 5

    def test_yesterday(self):
        dt = self.scraper._parse_timestamp("yesterday")
        assert dt is not None
        expected = datetime.now(timezone.utc) - timedelta(days=1)
        assert abs((dt - expected).total_seconds()) < 5

    def test_none_input(self):
        assert self.scraper._parse_timestamp(None) is None

    def test_empty_string(self):
        assert self.scraper._parse_timestamp("") is None

    def test_unparseable_string(self):
        assert self.scraper._parse_timestamp("not a date") is None

    def test_result_has_utc_timezone(self):
        dt = self.scraper._parse_timestamp("2026-02-24T10:00:00+0000")
        assert dt.tzinfo is not None


# ─── River Mention Detection ────────────────────────────────

class TestFacebookRiverMentionDetection:
    """Tests for _extract_river_mentions."""

    def setup_method(self):
        self.scraper = FacebookScraper()
        self.scraper._river_cache = MOCK_RIVERS

    def test_detects_exact_river_name(self):
        items = self.scraper._extract_river_mentions(
            text="Colorado River is running high.",
            author="Test User",
            source_url="https://fb.com/post/1",
            images=[], links=[], timestamp=None,
        )
        assert len(items) == 1
        assert items[0].data["river_name"] == "Colorado River"

    def test_detects_case_insensitive(self):
        items = self.scraper._extract_river_mentions(
            text="The colorado river was amazing.",
            author="Test User",
            source_url="https://fb.com/post/2",
            images=[], links=[], timestamp=None,
        )
        assert len(items) == 1
        assert items[0].data["river_name"] == "Colorado River"

    def test_detects_multiple_rivers(self):
        items = self.scraper._extract_river_mentions(
            text="Went from the Colorado River to the Salmon River this weekend.",
            author="Test User",
            source_url="https://fb.com/post/3",
            images=[], links=[], timestamp=None,
        )
        assert len(items) == 2
        river_names = {i.data["river_name"] for i in items}
        assert river_names == {"Colorado River", "Salmon River"}

    def test_no_false_positive_partial_match(self):
        """'Green Bay' should not match 'Green River' since word boundary check."""
        items = self.scraper._extract_river_mentions(
            text="I went to Green Bay for the game.",
            author="Test", source_url="https://fb.com/x",
            images=[], links=[], timestamp=None,
        )
        assert len(items) == 0

    def test_detects_hashtag_river_mentions(self):
        items = self.scraper._extract_river_mentions(
            text="Best day ever! #ColoradoRiver was running perfectly.",
            author="Test", source_url="https://fb.com/x",
            images=[], links=[], timestamp=None,
        )
        assert len(items) == 1
        assert items[0].data["river_name"] == "Colorado River"

    def test_no_matches_returns_empty(self):
        items = self.scraper._extract_river_mentions(
            text="Just a normal post about food.",
            author="Test", source_url="https://fb.com/x",
            images=[], links=[], timestamp=None,
        )
        assert len(items) == 0

    def test_no_duplicate_river_ids(self):
        """Same river mentioned twice should produce only one item."""
        items = self.scraper._extract_river_mentions(
            text="Colorado River in the morning, Colorado River in the evening.",
            author="Test", source_url="https://fb.com/x",
            images=[], links=[], timestamp=None,
        )
        assert len(items) == 1

    def test_item_has_correct_source(self):
        items = self.scraper._extract_river_mentions(
            text="Colorado River trip!",
            author="Author", source_url="https://fb.com/post/1",
            images=["img1.jpg"], links=["http://link.com"], timestamp=None,
        )
        assert items[0].source == "facebook"

    def test_item_has_source_url(self):
        items = self.scraper._extract_river_mentions(
            text="Colorado River trip!",
            author="Author", source_url="https://fb.com/post/1",
            images=[], links=[], timestamp=None,
        )
        assert items[0].source_url == "https://fb.com/post/1"

    def test_item_includes_condition_data(self):
        items = self.scraper._extract_river_mentions(
            text="Colorado River at 12000 cfs, conditions excellent!",
            author="Author", source_url="https://fb.com/x",
            images=[], links=[], timestamp=None,
        )
        assert items[0].data["flow_rate"] == 12000.0
        assert items[0].data["quality"] == "excellent"

    def test_post_text_truncated_at_1000(self):
        long_text = "Colorado River " + "x" * 2000
        items = self.scraper._extract_river_mentions(
            text=long_text,
            author="Author", source_url="https://fb.com/x",
            images=[], links=[], timestamp=None,
        )
        assert len(items[0].data["post_text"]) == 1000

    def test_images_limited_to_5(self):
        images = [f"https://example.com/img{i}.jpg" for i in range(10)]
        items = self.scraper._extract_river_mentions(
            text="Colorado River trip!",
            author="Author", source_url="https://fb.com/x",
            images=images, links=[], timestamp=None,
        )
        assert len(items[0].data["images"]) == 5

    def test_links_limited_to_5(self):
        links = [f"https://example.com/link{i}" for i in range(10)]
        items = self.scraper._extract_river_mentions(
            text="Colorado River trip!",
            author="Author", source_url="https://fb.com/x",
            images=[], links=links, timestamp=None,
        )
        assert len(items[0].data["links"]) == 5

    def test_empty_rivers_cache_returns_empty(self):
        self.scraper._river_cache = []
        items = self.scraper._extract_river_mentions(
            text="Colorado River trip!",
            author="Author", source_url="https://fb.com/x",
            images=[], links=[], timestamp=None,
        )
        assert len(items) == 0

    def test_timestamp_used_as_scraped_at(self):
        ts = datetime(2026, 2, 24, 10, 0, tzinfo=timezone.utc)
        items = self.scraper._extract_river_mentions(
            text="Colorado River trip!",
            author="Author", source_url="https://fb.com/x",
            images=[], links=[], timestamp=ts,
        )
        assert items[0].scraped_at == ts

    def test_none_timestamp_uses_now(self):
        items = self.scraper._extract_river_mentions(
            text="Colorado River trip!",
            author="Author", source_url="https://fb.com/x",
            images=[], links=[], timestamp=None,
        )
        # Should be close to now
        delta = abs((items[0].scraped_at - datetime.now(timezone.utc)).total_seconds())
        assert delta < 5


# ─── Post Parsing (Graph API) ───────────────────────────────

class TestFacebookPostParsing:
    """Tests for _parse_posts from Graph API responses."""

    def setup_method(self):
        self.scraper = FacebookScraper()
        self.scraper._river_cache = MOCK_RIVERS

    def test_parses_posts_with_river_mentions(self):
        items = self.scraper._parse_posts(SAMPLE_GRAPH_RESPONSE["data"], "testpage")
        # Post 1 mentions Colorado River, Post 2 mentions Salmon River, Post 3 no river
        assert len(items) == 2

    def test_skips_posts_without_message(self):
        items = self.scraper._parse_posts(SAMPLE_GRAPH_NO_MESSAGE["data"], "testpage")
        assert len(items) == 0

    def test_skips_old_posts(self):
        items = self.scraper._parse_posts(SAMPLE_GRAPH_OLD_POST["data"], "testpage")
        assert len(items) == 0

    def test_extracts_author_name(self):
        items = self.scraper._parse_posts(SAMPLE_GRAPH_RESPONSE["data"], "testpage")
        colorado_item = [i for i in items if i.data["river_name"] == "Colorado River"][0]
        assert colorado_item.data["author"] == "River Runner Joe"

    def test_extracts_image(self):
        items = self.scraper._parse_posts(SAMPLE_GRAPH_RESPONSE["data"], "testpage")
        colorado_item = [i for i in items if i.data["river_name"] == "Colorado River"][0]
        assert "https://example.com/photo1.jpg" in colorado_item.data["images"]

    def test_uses_permalink_url(self):
        items = self.scraper._parse_posts(SAMPLE_GRAPH_RESPONSE["data"], "testpage")
        colorado_item = [i for i in items if i.data["river_name"] == "Colorado River"][0]
        assert colorado_item.source_url == "https://www.facebook.com/page/posts/post-1"

    def test_fallback_source_url_to_page(self):
        posts = [{"id": "x", "message": "Colorado River rocks!", "from": {}}]
        items = self.scraper._parse_posts(posts, "mypage")
        assert items[0].source_url == "https://www.facebook.com/mypage"

    def test_from_as_non_dict(self):
        """Handles 'from' field that is not a dict."""
        posts = [{"id": "x", "message": "Colorado River trip", "from": "string-val", "created_time": _recent_ts(1)}]
        items = self.scraper._parse_posts(posts, "page")
        assert len(items) == 1
        assert items[0].data["author"] == ""

    def test_empty_posts_list(self):
        items = self.scraper._parse_posts([], "testpage")
        assert items == []

    def test_handles_post_parsing_exception(self):
        """A post that causes an error should be skipped, not crash the whole batch."""
        posts = [
            None,  # This will cause an exception
            {"id": "good", "message": "Colorado River today!", "from": {}, "created_time": _recent_ts(1)},
        ]
        items = self.scraper._parse_posts(posts, "page")
        # The None should be skipped, the good post parsed
        assert len(items) == 1


# ─── Graph API Fetching ─────────────────────────────────────

class TestFacebookGraphAPIFetching:
    """Tests for _fetch_page_posts_api."""

    def setup_method(self):
        self.scraper = FacebookScraper()
        self.scraper._access_token = "test-token"
        self.scraper._river_cache = MOCK_RIVERS

    @respx.mock
    def test_fetches_posts_successfully(self):
        respx.get("https://graph.facebook.com/v19.0/testpage/posts").mock(
            return_value=httpx.Response(200, json=SAMPLE_GRAPH_RESPONSE)
        )
        items = self.scraper._fetch_page_posts_api("testpage")
        assert len(items) == 2

    @respx.mock
    def test_includes_access_token_in_params(self):
        route = respx.get("https://graph.facebook.com/v19.0/testpage/posts").mock(
            return_value=httpx.Response(200, json=SAMPLE_GRAPH_EMPTY)
        )
        self.scraper._fetch_page_posts_api("testpage")
        assert route.called
        request = route.calls[0].request
        assert "access_token=test-token" in str(request.url)

    @respx.mock
    def test_handles_401_expired_token(self):
        respx.get("https://graph.facebook.com/v19.0/testpage/posts").mock(
            return_value=httpx.Response(401, json={"error": {"message": "Expired token"}})
        )
        items = self.scraper._fetch_page_posts_api("testpage")
        assert items == []

    @respx.mock
    def test_handles_403_invalid_token(self):
        respx.get("https://graph.facebook.com/v19.0/testpage/posts").mock(
            return_value=httpx.Response(403, json={"error": {"message": "Invalid token"}})
        )
        items = self.scraper._fetch_page_posts_api("testpage")
        assert items == []

    @respx.mock
    @patch("scrapers.facebook.time.sleep")
    def test_handles_429_rate_limit(self, mock_sleep):
        respx.get("https://graph.facebook.com/v19.0/testpage/posts").mock(
            return_value=httpx.Response(429, headers={"Retry-After": "30"})
        )
        items = self.scraper._fetch_page_posts_api("testpage")
        assert items == []
        mock_sleep.assert_called()

    @respx.mock
    def test_handles_timeout(self):
        respx.get("https://graph.facebook.com/v19.0/testpage/posts").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        items = self.scraper._fetch_page_posts_api("testpage")
        assert items == []

    @respx.mock
    def test_handles_http_error(self):
        respx.get("https://graph.facebook.com/v19.0/testpage/posts").mock(
            return_value=httpx.Response(500)
        )
        items = self.scraper._fetch_page_posts_api("testpage")
        assert items == []

    @respx.mock
    def test_handles_unexpected_exception(self):
        respx.get("https://graph.facebook.com/v19.0/testpage/posts").mock(
            side_effect=RuntimeError("something broke")
        )
        items = self.scraper._fetch_page_posts_api("testpage")
        assert items == []


# ─── Public Page Scraping ────────────────────────────────────

class TestFacebookPublicPageScraping:
    """Tests for _fetch_page_public and _extract_posts_from_html."""

    def setup_method(self):
        self.scraper = FacebookScraper()
        self.scraper._river_cache = MOCK_RIVERS

    @respx.mock
    def test_fetches_mobile_page(self):
        respx.get("https://m.facebook.com/testpage").mock(
            return_value=httpx.Response(200, text=SAMPLE_HTML_PAGE)
        )
        items = self.scraper._fetch_page_public("testpage")
        # Should find Green River and/or Colorado River mentions
        assert len(items) >= 1

    @respx.mock
    def test_handles_404_page_not_found(self):
        respx.get("https://m.facebook.com/testpage").mock(
            return_value=httpx.Response(404)
        )
        items = self.scraper._fetch_page_public("testpage")
        assert items == []

    @respx.mock
    def test_handles_timeout(self):
        respx.get("https://m.facebook.com/testpage").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        items = self.scraper._fetch_page_public("testpage")
        assert items == []

    @respx.mock
    def test_handles_http_error(self):
        respx.get("https://m.facebook.com/testpage").mock(
            return_value=httpx.Response(503)
        )
        items = self.scraper._fetch_page_public("testpage")
        assert items == []

    @respx.mock
    def test_empty_page_returns_empty(self):
        respx.get("https://m.facebook.com/testpage").mock(
            return_value=httpx.Response(200, text=SAMPLE_HTML_EMPTY)
        )
        items = self.scraper._fetch_page_public("testpage")
        assert items == []

    def test_extract_posts_ignores_empty_text(self):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(SAMPLE_HTML_PAGE, "html.parser")
        items = self.scraper._extract_posts_from_html(soup, "testpage")
        # All items should have non-empty text
        for item in items:
            assert item.data["post_text"]

    def test_extract_posts_gets_author(self):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(SAMPLE_HTML_PAGE, "html.parser")
        items = self.scraper._extract_posts_from_html(soup, "testpage")
        if items:
            # Author should be a non-empty string
            assert items[0].data["author"]

    def test_extract_posts_filters_emoji_images(self):
        """Images with 'emoji' or 'static' in URL should be excluded."""
        html = """<div data-ft="true"><p>Colorado River is great!</p>
        <img src="https://fb.com/emoji/1.png" /><img src="https://example.com/real.jpg" /></div>"""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        items = self.scraper._extract_posts_from_html(soup, "page")
        if items:
            for img in items[0].data["images"]:
                assert "emoji" not in img


# ─── Rate Limiting ───────────────────────────────────────────

class TestFacebookRateLimiting:
    """Tests for rate limiting and usage header handling."""

    def setup_method(self):
        self.scraper = FacebookScraper()

    @patch("scrapers.facebook.time.sleep")
    def test_handle_rate_limit_with_retry_after(self, mock_sleep):
        response = httpx.Response(429, headers={"Retry-After": "60"})
        self.scraper._handle_rate_limit(response)
        mock_sleep.assert_called_once_with(60)

    @patch("scrapers.facebook.time.sleep")
    def test_handle_rate_limit_caps_at_300(self, mock_sleep):
        response = httpx.Response(429, headers={"Retry-After": "600"})
        self.scraper._handle_rate_limit(response)
        mock_sleep.assert_called_once_with(300)

    @patch("scrapers.facebook.time.sleep")
    def test_handle_rate_limit_no_retry_after_header(self, mock_sleep):
        response = httpx.Response(429)
        self.scraper._handle_rate_limit(response)
        mock_sleep.assert_called_once_with(60)

    @patch("scrapers.facebook.time.sleep")
    def test_handle_rate_limit_invalid_retry_after(self, mock_sleep):
        response = httpx.Response(429, headers={"Retry-After": "not-a-number"})
        self.scraper._handle_rate_limit(response)
        mock_sleep.assert_called_once_with(60)

    @patch("scrapers.facebook.time.sleep")
    def test_check_usage_high_call_count(self, mock_sleep):
        """Should triple delay when usage > 75%."""
        usage = json.dumps({"call_count": 80})
        response = httpx.Response(200, headers={"X-App-Usage": usage})
        self.scraper._check_usage_headers(response)
        mock_sleep.assert_called_once_with(self.scraper._rate_limit_delay * 3)

    @patch("scrapers.facebook.time.sleep")
    def test_check_usage_medium_call_count(self, mock_sleep):
        """Should double delay when usage > 50%."""
        usage = json.dumps({"call_count": 55})
        response = httpx.Response(200, headers={"X-App-Usage": usage})
        self.scraper._check_usage_headers(response)
        mock_sleep.assert_called_once_with(self.scraper._rate_limit_delay * 2)

    @patch("scrapers.facebook.time.sleep")
    def test_check_usage_low_call_count(self, mock_sleep):
        """No extra delay when usage < 50%."""
        usage = json.dumps({"call_count": 30})
        response = httpx.Response(200, headers={"X-App-Usage": usage})
        self.scraper._check_usage_headers(response)
        mock_sleep.assert_not_called()

    @patch("scrapers.facebook.time.sleep")
    def test_check_usage_no_header(self, mock_sleep):
        response = httpx.Response(200)
        self.scraper._check_usage_headers(response)
        mock_sleep.assert_not_called()

    @patch("scrapers.facebook.time.sleep")
    def test_check_usage_business_header(self, mock_sleep):
        """Should also read X-Business-Use-Case-Usage header."""
        usage = json.dumps({"call_count": 90})
        response = httpx.Response(200, headers={"X-Business-Use-Case-Usage": usage})
        self.scraper._check_usage_headers(response)
        mock_sleep.assert_called_once()

    @patch("scrapers.facebook.time.sleep")
    def test_check_usage_invalid_json(self, mock_sleep):
        """Should not crash on invalid JSON in usage header."""
        response = httpx.Response(200, headers={"X-App-Usage": "not-json"})
        self.scraper._check_usage_headers(response)
        mock_sleep.assert_not_called()


# ─── Error Handling ──────────────────────────────────────────

class TestFacebookErrorHandling:
    """Tests for Facebook scraper error handling."""

    def setup_method(self):
        self.scraper = FacebookScraper()

    @respx.mock
    @patch("scrapers.facebook.time.sleep")
    def test_scrape_returns_empty_on_total_failure(self, mock_sleep):
        """scrape() should return [] not raise on total failure."""
        self.scraper._access_token = ""
        for page in DEFAULT_PAGES:
            respx.get(f"https://m.facebook.com/{page}").mock(
                side_effect=httpx.TimeoutException("timeout")
            )
        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.facebook.time.sleep")
    def test_continues_on_single_page_failure(self, mock_sleep):
        """If one page fails, should continue to next."""
        self.scraper._access_token = "token"
        self.scraper._river_cache = MOCK_RIVERS

        # First page fails, second succeeds
        respx.get(f"https://graph.facebook.com/v19.0/{DEFAULT_PAGES[0]}/posts").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        respx.get(f"https://graph.facebook.com/v19.0/{DEFAULT_PAGES[1]}/posts").mock(
            return_value=httpx.Response(200, json=SAMPLE_GRAPH_EMPTY)
        )
        items = self.scraper.scrape()
        assert isinstance(items, list)

    def test_scrape_catches_exception(self):
        """Top-level exception in scrape() should be caught."""
        with patch.object(self.scraper, "_scrape_graph_api", side_effect=RuntimeError("boom")):
            self.scraper._access_token = "token"
            items = self.scraper.scrape()
            assert items == []

    def test_scrape_resets_river_cache(self):
        """River cache should be reset after scrape."""
        self.scraper._river_cache = MOCK_RIVERS
        self.scraper._access_token = ""
        with patch.object(self.scraper, "_scrape_public_pages", return_value=[]):
            self.scraper.scrape()
        assert self.scraper._river_cache is None


# ─── Tracked Rivers ─────────────────────────────────────────

class TestFacebookTrackedRivers:
    """Tests for _get_tracked_rivers database access."""

    def setup_method(self):
        self.scraper = FacebookScraper()

    @patch("scrapers.facebook.SessionLocal")
    def test_queries_database_for_rivers(self, mock_session_cls):
        session = MagicMock()
        mock_session_cls.return_value = session
        mock_rivers = [_make_mock_river(r) for r in MOCK_RIVERS]
        session.query.return_value.all.return_value = mock_rivers

        result = self.scraper._get_tracked_rivers()
        assert len(result) == 3
        assert result[0]["name"] == "Colorado River"
        session.close.assert_called_once()

    @patch("scrapers.facebook.SessionLocal")
    def test_caches_rivers(self, mock_session_cls):
        """Should not query DB on second call."""
        session = MagicMock()
        mock_session_cls.return_value = session
        mock_rivers = [_make_mock_river(r) for r in MOCK_RIVERS]
        session.query.return_value.all.return_value = mock_rivers

        self.scraper._get_tracked_rivers()
        self.scraper._get_tracked_rivers()
        # Only one query
        assert mock_session_cls.call_count == 1

    @patch("scrapers.facebook.SessionLocal")
    def test_empty_db_returns_empty(self, mock_session_cls):
        session = MagicMock()
        mock_session_cls.return_value = session
        session.query.return_value.all.return_value = []

        result = self.scraper._get_tracked_rivers()
        assert result == []

    def test_returns_cached_if_set(self):
        self.scraper._river_cache = MOCK_RIVERS
        result = self.scraper._get_tracked_rivers()
        assert result == MOCK_RIVERS


# ─── Integration: scrape() ───────────────────────────────────

class TestFacebookScrapeIntegration:
    """Integration tests for the full scrape() method."""

    def setup_method(self):
        self.scraper = FacebookScraper()

    @respx.mock
    @patch("scrapers.facebook.time.sleep")
    @patch("scrapers.facebook.SessionLocal")
    def test_scrape_with_token_uses_graph_api(self, mock_session_cls, mock_sleep):
        self.scraper._access_token = "valid-token"
        session = MagicMock()
        mock_session_cls.return_value = session
        mock_rivers = [_make_mock_river(r) for r in MOCK_RIVERS]
        session.query.return_value.all.return_value = mock_rivers

        for page in DEFAULT_PAGES:
            respx.get(f"https://graph.facebook.com/v19.0/{page}/posts").mock(
                return_value=httpx.Response(200, json=SAMPLE_GRAPH_RESPONSE)
            )

        items = self.scraper.scrape()
        assert len(items) >= 2  # At least Colorado + Salmon per page

    @respx.mock
    @patch("scrapers.facebook.time.sleep")
    @patch("scrapers.facebook.SessionLocal")
    def test_scrape_without_token_uses_public(self, mock_session_cls, mock_sleep):
        self.scraper._access_token = ""
        session = MagicMock()
        mock_session_cls.return_value = session
        mock_rivers = [_make_mock_river(r) for r in MOCK_RIVERS]
        session.query.return_value.all.return_value = mock_rivers

        for page in DEFAULT_PAGES:
            respx.get(f"https://m.facebook.com/{page}").mock(
                return_value=httpx.Response(200, text=SAMPLE_HTML_PAGE)
            )

        items = self.scraper.scrape()
        assert isinstance(items, list)

    @respx.mock
    @patch("scrapers.facebook.time.sleep")
    @patch("scrapers.facebook.SessionLocal")
    def test_scrape_returns_scraped_items(self, mock_session_cls, mock_sleep):
        self.scraper._access_token = "token"
        session = MagicMock()
        mock_session_cls.return_value = session
        mock_rivers = [_make_mock_river(r) for r in MOCK_RIVERS]
        session.query.return_value.all.return_value = mock_rivers

        for page in DEFAULT_PAGES:
            respx.get(f"https://graph.facebook.com/v19.0/{page}/posts").mock(
                return_value=httpx.Response(200, json=SAMPLE_GRAPH_RESPONSE)
            )

        items = self.scraper.scrape()
        for item in items:
            assert isinstance(item, ScrapedItem)
            assert item.source == "facebook"
            assert item.data.get("river_name") is not None

    @respx.mock
    @patch("scrapers.facebook.time.sleep")
    def test_scrape_sleeps_between_pages(self, mock_sleep):
        self.scraper._access_token = "token"
        self.scraper._river_cache = MOCK_RIVERS

        for page in DEFAULT_PAGES:
            respx.get(f"https://graph.facebook.com/v19.0/{page}/posts").mock(
                return_value=httpx.Response(200, json=SAMPLE_GRAPH_EMPTY)
            )

        self.scraper.scrape()
        assert mock_sleep.call_count >= len(DEFAULT_PAGES)


# ─── Constants Validation ────────────────────────────────────

class TestFacebookConstants:
    """Validate module-level constants."""

    def test_flow_rate_patterns_are_compiled(self):
        import re
        for p in FLOW_RATE_PATTERNS:
            assert isinstance(p, re.Pattern)

    def test_condition_keywords_all_lowercase(self):
        for quality, keywords in CONDITION_KEYWORDS.items():
            for kw in keywords:
                assert kw == kw.lower(), f"Keyword '{kw}' in '{quality}' is not lowercase"

    def test_condition_keywords_has_all_levels(self):
        expected = {"excellent", "good", "fair", "poor", "dangerous"}
        assert set(CONDITION_KEYWORDS.keys()) == expected

    def test_default_pages_has_entries(self):
        assert len(DEFAULT_PAGES) >= 2

    def test_relative_time_patterns_are_compiled(self):
        import re
        for pattern, unit in RELATIVE_TIME_PATTERNS:
            assert isinstance(pattern, re.Pattern)
