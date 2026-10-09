#!/usr/bin/env python3
"""Regression checks for the October 2026 MotoGP weekend beta fixes."""

from __future__ import annotations

import importlib.util
import json
from datetime import datetime
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


def check_beta_version() -> None:
    manifest = json.loads((INTEGRATION / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["domain"] == "motogp_sensor"
    assert manifest["version"] == "2026.10.0b2"


if __name__ == "__main__":
    check_red_flag_polling_contract()
    check_mandalika_timezone()
    check_broadcast_url_template_contract()
    check_beta_version()
    print("Weekend regressions OK: R/D polling, Mandalika timezone, broadcast URL template, 2026.10.0b2")
