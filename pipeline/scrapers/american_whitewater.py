"""
American Whitewater Scraper

Scrapes river information, conditions, and rapid descriptions from
American Whitewater (americanwhitewater.org).

Uses AW's semi-public JSON endpoints for reach details and gauge data,
and falls back to HTML scraping for trip reports and hazard information.

Data extracted:
- River/reach details (name, section, difficulty, description)
- Current gauge readings and recommended flow ranges
- Rapid names, ratings, and descriptions
- Recent user trip reports
- Hazard alerts and warnings
"""

import time
import uuid
from datetime import datetime

import httpx
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedItem
from config.settings import settings
from models import SessionLocal, River, Hazard


# AW API base URL
AW_API_BASE = "https://www.americanwhitewater.org/content"

# Difficulty class mapping for normalization
DIFFICULTY_MAP = {
    "I": "Class I",
    "I-II": "Class I-II",
    "II": "Class II",
    "II-III": "Class II-III",
    "III": "Class III",
    "III-IV": "Class III-IV",
    "IV": "Class IV",
    "IV-V": "Class IV-V",
    "V": "Class V",
    "V+": "Class V+",
    "VI": "Class VI",
}


class AmericanWhitewaterScraper(BaseScraper):
    """Scrapes river condition data from American Whitewater.

    AW organizes rivers by 'reach' IDs. Each reach represents a specific
    section of a river. This scraper fetches reach details, gauge readings,
    rapid descriptions, and recent trip reports.
    """

    def __init__(self):
        super().__init__()
        self._client = httpx.Client(
            timeout=settings.request_timeout,
            headers={
                "User-Agent": "WaterWatcher/1.0 (river condition tracker)",
                "Accept": "application/json, text/html",
            },
            follow_redirects=True,
        )

    @property
    def name(self) -> str:
        return "aw"

    def _get_tracked_aw_ids(self) -> list[str]:
        """Get American Whitewater reach IDs for all tracked rivers."""
        session = SessionLocal()
        try:
            rivers = (
                session.query(River)
                .filter(River.aw_id.isnot(None))
                .all()
            )
            return [r.aw_id for r in rivers]
        finally:
            session.close()

    def _fetch_reach_detail(self, reach_id: str) -> dict | None:
        """Fetch reach detail from AW's JSON endpoint.

        Args:
            reach_id: The AW reach numeric ID.

        Returns:
            Parsed JSON dict with reach info, or None on failure.
        """
        url = f"{AW_API_BASE}/River/detail/id/{reach_id}/.json"
        try:
            resp = self._client.get(url)
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, dict) else None
        except (httpx.HTTPError, ValueError) as e:
            self.logger.warning(f"Failed to fetch reach {reach_id} detail: {e}")
            return None

    def _fetch_gauge_data(self, reach_id: str) -> list[dict]:
        """Fetch gauge readings for a reach.

        AW associates gauges with reaches. This returns the current
        gauge reading(s) and recommended flow ranges.

        Args:
            reach_id: The AW reach numeric ID.

        Returns:
            List of gauge data dicts with readings and ranges.
        """
        url = f"{AW_API_BASE}/River/detail/id/{reach_id}/"
        try:
            resp = self._client.get(url)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            gauges = []

            # Parse gauge info from the reach detail page
            gauge_table = soup.find("table", class_="gaugeTable")
            if not gauge_table:
                # Try alternate selectors — AW layout varies
                gauge_section = soup.find("div", id="gauge-container") or soup.find(
                    "div", class_="gauge-info"
                )
                if gauge_section:
                    return self._parse_gauge_section(gauge_section)
                return gauges

            for row in gauge_table.find_all("tr")[1:]:  # skip header
                cells = row.find_all("td")
                if len(cells) >= 3:
                    gauge = {
                        "name": cells[0].get_text(strip=True),
                        "reading": self._parse_float(cells[1].get_text(strip=True)),
                        "unit": cells[2].get_text(strip=True) if len(cells) > 2 else "cfs",
                    }
                    gauges.append(gauge)

            return gauges
        except (httpx.HTTPError, Exception) as e:
            self.logger.warning(f"Failed to fetch gauge data for reach {reach_id}: {e}")
            return []

    def _parse_gauge_section(self, section) -> list[dict]:
        """Parse gauge info from a div section on the reach page."""
        gauges = []
        text = section.get_text(" ", strip=True)
        # Look for patterns like "Current Level: 450 cfs"
        import re

        reading_match = re.search(r"(?:current|level|reading)[:\s]+([0-9,.]+)\s*(cfs|ft)", text, re.IGNORECASE)
        if reading_match:
            gauges.append({
                "name": "primary",
                "reading": self._parse_float(reading_match.group(1)),
                "unit": reading_match.group(2).lower(),
            })
        return gauges

    def _fetch_rapids(self, reach_id: str) -> list[dict]:
        """Scrape rapid descriptions from the reach page.

        Args:
            reach_id: The AW reach numeric ID.

        Returns:
            List of rapid dicts with name, difficulty, mile, description.
        """
        url = f"{AW_API_BASE}/River/detail/id/{reach_id}/"
        rapids = []
        try:
            resp = self._client.get(url)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")

            # AW lists rapids in a structured section
            rapid_elements = soup.find_all("div", class_="rapid") or soup.find_all(
                "div", class_="rapid-detail"
            )

            for elem in rapid_elements:
                name_el = elem.find(["h3", "h4", "strong", "span"], class_=lambda c: c and "name" in c.lower() if c else False)
                name = name_el.get_text(strip=True) if name_el else elem.find(["h3", "h4"])
                if name and hasattr(name, "get_text"):
                    name = name.get_text(strip=True)
                if not name:
                    continue

                desc_el = elem.find("p") or elem.find("div", class_="description")
                description = desc_el.get_text(strip=True) if desc_el else None

                diff_el = elem.find(class_=lambda c: c and "class" in c.lower() if c else False)
                difficulty = diff_el.get_text(strip=True) if diff_el else None

                rapids.append({
                    "name": str(name),
                    "difficulty": difficulty,
                    "description": description,
                })

            # Fallback: try parsing from a rapids table
            if not rapids:
                rapids_table = soup.find("table", id="rapids") or soup.find(
                    "table", class_="rapids"
                )
                if rapids_table:
                    for row in rapids_table.find_all("tr")[1:]:
                        cells = row.find_all("td")
                        if len(cells) >= 2:
                            rapids.append({
                                "name": cells[0].get_text(strip=True),
                                "difficulty": cells[1].get_text(strip=True) if len(cells) > 1 else None,
                                "description": cells[2].get_text(strip=True) if len(cells) > 2 else None,
                            })

        except (httpx.HTTPError, Exception) as e:
            self.logger.warning(f"Failed to fetch rapids for reach {reach_id}: {e}")

        return rapids

    def _fetch_trip_reports(self, reach_id: str, max_pages: int = 2) -> list[dict]:
        """Scrape recent trip reports for a reach.

        Args:
            reach_id: The AW reach numeric ID.
            max_pages: Maximum number of pages to scrape (for pagination).

        Returns:
            List of trip report dicts with date, flow, quality, and comments.
        """
        reports = []
        for page in range(max_pages):
            url = f"{AW_API_BASE}/River/detail/id/{reach_id}/"
            if page > 0:
                url += f"?page={page + 1}"

            try:
                resp = self._client.get(url)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "lxml")

                report_elements = soup.find_all("div", class_="trip-report") or soup.find_all(
                    "div", class_="report"
                )

                if not report_elements:
                    break  # No more reports on this page

                for elem in report_elements:
                    date_el = elem.find(class_=lambda c: c and "date" in c.lower() if c else False)
                    date_text = date_el.get_text(strip=True) if date_el else None

                    flow_el = elem.find(class_=lambda c: c and ("flow" in c.lower() or "level" in c.lower()) if c else False)
                    flow_text = flow_el.get_text(strip=True) if flow_el else None

                    comment_el = elem.find("p") or elem.find(class_="comment")
                    comment = comment_el.get_text(strip=True) if comment_el else None

                    quality_el = elem.find(class_=lambda c: c and "quality" in c.lower() if c else False)
                    quality = quality_el.get_text(strip=True) if quality_el else None

                    reports.append({
                        "date": date_text,
                        "flow": self._parse_float(flow_text) if flow_text else None,
                        "quality": quality,
                        "comment": comment,
                    })

                # Rate limiting between pages
                if page < max_pages - 1:
                    time.sleep(settings.rate_limit_delay)

            except (httpx.HTTPError, Exception) as e:
                self.logger.warning(f"Failed to fetch trip reports page {page} for reach {reach_id}: {e}")
                break

        return reports

    def _fetch_hazards(self, reach_id: str) -> list[dict]:
        """Scrape hazard/alert information for a reach.

        Args:
            reach_id: The AW reach numeric ID.

        Returns:
            List of hazard dicts with type, severity, title, description.
        """
        hazards = []
        url = f"{AW_API_BASE}/River/detail/id/{reach_id}/"
        try:
            resp = self._client.get(url)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")

            alert_elements = soup.find_all("div", class_="alert") or soup.find_all(
                "div", class_="hazard"
            )

            for elem in alert_elements:
                title_el = elem.find(["h3", "h4", "strong"])
                title = title_el.get_text(strip=True) if title_el else "Unknown hazard"

                desc_el = elem.find("p")
                description = desc_el.get_text(strip=True) if desc_el else None

                # Determine severity from CSS classes or text
                classes = " ".join(elem.get("class", []))
                if "danger" in classes or "critical" in classes:
                    severity = "danger"
                elif "warning" in classes or "caution" in classes:
                    severity = "warning"
                else:
                    severity = "info"

                # Classify hazard type from content
                hazard_type = self._classify_hazard(title, description or "")

                hazards.append({
                    "type": hazard_type,
                    "severity": severity,
                    "title": title,
                    "description": description,
                })

        except (httpx.HTTPError, Exception) as e:
            self.logger.warning(f"Failed to fetch hazards for reach {reach_id}: {e}")

        return hazards

    def _classify_hazard(self, title: str, description: str) -> str:
        """Classify a hazard into a type based on its text content."""
        text = f"{title} {description}".lower()
        if any(w in text for w in ("strainer", "tree", "log", "wood", "debris")):
            return "strainer"
        if any(w in text for w in ("dam", "diversion", "weir")):
            return "dam"
        if any(w in text for w in ("logjam", "log jam", "blockage")):
            return "logjam"
        if any(w in text for w in ("closure", "closed", "permit")):
            return "closure"
        if any(w in text for w in ("rapid", "hole", "hydraulic", "undercut")):
            return "rapid_change"
        return "rapid_change"

    def _extract_reach_data(self, reach_detail: dict) -> dict:
        """Extract structured data from AW's reach detail JSON response.

        Args:
            reach_detail: Raw JSON response from AW reach detail endpoint.

        Returns:
            Normalized dict with reach information.
        """
        info = reach_detail.get("info", reach_detail.get("CContainerViewJSON_view", {}))
        if isinstance(info, dict):
            reach = info.get("CRiverMainGadgetJSON_main", info)
        else:
            reach = reach_detail

        # Handle nested data structures — AW's API format varies
        river_info = reach.get("river", reach) if isinstance(reach, dict) else {}

        name = river_info.get("name", river_info.get("river", ""))
        section = river_info.get("section", river_info.get("altname", ""))
        difficulty = river_info.get("class", river_info.get("difficulty", ""))
        description = river_info.get("description", "")

        # Normalize difficulty
        if difficulty and difficulty in DIFFICULTY_MAP:
            difficulty = DIFFICULTY_MAP[difficulty]

        # Extract recommended flow range
        flow_range = {}
        gauge_info = river_info.get("gaugeinfo", river_info.get("gauge", {}))
        if isinstance(gauge_info, dict):
            flow_range = {
                "min": self._parse_float(gauge_info.get("minimum", gauge_info.get("min"))),
                "max": self._parse_float(gauge_info.get("maximum", gauge_info.get("max"))),
                "unit": gauge_info.get("unit", "cfs"),
            }
        elif isinstance(gauge_info, str):
            # Sometimes it's just a text description
            flow_range = {"description": gauge_info}

        return {
            "name": name,
            "section": section,
            "difficulty": difficulty,
            "description": self._clean_html(description),
            "flow_range": flow_range,
            "raw_detail": reach_detail,
        }

    def _clean_html(self, text: str) -> str:
        """Remove HTML tags from a string."""
        if not text:
            return ""
        soup = BeautifulSoup(text, "lxml")
        return soup.get_text(" ", strip=True)

    @staticmethod
    def _parse_float(value) -> float | None:
        """Safely parse a float from various input types."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        try:
            cleaned = str(value).replace(",", "").strip()
            return float(cleaned) if cleaned else None
        except (ValueError, TypeError):
            return None

    def _save_hazards(self, aw_id: str, hazards: list[dict]) -> None:
        """Save scraped hazards to the database for the matching river.

        Args:
            aw_id: American Whitewater reach ID.
            hazards: List of hazard dicts to save.
        """
        if not hazards:
            return

        session = SessionLocal()
        try:
            river = session.query(River).filter(River.aw_id == aw_id).first()
            if not river:
                return

            for h in hazards:
                # Check if a similar hazard already exists (by title and river)
                existing = (
                    session.query(Hazard)
                    .filter(
                        Hazard.river_id == river.id,
                        Hazard.title == h["title"],
                        Hazard.is_active.is_(True),
                    )
                    .first()
                )
                if existing:
                    continue

                hazard = Hazard(
                    id=str(uuid.uuid4()),
                    river_id=river.id,
                    type=h["type"],
                    severity=h["severity"],
                    title=h["title"],
                    description=h.get("description"),
                    source="aw",
                    source_url=f"{AW_API_BASE}/River/detail/id/{aw_id}/",
                    reported_at=datetime.utcnow(),
                    is_active=True,
                )
                session.add(hazard)

            session.commit()
            self.logger.info(f"Saved {len(hazards)} hazards for AW reach {aw_id}")
        except Exception as e:
            session.rollback()
            self.logger.error(f"Failed to save hazards for reach {aw_id}: {e}")
        finally:
            session.close()

    def scrape(self) -> list[ScrapedItem]:
        """Run the American Whitewater scraper.

        For each tracked river with an AW ID:
        1. Fetch reach details from JSON endpoint
        2. Scrape gauge data from the reach page
        3. Scrape rapid descriptions
        4. Scrape recent trip reports (with pagination)
        5. Check for hazard alerts
        6. Normalize everything into ScrapedItem format

        Returns:
            List of ScrapedItem objects with AW data.
        """
        self.log_start()
        aw_ids = self._get_tracked_aw_ids()

        if not aw_ids:
            self.logger.info("No AW IDs configured, skipping")
            return []

        items: list[ScrapedItem] = []

        for aw_id in aw_ids:
            try:
                view_url = f"{AW_API_BASE}/River/detail/id/{aw_id}/"
                self.logger.info(f"Scraping AW reach {aw_id}")

                # 1. Get reach detail from JSON API
                reach_detail = self._fetch_reach_detail(aw_id)
                reach_data = (
                    self._extract_reach_data(reach_detail) if reach_detail else {}
                )

                # Rate limit between requests
                time.sleep(settings.rate_limit_delay)

                # 2. Get gauge readings
                gauge_data = self._fetch_gauge_data(aw_id)
                time.sleep(settings.rate_limit_delay)

                # 3. Get rapids
                rapids = self._fetch_rapids(aw_id)
                time.sleep(settings.rate_limit_delay)

                # 4. Get recent trip reports
                trip_reports = self._fetch_trip_reports(aw_id, max_pages=2)
                time.sleep(settings.rate_limit_delay)

                # 5. Get hazards
                hazards = self._fetch_hazards(aw_id)
                self._save_hazards(aw_id, hazards)

                # Determine current flow from gauge readings
                flow_rate = None
                gauge_height = None
                for g in gauge_data:
                    reading = g.get("reading")
                    unit = g.get("unit", "cfs").lower()
                    if reading is not None:
                        if unit == "cfs":
                            flow_rate = reading
                        elif unit in ("ft", "feet"):
                            gauge_height = reading

                # Build the scraped item
                items.append(
                    ScrapedItem(
                        source="aw",
                        source_url=view_url,
                        data={
                            "aw_id": aw_id,
                            "name": reach_data.get("name", ""),
                            "section": reach_data.get("section", ""),
                            "difficulty": reach_data.get("difficulty", ""),
                            "description": reach_data.get("description", ""),
                            "flow_rate": flow_rate,
                            "gauge_height": gauge_height,
                            "flow_range": reach_data.get("flow_range", {}),
                            "gauge_readings": gauge_data,
                            "rapids": rapids,
                            "trip_reports": trip_reports[:10],  # keep last 10
                            "hazards": hazards,
                            "raw": reach_data.get("raw_detail"),
                        },
                        scraped_at=datetime.utcnow(),
                    )
                )

                self.logger.info(
                    f"AW reach {aw_id}: flow={flow_rate}, "
                    f"{len(rapids)} rapids, {len(trip_reports)} reports, "
                    f"{len(hazards)} hazards"
                )

                # Rate limiting between reaches
                time.sleep(settings.rate_limit_delay)

            except Exception as e:
                self.log_error(e)

        self.log_complete(len(items))
        return items

    def __del__(self):
        """Clean up the HTTP client."""
        try:
            self._client.close()
        except Exception:
            pass
