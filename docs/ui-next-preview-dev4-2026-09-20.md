# MotoGP Next UI preview `0.3.0-dev.4`

**Date:** 2026-09-20. **Branch:** `dev`. **State:** source, compiled one-file bundle, and installer published with automated tests; **not deployed to, or visually verified in, the user's HA**. This release note supersedes the implementation-status statement in [the earlier UI roadmap](ui-next-layout-roadmap-2026-09-20.md), while retaining that document's remaining requirements.

## Delivered in the isolated Next preview

- Single compiled JS at `dist/ha-motogp-next.js`; unchanged existing resource `/local/ha-motogp-next.js`, two existing custom card types, no original dashboard/backend changes. Display version `0.3.0-dev.4`; pinned Git blob `1f99efb65c9ab8087b51079b25ce283324ebfe8d`, published by commit `b7dbc1a542d1863004602f37c32e887d13c006d6`.
- Seven-column timing layout: POS / FÖRARE (team second line) / VARV / SENASTE VARV (best available rider lap second line) / FRAMFÖR / LEDARE / STATUS (start-position progression over rider status). Existing gap trends, PB, record summary, feed-age chip, Q1 markings, show/hide and TV-delay matching remain in the underlying verified Next baseline.
- Session-record icon changes from lightning to `⏱`. A red LIVE dot and existing header status/time are retained as an initial approximation of `motogp-dash`. Exact visual match still needs current original-dashboard comparison and a HA screenshot.
- Start-position progression calculated **only during a verified matching RAC/SPR live session** from the same event's class-specific `next_race.attributes.start_grids`, requiring one unique starting-grid rider number and unique grid position. Missing/ambiguous grid or qualifying yields `—`, never a guessed value. Existing grid must be present in the user's backend.
- Prestart grid appears for the closest RAC/SPR with a valid scheduled local start within T−15 through start; when not published, it shows a clear empty state. No grid in spoiler mode. Postponements, status-delayed retention and keeping a collapsible grid during the race remain future work; source times currently use the inherited local-wall-clock convention and require real timezone verification.
- VM section has three selectable tabs in order Moto3 / Moto2 / MotoGP. MotoGP shows the existing championship sensor when available; Moto2 and Moto3 show an explicit backend-needed message, **not mislabeled MotoGP standings**. VM section is hidden in spoiler mode, and standings rows are withheld while a matching session is LIVE. Full class-specific backend and further postrace TV-delay verification remain open.
- Full per-rider lap expanders are **not** included: those depend on the automatic persistent backend session archive in [its roadmap](session-logging-roadmap.md).

## Verified CI and safe deployment

- [Single-file build, old and new regression, installer and tamper checks](https://github.com/Jocke1970/ha-motogp/actions/runs/35513487589): green.
- [Single-file publication](https://github.com/Jocke1970/ha-motogp/actions/runs/35513391923): green.
- `scripts/install-next-one.sh` accepts only the Git blob of installed `0.3.0-dev.3` (`b15fb60af3a8140c191261f9ec0eac224b530d7b`) or an absent target and verifies the exact new blob before atomic replacement. It stops on unknown local files; no additional Lovelace resource or HA restart.
- Browser visual layout and actual HA sensor data still require validation. Preserve the old full JS file separately before any later rollback workflow; do not claim on-host validation from CI.

## Next UI iteration after screenshot

Verify live header against current `motogp-dash`, mobile column readability, on-host grid/driver-number matching, actual timezone and postponed-start behavior, progression after finish, tab/standings layout, and the backend-provided historical lap expanders. Do not promote to `beta` or `main` based solely on synthetic tests.
