# ha-motogp — MotoGP Sensor + Next UI

Independent Home Assistant companion/derived integration based on [Liionboy/motogp_sensor](https://github.com/Liionboy/motogp_sensor). Unaffiliated with MotoGP or its rights holders.

> **Current status (doc sync 2026-09-21):** [Project status and next milestones](docs/project-status.md) · [Evidence and sync ledger](docs/doc-sync-2026-09-21.md) · [HACS beta installation and rollback](docs/hacs-beta-installation.md) · [Tagged v1.0.9.1b1 release](https://github.com/Jocke1970/ha-motogp/releases/tag/v1.0.9.1b1).

## Installation: HACS beta

The operator's HACS update entity reported **`installed_version: v1.0.9.1b1`** on 2026-09-20. New installations should use the [complete HACS installation and rollback guide](docs/hacs-beta-installation.md), add `https://github.com/Jocke1970/ha-motogp` as a HACS custom **Integration** and explicitly choose tagged prerelease **`v1.0.9.1b1`**. This repo packages a *replacement*, not a second integration, at `custom_components/motogp_sensor/` using the existing domain.

Back up HA before migrating. Remove the old repository **inside HACS**, not the HA MotoGP config entry under Devices & services. Never combine this HACS edition with the old overlay installer or the historical upstream 1.0.10 patch. The original dashboard and `/local/ha-motogp-next.js` are separate and remain unchanged. `dev` is a development branch; `beta` holds beta source; install the **tagged release**, not an unspecified branch or main's commit hash.

For beta update discovery, enable the repository-specific HACS **Pre-release** switch when you want prereleases included. The operator enabled it and HACS displayed `v1.0.9.1b1` in the repository/version selector. A prior `latest_version: ba28f5e` represented `main`'s commit and was skipped, **not** a newer beta; no post-toggle update-entity `latest_version` attribute has yet been provided. `auto_update` is off by user setting; no commit-hash upgrade is recommended for the current trial.

## What the installed beta contains — and does not prove yet

- Complete reviewed customized v1.0.9-based Python integration, one archive coordinator hook, and `session_lap_archive.py`, versioned as `1.0.9.1b1` in the manifest. [HACS packaging CI passed](https://github.com/Jocke1970/ha-motogp/actions/runs/35528926529).
- Session engine accepts only TV-delay-ready coordinator snapshots and writes persistent JSON by season/event/category/session under `/config/motogp_data/` **outside HACS-owned code**. It is designed to resume valid existing session files after restart.
- **Not field-verified yet:** actual session JSON created on this HA host, full installed-file parity, repeated live-session transitions/restart recovery, exact lap coverage or spoiler-safe history display. The user's previous race `.jsonl` observation is separate and cannot automatically be replayed or renamed into the archive.
- **Not included:** JSONL replay importer, secured history UI API/per-rider lap expanders, class-specific Moto2/Moto3 championship backend or a Next JS update. Legacy dashboard, frontend resource and YAML are untouched.

The user confirmed that the preceding race was the weekend's final live session. The next practical step is a **read-only archive inspection during/after the next on-air session**, not an install or a forced update. TV-delay is user-set to **0 seconds** for the current trial. [Current checks and acceptance plan](docs/project-status.md).

See [beta release notes](docs/hacs-beta-release-notes.md) and [archived pre-HACS overlay design](docs/session-archive-beta1-2026-09-20.md) for historical reference only. Do **not** execute historical installer commands or the [legacy 1.0.10 patch](docs/local-patch-v1.0.10.md) against this HACS beta.
