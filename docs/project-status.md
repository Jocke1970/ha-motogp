# MotoGP project status — 2026-09-18

## Source and branch truth

- Running HA Python: reviewed customized `motogp_sensor` **v1.0.9**. Its exact 14 source files plus inventory were committed to `dev` in [`0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f); [integrity CI passed](https://github.com/Jocke1970/ha-motogp/actions/runs/35378743131). Nine files match upstream v1.0.9; five are modified (`api.py`, `const.py`, `coordinator.py`, `helpers.py`, `sensor.py`). This is an exact dated snapshot, **not continuous sync or runtime validation**. [Source audit](deployed-python-audit-2026-09-18.md).
- Development/documentation changes on `dev` only; `beta` and `main` not promoted. Source capture and shell-script quarantine did not overwrite the running integration or working legacy HA dashboard.
- Active `/config/packages/motogp_dashboard_mode.yaml` is independently exported, hash-verified and checked in as an exact **reference** on `dev` at [`config/packages/motogp_dashboard_mode.yaml`](../config/packages/motogp_dashboard_mode.yaml). Historical installer overwrites the live YAML and must not be rerun.

## UI

- Separate Card-test JS: [`frontend/ha-motogp-card.js`](../frontend/ha-motogp-card.js), `v0.1.0-dev.3` / `0b493073ef59`, previously observed in HA; old dashboard untouched.
- **File-content discrepancy RESOLVED:** the JS in the HA provenance export (26,122 bytes) differs from GitHub dev (26,123 bytes) **only by GitHub's final LF**. Appending one LF to the exported bytes yields exactly the GitHub blob SHA-1 `fef8e3e4f09d30f01385d6e8417e96ae923cb65d`. No functional source drift, no replacement or build bump needed. [Exact proof](frontend-drift-resolution-2026-09-18.md). **Separate unverified point:** actual browser-loaded resource/cache has not been independently inspected; check before subsequent deployment. Existing polish items include weather placeholders and prestart/session-day presentation.

## Patch provenance and cleanup

- Reviewed the 13-file provenance export: eleven historical patch/install `.sh` scripts, active YAML package and live JS. All ten Python patch feature families appear in the captured 1.0.9 end state; source-presence is not exhaustive runtime verification. [Per-script audit](provenance-cleanup-2026-09-18.md).
- First read-only scan checked 6,618 configuration text files and reported zero references but eight large files skipped; it correctly stopped without movement.
- **Executed on actual HA:** hash-gated [`quarantine_motogp_patches.py`](../scripts/quarantine_motogp_patches.py) with `--apply` verified live snapshot, provenance and eleven script hashes; scanned **6,626** text files including the eight large files in chunks; found **zero filename/wildcard references**. User terminal reported **all eleven scripts moved** to `/config/.motogp_cleanup_quarantine/patch-scripts`, leaving Python, YAML, JS, backups and non-MotoGP scripts untouched. **No permanent deletion.** [Executed runbook](patch-quarantine-runbook-2026-09-18.md).
- User knows of no external cron/add-on caller, but external invocations outside scanned `/config` cannot be conclusively ruled out. Validate normal HA/dashboard and scheduled operation and separately approve any permanent purge after checking quarantined files. The previous seven misplaced/duplicate YAML files remain quarantined under a **different cleanup gate**; user earlier observed no repair warnings, but purge/reference check is still open.

## Historical results and risks

- [`backend/result_archive.py`](../backend/result_archive.py) has fake-API unit tests but is **not connected to HA, persistent Store, service or Card-test UI**. Verify actual older Moto2 FP1 classification using exact event/category/session IDs and publication behavior before claiming history browsing works.
- Source-based risks (not confirmed incidents): postrace next-event may change before schedule refresh; static last-race-results may not be covered by live-only spoiler guard; lap history is in-memory.

## Next gates

1. Validate HA and scheduled workflows after script quarantine. Keep the eleven scripts in quarantine pending a distinct, explicitly approved permanent deletion step.
2. Verify browser-loaded Lovelace resource/cache before the next dev deployment; any future functional frontend changes must have fresh build metadata, tests and rollback. No EOF-newline-only deployment needed.
3. Audit references to the seven previously quarantined YAML files; capture dashboard resource and helper ownership.
4. Integrate and test spoiler-safe historical results on exact verified Python, document install/rollback, and only then consider reviewed `dev → beta → main` promotion.

[Full deployment ledger](deployment-sync-2026-09-18.md) · [Issue #1](https://github.com/Jocke1970/ha-motogp/issues/1).
