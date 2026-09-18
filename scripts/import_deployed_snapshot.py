#!/usr/bin/env python3
"""Verify/extract the reviewed 2026-09-18 HA MotoGP source snapshot.

Source is 6 base64 parts under backend/deployed/v1.0.9/snapshot/.
Run --verify to compare the committed source against the exact uploaded capture.
Run --write only on a clean dev checkout; differing existing files are NEVER overwritten.
Do not execute this script on the live HA installation.
"""
from __future__ import annotations

import argparse
import ast
import base64
import hashlib
import io
import json
import lzma
from pathlib import Path
import re
import tarfile

PART_COUNT = 6
ARCHIVE_SHA256 = "a17d395bfb9705cd9c11c27350e3c084c6297788b54c82acc78bcc6b954f4fad"
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


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_snapshot(root: Path) -> dict[str, bytes]:
    folder = root / "backend/deployed/v1.0.9/snapshot"
    parts = [folder / f"part{i:02d}.b64" for i in range(1, PART_COUNT + 1)]
    encoded = "".join(p.read_text(encoding="ascii").strip() for p in parts)
    compressed = base64.b64decode(encoded, validate=True)
    if sha(compressed) != ARCHIVE_SHA256:
        raise ValueError("Compressed snapshot checksum mismatch: stop, do not write")
    data = lzma.decompress(compressed)
    expected = {"motogp_sensor/" + name for name in FILES} | {"INVENTORY.txt"}
    results: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:") as archive:
        members = archive.getmembers()
        if len(members) != len(expected) or {m.name for m in members} != expected:
            raise ValueError("Snapshot file inventory differs from 14 source files + INVENTORY.txt")
        for member in members:
            if not member.isfile() or member.size > 2_000_000:
                raise ValueError("Unexpected snapshot member type/size")
            results[member.name] = archive.extractfile(member).read()
    inventory = results["INVENTORY.txt"].decode("utf-8")
    for name, expected_hash in FILES.items():
        content = results["motogp_sensor/" + name]
        if sha(content) != expected_hash:
            raise ValueError(f"Wrong SHA-256 for {name}")
        entry = rf"(?m)^{expected_hash}\s+{len(content)} bytes\s+{re.escape(name)}$"
        if not re.search(entry, inventory):
            raise ValueError(f"INVENTORY.txt inconsistent for {name}")
        if name.endswith(".py"):
            ast.parse(content.decode("utf-8"), filename=name)
    manifest = json.loads(results["motogp_sensor/manifest.json"])
    if manifest.get("domain") != "motogp_sensor" or manifest.get("version") != "1.0.9":
        raise ValueError("Unexpected manifest domain/version")
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Extract exact reviewed files into dev checkout")
    parser.add_argument("--verify", action="store_true", help="Verify existing committed source against capture")
    args = parser.parse_args()
    if args.write == args.verify:
        parser.error("Choose exactly one: --write or --verify")
    root = Path(__file__).resolve().parents[1]
    captured = load_snapshot(root)
    target = root / "backend/deployed/v1.0.9"
    destinations = {
        (target / "custom_components" / name).resolve(): content
        for name, content in captured.items()
        if name != "INVENTORY.txt"
        for name in [name.replace("motogp_sensor/", "motogp_sensor/", 1)]
    }
    # Above paths correspond to custom_components/motogp_sensor/<filename>.
    destinations[(target / "INVENTORY.txt").resolve()] = captured["INVENTORY.txt"]
    for path, expected in destinations.items():
        if path.exists() and path.read_bytes() != expected:
            raise ValueError(f"STOP: existing tracked source differs; no overwrite: {path}")
        if args.verify and not path.is_file():
            raise ValueError(f"Missing committed file: {path}")
    if args.write:
        for path, content in destinations.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                path.write_bytes(content)
    print(f"PASS: {len(FILES)} captured source files and INVENTORY, exact SHA-256 match; mode={'write' if args.write else 'verify'}")


if __name__ == "__main__":
    main()
