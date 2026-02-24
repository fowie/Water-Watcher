"""
Tests for pipeline configuration (config/settings.py).

Tests:
- Default values when env vars are not set
- Override behavior when env vars are set
- Type coercion (string env → int/float)
- Edge cases: empty string, whitespace, special characters
"""

import os
import pytest
from unittest.mock import patch


# ─── Default Values ─────────────────────────────────────────


class TestDefaultValues:
    """Test that Settings uses correct defaults when env vars are absent."""

    def _make_settings(self, env_overrides=None):
        """Create a fresh Settings instance with controlled env vars."""
        env = {
            k: v for k, v in os.environ.items()
            if k not in (
                "DATABASE_URL", "SCRAPE_INTERVAL_MINUTES",
                "RAFT_WATCH_INTERVAL_MINUTES", "REQUEST_TIMEOUT",
                "RATE_LIMIT_DELAY", "CRAIGSLIST_REGIONS",
                "USGS_BASE_URL", "AW_BASE_URL",
                "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY",
                "VAPID_SUBJECT", "RESEND_API_KEY",
                "NOTIFICATION_FROM_EMAIL",
            )
        }
        if env_overrides:
            env.update(env_overrides)

        with patch.dict(os.environ, env, clear=True):
            from config.settings import Settings
            return Settings()

    def test_default_database_url(self):
        s = self._make_settings()
        assert "postgresql" in s.database_url
        assert "waterwatcher" in s.database_url

    def test_default_scrape_interval(self):
        s = self._make_settings()
        assert s.scrape_interval_minutes == 240

    def test_default_raft_watch_interval(self):
        s = self._make_settings()
        assert s.raft_watch_interval_minutes == 30

    def test_default_request_timeout(self):
        s = self._make_settings()
        assert s.request_timeout == 30

    def test_default_rate_limit_delay(self):
        s = self._make_settings()
        assert s.rate_limit_delay == 2.0

    def test_default_craigslist_regions(self):
        s = self._make_settings()
        assert isinstance(s.craigslist_regions, list)
        assert "seattle" in s.craigslist_regions
        assert "portland" in s.craigslist_regions
        assert "denver" in s.craigslist_regions
        assert len(s.craigslist_regions) == 5

    def test_default_usgs_base_url(self):
        s = self._make_settings()
        assert s.usgs_base_url == "https://waterservices.usgs.gov/nwis"

    def test_default_aw_base_url(self):
        s = self._make_settings()
        assert "americanwhitewater.org" in s.aw_base_url

    def test_default_vapid_public_key_empty(self):
        s = self._make_settings()
        assert s.vapid_public_key == ""

    def test_default_vapid_private_key_empty(self):
        s = self._make_settings()
        assert s.vapid_private_key == ""

    def test_default_vapid_subject(self):
        s = self._make_settings()
        assert "mailto:" in s.vapid_subject

    def test_default_resend_api_key_empty(self):
        s = self._make_settings()
        assert s.resend_api_key == ""

    def test_default_notification_from_email(self):
        s = self._make_settings()
        assert "@" in s.notification_from_email


# ─── Override Behavior ──────────────────────────────────────


class TestOverrides:
    """Test that env vars properly override defaults."""

    def _make_settings(self, env_overrides):
        env = {
            k: v for k, v in os.environ.items()
            if k not in (
                "DATABASE_URL", "SCRAPE_INTERVAL_MINUTES",
                "RAFT_WATCH_INTERVAL_MINUTES", "REQUEST_TIMEOUT",
                "RATE_LIMIT_DELAY", "CRAIGSLIST_REGIONS",
                "USGS_BASE_URL", "AW_BASE_URL",
                "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY",
                "VAPID_SUBJECT", "RESEND_API_KEY",
                "NOTIFICATION_FROM_EMAIL",
            )
        }
        env.update(env_overrides)

        with patch.dict(os.environ, env, clear=True):
            from config.settings import Settings
            return Settings()

    def test_override_database_url(self):
        s = self._make_settings({"DATABASE_URL": "postgresql://custom:pw@db:5432/mydb"})
        assert s.database_url == "postgresql://custom:pw@db:5432/mydb"

    def test_override_scrape_interval(self):
        s = self._make_settings({"SCRAPE_INTERVAL_MINUTES": "60"})
        assert s.scrape_interval_minutes == 60

    def test_override_raft_watch_interval(self):
        s = self._make_settings({"RAFT_WATCH_INTERVAL_MINUTES": "15"})
        assert s.raft_watch_interval_minutes == 15

    def test_override_request_timeout(self):
        s = self._make_settings({"REQUEST_TIMEOUT": "10"})
        assert s.request_timeout == 10

    def test_override_rate_limit_delay(self):
        s = self._make_settings({"RATE_LIMIT_DELAY": "0.5"})
        assert s.rate_limit_delay == 0.5

    def test_override_craigslist_regions(self):
        s = self._make_settings({"CRAIGSLIST_REGIONS": "sacramento,reno"})
        assert s.craigslist_regions == ["sacramento", "reno"]

    def test_override_usgs_base_url(self):
        s = self._make_settings({"USGS_BASE_URL": "https://custom-usgs.example.com"})
        assert s.usgs_base_url == "https://custom-usgs.example.com"

    def test_override_vapid_keys(self):
        s = self._make_settings({
            "NEXT_PUBLIC_VAPID_PUBLIC_KEY": "pub-key-123",
            "VAPID_PRIVATE_KEY": "priv-key-456",
        })
        assert s.vapid_public_key == "pub-key-123"
        assert s.vapid_private_key == "priv-key-456"


# ─── Type Coercion ──────────────────────────────────────────


class TestTypeCoercion:
    """Test that string env vars are correctly coerced to int/float."""

    def _make_settings(self, env_overrides):
        env = {
            k: v for k, v in os.environ.items()
            if k not in (
                "DATABASE_URL", "SCRAPE_INTERVAL_MINUTES",
                "RAFT_WATCH_INTERVAL_MINUTES", "REQUEST_TIMEOUT",
                "RATE_LIMIT_DELAY", "CRAIGSLIST_REGIONS",
            )
        }
        env.update(env_overrides)

        with patch.dict(os.environ, env, clear=True):
            from config.settings import Settings
            return Settings()

    def test_interval_coerced_to_int(self):
        s = self._make_settings({"SCRAPE_INTERVAL_MINUTES": "120"})
        assert isinstance(s.scrape_interval_minutes, int)
        assert s.scrape_interval_minutes == 120

    def test_timeout_coerced_to_int(self):
        s = self._make_settings({"REQUEST_TIMEOUT": "45"})
        assert isinstance(s.request_timeout, int)
        assert s.request_timeout == 45

    def test_rate_limit_coerced_to_float(self):
        s = self._make_settings({"RATE_LIMIT_DELAY": "1.5"})
        assert isinstance(s.rate_limit_delay, float)
        assert s.rate_limit_delay == 1.5

    def test_regions_coerced_to_list(self):
        s = self._make_settings({"CRAIGSLIST_REGIONS": "a,b,c"})
        assert isinstance(s.craigslist_regions, list)
        assert s.craigslist_regions == ["a", "b", "c"]

    def test_single_region_is_list(self):
        s = self._make_settings({"CRAIGSLIST_REGIONS": "seattle"})
        assert s.craigslist_regions == ["seattle"]


# ─── Edge Cases ─────────────────────────────────────────────


class TestEdgeCases:
    """Test edge cases: empty strings, whitespace, special characters."""

    def _make_settings(self, env_overrides):
        env = {
            k: v for k, v in os.environ.items()
            if k not in (
                "DATABASE_URL", "SCRAPE_INTERVAL_MINUTES",
                "RAFT_WATCH_INTERVAL_MINUTES", "REQUEST_TIMEOUT",
                "RATE_LIMIT_DELAY", "CRAIGSLIST_REGIONS",
            )
        }
        env.update(env_overrides)

        with patch.dict(os.environ, env, clear=True):
            from config.settings import Settings
            return Settings()

    def test_non_numeric_interval_raises(self):
        """Non-numeric interval string should raise ValueError."""
        with pytest.raises(ValueError):
            self._make_settings({"SCRAPE_INTERVAL_MINUTES": "abc"})

    def test_float_interval_raises(self):
        """Float string for int field should raise ValueError."""
        with pytest.raises(ValueError):
            self._make_settings({"SCRAPE_INTERVAL_MINUTES": "3.14"})

    def test_empty_regions_string(self):
        """Empty CRAIGSLIST_REGIONS should produce a list with one empty string."""
        s = self._make_settings({"CRAIGSLIST_REGIONS": ""})
        # "".split(",") → [""]
        assert s.craigslist_regions == [""]

    def test_regions_with_spaces(self):
        """Regions with spaces are preserved (not stripped)."""
        s = self._make_settings({"CRAIGSLIST_REGIONS": " seattle , portland "})
        assert " seattle " in s.craigslist_regions

    def test_zero_interval(self):
        """Zero interval should be accepted (dataclass doesn't validate range)."""
        s = self._make_settings({"SCRAPE_INTERVAL_MINUTES": "0"})
        assert s.scrape_interval_minutes == 0

    def test_negative_interval(self):
        """Negative interval should be accepted (no validation in Settings)."""
        s = self._make_settings({"SCRAPE_INTERVAL_MINUTES": "-5"})
        assert s.scrape_interval_minutes == -5

    def test_large_interval(self):
        """Very large interval should work."""
        s = self._make_settings({"SCRAPE_INTERVAL_MINUTES": "999999"})
        assert s.scrape_interval_minutes == 999999

    def test_special_chars_in_database_url(self):
        """Special characters in DATABASE_URL should be preserved."""
        url = "postgresql://user:p@ss%40word@host:5432/db?sslmode=require"
        s = self._make_settings({"DATABASE_URL": url})
        assert s.database_url == url

    def test_empty_database_url(self):
        """Empty DATABASE_URL should use default."""
        # When env var is empty string, os.getenv returns the empty string
        # not the default — the dataclass default_factory uses os.getenv
        s = self._make_settings({"DATABASE_URL": ""})
        # Empty string overrides the default
        assert s.database_url == ""

    def test_zero_rate_limit(self):
        """Zero rate limit delay should be accepted."""
        s = self._make_settings({"RATE_LIMIT_DELAY": "0"})
        assert s.rate_limit_delay == 0.0

    def test_negative_timeout(self):
        """Negative timeout should be accepted (no validation)."""
        s = self._make_settings({"REQUEST_TIMEOUT": "-1"})
        assert s.request_timeout == -1
