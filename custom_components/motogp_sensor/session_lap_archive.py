"""Uninstalled, standard-library-only session lap archive engine for MotoGP Next.

Feed ONLY coordinator-approved, TV-delayed snapshots. Execute observe() off the HA
async event loop. No API access, no Home Assistant imports and no frontend exposure.
"""
from __future__ import annotations

import copy
import json
import os
import re
import tempfile
import threading
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
STATUSES = frozenset({"N", "I", "S", "R", "D", "F", "C"})
LAP = re.compile(r"^(?:(\d+)[:'])?(\d{1,3})\.(\d{3})$")


class ArchiveError(Exception):
    """An archive must not be overwritten or exposed when it is unsafe."""


class SpoilerHidden(ArchiveError):
    """The caller has enabled no-spoiler mode."""


def _text(value: Any) -> str:
    result = str(value if value is not None else "").strip()
    return "" if result.lower() in {"", "none", "null", "unknown", "unavailable"} else result


def _slug(value: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")[:65] or "unknown"


def _lap_seconds(value: Any) -> float | None:
    match = LAP.fullmatch(_text(value))
    if not match:
        return None
    minutes, seconds, millis = match.groups()
    if minutes is not None and int(seconds) >= 60:
        return None
    result = (int(minutes or 0) * 60) + int(seconds) + int(millis) / 1000
    return round(result, 3) if result > 0 else None


def _identity(live: dict[str, Any], year: int) -> dict[str, Any] | None:
    if not isinstance(year, int) or isinstance(year, bool) or not 1900 <= year <= 2100:
        raise ValueError("A verified season year is required")
    event_id = _text(live.get("event_id"))
    session_id = _text(live.get("session_id"))
    category_id = _text(live.get("championship_id")) or _text(live.get("category"))
    if not event_id or not session_id or not category_id:
        return None  # Never invent identities or silently combine sessions.
    return {"season": year, "event_id": event_id, "category_id": category_id,
            "session_id": session_id, "event_name": _text(live.get("event_name")) or event_id,
            "category": _text(live.get("category")) or category_id,
            "session": _text(live.get("session_shortname")) or session_id}


def _same(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return all(a.get(field) == b.get(field) for field in
               ("season", "event_id", "category_id", "session_id"))


def _coverage(riders: dict[str, Any]) -> dict[str, Any]:
    holes: dict[str, list[int]] = {}
    for key, rider in riders.items():
        numbers = {int(number) for number in rider["laps"]}
        if numbers:
            missing = sorted(set(range(1, max(numbers) + 1)) - numbers)
            if missing:
                holes[key] = missing
    return {"partial": bool(holes), "missing_laps_by_rider": holes,
            "observed_laps": sum(len(r["laps"]) for r in riders.values())}


class SessionLapArchive:
    """Persistent single-process archive; observe() is synchronous and serialized."""

    def __init__(self, root: str | Path):
        self.root = Path(root)
        self._lock = threading.RLock()
        self._active_key: tuple[Any, ...] | None = None
        self._active_path: Path | None = None
        self._active_document: dict[str, Any] | None = None

    @staticmethod
    def _key(identity: dict[str, Any]) -> tuple[Any, ...]:
        return tuple(identity[key] for key in ("season", "event_id", "category_id", "session_id"))

    @staticmethod
    def _load(path: Path) -> dict[str, Any]:
        if path.is_symlink():
            raise ArchiveError("Refusing to read a symlink archive")
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError) as err:
            raise ArchiveError(f"Cannot safely load {path.name}") from err
        if (not isinstance(doc, dict) or doc.get("schema_version") != SCHEMA_VERSION
                or not isinstance(doc.get("identity"), dict)
                or not isinstance(doc.get("riders"), dict)):
            raise ArchiveError("Unknown/corrupt archive schema; refusing overwrite")
        return doc

    def _locate(self, identity: dict[str, Any]) -> tuple[Path, dict[str, Any] | None]:
        year_dir = self.root / str(identity["season"])
        if self.root.is_symlink() or year_dir.is_symlink():
            raise ArchiveError("Archive root/year cannot be a symlink")
        if year_dir.exists():
            # Find the same immutable session IDs across renames/restarts.
            for path in sorted(year_dir.glob("*/*.json")):
                if path.is_symlink():
                    raise ArchiveError("Symlink detected within archive directory")
                existing = self._load(path)
                if _same(existing["identity"], identity):
                    return path, existing
        folder = year_dir / _slug(identity["event_name"])
        if folder.is_symlink():
            raise ArchiveError("Archive event directory cannot be a symlink")
        stem = "_".join(_slug(identity[field]) for field in ("event_name", "category", "session"))
        candidate = folder / f"{stem}.json"
        if candidate.exists():
            # A readable naming collision: add a stable identity-specific suffix.
            import hashlib
            tag = hashlib.sha256(repr(self._key(identity)).encode("utf-8")).hexdigest()[:12]
            candidate = folder / f"{stem}_{tag}.json"
            if candidate.exists():
                raise ArchiveError("Unresolved archive filename collision")
        return candidate, None

    @staticmethod
    def _save(path: Path, document: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.is_symlink():
            raise ArchiveError("Refusing to replace symlink archive")
        encoded = (json.dumps(document, ensure_ascii=False, sort_keys=True, indent=2,
                              allow_nan=False) + "\n").encode("utf-8")
        temp_name = None
        try:
            with tempfile.NamedTemporaryFile(mode="wb", prefix=".motogp-", suffix=".tmp",
                                             dir=path.parent, delete=False) as temp:
                temp_name = temp.name
                os.chmod(temp_name, 0o600)
                temp.write(encoded)
                temp.flush()
                os.fsync(temp.fileno())
            os.replace(temp_name, path)
        finally:
            if temp_name and os.path.exists(temp_name):
                os.unlink(temp_name)

    def observe(self, live: dict[str, Any] | None, season_year: int,
                observed_at: datetime | None = None) -> Path | None:
        """Accept only a TV-delay-ready snapshot; persist only meaningful changes.

        Call from hass.async_add_executor_job, never a sensor property. A None
        snapshot/offline feed does not close the previous session.
        """
        if not isinstance(live, dict) or live.get("tv_delay_ready") is not True:
            return None
        identity = _identity(live, season_year)
        status = _text(live.get("session_status_id")).upper()
        if identity is None or status not in STATUSES:
            return None
        riders = live.get("riders")
        if not isinstance(riders, list):
            riders = []
        clock = observed_at or datetime.now(timezone.utc)
        if clock.tzinfo is None or clock.utcoffset() is None:
            raise ValueError("observed_at must be timezone-aware")
        stamp = clock.astimezone(timezone.utc).isoformat()
        with self._lock:
            key = self._key(identity)
            if key != self._active_key:
                path, doc = self._locate(identity)
            else:
                path, doc = self._active_path, self._active_document
            if doc is None and status not in {"I", "S", "F", "C"}:
                return None
            if doc is None and status in {"F", "C"} and not riders:
                return None
            if doc is None:
                doc = {"schema_version": SCHEMA_VERSION, "identity": identity,
                       "first_seen_at": stamp, "updated_at": stamp,
                       "status": status, "ended": status in {"F", "C"},
                       "tv_delay_seconds": live.get("tv_delay_seconds", 0),
                       "riders": {}, "coverage": {"partial": False,
                       "missing_laps_by_rider": {}, "observed_laps": 0}}
                changed = True
            else:
                if not _same(doc["identity"], identity):
                    raise ArchiveError("Session identity collision")
                doc = copy.deepcopy(doc)
                changed = False
            if doc["status"] != status:
                doc["status"] = status
                doc["ended"] = status in {"F", "C"}
                changed = True
            for rider in riders:
                if not isinstance(rider, dict):
                    continue
                rider_id = _text(rider.get("rider_id"))
                try:
                    lap_number = int(rider.get("last_lap"))
                except (TypeError, ValueError):
                    continue
                raw_time = _text(rider.get("last_lap_time"))
                seconds = _lap_seconds(raw_time)
                if not rider_id or lap_number <= 0 or seconds is None:
                    continue
                rec = doc["riders"].setdefault(rider_id, {"number": _text(rider.get("number")),
                    "name": _text(rider.get("surname")) or _text(rider.get("shortname")), "laps": {}})
                number = str(lap_number)
                old = rec["laps"].get(number)
                if old is None or old["seconds"] != seconds:
                    rec["laps"][number] = {"lap": lap_number, "time": raw_time,
                                            "seconds": seconds, "observed_at": stamp}
                    changed = True
            coverage = _coverage(doc["riders"])
            if doc["coverage"] != coverage:
                doc["coverage"] = coverage
                changed = True
            if changed:
                doc["updated_at"] = stamp
                self._save(path, doc)
            self._active_key, self._active_path, self._active_document = key, path, doc
            return path

    def read(self, identity: dict[str, Any], *, no_spoiler: bool) -> dict[str, Any] | None:
        """Restricted internal read: UI exposure needs a separate HA authorization gate."""
        if no_spoiler:
            raise SpoilerHidden("History is hidden while no-spoiler is enabled")
        with self._lock:
            _, document = self._locate(identity)
            return copy.deepcopy(document) if document is not None else None
