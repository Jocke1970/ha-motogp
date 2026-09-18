# ha-motogp

Unofficial Home Assistant companion project based on [`Liionboy/motogp_sensor`](https://github.com/Liionboy/motogp_sensor). **Source of truth is the reviewed `dev` branch, not ad-hoc patch scripts in `/config`.** This is not yet a fully tested deployable release; do not blindly replace the running HA integration or promote to `beta`/`main`.

> **Read first:** [Project status](docs/project-status.md) · [HA ↔ GitHub inventory](docs/deployment-sync-2026-09-18.md) · [Python source audit](docs/deployed-python-audit-2026-09-18.md) · [Patch cleanup audit](docs/provenance-cleanup-2026-09-18.md) · [Historical results](docs/historical-results.md).

## Current components

| Component | Verified status |
| --- | --- |
| Python backend | Exact installed customized `motogp_sensor` v1.0.9 snapshot, 14 source files + inventory, checked into [`backend/deployed/v1.0.9`](backend/deployed/v1.0.9/) on `dev` in [commit `0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f); hash/syntax [CI passed](https://github.com/Jocke1970/ha-motogp/actions/runs/35378743131). Nine files matched upstream v1.0.9 and five were customized. Snapshot is not an install instruction. |
| Package | Exact active `/config/packages/motogp_dashboard_mode.yaml` now tracked as [`config/packages/motogp_dashboard_mode.yaml`](config/packages/motogp_dashboard_mode.yaml). Repo file is a reference, **not another active HA package**. Do not rerun the old installer that overwrites the file. |
| Legacy dashboard | Existing working HA dashboard must be preserved. Old `dashboard/*_wip.yaml` are references, not a guaranteed current export. |
| JS Card-test | Independent `frontend/ha-motogp-card.js` v0.1.0-dev.3 with embedded build ID `0b493073ef59`. **Actual HA `/config/www` file has a different Git blob hash despite the same embedded version.** Diff/browser-loaded verification are outstanding; do not overwrite HA JS blindly. [Frontend details](frontend/README.md). |
| Eleven historical `.sh` patches | Contents reviewed from a separate user-uploaded provenance ZIP; ten Python patch feature families are represented in tracked source. They were **not** blindly committed or deleted. [Disposition and safety gates](docs/provenance-cleanup-2026-09-18.md). Use the [read-only reference scanner](scripts/audit_motogp_patch_references.py) before quarantining them. |
| Historical session results | Isolated prototype `backend/result_archive.py` and fake-API tests on `dev`; not installed, real older Moto2 FP1 endpoint still unverified. No history UI or archive in running HA yet. |
| Prior YAML cleanup | Six Lovelace cards misplaced under `packages` and a duplicate package moved to HA quarantine; user reported no repair warnings. No permanent deletion until dependency verification. |

## Repository map and development rules

- `backend/deployed/v1.0.9/`: exact audited HA baseline, do not edit when adding new functionality; fork/change reviewed development source separately.
- `config/packages/`: tracked reference for active HA package, not an instruction to duplicate it.
- `frontend/`: separate JS test card with build identity, not the legacy dashboard.
- `dashboard/`: Card-test YAML and old WIP/reference YAML; Lovelace cards are not HA packages.
- `backend/result_archive.py`: uninstalled historical-results prototype, needs real API + HA Store/service/UI integration and spoiler protections.
- `scripts/patch_motogp_sensor_v1_0_10.sh`: historical version-gated patch for upstream 1.0.10. **Never apply or force it onto modified installed 1.0.9.** `scripts/audit_motogp_patch_references.py` is read-only.
- `docs/`: current status, provenance, deployment sync, rollback/testing gates.

All new code starts on `dev`, with tests and a documented installed version and rollback, then explicit review and HA validation before `dev → beta → main`. Do not assume that the public repo provides access to the running host. Do not commit whole `/config`, secrets, `.storage`, recorder, backup or unreviewed patch scripts. Do not modify the working legacy dashboard as part of test-card work.

This is a personal project unaffiliated with MotoGP or its rights holders.
