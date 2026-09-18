# Home Assistant ↔ GitHub deployment inventory — 2026-09-18

**This ledger distinguishes actual installed evidence, tracked GitHub files, plans and unverified assumptions.** See [the exact deployed Python audit](deployed-python-audit-2026-09-18.md) for source hashes and upstream comparison. Access to GitHub does not by itself grant access to `/config` on the HA host.

## Deployment ledger

| Component | Verified/user-observed HA status | What is in GitHub `dev` | Gap |
| --- | --- | --- | --- |
| Running Python | User exported ZIP at 19:24 CEST and uploaded it here. Archive integrity and inventory SHA-256 verified: 14 files, manifest version **1.0.9**, 13 `.py` syntax checks pass. Exact Git blob comparison vs upstream `v1.0.9`: **9 identical, 5 modified** (`api.py`, `const.py`, `coordinator.py`, `helpers.py`, `sensor.py`). | Old **v1.0.10-only** patch; separate audit with full source hashes and feature inventory. | **The exact five local source files/ZIP are not yet checked into GitHub**, and patch-script provenance is incomplete. Do not overwrite live 1.0.9 with older tracked patch or force it. |
| Frontend Card-test | User screenshot showed new separate card, build footer and multicategory schedule. | `frontend/ha-motogp-card.js` v0.1.0-dev.3 / build `0b493073ef59`; YAML for test card and tests. | Running host JS file hashes and final HA behavior not fully verified. Resource query alone is not build proof. |
| Legacy dashboard | Exists independently and should remain working. | `dashboard/*_wip.yaml` are reference prototypes, not a confirmed current export. | Avoid touching it while testing the new card. |
| Active display-mode package | `/config/packages/motogp_dashboard_mode.yaml` retained; its identical duplicate (only trailing blank line) quarantined. | Package source not yet tracked as an installable file. | Capture sanitized canonical package only if required; do not create a second active copy. |
| Historical results | No permanent official session-results browser installed. | `backend/result_archive.py` and tests, isolated CI passed with fake API. | Needs integration against actual backend, HA Store, real historical Moto2 FP1 endpoint and UI. |
| TV delay, lap history, grid and records | Source inspection confirms all exist in exported customized Python. TV helper: `input_number.motogp_tv_delay_seconds`; clamp 0–300 s; active polling 5 s. | Historical patch and roadmap do not reproduce all these features. | Capture five changed sources and local `.sh` patch provenance before modifying. |

`dev` is the only development branch touched; `beta`, `main` and the running HA installation have not been altered by this GitHub documentation reconciliation.

## Source capture: completed vs incomplete

The actual uploaded `motogp_source_review.zip` is 28,424 bytes and includes `INVENTORY.txt`, 13 `.py` modules and `manifest.json`. ZIP CRC check passed, 14 inventory checksums match, 13 source files parse as Python, and the manifest matches upstream tag `v1.0.9` exactly. Scan for several obvious embedded credential patterns showed no hits; **not a full secret/security review**. The attachment is present in the conversation, not part of the GitHub repository. [Full audit, five local SHA-256 hashes, risks, and scope](deployed-python-audit-2026-09-18.md).

Source functionality present: multicategory `sessions_all`/`schedule_categories` and season calendar; snapshot-based TV delay; five-second active polling; lap history; grid, records and weather; postrace event advance; official `async_get_classification` API method. The latter is not an installed historical archive. Actual source includes `api.py`, `const.py`, `coordinator.py`, `helpers.py`, `sensor.py` changes relative to the upstream 1.0.9 Git objects. This evidence corrects older status documents that described deployed versions/contents as unknown.

**Not captured by the ZIP:** contents of the local `motogp_*.sh` patch scripts shown in the user's VS Code screenshot; live Lovelace export; currently loaded JS file hashes; config helpers outside the Python integration; a real response from an old Moto2 FP1 classification endpoint. Never automatically commit `/config`, `.storage`, secrets, the HA database, backups or quarantine. The old `scripts/patch_motogp_sensor_v1_0_10.sh` requires v1.0.10 and should not be reapplied or forced onto installed v1.0.9.

## Sept 17 package cleanup: completed, quarantine remains

HA had six Lovelace card YAML files accidentally interpreted as packages (`expected dict or list or None at 'type'`). Exactly these six files were moved from `/config/packages` to `/config/.motogp_cleanup_quarantine`:

- `00_motogp_complete_stack.yaml`
- `01_motogp_header.yaml`
- `02_motogp_schedule_with_selector.yaml`
- `03_motogp_status_grid.yaml`
- `04_motogp_live_timing.yaml`
- `05_motogp_results_vm_expander.yaml`

Two duplicate package files both defined `motogp_calendar_preview` and `motogp_postrace_until`. Diff revealed only a trailing blank line. Retained `/config/packages/motogp_dashboard_mode.yaml`; moved duplicate to `/config/.motogp_cleanup_quarantine/packages/motogp_dashboard_mode_package.yaml`. **Seven files quarantined; none deleted.** User subsequently reported no repair warnings. There is no recorded complete `ha core check` output or final reference/dependency audit; do not delete quarantine yet. `.ha-git` copies are backups, not automatically active packages.

## Actual next steps and safeguards

1. **Reproducible backend snapshot:** transfer a reviewed exact source snapshot (prefer the five modified source files with a reproducible upstream v1.0.9 reference, or exact checked ZIP) onto `dev`; validate its hashes against the uploaded inventory. Repository documentation alone does not make the full source version-controlled. Inspect `motogp_*.sh` scripts for provenance, detect duplicated/obsolete mutations, and document build and rollback.
2. **History API:** test a real old event/category/session UUID including Moto2 FP1, verify real response structure and delayed publication; integrate `ResultArchive` via the installed coordinator/API and HA Store with an explicit results action and no-spoiler checks at the response/UI boundary.
3. **Race transition:** verify whether post-race `next_event` switching can temporarily disagree with cached `weekend_sessions_all`; test with realistic event data before attempting a fix.
4. **Cleanup and UI:** inventory active package references, keep legacy dashboard untouched, implement known frontend polish under a new dev build, verify in Card-test and clean quarantine only after explicit verification.
5. **Release discipline:** code and tests on `dev`, document CI versus HA validation, check install/rollback, then reviewed PR `dev → beta → main`. No blind update of running integration and no unverified claim of parity.

Track source reconciliation under [issue #1](https://github.com/Jocke1970/ha-motogp/issues/1).