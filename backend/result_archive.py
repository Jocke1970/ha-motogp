"""Historical session results, designed for later integration into motogp_sensor.

This module is deliberately NOT installed or wired into the running integration.
Provide its existing API client, a Home Assistant Store-like object, and the
existing parse_classification function when constructing ResultArchive.
"""

from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Callable


class ResultUnavailable(Exception):
    """Session is unfinished, absent from this category, or has no classification."""


class ResultsHidden(Exception):
    """Historical results cannot be accessed while no-spoiler mode is enabled."""


class ArchiveFormatError(Exception):
    """Stored data is incompatible; do not overwrite it silently."""


class ResultArchive:
    """Fetch by event + category + session UUID and persist finished results.

    ``api`` provides async_get_sessions(event_id, category_id) and
    async_get_classification(session_id). ``store`` provides HA Store's
    async_load()/async_save(data). ``parse_classification`` is injected from
    the installed integration to preserve its existing rider-data contract.

    The caller MUST pass the current no-spoiler state on every read. No cached
    results or session metadata are returned when that state is enabled.
    """

    SCHEMA = 1

    def __init__(
        self,
        api: Any,
        store: Any,
        parse_classification: Callable[[list[dict[str, Any]]], list[dict[str, Any]]],
        *,
        max_entries: int = 512,
    ) -> None:
        if max_entries < 1:
            raise ValueError("max_entries must be positive")
        self._api = api
        self._store = store
        self._parse_classification = parse_classification
        self._max_entries = max_entries
        self._entries: dict[str, dict[str, Any]] | None = None
        self._lock = asyncio.Lock()

    @staticmethod
    def _required_id(value: Any, name: str) -> str:
        if not isinstance(value, (str, int)) or not str(value).strip():
            raise ValueError(f"{name} is required")
        return str(value).strip()

    @staticmethod
    def _cache_key(event_id: str, category_id: str, session_id: str) -> str:
        # JSON array avoids delimiter collisions and binds the complete identity.
        import json

        return json.dumps([event_id, category_id, session_id], separators=(",", ":"))

    @staticmethod
    def _check_spoilers(no_spoiler: bool) -> None:
        if no_spoiler:
            raise ResultsHidden("Disable no-spoiler mode before viewing results")

    async def _load_locked(self) -> dict[str, dict[str, Any]]:
        if self._entries is not None:
            return self._entries
        saved = await self._store.async_load()
        if saved is None:
            self._entries = {}
            return self._entries
        if (
            not isinstance(saved, dict)
            or saved.get("schema") != self.SCHEMA
            or not isinstance(saved.get("entries"), dict)
        ):
            raise ArchiveFormatError("Archive schema/entries invalid; original store untouched")
        entries = saved["entries"]
        if not all(isinstance(key, str) and isinstance(value, dict) for key, value in entries.items()):
            raise ArchiveFormatError("Invalid archived entry; original store untouched")
        self._entries = entries
        return entries

    async def async_list_sessions(
        self, event_id: str, category_id: str, *, no_spoiler: bool
    ) -> list[dict[str, Any]]:
        """List the sessions for the explicitly chosen event and category."""
        self._check_spoilers(no_spoiler)
        event_id = self._required_id(event_id, "event_id")
        category_id = self._required_id(category_id, "category_id")
        sessions = await self._api.async_get_sessions(event_id, category_id)
        if not isinstance(sessions, list):
            raise ResultUnavailable("Session list unavailable")
        return [
            {
                "id": str(session["id"]),
                "name": str(session.get("name") or session.get("type") or "Session"),
                "type": str(session.get("type") or ""),
                "number": session.get("number"),
                "date": session.get("date"),
                "status": str(session.get("status") or ""),
            }
            for session in sessions
            if isinstance(session, dict) and session.get("id")
        ]

    async def async_get_result(
        self,
        event_id: str,
        category_id: str,
        session_id: str,
        *,
        no_spoiler: bool,
    ) -> dict[str, Any]:
        """Return cached or official FINISHED classification, never live timing.

        A session ID must belong to the requested event/category according to
        the sessions endpoint. Empty or malformed results are not cached, so a
        later request can retry when official classification becomes available.
        """
        self._check_spoilers(no_spoiler)
        event_id = self._required_id(event_id, "event_id")
        category_id = self._required_id(category_id, "category_id")
        session_id = self._required_id(session_id, "session_id")
        key = self._cache_key(event_id, category_id, session_id)

        async with self._lock:
            entries = await self._load_locked()
            if key in entries:
                cached = entries[key]
                if (
                    cached.get("event_id") != event_id
                    or cached.get("category_id") != category_id
                    or cached.get("session_id") != session_id
                ):
                    raise ArchiveFormatError("Cached session identity mismatch")
                return deepcopy(cached)

            sessions = await self._api.async_get_sessions(event_id, category_id)
            if not isinstance(sessions, list):
                raise ResultUnavailable("Session list unavailable")
            session = next(
                (
                    item for item in sessions
                    if isinstance(item, dict) and str(item.get("id") or "") == session_id
                ),
                None,
            )
            if session is None:
                raise ResultUnavailable("Session does not belong to selected event/category")
            if str(session.get("status") or "").upper() != "FINISHED":
                raise ResultUnavailable("Session has not finished")

            classification = await self._api.async_get_classification(session_id)
            if not isinstance(classification, dict):
                raise ResultUnavailable("Classification response invalid")
            rows = classification.get("classification")
            if not isinstance(rows, list) or not rows:
                raise ResultUnavailable("Official classification not available yet")
            riders = self._parse_classification(rows)
            if not isinstance(riders, list) or not riders:
                raise ResultUnavailable("Classification could not be parsed")

            record = {
                "event_id": event_id,
                "category_id": category_id,
                "session_id": session_id,
                "session_name": str(session.get("name") or session.get("type") or "Session"),
                "session_type": str(session.get("type") or ""),
                "session_number": session.get("number"),
                "session_date": session.get("date"),
                "status": "FINISHED",
                "source": "official_classification",
                "saved_at": datetime.now(timezone.utc).isoformat(),
                "riders": riders,
            }
            updated = dict(entries)
            updated[key] = record
            while len(updated) > self._max_entries:
                del updated[next(iter(updated))]
            # Do not announce/cache a saved result if persistence fails.
            await self._store.async_save({"schema": self.SCHEMA, "entries": updated})
            self._entries = updated
            return deepcopy(record)
