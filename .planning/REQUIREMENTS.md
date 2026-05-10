# Requirements: FitnessMaxxing

**Defined:** 2026-05-07
**Core Value:** Logga ett set och omedelbart se vad jag tog senast på samma övning — utan att tappa data, någonsin.

> **REQ-ID-konvention**: Vi behåller PRD:ns F-prefix (F1, F2, …) istället för standardmallens `CAT-01` — PRD är auktoritativ källa och 1:1-mappning gör att traceability stämmer mot dokumentet du redan skrivit. Nya krav som research surfade har ID F16+.

## V1 Requirements

Krav för initial release. Mappade till roadmap-faser i Traceability-sektionen.

### Authentication

- [ ] **F1**: Användarregistrering med email + lösen
  - Acceptans: signup → email verification (Supabase default) → log in → session persistens efter app-omstart

### Workout Plans

- [x] **F2**: Användare kan skapa, redigera och ta bort träningsplaner — Phase 4 Plans 02–03: CREATE side via plans/new (Plan 02), EDIT via plan-detail meta-form (Plan 03), DELETE via archive flow (ActionSheetIOS → Alert.alert destructive confirm → useArchivePlan; usePlansQuery filters archived_at IS NULL).
- [ ] **F4**: Användare kan lägga till och ordna om övningar i en plan
  - Acceptans: drag-att-ordna; ändringar persisterar offline och synkar vid återanslutning
  - **Status:** ADD side complete (Phase 4 Plan 03 — exercise-picker chained create-and-add); reorder side pending Plan 04-04

### Exercise Library

- [x] **F3**: Användare kan skapa egna övningar (ingen förladdad seed i V1) — Phase 4 Plan 03: exercise-picker inline create-form (namn + muskelgrupp + utrustning + anteckningar) chained to add-to-plan under shared scope.id='plan:<planId>' for FK-safe offline replay (RESEARCH §5).
  - Acceptans: namn, muskelgrupp, utrustning, anteckningar; visas i bibliotek vid plan-edit

### Active Workout (kärnflöde)

- [ ] **F5**: Användare kan starta ett pass från en plan
  - Acceptans: skapar `workout_sessions`-rad direkt vid "Starta pass"; återupptas vid app-omstart om `finished_at IS NULL`
- [ ] **F6**: Användare kan logga set (vikt + reps) under pass
  - Acceptans: ≤3 sek från knapptryck till lokalt sparat; per-set persistens (inte "save on finish")
- [ ] **F7**: Användare ser senaste värdet per övning vid loggning
  - Acceptans: visar set-position-aligned ("Förra: set 1: 82.5kg × 8") inte bara senaste single-värdet
- [ ] **F8**: Användare kan avsluta och spara pass
  - Acceptans: sätter `finished_at`; ingen "Discard workout"-knapp (data-loss-vector); återgår till hem

### History

- [ ] **F9**: Användare kan lista historiska pass
  - Acceptans: cursor-paginerad lista, sorterad på `started_at desc`

### Offline Sync (kritisk infrastruktur)

- [ ] **F13**: Pass kan loggas helt utan nät, synkar när det kommer tillbaka
  - Acceptans: airplane mode + force-quit + battery-pull under 25-set-pass = alla set överlever
  - **Bumpat från Bör → Måste** (PROJECT.md beslut 2026-05-07)

### Schema-only (UI senare)

- [x] **F17**: Set-typ-kolumn i `exercise_sets` (working/warmup/dropset/failure)
  - V1 levererar enum-kolumn med default 'working'. UI för att tagga sets ligger i V1.1.
  - Schema-migration är gratis innan data finns; expensive efter.

## V1 Bör

- [ ] **F10**: Graf per övning över tid (max vikt, total volym)
- [ ] **F15**: Dark mode-styling som **konvention i Phase 1** (`dark:` Tailwind-varianter från start). Toggle-UI ligger i V1.1.

## V1 Kan

- [ ] **F11**: RPE-fält (1-10) per set
- [ ] **F12**: Anteckningar per pass

## V1.1 Requirements

Skjuts till nästa release efter V1 är personligt validerat 4 veckor.

### Authentication

- **F14**: Apple Sign-In (App Store-blocker)

### Polish & Differentiators

- **F15-toggle**: Manuell dark mode-toggle i Settings (konventionen finns redan från V1 Phase 1)
- **F17-UI**: Set-typ-toggling under aktivt pass (warmup/working/dropset/failure)
- **F18**: PR-detection vid pass-avslut (Epley `w * (1 + r/30)`, max-vikt, max-volym per övning)
- **F19**: Vilo-timer som auto-triggas vid "Klart"-tap. **Research-flag** — kräver `expo-notifications` + `expo-keep-awake`, JS-suspension-trap att hantera

## V2 Requirements

App Store-launch-fas. Körs när V1 + V1.1 är validerade.

### App Store-blockers

- **F20**: Förladdat globalt övningsbibliotek (curation-arbete: namn, muskelgrupper, utrustning, ev. i18n)
- **F21**: EAS Build + TestFlight-pipeline (research-flag: credential-flow på Windows-only dev)

### Differentiators

- **F22**: Plan-scoped "förra värdet" (not bara global per övning)
- **F23**: "Repeat last session" CTA på hemskärm
- **F24**: Synlig sync-state-badge ("3 sets pending sync")

### Integrationer

- **F25**: Apple Health-integration (research-flag)
- **F26**: Hemskärms-widgets
- **F27**: CSV-export
- **F28**: Web-app (samma backend)
- **F29**: Android-version
- **F30**: Programmeringsmallar (5/3/1, PPL, Upper/Lower)

## Out of Scope

Explicit exkluderat. Dokumenterat för att förhindra scope creep och åter-debattering.

| Feature | Reason |
|---------|--------|
| Sociala features (delning, vänner, leaderboards) | Fokus är personligt verktyg, inte community |
| AI-coach / programmeringsförslag | Komplicerar utan att lösa kärnproblemet; kan adderas separat utan att påverka kärnflödet |
| Videos/animationer av övningar | Kostsamt att producera, marginellt värde för en användare som redan vet sina övningar |
| Apple Watch-app | V2+ fokuserar på iPhone; Apple Watch är eget projekt |
| Android-stöd | iPhone-fokus i V1/V1.1; V2 kan utvärdera Android |
| Förladdat övningsbibliotek (V1) | Användare skapar egna; schema tillåter `null user_id` så global seed kan adderas i V2 |
| Enhets-preferens kg/lb (V1) | Sverige-only V1 = kg räcker. Adderas vid App Store-launch (V2) |
| Apple Health-integration (V1/V1.1) | V2 endast — research-flag på integration scope |
| Plate calculator | Marginal nytta; V2 polish-feature |
| Supersets / drop-sets-flöde | UI är komplext; F17-tagging ger 80% av värdet utan UI-komplexitet |
| Nutrition / kostloggning | Helt separat domän; ut ur scope för all framtid |
| Gamification (streaks, badges) | Anti-feature: lekar på bekostnad av faktisk träning |
| Body-measurement tracking (vikt, omkrets) | Separat use case; V2+ om alls |

## Traceability

Vilka faser täcker vilka krav. Mappad av roadmap-skapandet 2026-05-07.

| Krav | Fas | Status |
|------|-----|--------|
| F1 (registrering + login) | Phase 3 — Auth & Persistent Session | Pending |
| F2 (planer CRUD) | Phase 4 — Plans, Exercises & Offline-Queue Plumbing | Complete 2026-05-10 (Plans 02–03) |
| F3 (egna övningar) | Phase 4 — Plans, Exercises & Offline-Queue Plumbing | Complete 2026-05-10 (Plan 03 picker chained create-and-add) |
| F4 (ordna övningar i plan) | Phase 4 — Plans, Exercises & Offline-Queue Plumbing | Partial — ADD side Complete (Plan 03); reorder side Pending Plan 04 |
| F5 (starta pass) | Phase 5 — Active Workout Hot Path | Pending |
| F6 (logga set) | Phase 5 — Active Workout Hot Path | Pending |
| F7 (senaste värdet) | Phase 5 — Active Workout Hot Path | Pending |
| F8 (avsluta pass) | Phase 5 — Active Workout Hot Path | Pending |
| F9 (historik-lista) | Phase 6 — History & Read-Side Polish | Pending |
| F13 (offline-stöd) | Phase 5 — Active Workout Hot Path | Pending |
| F17 (set-typ schema-only) | Phase 2 — Schema, RLS & Type Generation | Validated 2026-05-09 |
| F10 (graf per övning) | Phase 6 — History & Read-Side Polish | Pending |
| F15 (dark-mode konvention) | Phase 1 — Bootstrap & Infra Hardening | Pending |
| F11 (RPE per set) | Phase 7 — V1 Polish Cut | Pending |
| F12 (anteckningar per pass) | Phase 7 — V1 Polish Cut | Pending |

**Coverage:**
- V1 krav: 15 totalt (10 Måste + 1 schema-only + 2 Bör + 2 Kan)
- Mapped till faser: 15 ✅
- Unmapped: 0

**V1.1 / V2 (skissade i ROADMAP.md som framtida faser, ej mappade till V1):**
- V1.1: F14, F15-toggle, F17-UI, F18, F19
- V2: F20-F30

---
*Requirements defined: 2026-05-07*
*Last updated: 2026-05-07 after roadmap creation (traceability filled)*
