# ha-motogp-card – dev preview

Fristående Lovelace-kort i JavaScript. Det är en **utvecklingsversion på `dev`**; `beta` och `main` är inte uppdaterade med kortet. Kräver varken `button-card`, `expander-card` eller `input_text`-hjälpare för att öppna och stänga sektioner.

## Installation i en TEST-vy

1. Hämta [`frontend/ha-motogp-card.js`](ha-motogp-card.js) från **dev**. Kopiera filen till `/config/www/ha-motogp-card.js` i Home Assistant.
2. Inställningar → Dashboards → Resurser → Lägg till resurs: `/local/ha-motogp-card.js?v=0.1.0-dev.2` som **JavaScript module**. Finns resursen redan, ändra URL/versionen i stället för att lägga in en dubblett. Gör en hård omladdning av webbläsaren.
3. Ersätt de gamla schema- och timingkorten i just test-vyn med [`dashboard/motogp_custom_card_dev.yaml`](../dashboard/motogp_custom_card_dev.yaml). Kör inte båda implementationerna samtidigt när du mäter responstid.
4. `mode: both` visar båda; `mode: schedule` och `mode: timing` kan placeras som två separata kort. `entities:` kan skriva över entity-id:n (se exempelfilen). `entities.spoiler` har standardvärdet `switch.motogp_no_spoiler`; ändra det om din switch heter något annat.

## Datakontrakt

- `sensor.motogp_next_race.attributes.sessions_all` för kombinerat schema med flera klasser; fallback `sessions` gäller bara en klass. Original-upstream skapar **inte `sessions_all`**, så behåll din fungerande multicategory-backend tills Python-migreringen är verifierad.
- `sensor.motogp_current_session`: sessionsnamn och `category`/`event`.
- `sensor.motogp_session_status`: `session_status_id`; `I` och `S` är aktiva.
- `sensor.motogp_rider_positions.attributes.riders`: position, namn, nummer, varv, senaste tid, gap, team/cykel och status.
- `sensor.motogp_race_lap_count` och `sensor.motogp_session_time_remaining`.
- `input_select.motogp_schedule_category` är frivillig, annars används `Total`.
- No Spoiler: switchen ovan och/eller sensor-attributet `spoiler_mode: true` eller state `Hidden` döljer timing; tidigare cache rensas.

## Beteende och begränsningar

- Dagens dag öppnas om den finns i schemat. En annan dag kan öppnas manuellt, en i taget; manuellt val återställs vid midnatt.
- Timingrubriken syns alltid. Förare öppnas när feeden blir aktiv och tidigare pass ligger kvar under väntan till nästa aktiva pass, eller till midnatt. Manuell dölj/visa respekteras vid följande sensoruppdateringar.
- Kategori **och** sessionsnamn måste matcha för LIVE-markerat schema. Identitet för tidigare timingbild innefattar även event.
- Klick hanteras lokalt i browsern utan service-anrop till HA och utan gammal `update_timer: 5s`. En 30-sekunderstimer uppdaterar klockrelaterade texter, medan HA-sensorändringar ger nya data.
- Mellanpassresultat lagras **endast i den öppna webbläsarens minne** och kan försvinna vid omladdning/HA-omstart. Backend-cache och TV-delay är senare Python-arbete.
- Ingen auto-växling av kategorifiltret eller gamla gap-trendpilar i denna första JS-version. Det här är inte en fullständig ersättning för alla gamla dashboardfunktioner ännu.
- API-tiderna tolkas tills vidare som banans wall-clock. Vid lopp i andra tidszoner kan svenska klockslag bli fel. Tidszonshanteringen ska lösas i Python-backend, inte med naiv `new Date(raw)` i gränssnittet.

## Test och nästa steg

GitHub Actions kör `node --check`, `tests/frontend-smoke.cjs` samt `tests/frontend-spoiler.cjs`. De testar bland annat auto/manuella expanders, kategori-matchning, sessionsbyte, spoilerläge och midnatt. Det är **inte** ett uppmätt hastighetstest i din Home Assistant.

Om kortet inte laddas: kontrollera resursen, sökvägen under `/config/www` och att URL:en använder `/local/`. Om schemat är tomt: kontrollera `sessions_all` på `sensor.motogp_next_race`.

Promotion: utveckla i **`dev`**, skapa PR till **`beta`** efter verklig HA-testning och först därefter PR från `beta` till **`main`**. Ingenting flyttas automatiskt mellan brancherna.
