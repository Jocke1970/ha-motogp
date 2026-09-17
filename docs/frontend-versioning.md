# MotoGP UI: vilken version kör webbläsaren?

## Aktuellt utvecklingsbygge

- Frontend: **v0.1.0-dev.3**
- Branch: `dev`
- Bygg-ID: **`0b493073ef59`** (fingeravtryck av kortets ursprungliga JS-källkod före versionstämpling)
- Källcommit för bygget: `5900b8d8a2b1937345a26ced142da5a6fa474432`
- Byggdatum: 2026-09-17 20:48 UTC
- Fil som ska installeras: [`frontend/ha-motogp-card.js`](../frontend/ha-motogp-card.js). Det är samma filnamn i varje version.

**Källcommit är inte samma sak som committen som därefter skriver in versionsstämpeln.** Bygg-ID:t, versionsnumret och källcommitten är inbäddade i själva JS-filen. En query-parameter efter resursadressen är en cache-nyckel och bevisar inte vilken kod som körs.

## Se vilken kod som faktiskt laddats

Längst ned i **det nya `custom:ha-motogp-card`** syns exempelvis:

`UI v0.1.0-dev.3 · 0b493073ef59 ⓘ`

Klicka på den raden för att visa branch, full källcommit, byggdatum och bygg-ID. Det här visas från det körande JS-kortets egna inbäddade metadata, inte från YAML eller en HA-sensor.

I webbläsarens utvecklarkonsol kan man även läsa:

```js
customElements.get('ha-motogp-card')?.buildInfo
```

eller:

```js
window.haMotogpBuild
```

Vid registrering loggas samma information automatiskt med prefixet `[ha-motogp-card] Loaded frontend`. Om ett gammalt kort redan har registrerat samma namn kommer ny kod **inte** att kunna ersätta det i den öppna sidan; vi loggar då en varning med den gamla registrerade versionen. Gör en hård omladdning efter att rätt resurs laddats.

**Backendversionen är separat.** UI-versionen säger inget om vilken `motogp_sensor`-version eller lokal Python-patch som är installerad.

## Installera bara i Card-test

1. Hämta JS-filen från `dev`, kopiera den till `/config/www/ha-motogp-card.js` och ersätt den gamla testresursfilen.
2. Uppdatera den **befintliga** Lovelace-resursens URL till `/local/ha-motogp-card.js?v=0.1.0-dev.3-0b493073ef59` (JavaScript module). Registrera inte en dubblett. Query-strängen tvingar en ny cache-nyckel men är inte versionsbeviset.
3. Gör en hård omladdning av Card-test. Kontrollera att versionsraden på det **nya** kortet visar `v0.1.0-dev.3 · 0b493073ef59`. Om den saknas körs fortfarande en äldre modul eller fel kort.
4. Rör inte den fungerande gamla dashboarden. Ingen HA-omstart eller ompatchning av Python behövs för denna UI-ändring.

## Branchflöde och kommande byggen

`dev` → `beta` → `main` genom granskning/PR. Endast `dev` har versionsmärkningen just nu. Flytta inte koden till beta/main förrän den är verifierad i HA.

Versionen är nu en faktisk konstant i den distribuerade filen. En utvecklare ska höja versionsnumret och bygga ny metadata för varje ny distributionsfil; behåll inte ett gammalt bygg-ID på ny kod. `scripts/stamp_frontend_version.py` och dess CI-workflow är den **versionslåsta engångsstämplingen** för dev.3 (den avbryter vid okänd källfil); den kan inte återanvändas oförändrad efter att filen väl har stämplats. Nästa version behöver en granskad uppdatering av byggsteget, inte en manuell omskrivning av etiketten.

GitHub Actions testar JavaScript-syntax, befintliga UI-regressionstester samt ett separat test som bekräftar synlig version, detaljer, konsolmetadata och skydd mot dubbla resurser.
