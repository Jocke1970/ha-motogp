#!/usr/bin/env python3
"""Read-only allowlisted HA export of MotoGP patch provenance and one live package.

Produces a local review ZIP. It NEVER uploads to GitHub and NEVER reads secrets.yaml,
.storage, credentials, recorder, .ha-git, or the cleanup quarantine. Review before sharing.
"""
from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
import re
import sys
from datetime import datetime, timezone
from zipfile import ZipFile, ZIP_DEFLATED

NAMES = (
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
)
ROOT = Path('/config')
ROOTS = (ROOT, ROOT / 'config')
OUT = ROOT / 'config' / 'motogp_provenance_review.zip' if (ROOT / 'config').is_dir() else ROOT / 'motogp_provenance_review.zip'


def main() -> None:
    gathered: dict[str, bytes] = {}
    missing: list[str] = []
    alerts: dict[str, list[int]] = {}
    for name in NAMES:
        candidates = [root / name for root in ROOTS if (root / name).is_file() and not (root / name).is_symlink()]
        if not candidates:
            missing.append(name)
            continue
        contents = [candidate.read_bytes() for candidate in candidates]
        if any(content != contents[0] for content in contents[1:]):
            raise ValueError(f'Different copies of {name} found; review before exporting')
        if len(contents[0]) > 1_000_000:
            raise ValueError(f'Unusually large script: {name}')
        gathered['patch-scripts/' + name] = contents[0]
    package = ROOT / 'packages' / 'motogp_dashboard_mode.yaml'
    if package.is_file() and not package.is_symlink():
        gathered['active-package/motogp_dashboard_mode.yaml'] = package.read_bytes()
    frontend = ROOT / 'www' / 'ha-motogp-card.js'
    if frontend.is_file() and not frontend.is_symlink():
        gathered['frontend/ha-motogp-card.js'] = frontend.read_bytes()
    if not any(key.startswith('patch-scripts/') for key in gathered):
        raise ValueError('No allowlisted MotoGP patch scripts found in /config or /config/config')
    pattern = re.compile(rb'(?i)\b(?:token|password|passwd|secret|api[_-]?key|bearer|authorization)\b')
    for path, content in gathered.items():
        matches = [i for i, line in enumerate(content.splitlines(), 1) if pattern.search(line)]
        if matches:
            alerts[path] = matches
    metadata = {
        'captured_at_utc': datetime.now(timezone.utc).isoformat(),
        'purpose': 'Review only; NOT automatically synced to GitHub or executable',
        'files': {name: {'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()} for name, content in gathered.items()},
        'missing_expected_patch_scripts': missing,
        'potential_secret_keyword_line_numbers': alerts,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    buffer = io.BytesIO()
    with ZipFile(buffer, 'w', ZIP_DEFLATED) as archive:
        for name, content in sorted(gathered.items()):
            archive.writestr(name, content)
        archive.writestr('REVIEW_METADATA.json', json.dumps(metadata, indent=2, ensure_ascii=False) + '\n')
    OUT.write_bytes(buffer.getvalue())
    print(f'PROVENIENS-EXPORT: {OUT} ({len(gathered)} files, {OUT.stat().st_size} bytes)')
    print('Missing expected patch scripts:', ', '.join(missing) if missing else 'none')
    print('Potential secret keywords (filename and line only):', json.dumps(alerts, ensure_ascii=False))
    print('Review the ZIP before uploading; never blindly push scripts or include secrets.yaml.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as error:
        sys.exit(f'STOPP: {error}')
