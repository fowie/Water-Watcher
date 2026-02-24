"""
Condition Processor

Takes raw scraped data from multiple sources (USGS, American Whitewater, etc.)
and normalizes it into unified RiverCondition records in the database.

Key responsibilities:
- Normalize flow data from different units/formats
- Calculate runnability scores: Low / Medium / Optimal / High / Dangerous
- Merge data from multiple sources for the same river section
- Handle conflicting data (prioritize official gauges over user reports)
- Detect significant quality changes and flag them for notifications
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from models import SessionLocal, River, RiverCondition, ScrapeLog
from scrapers.base import ScrapedItem

logger = logging.getLogger("pipeline.processors.condition")


# Source priority — higher number = more authoritative.
# Official gauge data takes precedence over crowd-sourced reports.
SOURCE_PRIORITY = {
    "usgs": 100,     # USGS official gauges (most authoritative)
    "aw": 80,        # American Whitewater (gauge correlations + user reports)
    "blm": 70,       # Bureau of Land Management
    "usfs": 70,      # US Forest Service
    "facebook": 30,  # Facebook group posts (least authoritative)
}

# Default CFS-based flow ranges used when per-river thresholds aren't available.
# These are rough approximations — real thresholds vary wildly by river.
DEFAULT_FLOW_RANGES = {
    "too_low": (0, 200),
    "low": (200, 500),
    "runnable": (500, 1500),
    "optimal": (1500, 5000),
    "high": (5000, 10000),
    "dangerous": (10000, float("inf")),
}


def classify_runnability(
    flow_rate: float | None,
    flow_range: dict | None = None,
) -> str | None:
    """Classify runnability based on flow rate and optional per-river thresholds.

    If a per-river flow_range dict is provided (from AW data), uses those
    thresholds. Otherwise falls back to conservative defaults.

    Args:
        flow_rate: Current flow in CFS.
        flow_range: Optional dict with 'min' and 'max' recommended flow.

    Returns:
        Runnability label or None if flow is unknown.
    """
    if flow_rate is None:
        return None

    # Use per-river thresholds if available
    if flow_range and flow_range.get("min") is not None and flow_range.get("max") is not None:
        min_flow = float(flow_range["min"])
        max_flow = float(flow_range["max"])

        if flow_rate < min_flow * 0.5:
            return "too_low"
        elif flow_rate < min_flow:
            return "low"
        elif flow_rate <= max_flow:
            return "optimal"
        elif flow_rate <= max_flow * 1.5:
            return "high"
        else:
            return "dangerous"

    # Fall back to generic thresholds
    for label, (low, high) in DEFAULT_FLOW_RANGES.items():
        if low <= flow_rate < high:
            return label
    return None


def runnability_to_quality(runnability: str | None) -> str | None:
    """Map runnability classification to a human-readable quality label.

    Args:
        runnability: Runnability classification string.

    Returns:
        Quality label: 'excellent', 'good', 'fair', 'poor', or 'dangerous'.
    """
    mapping = {
        "optimal": "excellent",
        "runnable": "good",
        "high": "fair",
        "low": "poor",
        "too_low": "poor",
        "too_high": "dangerous",
        "dangerous": "dangerous",
    }
    return mapping.get(runnability) if runnability else None


class ConditionProcessor:
    """Process raw scraper output into normalized river condition records.

    Handles data from multiple sources, merges conflicting readings,
    and writes unified condition snapshots to the database.
    """

    def process(self, items: list[ScrapedItem], source: str) -> list[dict]:
        """Process scraped items and save to the database.

        For each item:
        1. Look up the matching river by source-specific ID
        2. Merge with any existing data from higher-priority sources
        3. Classify runnability and quality
        4. Save a new RiverCondition record
        5. Detect significant quality changes

        Args:
            items: List of ScrapedItem objects from a scraper.
            source: Name of the scraper that produced the items.

        Returns:
            List of dicts summarizing what was processed.
        """
        session = SessionLocal()
        started_at = datetime.now(timezone.utc)
        processed = []

        try:
            for item in items:
                data = item.data

                # Look up the river by source-specific ID
                river = self._find_river(session, source, data)
                if not river:
                    logger.warning(f"No river found for {source} data: {data.get('aw_id') or data.get('usgs_gauge_id')}")
                    continue

                flow_rate = data.get("flow_rate")
                gauge_height = data.get("gauge_height")
                water_temp = data.get("water_temp")

                # Check if a higher-priority source has recent data
                merged = self._merge_with_existing(
                    session, river.id, source, flow_rate, gauge_height, water_temp
                )
                flow_rate = merged["flow_rate"]
                gauge_height = merged["gauge_height"]
                water_temp = merged["water_temp"]

                # Classify runnability using per-river thresholds if available
                flow_range = data.get("flow_range")
                runnability = classify_runnability(flow_rate, flow_range)
                quality = runnability_to_quality(runnability)

                # Get previous condition to detect changes
                prev_condition = (
                    session.query(RiverCondition)
                    .filter(RiverCondition.river_id == river.id)
                    .order_by(RiverCondition.scraped_at.desc())
                    .first()
                )
                old_quality = prev_condition.quality if prev_condition else None

                condition = RiverCondition(
                    id=str(uuid.uuid4()),
                    river_id=river.id,
                    flow_rate=flow_rate,
                    gauge_height=gauge_height,
                    water_temp=water_temp,
                    quality=quality,
                    runnability=runnability,
                    source=source,
                    source_url=item.source_url,
                    raw_data=data.get("raw"),
                    scraped_at=item.scraped_at,
                )
                session.add(condition)

                result = {
                    "river_id": river.id,
                    "river_name": river.name,
                    "quality": quality,
                    "runnability": runnability,
                    "flow_rate": flow_rate,
                    "source": source,
                }

                # Flag significant quality changes for notification
                if old_quality and quality and old_quality != quality:
                    result["quality_changed"] = True
                    result["old_quality"] = old_quality
                    result["new_quality"] = quality
                    logger.info(
                        f"Quality change for {river.name}: {old_quality} → {quality}"
                    )

                processed.append(result)

            # Log the scrape
            duration = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
            scrape_log = ScrapeLog(
                id=str(uuid.uuid4()),
                source=source,
                status="success",
                item_count=len(processed),
                started_at=started_at,
                finished_at=datetime.now(timezone.utc),
                duration=duration,
            )
            session.add(scrape_log)
            session.commit()
            logger.info(f"Processed {len(processed)} conditions from {source} in {duration}ms")

        except Exception as e:
            session.rollback()
            logger.error(f"Processing failed: {e}", exc_info=True)

            try:
                scrape_log = ScrapeLog(
                    id=str(uuid.uuid4()),
                    source=source,
                    status="error",
                    error=str(e),
                    started_at=started_at,
                    finished_at=datetime.now(timezone.utc),
                )
                session.add(scrape_log)
                session.commit()
            except Exception:
                session.rollback()
        finally:
            session.close()

        return processed

    def _find_river(self, session, source: str, data: dict) -> River | None:
        """Look up a river by source-specific identifier.

        Args:
            session: Active DB session.
            source: Scraper source name.
            data: Scraped item data dict.

        Returns:
            River model instance or None.
        """
        if source == "usgs" and "usgs_gauge_id" in data:
            return (
                session.query(River)
                .filter(River.usgs_gauge_id == data["usgs_gauge_id"])
                .first()
            )
        elif source == "aw" and "aw_id" in data:
            return (
                session.query(River)
                .filter(River.aw_id == data["aw_id"])
                .first()
            )
        return None

    def _merge_with_existing(
        self,
        session,
        river_id: str,
        current_source: str,
        flow_rate: float | None,
        gauge_height: float | None,
        water_temp: float | None,
    ) -> dict:
        """Merge current readings with existing data from higher-priority sources.

        If the current source is lower priority but a higher-priority source
        has recent data (within 2 hours), we use the higher-priority values
        for fields where they exist. If the current source is the highest
        priority, its values take precedence.

        Args:
            session: Active DB session.
            river_id: ID of the river.
            current_source: Name of the current data source.
            flow_rate: Flow rate from current source.
            gauge_height: Gauge height from current source.
            water_temp: Water temperature from current source.

        Returns:
            Dict with merged flow_rate, gauge_height, water_temp values.
        """
        current_priority = SOURCE_PRIORITY.get(current_source, 0)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=2)

        # Get recent conditions from higher-priority sources
        recent_higher = (
            session.query(RiverCondition)
            .filter(
                RiverCondition.river_id == river_id,
                RiverCondition.scraped_at >= cutoff,
            )
            .order_by(RiverCondition.scraped_at.desc())
            .limit(5)
            .all()
        )

        merged = {
            "flow_rate": flow_rate,
            "gauge_height": gauge_height,
            "water_temp": water_temp,
        }

        for cond in recent_higher:
            src_priority = SOURCE_PRIORITY.get(cond.source, 0)
            if src_priority > current_priority:
                # Higher-priority source — fill in any missing values from it
                if merged["flow_rate"] is None and cond.flow_rate is not None:
                    merged["flow_rate"] = cond.flow_rate
                if merged["gauge_height"] is None and cond.gauge_height is not None:
                    merged["gauge_height"] = cond.gauge_height
                if merged["water_temp"] is None and cond.water_temp is not None:
                    merged["water_temp"] = cond.water_temp

        return merged
