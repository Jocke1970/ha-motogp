#!/usr/bin/env python3
"""Read-only MotoGP backend release preflight for a Home Assistant config tree.

No network, file edits, imports of HA, or access to tokens. Reports compatibility
rather than guessing which running integration can safely be overwritten.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import sys
from pathlib import Path

BASELINE_COORDINATOR_BLOB = "87a2a7217dc1e6d748cfcd8b4cd88eda43c5c163"
KNOWN_ARCHIVE_BLOB = "f20ceb90348ff124bdbc049faff4e0d90cf6b8b0"
NAMES = ("coordinator.py", "__init__.py", "helpers.py", "sensor.py", "api.py", "manifest.json", "const.py", "session_lap_archive.py")


def blob(path: Path) -> str:
    data = path.read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def report(config: Path) -> int:
    print("=== MotoGP backend release preflight (read-only) ===")
    print("Python:", sys.version.split()[0])
    print("HA config:", config)
    integration = config / "custom_components" / "motogp_sensor"
    print("Integration exists:", integration.is_dir())
    if integration.is_symlink():
        print("STOP: integration is a symlink; manual review required")
        return 2
    if not integration.is_dir():
        print("STOP: motogp_sensor integration not found in this config root")
        return 2
    observed = {}
    for name in NAMES:
        path = integration / name
        if path.is_symlink():
            print("STOP:", name, "is a symlink")
            return 2
        if path.is_file():
            try:
                observed[name] = blob(path)
                print(f"CODE {name}: bytes={path.stat().st_size} git_blob={observed[name]}")
            except OSError as err:
                print(f"STOP: unable to inspect {name}: {type(err).__name__}")
                return 2
        else:
            print(f"CODE {name}: NOT PRESENT")
    if observed.get("coordinator.py") == BASELINE_COORDINATOR_BLOB:
        print("COORDINATOR: matches the pinned unmodified v1.0.9 repository baseline")
    else:
        print("COORDINATOR: differs from pinned baseline; DO NOT INSTALL old candidate")
    if "session_lap_archive.py" in observed:
        print("ARCHIVE MODULE:", "matches prototype" if observed["session_lap_archive.py"] == KNOWN_ARCHIVE_BLOB else "differs from prototype")

    root = config / "motogp_data"
    if root.is_symlink():
        print("STOP: motogp_data is a symlink")
        return 2
    print("Archive directory exists:", root.is_dir())
    archive_count = 0
    replay_count = 0
    if root.is_dir():
        for path in sorted(root.rglob("*")):
            if path.is_symlink():
                print("STOP: symlink under motogp_data:", path.relative_to(config))
                return 2
            if not path.is_file():
                continue
            rel = path.relative_to(config)
            if path.suffix == ".json":
                archive_count += 1
                try:
                    doc = json.loads(path.read_text(encoding="utf-8"))
                    good = (isinstance(doc, dict) and doc.get("schema_version") == 1
                            and isinstance(doc.get("identity"), dict)
                            and isinstance(doc.get("riders"), dict))
                    print("ARCHIVE", rel, "VALID_SCHEMA" if good else "INVALID_SCHEMA")
                except (OSError, ValueError, UnicodeError):
                    print("ARCHIVE", rel, "UNREADABLE_OR_INVALID")
            elif path.suffix == ".jsonl":
                replay_count += 1
                try:
                    counts = collections.Counter()
                    with path.open(encoding="utf-8") as stream:
                        for line in stream:
                            if line.strip():
                                row = json.loads(line)
                                counts[str(row.get("kind", "unknown"))] += 1
                    print("OBSERVATION_ONLY", rel, "counts=" + json.dumps(dict(counts), sort_keys=True))
                except (OSError, ValueError, UnicodeError, AttributeError):
                    print("OBSERVATION_ONLY", rel, "UNREADABLE_OR_INVALID")
            else:
                print("OTHER_DATA_FILE", rel)
    print("ARCHIVE_FILES:", archive_count, "OBSERVATION_FILES:", replay_count)
    loose = list(config.glob("motogp-lap-observations-*.jsonl"))
    loose += list((config / "config").glob("motogp-lap-observations-*.jsonl")) if (config / "config").is_dir() else []
    for path in loose:
        print("OBSERVATION_OUTSIDE_ARCHIVE:", path.relative_to(config))
    print("VERDICT:", "BASELINE_MATCH_REVIEW_STILL_REQUIRED" if observed.get("coordinator.py") == BASELINE_COORDINATOR_BLOB else "INSTALLED_CODE_MUST_BE_REBASED")
    print("No files modified. Observation JSONL must not be renamed to an archive JSON.")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--config", type=Path, default=Path("/config"), help="HA config directory")
    args = p.parse_args()
    try:
        return report(args.config)
    except OSError as err:
        print("STOP: preflight cannot read config:", type(err).__name__, str(err))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
