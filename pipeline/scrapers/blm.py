"""
BLM (Bureau of Land Management) Scraper

Scrapes river recreation advisories from BLM's public API / RSS feeds.
Targets: river closures, fire restrictions, water level advisories, seasonal access info.

Data extracted:
- Advisory type (closure, fire_restriction, water_advisory, seasonal_access)
- Severity (info, warning, danger)
- Affected area / river name
- Start and end dates
- Description

Source priority: 70 (per BD-002)
"""

import time
import uuid
from datetime import datetime, timezone

import httpx
from xml.etree import ElementTree

from scrapers.base import BaseScraper, ScrapedItem
from config.settings import settings
from models import SessionLocal, River


# Advisory type normalization
ADVISORY_TYPE_MAP = {
    "closure": "closure",
    "closed": "closure",
    "fire": "fire_restriction",
    "fire restriction": "fire_restriction",
    "burn ban": "fire_restriction",
    "water": "water_advisory",
    "water level": "water_advisory",
    "flood": "water_advisory",
    "high water": "water_advisory",
    "seasonal": "seasonal_access",
    "seasonal closure": "seasonal_access",
    "winter closure": "seasonal_access",
    "permit": "permit_required",
}

# Severity mapping based on advisory keywords
SEVERITY_KEYWORDS = {
    "danger": ["closed", "closure", "flood", "emergency", "evacuate", "dangerous"],
    "warning": ["warning", "caution", "advisory", "fire restriction", "high water", "restricted"],
    "info": ["seasonal", "permit", "information", "notice", "update", "open"],
}


class BLMScraper(BaseScraper):
    """Scrapes river corridor advisories from Bureau of Land Management.

    BLM manages significant stretches of river corridor across the western US.
    This scraper fetches recreation advisories, closures, and access information
    from BLM's public data feeds.
    """

    def __init__(self):
        super().__init__()
        self._client = httpx.Client(
            timeout=settings.request_timeout,
            headers={
                "User-Agent": "WaterWatcher/1.0 (river condition tracker)",
                "Accept": "application/json, application/xml, text/xml",
            },
            follow_redirects=True,
        )
        self._rate_limit_delay = 2.0  # 2 second delay between requests

    @property
    def name(self) -> str:
        return "blm"

    def _get_tracked_rivers(self) -> list:
        """Get all tracked rivers from the database."""
        session = SessionLocal()
        try:
            return session.query(River).all()
        finally:
            session.close()

    def scrape(self) -> list[ScrapedItem]:
        """Run the BLM scraper and return advisory items.

        Fetches from BLM's recreation advisory API, parses results,
        and returns ScrapedItems with advisory data including river_name
        for name-based matching in the condition processor.
        """
        self.log_start()
        items: list[ScrapedItem] = []

        try:
            # Fetch advisories from BLM API
            api_items = self._fetch_advisories()
            items.extend(api_items)

            # Also try RSS feed for supplementary data
            rss_items = self._fetch_rss_advisories()
            items.extend(rss_items)

        except Exception as e:
            self.log_error(e)

        self.log_complete(len(items))
        return items

    def _fetch_advisories(self) -> list[ScrapedItem]:
        """Fetch advisories from BLM's recreation API."""
        items: list[ScrapedItem] = []
        base_url = settings.blm_base_url

        try:
            params = {
                "format": "json",
                "activity": "whitewater,rafting,kayaking,river",
                "status": "active",
            }

            resp = self._client.get(f"{base_url}/api/alerts", params=params)
            resp.raise_for_status()
            data = resp.json()

            alerts = []
            if isinstance(data, list):
                alerts = data
            elif isinstance(data, dict):
                alerts = data.get("alerts", data.get("results", data.get("features", [])))

            for alert in alerts:
                item = self._parse_alert(alert)
                if item:
                    items.append(item)

            time.sleep(self._rate_limit_delay)

        except httpx.TimeoutException:
            self.logger.warning("BLM API request timed out")
        except httpx.HTTPStatusError as e:
            self.logger.warning(f"BLM API returned HTTP {e.response.status_code}")
        except (httpx.HTTPError, ValueError, KeyError) as e:
            self.logger.warning(f"BLM API fetch failed: {e}")

        return items

    def _fetch_rss_advisories(self) -> list[ScrapedItem]:
        """Fetch advisories from BLM's RSS feed."""
        items: list[ScrapedItem] = []
        base_url = settings.blm_base_url

        try:
            time.sleep(self._rate_limit_delay)

            resp = self._client.get(f"{base_url}/rss/alerts.xml")
            resp.raise_for_status()

            items = self._parse_rss(resp.text)

        except httpx.TimeoutException:
            self.logger.warning("BLM RSS request timed out")
        except httpx.HTTPStatusError as e:
            self.logger.warning(f"BLM RSS returned HTTP {e.response.status_code}")
        except (httpx.HTTPError, Exception) as e:
            self.logger.warning(f"BLM RSS fetch failed: {e}")

        return items

    def _parse_alert(self, alert: dict) -> ScrapedItem | None:
        """Parse a single alert from the BLM API response.

        Args:
            alert: Dict from the API response representing one advisory.

        Returns:
            ScrapedItem if the alert is river-related, None otherwise.
        """
        try:
            # Extract fields — handle varying API structures
            title = (
                alert.get("title")
                or alert.get("name")
                or alert.get("attributes", {}).get("title", "")
            )
            description = (
                alert.get("description")
                or alert.get("summary")
                or alert.get("attributes", {}).get("description", "")
            )
            affected_area = (
                alert.get("area")
                or alert.get("location")
                or alert.get("attributes", {}).get("area_name", "")
            )

            # Try to extract river name from title or affected area
            river_name = self._extract_river_name(title, affected_area, description)
            if not river_name:
                # Skip non-river advisories
                return None

            advisory_type = self._classify_advisory_type(title, description)
            severity = self._classify_severity(title, description)

            # Parse dates
            start_date = self._parse_date(
                alert.get("start_date")
                or alert.get("startDate")
                or alert.get("attributes", {}).get("start_date")
            )
            end_date = self._parse_date(
                alert.get("end_date")
                or alert.get("endDate")
                or alert.get("attributes", {}).get("end_date")
            )

            source_url = (
                alert.get("url")
                or alert.get("link")
                or alert.get("attributes", {}).get("url")
            )

            return ScrapedItem(
                source="blm",
                source_url=source_url,
                data={
                    "river_name": river_name,
                    "advisory_type": advisory_type,
                    "severity": severity,
                    "title": title,
                    "description": description or None,
                    "affected_area": affected_area or None,
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None,
                },
            )
        except (KeyError, TypeError, ValueError) as e:
            self.logger.debug(f"Skipping malformed BLM alert: {e}")
            return None

    def _parse_rss(self, xml_text: str) -> list[ScrapedItem]:
        """Parse BLM RSS feed XML into ScrapedItems.

        Args:
            xml_text: Raw XML string from the RSS feed.

        Returns:
            List of ScrapedItems parsed from the feed.
        """
        items: list[ScrapedItem] = []

        try:
            root = ElementTree.fromstring(xml_text)
        except ElementTree.ParseError as e:
            self.logger.warning(f"Failed to parse BLM RSS XML: {e}")
            return items

        # Handle both RSS 2.0 and Atom formats
        ns = {"atom": "http://www.w3.org/2005/Atom"}

        # RSS 2.0: channel/item
        for item_el in root.findall(".//item"):
            title_el = item_el.find("title")
            desc_el = item_el.find("description")
            link_el = item_el.find("link")
            date_el = item_el.find("pubDate")

            if title_el is None:
                continue

            title = title_el.text or ""
            description = desc_el.text if desc_el is not None else ""
            link = link_el.text if link_el is not None else None
            pub_date = date_el.text if date_el is not None else None

            river_name = self._extract_river_name(title, "", description)
            if not river_name:
                continue

            advisory_type = self._classify_advisory_type(title, description)
            severity = self._classify_severity(title, description)
            start_date = self._parse_date(pub_date)

            items.append(ScrapedItem(
                source="blm",
                source_url=link,
                data={
                    "river_name": river_name,
                    "advisory_type": advisory_type,
                    "severity": severity,
                    "title": title,
                    "description": description or None,
                    "affected_area": None,
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": None,
                },
            ))

        # Atom format fallback
        for entry in root.findall("atom:entry", ns):
            title_el = entry.find("atom:title", ns)
            summary_el = entry.find("atom:summary", ns)
            link_el = entry.find("atom:link", ns)
            updated_el = entry.find("atom:updated", ns)

            if title_el is None:
                continue

            title = title_el.text or ""
            description = summary_el.text if summary_el is not None else ""
            link = link_el.get("href") if link_el is not None else None
            updated = updated_el.text if updated_el is not None else None

            river_name = self._extract_river_name(title, "", description)
            if not river_name:
                continue

            advisory_type = self._classify_advisory_type(title, description)
            severity = self._classify_severity(title, description)
            start_date = self._parse_date(updated)

            items.append(ScrapedItem(
                source="blm",
                source_url=link,
                data={
                    "river_name": river_name,
                    "advisory_type": advisory_type,
                    "severity": severity,
                    "title": title,
                    "description": description or None,
                    "affected_area": None,
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": None,
                },
            ))

        return items

    def _extract_river_name(self, title: str, area: str, description: str) -> str | None:
        """Try to extract a river name from advisory text.

        Looks for common patterns like "X River", "X Creek", "X Canyon"
        in the title, affected area, and description.

        Args:
            title: Advisory title text.
            area: Affected area text.
            description: Full description text.

        Returns:
            Extracted river name or None if no river reference found.
        """
        import re

        # Combine all text fields
        combined = f"{title} {area} {description}".strip()
        if not combined:
            return None

        # River name patterns — look for "[Name] River" or "[Name] Creek" etc.
        patterns = [
            r"(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+River\b)",
            r"(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Creek\b)",
            r"(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Canyon\b)",
            r"(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Fork\b)",
        ]

        for pattern in patterns:
            match = re.search(pattern, combined)
            if match:
                return match.group(1).strip()

        return None

    def _classify_advisory_type(self, title: str, description: str) -> str:
        """Classify an advisory into a type based on its text content.

        Args:
            title: Advisory title.
            description: Advisory description.

        Returns:
            Advisory type string.
        """
        text = f"{title} {description}".lower()

        for keyword, advisory_type in ADVISORY_TYPE_MAP.items():
            if keyword in text:
                return advisory_type

        return "general"

    def _classify_severity(self, title: str, description: str) -> str:
        """Classify the severity of an advisory based on keywords.

        Args:
            title: Advisory title.
            description: Advisory description.

        Returns:
            Severity string: "danger", "warning", or "info".
        """
        text = f"{title} {description}".lower()

        # Check danger first (highest priority)
        for keyword in SEVERITY_KEYWORDS["danger"]:
            if keyword in text:
                return "danger"

        for keyword in SEVERITY_KEYWORDS["warning"]:
            if keyword in text:
                return "warning"

        return "info"

    def _parse_date(self, date_str: str | None) -> datetime | None:
        """Try to parse a date string in various formats.

        Args:
            date_str: Date string to parse, or None.

        Returns:
            Parsed datetime in UTC, or None.
        """
        if not date_str:
            return None

        formats = [
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%a, %d %b %Y %H:%M:%S %z",  # RFC 822 (RSS)
            "%a, %d %b %Y %H:%M:%S GMT",
            "%m/%d/%Y",
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                continue

        self.logger.debug(f"Could not parse date: {date_str}")
        return None

    @staticmethod
    def _parse_float(value: str) -> float | None:
        """Safely parse a float from a string."""
        try:
            return float(value.replace(",", ""))
        except (ValueError, AttributeError):
            return None
