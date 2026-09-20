# HACS beta installation, upgrade and rollback — `v1.0.9.1b1`

**Updated 2026-09-21.** This is an independent derived integration based on Liionboy/motogp_sensor, not an upstream/official MotoGP release. The operator reported the beta installed on 2026-09-20, but **live archive writes have not yet been verified on the actual host**. Read the [current status](project-status.md) and [release notes](hacs-beta-release-notes.md) before deciding to change a running installation.

## Package boundary

- Complete Python integration: `custom_components/motogp_sensor/`, same domain as the existing HA integration. **Replacement, not a parallel integration.** Contains the tested archive hook and `session_lap_archive.py`; manifest version `1.0.9.1b1`.
- Session JSON data: `/config/motogp_data/`, outside the HACS-owned integration directory. Keep that directory across integration updates/rollbacks; no new directory is necessarily created until a suitable live snapshot arrives.
- Previously captured `motogp-lap-observations-*.jsonl` is distinct data, **not** archive JSON; there is no importer or automatic replay.
- Independent `/config/www/ha-motogp-next.js` exposed as `/local/ha-motogp-next.js` is not managed by this backend release. Do not add a second Lovelace JS resource or replace the working legacy dashboard/YAML.

## First-time migration from the upstream HACS repository

1. Make a **full Home Assistant backup**, including a copy of existing `/config/custom_components/motogp_sensor/` for fallback. Preserve `motogp_data`, existing `.jsonl` and independent frontend outside the integration directory.
2. In **HACS**, use **Remove** on the *old upstream repository* (`Liionboy/motogp_sensor`), not the HA integration entry under **Settings > Devices & services**. Do not restart between removing the old downloaded code and obtaining the replacement. If HACS reports duplicates/removal errors, stop rather than editing `.storage` or deleting the HA config entry.
3. In HACS `⋮ > Custom repositories`, add `https://github.com/Jocke1970/ha-motogp` as **Integration**.
4. Find **MotoGP Sensor (ha-motogp beta)**, choose **Download**, select tagged prerelease **`v1.0.9.1b1`** explicitly. Do not choose an unspecified branch, an arbitrary commit (`ba28f5e`), or the legacy `1.0.10` patch. Stop if the tag is unavailable.
5. Confirm `custom_components/motogp_sensor/manifest.json` version `1.0.9.1b1` and the presence of `session_lap_archive.py` if using file access. Restart Home Assistant **once** after installing Python files.
6. Check existing MotoGP entities, original dashboard, and HA logs for `motogp_sensor` setup/import errors. Archive creation cannot be confirmed without a qualifying real session; checking entity availability alone is insufficient.

**Do not run** the old `scripts/install-session-archive-beta.py` overlay or `scripts/patch_motogp_sensor_v1_0_10.sh` over the HACS version. Do not use HA's 'Delete/Remove integration' under Devices & services for this code-source migration.

## Beta/prerelease version selection — observed on this host

The user's first HACS update-entity report read `installed_version=v1.0.9.1b1`, `auto_update=false`, `latest_version=ba28f5e`, `skipped_version=ba28f5e`. `ba28f5e` is the initial HACS-compatible **main branch commit**, not another tagged beta release. The user enabled the separate HACS **Pre-release** switch for the *ha-motogp beta* repository; the HACS download dialog and repository badge then showed `v1.0.9.1b1` correctly. **No post-toggle `latest_version` attribute was supplied**, so that particular field's final state is not confirmed.

For subsequent tagged beta updates, keep the repository Pre-release switch on if prereleases should be considered and choose an explicitly tagged version. `auto_update=false` controls unattended installation and can remain off. If HACS proposes only a commit SHA rather than the intended tag, **do not press Update**; verify the current release selection first. A docs-only `main`/`beta` commit is not a new software release. Do not clear skipped versions merely to make a mismatched commit installable.

## Read-only acceptance after first qualifying live session

1. Check HA logs for archive errors and read-only inspect `/config/motogp_data/<year>/<event>/*.json`: file created, valid `schema_version: 1`, correct IDs and rider completed laps.
2. Compare snapshots with intended TV delay; user currently chose **0 seconds**. Do not silently change it. No claim of complete coverage is possible if HA/polling missed laps.
3. Across later sessions, verify separate files, correct end states, no duplication or corruption, and restart recovery when practical. Red-flag and failed-disk paths remain additional beta tests. No history is exposed in Next until an authenticated/spoiler-safe read API is separately implemented.

The last race of 2026-09-20 was the final session of that weekend; the prior manual JSONL capture was made before field validation of this HACS archive. Do not call it a successfully archived beta race.

## Rollback

**Preferred:** restore the full HA backup if the migration is broken. Alternatively, remove this beta **from HACS**, restore/download the original upstream repository and the audited original integration files as appropriate, then restart HA. Never delete the MotoGP config entry in HA merely to change code sources. Preserve `/config/motogp_data`, separate observation JSONL and frontend. If a previous overlay left `.motogp_session_beta/current.json`, **stop** and use the documented pinned rollback before layering HACS; do not remove rollback metadata by hand or force an unknown baseline.

[Latest doc-sync and unverified items](doc-sync-2026-09-21.md) · [Current status](project-status.md) · [GitHub prerelease](https://github.com/Jocke1970/ha-motogp/releases/tag/v1.0.9.1b1).
