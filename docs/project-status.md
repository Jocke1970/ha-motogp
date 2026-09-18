# MotoGP project status — 2026-09-18

## Source and branch truth

- Running HA Python: reviewed customized upstream `motogp_sensor` **v1.0.9**. The exact 14 source files and checksums were committed to `dev` in [`0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f); source-integrity CI passed. Nine files match upstream v1.0.9, five are locally modified (`api.py`, `const.py`, `coordinator.py`, `helpers.py`, `sensor.py`). This is an exact snapshot, **not continuous sync or runtime validation**. [Detailed audit](deployed-python-audit-2026-09-18.md).
- Branch discipline: `dev` only for these changes; no promotion to `beta` or `main`. The working legacy HA dashboard and live Python installation remain untouched by GitHub changes.
- Active HA package `/config/packages/motogp_dashboard_mode.yaml` was independently exported, hash-verified and checked in as a **reference copy** on `dev` at [`config/packages/motogp_dashboard_mode.yaml`](../config/packages/motogp_dashboard_mode.yaml). Do not re-run its historical installer; it overwrites the live YAML.

## UI

- New standalone frontend in Card-test: [`frontend/ha-motogp-card.js`](../frontend/ha-motogp-card.js), `v0.1.0-dev.3` / build `0b493073ef59`; current frontend category/day/session behaviors were observed previously. Legacy dashboard untouched.
- **Open drift:** actual HA `/config/www/ha-motogp-card.js` bytes differ from GitHub dev frontend despite matching visible version/build metadata. Do not overwrite HA JS until an exact diff and browser resource validation; issue new build ID for any correction. Known frontend polish: invalid weather placeholders, optional prestart rider list with session identity, next scheduled day ahead of weekend.

## Patch provenance and cleanup

- User-uploaded provenance ZIP reviewed: 11 original patch/install scripts, one active package and one actual HA frontend. The ten Python feature families in historical scripts appear in the committed 1.0.9 end state; source presence is **not** exhaustive runtime verification. [Per-script audit](provenance-cleanup-2026-09-18.md).
- HA operator ran read-only filename-reference scan: 11 individual script hashes matched, 6,618 config text files scanned, **zero matches**, but eight large files skipped (seven EPG XML + custom-brand-icons JS). No files moved. External cron/add-ons/manual commands remain outside scanner scope.
- A second hash-gated [`quarantine_motogp_patches.py`](../scripts/quarantine_motogp_patches.py) is committed and synthetic-tested. It scans large files in chunks, confirms live 14-file snapshot/provenance, refuses references/collisions, and moves only 11 old scripts into the existing quarantine on explicit `--apply`. **Not yet executed in HA, not permanently deleted.** [Runbook](patch-quarantine-runbook-2026-09-18.md).
- Seven old misplaced/duplicate package YAML files were previously moved to a separate quarantine. User reported repair warnings disappeared; permanent deletion and reference audit remain open.

## Historical results and risks

- [`backend/result_archive.py`](../backend/result_archive.py) has isolated fake-API tests but is **not connected to live HA, persistent Store, service or Card-test UI**. Need an actual older Moto2 FP1 classification with event/category/session UUID and missing-result handling before claiming historical browsing works.
- Source-based risks: postrace next-event can precede schedule refresh; static last-race-results may escape live-only no-spoiler guards; lap history is memory-only and may be partial after restart. These are not confirmed runtime incidents.

## Next gates

1. Run the safer, explicitly opt-in quarantine check on HA and verify scripts can be moved without references/collisions; review external cron/add-on workflows and validate HA before approving **separate** permanent deletion.
2. Resolve exact HA versus GitHub JS diff; verify actual loaded browser resource and fix through a new uniquely stamped dev build without touching old dashboard.
3. Audit remaining references to the seven quarantined YAML files and capture current dashboard resource/helper ownership.
4. Integrate/test spoiler-safe persistent history on the exact verified backend, then validate and document safe deployment/rollback before any `dev → beta → main` promotion.

[Full deployment ledger](deployment-sync-2026-09-18.md) · [GitHub Issue #1](https://github.com/Jocke1970/ha-motogp/issues/1).
