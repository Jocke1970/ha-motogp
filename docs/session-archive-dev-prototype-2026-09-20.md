# Backend progress — persistent session lap archive prototype

**Date:** 2026-09-20  
**Branch:** `dev`  
**State:** tested isolated prototype and reproducible *uninstalled* coordinator candidate. No change has been deployed to the Home Assistant host.

## New files

- [`backend/session_lap_archive.py`](../backend/session_lap_archive.py): dependency-free archive engine. It accepts only snapshots marked `tv_delay_ready is True` with season, exact event/category/session IDs, status and valid completed laps (`rider_id`, `last_lap`, `last_lap_time`). Writes one JSON per session under the proposed `/config/motogp_data/<season>/<event>/` layout, uses safe filenames, atomic replacement and private file permissions. Reconstructs existing session after a process restart by matching IDs; keeps past session files when a new session starts. Deduplicates observations and accepts corrections. Explicitly tracks missing lap numbers from lap 1 through the highest observed for each rider. It does **not** prove all laps were captured or infer missing trailing laps.
- [`tests/test_session_lap_archive.py`](../tests/test_session_lap_archive.py): ten isolated regression tests including restart, same-status session switch, read/no-spoiler gate, invalid delayed samples, correction, corrupt file and filename collision.
- [`scripts/build-session-archive-candidate.py`](../scripts/build-session-archive-candidate.py): fail-closed generator. Reads pinned snapshots from `backend/deployed/v1.0.9/` and the new archive module, copies to a **new** output directory, injects archive ownership in the copied coordinator after its existing `_apply_tv_delay()` result and runs disk I/O via `hass.async_add_executor_job`. Does not mutate the audited baseline or running Home Assistant installation. Source hashes must match before building.
- [CI: Backend session archive check](https://github.com/Jocke1970/ha-motogp/actions/runs/35515530437): success — Python compilation, all ten archive regression tests, generated candidate syntax, pinned source hashes and unchanged tracked repository files.

## What has and has not been validated

**Validated in offline tests/CI:** the isolated archive's above behavior and candidate generation. The first candidate-build CI revision failed its `git status` cleanliness assertion because Python compilation generated untracked `__pycache__` directories; the check was changed to assert no **tracked** files were modified, while specific baseline file hashes remain checked. The next run passed.

**NOT validated:** current installed HA Python version/hash, real integration setup and teardown, event-loop scheduling under load, full multi-category real API behavior, polling near starts, concurrent config entries, disk-full recovery in HA, true TV-delay integration under real event transitions, spoiler-safe archive reading via a HA API and browser access. Do not install this candidate as a drop-in release. The independent `read(no_spoiler=...)` guard alone is not a complete HA authorization/spoiler boundary. The module performs no network calls and does not fill missed laps retroactively.

## Next implementation gates

1. Compare actual current `/config/custom_components/motogp_sensor/` source hashes/version against the dated audited repo snapshot and verify the coordinator's current TV-delay source, session IDs and source of season year.
2. Review/strengthen archive schema validation, session filename collisions and lifecycle/error behavior; run tests against representative saved delayed snapshots from more than one session and category. Verify first possible lap and mark downtime/missing coverage explicitly.
3. Integrate the logger into reviewed development sources (not the immutable `deployed/v1.0.9` audit), add HA-level tests with mocked coordinator/executor, disable duplicate loggers across config entries, and test reload/restart/rollback. Preserve read-only and spoiler behavior.
4. Add a separately gated, bounded on-demand history reader for the Next rider expander without flooding HA state attributes or Recorder.
5. Implement MotoGP/Moto2/Moto3 rider standings by category with real API verification and similarly safe presentation.
6. Only after all gates, prepare a source-hash-guarded whole-file deployment plus an explicit rollback. No extra Lovelace resource and no original dashboard changes.

See also [session logging roadmap](session-logging-roadmap.md) and [Next UI roadmap](ui-next-layout-roadmap-2026-09-20.md).
