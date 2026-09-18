# MotoGP project status — 2026-09-18

This is a status ledger, not a statement that the GitHub checkout exactly matches the HA host. The actual user-uploaded Python source has now been reviewed: [source audit](deployed-python-audit-2026-09-18.md), [deployment and cleanup ledger](deployment-sync-2026-09-18.md).

## Branches and ownership

- `dev`: standalone JS frontend, versioning/tests, isolated historical-results prototype and documentation/source audit.
- `beta` and `main`: not promoted. Both were at commit `c24ee59e6cfe5e6504da77a41fb4a1559cc99949` when inspected 2026-09-18.
- Running HA Python: customized upstream `Liionboy/motogp_sensor` **version 1.0.9**, as verified from the uploaded manifest. 14-file ZIP received; ZIP checksum/inventory verified, 13 `.py` AST checks pass; 9 identical to upstream `v1.0.9`, 5 modified (`api.py`, `const.py`, `coordinator.py`, `helpers.py`, `sensor.py`). **Full installed source is still not committed to GitHub.** Historic tracked patch expects v1.0.10; never force/apply to running modified v1.0.9. Detailed hashes: [audit](deployed-python-audit-2026-09-18.md).
- Keep the working legacy dashboard separate; the new `custom:ha-motogp-card` is observed in Card-test.

## Frontend: implemented and observed

- Test resource: [`frontend/ha-motogp-card.js`](../frontend/ha-motogp-card.js), `v0.1.0-dev.3` / build `0b493073ef59` embedded in JS. Actual HA screenshots 2026-09-17 show a multicategory three-day schedule, local expandable timing/day sections and version footer; user described faster expansion, not an instrumented benchmark.
- Category + session + event identity for LIVE, no-spoiler and midnight behavior have isolated frontend tests.
- Open polish: invalid weather placeholders displayed as `0°`; prestart rider list potentially hidden when opened manually (must first establish data belongs to correct session); optionally show next day ahead of race weekend. [Observations](dev-ui-test-observations-2026-09-17.md).
- Card-test lacks feature parity with old dashboard: header/map, full status, some standings/last-race views and dedicated persistent historical results. Keep old dashboard intact.

## Backend: recovered actual implementation vs tracked files

- Real code: `sessions_all`, `schedule_categories`, `season_calendar`; live 5-second polling and status `S`; TV-delay complete snapshot ring buffer controlled by `input_number.motogp_tv_delay_seconds` (0–300 s); session-scoped in-memory lap history/fastest lap; multi-category grid/records and weather; next-event advancement after MotoGP race. These have been identified from the uploaded source, **not exhaustively tested as a replacement build**.
- Historical patch in repo is version-gated v1.0.10 and does not reproduce deployed modifications. User screenshot shows ten separate `motogp_*.sh` scripts in HA config; they were not part of exported ZIP. Reconcile provenance, do not overwrite source.
- Source-based risks to test: postrace `next_event` can change before schedule lists are rebuilt; static `sensor.motogp_last_race_results` is not automatically masked by the live-only no-spoiler guard; lap history is volatile and may be partial. No production failure inferred solely from source.
- `backend/result_archive.py` and its isolated tests on `dev` support official classifications keyed by event/category/session; fake-API CI passed. This is **not installed, not connected to card/HA Store, and not verified with a real old Moto2 FP1 endpoint**. [Historical-result design](historical-results.md).

## HA cleanup status

Six Lovelace YAML cards mistakenly under `/config/packages` and one duplicate display-mode package were moved to `/config/.motogp_cleanup_quarantine` (seven total, no permanent deletion). `/config/packages/motogp_dashboard_mode.yaml` remains active. User subsequently saw no HA repair warnings. Complete config-check output and dependency references not captured; quarantine removal remains blocked. [Exact file list](deployment-sync-2026-09-18.md).

## Next steps — gates

1. Version-control the reviewed **five modified Python files** as an exact source snapshot or reproducible overlay on `dev`; compare bytes against the uploaded SHA-256 and audit the separate HA `.sh` provenance. Current audit documents code but **does not equal a source commit**. [Issue #1](https://github.com/Jocke1970/ha-motogp/issues/1).
2. Record actual running dashboard resource, active helper ownership and any remaining package references without touching legacy view; do not purge quarantine until verified.
3. Validate one real older Moto2 FP1 classification by explicit event/category/session IDs; integrate result archive with this verified Python and HA Store, guarded service and UI boundary, real scrubbed payload tests and rollback.
4. Test postrace schedule coherence, timezone/TV-delay, restart and spoiler transitions in HA. Improve JS on `dev` with a **new build ID/version** and Card-test verification.
5. Only after a reproducible build, safe install/rollback and actual HA verification, promote `dev → beta → main` by reviewed PRs.

## Important limitation

The uploaded ZIP represents the installed Python integration at export time. It does **not** contain the `.sh` patches, the full HA configuration, live Lovelace export, JS binary or a runtime test report. No changes to HA were made during this audit.
