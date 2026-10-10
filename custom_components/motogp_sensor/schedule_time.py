"""Schedule timezone normalization for MotoGP Results API session timestamps.

The Results API exposes session wall-clock values with a +00:00 suffix even
when the value represents circuit-local time. The Broadcast API exposes the
event's IANA timezone. This module combines both without depending on Home
Assistant so the behavior is easy to regression-test.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError, available_timezones

_WALL_RE = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?"
)


@lru_cache(maxsize=1)
def _zone_names_casefolded() -> dict[str, str]:
    """Return IANA zone names keyed case-insensitively."""
    return {name.casefold(): name for name in available_timezones()}


def canonical_time_zone(raw: Any) -> str | None:
    """Return a valid IANA timezone name, accepting API upper-case spelling."""
    value = str(raw or "").strip()
    if not value:
        return None

    try:
        ZoneInfo(value)
        return value
    except ZoneInfoNotFoundError:
        return _zone_names_casefolded().get(value.casefold())


def session_wall_time_to_utc(raw: Any, time_zone: Any) -> str | None:
    """Convert a Results API circuit-local wall time to an actual UTC ISO time."""
    if not isinstance(raw, str) or not raw:
        return None

    zone_name = canonical_time_zone(time_zone)
    if zone_name is None:
        return None

    match = _WALL_RE.match(raw)
    if match is None:
        return None

    year, month, day, hour, minute, second = match.groups()
    try:
        local = datetime(
            int(year),
            int(month),
            int(day),
            int(hour),
            int(minute),
            int(second or 0),
            tzinfo=ZoneInfo(zone_name),
        )
    except (ValueError, ZoneInfoNotFoundError):
        return None

    return local.astimezone(timezone.utc).isoformat()


def scheduled_session_start_near(
    sessions: Any,
    now: datetime,
    *,
    before: timedelta = timedelta(minutes=15),
    after: timedelta = timedelta(minutes=30),
) -> bool:
    """Return True when a normalized session start is near now.

    Only backend-normalized date_utc values are trusted. Raw Results API
    date values are circuit wall times disguised with a UTC suffix and must
    not be compared directly with UTC now.
    """
    if not isinstance(sessions, list):
        return False
    if now.tzinfo is None or now.utcoffset() is None:
        return False

    now_utc = now.astimezone(timezone.utc)
    for item in sessions:
        if not isinstance(item, dict):
            continue
        raw = item.get("date_utc")
        if not isinstance(raw, str) or not raw:
            continue
        try:
            start = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            continue
        if start.tzinfo is None or start.utcoffset() is None:
            continue
        start_utc = start.astimezone(timezone.utc)
        if start_utc - before <= now_utc <= start_utc + after:
            return True

    return False
