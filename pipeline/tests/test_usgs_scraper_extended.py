"""
Extended tests for the USGS Water Services scraper.

Covers edge cases not in the base test file:
- Malformed API responses (missing fields, wrong types, truncated JSON)
- Rate limiting / HTTP 429 handling
- Timeout handling
- Multiple gauge stations in one request
- Edge cases: no recent readings, negative values, zero flow
- Correct USGS API URL format verification
"""

import httpx
import respx
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from scrapers.usgs import USGSScraper
from config.settings import settings
from tests.conftest import make_mock_river


# ─── Helpers ────────────────────────────────────────────────


def _make_timeseries_entry(site_code, param_code, values):
    """Build a single timeSeries entry for a USGS response."""
    return {
        "sourceInfo": {
            "siteCode": [{"value": site_code}],
            "siteName": f"GAUGE {site_code}",
        },
        "variable": {
            "variableCode": [{"value": param_code}],
        },
        "values": [{"value": values}],
    }


def _make_usgs_response(*timeseries):
    """Build a full USGS JSON response body."""
    return {"value": {"timeSeries": list(timeseries)}}


def _setup_scraper_mock(mock_session_cls, gauge_ids):
    """Set up the USGSScraper with mocked gauge IDs."""
    mock_session = MagicMock()
    mock_session_cls.return_value = mock_session
    rivers = [make_mock_river(id=f"r-{gid}", usgs_gauge_id=gid) for gid in gauge_ids]
    mock_session.query.return_value.filter.return_value.all.return_value = rivers
    return mock_session


# ─── Malformed USGS API Responses ───────────────────────────


class TestMalformedResponses:
    """Test scraper resilience to unexpected API response structures."""

    def setup_method(self):
        self.scraper = USGSScraper()

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_missing_value_key(self, mock_session_cls):
        """Response without 'value' key should return empty list."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json={"something": "else"})
        )
        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_missing_timeseries_key(self, mock_session_cls):
        """Response with 'value' but no 'timeSeries' key."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json={"value": {}})
        )
        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_empty_timeseries_array(self, mock_session_cls):
        """Empty timeSeries array should produce no items."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=_make_usgs_response())
        )
        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_timeseries_with_empty_values(self, mock_session_cls):
        """TimeSeries entry with empty values array should be skipped."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        ts = _make_timeseries_entry("09380000", "00060", [])
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=_make_usgs_response(ts))
        )
        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_timeseries_missing_source_info(self, mock_session_cls):
        """TimeSeries entry without sourceInfo is handled gracefully."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        ts = {
            "variable": {"variableCode": [{"value": "00060"}]},
            "values": [{"value": [{"value": "100", "dateTime": "2026-01-01T00:00:00"}]}],
        }
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=_make_usgs_response(ts))
        )
        # Scraper now catches KeyError gracefully
        result = self.scraper.scrape()
        assert result == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_non_numeric_value(self, mock_session_cls):
        """Non-numeric flow value (e.g., 'Ice') is skipped gracefully."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        ts = _make_timeseries_entry("09380000", "00060",
                                     [{"value": "Ice", "dateTime": "2026-01-01T00:00:00"}])
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=_make_usgs_response(ts))
        )
        # Scraper now catches ValueError and skips non-numeric values
        result = self.scraper.scrape()
        assert isinstance(result, list)

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_html_response_instead_of_json(self, mock_session_cls):
        """HTML response (maintenance page) is handled gracefully."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, text="<html>Under Maintenance</html>",
                                         headers={"content-type": "text/html"})
        )
        # Scraper now catches JSONDecodeError gracefully
        result = self.scraper.scrape()
        assert result == []


# ─── HTTP Error Handling ────────────────────────────────────


class TestHTTPErrorHandling:
    """Test resilience to various HTTP error conditions."""

    def setup_method(self):
        self.scraper = USGSScraper()

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_429_rate_limiting(self, mock_session_cls):
        """HTTP 429 should be handled gracefully."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(429, text="Rate limit exceeded",
                                         headers={"Retry-After": "60"})
        )
        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_503_service_unavailable(self, mock_session_cls):
        """503 should be handled gracefully."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(503, text="Service Unavailable")
        )
        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_404_not_found(self, mock_session_cls):
        """404 for invalid endpoint should be handled."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(404, text="Not Found")
        )
        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_connect_timeout(self, mock_session_cls):
        """Connection timeout should be handled."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            side_effect=httpx.ConnectTimeout("Connection timed out")
        )
        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_read_timeout(self, mock_session_cls):
        """Read timeout should be handled."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            side_effect=httpx.ReadTimeout("Read timed out")
        )
        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_connection_error(self, mock_session_cls):
        """DNS/connection failure should be handled."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            side_effect=httpx.ConnectError("DNS resolution failed")
        )
        items = self.scraper.scrape()
        assert items == []


# ─── Multiple Gauge Stations ───────────────────────────────


class TestMultipleGauges:
    """Test behavior with multiple gauge stations in one request."""

    def setup_method(self):
        self.scraper = USGSScraper()

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_three_gauges_all_parsed(self, mock_session_cls):
        """Three gauges in response → three ScrapedItems."""
        _setup_scraper_mock(mock_session_cls, ["111", "222", "333"])
        response = _make_usgs_response(
            _make_timeseries_entry("111", "00060",
                                    [{"value": "500", "dateTime": "2026-01-01T00:00:00"}]),
            _make_timeseries_entry("222", "00060",
                                    [{"value": "1000", "dateTime": "2026-01-01T00:00:00"}]),
            _make_timeseries_entry("333", "00060",
                                    [{"value": "2000", "dateTime": "2026-01-01T00:00:00"}]),
        )
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=response)
        )
        items = self.scraper.scrape()
        assert len(items) == 3
        codes = {i.data["usgs_gauge_id"] for i in items}
        assert codes == {"111", "222", "333"}

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_mixed_parameters_merged_per_site(self, mock_session_cls):
        """Multiple parameters for the same site should merge into one item."""
        _setup_scraper_mock(mock_session_cls, ["111"])
        response = _make_usgs_response(
            _make_timeseries_entry("111", "00060",
                                    [{"value": "1500", "dateTime": "2026-01-01T00:00:00"}]),
            _make_timeseries_entry("111", "00065",
                                    [{"value": "5.5", "dateTime": "2026-01-01T00:00:00"}]),
            _make_timeseries_entry("111", "00010",
                                    [{"value": "15.0", "dateTime": "2026-01-01T00:00:00"}]),
        )
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=response)
        )
        items = self.scraper.scrape()
        assert len(items) == 1
        assert items[0].data["flow_rate"] == 1500.0
        assert items[0].data["gauge_height"] == 5.5
        # 15°C → 59°F
        assert items[0].data["water_temp"] == pytest.approx(59.0, abs=0.1)

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_comma_separated_sites_in_url(self, mock_session_cls):
        """URL should contain comma-separated site IDs."""
        _setup_scraper_mock(mock_session_cls, ["111", "222"])
        route = respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=_make_usgs_response())
        )
        self.scraper.scrape()
        assert route.called
        request_url = str(route.calls[0].request.url)
        assert "111" in request_url
        assert "222" in request_url

    @patch("scrapers.usgs.SessionLocal")
    def test_no_gauges_skips_request(self, mock_session_cls):
        """If no rivers have USGS gauge IDs, no HTTP request is made."""
        _setup_scraper_mock(mock_session_cls, [])
        # No respx mock → any HTTP call would raise
        items = self.scraper.scrape()
        assert items == []


# ─── Edge Cases: Special Values ─────────────────────────────


class TestEdgeCaseValues:
    """Test handling of unusual flow/gauge/temp values."""

    def setup_method(self):
        self.scraper = USGSScraper()

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_negative_flow_value(self, mock_session_cls):
        """Negative flow (tidal influence) should be parsed as-is."""
        _setup_scraper_mock(mock_session_cls, ["111"])
        response = _make_usgs_response(
            _make_timeseries_entry("111", "00060",
                                    [{"value": "-50", "dateTime": "2026-01-01T00:00:00"}])
        )
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=response)
        )
        items = self.scraper.scrape()
        assert len(items) == 1
        assert items[0].data["flow_rate"] == -50.0

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_zero_flow_value(self, mock_session_cls):
        """Zero flow should be parsed correctly."""
        _setup_scraper_mock(mock_session_cls, ["111"])
        response = _make_usgs_response(
            _make_timeseries_entry("111", "00060",
                                    [{"value": "0", "dateTime": "2026-01-01T00:00:00"}])
        )
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=response)
        )
        items = self.scraper.scrape()
        assert items[0].data["flow_rate"] == 0.0

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_very_large_flow_value(self, mock_session_cls):
        """Very large flow (major flood) should be parsed."""
        _setup_scraper_mock(mock_session_cls, ["111"])
        response = _make_usgs_response(
            _make_timeseries_entry("111", "00060",
                                    [{"value": "500000", "dateTime": "2026-01-01T00:00:00"}])
        )
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=response)
        )
        items = self.scraper.scrape()
        assert items[0].data["flow_rate"] == 500000.0

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_negative_temperature(self, mock_session_cls):
        """Negative Celsius temperature should convert correctly to F."""
        _setup_scraper_mock(mock_session_cls, ["111"])
        response = _make_usgs_response(
            _make_timeseries_entry("111", "00010",
                                    [{"value": "-5", "dateTime": "2026-01-01T00:00:00"}])
        )
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=response)
        )
        items = self.scraper.scrape()
        # -5°C = 23°F
        assert items[0].data["water_temp"] == pytest.approx(23.0, abs=0.1)

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_zero_temperature(self, mock_session_cls):
        """0°C should convert to 32°F."""
        _setup_scraper_mock(mock_session_cls, ["111"])
        response = _make_usgs_response(
            _make_timeseries_entry("111", "00010",
                                    [{"value": "0", "dateTime": "2026-01-01T00:00:00"}])
        )
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=response)
        )
        items = self.scraper.scrape()
        assert items[0].data["water_temp"] == pytest.approx(32.0, abs=0.1)

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_no_recent_readings(self, mock_session_cls):
        """Gauge with no values in the values array."""
        _setup_scraper_mock(mock_session_cls, ["111"])
        ts = {
            "sourceInfo": {"siteCode": [{"value": "111"}]},
            "variable": {"variableCode": [{"value": "00060"}]},
            "values": [{"value": []}],  # no readings
        }
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=_make_usgs_response(ts))
        )
        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_latest_value_selected(self, mock_session_cls):
        """Should pick the last (most recent) value from the values array."""
        _setup_scraper_mock(mock_session_cls, ["111"])
        response = _make_usgs_response(
            _make_timeseries_entry("111", "00060", [
                {"value": "100", "dateTime": "2026-01-01T00:00:00"},
                {"value": "200", "dateTime": "2026-01-01T00:15:00"},
                {"value": "300", "dateTime": "2026-01-01T00:30:00"},
            ])
        )
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=response)
        )
        items = self.scraper.scrape()
        assert items[0].data["flow_rate"] == 300.0  # last value


# ─── URL Format Verification ───────────────────────────────


class TestURLFormat:
    """Verify the scraper constructs the correct USGS API URLs."""

    def setup_method(self):
        self.scraper = USGSScraper()

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_url_contains_format_json(self, mock_session_cls):
        """URL should request JSON format."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        route = respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=_make_usgs_response())
        )
        self.scraper.scrape()
        url = str(route.calls[0].request.url)
        assert "format=json" in url

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_url_contains_parameter_codes(self, mock_session_cls):
        """URL should request flow, gauge height, and temperature params."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        route = respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=_make_usgs_response())
        )
        self.scraper.scrape()
        url = str(route.calls[0].request.url)
        assert "00060" in url  # Discharge
        assert "00065" in url  # Gauge height
        assert "00010" in url  # Temperature

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_url_contains_site_status_active(self, mock_session_cls):
        """URL should request only active sites."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        route = respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=_make_usgs_response())
        )
        self.scraper.scrape()
        url = str(route.calls[0].request.url)
        assert "siteStatus=active" in url

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_source_url_on_items(self, mock_session_cls):
        """Each ScrapedItem should have the correct USGS waterdata URL."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        response = _make_usgs_response(
            _make_timeseries_entry("09380000", "00060",
                                    [{"value": "1000", "dateTime": "2026-01-01T00:00:00"}])
        )
        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=response)
        )
        items = self.scraper.scrape()
        assert items[0].source_url == "https://waterdata.usgs.gov/nwis/uv?site_no=09380000"
        assert items[0].source == "usgs"

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_base_url_from_settings(self, mock_session_cls):
        """Should use settings.usgs_base_url for the API endpoint."""
        _setup_scraper_mock(mock_session_cls, ["09380000"])
        route = respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=_make_usgs_response())
        )
        self.scraper.scrape()
        assert route.called
        url = str(route.calls[0].request.url)
        assert url.startswith(settings.usgs_base_url)
