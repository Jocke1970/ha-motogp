# MotoGP patch quarantine — executed 2026-09-18

## Completed on the user's Home Assistant host

The operator ran the hash-pinned [`scripts/quarantine_motogp_patches.py`](../scripts/quarantine_motogp_patches.py) with explicit `--apply`. The user supplied the terminal output:

- Source snapshot still matched the running integration; provenance archive and eleven old patch/install scripts were verified.
- Streaming scan checked **6,626 text files**, including the eight files previously skipped for exceeding 2 MB. **Zero explicit filename or wildcard references** were found.
- Script reported `KLART: 11 scripts moved to /config/.motogp_cleanup_quarantine/patch-scripts`.
- Script reported the running integration, active YAML package, JS, backups and non-MotoGP scripts untouched; **no permanent deletion**.

This is a user-reported successful on-host execution, not an independent readback of the host after the move. The original size-limited reference scan checked 6,618 files, skipped eight large files and correctly stopped; the new streaming scanner resolved those eight before relocation. The new script was previously tested in an isolated synthetic filesystem for reference hits, destination collisions, clean moves, rollback guards and repeat-invocation stop.

The GitHub `dev` repository holds the exact earlier 14-file deployed v1.0.9 source snapshot at [commit `0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f), whose [integrity workflow passed](https://github.com/Jocke1970/ha-motogp/actions/runs/35378743131). It also holds a byte-matching reference of the active dashboard-mode package. The reviewed provenance ZIP remains local at `/config/config/motogp_provenance_review.zip`; its eleven shell scripts were not pushed to the public repo.

## What stays untouched / outstanding

- Quarantined eleven `.sh` scripts are **not deleted**. Retain for reversible recovery until the HA dashboard and scheduled operation have been validated and the operator separately approves their removal. Restore only by a checked reverse move after verifying destination hashes; never casually rerun obsolete patches.
- External cron, add-on jobs and manually entered commands outside the scanned `/config` text files were **not covered**. Inspect if any are configured before final purge.
- Seven previously quarantined Lovelace/package YAML files are **a separate cleanup** and remain untouched; verify references before deleting them.
- The actual HA JS file differs in bytes from `dev/frontend/ha-motogp-card.js` despite identical embedded version/build metadata. Resolve frontend drift separately; never overwrite running JS as part of shell-script cleanup.
- Historical result archive is still a prototype, not deployed. No promotion to `beta` or `main`, no HA restart or run-time functionality testing was reported with this quarantine step.

## Safety procedure recorded

[`scripts/quarantine_motogp_patches.py`](../scripts/quarantine_motogp_patches.py) verifies the exact reviewed Python source ZIP and fourteen live files, provenance ZIP and all eleven script hashes, refuses symlinks/duplicate script copies/destination collisions, streams configuration text files (including large files) and aborts on matched references or unreadable relevant files before moving any allowlisted files. It attempts rollback if a move fails partway. The script does not delete files. Its reviewed SHA-256 is `ea9381682644dce4bea48ab83674f5b66b70656388bd6aaabdc0c7d738bc0194`.
