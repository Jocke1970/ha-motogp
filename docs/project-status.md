# Project status

## Backend baseline

Current reviewed upstream baseline: `Liionboy/motogp_sensor` **v1.0.10**.

Local patch responsibilities:

- Treat Pulselive `session_status_id: S` as active.
- Keep active polling at 10 seconds for both `I` and `S`.
- Preserve `category` and `championship_id` from live timing.
- Expose MotoGP weekend sessions on `sensor.motogp_next_race`.

Upstream-owned behaviour:

- Unclassified riders (`position < 1`) sorted after classified riders.
- Fastest lap prefers best/fastest lap fields before last lap.
- Constructor standings rebuilt from completed Sprint/GP classifications.

## Dashboard state

Implemented / prototyped:

- Full-width event header with race week badge.
- Current/next session state.
- Live session countdown.
- Two-column weekend schedule.
- Weather per completed session where available.
- Live timing rows with rider, bike/team, gaps, pit/status indicators.
- Expandable championship standings and last-race sections in the larger dashboard concept.

Known dashboard work still open:

- Finish reliable full-width `custom:button-card` grid behaviour across desktop/mobile.
- Make LIVE highlighting category-aware so Moto2/Moto3 Q2 cannot incorrectly light up MotoGP Q2.
- Show friendly category label in live timing/header.
- Continue visual polish of standings and last race.

## Category-aware target behaviour

When Moto3 Q2 is live while MotoGP Sprint is next:

```text
Live timing:       Moto3 · Q2 · LIVE · 11:44 kvar
MotoGP schedule:   Next MotoGP · Sprint · 15:00
```

The live feed category and the static MotoGP weekend schedule must be treated as separate data domains.

## TV delay

Planned as a backend feature, not a Lovelace-only workaround.

Preferred design:

- Keep polling the live feed normally.
- Timestamp complete live snapshots.
- Keep a short in-memory ring buffer.
- Expose a snapshot N seconds behind live data.
- Apply the delay consistently to session/category, countdown, positions, gaps, pit, fastest lap and lap count.
- Target configurable delay range: roughly 0–60 seconds.

## Time handling note

The Pulselive sessions endpoint has been observed to return event wall-clock times in a representation that JavaScript interprets as UTC, causing a +2 h display shift in Sweden during CEST. The current Lovelace schedule prototypes therefore parse the `YYYY-MM-DDTHH:MM` wall-clock portion directly instead of allowing browser timezone conversion.

This should eventually be formalized in backend/session metadata so the dashboard does not need venue-specific assumptions.

## Next practical steps

1. Install upstream 1.0.10 cleanly through HACS.
2. Apply and verify the version-gated local patch.
3. Capture actual `category` values for MotoGP/Moto2/Moto3 live feeds.
4. Update dashboard logic to be category-aware.
5. Finish responsive full-width card layout.
6. Implement backend TV delay.
