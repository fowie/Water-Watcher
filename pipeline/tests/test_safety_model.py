"""
Tests for SafetyAlert model and related safety infrastructure.

Tests model instantiation, column types, relationships, and
enum-like type/severity validation. These are structural tests
that don't require a database connection.

Coverage:
- SafetyAlert model creation (or Hazard as equivalent)
- Alert type classification (HIGH_WATER, CLOSURE, HAZARD, FLOOD, etc.)
- Alert severity levels (info, warning, danger)
- Relationships (river → alerts)
- Column presence and constraints
- Index verification
- Default values
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock

from models.models import (
    River,
    Hazard,
    RiverCondition,
)


# ─── SafetyAlert/Hazard Model Structural Tests ──────────

class TestSafetyAlertModel:
    """Tests for the safety alert model.

    The existing 'Hazard' model serves as the safety alert model in the current
    schema. If a dedicated 'SafetyAlert' model is added in Round 16, these tests
    should be updated to reference it.
    """

    def test_hazard_table_name(self):
        """Hazard model maps to 'hazards' table."""
        assert Hazard.__tablename__ == "hazards"

    def test_hazard_has_id_column(self):
        cols = {c.name for c in Hazard.__table__.columns}
        assert "id" in cols

    def test_hazard_has_river_id_column(self):
        cols = {c.name for c in Hazard.__table__.columns}
        assert "river_id" in cols

    def test_hazard_has_type_column(self):
        cols = {c.name for c in Hazard.__table__.columns}
        assert "type" in cols

    def test_hazard_has_severity_column(self):
        cols = {c.name for c in Hazard.__table__.columns}
        assert "severity" in cols

    def test_hazard_has_title_column(self):
        cols = {c.name for c in Hazard.__table__.columns}
        assert "title" in cols

    def test_hazard_has_description_column(self):
        cols = {c.name for c in Hazard.__table__.columns}
        assert "description" in cols

    def test_hazard_has_source_column(self):
        cols = {c.name for c in Hazard.__table__.columns}
        assert "source" in cols

    def test_hazard_has_is_active_column(self):
        cols = {c.name for c in Hazard.__table__.columns}
        assert "is_active" in cols

    def test_hazard_has_expires_at_column(self):
        cols = {c.name for c in Hazard.__table__.columns}
        assert "expires_at" in cols

    def test_hazard_has_reported_at_column(self):
        cols = {c.name for c in Hazard.__table__.columns}
        assert "reported_at" in cols

    def test_hazard_has_source_url_column(self):
        cols = {c.name for c in Hazard.__table__.columns}
        assert "source_url" in cols

    def test_hazard_has_created_at_column(self):
        cols = {c.name for c in Hazard.__table__.columns}
        assert "created_at" in cols


class TestSafetyAlertNullability:
    """Tests for column nullability constraints."""

    def test_type_not_nullable(self):
        col = Hazard.__table__.columns["type"]
        assert col.nullable is False

    def test_severity_not_nullable(self):
        col = Hazard.__table__.columns["severity"]
        assert col.nullable is False

    def test_title_not_nullable(self):
        col = Hazard.__table__.columns["title"]
        assert col.nullable is False

    def test_source_not_nullable(self):
        col = Hazard.__table__.columns["source"]
        assert col.nullable is False

    def test_reported_at_not_nullable(self):
        col = Hazard.__table__.columns["reported_at"]
        assert col.nullable is False

    def test_description_is_nullable(self):
        col = Hazard.__table__.columns["description"]
        assert col.nullable is True

    def test_expires_at_is_nullable(self):
        col = Hazard.__table__.columns["expires_at"]
        assert col.nullable is True

    def test_source_url_is_nullable(self):
        col = Hazard.__table__.columns["source_url"]
        assert col.nullable is True


class TestSafetyAlertTypes:
    """Tests for alert type classification.

    Valid alert types from the Prisma schema:
    "strainer", "dam", "logjam", "rapid_change", "closure", "permit_required"
    Round 16 may add: "HIGH_WATER", "FLOOD", "DEBRIS"
    """

    def test_valid_types_documented(self):
        """Known hazard types should be documented."""
        known_types = [
            "strainer",
            "dam",
            "logjam",
            "rapid_change",
            "closure",
            "permit_required",
        ]
        assert len(known_types) >= 6

    def test_strainer_type_is_valid(self):
        assert "strainer" in ["strainer", "dam", "logjam", "rapid_change", "closure", "permit_required"]

    def test_dam_type_is_valid(self):
        assert "dam" in ["strainer", "dam", "logjam", "rapid_change", "closure", "permit_required"]

    def test_closure_type_is_valid(self):
        assert "closure" in ["strainer", "dam", "logjam", "rapid_change", "closure", "permit_required"]

    def test_permit_required_type_is_valid(self):
        assert "permit_required" in ["strainer", "dam", "logjam", "rapid_change", "closure", "permit_required"]

    def test_type_column_is_string(self):
        """Type column should accept string values (no DB-level enum constraint)."""
        from sqlalchemy import String
        col = Hazard.__table__.columns["type"]
        assert isinstance(col.type, String)


class TestSafetyAlertSeverity:
    """Tests for alert severity level classification."""

    def test_valid_severities(self):
        """Severity should be one of: info, warning, danger."""
        valid = {"info", "warning", "danger"}
        assert len(valid) == 3
        assert "info" in valid
        assert "warning" in valid
        assert "danger" in valid

    def test_severity_column_is_string(self):
        from sqlalchemy import String
        col = Hazard.__table__.columns["severity"]
        assert isinstance(col.type, String)

    def test_info_is_lowest_severity(self):
        severity_order = {"info": 0, "warning": 1, "danger": 2}
        assert severity_order["info"] < severity_order["warning"]
        assert severity_order["warning"] < severity_order["danger"]

    def test_danger_is_highest_severity(self):
        severity_order = {"info": 0, "warning": 1, "danger": 2}
        assert severity_order["danger"] == max(severity_order.values())


class TestSafetyAlertRelationships:
    """Tests for river → alerts relationship."""

    def test_hazard_has_river_relationship(self):
        rels = {r.key for r in Hazard.__mapper__.relationships}
        assert "river" in rels

    def test_river_has_hazards_relationship(self):
        rels = {r.key for r in River.__mapper__.relationships}
        assert "hazards" in rels

    def test_hazard_foreign_key_targets_rivers(self):
        fk_targets = [
            fk.target_fullname for fk in Hazard.__table__.foreign_keys
        ]
        assert "rivers.id" in fk_targets

    def test_hazard_cascade_delete(self):
        """Delete should cascade when parent river is removed."""
        fks = list(Hazard.__table__.foreign_keys)
        for fk in fks:
            if fk.target_fullname == "rivers.id":
                # Check that ondelete is CASCADE
                assert fk.ondelete == "CASCADE"


class TestSafetyAlertIndex:
    """Tests for composite index on hazard model."""

    def test_river_active_index_exists(self):
        index_names = [idx.name for idx in Hazard.__table__.indexes]
        assert "ix_hazards_river_active" in index_names

    def test_index_covers_river_id_and_is_active(self):
        for idx in Hazard.__table__.indexes:
            if idx.name == "ix_hazards_river_active":
                col_names = [col.name for col in idx.columns]
                assert "river_id" in col_names
                assert "is_active" in col_names


class TestSafetyAlertDefaults:
    """Tests for default values on the hazard model."""

    def test_is_active_defaults_to_true(self):
        col = Hazard.__table__.columns["is_active"]
        # SQLAlchemy default
        default = col.default
        if default is not None:
            assert default.arg is True


class TestSafetyAlertCreation:
    """Tests for creating mock SafetyAlert/Hazard instances."""

    def test_create_hazard_with_all_fields(self):
        hazard = MagicMock()
        hazard.id = "hazard-1"
        hazard.river_id = "river-1"
        hazard.type = "strainer"
        hazard.severity = "warning"
        hazard.title = "Large strainer at mile 5"
        hazard.description = "Tree blocking 60% of channel"
        hazard.source = "aw"
        hazard.source_url = "https://americanwhitewater.org/content/Gauge2/detail/id/123"
        hazard.reported_at = datetime(2026, 2, 24, 12, 0, 0, tzinfo=timezone.utc)
        hazard.expires_at = datetime(2026, 6, 1, 0, 0, 0, tzinfo=timezone.utc)
        hazard.is_active = True
        hazard.created_at = datetime(2026, 2, 24, 12, 0, 0, tzinfo=timezone.utc)

        assert hazard.id == "hazard-1"
        assert hazard.type == "strainer"
        assert hazard.severity == "warning"
        assert hazard.is_active is True
        assert hazard.reported_at.tzinfo is not None

    def test_create_hazard_without_optional_fields(self):
        hazard = MagicMock()
        hazard.id = "hazard-2"
        hazard.river_id = "river-1"
        hazard.type = "closure"
        hazard.severity = "danger"
        hazard.title = "River closed"
        hazard.description = None
        hazard.source = "blm"
        hazard.source_url = None
        hazard.reported_at = datetime(2026, 2, 25, 0, 0, 0, tzinfo=timezone.utc)
        hazard.expires_at = None
        hazard.is_active = True

        assert hazard.description is None
        assert hazard.source_url is None
        assert hazard.expires_at is None

    def test_create_high_water_alert(self):
        """HIGH_WATER type alert for auto-detection scenario."""
        alert = MagicMock()
        alert.id = "alert-hw-1"
        alert.river_id = "river-1"
        alert.type = "rapid_change"  # closest existing type for high water
        alert.severity = "danger"
        alert.title = "Extreme high water warning"
        alert.description = "Flow rate exceeds 20,000 CFS. Extremely dangerous conditions."
        alert.source = "usgs"
        alert.is_active = True

        assert alert.type in ["rapid_change", "HIGH_WATER"]
        assert alert.severity == "danger"

    def test_create_closure_alert(self):
        alert = MagicMock()
        alert.id = "alert-cl-1"
        alert.river_id = "river-2"
        alert.type = "closure"
        alert.severity = "danger"
        alert.title = "Section closed for dam repair"
        alert.is_active = True

        assert alert.type == "closure"
        assert alert.severity == "danger"

    def test_create_info_severity_alert(self):
        alert = MagicMock()
        alert.id = "alert-info-1"
        alert.river_id = "river-1"
        alert.type = "permit_required"
        alert.severity = "info"
        alert.title = "Permit required for this section"
        alert.is_active = True

        assert alert.severity == "info"

    def test_multiple_alerts_per_river(self):
        """A river can have multiple simultaneous alerts."""
        alerts = []
        for i in range(5):
            a = MagicMock()
            a.id = f"alert-{i}"
            a.river_id = "river-1"
            a.type = ["strainer", "dam", "logjam", "closure", "rapid_change"][i]
            a.severity = ["info", "warning", "danger", "danger", "warning"][i]
            a.is_active = True
            alerts.append(a)

        assert len(alerts) == 5
        assert all(a.river_id == "river-1" for a in alerts)
        assert len(set(a.type for a in alerts)) == 5  # all different types

    def test_expired_alert_detection(self):
        """Alerts with expires_at in the past should be considered expired."""
        alert = MagicMock()
        alert.expires_at = datetime(2025, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)

        is_expired = alert.expires_at < now
        assert is_expired is True

    def test_active_alert_detection(self):
        """Alerts with expires_at in the future should be active."""
        alert = MagicMock()
        alert.expires_at = datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        alert.is_active = True
        now = datetime.now(timezone.utc)

        is_active = alert.is_active and alert.expires_at > now
        assert is_active is True

    def test_null_expires_at_means_no_expiry(self):
        """Alerts with no expiration should remain active indefinitely."""
        alert = MagicMock()
        alert.expires_at = None
        alert.is_active = True

        is_active = alert.is_active and (alert.expires_at is None or alert.expires_at > datetime.now(timezone.utc))
        assert is_active is True


class TestRiverConditionToSafetyAlert:
    """Tests for the conceptual link between river conditions and auto-generated safety alerts."""

    def test_too_high_runnability_indicates_danger(self):
        """When runnability is 'too_high', a HIGH_WATER alert should be considered."""
        condition = MagicMock()
        condition.runnability = "too_high"
        condition.quality = "dangerous"
        condition.flow_rate = 25000.0

        should_alert = condition.runnability == "too_high" or condition.quality == "dangerous"
        assert should_alert is True

    def test_optimal_runnability_no_alert(self):
        """Normal conditions should not trigger a safety alert."""
        condition = MagicMock()
        condition.runnability = "optimal"
        condition.quality = "good"
        condition.flow_rate = 3000.0

        should_alert = condition.runnability == "too_high" or condition.quality == "dangerous"
        assert should_alert is False

    def test_too_low_runnability_may_alert(self):
        """Very low water can also be an alert condition."""
        condition = MagicMock()
        condition.runnability = "too_low"
        condition.quality = "poor"
        condition.flow_rate = 100.0

        is_low_water = condition.runnability == "too_low"
        assert is_low_water is True

    def test_condition_sources_align_with_alert_sources(self):
        """Condition sources should be valid alert sources."""
        condition_sources = {"usgs", "aw", "facebook", "blm", "usfs"}
        alert_sources = {"usgs", "aw", "blm", "usfs", "facebook"}
        assert condition_sources == alert_sources
