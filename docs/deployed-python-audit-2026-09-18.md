# Running MotoGP Python source: audited capture, 2026-09-18

## Evidence and scope

User supplied `motogp_source_review.zip` exported from `/config/custom_components/motogp_sensor` on 2026-09-18 19:24 Europe/Stockholm. ZIP is 28,424 bytes, contains 14 source files (`13 .py` + `manifest.json`) and `INVENTORY.txt`. ZIP CRC check passed; all 14 exported SHA-256 checksums match the included inventory; all 13 Python files pass `ast.parse` syntax checks. Installed `manifest.json` declares **1.0.9** and matches upstream tag `v1.0.9` exactly. Source was read and inspected for obvious literal credentials without a flagged match; this is not a security audit or authorization to publish other HA files. No HA installation was modified.

Compared each exported file's Git blob SHA-1 with the official `Liionboy/motogp_sensor` GitHub contents at tag **v1.0.9**. This is an exact content comparison, not an inferred version comparison:

| Status | Files |
| --- | --- |
| **9 identical to upstream** | `__init__.py`, `binary_sensor.py`, `calendar.py`, `config_flow.py`, `device_trigger.py`, `entity.py`, `manifest.json`, `select.py`, `switch.py` |
| **5 locally modified** | `api.py`, `const.py`, `coordinator.py`, `helpers.py`, `sensor.py` |

## Modified-file content hashes

These are SHA-256 of the installed files, not repository commit IDs. The full 14-file checksums remain in the ZIP's `INVENTORY.txt` (uploaded in the conversation; **the ZIP and the five full sources are not yet committed to this repository**).

| File | SHA-256 (installed) | Upstream v1.0.9 Git blob SHA |
| --- | --- | --- |
| `api.py` | `6abdc1cd4a4065044fd1728e3ead2a055215c9b62e75d5b7ad4b839f1950e081` | `5a3cdbf5c29621c6dcc8f0699159dbd2de4dccf4` |
| `const.py` | `a5efe7b6b4691580031216cfb2a3fe3ee1cf488de8934d70fef5e8f76eacf49f` | `b517a1d0ad63e63d0ff77eba0db0e1c758deec60` |
| `coordinator.py` | `bde9df6b349d5a087ee9f8b9d94ea5c520ad9a0ee7b6edf0014c2ed541c4e4ff` | `dc65e7e642c234e794bda129c77492a82b3b3b94` |
| `helpers.py` | `71c8a4a392019cec7baf5f0447d0b6a83c6688cac3f787a34b31236470887523` | `6b8d094183ffa5a400576455abbe08c865ae7e5e` |
| `sensor.py` | `aa11653b791919f32a72b702b474ce04bbd729494d1e5b74b6bf29f2b5f42862` | `d3d9fb5eed477e900fbd2a5f6ff3ab7c23ba565e` |

## Observed local features (source inspection, not full HA runtime tests)

- `api.py`: extra `async_get_grid(event_uuid, category_uuid)` API method.
- `const.py`: status `S` as active; active polling **5 seconds**; grid/records refresh 5 minutes; weather refresh 60 seconds; additional grid API URL. Its HTTP User-Agent still says `1.0.4`; this is a string, not the installed manifest version.
- `helpers.py`: live event/session IDs, class/championship and richer rider/track/status fields from timing feed.
- `coordinator.py`: complete-snapshot TV delay buffer with HA helper `input_number.motogp_tv_delay_seconds` clamped 0–300 s and warm-up metadata; multicategory `weekend_sessions_all`/`schedule_categories`; weather, grid and records; post-race `next_event` advancement.
- `sensor.py`: `sessions_all`, category list, season calendar, grid/records attributes; per-session in-memory lap history and fastest lap derived from exposed/delayed snapshots; shared TV-delay attributes.
- `api.py` already supports per-session `async_get_classification`, but there is **no installed persistent per-session result archive or historical-result selector** in this source. The separate `backend/result_archive.py` on `dev` remains unintegrated.

## Risks to test, not established runtime failures

1. The post-race advancement routine changes `static['next_event']` synchronously, while `weekend_sessions` and `weekend_sessions_all` are generated at static refresh. An event-header/schedule mismatch is therefore possible until refresh. Test the transition before altering this logic.
2. The `sensor.py` `LIVE` entities hide their values under no-spoiler, but `SENSOR_LAST_RACE_RESULTS` is a `STATIC` sensor and its attributes are not guarded there. A new history UI must enforce spoiler checks at the service/API **and at the presentation boundary**; do not assume the switch masks all historic data automatically.
3. Lap history is built in-memory when sensor properties are evaluated; it is not a persistent official result archive and can be partial after a late start or reboot.
4. Classification payload shape and actual availability of Moto2 FP1 three weekends ago have **not** been tested against the live API; do not claim a successful historical lookup.

## Provenance gaps and rollout gate

The screenshot of `/config` showed separate local patch scripts: `motogp_grid_records_hotfix.sh`, `motogp_grid_records_patch.sh`, `motogp_lap_history_patch.sh`, `motogp_live_extras_1_4_patch.sh`, `motogp_multiclass_schedule_patch.sh`, `motogp_polling_5s_patch.sh`, `motogp_postrace_advance_patch.sh`, `motogp_pulselive_status_codes_patch.sh`, `motogp_season_calendar_patch.sh`, `motogp_tv_delay_patch.sh`. These scripts were **not included** in the source ZIP and their content has not been reviewed. The old repo `scripts/patch_motogp_sensor_v1_0_10.sh` is a different, version-gated historical baseline; never apply or force it onto installed 1.0.9.

Next: commit a separately reviewed **exact** deployed source snapshot (or the five-file overlay with reproducible upstream v1.0.9 instructions) onto `dev`; compare script provenance and document safe install/rollback; add tests against recorded scrubbed real payloads; integrate history archive only after this baseline is reproducible. Do not expose arbitrary `/config` backups, secrets, `.storage`, HA recorder or user data. Until exact source is actually stored in the repo, this audit is documentation **only** and issue #1 remains open. Keep `beta`, `main`, the legacy dashboard and running HA unchanged.
