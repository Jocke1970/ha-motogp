# ha-motogp

Home Assistant companion project for the unofficial [`Liionboy/motogp_sensor`](https://github.com/Liionboy/motogp_sensor) integration. This repo tracks a verified deployed Python source snapshot, standalone JS test card, historical-results prototype, audits and tests. It is **not** an automatically synchronized copy of the entire HA configuration.

**Start here:** [Project status](docs/project-status.md) · [HA ↔ GitHub deployment ledger](docs/deployment-sync-2026-09-18.md) · [Source audit](docs/deployed-python-audit-2026-09-18.md) · [Historical results](docs/historical-results.md).

## Running backend and source capture

The exact 14-file source snapshot exported from `/config/custom_components/motogp_sensor` on 2026-09-18 is now checked into [`backend/deployed/v1.0.9/`](backend/deployed/v1.0.9/) on `dev`, commit [`0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f). The guarded HA script checked that its export still matched live HA source, pushed to dev and verified the remote SHA. [GitHub Actions](https://github.com/Jocke1970/ha-motogp/actions/runs/35378743131) passed source SHA-256, inventory and Python syntax checks. This verifies the **source snapshot**, not runtime behavior or installation of new code.

Installed `manifest.json` declares **1.0.9**; compared with upstream tag `v1.0.9`, nine files are identical and five modified: `api.py`, `const.py`, `coordinator.py`, `helpers.py`, `sensor.py`. The captured code contains multicategory schedule, 5-second active polling, snapshot TV delay, lap history, grid/records and postrace advancement. The old [`scripts/patch_motogp_sensor_v1_0_10.sh`](scripts/patch_motogp_sensor_v1_0_10.sh) is a **historical patch for a different base**: never execute or force it against modified live 1.0.9.

**Remaining provenance:** a separate local `/config/config/motogp_provenance_review.zip` was exported with 13 script files for user review. It has not yet been uploaded, security-reviewed or committed. Do not delete or blindly run/push old scripts until their references, ordering, overlap and rollback are audited. [Issue #1](https://github.com/Jocke1970/ha-motogp/issues/1).

## Other components

- [`frontend/`](frontend/): independent `custom:ha-motogp-card` JavaScript test card, `v0.1.0-dev.3`, embedded build `0b493073ef59`, tested in Card-test. Preserve the separate working legacy dashboard.
- [`dashboard/`](dashboard/): test-card YAML and older **WIP/reference** cards; a Lovelace `type:` card is not an HA package.
- [`backend/result_archive.py`](backend/result_archive.py): uninstalled historic-classification prototype with fake-API tests. Real old Moto2 FP1 verification, HA Store/service and UI selector remain to be done.
- [`scripts/`](scripts/): guarded source-sync/import and patch-export helpers plus the historical v1.0.10 patch.
- [`docs/`](docs/) and [`tests/`](tests/): source and rollout documentation, regression and integrity tests.

## Safe workflow

Develop in `dev`; verify source integrity, runtime behavior, version, rollback and no-spoiler independently; then reviewed promotion `dev → beta → main`. This snapshot capture did **not** change the running HA integration, `beta`, `main` or the legacy dashboard. No scripts or quarantined YAML should be deleted before checking dependencies.

This is a personal unofficial project, not affiliated with MotoGP or its rights holders.