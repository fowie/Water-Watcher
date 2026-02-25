"""
Email Notifier

Sends email notifications to users via the Resend API.

Notification types:
- Deal alerts: Formatted email when gear deals match a user's filter
- Condition alerts: When a tracked river's quality changes
- Hazard alerts: When a new hazard is reported on a tracked river
- Weekly digest: Summary of all tracked rivers' conditions

Uses inline HTML templates (no template engine dependency).
"""

import logging
from datetime import datetime, timezone

import resend

from config.settings import settings

logger = logging.getLogger("pipeline.notifiers.email")

# ─── HTML Templates ─────────────────────────────────────────

STYLES = """
<style>
  body { font-family: -apple-system, system-ui, sans-serif; color: #1a1a1a; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 24px; }
  .header { background: #1e40af; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
  .header h1 { margin: 0; font-size: 20px; }
  .content { background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; }
  .footer { text-align: center; padding: 16px; color: #64748b; font-size: 12px; }
  .card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 12px 0; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-yellow { background: #fef9c3; color: #854d0e; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .price { font-size: 18px; font-weight: 700; color: #166534; }
  .btn { display: inline-block; background: #1e40af; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  td, th { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  th { background: #f1f5f9; font-size: 13px; color: #475569; }
</style>
"""


def _wrap_html(title: str, body_html: str) -> str:
    """Wrap body content in the standard email template."""
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8">{STYLES}</head>
<body>
<div class="container">
  <div class="header"><h1>🏞️ Water-Watcher</h1></div>
  <div class="content">
    <h2 style="margin-top:0">{title}</h2>
    {body_html}
  </div>
  <div class="footer">
    <p>Water-Watcher &middot; Whitewater Rafting Tracker</p>
    <p>You're receiving this because of your notification preferences.</p>
  </div>
</div>
</body>
</html>"""


class EmailNotifier:
    """Send email notifications via the Resend API.

    Requires RESEND_API_KEY and NOTIFICATION_FROM_EMAIL to be configured.
    Silently skips when the API key is not set.
    """

    def __init__(self):
        if settings.resend_api_key:
            resend.api_key = settings.resend_api_key
        self.from_email = settings.notification_from_email

    def _is_configured(self) -> bool:
        """Check if the email notifier is properly configured."""
        if not settings.resend_api_key:
            logger.debug("Resend API key not configured, skipping email notification")
            return False
        return True

    def _send(self, to: str, subject: str, html: str) -> bool:
        """Send a single email via Resend.

        Args:
            to: Recipient email address.
            subject: Email subject line.
            html: HTML body content.

        Returns:
            True if sent successfully, False otherwise.
        """
        try:
            resend.Emails.send({
                "from": self.from_email,
                "to": [to],
                "subject": subject,
                "html": html,
            })
            logger.info(f"Email sent to {to}: {subject}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to}: {e}")
            return False

    def send_deal_alert(self, user_email: str, deals: list[dict]) -> bool:
        """Send an email with matching gear deals.

        Args:
            user_email: Recipient email address.
            deals: List of deal dicts with keys: title, price, url, category, region.

        Returns:
            True if email sent successfully, False otherwise.
        """
        if not self._is_configured():
            return False

        if not deals:
            return False

        if len(deals) == 1:
            subject = f"🛶 Raft Watch Deal: {deals[0].get('title', 'New Deal')}"
        else:
            subject = f"🛶 {len(deals)} New Raft Watch Deals!"

        rows = ""
        for deal in deals:
            price_str = f"${deal['price']:.0f}" if deal.get("price") is not None else "N/A"
            category = deal.get("category", "gear").title()
            region = deal.get("region", "—")
            url = deal.get("url", "#")
            rows += f"""
            <div class="card">
              <h3 style="margin:0 0 8px 0">
                <a href="{url}" style="color:#1e40af;text-decoration:none">{deal.get('title', 'Deal')}</a>
              </h3>
              <span class="price">{price_str}</span>
              <span class="badge badge-blue" style="margin-left:8px">{category}</span>
              <p style="color:#64748b;margin:8px 0 0 0">📍 {region}</p>
            </div>"""

        body = f"""
        <p>We found {len(deals)} gear {"deal" if len(deals) == 1 else "deals"} matching your filters:</p>
        {rows}
        <p style="text-align:center;margin-top:24px">
          <a href="/deals" class="btn">View All Deals</a>
        </p>"""

        html = _wrap_html("New Gear Deals", body)
        return self._send(user_email, subject, html)

    def send_condition_alert(
        self,
        user_email: str,
        river_name: str,
        old_quality: str,
        new_quality: str,
        details: dict | None = None,
    ) -> bool:
        """Send an email when a river's condition changes.

        Args:
            user_email: Recipient email address.
            river_name: Human-readable river name.
            old_quality: Previous quality label.
            new_quality: New quality label.
            details: Optional dict with flow_rate, gauge_height, water_temp, river_id.

        Returns:
            True if email sent successfully, False otherwise.
        """
        if not self._is_configured():
            return False

        quality_order = ["dangerous", "poor", "fair", "good", "excellent"]
        old_idx = quality_order.index(old_quality) if old_quality in quality_order else -1
        new_idx = quality_order.index(new_quality) if new_quality in quality_order else -1

        if new_idx > old_idx:
            emoji = "🟢"
            direction = "Improved"
            badge_class = "badge-green"
        elif new_quality == "dangerous":
            emoji = "🔴"
            direction = "Deteriorated"
            badge_class = "badge-red"
        else:
            emoji = "🟡"
            direction = "Changed"
            badge_class = "badge-yellow"

        subject = f"{emoji} {river_name} — Conditions {direction}"

        details = details or {}
        detail_rows = ""
        if details.get("flow_rate") is not None:
            detail_rows += f"<tr><td><strong>Flow Rate</strong></td><td>{details['flow_rate']:.0f} CFS</td></tr>"
        if details.get("gauge_height") is not None:
            detail_rows += f"<tr><td><strong>Gauge Height</strong></td><td>{details['gauge_height']:.1f} ft</td></tr>"
        if details.get("water_temp") is not None:
            detail_rows += f"<tr><td><strong>Water Temp</strong></td><td>{details['water_temp']:.0f}°F</td></tr>"

        river_id = details.get("river_id", "")
        river_link = f"/rivers/{river_id}" if river_id else "/rivers"

        body = f"""
        <div class="card">
          <h3 style="margin:0 0 12px 0">{river_name}</h3>
          <p>
            <span class="badge badge-yellow">{old_quality}</span>
            &rarr;
            <span class="badge {badge_class}">{new_quality}</span>
          </p>
          {f'<table>{detail_rows}</table>' if detail_rows else ''}
        </div>
        <p style="text-align:center;margin-top:24px">
          <a href="{river_link}" class="btn">View River Details</a>
        </p>"""

        html = _wrap_html(f"Conditions {direction}", body)
        return self._send(user_email, subject, html)

    def send_hazard_alert(
        self, user_email: str, river_name: str, hazards: list[dict]
    ) -> bool:
        """Send an email when new hazards are reported on a tracked river.

        Args:
            user_email: Recipient email address.
            river_name: Human-readable river name.
            hazards: List of hazard dicts with keys: title, severity, type, description.

        Returns:
            True if email sent successfully, False otherwise.
        """
        if not self._is_configured():
            return False

        if not hazards:
            return False

        severity_emoji = {"danger": "🔴", "warning": "⚠️", "info": "ℹ️"}
        top_severity = "info"
        for h in hazards:
            if h.get("severity") == "danger":
                top_severity = "danger"
                break
            if h.get("severity") == "warning":
                top_severity = "warning"

        emoji = severity_emoji.get(top_severity, "⚠️")
        subject = f"{emoji} Hazard Alert: {river_name}"

        cards = ""
        for h in hazards:
            sev = h.get("severity", "info")
            badge_cls = "badge-red" if sev == "danger" else ("badge-yellow" if sev == "warning" else "badge-blue")
            desc = h.get("description", "") or ""
            cards += f"""
            <div class="card">
              <h3 style="margin:0 0 8px 0">{h.get('title', 'Hazard')}</h3>
              <span class="badge {badge_cls}">{sev.upper()}</span>
              <span class="badge badge-blue" style="margin-left:4px">{h.get('type', 'unknown')}</span>
              {f'<p style="color:#475569;margin:8px 0 0 0">{desc[:200]}</p>' if desc else ''}
            </div>"""

        body = f"""
        <p>{len(hazards)} new hazard{"" if len(hazards) == 1 else "s"} reported on <strong>{river_name}</strong>:</p>
        {cards}
        <p style="text-align:center;margin-top:24px">
          <a href="/rivers" class="btn">View River Details</a>
        </p>"""

        html = _wrap_html("Hazard Alert", body)
        return self._send(user_email, subject, html)

    def send_weekly_digest(
        self, user_email: str, rivers_summary: list[dict]
    ) -> bool:
        """Send a weekly summary of tracked rivers.

        Args:
            user_email: Recipient email address.
            rivers_summary: List of river summary dicts with keys:
                name, quality, flow_rate, hazard_count, runnability.

        Returns:
            True if email sent successfully, False otherwise.
        """
        if not self._is_configured():
            return False

        if not rivers_summary:
            return False

        subject = "🏞️ Water-Watcher Weekly Digest"
        now = datetime.now(timezone.utc).strftime("%B %d, %Y")

        quality_badge = {
            "excellent": "badge-green",
            "good": "badge-green",
            "fair": "badge-yellow",
            "poor": "badge-red",
            "dangerous": "badge-red",
        }

        rows = ""
        for r in rivers_summary:
            q = r.get("quality", "unknown") or "unknown"
            badge_cls = quality_badge.get(q, "badge-blue")
            flow = f"{r['flow_rate']:.0f} CFS" if r.get("flow_rate") is not None else "—"
            hazards = r.get("hazard_count", 0)
            hazard_str = f"⚠️ {hazards}" if hazards > 0 else "✅ None"
            runnability = (r.get("runnability") or "—").replace("_", " ").title()

            rows += f"""<tr>
              <td><strong>{r.get('name', 'River')}</strong></td>
              <td><span class="badge {badge_cls}">{q}</span></td>
              <td>{flow}</td>
              <td>{runnability}</td>
              <td>{hazard_str}</td>
            </tr>"""

        body = f"""
        <p>Here's your weekly summary for <strong>{now}</strong>:</p>
        <table>
          <tr>
            <th>River</th>
            <th>Quality</th>
            <th>Flow</th>
            <th>Runnability</th>
            <th>Hazards</th>
          </tr>
          {rows}
        </table>
        <p style="text-align:center;margin-top:24px">
          <a href="/rivers" class="btn">View All Rivers</a>
        </p>"""

        html = _wrap_html("Weekly Digest", body)
        return self._send(user_email, subject, html)
