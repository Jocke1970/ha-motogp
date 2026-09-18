# ha-motogp

Unofficial Home Assistant companion project based on [`Liionboy/motogp_sensor`](https://github.com/Liionboy/motogp_sensor). **Source of truth is the reviewed `dev` branch, not ad-hoc patch scripts in `/config`.** This is not yet a fully tested deployable release; do not blindly replace the running HA integration or promote to `beta`/`main`.

> **Read first:** [Project status](docs/project-status.md) · [HA ↔ GitHub inventory](docs/deployment-sync-2026-09-18.md) · [Python source audit](docs/deployed-python-audit-2026-09-18.md) · [Patch cleanup audit](docs/provenance-cleanup-2026-09-18.md) · [Frontend newline proof](docs/frontend-drift-resolution-2026-09-18.md) · [Historical results](docs/historical-results.md).

## Current components

| Component | Verified status |
| --- | --- |
| Python backend | Exact installed customized `motogp_sensor` v1.0.9 snapshot, 14 source files + inventory, checked into [`backend/deployed/v1.0.9`](backend/deployed/v1.0.9/) on `dev` in [commit `0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f); hash/syntax [CI passed](https://github.com/Jocke1970/ha-motogp/actions/runs/35378743131). Nine files matched upstream v1.0.9 and five were customized. Snapshot is not an install instruction. |
| Package | Exact active `/config/packages/motogp_dashboard_mode.yaml` now tracked as [`config/packages/motogp_dashboard_mode.yaml`](config/packages/motogp_dashboard_mode.yaml). Repo file is a reference, **not another active HA package**. Do not rerun the old installer that overwrites the file. |
| Legacy dashboard | Existing working HA dashboard must be preserved. Old `dashboard/*_wip.yaml` are references, not a guaranteed current export. |
| JS Card-test | Independent `frontend/ha-motogp-card.js` v0.1.0-dev.3 with embedded build ID `0b493073ef59`. The exported HA `/config/www` JS is identical to GitHub **except for a missing final LF**: adding one LF to the 26,122-byte export gives exactly the 26,123-byte GitHub blob hash. No functional source drift or replacement needed. Browser-loaded resource/cache still awaits independent validation. [Proof](docs/frontend-drift-resolution-2026-09-18.md). |
| Eleven historical `.sh` patches | Provenance inspected; all eleven exact scripts were **moved to `/config/.motogp_cleanup_quarantine/patch-scripts`**, following a hash-gated host scan of 6,626 config files with no filename/wildcard references. They were **not permanently deleted**. External job/manual references cannot be ruled out conclusively. [Executed runbook](docs/patch-quarantine-runbook-2026-09-18.md). |
| Historical session results | Isolated prototype `backend/result_archive.py` and fake-API tests on `dev`; not installed, real older Moto2 FP1 endpoint still unverified. No history UI or archive in running HA yet. |
| Prior YAML cleanup | Six Lovelace cards misplaced under `packages` and a duplicate package moved to HA quarantine; user reported no repair warnings. No permanent deletion until dependency verification. |

## Repository map and development rules

- `backend/deployed/v1.0.9/`: exact audited HA baseline, do not edit when adding new functionality; fork/change reviewed development source separately.
- `config/packages/`: tracked reference for active HA package, not an instruction to duplicate it.
- `frontend/`: separate JS test card with build identity, not the legacy dashboard.
- `dashboard/`: Card-test YAML and old WIP/reference YAML; Lovelace cards are not HA packages.
- `backend/result_archive.py`: uninstalled historical-results prototype, needs real API + HA Store/service/UI integration and spoiler protections.
- `scripts/patch_motogp_sensor_v1_0_10.sh`: historical version-gated patch for upstream 1.0.10. **Never apply or force it onto modified installed 1.0.9.** The prior on-host scripts are quarantined, not active deploy tools.
- `docs/`: current status, provenance, deployment sync, rollback/testing gates.

All new code starts on `dev`, with tests and a documented installed version and rollback, then explicit review and HA validation before `dev → beta → main`. Do not assume that the public repo provides access to the running host. Do not commit whole `/config`, secrets, `.storage`, recorder, backup or unreviewed patch scripts. Do not modify the working legacy dashboard as part of test-card work.

This is a personal project unaffiliated with MotoGP or its rights holders.
