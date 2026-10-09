# Deployed Home Assistant baseline — captured 2026-09-18

This folder is the **exact-source snapshot** of the user's running `motogp_sensor` integration as exported on 2026-09-18 19:24 CEST. Manifest version **1.0.9**; it must NOT be mistaken for the older v1.0.10 patch or the separate experimental historical-results module.

Expected after import:

- `custom_components/motogp_sensor/`: **14 complete source files** (13 Python and `manifest.json`), copied byte-for-byte from the reviewed archive. Nine files match upstream `Liionboy/motogp_sensor` tag v1.0.9; five modified locally: `api.py`, `const.py`, `coordinator.py`, `helpers.py`, `sensor.py`.
- `INVENTORY.txt`: exported SHA-256 manifest for the 14 files. Commit only this inventory and source; do NOT commit the ZIP itself or any unrelated `/config` material.

Import from a clean Git checkout using `python3 scripts/import_deployed_snapshot.py --archive PATH_TO_REVIEWED_ZIP --live-dir /config/custom_components/motogp_sensor --write`. The importer pins the original ZIP SHA-256, validates all source hashes, checks the installed copy has not drifted and will not overwrite different tracked files. Verify after import and in CI with `python3 scripts/import_deployed_snapshot.py --verify`.

**This is reference source, not an HA upgrade, replacement package or installable release.** Do not copy it into `/config/custom_components` without a separately tested release and rollback plan. `beta`, `main` and the existing dashboard are unaffected. See [`docs/deployed-python-audit-2026-09-18.md`](../../../docs/deployed-python-audit-2026-09-18.md) for the audit, and GitHub issue #1 for remaining provenance/validation work.

The `/config/motogp_*.sh` patch scripts, dashboard-mode package, web resources and actual Lovelace configuration are **not** in the source ZIP. They require a separately reviewed export; do not mark complete GitHub/HA parity until those are captured, compared, and tracked or explicitly excluded with reasons.
