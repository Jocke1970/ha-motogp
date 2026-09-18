# Home Assistant ↔ GitHub deployment inventory — 2026-09-18

**Verified in this conversation:** The actual installed Python 1.0.9 source ZIP (13 `.py`, `manifest.json`, inventory) was captured from HA, audited and uploaded. Nine of fourteen files match upstream tag `v1.0.9`; five contain local modifications. All fourteen exact source files and the SHA-256 inventory are tracked in [`backend/deployed/v1.0.9`](../backend/deployed/v1.0.9/) on `dev`, source commit [`0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f). [GitHub source-integrity CI passed](https://github.com/Jocke1970/ha-motogp/actions/runs/35378743131). The capture script compared the archive against the then-running files before push, and did not change the HA integration. Subsequent edits on the live HA are not monitored automatically.

## Components and remaining drift

| Component | User-deployed/evidence | GitHub `dev` | Outstanding |
| --- | --- | --- | --- |
| Python integration | Exact source exported 2026-09-18 19:24 Europe/Stockholm, manifest **1.0.9**, 14/14 inventory hash checks, 13/13 syntax parses. Multicategory schedule, 5 s active polling, TV-delay, lap history, weather/grid/records, postrace included. | Exact checked source and inventory, hash CI green. | This is a baseline snapshot, not a tested replacement release. The old 1.0.10-only patch must never be forced onto deployed 1.0.9. |
| Dashboard-mode package | `/config/packages/motogp_dashboard_mode.yaml` is the one retained active copy; duplicate package quarantined previously. | Exact source now tracked at [`config/packages/motogp_dashboard_mode.yaml`](../config/packages/motogp_dashboard_mode.yaml), SHA-256 `ed6c84f274d5b7d3af638012d68b0609e2ec5ff4eeb0cd5dfe2f89c1503cc769`. | Reference copy only; do not install a second package or rerun overwriting installer. Full active YAML references not audited. |
| Actual frontend JS | Provenance export captures `/config/www/ha-motogp-card.js`, Git blob `10f995c8622036beae117ae11c791a682bbeeac1`, embeds `v0.1.0-dev.3` / build `0b493073ef59`. | `frontend/ha-motogp-card.js` has Git blob `fef8e3e4f09d30f01385d6e8417e96ae923cb65d`, same embedded version/build metadata. | **Different bytes with identical version footer.** Actual textual diff, browser-loaded resource and effect are not verified. Do not overwrite HA frontend or assert parity based on version string. |
| Patch provenance | Export ZIP reviewed: eleven historical `.sh` scripts + live package + live JS, 13 files, 32,062 bytes. ZIP/member hashes validated. | Their functions are represented in source and [provenance audit](provenance-cleanup-2026-09-18.md) documents dispositions; old scripts deliberately NOT committed as executable files. Read-only [reference scanner](../scripts/audit_motogp_patch_references.py) available. | Live `/config` callers, external add-on/cron invocations and script cleanup not verified. Do not permanently delete. |
| Historical results | No installed persistent classification archive. | Isolated `backend/result_archive.py` + fake-API tests. | Real older Moto2 FP1 API response, HA Store/service/UI, spoiler/restart and rollback still untested. |
| Legacy dashboard | Working separate dashboard, not exported in full. | Historical WIP dashboard references and separate Card-test YAML. | Preserve legacy; no claim of parity. |

## Old YAML cleanup (separate from patch cleanup)

Six Lovelace YAML files accidentally interpreted as packages and one duplicate display-mode package were moved to `/config/.motogp_cleanup_quarantine` (seven files; none deleted). Retained file is `/config/packages/motogp_dashboard_mode.yaml`. User reported no remaining repair warnings. A comprehensive config dependency scan and final purge verification are still missing. Git backup `.ha-git` copies are not active packages, but should not be mixed into a live reference scan.

## Safe future steps

1. On HA run the read-only patch-reference scan, inspect any hits and outside-HA schedules; **only then** move unchanged eleven scripts into quarantine using an allowlist, collision checks and restore plan. Do not include non-MotoGP scripts, the active package, JS, or source code.
2. Diff the actual `/config/www/ha-motogp-card.js` against GitHub `dev/frontend/ha-motogp-card.js`. Same version string does not mean same content. Resolve with new explicit build ID and Card-test verification.
3. Inspect and document active helpers/dashboard resources and dependencies of the old seven YAML quarantine files before any permanent purge.
4. Test actual older Moto2 FP1 classification identified by event/category/session IDs; then integrate result archive with the baseline, HA Store, no-spoiler boundaries, tests and rollback.
5. Development only on `dev`, explicit review and HA verification before promoting `dev → beta → main`.

See [source audit](deployed-python-audit-2026-09-18.md), [patch provenance audit](provenance-cleanup-2026-09-18.md), [project status](project-status.md), and [Issue #1](https://github.com/Jocke1970/ha-motogp/issues/1). Source capture and documentation are not an automatic HA deployment.
