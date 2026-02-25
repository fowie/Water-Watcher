"""
Facebook Scraper

Scrapes public Facebook pages/groups for whitewater river condition reports.
Uses mobile site or RSS bridge approach since Graph API requires auth tokens.

Data extracted:
- Post text, images, links
- Author name
- Timestamp
- River mentions (matched against database river names)
- Condition/flow rate extraction from post text

Source priority: 30 (per BD-002 — lowest priority)
"""

import logging
import re
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedItem
from config.settings import settings
from models import SessionLocal, River

logger = logging.getLogger("pipeline.scrapers.facebook")

# ─── Constants ──────────────────────────────────────────

# Regex patterns for extracting flow information from post text
FLOW_RATE_PATTERNS = [
    re.compile(r"(\d[\d,]*)\s*(?:cfs|cubic\s+feet)", re.IGNORECASE),
    re.compile(r"flow[:\s]+(\d[\d,]*)", re.IGNORECASE),
    re.compile(r"(\d[\d,]*)\s*(?:ft³/s)", re.IGNORECASE),
]

GAUGE_HEIGHT_PATTERNS = [
    re.compile(r"(\d+\.?\d*)\s*(?:feet|ft|foot)\s*(?:gauge|gage|stage)", re.IGNORECASE),
    re.compile(r"(?:gauge|gage|stage)[:\s]+(\d+\.?\d*)\s*(?:feet|ft|foot)?", re.IGNORECASE),
]

WATER_TEMP_PATTERNS = [
    re.compile(r"water\s*temp[:\s]+(\d+\.?\d*)\s*[°]?[fF]", re.IGNORECASE),
    re.compile(r"(\d+\.?\d*)\s*[°]?[fF]\s*water", re.IGNORECASE),
]

# Condition quality keywords
CONDITION_KEYWORDS = {
    "excellent": ["excellent", "perfect", "prime", "ideal", "outstanding", "amazing"],
    "good": ["good", "great", "nice", "solid", "fun", "enjoyable"],
    "fair": ["fair", "ok", "okay", "moderate", "decent", "average", "mediocre"],
    "poor": ["poor", "low", "bad", "scrapy", "bony", "rocky"],
    "dangerous": ["dangerous", "flood", "deadly", "extreme", "closed", "hazardous", "unsafe"],
}

# Relative time patterns for date parsing
RELATIVE_TIME_PATTERNS = [
    (re.compile(r"(\d+)\s*min(?:ute)?s?\s*ago", re.IGNORECASE), "minutes"),
    (re.compile(r"(\d+)\s*hours?\s*ago", re.IGNORECASE), "hours"),
    (re.compile(r"(\d+)\s*days?\s*ago", re.IGNORECASE), "days"),
    (re.compile(r"yesterday", re.IGNORECASE), "yesterday"),
]

# Default Facebook pages/groups for whitewater communities
DEFAULT_PAGES = [
    "americanwhitewater",
    "whitewaterkayaking",
]


class FacebookScraper(BaseScraper):
    """Scrapes public Facebook pages/groups for river condition reports.

    Since the Facebook Graph API requires auth tokens, this scraper uses
    a public page scraping approach via mobile site or RSS bridge services.
    Falls back gracefully when auth token is not available.
    """

    def __init__(self):
        super().__init__()
        self._access_token = settings.facebook_access_token
        self._client = httpx.Client(
            timeout=settings.request_timeout,
            headers={
                "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 "
                              "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            },
            follow_redirects=True,
        )
        self._rate_limit_delay = settings.rate_limit_delay
        self._river_cache: list[dict] | None = None
        self._scrape_window_hours = 48  # Only process posts from last 48 hours

    @property
    def name(self) -> str:
        return "facebook"

    def _get_tracked_rivers(self) -> list[dict]:
        """Get tracked rivers from the database, cached per scrape cycle."""
        if self._river_cache is not None:
            return self._river_cache

        session = SessionLocal()
        try:
            rivers = session.query(River).all()
            self._river_cache = [
                {
                    "id": r.id,
                    "name": r.name,
                    "state": r.state,
                    "region": r.region,
                }
                for r in rivers
            ]
            return self._river_cache
        finally:
            session.close()

    def scrape(self) -> list[ScrapedItem]:
        """Run the Facebook scraper and return condition items.

        Attempts Graph API if token is available, falls back to
        public page scraping. Returns empty list on total failure.
        """
        self.log_start()
        items: list[ScrapedItem] = []

        try:
            if self._access_token:
                items = self._scrape_graph_api()
            else:
                logger.warning(
                    "No Facebook access token configured. "
                    "Attempting public page scraping (limited data)."
                )
                items = self._scrape_public_pages()
        except Exception as e:
            self.log_error(e)
            return []

        # Reset river cache for next cycle
        self._river_cache = None

        self.log_complete(len(items))
        return items

    def _scrape_graph_api(self) -> list[ScrapedItem]:
        """Scrape Facebook pages/groups via the Graph API."""
        items: list[ScrapedItem] = []
        pages = settings.facebook_pages if hasattr(settings, "facebook_pages") else DEFAULT_PAGES

        for page_id in pages:
            try:
                page_items = self._fetch_page_posts_api(page_id)
                items.extend(page_items)
                time.sleep(self._rate_limit_delay)
            except Exception as e:
                logger.error(f"Failed to scrape Facebook page {page_id}: {e}")
                continue

        return items

    def _fetch_page_posts_api(self, page_id: str) -> list[ScrapedItem]:
        """Fetch posts from a Facebook page via Graph API."""
        url = f"https://graph.facebook.com/v19.0/{page_id}/posts"
        params = {
            "access_token": self._access_token,
            "fields": "id,message,created_time,from,full_picture,permalink_url",
            "limit": 50,
        }

        try:
            response = self._client.get(url, params=params)

            if response.status_code == 401:
                logger.error(f"Facebook API: expired token for page {page_id}")
                return []
            if response.status_code == 403:
                logger.error(f"Facebook API: invalid token or no access to page {page_id}")
                return []
            if response.status_code == 429:
                logger.warning(f"Facebook API: rate limited on page {page_id}")
                self._handle_rate_limit(response)
                return []

            response.raise_for_status()

            # Check for rate limit headers
            self._check_usage_headers(response)

            data = response.json()
            posts = data.get("data", [])
            return self._parse_posts(posts, page_id)

        except httpx.TimeoutException:
            logger.error(f"Facebook API timeout for page {page_id}")
            return []
        except httpx.HTTPError as e:
            logger.error(f"Facebook API HTTP error for page {page_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Facebook API unexpected error for page {page_id}: {e}")
            return []

    def _scrape_public_pages(self) -> list[ScrapedItem]:
        """Scrape public Facebook pages via mobile site (no auth required)."""
        items: list[ScrapedItem] = []
        pages = DEFAULT_PAGES

        for page_id in pages:
            try:
                page_items = self._fetch_page_public(page_id)
                items.extend(page_items)
                time.sleep(self._rate_limit_delay)
            except Exception as e:
                logger.error(f"Failed to scrape public Facebook page {page_id}: {e}")
                continue

        return items

    def _fetch_page_public(self, page_id: str) -> list[ScrapedItem]:
        """Fetch posts from a public Facebook page via mobile site."""
        url = f"https://m.facebook.com/{page_id}"

        try:
            response = self._client.get(url)
            if response.status_code == 404:
                logger.warning(f"Facebook page not found: {page_id}")
                return []

            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")
            posts = self._extract_posts_from_html(soup, page_id)
            return posts

        except httpx.TimeoutException:
            logger.error(f"Timeout fetching Facebook page {page_id}")
            return []
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching Facebook page {page_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Error parsing Facebook page {page_id}: {e}")
            return []

    def _extract_posts_from_html(self, soup: BeautifulSoup, page_id: str) -> list[ScrapedItem]:
        """Extract posts from parsed HTML of a Facebook page."""
        items: list[ScrapedItem] = []

        # Facebook mobile site uses various div structures for posts
        post_divs = soup.find_all("div", {"data-ft": True}) or soup.find_all(
            "article"
        )

        for post_div in post_divs:
            try:
                # Extract text content
                text_elem = post_div.find("div", class_=re.compile(r".*story.*|.*userContent.*"))
                if text_elem is None:
                    # Try broader text extraction
                    text_elem = post_div.find("p")

                text = ""
                if text_elem:
                    text = text_elem.get_text(strip=True)

                if not text:
                    continue

                # Extract images
                images = []
                for img in post_div.find_all("img"):
                    src = img.get("src", "")
                    if src and "emoji" not in src and "static" not in src:
                        images.append(src)

                # Extract links
                links = []
                for a in post_div.find_all("a", href=True):
                    href = a["href"]
                    if href.startswith("http") and "facebook.com" not in href:
                        links.append(href)

                # Extract author
                author_elem = post_div.find("strong") or post_div.find("h3")
                author = author_elem.get_text(strip=True) if author_elem else page_id

                # Build source URL
                post_link = post_div.find("a", href=re.compile(r"/story\.php|/permalink"))
                source_url = f"https://www.facebook.com/{page_id}"
                if post_link:
                    href = post_link.get("href", "")
                    if href.startswith("/"):
                        source_url = f"https://m.facebook.com{href}"

                # Extract river mentions and create items
                river_items = self._extract_river_mentions(
                    text=text,
                    author=author,
                    source_url=source_url,
                    images=images,
                    links=links,
                    timestamp=None,  # HTML scraping doesn't always have timestamps
                )
                items.extend(river_items)

            except Exception as e:
                logger.debug(f"Error parsing post from {page_id}: {e}")
                continue

        return items

    def _parse_posts(self, posts: list[dict], page_id: str) -> list[ScrapedItem]:
        """Parse Graph API post responses into ScrapedItems."""
        items: list[ScrapedItem] = []
        now = datetime.now(timezone.utc)
        threshold = now - timedelta(hours=self._scrape_window_hours)

        for post in posts:
            try:
                message = post.get("message", "")
                if not message:
                    continue

                # Parse timestamp
                timestamp = self._parse_timestamp(post.get("created_time"))
                if timestamp and timestamp < threshold:
                    continue

                author = ""
                from_data = post.get("from", {})
                if isinstance(from_data, dict):
                    author = from_data.get("name", "")

                source_url = post.get("permalink_url", f"https://www.facebook.com/{page_id}")
                images = []
                if post.get("full_picture"):
                    images.append(post["full_picture"])

                river_items = self._extract_river_mentions(
                    text=message,
                    author=author,
                    source_url=source_url,
                    images=images,
                    links=[],
                    timestamp=timestamp,
                )
                items.extend(river_items)

            except Exception as e:
                logger.debug(f"Error parsing post from {page_id}: {e}")
                continue

        return items

    def _extract_river_mentions(
        self,
        text: str,
        author: str,
        source_url: str,
        images: list[str],
        links: list[str],
        timestamp: datetime | None,
    ) -> list[ScrapedItem]:
        """Detect river mentions in post text and create ScrapedItems.

        Matches river names from the database against post text.
        Produces one ScrapedItem per river mentioned.
        """
        rivers = self._get_tracked_rivers()
        if not rivers:
            return []

        items: list[ScrapedItem] = []
        text_lower = text.lower()

        # Also handle hashtag mentions like #ColoradoRiver
        # Convert hashtags to spaces for matching: "#ColoradoRiver" -> "Colorado River"
        text_for_matching = re.sub(
            r"#([A-Z][a-z]+)([A-Z])",
            lambda m: m.group(1) + " " + m.group(2),
            text,
        )
        text_for_matching_lower = text_for_matching.lower()

        matched_river_ids: set[str] = set()

        for river in rivers:
            river_name = river["name"]
            river_name_lower = river_name.lower()

            # Exact river name match (case-insensitive, word boundary)
            pattern = re.compile(
                r"\b" + re.escape(river_name_lower) + r"\b",
                re.IGNORECASE,
            )

            if pattern.search(text_lower) or pattern.search(text_for_matching_lower):
                if river["id"] not in matched_river_ids:
                    matched_river_ids.add(river["id"])

                    condition_data = self._classify_condition(text)
                    scraped_at = timestamp or datetime.now(timezone.utc)

                    item = ScrapedItem(
                        source="facebook",
                        source_url=source_url,
                        data={
                            "river_id": river["id"],
                            "river_name": river_name,
                            "post_text": text[:1000],  # Truncate very long posts
                            "author": author,
                            "images": images[:5],  # Limit images
                            "links": links[:5],
                            **condition_data,
                        },
                        scraped_at=scraped_at,
                    )
                    items.append(item)

        return items

    def _classify_condition(self, text: str) -> dict[str, Any]:
        """Extract condition data from post text.

        Parses flow rates, gauge heights, water temps, and quality
        assessments from natural language post text using regex.

        Returns dict with available condition fields.
        """
        result: dict[str, Any] = {}
        text_lower = text.lower()

        # Extract flow rate
        for pattern in FLOW_RATE_PATTERNS:
            match = pattern.search(text)
            if match:
                try:
                    result["flow_rate"] = float(match.group(1).replace(",", ""))
                except (ValueError, IndexError):
                    pass
                break

        # Extract gauge height
        for pattern in GAUGE_HEIGHT_PATTERNS:
            match = pattern.search(text)
            if match:
                try:
                    result["gauge_height"] = float(match.group(1))
                except (ValueError, IndexError):
                    pass
                break

        # Extract water temperature
        for pattern in WATER_TEMP_PATTERNS:
            match = pattern.search(text)
            if match:
                try:
                    result["water_temp"] = float(match.group(1))
                except (ValueError, IndexError):
                    pass
                break

        # Classify quality from keywords
        for quality, keywords in CONDITION_KEYWORDS.items():
            for keyword in keywords:
                if keyword in text_lower:
                    result["quality"] = quality
                    break
            if "quality" in result:
                break

        return result

    def _parse_timestamp(self, timestamp_str: str | None) -> datetime | None:
        """Parse an ISO 8601 timestamp or relative time string.

        Returns datetime in UTC, or None if parsing fails.
        """
        if not timestamp_str:
            return None

        # Try ISO 8601 first (Graph API format)
        try:
            dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except (ValueError, AttributeError):
            pass

        # Try relative time patterns
        for pattern, unit in RELATIVE_TIME_PATTERNS:
            match = pattern.search(timestamp_str)
            if match:
                now = datetime.now(timezone.utc)
                if unit == "yesterday":
                    return now - timedelta(days=1)
                value = int(match.group(1))
                if unit == "minutes":
                    return now - timedelta(minutes=value)
                elif unit == "hours":
                    return now - timedelta(hours=value)
                elif unit == "days":
                    return now - timedelta(days=value)

        return None

    def _handle_rate_limit(self, response: httpx.Response) -> None:
        """Handle rate limit response by backing off."""
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            try:
                wait_time = min(int(retry_after), 300)  # Max 5 min wait
                logger.info(f"Facebook API rate limited. Waiting {wait_time}s")
                time.sleep(wait_time)
            except ValueError:
                time.sleep(60)
        else:
            time.sleep(60)

    def _check_usage_headers(self, response: httpx.Response) -> None:
        """Check Facebook API usage headers and slow down if approaching limits."""
        usage = response.headers.get("X-App-Usage") or response.headers.get(
            "X-Business-Use-Case-Usage"
        )
        if not usage:
            return

        try:
            import json

            usage_data = json.loads(usage)
            # X-App-Usage has call_count, total_cputime, total_time as percentages
            call_count = usage_data.get("call_count", 0)
            if call_count > 75:
                logger.warning(
                    f"Facebook API usage at {call_count}%. Slowing down."
                )
                time.sleep(self._rate_limit_delay * 3)
            elif call_count > 50:
                time.sleep(self._rate_limit_delay * 2)
        except Exception:
            pass
