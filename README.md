# ha-motogp — MotoGP Sensor + Next UI

An independent Home Assistant companion and derived version of [Liionboy/motogp_sensor](https://github.com/Liionboy/motogp_sensor). Not affiliated with MotoGP or Dorna.

## Installation: HACS beta

**Use [the complete HACS beta installation and rollback guide](docs/hacs-beta-installation.md).** Add `https://github.com/Jocke1970/ha-motogp` as a HACS **Integration** custom repository and select the tagged prerelease **`v1.0.9.1b1`**. The repo provides one integration at `custom_components/motogp_sensor/` with the *same* domain as upstream. It is a **replacement**, not a second integration.

Back up Home Assistant before switching HACS sources. Remove the old repository **inside HACS**, not the existing MotoGP config entry in Settings > Devices & services. Restart HA once after replacing the integration. Never stack the old `install-session-archive-beta.py` patch or the unrelated 1.0.10 patch on top of the HACS edition.

The integration writes sessions to `/config/motogp_data/` outside its own directory, so the JSON archive survives HACS upgrades. Existing `.jsonl` observation captures are separate input files, not automatically imported archives. The Next frontend `/local/ha-motogp-next.js` remains independently installed and unchanged.

## What's in first HACS beta

- Full audited locally deployed 1.0.9 Python integration with a single tested archive hook.
- TV-delayed session snapshots archived by event, category and session ID into persistent JSON; restart restoration.
- Domain, entity naming and configured HA integration entries preserved in code.

Not included: replay JSONL importer, lap-history UI API, rider expanders and class-specific Moto2/Moto3 championship data. Real-race and migration tests occur during beta, not before beta.

See [release notes](docs/hacs-beta-release-notes.md), [original archive design](docs/session-archive-beta1-2026-09-20.md) and [legacy 1.0.10 patch notes](docs/local-patch-v1.0.10.md) (historical reference only; **do not run that patch** for this HACS beta).

`dev` is a development branch. `beta` holds beta source. HACS uses the **tagged release**; do not select an unspecified branch when installing this beta.
