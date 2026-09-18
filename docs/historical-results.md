# Historical session results — dev foundation (2026-09-18)

## Status

`backend/result_archive.py` and `tests/test_result_archive.py` are committed on `dev` and tested by `.github/workflows/backend-results-check.yml`. **Not installed in Home Assistant; no UI yet.** `beta`, `main`, the old dashboard, and the running `motogp_sensor` files were not modified.

The running integration contains additional locally deployed multicategory schedule changes (`sessions_all`) that are **not present** in the older v1.0.10 patch tracked here. Before wiring in the results module, capture and review the exact installed integration source. Do not reapply the old patch or replace coordinator/sensor.py from upstream.

## User experience

A result selector should offer **season → race weekend → category (MotoGP / Moto2 / Moto3 / available classes) → session (FP1, Practice, Q1, etc.)**. The selected race must be an explicitly identified event, never inferred from a generic 'last result' sensor. The user can select an older event, e.g. Moto2 FP1 three races ago, even if HA was not running at the time. Include event date and category on the results heading. Show 'classification not yet published/unavailable' if the API has no result, and never substitute the current live riders or a different session.

## Integration data flow

1. Obtain the season and events via the existing API (`async_get_seasons`, `async_get_events`). Use event UUID from the user's selected weekend. Sort races by their actual schedule and explicitly exclude tests if presenting a 'three races ago' shortcut; do not derive event IDs from an offset.
2. Obtain the category UUID via `async_get_categories(season_uuid)`; do not assume numeric `championship_id` is an API category UUID.
3. `ResultArchive.async_list_sessions(event_uuid, category_uuid, no_spoiler=coordinator.no_spoiler)` uses the filtered sessions endpoint. Find FP1 by type `FP` plus number `1` (or offer all returned sessions; APIs may label sessions differently). Select the returned session UUID.
4. `ResultArchive.async_get_result(event_uuid, category_uuid, session_uuid, no_spoiler=coordinator.no_spoiler)` verifies that the chosen session belongs to the selected event/category and has status `FINISHED`, retrieves `async_get_classification(session_uuid)`, normalizes rows through the installed `parse_classification`, and persists only nonempty results.
5. Construct the archive with the existing API instance and a versioned Home Assistant `Store` (for example `Store(hass, 1, 'motogp_results')`). Expose results to a dedicated HA action/API with explicit IDs rather than placing a complete multi-season archive into a sensor attribute. Ensure no-spoiler is checked AGAIN at the response/UI boundary, including immediately before presenting an awaited result. No cached results, result summaries or historic classifications may be rendered while no-spoiler is enabled.
6. When a pass finishes, optionally prefetch by its **actual** event/category/session UUID. If the official classification is not yet populated, retry after a later coordinator update. Do not store provisional live rider positions as official final results.

The archive uses Home Assistant Store's asynchronous `async_load` / `async_save` interface, schema version 1, and a maximum of 512 cached session records by default. Entries evicted from cache can be fetched again from the API if available. This is **not** a guaranteed permanent offline mirror of every race in history. A corrupt or unknown store schema causes an explicit exception without overwriting the existing file. No per-run timestamped backup piles are generated.

## Tests and rollout gate

Run `python -m unittest discover -s tests -p 'test_result_archive.py' -v`. CI covers old FP1 lookup, persistence after a new service instance, event/category isolation, unfinished sessions, delayed publication, spoiler blocking (including cache), incompatible store format, failed writes, cache limits and selector boundaries. These are fake-API unit tests, not a successful call to the live MotoGP API.

Before activating in HA: capture the currently deployed Python integration; review upstream API response shape for FP1 from an earlier event in each available category; verify `Store` setup and HA async call rules; test no-spoiler races and race-week transitions; test restart, unavailable API and late publication; then stage through `dev → beta → main`. Do not install this file alone or overwrite the working integration.
