#!/usr/bin/env bash
# Import exact reviewed HA MotoGP source to GitHub dev and export patch provenance for review.
# Does NOT modify the running HA integration or upload unreviewed patch scripts.
set -euo pipefail

EXPECTED_ZIP_SHA='da753fc45010da43daaada9c5cf36621c424f36485a12fabd04437a8fc4fef68'
REMOTE='https://github.com/Jocke1970/ha-motogp.git'
LIVE='/config/custom_components/motogp_sensor'
SOURCE=''
for candidate in /config/config/motogp_source_review.zip /config/motogp_source_review.zip; do
  if [[ -f "$candidate" ]]; then
    actual="$(sha256sum "$candidate" | cut -d' ' -f1)"
    if [[ "$actual" != "$EXPECTED_ZIP_SHA" ]]; then
      echo "STOPP: fel ZIP-kontrollsumma: $candidate" >&2
      exit 1
    fi
    SOURCE="$candidate"
    break
  fi
done
if [[ -z "$SOURCE" || ! -d "$LIVE" ]]; then
  echo 'STOPP: granskad ZIP eller HA-integrationskatalog saknas.' >&2
  exit 1
fi

WORKDIR="$(mktemp -d /tmp/motogp-source-sync.XXXXXX)"
trap 'rm -rf -- "$WORKDIR"' EXIT

echo '1/5 Hämtar endast GitHub dev till tillfällig katalog...'
git clone --quiet --single-branch --branch dev "$REMOTE" "$WORKDIR/repo"
cd "$WORKDIR/repo"

echo '2/5 Jämför arkiv med körande HA, importerar till Git-checkouten...'
python3 scripts/import_deployed_snapshot.py --archive "$SOURCE" --live-dir "$LIVE" --write
python3 scripts/import_deployed_snapshot.py --verify

echo '3/5 Stagar ENDAST 14 källfiler + inventory...'
git add -- backend/deployed/v1.0.9/custom_components/motogp_sensor backend/deployed/v1.0.9/INVENTORY.txt
if git diff --cached --quiet; then
  echo 'Källsnapshot finns redan identisk på dev. Ingen extra commit.'
else
  git -c user.name='MotoGP source sync' \
      -c user.email='ha-motogp-source-sync@users.noreply.github.com' \
      commit -m 'chore(backend): capture verified installed HA MotoGP 1.0.9 source'
  echo '4/5 Pushar ENDAST källsnapshot till dev...'
  git push origin HEAD:dev
fi

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git ls-remote origin refs/heads/dev | cut -f1)"
if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo 'STOPP: kunde inte bekräfta att dev pekar på vår commit.' >&2
  exit 1
fi
printf 'GITHUB DEV VERIFIERAD: %s\n' "$REMOTE_HEAD"

echo '5/5 Exporterar gamla patchscript lokalt för separat säkerhetsgranskning...'
python3 scripts/export_motogp_provenance.py

echo 'KLART: källkoden finns på dev. Ladda upp motogp_provenance_review.zip här för nästa del.'
echo 'Inga filer i den körande HA-integrationen har ändrats.'
