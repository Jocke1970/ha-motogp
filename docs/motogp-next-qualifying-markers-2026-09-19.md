# MotoGP Next – Q1/Q2-gräns och startled (förslag, 2026-09-19)

## Verifierade tävlingsregler
- MotoGP: tio förare går direkt från Practice till Q2, och de två snabbaste i Q1 går vidare till Q2. Q2 avgör startpositionerna 1–12. Övriga Q1-förare får position 13 och bakåt beroende på Q1-resultat.
- Moto2/Moto3: fjorton förare direkt från Practice till Q2, fyra snabbaste i Q1 vidare till Q2. Q2 avgör startpositionerna 1–18; övriga Q1-förare får position 19 och bakåt.
- Startgridden använder tre förare per led i samtliga klasser. Bestraffningar och officiell resultatbekräftelse kan påverka slutlig grid.
- Källor: https://www.motogp.com/en/blog-articles/what-does-a-motogp-race-weekend-look-like/762537 ; https://www.motogp.com/en/news/2025/05/07/how-does-motogp-qualifying-affect-the-racex/748333 ; FIM 2026 Grand Prix regulations §1.16: https://www.fim-moto.com/fileadmin/user_upload/Documents/2026/FIM_2026_MotoGP__Moto2___Moto3_World_Championship_Regulations_Updates_24_April.pdf

## Avsett beteende i isolerat JS-timingkort
1. Under **Q1**, och endast för MotoGP/Moto2/Moto3, visa en diskret grön markör `Q2 ↑` vid provisoriska placeringar 1–2 (MotoGP) respektive 1–4 (Moto2/Moto3). Lägg en synlig avgränsningsrad `Q2-GRÄNS` efter sista markerade föraren, utan att störa kolumninriktning eller tillgänglighet. Under livepasset måste texten tydligt säga `PRELIMINÄRT` och följa data efter TV-delay.
2. Markera inte okvalificerade förare (`position <= 0`), ogiltiga nollvarv eller ofullständiga data som klara för Q2. Använd endast sessionens matchade förardata; ingen läcka från föregående pass eller annan klass. Om positionerna inte är tillförlitliga, utelämna markeringen och visa att kvalgränsen är okänd.
3. Efter Q1: formulera inte `VIDARE` definitivt förrän resultatet har bekräftats; en bekräftad klassificering ska prioriteras. Sensorstatus `F` räcker inte ensam för att bevisa officiell klassificering.
4. Under **Q2**: ta bort Q1-gränsen. En separat startgrid kan grupperas 1–3 `Led 1`, 4–6 `Led 2`, osv. MotoGP Q2 ger preliminärt led 1–4 (platser 1–12), Moto2/Moto3 preliminärt led 1–6 (platser 1–18). Använd separat verifierad gridinformation och respektera eventuella gridstraff före slutgiltig etikett.
5. Under Sprint/Race: ingen Q1-indikering i live timing; visa i stället gaptrend enligt originalkortets verifierade betydelse (grön upp = minskande gap, röd ned = ökande), separat per event/klass/session och utan att blanda TV-delay eller nulldata.
6. Synlighet/UX: stark kontrast i ljust och mörkt tema, inte bara färg som signal; skärmläsartext `Preliminärt vidare till Q2`, status på svenska. Ingen HA-service vid klick.

## Implementationsgräns
Detta är en dokumenterad design och testplan. **Inte kodad eller installerad ännu**. Befintliga `frontend/ha-motogp-next-split.js` split.2, originaldashboard, mobilkort och backend ska inte ändras på chans. Verifiera de exakta fälten i den aktuella originaldashboarden för gaptrend innan implementation och kör regressionstester för MotoGP/Moto2/Moto3 Q1, Q2, negativa positioner, sessionbyte och spoilerläge.