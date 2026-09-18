# ha-motogp

Home Assistant companion project for the unofficial [`Liionboy/motogp_sensor`](https://github.com/Liionboy/motogp_sensor) integration. This repository holds experimental frontend code, a version-gated historical upstream patch, backend prototypes and documentation. **It is not yet a complete, reproducible copy of the Home Assistant installation.**

> **Read first:** [Current project status](docs/project-status.md) · [HA ↔ GitHub inventory and handover](docs/deployment-sync-2026-09-18.md) · [Historical results](docs/historical-results.md).

## What is actually running?

| Component | Status as of 2026-09-18 |
| --- | --- |
| Home Assistant Python backend | `Liionboy/motogp_sensor` with local changes, including multicategory `sessions_all`. Exact deployed source, patch set and revision **have not been captured/verified in this repo**. Do not replace it with the old patch. |
| Existing full MotoGP dashboard | User's working legacy dashboard; preserve it. The repository's older WIP YAML files are not a guaranteed export of that dashboard. |
| New JS test card | `frontend/ha-motogp-card.js`, `v0.1.0-dev.3`, build `0b493073ef59`, tested visually in the separate Card-test view. [Install/version instructions](frontend/README.md). |
| Historical results | `backend/result_archive.py` plus unit tests on `dev` only. CI tests use fake API data. **Not wired into HA or the card; historical API availability not yet verified against real old sessions.** |
| Old HA package cleanup | Six misplaced Lovelace YAML packages and one duplicate dashboard-mode package moved to local quarantine, not deleted. User subsequently reported no HA repair warnings. [Details](docs/deployment-sync-2026-09-18.md). |

## Repository map

- [`frontend/`](frontend/) — standalone JS Lovelace test card; version stamp belongs to the distributed JS file.
- [`dashboard/`](dashboard/) — `motogp_custom_card_dev.yaml` for the new card, plus **legacy WIP/reference** YAML. Dashboard configs are not HA `packages`.
- [`backend/`](backend/) — architecture and an isolated historical-results prototype; not a drop-in integration.
- [`scripts/patch_motogp_sensor_v1_0_10.sh`](scripts/patch_motogp_sensor_v1_0_10.sh) — older, version-gated upstream patch, not a complete representation of the deployed multicategory integration.
- [`docs/`](docs/) — status, deployment drift, tests and design decisions.
- [`tests/`](tests/) — frontend and isolated historical-results regression tests.

## Development and rollout rules

Development goes `dev → beta → main`, with actual HA tests and explicit review at each boundary. **Never promote by merely copying files or by assuming the deployed Python matches this repo.** As checked 2026-09-18, `beta` and `main` still point to the same older commit; recent JS and results changes are `dev` only.

Before changing Python: retrieve the exact deployed integration files, compare them to the tracked upstream baseline/patch, record an install/rollback path and test against recorded *real* multicategory payloads. Before changing the frontend: bump the version and embedded build identity and verify the version displayed in the running test card. Do not touch the working legacy dashboard without an explicit migration decision.

**Do not blindly run the old patch or `--force` it against the running HA installation.** The original upstream baseline was v1.0.10, but today's deployed revision has not been reverified. The old install instructions in `docs/local-patch-v1.0.10.md` are historical context, not an instruction to reinstall now.

This is a personal, unofficial project and is not affiliated with MotoGP or its rights holders.
