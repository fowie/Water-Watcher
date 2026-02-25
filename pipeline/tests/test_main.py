"""
Tests for the pipeline entry point (main.py).

Tests:
- _validate_startup() behavior with missing/present env vars
- Scheduler configuration (intervals, job names)
- Graceful shutdown behavior
"""

import logging
import os
import signal
import sys
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock, call


# ─── _validate_startup Tests ───────────────────────────────


class TestValidateStartup:
    """Test the startup validation logic."""

    @patch.dict(os.environ, {"DATABASE_URL": ""}, clear=False)
    @patch("sys.exit")
    def test_exits_on_missing_database_url(self, mock_exit):
        """Should call sys.exit(1) when DATABASE_URL is empty."""
        from main import _validate_startup
        _validate_startup()
        mock_exit.assert_called_once_with(1)

    @patch.dict(os.environ, {}, clear=False)
    @patch("sys.exit")
    def test_exits_on_unset_database_url(self, mock_exit):
        """Should call sys.exit(1) when DATABASE_URL is not in env at all."""
        env = os.environ.copy()
        env.pop("DATABASE_URL", None)
        with patch.dict(os.environ, env, clear=True):
            from main import _validate_startup
            _validate_startup()
            mock_exit.assert_called_once_with(1)

    @patch.dict(os.environ, {
        "DATABASE_URL": "postgresql://user:pass@localhost/db",
        "NEXT_PUBLIC_VAPID_PUBLIC_KEY": "",
        "VAPID_PRIVATE_KEY": "",
    }, clear=False)
    @patch("sys.exit")
    def test_warns_on_missing_vapid_keys(self, mock_exit, caplog):
        """Should log a warning when VAPID keys are missing."""
        from main import _validate_startup
        with caplog.at_level(logging.WARNING):
            _validate_startup()
        mock_exit.assert_not_called()
        assert any("VAPID" in r.message for r in caplog.records)

    @patch.dict(os.environ, {
        "DATABASE_URL": "postgresql://user:pass@localhost/db",
        "NEXT_PUBLIC_VAPID_PUBLIC_KEY": "BEl62iUYgUivxIkv69yViEuibc...",
        "VAPID_PRIVATE_KEY": "UUxI4o8_ysRGJkA...",
    }, clear=False)
    @patch("sys.exit")
    def test_no_exit_with_valid_config(self, mock_exit):
        """Should not exit when DATABASE_URL and VAPID keys are set."""
        from main import _validate_startup
        _validate_startup()
        mock_exit.assert_not_called()

    @patch.dict(os.environ, {
        "DATABASE_URL": "postgresql://user:pass@localhost/db",
        "NEXT_PUBLIC_VAPID_PUBLIC_KEY": "key-here",
        "VAPID_PRIVATE_KEY": "",
    }, clear=False)
    @patch("sys.exit")
    def test_warns_with_partial_vapid(self, mock_exit, caplog):
        """Should warn when only one VAPID key is set."""
        from main import _validate_startup
        with caplog.at_level(logging.WARNING):
            _validate_startup()
        mock_exit.assert_not_called()
        assert any("VAPID" in r.message for r in caplog.records)

    @patch.dict(os.environ, {"DATABASE_URL": ""}, clear=False)
    @patch("sys.exit")
    def test_logs_critical_on_missing_db(self, mock_exit, caplog):
        """Should log CRITICAL when DATABASE_URL is missing."""
        from main import _validate_startup
        with caplog.at_level(logging.CRITICAL):
            _validate_startup()
        assert any(r.levelno == logging.CRITICAL for r in caplog.records)


# ─── Scheduler Configuration Tests ─────────────────────────


class TestSchedulerConfig:
    """Test that the scheduler is configured with correct intervals and jobs."""

    @patch("main.BlockingScheduler")
    @patch("main._validate_startup")
    @patch("main.signal.signal")
    @patch("main.settings")
    def test_river_job_uses_settings_interval(self, mock_settings, mock_signal,
                                                mock_validate, mock_sched_cls):
        """River scrapers job should use settings.scrape_interval_minutes."""
        mock_settings.scrape_interval_minutes = 240
        mock_settings.raft_watch_interval_minutes = 30
        mock_settings.land_agency_interval_minutes = 360
        mock_settings.facebook_interval_minutes = 360
        mock_scheduler = MagicMock()
        mock_sched_cls.return_value = mock_scheduler
        # main() catches SystemExit, so use KeyboardInterrupt to exit cleanly
        mock_scheduler.start.side_effect = KeyboardInterrupt()

        from main import main
        main()  # Does not raise — main catches KeyboardInterrupt

        calls = mock_scheduler.add_job.call_args_list
        assert len(calls) == 4

        # First job: river scrapers
        river_call = calls[0]
        assert river_call.kwargs.get("minutes") == 240 or river_call[1].get("minutes") == 240

    @patch("main.BlockingScheduler")
    @patch("main._validate_startup")
    @patch("main.signal.signal")
    @patch("main.settings")
    def test_raft_watch_job_uses_settings_interval(self, mock_settings, mock_signal,
                                                     mock_validate, mock_sched_cls):
        """Raft Watch job should use settings.raft_watch_interval_minutes."""
        mock_settings.scrape_interval_minutes = 240
        mock_settings.raft_watch_interval_minutes = 30
        mock_settings.land_agency_interval_minutes = 360
        mock_settings.facebook_interval_minutes = 360
        mock_scheduler = MagicMock()
        mock_sched_cls.return_value = mock_scheduler
        mock_scheduler.start.side_effect = KeyboardInterrupt()

        from main import main
        main()

        calls = mock_scheduler.add_job.call_args_list
        raft_call = calls[1]
        assert raft_call.kwargs.get("minutes") == 30 or raft_call[1].get("minutes") == 30

    @patch("main.BlockingScheduler")
    @patch("main._validate_startup")
    @patch("main.signal.signal")
    @patch("main.settings")
    def test_jobs_have_ids(self, mock_settings, mock_signal,
                           mock_validate, mock_sched_cls):
        """All jobs should have unique IDs."""
        mock_settings.scrape_interval_minutes = 240
        mock_settings.raft_watch_interval_minutes = 30
        mock_settings.land_agency_interval_minutes = 360
        mock_settings.facebook_interval_minutes = 360
        mock_scheduler = MagicMock()
        mock_sched_cls.return_value = mock_scheduler
        mock_scheduler.start.side_effect = KeyboardInterrupt()

        from main import main
        main()

        calls = mock_scheduler.add_job.call_args_list
        ids = [c.kwargs.get("id") or c[1].get("id") for c in calls]
        assert "river_scrapers" in ids
        assert "raft_watch" in ids
        assert "land_agency_scrapers" in ids
        assert "facebook_scraper" in ids

    @patch("main.BlockingScheduler")
    @patch("main._validate_startup")
    @patch("main.signal.signal")
    @patch("main.settings")
    def test_jobs_run_immediately_on_start(self, mock_settings, mock_signal,
                                           mock_validate, mock_sched_cls):
        """All jobs should have next_run_time set to run immediately."""
        mock_settings.scrape_interval_minutes = 240
        mock_settings.raft_watch_interval_minutes = 30
        mock_settings.land_agency_interval_minutes = 360
        mock_settings.facebook_interval_minutes = 360
        mock_scheduler = MagicMock()
        mock_sched_cls.return_value = mock_scheduler
        mock_scheduler.start.side_effect = KeyboardInterrupt()

        from main import main
        main()

        calls = mock_scheduler.add_job.call_args_list
        for c in calls:
            next_run = c.kwargs.get("next_run_time") or c[1].get("next_run_time")
            assert next_run is not None


# ─── Graceful Shutdown Tests ────────────────────────────────


class TestGracefulShutdown:
    """Test that signal handlers are registered for graceful shutdown."""

    @patch("main.BlockingScheduler")
    @patch("main._validate_startup")
    @patch("main.signal.signal")
    @patch("main.settings")
    def test_sigint_handler_registered(self, mock_settings, mock_signal_fn,
                                        mock_validate, mock_sched_cls):
        """Should register a SIGINT handler."""
        mock_settings.scrape_interval_minutes = 240
        mock_settings.raft_watch_interval_minutes = 30
        mock_scheduler = MagicMock()
        mock_sched_cls.return_value = mock_scheduler
        mock_scheduler.start.side_effect = KeyboardInterrupt()

        from main import main
        main()

        signal_calls = mock_signal_fn.call_args_list
        registered_signals = [c[0][0] for c in signal_calls]
        assert signal.SIGINT in registered_signals

    @patch("main.BlockingScheduler")
    @patch("main._validate_startup")
    @patch("main.signal.signal")
    @patch("main.settings")
    def test_sigterm_handler_registered(self, mock_settings, mock_signal_fn,
                                         mock_validate, mock_sched_cls):
        """Should register a SIGTERM handler."""
        mock_settings.scrape_interval_minutes = 240
        mock_settings.raft_watch_interval_minutes = 30
        mock_scheduler = MagicMock()
        mock_sched_cls.return_value = mock_scheduler
        mock_scheduler.start.side_effect = KeyboardInterrupt()

        from main import main
        main()

        signal_calls = mock_signal_fn.call_args_list
        registered_signals = [c[0][0] for c in signal_calls]
        assert signal.SIGTERM in registered_signals

    @patch("main.BlockingScheduler")
    @patch("main._validate_startup")
    @patch("main.signal.signal")
    @patch("main.settings")
    def test_shutdown_handler_calls_scheduler_shutdown(self, mock_settings,
                                                        mock_signal_fn,
                                                        mock_validate,
                                                        mock_sched_cls):
        """The shutdown handler should call scheduler.shutdown(wait=False)."""
        mock_settings.scrape_interval_minutes = 240
        mock_settings.raft_watch_interval_minutes = 30
        mock_scheduler = MagicMock()
        mock_sched_cls.return_value = mock_scheduler
        mock_scheduler.start.side_effect = KeyboardInterrupt()

        from main import main
        main()

        # Extract the shutdown handler that was registered for SIGINT
        for c in mock_signal_fn.call_args_list:
            if c[0][0] == signal.SIGINT:
                handler = c[0][1]
                # Call the handler — it calls sys.exit(0)
                with pytest.raises(SystemExit):
                    handler(signal.SIGINT, None)
                mock_scheduler.shutdown.assert_called_with(wait=False)
                break


# ─── run_river_scrapers Tests ───────────────────────────────


class TestRunRiverScrapers:
    """Test the run_river_scrapers function."""

    @patch("main.PushNotifier")
    @patch("main.ConditionProcessor")
    @patch("main.AmericanWhitewaterScraper")
    @patch("main.USGSScraper")
    def test_runs_both_scrapers(self, mock_usgs_cls, mock_aw_cls,
                                 mock_processor_cls, mock_notifier_cls):
        """Should run both USGS and AW scrapers."""
        mock_usgs = MagicMock()
        mock_usgs.name = "usgs"
        mock_usgs.scrape.return_value = []
        mock_usgs_cls.return_value = mock_usgs

        mock_aw = MagicMock()
        mock_aw.name = "aw"
        mock_aw.scrape.return_value = []
        mock_aw_cls.return_value = mock_aw

        mock_processor = MagicMock()
        mock_processor.process.return_value = []
        mock_processor_cls.return_value = mock_processor

        mock_notifier_cls.return_value = MagicMock()

        from main import run_river_scrapers
        run_river_scrapers()

        mock_usgs.scrape.assert_called_once()
        mock_aw.scrape.assert_called_once()

    @patch("main.PushNotifier")
    @patch("main.ConditionProcessor")
    @patch("main.AmericanWhitewaterScraper")
    @patch("main.USGSScraper")
    def test_notifies_on_quality_change(self, mock_usgs_cls, mock_aw_cls,
                                         mock_processor_cls, mock_notifier_cls):
        """Should call notifier when quality_changed flag is set."""
        mock_usgs = MagicMock()
        mock_usgs.name = "usgs"
        mock_usgs.scrape.return_value = [MagicMock()]
        mock_usgs_cls.return_value = mock_usgs

        mock_aw = MagicMock()
        mock_aw.name = "aw"
        mock_aw.scrape.return_value = []
        mock_aw_cls.return_value = mock_aw

        # Processor returns quality_changed for USGS but not for AW
        mock_processor = MagicMock()
        mock_processor.process.side_effect = [
            [{  # USGS result
                "river_id": "r1",
                "river_name": "Colorado River",
                "quality_changed": True,
                "old_quality": "poor",
                "new_quality": "excellent",
            }],
            [],  # AW result (empty)
        ]
        mock_processor_cls.return_value = mock_processor

        mock_notifier = MagicMock()
        mock_notifier_cls.return_value = mock_notifier

        from main import run_river_scrapers
        run_river_scrapers()

        mock_notifier.notify_condition_change.assert_called_once()

    @patch("main.PushNotifier")
    @patch("main.ConditionProcessor")
    @patch("main.AmericanWhitewaterScraper")
    @patch("main.USGSScraper")
    def test_handles_scraper_exception(self, mock_usgs_cls, mock_aw_cls,
                                        mock_processor_cls, mock_notifier_cls):
        """Should continue even if one scraper throws an exception."""
        mock_usgs = MagicMock()
        mock_usgs.name = "usgs"
        mock_usgs.scrape.side_effect = RuntimeError("USGS down")
        mock_usgs_cls.return_value = mock_usgs

        mock_aw = MagicMock()
        mock_aw.name = "aw"
        mock_aw.scrape.return_value = []
        mock_aw_cls.return_value = mock_aw

        mock_processor = MagicMock()
        mock_processor.process.return_value = []
        mock_processor_cls.return_value = mock_processor

        mock_notifier_cls.return_value = MagicMock()

        from main import run_river_scrapers
        # Should not raise
        run_river_scrapers()
        # AW should still be attempted
        mock_aw.scrape.assert_called_once()


# ─── run_raft_watch Tests ───────────────────────────────────


class TestRunRaftWatch:
    """Test the run_raft_watch function."""

    @patch("main.PushNotifier")
    @patch("main.DealMatcher")
    @patch("main.CraigslistScraper")
    def test_runs_craigslist_scraper(self, mock_cl_cls, mock_matcher_cls,
                                      mock_notifier_cls):
        """Should run the Craigslist scraper."""
        mock_cl = MagicMock()
        mock_cl.scrape.return_value = []
        mock_cl_cls.return_value = mock_cl

        mock_matcher = MagicMock()
        mock_matcher.match.return_value = []
        mock_matcher_cls.return_value = mock_matcher

        mock_notifier_cls.return_value = MagicMock()

        from main import run_raft_watch
        run_raft_watch()

        mock_cl.scrape.assert_called_once()

    @patch("main.PushNotifier")
    @patch("main.DealMatcher")
    @patch("main.CraigslistScraper")
    def test_notifies_on_matches(self, mock_cl_cls, mock_matcher_cls,
                                  mock_notifier_cls):
        """Should call notifier when matches are found."""
        mock_cl = MagicMock()
        mock_cl.scrape.return_value = [MagicMock()]
        mock_cl_cls.return_value = mock_cl

        mock_matcher = MagicMock()
        mock_matcher.match.return_value = [{"filter_id": "f1", "deal_id": "d1"}]
        mock_matcher_cls.return_value = mock_matcher

        mock_notifier = MagicMock()
        mock_notifier_cls.return_value = mock_notifier

        from main import run_raft_watch
        run_raft_watch()

        mock_notifier.notify_deal_matches.assert_called_once()

    @patch("main.PushNotifier")
    @patch("main.DealMatcher")
    @patch("main.CraigslistScraper")
    def test_handles_scraper_exception(self, mock_cl_cls, mock_matcher_cls,
                                        mock_notifier_cls):
        """Should handle Craigslist scraper failure gracefully."""
        mock_cl = MagicMock()
        mock_cl.scrape.side_effect = RuntimeError("CL blocked")
        mock_cl_cls.return_value = mock_cl

        mock_matcher_cls.return_value = MagicMock()
        mock_notifier_cls.return_value = MagicMock()

        from main import run_raft_watch
        # Should not raise
        run_raft_watch()
