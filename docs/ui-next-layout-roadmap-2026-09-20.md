# MotoGP Next — UI-roadmap: livetiming, startgrid och VM-ställning

**Datum:** 2026-09-20  
**Status:** Användarönskemål och konkret designkontrakt; **ej implementerat eller installerat**  
**Gren:** `dev`  
**Relaterat:** [Automatisk sessionsloggning och varvhistorik](session-logging-roadmap.md)

## 0. Skyddsgränser och utgångspunkt

- Nuvarande fungerande Next-installation är den tidigare testade `0.3.0-dev.3`, distribuerad som **en** JS-fil `/config/www/ha-motogp-next.js` och registrerad i Lovelace via **en** resurs `/local/ha-motogp-next.js`. Det är inte ett påstående om att användaren verifierat den senaste renderingen på sin HA.
- Originaldashboarden (`motogp-dash`), dess befintliga live-timing-header, `ha-motogp-card.js`, HACS-resurser och installerad Python ska lämnas orörda. Utveckla i isolerad Next-kod; ersätt inte testvyn eller YAML-korttyperna utan separat godkännande.
- `dashboard/live_timing_card_wip.yaml` är en historisk **WIP-referens** till headern, inte bevis för exakt aktuellt innehåll i användarens aktiva `motogp-dash`. Jämför med aktuell export/screenshot innan pixel- eller markup-replikering. Behåll liveindikator, sessionsnamn, status och korrekt varv/tid i headern. Ändra inte headern för att implementera tabellkolumnerna.
- TV-delay, matchning av event/klass/session och spoilergrind ska gälla **samtliga nya visningar**. Separata startgrid- eller standingsdata får inte läcka ett nyare loppresultat via snabbare statiska API-uppdateringar.

## 1. Livetiming: sju kolumner, två textrader

Exakt kolumnordning (desktop):

| Pos | Förare | Varv | Senaste varv | Framför | Ledare | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `3` | **Förarnamn #nummer**<br>Team | `12` | **1'30.450**<br>Snabbaste varv (förare): 1'29.980 | `+0.328` | `+1.895` | **▲ +5**<br>Förarstatus |

Illustrativ rad ovan innehåller **påhittade värden**.

- Team är underrad i **Förare** och förarens verifierade personliga snabbaste varv är underrad i **Senaste varv**. Behåll PB-markering på *nytt* PB och ett tydligt saknat-/partiellt-läge tills sessionens kompletta historik finns.
- **Framför** är `gap_prev`; **Ledare** är `gap_first`. Ledaren får `—` respektive `LEDARE`. Behåll fungerande gaptrender men säkerställ att kolumnordningen följer rubrikerna.
- `Varv` använder befintlig aktuell varvräkning med tydlig datakälla; avslutade varv i historik/expander använder **`last_lap`** (inte `num_lap`).
- Status har två rader: progression från startposition och förarstatus (`PIT`, `RT` osv.). Progression = `startposition - aktuell position`: positiv = `▲ +N`, negativ = `▼ −N`, lika = `= 0`. Visa **`—`** när startgrid eller säker matchning saknas eller föraren saknar klassificerad position. Visa progression **endast i RAC/SPR**, inte i fri träning/kval.
- Behåll teamfärg, förarnummer, läsbar kontrast och utökbar förarrad. Förarens varv-expander från [sessionsroadmapen](session-logging-roadmap.md) läggs som en fullbreddsruta **under samma förare**, inte som en åttonde tabellkolumn; dess data måste komma från backendarkivet, inte improviserad browserhistorik.
- Mobil: bibehåll alla uppgifter med horisontell skrollning eller en separat kompakt radlayout; aldrig felkopplade rubriker och värden. Säkerställ korrekt `aria-expanded`/tangentbordsstöd när expandern finns.

### Ikonografi och rekord

- Byt ut **⚡** mot en klocka/timer **⏱** för *totalt snabbaste verifierade varvtiden i aktuell session*, såväl i separat rekordrad som i förare-radens eventuella rekordmarkering. Använd endast konstaterad rekordtid; `lap_history_partial=true` måste visa **"Snabbaste observerade varv"**, inte ett obetingat sessionsrekord.
- PB har separat beteckning och får inte felaktigt visas som nytt PB på efterföljande, långsammare varv. Senaste varv och förarens snabbaste historiska varv är två olika datafält.
- Behåll chipet för senaste livetiminguppdatering och dess varning för gamla data.

## 2. Live-timing-header från `motogp-dash`

- Återanvänd/återskapa den **faktiskt installerade** headern från `motogp-dash` i Next; ersätt den inte med en ny, generell tabellrubrik.
- Minimikrav från WIP-referensen: sessionsnamn, status/LIVE-indikator samt varv och/eller korrekt återstående tid. Bevara Next-funktionerna för TV-delay, ålderschip, show/hide och säker matchning. Bekräfta layout mot aktuell originaldashboard innan ny build.
- Tid före start är inte samma sak som sessionens `remaining`-värde; håll isär sessionens längd, startnedräkning och aktiv sessionsklocka.

## 3. Startgrid — visas från T−15 minuter

- Startgrid för respektive klass finns i `sensor.motogp_next_race.attributes.start_grids` i den granskade backend-snapshoten. Normaliserade poster innehåller bland annat `position`, `number`, `rider` och `team`. Detta är ett **datakontrakt att verifiera i installerad HA**, inte garanti att alla pass har komplett grid.
- Visa startgrid **15 minuter före verifierad/schemalagd start för RAC/SPR**, för den aktuella klassen och rätt evenemang. Säkerställ korrekt lokal tidszon; befintliga Next-koden tolkar vissa API-tider som wall-clock och denna avvikelse får inte bli ett falskt T−15.
- Om start skjuts upp: behåll grid synligt fram till faktisk start eller verifierad ny starttid. När loppet pågår får grid gärna finnas som nedfällbar referens så att progression kan granskas; dölj igen efter sessionens slut. Aldrig fel klass, fel helg eller för tidig spoiler.
- Matchning av grid mot förarrad: helst stabilt förar-ID om det senare görs tillgängligt; nuvarande normaliserade grid saknar detta och kräver säker klass-/eventmatchning + unikt nummer och kontroll för dubbelnummer. Matcha **inte enbart namn**. Om matchningen är tvetydig, visa inte progression.
- Testa fallet utan grid, sena schemaändringar, inställt pass och fördröjd feed.

## 4. VM-ställning: `Moto3 · Moto2 · MotoGP`

- Tre synliga klassflikar i **den ordningen**, en klass i taget, tydlig aktiv markering. Välj som rimligt standard den klass som användaren har vald/aktiv om data finns, annars MotoGP; ingen automatisk växling mitt under användarens manuella val.
- Varje tabell visar minst position, förare och poäng. Status som när data uppdaterades och ett tydligt tomläge om klassen saknar tillgänglig data. Byt aldrig etikett till Moto2/Moto3 om innehållet egentligen är MotoGP-data.
- **Backendberoende:** Den granskade `sensor.motogp_rider_standings` exponerar endast `static['rider_standings']`, och koordinatorns hämtning väljer MotoGP-kategori. Utöka till en korrekt `standings_by_category` eller separata sensorsignaler för samtliga tre klasser innan flikarna aktiveras. Kontrollera datakontrakt, schemaläggning och HA-attributstorlek/Recorder-belastning.
- Sektionen ska behålla sitt expanderbeteende om användaren tidigare valt den, och visa spoiler-säkra poäng (t.ex. dolt under aktivt spoilerläge om statisk API-data är nyare än TV-fördröjd bild). Separerad från live-kategorifiltret för helgschemat om ingen uttrycklig koppling önskas.

## 5. Genomförande och acceptanstester

1. **Frys baseline:** bekräfta faktisk `0.3.0-dev.3`-rendering, aktivt `motogp-dash` header-YAML/export och installerade sensorattribut. Dokumentera versions-ID, byggkällor och rollback; ändra inte `backend/deployed/v1.0.9/` historiska snapshot.
2. **UI-pass A, backendfri:** rubriker/kolumnordning, team- och snabbaste-varv-underrader, ⏱-rekordikon, statusrad för känd förarstatus samt bibehållen header, ålderschip och gaptrender. För progression utan verifierad grid är det enda korrekta värdet `—`.
3. **UI-pass B, beroende av data:** T−15-grid och robust startpositionsmatchning; regressionstest för RAC/SPR, flera klasser, uppskjuten start, fel tidszon och utebliven grid.
4. **Backend + UI-pass C:** komplett standingsdata Moto3/Moto2/MotoGP och klassflikar, säkert spoilerbeteende, saknade data och regression av nuvarande MotoGP-tabell.
5. **Varv-expander:** först efter att backendloggning och permanent arkiv i sessionsroadmapen är implementerade och verifierade.
6. **Leveransgrind:** isolerad ny versionerad enkelbundle i `dist/ha-motogp-next.js`, tester för gammal/ny build samt installerens tillåtna blob-hash, CI-grönt, testning i HA och rollback. **Ingen ny Lovelace-resurs eller YAML-korttyp.** Originaldashboard, `main` och `beta` lämnas orörda tills separat granskning.

## Status och beroenden

**Verifierat i kod:** Nuvarande Next-tabell har redan sju kolumner, teamrad, gap_prev/gap_first samt extra rekordmarkering via tillägg; grid per klass exponeras genom `next_race.start_grids`; Championship-sensorn i backend innehåller inte klassvisa tabeller för alla tre önskade klasser. `dashboard/live_timing_card_wip.yaml` visar en tidigare headeridé men är inte en verifierad aktuell aktiv export.

**Inte klart:** Denna dokumentation är en plan, inte en UI-patch. Ingen ⏱-ändring, T−15-grid, startpositionsprogression, VM-flikar eller varv-expander har installerats genom roadmapen. Dessa ska byggas/testas i ordning ovan utan att störa fungerande dashboard.