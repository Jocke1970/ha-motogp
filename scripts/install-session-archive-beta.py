#!/usr/bin/env python3
"""Pinned, fail-closed beta overlay installer for the audited MotoGP 1.0.9 HA integration.

Usage: python3 install-session-archive-beta.py --check|--install|--rollback [--config /config]
Never source this script. No changes to frontend, HACS metadata or observation logs.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import tempfile
import urllib.request

VERSION = "session-archive-beta.1"
SOURCE_COMMIT = "2b092efeb784a4267c699b3a7f242c520cbc92da"
ARCHIVE_BLOB = "f20ceb90348ff124bdbc049faff4e0d90cf6b8b0"
EXPECTED = {
    "coordinator.py": "87a2a7217dc1e6d748cfcd8b4cd88eda43c5c163",
    "__init__.py": "e477b7c0ffa7595a1686e0f0dca05c5cd740e64a",
    "helpers.py": "7235a5b70aaf3e0440d07b00949e482bbdfd7971",
    "sensor.py": "52b12133ff4c6e0e94071faf7425819a9384a455",
    "api.py": "d4dff9a994b1a58083d2f0eb0e8e2e2a23e46ed7",
    "manifest.json": "f671a29a23193a2a1bd023d9d41279ae3fab7655",
    "const.py": "4a5029303f03cd33a11ce8a91f7dfb771481416f",
}
MARKER = ".motogp_session_beta/current.json"


def blob(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def require(condition: bool, why: str) -> None:
    if not condition:
        raise RuntimeError("STOP: " + why)


def safe_file(path: Path) -> bytes:
    require(not path.is_symlink() and path.is_file(), f"missing or symlink file: {path}")
    return path.read_bytes()


def pin_replace(code: str, anchor: str, replacement: str, description: str) -> str:
    require(code.count(anchor) == 1, f"ambiguous patch anchor ({description})")
    return code.replace(anchor, replacement, 1)


def patch(base: bytes) -> bytes:
    code = base.decode("utf-8")
    code = pin_replace(code,
        "from .api import MotogpApiClient, MotogpApiError\n",
        "from .api import MotogpApiClient, MotogpApiError\n"
        "from .session_lap_archive import ArchiveError, SessionLapArchive\n", "import")
    code = pin_replace(code, "        self.api = api\n",
        "        self.api = api\n"
        "        # Backend-owned archive: no UI, sensor-property or helper dependency.\n"
        "        self._session_lap_archive = SessionLapArchive(hass.config.path(\"motogp_data\"))\n", "init")
    code = pin_replace(code, "        # 3. Detect state transitions and fire events\n",
        "        # Archive ONLY a validated, coordinator-exposed TV-delayed sample.\n"
        "        # Do not record raw_live or an unready warm-up sample.\n"
        "        if live is not None and live.get(\"tv_delay_ready\") is True:\n"
        "            season = self.static.get(\"season\")\n"
        "            year = season.get(\"year\") if isinstance(season, dict) else None\n"
        "            if year is not None:\n"
        "                try:\n"
        "                    await self.hass.async_add_executor_job(\n"
        "                        self._session_lap_archive.observe, live, int(year)\n"
        "                    )\n"
        "                except (ArchiveError, OSError, ValueError, TypeError) as err:\n"
        "                    _LOGGER.warning(\"MotoGP lap archive write failed: %s\", err)\n"
        "        # 3. Detect state transitions and fire events\n", "TV-delayed hook")
    result = code.encode("utf-8")
    compile(result, "coordinator.py", "exec")
    return result


def get_module() -> bytes:
    url = ("https://raw.githubusercontent.com/Jocke1970/ha-motogp/" + SOURCE_COMMIT
           + "/backend/session_lap_archive.py")
    with urllib.request.urlopen(url, timeout=25) as response:
        data = response.read(200_000)
    require(blob(data) == ARCHIVE_BLOB, "downloaded archive module does not match pinned Git blob")
    compile(data, "session_lap_archive.py", "exec")
    return data


def atomic(path: Path, data: bytes, mode: int = 0o644) -> None:
    require(not path.is_symlink(), f"refusing symlink: {path}")
    temp = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".motogp-beta-", delete=False) as out:
            temp = Path(out.name)
            out.write(data)
            out.flush()
            os.fsync(out.fileno())
        os.chmod(temp, mode)
        os.replace(temp, path)
    finally:
        if temp is not None and temp.exists():
            temp.unlink()


def prepare(config: Path) -> tuple[Path, dict[str, bytes], bytes, bytes]:
    target = config / "custom_components" / "motogp_sensor"
    require(not config.is_symlink() and not target.is_symlink() and target.is_dir(),
            "HA config/integration missing or symlinked")
    require(not (target / "session_lap_archive.py").exists(), "archive already exists; never overwrite")
    originals = {name: safe_file(target / name) for name in EXPECTED}
    for name, data in originals.items():
        require(blob(data) == EXPECTED[name], f"installed {name} differs from pinned 1.0.9; no files modified")
    root = config / "motogp_data"
    require(not root.is_symlink() and (not root.exists() or root.is_dir()),
            "archive root is symlink or not a directory")
    coordinator = patch(originals["coordinator.py"])
    module = get_module()
    return target, originals, coordinator, module


def install(config: Path, *, check_only: bool) -> None:
    marker = config / MARKER
    require(not marker.exists() and not marker.is_symlink(), "prior beta install/backup marker exists")
    target, originals, candidate, module = prepare(config)
    print("MATCH: seven pinned 1.0.9 files; archive module absent")
    print("Candidate coordinator Git blob:", blob(candidate))
    print("Candidate archive Git blob:", blob(module))
    if check_only:
        print("CHECK OK: no files modified; first install requires --install")
        return
    # Keep exactly one retained backup until an explicit rollback/confirmation.
    backup = marker.parent
    require(not backup.exists() and not backup.is_symlink(), "backup folder already exists")
    backup.mkdir(mode=0o700)
    orig = backup / "coordinator.py.original"
    atomic(orig, originals["coordinator.py"], 0o600)
    record = {"version": VERSION, "original_blob": EXPECTED["coordinator.py"],
              "candidate_blob": blob(candidate), "archive_blob": ARCHIVE_BLOB,
              "original_archive_absent": True, "source_commit": SOURCE_COMMIT}
    atomic(marker, (json.dumps(record, sort_keys=True) + "\n").encode(), 0o600)
    module_path = target / "session_lap_archive.py"
    coordinator_path = target / "coordinator.py"
    # Archive first, then coordinator; neither stage leaves half-written files.
    try:
        atomic(module_path, module)
        atomic(coordinator_path, candidate, stat.S_IMODE(coordinator_path.stat().st_mode))
        require(blob(safe_file(module_path)) == ARCHIVE_BLOB and
                blob(safe_file(coordinator_path)) == blob(candidate), "post-install verification failed")
    except BaseException:
        # Restore only files which still match an expected state.
        if coordinator_path.is_file() and blob(safe_file(coordinator_path)) in (record["candidate_blob"], record["original_blob"]):
            atomic(coordinator_path, originals["coordinator.py"])
        if module_path.is_file() and blob(safe_file(module_path)) == ARCHIVE_BLOB:
            module_path.unlink()
        # Retain the backup/marker if an unexpected installed file prevented a clean recovery.
        if (coordinator_path.is_file() and blob(safe_file(coordinator_path)) == EXPECTED["coordinator.py"]
                and not module_path.exists()):
            marker.unlink()
            orig.unlink()
            backup.rmdir()
        raise
    print("INSTALLED:", VERSION, "; backup retained:", backup)
    print("Restart Home Assistant to load backend; Next frontend untouched.")
    print("Rollback: python3 install-session-archive-beta.py --rollback")


def rollback(config: Path) -> None:
    marker = config / MARKER
    record = json.loads(safe_file(marker).decode("utf-8"))
    require(record.get("version") == VERSION and record.get("original_archive_absent") is True,
            "unknown backup metadata")
    backup = marker.parent
    original = safe_file(backup / "coordinator.py.original")
    require(blob(original) == record["original_blob"] == EXPECTED["coordinator.py"], "backup corrupted")
    target = config / "custom_components" / "motogp_sensor"
    coordinator = target / "coordinator.py"
    module = target / "session_lap_archive.py"
    require(blob(safe_file(coordinator)) == record["candidate_blob"], "coordinator changed since beta install")
    require(blob(safe_file(module)) == record["archive_blob"] == ARCHIVE_BLOB, "archive module changed since beta install")
    atomic(coordinator, original, stat.S_IMODE(coordinator.stat().st_mode))
    module.unlink()
    marker.unlink()
    (backup / "coordinator.py.original").unlink()
    backup.rmdir()
    print("ROLLED BACK: original coordinator restored, beta module removed; beta backup cleaned.")
    print("Restart Home Assistant to load original backend. Existing motogp_data archives preserved.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    options = parser.add_mutually_exclusive_group(required=True)
    options.add_argument("--check", action="store_true")
    options.add_argument("--install", action="store_true")
    options.add_argument("--rollback", action="store_true")
    parser.add_argument("--config", type=Path, default=Path("/config"))
    args = parser.parse_args()
    try:
        if args.rollback:
            rollback(args.config)
        else:
            install(args.config, check_only=args.check)
        return 0
    except (OSError, ValueError, UnicodeError, RuntimeError, SyntaxError, TimeoutError) as err:
        print("FAILED:", str(err))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
