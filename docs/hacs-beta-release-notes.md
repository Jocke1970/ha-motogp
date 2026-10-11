# MotoGP Sensor 2026.10.0b5 — live-feed freshness beta

**Backend-only HACS prerelease.** Builds directly on the field-tested 2026.10.0b4 backend. The integration domain remains `motogp_sensor` and existing HA config entries and /config/motogp_data archives must be preserved.

## What changes from b4

- Coordinator now records `live_poll_at` in UTC at **each successful live timing API poll**, whether the selected primary source or PulseLive fallback succeeded. A failed request does not advance this timestamp, and an unchanged payload still counts as a successful poll.
- `sensor.motogp_rider_positions` now exposes `live_poll_at` (ISO 8601 string or null before the first success) and `live_poll_interval_seconds`. Poll metadata is scoped to this one entity rather than updating every live sensor on each refresh.
- New weekend regression checks verify the backend timestamp contract and b5 manifest version.
- Retains b4's tiered session-start polling and all earlier Red Flag/Delayed and IANA timezone fixes, without changing TV delay or session archive format.

### Evidence from Mandalika, 9–11 October 2026

Sunday JSON review: MotoGP Warm Up (142 observations), Moto3 Race (445), Moto2 Race (343), MotoGP Race (478). All four captured lap 1 for every recorded rider. Three archives report complete coverage; Moto2 Race reports one missing lap (Holgado, rider 8671, lap 13). This is not a session-start loss. The Warm Up contains one early timestamp for Zarco's lap 7; per operator decision, this historical anomaly is **not** treated as a blocker to the b5 freshness-only prerelease. The archive does not fabricate missing laps.

Current dev CI for the freshness change passed weekend regression, frontend, and one-resource Next checks. The HACS beta publishing workflow recompiles the integration and reruns weekend and archive tests before tagging the release.

## Frontend remains separate

The matching Next UI candidate is `0.3.0-dev.6`, maintained as `/config/www/ha-motogp-next.js` and loaded through `/local/ha-motogp-next.js`. It uses `sensor.motogp_rider_positions.attributes.live_poll_at` for its freshness indicator rather than Home Assistant's `last_updated`. This **is not bundled or installed by HACS**; backend b5 does not automatically upgrade the Lovelace JS. Frontend cache-busting/version verification remains a separate deployment step.

## Install and rollback

1. Back up HA and preserve `/config/motogp_data/` and `/config/www/ha-motogp-next.js`.
2. In HACS with prereleases enabled, select exactly `2026.10.0b5`; retain the existing MotoGP config entry.
3. Restart Home Assistant, confirm integration/entities, then check `sensor.motogp_rider_positions` attributes while live feed polls succeed.
4. Roll back to `2026.10.0b4` via HACS and restart if needed; do not run old Python overlay scripts or delete the config entry.

`main` is deliberately unchanged. Successful CI and prior b4 field evidence support a b5 beta, but are not a claim of b5 on-host validation.
