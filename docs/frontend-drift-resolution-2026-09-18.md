# Frontend drift resolved: EOF newline only — 2026-09-18

## Scope and evidence

Compared the **actual HA JS file embedded in the user-exported** `motogp_provenance_review.zip` (`frontend/ha-motogp-card.js`) against the immutable GitHub `frontend/ha-motogp-card.js` at source commit [`0c66663`](https://github.com/Jocke1970/ha-motogp/commit/0c66663aff1ee7db30de136b064941964791219f). The export had passed ZIP member SHA-256 verification in the provenance review; the quarantine run later reported that live JS was left untouched. This establishes the exported file, not what an already-open browser has cached or an independent current read of `/config/www`.

| Item | Exported HA JS | GitHub source |
| --- | --- | --- |
| Length | 26,122 bytes | 26,123 bytes (Git tree) |
| Git blob SHA-1 | `10f995c8622036beae117ae11c791a682bbeeac1` | `fef8e3e4f09d30f01385d6e8417e96ae923cb65d` |
| Final byte | `}` (no final line feed) | LF (`\n`) |
| Embedded metadata | `v0.1.0-dev.3` / `0b493073ef59` | Same |

**Exact-difference proof:** calculating the Git blob SHA-1 of the 26,122 exported bytes with precisely one LF appended produces `fef8e3e4f09d30f01385d6e8417e96ae923cb65d`, identical to the published GitHub JS blob. GitHub tree confirms that blob is 26,123 bytes. Thus the exported files have **identical content other than the final newline**. Node's `--check` accepted the exported JS syntax. No functionality drift is present between these two captured files; the prior generic JS drift warning was a false alarm.

## Operational disposition

- **No JS replacement, no metadata/build-ID bump and no new backup** are needed to correct a missing EOF newline. The running integration and legacy dashboard are unchanged.
- GitHub `dev/frontend/ha-motogp-card.js` remains the canonical source for the next changes; any *actual* subsequent code edit needs a new build identity and tests before deployment.
- Separately, the exact browser-loaded URL/content (including cache and `customElements` one-time registration) has **not** been verified. This is a resource/runtime validation task, not a source-drift blocker. Check through HA Lovelace resource settings/browser when preparing the next deployment.
- Old 11 HA patch scripts are separately quarantined, not permanently deleted; seven old YAML files have their own cleanup gate.
