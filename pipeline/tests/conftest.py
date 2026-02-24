"""
Shared test fixtures for the Water-Watcher pipeline test suite.

Provides:
- SQLAlchemy in-memory session fixtures (mocked)
- Mock HTTP responses for external APIs
- Realistic test data factories
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from scrapers.base import ScrapedItem


# ─── Realistic USGS API response ────────────────────────────

USGS_RESPONSE_JSON = {
    "value": {
        "timeSeries": [
            {
                "sourceInfo": {
                    "siteCode": [{"value": "09380000"}],
                    "siteName": "COLORADO RIVER AT LEES FERRY, AZ",
                },
                "variable": {
                    "variableCode": [{"value": "00060"}],
                    "variableName": "Streamflow, ft³/s",
                },
                "values": [
                    {
                        "value": [
                            {"value": "12400", "dateTime": "2026-02-24T10:00:00.000-07:00"},
                            {"value": "12800", "dateTime": "2026-02-24T10:15:00.000-07:00"},
                        ]
                    }
                ],
            },
            {
                "sourceInfo": {
                    "siteCode": [{"value": "09380000"}],
                    "siteName": "COLORADO RIVER AT LEES FERRY, AZ",
                },
                "variable": {
                    "variableCode": [{"value": "00065"}],
                    "variableName": "Gage height, ft",
                },
                "values": [
                    {
                        "value": [
                            {"value": "6.42", "dateTime": "2026-02-24T10:15:00.000-07:00"},
                        ]
                    }
                ],
            },
            {
                "sourceInfo": {
                    "siteCode": [{"value": "09380000"}],
                    "siteName": "COLORADO RIVER AT LEES FERRY, AZ",
                },
                "variable": {
                    "variableCode": [{"value": "00010"}],
                    "variableName": "Temperature, water, °C",
                },
                "values": [
                    {
                        "value": [
                            {"value": "8.5", "dateTime": "2026-02-24T10:15:00.000-07:00"},
                        ]
                    }
                ],
            },
            # Second site — only flow data
            {
                "sourceInfo": {
                    "siteCode": [{"value": "13317000"}],
                    "siteName": "SALMON RIVER AT SHOUP, ID",
                },
                "variable": {
                    "variableCode": [{"value": "00060"}],
                    "variableName": "Streamflow, ft³/s",
                },
                "values": [
                    {
                        "value": [
                            {"value": "2150", "dateTime": "2026-02-24T10:00:00.000-07:00"},
                        ]
                    }
                ],
            },
        ]
    }
}

USGS_EMPTY_RESPONSE = {"value": {"timeSeries": []}}

USGS_MALFORMED_RESPONSE = {"value": {}}


# ─── Mock River objects ─────────────────────────────────────

def make_mock_river(
    id="river-1",
    name="Colorado River — Grand Canyon",
    state="AZ",
    usgs_gauge_id="09380000",
    aw_id="aw-123",
    difficulty="Class III-IV",
):
    """Create a mock River object for testing."""
    river = MagicMock()
    river.id = id
    river.name = name
    river.state = state
    river.usgs_gauge_id = usgs_gauge_id
    river.aw_id = aw_id
    river.difficulty = difficulty
    return river


# ─── ScrapedItem factories ──────────────────────────────────

def make_usgs_scraped_item(
    gauge_id="09380000",
    flow_rate=12800.0,
    gauge_height=6.42,
    water_temp=47.3,
):
    """Create a USGS ScrapedItem for testing."""
    return ScrapedItem(
        source="usgs",
        source_url=f"https://waterdata.usgs.gov/nwis/uv?site_no={gauge_id}",
        data={
            "usgs_gauge_id": gauge_id,
            "flow_rate": flow_rate,
            "gauge_height": gauge_height,
            "water_temp": water_temp,
            "raw": {"site_code": gauge_id, "00060": flow_rate},
        },
        scraped_at=datetime(2026, 2, 24, 17, 0, 0),
    )


def make_deal_scraped_item(
    title="NRS Otter 140 Raft — great condition",
    price=1200.0,
    url="https://seattle.craigslist.org/sga/12345",
    category="raft",
    region="seattle",
    description="14-foot self-bailing raft, used 10 trips. Includes frame.",
):
    """Create a Craigslist deal ScrapedItem for testing."""
    return ScrapedItem(
        source="craigslist",
        source_url=url,
        data={
            "title": title,
            "price": price,
            "url": url,
            "image_url": "https://images.craigslist.org/abc.jpg",
            "description": description,
            "category": category,
            "region": region,
            "posted_at": datetime(2026, 2, 23, 14, 30, 0),
        },
        scraped_at=datetime(2026, 2, 24, 17, 0, 0),
    )


# ─── Mock DealFilter objects ───────────────────────────────

_SENTINEL = object()


def make_mock_filter(
    id="filter-1",
    user_id="user-1",
    name="Raft deals under $2000",
    keywords=_SENTINEL,
    categories=_SENTINEL,
    max_price=2000.0,
    regions=_SENTINEL,
    is_active=True,
):
    """Create a mock DealFilter for testing.

    Uses a sentinel default so callers can explicitly pass [] or None
    and have it respected, rather than falling back to defaults.
    """
    f = MagicMock()
    f.id = id
    f.user_id = user_id
    f.name = name
    f.keywords = ["raft", "inflatable"] if keywords is _SENTINEL else keywords
    f.categories = ["raft"] if categories is _SENTINEL else categories
    f.max_price = max_price
    f.regions = ["seattle", "portland"] if regions is _SENTINEL else regions
    f.is_active = is_active
    return f


# ─── Mock GearDeal objects ─────────────────────────────────

def make_mock_deal(
    id="deal-1",
    title="NRS Otter 140 Raft — great condition",
    price=1200.0,
    url="https://seattle.craigslist.org/sga/12345",
    category="raft",
    region="seattle",
    description="14-foot self-bailing raft. Includes frame.",
):
    """Create a mock GearDeal for testing."""
    deal = MagicMock()
    deal.id = id
    deal.title = title
    deal.price = price
    deal.url = url
    deal.category = category
    deal.region = region
    deal.description = description
    return deal
