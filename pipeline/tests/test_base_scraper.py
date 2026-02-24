"""
Tests for the base scraper class and ScrapedItem dataclass.
"""

import logging
from datetime import datetime
from scrapers.base import BaseScraper, ScrapedItem


# ─── ScrapedItem Tests ──────────────────────────────────────


class TestScrapedItem:
    def test_create_with_defaults(self):
        item = ScrapedItem(source="usgs")
        assert item.source == "usgs"
        assert item.source_url is None
        assert item.data == {}
        assert isinstance(item.scraped_at, datetime)

    def test_create_with_all_fields(self):
        now = datetime(2026, 2, 24, 12, 0, 0)
        item = ScrapedItem(
            source="craigslist",
            source_url="https://example.com/listing",
            data={"title": "Test Raft", "price": 500.0},
            scraped_at=now,
        )
        assert item.source == "craigslist"
        assert item.source_url == "https://example.com/listing"
        assert item.data["title"] == "Test Raft"
        assert item.data["price"] == 500.0
        assert item.scraped_at == now

    def test_data_dict_is_mutable(self):
        item = ScrapedItem(source="test")
        item.data["new_key"] = "new_value"
        assert item.data["new_key"] == "new_value"

    def test_unicode_in_data(self):
        """River names can contain unicode characters."""
        item = ScrapedItem(
            source="aw",
            data={
                "name": "Río Grande — Taos Box",
                "description": "Class III–IV whitewater through basalt gorge",
            },
        )
        assert "Río Grande" in item.data["name"]
        assert "–" in item.data["description"]

    def test_empty_data_dict_independence(self):
        """Each ScrapedItem should have its own dict, not a shared default."""
        item1 = ScrapedItem(source="a")
        item2 = ScrapedItem(source="b")
        item1.data["x"] = 1
        assert "x" not in item2.data


# ─── BaseScraper Tests ──────────────────────────────────────


class ConcreteScraper(BaseScraper):
    """Minimal concrete scraper for testing the abstract base."""

    @property
    def name(self) -> str:
        return "test_scraper"

    def scrape(self) -> list[ScrapedItem]:
        items = [
            ScrapedItem(source=self.name, data={"value": 42}),
            ScrapedItem(source=self.name, data={"value": 99}),
        ]
        return items


class TestBaseScraper:
    def test_name_property(self):
        scraper = ConcreteScraper()
        assert scraper.name == "test_scraper"

    def test_scrape_returns_list(self):
        scraper = ConcreteScraper()
        items = scraper.scrape()
        assert isinstance(items, list)
        assert len(items) == 2
        assert all(isinstance(i, ScrapedItem) for i in items)

    def test_logger_is_configured(self):
        scraper = ConcreteScraper()
        assert scraper.logger.name == "pipeline.scrapers.test_scraper"

    def test_log_start(self, caplog):
        scraper = ConcreteScraper()
        with caplog.at_level(logging.INFO, logger="pipeline.scrapers.test_scraper"):
            scraper.log_start()
        assert "Starting test_scraper scraper" in caplog.text

    def test_log_complete(self, caplog):
        scraper = ConcreteScraper()
        with caplog.at_level(logging.INFO, logger="pipeline.scrapers.test_scraper"):
            scraper.log_complete(5)
        assert "test_scraper: scraped 5 items" in caplog.text

    def test_log_error(self, caplog):
        scraper = ConcreteScraper()
        with caplog.at_level(logging.ERROR, logger="pipeline.scrapers.test_scraper"):
            scraper.log_error(ValueError("connection timeout"))
        assert "test_scraper error: connection timeout" in caplog.text

    def test_cannot_instantiate_abstract(self):
        """BaseScraper cannot be instantiated directly."""
        try:
            BaseScraper()  # type: ignore
            assert False, "Should have raised TypeError"
        except TypeError:
            pass

    def test_subclass_must_implement_name(self):
        """Subclass without `name` cannot be instantiated."""

        class IncompleteScraper(BaseScraper):
            def scrape(self):
                return []

        try:
            IncompleteScraper()  # type: ignore
            assert False, "Should have raised TypeError"
        except TypeError:
            pass

    def test_subclass_must_implement_scrape(self):
        """Subclass without `scrape` cannot be instantiated."""

        class IncompleteScraper(BaseScraper):
            @property
            def name(self):
                return "incomplete"

        try:
            IncompleteScraper()  # type: ignore
            assert False, "Should have raised TypeError"
        except TypeError:
            pass
