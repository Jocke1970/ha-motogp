# HACS beta: MotoGP session archive

Status: **beta distribution**, not yet proven in a real MotoGP session on the target Home Assistant host. This is an independent local derivative of Liionboy/motogp_sensor, not an upstream or official MotoGP release.

## What is included

- The complete `motogp_sensor` integration from the audited, locally deployed 1.0.9 baseline, plus the tested session-lap archive coordinator hook and `session_lap_archive.py`.
- Integration domain `motogp_sensor`, existing entity naming and existing HA config entries remain the same.
- Persistent JSON files written beneath `/config/motogp_data/`; HACS does not manage this directory. Files survive integration replacement and HACS updates.
- TV-delay-ready snapshot gating, event/category/session IDs, safe/atomic writes, resume from existing files after an HA restart.

Not included: Replay importer for previously recorded `.jsonl`, lap-history UI API/expanders, class-specific Moto2/Moto3 championship standings. `motogp-lap-observations-*.jsonl` is **not** an archive JSON. HACS does not install or manage the separate `/local/ha-motogp-next.js` frontend resource.

## IMPORTANT: migration from the existing HACS upstream integration

**Do not install two repositories that manage the same `motogp_sensor` domain simultaneously. Do not delete the MotoGP config entry from Settings > Devices & services. Do not use the old 1.0.10 patch or the pre-HACS beta overlay installer after switching.**

1. Create a full Home Assistant backup and preserve a copy of the existing `/config/custom_components/motogp_sensor/` directory for rollback. Keep `/config/motogp_data/` and any recorded `.jsonl` files outside the integration directory.
2. In HACS, open the currently installed upstream `Liionboy/motogp_sensor` repository and use its **Remove** action. This removes its managed integration files; it is not the similarly named **Delete integration** action under HA Settings > Devices & services. Do **not** restart HA in between removing old code and installing the replacement. If HACS reports a duplicate repository or cannot remove cleanly, stop; do not delete files in `.storage`.
3. In HACS menu `⋮` > **Custom repositories**, enter `https://github.com/Jocke1970/ha-motogp`, choose category **Integration**, add it.
4. Open `ha-motogp` / `MotoGP Sensor (ha-motogp)` in HACS. Choose **Download**, then choose the **`v1.0.9.1b1` prerelease** (not the default branch or a legacy `1.0.10` update). Ensure the displayed version matches before confirming. If that release is not available, **stop instead of selecting an unspecified branch**.
5. Confirm that `/config/custom_components/motogp_sensor/manifest.json` reports version `1.0.9.1b1` and that `session_lap_archive.py` is present. Restart Home Assistant once to load the Python integration.
6. Verify existing MotoGP entities and original dashboard still load, and check HA logs for `motogp_sensor` exceptions. The archive folder is created only when a qualifying TV-delayed session snapshot is received; its absence immediately after install is normal.

**Do not press HA's Remove integration action** during this migration; it deletes the config entry and may force reconfiguration. The HACS Remove action affects the downloaded integration code and may have additional version-specific UI effects; the full HA backup is required.

## Subsequent HACS updates

Use the same custom repository. Download the newer tagged release in HACS and restart HA. Beta tags have distinct versions; do not switch back to upstream without explicitly deciding to migrate. No manual Python patching and no second Lovelace resource.

## Rollback

1. If the HACS beta fails, restore the full HA backup (most reliable), or remove the beta **from HACS**, re-add/download `Liionboy/motogp_sensor` through HACS and restore the original audited integration directory as appropriate. Restart HA.
2. Do not remove the MotoGP config entry from HA. Do not delete `/config/motogp_data/` or the observational JSONL.
3. If you previously used the overlay script and its `.motogp_session_beta/current.json` marker is present, **stop** and use that script's documented rollback first; do not stack HACS on top of a patched folder.

## Limitations of first beta

The standalone archive engine has automated tests and the complete candidate has been built and syntax-checked. Real-session behavior, Home Assistant shutdown while writing, transitions during red flags, and HACS migration on the user's host are **not yet practically tested**. A host outage may create gaps; missing laps are not fabricated. This beta deliberately does not expose historic laps to Lovelace before a spoiler/authorization-safe API exists.

Upstream credit: [Liionboy/motogp_sensor](https://github.com/Liionboy/motogp_sensor). Issues for this derived beta: [Jocke1970/ha-motogp/issues](https://github.com/Jocke1970/ha-motogp/issues).