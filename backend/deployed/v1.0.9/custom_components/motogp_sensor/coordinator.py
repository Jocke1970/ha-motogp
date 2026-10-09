"""Data coordinator for the MotoGP Sensor integration."""

from __future__ import annotations

import copy
import logging
from collections import deque
from datetime import datetime, timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .api import MotogpApiClient, MotogpApiError
from .const import (
    DOMAIN,
    EVENT_LIVE_TIMING_OFFLINE,
    EVENT_LIVE_TIMING_ONLINE,
    EVENT_MOTOGP,
    EVENT_RACE_WEEK_ENDED,
    EVENT_RACE_WEEK_STARTED,
    EVENT_SESSION_CANCELLED,
    EVENT_SESSION_DELAYED,
    EVENT_SESSION_FINISHED,
    EVENT_SESSION_IN_PROGRESS,
    EVENT_SESSION_RED_FLAG,
    LIVE_POLLING_ACTIVE,
    LIVE_POLLING_IDLE,
    LIVE_SOURCE_AUTO,
    LIVE_SOURCE_OFFICIAL,
    LIVE_SOURCE_PULSELIVE,
    GRID_RECORDS_REFRESH_INTERVAL,
    STATIC_REFRESH_INTERVAL,
    WEATHER_REFRESH_INTERVAL,
)
from .helpers import (
    EVENT_WINDOW_GRACE,
    aggregate_constructor_standings,
    events_to_calendar,
    find_next_event,
    is_race_week,
    parse_api_date,
    parse_classification,
    parse_live_timing,
    parse_standings,
)

_LOGGER = logging.getLogger(__name__)

# Session types, best race first (used to pick "the race" of a weekend).
RACE_SESSION_PRIORITY = ("RAC", "SPR")


class MotogpCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Fetch and hold MotoGP live and static data."""

    def __init__(
        self,
        hass: HomeAssistant,
        api: MotogpApiClient,
        live_source: str,
        race_week_start_day: str,
        enabled_sensors: list[str],
    ) -> None:
        """Initialize the coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=LIVE_POLLING_IDLE,
        )
        self.api = api
        self.live_source = live_source
        self.race_week_start_day = race_week_start_day
        self.enabled_sensors = set(enabled_sensors)
        self.device_id: str | None = None
        self.no_spoiler = False
        self._race_week = False

        self._last_static_refresh: datetime | None = None
        self._last_grid_records_refresh: datetime | None = None
        self._last_weather_refresh: datetime | None = None
        self._prev_live_online: bool | None = None
        self._prev_session_status: str | None = None
        self._prev_race_week: bool | None = None

        # TV-sync buffer. Raw live snapshots are retained here and the
        # coordinator exposes a snapshot from N seconds ago.
        self._live_history: deque[tuple[datetime, dict[str, Any]]] = deque()
        self._tv_delay_seconds = 0
        self._tv_delay_effective_seconds = 0
        self._tv_delay_ready = True

        self.static: dict[str, Any] = {
            "season": None,
            "events": [],
            "calendar": [],
            "next_event": None,
            "rider_standings": [],
            "constructor_standings": [],
            "last_race_results": [],
            "start_grids": {},
            "records_by_category": {},
            "records_session_by_category": {},
            "categories": [],
            "weekend_sessions": [],
            "weekend_sessions_all": [],
            "schedule_categories": [],
            "track_weather": None,
        }

    # ── Public helpers for entities ─────────────────────────────────────────
    @property
    def live_data(self) -> dict[str, Any] | None:
        """Return the parsed live timing payload (or None)."""
        data = self.data.get("live") if self.data else None
        return data

    @property
    def live_online(self) -> bool:
        """True when a live timing feed is currently reachable."""
        return bool(self.data and self.data.get("live_online"))

    @property
    def session_in_progress(self) -> bool:
        """True when the current session is in progress."""
        live = self.live_data
        if not live:
            return False
        return live.get("session_status_id") in ("I", "S")

    @property
    def race_week(self) -> bool:
        """True when we are inside the current race week window."""
        return self._race_week

    def _fire_event(self, event_type: str) -> None:
        """Fire a MotoGP device event on the HA bus."""
        if not self.device_id:
            return
        self.hass.bus.async_fire(
            EVENT_MOTOGP,
            {"device_id": self.device_id, "type": event_type},
        )
        _LOGGER.debug("Fired MotoGP event: %s", event_type)

    # ── TV delay / broadcast sync ───────────────────────────────────────────
    def _read_tv_delay_seconds(self) -> int:
        """Read the requested broadcast delay from the HA helper."""
        state = self.hass.states.get("input_number.motogp_tv_delay_seconds")
        if state is None:
            return 0

        try:
            value = int(round(float(state.state)))
        except (TypeError, ValueError):
            return 0

        return max(0, min(value, 300))

    def _apply_tv_delay(
        self,
        raw_live: dict[str, Any] | None,
        now: datetime,
    ) -> dict[str, Any] | None:
        """Return live timing delayed to approximately match the TV feed."""
        requested = self._read_tv_delay_seconds()
        self._tv_delay_seconds = requested

        # Keep pristine parsed snapshots in the history.
        if raw_live is not None:
            self._live_history.append(
                (now, copy.deepcopy(raw_live))
            )

        # Keep enough history for the maximum useful delay plus margin.
        keep_seconds = max(600, requested + 180)
        cutoff = now - timedelta(seconds=keep_seconds)

        while self._live_history and self._live_history[0][0] < cutoff:
            self._live_history.popleft()

        if requested <= 0:
            self._tv_delay_effective_seconds = 0
            self._tv_delay_ready = True

            if raw_live is None:
                return None

            result = copy.deepcopy(raw_live)
            result["tv_delay_seconds"] = 0
            result["tv_delay_effective_seconds"] = 0
            result["tv_delay_ready"] = True
            return result

        if not self._live_history:
            self._tv_delay_effective_seconds = 0
            self._tv_delay_ready = False
            return None

        target = now - timedelta(seconds=requested)

        selected_time = None
        selected_live = None

        # Newest snapshot at or before the target time.
        for snapshot_time, snapshot in reversed(self._live_history):
            if snapshot_time <= target:
                selected_time = snapshot_time
                selected_live = snapshot
                break

        # Immediately after startup there may not yet be enough buffered
        # history. Expose the oldest available sample and flag warm-up.
        ready = selected_live is not None

        if selected_live is None:
            selected_time, selected_live = self._live_history[0]

        effective = max(
            0,
            int(round((now - selected_time).total_seconds())),
        )

        self._tv_delay_effective_seconds = effective
        self._tv_delay_ready = ready

        result = copy.deepcopy(selected_live)
        result["tv_delay_seconds"] = requested
        result["tv_delay_effective_seconds"] = effective
        result["tv_delay_ready"] = ready

        return result

    # ── Update loop ─────────────────────────────────────────────────────────
    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch the latest data."""
        now = dt_util.utcnow()

        # 1. Live timing (with source fallback)
        live: dict[str, Any] | None = None
        live_online = False
        try:
            payload = await self.api.async_get_live_timing(self.live_source)
            live = parse_live_timing(payload)
            live_online = True
        except MotogpApiError as err:
            _LOGGER.debug("Live timing failed on %s: %s", self.live_source, err)
            if self.live_source in (LIVE_SOURCE_AUTO, LIVE_SOURCE_OFFICIAL):
                try:
                    payload = await self.api.async_get_live_timing(LIVE_SOURCE_PULSELIVE)
                    live = parse_live_timing(payload)
                    live_online = True
                except MotogpApiError as err2:
                    _LOGGER.debug("Live timing fallback failed: %s", err2)

        # 2. Static data refresh (throttled)
        if (
            self._last_static_refresh is None
            or now - self._last_static_refresh >= STATIC_REFRESH_INTERVAL
        ):
            try:
                await self._async_refresh_static(now)
                self._last_static_refresh = now
            except MotogpApiError as err:
                _LOGGER.warning("Static data refresh failed: %s", err)

        # 2a. Weekend start grid + records (5-minute cache).
        if (
            self.static.get("next_event") is not None
            and (
                self._last_grid_records_refresh is None
                or now - self._last_grid_records_refresh
                >= GRID_RECORDS_REFRESH_INTERVAL
            )
        ):
            try:
                await self._async_refresh_grid_records(now)
                self._last_grid_records_refresh = now
            except MotogpApiError as err:
                _LOGGER.debug(
                    "Grid/records refresh failed: %s",
                    err,
                )

        # 2b. Track/weather conditions for the active session.
        if (
            live is not None
            and live.get("session_status_id") in ("I", "S")
            and (
                self._last_weather_refresh is None
                or now - self._last_weather_refresh >= WEATHER_REFRESH_INTERVAL
            )
        ):
            await self._async_refresh_live_conditions(live, now)
            self._last_weather_refresh = now

        # Apply broadcast delay only to the exposed live snapshot.
        # Polling activity still follows the real/raw feed so the history
        # continues to be sampled quickly while a session is active.
        raw_live = live
        live = self._apply_tv_delay(raw_live, dt_util.utcnow())

        # 3. Detect state transitions and fire events
        # MOTOGP_POSTRACE_ADVANCE_V1
        self._advance_after_final_motogp_race(live, now)

        self._detect_transitions(live, live_online, now)

        # 4. Adapt polling interval to session activity
        active = (
            live_online
            and raw_live is not None
            and raw_live.get("session_status_id") in ("I", "S")
        )
        self.update_interval = LIVE_POLLING_ACTIVE if active else LIVE_POLLING_IDLE

        return {"live": live, "live_online": live_online}

    async def _async_refresh_live_conditions(
        self,
        live: dict[str, Any],
        now: datetime,
    ) -> None:
        # Refresh track/air/ground/humidity for the active class/session.
        event = self.static.get("next_event")
        if not isinstance(event, dict) or not event.get("id"):
            return

        category_name = str(live.get("category") or "").strip()
        live_shortname = str(live.get("session_shortname") or "").strip().upper()

        category_uuid = None
        for item in self.static.get("weekend_sessions_all", []):
            if not isinstance(item, dict):
                continue
            if str(item.get("category") or "").strip() == category_name:
                category_uuid = item.get("category_id")
                if category_uuid:
                    break

        if not category_uuid:
            return

        try:
            sessions = await self.api.async_get_sessions(
                event["id"],
                category_uuid,
            )
        except MotogpApiError as err:
            _LOGGER.debug("Live conditions refresh failed: %s", err)
            return

        def _shortname(sess: dict[str, Any]) -> str:
            session_type = str(sess.get("type") or "").upper()
            number = sess.get("number")

            if session_type in ("FP", "Q", "RAC"):
                if number not in (None, "", 0, "0"):
                    return f"{session_type}{number}"
            return session_type

        exact = None
        fallback = None
        fallback_date = None

        for sess in sessions:
            if not isinstance(sess, dict):
                continue

            condition = sess.get("condition")
            if not isinstance(condition, dict) or not condition:
                continue

            shortname = _shortname(sess)
            session_type = str(sess.get("type") or "").upper()

            if shortname == live_shortname or session_type == live_shortname:
                exact = sess
                break

            session_date = parse_api_date(sess.get("date"))
            if (
                session_date is not None
                and session_date <= now
                and (fallback_date is None or session_date > fallback_date)
            ):
                fallback = sess
                fallback_date = session_date

        selected = exact or fallback
        if selected is None:
            return

        condition = selected.get("condition")
        if not isinstance(condition, dict):
            return

        self.static["track_weather"] = {
            "track": condition.get("track") or "",
            "air": condition.get("air") or "",
            "ground": condition.get("ground") or "",
            "humidity": condition.get("humidity") or "",
            "weather": condition.get("weather") or "",
            "category": category_name,
            "session": live_shortname,
            "source_session": _shortname(selected),
            "updated_at": now.isoformat(),
        }

    @staticmethod
    def _grid_records_category_name(value: Any) -> str:
        raw = str(value or "").strip()
        lowered = raw.lower()

        if "motogp" in lowered:
            return "MotoGP"
        if "moto2" in lowered:
            return "Moto2"
        if "moto3" in lowered:
            return "Moto3"
        if "motoe" in lowered:
            return "MotoE"

        return raw

    @staticmethod
    def _normalize_grid(
        grid: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []

        for item in grid:
            if not isinstance(item, dict):
                continue

            rider = item.get("rider")
            if not isinstance(rider, dict):
                rider = {}

            team = item.get("team")
            if not isinstance(team, dict):
                team = {}

            constructor = item.get("constructor")
            if not isinstance(constructor, dict):
                constructor = {}

            category = item.get("category")
            if not isinstance(category, dict):
                category = {}

            rider_country = rider.get("country")
            if not isinstance(rider_country, dict):
                rider_country = {}

            result.append(
                {
                    "position": item.get("qualifying_position")
                    or item.get("position"),
                    "time": item.get("qualifying_time")
                    or item.get("time")
                    or "",
                    "rider": rider.get("full_name") or "",
                    "number": rider.get("number"),
                    "nation": rider_country.get("iso") or "",
                    "team": team.get("name")
                    or item.get("team_name")
                    or "",
                    "constructor": constructor.get("name") or "",
                    "category": category.get("name") or "",
                }
            )

        result.sort(
            key=lambda x: (
                x.get("position") is None,
                x.get("position") or 999,
            )
        )
        return result

    @staticmethod
    def _normalize_records(
        records: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []

        for item in records:
            if not isinstance(item, dict):
                continue

            rider = item.get("rider")
            if not isinstance(rider, dict):
                rider = {}

            rider_country = rider.get("country")
            if not isinstance(rider_country, dict):
                rider_country = {}

            best_lap = item.get("bestLap")
            if not isinstance(best_lap, dict):
                best_lap = item.get("best_lap")
            if not isinstance(best_lap, dict):
                best_lap = {}

            result.append(
                {
                    "type": item.get("type") or "",
                    "rider": rider.get("full_name") or "",
                    "number": rider.get("number"),
                    "nation": rider_country.get("iso") or "",
                    "time": best_lap.get("time") or "",
                    "lap": best_lap.get("number"),
                    "speed": item.get("speed") or "",
                    "year": item.get("year"),
                    "is_new_record": bool(
                        item.get("isNewRecord")
                        or item.get("is_new_record")
                    ),
                }
            )

        return result

    async def _async_refresh_grid_records(
        self,
        now: datetime,
    ) -> None:
        event = self.static.get("next_event")
        if not isinstance(event, dict) or not event.get("id"):
            return

        categories = self.static.get("categories", [])
        if not isinstance(categories, list) or not categories:
            return

        active_names = self.static.get("schedule_categories", [])
        if not isinstance(active_names, list):
            active_names = []

        grids: dict[str, list[dict[str, Any]]] = {}
        records_by_category: dict[str, list[dict[str, Any]]] = {}
        record_sessions: dict[str, dict[str, Any]] = {}

        for category in categories:
            if not isinstance(category, dict):
                continue

            category_uuid = category.get("id")
            category_name = self._grid_records_category_name(
                category.get("name")
            )

            if not category_uuid or not category_name:
                continue

            if active_names and category_name not in active_names:
                continue

            try:
                raw_grid = await self.api.async_get_grid(
                    event["id"],
                    category_uuid,
                )
                grids[category_name] = self._normalize_grid(raw_grid)
            except MotogpApiError as err:
                _LOGGER.debug(
                    "Grid refresh failed for %s: %s",
                    category_name,
                    err,
                )
                grids[category_name] = []

            try:
                sessions = await self.api.async_get_sessions(
                    event["id"],
                    category_uuid,
                )
            except MotogpApiError as err:
                _LOGGER.debug(
                    "Record sessions failed for %s: %s",
                    category_name,
                    err,
                )
                sessions = []

            eligible: list[dict[str, Any]] = []
            for sess in sessions:
                if not isinstance(sess, dict) or not sess.get("id"):
                    continue

                session_date = parse_api_date(sess.get("date"))
                if session_date is not None and session_date > now:
                    continue

                eligible.append(sess)

            eligible.sort(
                key=lambda s: parse_api_date(s.get("date")) or now
            )

            records: list[dict[str, Any]] = []
            source_session: dict[str, Any] = {}

            for sess in reversed(eligible):
                try:
                    classification = await self.api.async_get_classification(
                        sess["id"]
                    )
                except MotogpApiError:
                    continue

                raw_records = classification.get("records", [])
                if not isinstance(raw_records, list) or not raw_records:
                    continue

                records = self._normalize_records(raw_records)
                source_session = {
                    "id": sess.get("id"),
                    "type": sess.get("type"),
                    "number": sess.get("number"),
                    "date": sess.get("date"),
                    "status": sess.get("status"),
                }
                break

            records_by_category[category_name] = records
            record_sessions[category_name] = source_session

        self.static["start_grids"] = grids
        self.static["records_by_category"] = records_by_category
        self.static["records_session_by_category"] = record_sessions

    # ── Static data ─────────────────────────────────────────────────────────
    async def _async_refresh_static(self, now: datetime) -> None:
        """Fetch season, events, standings and last race results."""
        # Season
        seasons = await self.api.async_get_seasons()
        season = next((s for s in seasons if s.get("current")), seasons[0] if seasons else None)
        season_uuid = season.get("id") if season else None
        self.static["season"] = season

        if not season_uuid:
            return

        # Category (MotoGP class)
        categories = await self.api.async_get_categories(season_uuid)
        self.static["categories"] = categories
        category = next(
            (c for c in categories if str(c.get("name", "")).startswith("MotoGP")),
            categories[0] if categories else None,
        )
        category_uuid = category.get("id") if category else None

        # Events + calendar
        events = await self.api.async_get_events(season_uuid)
        events = [e for e in events if isinstance(e, dict)]
        self.static["events"] = events
        self.static["calendar"] = events_to_calendar(events)
        self.static["next_event"] = find_next_event(events, now)

        # ── All-category weekend schedule ──
        self.static["weekend_sessions_all"] = []
        self.static["schedule_categories"] = []

        schedule_event = self.static.get("next_event")

        def _schedule_category_name(value: Any) -> str:
            raw = str(value or "").strip()
            lowered = raw.lower()

            if "motogp" in lowered:
                return "MotoGP"
            if "moto2" in lowered:
                return "Moto2"
            if "moto3" in lowered:
                return "Moto3"
            if "motoe" in lowered:
                return "MotoE"

            return raw

        def _schedule_session_name(sess: dict[str, Any]) -> str:
            session_type = str(sess.get("type") or "").upper()
            session_number = sess.get("number")

            if session_type == "FP":
                return f"FP{session_number}" if session_number else "Free Practice"
            if session_type == "PR":
                return "Practice"
            if session_type == "Q":
                return f"Q{session_number}" if session_number else "Qualifying"
            if session_type == "SPR":
                return "Sprint"
            if session_type == "RAC":
                return "Race"
            if session_type == "WUP":
                return "Warm Up"

            return session_type or "Session"

        if schedule_event is not None:
            all_sessions: list[dict[str, Any]] = []
            seen_categories: list[str] = []

            for schedule_category in categories:
                if not isinstance(schedule_category, dict):
                    continue

                schedule_category_uuid = schedule_category.get("id")
                schedule_category_name = _schedule_category_name(
                    schedule_category.get("name")
                )

                if not schedule_category_uuid or not schedule_category_name:
                    continue

                try:
                    category_sessions = await self.api.async_get_sessions(
                        schedule_event["id"], schedule_category_uuid
                    )
                except MotogpApiError as err:
                    _LOGGER.debug(
                        "Weekend schedule failed for %s: %s",
                        schedule_category_name,
                        err,
                    )
                    continue

                if category_sessions and schedule_category_name not in seen_categories:
                    seen_categories.append(schedule_category_name)

                for sess in category_sessions:
                    if not isinstance(sess, dict):
                        continue

                    session_date = sess.get("date")
                    if not session_date:
                        continue

                    condition = sess.get("condition")
                    if not isinstance(condition, dict):
                        condition = {}

                    all_sessions.append(
                        {
                            "id": sess.get("id"),
                            "category": schedule_category_name,
                            "category_raw": schedule_category.get("name") or "",
                            "category_id": schedule_category_uuid,
                            "name": _schedule_session_name(sess),
                            "type": str(sess.get("type") or "").upper(),
                            "number": sess.get("number"),
                            "date": session_date,
                            "status": sess.get("status") or "",
                            "circuit": sess.get("circuit") or "",
                            "track": condition.get("track") or "",
                            "air": condition.get("air") or "",
                            "ground": condition.get("ground") or "",
                            "humidity": condition.get("humidity") or "",
                            "weather": condition.get("weather") or "",
                        }
                    )

            all_sessions.sort(
                key=lambda s: parse_api_date(s.get("date")) or now
            )

            preferred = ["MotoGP", "Moto2", "Moto3", "MotoE"]
            ordered_categories = [
                name for name in preferred if name in seen_categories
            ]
            ordered_categories.extend(
                name for name in seen_categories if name not in ordered_categories
            )

            self.static["weekend_sessions_all"] = all_sessions
            self.static["schedule_categories"] = ordered_categories

        if category_uuid:
            # Standings (rider + aggregated constructor)
            try:
                standings = await self.api.async_get_standings(season_uuid, category_uuid)
                rider_standings = parse_standings(standings.get("classification", []))
            except MotogpApiError as err:
                _LOGGER.debug("Rider standings failed: %s", err)
                rider_standings = []
            self.static["rider_standings"] = rider_standings
            self.static["constructor_standings"] = aggregate_constructor_standings(
                rider_standings
            )

            # Last race results + track weather for the relevant events
            await self._async_refresh_event_details(events, category_uuid, now)

    async def _async_refresh_event_details(
        self, events: list[dict[str, Any]], category_uuid: str, now: datetime
    ) -> None:
        """Fetch sessions/classification for the relevant events."""
        past = [
            e
            for e in events
            if parse_api_date(e.get("date_end")) is not None
            and parse_api_date(e.get("date_end")) < now
        ]
        past.sort(
            key=lambda e: parse_api_date(e.get("date_end")) or now, reverse=True
        )
        last_event = past[0] if past else None

        # ── Weekend schedule for next/current MotoGP event ──
        self.static["weekend_sessions"] = []
        schedule_event = self.static.get("next_event")

        if schedule_event is not None:
            try:
                schedule_sessions = await self.api.async_get_sessions(
                    schedule_event["id"], category_uuid
                )
            except MotogpApiError as err:
                _LOGGER.debug("Weekend schedule sessions failed: %s", err)
                schedule_sessions = []

            normalized_sessions: list[dict[str, Any]] = []

            for sess in schedule_sessions:
                if not isinstance(sess, dict):
                    continue

                session_date = sess.get("date")
                if not session_date:
                    continue

                session_type = str(sess.get("type") or "").upper()
                session_number = sess.get("number")

                if session_type == "FP":
                    if session_number:
                        session_name = f"FP{session_number}"
                    else:
                        session_name = "Free Practice"

                elif session_type == "PR":
                    session_name = "Practice"

                elif session_type == "Q":
                    if session_number:
                        session_name = f"Q{session_number}"
                    else:
                        session_name = "Qualifying"

                elif session_type == "SPR":
                    session_name = "Sprint"

                elif session_type == "RAC":
                    session_name = "Race"

                elif session_type == "WUP":
                    session_name = "Warm Up"

                else:
                    session_name = session_type or "Session"

                condition = sess.get("condition")
                if not isinstance(condition, dict):
                    condition = {}

                normalized_sessions.append(
                    {
                        "id": sess.get("id"),
                        "name": session_name,
                        "type": session_type,
                        "number": session_number,
                        "date": session_date,
                        "status": sess.get("status") or "",
                        "circuit": sess.get("circuit") or "",
                        "track": condition.get("track") or "",
                        "air": condition.get("air") or "",
                        "ground": condition.get("ground") or "",
                        "humidity": condition.get("humidity") or "",
                        "weather": condition.get("weather") or "",
                    }
                )

            normalized_sessions.sort(
                key=lambda s: parse_api_date(s.get("date")) or now
            )

            self.static["weekend_sessions"] = normalized_sessions

        # Weather: from the current weekend if we are inside it, otherwise
        # from the most recent finished event (which has real conditions).
        weather_event = None
        target = self.static.get("next_event")
        if target is not None:
            start = parse_api_date(target.get("date_start"))
            end = parse_api_date(target.get("date_end"))
            if start is not None and end is not None and start <= now <= end + EVENT_WINDOW_GRACE:
                weather_event = target
        if weather_event is None:
            weather_event = last_event

        if weather_event is not None:
            try:
                sessions = await self.api.async_get_sessions(
                    weather_event["id"], category_uuid
                )
            except MotogpApiError as err:
                _LOGGER.debug("Sessions failed: %s", err)
                sessions = []

            weather = None
            for sess in sessions:
                cond = sess.get("condition")
                if isinstance(cond, dict) and cond:
                    weather = {
                        "track": cond.get("track") or "",
                        "air": cond.get("air") or "",
                        "ground": cond.get("ground") or "",
                        "humidity": cond.get("humidity") or "",
                        "weather": cond.get("weather") or "",
                    }
            self.static["track_weather"] = weather

        # Last race results: from the most recent finished event
        if last_event is None:
            self.static["last_race_results"] = []
            return

        try:
            sessions = await self.api.async_get_sessions(
                last_event["id"], category_uuid
            )
        except MotogpApiError as err:
            _LOGGER.debug("Sessions failed: %s", err)
            self.static["last_race_results"] = []
            return

        # Pick the best session type (RAC > SPR)
        race = None
        for s_type in RACE_SESSION_PRIORITY:
            race = next(
                (
                    s
                    for s in sessions
                    if s.get("type") == s_type and s.get("status") == "FINISHED"
                ),
                None,
            )
            if race:
                break
        if race:
            try:
                classification = await self.api.async_get_classification(race["id"])
                self.static["last_race_results"] = parse_classification(
                    classification.get("classification", [])
                )
            except MotogpApiError as err:
                _LOGGER.debug("Classification failed: %s", err)
                self.static["last_race_results"] = []
        else:
            self.static["last_race_results"] = []

    def _advance_after_final_motogp_race(
        self,
        live: dict[str, Any] | None,
        now: datetime,
    ) -> None:
        # Advance next_event immediately when final MotoGP RAC is done.
        if not live:
            return

        status_id = str(live.get("session_status_id") or "").upper()
        session = str(live.get("session_shortname") or "").upper()
        category = str(live.get("category") or "").upper()
        championship_id = str(live.get("championship_id") or "")
        remaining = str(live.get("remaining") or "").strip()

        is_motogp = (
            category == "MOTOGP"
            or championship_id == "3"
        )

        final_race_finished = (
            is_motogp
            and session == "RAC"
            and status_id in ("C", "F")
            and remaining in ("0", "0.0", "")
        )

        if not final_race_finished:
            return

        events = [
            event
            for event in self.static.get("events", [])
            if isinstance(event, dict)
            and not event.get("test", False)
        ]

        future = []

        for event in events:
            start = parse_api_date(event.get("date_start"))

            if start is not None and start > now:
                future.append((start, event))

        future.sort(key=lambda item: item[0])

        new_next_event = (
            future[0][1]
            if future
            else None
        )

        old_next_event = self.static.get("next_event")

        old_id = (
            old_next_event.get("id")
            if isinstance(old_next_event, dict)
            else None
        )

        new_id = (
            new_next_event.get("id")
            if isinstance(new_next_event, dict)
            else None
        )

        if old_id != new_id:
            _LOGGER.info(
                "Final MotoGP race finished; advancing next event from %s to %s",
                (
                    old_next_event.get("name")
                    if isinstance(old_next_event, dict)
                    else None
                ),
                (
                    new_next_event.get("name")
                    if isinstance(new_next_event, dict)
                    else None
                ),
            )

        self.static["next_event"] = new_next_event


    # ── Transitions / device events ─────────────────────────────────────────
    def _detect_transitions(
        self,
        live: dict[str, Any] | None,
        live_online: bool,
        now: datetime,
    ) -> None:
        """Fire events when the state changes between updates."""

        # Live timing online/offline
        if self._prev_live_online is not None:
            if live_online and not self._prev_live_online:
                self._fire_event(EVENT_LIVE_TIMING_ONLINE)
            elif not live_online and self._prev_live_online:
                self._fire_event(EVENT_LIVE_TIMING_OFFLINE)
        self._prev_live_online = live_online

        # Session status changes
        if live is not None:
            status_id = live.get("session_status_id")
            if status_id != self._prev_session_status:
                if status_id in ("I", "S"):
                    self._fire_event(EVENT_SESSION_IN_PROGRESS)
                elif status_id in ("F", "C"):
                    self._fire_event(EVENT_SESSION_FINISHED)
                elif status_id == "R":
                    self._fire_event(EVENT_SESSION_RED_FLAG)
                elif status_id == "D":
                    self._fire_event(EVENT_SESSION_DELAYED)
                self._prev_session_status = status_id
        elif self._prev_session_status is not None:
            self._prev_session_status = None

        # Race week start/end
        race_week = is_race_week(
            self.static.get("next_event"), now, self.race_week_start_day
        )
        self._race_week = race_week
        if self._prev_race_week is not None:
            if race_week and not self._prev_race_week:
                self._fire_event(EVENT_RACE_WEEK_STARTED)
            elif not race_week and self._prev_race_week:
                self._fire_event(EVENT_RACE_WEEK_ENDED)
        self._prev_race_week = race_week
