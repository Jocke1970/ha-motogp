# MotoGP Sensor (ha-motogp) v1.0.9.1b1 — first HACS beta

**Release published:** 2026-09-20. **Operator installation reported:** 2026-09-20 evening. **Documentation reconciled:** 2026-09-21. This is a complete HACS-installable derivative of the locally audited customized `motogp_sensor` 1.0.9, not upstream's 1.0.10 or an official MotoGP release.

## Released contents (verified in repository/CI)

- Preserves `motogp_sensor` domain and entity names in the packaged implementation.
- Adds a permanent backend per-session lap archive, gated on coordinator-exposed TV-delay-ready snapshots, writing JSON under `/config/motogp_data/` outside the HACS integration folder. Keeps event/category/session identities, deduplicates/corrects captured completed laps, atomically writes files and is designed to restore matching files after restart.
- HACS manages the **complete integration**. No `install-session-archive-beta.py` overlay, upstream `1.0.10` patch or second MotoGP integration should be installed over it.
- [Packaging and offline tests passed](https://github.com/Jocke1970/ha-motogp/actions/runs/35528926529). This does not prove actual on-host live archive creation or continuous lap coverage.

## Operator observations (not to be confused with complete end-to-end validation)

- HACS update entity reported `installed_version=v1.0.9.1b1`, `in_progress=false`, `auto_update=false`; the HA Jinja diagnostics found 36 MotoGP-matching entities and static results/standings data.
- Initially HACS showed `latest_version=ba28f5e` (`main` commit) and skipped that commit. The operator enabled the HACS repository's *Pre-release* switch and HACS then displayed the tagged beta in its download dialogue/repository badge. **A later `latest_version` attribute has not been captured**; do not claim its value was independently verified.
- The weekend's last live session ended before this beta could be field-tested; live-only sensors being unknown afterward is not in itself a defect. TV delay was intentionally set to **0 seconds** by the operator.
- The earlier captured `motogp-lap-observations-*.jsonl` file is **not** an archive JSON and is not automatically imported.

## Still excluded / unverified

No JSONL Replay importer; no safe historical read API or rider lap-history expanders; no independent Moto2/Moto3 championship backend; no Next UI update. Host file-hash parity, new live-session JSON creation, real session transitions, gaps, disk failures and restart recovery still await actual HA validation. No source deployment is implied by doc changes.

**Migration/rollback:** Back up HA; remove the **old repository in HACS**, not the existing HA config entry in Devices & services; add `https://github.com/Jocke1970/ha-motogp` as a custom Integration and select exactly tagged prerelease `v1.0.9.1b1`. Restart HA once after replacing Python code. See the [complete installation guide](hacs-beta-installation.md) and [current project status](project-status.md). Preserve `/config/motogp_data` and observation files during recovery.

Based on [Liionboy/motogp_sensor](https://github.com/Liionboy/motogp_sensor); not affiliated with MotoGP or its rights holders.
