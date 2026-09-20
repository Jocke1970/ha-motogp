# ha-motogp

Home Assistant companion project for the unofficial [`Liionboy/motogp_sensor`](https://github.com/Liionboy/motogp_sensor) integration.

This repository keeps the local patch layer, dashboard YAML and project documentation used to build a richer MotoGP race-week dashboard in Home Assistant.

## Session archive beta.1 — customised 1.0.9 installations

**New, separate beta installation path:** [Automatic session archive beta.1 — scope, exact compatibility checks, download, installation and rollback](docs/session-archive-beta1-2026-09-20.md).

The operator's actual Home Assistant preflight identified an audited customised `motogp_sensor` **1.0.9** install. The archive beta installer checks the exact installed files, installs only an archive module and a coordinator hook, and keeps a verified rollback. It is a pinned overlay, not a tagged release, HACS update, or migration to upstream 1.0.10. **Do not run the 1.0.10 patch below against the 1.0.9 archive beta.** The frontend stays unchanged. First practical HA validation will happen on beta rather than on dev.

## Current upstream baseline

- Integration: `Liionboy/motogp_sensor`
- Reviewed upstream version: **1.0.10** (separate from the pinned archive beta's 1.0.9 base)
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

## Install / update flow for upstream 1.0.10 only

**Not applicable to the new 1.0.9 session archive beta.** After updating `motogp_sensor` to **1.0.10** with HACS:

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
