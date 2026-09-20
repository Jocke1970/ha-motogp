# Historical design and installer record — session archive beta.1 (2026-09-20)

> **SUPERSEDED — DO NOT RUN THE OVERLAY INSTALLER.** This document records the pre-HACS patch candidate and the origin of the archive implementation. The **current** deployment is the complete HACS release [`v1.0.9.1b1`](https://github.com/Jocke1970/ha-motogp/releases/tag/v1.0.9.1b1). For installation or recovery, use the [current HACS guide](hacs-beta-installation.md), and for verified/pending state see [project status](project-status.md). The old commands are deliberately omitted here to prevent accidental patching of HACS-managed code.

## Provenance of the retired overlay

- Original goal: add a backend-only per-session archive to the audited local customized `motogp_sensor` v1.0.9 without touching live dashboard, frontend JavaScript or unrelated files. Before HACS packaging it was delivered as an **overlay candidate**, *not* a tagged release.
- Pre-HACS script: `scripts/install-session-archive-beta.py` at pinned development commit `c4939f4a8997e526f5846d306161bccdb9a3d8c7`. Script SHA-256: `cac9870556548dafb4b289162bca3f302b890c9653f67d19f1c006567a4bfa34`. This file remains in repository history for traceability, **not** as an active installation or rollback route for the current HACS beta.
- Pinned original coordinator Git blob: `87a2a7217dc1e6d748cfcd8b4cd88eda43c5c163`; archive source commit `2b092efeb784a4267c699b3a7f242c520cbc92da`; module blob `f20ceb90348ff124bdbc049faff4e0d90cf6b8b0`.
- Original read-only preflight saw Python 3.13.5 and seven selected installed 1.0.9 files matching pinned blobs, no installed `session_lap_archive.py` and no archive JSON. It also saw a separate observation JSONL from the weekend's race. This was **pre-HACS evidence**, not a post-HACS installed-file audit.
- Original overlay CI: archive logic tests and 4 installer/rollback regression tests, pinned candidate/installer byte equivalence, [successful run 35519389974](https://github.com/Jocke1970/ha-motogp/actions/runs/35519389974). Source snapshot is on `dev` under `backend/deployed/v1.0.9/`. The overlay would modify coordinator and add the archive module while retaining a pinned rollback backup; it never ran as the chosen deployment method.
- The complete integration was subsequently packaged under `custom_components/motogp_sensor/` and released as a real HACS prerelease, with [HACS packaging CI run 35528926529](https://github.com/Jocke1970/ha-motogp/actions/runs/35528926529). Initial package commit on `beta`: `a40b9ebe9e5a8cf515e6209f5ff56ebba0dafb5f`; original main package promotion `ba28f5e8f5cc594468f4a7740efa9460da8c077e`.

## Archive's design contract

- Observe **only** coordinator-exposed snapshots with `tv_delay_ready=True`; never bypass the TV buffer by collecting `raw_live` directly. Logger runs in backend independently of browser/card state.
- Identity includes season, event ID, class/category ID and session ID. Record valid finished laps by stable rider ID and lap number, deduplicate observations and preserve corrected observed times. Do not synthesize missing laps.
- Store schema-versioned JSON under `/config/motogp_data/<season>/<event>/` **outside HACS integration files**; safe filenames and atomic writes. A matching existing session file can be resumed after HA restart, but missed source data cannot be reconstructed during HA outages.
- Keep files across pass changes, race weekends and HACS upgrades. Offline feed is not sufficient proof that a session ended. Do not assume an observation `.jsonl` file is the schema-versioned JSON archive.
- This beta intentionally has **no** Replay/JSONL importer, authenticated historical read API, Next rider-lap expanders or Moto2/Moto3 championship backend. It does not install the separate Next JavaScript resource or alter the original dashboard.

## Status after HACS deployment

The user reported HACS `installed_version=v1.0.9.1b1` on 2026-09-20 and observed populated static HA sensors; the last race was already over, so no post-install live archive file or real session/restart transition has been proven. TV delay had been explicitly set to **0 seconds** by the user. The previous manual race log is a historical observation, not new beta evidence. The next acceptance gate is a read-only check of the *first new* session JSON, IDs, actual lap coverage and HA archive warnings during/after a future live session.

**Current authoritative links:** [Project status](project-status.md) · [HACS install/rollback](hacs-beta-installation.md) · [release notes](hacs-beta-release-notes.md) · [doc-sync ledger](doc-sync-2026-09-21.md).
