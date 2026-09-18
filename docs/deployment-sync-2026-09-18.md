# Home Assistant ↔ GitHub deployment inventory — 2026-09-18

**Purpose:** distinguish deployed facts, repository source, prototypes and unverified assumptions. This is not a claim that GitHub already contains the complete live HA setup. The snapshot is based on the user-shared HA configuration/logs/screenshots and the repository contents inspected 2026-09-18. We cannot read `/config` on the running HA host through the GitHub connection.

## 1. Deployment ledger

| Component | HA observation / status | GitHub representation on `dev` | Drift / action |
| --- | --- | --- | --- |
| Python integration | Upstream `Liionboy/motogp_sensor`, locally modified; exact installed manifest version, files and hashes not supplied. The HA sensor's `sessions_all` included 20 passes over MotoGP/Moto2/Moto3 on 2026-09-17. | Historical version-gated v1.0.10 patch in `scripts/`; architecture in `backend/README.md`. | **Critical: deployed multi-category implementation is not fully in GitHub. Capture original files before any backend integration/update.** Do not run the old patch again or use `--force`. |
| JS test card | User screenshot showed independent Card-test card with build footer and expandable multi-day schedule. | `frontend/ha-motogp-card.js` v0.1.0-dev.3, embedded build `0b493073ef59`; `dashboard/motogp_custom_card_dev.yaml`. | Browser/host file hashes not yet captured. Query parameter is not version proof. No further JS version changes in this documentation sync. |
| Legacy dashboard | Existing separate working dashboard; exact live Lovelace export not obtained. | `dashboard/*_wip.yaml` are older reference prototypes, **not** a verified dashboard export. | Preserve working dashboard; capture separately if we need migration/cleanup, and never overwrite it for dev-card tests. |
| Dashboard-mode package | User showed `/config/packages/motogp_dashboard_mode.yaml` and identical duplicate `motogp_dashboard_mode_package.yaml` (only a trailing blank line differed). | No corresponding installable package tracked in this repo as of this audit. | One active package remains on HA. Audit actual file/other helpers and decide whether to version-control a sanitized copy later. Do not generate a duplicate package. |
| Result history | No installed history browser, results service or persistent archive demonstrated. | `backend/result_archive.py`, `tests/test_result_archive.py`, `.github/workflows/backend-results-check.yml`, `docs/historical-results.md` on `dev`. Fake-API CI succeeded 2026-09-18. | Code is isolated and not installed. Real old FP1 endpoint, store integration, frontend selector and rollback still need validation. |
| TV delay | Existing backend delay mentioned in earlier UI work, precise deployed implementation/version not captured. | `backend/README.md` is a design, not deployable delay code. | Capture running code/settings before implementing or claiming parity; no unverified replacement. |

`beta` and `main` were both at `c24ee59e6cfe5e6504da77a41fb4a1559cc99949` when checked; `dev` contains unpromoted frontend/results work.

## 2. Sept 17 package cleanup: documented, not yet deleted

Home Assistant reported six packages with `expected dict or list or None at 'type'`. A guarded local script moved **exactly six** matching files containing top-level `type:` out of `/config/packages` into `/config/.motogp_cleanup_quarantine`, reporting `Flyttade: 6`, `Överhoppade: 0`:

1. `00_motogp_complete_stack.yaml`
2. `01_motogp_header.yaml`
3. `02_motogp_schedule_with_selector.yaml`
4. `03_motogp_status_grid.yaml`
5. `04_motogp_live_timing.yaml`
6. `05_motogp_results_vm_expander.yaml`

A `grep` comparison then located duplicate helper definitions (`motogp_calendar_preview`, `motogp_postrace_until`) in two active package files. `diff -u` revealed only one extra trailing blank line in `/config/packages/motogp_dashboard_mode.yaml` compared with `/config/packages/motogp_dashboard_mode_package.yaml`. A guarded script kept the former and moved the latter to:

`/config/.motogp_cleanup_quarantine/packages/motogp_dashboard_mode_package.yaml`

**Exactly seven files were quarantined, zero files deliberately deleted.** User later reported **no HA repair warnings**. A complete output from `ha core check`, an inventory of active package references and an explicit clean start log were not supplied here. Therefore record this as *warnings apparently resolved, final purge pending dependency and restore verification*, not as permission to delete the quarantine.

The `/config/.ha-git/` directory is a backup; grep hits there do not mean the same helpers are actively loaded. Conversely, no-repair UI alone does not prove a complete config inventory. Do not put the quarantine back under an active `packages` include.

## 3. Safe capture of the real Python baseline — BEFORE further changes

The user or an authorized HA-side tool must supply an archive of **only the relevant installed integration source**, not the whole HA config. Suggested paths from `/config/custom_components/motogp_sensor/`:

- `manifest.json`, `__init__.py`, `api.py`, `const.py`, `coordinator.py`, `helpers.py`, `sensor.py`, `entity.py` and any other project-owned `.py` modules that are actually present.
- Inventory names, SHA-256 hashes and file sizes, and separately note installed HA/HACS integration version, current `sensor.motogp_next_race` attribute names and frontend build footer.
- A sanitized copy of the retained package `motogp_dashboard_mode.yaml` if package ownership/migration is to be tracked.

**Review every file before sharing or committing.** Never archive `/config/secrets.yaml`, `.storage`, HA auth/tokens, credentials, cookies, recorder database, `.ha-git` backups, quarantine or the whole `/config`. If source files contain embedded API tokens/credentials, redact them before sharing and do not commit secrets. For GitHub, use the connection to commit reviewed code on `dev` only, not a blind HA backup push.

Once the actual files are available: compare against the original upstream v1.0.10 commit and `scripts/patch_motogp_sensor_v1_0_10.sh`; identify *all* extra deployed changes, ownership and conflicts; turn them into a reproducible patch/integration source with tests; document exact install/rollback and configuration schema; only then wire in the isolated results archive. This source-capture gate cannot be marked complete by documentation alone.

## 4. One rule for every future change

Change proposal → identify owning source file and branch → update code and tests on `dev` → document what was tested in GitHub CI versus actual HA → deploy in separate test view/integration with version or hashes → verify/no-spoiler/restart/rollback → explicitly remove or quarantine replaced HA files after reference audit → promote via reviewed PR `dev → beta → main`. Every deletion must list the replacement and the remaining references. Do not keep two active packages defining the same helper and do not treat a Lovelace `type:` card as a HA package.

## 5. Remaining validation tickets

- Capture and sync actual multicategory Python integration baseline; **blocking** for real historical-results integration and TV-delay modifications.
- Capture live package and dashboard/resource inventory; determine if any quarantined YAML is referenced and whether archive can safely be purged.
- Validate API data for a real older Moto2 FP1 and other categories; unit tests on a fake API are insufficient.
- Verify archive persistence under real HA Store, spoiler behavior on async completion, current/previous race transitions, API outage and safe rollback.
- Address known JS polish on `dev` with a new build/version and actual Card-test verification; keep `beta`, `main`, original dashboard untouched meanwhile.
