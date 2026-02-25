"""
Tests for the BLM (Bureau of Land Management) scraper.

Mocks HTTP responses with respx and verifies:
- Initialization and base properties
- API response parsing (JSON list, dict with various keys)
- RSS/Atom feed parsing
- Advisory type classification
- Severity classification
- River name extraction from text
- Date parsing in various formats
- Rate limiting (sleep delays between requests)
- Error handling (timeouts, HTTP errors, non-JSON, missing fields)
- scrape() integration: combines API + RSS items
"""

import httpx
import respx
import pytest
import time
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from scrapers.blm import (
    BLMScraper,
    ADVISORY_TYPE_MAP,
    SEVERITY_KEYWORDS,
)
from scrapers.base import BaseScraper, ScrapedItem
from config.settings import settings


# ─── Sample API responses ───────────────────────────────────

SAMPLE_ALERTS_LIST = [
    {
        "title": "Colorado River Closure — Hazardous Conditions",
        "description": "Emergency closure due to dangerous flooding along the river corridor.",
        "area": "Grand Canyon NRA",
        "start_date": "2026-02-20",
        "end_date": "2026-03-01",
        "url": "https://www.blm.gov/alert/12345",
    },
    {
        "title": "Seasonal access update for the area",
        "description": "Seasonal permit requirements now in effect.",
        "area": "Salmon Creek Wild & Scenic Area",
        "start_date": "2026-06-01",
        "url": "https://www.blm.gov/alert/12346",
    },
]

SAMPLE_ALERTS_DICT = {
    "alerts": [
        {
            "title": "Fire restriction along the Owyhee River",
            "description": "Stage 2 fire restriction in effect along the corridor.",
            "area": "eastern Oregon",
            "start_date": "2026-07-01T00:00:00Z",
            "url": "https://www.blm.gov/alert/99001",
        },
    ]
}

SAMPLE_ALERTS_RESULTS_KEY = {
    "results": [
        {
            "name": "High water advisory on the Deschutes River",
            "summary": "Advisory warning for high water levels.",
            "location": "central Oregon",
            "startDate": "2026-03-15T00:00:00Z",
            "link": "https://www.blm.gov/alert/77001",
        },
    ]
}

SAMPLE_ALERTS_FEATURES_KEY = {
    "features": [
        {
            "attributes": {
                "title": "Permit notice for the Rogue River",
                "description": "Permits required for float trips on the wild section.",
                "area_name": "southern Oregon",
                "start_date": "2026-05-01",
                "end_date": "2026-09-30",
                "url": "https://www.blm.gov/alert/66001",
            },
        },
    ]
}

SAMPLE_RSS_XML = """\
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>BLM Recreation Alerts</title>
    <item>
      <title>Snake River Advisory — Caution High Water</title>
      <description>Warning: high water levels expected on the Snake River through March.</description>
      <link>https://www.blm.gov/alert/rss-001</link>
      <pubDate>Tue, 20 Feb 2026 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Road maintenance near parking lot</title>
      <description>Parking lot resurfacing in progress.</description>
      <link>https://www.blm.gov/alert/rss-002</link>
      <pubDate>Mon, 19 Feb 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
"""

SAMPLE_ATOM_XML = """\
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>BLM Atom Feed</title>
  <entry>
    <title>Green River Closure for Construction</title>
    <summary>Temporary closure of Green River put-in due to boat ramp construction.</summary>
    <link href="https://www.blm.gov/alert/atom-001" />
    <updated>2026-02-18T09:00:00Z</updated>
  </entry>
</feed>
"""

NO_RIVER_ALERTS = [
    {
        "title": "Office Hours Change",
        "description": "The BLM field office will now open at 8 AM.",
        "area": "Field Office",
        "start_date": "2026-01-01",
    },
]


# ─── Init & Properties ──────────────────────────────────────

class TestBLMScraperInit:
    """Tests for BLM scraper initialization."""

    def test_scraper_name_is_blm(self):
        scraper = BLMScraper()
        assert scraper.name == "blm"

    def test_inherits_base_scraper(self):
        assert issubclass(BLMScraper, BaseScraper)

    def test_has_http_client(self):
        scraper = BLMScraper()
        assert isinstance(scraper._client, httpx.Client)

    def test_rate_limit_delay(self):
        scraper = BLMScraper()
        assert scraper._rate_limit_delay == 2.0

    def test_client_has_user_agent(self):
        scraper = BLMScraper()
        assert "WaterWatcher" in scraper._client.headers.get("User-Agent", "")

    def test_client_accepts_json_and_xml(self):
        scraper = BLMScraper()
        accept = scraper._client.headers.get("Accept", "")
        assert "application/json" in accept
        assert "xml" in accept


# ─── Advisory Type Classification ────────────────────────────

class TestBLMAdvisoryClassification:
    """Tests for _classify_advisory_type."""

    def setup_method(self):
        self.scraper = BLMScraper()

    def test_closure_from_title(self):
        result = self.scraper._classify_advisory_type("River Closure Notice", "")
        assert result == "closure"

    def test_closed_keyword(self):
        result = self.scraper._classify_advisory_type("Area Closed", "")
        assert result == "closure"

    def test_fire_restriction(self):
        result = self.scraper._classify_advisory_type("Fire Restriction in Effect", "")
        assert result == "fire_restriction"

    def test_burn_ban(self):
        result = self.scraper._classify_advisory_type("", "A burn ban has been issued.")
        assert result == "fire_restriction"

    def test_water_advisory(self):
        result = self.scraper._classify_advisory_type("High Water Advisory", "")
        assert result == "water_advisory"

    def test_flood_advisory(self):
        result = self.scraper._classify_advisory_type("", "Flood conditions expected.")
        assert result == "water_advisory"

    def test_seasonal_access(self):
        result = self.scraper._classify_advisory_type("Seasonal Access Update", "")
        assert result == "seasonal_access"

    def test_permit_required(self):
        result = self.scraper._classify_advisory_type("Permit Required", "")
        assert result == "permit_required"

    def test_general_fallback(self):
        result = self.scraper._classify_advisory_type("General Update", "Nothing special.")
        assert result == "general"

    def test_case_insensitive(self):
        # Note: "closure" keyword is checked before "winter closure" due to dict ordering
        result = self.scraper._classify_advisory_type("WINTER CLOSURE", "")
        assert result == "closure"


# ─── Severity Classification ────────────────────────────────

class TestBLMSeverityClassification:
    """Tests for _classify_severity."""

    def setup_method(self):
        self.scraper = BLMScraper()

    def test_danger_from_closed(self):
        assert self.scraper._classify_severity("Area Closed", "") == "danger"

    def test_danger_from_flood(self):
        assert self.scraper._classify_severity("", "Flood warning issued") == "danger"

    def test_danger_from_emergency(self):
        assert self.scraper._classify_severity("Emergency Notice", "") == "danger"

    def test_danger_from_dangerous(self):
        assert self.scraper._classify_severity("Dangerous conditions", "") == "danger"

    def test_warning_from_caution(self):
        assert self.scraper._classify_severity("", "Use caution on the trail.") == "warning"

    def test_warning_from_advisory(self):
        assert self.scraper._classify_severity("Advisory Issued", "") == "warning"

    def test_warning_from_high_water(self):
        assert self.scraper._classify_severity("High water levels", "") == "warning"

    def test_info_fallback(self):
        assert self.scraper._classify_severity("Seasonal update", "River is lovely") == "info"

    def test_danger_takes_priority_over_warning(self):
        """If both danger and warning keywords are present, danger wins."""
        assert self.scraper._classify_severity("Closed area advisory", "") == "danger"


# ─── River Name Extraction ──────────────────────────────────

class TestBLMRiverNameExtraction:
    """Tests for _extract_river_name."""

    def setup_method(self):
        self.scraper = BLMScraper()

    def test_extracts_river_from_title(self):
        name = self.scraper._extract_river_name("Colorado River Closure", "", "")
        assert name == "Colorado River"

    def test_extracts_creek_name(self):
        name = self.scraper._extract_river_name("", "Salmon Creek Area", "")
        assert name == "Salmon Creek"

    def test_extracts_canyon_name(self):
        name = self.scraper._extract_river_name("", "", "Advisory for Owyhee Canyon region.")
        assert name == "Owyhee Canyon"

    def test_extracts_fork_name(self):
        name = self.scraper._extract_river_name("North Fork closure", "", "")
        assert name == "North Fork"

    def test_multi_word_river(self):
        name = self.scraper._extract_river_name("Grande Ronde River Advisory", "", "")
        assert name == "Grande Ronde River"

    def test_returns_none_for_no_river(self):
        name = self.scraper._extract_river_name("Office closed Monday", "BLM building", "No river here")
        assert name is None

    def test_empty_inputs(self):
        name = self.scraper._extract_river_name("", "", "")
        assert name is None

    def test_prefers_first_match(self):
        name = self.scraper._extract_river_name(
            "Snake River advisory near Payette River", "", ""
        )
        assert name == "Snake River"


# ─── Date Parsing ───────────────────────────────────────────

class TestBLMDateParsing:
    """Tests for _parse_date."""

    def setup_method(self):
        self.scraper = BLMScraper()

    def test_iso_date(self):
        dt = self.scraper._parse_date("2026-02-20")
        assert dt is not None
        assert dt.year == 2026 and dt.month == 2 and dt.day == 20

    def test_iso_datetime_utc(self):
        dt = self.scraper._parse_date("2026-02-20T12:00:00Z")
        assert dt is not None
        assert dt.tzinfo is not None

    def test_iso_datetime_with_tz(self):
        dt = self.scraper._parse_date("2026-02-20T12:00:00+00:00")
        assert dt is not None

    def test_rfc822_date(self):
        dt = self.scraper._parse_date("Tue, 20 Feb 2026 12:00:00 GMT")
        assert dt is not None
        assert dt.year == 2026

    def test_us_date_format(self):
        dt = self.scraper._parse_date("02/20/2026")
        assert dt is not None
        assert dt.month == 2

    def test_none_input(self):
        assert self.scraper._parse_date(None) is None

    def test_empty_string(self):
        assert self.scraper._parse_date("") is None

    def test_unparseable_string(self):
        assert self.scraper._parse_date("not a date") is None

    def test_result_has_utc_tz(self):
        dt = self.scraper._parse_date("2026-01-15")
        assert dt.tzinfo is not None


# ─── Alert Parsing ──────────────────────────────────────────

class TestBLMAlertParsing:
    """Tests for _parse_alert."""

    def setup_method(self):
        self.scraper = BLMScraper()

    def test_parses_standard_alert(self):
        item = self.scraper._parse_alert(SAMPLE_ALERTS_LIST[0])
        assert item is not None
        assert item.source == "blm"
        assert item.data["river_name"] == "Colorado River"
        assert item.data["severity"] == "danger"
        assert item.data["advisory_type"] == "closure"

    def test_parses_seasonal_alert(self):
        item = self.scraper._parse_alert(SAMPLE_ALERTS_LIST[1])
        assert item is not None
        assert item.data["river_name"] == "Salmon Creek"
        assert item.data["advisory_type"] == "seasonal_access"

    def test_parses_name_fallback(self):
        """When 'title' is missing, uses 'name' field."""
        alert = {
            "name": "Advisory for the Owyhee River",
            "summary": "Caution near the river.",
            "location": "eastern Oregon",
        }
        item = self.scraper._parse_alert(alert)
        assert item is not None
        assert item.data["river_name"] == "Owyhee River"

    def test_parses_attributes_structure(self):
        """Handles BLM Feature-service style nested 'attributes'."""
        item = self.scraper._parse_alert(SAMPLE_ALERTS_FEATURES_KEY["features"][0])
        assert item is not None
        assert item.data["river_name"] == "Rogue River"

    def test_skips_non_river_alert(self):
        item = self.scraper._parse_alert(NO_RIVER_ALERTS[0])
        assert item is None

    def test_sets_source_url(self):
        item = self.scraper._parse_alert(SAMPLE_ALERTS_LIST[0])
        assert item.source_url == "https://www.blm.gov/alert/12345"

    def test_parses_dates(self):
        item = self.scraper._parse_alert(SAMPLE_ALERTS_LIST[0])
        assert item.data["start_date"] is not None
        assert item.data["end_date"] is not None

    def test_missing_end_date_is_none(self):
        item = self.scraper._parse_alert(SAMPLE_ALERTS_LIST[1])
        assert item.data["end_date"] is None

    def test_missing_description_gives_none(self):
        alert = {"title": "Snake River Update", "area": "Snake River"}
        item = self.scraper._parse_alert(alert)
        assert item is not None
        assert item.data["description"] is None

    def test_malformed_alert_returns_none(self):
        """Totally empty alert should not crash."""
        item = self.scraper._parse_alert({})
        assert item is None


# ─── RSS Parsing ────────────────────────────────────────────

class TestBLMRSSParsing:
    """Tests for _parse_rss."""

    def setup_method(self):
        self.scraper = BLMScraper()

    def test_parses_rss_items(self):
        items = self.scraper._parse_rss(SAMPLE_RSS_XML)
        assert len(items) == 1
        assert items[0].data["river_name"] == "Snake River"

    def test_rss_item_has_correct_source(self):
        items = self.scraper._parse_rss(SAMPLE_RSS_XML)
        assert items[0].source == "blm"

    def test_rss_item_has_link(self):
        items = self.scraper._parse_rss(SAMPLE_RSS_XML)
        assert items[0].source_url == "https://www.blm.gov/alert/rss-001"

    def test_rss_severity_classified(self):
        items = self.scraper._parse_rss(SAMPLE_RSS_XML)
        assert items[0].data["severity"] == "warning"

    def test_rss_parses_pub_date(self):
        items = self.scraper._parse_rss(SAMPLE_RSS_XML)
        assert items[0].data["start_date"] is not None

    def test_atom_feed_parsing(self):
        items = self.scraper._parse_rss(SAMPLE_ATOM_XML)
        assert len(items) == 1
        assert items[0].data["river_name"] == "Green River"

    def test_atom_uses_href_for_link(self):
        items = self.scraper._parse_rss(SAMPLE_ATOM_XML)
        assert items[0].source_url == "https://www.blm.gov/alert/atom-001"

    def test_invalid_xml_returns_empty(self):
        items = self.scraper._parse_rss("not xml at all <><>!!")
        assert items == []

    def test_empty_xml_returns_empty(self):
        items = self.scraper._parse_rss("<rss><channel></channel></rss>")
        assert items == []

    def test_skips_items_without_title(self):
        xml = """\
<rss version="2.0"><channel>
  <item><description>No title here, Colorado River.</description></item>
</channel></rss>"""
        items = self.scraper._parse_rss(xml)
        assert items == []

    def test_skips_items_without_river(self):
        xml = """\
<rss version="2.0"><channel>
  <item><title>Office closed</title><description>Admin notice.</description></item>
</channel></rss>"""
        items = self.scraper._parse_rss(xml)
        assert items == []


# ─── API Fetch ──────────────────────────────────────────────

class TestBLMFetchAdvisories:
    """Tests for _fetch_advisories with mocked HTTP."""

    def setup_method(self):
        self.scraper = BLMScraper()

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_parses_list_response(self, mock_sleep):
        url = f"{settings.blm_base_url}/api/alerts"
        respx.get(url).mock(return_value=httpx.Response(200, json=SAMPLE_ALERTS_LIST))

        items = self.scraper._fetch_advisories()
        assert len(items) == 2
        assert items[0].data["river_name"] == "Colorado River"
        mock_sleep.assert_called()

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_parses_dict_with_alerts_key(self, mock_sleep):
        url = f"{settings.blm_base_url}/api/alerts"
        respx.get(url).mock(return_value=httpx.Response(200, json=SAMPLE_ALERTS_DICT))

        items = self.scraper._fetch_advisories()
        assert len(items) == 1
        assert items[0].data["river_name"] == "Owyhee River"

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_parses_dict_with_results_key(self, mock_sleep):
        url = f"{settings.blm_base_url}/api/alerts"
        respx.get(url).mock(return_value=httpx.Response(200, json=SAMPLE_ALERTS_RESULTS_KEY))

        items = self.scraper._fetch_advisories()
        assert len(items) == 1
        assert items[0].data["river_name"] == "Deschutes River"

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_parses_dict_with_features_key(self, mock_sleep):
        url = f"{settings.blm_base_url}/api/alerts"
        respx.get(url).mock(return_value=httpx.Response(200, json=SAMPLE_ALERTS_FEATURES_KEY))

        items = self.scraper._fetch_advisories()
        assert len(items) == 1
        assert items[0].data["river_name"] == "Rogue River"

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_handles_timeout(self, mock_sleep):
        url = f"{settings.blm_base_url}/api/alerts"
        respx.get(url).mock(side_effect=httpx.TimeoutException("timed out"))

        items = self.scraper._fetch_advisories()
        assert items == []

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_handles_http_500(self, mock_sleep):
        url = f"{settings.blm_base_url}/api/alerts"
        respx.get(url).mock(return_value=httpx.Response(500))

        items = self.scraper._fetch_advisories()
        assert items == []

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_handles_http_403(self, mock_sleep):
        url = f"{settings.blm_base_url}/api/alerts"
        respx.get(url).mock(return_value=httpx.Response(403))

        items = self.scraper._fetch_advisories()
        assert items == []

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_handles_non_json_response(self, mock_sleep):
        url = f"{settings.blm_base_url}/api/alerts"
        respx.get(url).mock(
            return_value=httpx.Response(200, text="<html>Error Page</html>",
                                        headers={"content-type": "text/html"})
        )
        items = self.scraper._fetch_advisories()
        assert items == []

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_empty_alerts_list(self, mock_sleep):
        url = f"{settings.blm_base_url}/api/alerts"
        respx.get(url).mock(return_value=httpx.Response(200, json=[]))

        items = self.scraper._fetch_advisories()
        assert items == []


# ─── RSS Fetch ──────────────────────────────────────────────

class TestBLMFetchRSSAdvisories:
    """Tests for _fetch_rss_advisories with mocked HTTP."""

    def setup_method(self):
        self.scraper = BLMScraper()

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_fetches_and_parses_rss(self, mock_sleep):
        url = f"{settings.blm_base_url}/rss/alerts.xml"
        respx.get(url).mock(return_value=httpx.Response(200, text=SAMPLE_RSS_XML))

        items = self.scraper._fetch_rss_advisories()
        assert len(items) == 1
        assert items[0].data["river_name"] == "Snake River"
        mock_sleep.assert_called()

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_rss_timeout(self, mock_sleep):
        url = f"{settings.blm_base_url}/rss/alerts.xml"
        respx.get(url).mock(side_effect=httpx.TimeoutException("timeout"))

        items = self.scraper._fetch_rss_advisories()
        assert items == []

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_rss_http_error(self, mock_sleep):
        url = f"{settings.blm_base_url}/rss/alerts.xml"
        respx.get(url).mock(return_value=httpx.Response(404))

        items = self.scraper._fetch_rss_advisories()
        assert items == []


# ─── Rate Limiting ──────────────────────────────────────────

class TestBLMRateLimiting:
    """Tests for rate limiting behavior."""

    def setup_method(self):
        self.scraper = BLMScraper()

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_api_sleeps_after_request(self, mock_sleep):
        url = f"{settings.blm_base_url}/api/alerts"
        respx.get(url).mock(return_value=httpx.Response(200, json=[]))

        self.scraper._fetch_advisories()
        mock_sleep.assert_called_with(2.0)

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_rss_sleeps_before_request(self, mock_sleep):
        url = f"{settings.blm_base_url}/rss/alerts.xml"
        respx.get(url).mock(return_value=httpx.Response(200, text="<rss><channel></channel></rss>"))

        self.scraper._fetch_rss_advisories()
        mock_sleep.assert_called_with(2.0)


# ─── Full Scrape Integration ────────────────────────────────

class TestBLMScrapeIntegration:
    """Tests for the top-level scrape() method."""

    def setup_method(self):
        self.scraper = BLMScraper()

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_scrape_combines_api_and_rss(self, mock_sleep):
        api_url = f"{settings.blm_base_url}/api/alerts"
        rss_url = f"{settings.blm_base_url}/rss/alerts.xml"

        respx.get(api_url).mock(return_value=httpx.Response(200, json=SAMPLE_ALERTS_LIST))
        respx.get(rss_url).mock(return_value=httpx.Response(200, text=SAMPLE_RSS_XML))

        items = self.scraper.scrape()
        assert len(items) == 3
        sources = [i.source for i in items]
        assert all(s == "blm" for s in sources)

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_scrape_returns_empty_on_total_failure(self, mock_sleep):
        api_url = f"{settings.blm_base_url}/api/alerts"
        rss_url = f"{settings.blm_base_url}/rss/alerts.xml"

        respx.get(api_url).mock(side_effect=httpx.TimeoutException("timeout"))
        respx.get(rss_url).mock(side_effect=httpx.TimeoutException("timeout"))

        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_scrape_partial_success(self, mock_sleep):
        """API fails but RSS succeeds — should return RSS items."""
        api_url = f"{settings.blm_base_url}/api/alerts"
        rss_url = f"{settings.blm_base_url}/rss/alerts.xml"

        respx.get(api_url).mock(return_value=httpx.Response(500))
        respx.get(rss_url).mock(return_value=httpx.Response(200, text=SAMPLE_RSS_XML))

        items = self.scraper.scrape()
        assert len(items) == 1

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_scrape_all_items_have_river_name(self, mock_sleep):
        api_url = f"{settings.blm_base_url}/api/alerts"
        rss_url = f"{settings.blm_base_url}/rss/alerts.xml"

        respx.get(api_url).mock(return_value=httpx.Response(200, json=SAMPLE_ALERTS_LIST))
        respx.get(rss_url).mock(return_value=httpx.Response(200, text=SAMPLE_ATOM_XML))

        items = self.scraper.scrape()
        for item in items:
            assert item.data.get("river_name") is not None

    @respx.mock
    @patch("scrapers.blm.time.sleep")
    def test_scrape_data_includes_required_fields(self, mock_sleep):
        api_url = f"{settings.blm_base_url}/api/alerts"
        rss_url = f"{settings.blm_base_url}/rss/alerts.xml"

        respx.get(api_url).mock(return_value=httpx.Response(200, json=SAMPLE_ALERTS_LIST))
        respx.get(rss_url).mock(return_value=httpx.Response(200, text="<rss><channel></channel></rss>"))

        items = self.scraper.scrape()
        for item in items:
            assert "river_name" in item.data
            assert "advisory_type" in item.data
            assert "severity" in item.data
            assert "title" in item.data


# ─── Edge Cases ─────────────────────────────────────────────

class TestBLMEdgeCases:
    """Edge case and boundary testing."""

    def setup_method(self):
        self.scraper = BLMScraper()

    def test_advisory_type_map_completeness(self):
        """All ADVISORY_TYPE_MAP values should be in expected set."""
        expected_types = {"closure", "fire_restriction", "water_advisory",
                          "seasonal_access", "permit_required"}
        for val in ADVISORY_TYPE_MAP.values():
            assert val in expected_types

    def test_severity_keywords_are_lowercase(self):
        """All severity keywords should be lowercase for matching."""
        for level, keywords in SEVERITY_KEYWORDS.items():
            for kw in keywords:
                assert kw == kw.lower()

    def test_parse_alert_with_only_attributes(self):
        """Alert with data only in 'attributes' sub-dict."""
        alert = {
            "attributes": {
                "title": "Seasonal access on the Yampa River",
                "description": "Seasonal notice for river access.",
                "area_name": "northwestern Colorado",
                "start_date": "2026-04-01",
            },
        }
        item = self.scraper._parse_alert(alert)
        assert item is not None
        assert item.data["river_name"] == "Yampa River"

    def test_parse_float_valid(self):
        assert BLMScraper._parse_float("1,250.5") == 1250.5

    def test_parse_float_invalid(self):
        assert BLMScraper._parse_float("N/A") is None

    def test_parse_float_none_attr(self):
        assert BLMScraper._parse_float(None) is None
