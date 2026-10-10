# MotoGP Sensor 2026.10.0b3 — weekend beta

**Fixes a five-minute blind spot between finished and upcoming sessions.** Saturday archive evidence showed Q1→Q2 handoffs exactly ~300 seconds apart and Sprint archiving beginning 5m43s after the scheduled start. b3 keeps 300-second idle polling normally, but switches to 30-second standby polling from 15 minutes before until 30 minutes after a normalized scheduled session start.

**Supersedes broken 2026.10.0b1.** b1 fails during Home Assistant import because the Broadcast event URL constant eagerly evaluates an undefined `uuid` name. b2 fixes that constant and adds an executable import-time release regression.

**Beta target:** 2026-10-09. This prerelease keeps the existing `motogp_sensor` domain and is intended for live validation before any promotion to `main`.

## Fixes

- **Red Flag / Delayed live polling:** `R` and `D` now remain on the 5-second active-session polling cadence instead of dropping to the 300-second idle cadence. This fixes the reproduced Mandalika case where HA stayed on Red Flag for up to five minutes after the broadcast returned to green.
- **Consistent active-session context:** the same `I/S/R/D` set is used by `session_in_progress`, live-condition refresh and adaptive polling.
- **Timezone-aware weekend schedule:** backend obtains the event IANA timezone from the MotoGP Broadcast API, keeps the raw Results API wall-clock `date`, and adds a true `date_utc` for each normalized weekend session.
- **Timezone metadata:** `sensor.motogp_next_race` exposes `time_zone`.

Regression coverage includes Mandalika **14:05 → 08:05 Europe/Stockholm** and the Red Flag/Delayed polling contract.

## Separate Next dashboard update

The HACS integration does **not** install `/config/www/ha-motogp-next.js`. A separately verified **Next 0.3.0-dev.5** bundle prefers the new `date_utc` field and renders browser-local time. Its Git blob is:

`4c73aa7f22ec8876b77beede369d565e86e08e0d`

Keep the existing Lovelace resource; replace only its JS file using the pinned installer. No second resource is required.

## Validation boundary

Dev CI is green, but this is still a beta:
- confirm live `R → I/S` recovery on the actual HA host;
- confirm timezone metadata/session `date_utc` from the current event;
- inspect archive JSON after a qualifying session;
- do not promote to `main` solely because CI passed.

TV delay remains the operator's setting and is not changed by this release. Existing `/config/motogp_data` is preserved.
