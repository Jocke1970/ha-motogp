# MotoGP Sensor v1.0.10 – lokal patch för Home Assistant

## Syfte

Det här paketet lägger våra lokala MotoGP-tillägg ovanpå upstream **Liionboy/motogp_sensor v1.0.10** utan att återinföra sådant som upstream redan har fixat.

Baslinjen som patchen är granskad mot är:

- Upstream-version: **1.0.10**
- Commit: `616de2262f3cbb9e6a396f0d4797c14493a67b27`
- Repo: `https://github.com/Liionboy/motogp_sensor`

Patchen är avsiktligt versionslåst. Om HACS senare installerar 1.0.11 eller högre ska scriptet uppdateras/granskas innan det körs igen.

## Vad upstream 1.0.10 redan löser

Vi ska låta upstream äga dessa delar:

- Förare med `position: -1` sorteras sist i live timing i stället för före P1.
- Fastest lap föredrar `best_lap_time` / `fastest_lap_time` före `last_lap_time`.
- Constructor standings beräknas från färdiga Sprint/GP-klassificeringar i stället för den tidigare felaktiga summeringen av rider standings.
- Version/Device info är uppdaterad till 1.0.10.

Den lokala patchen ändrar **inte** dessa implementationer.

## Vad den lokala patchen lägger till

### 1. Status `S` behandlas som aktiv session

Pulselive har visat `session_status_id: S` under verkligt aktiva pass.

Patchen gör därför att `S`:

- mappas till `In Progress`;
- ger 10 sekunders live-polling, precis som `I`;
- gör `session_in_progress == true`;
- triggar `session_in_progress`-event.

Detta är viktigt för Q1/Q2, live-countdown och dashboardens LIVE-status.

### 2. Live-kategori och championship-id bevaras

Pulselive skickar informationen i live-feedens `head`, men upstream 1.0.10 kastar fortfarande bort den.

Patchen lägger därför till:

- `category`
- `championship_id`

som gemensamma attribut på live-sensorerna.

Syftet är att dashboarden ska kunna skilja på exempelvis MotoGP, Moto2, Moto3, MotoE och supportklasser.

**Obs:** `category` exponeras rått från API:t. Vi mappar inte okända kategorikoder till ett snyggt namn förrän vi sett de verkliga värdena i HA.

### 3. MotoGP-helgens sessionsschema exponeras

Upstream hämtar MotoGP-kategorin för standings/resultat men exponerar inget komplett schema för nästa/aktuella GP.

Patchen hämtar därför MotoGP-sessionerna för `next_event`, normaliserar dem och lägger dem som attribut på:

`sensor.motogp_next_race`

Nya attribut:

- `category`
- `category_id`
- `sessions`
- `session_count`

Varje session innehåller normalt `id`, `name`, `type`, `number`, `date`, `status`, `circuit`, `track`, `air`, `ground`, `humidity` och `weather`.

Namn normaliseras till bland annat `FP1`, `FP2`, `Practice`, `Q1`, `Q2`, `Sprint`, `Warm Up` och `Race`.

## Inte med i denna patch ännu

Följande är planerade separat:

- **Backend TV-delay** / buffrad live timing.
- Slutlig friendly-name-mappning av live-kategorier.
- Dashboardens Lovelace-YAML.
- Eventuella framtida sektor-/track-statusfält.

Det gör baspatchen liten nog att lätt kunna rebasas mot nästa upstream-version.

---

# Rekommenderat uppdateringsflöde

1. Uppdatera `motogp_sensor` till **1.0.10 via HACS**.
2. Om möjligt, vänta med HA-omstarten tills patchen är lagd.
3. Lägg scriptet under `/config`, exempelvis:

   `/config/patch_motogp_sensor_v1_0_10.sh`

4. Kontrollkör:

```bash
bash /config/patch_motogp_sensor_v1_0_10.sh --check
```

5. Applicera:

```bash
bash /config/patch_motogp_sensor_v1_0_10.sh
```

6. Starta om Home Assistant.

Scriptet skapar **inga permanenta `.bak`-filer**. Alla modifierade Python-filer syntaxkontrolleras innan något skrivs.

## Om patchen redan är applicerad

Scriptet är idempotent. En ny körning ska ge:

`Status: redan patchad; inga ändringar behövs.`

## Om HACS får en ny upstream-version

Efter en framtida HACS-uppdatering kan de lokala ändringarna skrivas över.

Scriptet vägrar därför som standard patcha en annan upstream-version än 1.0.10. Det är avsiktligt.

Använd inte `--force` efter en vanlig versionshöjning innan den nya upstream-koden har granskats.

---

# Verifiering efter omstart

## A. Aktiv session / status S

Öppna:

`sensor.motogp_session_status`

När Pulselive skickar `session_status_id: S` ska state visas som `In Progress`, medan attributet fortfarande visar:

```yaml
session_status_id: S
```

Under aktiv session ska integrationen polla ungefär var 10:e sekund.

## B. Live-kategori

Öppna exempelvis `sensor.motogp_current_session` eller `sensor.motogp_rider_positions`.

Du ska se nya attribut:

```yaml
category: <rått API-värde>
championship_id: <id>
session_shortname: Q2
session_status_id: S
```

Skicka gärna värdet på `category` när vi ser MotoGP, Moto2 och Moto3 live. Då kan friendly-name-mappningen göras säkert.

## C. Helgens schema

Öppna:

`sensor.motogp_next_race`

Du ska se något i stil med:

```yaml
category: MotoGP
category_id: ...
session_count: 8
sessions:
  - name: FP1
    ...
  - name: Practice
    ...
  - name: FP2
    ...
  - name: Q1
    ...
  - name: Q2
    ...
  - name: Sprint
    ...
  - name: Warm Up
    ...
  - name: Race
    ...
```

Antalet sessioner varierar mellan helger.

---

# Dashboardlogik efter patchen

Målet är att skilja på **live-feedens kategori** och **MotoGP-schemat**.

Exempel när Moto3 kör Q2:

```text
Live timing:
Moto3 · Q2 · LIVE · 11:44 kvar

MotoGP helgschema:
Nästa MotoGP: Sprint · 15:00 · om 1 h 47 min
```

En Moto3/Moto2-session ska alltså inte längre få MotoGP-schemat att markera en session med samma namn som LIVE.

---

# Backend-delay – nästa steg

TV-delay ska byggas i backend och inte som en Lovelace-hack.

Planerad modell:

- integrationen fortsätter polla live-feed normalt;
- varje komplett live-snapshot timestamplas och läggs i en kort ringbuffer;
- dashboardens sensorer exponeras från snapshoten som ligger exempelvis 10–60 sekunder bakåt;
- hela livebilden fördröjs tillsammans: kategori, session/status, countdown, rider positions, gaps, pit, fastest lap och lap count.

Det undviker att olika delar av dashboarden hamnar ur synk med TV-bilden.

---

# Patch-scriptets säkerhet

Scriptet:

- kontrollerar att integrationen finns;
- läser `manifest.json`;
- kräver upstream 1.0.10 som standard;
- använder exakta, granskade patch-ankare;
- avbryter om upstream-koden inte längre ser ut som förväntat;
- syntaxkontrollerar alla modifierade Python-filer **innan** något skrivs;
- har `--check`;
- är idempotent;
- skapar inga permanenta backupfiler;
- försöker återställa originaltexten om en filersättning skulle misslyckas.

Alternativ katalog:

```bash
bash patch_motogp_sensor_v1_0_10.sh \
  --base /annan/sökväg/motogp_sensor
```

`--force` finns endast för manuell felsökning/utveckling och bör inte användas rutinmässigt.
