#!/usr/bin/env bash
set -euo pipefail

# MotoGP Sensor v1.0.10 - local Home Assistant patch layer
#
# Usage:
#   bash patch_motogp_sensor_v1_0_10.sh --check
#   bash patch_motogp_sensor_v1_0_10.sh
#   bash patch_motogp_sensor_v1_0_10.sh --base /config/custom_components/motogp_sensor
#
# The script is intentionally version-gated. It refuses to patch another
# upstream version unless --force is explicitly supplied.

python3 - "$@" <<'PY'
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import tempfile

PATCH_NAME = "MotoGP Sensor local patch"
PATCH_REVISION = "2026-09-14-r1"
EXPECTED_VERSION = "1.0.10"


def fail(message: str) -> None:
    raise SystemExit(f"\nSTOPP: {message}\n")


def replace_once(
    text: str,
    *,
    label: str,
    needle: str,
    replacement: str,
    already_marker: str | None = None,
) -> tuple[str, bool]:
    """Replace exactly one expected upstream block, idempotently."""
    if already_marker and already_marker in text:
        return text, False

    count = text.count(needle)
    if count != 1:
        fail(
            f"{label}: förväntade exakt 1 träff men hittade {count}. "
            "Upstream-koden verkar ha ändrats; uppdatera patch-scriptet i stället "
            "för att forcera en osäker textpatch."
        )
    return text.replace(needle, replacement, 1), True


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        fail(f"filen saknas: {path}")


parser = argparse.ArgumentParser(
    description=f"{PATCH_NAME} ({PATCH_REVISION})"
)
parser.add_argument(
    "--base",
    default="/config/custom_components/motogp_sensor",
    help="Sökväg till integrationen (default: /config/custom_components/motogp_sensor)",
)
parser.add_argument(
    "--check",
    action="store_true",
    help="Kontrollera vad som skulle ändras utan att skriva filer.",
)
parser.add_argument(
    "--force",
    action="store_true",
    help="Tillåt annan upstream-version än 1.0.10. Använd endast efter manuell granskning.",
)
args = parser.parse_args()

base = Path(args.base)
paths = {
    "manifest": base / "manifest.json",
    "const": base / "const.py",
    "coordinator": base / "coordinator.py",
    "helpers": base / "helpers.py",
    "sensor": base / "sensor.py",
}

if not base.is_dir():
    fail(f"integrationskatalogen finns inte: {base}")

original = {name: read_text(path) for name, path in paths.items()}

try:
    manifest = json.loads(original["manifest"])
except json.JSONDecodeError as err:
    fail(f"manifest.json är inte giltig JSON: {err}")

version = str(manifest.get("version") or "")
if version != EXPECTED_VERSION and not args.force:
    fail(
        f"installerad upstream-version är {version or 'okänd'}, inte {EXPECTED_VERSION}. "
        "Patchen avbryts med flit. Hämta en patch som är granskad mot den nya versionen."
    )

patched = dict(original)
changed_labels: list[str] = []


# ============================================================================
# 1. Status S = aktiv session
# ============================================================================

patched["const"], changed = replace_once(
    patched["const"],
    label="const.py / SESSION_STATUS_MAP",
    needle='    "R": "Red Flag",\n}',
    replacement='    "R": "Red Flag",\n    "S": "In Progress",\n}',
    already_marker='    "S": "In Progress",',
)
if changed:
    changed_labels.append("const.py: S -> In Progress")


# ============================================================================
# 2. Behåll live-kategori och championship_id från Pulselive
# ============================================================================

needle = (
    '        "session_shortname": head.get("session_shortname") or "",\n'
    '        "session_name": head.get("session_name") or "",\n'
    '        "circuit_name": head.get("circuit_name") or "",\n'
)
replacement = (
    '        "session_shortname": head.get("session_shortname") or "",\n'
    '        "session_name": head.get("session_name") or "",\n'
    '        "category": head.get("category") or "",\n'
    '        "championship_id": str(head.get("championship_id") or ""),\n'
    '        "circuit_name": head.get("circuit_name") or "",\n'
)
patched["helpers"], changed = replace_once(
    patched["helpers"],
    label="helpers.py / live category",
    needle=needle,
    replacement=replacement,
    already_marker='"championship_id": str(head.get("championship_id") or ""),',
)
if changed:
    changed_labels.append("helpers.py: category + championship_id")


# ============================================================================
# 3. Coordinator: extra statisk metadata och sessionslista
# ============================================================================

needle = (
    '            "next_event": None,\n'
    '            "rider_standings": [],\n'
    '            "constructor_standings": [],\n'
    '            "last_race_results": [],\n'
    '            "track_weather": None,\n'
)
replacement = (
    '            "next_event": None,\n'
    '            "category": None,\n'
    '            "category_id": None,\n'
    '            "weekend_sessions": [],\n'
    '            "rider_standings": [],\n'
    '            "constructor_standings": [],\n'
    '            "last_race_results": [],\n'
    '            "track_weather": None,\n'
)
patched["coordinator"], changed = replace_once(
    patched["coordinator"],
    label="coordinator.py / static data",
    needle=needle,
    replacement=replacement,
    already_marker='"weekend_sessions": [],',
)
if changed:
    changed_labels.append("coordinator.py: static category/weekend_sessions")


needle = (
    '        category_uuid = category.get("id") if category else None\n\n'
    '        # Events + calendar\n'
)
replacement = (
    '        category_uuid = category.get("id") if category else None\n'
    '        self.static["category"] = category.get("name") if category else None\n'
    '        self.static["category_id"] = category_uuid\n\n'
    '        # Events + calendar\n'
)
patched["coordinator"], changed = replace_once(
    patched["coordinator"],
    label="coordinator.py / selected category",
    needle=needle,
    replacement=replacement,
    already_marker='self.static["category_id"] = category_uuid',
)
if changed:
    changed_labels.append("coordinator.py: expose selected MotoGP category")


old = 'return live.get("session_status_id") == "I"'
new = 'return live.get("session_status_id") in ("I", "S")'
if new not in patched["coordinator"]:
    if old not in patched["coordinator"]:
        fail("coordinator.py / session_in_progress: upstream-ankaret hittades inte.")
    patched["coordinator"] = patched["coordinator"].replace(old, new, 1)
    changed_labels.append("coordinator.py: S active in session_in_progress")

old = 'active = live_online and live is not None and live.get("session_status_id") == "I"'
new = (
    'active = (\n'
    '            live_online\n'
    '            and live is not None\n'
    '            and live.get("session_status_id") in ("I", "S")\n'
    '        )'
)
if new not in patched["coordinator"]:
    if old not in patched["coordinator"]:
        fail("coordinator.py / active polling: upstream-ankaret hittades inte.")
    patched["coordinator"] = patched["coordinator"].replace(old, new, 1)
    changed_labels.append("coordinator.py: S gets active 10s polling")

old = (
    '                if status_id == "I":\n'
    '                    self._fire_event(EVENT_SESSION_IN_PROGRESS)'
)
new = (
    '                if status_id in ("I", "S"):\n'
    '                    self._fire_event(EVENT_SESSION_IN_PROGRESS)'
)
if new not in patched["coordinator"]:
    if old not in patched["coordinator"]:
        fail("coordinator.py / session event: upstream-ankaret hittades inte.")
    patched["coordinator"] = patched["coordinator"].replace(old, new, 1)
    changed_labels.append("coordinator.py: S fires session_in_progress")


schedule_marker = "# ── Local patch: MotoGP weekend schedule ──"
if schedule_marker not in patched["coordinator"]:
    needle = (
        '        last_event = past[0] if past else None\n\n'
        '        # Weather: from the current weekend if we are inside it, otherwise\n'
    )
    replacement = (
        '        last_event = past[0] if past else None\n\n'
        '        # ── Local patch: MotoGP weekend schedule ──\n'
        '        self.static["weekend_sessions"] = []\n'
        '        schedule_event = self.static.get("next_event")\n\n'
        '        if schedule_event is not None:\n'
        '            try:\n'
        '                schedule_sessions = await self.api.async_get_sessions(\n'
        '                    schedule_event["id"], category_uuid\n'
        '                )\n'
        '            except MotogpApiError as err:\n'
        '                _LOGGER.debug("Weekend schedule sessions failed: %s", err)\n'
        '                schedule_sessions = []\n\n'
        '            normalized_sessions: list[dict[str, Any]] = []\n\n'
        '            for sess in schedule_sessions:\n'
        '                if not isinstance(sess, dict):\n'
        '                    continue\n\n'
        '                session_date = sess.get("date")\n'
        '                if not session_date:\n'
        '                    continue\n\n'
        '                session_type = str(sess.get("type") or "").upper()\n'
        '                session_number = sess.get("number")\n\n'
        '                if session_type == "FP":\n'
        '                    session_name = (\n'
        '                        f"FP{session_number}" if session_number else "Free Practice"\n'
        '                    )\n'
        '                elif session_type == "PR":\n'
        '                    session_name = "Practice"\n'
        '                elif session_type == "Q":\n'
        '                    session_name = (\n'
        '                        f"Q{session_number}" if session_number else "Qualifying"\n'
        '                    )\n'
        '                elif session_type == "SPR":\n'
        '                    session_name = "Sprint"\n'
        '                elif session_type == "RAC":\n'
        '                    session_name = "Race"\n'
        '                elif session_type == "WUP":\n'
        '                    session_name = "Warm Up"\n'
        '                else:\n'
        '                    session_name = (\n'
        '                        str(sess.get("name") or "").strip()\n'
        '                        or session_type\n'
        '                        or "Session"\n'
        '                    )\n\n'
        '                condition = sess.get("condition")\n'
        '                if not isinstance(condition, dict):\n'
        '                    condition = {}\n\n'
        '                normalized_sessions.append(\n'
        '                    {\n'
        '                        "id": sess.get("id"),\n'
        '                        "name": session_name,\n'
        '                        "type": session_type,\n'
        '                        "number": session_number,\n'
        '                        "date": session_date,\n'
        '                        "status": sess.get("status") or "",\n'
        '                        "circuit": sess.get("circuit") or "",\n'
        '                        "track": condition.get("track") or "",\n'
        '                        "air": condition.get("air") or "",\n'
        '                        "ground": condition.get("ground") or "",\n'
        '                        "humidity": condition.get("humidity") or "",\n'
        '                        "weather": condition.get("weather") or "",\n'
        '                    }\n'
        '                )\n\n'
        '            normalized_sessions.sort(\n'
        '                key=lambda item: parse_api_date(item.get("date")) or now\n'
        '            )\n'
        '            self.static["weekend_sessions"] = normalized_sessions\n\n'
        '        # Weather: from the current weekend if we are inside it, otherwise\n'
    )
    if patched["coordinator"].count(needle) != 1:
        fail(
            "coordinator.py / weekend schedule: insättningspunkten hittades inte exakt en gång."
        )
    patched["coordinator"] = patched["coordinator"].replace(needle, replacement, 1)
    changed_labels.append("coordinator.py: MotoGP weekend schedule")


# ============================================================================
# 4. Sensor attributes
# ============================================================================

needle = (
    '    attrs: dict[str, Any] = {\n'
    '        "session_shortname": live.get("session_shortname"),\n'
    '        "session_status_id": live.get("session_status_id"),\n'
    '        "circuit": live.get("circuit_name"),\n'
    '        "event": live.get("event_name"),\n'
    '    }\n'
)
replacement = (
    '    attrs: dict[str, Any] = {\n'
    '        "category": live.get("category"),\n'
    '        "championship_id": live.get("championship_id"),\n'
    '        "session_shortname": live.get("session_shortname"),\n'
    '        "session_status_id": live.get("session_status_id"),\n'
    '        "circuit": live.get("circuit_name"),\n'
    '        "event": live.get("event_name"),\n'
    '    }\n'
)
patched["sensor"], changed = replace_once(
    patched["sensor"],
    label="sensor.py / live attributes",
    needle=needle,
    replacement=replacement,
    already_marker='"championship_id": live.get("championship_id"),',
)
if changed:
    changed_labels.append("sensor.py: live category attributes")


needle = (
    '            attrs["country"] = _event_country(event)\n'
    '            attrs["sponsored_name"] = event.get("sponsored_name")\n'
)
replacement = (
    '            attrs["country"] = _event_country(event)\n'
    '            attrs["sponsored_name"] = event.get("sponsored_name")\n'
    '            attrs["category"] = static.get("category")\n'
    '            attrs["category_id"] = static.get("category_id")\n'
    '            attrs["sessions"] = static.get("weekend_sessions", [])\n'
    '            attrs["session_count"] = len(static.get("weekend_sessions", []))\n'
)
patched["sensor"], changed = replace_once(
    patched["sensor"],
    label="sensor.py / next_race schedule attributes",
    needle=needle,
    replacement=replacement,
    already_marker='attrs["session_count"] = len(static.get("weekend_sessions", []))',
)
if changed:
    changed_labels.append("sensor.py: next_race sessions/category attributes")


# ============================================================================
# Validate ALL outputs before writing anything.
# ============================================================================

for key in ("const", "coordinator", "helpers", "sensor"):
    try:
        compile(patched[key], str(paths[key]), "exec")
    except SyntaxError as err:
        fail(f"{paths[key].name}: syntaxfel efter patch: {err}")

try:
    json.loads(patched["manifest"])
except json.JSONDecodeError as err:
    fail(f"manifest.json blev ogiltig: {err}")

if not changed_labels:
    print(f"{PATCH_NAME} {PATCH_REVISION}")
    print(f"Target: {base}")
    print("Status: redan patchad; inga ändringar behövs.")
    raise SystemExit(0)

print(f"{PATCH_NAME} {PATCH_REVISION}")
print(f"Upstream: {version}")
print(f"Target: {base}")
print()
print("Ändringar:")
for item in changed_labels:
    print(f"  - {item}")

if args.check:
    print()
    print("CHECK ONLY: inga filer skrevs.")
    raise SystemExit(0)


# ============================================================================
# Stage first, then replace. No persistent .bak files.
# ============================================================================

to_write = [
    key for key in ("const", "coordinator", "helpers", "sensor")
    if patched[key] != original[key]
]

with tempfile.TemporaryDirectory(prefix="motogp_patch_") as tmp:
    tmpdir = Path(tmp)
    staged: dict[str, Path] = {}

    for key in to_write:
        staged_path = tmpdir / paths[key].name
        staged_path.write_text(patched[key], encoding="utf-8")
        staged_path.chmod(paths[key].stat().st_mode & 0o777)
        staged[key] = staged_path

    replaced: list[str] = []
    try:
        for key in to_write:
            os.replace(staged[key], paths[key])
            replaced.append(key)
    except Exception as err:
        for key in replaced:
            paths[key].write_text(original[key], encoding="utf-8")
        fail(f"skrivning misslyckades; ändrade filer återställdes: {err}")

print()
print("KLART.")
print("Inga permanenta backupfiler skapades.")
print("Starta om Home Assistant och verifiera sensorerna enligt dokumentationen.")
PY
