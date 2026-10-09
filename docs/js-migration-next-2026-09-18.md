# MotoGP JS migration restart — v0.2.0-dev.1 (2026-09-18)

## Scope and ownership

A clean, **separate** Lovelace custom element `ha-motogp-next-card` is now in [`frontend/ha-motogp-next-card.js`](../frontend/ha-motogp-next-card.js). It is not a replacement for `ha-motogp-card` (unchanged Card-test mobile), not a change to the legacy MotoGP dashboard, and not a Python/backend upgrade. **Only `motogp-test` is the intended development view.** `beta` and `main` are untouched. Test card: [`dashboard/motogp_next_test_card.yaml`](../dashboard/motogp_next_test_card.yaml).

The older `motogp-test` screenshot with raw `2026-09-26T11:00:00+00:00`, `TRACK unavailable`, was produced by another test card, not proof that `sensor.motogp_next_race` is empty. Actual HA template at 21:17 CEST showed `GRAND PRIX OF AUSTRIA`, 2026-09-18–20, `sessions_all=20`, `sessions=8`, classes MotoGP/Moto2/Moto3, weekend view on. The new card reads **that** source directly and requires no weekend-view gate or YAML package replacement.

## Implemented in v0.2.0-dev.1

- Header reads `sensor.motogp_next_race` directly; no raw calendar date rendered as the event name.
- `sessions_all` with `sessions` fallback; filters to race `date_start`–`date_end`, sorts sessions, and offers **local** Total/MotoGP/Moto2/Moto3/MotoE buttons, without calls to HA helpers.
- Auto-expands **today** and highlights day header; other days collapsed. Clicking a day opens only that day, or closes it; manual choice resets at local midnight or event change. Finished/past sessions gray; active session highlighted by category+session name+today.
- Timing panel: header always shown, opens on active `I`/`S`, local toggle; remembers a snapshot during the day after completion, clears at midnight/event transition/no-spoiler. Basic positions, rider/team/color, lap, last lap and leader gap are shown. This is a **baseline**, not yet the full intended live-timing design (gap to rider ahead, sector times, published classification archive and session identity checks require further work).
- Weather uses `sensor.motogp_track_weather` attrs `air`, `ground`, `humidity`, `track`, `weather`. Invalid strings and numeric zero placeholders show `—`, not fake `0°`. Label says latest reported, **not assured live**; genuine zero-degree observations require validated source metadata to display safely.
- All source-controlled data inserted into HTML is escaped; rider colors restricted to six-digit hex. Spoiler hides timing and purges cached riders. Per-card clock tick every 30 seconds, cleaned on disconnect. No service calls on clicks.

## CI / validation

`frontend-check.yml` now runs `node --check` for **both** JS files and all pre-existing mobile frontend tests plus `node tests/frontend-next.cjs`. The new regression tests cover separate tag and duplicate script, expected event versus bogus timestamp, date/day selection, gray sessions, local category filters, placeholder/live weather, automatic and manual timing, cached finished riders, spoiler purge, midnight and interval cleanup. GitHub run `35388231813` completed **success** on commit `ade6501` and included the new test step.

CI does **not** verify actual HA/browser loading, CSS visual layout, click latency on the target device, timing endpoint identity or international timezone correctness. This is a dev/test artifact, not a production deployment.

## Guarded first install — user executes on HA only when ready

The exact published JS content at source commit `a72911c68f5daf35cddb5eac730b1e036a1adce6` has Git blob SHA-1 `a16f5b8e02d764396bce812121f5b9f26d186bee` (verify using `git hash-object`). The source URL is pinned to that commit, not a mutable branch. The terminal command intentionally refuses to overwrite an existing target file.

```bash
bash <<'BASH'
set -euo pipefail
TARGET=/config/www/ha-motogp-next-card.js
if [ -e "$TARGET" ]; then
  echo "STOP: $TARGET finns redan; ingen fil ersatt."
  exit 1
fi
SRC="$(mktemp /tmp/motogp-next.XXXXXX)"
trap 'rm -f "$SRC"' EXIT
curl -fsSL 'https://raw.githubusercontent.com/Jocke1970/ha-motogp/a72911c68f5daf35cddb5eac730b1e036a1adce6/frontend/ha-motogp-next-card.js' -o "$SRC"
EXPECTED=a16f5b8e02d764396bce812121f5b9f26d186bee
ACTUAL="$(git hash-object "$SRC")"
if [ "$EXPECTED" != "$ACTUAL" ]; then
  echo "STOP: JS hash mismatch: $ACTUAL"
  exit 1
fi
install -m 0644 "$SRC" "$TARGET"
echo "KLART: isolerad testfil installerad: $TARGET"
BASH
```

Then in Home Assistant add **one new** Dashboard Resource `/local/ha-motogp-next-card.js?v=0.2.0-dev.1-next-20260918-01` as **JavaScript module**, not as an additional reference to the old JS file. In `motogp-test` use dashboard editor > add manual card, replace the manual editor contents with the **complete one-card YAML**:

```yaml
type: custom:ha-motogp-next-card
```

Do **not** replace the entire `motogp-test` dashboard view or remove its old test card until visual validation. The `Card-test` mobile resource `/local/ha-motogp-card.js` and the working MotoGP dashboard must remain untouched. Hard reload browser if `Custom element doesn't exist`; inspect the visible footer `ha-motogp-next-card · next-20260918-01` to prove the new resource loaded.

## Test gates before touching any old card

1. `motogp-test` newly added card shows Austria 18–20 Sep rather than 26 Sep / unavailable. Check all 20 sessions via Total (when backend still provides them); Friday opens on Friday, others collapsed, finished passes gray. Switch categories without waiting for a HA service call.
2. Open another day and return to today, test manual close, reload and day change; note frontend-local manual state intentionally resets on reload.
3. Test timing during a real session and after finish; verify rider rows match event/category, spoiler hides all rows, no stale data across events. Do not infer real performance or timing correctness solely from synthetic CI.
4. Confirm latest reported weather fields are either reasonable observations or visibly unavailable; no fabricated zero degrees.
5. Record screenshot/behavior. Only then replace the broken *test* card, still leaving Card-test and original dashboard intact.

Rollback is simple: remove only the new `motogp-test` card and its distinct resource, then (optionally) delete **only** `/config/www/ha-motogp-next-card.js` after checking it is unused. Do not alter the old JS or any Python/YAML integration configuration.

## Known design debt for following versions

Backend timestamp strings currently embed `+00:00` but are treated as event-wall times to avoid the previously observed +2h shift; this is not a fully validated timezone conversion for all circuits. Incomplete/rebooted live lap history, per-rider best lap and sector support, final classification, stable session identity, shared global TV-delay display, precise live weather freshness, and measured interaction latency remain separate work. The old proposed `motogp_dashboard_mode_weekend_gate_candidate.yaml` is **not part of this JS test install**: user template already confirmed weekend_view on.
