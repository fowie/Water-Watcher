"""
Tests for the USGS Water Services scraper.

Mocks HTTP responses with realistic USGS JSON data and verifies:
- Correct parsing of flow rate, gauge height, and temperature
- Temperature conversion (°C → °F)
- Multiple gauge sites in one response
- Empty response handling
- HTTP error handling (timeouts, 429 rate limiting, 500 errors)
- Malformed/unexpected response structures
"""

import httpx
import respx
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock

from scrapers.usgs import USGSScraper
from scrapers.base import ScrapedItem
from config.settings import settings
from tests.conftest import (
    USGS_RESPONSE_JSON,
    USGS_EMPTY_RESPONSE,
    USGS_MALFORMED_RESPONSE,
    make_mock_river,
)


class TestUSGSScraper:
    """Tests for USGSScraper."""

    def setup_method(self):
        self.scraper = USGSScraper()

    def test_name(self):
        assert self.scraper.name == "usgs"

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_scrape_parses_flow_rate(self, mock_session_cls):
        """Should parse CFS (parameter 00060) from USGS response."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = [
            make_mock_river(usgs_gauge_id="09380000"),
        ]

        url_pattern = f"{settings.usgs_base_url}/iv/"
        respx.get(url_pattern).mock(
            return_value=httpx.Response(200, json=USGS_RESPONSE_JSON)
        )

        items = self.scraper.scrape()
        lees_ferry = [i for i in items if i.data["usgs_gauge_id"] == "09380000"]
        assert len(lees_ferry) == 1
        assert lees_ferry[0].data["flow_rate"] == 12800.0  # latest value

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_scrape_parses_gauge_height(self, mock_session_cls):
        """Should parse gauge height in feet (parameter 00065)."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = [
            make_mock_river(usgs_gauge_id="09380000"),
        ]

        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=USGS_RESPONSE_JSON)
        )

        items = self.scraper.scrape()
        assert items[0].data["gauge_height"] == 6.42

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_scrape_converts_temp_c_to_f(self, mock_session_cls):
        """Should convert water temperature from °C to °F."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = [
            make_mock_river(usgs_gauge_id="09380000"),
        ]

        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=USGS_RESPONSE_JSON)
        )

        items = self.scraper.scrape()
        lees_ferry = [i for i in items if i.data["usgs_gauge_id"] == "09380000"][0]
        # 8.5°C = 47.3°F
        assert lees_ferry.data["water_temp"] == pytest.approx(47.3, abs=0.1)

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_scrape_multiple_sites(self, mock_session_cls):
        """Should parse data for multiple gauge sites in one response."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = [
            make_mock_river(id="r1", usgs_gauge_id="09380000"),
            make_mock_river(id="r2", usgs_gauge_id="13317000"),
        ]

        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=USGS_RESPONSE_JSON)
        )

        items = self.scraper.scrape()
        assert len(items) == 2
        site_codes = {i.data["usgs_gauge_id"] for i in items}
        assert site_codes == {"09380000", "13317000"}

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_scrape_site_without_temp(self, mock_session_cls):
        """Salmon River has no temp data; water_temp should be None."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = [
            make_mock_river(id="r2", usgs_gauge_id="13317000"),
        ]

        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=USGS_RESPONSE_JSON)
        )

        items = self.scraper.scrape()
        salmon = [i for i in items if i.data["usgs_gauge_id"] == "13317000"]
        assert len(salmon) == 1
        assert salmon[0].data["water_temp"] is None

    @patch("scrapers.usgs.SessionLocal")
    def test_scrape_no_gauge_ids(self, mock_session_cls):
        """Should return empty list if no rivers have USGS gauge IDs."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = []

        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_scrape_empty_timeseries(self, mock_session_cls):
        """Should return empty list when USGS returns no timeSeries."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = [
            make_mock_river(usgs_gauge_id="09380000"),
        ]

        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=USGS_EMPTY_RESPONSE)
        )

        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_scrape_handles_http_error(self, mock_session_cls):
        """Should gracefully handle HTTP errors (500, etc)."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = [
            make_mock_river(usgs_gauge_id="09380000"),
        ]

        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(500, text="Internal Server Error")
        )

        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_scrape_handles_rate_limiting(self, mock_session_cls):
        """Should handle 429 Too Many Requests gracefully."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = [
            make_mock_river(usgs_gauge_id="09380000"),
        ]

        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(429, text="Rate limit exceeded")
        )

        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_scrape_handles_timeout(self, mock_session_cls):
        """Should handle request timeouts gracefully."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = [
            make_mock_river(usgs_gauge_id="09380000"),
        ]

        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            side_effect=httpx.ConnectTimeout("Connection timed out")
        )

        items = self.scraper.scrape()
        assert items == []

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_scrape_sets_source_url(self, mock_session_cls):
        """Each item should have a USGS source URL with the site number."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = [
            make_mock_river(usgs_gauge_id="09380000"),
        ]

        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=USGS_RESPONSE_JSON)
        )

        items = self.scraper.scrape()
        assert "09380000" in items[0].source_url

    @respx.mock
    @patch("scrapers.usgs.SessionLocal")
    def test_scrape_malformed_response(self, mock_session_cls):
        """Should handle responses with unexpected structure."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = [
            make_mock_river(usgs_gauge_id="09380000"),
        ]

        respx.get(f"{settings.usgs_base_url}/iv/").mock(
            return_value=httpx.Response(200, json=USGS_MALFORMED_RESPONSE)
        )

        # Should not crash — may return empty list or raise handled error
        items = self.scraper.scrape()
        assert isinstance(items, list)
