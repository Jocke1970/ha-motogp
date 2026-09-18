# Home Assistant ↔ GitHub deployment inventory — 2026-09-18

**Distinguish actual deployment evidence, checked-in files, and remaining gaps.** Live Home Assistant is never automatically synced merely because a GitHub commit exists.

| Component | Verified status | Remaining work |
| --- | --- | --- |
| Running Python | Exact customized upstream `motogp_sensor` v1.0.9 source: 14 files plus inventory committed to `dev` in [`0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f). [Source integrity CI passed](https://github.com/Jocke1970/ha-motogp/actions/runs/35378743131). Nine files match upstream, five changed locally. | This is a one-time snapshot, not deployment tests or continuous sync. Do not run the legacy v1.0.10-only patch against customized v1.0.9. |
| Dashboard-mode package | Active `/config/packages/motogp_dashboard_mode.yaml` independently exported, byte-matching [`config/packages/motogp_dashboard_mode.yaml`](../config/packages/motogp_dashboard_mode.yaml) on `dev`. One duplicate package previously quarantined. | Do not run old package installer; it overwrites the active file. Capture other active helper/dashboard references before further cleanup. |
| Eleven historical patch/install scripts | Provenance ZIP inspected; ten Python feature families visible in the deployed snapshot. Read-only scan on actual HA: 6,618 configuration files checked, **0 references**, 8 large files skipped (7 EPG XML, one brand-icons JS); no files moved. | New [`quarantine_motogp_patches.py`](../scripts/quarantine_motogp_patches.py) scans large files in chunks, rechecks ZIP and live hashes/collisions, and only moves eleven scripts when explicitly given `--apply`. Synthetic tests passed; **not executed on host yet**. External cron/add-ons remain unverified. [Runbook](patch-quarantine-runbook-2026-09-18.md). |
| Seven old YAML files | Six misplaced Lovelace cards and duplicate display-mode package moved to `/config/.motogp_cleanup_quarantine` previously; user reports no repair warnings. | Separate reference check before permanent deletion. |
| New frontend / Card-test | `v0.1.0-dev.3` metadata and independent JS card seen in screenshots. Actual `/config/www/ha-motogp-card.js` Git blob differs from dev source despite identical version/build metadata. | Exact diff and browser-loaded version needed before replacing any JS; legacy dashboard untouched. |
| Historical results | Isolated `backend/result_archive.py` with fake-API tests on `dev`. | Not installed. Validate actual old Moto2 FP1 classification, integrate persistent storage, spoiler-safe API and selector, restart/rollback and real HA tests. |

**Do not permanently delete anything at this stage.** The existing provenance ZIP and source ZIP are still rollback/audit material, the active package and JS are not patch debris, and the running integration has not been altered by repository operations. `dev → beta → main` promotion is still pending review.

[Source audit](deployed-python-audit-2026-09-18.md) · [Patch audit](provenance-cleanup-2026-09-18.md) · [Project status](project-status.md) · [Issue #1](https://github.com/Jocke1970/ha-motogp/issues/1)
