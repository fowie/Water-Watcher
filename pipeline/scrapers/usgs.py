"""
USGS Water Services Scraper

Fetches real-time streamflow data from USGS gauges for tracked rivers.
API docs: https://waterservices.usgs.gov/rest/IV-Service.html

Parameters scraped:
- 00060: Discharge (CFS)
- 00065: Gauge height (ft)
- 00010: Water temperature (°C, converted to °F)
"""

import httpx
import json
from datetime import datetime, timezone

from scrapers.base import BaseScraper, ScrapedItem
from config.settings import settings
from models import SessionLocal, River


class USGSScraper(BaseScraper):
    @property
    def name(self) -> str:
        return "usgs"

    def _get_tracked_gauge_ids(self) -> list[str]:
        """Get USGS gauge IDs for all tracked rivers."""
        session = SessionLocal()
        try:
            rivers = (
                session.query(River)
                .filter(River.usgs_gauge_id.isnot(None))
                .all()
            )
            return [r.usgs_gauge_id for r in rivers]
        finally:
            session.close()

    def scrape(self) -> list[ScrapedItem]:
        self.log_start()
        gauge_ids = self._get_tracked_gauge_ids()

        if not gauge_ids:
            self.logger.info("No USGS gauge IDs configured, skipping")
            return []

        items: list[ScrapedItem] = []

        # USGS supports comma-separated site IDs (max ~100 per request)
        sites = ",".join(gauge_ids)
        url = (
            f"{settings.usgs_base_url}/iv/"
            f"?format=json"
            f"&sites={sites}"
            f"&parameterCd=00060,00065,00010"
            f"&siteStatus=active"
        )

        try:
            response = httpx.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()

            timeseries = data.get("value", {}).get("timeSeries", [])
            # Group by site
            site_data: dict[str, dict] = {}
            for ts in timeseries:
                site_code = ts["sourceInfo"]["siteCode"][0]["value"]
                param_code = ts["variable"]["variableCode"][0]["value"]
                values = ts.get("values", [{}])[0].get("value", [])
                if values:
                    latest = values[-1]
                    if site_code not in site_data:
                        site_data[site_code] = {"site_code": site_code}
                    try:
                        site_data[site_code][param_code] = float(latest["value"])
                    except (ValueError, TypeError):
                        self.logger.warning(
                            f"Non-numeric value '{latest.get('value')}' for "
                            f"param {param_code} at site {site_code}, skipping"
                        )
                        continue
                    site_data[site_code]["datetime"] = latest["dateTime"]

            for site_code, readings in site_data.items():
                flow_rate = readings.get("00060")  # CFS
                gauge_height = readings.get("00065")  # feet
                water_temp_c = readings.get("00010")  # °C
                water_temp_f = (
                    (water_temp_c * 9 / 5 + 32) if water_temp_c is not None else None
                )

                items.append(
                    ScrapedItem(
                        source="usgs",
                        source_url=f"https://waterdata.usgs.gov/nwis/uv?site_no={site_code}",
                        data={
                            "usgs_gauge_id": site_code,
                            "flow_rate": flow_rate,
                            "gauge_height": gauge_height,
                            "water_temp": water_temp_f,
                            "raw": readings,
                        },
                        scraped_at=datetime.now(timezone.utc),
                    )
                )

        except httpx.HTTPError as e:
            self.log_error(e)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            self.logger.error(f"Failed to parse USGS response: {e}")

        self.log_complete(len(items))
        return items
