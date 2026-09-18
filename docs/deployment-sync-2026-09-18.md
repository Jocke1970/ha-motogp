# Home Assistant ↔ GitHub deployment inventory — 2026-09-18

This ledger distinguishes verified installed files, GitHub source, prototypes and gaps. GitHub does not automatically sync with `/config` on the HA host.

## Source capture: verified and committed

On 2026-09-18 19:24 CEST, the user exported and uploaded `motogp_source_review.zip`: 28,424 bytes, 13 Python files plus `manifest.json` and `INVENTORY.txt`. ZIP integrity, all inventory SHA-256 checks and Python syntax checks passed; the installed manifest reports **v1.0.9**. Exact Git object comparison against upstream tag `v1.0.9` found nine identical files and five local changes: `api.py`, `const.py`, `coordinator.py`, `helpers.py`, `sensor.py`. See [full audit and hashes](deployed-python-audit-2026-09-18.md).

The [guarded HA sync script](../scripts/sync_deployed_to_dev.sh) validated the reviewed ZIP against live HA sources, wrote the 14 files and inventory **only to a temporary Git checkout**, committed and pushed them to `dev` at [`0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f). The user confirmed `GITHUB DEV VERIFIERAD`, and the GitHub branch was independently checked at the same SHA. [Deployed Python source integrity CI](https://github.com/Jocke1970/ha-motogp/actions/runs/35378743131) passed verification of source hashes, inventory and syntax. The source is at [`backend/deployed/v1.0.9/`](../backend/deployed/v1.0.9/). **No running HA integration files were changed.** The snapshot captures the code at the time of export; future edits will not auto-sync.

The old repository `scripts/patch_motogp_sensor_v1_0_10.sh` is historical and version-gated to upstream 1.0.10. **Do not apply or force it** against this modified live 1.0.9 installation.

## Remaining patch provenance — not yet reviewed

The same script exported `/config/config/motogp_provenance_review.zip` with **13 old script/provenance files, 32,062 bytes**. No expected patch scripts were missing and its automated filename/line keyword scan reported no potential secrets. This is not a security review. The archive has not been uploaded or reviewed; **do not push its contents to public GitHub, execute the scripts, or delete the originals yet**. Once uploaded: audit patch ordering, differences against committed final Python, any secrets and live references; document reproducible install/rollback; then explicitly decide which `.sh` files can be quarantined and ultimately deleted. Do not delete non-MotoGP scripts.

## Deployment ledger

| Component | HA state | GitHub `dev` state | Remaining gap |
| --- | --- | --- | --- |
| Python `motogp_sensor` | Modified v1.0.9, export verified at 19:24 CEST | Exact 14 files and inventory at commit `0c66663` | Reconcile 13 patch scripts and safe install/rollback; real runtime tests not implied by syntax CI. |
| JS Card-test | Existing separate test card seen with build footer and multicategory schedule | `frontend/ha-motogp-card.js` v0.1.0-dev.3 / build `0b493073ef59` | Verify deployed JS file hash and finish UI issues without touching legacy view. |
| Legacy dashboard | Existing working dashboard | `dashboard/*_wip.yaml` are references, not an authoritative export | Capture separately before any migration. |
| Dashboard-mode package | Active `/config/packages/motogp_dashboard_mode.yaml` | No canonical active HA package tracked | Audit helpers/references if bringing into GitHub; never create duplicate package. |
| Historical results | No installed persistent old-session result browser | Isolated `backend/result_archive.py` and tests (fake API) | Verify a real old Moto2 FP1, integrate Store/service, spoiler boundary, restart tests and UI. |
| TV delay, multicategory, history, grid | Present in captured source; 5 s active polling and TV delay up to 300 s | Included in exact snapshot, not fully represented by old v1.0.10 patch | Establish reproducible deployment and regression tests. |

## Package cleanup — quarantined, not deleted

Six old Lovelace YAML card files mistakenly placed under `/config/packages` were moved to `/config/.motogp_cleanup_quarantine`: `00_motogp_complete_stack.yaml`, `01_motogp_header.yaml`, `02_motogp_schedule_with_selector.yaml`, `03_motogp_status_grid.yaml`, `04_motogp_live_timing.yaml`, `05_motogp_results_vm_expander.yaml`. The duplicate `motogp_dashboard_mode_package.yaml` (identical apart from trailing blank line) was moved to its `packages/` subdirectory, preserving `/config/packages/motogp_dashboard_mode.yaml`. **Seven files quarantined, none deleted.** User reported no HA repair warnings; complete config-check output and reference audit were not recorded. Purge only after dependency/rollback review. `.ha-git` copies are backups, not active packages.

## Next controlled milestones

1. Receive and review the separate 13-script provenance ZIP; check for secrets, patch overlap, references, reproducibility and rollback; document before removing old scripts.
2. Verify official historical classification for an old Moto2 FP1 using exact event/category/session IDs; test real response shapes and availability.
3. Connect `ResultArchive` to captured source with HA Store and safe service/API, enforce no-spoiler at retrieval and display, and test restart and race transitions.
4. Finish known JS polish with a new stamped dev build, test in Card-test; retain working legacy dashboard.
5. Promote only after verified behavior and rollback through reviewed `dev → beta → main`; never blindly overwrite the running integration.

Track open work in [issue #1](https://github.com/Jocke1970/ha-motogp/issues/1).