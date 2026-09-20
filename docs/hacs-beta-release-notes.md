# MotoGP Sensor (ha-motogp) v1.0.9.1b1 — first HACS beta

Complete installable derivative of the locally audited `motogp_sensor` 1.0.9 integration, adding a permanent, TV-delay-gated per-session lap archive.

- Preserves the `motogp_sensor` domain and current entity naming.
- Writes JSON under `/config/motogp_data/`, not inside the HACS-owned integration directory.
- Records distinct session/event/category IDs, restores existing session JSON after restart, and saves corrected laps atomically.
- HACS manages the complete integration; no separate `install-session-archive-beta.py` patch is needed.
- Does **not** include a replay JSONL importer, lap-history UI API/expanders, Moto2/Moto3 championship backend, or Next JavaScript UI updates.

**Beta risks:** HACS migration, real race transitions, interrupted writes and restart behavior on the actual host remain to be verified during beta usage. An offline HA cannot guarantee capturing missed laps.

**Migration warning:** Back up HA first. Remove the **original repository from HACS**, never the MotoGP config entry under Devices & services. Add `https://github.com/Jocke1970/ha-motogp` as HACS custom Integration, download **this exact version**, restart HA. Do not layer this HACS release on top of the old Python overlay script or v1.0.10 patch. See [full installation and rollback instructions](https://github.com/Jocke1970/ha-motogp/blob/beta/docs/hacs-beta-installation.md).

Based on [Liionboy/motogp_sensor](https://github.com/Liionboy/motogp_sensor); not officially affiliated with MotoGP.
