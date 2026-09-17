# Dev UI test – 2026-09-17

Screenshots from the real HA test view confirm that the standalone card loads, the Total multi-category schedule is present, all three days can be expanded or collapsed, and the timing header toggles between showing and hiding the body. This is **visual/interaction evidence only**; click latency has not yet been measured.

## Confirmed frontend issues from code plus screenshots

1. **Bogus weather `Luft 0° · Bana 0°`.** In `frontend/ha-motogp-card.js`, `_scheduleMarkup()` builds weather strings using truthiness (`s.air && ...`). Numeric zero is hidden, but the string `"0"` is truthy and shown as a real measurement. Normalize numeric values and treat unavailable/zero placeholder weather as unknown; omit the weather row if both absent. Preserve genuine 0°C only if upstream adds an explicit validity flag or a proven actual measurement contract.
2. **Timing list is empty while `VÄNTAR` even if rider sensor contains riders.** `_timingMarkup()` selects `snapshot?.riders || (identity.active ? orderedRiders(states[ids.riders]) : [])`, so before the session starts (not active, no snapshot) a manual expand always says `Ingen timingdata tillgänglig än.`. Allow a manual, non-spoiler expansion to show the *current session's* rider data if present; do not auto-expand before activation and do not accidentally show the previous session as the current one. The source entity must be checked in HA before stating that data is definitely available.
3. **Today's auto-open starts only when today is one of the weekend dates.** All days folded the evening before the first session is consistent with current documented rules, but consider optionally auto-opening the first upcoming day to reduce an extra tap. User has not chosen this behaviour yet.

## Data and safety checks

- Keep local expanders instant; no helper service round-trip.
- Do not regress spoiler/no-spoiler protections or category+session matching.
- Add smoke tests covering `"0"` weather and a waiting session with rider attributes.
- Compare click-to-open/close latency with previous 4–7 seconds on the same device. Screenshots alone cannot establish speed.
- `beta` and `main` stay untouched until confirmed in HA.
