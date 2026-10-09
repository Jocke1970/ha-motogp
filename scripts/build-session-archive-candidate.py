#!/usr/bin/env python3
"""Generate an UNINSTALLED candidate from the immutable audited v1.0.9 source.

Never patch /config or mutate backend/deployed. Inspect current HA source and
approve a separate installation before using the generated candidate.
"""
from __future__ import annotations

import hashlib
import pathlib
import shutil
import sys

BASE_BLOB = '87a2a7217dc1e6d748cfcd8b4cd88eda43c5c163'
ARCHIVE_BLOB = 'f20ceb90348ff124bdbc049faff4e0d90cf6b8b0'


def blob(data: bytes) -> str:
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def replace_one(code: str, before: str, after: str, description: str) -> str:
    if code.count(before) != 1:
        raise SystemExit(f'STOP: ambiguous coordinator anchor: {description}')
    return code.replace(before, after, 1)


def build(repository: pathlib.Path, output: pathlib.Path) -> None:
    baseline = repository / 'backend/deployed/v1.0.9/custom_components/motogp_sensor'
    coordinator = baseline / 'coordinator.py'
    archive = repository / 'backend/session_lap_archive.py'
    if not coordinator.is_file() or coordinator.is_symlink() or not archive.is_file() or archive.is_symlink():
        raise SystemExit('STOP: source files missing or unsafe')
    if blob(coordinator.read_bytes()) != BASE_BLOB or blob(archive.read_bytes()) != ARCHIVE_BLOB:
        raise SystemExit('STOP: sources changed; review/re-pin before building')
    if output.exists():
        raise SystemExit(f'STOP: candidate target already exists: {output}')

    code = coordinator.read_text(encoding='utf-8')
    code = replace_one(code,
        'from .api import MotogpApiClient, MotogpApiError\n',
        'from .api import MotogpApiClient, MotogpApiError\n'
        'from .session_lap_archive import ArchiveError, SessionLapArchive\n',
        'new archive import')
    code = replace_one(code,
        '        self.api = api\n',
        '        self.api = api\n'
        '        # Backend-owned archive: no UI, sensor-property or helper dependency.\n'
        '        self._session_lap_archive = SessionLapArchive(hass.config.path("motogp_data"))\n',
        'archive initialization')
    code = replace_one(code,
        '        # 3. Detect state transitions and fire events\n',
        '        # Archive ONLY a validated, coordinator-exposed TV-delayed sample.\n'
        '        # Do not record raw_live or an unready warm-up sample.\n'
        '        if live is not None and live.get("tv_delay_ready") is True:\n'
        '            season = self.static.get("season")\n'
        '            year = season.get("year") if isinstance(season, dict) else None\n'
        '            if year is not None:\n'
        '                try:\n'
        '                    await self.hass.async_add_executor_job(\n'
        '                        self._session_lap_archive.observe, live, int(year)\n'
        '                    )\n'
        '                except (ArchiveError, OSError, ValueError, TypeError) as err:\n'
        '                    _LOGGER.warning("MotoGP lap archive write failed: %s", err)\n'
        '        # 3. Detect state transitions and fire events\n',
        'archive after TV delay')
    try:
        shutil.copytree(baseline, output, symlinks=False)
        (output / 'coordinator.py').write_text(code, encoding='utf-8')
        shutil.copy2(archive, output / 'session_lap_archive.py')
    except BaseException:
        if output.exists():
            shutil.rmtree(output)
        raise
    print('Candidate generated (NOT installed):', output)
    print('Coordinator blob:', blob((output / 'coordinator.py').read_bytes()))
    print('Archive blob:', blob((output / 'session_lap_archive.py').read_bytes()))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: build-session-archive-candidate.py REPOSITORY_ROOT NEW_OUTPUT_DIRECTORY')
    build(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
