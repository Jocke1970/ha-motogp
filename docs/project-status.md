# MotoGP project status — 2026-10-11

## Release track

Strict `dev → beta → main`. **2026.10.0b5** is the new HACS backend beta candidate (freshness-only delta from live-tested b4). Stable `main` remains unchanged. Repo: `Jocke1970/ha-motogp`; integration domain remains `motogp_sensor`.

## Weekend field acceptance

- Friday: six session archives, four without reported varvluckor and two partial; earlier Red Flag polling and import crash explain key gaps.
- Saturday: ten archives, seven complete by the archive's `partial` criterion, three partial. Q1/Sprint lap-1 losses motivated b4's prestart cadence.
- Sunday: MotoGP WUP 142 observations, Moto3 Race 445, Moto2 Race 343, MotoGP Race 478. All four captured lap 1 for every recorded rider; Moto2 Race alone has a known missing Holgado lap 13.
- Zarco WUP lap 7 has a suspicious early observation timestamp, but the operator explicitly chose to disregard it for this b5 release decision. Coverage flag checks missing lap numbers, not chronological plausibility.

**Assessment:** b4 tiered polling successfully addressed the systemic session-start blind spot in Sunday's four sessions, while isolated data anomalies should not be attributed to session-start polling without evidence.

## b5 scope

- `coordinator.py`: `_last_live_poll_at` set when primary or fallback API poll succeeds, even if the response body has not changed.
- `sensor.py`: `live_poll_at` and `live_poll_interval_seconds` on `sensor.motogp_rider_positions` only; no broader Recorder churn.
- `manifest.json`: `2026.10.0b5`. Weekend regressions updated to cover freshness metadata and version.
- All b4 active/Red Flag/Delayed 5-second polling, normalized circuit timezone, and tiered prestart cadence remain unchanged.
- Separate Next UI `0.3.0-dev.6` can read this metadata; it is **not included in HACS**.

## Validation and operating boundary

Latest dev commit `2de936e980a0eb6ffa0e5753481423aaf592ee14` passed weekend/backend, Next single-resource and frontend GitHub Actions checks on 2026-10-11. The beta publishing workflow independently reruns the integration compile, weekend regressions, archive tests and HACS packaging contract before creating a GitHub prerelease.

After HACS installation, verify that `live_poll_at` advances with each successful poll, and does not advance during an actual failure. Confirm the separate Next JS `0.3.0-dev.6` was installed and refreshed explicitly before evaluating the freshness chip. Do not mistake entity `last_updated` for API feed success.

No old JSONL importer, synthetic gap filling, or automatic frontend migration. Preserve `/config/motogp_data/`; do not replace or remove the HA MotoGP config entry.
