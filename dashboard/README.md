# Dashboard YAML

This directory contains the current Lovelace prototypes used with `custom:button-card`.

The files are intentionally marked as **WIP**. They represent the latest saved versions from development, but the layout still needs another pass for reliable full-width behaviour on all screen sizes.

Current prototypes:

- `event_header_wip.yaml` – event/race-week header with live or next-session countdown.
- `live_timing_card_wip.yaml` – live rider timing card.
- `weekend_schedule_2col_wip.yaml` – two-column MotoGP weekend schedule.

## Dependencies

- Home Assistant
- `custom:button-card`
- Patched `motogp_sensor` data described in `docs/local-patch-v1.0.10.md`

## Important

The saved schedule currently uses wall-clock parsing to avoid the observed +2 h browser conversion for Pulselive session timestamps.

Category-aware LIVE matching is the next change: the MotoGP weekend schedule must not mark a MotoGP session live merely because another category (Moto2/Moto3) is running a session with the same short name.

The three cards can be placed in a normal `vertical-stack` while testing. A final combined stack will be added once the responsive/full-width layout is locked.
