#!/usr/bin/env python3
"""Import/verify the exact, user-reviewed MotoGP integration snapshot (v1.0.9).

This modifies a Git checkout only. It never writes to the running HA integration.
Usage:
  python3 scripts/import_deployed_snapshot.py --archive /config/motogp_source_review.zip \
    --live-dir /config/custom_components/motogp_sensor --write
  python3 scripts/import_deployed_snapshot.py --verify
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
from pathlib import Path
import re
import sys
from zipfile import ZipFile

CAPTURE_ZIP_SHA256 = "da753fc45010da43daaada9c5cf36621c424f36485a12fabd04437a8fc4fef68"
FILES = {
    "__init__.py": "0c86a72c003f9df433a43cb7eb204c52aa107d6364d8faf45ff3b43925fd2f7f",
    "api.py": "6abdc1cd4a4065044fd1728e3ead2a055215c9b62e75d5b7ad4b839f1950e081",
    "binary_sensor.py": "ad1ea722f5cbbf5309ffa66c98d2bb8844cb704f672b24616da9369d69ffa06a",
    "calendar.py": "920924047d1cc37437b95ed41d02a023ed9f8641338aebfbd9f7c2f30ddae352",
    "config_flow.py": "6c3ad99d037b47d3eb85bc49e73f7577469b4b058a0fb25a097bc77a3352fe24",
    "const.py": "a5efe7b6b4691580031216cfb2a3fe3ee1cf488de8934d70fef5e8f76eacf49f",
    "coordinator.py": "bde9df6b349d5a087ee9f8b9d94ea5c520ad9a0ee7b6edf0014c2ed541c4e4ff",
    "device_trigger.py": "184b251fbac76d02b249b9f642af8565fa36e36ae533ed73361660922463f62e",
    "entity.py": "3c74154ab5d421b98db212ecf6e6a384fe7b94745233595adaba8a8c6d7d571f",
    "helpers.py": "71c8a4a392019cec7baf5f0447d0b6a83c6688cac3f787a34b31236470887523",
    "manifest.json": "6f20bf0fba1aad309485eb7b11c5668b7f38b05dd6b701491e8071a5320e071c",
    "select.py": "d5d4ffedce9ea5e4632d4f0bd3ab683aadff114a2ce135765f7feb2c5dfea270",
    "sensor.py": "aa11653b791919f32a72b702b474ce04bbd729494d1e5b74b6bf29f2b5f42862",
    "switch.py": "0609dc11f4d3ad0c216c0a4c79b6da2f78bfb2b98e61b4048ee73c6d2c043e6b",
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def check_source(files: dict[str, bytes], context: str) -> None:
    for name, expected in FILES.items():
        if name not in files or digest(files[name]) != expected:
            raise ValueError(f"{context}: SHA-256 mismatch or missing: {name}")
        if name.endswith(".py"):
            ast.parse(files[name].decode("utf-8"), filename=name)
    manifest = json.loads(files["manifest.json"])
    if manifest.get("domain") != "motogp_sensor" or manifest.get("version") != "1.0.9":
        raise ValueError(f"{context}: unexpected manifest domain or version")


def load_capture(path: Path) -> tuple[dict[str, bytes], bytes]:
    if not path.is_file() or digest(path.read_bytes()) != CAPTURE_ZIP_SHA256:
        raise ValueError("Source ZIP missing or differs from reviewed 2026-09-18 capture")
    with ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise ValueError("ZIP CRC failure")
        expected = {f"motogp_sensor/{name}" for name in FILES} | {"INVENTORY.txt"}
        if set(archive.namelist()) != expected or len(archive.namelist()) != len(expected):
            raise ValueError("ZIP has unexpected files; no extraction performed")
        files = {name: archive.read(f"motogp_sensor/{name}") for name in FILES}
        inventory = archive.read("INVENTORY.txt")
    check_source(files, "Archive")
    text = inventory.decode("utf-8")
    for name, data in files.items():
        line = rf"(?m)^{digest(data)}\s+{len(data)} bytes\s+{re.escape(name)}$"
        if not re.search(line, text):
            raise ValueError(f"Inventory mismatch: {name}")
    return files, inventory


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--write", action="store_true", help="Import into Git checkout without overwriting differing source")
    modes.add_argument("--verify", action="store_true", help="Verify already tracked snapshot without ZIP")
    parser.add_argument("--archive", type=Path, help="Exact reviewed ZIP; required with --write")
    parser.add_argument("--live-dir", type=Path, help="Compare against current running HA Python (read-only)")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    dest = repo / "backend/deployed/v1.0.9"
    source_dir = dest / "custom_components/motogp_sensor"

    if args.verify:
        tracked = {name: (source_dir / name).read_bytes() for name in FILES}
        check_source(tracked, "Committed source")
        inv = dest / "INVENTORY.txt"
        if not inv.is_file():
            raise ValueError("Committed INVENTORY.txt missing")
        text = inv.read_text(encoding="utf-8")
        for name, data in tracked.items():
            if not re.search(rf"(?m)^{digest(data)}\s+{len(data)} bytes\s+{re.escape(name)}$", text):
                raise ValueError(f"Committed inventory mismatch: {name}")
        print("PASS: 14 tracked files and inventory match exported HA snapshot (SHA-256 + Python syntax).")
        return 0

    if args.archive is None:
        parser.error("--write requires --archive")
    files, inventory = load_capture(args.archive)
    if args.live_dir is not None:
        if not args.live_dir.is_dir():
            raise ValueError("--live-dir does not exist; stopped")
        live = {name: (args.live_dir / name).read_bytes() for name in FILES}
        if any(live[name] != files[name] for name in FILES):
            raise ValueError("Live HA source differs from capture. Re-export; no source files were written.")
    targets = {source_dir / name: content for name, content in files.items()}
    targets[dest / "INVENTORY.txt"] = inventory
    for target, content in targets.items():
        if target.exists() and target.read_bytes() != content:
            raise ValueError(f"Refusing to overwrite changed Git file: {target}")
    for target, content in targets.items():
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_bytes(content)
    print("PASS: captured 14 exact files + inventory into Git checkout; running HA untouched.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, SyntaxError, json.JSONDecodeError) as exc:
        sys.exit(f"STOPP: {exc}")
