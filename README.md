# ha-motogp — development

Independent Home Assistant companion/derived integration based on [Liionboy/motogp_sensor](https://github.com/Liionboy/motogp_sensor). Unaffiliated with MotoGP or its rights holders.

> **Current operational truth — 2026-10-09:** backend candidate **2026.10.0b2** is green on `dev` and is being promoted through **dev → beta → main**. `main` remains untouched until the beta has been exercised during real sessions. See [project status](docs/project-status.md), [beta notes](docs/hacs-beta-release-notes.md) and [install/rollback](docs/hacs-beta-installation.md).

## What changed for the October weekend beta

> **2026.10.0b1 is withdrawn from use.** It contains a module-import crash in the Broadcast event URL constant (`{uuid}` was eagerly interpolated by an f-string). Use **2026.10.0b2** or later.

- **Red Flag / Delayed remain hot:** session states `R` and `D` now keep the coordinator on the 5-second live polling cadence instead of falling back to the 300-second idle cadence. The same live-session set is used by `session_in_progress` and live-condition refresh.
- **Schedule timezone normalization:** Results API venue wall-clock session times are converted with the event IANA timezone obtained from the Broadcast API. Backend exposes both original `date` and normalized `date_utc`, plus `sensor.motogp_next_race.time_zone`.
- **Next UI dev.5:** the independent one-file dashboard prefers `date_utc` and renders the browser/HA user's local time. It keeps the previous wall-time parser only as a fallback. The verified bundle blob is `4c73aa7f22ec8876b77beede369d565e86e08e0d`.
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

The first archive-created session JSON and restart/session-boundary behavior still require direct on-host inspection; do not infer archive completeness merely from a green build.
