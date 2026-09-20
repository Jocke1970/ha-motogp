# Session archive: actual Home Assistant host preflight review

Date: 2026-09-20. Branch: `dev`. **Review only — do not deploy the archive candidate.**

## Evidence from the target host

The operator ran the read-only `motogp-backend-preflight.py` against `/config` and supplied its full output. Python is **3.13.5**; `/config/custom_components/motogp_sensor` exists. The seven inspected existing files match the audited `backend/deployed/v1.0.9/custom_components/motogp_sensor/` blob IDs and sizes:

| File | Git blob | Bytes |
|---|---|---:|
| `coordinator.py` | `87a2a7217dc1e6d748cfcd8b4cd88eda43c5c163` | 38918 |
| `__init__.py` | `e477b7c0ffa7595a1686e0f0dca05c5cd740e64a` | 2519 |
| `helpers.py` | `7235a5b70aaf3e0440d07b00949e482bbdfd7971` | 9626 |
| `sensor.py` | `52b12133ff4c6e0e94071faf7425819a9384a455` | 23224 |
| `api.py` | `d4dff9a994b1a58083d2f0eb0e8e2e2a23e46ed7` | 5935 |
| `manifest.json` | `f671a29a23193a2a1bd023d9d41279ae3fab7655` | 449 |
| `const.py` | `4a5029303f03cd33a11ce8a91f7dfb771481416f` | 6546 |

The output states `COORDINATOR: matches the pinned unmodified v1.0.9 repository baseline` and `VERDICT: BASELINE_MATCH_REVIEW_STILL_REQUIRED`. The check only makes the coordinator equality decision programmatically; the other six values above were compared against the repository inventory during this review. Files not included in the host preflight must not be assumed identical. The preflight made **no modifications**.

`session_lap_archive.py` is **not present** and `/config/motogp_data` **does not exist** on the host. This is consistent with the archive candidate being uninstalled, not an installation failure. The observation file `/config/motogp-lap-observations-20260920-133105-1371415.jsonl` exists outside that archive. It is a separate Recorder observation log: do **not** rename, import or write over it as an authoritative session JSON.

A previously shared editor screenshot appears to show a `config/data/motogp_data` tree. This is not proof of the absolute path; the actual host preflight only establishes that `/config/motogp_data` does not exist. Resolve absolute paths explicitly before considering any migration. Do not move any file automatically.

## Repository code review, limited scope

- `scripts/build-session-archive-candidate.py` builds a **new, uninstalled** directory from the pinned coordinator and archive module, checking both blob hashes; it refuses an existing output directory and preserves the baseline directory.
- The new hook is inserted after `_apply_tv_delay(raw_live, ...)`, checks `live.get('tv_delay_ready') is True` and invokes `SessionLapArchive.observe()` through `hass.async_add_executor_job`. It does not consume `raw_live` directly.
- The parsing helper supplies `event_id`, `session_id`, `championship_id`, `category`, `last_lap`, `last_lap_time` and `rider_id`. The archive module rejects absent IDs and invalid lap times, writes atomic JSON and can reload an existing archive after a restart. The tests cover basic duplicate/switch/partial/restart and no-spoiler internal reads.
- The manifest in the candidate is still the original upstream `1.0.9`; the CI artifact is a **review candidate**, not a versioned install release. A passing GitHub Actions run verifies only the automated offline checks, not behavior on the target Home Assistant host.

## Release blockers (not yet verified)

1. Verify actual runtime feed identities and season year, readiness gating, session transitions, complete-lap extraction and TV delay against live HA (including 0s and >0s delay, startup warm-up, stale/offline feeds). Do not claim the observation JSONL has official event/session IDs.
2. Exercise setup, unload, reload, restart, two config entries sharing an archive directory, missing permissions, disk-full/failed write, partial gaps, red flag and next session. Check the entire archive operation cannot corrupt an earlier file or expose future laps. Avoid blocking HA's event loop.
3. Explicitly design and test a safe authenticated read path and no-spoiler UI behavior **before** presenting archived history in Next. The archive module's local `read()` guard alone is not a frontend API.
4. Produce a versioned, checksummed, fail-closed full integration package and installer that checks **every overwritten file**, backs up the exact installed tree, provides tested rollback and respects HACS ownership. Keep the existing Next JS and upstream card unchanged.
5. Re-run host preflight just before installation to detect changes since this review. The current positive verdict is not permission for an install.

**Decision:** baseline compatibility established for the seven observed host files; candidate still **NOT APPROVED FOR INSTALLATION**. Keep all existing HA files and recorded observations unchanged until the blockers are resolved.
