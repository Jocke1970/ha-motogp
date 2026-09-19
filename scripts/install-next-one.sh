#!/usr/bin/env bash
# MotoGP Next: ONE compiled JS resource, fixed path; only isolated Next cards.
# No edits to Lovelace/YAML, original MotoGP card, Python, main or beta.
set -euo pipefail
DIR="${MOTOGP_WWW_DIR:-/config/www}"
TARGET="$DIR/ha-motogp-next.js"
SOURCE_COMMIT=76bef9cb79b60f84768d182f81612efcdb89cd19
BUILDER_COMMIT=c43c97efa8d3b2e15d4a04f412b3d542da2755b8
BUILDER_SHA=bd5c4abe64242aa78c85062e3693354b64f76ef0
BUNDLE_SHA=bd8d9eb66bb867dd6552587d9850e7b41e05b1b6
for cmd in curl git python3 mktemp mv chmod cp rm; do
  command -v "$cmd" >/dev/null || { echo "STOP: $cmd saknas." >&2; exit 1; }
done
[ -d "$DIR" ] && [ ! -L "$DIR" ] || { echo "STOP: www-katalog saknas eller är symlänk: $DIR" >&2; exit 1; }
work="$(mktemp -d "$DIR/.motogp-next-one.XXXXXXXX")"
trap 'rm -rf -- "$work"' EXIT
check() {
  local path="$1" expected="$2"
  [ -f "$path" ] && [ ! -L "$path" ] && [ "$(git hash-object "$path")" = "$expected" ] || {
    echo "STOP: Fel innehåll eller osäker fil: $path" >&2; exit 1;
  }
}
source_file() {
  local name="$1" sha="$2" output="$work/$1"
  if [ -n "${MOTOGP_SOURCE_DIR:-}" ]; then
    check "$MOTOGP_SOURCE_DIR/$name" "$sha"
    cp -- "$MOTOGP_SOURCE_DIR/$name" "$output"
  else
    curl --fail --silent --show-error --location \
      "https://raw.githubusercontent.com/Jocke1970/ha-motogp/$SOURCE_COMMIT/frontend/$name" \
      --output "$output"
  fi
  check "$output" "$sha"
}
source_file ha-motogp-next-card.js b3ec963fa5f734e1db38e4d4a2ccb9d6b93a8286
source_file ha-motogp-next-split.js 797594a2440a0818c2551ac2d3f0d502f163111b
source_file ha-motogp-next-split-enhancements.js 346df5046cc9301e426650cb36cb32449883414c
source_file ha-motogp-next-gap-trends.js c9eba3a6de76237945ac7e37a7db9356e319560e
if [ -n "${MOTOGP_BUILDER_FILE:-}" ]; then
  check "$MOTOGP_BUILDER_FILE" "$BUILDER_SHA"
  cp -- "$MOTOGP_BUILDER_FILE" "$work/build.py"
else
  curl --fail --silent --show-error --location \
    "https://raw.githubusercontent.com/Jocke1970/ha-motogp/$BUILDER_COMMIT/scripts/build-next-one.py" \
    --output "$work/build.py"
fi
check "$work/build.py" "$BUILDER_SHA"
python3 "$work/build.py" "$work" "$work/bundle.js"
check "$work/bundle.js" "$BUNDLE_SHA"
if command -v node >/dev/null 2>&1; then node --check "$work/bundle.js"; fi
if [ -e "$TARGET" ] || [ -L "$TARGET" ]; then
  check "$TARGET" "$BUNDLE_SHA"
  echo 'Redan installerad: samma verifierade Next-fil. Ingenting ändrat.'
else
  chmod 0644 "$work/bundle.js"
  mv -- "$work/bundle.js" "$TARGET"
  check "$TARGET" "$BUNDLE_SHA"
  echo "Installerat och verifierat: $TARGET"
fi
cat <<'INFO'

Nästa steg: Inställningar > Paneler > Resurser i Home Assistant.
TA BORT de gamla Next-resursposterna, OM de finns:
  /local/ha-motogp-next-card.js
  /local/ha-motogp-next-split.js
  /local/ha-motogp-next-split-enhancements.js
  /local/ha-motogp-next-gap-trends.js
LÄGG TILL EXAKT EN JavaScript-modul:
  /local/ha-motogp-next.js
Behåll de gamla original-/HACS-resurserna ha-motogp-card.js orörda!
Radera INGA gamla filer från disken nu. Ladda om webbläsaren med Ctrl+Shift+R.
Testa ENDAST vyn MotoGP Next Split; samma två korttyper används i dess YAML.
Inget byte av YAML-korttyper och ingen omstart av Home Assistant behövs.

Obs: Det här installerar filen, men kan inte själv ändra dina Lovelace-resurser.
INFO
