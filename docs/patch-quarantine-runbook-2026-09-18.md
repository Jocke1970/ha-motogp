# MotoGP patch quarantine runbook — 2026-09-18

## Verified state

The HA operator ran `scripts/audit_motogp_patch_references.py` against the actual host. It verified the reviewed provenance archive, confirmed 11 unchanged individual scripts and scanned 6,618 configuration text files: **zero script-filename/wildcard references**. Eight text files were skipped by the original scanner's 2 MB size guard: seven EPG XML files and `www/community/custom-brand-icons/custom-brand-icons.js`. This is not evidence of eight dependencies. The original scanner explicitly returned STOP on any skip, and moved nothing. It excludes `.storage`, `.ha-git` and quarantine; add-on jobs, cron outside `/config`, and manual invocations cannot be ruled out by this scan.

The exact running 14-file Python source was earlier verified and committed at [`0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f), with [passing source-integrity CI](https://github.com/Jocke1970/ha-motogp/actions/runs/35378743131). The active package was separately committed as a reference. Keep the historical source snapshot, provenance ZIP and the existing seven quarantined YAML files until their own cleanup criteria are met.

## Reversible, explicit quarantine

[`scripts/quarantine_motogp_patches.py`](../scripts/quarantine_motogp_patches.py) replaces the size-limited audit for this single retirement step. The committed script's SHA-256 is `ea9381682644dce4bea48ab83674f5b66b70656388bd6aaabdc0c7d738bc0194`. Default execution is read-only; `--apply` is an explicit opt-in. Before any move it checks:

1. Exact reviewed Python source ZIP SHA-256 and all 14 live Python/manifest files against the ZIP, including file inventory/version.
2. Exact reviewed provenance ZIP SHA-256, its 11 allowlisted shell entries and all 11 unchanged current on-host scripts; it refuses duplicate on-host filenames or symlinks.
3. Destination collisions and unsafe quarantine directory/symlink conditions.
4. A new /config text-reference scan, streaming even files over 2 MB in 1 MB blocks, stopping on any matching filename, likely wildcard invocation or unreadable in-scope file.

Only if all checks pass does `--apply` move the **eleven** old patch/install scripts to `/config/.motogp_cleanup_quarantine/patch-scripts/`; on an exception during movement it attempts to roll back files already moved. It never edits the active `motogp_sensor` integration, active `packages/motogp_dashboard_mode.yaml`, frontend JS, Git backups, non-MotoGP scripts or provenance ZIP. It never deletes anything.

Local simulated tests on a synthetic /config tree containing the two original reviewed ZIPs passed: no-op dry run, large-file reference STOP, destination-collision STOP, exactly eleven moves with integration untouched, and safe repeated-invocation STOP. This is **not** a claim that the script has been run on the user's HA host. External cron/add-ons are not covered; review those separately before permanent deletion. After moving, validate HA and any scheduled workflows, then approve deletion only after a distinct confirmation/cleanup step. Do not run old historical patch installers again.

## Separate unresolved work

The `/config/www/ha-motogp-card.js` bytes differ from the tracked `dev/frontend/ha-motogp-card.js` despite sharing version/build metadata. Investigate independently; **do not replace the live JS during shell cleanup**. Historical result archive is not deployed. `beta` and `main` are not promoted.
