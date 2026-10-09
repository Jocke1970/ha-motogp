# MotoGP project status — 2026-10-09

## Current release track

The project is on the strict **dev → beta → main** path. The October weekend candidate is **2026.10.0b2**. `main` is intentionally unchanged while the candidate is field-tested.

The integration domain remains `motogp_sensor`; preserve the existing Home Assistant config entry. The HACS backend and the independent Next Lovelace JS are separate delivery surfaces.

## Live findings from Moto2 Practice, Mandalika — 2026-10-09

Observed on the user's HA:

1. Live feed correctly identified `Moto2 / PR`.
2. Red flag eventually arrived as `session_status_id=R` / `Red Flag`; therefore the R mapping itself works.
3. At **09:15:24 Europe/Stockholm**, status changed to Red Flag. Once status became `R`, the old coordinator no longer considered the session active.
4. Rider data next updated at **09:20:24**, exactly five minutes later. This matches `LIVE_POLLING_IDLE = 300 s` and reproduces the bug: `R` fell from the normal 5-second cadence to idle polling.
5. The dashboard showed venue-local Mandalika session times (for example Moto2 Practice 14:05) directly as Swedish local time. The correct conversion for this date is 14:05 Asia/Makassar → 06:05 UTC → **08:05 Europe/Stockholm**.

`track_status_codes=['B','T']` were observed but are rider track/pit-style states and are not used to infer a red flag.

## Release correction

**2026.10.0b1 must not be used.** Home Assistant exposed an import-time crash immediately after install:

`NameError: name 'uuid' is not defined`

Root cause: `PULSELIVE_BROADCAST_EVENT_URL` was declared with an f-string that tried to evaluate `{uuid}` during module import. `2026.10.0b2` preserves the placeholder literally until `.format(uuid=...)` is called and adds an executable import-time regression test so this class of error is caught before release.

## 2026.10.0b2 fixes

### Live-session polling

A shared set is now used:

`I, S, R, D`

It controls:
- `session_in_progress`;
- live-condition/weather refresh;
- adaptive live polling.

Therefore Red Flag and Delayed keep the 5-second live cadence and do not prematurely break the session context. Finished/cancelled/not-started states still fall back to idle cadence.

### Schedule timezone

The backend reads the current event's `toad_api_uuid`, fetches Broadcast API event metadata, canonicalizes its IANA `time_zone`, and adds a normalized `date_utc` to weekend session records while retaining the original `date`. The event timezone is also exposed as `sensor.motogp_next_race.time_zone`.

The Next UI dev.5 prefers `date_utc`, allowing the browser to render the user's local timezone correctly. If event timezone lookup fails, the legacy wall-clock parsing remains as a fallback rather than removing the schedule.

## Verification

Green dev gates on 2026-10-09:
- Python integration compilation.
- Weekend regression: R/D live polling contract.
- Mandalika timezone conversion regression.
- Existing session-lap archive regressions.
- Next single-resource regression.
- Full frontend regression, including explicit `date_utc` local-rendering assertion.
- Verified Next dev.5 bundle Git blob: `4c73aa7f22ec8876b77beede369d565e86e08e0d`.

## Still to verify on the Home Assistant host

- Install HACS prerelease **2026.10.0b2** and restart HA once.
- During a live session, confirm Red Flag/Delayed no longer causes a 300-second update gap.
- Confirm `sensor.motogp_next_race` exposes the event `time_zone` and session entries have `date_utc`.
- Install/update the separate Next dev.5 JS and confirm Mandalika times display in Swedish local time.
- Read-only inspect the first qualifying archive JSON under `/config/motogp_data/`, including session identity, lap coverage and restart behavior.

No replay importer or safe historical read API is included. The old observation JSONL is not automatically imported into the archive.
