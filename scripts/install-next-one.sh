#!/usr/bin/env bash
# Upgrade ONLY the isolated MotoGP Next one-file resource. Never touch original cards.
# One pinned published JS download, verified before an atomic replacement.
set -euo pipefail

DIR="${MOTOGP_WWW_DIR:-/config/www}"
TARGET="$DIR/ha-motogp-next.js"
SOURCE_COMMIT=b7dbc1a542d1863004602f37c32e887d13c006d6
OLD_BLOB=b15fb60af3a8140c191261f9ec0eac224b530d7b
EXPECTED_BLOB=1f99efb65c9ab8087b51079b25ce283324ebfe8d
URL="https://raw.githubusercontent.com/Jocke1970/ha-motogp/$SOURCE_COMMIT/dist/ha-motogp-next.js"

stop() { printf 'STOP: %s\n' "$*" >&2; exit 1; }
command -v git >/dev/null 2>&1 || stop 'git saknas; ingen säker kontrollsumma kan verifieras.'
command -v mktemp >/dev/null 2>&1 || stop 'mktemp saknas.'
[ -d "$DIR" ] && [ ! -L "$DIR" ] || stop "Katalogen $DIR saknas eller är en symlänk."

blob() { git hash-object "$1"; }
verify_new() {
  [ -f "$1" ] && [ ! -L "$1" ] && [ "$(blob "$1")" = "$EXPECTED_BLOB" ]
}

current='none'
if [ -e "$TARGET" ] || [ -L "$TARGET" ]; then
  [ -f "$TARGET" ] && [ ! -L "$TARGET" ] || stop 'Målfilen är inte en vanlig fil. Inget ändrat.'
  current="$(blob "$TARGET")"
  case "$current" in
    "$EXPECTED_BLOB") echo "REDAN KLART: $TARGET är senaste verifierade versionen. Ingen nedladdning." ;;
    "$OLD_BLOB") echo 'Hittade verifierad tidigare Next-version; säker uppdatering möjlig.' ;;
    *) stop "Okänd eller lokalt modifierad version i $TARGET. Inget skrivs över." ;;
  esac
fi

if [ "$current" != "$EXPECTED_BLOB" ]; then
  work="$(mktemp -d "$DIR/.motogp-next.XXXXXXXX")" || stop 'Kan inte skapa temporär katalog.'
  cleanup() {
    status=$?
    rm -rf -- "$work"
    if [ "$status" -ne 0 ]; then
      printf 'INSTALLATION AVBRUTEN (felkod %s). Kontrollera STOP-raden ovan.\n' "$status" >&2
    fi
  }
  trap cleanup EXIT

  if [ -n "${MOTOGP_BUNDLE_FILE:-}" ]; then
    [ -f "$MOTOGP_BUNDLE_FILE" ] && [ ! -L "$MOTOGP_BUNDLE_FILE" ] ||
      stop "Färdigbyggda källfilen saknas: $MOTOGP_BUNDLE_FILE"
    cp -- "$MOTOGP_BUNDLE_FILE" "$work/next.js" || stop 'Kunde inte kopiera färdigbyggda filen.'
  else
    command -v curl >/dev/null 2>&1 || stop 'curl saknas; kan inte hämta JS.'
    echo 'Hämtar EN färdigbyggd MotoGP Next-fil från fast GitHub-commit ...'
    curl --fail --location --silent --show-error --retry 2 \
      --connect-timeout 10 --max-time 60 \
      --output "$work/next.js" "$URL" || stop 'Hämtningen misslyckades; tidigare Next-fil är orörd.'
  fi
  verify_new "$work/next.js" || stop 'Nedladdad fil har fel kontrollsumma. Målfilen är orörd.'
  if command -v node >/dev/null 2>&1; then
    node --check "$work/next.js" || stop 'JavaScript-syntaxfel. Målfilen är orörd.'
  fi
  chmod 0644 "$work/next.js" || stop 'Kunde inte sätta läsrättigheter.'

  if [ "$current" = "$OLD_BLOB" ]; then
    cp -- "$TARGET" "$work/previous.js" || stop 'Kunde inte säkra den verifierade tidigare filen.'
  fi
  mv -f -- "$work/next.js" "$TARGET" || stop 'Kunde inte installera filen.'
  if ! verify_new "$TARGET"; then
    if [ "$current" = "$OLD_BLOB" ]; then
      cp -- "$work/previous.js" "$TARGET" || stop 'Slutkontroll misslyckades och återställning misslyckades.'
    else
      rm -f -- "$TARGET"
    fi
    stop 'Slutkontroll misslyckades; tidigare version har återställts där den fanns.'
  fi
  if [ "$current" = "$OLD_BLOB" ]; then
    echo "UPPDATERAT OCH VERIFIERAT: $TARGET"
  else
    echo "INSTALLERAT OCH VERIFIERAT: $TARGET"
  fi
fi

cat <<'INFO'

Nästa steg: Behåll EXAKT SAMMA befintliga Next-resurs i Home Assistant:
  /local/ha-motogp-next.js
Skapa INTE en ny resurs och ändra INTE YAML-korttyper.
Ladda om testvyn med Ctrl+Shift+R och kontrollera versionsraden 0.3.0-dev.4.
Låt originalets ha-motogp-card.js/HACS-resurser och gamla JS-filer vara orörda.
Ingen Home Assistant-omstart behövs.
INFO
