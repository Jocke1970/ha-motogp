# UI-beteende: dagschema och live timing (förslag 2026-09-17)

Status: **design dokumenterad, inte implementerad**. Skärmdumparna från 2026-09-17 visar ett nyare, kombinerat MotoGP/Moto2/Moto3-schema (`Total`) än de YAML-prototyper som just nu finns i `dashboard/`. Uppdatera inte de äldre prototyperna och kalla dem aktuella utan att först hämta dashboard-YAML från den körande Home Assistant-installationen.

## 1. Helgens schema: aktuell dag öppen

- Visa hela helgens schema som dag-sektioner med **en header per dag** och två kolumner med pass när en dag är expanderad.
- Endast **dagens** sektion öppnas automatiskt. Övriga dagar visas som hopfällda headers med datum, antal pass och gärna kort förhandsvisning (`nästa pass` / `klart`).
- Vid midnatt växlas autovalet till den nya dagen; den tidigare dagens schema fälls ihop.
- På dagar då tävlingshelgen inte har några pass: håll samtliga dagar hopfällda, men visa nästa kommande pass i kortets huvudheader. Alternativet att öppna en framtida dag manuellt ska alltid finnas.
- Manuell öppning av en annan dag bör inte orsaka att dagens automatiska dag också måste vara synlig. Om användaren vill ha flera dagar öppna samtidigt ska det vara ett uttryckligt designval.
- Behåll kategorin (MotoGP/Moto2/Moto3/...) på varje pass, även om kategorifilter ändras.
- LIVE-markering måste matcha **kategori + session** (helst session-id), inte enbart `FP1`/`Q2`.
- Datum och gräns vid midnatt ska tolkas enligt avsedd tidszon. Tidpunkterna i Pulselive har tidigare gett +2 h med naiv JavaScript-UTC-konvertering; laga inte detta genom att återintroducera automatisk `new Date(raw)`-tolkning utan granskning.

## 2. Live timing: automatiskt synlig när det finns relevant data

Headern/rubriken är **alltid synlig** och visar kategori, session, status och lämplig återstående tid. Själva förarlistan styrs separat:

| Tillstånd | Förarlistans standardläge |
|---|---|
| Före dagens första aktiva pass | Hopfälld. Headern visar t.ex. `Moto3 · FP1 — VÄNTAR` och `35:00 session` när det är en sessionslängd, inte nedräkning till start. |
| Pass börjar (`I` eller `S`) | Fäll ut automatiskt. |
| Pass avslutat, ännu inget senare pass har börjat **samma dag** | Behåll listan utfälld så att resultat/positioner kan läsas. Märk tydligt `AVSLUTAD`, inte `LIVE`. |
| Ett senare pass börjar samma dag | Växla till det nya passets data; visa nya passet utfällt. Gamla passet ersätts och ska inte felaktigt kallas live. |
| Dagens sista pass avslutat | Behåll listan utfälld fram till lokal midnatt. |
| Lokal midnatt passerad | Fäll ihop listan, behåll headern. |
| Ingen giltig feed / spoiler-läge | Visa informativ header; läck inte förare/resultat när spoiler-läget är aktivt. |

**Manuell kontroll:** Det måste finnas en fungerande pil/expander för att öppna/stänga förarlistan oavsett automatik. Beslut behövs om manuellt val ska gälla tills nästa pass blir aktivt eller tills användaren återställer `Auto`. Föreslagen modell: `Auto / Visa / Dölj`, tydligt visad i UI. Byt till `Auto` vid nytt pass eller nästa dag endast om det är förväntat av användaren.

**Persistens:** Autoöppning/manuelldöljning får inte flimra eller nollställas av var 10:e sekunds sensoruppdatering. Att lägga en vanlig `<details>` direkt i ett `custom:button-card`-HTML-fält är riskabelt när hela fältet renderas om. Välj en expander/conditional-lösning med dokumenterat beteende eller en HA-helper som håller användarens läge. Vid behov lagrar backend även senast aktiverad session/tidpunkt så att logiken överlever omstart och HA-frontendrefresh.

## 3. Implementationsprincip

- Separera **domänlogik** (vilken dag och session, status, när en session startade, när förra var den sista) från **visningsläge** (öppen/stängd).
- Tolka `I` och `S` som aktiva för de feeds där detta är verifierat.
- I totalvyn ska samma sessionnamn i olika klasser inte kollidera. Föredra API-session-id; annars matcha kategori och sessionnamn inom aktuellt event.
- Visa **rätt kategori** i header och pass, och låt inte statiska MotoGP-pass påverkas av en aktiv Moto3-session med samma kortnamn.
- Behåll förarlistan efter avslutat pass även om nästa pass har status `N`; släpp först när nästa pass faktiskt blir aktivt eller vid midnatt.
- Om feedens nuvarande session skiljer sig från den senast aktiva måste vi skilja på ny `N` (förhandsdata, ska inte röja den gamla listan oavsiktligt) och ny aktiv `I/S`.
- Ingen automatisk tilläggskod för TV-delay i detta steg; den ska komma som separat backendförändring.

## 4. Underlag som behövs för säker implementation

Det som ligger i repot idag (`dashboard/weekend_schedule_2col_wip.yaml` och `dashboard/live_timing_card_wip.yaml`) beskriver den tidigare MotoGP-enda prototypen. Skärmdumparna visar en nyare implementation med `Total`, stödklasser och annat kortutseende. Hämta därför **aktuell komplett YAML** för schemakortet och timingkortet (alternativt dashboard-vyn där de ingår) från Home Assistant innan kod uppdateras; annars riskerar vi att skriva över de nya funktionerna med en gammal variant.

Efter implementation: verifiera föregående/nästa dag, midnatt, pass i olika klasser med samma namn, fullföljt sista pass, HA-omstart och manuell kollaps under pågående pass.
