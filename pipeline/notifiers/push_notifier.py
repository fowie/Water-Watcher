"""
Push Notifier

Sends Web Push notifications to users via the pywebpush library.

Notification types:
- Deal matches: When Raft Watch finds gear matching a user's filter
- Condition changes: When a tracked river's quality changes significantly
- Hazard alerts: When a new hazard is reported on a tracked river

Reads VAPID keys from settings and push subscriptions from the database.
Handles expired/invalid subscriptions gracefully by removing them.
"""

import json
import logging

from pywebpush import webpush, WebPushException

from models import SessionLocal, PushSubscription, DealFilterMatch, UserRiver
from config.settings import settings

logger = logging.getLogger("pipeline.notifiers.push")


class PushNotifier:
    """Send Web Push notifications to subscribed users.

    Uses the VAPID protocol with pywebpush. Automatically cleans up
    expired or invalid push subscriptions when delivery fails with
    a 410 (Gone) status.
    """

    def _send_push(self, subscription_info: dict, payload: str) -> bool:
        """Send a single web push notification.

        Args:
            subscription_info: Dict with endpoint, keys (p256dh, auth).
            payload: JSON string payload for the notification.

        Returns:
            True if sent successfully, False otherwise.
        """
        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
            )
            return True
        except WebPushException as e:
            # 410 Gone = subscription expired, should be removed
            if hasattr(e, "response") and e.response is not None:
                if e.response.status_code == 410:
                    logger.info(f"Push subscription expired: {subscription_info.get('endpoint', '')[:60]}...")
                    return False
                logger.warning(
                    f"Push failed (HTTP {e.response.status_code}): "
                    f"{subscription_info.get('endpoint', '')[:60]}..."
                )
            else:
                logger.warning(f"Push failed: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected push error: {e}")
            return False

    def _get_subscriptions(self, session, user_id: str) -> list[PushSubscription]:
        """Get all push subscriptions for a user.

        Args:
            session: Active DB session.
            user_id: User ID to look up.

        Returns:
            List of PushSubscription records.
        """
        return (
            session.query(PushSubscription)
            .filter(PushSubscription.user_id == user_id)
            .all()
        )

    def _remove_subscription(self, session, endpoint: str) -> None:
        """Remove an expired/invalid subscription from the database.

        Args:
            session: Active DB session.
            endpoint: The push endpoint URL to remove.
        """
        session.query(PushSubscription).filter(
            PushSubscription.endpoint == endpoint
        ).delete()

    def notify_deal_matches(self, matches: list[dict]) -> int:
        """Send push notifications for new deal filter matches.

        Groups matches by user, builds a notification payload for each,
        and sends via web push. Marks matched records as notified.

        Args:
            matches: List of match dicts from DealMatcher.match().

        Returns:
            Number of notifications successfully sent.
        """
        if not settings.vapid_private_key:
            logger.warning("VAPID keys not configured, skipping push notifications")
            return 0

        session = SessionLocal()
        sent = 0

        try:
            # Group matches by user
            user_matches: dict[str, list[dict]] = {}
            for match in matches:
                uid = match["user_id"]
                if uid not in user_matches:
                    user_matches[uid] = []
                user_matches[uid].append(match)

            for user_id, user_deals in user_matches.items():
                subs = self._get_subscriptions(session, user_id)
                if not subs:
                    continue

                # Build notification payload
                payload = self._build_deal_payload(user_deals)

                for sub in subs:
                    subscription_info = {
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    }

                    success = self._send_push(subscription_info, payload)
                    if success:
                        sent += 1
                        logger.info(f"Deal notification sent to user {user_id}")
                    else:
                        # Check if subscription should be cleaned up
                        # (410 Gone indicates it's permanently invalid)
                        self._remove_subscription(session, sub.endpoint)

                # Mark matches as notified
                for deal in user_deals:
                    session.query(DealFilterMatch).filter(
                        DealFilterMatch.filter_id == deal["filter_id"],
                        DealFilterMatch.deal_id == deal["deal_id"],
                    ).update({"notified": True})

            session.commit()
            logger.info(f"Deal notifications: {sent} sent to {len(user_matches)} users")

        except Exception as e:
            session.rollback()
            logger.error(f"Notification dispatch failed: {e}", exc_info=True)
        finally:
            session.close()

        return sent

    def notify_condition_change(
        self, river_id: str, river_name: str, old_quality: str, new_quality: str
    ) -> int:
        """Send push notifications when a river's quality changes significantly.

        Notifies all users who have opted into notifications for this river
        via the user_rivers tracking table.

        Args:
            river_id: ID of the river whose condition changed.
            river_name: Human-readable river name.
            old_quality: Previous quality label.
            new_quality: New quality label.

        Returns:
            Number of notifications successfully sent.
        """
        if not settings.vapid_private_key:
            logger.warning("VAPID keys not configured, skipping push notifications")
            return 0

        session = SessionLocal()
        sent = 0

        try:
            # Find users tracking this river with notifications enabled
            tracked = (
                session.query(UserRiver)
                .filter(
                    UserRiver.river_id == river_id,
                    UserRiver.notify.is_(True),
                )
                .all()
            )

            if not tracked:
                return 0

            # Determine if this is a good or bad change
            quality_order = ["dangerous", "poor", "fair", "good", "excellent"]
            old_idx = quality_order.index(old_quality) if old_quality in quality_order else -1
            new_idx = quality_order.index(new_quality) if new_quality in quality_order else -1

            if new_idx > old_idx:
                emoji = "🟢"
                direction = "improved"
            elif new_quality == "dangerous":
                emoji = "🔴"
                direction = "deteriorated"
            else:
                emoji = "🟡"
                direction = "changed"

            payload = json.dumps({
                "title": f"{emoji} {river_name} Conditions {direction.title()}",
                "body": f"Quality went from {old_quality} to {new_quality}",
                "url": f"/rivers/{river_id}",
                "tag": f"river-{river_id}",
            })

            for ur in tracked:
                subs = self._get_subscriptions(session, ur.user_id)
                for sub in subs:
                    subscription_info = {
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    }
                    success = self._send_push(subscription_info, payload)
                    if success:
                        sent += 1
                    else:
                        self._remove_subscription(session, sub.endpoint)

            session.commit()
            logger.info(
                f"Condition change notifications for {river_name}: "
                f"{sent} sent ({old_quality} → {new_quality})"
            )

        except Exception as e:
            session.rollback()
            logger.error(f"Condition notification failed: {e}", exc_info=True)
        finally:
            session.close()

        return sent

    def notify_hazard_alert(
        self, river_id: str, river_name: str, hazard_title: str, severity: str
    ) -> int:
        """Send push notifications for new hazard reports on a tracked river.

        Args:
            river_id: ID of the affected river.
            river_name: Human-readable river name.
            hazard_title: Title/summary of the hazard.
            severity: Severity level ('info', 'warning', 'danger').

        Returns:
            Number of notifications successfully sent.
        """
        if not settings.vapid_private_key:
            logger.warning("VAPID keys not configured, skipping push notifications")
            return 0

        session = SessionLocal()
        sent = 0

        try:
            tracked = (
                session.query(UserRiver)
                .filter(
                    UserRiver.river_id == river_id,
                    UserRiver.notify.is_(True),
                )
                .all()
            )

            if not tracked:
                return 0

            severity_emoji = {"danger": "🔴", "warning": "⚠️", "info": "ℹ️"}
            emoji = severity_emoji.get(severity, "⚠️")

            payload = json.dumps({
                "title": f"{emoji} Hazard Alert: {river_name}",
                "body": hazard_title,
                "url": f"/rivers/{river_id}",
                "tag": f"hazard-{river_id}",
            })

            for ur in tracked:
                subs = self._get_subscriptions(session, ur.user_id)
                for sub in subs:
                    subscription_info = {
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    }
                    success = self._send_push(subscription_info, payload)
                    if success:
                        sent += 1
                    else:
                        self._remove_subscription(session, sub.endpoint)

            session.commit()
            logger.info(f"Hazard alert for {river_name}: {sent} notifications sent")

        except Exception as e:
            session.rollback()
            logger.error(f"Hazard notification failed: {e}", exc_info=True)
        finally:
            session.close()

        return sent

    @staticmethod
    def _build_deal_payload(deals: list[dict]) -> str:
        """Build notification payload JSON for deal matches.

        Args:
            deals: List of deal match dicts.

        Returns:
            JSON string for the notification payload.
        """
        if len(deals) == 1:
            deal = deals[0]
            title = "🛶 Raft Watch Deal!"
            body = deal["deal_title"]
            if deal.get("deal_price"):
                body += f" — ${deal['deal_price']:.0f}"
            url = deal.get("deal_url", "/deals")
        else:
            title = f"🛶 {len(deals)} New Raft Watch Deals!"
            body = ", ".join(d["deal_title"][:30] for d in deals[:3])
            if len(deals) > 3:
                body += f" +{len(deals) - 3} more"
            url = "/deals"

        return json.dumps({
            "title": title,
            "body": body,
            "url": url,
            "tag": "raft-watch",
        })
