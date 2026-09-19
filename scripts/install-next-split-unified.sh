#!/usr/bin/env bash
# Consolidate the two verified visual extensions into the existing Next split JS.
# Result: only TWO Lovelace resources: original dev.4 base + unified split card.
# Work exclusively on the isolated motogp-next-split view; no backend edits.
set -euo pipefail
DIR="${MOTOGP_WWW_DIR:-/config/www}"
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
MARKER='/* MotoGP Next split unified: visual enhancements and gap trends 20260919-01 */'
for cmd in git python3 mktemp cp mv chmod rm; do
  command -v "$cmd" >/dev/null || { echo "STOP: $cmd saknas." >&2; exit 1; }
done
[ -d "$DIR" ] || { echo "STOP: Katalogen saknas: $DIR" >&2; exit 1; }
check() {
  local f=$1 sha=$2
  [ -f "$f" ] && [ ! -L "$f" ] && [ "$(git hash-object "$f")" = "$sha" ] || {
    echo "STOP: Filen saknas, är en symlänk eller har ändrat innehåll: $f" >&2; exit 1;
  }
}
check "$BASE" "$BASE_SHA"
[ -f "$SPLIT" ] && [ ! -L "$SPLIT" ] || {
  echo "STOP: Split-kortet saknas eller är en symlänk: $SPLIT" >&2; exit 1;
}
work="$(mktemp -d "$DIR/.motogp-unify.XXXXXXXX")"
trap 'rm -rf -- "$work"' EXIT
piece() {
  local existing=$1 sha=$2 url=$3 out=$4
  if [ -e "$existing" ] || [ -L "$existing" ]; then
    check "$existing" "$sha"
    cp -- "$existing" "$out"
  else
    command -v curl >/dev/null || { echo 'STOP: curl saknas.' >&2; exit 1; }
    curl --fail --silent --show-error --location "$url" --output "$out" || {
      echo "STOP: Kunde inte hämta $url" >&2; exit 1;
    }
    check "$out" "$sha"
  fi
}
piece "$FIRST" "$FIRST_SHA" "$FIRST_URL" "$work/first.js"
piece "$TRENDS" "$TRENDS_SHA" "$TRENDS_URL" "$work/trends.js"
installed_sha="$(git hash-object "$SPLIT")"
if [ "$installed_sha" = "$SPLIT_SHA" ]; then
  cp -- "$SPLIT" "$work/original.js"
else
  # Extract only when the exact marker occurs exactly once; compare the recovered
  # original blob to the approved split.2 blob. A modified card aborts safely.
  python3 - "$SPLIT" "$work/original.js" "$MARKER" <<'PY'
import pathlib, sys
source, target, marker = sys.argv[1:]
content = pathlib.Path(source).read_bytes()
separator = ("\n" + marker + "\n").encode("utf-8")
if content.count(separator) != 1:
    sys.exit("STOP: Oväntad split-fil; kan inte säkert identifiera tidigare unified-installation.")
pathlib.Path(target).write_bytes(content.split(separator, 1)[0])
PY
  check "$work/original.js" "$SPLIT_SHA"
fi
{
  cat -- "$work/original.js"
  printf '\n%s\n' "$MARKER"
  cat -- "$work/first.js"
  printf '\n'
  cat -- "$work/trends.js"
  printf '\n'
} > "$work/bundle.js"
expected_sha="$(git hash-object "$work/bundle.js")"
if [ "$installed_sha" = "$expected_sha" ]; then
  echo 'Redan installerad: unified split-kortet har korrekt kontrollsumma.'
elif [ "$installed_sha" = "$SPLIT_SHA" ]; then
  chmod 0644 "$work/bundle.js"
  mv -- "$work/bundle.js" "$SPLIT"
  check "$SPLIT" "$expected_sha"
  echo "Installerat: $SPLIT (samlat i EN split-resurs)."
else
  echo "STOP: Den modifierade split-filen matchar inte väntat paket. Inget skrevs." >&2
  exit 1
fi
cat <<'INFO'

VIKTIGT: Under Inställningar > Paneler > Resurser i Home Assistant:
BEHÅLL dessa två befintliga JavaScript-resurser, i ordning:
  /local/ha-motogp-next-card.js             (dev.4, befintlig URL)
  /local/ha-motogp-next-split.js?v=unified-20260919-01
TA BORT följande två resursregistreringar OM de finns (inte kortens YAML):
  /local/ha-motogp-next-split-enhancements.js
  /local/ha-motogp-next-gap-trends.js

Ladda sedan om med Ctrl+Shift+R. Testa BARA motogp-next-split.
Ingen Home Assistant-omstart och inget nytt custom-card behövs.
Övriga dashboardar, mobilkort, Python-backend och main/beta berörs inte.
Återställning: återinstallera original split.2 från GitHub dev, återställ
split-resursens tidigare URL och vid behov de tidigare två addon-resurserna.
INFO
