# ha-motogp

Home Assistant companion project for the unofficial [`Liionboy/motogp_sensor`](https://github.com/Liionboy/motogp_sensor) integration.

This repository keeps the local patch layer, dashboard YAML and project documentation used to build a richer MotoGP race-week dashboard in Home Assistant.

## Current upstream baseline

- Integration: `Liionboy/motogp_sensor`
- Reviewed upstream version: **1.0.10**
- Reviewed upstream commit: `616de2262f3cbb9e6a396f0d4797c14493a67b27`

## Local additions

The local patch currently adds:

- Pulselive status `S` treated as an active session.
- 10-second polling for active `S` sessions.
- Live `category` and `championship_id` attributes.
- MotoGP weekend sessions exposed on `sensor.motogp_next_race`.
- Data needed to keep MotoGP/Moto2/Moto3 live timing separate from the MotoGP weekend schedule.

Upstream 1.0.10 already fixes live ordering for unclassified riders, fastest-lap selection and constructor standings; those fixes are deliberately left upstream-owned.

## Repository layout

```text
scripts/       Version-gated Home Assistant patch scripts
docs/          Patch notes, verification and project status
dashboard/     Lovelace YAML (currently work in progress)
```

## Install / update flow

After updating `motogp_sensor` to **1.0.10** with HACS:

```bash
bash /config/patch_motogp_sensor_v1_0_10.sh --check
bash /config/patch_motogp_sensor_v1_0_10.sh
```

Restart Home Assistant after the patch has been applied.

The patch is intentionally version-gated. Do not use `--force` after an upstream version change until the diff has been reviewed.

## Current roadmap

1. Finish category-aware live timing (`MotoGP`, `Moto2`, `Moto3`, etc.).
2. Keep the MotoGP weekend schedule independent from whichever category is currently live.
3. Finish the responsive/full-width Lovelace layout.
4. Add backend TV delay using a buffered live snapshot, so timing can be synchronized with the broadcast.
5. Polish championship standings and last-race cards.

## Status

This is a personal Home Assistant project and is not affiliated with Dorna Sports or MotoGP.
