# ha-motogp — HACS beta

Independent Home Assistant companion/derived integration based on [Liionboy/motogp_sensor](https://github.com/Liionboy/motogp_sensor). Unaffiliated with MotoGP or its rights holders.

> **Current operational truth — 2026-10-11:** **2026.10.0b5** is the scoped backend beta candidate after successful b4 Mandalika field tests; `main` remains untouched. Freshness metadata is new in b5, while the Next UI is still a separate JavaScript deployment. See [project status](docs/project-status.md), [beta notes](docs/hacs-beta-release-notes.md) and [install/rollback](docs/hacs-beta-installation.md).

## What changed for the October weekend beta

- **Tiered scheduled-session polling (b4):** normally 300 seconds; 15 seconds from T−5 through T+10 minutes when not active; 30 seconds from T+10 through T+30; 5 seconds for I/S/R/D.

> **2026.10.0b1 is withdrawn from use.** It contains a module-import crash in the Broadcast event URL constant (`{uuid}` was eagerly interpolated by an f-string). Use **2026.10.0b2** or later.

- **Red Flag / Delayed remain hot:** session states `R` and `D` now keep the coordinator on the 5-second live polling cadence instead of falling back to the 300-second idle cadence. The same live-session set is used by `session_in_progress` and live-condition refresh.
- **Schedule timezone normalization:** Results API venue wall-clock session times are converted with the event IANA timezone obtained from the Broadcast API. Backend exposes both original `date` and normalized `date_utc`, plus `sensor.motogp_next_race.time_zone`.
- **Next UI dev.6:** the independent, one-file Lovelace dashboard uses true `date_utc` for local time and can display feed freshness from `live_poll_at`. It remains separately deployed, not part of HACS.
- Regression coverage includes the real observed Mandalika example: **14:05 Asia/Makassar → 06:05 UTC → 08:05 Europe/Stockholm**.

## Distribution boundaries

- HACS backend: `custom_components/motogp_sensor/`, domain unchanged.
- Persistent session data: `/config/motogp_data/`, outside HACS-managed code.
- Next frontend: `/config/www/ha-motogp-next.js` / `/local/ha-motogp-next.js`, still separate from HACS. Updating the backend does not replace this JS automatically.
- Existing HA MotoGP config entry must be preserved. Do not install a second integration with the same domain and do not use the old overlay/1.0.10 patch scripts.

## Branch rule

`dev → beta → main`

- `dev`: implementation and regression gates.
- `beta`: tagged HACS prerelease for live validation.
- `main`: only after beta evidence is satisfactory.

Mandalika live testing verified successful session archives and lap-1 capture on Sunday after b4. The b5 freshness additions still need an on-host check after HACS installation.


### Session-start polling

Polling is now tiered around normalized scheduled session starts: 300 seconds normally, 15 seconds from 5 minutes before through 10 minutes after a scheduled start while the feed is not active, 30 seconds from +10 through +30 minutes as a delayed-start fallback, and 5 seconds for active/Red Flag/Delayed sessions.

### Live-feed freshness in b5

A timestamp for each successful primary/fallback live poll is now exposed on `sensor.motogp_rider_positions` as `live_poll_at`, together with `live_poll_interval_seconds`. This tracks API polling, **not** HA `last_updated`, and changes no archive or TV-delay behavior.
