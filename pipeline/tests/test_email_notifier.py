"""
Tests for the Email Notifier (pipeline/notifiers/email_notifier.py).

Coverage:
- send_deal_alert: HTML content, recipient, single/multi deal subjects
- send_condition_alert: river name, quality change, direction detection
- send_hazard_alert: hazard details, severity levels, top-severity logic
- send_weekly_digest: river summaries, quality badges, flow display
- API key missing → graceful skip (returns False, logs debug)
- Resend API error handling
- Email formatting / template correctness
"""

import logging
from unittest.mock import patch, MagicMock

import pytest


# ─── Fixtures ───────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _mock_resend_module():
    """Patch resend at import time so we never hit real APIs."""
    with patch("notifiers.email_notifier.resend") as mock_resend:
        mock_resend.Emails = MagicMock()
        mock_resend.Emails.send = MagicMock(return_value={"id": "email-123"})
        mock_resend.api_key = None
        yield mock_resend


@pytest.fixture
def configured_settings():
    """Settings with a valid Resend API key."""
    with patch("notifiers.email_notifier.settings") as mock_settings:
        mock_settings.resend_api_key = "re_test_key_123"
        mock_settings.notification_from_email = "alerts@waterwatcher.app"
        yield mock_settings


@pytest.fixture
def unconfigured_settings():
    """Settings with no Resend API key."""
    with patch("notifiers.email_notifier.settings") as mock_settings:
        mock_settings.resend_api_key = ""
        mock_settings.notification_from_email = "alerts@waterwatcher.app"
        yield mock_settings


def _make_notifier():
    """Create a fresh EmailNotifier instance."""
    from notifiers.email_notifier import EmailNotifier
    return EmailNotifier()


# ─── _is_configured / init ─────────────────────────────────


class TestEmailNotifierConfiguration:
    """Tests for API key guard behavior."""

    def test_configured_returns_true(self, configured_settings):
        notifier = _make_notifier()
        assert notifier._is_configured() is True

    def test_unconfigured_returns_false(self, unconfigured_settings):
        notifier = _make_notifier()
        assert notifier._is_configured() is False

    def test_unconfigured_logs_debug(self, unconfigured_settings, caplog):
        notifier = _make_notifier()
        with caplog.at_level(logging.DEBUG, logger="pipeline.notifiers.email"):
            notifier._is_configured()
        assert "not configured" in caplog.text.lower() or "skipping" in caplog.text.lower()

    def test_from_email_set_from_settings(self, configured_settings):
        notifier = _make_notifier()
        assert notifier.from_email == "alerts@waterwatcher.app"


# ─── _send ──────────────────────────────────────────────────


class TestSendMethod:
    """Tests for the low-level _send helper."""

    def test_send_calls_resend_emails(self, configured_settings, _mock_resend_module):
        notifier = _make_notifier()
        result = notifier._send("user@example.com", "Test Subject", "<p>Hi</p>")
        assert result is True
        _mock_resend_module.Emails.send.assert_called_once()
        call_args = _mock_resend_module.Emails.send.call_args[0][0]
        assert call_args["to"] == ["user@example.com"]
        assert call_args["subject"] == "Test Subject"
        assert call_args["html"] == "<p>Hi</p>"
        assert call_args["from"] == "alerts@waterwatcher.app"

    def test_send_returns_false_on_resend_error(self, configured_settings, _mock_resend_module):
        _mock_resend_module.Emails.send.side_effect = Exception("API rate limited")
        notifier = _make_notifier()
        result = notifier._send("user@example.com", "Subject", "<p>Body</p>")
        assert result is False

    def test_send_logs_error_on_failure(self, configured_settings, _mock_resend_module, caplog):
        _mock_resend_module.Emails.send.side_effect = Exception("Connection refused")
        notifier = _make_notifier()
        with caplog.at_level(logging.ERROR, logger="pipeline.notifiers.email"):
            notifier._send("user@example.com", "Subject", "<p>Body</p>")
        assert "failed to send email" in caplog.text.lower()

    def test_send_logs_success(self, configured_settings, _mock_resend_module, caplog):
        notifier = _make_notifier()
        with caplog.at_level(logging.INFO, logger="pipeline.notifiers.email"):
            notifier._send("user@example.com", "Subject", "<p>Body</p>")
        assert "email sent" in caplog.text.lower()


# ─── send_deal_alert ────────────────────────────────────────


class TestSendDealAlert:
    """Tests for deal notification emails."""

    @pytest.fixture
    def sample_deals(self):
        return [
            {
                "title": "NRS Otter 130",
                "price": 2500.0,
                "url": "https://craigslist.org/123",
                "category": "raft",
                "region": "Denver",
            },
            {
                "title": "Werner Paddle",
                "price": 85.0,
                "url": "https://craigslist.org/456",
                "category": "paddle",
                "region": "Seattle",
            },
        ]

    def test_returns_false_when_unconfigured(self, unconfigured_settings):
        notifier = _make_notifier()
        result = notifier.send_deal_alert("user@example.com", [{"title": "X", "price": 10}])
        assert result is False

    def test_returns_false_for_empty_deals(self, configured_settings):
        notifier = _make_notifier()
        result = notifier.send_deal_alert("user@example.com", [])
        assert result is False

    def test_single_deal_subject_includes_title(self, configured_settings, _mock_resend_module):
        deals = [{"title": "NRS Otter 130", "price": 2500, "url": "#", "category": "raft"}]
        notifier = _make_notifier()
        notifier.send_deal_alert("user@example.com", deals)
        call_args = _mock_resend_module.Emails.send.call_args[0][0]
        assert "NRS Otter 130" in call_args["subject"]
        assert "🛶" in call_args["subject"]

    def test_multi_deal_subject_includes_count(self, configured_settings, _mock_resend_module, sample_deals):
        notifier = _make_notifier()
        notifier.send_deal_alert("user@example.com", sample_deals)
        call_args = _mock_resend_module.Emails.send.call_args[0][0]
        assert "2" in call_args["subject"]
        assert "Deals" in call_args["subject"]

    def test_html_contains_deal_title(self, configured_settings, _mock_resend_module, sample_deals):
        notifier = _make_notifier()
        notifier.send_deal_alert("user@example.com", sample_deals)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "NRS Otter 130" in html
        assert "Werner Paddle" in html

    def test_html_contains_price(self, configured_settings, _mock_resend_module, sample_deals):
        notifier = _make_notifier()
        notifier.send_deal_alert("user@example.com", sample_deals)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "$2500" in html
        assert "$85" in html

    def test_html_contains_category(self, configured_settings, _mock_resend_module, sample_deals):
        notifier = _make_notifier()
        notifier.send_deal_alert("user@example.com", sample_deals)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "Raft" in html
        assert "Paddle" in html

    def test_html_contains_region(self, configured_settings, _mock_resend_module, sample_deals):
        notifier = _make_notifier()
        notifier.send_deal_alert("user@example.com", sample_deals)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "Denver" in html
        assert "Seattle" in html

    def test_html_contains_url_link(self, configured_settings, _mock_resend_module, sample_deals):
        notifier = _make_notifier()
        notifier.send_deal_alert("user@example.com", sample_deals)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "https://craigslist.org/123" in html

    def test_sent_to_correct_recipient(self, configured_settings, _mock_resend_module, sample_deals):
        notifier = _make_notifier()
        notifier.send_deal_alert("alice@example.com", sample_deals)
        call_args = _mock_resend_module.Emails.send.call_args[0][0]
        assert call_args["to"] == ["alice@example.com"]

    def test_deal_with_none_price_shows_na(self, configured_settings, _mock_resend_module):
        deals = [{"title": "Free PFD", "price": None, "url": "#"}]
        notifier = _make_notifier()
        notifier.send_deal_alert("user@example.com", deals)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "N/A" in html

    def test_deal_with_missing_region_shows_dash(self, configured_settings, _mock_resend_module):
        deals = [{"title": "Kayak", "price": 100, "url": "#"}]
        notifier = _make_notifier()
        notifier.send_deal_alert("user@example.com", deals)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "—" in html or "&#8212;" in html

    def test_html_has_water_watcher_branding(self, configured_settings, _mock_resend_module):
        deals = [{"title": "Kayak", "price": 100, "url": "#"}]
        notifier = _make_notifier()
        notifier.send_deal_alert("user@example.com", deals)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "Water-Watcher" in html

    def test_returns_true_on_success(self, configured_settings):
        deals = [{"title": "Kayak", "price": 100, "url": "#"}]
        notifier = _make_notifier()
        result = notifier.send_deal_alert("user@example.com", deals)
        assert result is True


# ─── send_condition_alert ───────────────────────────────────


class TestSendConditionAlert:
    """Tests for river condition change emails."""

    def test_returns_false_when_unconfigured(self, unconfigured_settings):
        notifier = _make_notifier()
        result = notifier.send_condition_alert("user@example.com", "Green River", "fair", "good")
        assert result is False

    def test_improved_subject_has_green_emoji(self, configured_settings, _mock_resend_module):
        notifier = _make_notifier()
        notifier.send_condition_alert("user@example.com", "Green River", "fair", "good")
        subject = _mock_resend_module.Emails.send.call_args[0][0]["subject"]
        assert "🟢" in subject
        assert "Improved" in subject

    def test_deteriorated_to_dangerous_has_red_emoji(self, configured_settings, _mock_resend_module):
        notifier = _make_notifier()
        notifier.send_condition_alert("user@example.com", "Gauley River", "good", "dangerous")
        subject = _mock_resend_module.Emails.send.call_args[0][0]["subject"]
        assert "🔴" in subject
        assert "Deteriorated" in subject

    def test_changed_has_yellow_emoji(self, configured_settings, _mock_resend_module):
        notifier = _make_notifier()
        notifier.send_condition_alert("user@example.com", "Lochsa River", "good", "fair")
        subject = _mock_resend_module.Emails.send.call_args[0][0]["subject"]
        assert "🟡" in subject
        assert "Changed" in subject

    def test_html_contains_river_name(self, configured_settings, _mock_resend_module):
        notifier = _make_notifier()
        notifier.send_condition_alert("user@example.com", "Snake River", "poor", "good")
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "Snake River" in html

    def test_html_contains_old_quality(self, configured_settings, _mock_resend_module):
        notifier = _make_notifier()
        notifier.send_condition_alert("user@example.com", "Snake River", "poor", "good")
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "poor" in html

    def test_html_contains_new_quality(self, configured_settings, _mock_resend_module):
        notifier = _make_notifier()
        notifier.send_condition_alert("user@example.com", "Snake River", "poor", "excellent")
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "excellent" in html

    def test_subject_contains_river_name(self, configured_settings, _mock_resend_module):
        notifier = _make_notifier()
        notifier.send_condition_alert("user@example.com", "Arkansas River", "fair", "good")
        subject = _mock_resend_module.Emails.send.call_args[0][0]["subject"]
        assert "Arkansas River" in subject

    def test_details_with_flow_rate(self, configured_settings, _mock_resend_module):
        notifier = _make_notifier()
        notifier.send_condition_alert(
            "user@example.com", "Green River", "fair", "good",
            details={"flow_rate": 1250.0}
        )
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "1250" in html
        assert "CFS" in html

    def test_details_with_gauge_height(self, configured_settings, _mock_resend_module):
        notifier = _make_notifier()
        notifier.send_condition_alert(
            "user@example.com", "Green River", "fair", "good",
            details={"gauge_height": 4.5}
        )
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "4.5" in html
        assert "ft" in html

    def test_details_with_water_temp(self, configured_settings, _mock_resend_module):
        notifier = _make_notifier()
        notifier.send_condition_alert(
            "user@example.com", "Green River", "fair", "good",
            details={"water_temp": 62.0}
        )
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "62" in html
        assert "°F" in html

    def test_details_with_river_id_link(self, configured_settings, _mock_resend_module):
        notifier = _make_notifier()
        notifier.send_condition_alert(
            "user@example.com", "Green River", "fair", "good",
            details={"river_id": "river-abc"}
        )
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "/rivers/river-abc" in html

    def test_no_details_no_table(self, configured_settings, _mock_resend_module):
        notifier = _make_notifier()
        notifier.send_condition_alert("user@example.com", "Green River", "fair", "good")
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "<table>" not in html

    def test_unknown_quality_uses_yellow(self, configured_settings, _mock_resend_module):
        """Unknown quality values default to Changed/yellow."""
        notifier = _make_notifier()
        notifier.send_condition_alert("user@example.com", "River X", "unknown", "mystery")
        subject = _mock_resend_module.Emails.send.call_args[0][0]["subject"]
        assert "🟡" in subject


# ─── send_hazard_alert ──────────────────────────────────────


class TestSendHazardAlert:
    """Tests for hazard alert emails."""

    @pytest.fixture
    def danger_hazards(self):
        return [
            {
                "title": "Strainer at mile 12",
                "severity": "danger",
                "type": "strainer",
                "description": "Large tree blocking the main channel. Portage required.",
            }
        ]

    @pytest.fixture
    def mixed_hazards(self):
        return [
            {"title": "High water advisory", "severity": "warning", "type": "flow", "description": ""},
            {"title": "New rapid formed", "severity": "info", "type": "obstacle", "description": "Rock slide created Class IV rapid."},
        ]

    def test_returns_false_when_unconfigured(self, unconfigured_settings):
        notifier = _make_notifier()
        result = notifier.send_hazard_alert("user@example.com", "Gauley River", [{"title": "X", "severity": "info"}])
        assert result is False

    def test_returns_false_for_empty_hazards(self, configured_settings):
        notifier = _make_notifier()
        result = notifier.send_hazard_alert("user@example.com", "Gauley River", [])
        assert result is False

    def test_danger_severity_uses_red_emoji(self, configured_settings, _mock_resend_module, danger_hazards):
        notifier = _make_notifier()
        notifier.send_hazard_alert("user@example.com", "Gauley River", danger_hazards)
        subject = _mock_resend_module.Emails.send.call_args[0][0]["subject"]
        assert "🔴" in subject

    def test_warning_only_uses_warning_emoji(self, configured_settings, _mock_resend_module):
        hazards = [{"title": "Advisory", "severity": "warning", "type": "flow"}]
        notifier = _make_notifier()
        notifier.send_hazard_alert("user@example.com", "River X", hazards)
        subject = _mock_resend_module.Emails.send.call_args[0][0]["subject"]
        assert "⚠️" in subject

    def test_info_only_uses_info_emoji(self, configured_settings, _mock_resend_module):
        hazards = [{"title": "Notice", "severity": "info", "type": "info"}]
        notifier = _make_notifier()
        notifier.send_hazard_alert("user@example.com", "River X", hazards)
        subject = _mock_resend_module.Emails.send.call_args[0][0]["subject"]
        assert "ℹ️" in subject

    def test_mixed_severity_danger_wins(self, configured_settings, _mock_resend_module, mixed_hazards):
        """When danger + info are mixed, top_severity should be warning (no danger here)."""
        notifier = _make_notifier()
        notifier.send_hazard_alert("user@example.com", "River X", mixed_hazards)
        subject = _mock_resend_module.Emails.send.call_args[0][0]["subject"]
        assert "⚠️" in subject  # warning is top severity in mixed_hazards

    def test_danger_overrides_warning(self, configured_settings, _mock_resend_module):
        hazards = [
            {"title": "Strainer", "severity": "danger", "type": "strainer"},
            {"title": "High water", "severity": "warning", "type": "flow"},
        ]
        notifier = _make_notifier()
        notifier.send_hazard_alert("user@example.com", "River X", hazards)
        subject = _mock_resend_module.Emails.send.call_args[0][0]["subject"]
        assert "🔴" in subject

    def test_subject_contains_river_name(self, configured_settings, _mock_resend_module, danger_hazards):
        notifier = _make_notifier()
        notifier.send_hazard_alert("user@example.com", "Gauley River", danger_hazards)
        subject = _mock_resend_module.Emails.send.call_args[0][0]["subject"]
        assert "Gauley River" in subject

    def test_html_contains_hazard_title(self, configured_settings, _mock_resend_module, danger_hazards):
        notifier = _make_notifier()
        notifier.send_hazard_alert("user@example.com", "Gauley River", danger_hazards)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "Strainer at mile 12" in html

    def test_html_contains_severity_badge(self, configured_settings, _mock_resend_module, danger_hazards):
        notifier = _make_notifier()
        notifier.send_hazard_alert("user@example.com", "Gauley River", danger_hazards)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "DANGER" in html

    def test_html_contains_hazard_type(self, configured_settings, _mock_resend_module, danger_hazards):
        notifier = _make_notifier()
        notifier.send_hazard_alert("user@example.com", "Gauley River", danger_hazards)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "strainer" in html

    def test_html_contains_description(self, configured_settings, _mock_resend_module, danger_hazards):
        notifier = _make_notifier()
        notifier.send_hazard_alert("user@example.com", "Gauley River", danger_hazards)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "Large tree blocking" in html

    def test_html_contains_hazard_count(self, configured_settings, _mock_resend_module, mixed_hazards):
        notifier = _make_notifier()
        notifier.send_hazard_alert("user@example.com", "River X", mixed_hazards)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "2 new hazards" in html

    def test_single_hazard_no_plural(self, configured_settings, _mock_resend_module, danger_hazards):
        notifier = _make_notifier()
        notifier.send_hazard_alert("user@example.com", "Gauley River", danger_hazards)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "1 new hazard " in html  # no trailing "s"

    def test_description_truncated_at_200_chars(self, configured_settings, _mock_resend_module):
        hazards = [{"title": "Long", "severity": "info", "type": "info", "description": "A" * 300}]
        notifier = _make_notifier()
        notifier.send_hazard_alert("user@example.com", "River X", hazards)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        # Description in the card should be <= 200 chars of "A"s
        assert "A" * 200 in html
        assert "A" * 201 not in html

    def test_hazard_with_no_description(self, configured_settings, _mock_resend_module):
        hazards = [{"title": "Bridge out", "severity": "warning", "type": "obstacle"}]
        notifier = _make_notifier()
        result = notifier.send_hazard_alert("user@example.com", "River X", hazards)
        assert result is True


# ─── send_weekly_digest ─────────────────────────────────────


class TestSendWeeklyDigest:
    """Tests for the weekly digest email."""

    @pytest.fixture
    def rivers(self):
        return [
            {
                "name": "Colorado River",
                "quality": "excellent",
                "flow_rate": 12400.0,
                "hazard_count": 0,
                "runnability": "prime_time",
            },
            {
                "name": "Green River",
                "quality": "fair",
                "flow_rate": 850.0,
                "hazard_count": 2,
                "runnability": "runnable",
            },
        ]

    def test_returns_false_when_unconfigured(self, unconfigured_settings):
        notifier = _make_notifier()
        result = notifier.send_weekly_digest("user@example.com", [{"name": "X", "quality": "good"}])
        assert result is False

    def test_returns_false_for_empty_rivers(self, configured_settings):
        notifier = _make_notifier()
        result = notifier.send_weekly_digest("user@example.com", [])
        assert result is False

    def test_subject_is_weekly_digest(self, configured_settings, _mock_resend_module, rivers):
        notifier = _make_notifier()
        notifier.send_weekly_digest("user@example.com", rivers)
        subject = _mock_resend_module.Emails.send.call_args[0][0]["subject"]
        assert "Weekly Digest" in subject
        assert "🏞️" in subject

    def test_html_contains_river_names(self, configured_settings, _mock_resend_module, rivers):
        notifier = _make_notifier()
        notifier.send_weekly_digest("user@example.com", rivers)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "Colorado River" in html
        assert "Green River" in html

    def test_html_contains_quality_badges(self, configured_settings, _mock_resend_module, rivers):
        notifier = _make_notifier()
        notifier.send_weekly_digest("user@example.com", rivers)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "excellent" in html
        assert "fair" in html

    def test_html_contains_flow_rate(self, configured_settings, _mock_resend_module, rivers):
        notifier = _make_notifier()
        notifier.send_weekly_digest("user@example.com", rivers)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "12400" in html
        assert "CFS" in html

    def test_html_contains_runnability(self, configured_settings, _mock_resend_module, rivers):
        notifier = _make_notifier()
        notifier.send_weekly_digest("user@example.com", rivers)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "Prime Time" in html  # prime_time → Prime Time
        assert "Runnable" in html

    def test_hazard_count_displays_warning(self, configured_settings, _mock_resend_module, rivers):
        notifier = _make_notifier()
        notifier.send_weekly_digest("user@example.com", rivers)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "⚠️ 2" in html

    def test_zero_hazards_shows_none(self, configured_settings, _mock_resend_module, rivers):
        notifier = _make_notifier()
        notifier.send_weekly_digest("user@example.com", rivers)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "✅ None" in html

    def test_missing_flow_rate_shows_dash(self, configured_settings, _mock_resend_module):
        rivers = [{"name": "Mystery River", "quality": "good", "flow_rate": None, "hazard_count": 0}]
        notifier = _make_notifier()
        notifier.send_weekly_digest("user@example.com", rivers)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "—" in html or "&#8212;" in html

    def test_unknown_quality_uses_blue_badge(self, configured_settings, _mock_resend_module):
        rivers = [{"name": "River X", "quality": "unknown", "flow_rate": 100, "hazard_count": 0}]
        notifier = _make_notifier()
        notifier.send_weekly_digest("user@example.com", rivers)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "badge-blue" in html

    def test_none_quality_becomes_unknown(self, configured_settings, _mock_resend_module):
        rivers = [{"name": "River X", "quality": None, "flow_rate": 100, "hazard_count": 0}]
        notifier = _make_notifier()
        notifier.send_weekly_digest("user@example.com", rivers)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "unknown" in html

    def test_html_has_table_structure(self, configured_settings, _mock_resend_module, rivers):
        notifier = _make_notifier()
        notifier.send_weekly_digest("user@example.com", rivers)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "<table>" in html
        assert "<th>" in html
        assert "River" in html
        assert "Quality" in html
        assert "Flow" in html


# ─── Template correctness ──────────────────────────────────


class TestTemplateFormatting:
    """Tests for shared template structure."""

    def test_wrap_html_produces_valid_html_structure(self, configured_settings, _mock_resend_module):
        deals = [{"title": "Test", "price": 50, "url": "#"}]
        notifier = _make_notifier()
        notifier.send_deal_alert("user@example.com", deals)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert html.startswith("<!DOCTYPE html>")
        assert "<html>" in html
        assert "</html>" in html
        assert "Water-Watcher" in html

    def test_email_has_footer(self, configured_settings, _mock_resend_module):
        deals = [{"title": "Test", "price": 50, "url": "#"}]
        notifier = _make_notifier()
        notifier.send_deal_alert("user@example.com", deals)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "notification preferences" in html.lower()

    def test_email_has_header_branding(self, configured_settings, _mock_resend_module):
        deals = [{"title": "Test", "price": 50, "url": "#"}]
        notifier = _make_notifier()
        notifier.send_deal_alert("user@example.com", deals)
        html = _mock_resend_module.Emails.send.call_args[0][0]["html"]
        assert "🏞️" in html

    def test_resend_api_error_types(self, configured_settings, _mock_resend_module):
        """Various exception types from Resend should all be caught."""
        _mock_resend_module.Emails.send.side_effect = ConnectionError("Network error")
        notifier = _make_notifier()
        result = notifier.send_deal_alert("user@example.com", [{"title": "X", "price": 1, "url": "#"}])
        assert result is False

    def test_resend_timeout_error(self, configured_settings, _mock_resend_module):
        _mock_resend_module.Emails.send.side_effect = TimeoutError("Timed out")
        notifier = _make_notifier()
        result = notifier.send_condition_alert("user@example.com", "River", "fair", "good")
        assert result is False
