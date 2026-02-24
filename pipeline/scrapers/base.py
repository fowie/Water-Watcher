"""Base scraper class that all scrapers inherit from."""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class ScrapedItem:
    """A single item produced by a scraper."""
    source: str
    source_url: str | None = None
    data: dict[str, Any] = field(default_factory=dict)
    scraped_at: datetime = field(default_factory=_utc_now)


class BaseScraper(ABC):
    """Base class for all scrapers."""

    def __init__(self):
        self.logger = logging.getLogger(f"pipeline.scrapers.{self.name}")

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique name for this scraper (used in logs and DB)."""
        ...

    @abstractmethod
    def scrape(self) -> list[ScrapedItem]:
        """Run the scraper and return a list of scraped items."""
        ...

    def log_start(self):
        self.logger.info(f"Starting {self.name} scraper")

    def log_complete(self, count: int):
        self.logger.info(f"{self.name}: scraped {count} items")

    def log_error(self, error: Exception):
        self.logger.error(f"{self.name} error: {error}", exc_info=True)
