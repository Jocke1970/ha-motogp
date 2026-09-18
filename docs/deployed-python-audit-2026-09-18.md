# Running MotoGP Python source: audited capture, 2026-09-18

## Verified snapshot

The user exported `motogp_source_review.zip` from `/config/custom_components/motogp_sensor` at 2026-09-18 19:24 CEST. ZIP is 28,424 bytes, contains 13 Python files, `manifest.json` and `INVENTORY.txt`. ZIP integrity, all 14 inventory SHA-256 hashes and Python syntax checks passed. Installed manifest version is **1.0.9**. A search for obvious embedded literal credentials produced no flagged matches; this is not a comprehensive security audit.

**Source sync subsequently completed:** the guarded HA sync script validated that the archive still matched live HA files and pushed all 14 source files plus inventory to GitHub [`backend/deployed/v1.0.9/`](../backend/deployed/v1.0.9/) in commit [`0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f). GitHub independently shows `dev` at that commit; [source-integrity CI](https://github.com/Jocke1970/ha-motogp/actions/runs/35378743131) passed checksums, inventory and Python syntax on the committed files. This is a **snapshot of source at export time**, not automatic HA↔GitHub sync and not deployment/runtime validation. The running integration was not modified by the sync.

## Exact upstream comparison

Each exported file's Git blob SHA was compared to official upstream `Liionboy/motogp_sensor` tag `v1.0.9`:

| Result | Files |
| --- | --- |
| Nine byte-identical | `__init__.py`, `binary_sensor.py`, `calendar.py`, `config_flow.py`, `device_trigger.py`, `entity.py`, `manifest.json`, `select.py`, `switch.py` |
| Five locally modified | `api.py`, `const.py`, `coordinator.py`, `helpers.py`, `sensor.py` |

Local SHA-256 hashes:

| File | Installed SHA-256 |
| --- | --- |
| `api.py` | `6abdc1cd4a4065044fd1728e3ead2a055215c9b62e75d5b7ad4b839f1950e081` |
| `const.py` | `a5efe7b6b4691580031216cfb2a3fe3ee1cf488de8934d70fef5e8f76eacf49f` |
| `coordinator.py` | `bde9df6b349d5a087ee9f8b9d94ea5c520ad9a0ee7b6edf0014c2ed541c4e4ff` |
| `helpers.py` | `71c8a4a392019cec7baf5f0447d0b6a83c6688cac3f787a34b31236470887523` |
| `sensor.py` | `aa11653b791919f32a72b702b474ce04bbd729494d1e5b74b6bf29f2b5f42862` |

All 14 exact source hashes are in the committed [`INVENTORY.txt`](../backend/deployed/v1.0.9/INVENTORY.txt). The older `scripts/patch_motogp_sensor_v1_0_10.sh` applies to a different upstream baseline; do not execute or force against customized live 1.0.9.

## Deployed features identified by source inspection

- `api.py`: `async_get_grid(event_uuid, category_uuid)` in addition to official per-session `async_get_classification`; the latter alone does not implement a persistent history viewer.
- `const.py`: status `S` active, active polling 5 seconds, grid/records refresh 5 minutes, weather refresh 60 seconds, grid URL. User-Agent string says 1.0.4 but manifest says 1.0.9.
- `helpers.py`: richer live event/session identity, class/championship metadata, track and rider/status fields.
- `coordinator.py`: coherent TV-delay snapshot ring buffer with `input_number.motogp_tv_delay_seconds` constrained to 0–300 s, multicategory schedule (`weekend_sessions_all`), weather/grid/records, postrace event advancement.
- `sensor.py`: `sessions_all` and categories, season calendar, grid/records, in-memory session lap history and fastest lap from exposed snapshots, shared delay metadata.

## Risks to verify, not established runtime failures

1. Postrace advancement switches `static['next_event']` before static schedule lists regenerate; a temporary header/schedule mismatch is possible until refresh.
2. The static last-race-results sensor does not gain an automatic no-spoiler guard merely from `LIVE`-entity masking. A history API/UI needs independent checks at retrieval and display boundaries, including when async requests finish.
3. Lap history is populated in memory when entities are read and can be partial after a late start or HA restart; do not mistake it for persisted official results.
4. Real historic Moto2 FP1 classification availability and shape have not been confirmed. The separate [`result_archive.py`](../backend/result_archive.py) is a tested prototype, not installed.

## Patch provenance and rollout gate

The HA sync command also generated `/config/config/motogp_provenance_review.zip` with **13 files, 32,062 bytes**. Its own output reported no missing expected scripts and no suspect secret keywords; contents have **not** been uploaded/reviewed, and a keyword scan is not a complete security check. The source ZIP did not include these scripts. Before deleting old `motogp_*.sh` scripts: inspect their contents, identify their order/side effects, check active references and credentials, reconcile against captured final code and record a reproducible install/rollback path. Preserve non-MotoGP scripts and the working HA integration.

The captured Python is now reproducible as an exact source *snapshot* at a fixed commit. Actual deployment/test parity, patch provenance, the current legacy dashboard and HA package configuration, and the historical-results feature are separate open gates. Track them in [issue #1](https://github.com/Jocke1970/ha-motogp/issues/1). Do not promote to `beta` or `main` until tests and rollback are verified.