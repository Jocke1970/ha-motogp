# MotoGP project status — 2026-09-18

**Verified source milestone:** The actual running HA `motogp_sensor` Python v1.0.9 was exported, audited and committed as an exact 14-file source snapshot on `dev` in commit [`0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f). The source integrity workflow [passed](https://github.com/Jocke1970/ha-motogp/actions/runs/35378743131). Nine files matched upstream tag v1.0.9 and five were locally modified. The running HA integration was not changed by capture. [File audit and hashes](deployed-python-audit-2026-09-18.md).

**Package milestone:** The active `/config/packages/motogp_dashboard_mode.yaml` was exported, reviewed and committed as an exact byte-matching reference at [`config/packages/motogp_dashboard_mode.yaml`](../config/packages/motogp_dashboard_mode.yaml), SHA-256 `ed6c84f274d5b7d3af638012d68b0609e2ec5ff4eeb0cd5dfe2f89c1503cc769`. This is a repo source file, **not another deployed HA package**. The old `install_motogp_dashboard_mode_package.sh` regenerates the same YAML but overwrites it unconditionally, so do not rerun it. Only one active package remains in HA after the prior duplicate cleanup; user observed no HA repair warnings.

**Patch provenance milestone:** The 13-file user-uploaded provenance ZIP contains eleven historical `.sh` scripts, the package and live JS resource. ZIP member hashes/CRC verified, script effects statically reviewed against the committed Python snapshot. All ten Python patch feature families are represented in that snapshot. Full disposition, limitations, risks and deletion gates: [provenance cleanup audit](provenance-cleanup-2026-09-18.md). Shell scripts have **not** been copied to public GitHub, executed, quarantined or deleted. Active references on the HA host and external cron/add-on callers remain unknown. A [hash-guarded, read-only reference scanner](../scripts/audit_motogp_patch_references.py) is ready on `dev` and has passed synthetic tests for zero and one reference; run it on HA before deciding to move anything. The user's non-MotoGP scripts are out of scope.

**JS drift:** The export of actual `/config/www/ha-motogp-card.js` has Git blob `10f995c8622036beae117ae11c791a682bbeeac1`, while `dev/frontend/ha-motogp-card.js` is `fef8e3e4f09d30f01385d6e8417e96ae923cb65d`. Both embed `v0.1.0-dev.3` and build `0b493073ef59`; bytes differ. A substantive diff and browser-loaded verification are **outstanding**. Preserve the current HA JS and separate Card-test; do not overwrite or claim a complete frontend mirror based on matching displayed version.

**History:** `backend/result_archive.py` and fake-API tests are only an isolated `dev` prototype. Still need a real historical Moto2 FP1 response, HA Store wiring, no-spoiler checks at retrieval and response/UI boundaries, restart/rollback tests and a Card-test history selector. No live result archive is installed.

**Cleanup:** Six misplaced Lovelace cards and one duplicate HA package were moved to `/config/.motogp_cleanup_quarantine` earlier. User reports no repair warnings. Do not permanently purge seven files until their own dependency and restore audit is complete. New patch-script cleanup is a separate operation. Keep legacy dashboard unchanged.

**Branches:** Development on `dev`; no promotion to `beta` or `main`. Old repo patch is pinned to upstream 1.0.10 and **must not** be forced onto running customized 1.0.9. No live deployment is implied by source/audit commits.

## Remaining gates

1. Run the safe HA reference audit for all eleven patch scripts and inspect any references, skipped files or external scheduled invocations. Only then quarantine the exact unchanged files, validate HA, and later seek explicit permanent-delete approval.
2. Compare actual HA JS with tracked frontend and resolve the same-version/different-bytes drift under a new identifiable dev build; verify browser-loaded card and preserve legacy.
3. Audit actual package and dashboard resource dependencies before purging old YAML quarantine.
4. Implement historical-results backend and selector against exact tracked source with real API tests and rollback.
5. Only after HA verification, review `dev → beta → main` promotion.

See [deployment ledger](deployment-sync-2026-09-18.md) and [Issue #1](https://github.com/Jocke1970/ha-motogp/issues/1) for progress and unresolved acceptance criteria.
