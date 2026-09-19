# MotoGP Next split.2 — genuine separate timing layout and next-pass countdown (2026-09-19)

## Correction
`split.1` introduced separate Home Assistant custom element names but subclassed the old `dev.4` timing renderer and therefore looked essentially unchanged. `split.2` replaces the standalone timing card's **HTML/CSS renderer**. It still inherits `dev.4`'s verified entity matching, session gating, TV-delay guard, snapshot handling and click logic. Original desktop dashboard, Card-test mobile card and `dev.4` JS have not changed.

- `custom:ha-motogp-next-overview-card`: retains event header, schedule and weather; schedule header adds a 1-second countdown to the next scheduled session **in the selected category** (Total = all categories).
- `custom:ha-motogp-next-timing-card`: independent full-width layout with POS, driver/team, lap number (no `L` prefix), latest lap, gap to rider ahead, gap to leader, and status/PIT. During a matched live session show remaining session time or race/sprint lap countdown plus TV delay. Between sessions show next global session class/name, scheduled time and 1-second countdown, regardless of whether driver rows are folded. An existing captured finished-session snapshot can remain visible explicitly labeled 'ej live'; a card newly loaded after the finish does **not** fabricate historic rows.
- Timers update countdown text only each second; the base continues 30-second full refresh and normal HA-driven sensor updates. No HA service calls. User locale must be Europe/Stockholm to match existing `dev.4` local-wall-time treatment of the API schedule's unusual `+00:00` suffix.
- No false live labels based only on timestamps; no made-up weather or lap totals; missing/zero lap times are dashes; API-sourced strings are HTML escaped.

## Source / test identity

- Base JS remains git blob `b3ec963fa5f734e1db38e4d4a2ccb9d6b93a8286` (`0.2.0-dev.4`).
- Prior split.1 git blob `42e6dfe6f3eaac9e8c7e3876b5680e9cb7f6f678`.
- New split.2 git blob `797594a2440a0818c2551ac2d3f0d502f163111b`; source commit `b134d3fae0889df7dadc9646e3247f821599e0ad`; test commit `d5246210d6fe4f1845be8717dfd586d5e483ca71`.
- GitHub Actions workflow run: https://github.com/Jocke1970/ha-motogp/actions/runs/35434426034 (passed). Tests cover live Q1, finished Q1 to upcoming Q2, category filter, isolated expanders, invalid rider times, escaping, TV delay and spoiler. Real browser visual validation still outstanding.

## Safe complete terminal installation (new file or upgrade from exactly split.1)

Only apply in the isolated test view. If any hash differs, stop without overwriting.

```bash
bash <<'BASH'
set -euo pipefail
BASE=/config/www/ha-motogp-next-card.js
TARGET=/config/www/ha-motogp-next-split.js
BASE_SHA=b3ec963fa5f734e1db38e4d4a2ccb9d6b93a8286
OLD_SHA=42e6dfe6f3eaac9e8c7e3876b5680e9cb7f6f678
NEW_SHA=797594a2440a0818c2551ac2d3f0d502f163111b
if [ ! -f "$BASE" ] || [ -L "$BASE" ] || [ "$(git hash-object "$BASE")" != "$BASE_SHA" ]; then
  echo 'STOP: the exact dev.4 base file is required.'; exit 1
fi
if [ -e "$TARGET" ] || [ -L "$TARGET" ]; then
  if [ ! -f "$TARGET" ] || [ -L "$TARGET" ]; then echo 'STOP: unexpected split target.'; exit 1; fi
  CURRENT="$(git hash-object "$TARGET")"
  if [ "$CURRENT" = "$NEW_SHA" ]; then echo 'Split.2 already installed.'; exit 0; fi
  if [ "$CURRENT" != "$OLD_SHA" ]; then echo "STOP: unknown split content $CURRENT"; exit 1; fi
fi
TMP="$(mktemp /config/www/.motogp-split.XXXXXX)"
trap 'rm -f "$TMP"' EXIT
curl -fsSL 'https://raw.githubusercontent.com/Jocke1970/ha-motogp/b134d3fae0889df7dadc9646e3247f821599e0ad/frontend/ha-motogp-next-split.js' -o "$TMP"
if [ "$(git hash-object "$TMP")" != "$NEW_SHA" ]; then echo 'STOP: source checksum mismatch.'; exit 1; fi
chmod 0644 "$TMP"
mv -f "$TMP" "$TARGET"
[ "$(git hash-object "$TARGET")" = "$NEW_SHA" ]
echo 'KLART: MotoGP Next split.2 installed.'
BASH
```

Update the **existing** split JavaScript module URL, do not register a second URL for the same custom elements:

`/local/ha-motogp-next-split.js?v=split-20260919-02`

Keep the existing dev.4 resource as well. Hard reload (`Ctrl+Shift+R`). Test view example remains `dashboard/motogp_next_split_test_view.yaml`, with overview and timing in separate sections; the timing section spans two columns. A custom card of type `custom:ha-motogp-next-card` is the old combined card, **not** the new one. Verify the new card types in view YAML. No changes to original MotoGP dashboard or Card-test.

Rollback: if installed split.2 hash matches `NEW_SHA`, retrieve old split.1 file from commit `f1665f0f52c0374e0fd805c97c7ce6e25b1692cf` and check `OLD_SHA`, replace and restore old resource URL `/local/ha-motogp-next-split.js?v=split-20260919-01`. Do not leave generated backup clutter.
