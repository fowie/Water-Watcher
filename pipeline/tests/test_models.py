"""
Tests for SQLAlchemy data models.

Tests model instantiation, default values, column types, and
relationship definitions. These are structural tests that don't
require a database connection.
"""

from datetime import datetime
from unittest.mock import MagicMock
from models.models import (
    River,
    RiverCondition,
    Hazard,
    GearDeal,
    DealFilter,
    DealFilterMatch,
    PushSubscription,
    ScrapeLog,
)


class TestRiverModel:
    def test_table_name(self):
        assert River.__tablename__ == "rivers"

    def test_required_columns(self):
        """River must have id, name, and state."""
        cols = {c.name for c in River.__table__.columns}
        assert "id" in cols
        assert "name" in cols
        assert "state" in cols

    def test_optional_columns(self):
        cols = {c.name for c in River.__table__.columns}
        assert "region" in cols
        assert "latitude" in cols
        assert "longitude" in cols
        assert "difficulty" in cols
        assert "description" in cols
        assert "aw_id" in cols
        assert "usgs_gauge_id" in cols
        assert "image_url" in cols

    def test_relationships_defined(self):
        rels = {r.key for r in River.__mapper__.relationships}
        assert "conditions" in rels
        assert "hazards" in rels

    def test_aw_id_unique(self):
        aw_id_col = River.__table__.columns["aw_id"]
        assert aw_id_col.unique is True


class TestRiverConditionModel:
    def test_table_name(self):
        assert RiverCondition.__tablename__ == "river_conditions"

    def test_foreign_key(self):
        fks = [
            fk.target_fullname
            for fk in RiverCondition.__table__.foreign_keys
        ]
        assert "rivers.id" in fks

    def test_index_exists(self):
        """Should have composite index on river_id + scraped_at."""
        index_names = [idx.name for idx in RiverCondition.__table__.indexes]
        assert "ix_river_conditions_river_scraped" in index_names


class TestHazardModel:
    def test_table_name(self):
        assert Hazard.__tablename__ == "hazards"

    def test_required_columns(self):
        # type, severity, title, source are non-nullable
        for col_name in ["type", "severity", "title", "source"]:
            col = Hazard.__table__.columns[col_name]
            assert col.nullable is False, f"{col_name} should be non-nullable"

    def test_index_exists(self):
        index_names = [idx.name for idx in Hazard.__table__.indexes]
        assert "ix_hazards_river_active" in index_names


class TestGearDealModel:
    def test_table_name(self):
        assert GearDeal.__tablename__ == "gear_deals"

    def test_url_unique(self):
        url_col = GearDeal.__table__.columns["url"]
        assert url_col.unique is True

    def test_url_not_nullable(self):
        url_col = GearDeal.__table__.columns["url"]
        assert url_col.nullable is False

    def test_indexes(self):
        index_names = [idx.name for idx in GearDeal.__table__.indexes]
        assert "ix_gear_deals_category_active" in index_names
        assert "ix_gear_deals_scraped" in index_names


class TestDealFilterModel:
    def test_table_name(self):
        assert DealFilter.__tablename__ == "deal_filters"

    def test_array_columns(self):
        """keywords, categories, regions should be ARRAY types."""
        from sqlalchemy import ARRAY

        for col_name in ["keywords", "categories", "regions"]:
            col = DealFilter.__table__.columns[col_name]
            assert isinstance(col.type, ARRAY), f"{col_name} should be ARRAY"


class TestDealFilterMatchModel:
    def test_table_name(self):
        assert DealFilterMatch.__tablename__ == "deal_filter_matches"

    def test_foreign_keys(self):
        fk_targets = {
            fk.target_fullname for fk in DealFilterMatch.__table__.foreign_keys
        }
        assert "deal_filters.id" in fk_targets
        assert "gear_deals.id" in fk_targets


class TestPushSubscriptionModel:
    def test_table_name(self):
        assert PushSubscription.__tablename__ == "push_subscriptions"

    def test_endpoint_unique(self):
        endpoint_col = PushSubscription.__table__.columns["endpoint"]
        assert endpoint_col.unique is True


class TestScrapeLogModel:
    def test_table_name(self):
        assert ScrapeLog.__tablename__ == "scrape_logs"

    def test_index_exists(self):
        index_names = [idx.name for idx in ScrapeLog.__table__.indexes]
        assert "ix_scrape_logs_source_started" in index_names

    def test_required_columns(self):
        for col_name in ["source", "status", "started_at"]:
            col = ScrapeLog.__table__.columns[col_name]
            assert col.nullable is False, f"{col_name} should be non-nullable"
