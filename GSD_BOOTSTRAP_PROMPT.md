# GSD Bootstrap Prompt

Kopiera HELA texten nedan (mellan de två linjerna) och klistra in i Claude Code som **din allra första prompt** när du sitter i projektmappen `gym-tracker` med Claude Code igång.

GSD-skills laddas automatiskt — du behöver inte aktivera något manuellt.

---

```
Hej Claude! Jag startar ett nytt projekt och vill köra GSD-flödet (Get Shit Done) från början till slut. Innan du gör något annat, läs följande:

VIKTIG KONTEXT OM MIG:
- Jag är en van utvecklare i andra språk men HELT NY på React Native och TypeScript
- Jag bygger den här appen för att lära mig — så förklara nya koncept första gången de dyker upp (t.ex. Expo Router, TanStack Query, RLS, NativeWind)
- Jag kör Windows + PowerShell + Claude Code nativt (inte WSL)
- Jag använder Expo Go på iPhone för utveckling
- Mål: en personlig fitness-app för iPhone, senare eventuellt App Store

VIKTIG KONTEXT OM PROJEKTET:
Jag har förberett två referensdokument i projektroten som beskriver vad jag vill bygga och hur:

1. PRD.md — produktkrav: vad appen är, användarflöden, funktionella krav (F1-F15), prioriteringar V1/V2
2. ARCHITECTURE.md — teknisk stack, datamodell (Postgres/Supabase med RLS), mappstruktur för Expo, beslutsregister

Läs BÅDA dessa filer noggrant innan du gör något annat. De ska användas som primärkälla när GSD ställer frågor under /gsd-new-project — istället för att jag ska upprepa allt manuellt.

DET HÄR VILL JAG ATT DU GÖR:

Steg 1: Bekräfta att du läst PRD.md och ARCHITECTURE.md. Sammanfatta i 5-7 punkter vad du förstår om projektet, så jag kan korrigera missförstånd innan vi går vidare.

Steg 2: Vänta på att jag säger "kör".

Steg 3: När jag säger "kör", starta /gsd-new-project. Under det flödet:
- Använd PRD.md och ARCHITECTURE.md som primärkälla för all information om vad/hur
- Ställ bara frågor om saker som INTE redan är besvarade i dokumenten
- Föreslå defaults baserade på dokumenten istället för att fråga om varje detalj
- För tekniska val som redan är låsta i ARCHITECTURE.md (Expo, Supabase, NativeWind, TanStack Query, Zustand, TypeScript): bekräfta dem snarare än att utmana dem
- Föreslå valfria förbättringar/risker du ser, men kör inte över mina val

Steg 4: När roadmappen är klar — innan jag godkänner — peka ut 2-3 saker du tror är de svåraste delarna givet att jag är ny på React Native, så jag mentalt kan förbereda mig.

EXTRA REGLER UNDER HELA PROJEKTET:
- Använd svenska eller engelska — anpassa efter min senaste prompt
- Var ärlig: om du tycker jag tänker fel, säg det. Don't be a pushover.
- Föreslå commit-meddelanden i konventionellt format (feat:, fix:, chore:, docs:, refactor:)
- ALDRIG hardkoda secrets eller API-nycklar
- ALDRIG stäng av Supabase RLS — påminn mig att skapa policies när nya tabeller läggs till
- Använd expo-secure-store för sessions, inte AsyncStorage
- Validera all extern data med zod

Börja med Steg 1.
```

---

## Vad gör den här prompten?

1. **Sätter persona och kontext** — Claude vet att du lär dig och behöver förklaringar
2. **Pekar på dina referensdokument** — GSD ställer färre, smartare frågor
3. **Definierar regler som överlever hela projektet** — säkerhet, kodstandard, kommunikationsstil
4. **Pausar för bekräftelse** — du får chansen att korrigera missförstånd innan GSD drar igång
5. **Ber om en risk-heads-up** — du vet i förväg var du behöver vara extra fokuserad

## Tips när du klistrat in

- Läs Claudes sammanfattning **noga**. Om något är fel — säg ifrån direkt innan du säger "kör".
- När `/gsd-new-project` startar: ta dig tid. 30-45 min av bra svar nu = veckor av sparat arbete senare.
- Om GSD frågar något du verkligen inte vet: be om rekommendation, inte om att gissa själv.

Lycka till! 🚀
