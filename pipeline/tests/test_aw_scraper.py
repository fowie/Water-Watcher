"""
Tests for the American Whitewater scraper.

Mocks HTTP responses with sample JSON and HTML, verifying:
- _fetch_reach_detail() — JSON API parsing
- _fetch_gauge_data() — gauge reading extraction from HTML
- _extract_reach_data() — normalization of nested AW JSON
- Difficulty mapping/normalization
- _classify_hazard() — hazard type classification
- _parse_float() — safe float parsing
- _clean_html() — HTML tag stripping
- Error handling — HTTP errors, invalid JSON, network failures
- Tracked river lookup
"""

import httpx
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from scrapers.american_whitewater import (
    AmericanWhitewaterScraper,
    AW_API_BASE,
    DIFFICULTY_MAP,
)
from scrapers.base import ScrapedItem
from tests.conftest import make_mock_river


# ─── Sample AW JSON response ───────────────────────────────

SAMPLE_REACH_JSON = {
    "info": {
        "CRiverMainGadgetJSON_main": {
            "river": {
                "name": "North Fork Payette",
                "section": "Banks to Beehive Bend",
                "class": "IV",
                "difficulty": "IV",
                "description": "<p>Classic Idaho whitewater run.</p>",
                "gaugeinfo": {
                    "minimum": "800",
                    "maximum": "3000",
                    "unit": "cfs",
                },
            }
        }
    }
}

SAMPLE_REACH_JSON_ALT = {
    "CContainerViewJSON_view": {
        "CRiverMainGadgetJSON_main": {
            "river": {
                "name": "Lochsa River",
                "section": "Fish Creek to Lowell",
                "class": "III-IV",
                "description": "Wild and Scenic section",
                "gaugeinfo": {
                    "min": "1500",
                    "max": "8000",
                    "unit": "cfs",
                },
            }
        }
    }
}

SAMPLE_REACH_JSON_FLAT = {
    "info": {
        "CRiverMainGadgetJSON_main": {
            "river": {
                "name": "Salmon River",
                "section": "Pine Bar to Spring Bar",
                "class": "III",
                "description": "",
                "gaugeinfo": "800-4000 cfs recommended",
            }
        }
    }
}

# ─── Sample gauge HTML ──────────────────────────────────────

SAMPLE_GAUGE_HTML = """\
<html><body>
<table class="gaugeTable">
  <tr><th>Gauge</th><th>Reading</th><th>Unit</th></tr>
  <tr><td>USGS 13185000</td><td>1,250</td><td>cfs</td></tr>
  <tr><td>Stage</td><td>4.2</td><td>ft</td></tr>
</table>
</body></html>
"""

SAMPLE_GAUGE_HTML_ALT = """\
<html><body>
<div id="gauge-container">
  <span>Current Level: 2,100 cfs</span>
</div>
</body></html>
"""

SAMPLE_GAUGE_HTML_EMPTY = """\
<html><body><div>No gauge info available</div></body></html>
"""

# ─── Sample rapids HTML ────────────────────────────────────

SAMPLE_RAPIDS_HTML = """\
<html><body>
<div class="rapid">
  <h3 class="rapid-name">Crunch</h3>
  <span class="class-iv">IV</span>
  <p>Big hole at center. Run left.</p>
</div>
<div class="rapid">
  <h4>Juicer</h4>
  <p>Long wave train.</p>
</div>
</body></html>
"""

# ─── Sample hazards HTML ───────────────────────────────────

SAMPLE_HAZARDS_HTML = """\
<html><body>
<div class="alert danger">
  <h3>Strainer at Mile 14</h3>
  <p>Large tree blocking right channel.</p>
</div>
<div class="alert warning">
  <strong>Low bridge advisory</strong>
  <p>New bridge construction at takeout.</p>
</div>
</body></html>
"""


class TestFetchReachDetail:
    """Tests for AmericanWhitewaterScraper._fetch_reach_detail()."""

    def setup_method(self):
        self.scraper = AmericanWhitewaterScraper()

    def test_parses_json_response(self):
        """Should parse a valid JSON response from AW API."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = SAMPLE_REACH_JSON
        mock_resp.raise_for_status = MagicMock()
        self.scraper._client = MagicMock()
        self.scraper._client.get.return_value = mock_resp

        result = self.scraper._fetch_reach_detail("12345")
        assert result is not None
        assert "info" in result

    def test_returns_none_on_http_error(self):
        """Should return None on HTTP errors."""
        self.scraper._client = MagicMock()
        self.scraper._client.get.side_effect = httpx.ConnectError("Connection failed")

        result = self.scraper._fetch_reach_detail("12345")
        assert result is None

    def test_returns_none_on_invalid_json(self):
        """Should return None when response is not valid JSON."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.side_effect = ValueError("Invalid JSON")
        self.scraper._client = MagicMock()
        self.scraper._client.get.return_value = mock_resp

        result = self.scraper._fetch_reach_detail("12345")
        assert result is None

    def test_returns_none_on_non_dict_json(self):
        """Should return None if JSON response is a list, not a dict."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = [1, 2, 3]
        self.scraper._client = MagicMock()
        self.scraper._client.get.return_value = mock_resp

        result = self.scraper._fetch_reach_detail("12345")
        assert result is None

    def test_correct_url_format(self):
        """Should construct the correct AW API URL."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = SAMPLE_REACH_JSON
        mock_resp.raise_for_status = MagicMock()
        self.scraper._client = MagicMock()
        self.scraper._client.get.return_value = mock_resp

        self.scraper._fetch_reach_detail("67890")
        called_url = self.scraper._client.get.call_args[0][0]
        assert "67890" in called_url
        assert called_url.endswith(".json")


class TestFetchGaugeData:
    """Tests for AmericanWhitewaterScraper._fetch_gauge_data()."""

    def setup_method(self):
        self.scraper = AmericanWhitewaterScraper()

    def test_parses_gauge_table(self):
        """Should parse gauge data from HTML table."""
        mock_resp = MagicMock()
        mock_resp.text = SAMPLE_GAUGE_HTML
        mock_resp.raise_for_status = MagicMock()
        self.scraper._client = MagicMock()
        self.scraper._client.get.return_value = mock_resp

        gauges = self.scraper._fetch_gauge_data("12345")
        assert len(gauges) == 2
        assert gauges[0]["name"] == "USGS 13185000"
        assert gauges[0]["reading"] == 1250.0
        assert gauges[0]["unit"] == "cfs"
        assert gauges[1]["reading"] == 4.2
        assert gauges[1]["unit"] == "ft"

    def test_parses_alt_gauge_section(self):
        """Should parse gauge data from div#gauge-container fallback."""
        mock_resp = MagicMock()
        mock_resp.text = SAMPLE_GAUGE_HTML_ALT
        mock_resp.raise_for_status = MagicMock()
        self.scraper._client = MagicMock()
        self.scraper._client.get.return_value = mock_resp

        gauges = self.scraper._fetch_gauge_data("12345")
        assert len(gauges) == 1
        assert gauges[0]["reading"] == 2100.0
        assert gauges[0]["unit"] == "cfs"

    def test_returns_empty_on_no_gauge_info(self):
        """Should return empty list if no gauge info found."""
        mock_resp = MagicMock()
        mock_resp.text = SAMPLE_GAUGE_HTML_EMPTY
        mock_resp.raise_for_status = MagicMock()
        self.scraper._client = MagicMock()
        self.scraper._client.get.return_value = mock_resp

        gauges = self.scraper._fetch_gauge_data("12345")
        assert gauges == []

    def test_returns_empty_on_http_error(self):
        """Should return empty list on HTTP errors."""
        self.scraper._client = MagicMock()
        self.scraper._client.get.side_effect = httpx.ConnectError("Connection failed")

        gauges = self.scraper._fetch_gauge_data("12345")
        assert gauges == []


class TestExtractReachData:
    """Tests for AmericanWhitewaterScraper._extract_reach_data()."""

    def setup_method(self):
        self.scraper = AmericanWhitewaterScraper()

    def test_standard_format(self):
        """Should extract data from standard AW JSON format."""
        result = self.scraper._extract_reach_data(SAMPLE_REACH_JSON)
        assert result["name"] == "North Fork Payette"
        assert result["section"] == "Banks to Beehive Bend"
        assert result["difficulty"] == "Class IV"
        assert "Classic Idaho" in result["description"]
        assert result["flow_range"]["min"] == 800.0
        assert result["flow_range"]["max"] == 3000.0

    def test_alt_format_with_container_view(self):
        """Should extract data from alternate CContainerViewJSON_view format."""
        result = self.scraper._extract_reach_data(SAMPLE_REACH_JSON_ALT)
        assert result["name"] == "Lochsa River"
        assert result["section"] == "Fish Creek to Lowell"
        assert result["difficulty"] == "Class III-IV"

    def test_flat_format(self):
        """Should handle flat JSON structure."""
        result = self.scraper._extract_reach_data(SAMPLE_REACH_JSON_FLAT)
        assert result["name"] == "Salmon River"
        assert result["difficulty"] == "Class III"
        # gaugeinfo is a string, should be in description form
        assert "description" in result["flow_range"]

    def test_html_stripped_from_description(self):
        """HTML tags should be stripped from the description."""
        result = self.scraper._extract_reach_data(SAMPLE_REACH_JSON)
        assert "<p>" not in result["description"]


class TestDifficultyMapping:
    """Tests for difficulty normalization."""

    def setup_method(self):
        self.scraper = AmericanWhitewaterScraper()

    def test_all_mapped_values(self):
        """All difficulty shorthand values should have a mapping."""
        for short, full in DIFFICULTY_MAP.items():
            assert full.startswith("Class ")
            assert short in full.replace("Class ", "")

    def test_class_i(self):
        data = {"info": {"CRiverMainGadgetJSON_main": {"river": {"name": "Test", "class": "I", "description": ""}}}}
        result = self.scraper._extract_reach_data(data)
        assert result["difficulty"] == "Class I"

    def test_class_v_plus(self):
        data = {"info": {"CRiverMainGadgetJSON_main": {"river": {"name": "Test", "class": "V+", "description": ""}}}}
        result = self.scraper._extract_reach_data(data)
        assert result["difficulty"] == "Class V+"

    def test_unmapped_difficulty_unchanged(self):
        """Difficulties not in the map should be left as-is."""
        data = {"info": {"CRiverMainGadgetJSON_main": {"river": {"name": "Test", "class": "III(IV)", "description": ""}}}}
        result = self.scraper._extract_reach_data(data)
        assert result["difficulty"] == "III(IV)"


class TestClassifyHazard:
    """Tests for AmericanWhitewaterScraper._classify_hazard()."""

    def setup_method(self):
        self.scraper = AmericanWhitewaterScraper()

    def test_strainer_keywords(self):
        assert self.scraper._classify_hazard("Strainer at mile 5", "") == "strainer"
        assert self.scraper._classify_hazard("Fallen tree", "blocking channel") == "strainer"
        assert self.scraper._classify_hazard("Log debris", "") == "strainer"

    def test_dam_keywords(self):
        assert self.scraper._classify_hazard("Dam portage required", "") == "dam"
        assert self.scraper._classify_hazard("Diversion structure", "") == "dam"
        assert self.scraper._classify_hazard("Low-head weir", "") == "dam"

    def test_logjam_keywords(self):
        # Logjam check runs before strainer to avoid false matches
        # ("logjam" contains "log" which would match strainer if checked first).
        assert self.scraper._classify_hazard("Logjam at bridge", "") == "logjam"
        assert self.scraper._classify_hazard("Log jam downstream", "") == "logjam"
        assert self.scraper._classify_hazard("Complete blockage", "full blockage ahead") == "logjam"

    def test_closure_keywords(self):
        assert self.scraper._classify_hazard("River closure", "closed for season") == "closure"
        assert self.scraper._classify_hazard("Permit required", "") == "closure"

    def test_rapid_change_keywords(self):
        assert self.scraper._classify_hazard("New hole formed", "big hydraulic") == "rapid_change"

    def test_default_is_rapid_change(self):
        """Unknown hazards default to rapid_change."""
        assert self.scraper._classify_hazard("Unknown hazard", "be careful") == "rapid_change"


class TestParseFloat:
    """Tests for AmericanWhitewaterScraper._parse_float()."""

    def test_int_value(self):
        assert AmericanWhitewaterScraper._parse_float(42) == 42.0

    def test_float_value(self):
        assert AmericanWhitewaterScraper._parse_float(3.14) == 3.14

    def test_string_int(self):
        assert AmericanWhitewaterScraper._parse_float("1200") == 1200.0

    def test_string_float(self):
        assert AmericanWhitewaterScraper._parse_float("4.5") == 4.5

    def test_string_with_comma(self):
        assert AmericanWhitewaterScraper._parse_float("1,250") == 1250.0

    def test_none_returns_none(self):
        assert AmericanWhitewaterScraper._parse_float(None) is None

    def test_empty_string_returns_none(self):
        assert AmericanWhitewaterScraper._parse_float("") is None

    def test_invalid_string_returns_none(self):
        assert AmericanWhitewaterScraper._parse_float("abc") is None

    def test_whitespace_string(self):
        assert AmericanWhitewaterScraper._parse_float("  ") is None


class TestCleanHtml:
    """Tests for _clean_html()."""

    def setup_method(self):
        self.scraper = AmericanWhitewaterScraper()

    def test_strips_tags(self):
        assert self.scraper._clean_html("<p>Hello <b>world</b></p>") == "Hello world"

    def test_empty_string(self):
        assert self.scraper._clean_html("") == ""

    def test_no_html(self):
        assert self.scraper._clean_html("Plain text") == "Plain text"


class TestTrackedRiverLookup:
    """Tests for _get_tracked_aw_ids()."""

    def setup_method(self):
        self.scraper = AmericanWhitewaterScraper()

    @patch("scrapers.american_whitewater.SessionLocal")
    def test_returns_aw_ids(self, mock_session_cls):
        """Should return AW IDs from tracked rivers."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        r1 = make_mock_river(aw_id="111")
        r2 = make_mock_river(aw_id="222")
        mock_session.query.return_value.filter.return_value.all.return_value = [r1, r2]

        ids = self.scraper._get_tracked_aw_ids()
        assert ids == ["111", "222"]

    @patch("scrapers.american_whitewater.SessionLocal")
    def test_returns_empty_when_no_rivers(self, mock_session_cls):
        """Should return empty list when no rivers have AW IDs."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = []

        ids = self.scraper._get_tracked_aw_ids()
        assert ids == []


class TestScrapeIntegration:
    """Integration tests for the full scrape() method."""

    def setup_method(self):
        self.scraper = AmericanWhitewaterScraper()

    @patch("time.sleep")
    @patch("scrapers.american_whitewater.SessionLocal")
    def test_scrape_no_aw_ids_returns_empty(self, mock_session_cls, mock_sleep):
        """Should return empty list and skip if no AW IDs configured."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = []

        items = self.scraper.scrape()
        assert items == []

    @patch("time.sleep")
    @patch("scrapers.american_whitewater.SessionLocal")
    def test_scrape_produces_scraped_items(self, mock_session_cls, mock_sleep):
        """Should produce ScrapedItems with source='aw'."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        # _get_tracked_aw_ids
        r1 = make_mock_river(aw_id="12345")
        mock_session.query.return_value.filter.return_value.all.return_value = [r1]
        # For _save_hazards, _fetch_hazards, etc. — mock to avoid DB writes
        mock_session.query.return_value.filter.return_value.first.return_value = None

        # Mock all HTTP calls
        self.scraper._client = MagicMock()

        # First call: _get_tracked_aw_ids (already mocked via SessionLocal)
        # Second call: _fetch_reach_detail (JSON)
        json_resp = MagicMock()
        json_resp.json.return_value = SAMPLE_REACH_JSON
        json_resp.raise_for_status = MagicMock()

        # Subsequent calls: _fetch_gauge_data, _fetch_rapids, etc. (HTML)
        html_resp = MagicMock()
        html_resp.text = SAMPLE_GAUGE_HTML
        html_resp.raise_for_status = MagicMock()

        hazard_resp = MagicMock()
        hazard_resp.text = "<html><body></body></html>"
        hazard_resp.raise_for_status = MagicMock()

        self.scraper._client.get.side_effect = [
            json_resp,   # _fetch_reach_detail
            html_resp,   # _fetch_gauge_data
            html_resp,   # _fetch_rapids
            html_resp,   # _fetch_trip_reports page 0
            hazard_resp, # _fetch_hazards
        ]

        items = self.scraper.scrape()
        assert len(items) == 1
        assert items[0].source == "aw"
        assert items[0].data["aw_id"] == "12345"
        assert items[0].data["name"] == "North Fork Payette"

    @patch("time.sleep")
    @patch("scrapers.american_whitewater.SessionLocal")
    def test_scrape_handles_fetch_failure(self, mock_session_cls, mock_sleep):
        """Should continue if a single reach fetch fails."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        r1 = make_mock_river(aw_id="bad-reach")
        mock_session.query.return_value.filter.return_value.all.return_value = [r1]
        mock_session.query.return_value.filter.return_value.first.return_value = None

        self.scraper._client = MagicMock()
        # All HTTP calls fail
        self.scraper._client.get.side_effect = httpx.ConnectError("Network down")

        items = self.scraper.scrape()
        # Should still produce an item (with empty data) since the error
        # is caught per-method, not at the top level
        assert isinstance(items, list)

    def test_name_property(self):
        assert self.scraper.name == "aw"
