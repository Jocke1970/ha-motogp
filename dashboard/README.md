# MotoGP dashboards — separate the working view from experiments

**Current development path:** standalone [`custom:ha-motogp-card`](../frontend/README.md) in the separate **Card-test** Home Assistant view. Its example card configuration is [`motogp_custom_card_dev.yaml`](motogp_custom_card_dev.yaml). The distributed JS resource is [`frontend/ha-motogp-card.js`](../frontend/ha-motogp-card.js); verify its embedded version in the card footer. This dev component does not yet reproduce every feature of the user's original dashboard.

**Existing working/legacy dashboard:** preserve it. The files in this repository are not a verified full export of the running legacy dashboard, and updating an experimental YAML card is not permission to alter the original dashboard.

## Reference material, NOT active HA packages

- `event_header_wip.yaml` — older `custom:button-card` header prototype.
- `live_timing_card_wip.yaml` — older `custom:button-card` timing prototype.
- `weekend_schedule_2col_wip.yaml` — older two-column schedule prototype.

The WIP files are historical/reference implementations, **not the active JS test card**. Their saved content may lag behind edits made directly in Home Assistant. Do not install them into `/config/packages`: Lovelace YAML beginning with `type:` is a card configuration, not a valid Home Assistant package.

## What was cleaned up on the HA host?

On 2026-09-17/18, six misplaced old MotoGP Lovelace YAML files were moved out of `/config/packages` into `/config/.motogp_cleanup_quarantine`, and a duplicate `motogp_dashboard_mode_package.yaml` was quarantined. The active `motogp_dashboard_mode.yaml` was retained. User reported no repair warnings afterward. **These files were not deleted and their final removal has not been approved or verified against all dependencies.** The repo's WIP files above were not deleted; they are explicitly reference material. See [cleanup inventory](../docs/deployment-sync-2026-09-18.md).

## Design and data constraints

The JS test card expects `sensor.motogp_next_race.attributes.sessions_all` for multi-class schedule. That field comes from local backend modifications not yet captured completely in this repo; the old tracked v1.0.10 patch is not a replacement. Preserve category + session + event identity and no-spoiler protections. Event times currently use a wall-clock workaround; timezone-aware normalization belongs in Python.

Follow `dev → beta → main` after real HA verification, and remove an obsolete implementation only after the replacement and remaining references have been confirmed. Do not make parallel active cards or duplicate HA helpers without documenting ownership.
