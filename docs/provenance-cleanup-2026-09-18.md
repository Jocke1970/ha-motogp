# Audit of HA MotoGP patch provenance — 2026-09-18

**Scope and source:** user-supplied `motogp_provenance_review.zip`, exported 2026-09-18 18:11:43 UTC from the running HA host. ZIP SHA-256 `578aa3db991656e06f2f1df5dcc735ba995adaf6a6e8268c0f2be8cd709660d8`. ZIP CRC and all 13 `REVIEW_METADATA.json` member SHA-256/byte sizes verified. Members: **11 shell scripts**, the active `/config/packages/motogp_dashboard_mode.yaml`, the actual `/config/www/ha-motogp-card.js`, and metadata. This ZIP was reviewed in the conversation, **not committed to this public repository**. No scripts in it were executed.

## Patch disposition (not a license to delete yet)

| HA script | Writes / purpose | Evidence in the committed 1.0.9 snapshot |
| --- | --- | --- |
| `motogp_grid_records_patch.sh` | Edits `api.py`, `const.py`, `coordinator.py`, `sensor.py`; grid API, records, refresh and sensor attributes. Writes four files separately after compile checks. | Grid API, refresh function and grid/records sensor attributes present. |
| `motogp_grid_records_hotfix.sh` | Edits `const.py` grid URL f-string. | Correct double-brace event/category URL is present. |
| `motogp_lap_history_patch.sh` | Edits `sensor.py` history/fastest lap. | `MOTOGP_LAP_HISTORY_V1` present. |
| `motogp_live_extras_1_4_patch.sh` | Edits `helpers.py`, `sensor.py`, `coordinator.py`, `const.py` for rider fields, live status, track/weather. | Rider colors/status, track-status codes, conditions method and weather interval present. |
| `motogp_multiclass_schedule_patch.sh` | Edits `coordinator.py` and `sensor.py` for all-category schedules. | `weekend_sessions_all`, `sessions_all` and `schedule_categories` present. |
| `motogp_polling_5s_patch.sh` | Edits `const.py`. | `LIVE_POLLING_ACTIVE = timedelta(seconds=5)` present. |
| `motogp_postrace_advance_patch.sh` | Edits `coordinator.py`; advances next event. | `MOTOGP_POSTRACE_ADVANCE_V1` present. |
| `motogp_pulselive_status_codes_patch.sh` | Edits `const.py`, `coordinator.py` for status mapping. | `S` handled as active in coordinator. |
| `motogp_season_calendar_patch.sh` | Edits `sensor.py`. | `season_calendar` attribute present. |
| `motogp_tv_delay_patch.sh` | Edits `coordinator.py`, `sensor.py` for full-snapshot delay. | `_apply_tv_delay`, helper `input_number.motogp_tv_delay_seconds`, effective-delay attrs present. |
| `install_motogp_dashboard_mode_package.sh` | **Unconditionally overwrites** `/config/packages/motogp_dashboard_mode.yaml`; does not modify `configuration.yaml` but prints package-include guidance. | Generated YAML matches the active exported package exactly. Exact package now tracked at [`config/packages/motogp_dashboard_mode.yaml`](../config/packages/motogp_dashboard_mode.yaml), commit `5913ea0`; SHA-256 `ed6c84f274d5b7d3af638012d68b0609e2ec5ff4eeb0cd5dfe2f89c1503cc769`. This is a reference copy, **not** a second active HA package. |

These are *source-presence checks*, not a reconstruction of execution order, a guarantee that every patch operation is harmless or a complete HA runtime test. The full fourteen-file live Python snapshot and inventory are already tracked in [`backend/deployed/v1.0.9/`](../backend/deployed/v1.0.9/), source commit `0c66663`, with passing source-integrity CI. Do **not** rerun these old patch scripts; in particular multi-file patches are not transactionally installed and the package installer will overwrite the currently working YAML. Retain the upstream v1.0.10-gated repo patch only as clearly labeled historical material, never force onto deployed 1.0.9.

## JS DRIFT — open and independent of shell-script cleanup

The export reads the actual `/config/www/ha-motogp-card.js`. Its Git blob hash is `10f995c8622036beae117ae11c791a682bbeeac1`; the source at GitHub `dev/frontend/ha-motogp-card.js` has blob `fef8e3e4f09d30f01385d6e8417e96ae923cb65d`. Both embed `v0.1.0-dev.3`, build ID `0b493073ef59` and the same source-commit metadata. **Bytes differ despite identical displayed build metadata.** The exact diff, actual browser-loaded JS file and whether difference is functional remain unverified. Do not overwrite the HA JS or assume GitHub is a complete frontend mirror; compare/diff it as a separate task and issue a new explicit build if needed.

## Actual HA reference audit and quarantine gate

The user ran the read-only [`audit_motogp_patch_references.py`](../scripts/audit_motogp_patch_references.py) on HA: **11 unchanged scripts**, **6,618 configuration text files scanned**, **zero potential invocations**, **eight files skipped** because of its 2 MB limit (seven EPG XML files and `custom-brand-icons.js`). It correctly printed STOP rather than moving files. This does not establish that the eight contain no reference, nor that external cron/add-on jobs do not invoke the scripts.

A new hash-pinned, **reversible** [`quarantine_motogp_patches.py`](../scripts/quarantine_motogp_patches.py) checks the source ZIP against all 14 live integration files, all 11 patch hashes/provenance, destination collisions, and scans even large /config text files in 1 MB chunks. Default is read-only; only `--apply` moves the eleven exact scripts to `/config/.motogp_cleanup_quarantine/patch-scripts/`. It never changes live integration, active package, JS or non-MotoGP scripts. Synthetic tests covered dry run, reference in a large file, collision, successful eleven-file move and repeated-run stop. See the [runbook](patch-quarantine-runbook-2026-09-18.md) for exact scope, checks, remaining external-job limitation and rollback. **Not yet run against the real HA host. No files permanently deleted.**

- Static scan of exported 11 scripts identified file writes to the MotoGP Python files and unconditional package-file overwrite; no download, automatic reboot, `rm -rf` or obvious literal secret assignment found. Exporter keyword scan had zero alerts; neither scan is a comprehensive credential audit. Do not publish unreviewed script contents.
- Existing seven quarantined YAML files are a separate cleanup requiring their own dependency check. A frontend JS drift investigation is also separate.

**Current state:** actual Python snapshot and active package reference tracked, patch provenance reviewed, host's first read-only scan performed, stronger gated script ready but not yet applied. Keep `beta`, `main`, legacy dashboard and running integration unchanged; do not delete quarantined files until individually verified.
