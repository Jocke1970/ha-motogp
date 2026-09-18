# MotoGP project status — 2026-09-18

## Verified source-sync milestone

The exact source exported from the running Home Assistant integration has been imported to [`backend/deployed/v1.0.9/`](../backend/deployed/v1.0.9/) on `dev` in commit [`0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f). The HA sync command verified the source ZIP, verified it against live Python, committed 14 source files plus `INVENTORY.txt`, pushed and confirmed the remote `dev` commit. GitHub Actions [Deployed Python source integrity](https://github.com/Jocke1970/ha-motogp/actions/runs/35378743131) passed hash/inventory and Python syntax checks on that commit. This is **source capture**, not a code deployment or full runtime test.

The running integration's `manifest.json` is **v1.0.9**. Of its 14 source files, nine match upstream tag `v1.0.9` byte-for-byte; five differ: `api.py`, `const.py`, `coordinator.py`, `helpers.py`, `sensor.py`. The earlier repo patch targets v1.0.10 and must not be applied or forced against the live system. See the [source audit](deployed-python-audit-2026-09-18.md) and [deployment ledger](deployment-sync-2026-09-18.md).

The same HA command reported a *separate*, local `/config/config/motogp_provenance_review.zip` containing **13 old patch/provenance files**, 32,062 bytes; no expected script was missing and its keyword scan found no obvious credential keywords. The contents have **not** been uploaded/reviewed and must **not** be committed or deleted before inspection. The automated keyword scan is not a security audit.

## Branches and ownership

- `dev`: captured Python v1.0.9 source, separate standalone JS frontend, historical results prototype and tests/documentation.
- `beta` and `main`: no promotion or deployment of these changes; original working legacy dashboard preserved.
- The source snapshot is a copy of HA at 2026-09-18 19:24 CEST, not a promise it will auto-sync future edits. No HA source file was changed by capture.

## Frontend status

- Test card: [`frontend/ha-motogp-card.js`](../frontend/ha-motogp-card.js), `v0.1.0-dev.3`, build `0b493073ef59`, observed working separately in Card-test. The old dashboard remains the reference for features not yet ported.
- Open: invalid weather placeholders, manual prestart rider list and optional upcoming-day expansion. Category/session/event identity and no-spoiler behavior must be preserved. See [UI observations](dev-ui-test-observations-2026-09-17.md).
- No new JS build was installed by this Python source sync.

## Backend features captured, not yet revalidated as a new build

The installed source contains `sessions_all`, multicategory schedule and season calendar; five-second active polling; snapshot TV-delay buffer via `input_number.motogp_tv_delay_seconds` (0–300 seconds); in-memory lap history, grid, records, weather and postrace advancement. Potential postrace schedule mismatch, static last-race no-spoiler masking and volatile lap history require targeted tests; these are code-based risks, not proven HA failures.

The separate [`backend/result_archive.py`](../backend/result_archive.py) remains an **uninstalled prototype**, tested with fake API data only. Historic Moto2 FP1 API availability, HA Store integration, no-spoiler response boundary, results service and UI selector remain unverified/unimplemented. [Design](historical-results.md).

## Cleanup and open gates

- **Next:** upload and inspect `motogp_provenance_review.zip`; reconstruct how 13 old scripts produced the captured source, check secrets and live references, document a reproducible install/rollback. No script deletion or blind Git push yet. [Issue #1](https://github.com/Jocke1970/ha-motogp/issues/1).
- Capture the canonical active `/config/packages/motogp_dashboard_mode.yaml` and actual dashboard/resource ownership only when needed; do not introduce a duplicate package or touch the old dashboard.
- Seven obsolete/misplaced HA packages were quarantined, none deleted; the user saw no repair warnings. Dependency audit and explicit purge approval are pending.
- Verify actual historical classification against an older Moto2 FP1; integrate results only after real payload tests, spoiler/restart/race-transition tests and rollback.
- Stage and verify all future changes on `dev` and in HA before reviewed `dev → beta → main` promotion.

**Scope limitation:** GitHub now contains the exact *exported Python source*. It does not yet contain verified patch provenance, a complete HA config/dashboard export, all running frontend assets, or evidence of production tests for the results archive.