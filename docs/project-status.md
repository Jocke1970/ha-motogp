# MotoGP project status — doc sync 2026-09-21

**Current operational reference.** This supersedes the older instructions in this file to install upstream 1.0.10, run a shell patch or implement TV delay from scratch. Software is not changed by this documentation update. See the [HACS installation and rollback guide](hacs-beta-installation.md) and [v1.0.9.1b1 release](https://github.com/Jocke1970/ha-motogp/releases/tag/v1.0.9.1b1).

## Source of truth and branch ownership

| Location | Purpose / known state |
| --- | --- |
| Running Home Assistant | User reported HACS `installed_version: v1.0.9.1b1`, existing MotoGP entities and static data visible on 2026-09-20. This **does not** verify all installed Python file hashes or actual archive writes. |
| GitHub tagged `v1.0.9.1b1` | Immutable reference for this trial's **versioned package**, created from beta packaging commit `a40b9ebe`; full integration under `custom_components/motogp_sensor/`, manifest `1.0.9.1b1`. This is the intended HACS install choice. |
| `main` | HACS custom-repository discovery and the packaged integration. The initial package promotion was commit `ba28f5e`; future documentation-only commits do **not** create a newer released software version. |
| `beta` | Reviewed beta distribution and release-related documentation. |
| `dev` | Ongoing development, pinned pre-beta baseline, frontend work, offline archive tests and roadmaps. Do not use an untagged branch as a substitute for the installed HACS beta. |

The integration domain remains `motogp_sensor`; do not install a second copy from upstream. Keep the existing HA config entry under Devices & services. Do not run the historical `1.0.10` patch or the earlier `install-session-archive-beta.py` overlay on the HACS edition. Do not automatically merge `dev` into `main`/`beta`; the branches contain different workstreams.

## Verified in GitHub and offline tests

- The complete HACS beta was packaged from the audited, locally customized 1.0.9 backend with one coordinator archive hook plus `session_lap_archive.py`; manifest version is `1.0.9.1b1`. Packaging, source-pinning, syntax, archive and installer regression jobs completed successfully: [HACS CI run 35528926529](https://github.com/Jocke1970/ha-motogp/actions/runs/35528926529). This is build/test evidence, **not** evidence of recording a live race on the user's host.
- `coordinator.py` packaged Git blob: `bd953cbf20f4f435c277e7a4265c38f6cb4aa37a`; archive module Git blob: `f20ceb90348ff124bdbc049faff4e0d90cf6b8b0`. These are expected repository files, not yet independently compared with the installed host files.
- Archive design: accept only coordinator-exposed `tv_delay_ready=True` snapshots; persist session JSON under `/config/motogp_data/<year>/<event>/` outside HACS-managed source; use season/event/category/session identity, atomic writes, and reload matching files after restart. Missing laps cannot be reconstructed if HA never observed them. There is **no** history read API for Next yet. [Archive implementation notes](session-archive-beta1-2026-09-20.md) are historically about the *superseded overlay candidate*; the current distribution is the [HACS release notes](hacs-beta-release-notes.md).

## Reported from the user's HA — 2026-09-20 evening

- HACS update entity `update.motogp_sensor_ha_motogp_beta_update` reported `installed_version: v1.0.9.1b1`, `auto_update: false`, `in_progress: false`. Before pre-release was enabled its `latest_version` and `skipped_version` both showed `ba28f5e` (`main` commit), **not** a second beta. User found the disabled HACS *Pre-release* switch for this repository and enabled it; HACS subsequently displayed the tagged `v1.0.9.1b1` in its download dialog and repository version badge. A post-toggle `latest_version` attribute was **not** provided, so do not claim that attribute was definitively corrected. No second download was required or confirmed.
- The compact, read-only HA Jinja report found 36 MotoGP-matching entities, including calendar, race/weekend helpers, results, standings and both old and new HACS update entities. Presence of both update entities alone does not prove that two backend integrations run. Static results and standings were populated. No direct file/hash or HA-log export has been reviewed after the HACS switch.
- All live-only sensors were `unknown` and live-timing-online was `off` after the **last race of the weekend**. This is expected context, not by itself an integration error. The user's TV delay was deliberately set to **0 seconds**; do not silently change it. Dashboard had post-race visibility until local midnight; its Austria/0-days display on that evening is an observation requiring next-event verification, not a diagnosed API defect.
- The race captured earlier on 2026-09-20 generated a separate `motogp-lap-observations-*.jsonl` observation file **before** this beta was in use. That file is **not** a session archive; no automatic importer/replay exists. Do not rename or ingest it as archive JSON without a separately tested importer.

## Components and exclusions

- **Beta backend:** installed version reported by HACS; actual live archive creation, session transitions, persistent recovery, spoiler behavior and real full-file parity still pending a qualifying session/host review.
- **Next UI:** independent `/config/www/ha-motogp-next.js` / `/local/ha-motogp-next.js`; last reported working version `0.3.0-dev.4`. It was **not** bundled with or changed by the HACS backend release. Original legacy dashboard, `ha-motogp-card.js`, existing YAML and HACS card resources are to remain untouched.
- **Future UI and backend:** no replay importer, rider lap-history expander, guarded history API or verified Moto2/Moto3 class-wise championship backend in `v1.0.9.1b1`. Historical `backend/result_archive.py` is a separate uninstalled prototype on `dev`.
- **Earlier cleanup:** 11 old shell patches remain quarantined, not permanently deleted. Seven historical misplaced/duplicate YAML files have a separate cleanup gate; preserve the working dashboard. [September 18 deployment ledger](https://github.com/Jocke1970/ha-motogp/blob/dev/docs/deployment-sync-2026-09-18.md) and [Issue #1](https://github.com/Jocke1970/ha-motogp/issues/1) are historical audit/unfinished-cleanup references, not today's deployment instruction.

## Next practical milestones — in order

1. **Leave installed HACS beta alone** until next on-air session; avoid commit-hash update, original upstream HACS update, manual overlay or unnecessary reinstall. `auto_update` remains off by user setting. If reviewing HACS version metadata, distinguish release tag from a branch commit; record `installed_version`, `latest_version`, `skipped_version` after prerelease toggle without changing code.
2. **First real backend archive verification:** after a qualifying session, confirm that a new session JSON actually appears in `/config/motogp_data/`, has `schema_version: 1`, correct event/category/session IDs, valid completed laps and timestamps, and no invented data. Use read-only inspection; redact secrets and private paths if exporting logs. The user has no further live sessions for the already completed weekend.
3. **Subsequent sessions:** test separate per-class/per-session files, duplicates, missing-lap coverage, corrected times, finish, and recovery from an HA restart when practical. Verify delay behavior against the user's intended setting (currently 0 s) before any optional nonzero-delay test. Inspect HA log for archive warnings. Do not promise full lap coverage during outages.
4. **HACS and source integrity:** when needed, read-only compare manifest, archive module and coordinator against the released Git blobs. Confirm no accidental source updates by the old upstream repository; do not remove the existing HA configuration entry.
5. **Next features, separately scoped on `dev`:** spoiler-safe archive read/API + per-rider lap expanders; JSONL replay importer only if explicitly designed and tested; Next layout/grid/standings work behind verified data contracts. See the [archive roadmap on dev](https://github.com/Jocke1970/ha-motogp/blob/dev/docs/session-logging-roadmap.md) and [Next UI roadmap on dev](https://github.com/Jocke1970/ha-motogp/blob/dev/docs/ui-next-layout-roadmap-2026-09-20.md). Neither roadmap is a deployed feature list.

**Acceptance boundary:** GitHub release + HACS installed-version report are verified; real on-host automatic archiving and all-lap coverage are **not yet verified**. Preserve source and data; no software deployment follows from a doc sync.
