# Running MotoGP Python source: audited capture, 2026-09-18

## Verified snapshot

The user exported `motogp_source_review.zip` from `/config/custom_components/motogp_sensor` at 2026-09-18 19:24 CEST. The 28,424-byte ZIP contains 13 Python files, `manifest.json` and `INVENTORY.txt`. ZIP integrity, all 14 SHA-256 checksums and 13 Python syntax checks passed. The installed manifest declares **v1.0.9**. An obvious-literal-secret scan found no flagged matches; that is not a complete security audit.

**Exact source sync is complete as of capture:** the guarded HA sync script confirmed that ZIP contents matched the then-running integration, committed all 14 sources plus inventory to [`backend/deployed/v1.0.9/`](../backend/deployed/v1.0.9/) on `dev` in [`0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f), and verified the remote branch. [Source-integrity CI passed](https://github.com/Jocke1970/ha-motogp/actions/runs/35378743131). No running HA integration files were changed. Snapshot is not an automatic continuous sync or a tested deployable release.

## Upstream comparison

Each of the 14 files was compared via Git blob SHA to upstream `Liionboy/motogp_sensor` tag v1.0.9. Nine were byte-identical: `__init__.py`, `binary_sensor.py`, `calendar.py`, `config_flow.py`, `device_trigger.py`, `entity.py`, `manifest.json`, `select.py`, `switch.py`. Five files contained local changes:

| File | Captured SHA-256 |
| --- | --- |
| `api.py` | `6abdc1cd4a4065044fd1728e3ead2a055215c9b62e75d5b7ad4b839f1950e081` |
| `const.py` | `a5efe7b6b4691580031216cfb2a3fe3ee1cf488de8934d70fef5e8f76eacf49f` |
| `coordinator.py` | `bde9df6b349d5a087ee9f8b9d94ea5c520ad9a0ee7b6edf0014c2ed541c4e4ff` |
| `helpers.py` | `71c8a4a392019cec7baf5f0447d0b6a83c6688cac3f787a34b31236470887523` |
| `sensor.py` | `aa11653b791919f32a72b702b474ce04bbd729494d1e5b74b6bf29f2b5f42862` |

All fourteen hashes are in tracked [`INVENTORY.txt`](../backend/deployed/v1.0.9/INVENTORY.txt). The historic `scripts/patch_motogp_sensor_v1_0_10.sh` expects **another upstream baseline** and must not be forced onto captured 1.0.9.

## Features found in installed source

- `api.py`: per-session official `async_get_classification` and extra `async_get_grid(event_uuid, category_uuid)`. No persistent historical archive is installed.
- `const.py`: active PulseLive status `S`; 5-second active polling, 5-minute grid/records refresh, 60-second weather refresh and corrected grid URL. User-Agent string remains 1.0.4 while manifest declares 1.0.9.
- `helpers.py`: richer event/session identity, class/championship metadata, rider/track/status fields.
- `coordinator.py`: complete-snapshot TV-delay buffer using `input_number.motogp_tv_delay_seconds` (0–300 seconds); multicategory `weekend_sessions_all`, weather/grid/records and post-race advancement.
- `sensor.py`: `sessions_all`, category list, season calendar, grid/records, in-memory session lap history/fastest lap and delay diagnostic attributes.

## Provenance capture and review — now completed

The second user-exported `motogp_provenance_review.zip` contains 11 historical `.sh` scripts, the active package and actual HA frontend JS (13 files, 32,062 bytes). Its ZIP integrity and member hashes were verified. Script effects were statically reviewed and the ten Python patch feature families were located in the exact committed snapshot. [Detailed per-script disposition, safety findings and cleanup gates](provenance-cleanup-2026-09-18.md). The installer regenerates the exported package exactly but overwrites it unconditionally; the active package is now tracked separately at [`config/packages/motogp_dashboard_mode.yaml`](../config/packages/motogp_dashboard_mode.yaml) with exact SHA-256 `ed6c84f274d5b7d3af638012d68b0609e2ec5ff4eeb0cd5dfe2f89c1503cc769`. Neither eleven scripts nor source ZIP were blindly committed as executable public scripts. Actual caller/reference scan on the HA host has **not yet run**; scripts have **not** been moved/deleted.

The actual `/config/www/ha-motogp-card.js` and tracked `frontend/ha-motogp-card.js` both label themselves `v0.1.0-dev.3` / `0b493073ef59` but have **different Git blob hashes**. Treat frontend parity as unresolved until the actual code diff/browser-loaded resource is checked. No frontend replacement was attempted.

## Unverified behavior and release gates

1. Postrace advancement can change `static['next_event']` before statically cached schedules regenerate; a temporary header/schedule mismatch is possible and needs testing, not merely an assumption of a runtime failure.
2. The static last-race-results entity is not masked merely by the `LIVE` no-spoiler property. Historical API and UI each need protection, including delayed async responses.
3. In-memory lap history can be partial after late start/restart, and is not a persistent official result archive.
4. Actual availability and response shape for a Moto2 FP1 three races ago are unverified. [`result_archive.py`](../backend/result_archive.py) is an isolated uninstalled prototype.
5. Caller/reference scan, old seven YAML quarantine dependencies, real HA tests, install/rollback and `dev → beta → main` promotion remain open. Do not use snapshot capture as a deployment instruction or remove the working legacy dashboard.

Track the work in [Issue #1](https://github.com/Jocke1970/ha-motogp/issues/1). No HA files were changed during source/provenance review.
