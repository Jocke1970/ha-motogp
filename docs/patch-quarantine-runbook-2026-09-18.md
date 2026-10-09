# MotoGP patch quarantine runbook — 2026-09-18

## Verified execution

The first HA-side read-only scanner verified 11 original script hashes and searched **6,618** text files, finding **zero references** but skipping eight oversized files (seven EPG XML, one custom-brand-icons JS). It returned STOP without changing anything.

The user subsequently ran the hash-pinned [`scripts/quarantine_motogp_patches.py`](../scripts/quarantine_motogp_patches.py) with explicit `--apply` on HA. Terminal output confirms four successful stages:

1. The reviewed 14-file source snapshot still matched the running MotoGP integration.
2. Provenance archive and all eleven individual scripts passed checks.
3. Streaming search scanned **6,626** text files, including all eight large files, with **zero filename/wildcard references**.
4. **Exactly eleven allowlisted patch/install `.sh` files moved** to `/config/.motogp_cleanup_quarantine/patch-scripts`.

The script reported running integration, active YAML package, JS, backups and non-MotoGP scripts untouched. No permanent deletion occurred. User knows of no external job, but cron/add-on invocations outside `/config` and manual commands cannot be established by this scan.

## Safety, rollback and deletion gate

The hash-gated script checks immutable source/provenance ZIP hashes, live source inventory, all eleven original script hashes, destination collisions, symlinks and text references before moving. Simulated tests covered a no-op, detection of a reference in a large file, collision, successful exact-file move and safe repeat STOP. The original provenance archive is retained; reverse movement requires confirming destination hashes/collision-free original paths. Do not rerun old patch installers.

Before authorizing a *different* permanent-deletion operation, validate dashboard and scheduled behavior, verify only eleven intended files are in patch quarantine and verify their hashes against the provenance inventory; explicitly approve deletion. The seven previously quarantined package/YAML files are **not** part of this scope and require a separate reference audit. Non-MotoGP scripts, original provenance/source ZIPs, JS, package and running integration are never cleanup targets here.

## Independent frontend finding

The exported HA JS differs from GitHub `dev/frontend/ha-motogp-card.js` **only in the final newline**: 26,122 vs 26,123 bytes; appending LF to exported bytes reproduces GitHub's exact Git blob SHA-1. [Detailed proof](frontend-drift-resolution-2026-09-18.md). No frontend overwrite or new build ID is needed for this difference. Browser-loaded resource/cache is still an independent validation point before the next actual deployment.

Historical results remain an uninstalled prototype, and `beta`/`main` have not been promoted.
