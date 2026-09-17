# ha-motogp-card · development preview

This is a **standalone Lovelace JavaScript custom card**; no `button-card`, `expander-card`, npm, Python process or extra `input_text` helpers are needed for the expanders. **It is in `dev` only** until tested in a real Home Assistant installation.

## Install the dev preview

1. From the `dev` branch, take **`frontend/ha-motogp-card.js`**, place it at `/config/www/ha-motogp-card.js` in Home Assistant (this is a file, not a shell command).
2. Home Assistant → Settings → Dashboards → Resources → Add resource: URL `/local/ha-motogp-card.js?v=0.1.0-dev.1`, type **JavaScript module**. If the resource already exists, update its URL/version instead of registering duplicates. Reload the browser fully.
3. In the *test dashboard*, replace the current schedule and timing `vertical-stack` cards with the contents of [`dashboard/motogp_custom_card_dev.yaml`](../dashboard/motogp_custom_card_dev.yaml). Do not keep the old cards active alongside the new ones while comparing responsiveness.
4. The card offers `mode: both` (default), `mode: schedule`, and `mode: timing`; choose two separate cards if you want to position them independently. All entity IDs can be overridden using the `entities:` dictionary in the YAML example.

## Existing data contracts

- `sensor.motogp_next_race`: preferably `attributes.sessions_all` (multicategory) and `schedule_categories`. Falls back to `attributes.sessions` (single category). The original upstream integration **does not provide `sessions_all`** on its own; keep the working local multicategory backend while testing.
- `sensor.motogp_current_session`: state (e.g. FP1), attributes `category` and `event`.
- `sensor.motogp_session_status`: state and `session_status_id`. IDs `I` and `S` mean live.
- `sensor.motogp_rider_positions`: attributes `riders`; each rider has `position`, name, team, bike, number, laps and gaps.
- `sensor.motogp_race_lap_count`, `sensor.motogp_session_time_remaining`.
- `input_select.motogp_schedule_category` optionally selects Total/MotoGP/Moto2/Moto3/MotoE; the card still works if absent (defaults to Total).

## UI behaviour

- Expanding a day or timing table is local JavaScript state: **no HA service call or 5-second render timer**. Only one day is open. Today's day is auto-open if present; a manual choice lasts until local midnight.
- Timing header is always visible. The rider list opens when the feed becomes active and stays available after finish/while next session waits, until next live session or midnight. You may override open/closed without the next feed update undoing it.
- Session identity uses **category + session name + event**. A Moto3 FP1 must not light up MotoGP FP1. Day must match today's wall-date for current-session highlighting.
- The final snapshot is **browser memory only**; a page reload can lose the last finished session. A future Python/backend snapshot cache should address this.
- The card does not control the integration and does not yet implement TV-delay, automatic category switching or the old `button-card` gap-trend arrows. It displays data from the entities as received.
- Current date parsing intentionally preserves observed Pulselive *event-local wall time*. Correct worldwide conversion to the user's zone needs backend circuit timezone information; the current approach may show incorrect local times outside the track's timezone.

## Troubleshooting

- `Custom element doesn't exist: ha-motogp-card`: check the resource URL/module type; browser refresh; confirm the file is in `/config/www` and served at `/local/ha-motogp-card.js`.
- No sessions: inspect `sensor.motogp_next_race` → `sessions_all` (or `sessions`). Upstream's single-category schedule patch is not sufficient for Total.
- Timing stays closed: check `sensor.motogp_session_status` and `sensor.motogp_rider_positions` plus their `category` attributes. Open manually to inspect an empty feed.
- To compare latency, measure click-to-visible on the same device without loading the legacy button-card variant alongside it. We have **not** measured this custom card in the user's HA yet.

## Branch promotion

`dev` → `beta` → `main` through explicit review/merge. The old prototypes and production dashboard in `main` remain untouched. Create a PR from `dev` to `beta` after HA testing, then `beta` to `main` once regression checks and TV/no-spoiler behaviour are reviewed. Do not merge or install this preview automatically.
