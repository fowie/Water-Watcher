"""
USFS (US Forest Service) Scraper

Scrapes recreation alerts and conditions from the USFS Recreation Information
Database (RIDB) API for river-related facilities.

API: https://ridb.recreation.gov/api/v1/
Requires: RIDB_API_KEY environment variable

Data extracted:
- Alert type (trail_closure, flood_warning, seasonal_restriction, campground_status)
- Severity (info, warning, danger)
- Description / affected facility
- Dates (start, end)

Source priority: 70 (per BD-002)
"""

import time
from datetime import datetime, timezone

import httpx

from scrapers.base import BaseScraper, ScrapedItem
from config.settings import settings
from models import SessionLocal, River


# RIDB API base
RIDB_BASE_URL = "https://ridb.recreation.gov/api/v1"

# Alert type classification
ALERT_TYPE_MAP = {
    "closure": "closure",
    "closed": "closure",
    "trail closure": "trail_closure",
    "trail closed": "trail_closure",
    "flood": "flood_warning",
    "flood warning": "flood_warning",
    "high water": "flood_warning",
    "seasonal": "seasonal_restriction",
    "winter": "seasonal_restriction",
    "campground": "campground_status",
    "camp": "campground_status",
    "fire": "fire_restriction",
    "burn": "fire_restriction",
    "restriction": "seasonal_restriction",
}

# Water/river related keywords for filtering facility alerts
RIVER_KEYWORDS = [
    "river", "creek", "stream", "waterway", "whitewater",
    "rafting", "kayak", "canoe", "boat ramp", "boat launch",
    "put-in", "take-out", "rapids", "gorge", "canyon",
    "fork", "falls", "dam",
]


class USFSScraper(BaseScraper):
    """Scrapes recreation alerts from US Forest Service RIDB API.

    The RIDB (Recreation Information Database) provides alerts for
    recreation facilities managed by USFS. This scraper filters for
    river-related facilities and extracts advisory information.
    """

    def __init__(self):
        super().__init__()
        self._api_key = settings.ridb_api_key
        self._client = httpx.Client(
            timeout=settings.request_timeout,
            headers={
                "User-Agent": "WaterWatcher/1.0 (river condition tracker)",
                "Accept": "application/json",
                "apikey": self._api_key,
            },
            follow_redirects=True,
        )
        self._rate_limit_delay = 1.0  # 1 second delay between requests

    @property
    def name(self) -> str:
        return "usfs"

    def scrape(self) -> list[ScrapedItem]:
        """Run the USFS scraper and return alert items.

        Fetches facility alerts from RIDB, filters for river-related
        facilities, and returns ScrapedItems with alert data including
        river_name for name-based matching.
        """
        self.log_start()
        items: list[ScrapedItem] = []

        if not self._api_key:
            self.logger.warning("RIDB_API_KEY not configured, skipping USFS scraper")
            return items

        try:
            # Fetch facility alerts
            alert_items = self._fetch_facility_alerts()
            items.extend(alert_items)

            # Fetch recreation area alerts
            time.sleep(self._rate_limit_delay)
            rec_items = self._fetch_rec_area_alerts()
            items.extend(rec_items)

        except Exception as e:
            self.log_error(e)

        self.log_complete(len(items))
        return items

    def _fetch_facility_alerts(self) -> list[ScrapedItem]:
        """Fetch alerts for recreation facilities from RIDB.

        Queries the RIDB facilities endpoint with water-activity filters,
        then fetches alerts for matching facilities.
        """
        items: list[ScrapedItem] = []

        try:
            # Search for river-related facilities with alerts
            params = {
                "query": "river",
                "activity": "WHITEWATER RAFTING,KAYAKING,CANOEING",
                "limit": 50,
                "offset": 0,
            }

            resp = self._client.get(f"{RIDB_BASE_URL}/facilities", params=params)
            resp.raise_for_status()
            data = resp.json()

            facilities = data.get("RECDATA", [])
            if not isinstance(facilities, list):
                facilities = []

            for facility in facilities:
                facility_id = facility.get("FacilityID")
                if not facility_id:
                    continue

                # Rate limit between facility alert requests
                time.sleep(self._rate_limit_delay)

                facility_alerts = self._fetch_alerts_for_facility(
                    facility_id, facility
                )
                items.extend(facility_alerts)

        except httpx.TimeoutException:
            self.logger.warning("RIDB facilities request timed out")
        except httpx.HTTPStatusError as e:
            self.logger.warning(f"RIDB facilities returned HTTP {e.response.status_code}")
        except (httpx.HTTPError, ValueError, KeyError) as e:
            self.logger.warning(f"RIDB facilities fetch failed: {e}")

        return items

    def _fetch_alerts_for_facility(
        self, facility_id: str, facility: dict
    ) -> list[ScrapedItem]:
        """Fetch alerts for a specific facility.

        Args:
            facility_id: RIDB facility ID.
            facility: Facility dict from the facilities response.

        Returns:
            List of ScrapedItems for alerts on this facility.
        """
        items: list[ScrapedItem] = []

        try:
            resp = self._client.get(
                f"{RIDB_BASE_URL}/facilities/{facility_id}/alerts"
            )
            resp.raise_for_status()
            data = resp.json()

            alerts = data.get("RECDATA", [])
            if not isinstance(alerts, list):
                return items

            facility_name = facility.get("FacilityName", "")
            river_name = self._extract_river_name(facility_name, facility)

            for alert in alerts:
                item = self._parse_facility_alert(alert, facility_name, river_name)
                if item:
                    items.append(item)

        except httpx.TimeoutException:
            self.logger.debug(f"Timeout fetching alerts for facility {facility_id}")
        except httpx.HTTPStatusError as e:
            self.logger.debug(
                f"HTTP {e.response.status_code} fetching alerts for facility {facility_id}"
            )
        except (httpx.HTTPError, ValueError) as e:
            self.logger.debug(f"Failed to fetch alerts for facility {facility_id}: {e}")

        return items

    def _fetch_rec_area_alerts(self) -> list[ScrapedItem]:
        """Fetch alerts for recreation areas from RIDB."""
        items: list[ScrapedItem] = []

        try:
            params = {
                "query": "river",
                "limit": 50,
                "offset": 0,
            }

            resp = self._client.get(f"{RIDB_BASE_URL}/recareas", params=params)
            resp.raise_for_status()
            data = resp.json()

            rec_areas = data.get("RECDATA", [])
            if not isinstance(rec_areas, list):
                rec_areas = []

            for area in rec_areas:
                area_id = area.get("RecAreaID")
                if not area_id:
                    continue

                time.sleep(self._rate_limit_delay)

                try:
                    resp = self._client.get(
                        f"{RIDB_BASE_URL}/recareas/{area_id}/alerts"
                    )
                    resp.raise_for_status()
                    alert_data = resp.json()

                    alerts = alert_data.get("RECDATA", [])
                    if not isinstance(alerts, list):
                        continue

                    area_name = area.get("RecAreaName", "")
                    river_name = self._extract_river_name_from_text(area_name)

                    for alert in alerts:
                        item = self._parse_rec_area_alert(alert, area_name, river_name)
                        if item:
                            items.append(item)

                except (httpx.HTTPError, ValueError) as e:
                    self.logger.debug(f"Failed to fetch alerts for rec area {area_id}: {e}")
                    continue

        except httpx.TimeoutException:
            self.logger.warning("RIDB rec areas request timed out")
        except httpx.HTTPStatusError as e:
            self.logger.warning(f"RIDB rec areas returned HTTP {e.response.status_code}")
        except (httpx.HTTPError, ValueError, KeyError) as e:
            self.logger.warning(f"RIDB rec areas fetch failed: {e}")

        return items

    def _parse_facility_alert(
        self, alert: dict, facility_name: str, river_name: str | None
    ) -> ScrapedItem | None:
        """Parse a single facility alert from RIDB.

        Args:
            alert: Alert dict from the RIDB API.
            facility_name: Name of the parent facility.
            river_name: Extracted river name, if any.

        Returns:
            ScrapedItem if parseable, None otherwise.
        """
        try:
            title = alert.get("Title", alert.get("AlertTitle", ""))
            description = alert.get("Description", alert.get("AlertDescription", ""))

            # If we don't have a river name from the facility, try to find one in the alert
            if not river_name:
                river_name = self._extract_river_name_from_text(
                    f"{title} {description} {facility_name}"
                )

            if not river_name:
                return None

            alert_type = self._classify_alert_type(title, description)
            severity = self._classify_severity(title, description)

            start_date = self._parse_date(
                alert.get("StartDate", alert.get("AlertStartDate"))
            )
            end_date = self._parse_date(
                alert.get("EndDate", alert.get("AlertEndDate"))
            )

            alert_url = alert.get("URL", alert.get("AlertURL"))

            return ScrapedItem(
                source="usfs",
                source_url=alert_url,
                data={
                    "river_name": river_name,
                    "alert_type": alert_type,
                    "severity": severity,
                    "title": title,
                    "description": description or None,
                    "facility_name": facility_name,
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None,
                },
            )
        except (KeyError, TypeError, ValueError) as e:
            self.logger.debug(f"Skipping malformed USFS alert: {e}")
            return None

    def _parse_rec_area_alert(
        self, alert: dict, area_name: str, river_name: str | None
    ) -> ScrapedItem | None:
        """Parse a single recreation area alert from RIDB.

        Args:
            alert: Alert dict from the RIDB API.
            area_name: Name of the recreation area.
            river_name: Extracted river name, if any.

        Returns:
            ScrapedItem if parseable, None otherwise.
        """
        try:
            title = alert.get("Title", alert.get("AlertTitle", ""))
            description = alert.get("Description", alert.get("AlertDescription", ""))

            if not river_name:
                river_name = self._extract_river_name_from_text(
                    f"{title} {description} {area_name}"
                )

            if not river_name:
                return None

            alert_type = self._classify_alert_type(title, description)
            severity = self._classify_severity(title, description)

            start_date = self._parse_date(
                alert.get("StartDate", alert.get("AlertStartDate"))
            )
            end_date = self._parse_date(
                alert.get("EndDate", alert.get("AlertEndDate"))
            )

            alert_url = alert.get("URL", alert.get("AlertURL"))

            return ScrapedItem(
                source="usfs",
                source_url=alert_url,
                data={
                    "river_name": river_name,
                    "alert_type": alert_type,
                    "severity": severity,
                    "title": title,
                    "description": description or None,
                    "facility_name": area_name,
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None,
                },
            )
        except (KeyError, TypeError, ValueError) as e:
            self.logger.debug(f"Skipping malformed USFS rec area alert: {e}")
            return None

    def _extract_river_name(self, facility_name: str, facility: dict) -> str | None:
        """Extract river name from a facility name and metadata.

        Args:
            facility_name: The facility's display name.
            facility: Full facility dict from RIDB.

        Returns:
            River name string or None.
        """
        # Check facility name first
        river = self._extract_river_name_from_text(facility_name)
        if river:
            return river

        # Try facility description
        desc = facility.get("FacilityDescription", "")
        if desc:
            river = self._extract_river_name_from_text(desc)
            if river:
                return river

        return None

    def _extract_river_name_from_text(self, text: str) -> str | None:
        """Extract a river name from free text using pattern matching.

        Args:
            text: Text that may contain a river name reference.

        Returns:
            Extracted river name or None.
        """
        import re

        if not text:
            return None

        patterns = [
            r"(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+River\b)",
            r"(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Creek\b)",
            r"(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Canyon\b)",
            r"(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Fork\b)",
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()

        return None

    def _classify_alert_type(self, title: str, description: str) -> str:
        """Classify an alert into a type based on text content.

        Args:
            title: Alert title.
            description: Alert description.

        Returns:
            Alert type string.
        """
        text = f"{title} {description}".lower()

        for keyword, alert_type in ALERT_TYPE_MAP.items():
            if keyword in text:
                return alert_type

        return "general"

    def _classify_severity(self, title: str, description: str) -> str:
        """Classify alert severity based on keywords.

        Args:
            title: Alert title.
            description: Alert description.

        Returns:
            Severity string: "danger", "warning", or "info".
        """
        text = f"{title} {description}".lower()

        danger_keywords = ["closed", "closure", "flood", "emergency", "evacuate", "dangerous"]
        warning_keywords = ["warning", "caution", "advisory", "fire", "high water", "restricted"]

        for keyword in danger_keywords:
            if keyword in text:
                return "danger"

        for keyword in warning_keywords:
            if keyword in text:
                return "warning"

        return "info"

    def _parse_date(self, date_str: str | None) -> datetime | None:
        """Try to parse a date string in common RIDB formats.

        Args:
            date_str: Date string or None.

        Returns:
            Parsed datetime in UTC, or None.
        """
        if not date_str:
            return None

        formats = [
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
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

        self.logger.debug(f"Could not parse RIDB date: {date_str}")
        return None
