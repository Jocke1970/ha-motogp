# MotoGP Next v0.2.0-dev.2 — dual-day schedule and missing weather (2026-09-18)

## User feedback

Real HA screenshots of `motogp-test` running dev.1 showed the Austria event, today's Friday finished sessions gray, daily expanders, absent weather shown as four dashes, and timing offline. User confirms no weather measurements were visible, and requests that **after today's final session, both today's gray sessions and tomorrow's upcoming sessions be expanded together**. Keep the original MotoGP desktop dashboard and the separate `Card-test` mobile card untouched.

## Delivered in frontend/ha-motogp-next-card.js on dev

- `v0.2.0-dev.2`, build `next-20260918-02`, same isolated custom element (`custom:ha-motogp-next-card`) and existing test-card YAML. Do not register a second JS resource; update this element's existing URL/version parameter.
- Normal: today's schedule expanded, the other weekend days collapsed. After all today's sessions explicitly report FINISHED/CANCELLED, tomorrow also expands. Feed frequently leaves session status NOT-STARTED after its scheduled start; when no session is active, a conservative fallback opens tomorrow **two hours after today's last scheduled start**. This is a preview heuristic, NOT verified session completion. Never open a tomorrow that does not exist in the selected event. Transition to midnight resets overrides and opens the new current day only.
- A per-day local override map lets the user independently close/reopen today's and tomorrow's panels; class filtering is local and a category with no sessions on a day does not manufacture an empty day. Highlight today's date with its own red left marker (`IDAG`), independent of blue expanded-state styling.
- API `FINISHED` => gray `✓ KLART`; expired start with unconfirmed `NOT-STARTED` => gray `PASSERAT`; CANCELLED => `INSTÄLLT`. Never claim completion solely from scheduled start. The event header formats the race date as e.g. `18–20 sep`.
- Missing/placeholder track weather displays `Inga banväderdata rapporterade ännu.` instead of four uninformative placeholders or fake 0°C. When measurements exist, show latest reported values with no promise that they are live; weather source/event freshness is not yet established.
- No HA service calls for expanders/category switching, no backend or package changes, original JS untouched.

## Verification

[GitHub Actions run 35390102642](https://github.com/Jocke1970/ha-motogp/actions/runs/35390102642) passed syntax for original and isolated JS; original smoke, spoiler, version checks; and `tests/frontend-next.cjs` for dual-day auto-open, independent manual toggles, class filter, explicit versus heuristic completion, missing/available weather, timing, spoiler, midnight and timer cleanup. Synthetic tests are not proof of real-world frontend latency, event timezone or actual sensor end state. A previous dev.2 test run failed due a **test mistake** (expecting Saturday to exist under Moto2-only when its dataset had zero Moto2 Saturday sessions); corrected and latest CI passed.

## Safe replace ONLY the already-installed isolated dev card

Expected installed dev.1 Git blob: `a16f5b8e02d764396bce812121f5b9f26d186bee`. New JS at source commit `7a901befeb77335eed2573655bc913eee84790d9` Git blob: `a1f3f453e1db1065e8b838abf212a6317d2a65a2`. If the local file has another hash, **stop**; no blind overwrite. Run this full block in HA terminal:

```bash
bash <<'BASH'
set -euo pipefail
TARGET=/config/www/ha-motogp-next-card.js
OLD=a16f5b8e02d764396bce812121f5b9f26d186bee
NEW=a1f3f453e1db1065e8b838abf212a6317d2a65a2
if [ ! -f "$TARGET" ] || [ -L "$TARGET" ]; then
  echo "STOP: expected regular existing dev.1 file missing or is a link."
  exit 1
fi
ACTUAL="$(git hash-object "$TARGET")"
if [ "$ACTUAL" != "$OLD" ]; then
  echo "STOP: installed JS differs from expected dev.1: $ACTUAL"
  exit 1
fi
SRC="$(mktemp /tmp/motogp-next.XXXXXX)"
STAGED="$(mktemp /config/www/.motogp-next.XXXXXX)"
trap 'rm -f "$SRC" "$STAGED"' EXIT
curl -fsSL 'https://raw.githubusercontent.com/Jocke1970/ha-motogp/7a901befeb77335eed2573655bc913eee84790d9/frontend/ha-motogp-next-card.js' -o "$SRC"
[ "$(git hash-object "$SRC")" = "$NEW" ] || { echo 'STOP: downloaded JS hash mismatch'; exit 1; }
install -m 0644 "$SRC" "$STAGED"
[ "$(git hash-object "$STAGED")" = "$NEW" ] || { echo 'STOP: staged JS hash mismatch'; exit 1; }
mv -f "$STAGED" "$TARGET"
echo "KLART: dev.2 installed, hash $(git hash-object "$TARGET")"
BASH
```

After success, change the **existing** resource in HA Dashboard Resources (JavaScript module) from `/local/ha-motogp-next-card.js?v=0.2.0-dev.1-next-20260918-01` to `/local/ha-motogp-next-card.js?v=0.2.0-dev.2-next-20260918-02`. Do not add another URL for the same custom element. Completely reload browser tab to clear the already registered custom element, then verify visible `MOTOGP · 0.2.0-dev.2` and footer `next-20260918-02` in `motogp-test`. Same existing card config: `type: custom:ha-motogp-next-card`. If an install step stops, leave HA resource unchanged.

Rollback: repeat the same guarded pattern in reverse, using pinned previous-source commit `a72911c68f5daf35cddb5eac730b1e036a1adce6` and old blob `a16f5b8e02d764396bce812121f5b9f26d186bee` after confirming the installed hash is dev.2, then restore old resource query. Don't edit `Card-test`, original MotoGP, beta/main or Python.
