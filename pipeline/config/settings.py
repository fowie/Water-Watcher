"""Pipeline configuration loaded from environment variables."""

import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))


@dataclass
class Settings:
    # Database
    database_url: str = field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL",
            "postgresql://waterwatcher:waterwatcher@localhost:5432/waterwatcher",
        )
    )

    # Scrape intervals (minutes)
    scrape_interval_minutes: int = field(
        default_factory=lambda: int(os.getenv("SCRAPE_INTERVAL_MINUTES", "240"))
    )
    raft_watch_interval_minutes: int = field(
        default_factory=lambda: int(os.getenv("RAFT_WATCH_INTERVAL_MINUTES", "30"))
    )

    # Request settings
    request_timeout: int = field(
        default_factory=lambda: int(os.getenv("REQUEST_TIMEOUT", "30"))
    )
    rate_limit_delay: float = field(
        default_factory=lambda: float(os.getenv("RATE_LIMIT_DELAY", "2.0"))
    )

    # Craigslist regions to monitor
    craigslist_regions: list[str] = field(
        default_factory=lambda: os.getenv(
            "CRAIGSLIST_REGIONS", "seattle,portland,denver,saltlakecity,boise"
        ).split(",")
    )

    # USGS
    usgs_base_url: str = field(
        default_factory=lambda: os.getenv(
            "USGS_BASE_URL", "https://waterservices.usgs.gov/nwis"
        )
    )

    # American Whitewater
    aw_base_url: str = field(
        default_factory=lambda: os.getenv(
            "AW_BASE_URL",
            "https://www.americanwhitewater.org/content/River/view",
        )
    )

    # Push notifications
    vapid_public_key: str = field(
        default_factory=lambda: os.getenv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "")
    )
    vapid_private_key: str = field(
        default_factory=lambda: os.getenv("VAPID_PRIVATE_KEY", "")
    )
    vapid_subject: str = field(
        default_factory=lambda: os.getenv("VAPID_SUBJECT", "mailto:you@example.com")
    )

    # Email
    resend_api_key: str = field(
        default_factory=lambda: os.getenv("RESEND_API_KEY", "")
    )
    notification_from_email: str = field(
        default_factory=lambda: os.getenv(
            "NOTIFICATION_FROM_EMAIL", "alerts@waterwatcher.app"
        )
    )


settings = Settings()
