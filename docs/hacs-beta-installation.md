# HACS beta installation, upgrade and rollback — 2026.10.0b2

**Do not use 2026.10.0b1.** It contains an import-time `NameError` in the Broadcast URL constant and cannot load the integration. Upgrade directly to **2026.10.0b2**.

This is an independent derived integration based on Liionboy/motogp_sensor, not an official MotoGP release. Domain remains `motogp_sensor`.

## Upgrade from the installed ha-motogp beta

1. Make/confirm a Home Assistant backup. Preserve `/config/motogp_data/` and the independent `/config/www/ha-motogp-next.js`.
2. Keep the existing MotoGP integration under **Settings → Devices & services**. Do **not** delete or re-add it.
3. In HACS, keep **Pre-release** enabled for the ha-motogp repository and select the explicit prerelease **2026.10.0b2**.
4. Confirm the downloaded manifest reports `2026.10.0b2`.
5. Restart Home Assistant once after the Python integration update.
6. Check existing MotoGP entities and HA logs before touching the dashboard.

Do not run the old `install-session-archive-beta.py` overlay or the historical upstream 1.0.10 patch over this HACS version.

## What HACS updates

HACS replaces the Python integration under `custom_components/motogp_sensor/`. It does not manage:
- `/config/motogp_data/`;
- the old observation JSONL;
- `/config/www/ha-motogp-next.js`.

## Next dashboard dev.5

The timezone-corrected Next JS is a separate update. It is still one resource at `/local/ha-motogp-next.js`; do not add a duplicate Lovelace resource. The pinned installer verifies the expected JS blob before replacing the file.

After updating the JS, a hard browser reload may be needed if the browser still serves an older frontend file.

## Live acceptance checks

During a session:
- `sensor.motogp_session_status` may move `I/S → R → I/S` without leaving the session.
- Under Red Flag/Delayed, live entities should continue receiving coordinator updates on the active cadence rather than pausing for five minutes.
- `sensor.motogp_next_race` should expose `time_zone`; its `sessions_all` entries should contain `date_utc` when timezone metadata resolved.
- In Sweden on 2026-10-09, the Mandalika Moto2 Practice wall time 14:05 should render as 08:05 in the Next dashboard.

Archive checks remain read-only: inspect new JSON only after a qualifying session; do not fabricate missing laps or import the old JSONL automatically.

## Rollback

Preferred rollback is the Home Assistant backup. Alternatively, use HACS to select the previously known working tagged beta, then restart HA once. Do not delete the HA MotoGP config entry merely to change code versions. Preserve `/config/motogp_data/` and the separate frontend file.
