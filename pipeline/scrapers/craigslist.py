"""
Craigslist Scraper — Raft Watch

Monitors Craigslist for rafting gear deals across configured regions.
Searches sporting goods and boats categories for relevant listings.

Uses RSS feeds as the primary scraping method (least likely to trigger
anti-bot measures). Falls back to HTML scraping when RSS is unavailable.

Data extracted per listing:
- Title, price, URL, image URL
- Description text
- Post date
- Location/region
- Category (auto-classified from keywords)
"""

import random
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from urllib.parse import quote_plus, urljoin

import httpx
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, ScrapedItem
from config.settings import settings
from models import SessionLocal, GearDeal


# Keywords that indicate rafting gear
RAFT_KEYWORDS = [
    "raft",
    "rafting",
    "kayak",
    "canoe",
    "paddle",
    "oar",
    "pfd",
    "life jacket",
    "life vest",
    "drysuit",
    "dry suit",
    "wetsuit",
    "wet suit",
    "throw bag",
    "river",
    "whitewater",
    "white water",
    "inflatable boat",
    "nrs",
    "aire",
    "hyside",
    "maravia",
    "sotar",
]

# Map keywords to categories
CATEGORY_MAP = {
    "raft": "raft",
    "rafting": "raft",
    "inflatable boat": "raft",
    "kayak": "kayak",
    "canoe": "kayak",
    "paddle": "paddle",
    "oar": "paddle",
    "pfd": "pfd",
    "life jacket": "pfd",
    "life vest": "pfd",
    "drysuit": "drysuit",
    "dry suit": "drysuit",
    "wetsuit": "drysuit",
    "wet suit": "drysuit",
}

# Craigslist search categories
CL_CATEGORIES = [
    "sga",  # sporting goods
    "boa",  # boats
]

# User-Agent rotation to avoid basic bot detection
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:121.0) Gecko/20100101 Firefox/121.0",
]


class CraigslistScraper(BaseScraper):
    """Monitors Craigslist for rafting gear deals.

    Searches multiple regions and categories using RSS feeds, extracts
    listing details, deduplicates against the database, and classifies
    each listing by gear category.
    """

    def __init__(self):
        super().__init__()
        self._seen_urls: set[str] = set()

    @property
    def name(self) -> str:
        return "craigslist"

    def _get_client(self) -> httpx.Client:
        """Create a new HTTP client with a random User-Agent."""
        return httpx.Client(
            timeout=settings.request_timeout,
            headers={
                "User-Agent": random.choice(USER_AGENTS),
                "Accept": "application/rss+xml, application/xml, text/xml, text/html",
                "Accept-Language": "en-US,en;q=0.9",
            },
            follow_redirects=True,
        )

    def _categorize(self, title: str, description: str = "") -> str:
        """Categorize a listing based on title and description text.

        Checks for known brand names and gear keywords to assign a
        gear category. Returns 'other' if no specific match found.

        Args:
            title: Listing title.
            description: Listing description body.

        Returns:
            Category string: 'raft', 'kayak', 'paddle', 'pfd', 'drysuit', or 'other'.
        """
        text = f"{title} {description}".lower()
        for keyword, category in CATEGORY_MAP.items():
            if keyword in text:
                return category
        return "other"

    def _is_relevant(self, title: str, description: str = "") -> bool:
        """Check if a listing is relevant to whitewater/rafting.

        Args:
            title: Listing title.
            description: Listing description body.

        Returns:
            True if the listing matches any rafting keyword.
        """
        text = f"{title} {description}".lower()
        return any(kw in text for kw in RAFT_KEYWORDS)

    def _extract_price(self, text: str) -> float | None:
        """Extract price from text, handling various formats.

        Args:
            text: Text that may contain a price (e.g. "$150", "$1,200").

        Returns:
            Price as float, or None if not found.
        """
        if not text:
            return None
        match = re.search(r"\$\s*([\d,]+(?:\.\d{2})?)", text)
        if match:
            try:
                return float(match.group(1).replace(",", ""))
            except ValueError:
                pass
        return None

    def _load_seen_urls(self) -> set[str]:
        """Load URLs of already-scraped deals from the database to avoid duplicates."""
        session = SessionLocal()
        try:
            existing = session.query(GearDeal.url).all()
            return {row[0] for row in existing}
        finally:
            session.close()

    def _scrape_rss(self, region: str, category: str, query: str, client: httpx.Client) -> list[dict]:
        """Scrape listings from a Craigslist RSS feed.

        Args:
            region: Craigslist region subdomain (e.g., 'seattle').
            category: CL category code (e.g., 'sga').
            query: Search query string.
            client: HTTP client to use.

        Returns:
            List of listing dicts extracted from the RSS feed.
        """
        url = f"https://{region}.craigslist.org/search/{category}?format=rss&query={quote_plus(query)}"
        listings = []

        try:
            resp = client.get(url)
            resp.raise_for_status()

            # Parse RSS XML
            root = ET.fromstring(resp.text)

            # RSS 2.0 namespace handling
            ns = {"rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"}

            # Try standard RSS items
            items = root.findall(".//item")
            if not items:
                # Try RDF format (older Craigslist feeds)
                items = root.findall(".//{http://purl.org/rss/1.0/}item")

            for item in items:
                title_el = item.find("title")
                if title_el is None:
                    title_el = item.find("{http://purl.org/rss/1.0/}title")
                link_el = item.find("link")
                if link_el is None:
                    link_el = item.find("{http://purl.org/rss/1.0/}link")
                desc_el = item.find("description")
                if desc_el is None:
                    desc_el = item.find("{http://purl.org/rss/1.0/}description")
                date_el = item.find("dc:date", {"dc": "http://purl.org/dc/elements/1.1/"})
                if date_el is None:
                    date_el = item.find("pubDate")

                title = title_el.text if title_el is not None and title_el.text else ""
                link = link_el.text if link_el is not None and link_el.text else ""
                description = desc_el.text if desc_el is not None and desc_el.text else ""
                date_str = date_el.text if date_el is not None and date_el.text else None

                if not link or link in self._seen_urls:
                    continue

                self._seen_urls.add(link)

                # Clean HTML from description
                if description:
                    description = BeautifulSoup(description, "lxml").get_text(" ", strip=True)

                # Extract price from title
                price = self._extract_price(title) or self._extract_price(description)

                # Parse date
                posted_at = None
                if date_str:
                    try:
                        from dateutil.parser import parse as parse_date
                        posted_at = parse_date(date_str)
                    except (ValueError, TypeError):
                        pass

                # Extract image URL from description HTML (some feeds include it)
                image_url = None
                if desc_el is not None and desc_el.text:
                    img_match = re.search(r'<img[^>]+src="([^"]+)"', desc_el.text)
                    if img_match:
                        image_url = img_match.group(1)

                listings.append({
                    "title": title.strip(),
                    "price": price,
                    "url": link.strip(),
                    "image_url": image_url,
                    "description": description[:2000] if description else None,  # cap length
                    "region": region,
                    "posted_at": posted_at,
                })

        except ET.ParseError as e:
            self.logger.warning(f"RSS parse error for {region}/{category}: {e}")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403:
                self.logger.warning(f"Blocked by Craigslist for {region}/{category} — backing off")
            else:
                self.logger.warning(f"HTTP error for {region}/{category}: {e}")
        except httpx.HTTPError as e:
            self.logger.warning(f"Request failed for {region}/{category}: {e}")

        return listings

    def _scrape_html_fallback(self, region: str, category: str, query: str, client: httpx.Client) -> list[dict]:
        """HTML fallback when RSS is unavailable.

        Scrapes the Craigslist search results HTML page directly.
        Less reliable than RSS but works when RSS is blocked.

        Args:
            region: Craigslist region subdomain.
            category: CL category code.
            query: Search query string.
            client: HTTP client to use.

        Returns:
            List of listing dicts.
        """
        url = f"https://{region}.craigslist.org/search/{category}?query={quote_plus(query)}"
        listings = []

        try:
            resp = client.get(url)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")

            # Craigslist result rows
            result_rows = soup.select("li.cl-static-search-result") or soup.select("li.result-row")

            for row in result_rows:
                # Modern CL layout
                link_el = row.find("a")
                if not link_el:
                    continue

                href = link_el.get("href", "")
                if not href:
                    continue

                # Make absolute URL
                if href.startswith("/"):
                    href = f"https://{region}.craigslist.org{href}"

                if href in self._seen_urls:
                    continue
                self._seen_urls.add(href)

                title = link_el.get_text(strip=True)
                price_el = row.find("span", class_="priceinfo") or row.find("span", class_="result-price")
                price = self._extract_price(price_el.get_text(strip=True)) if price_el else None

                listings.append({
                    "title": title,
                    "price": price,
                    "url": href,
                    "image_url": None,
                    "description": None,
                    "region": region,
                    "posted_at": None,
                })

        except httpx.HTTPError as e:
            self.logger.warning(f"HTML scrape failed for {region}/{category}: {e}")

        return listings

    def scrape(self) -> list[ScrapedItem]:
        """Run the Craigslist gear deal scraper.

        Iterates over configured regions and search categories, fetching
        listings via RSS feeds (with HTML fallback). Deduplicates against
        previously scraped URLs, filters for relevance, and classifies
        each listing by gear category.

        Returns:
            List of ScrapedItem objects representing gear deals.
        """
        self.log_start()
        items: list[ScrapedItem] = []

        # Pre-load known URLs to skip duplicates
        self._seen_urls = self._load_seen_urls()
        self.logger.info(f"Loaded {len(self._seen_urls)} existing deal URLs for dedup")

        # Group search terms into compound queries to reduce request count
        search_groups = [
            "raft OR kayak OR canoe OR whitewater",
            "paddle OR oar OR PFD OR life jacket",
            "drysuit OR wetsuit OR NRS OR throw bag",
            "AIRE OR Hyside OR Maravia OR SOTAR",
        ]

        for region in settings.craigslist_regions:
            client = self._get_client()
            region_count = 0

            try:
                self.logger.info(f"Scanning Craigslist {region}...")

                for cl_category in CL_CATEGORIES:
                    for query in search_groups:
                        # Try RSS first
                        raw_listings = self._scrape_rss(region, cl_category, query, client)

                        # Fall back to HTML if RSS returned nothing
                        if not raw_listings:
                            raw_listings = self._scrape_html_fallback(region, cl_category, query, client)

                        # Filter and convert to ScrapedItems
                        for listing in raw_listings:
                            title = listing.get("title", "")
                            desc = listing.get("description", "") or ""

                            if not self._is_relevant(title, desc):
                                continue

                            category = self._categorize(title, desc)

                            items.append(
                                ScrapedItem(
                                    source="craigslist",
                                    source_url=listing["url"],
                                    data={
                                        "title": title,
                                        "price": listing.get("price"),
                                        "url": listing["url"],
                                        "image_url": listing.get("image_url"),
                                        "description": desc or None,
                                        "category": category,
                                        "region": region,
                                        "posted_at": listing.get("posted_at"),
                                    },
                                    scraped_at=datetime.now(timezone.utc),
                                )
                            )
                            region_count += 1

                        # Rate limiting: random delay between requests
                        delay = settings.rate_limit_delay + random.uniform(0.5, 2.0)
                        time.sleep(delay)

                self.logger.info(f"Craigslist {region}: {region_count} relevant listings")

            except Exception as e:
                self.log_error(e)
            finally:
                client.close()

        self.log_complete(len(items))
        return items
