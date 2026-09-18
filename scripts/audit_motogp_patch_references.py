#!/usr/bin/env python3
"""Read-only inventory of former MotoGP patch entry points and references.

Does not execute or move scripts. Scans configuration-readable text in /config;
external cron, add-ons and manual invocations cannot be ruled out.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from pathlib import Path
from zipfile import ZipFile

EXPECTED_ARCHIVE_SHA256 = "578aa3db991656e06f2f1df5dcc735ba995adaf6a6e8268c0f2be8cd709660d8"
SUFFIXES = {".yaml", ".yml", ".sh", ".py", ".json", ".js", ".txt", ".toml", ".cfg", ".conf", ".ini", ".xml"}
SKIP_DIRS = {".ha-git", ".git", ".storage", ".motogp_cleanup_quarantine", "__pycache__", "node_modules", ".venv", "venv"}
MAX_FILE_SIZE = 2_000_000


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/config"), help="HA configuration root")
    args = parser.parse_args()
    root = args.root.resolve(strict=True)
    candidates = [root / "config" / "motogp_provenance_review.zip", root / "motogp_provenance_review.zip"]
    archives = [p for p in candidates if p.is_file() and not p.is_symlink()]
    if len(archives) != 1:
        raise ValueError(f"Expected exactly one provenance ZIP; found {len(archives)}")
    archive = archives[0]
    if digest(archive.read_bytes()) != EXPECTED_ARCHIVE_SHA256:
        raise ValueError("Provenance ZIP differs from reviewed capture; STOP")
    with ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError("ZIP integrity failure")
        metadata = json.loads(z.read("REVIEW_METADATA.json"))
        expected = {k.split("/", 1)[1]: v["sha256"] for k, v in metadata["files"].items() if k.startswith("patch-scripts/")}
    if len(expected) != 11:
        raise ValueError("Expected eleven reviewed shell scripts")
    scripts: set[Path] = set()
    for name, checksum in sorted(expected.items()):
        paths = [p for p in (root / name, root / "config" / name) if p.exists() or p.is_symlink()]
        if not paths:
            raise ValueError(f"Patch file absent from both export locations: {name}")
        for path in paths:
            if not path.is_file() or path.is_symlink() or digest(path.read_bytes()) != checksum:
                raise ValueError(f"Patch script differs or is not regular: {path}")
            scripts.add(path)
    name_regex = re.compile(b"|".join(re.escape(name.encode()) for name in sorted(expected, key=len, reverse=True)))
    wildcard_regex = re.compile(rb"(?:motogp|install_motogp)[^\r\n]{0,70}\*[^\r\n]{0,70}\.sh", re.I)
    hits: list[tuple[Path, int, str]] = []
    skipped: list[Path] = []
    scanned = 0
    for directory, dirs, files in os.walk(root, topdown=True, followlinks=False):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not (Path(directory) / d).is_symlink()]
        for name in files:
            path = Path(directory) / name
            if path in scripts or path.suffix.lower() not in SUFFIXES or path.is_symlink():
                continue
            try:
                if path.stat().st_size > MAX_FILE_SIZE:
                    skipped.append(path)
                    continue
                content = path.read_bytes()
            except OSError:
                skipped.append(path)
                continue
            scanned += 1
            for line_no, line in enumerate(content.splitlines(), 1):
                if name_regex.search(line) or wildcard_regex.search(line):
                    hits.append((path, line_no, "filename" if name_regex.search(line) else "wildcard"))
    print("=== MotoGP patch reference audit – READ ONLY ===")
    print(f"Reviewed source archive: {archive}")
    print(f"Unchanged script copies: {len(scripts)} (11 unique names)")
    print(f"Scanned configuration text files: {scanned}")
    print(f"References/possible invocations: {len(hits)}")
    for path, number, kind in hits:
        print(f"  {path}:{number} ({kind})")
    print(f"Skipped relevant text files: {len(skipped)}")
    for path in skipped:
        print(f"  SKIPPED: {path}")
    if hits or skipped:
        print("RESULT: STOP – review reported references/skipped files before any quarantine.")
    else:
        print("RESULT: no filename references found in scanned /config text files.")
    print("LIMITATION: external add-on jobs, cron and manually run commands are NOT covered.")
    print("NO FILES MODIFIED OR MOVED.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        raise SystemExit(f"STOPP: {exc}")
