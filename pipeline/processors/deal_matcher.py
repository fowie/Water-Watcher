"""
Deal Matcher

Matches newly scraped gear deals against user-defined deal filters.
Produces match records and triggers notifications for strong matches.

Scoring criteria:
- Category match: +30 points
- Keyword match: +10 per keyword (up to 40)
- Under max price: +20, plus bonus for being well under
- Region match: +10
- Total possible: 100

Matches scoring 50+ are considered "strong" and trigger notifications.
"""

import logging
import uuid
from datetime import datetime, timezone

from models import SessionLocal, GearDeal, DealFilter, DealFilterMatch, ScrapeLog
from scrapers.base import ScrapedItem

logger = logging.getLogger("pipeline.processors.deal_matcher")

# Minimum match score to trigger a notification
NOTIFICATION_THRESHOLD = 50


class DealMatcher:
    """Match gear deals against user filters and score match quality.

    Saves new deals to the database, matches them against all active
    user filters, scores each match, and returns results suitable
    for the notification pipeline.
    """

    def match(self, deals: list[ScrapedItem]) -> list[dict]:
        """Save deals to DB and match against active deal filters.

        For each new deal:
        1. Skip if URL already exists (dedup)
        2. Save to gear_deals table
        3. Compare against every active filter
        4. Score the match quality
        5. Save DealFilterMatch records for hits

        Args:
            deals: List of ScrapedItem objects from the Craigslist scraper.

        Returns:
            List of match dicts with filter, deal, and score info.
        """
        session = SessionLocal()
        new_matches = []
        started_at = datetime.now(timezone.utc)
        deals_saved = 0

        try:
            # Get all active filters
            filters = (
                session.query(DealFilter)
                .filter(DealFilter.is_active.is_(True))
                .all()
            )

            if not filters:
                logger.info("No active deal filters, skipping matching")
                return []

            logger.info(f"Matching {len(deals)} deals against {len(filters)} active filters")

            for item in deals:
                data = item.data
                url = data.get("url")

                if not url:
                    continue

                # Dedup by URL
                existing = (
                    session.query(GearDeal)
                    .filter(GearDeal.url == url)
                    .first()
                )

                if existing:
                    continue  # Already scraped

                deal = GearDeal(
                    id=str(uuid.uuid4()),
                    title=data.get("title", ""),
                    price=data.get("price"),
                    url=url,
                    image_url=data.get("image_url"),
                    description=data.get("description"),
                    category=data.get("category"),
                    region=data.get("region"),
                    posted_at=data.get("posted_at"),
                    scraped_at=item.scraped_at,
                )
                session.add(deal)
                session.flush()  # Get the ID
                deals_saved += 1

                # Match against every active filter
                for f in filters:
                    score = self._score_match(deal, f)
                    if score > 0:
                        match_record = DealFilterMatch(
                            id=str(uuid.uuid4()),
                            filter_id=f.id,
                            deal_id=deal.id,
                        )
                        session.add(match_record)

                        match_info = {
                            "filter_id": f.id,
                            "filter_name": f.name,
                            "user_id": f.user_id,
                            "deal_id": deal.id,
                            "deal_title": deal.title,
                            "deal_price": deal.price,
                            "deal_url": deal.url,
                            "deal_category": deal.category,
                            "deal_region": deal.region,
                            "score": score,
                            "notify": score >= NOTIFICATION_THRESHOLD,
                        }
                        new_matches.append(match_info)

            # Log the matching run
            scrape_log = ScrapeLog(
                id=str(uuid.uuid4()),
                source="deal_matcher",
                status="success",
                item_count=deals_saved,
                started_at=started_at,
                finished_at=datetime.now(timezone.utc),
                duration=int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000),
            )
            session.add(scrape_log)
            session.commit()

            logger.info(
                f"Saved {deals_saved} new deals, "
                f"found {len(new_matches)} filter matches "
                f"({sum(1 for m in new_matches if m['notify'])} above notification threshold)"
            )

        except Exception as e:
            session.rollback()
            logger.error(f"Deal matching failed: {e}", exc_info=True)
        finally:
            session.close()

        # Only return matches that meet the notification threshold
        return [m for m in new_matches if m["notify"]]

    def _score_match(self, deal: GearDeal, f: DealFilter) -> int:
        """Score how well a deal matches a filter.

        Scoring:
        - Category match: 30 points
        - Each keyword found: 10 points (max 40)
        - Under max price: 20 points + bonus for being far under
        - Region match: 10 points
        - No disqualifiers (over max price, wrong region): 0

        Args:
            deal: GearDeal model instance.
            f: DealFilter model instance.

        Returns:
            Integer match score (0-100). Zero means no match.
        """
        score = 0
        text = f"{deal.title} {deal.description or ''}".lower()

        # --- Hard disqualifiers ---

        # Price ceiling: if set and deal price exceeds it, no match
        if f.max_price is not None and deal.price is not None and deal.price > f.max_price:
            return 0

        # Region whitelist: if set and deal region doesn't match, no match
        if f.regions and deal.region and deal.region not in f.regions:
            return 0

        # --- Category match (30 pts) ---
        if f.categories and deal.category:
            if deal.category in f.categories:
                score += 30
            else:
                # Category mismatch isn't a hard disqualifier, but no bonus
                pass

        # If no categories specified, consider it a category match
        if not f.categories:
            score += 15  # partial credit

        # --- Keyword match (up to 40 pts) ---
        if f.keywords:
            keyword_hits = sum(1 for kw in f.keywords if kw.lower() in text)
            if keyword_hits == 0:
                return 0  # Must match at least one keyword
            score += min(keyword_hits * 10, 40)
        else:
            score += 20  # no keywords = broad match

        # --- Price bonus (20 pts) ---
        if f.max_price is not None and deal.price is not None:
            score += 20
            # Bonus for being well under budget (up to 10 extra pts)
            savings_pct = (f.max_price - deal.price) / f.max_price
            score += min(int(savings_pct * 10), 10)
        elif deal.price is not None:
            score += 10  # Has a price listed, even if no max set

        # --- Region match (10 pts) ---
        if f.regions and deal.region and deal.region in f.regions:
            score += 10
        elif not f.regions:
            score += 5  # No region filter = partial credit

        return min(score, 100)
