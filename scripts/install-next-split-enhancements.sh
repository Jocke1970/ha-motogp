#!/usr/bin/env bash
# Install test-only MotoGP split enhancements. Does not edit Lovelace or original cards.
set -euo pipefail
DIR=/config/www
BASE="$DIR/ha-motogp-next-card.js"
SPLIT="$DIR/ha-motogp-next-split.js"
ADDON="$DIR/ha-motogp-next-split-enhancements.js"
BASE_BLOB=b3ec963fa5f734e1db38e4d4a2ccb9d6b93a8286
SPLIT_BLOB=797594a2440a0818c2551ac2d3f0d502f163111b
ADDON_BLOB=346df5046cc9301e426650cb36cb32449883414c
COMMIT=efc12c6bafe595cf7596a9423a96f7208fb52cda
URL="https://raw.githubusercontent.com/Jocke1970/ha-motogp/$COMMIT/frontend/ha-motogp-next-split-enhancements.js"
for cmd in git curl mktemp; do command -v "$cmd" >/dev/null || { echo "STOP: $cmd saknas"; exit 1; }; done
[ -d "$DIR" ] || { echo "STOP: $DIR saknas"; exit 1; }
check_file() {
  local file=$1 expected=$2
  if [ ! -f "$file" ] || [ -L "$file" ] || [ "$(git hash-object "$file")" != "$expected" ]; then
    echo "STOP: Fel eller ändrad fil: $file"; exit 1
  fi
}
check_file "$BASE" "$BASE_BLOB"
check_file "$SPLIT" "$SPLIT_BLOB"
if [ -e "$ADDON" ] || [ -L "$ADDON" ]; then
  check_file "$ADDON" "$ADDON_BLOB"
  echo 'Redan installerad: korrekt MotoGP split-tillägg.'
else
  tmp="$(mktemp "$DIR/.motogp-enhancements.XXXXXX")"
  trap 'rm -f "$tmp"' EXIT
  curl --fail --silent --show-error --location "$URL" --output "$tmp"
  if [ "$(git hash-object "$tmp")" != "$ADDON_BLOB" ]; then
    echo 'STOP: Nedladdad fil har fel kontrollsumma.'; exit 1
  fi
  chmod 0644 "$tmp"
  mv -- "$tmp" "$ADDON"
  check_file "$ADDON" "$ADDON_BLOB"
  echo 'KLART: Tillägget installerat utan att ändra befintliga filer.'
fi
cat <<'INFO'

Lägg till EN JavaScript-modul i Home Assistant > Inställningar > Paneler > Resurser:
/local/ha-motogp-next-split-enhancements.js?v=split-enhancements-20260919-01

Behåll befintliga dev.4- och split.2-resurser. Gör en hård omladdning (Ctrl+Shift+R).
Testa bara i den isolerade vyn motogp-next-split.
Återställning: ta bort den nya resursraden, ladda om; originalfilerna är orörda.
INFO
