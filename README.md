# ha-motogp — development

Independent Home Assistant companion/derived integration based on [Liionboy/motogp_sensor](https://github.com/Liionboy/motogp_sensor). Unaffiliated with MotoGP or its rights holders.

> **Current operational truth (synced 2026-09-21):** [Project status](docs/project-status.md) · [Documentation sync ledger](docs/doc-sync-2026-09-21.md) · [HACS beta install/rollback](docs/hacs-beta-installation.md) · [Tagged `v1.0.9.1b1` release](https://github.com/Jocke1970/ha-motogp/releases/tag/v1.0.9.1b1).

## Branch and installation rules

The operator's HACS update entity reported installed `v1.0.9.1b1` on 2026-09-20. The full HACS-compatible Python integration lives under `custom_components/motogp_sensor/` on `main`/`beta` and in the **tagged release**. Do not install the `dev` branch, run an old `1.0.10` patch, or apply the superseded `install-session-archive-beta.py` overlay to the HACS-managed files. Leave the existing HA MotoGP config entry and legacy dashboard intact. `dev` is **not** the HACS distribution source; it carries test and roadmap development that has not automatically been promoted.

Beta CI passed ([packaging run](https://github.com/Jocke1970/ha-motogp/actions/runs/35528926529)); HACS displayed the installed version and repository's tag after the user enabled its Pre-release switch. **Not yet field-verified:** actual auto-created session JSON in `/config/motogp_data`, restart recovery, consecutive session boundaries, real multi-class completeness or a full post-install installed-code hash audit. The previously captured race JSONL is a separate observation, not a beta-created session archive. There were no more live sessions after the final race that weekend; first backend field test belongs to the next race weekend. User-set TV delay is currently 0 seconds.

## Development inventory

- `backend/deployed/v1.0.9/`: historically audited, exact pre-beta Python snapshot (14 files), **not** the newly installed beta and not a deployment directory. [Audit](docs/deployed-python-audit-2026-09-18.md), [September 18 ledger](docs/deployment-sync-2026-09-18.md).
- `backend/session_lap_archive.py`, `tests/test_session_lap_archive.py` and `scripts/build-session-archive-candidate.py`: reviewed offline archive candidate, later packaged in the HACS release. The archive's session logic is implemented in the beta; on-host operation still awaits a live-session test.
- `backend/result_archive.py`: separate historical-results prototype, not installed or wired to the beta history UI.
- `frontend/`, `dist/` and `dashboard/`: isolated Next UI/test sources and reference YAML; actual `/local/ha-motogp-next.js` remains independently installed (last reported working `0.3.0-dev.4`). This HACS beta does **not** install or update Next or the legacy card. [Next UI roadmap](docs/ui-next-layout-roadmap-2026-09-20.md), [frontend source proof](docs/frontend-drift-resolution-2026-09-18.md).
- `config/packages/motogp_dashboard_mode.yaml`: reference copy of the active dashboard helper package, not an instruction to duplicate or overwrite host YAML.
- Eleven old HA shell patch scripts are quarantined, not permanently removed. [Cleanup runbook](docs/patch-quarantine-runbook-2026-09-18.md), [Issue #1](https://github.com/Jocke1970/ha-motogp/issues/1).

## Next work: actual validation before more features

1. Leave the installed tagged HACS beta alone; do not select a commit-hash or untagged branch as an update. Confirm exact `latest_version` only if HACS metadata is revisited; the post-toggle attribute has not been captured yet.
2. After the first qualifying live session, read-only inspect session JSON path, schema, event/category/session IDs, lap coverage and HA warnings. Do not claim successful on-host archiving based solely on a compiled module or release.
3. Across later sessions verify file separation, finish handling, missing laps and restart recovery when practical; no retrospective data should be fabricated.
4. Only after backend evidence: develop protected history read API, lap expanders, optional explicit JSONL Replay and class-specific standings/Next UI separately on `dev`. [Session logging roadmap](docs/session-logging-roadmap.md); [UI roadmap](docs/ui-next-layout-roadmap-2026-09-20.md). Older roadmaps may say 'not implemented' because they preserve pre-release design context; consult current [project status](docs/project-status.md) for what is packaged and installed.

Never commit whole `/config`, credentials, `.storage`, backups, recorder data or unreviewed patch scripts. Changes to `dev` are not automatic instructions to replace running HA, `beta` or `main`.
