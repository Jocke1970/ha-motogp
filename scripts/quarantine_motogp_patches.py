#!/usr/bin/env python3
"""Hash-gated, reversible retirement of eleven reviewed HA MotoGP patch scripts.

Default: read-only preflight. --apply moves files to one quarantine directory.
Never edits the running integration, active package, frontend or other scripts.
Do not treat this as an audit of cron/add-on jobs outside /config.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from pathlib import Path
from zipfile import ZipFile

ROOT = Path('/config')
PROVENANCE_SHA = '578aa3db991656e06f2f1df5dcc735ba995adaf6a6e8268c0f2be8cd709660d8'
SOURCE_SHA = 'da753fc45010da43daaada9c5cf36621c424f36485a12fabd04437a8fc4fef68'
NAMES = frozenset({
    'install_motogp_dashboard_mode_package.sh',
    'motogp_grid_records_hotfix.sh',
    'motogp_grid_records_patch.sh',
    'motogp_lap_history_patch.sh',
    'motogp_live_extras_1_4_patch.sh',
    'motogp_multiclass_schedule_patch.sh',
    'motogp_polling_5s_patch.sh',
    'motogp_postrace_advance_patch.sh',
    'motogp_pulselive_status_codes_patch.sh',
    'motogp_season_calendar_patch.sh',
    'motogp_tv_delay_patch.sh',
})
SUFFIXES = {'.yaml', '.yml', '.sh', '.py', '.json', '.js', '.txt', '.toml', '.cfg', '.conf', '.ini', '.xml'}
SKIP_DIRS = {'.ha-git', '.git', '.storage', '.motogp_cleanup_quarantine', '__pycache__', 'node_modules', '.venv', 'venv'}
CHUNK = 1024 * 1024


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def reviewed_zip(paths: tuple[Path, ...], sha: str) -> Path:
    found = [p for p in paths if p.exists() or p.is_symlink()]
    if len(found) != 1 or not found[0].is_file() or found[0].is_symlink():
        raise ValueError(f'Expected one regular reviewed ZIP, found {len(found)} among {paths}')
    if digest(found[0].read_bytes()) != sha:
        raise ValueError(f'Reviewed ZIP checksum differs: {found[0]}')
    return found[0]


def verify_live_source() -> None:
    archive = reviewed_zip((ROOT / 'config/motogp_source_review.zip', ROOT / 'motogp_source_review.zip'), SOURCE_SHA)
    live = ROOT / 'custom_components/motogp_sensor'
    if not live.is_dir() or live.is_symlink():
        raise ValueError('Live integration directory is missing or a symlink')
    with ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError('Source ZIP failed CRC check')
        members = [m for m in z.namelist() if m.startswith('motogp_sensor/')]
        if len(members) != 14 or not all(m.count('/') == 1 for m in members):
            raise ValueError('Unexpected source ZIP layout')
        expected_names = {m.split('/')[1] for m in members}
        if len(expected_names) != 14 or 'manifest.json' not in expected_names:
            raise ValueError('Unexpected source file inventory')
        actual_names = {p.name for p in live.iterdir() if p.is_file() and (p.suffix == '.py' or p.name == 'manifest.json')}
        if actual_names != expected_names:
            raise ValueError('Live Python/manifest file inventory differs from capture')
        for m in members:
            path = live / m.split('/')[1]
            if not path.is_file() or path.is_symlink() or digest(path.read_bytes()) != digest(z.read(m)):
                raise ValueError(f'Live source differs from reviewed snapshot: {path}')
        if json.loads(z.read('motogp_sensor/manifest.json')).get('version') != '1.0.9':
            raise ValueError('Source capture does not declare version 1.0.9')


def verify_patches() -> tuple[dict[str, str], list[Path]]:
    archive = reviewed_zip((ROOT / 'config/motogp_provenance_review.zip', ROOT / 'motogp_provenance_review.zip'), PROVENANCE_SHA)
    with ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError('Provenance ZIP failed CRC check')
        metadata = json.loads(z.read('REVIEW_METADATA.json'))
        expected = {k.split('/', 1)[1]: v['sha256'] for k, v in metadata['files'].items() if k.startswith('patch-scripts/')}
        if set(expected) != NAMES:
            raise ValueError('Provenance filenames do not match the fixed 11-file allowlist')
        for name, sha in expected.items():
            if digest(z.read('patch-scripts/' + name)) != sha:
                raise ValueError('Provenance member does not match metadata: ' + name)
    sources = []
    for name, sha in sorted(expected.items()):
        copies = [p for p in (ROOT / name, ROOT / 'config' / name) if p.exists() or p.is_symlink()]
        if len(copies) != 1:
            raise ValueError(f'Expected exactly one copy of {name}, found {len(copies)}')
        p = copies[0]
        if not p.is_file() or p.is_symlink() or digest(p.read_bytes()) != sha:
            raise ValueError(f'Changed or non-regular patch script: {p}')
        sources.append(p)
    return expected, sources


def references(expected: dict[str, str], sources: list[Path]) -> tuple[int, int]:
    exact = re.compile(b'|'.join(re.escape(name.encode()) for name in sorted(expected, key=len, reverse=True)))
    wildcard = re.compile(rb'(?:motogp|install_motogp)[^\r\n]{0,70}\*[^\r\n]{0,70}\.sh', re.I)
    scanned = large = 0
    for directory, dirs, files in os.walk(ROOT, topdown=True, followlinks=False):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not (Path(directory) / d).is_symlink()]
        for name in files:
            path = Path(directory) / name
            if path in sources or path.suffix.lower() not in SUFFIXES or path.is_symlink():
                continue
            try:
                length = path.stat().st_size
                with path.open('rb') as f:
                    if length > 2_000_000:
                        large += 1
                    scanned += 1
                    tail = b''
                    while True:
                        chunk = f.read(CHUNK)
                        if not chunk:
                            break
                        data = tail + chunk
                        if exact.search(data) or wildcard.search(data):
                            raise ValueError(f'Found possible script reference: {path}; no moves made')
                        tail = data[-256:]
            except OSError as exc:
                raise ValueError(f'Unable to fully scan {path}: {exc}') from exc
    return scanned, large


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Move verified scripts after ALL preflight checks')
    args = parser.parse_args()
    if ROOT.resolve() != Path('/config').resolve(strict=True):
        raise ValueError('Unexpected HA root')
    print('1/4 Verifying source snapshot still matches the running integration...', flush=True)
    verify_live_source()
    print('2/4 Verifying the provenance archive and all eleven individual scripts...', flush=True)
    expected, sources = verify_patches()
    quarantine = ROOT / '.motogp_cleanup_quarantine'
    target_dir = quarantine / 'patch-scripts'
    if (quarantine.exists() and (not quarantine.is_dir() or quarantine.is_symlink())) or (target_dir.exists() and (not target_dir.is_dir() or target_dir.is_symlink())):
        raise ValueError('Quarantine directory is not a regular directory')
    for src in sources:
        if (target_dir / src.name).exists() or (target_dir / src.name).is_symlink():
            raise ValueError(f'Quarantine destination collision: {src.name}')
    print('3/4 Scanning text files, including previously skipped >2 MB files in 1 MB chunks...', flush=True)
    scanned, large = references(expected, sources)
    print(f'PASS: {scanned} text files scanned, including {large} large files; zero filename/wildcard references.', flush=True)
    print('CAVEAT: cron/add-ons outside /config and manual commands cannot be verified here.', flush=True)
    if not args.apply:
        print('DRY RUN: no files moved. Run with --apply only to quarantine eleven verified old scripts.')
        return
    print('4/4 Moving ONLY the eleven allowlisted patch scripts to quarantine...', flush=True)
    target_dir.mkdir(parents=True, exist_ok=True)
    moved: list[tuple[Path, Path]] = []
    try:
        for src in sources:
            if digest(src.read_bytes()) != expected[src.name] or (target_dir / src.name).exists():
                raise ValueError(f'Changed source or collision during move: {src.name}')
            target = target_dir / src.name
            shutil.move(str(src), str(target))
            moved.append((src, target))
    except Exception:
        for original, target in reversed(moved):
            if target.exists() and not original.exists():
                shutil.move(str(target), str(original))
        raise
    print(f'KLART: {len(moved)} scripts moved to {target_dir}')
    print('Running integration, active YAML package, JS, backups and non-MotoGP scripts left untouched.')
    print('No permanent deletion; restore is a reverse move after verifying destination hashes.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        sys.exit(f'STOPP: {error}')
