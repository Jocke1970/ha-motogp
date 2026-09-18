# Audit of HA MotoGP patch provenance — 2026-09-18

**Scope and source:** user-supplied `motogp_provenance_review.zip`, exported 2026-09-18 18:11:43 UTC from HA. ZIP SHA-256 `578aa3db991656e06f2f1df5dcc735ba995adaf6a6e8268c0f2be8cd709660d8`; ZIP CRC and all 13 member SHA-256/byte sizes verified. Contents: 11 historical shell scripts, active `/config/packages/motogp_dashboard_mode.yaml`, exported `/config/www/ha-motogp-card.js`, metadata. The ZIP was reviewed in the conversation, **not committed publicly**; none of the historical scripts were executed during review.

## Patch disposition

| HA script | Purpose / side effect | Captured Python source evidence |
| --- | --- | --- |
| `motogp_grid_records_patch.sh` | Edits four Python files for grid API/records/sensors; writes each separately. | Grid API, refresh and attributes present. |
| `motogp_grid_records_hotfix.sh` | Edits grid URL f-string. | Correct double-brace grid URL present. |
| `motogp_lap_history_patch.sh` | Edits lap-history sensor. | `MOTOGP_LAP_HISTORY_V1` present. |
| `motogp_live_extras_1_4_patch.sh` | Rider fields, status, track/weather. | Corresponding fields and conditions method present. |
| `motogp_multiclass_schedule_patch.sh` | Adds all-category schedule. | `weekend_sessions_all`, `sessions_all`, `schedule_categories` present. |
| `motogp_polling_5s_patch.sh` | Changes live polling. | `LIVE_POLLING_ACTIVE = timedelta(seconds=5)` present. |
| `motogp_postrace_advance_patch.sh` | Advances next event. | `MOTOGP_POSTRACE_ADVANCE_V1` present. |
| `motogp_pulselive_status_codes_patch.sh` | Live/status mapping. | `S` handled as active. |
| `motogp_season_calendar_patch.sh` | Season calendar attribute. | `season_calendar` present. |
| `motogp_tv_delay_patch.sh` | Full-snapshot delay in coordinator/sensor. | `_apply_tv_delay` and delay helper/attributes present. |
| `install_motogp_dashboard_mode_package.sh` | **Unconditionally overwrites** active display-mode YAML. | Generated YAML byte-matches active export. Canonical reference committed as [`config/packages/motogp_dashboard_mode.yaml`](../config/packages/motogp_dashboard_mode.yaml), SHA-256 `ed6c84f274d5b7d3af638012d68b0609e2ec5ff4eeb0cd5dfe2f89c1503cc769`. |

Source-presence checks do not prove flawless runtime behavior. The exact 14-source Python snapshot is tracked in [`backend/deployed/v1.0.9/`](../backend/deployed/v1.0.9/) with passing integrity CI. Do not rerun old patches: multi-file edits are not atomic, and the package installer overwrites working configuration. The repository's separate upstream 1.0.10-gated patch is historical only; **never force it onto customized deployed 1.0.9**.

## Frontend discrepancy — RESOLVED as final newline only

The exported HA JS has 26,122 bytes, Git blob `10f995c8622036beae117ae11c791a682bbeeac1`, and no final LF. GitHub `dev/frontend/ha-motogp-card.js` at source commit `0c66663` has 26,123 bytes, Git blob `fef8e3e4f09d30f01385d6e8417e96ae923cb65d`. Appending **exactly one LF** to exported bytes reproduces GitHub's exact Git blob hash. Both share `v0.1.0-dev.3` and `0b493073ef59`. Thus there is **no functional difference between these two file contents**, and no overwrite or version bump is warranted. [Full proof and remaining browser-cache qualification](frontend-drift-resolution-2026-09-18.md). Browser-loaded JS content still needs independent verification before future deployments.

## Actual HA reference scan and script quarantine — COMPLETED, NOT DELETED

The first host read-only scan checked 6,618 text files: zero references, eight oversized files skipped, STOP as designed. The subsequently executed hash-gated [`quarantine_motogp_patches.py`](../scripts/quarantine_motogp_patches.py) `--apply` verified all 14 live integration sources, the original provenance ZIP and eleven script hashes, checked destination collisions, and scanned **6,626 text files including all eight previously skipped files** in chunks. It reported zero filename/wildcard references and successfully moved **only eleven allowlisted scripts** to `/config/.motogp_cleanup_quarantine/patch-scripts`. Live Python, package, JS, backups, non-MotoGP scripts and provenance ZIP untouched. [Executed runbook](patch-quarantine-runbook-2026-09-18.md).

User knows of no external cron/add-on invocations, but external and manual callers cannot be conclusively excluded by scanning `/config`. No files have been permanently deleted. Before a separate permanent purge, validate HA/dashboard/scheduled behavior, check quarantined contents/hashes and request distinct approval. Seven earlier quarantined YAML files require independent reference/deletion review. The original provenance archive is retained as audit/rollback evidence.
