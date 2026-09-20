# Roadmap: automatisk sessionsloggning och varvhistorik

**Datum:** 2026-09-20  
**Status:** Beslutad målbild / ännu inte implementerad i HA-backend  
**Gren:** `dev`; ingen ändring av installerad integration, legacy-dashboard eller Next-resurs genom denna dokumentation.

## Syfte

Logga alla MotoGP-klasser och pass automatiskt i backend, helt oberoende av att Lovelace är öppen eller att användaren kör ett terminalskript. Spara **en permanent JSON-fil per session**, återuppta insamlingen efter Home Assistant-omstart, visa alla insamlade varvtider i en expander per förare i Next-livetimingen och bygg på sikt säsongsstatistik. Arkivet ska inte raderas vid nästa pass eller racehelgens slut: endast *aktiv sessionskontext* byts.

## Verifierad utgångspunkt och begränsningar

- Den granskade backend-snapshoten `backend/deployed/v1.0.9/` är en **daterad referens**, inte bevis för att aktuell HA-installation fortfarande är bitidentisk. Verifiera installerad Python innan en patch skrivs eller distribueras. Se [projektstatus](project-status.md) och [Python-audit](deployed-python-audit-2026-09-18.md).
- `helpers.parse_live_timing()` läser `session_status_id`, `session_id`, `event_id`, `category`/`championship_id` samt förarnas `rider_id`, `last_lap`, `last_lap_time` och `num_lap`. `last_lap` identifierar senast **avslutade** varv; `num_lap` kan avse pågående varv.
- `const.py` mappar `I`/`S` = pågående, `F`/`C` = avslutat, `N` = ej startat, `R` = röd flagg och `D` = försenat. Koordinatorn skickar redan händelserna `session_in_progress` och `session_finished`, men dess nuvarande övergångsdetektor jämför enbart statuskod. Loggern måste också jämföra sessionsidentitet, annars kan ett direkt passbyte med samma status missas.
- Koordinatorn hämtar rådata och anropar `_apply_tv_delay()` innan det exponerade `live` används. Normal polling i den granskade koden är 5 sekunder under pågående pass och 300 sekunder annars. Det ger ingen garanti för att varje varv eller första varvet fångas.
- `sensor.py` håller i dag en **minnesbaserad** mängd sedda varvnummer och personbästan, **inte** tid för vart och ett av varven; den uppdateras dessutom från sensorers egenskaper. Det är inte en permanent sessionslogger.
- Den manuella testinsamlingen 2026-09-20 gav ett användbart MotoGP-raceunderlag enligt analysen i projektchatten. Den testade däremot inte verkliga passbyten, rödflagg/depåfall, aktiv TV-fördröjning eller återstart. Den fristående JSONL-testloggen är *inte* en redan installerad backendfunktion och ska inte checkas in som kod.

## Beslutad målarkitektur

### 1. Backend äger loggningen

- Kör loggern **en gång per accepterad, TV-fördröjd koordinatoruppdatering**, oberoende av aktiverade sensorer och öppna dashboards. Använd inte Lovelace, sensor-property-access, separata HA-automations eller periodiska manuella skript som loggningens motor.
- Följ endast den snapshot som koordinatorn faktiskt exponerar efter fördröjningsbufferten; läs inte råflödet för att fylla arkivet i förtid. Arkivets läs-API och frontend måste respektera `no_spoiler` och motsvarande åtkomstgrindar; historiska filer får inte bli en bakväg för att se framtida, ännu ej TV-synkade data.
- Sessionsnyckel: säsong/event-ID + klass-ID/kategori + sessions-ID. Verifiera ID-fälten mot verkliga payloads. Om stabilt sessions-ID saknas, använd en tydligt märkt fallback inklusive event, klass, passtyp och schemadatum och skriv aldrig tyst över en annan session.
- Starta/återuppta vid verifierad sessionsidentitet med `I`/`S`. Behåll samma session vid `R` och `D`; registrera statusbyten. Markera som avslutad vid `F`/`C`, men behåll filen och tillåt verifierade korrigeringar av samma session efter målgång. Om en ny sessionsnyckel dyker upp ska en **ny fil** aktiveras även om statuskoden inte ändrats. En offline-/tom uppdatering är inte bevis på avslut.
- Förbättra bevakningen kring schemalagd start (från befintligt helgschema) och testa tätheten; status och sessions-ID är auktoritativa, klockslag endast för tidigare polling. Undvik onödigt tät polling dygnet runt.

### 2. Varvdata och integritet

- Modell: `rider_id -> last_lap -> {lap_time, seconds, observed_at, ...}` med kompletterande nummer/namn för presentation. Använd `last_lap > 0` plus giltig `last_lap_time`; `num_lap` är endast kontext. Dubbletter är idempotenta. En korrigerad tid för samma förar-ID och varvnummer ersätter den tidigare och dokumenteras vid behov.
- Markera saknade eller misstänkt ofullständiga varv explicit. Inga gissade tider, inga antaganden om full täckning efter HA-stopp eller nätverksbortfall. Personbästa och sessionsrekord beräknas från **faktiskt observerade giltiga varv** och märks partiella där det behövs.
- Förare som byter position/namn ska inte få ny historik om deras stabila ID är samma. Hantera saknat eller återanvänt förar-ID försiktigt, utan att slå ihop två förare på ett otestat namnmatchningsantagande.

### 3. Permanent arkiv och omstart

Exempel på önskad sökväg och läsbart filnamn:

```text
/config/motogp_data/
  2026/
    san-marino/
      san-marino_motogp_q1.json
      san-marino_motogp_q2.json
      san-marino_motogp_spr.json
      san-marino_motogp_rac.json
```

- Namnsätt enligt **racenamn_klass_session.json** med normaliserade säkra filnamn. Skydda mot kollisioner med sessions-ID (t.ex. ett kort ID-suffix vid behov); fullständiga käll-ID:n ska alltid finnas *inuti* filen. Filnamn från API får aldrig styra sökvägen direkt.
- Versionssätt JSON-schemat (`schema_version`) och lagra säsong, event-ID/namn, klass-ID/namn, sessions-ID/namn, tidsstämplar, status, `tv_delay`-metadata, täcknings-/luckflaggor samt förar- och varvposter. Spara inte hemligheter, abonnemangstoken eller råa autentiserade API-svar.
- Skriv uppdaterad sessionsfil **atomiskt** (temporär fil i samma katalog + `os.replace`), utanför HA:s event-loop med lämplig executor-/async-metod. Skriv bara när data/status faktiskt ändras. Hantera läs-/disk-/JSON-fel tydligt, utan att krascha hela integrationen eller förstöra en tidigare giltig fil.
- Vid HA-start: läs och validera relevant sessionsfil; slå samman nya observationer idempotent med rätt ID och fortsätt. Vid sessionsbyte: spara/slutför föregående kontext och öppna nästa fil. **Inga automatiska borttagningar av säsongsarkivet**. Ta höjd för diskförbrukning, separat retention/export som ett framtida uttryckligt användarval och att HA:s ordinarie backup bör inkludera arkivet.
- Arkivet ska inte speglas helt i `sensor.rider_positions`-attribut för varje uppdatering: undvik svällande HA-state/Recorder. Välj ett avgränsat, behörighetskontrollerat sätt för frontend att läsa en förares/sessionens historik när användaren öppnar den.

### 4. Next-frontend

- Varje förare får en expander med `varvnummer`, `varvtid`, PB/sessionsrekord samt tydlig märkning för saknade varv och partiella sessioner. Läs färdiga varvtider från backend, skapa inte separat browserlokal sanning. Historiken ska kunna visas efter målgång och uppdateras live när expandern är öppen.
- Bevara exakt **en** Next-Lovelace-resurs: `/local/ha-motogp-next.js`. Ingen ändring av legacy `ha-motogp-card.js`, HACS-resurser eller befintliga YAML-korttyper. Bygg och testversionera en ny Next-bundle innan installation.

## Implementeringsordning och godkännandekriterier

1. **Baseline och kontrakt:** jämför faktisk HA-backend mot daterad repo-snapshot; kartlägg API-fält, sessions-ID, fördröjning och nuvarande tester. Dokumentera installations- och rollbackplan; ändra inte historisk `backend/deployed/v1.0.9/`-snapshot direkt.
2. **Ren sessions-/varvlogik:** tester för `N -> I/S -> F/C`, oförändrad status vid ny sessionsnyckel, `R`/`D`, offline, felaktiga tider, dubbletter, korrigeringar, förare och luckor. Verifiera TV-fördröjningsordning och spoilerläge.
3. **Diskpersistens:** schema- och filnamnstester, atomisk skrivning, trasig JSON, saknad behörighet, abrupt omstart och återupptagning av *samma* session; nytt pass öppnar ny fil utan att radera den gamla.
4. **Helautomatisk drift:** verifiera att insamlingen kör utan öppen dashboard, med samtliga klasser, från första möjliga observerade varv och efter HA-omstart. Testa schemanära polling, sessionsavslut och racehelg; redovisa faktisk täckning och avbrott.
5. **Frontend:** expander per förare, dataläsning vid behov, spoilergrind, färdig/partiell märkning, regressionsprov och ny byggd Next-fil; använd befintlig JS-resurs och lämna originaldashboarden orörd.
6. **Säsongsstatistik (senare):** analys av pace/median/jämnhet och jämförelser per pass med tydliga täckningsflaggor. Inga däckblandningar eller sektortider utan verifierad källa.
7. **Möjlig officiell TimingPass-källa (separat framtida spår):** kontrollera abonnemangets villkor, teknisk åtkomst och tillåtna API-gränssnitt först; behåll nuvarande källa som reserv. Abonnemang betyder inte automatiskt tillgång till ett dokumenterat API.

**Definition av klart:** tester + verifierad HA-drift + kontrollerad rollback visar att samtliga pass loggas automatiskt *när HA är igång och data når integrationen*, historiken överlever omstart, ingen fil blandas ihop eller raderas vid nytt pass och inga otillåtna spoilers läcker. Vid HA-avbrott kan saknade API-varv inte utlovas att gå att återställa; luckor visas ärligt.

## Ändringsgräns

Detta dokument är en roadmap, **inte** en uppgift som redan är utförd. Varken permanent JSON-arkivering, återhämtning, fulla förar-expanders eller nya pollingregler är installerade bara för att roadmapen publicerats. Gör utvecklingsändringar först på `dev` med separata tester och granskad deploy; inga direktpatchar i `/config` utan verifierad baseline.
