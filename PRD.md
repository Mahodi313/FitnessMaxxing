# PRD — Gym Tracker

## 1. Problem
Jag tränar på gym och vill veta vad jag tog senast (vikt, reps) på varje övning, så jag kan progressera systematiskt. Pappersanteckningar och Notes-appen är klumpiga. Befintliga appar är antingen för komplexa eller har features bakom betalvägg.

## 2. Mål
Bygga en personlig, snabb, gratis app där jag:
- Skapar mina egna träningsplaner med övningar
- Loggar set, reps och vikt under passet
- Ser direkt vad jag tog senast på samma övning
- Får data synkad mellan iPhone och eventuellt iPad/dator i framtiden

## 3. Icke-mål (V1)
- Sociala features (delning, vänner, leaderboards)
- AI-coach eller programmeringsförslag
- Videos/animationer av övningar
- Apple Watch-app
- Android-stöd

## 4. Användare
- Primär: jag själv
- Sekundär (efter App Store-launch): andra som vill ha en enkel, ren tracker

## 5. Kärnflöden (V1)

### 5.1 Skapa träningsplan
Användare → "Ny plan" → namnger ("Push Day") → lägger till övningar från bibliotek (eller skapar nya) → sparar.

### 5.2 Starta pass
Användare → väljer plan → "Starta pass" → ser lista över planens övningar i ordning.

### 5.3 Logga set
För varje övning: ser senaste värdet ("Förra: 80kg × 8 reps") → matar in nya set (vikt + reps) → markerar set som klart → går till nästa övning.

### 5.4 Avsluta pass
"Avsluta pass" → sparar med tidsstämpel → tillbaka till hem.

### 5.5 Se historik
Per övning: graf över tid (max vikt, total volym), senaste 10 passen som lista.

## 6. Funktionella krav

| ID | Krav | Prioritet |
|----|------|-----------|
| F1 | Användarregistrering (email + lösen, eller Apple Sign-In) | Måste |
| F2 | Skapa, redigera, ta bort träningsplaner | Måste |
| F3 | Bibliotek av övningar (förladdat + egna) | Måste |
| F4 | Lägga till/ordna om övningar i en plan | Måste |
| F5 | Starta ett pass från en plan | Måste |
| F6 | Logga set (vikt + reps) under pass | Måste |
| F7 | Visa senaste värde per övning vid loggning | Måste |
| F8 | Avsluta och spara pass | Måste |
| F9 | Lista historiska pass | Måste |
| F10 | Graf per övning över tid | Bör |
| F11 | RPE-fält (rate of perceived exertion) | Kan |
| F12 | Anteckningar per pass | Kan |
| F13 | Offline-stöd (logga utan nät, synka senare) | Bör |
| F14 | Apple Sign-In | Bör |
| F15 | Dark mode | Bör |

## 7. Icke-funktionella krav
- **Snabb**: Loggning av ett set ska ta ≤ 3 sekunder från knapptryck till sparat
- **Pålitlig**: Får ALDRIG förlora ett loggat set
- **Privat**: All data tillhör användaren, RLS i Supabase
- **Offline-tolerant**: Pass måste kunna loggas utan nät
- **Billig**: Ska rymmas inom Supabase free tier för enskild användare

## 8. Framgångskriterier
- Jag använder appen själv på alla pass i 4 veckor utan att gå tillbaka till papper
- Färre än 1 bug per veckas användning
- Synk fungerar mellan iPhone och en andra enhet (iPad/web)

## 9. Framtida features (V2+)
- Apple Health-integration
- Widgets på hemskärmen
- Programmeringsmallar (5/3/1, PPL, etc.)
- Export till CSV
- Web-app (samma backend)
- Android-version
- Delade pass med träningskompis

## 10. Tidsram
Inga hårda deadlines. Bygg i kvällar/helger. Mål: V1 körbar på egen telefon inom 4-6 veckors arbete.
