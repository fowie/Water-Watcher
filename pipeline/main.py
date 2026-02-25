"""
Water-Watcher Scraping Pipeline

Entry point for the scheduled scraping pipeline. Runs scrapers on configurable
intervals to collect river conditions, hazards, and gear deals.

Schedule defaults:
- River conditions (USGS + AW): every 4 hours
- Raft Watch (Craigslist): every 30 minutes
"""

import logging
import signal
import sys
from datetime import datetime

from apscheduler.schedulers.blocking import BlockingScheduler
from dotenv import load_dotenv

from config.settings import settings
from scrapers.usgs import USGSScraper
from scrapers.american_whitewater import AmericanWhitewaterScraper
from scrapers.craigslist import CraigslistScraper
from scrapers.blm import BLMScraper
from scrapers.usfs import USFSScraper
from processors.condition_processor import ConditionProcessor
from processors.deal_matcher import DealMatcher
from notifiers.push_notifier import PushNotifier

# Load environment variables from project root
load_dotenv(dotenv_path="../.env")


def _validate_startup():
    """Check critical configuration before starting the pipeline."""
    import os

    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        logging.critical(
            "DATABASE_URL is not set. The pipeline cannot connect to the database. "
            "Set DATABASE_URL in your .env file or environment."
        )
        sys.exit(1)

    if not os.getenv("NEXT_PUBLIC_VAPID_PUBLIC_KEY") or not os.getenv("VAPID_PRIVATE_KEY"):
        logging.warning(
            "VAPID keys are not configured. Push notifications will be disabled. "
            "Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to enable them."
        )


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("pipeline.log"),
    ],
)

logger = logging.getLogger("pipeline")


def run_river_scrapers():
    """Run all river condition scrapers and process results.

    Runs USGS and American Whitewater scrapers sequentially, processes
    their output through the condition normalizer, and sends push
    notifications for any significant quality changes.
    """
    logger.info("Starting river condition scrape cycle")
    processor = ConditionProcessor()
    notifier = PushNotifier()

    scrapers = [
        USGSScraper(),
        AmericanWhitewaterScraper(),
    ]

    for scraper in scrapers:
        try:
            logger.info(f"Running {scraper.name}...")
            raw_data = scraper.scrape()
            processed = processor.process(raw_data, source=scraper.name)
            logger.info(f"{scraper.name}: processed {len(processed)} records")

            # Check for quality changes and notify users
            for record in processed:
                if record.get("quality_changed"):
                    notifier.notify_condition_change(
                        river_id=record["river_id"],
                        river_name=record.get("river_name", "Unknown River"),
                        old_quality=record["old_quality"],
                        new_quality=record["new_quality"],
                    )
        except Exception as e:
            logger.error(f"{scraper.name} failed: {e}", exc_info=True)


def run_raft_watch():
    """Run Craigslist gear deal scraper and match against user filters.

    Scrapes configured Craigslist regions, saves new deals, matches
    them against active deal filters, and sends push notifications
    for strong matches.
    """
    logger.info("Starting Raft Watch scrape cycle")
    scraper = CraigslistScraper()
    matcher = DealMatcher()
    notifier = PushNotifier()

    try:
        deals = scraper.scrape()
        logger.info(f"Craigslist: found {len(deals)} deals")

        matches = matcher.match(deals)
        if matches:
            logger.info(f"Raft Watch: {len(matches)} filter matches above threshold")
            notifier.notify_deal_matches(matches)
        else:
            logger.info("Raft Watch: no new matches this cycle")
    except Exception as e:
        logger.error(f"Raft Watch failed: {e}", exc_info=True)


def run_land_agency_scrapers():
    """Run BLM and USFS scrapers for land agency advisories.

    Runs both scrapers and processes their output through the condition
    processor. These update less frequently than water gauges.
    """
    logger.info("Starting land agency scrape cycle")
    processor = ConditionProcessor()
    notifier = PushNotifier()

    scrapers = [
        BLMScraper(),
        USFSScraper(),
    ]

    for scraper in scrapers:
        try:
            logger.info(f"Running {scraper.name}...")
            raw_data = scraper.scrape()
            processed = processor.process(raw_data, source=scraper.name)
            logger.info(f"{scraper.name}: processed {len(processed)} records")

            for record in processed:
                if record.get("quality_changed"):
                    notifier.notify_condition_change(
                        river_id=record["river_id"],
                        river_name=record.get("river_name", "Unknown River"),
                        old_quality=record["old_quality"],
                        new_quality=record["new_quality"],
                    )
        except Exception as e:
            logger.error(f"{scraper.name} failed: {e}", exc_info=True)


def main():
    _validate_startup()

    logger.info("=" * 60)
    logger.info("Water-Watcher Pipeline starting")
    logger.info(f"Time: {datetime.now().isoformat()}")
    logger.info(f"River scrape interval: {settings.scrape_interval_minutes}m")
    logger.info(f"Raft Watch interval: {settings.raft_watch_interval_minutes}m")
    logger.info(f"Land agency interval: {settings.land_agency_interval_minutes}m")
    logger.info("=" * 60)

    scheduler = BlockingScheduler()

    # River conditions — every 4 hours by default
    scheduler.add_job(
        run_river_scrapers,
        "interval",
        minutes=settings.scrape_interval_minutes,
        id="river_scrapers",
        name="River Condition Scrapers (USGS + AW)",
        next_run_time=datetime.now(),  # run immediately on start
    )

    # Raft Watch — every 30 minutes by default
    scheduler.add_job(
        run_raft_watch,
        "interval",
        minutes=settings.raft_watch_interval_minutes,
        id="raft_watch",
        name="Raft Watch (Craigslist Deals)",
        next_run_time=datetime.now(),
    )

    # Land agency advisories (BLM + USFS) — every 6 hours by default
    scheduler.add_job(
        run_land_agency_scrapers,
        "interval",
        minutes=settings.land_agency_interval_minutes,
        id="land_agency_scrapers",
        name="Land Agency Scrapers (BLM + USFS)",
        next_run_time=datetime.now(),
    )

    # Graceful shutdown
    def shutdown(signum, frame):
        logger.info("Shutting down pipeline...")
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Pipeline stopped")


if __name__ == "__main__":
    main()
