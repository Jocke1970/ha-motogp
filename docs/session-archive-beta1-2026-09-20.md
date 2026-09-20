# MotoGP automatic session archive — beta.1

Date: 2026-09-20. Status: **beta installation candidate; first real-world HA exercise is on beta, not dev.** This is a separately scoped overlay on the operator's verified customised upstream `motogp_sensor` v1.0.9, **not** an official HACS 1.0.10 update or a tagged GitHub release.

## Scope

The backend hook consumes ONLY coordinator-exposed `tv_delay_ready=True` snapshots, not unfiltered `raw_live`. A standalone archive module writes atomic JSON per season/event/category/session in `/config/motogp_data/<season>/<event>/`, using official IDs, storing completed laps by rider, retaining prior sessions and recovering existing JSON after Home Assistant restarts. Missing laps are recorded as incomplete; a stopped Home Assistant cannot recover laps never received. Offline feed does not close an active session. The archive is independent of Lovelace being open.

**Excluded from beta.1:** import of earlier Recorder `.jsonl` observations; Replay mode; history display/expanders in Next (no authenticated frontend history API is provided); Moto2/Moto3 standings; upstream HACS ownership/version upgrade. Do not rename observation JSONL into archive JSON. The installed Next `/local/ha-motogp-next.js`, the original HACS JavaScript cards and the existing YAML dashboard are not changed.

## Verified before beta

Read-only host preflight: Python 3.13.5, `/config/custom_components/motogp_sensor` exists; seven target files match pinned audited v1.0.9 git blobs, coordinator blob `87a2a7217dc1e6d748cfcd8b4cd88eda43c5c163`; `session_lap_archive.py` absent. It does NOT prove every other integration file matches. The full beta installer checks all seven selected files again immediately before writing, refuses symlinks and already-existing beta marker/archive module. An immutable archive source commit and archive Git blob are verified at download. Installer code reproduces the CI-built candidate exactly, compiled by Python. The installer retains a pinned backup of the original coordinator and refuses rollback after unexpected changes. Ten archive tests and four installation/rollback regression tests passed; the GitHub Actions candidate equivalence run succeeded: https://github.com/Jocke1970/ha-motogp/actions/runs/35519389974 . No runtime HA install or race-session exercise has happened yet.

Installer source is pinned to commit `c4939f4a8997e526f5846d306161bccdb9a3d8c7`, repository path `scripts/install-session-archive-beta.py`, SHA-256 of this script:

`cac9870556548dafb4b289162bca3f302b890c9653f67d19f1c006567a4bfa34`

Note that this beta document on the `beta` branch points at the immutable, CI-verified source on `dev`; it does NOT merge all development changes into the older beta branch. Releasing under a tag or normal HACS installation requires its own versioned full-package process.

## One-command, read-only download and verification

Run in the **HA terminal**, NOT `source`:

```bash
curl -fsSLo /tmp/install-session-archive-beta.py https://raw.githubusercontent.com/Jocke1970/ha-motogp/c4939f4a8997e526f5846d306161bccdb9a3d8c7/scripts/install-session-archive-beta.py && printf '%s  %s\n' cac9870556548dafb4b289162bca3f302b890c9653f67d19f1c006567a4bfa34 /tmp/install-session-archive-beta.py | sha256sum -c - && python3 /tmp/install-session-archive-beta.py --check
```

The script downloads an additional pinned archive source only for `--check`, but it does not write integration files in that mode. If network unavailable or hashes differ, it stops. If the exact baseline no longer matches (e.g. HACS already upgraded), do not bypass the checks.

## Beta install and rollback (deliberate operator action)

Only after the `--check` command reports `CHECK OK`, install with:

```bash
python3 /tmp/install-session-archive-beta.py --install
```

This modifies exactly `coordinator.py` and adds `session_lap_archive.py` under `/config/custom_components/motogp_sensor/`; it keeps rollback materials at `/config/.motogp_session_beta/` and never touches `/config/motogp_data`, observation files, frontend JS, YAML or manifest. **Restart Home Assistant** after installation to load Python. The manifest still says `1.0.9`, so an automatic HACS update may overwrite the overlay: hold any HACS upgrade until migrating this beta properly. This beta may record no archive data until a qualifying race session arrives; it does not process yesterday's recordings automatically.

To roll back, using the same downloaded script (it checks exact installed blobs):

```bash
python3 /tmp/install-session-archive-beta.py --rollback
```

Restart Home Assistant again. The rollback restores the original coordinator, removes the beta module and its backup folder only after verified file checks, and keeps any collected JSON archives. If a third party modified the integration after beta installation, rollback deliberately refuses to overwrite unknown content: investigate instead of forcing it. Do not remove the rollback directory manually before deciding to restore.

## What to assess during beta

After HA restart, check HA logs for `motogp_sensor` setup/import errors. On the next real session, verify `/config/motogp_data/<year>/<event>/...json` appears only after delay readiness, that it has `schema_version: 1`, correct session IDs and completed lap numbers, and that adjacent sessions get different JSON files. Test no-spoiler visibility separately before exposing any history to frontend. Track startup warmup, TV-delay values 0/>0 seconds, missing laps, red flag, finish, restart during a session, concurrent config entries, read-only disk and unexpected HACS updates as beta findings. First race session is the practical test; do not describe runtime behavior as field-verified until observed.

**Current declaration:** beta source and tests prepared; not installed on operator's Home Assistant by this documentation change, not a tagged GitHub Release and not proven live.