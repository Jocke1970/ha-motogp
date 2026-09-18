# ha-motogp

Home Assistant companion project for the unofficial [`Liionboy/motogp_sensor`](https://github.com/Liionboy/motogp_sensor) integration. This repository holds experimental frontend code, a version-gated historical upstream patch, backend prototypes and documentation. **It is not yet a complete, reproducible copy of the running Home Assistant installation.**

> **Read first:** [Project status](docs/project-status.md) · [HA ↔ GitHub inventory](docs/deployment-sync-2026-09-18.md) · [Verified deployed Python audit](docs/deployed-python-audit-2026-09-18.md) · [Historical results](docs/historical-results.md).

## What is actually running?

| Component | Verified or reported state as of 2026-09-18 |
| --- | --- |
| Home Assistant Python backend | User uploaded exact source ZIP; `manifest.json` = **v1.0.9**, 14 files; archive and inventory validated, 13 Python files pass syntax parsing. Compared against upstream tag v1.0.9: **9 exact files, 5 modified** (`api.py`, `const.py`, `coordinator.py`, `helpers.py`, `sensor.py`). The ZIP/source is attached in the conversation and **not yet committed as source here**. Full hashes and features: [audit](docs/deployed-python-audit-2026-09-18.md). |
| Legacy MotoGP dashboard | User's working older dashboard; preserve it. `dashboard/*_wip.yaml` are reference prototypes, not a verified export of that dashboard. |
| New JS test card | `frontend/ha-motogp-card.js`, `v0.1.0-dev.3`, build `0b493073ef59`, observed in separate Card-test; [version/install instructions](frontend/README.md). |
| Historical results | Isolated `backend/result_archive.py` and fake-API unit tests on `dev`. **Not integrated in HA or UI.** Availability of an actual historic Moto2 FP1 classification not yet verified. |
| Package cleanup | Six misplaced Lovelace YAML packages and a duplicate helper package moved to local quarantine, not deleted; user reported no remaining HA repair warnings. [Details](docs/deployment-sync-2026-09-18.md). |

## Repository map

- [`frontend/`](frontend/) — standalone JS Lovelace test card, version stamp in distributed JS.
- [`dashboard/`](dashboard/) — test-card YAML plus **legacy WIP/reference** dashboard YAML. Lovelace cards are not Home Assistant `packages`.
- [`backend/`](backend/) — architecture and isolated historical-results prototype, not a drop-in integration.
- [`scripts/patch_motogp_sensor_v1_0_10.sh`](scripts/patch_motogp_sensor_v1_0_10.sh) — historical patch specifically for upstream 1.0.10; **do not apply or force against running modified 1.0.9**.
- [`docs/`](docs/) — source audit, deployment drift, tests and design.
- [`tests/`](tests/) — frontend and historical-results isolated regression tests.

## Safe development and rollout

Development goes `dev → beta → main`, with actual HA verification, tests and explicit review at each boundary. The five modified Python source files still need to be checked in as a reviewed exact snapshot or reproducible overlay and verified against the [uploaded hashes](docs/deployed-python-audit-2026-09-18.md). Separate HA-side `motogp_*.sh` scripts seen in the file manager are **not in the ZIP** and have not been reviewed. Document integration install/rollback before changing the running files.

The frontend version is independent of the Python backend version. For JS changes, bump version/build identity and inspect the footer in the running Card-test; the cache-busting resource URL alone is not proof. Never overwrite the working legacy dashboard as part of a test. Historical-results integration must validate a real old session, persist by event/category/session IDs and enforce no-spoiler at both backend and UI boundaries.

Track the missing reproducible source and integration work under [issue #1](https://github.com/Jocke1970/ha-motogp/issues/1). `beta` and `main` remain intentionally unpromoted. No current instructions should reinstall or run the old 1.0.10 patch against the captured 1.0.9 deployment.

This is a personal, unofficial project and is not affiliated with MotoGP or its rights holders.
