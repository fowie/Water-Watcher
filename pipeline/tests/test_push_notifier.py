"""
Tests for the Push Notifier.

Mocks pywebpush.webpush and DB queries to verify:
- _send_push() — success and failure paths
- Expired subscription cleanup (410 Gone response)
- _build_deal_payload() — single and multi-deal payloads
- notify_deal_matches() — grouping by user, marking as notified
- notify_condition_change() — payload construction, direction detection
- notify_hazard_alert() — severity emoji mapping
- Missing VAPID keys — graceful skip
"""

import json
import pytest
from unittest.mock import patch, MagicMock, PropertyMock, call

from notifiers.push_notifier import PushNotifier
from pywebpush import WebPushException


# ─── Mock subscription helpers ──────────────────────────────

def make_mock_subscription(endpoint="https://push.example.com/sub/abc", p256dh="key123", auth="auth456", user_id="user-1"):
    """Create a mock PushSubscription record."""
    sub = MagicMock()
    sub.endpoint = endpoint
    sub.p256dh = p256dh
    sub.auth = auth
    sub.user_id = user_id
    return sub


def make_mock_user_river(user_id="user-1", river_id="river-1", notify=True):
    """Create a mock UserRiver record."""
    ur = MagicMock()
    ur.user_id = user_id
    ur.river_id = river_id
    ur.notify = notify
    return ur


def make_deal_match(user_id="user-1", filter_id="filter-1", deal_id="deal-1",
                    deal_title="NRS Raft", deal_price=1200.0, deal_url="/deals/1"):
    """Create a deal match dict like DealMatcher.match() produces."""
    return {
        "user_id": user_id,
        "filter_id": filter_id,
        "deal_id": deal_id,
        "deal_title": deal_title,
        "deal_price": deal_price,
        "deal_url": deal_url,
    }


class TestSendPush:
    """Tests for PushNotifier._send_push()."""

    def setup_method(self):
        self.notifier = PushNotifier()
        self.sub_info = {
            "endpoint": "https://push.example.com/sub/abc",
            "keys": {"p256dh": "key123", "auth": "auth456"},
        }

    @patch("notifiers.push_notifier.webpush")
    @patch("notifiers.push_notifier.settings")
    def test_send_push_success(self, mock_settings, mock_webpush):
        """Should return True on successful push."""
        mock_settings.vapid_private_key = "test-private-key"
        mock_settings.vapid_subject = "mailto:test@example.com"
        mock_webpush.return_value = None  # no exception = success

        result = self.notifier._send_push(self.sub_info, '{"title": "Test"}')
        assert result is True
        mock_webpush.assert_called_once()

    @patch("notifiers.push_notifier.webpush")
    @patch("notifiers.push_notifier.settings")
    def test_send_push_410_gone(self, mock_settings, mock_webpush):
        """Should return False for 410 Gone (expired subscription)."""
        mock_settings.vapid_private_key = "test-private-key"
        mock_settings.vapid_subject = "mailto:test@example.com"

        mock_response = MagicMock()
        mock_response.status_code = 410
        exc = WebPushException("Gone")
        exc.response = mock_response
        mock_webpush.side_effect = exc

        result = self.notifier._send_push(self.sub_info, '{"title": "Test"}')
        assert result is False

    @patch("notifiers.push_notifier.webpush")
    @patch("notifiers.push_notifier.settings")
    def test_send_push_other_http_error(self, mock_settings, mock_webpush):
        """Should return False for non-410 HTTP errors."""
        mock_settings.vapid_private_key = "test-private-key"
        mock_settings.vapid_subject = "mailto:test@example.com"

        mock_response = MagicMock()
        mock_response.status_code = 500
        exc = WebPushException("Server Error")
        exc.response = mock_response
        mock_webpush.side_effect = exc

        result = self.notifier._send_push(self.sub_info, '{"title": "Test"}')
        assert result is False

    @patch("notifiers.push_notifier.webpush")
    @patch("notifiers.push_notifier.settings")
    def test_send_push_no_response_attr(self, mock_settings, mock_webpush):
        """Should return False when WebPushException has no response."""
        mock_settings.vapid_private_key = "test-private-key"
        mock_settings.vapid_subject = "mailto:test@example.com"

        exc = WebPushException("Network error")
        exc.response = None
        mock_webpush.side_effect = exc

        result = self.notifier._send_push(self.sub_info, '{"title": "Test"}')
        assert result is False

    @patch("notifiers.push_notifier.webpush")
    @patch("notifiers.push_notifier.settings")
    def test_send_push_unexpected_exception(self, mock_settings, mock_webpush):
        """Should return False on unexpected exceptions."""
        mock_settings.vapid_private_key = "test-private-key"
        mock_settings.vapid_subject = "mailto:test@example.com"

        mock_webpush.side_effect = RuntimeError("Something broke")

        result = self.notifier._send_push(self.sub_info, '{"title": "Test"}')
        assert result is False


class TestBuildDealPayload:
    """Tests for PushNotifier._build_deal_payload()."""

    def test_single_deal_payload(self):
        deals = [make_deal_match(deal_title="NRS Raft", deal_price=1200.0, deal_url="/deals/1")]
        payload = json.loads(PushNotifier._build_deal_payload(deals))
        assert "Raft Watch Deal" in payload["title"]
        assert "NRS Raft" in payload["body"]
        assert "$1200" in payload["body"]
        assert payload["url"] == "/deals/1"

    def test_single_deal_no_price(self):
        deals = [make_deal_match(deal_title="Free kayak", deal_price=None)]
        payload = json.loads(PushNotifier._build_deal_payload(deals))
        assert "$" not in payload["body"]
        assert "Free kayak" in payload["body"]

    def test_multi_deal_payload(self):
        deals = [
            make_deal_match(deal_title="Raft A", deal_id="d1"),
            make_deal_match(deal_title="Kayak B", deal_id="d2"),
            make_deal_match(deal_title="Paddle C", deal_id="d3"),
        ]
        payload = json.loads(PushNotifier._build_deal_payload(deals))
        assert "3 New" in payload["title"]
        assert payload["url"] == "/deals"

    def test_multi_deal_with_overflow(self):
        deals = [make_deal_match(deal_title=f"Item {i}", deal_id=f"d{i}") for i in range(5)]
        payload = json.loads(PushNotifier._build_deal_payload(deals))
        assert "+2 more" in payload["body"]

    def test_payload_has_tag(self):
        deals = [make_deal_match()]
        payload = json.loads(PushNotifier._build_deal_payload(deals))
        assert payload["tag"] == "raft-watch"


class TestNotifyDealMatches:
    """Tests for PushNotifier.notify_deal_matches()."""

    def setup_method(self):
        self.notifier = PushNotifier()

    @patch("notifiers.push_notifier.settings")
    def test_skips_when_no_vapid_key(self, mock_settings):
        """Should return 0 and skip if VAPID keys not configured."""
        mock_settings.vapid_private_key = ""
        result = self.notifier.notify_deal_matches([make_deal_match()])
        assert result == 0

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push", return_value=True)
    def test_sends_to_user_subscriptions(self, mock_push, mock_settings, mock_session_cls):
        """Should send push to each user subscription."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        sub1 = make_mock_subscription(endpoint="https://push.example.com/1")
        sub2 = make_mock_subscription(endpoint="https://push.example.com/2")

        # _get_subscriptions returns two subs for user-1
        mock_session.query.return_value.filter.return_value.all.return_value = [sub1, sub2]
        mock_session.query.return_value.filter.return_value.update.return_value = None

        matches = [make_deal_match(user_id="user-1")]
        result = self.notifier.notify_deal_matches(matches)
        assert result == 2
        assert mock_push.call_count == 2

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push", return_value=True)
    def test_groups_by_user(self, mock_push, mock_settings, mock_session_cls):
        """Different users should get separate notifications."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        sub_u1 = make_mock_subscription(endpoint="https://push.example.com/u1", user_id="user-1")
        sub_u2 = make_mock_subscription(endpoint="https://push.example.com/u2", user_id="user-2")

        # Return different subs per user query
        def mock_get_subs(session, user_id):
            if user_id == "user-1":
                return [sub_u1]
            elif user_id == "user-2":
                return [sub_u2]
            return []

        self.notifier._get_subscriptions = mock_get_subs

        matches = [
            make_deal_match(user_id="user-1", deal_id="d1"),
            make_deal_match(user_id="user-2", deal_id="d2"),
        ]

        result = self.notifier.notify_deal_matches(matches)
        assert result == 2

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push", return_value=False)
    @patch.object(PushNotifier, "_remove_subscription")
    def test_removes_subscription_on_failure(self, mock_remove, mock_push, mock_settings, mock_session_cls):
        """Should remove subscription when push fails."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        sub = make_mock_subscription(endpoint="https://push.example.com/expired")
        mock_session.query.return_value.filter.return_value.all.return_value = [sub]
        mock_session.query.return_value.filter.return_value.update.return_value = None

        matches = [make_deal_match()]
        self.notifier.notify_deal_matches(matches)

        mock_remove.assert_called_once_with(mock_session, "https://push.example.com/expired")

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push", return_value=True)
    def test_no_subscriptions_sends_nothing(self, mock_push, mock_settings, mock_session_cls):
        """Should not send if user has no subscriptions."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        # _get_subscriptions returns empty
        mock_session.query.return_value.filter.return_value.all.return_value = []

        matches = [make_deal_match()]
        result = self.notifier.notify_deal_matches(matches)
        assert result == 0
        mock_push.assert_not_called()

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push")
    def test_commits_session_on_success(self, mock_push, mock_settings, mock_session_cls):
        """DB session should be committed after successful dispatch."""
        mock_settings.vapid_private_key = "test-key"
        mock_push.return_value = True

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = []

        self.notifier.notify_deal_matches([make_deal_match()])
        mock_session.commit.assert_called_once()

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push")
    def test_rollback_on_exception(self, mock_push, mock_settings, mock_session_cls):
        """DB session should be rolled back if an exception occurs."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        # Make the query blow up
        mock_session.query.side_effect = RuntimeError("DB error")

        self.notifier.notify_deal_matches([make_deal_match()])
        mock_session.rollback.assert_called_once()


class TestNotifyConditionChange:
    """Tests for PushNotifier.notify_condition_change()."""

    def setup_method(self):
        self.notifier = PushNotifier()

    @patch("notifiers.push_notifier.settings")
    def test_skips_when_no_vapid_key(self, mock_settings):
        """Should return 0 if VAPID keys not configured."""
        mock_settings.vapid_private_key = ""
        result = self.notifier.notify_condition_change("r1", "Test River", "poor", "good")
        assert result == 0

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push", return_value=True)
    def test_sends_notification_on_improvement(self, mock_push, mock_settings, mock_session_cls):
        """Should send a notification when quality improves."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        ur = make_mock_user_river(user_id="user-1", river_id="river-1")
        sub = make_mock_subscription()

        # First query: UserRiver tracking
        # Second query: PushSubscription for user
        mock_session.query.return_value.filter.return_value.all.side_effect = [
            [ur],    # tracked users
            [sub],   # subscriptions
        ]

        result = self.notifier.notify_condition_change("river-1", "Salmon River", "fair", "good")
        assert result == 1

        # Verify payload content
        sent_payload = json.loads(mock_push.call_args[0][1])
        assert "Improved" in sent_payload["title"]
        assert "fair" in sent_payload["body"]
        assert "good" in sent_payload["body"]
        assert sent_payload["url"] == "/rivers/river-1"

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push", return_value=True)
    def test_deterioration_uses_red_emoji(self, mock_push, mock_settings, mock_session_cls):
        """Should use red emoji when quality changes to dangerous."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        ur = make_mock_user_river()
        sub = make_mock_subscription()
        mock_session.query.return_value.filter.return_value.all.side_effect = [[ur], [sub]]

        self.notifier.notify_condition_change("r1", "Test River", "fair", "dangerous")
        sent_payload = json.loads(mock_push.call_args[0][1])
        assert "🔴" in sent_payload["title"]
        assert "Deteriorated" in sent_payload["title"]

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push", return_value=True)
    def test_lateral_change_uses_yellow_emoji(self, mock_push, mock_settings, mock_session_cls):
        """Should use yellow emoji for non-improvement non-dangerous changes."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        ur = make_mock_user_river()
        sub = make_mock_subscription()
        mock_session.query.return_value.filter.return_value.all.side_effect = [[ur], [sub]]

        self.notifier.notify_condition_change("r1", "Test River", "good", "fair")
        sent_payload = json.loads(mock_push.call_args[0][1])
        assert "🟡" in sent_payload["title"]
        assert "Changed" in sent_payload["title"]

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    def test_no_tracked_users_returns_zero(self, mock_settings, mock_session_cls):
        """Should return 0 if no users are tracking this river."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.query.return_value.filter.return_value.all.return_value = []

        result = self.notifier.notify_condition_change("r1", "Empty River", "poor", "good")
        assert result == 0

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push", return_value=True)
    def test_unknown_quality_handled(self, mock_push, mock_settings, mock_session_cls):
        """Should handle quality values not in the quality_order list."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        ur = make_mock_user_river()
        sub = make_mock_subscription()
        mock_session.query.return_value.filter.return_value.all.side_effect = [[ur], [sub]]

        # "unknown_quality" is not in quality_order list — should not crash
        result = self.notifier.notify_condition_change("r1", "Test", "unknown_old", "unknown_new")
        assert result == 1


class TestNotifyHazardAlert:
    """Tests for PushNotifier.notify_hazard_alert()."""

    def setup_method(self):
        self.notifier = PushNotifier()

    @patch("notifiers.push_notifier.settings")
    def test_skips_when_no_vapid_key(self, mock_settings):
        mock_settings.vapid_private_key = ""
        result = self.notifier.notify_hazard_alert("r1", "Test River", "Fallen tree", "danger")
        assert result == 0

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push", return_value=True)
    def test_danger_severity_emoji(self, mock_push, mock_settings, mock_session_cls):
        """Should use red circle emoji for danger severity."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        ur = make_mock_user_river()
        sub = make_mock_subscription()
        mock_session.query.return_value.filter.return_value.all.side_effect = [[ur], [sub]]

        result = self.notifier.notify_hazard_alert("r1", "Salmon River", "Strainer at mile 5", "danger")
        assert result == 1

        payload = json.loads(mock_push.call_args[0][1])
        assert "🔴" in payload["title"]
        assert "Strainer at mile 5" in payload["body"]
        assert payload["tag"] == "hazard-r1"

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push", return_value=True)
    def test_warning_severity_emoji(self, mock_push, mock_settings, mock_session_cls):
        """Should use warning emoji for warning severity."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        ur = make_mock_user_river()
        sub = make_mock_subscription()
        mock_session.query.return_value.filter.return_value.all.side_effect = [[ur], [sub]]

        self.notifier.notify_hazard_alert("r1", "Lochsa", "High water advisory", "warning")
        payload = json.loads(mock_push.call_args[0][1])
        assert "⚠️" in payload["title"]

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push", return_value=True)
    def test_info_severity_emoji(self, mock_push, mock_settings, mock_session_cls):
        """Should use info emoji for info severity."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        ur = make_mock_user_river()
        sub = make_mock_subscription()
        mock_session.query.return_value.filter.return_value.all.side_effect = [[ur], [sub]]

        self.notifier.notify_hazard_alert("r1", "Payette", "Shuttle road construction", "info")
        payload = json.loads(mock_push.call_args[0][1])
        assert "ℹ️" in payload["title"]


class TestExpiredSubscriptionCleanup:
    """Tests verifying expired subscriptions are cleaned up."""

    def setup_method(self):
        self.notifier = PushNotifier()

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push", return_value=False)
    @patch.object(PushNotifier, "_remove_subscription")
    def test_condition_change_removes_expired_sub(self, mock_remove, mock_push, mock_settings, mock_session_cls):
        """Expired subs should be removed during condition notifications."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        ur = make_mock_user_river()
        sub = make_mock_subscription(endpoint="https://push.example.com/expired")
        mock_session.query.return_value.filter.return_value.all.side_effect = [[ur], [sub]]

        self.notifier.notify_condition_change("r1", "Test", "poor", "good")
        mock_remove.assert_called_once_with(mock_session, "https://push.example.com/expired")

    @patch("notifiers.push_notifier.SessionLocal")
    @patch("notifiers.push_notifier.settings")
    @patch.object(PushNotifier, "_send_push", return_value=False)
    @patch.object(PushNotifier, "_remove_subscription")
    def test_hazard_alert_removes_expired_sub(self, mock_remove, mock_push, mock_settings, mock_session_cls):
        """Expired subs should be removed during hazard notifications."""
        mock_settings.vapid_private_key = "test-key"

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        ur = make_mock_user_river()
        sub = make_mock_subscription(endpoint="https://push.example.com/gone")
        mock_session.query.return_value.filter.return_value.all.side_effect = [[ur], [sub]]

        self.notifier.notify_hazard_alert("r1", "Test", "Alert", "danger")
        mock_remove.assert_called_once_with(mock_session, "https://push.example.com/gone")
