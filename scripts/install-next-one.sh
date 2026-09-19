#!/usr/bin/env bash
# One-file installation for the isolated MotoGP Next dashboard only.
# GitHub builds/tests the JS; Home Assistant only downloads, verifies and installs it.
set -euo pipefail

DIR="${MOTOGP_WWW_DIR:-/config/www}"
TARGET="$DIR/ha-motogp-next.js"
SOURCE_COMMIT=430dbac5133dff0e722bc82aec9bdf96bf6e22e7
EXPECTED_BLOB=bd8d9eb66bb867dd6552587d9850e7b41e05b1b6
URL="https://raw.githubusercontent.com/Jocke1970/ha-motogp/$SOURCE_COMMIT/dist/ha-motogp-next.js"

stop() { printf 'STOP: %s\n' "$*" >&2; exit 1; }
command -v git >/dev/null 2>&1 || stop 'git saknas; kan inte verifiera kontrollsumman.'
command -v mktemp >/dev/null 2>&1 || stop 'mktemp saknas.'
[ -d "$DIR" ] && [ ! -L "$DIR" ] || stop "Katalogen $DIR saknas eller är en symlänk."

verify() {
  [ -f "$1" ] && [ ! -L "$1" ] &&
    [ "$(git hash-object "$1")" = "$EXPECTED_BLOB" ]
}

# A second run should never require network access or rewrite a working file.
if [ -e "$TARGET" ] || [ -L "$TARGET" ]; then
  verify "$TARGET" || stop "Befintliga $TARGET är en okänd version. Inget skrivs över."
  echo "REDAN KLART: $TARGET har rätt kontrollsumma. Ingen nedladdning behövs."
else
  work="$(mktemp -d "$DIR/.motogp-next.XXXXXXXX")" || stop 'Kan inte skapa temporär katalog i www.'
  cleanup() {
    status=$?
    rm -rf -- "$work"
    if [ "$status" -ne 0 ]; then
      printf '\nINSTALLATION AVBRUTEN (felkod %s). Ingen befintlig JS-fil har ändrats.\n' "$status" >&2
    fi
  }
  trap cleanup EXIT

  if [ -n "${MOTOGP_BUNDLE_FILE:-}" ]; then
    [ -f "$MOTOGP_BUNDLE_FILE" ] && [ ! -L "$MOTOGP_BUNDLE_FILE" ] ||
      stop "Den angivna färdigbyggda filen saknas: $MOTOGP_BUNDLE_FILE"
    cp -- "$MOTOGP_BUNDLE_FILE" "$work/next.js" || stop 'Kunde inte kopiera den färdigbyggda filen.'
  else
    command -v curl >/dev/null 2>&1 || stop 'curl saknas; kan inte hämta JS-filen.'
    echo 'Hämtar en färdigbyggd, verifierad MotoGP Next-fil från GitHub ...'
    if ! curl --fail --location --silent --show-error --retry 2 \
      --connect-timeout 10 --max-time 60 \
      --output "$work/next.js" "$URL"; then
      stop 'GitHub-hämtningen misslyckades. Kontrollera DNS/nätverk i HA; inga resurser ska ändras.'
    fi
  fi

  verify "$work/next.js" || stop 'Nedladdad fil har fel kontrollsumma. Installation stoppad.'
  if command -v node >/dev/null 2>&1; then
    node --check "$work/next.js" || stop 'JS-syntaxkontrollen misslyckades.'
  fi
  chmod 0644 "$work/next.js" || stop 'Kunde inte sätta läsrättigheter.'
  mv -- "$work/next.js" "$TARGET" || stop 'Kunde inte installera JS-filen.'
  verify "$TARGET" || stop 'Slutkontrollen misslyckades. Kontrollera filsystemet.'
  echo "INSTALLERAT: $TARGET (verifierad, en fil)."
fi

cat <<'INFO'

Ändra Lovelace-resurser FÖRST EFTER ett lyckat installationsmeddelande:
  BEHÅLL originalets ha-motogp-card.js och HACS-resurser.
  TA BORT bara gamla ha-motogp-next-card.js, ha-motogp-next-split.js
    och Next-tilläggsresurserna, om de finns.
  LÄGG TILL en JavaScript-modul: /local/ha-motogp-next.js
  Ladda om med Ctrl+Shift+R och testa MotoGP Next Split.

Samma två YAML-korttyper; ingen HA-omstart behövs. Radera inte gamla JS-filer på disken.
INFO
