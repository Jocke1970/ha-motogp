#!/usr/bin/env python3
"""Regression checks for the October 2026 MotoGP weekend beta fixes."""

from __future__ import annotations

import importlib.util
import json
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
INTEGRATION = ROOT / "custom_components" / "motogp_sensor"


def load_schedule_time():
    path = INTEGRATION / "schedule_time.py"
    spec = importlib.util.spec_from_file_location("motogp_schedule_time", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load schedule_time.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check_red_flag_polling_contract() -> None:
    source = (INTEGRATION / "coordinator.py").read_text(encoding="utf-8")
    expected = 'LIVE_SESSION_STATUS_IDS = frozenset({"I", "S", "R", "D"})'
    assert expected in source, "Red Flag/Delayed must remain fast-polled"
    assert (
        'raw_live.get("session_status_id") in LIVE_SESSION_STATUS_IDS' in source
    ), "Adaptive polling must use the shared live-status set"
    assert (
        'live.get("session_status_id") in LIVE_SESSION_STATUS_IDS' in source
    ), "Session context/weather must use the shared live-status set"


def check_mandalika_timezone() -> None:
    schedule_time = load_schedule_time()

    assert schedule_time.canonical_time_zone("ASIA/MAKASSAR") == "Asia/Makassar"
    utc = schedule_time.session_wall_time_to_utc(
        "2026-10-09T14:05:00+00:00",
        "ASIA/MAKASSAR",
    )
    assert utc == "2026-10-09T06:05:00+00:00", utc

    stockholm = datetime.fromisoformat(utc).astimezone(ZoneInfo("Europe/Stockholm"))
    assert stockholm.strftime("%Y-%m-%d %H:%M") == "2026-10-09 08:05"



def check_broadcast_url_template_contract() -> None:
    source = (INTEGRATION / "const.py").read_text(encoding="utf-8")
    expected = 'PULSELIVE_BROADCAST_EVENT_URL = PULSELIVE_BASE_URL + "/events/{uuid}"'
    assert expected in source, "Broadcast event URL must preserve {uuid} until .format()"

    # Import const.py with the minimum HA stub needed to execute module-level
    # expressions. This catches NameError-style release failures that compileall
    # cannot detect.
    class _Platform:
        SENSOR = "sensor"
        BINARY_SENSOR = "binary_sensor"
        CALENDAR = "calendar"
        SWITCH = "switch"
        SELECT = "select"

    homeassistant = types.ModuleType("homeassistant")
    homeassistant_const = types.ModuleType("homeassistant.const")
    homeassistant_const.Platform = _Platform
    previous_ha = sys.modules.get("homeassistant")
    previous_const = sys.modules.get("homeassistant.const")
    sys.modules["homeassistant"] = homeassistant
    sys.modules["homeassistant.const"] = homeassistant_const
    try:
        path = INTEGRATION / "const.py"
        spec = importlib.util.spec_from_file_location("motogp_const_smoke", path)
        if spec is None or spec.loader is None:
            raise RuntimeError("Unable to load const.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        assert module.PULSELIVE_BROADCAST_EVENT_URL.format(uuid="event-123").endswith(
            "/events/event-123"
        )
    finally:
        if previous_ha is None:
            sys.modules.pop("homeassistant", None)
        else:
            sys.modules["homeassistant"] = previous_ha
        if previous_const is None:
            sys.modules.pop("homeassistant.const", None)
        else:
            sys.modules["homeassistant.const"] = previous_const


def check_near_session_standby_polling() -> None:
    schedule_time = load_schedule_time()
    sessions = [{"date_utc": "2026-10-10T07:00:00+00:00"}]

    # Still ordinary 300-second idle polling six minutes before start.
    assert not schedule_time.scheduled_session_start_near(
        sessions,
        datetime(2026, 10, 10, 6, 54, tzinfo=timezone.utc),
        before=timedelta(minutes=5),
        after=timedelta(minutes=10),
    )

    # Enter 15-second prestart cadence inside T-5m.
    assert schedule_time.scheduled_session_start_near(
        sessions,
        datetime(2026, 10, 10, 6, 55, 1, tzinfo=timezone.utc),
        before=timedelta(minutes=5),
        after=timedelta(minutes=10),
    )

    # Still dense immediately after scheduled start if the feed has not
    # transitioned to an active status yet.
    assert schedule_time.scheduled_session_start_near(
        sessions,
        datetime(2026, 10, 10, 7, 9, 59, tzinfo=timezone.utc),
        before=timedelta(minutes=5),
        after=timedelta(minutes=10),
    )

    # 30-second fallback remains available for a delayed/non-transitioning feed.
    assert schedule_time.scheduled_session_start_near(
        sessions,
        datetime(2026, 10, 10, 7, 29, 59, tzinfo=timezone.utc),
        before=timedelta(minutes=0),
        after=timedelta(minutes=30),
    )
    assert not schedule_time.scheduled_session_start_near(
        sessions,
        datetime(2026, 10, 10, 7, 30, 1, tzinfo=timezone.utc),
        before=timedelta(minutes=0),
        after=timedelta(minutes=30),
    )

    source = (INTEGRATION / "coordinator.py").read_text(encoding="utf-8")
    assert "self.update_interval = LIVE_POLLING_PRESTART" in source
    assert "self.update_interval = LIVE_POLLING_STANDBY" in source

def check_beta_version() -> None:
    manifest = json.loads((INTEGRATION / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["domain"] == "motogp_sensor"
    assert manifest["version"] == "2026.10.0b4"


if __name__ == "__main__":
    check_red_flag_polling_contract()
    check_mandalika_timezone()
    check_broadcast_url_template_contract()
    check_near_session_standby_polling()
    check_beta_version()
    print("Weekend regressions OK: R/D polling, Mandalika timezone, tiered session-start polling, broadcast URL template, 2026.10.0b4")
