# MotoGP project status — 2026-09-18

This is a **state inventory**, not a claim that the GitHub checkout exactly matches the Home Assistant host. See [deployment sync and handover](deployment-sync-2026-09-18.md) for sources and a safe capture procedure.

## Branches and ownership

- `dev`: new standalone frontend, versioning/test workflows and isolated Python historical-results prototype.
- `beta` and `main`: intentionally not promoted yet; both were at `c24ee59e6cfe5e6504da77a41fb4a1559cc99949` when checked 2026-09-18.
- Running HA Python is still upstream `Liionboy/motogp_sensor` with extra local modifications. The repository's version-gated 1.0.10 patch **does not contain all deployed multicategory changes**. Deployed exact source/version checksums: unknown until captured.
- Running legacy dashboard must not be overwritten. The new `custom:ha-motogp-card` is tested separately in Card-test.

## Frontend: implemented and observed

- JS test resource: [`frontend/ha-motogp-card.js`](../frontend/ha-motogp-card.js), `v0.1.0-dev.3` / build `0b493073ef59`. Build metadata is embedded in actual JS and shown in the card; the resource URL query is not proof of loaded version.
- Standalone schedule/timing modes and local, responsive expanders (no helper service round trips). Real HA screenshots on 2026-09-17 showed a multi-category three-day schedule, working expandable day/timing sections and build footer; the user described the new expansion as noticeably faster. No instrumented speed measurement.
- Session identity includes category + session + event; no-spoiler protection and midnight state behavior are covered by frontend tests.
- Open frontend issues: invalid weather placeholders shown as `0°`, a manually opened prestart rider list showing no data despite potential sensor riders, and optional upcoming-day auto-selection before Friday. The source rider identity and available data need verifying; do not bypass no-spoiler protection. [Detailed observations](dev-ui-test-observations-2026-09-17.md).
- Still absent in this JS implementation: full parity with the old dashboard (e.g. header/map, status grid, standings/last-race views and any legacy visual features not explicitly ported), persistent result browsing, and backend TV delay. Keep the old dashboard available.

## Backend: actual vs GitHub

- Reviewed historical upstream base: v1.0.10. Repo patch adds `S` as active, live category/championship attributes and MotoGP `sessions` schedule. These are **historical patch responsibilities**, not proof of the exact running files or installed version.
- Real HA entity observations from 2026-09-17: `sensor.motogp_next_race.attributes.sessions_all` contained a multicategory schedule (20 entries across MotoGP/Moto2/Moto3); `schedule_categories` and `session_count_all` were also present, and weekend-view binary sensors were on. These extensions are not captured in the older tracked patch. Confirm exact installed source before touching it.
- Python `backend/result_archive.py` and `tests/test_result_archive.py` on `dev` provide an isolated historical classifications archive; CI passed its fake-API regression suite 2026-09-18. This is **not installed, not connected to the JS card, not verified against a real historical FP1 endpoint**. [Architecture and rollout gate](historical-results.md).
- Future Python architecture: normalized timezone-aware schedule, category/session/event lifecycle, persistable official classifications, then coherent full-snapshot TV delay (0–60 s). Do not delay individual sensors independently.

## Cleanup completed in HA (reported 2026-09-17/18)

Six old Lovelace card YAML files accidentally loaded as `/config/packages` were moved to `/config/.motogp_cleanup_quarantine`; the only difference between `motogp_dashboard_mode.yaml` and `motogp_dashboard_mode_package.yaml` was a trailing blank line, so the duplicate was also quarantined. The retained active file is `/config/packages/motogp_dashboard_mode.yaml`. No files were permanently deleted. The user subsequently reported **no repair warnings** in HA. An explicit `ha core check` result and all affected dashboard entity dependencies have not been separately captured in this repo. Leave quarantine untouched until reviewed and verified. [Exact names](deployment-sync-2026-09-18.md).

## Priority next steps — do not skip gates

1. Capture **exact deployed Python integration files**, version, hashes and patch provenance. Compare them with upstream and repo patch. Never blindly reinstall/run the old patch, and never include HA secrets or runtime storage in GitHub.
2. Record the actual active dashboard/resource(s), helper ownership and remaining dependencies. Confirm legacy and Card-test are independent before deleting quarantined files.
3. Review historical-result integration against the *deployed* Python, confirm a real older Moto2 FP1 classification, and stage an explicitly identified event/category/session API. No result fallback to current riders or to another pass; no cached spoiler leaks.
4. Add tests with real scrubbed payloads and a verified rollback path; only then integrate/test on HA and promote `dev → beta → main` by reviewed PRs.
5. Address the three frontend polish issues on `dev` with version bump, regression tests and verification in Card-test; then later TV delay and UI parity.

## Known uncertainty

GitHub access does not provide access to `/config` on the actual HA host. Statements above about that host are based on user-shared commands, sensor attributes and screenshots; installed source files and current live configuration still need verification. "No repair warnings" is not synonymous with a complete package dependency audit.
