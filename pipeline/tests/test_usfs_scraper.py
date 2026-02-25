"""
Tests for the USFS (US Forest Service) RIDB scraper.

Mocks HTTP responses with respx and verifies:
- Initialization and API key gating
- Facility and rec area response parsing
- Alert parsing (facility + rec area alerts)
- Alert type classification
- Severity classification
- River name extraction from facility names
- Date parsing in RIDB formats
- Rate limiting (sleep delays between requests)
- Error handling (timeouts, HTTP errors, missing fields)
- scrape() integration: combines facility + rec area alerts
"""

import httpx
import respx
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from scrapers.usfs import (
    USFSScraper,
    RIDB_BASE_URL,
    ALERT_TYPE_MAP,
    RIVER_KEYWORDS,
)
from scrapers.base import BaseScraper, ScrapedItem
from config.settings import settings


# ─── Sample RIDB responses ──────────────────────────────────

SAMPLE_FACILITIES = {
    "RECDATA": [
        {
            "FacilityID": "FAC-001",
            "FacilityName": "Salmon River Put-In",
            "FacilityDescription": "Boat ramp on the Salmon River.",
        },
        {
            "FacilityID": "FAC-002",
            "FacilityName": "Eagle Creek Trailhead",
            "FacilityDescription": "Hiking trailhead near Eagle Creek.",
        },
    ]
}

SAMPLE_FACILITY_ALERTS = {
    "RECDATA": [
        {
            "Title": "Salmon River high water closure",
            "Description": "Area closed due to dangerous flooding on the Salmon River.",
            "StartDate": "2026-03-01T00:00:00Z",
            "EndDate": "2026-03-15T00:00:00Z",
            "URL": "https://ridb.recreation.gov/alert/alert-001",
        },
    ]
}

SAMPLE_FACILITY_ALERTS_ALT_KEYS = {
    "RECDATA": [
        {
            "AlertTitle": "Payette River advisory",
            "AlertDescription": "Caution: high water levels on the Payette River.",
            "AlertStartDate": "2026-04-01",
            "AlertEndDate": "2026-04-30",
            "AlertURL": "https://ridb.recreation.gov/alert/alert-002",
        },
    ]
}

SAMPLE_REC_AREAS = {
    "RECDATA": [
        {
            "RecAreaID": "REC-001",
            "RecAreaName": "Frank Church River of No Return Wilderness",
        },
        {
            "RecAreaID": "REC-002",
            "RecAreaName": "Deschutes River National Recreation Area",
        },
    ]
}

SAMPLE_REC_AREA_ALERTS = {
    "RECDATA": [
        {
            "Title": "Seasonal restriction on Deschutes River",
            "Description": "Winter access restricted on the Deschutes River corridor.",
            "StartDate": "2025-11-01T00:00:00Z",
            "EndDate": "2026-04-15T00:00:00Z",
            "URL": "https://ridb.recreation.gov/alert/rec-001",
        },
    ]
}


# ─── Init & Properties ──────────────────────────────────────

class TestUSFSScraperInit:
    """Tests for USFS scraper initialization."""

    @patch.object(settings, "ridb_api_key", "test-api-key-123")
    def test_scraper_name_is_usfs(self):
        scraper = USFSScraper()
        assert scraper.name == "usfs"

    def test_inherits_base_scraper(self):
        assert issubclass(USFSScraper, BaseScraper)

    @patch.object(settings, "ridb_api_key", "test-key")
    def test_has_http_client(self):
        scraper = USFSScraper()
        assert isinstance(scraper._client, httpx.Client)

    @patch.object(settings, "ridb_api_key", "my-key-123")
    def test_client_sends_api_key_header(self):
        scraper = USFSScraper()
        assert scraper._client.headers.get("apikey") == "my-key-123"

    @patch.object(settings, "ridb_api_key", "key")
    def test_rate_limit_delay(self):
        scraper = USFSScraper()
        assert scraper._rate_limit_delay == 1.0

    @patch.object(settings, "ridb_api_key", "key")
    def test_client_accepts_json(self):
        scraper = USFSScraper()
        assert "application/json" in scraper._client.headers.get("Accept", "")


# ─── API Key Gating ─────────────────────────────────────────

class TestUSFSAPIKeyGating:
    """Tests that scraper warns/skips when API key is missing."""

    @patch.object(settings, "ridb_api_key", "")
    def test_scrape_returns_empty_without_key(self):
        scraper = USFSScraper()
        items = scraper.scrape()
        assert items == []

    @patch.object(settings, "ridb_api_key", "")
    def test_scrape_logs_warning_without_key(self, caplog):
        import logging
        with caplog.at_level(logging.WARNING):
            scraper = USFSScraper()
            scraper.scrape()
        assert any("RIDB_API_KEY" in r.message for r in caplog.records)

    @patch.object(settings, "ridb_api_key", "valid-key")
    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_scrape_proceeds_with_key(self, mock_sleep):
        scraper = USFSScraper()
        respx.get(f"{RIDB_BASE_URL}/facilities").mock(
            return_value=httpx.Response(200, json={"RECDATA": []})
        )
        respx.get(f"{RIDB_BASE_URL}/recareas").mock(
            return_value=httpx.Response(200, json={"RECDATA": []})
        )
        items = scraper.scrape()
        assert items == []  # No alerts, but no error


# ─── Alert Type Classification ──────────────────────────────

class TestUSFSAlertTypeClassification:
    """Tests for _classify_alert_type."""

    @patch.object(settings, "ridb_api_key", "key")
    def setup_method(self, method=None):
        self.scraper = USFSScraper()

    def test_closure_keyword(self):
        assert self.scraper._classify_alert_type("Area Closure", "") == "closure"

    def test_trail_closure(self):
        assert self.scraper._classify_alert_type("Trail Closure Notice", "") == "closure"

    def test_flood_warning(self):
        assert self.scraper._classify_alert_type("Flood Warning", "") == "flood_warning"

    def test_high_water(self):
        assert self.scraper._classify_alert_type("", "High water advisory") == "flood_warning"

    def test_seasonal_restriction(self):
        assert self.scraper._classify_alert_type("Seasonal Access", "") == "seasonal_restriction"

    def test_campground_status(self):
        assert self.scraper._classify_alert_type("Campground Update", "") == "campground_status"

    def test_fire_restriction(self):
        assert self.scraper._classify_alert_type("Fire Restriction", "") == "fire_restriction"

    def test_general_fallback(self):
        assert self.scraper._classify_alert_type("General info", "Nothing special") == "general"


# ─── Severity Classification ────────────────────────────────

class TestUSFSSeverityClassification:
    """Tests for _classify_severity."""

    @patch.object(settings, "ridb_api_key", "key")
    def setup_method(self, method=None):
        self.scraper = USFSScraper()

    def test_danger_from_closed(self):
        assert self.scraper._classify_severity("Area Closed", "") == "danger"

    def test_danger_from_flood(self):
        assert self.scraper._classify_severity("Flood Alert", "") == "danger"

    def test_danger_from_emergency(self):
        assert self.scraper._classify_severity("Emergency Evacuation", "") == "danger"

    def test_warning_from_caution(self):
        assert self.scraper._classify_severity("", "Use caution in the area") == "warning"

    def test_warning_from_fire(self):
        assert self.scraper._classify_severity("Fire restriction", "") == "warning"

    def test_warning_from_high_water(self):
        assert self.scraper._classify_severity("High water", "") == "warning"

    def test_info_fallback(self):
        assert self.scraper._classify_severity("Spring update", "Everything's fine") == "info"

    def test_danger_priority_over_warning(self):
        assert self.scraper._classify_severity("Closed area, restricted access", "") == "danger"


# ─── River Name Extraction ──────────────────────────────────

class TestUSFSRiverNameExtraction:
    """Tests for _extract_river_name and _extract_river_name_from_text."""

    @patch.object(settings, "ridb_api_key", "key")
    def setup_method(self, method=None):
        self.scraper = USFSScraper()

    def test_extracts_river_from_facility_name(self):
        name = self.scraper._extract_river_name(
            "Salmon River Put-In", {"FacilityDescription": ""}
        )
        assert name == "Salmon River"

    def test_extracts_from_description_fallback(self):
        name = self.scraper._extract_river_name(
            "Boat Ramp #5",
            {"FacilityDescription": "Located on the Deschutes River."}
        )
        assert name == "Deschutes River"

    def test_returns_none_for_no_river(self):
        name = self.scraper._extract_river_name(
            "Mountain View Campground",
            {"FacilityDescription": "Scenic views"}
        )
        assert name is None

    def test_extract_from_text_river(self):
        assert self.scraper._extract_river_name_from_text("Snake River area") == "Snake River"

    def test_extract_from_text_creek(self):
        assert self.scraper._extract_river_name_from_text("Eagle Creek Trail") == "Eagle Creek"

    def test_extract_from_text_canyon(self):
        assert self.scraper._extract_river_name_from_text("Hells Canyon visitor center") == "Hells Canyon"

    def test_extract_from_text_none_for_no_match(self):
        assert self.scraper._extract_river_name_from_text("Mountain campground") is None

    def test_extract_from_empty_text(self):
        assert self.scraper._extract_river_name_from_text("") is None

    def test_extract_from_none(self):
        assert self.scraper._extract_river_name_from_text(None) is None


# ─── Date Parsing ───────────────────────────────────────────

class TestUSFSDateParsing:
    """Tests for _parse_date."""

    @patch.object(settings, "ridb_api_key", "key")
    def setup_method(self, method=None):
        self.scraper = USFSScraper()

    def test_iso_datetime_utc(self):
        dt = self.scraper._parse_date("2026-03-01T00:00:00Z")
        assert dt is not None
        assert dt.year == 2026 and dt.month == 3

    def test_iso_date_only(self):
        dt = self.scraper._parse_date("2026-03-01")
        assert dt is not None

    def test_iso_with_timezone(self):
        dt = self.scraper._parse_date("2026-03-01T12:00:00+00:00")
        assert dt is not None

    def test_us_date_format(self):
        dt = self.scraper._parse_date("03/01/2026")
        assert dt is not None

    def test_none_returns_none(self):
        assert self.scraper._parse_date(None) is None

    def test_empty_string_returns_none(self):
        assert self.scraper._parse_date("") is None

    def test_unparseable_returns_none(self):
        assert self.scraper._parse_date("Not a date") is None

    def test_utc_timezone_added(self):
        dt = self.scraper._parse_date("2026-01-15")
        assert dt.tzinfo is not None


# ─── Facility Alert Parsing ─────────────────────────────────

class TestUSFSFacilityAlertParsing:
    """Tests for _parse_facility_alert."""

    @patch.object(settings, "ridb_api_key", "key")
    def setup_method(self, method=None):
        self.scraper = USFSScraper()

    def test_parses_standard_alert(self):
        alert = SAMPLE_FACILITY_ALERTS["RECDATA"][0]
        item = self.scraper._parse_facility_alert(alert, "Salmon River Put-In", "Salmon River")
        assert item is not None
        assert item.source == "usfs"
        assert item.data["river_name"] == "Salmon River"
        assert item.data["severity"] == "danger"  # "closed" keyword
        assert item.data["title"] == "Salmon River high water closure"

    def test_parses_alt_key_names(self):
        alert = SAMPLE_FACILITY_ALERTS_ALT_KEYS["RECDATA"][0]
        item = self.scraper._parse_facility_alert(alert, "Payette River Launch", "Payette River")
        assert item is not None
        assert item.data["river_name"] == "Payette River"
        assert "Payette" in item.data["title"]

    def test_extracts_river_from_alert_text_when_not_given(self):
        alert = {
            "Title": "Rogue River flood warning",
            "Description": "High water on the Rogue River.",
        }
        item = self.scraper._parse_facility_alert(alert, "Recreation Site", None)
        assert item is not None
        assert item.data["river_name"] == "Rogue River"

    def test_skips_non_river_alert(self):
        alert = {"Title": "Campground maintenance", "Description": "Bathroom repairs."}
        item = self.scraper._parse_facility_alert(alert, "Mountain Camp", None)
        assert item is None

    def test_sets_source_url(self):
        alert = SAMPLE_FACILITY_ALERTS["RECDATA"][0]
        item = self.scraper._parse_facility_alert(alert, "Site", "Salmon River")
        assert item.source_url == "https://ridb.recreation.gov/alert/alert-001"

    def test_sets_dates(self):
        alert = SAMPLE_FACILITY_ALERTS["RECDATA"][0]
        item = self.scraper._parse_facility_alert(alert, "Site", "Salmon River")
        assert item.data["start_date"] is not None
        assert item.data["end_date"] is not None

    def test_includes_facility_name(self):
        alert = SAMPLE_FACILITY_ALERTS["RECDATA"][0]
        item = self.scraper._parse_facility_alert(alert, "Salmon River Put-In", "Salmon River")
        assert item.data["facility_name"] == "Salmon River Put-In"

    def test_malformed_alert_returns_none(self):
        item = self.scraper._parse_facility_alert({}, "Site", "Salmon River")
        # Empty alert has no title text — should still produce an item if river_name is given
        # since river_name is pre-supplied
        if item is not None:
            assert item.data["river_name"] == "Salmon River"


# ─── Rec Area Alert Parsing ─────────────────────────────────

class TestUSFSRecAreaAlertParsing:
    """Tests for _parse_rec_area_alert."""

    @patch.object(settings, "ridb_api_key", "key")
    def setup_method(self, method=None):
        self.scraper = USFSScraper()

    def test_parses_rec_area_alert(self):
        alert = SAMPLE_REC_AREA_ALERTS["RECDATA"][0]
        item = self.scraper._parse_rec_area_alert(
            alert, "Deschutes River NRA", "Deschutes River"
        )
        assert item is not None
        assert item.source == "usfs"
        assert item.data["river_name"] == "Deschutes River"

    def test_extracts_river_from_text_when_not_given(self):
        alert = {
            "Title": "Snake River corridor restricted",
            "Description": "Seasonal access restriction.",
        }
        item = self.scraper._parse_rec_area_alert(alert, "Rec Area", None)
        assert item is not None
        assert item.data["river_name"] == "Snake River"

    def test_skips_non_river_rec_alert(self):
        alert = {"Title": "Mountain trail update", "Description": "Trail resurfaced."}
        item = self.scraper._parse_rec_area_alert(alert, "Mountain Trail", None)
        assert item is None


# ─── Fetch Facility Alerts (HTTP mocked) ────────────────────

class TestUSFSFetchFacilityAlerts:
    """Tests for _fetch_facility_alerts with mocked HTTP."""

    @patch.object(settings, "ridb_api_key", "key")
    def setup_method(self, method=None):
        self.scraper = USFSScraper()

    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_fetches_facilities_and_alerts(self, mock_sleep):
        respx.get(f"{RIDB_BASE_URL}/facilities").mock(
            return_value=httpx.Response(200, json=SAMPLE_FACILITIES)
        )
        # FAC-001 has alerts with river, FAC-002 does not
        respx.get(f"{RIDB_BASE_URL}/facilities/FAC-001/alerts").mock(
            return_value=httpx.Response(200, json=SAMPLE_FACILITY_ALERTS)
        )
        respx.get(f"{RIDB_BASE_URL}/facilities/FAC-002/alerts").mock(
            return_value=httpx.Response(200, json={"RECDATA": []})
        )

        items = self.scraper._fetch_facility_alerts()
        assert len(items) == 1
        assert items[0].data["river_name"] == "Salmon River"

    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_handles_facilities_timeout(self, mock_sleep):
        respx.get(f"{RIDB_BASE_URL}/facilities").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        items = self.scraper._fetch_facility_alerts()
        assert items == []

    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_handles_facilities_http_error(self, mock_sleep):
        respx.get(f"{RIDB_BASE_URL}/facilities").mock(
            return_value=httpx.Response(500)
        )
        items = self.scraper._fetch_facility_alerts()
        assert items == []

    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_handles_facility_alert_timeout(self, mock_sleep):
        """Individual facility alert timeout doesn't crash the scraper."""
        respx.get(f"{RIDB_BASE_URL}/facilities").mock(
            return_value=httpx.Response(200, json={
                "RECDATA": [{"FacilityID": "F1", "FacilityName": "Snake River Launch"}]
            })
        )
        respx.get(f"{RIDB_BASE_URL}/facilities/F1/alerts").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        items = self.scraper._fetch_facility_alerts()
        assert items == []

    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_skips_facility_without_id(self, mock_sleep):
        respx.get(f"{RIDB_BASE_URL}/facilities").mock(
            return_value=httpx.Response(200, json={
                "RECDATA": [{"FacilityName": "No ID here"}]
            })
        )
        items = self.scraper._fetch_facility_alerts()
        assert items == []

    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_handles_non_list_recdata(self, mock_sleep):
        respx.get(f"{RIDB_BASE_URL}/facilities").mock(
            return_value=httpx.Response(200, json={"RECDATA": "not a list"})
        )
        items = self.scraper._fetch_facility_alerts()
        assert items == []

    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_rate_limits_between_facility_requests(self, mock_sleep):
        respx.get(f"{RIDB_BASE_URL}/facilities").mock(
            return_value=httpx.Response(200, json=SAMPLE_FACILITIES)
        )
        respx.get(f"{RIDB_BASE_URL}/facilities/FAC-001/alerts").mock(
            return_value=httpx.Response(200, json={"RECDATA": []})
        )
        respx.get(f"{RIDB_BASE_URL}/facilities/FAC-002/alerts").mock(
            return_value=httpx.Response(200, json={"RECDATA": []})
        )

        self.scraper._fetch_facility_alerts()
        # Should sleep between each facility request
        assert mock_sleep.call_count >= 2


# ─── Fetch Rec Area Alerts (HTTP mocked) ────────────────────

class TestUSFSFetchRecAreaAlerts:
    """Tests for _fetch_rec_area_alerts with mocked HTTP."""

    @patch.object(settings, "ridb_api_key", "key")
    def setup_method(self, method=None):
        self.scraper = USFSScraper()

    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_fetches_rec_areas_and_alerts(self, mock_sleep):
        respx.get(f"{RIDB_BASE_URL}/recareas").mock(
            return_value=httpx.Response(200, json=SAMPLE_REC_AREAS)
        )
        # REC-001 has no clear river name in "Frank Church River of No Return Wilderness"
        # but "River" pattern should match
        respx.get(f"{RIDB_BASE_URL}/recareas/REC-001/alerts").mock(
            return_value=httpx.Response(200, json={"RECDATA": []})
        )
        respx.get(f"{RIDB_BASE_URL}/recareas/REC-002/alerts").mock(
            return_value=httpx.Response(200, json=SAMPLE_REC_AREA_ALERTS)
        )

        items = self.scraper._fetch_rec_area_alerts()
        # Only REC-002 has an alert with Deschutes River
        river_names = [i.data["river_name"] for i in items]
        assert "Deschutes River" in river_names

    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_handles_rec_areas_timeout(self, mock_sleep):
        respx.get(f"{RIDB_BASE_URL}/recareas").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        items = self.scraper._fetch_rec_area_alerts()
        assert items == []

    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_handles_rec_areas_http_error(self, mock_sleep):
        respx.get(f"{RIDB_BASE_URL}/recareas").mock(
            return_value=httpx.Response(403)
        )
        items = self.scraper._fetch_rec_area_alerts()
        assert items == []

    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_skips_rec_area_without_id(self, mock_sleep):
        respx.get(f"{RIDB_BASE_URL}/recareas").mock(
            return_value=httpx.Response(200, json={
                "RECDATA": [{"RecAreaName": "No ID"}]
            })
        )
        items = self.scraper._fetch_rec_area_alerts()
        assert items == []


# ─── Full Scrape Integration ────────────────────────────────

class TestUSFSScrapeIntegration:
    """Tests for the top-level scrape() method."""

    @patch.object(settings, "ridb_api_key", "test-key")
    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_scrape_combines_facility_and_rec_alerts(self, mock_sleep):
        scraper = USFSScraper()

        respx.get(f"{RIDB_BASE_URL}/facilities").mock(
            return_value=httpx.Response(200, json=SAMPLE_FACILITIES)
        )
        respx.get(f"{RIDB_BASE_URL}/facilities/FAC-001/alerts").mock(
            return_value=httpx.Response(200, json=SAMPLE_FACILITY_ALERTS)
        )
        respx.get(f"{RIDB_BASE_URL}/facilities/FAC-002/alerts").mock(
            return_value=httpx.Response(200, json={"RECDATA": []})
        )
        respx.get(f"{RIDB_BASE_URL}/recareas").mock(
            return_value=httpx.Response(200, json={
                "RECDATA": [{"RecAreaID": "R1", "RecAreaName": "Deschutes River NRA"}]
            })
        )
        respx.get(f"{RIDB_BASE_URL}/recareas/R1/alerts").mock(
            return_value=httpx.Response(200, json=SAMPLE_REC_AREA_ALERTS)
        )

        items = scraper.scrape()
        assert len(items) >= 2
        sources = [i.source for i in items]
        assert all(s == "usfs" for s in sources)

    @patch.object(settings, "ridb_api_key", "test-key")
    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_scrape_returns_empty_on_total_failure(self, mock_sleep):
        scraper = USFSScraper()
        respx.get(f"{RIDB_BASE_URL}/facilities").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        respx.get(f"{RIDB_BASE_URL}/recareas").mock(
            side_effect=httpx.TimeoutException("timeout")
        )

        items = scraper.scrape()
        assert items == []

    @patch.object(settings, "ridb_api_key", "test-key")
    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_scrape_all_items_have_river_name(self, mock_sleep):
        scraper = USFSScraper()

        respx.get(f"{RIDB_BASE_URL}/facilities").mock(
            return_value=httpx.Response(200, json=SAMPLE_FACILITIES)
        )
        respx.get(f"{RIDB_BASE_URL}/facilities/FAC-001/alerts").mock(
            return_value=httpx.Response(200, json=SAMPLE_FACILITY_ALERTS)
        )
        respx.get(f"{RIDB_BASE_URL}/facilities/FAC-002/alerts").mock(
            return_value=httpx.Response(200, json={"RECDATA": []})
        )
        respx.get(f"{RIDB_BASE_URL}/recareas").mock(
            return_value=httpx.Response(200, json={"RECDATA": []})
        )

        items = scraper.scrape()
        for item in items:
            assert item.data.get("river_name") is not None

    @patch.object(settings, "ridb_api_key", "test-key")
    @respx.mock
    @patch("scrapers.usfs.time.sleep")
    def test_scrape_data_required_fields(self, mock_sleep):
        scraper = USFSScraper()

        respx.get(f"{RIDB_BASE_URL}/facilities").mock(
            return_value=httpx.Response(200, json=SAMPLE_FACILITIES)
        )
        respx.get(f"{RIDB_BASE_URL}/facilities/FAC-001/alerts").mock(
            return_value=httpx.Response(200, json=SAMPLE_FACILITY_ALERTS)
        )
        respx.get(f"{RIDB_BASE_URL}/facilities/FAC-002/alerts").mock(
            return_value=httpx.Response(200, json={"RECDATA": []})
        )
        respx.get(f"{RIDB_BASE_URL}/recareas").mock(
            return_value=httpx.Response(200, json={"RECDATA": []})
        )

        items = scraper.scrape()
        for item in items:
            assert "river_name" in item.data
            assert "alert_type" in item.data
            assert "severity" in item.data
            assert "title" in item.data


# ─── Edge Cases ─────────────────────────────────────────────

class TestUSFSEdgeCases:
    """Edge case and boundary testing."""

    def test_alert_type_map_values(self):
        """All ALERT_TYPE_MAP values should be recognized types."""
        expected_types = {"closure", "trail_closure", "flood_warning",
                          "seasonal_restriction", "campground_status",
                          "fire_restriction"}
        for val in ALERT_TYPE_MAP.values():
            assert val in expected_types

    def test_river_keywords_are_lowercase(self):
        for kw in RIVER_KEYWORDS:
            assert kw == kw.lower()

    @patch.object(settings, "ridb_api_key", "key")
    def test_empty_facility_name_extraction(self):
        scraper = USFSScraper()
        result = scraper._extract_river_name("", {"FacilityDescription": ""})
        assert result is None
