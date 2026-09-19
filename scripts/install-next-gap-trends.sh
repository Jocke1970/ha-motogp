#!/usr/bin/env bash
# Guarded installation for isolated MotoGP Next split.2 visual addons.
set -euo pipefail
DIR=/config/www
BASE="$DIR/ha-motogp-next-card.js"
SPLIT="$DIR/ha-motogp-next-split.js"
FIRST="$DIR/ha-motogp-next-split-enhancements.js"
TRENDS="$DIR/ha-motogp-next-gap-trends.js"
BASE_SHA=b3ec963fa5f734e1db38e4d4a2ccb9d6b93a8286
SPLIT_SHA=797594a2440a0818c2551ac2d3f0d502f163111b
FIRST_SHA=346df5046cc9301e426650cb36cb32449883414c
TRENDS_SHA=c9eba3a6de76237945ac7e37a7db9356e319560e
FIRST_URL=https://raw.githubusercontent.com/Jocke1970/ha-motogp/efc12c6bafe595cf7596a9423a96f7208fb52cda/frontend/ha-motogp-next-split-enhancements.js
TRENDS_URL=https://raw.githubusercontent.com/Jocke1970/ha-motogp/af1ac68f2f8dab9a7d85088773d0877e225c4996/frontend/ha-motogp-next-gap-trends.js
for cmd in git curl mktemp mv chmod; do command -v "$cmd" >/dev/null || { echo "STOP: $cmd saknas";exit 1; }; done
[ -d "$DIR" ] || { echo "STOP: $DIR saknas";exit 1; }
check() {
  local f=$1 sha=$2
  [ -f "$f" ] && [ ! -L "$f" ] && [ "$(git hash-object "$f")" = "$sha" ] || {
    echo "STOP: Fil saknas eller har oväntat innehåll: $f";exit 1;
  }
}
check "$BASE" "$BASE_SHA"
check "$SPLIT" "$SPLIT_SHA"
install_one() {
  local target=$1 sha=$2 url=$3 tmp
  if [ -e "$target" ] || [ -L "$target" ]; then
    check "$target" "$sha"
    echo "Verifierad befintlig fil: $target"
    return
  fi
  tmp="$(mktemp "$DIR/.motogp-next.XXXXXX")"
  if ! curl --fail --silent --show-error --location "$url" --output "$tmp"; then
    rm -f "$tmp"; echo 'STOP: Nedladdning misslyckades';exit 1
  fi
  if [ "$(git hash-object "$tmp")" != "$sha" ]; then
    rm -f "$tmp";echo 'STOP: Fel kontrollsumma på nedladdad fil';exit 1
  fi
  chmod 0644 "$tmp"
  mv -- "$tmp" "$target"
  check "$target" "$sha"
  echo "Installerad: $target"
}
install_one "$FIRST" "$FIRST_SHA" "$FIRST_URL"
install_one "$TRENDS" "$TRENDS_SHA" "$TRENDS_URL"
cat <<'INFO'

KLART. Lägg till/behåll dessa två JavaScript-moduler i denna ordning under
Home Assistant > Inställningar > Paneler > Resurser:
/local/ha-motogp-next-split-enhancements.js?v=split-enhancements-20260919-01
/local/ha-motogp-next-gap-trends.js?v=gap-trends-20260919-01

Behåll befintliga base dev.4 och split.2-resurser FÖRE dessa två.
Hård omladdning: Ctrl+Shift+R. Testa bara vyn motogp-next-split.
Återställning: ta bort den nya gap-trends-resursen och ladda om;
originalkort, backend och existerande filer har inte ändrats.
INFO
