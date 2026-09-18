# Backend roadmap (Python, integrated into Home Assistant)

The **running** backend remains `Liionboy/motogp_sensor` with our local patch(es). This directory describes the planned extraction; nothing here is a second server or installable HA integration yet.

Planned modules within the Home Assistant integration:

- `schedule_manager.py`: normalize `sessions_all`, category metadata, status and **timezone-aware** timestamps once, rather than in JavaScript.
- `session_manager.py`: unified session identity (`event_id`, `category_id`, `session_id`), lifecycle and final-snapshot handling. Track exactly which session each result belongs to.
- `tv_delay.py`: append complete timestamped coordinator snapshots to a bounded ring buffer, expose a consistent state delayed by a user-selected 0–60 seconds. Do not delay individual HA sensors separately. Preserve online/offline and no-spoiler safety semantics.

## Historical results prototype (dev only)

`result_archive.py` now contains an isolated, tested module that fetches **official finished-session classifications** by event + category + session UUID, stores results through a Home Assistant Store-compatible interface, and blocks cache/API reads when spoiler mode is enabled. It can fetch older event sessions retrospectively; the Home Assistant instance does not need to have recorded them live. See [historical results design and rollout gate](../docs/historical-results.md) and [unit tests](../tests/test_result_archive.py).

**Not yet wired into the running integration or frontend.** The currently deployed multicategory Python changes have not been captured in this repository. Do not install this prototype or overwrite your working integration with old v1.0.10 patch files. Only `dev` contains the prototype; `beta` and `main` remain untouched.

## Data contract v0 (already in use by frontend dev)

- `sensor.motogp_next_race.attributes.sessions_all`: array of `{id, date, name, category, status, air?, ground?, ...}`; legacy `sessions` as fallback.
- `sensor.motogp_current_session`: state session name and `attributes.category`/`event`.
- `sensor.motogp_session_status`: `attributes.session_status_id`, where `I` and `S` mean active.
- `sensor.motogp_rider_positions.attributes.riders`: list of rider records with position, number, names, gaps, latest lap, bike/team, status and pit.

## Before implementing

1. Obtain the **actual currently deployed** integration files or repository branch implementing multicategory `sessions_all`; the old v1.0.10 patch in `scripts/` adds only `sessions` for MotoGP.
2. Decide whether to maintain an upstream-compatible additive patch or a dedicated custom integration and document its update path. Do not overwrite the working local integration without a verified rebase.
3. Handle no-spoiler mode and retained-result snapshots together: no cached result may leak while spoilers are hidden.
4. Add tests with realistic recorded payloads for session transitions, midnight, source dropouts and delays. Only then move Python changes from `dev` to `beta`.

The first milestone is the **JavaScript custom card** to remove HA-helper round trips from expanders; Python migration follows once the live backend baseline is captured.
