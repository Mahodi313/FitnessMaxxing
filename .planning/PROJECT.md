# FitnessMaxxing

## What This Is

En personlig gym-tracker för iPhone där användaren skapar egna träningsplaner, loggar set under passet, och ser direkt vad senaste värdet var per övning. V1 byggs som ett personligt verktyg; V2+ kan eventuellt lanseras till App Store.

## Core Value

Logga ett set och omedelbart se vad jag tog senast på samma övning — utan att tappa data, någonsin.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- **F15 (konvention)** — Validated in Phase 1: dark mode established as a project-wide convention (`darkMode:'class'` in `tailwind.config.js` with NativeWind 4 system-theme bridge); `dark:` variants used from start in `app/app/index.tsx`, status-bar + nav-header conventions captured in `CLAUDE.md ## Conventions`. Manual toggle UI deferred to Phase 7.
- **F17 (set-typ schema-only)** — Validated in Phase 2: `set_type` Postgres ENUM with values `working | warmup | dropset | failure` is live in remote DB and surfaces through `app/types/database.ts` to the typed Supabase client. `is_warmup` removed everywhere. UI for toggling set type is deferred to V1.1 — V1 always writes `'working'` (default).
- **F1** — Validated in Phase 3: email/password registration + sign-in working end-to-end with Supabase Auth + LargeSecureStore session persistence; 9/11 UAT items pass, 2 V1.1-deferred (deep-link email-confirm carry-over).
- **F2 / F3 / F4** — Validated in Phase 4: full plan CRUD (create/archive/edit), exercise CRUD with chained create-and-add, plan_exercise CRUD with two-phase-negative-bridge drag-reorder. Offline-first TanStack v5 queue with optimistic mutations, scope.id-serialized replay, manual airplane-mode UAT signed off 2026-05-10. Code review CR-01 + CR-02 (reorder offline data-loss) closed in commit `66d0804`.

### Active

<!-- Current scope. Building toward these. Mappade från PRD F1-F15. -->

#### V1 Måste (kärnflöde)

- [x] **F1** — Användarregistrering med email + lösen (Phase 3, 2 V1.1-deferred UAT gaps)
- [x] **F2** — Skapa, redigera, ta bort träningsplaner (Phase 4)
- [x] **F3** — Övningsbibliotek (egna övningar, ingen seed i V1) (Phase 4)
- [x] **F4** — Lägga till och ordna om övningar i en plan (Phase 4)
- [ ] **F5** — Starta pass från en plan
- [ ] **F6** — Logga set (vikt + reps) under pass
- [ ] **F7** — Visa senaste värdet per övning vid loggning
- [ ] **F8** — Avsluta och spara pass
- [ ] **F9** — Lista historiska pass
- [ ] **F13** — Offline-stöd: pass kan loggas utan nät, synkar när det kommer tillbaka *(bumpat från Bör → Måste pga "får aldrig förlora ett set")*

#### V1 Bör

- [ ] **F10** — Graf per övning över tid (max vikt, total volym)
- [ ] **F14** — Apple Sign-In (V1.1)
- [x] **F15** — Dark mode (konvention etablerad i Phase 1; manual toggle UI deferred till Phase 7)

#### V1 Kan

- [ ] **F11** — RPE-fält (1–10) per set
- [ ] **F12** — Anteckningar per pass

### Out of Scope (V1)

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Sociala features (delning, vänner, leaderboards) — fokus är personligt verktyg
- AI-coach / programmeringsförslag — komplicerar utan att lösa kärnproblemet
- Videos eller animationer av övningar — kostsamt att producera, marginellt värde
- Apple Watch-app — V2 i tidigast
- Android-stöd — iPhone-fokus i V1
- Förladdat övningsbibliotek — användare skapar egna från start; schema tillåter null `user_id` så global seed kan adderas i V2 utan migration
- Apple Health-integration, hemskärms-widgets, CSV-export, web-app, delade pass — alla V2+
- Programmeringsmallar (5/3/1, PPL etc.) — V2+, kräver mer modellering

## Context

- **Utvecklare**: Van utvecklare i andra språk men ny på React Native och TypeScript. Bygger för att lära sig — vill ha förklaringar av nya RN/TS-koncept första gången de dyker upp (Expo Router, TanStack Query, RLS, NativeWind, Zustand).
- **Plattform**: Windows + PowerShell + Claude Code nativt (inte WSL). Expo Go på iPhone för dev. Ingen Mac initialt; EAS Build hanterar bygg när TestFlight blir aktuellt.
- **Stack är låst** i ARCHITECTURE.md beslutsregister: Expo SDK 54, TypeScript, Expo Router (file-based), NativeWind, TanStack Query v5, Zustand, react-hook-form + zod, date-fns, victory-native (eller react-native-skia), Supabase (Postgres + Auth + auto-REST + RLS), expo-secure-store för sessions.
- **Datamodell är förkonstruerad** i ARCHITECTURE.md sektion 4: 6 tabeller (`profiles`, `exercises`, `workout_plans`, `plan_exercises`, `workout_sessions`, `exercise_sets`) med index och RLS-policies redan utskrivna.
- **Supabase-projekt finns redan** — URL + anon-key i `.env.local` (Phase 1). Schema applicerat på remote i Phase 2 (`0001_initial_schema.sql`): 6 tabeller med RLS, errata-fixat `with check`, wrapped `(select auth.uid())`, `set_type` ENUM, `handle_new_user` trigger. Verifierat live via 22/22 cross-user assertions.
- **Scaffolding-status**: `app/`-mappen innehåller `npx create-expo-app` default (Expo Router 6, TS, Reanimated, Gesture handler, Safe area, Screens). Stack-paket från ARCHITECTURE (NativeWind, TanStack, Zustand, Supabase, zod) är **ännu inte installerade**.
- **Referensdokument**: `PRD.md` och `ARCHITECTURE.md` i projektroten är auktoritativa källor för krav och teknisk arkitektur. GSD läser dem vid varje plan-phase.

## Constraints

- **Tech stack**: Expo + Supabase + TypeScript låst i ARCHITECTURE.md beslutsregister — får inte bytas utan att registret revideras explicit
- **Plattform**: iOS-only i V1 (iPhone via Expo Go) — Android avskuret
- **Performance**: Loggning av ett set ≤ 3 sekunder från knapptryck till lokalt sparat — UX-kritiskt
- **Data integrity**: Får ALDRIG förlora ett loggat set — driver offline-first beslut i V1
- **Säkerhet**: RLS obligatoriskt på alla tabeller; service-role-key används ALDRIG i klient; secrets aldrig hårdkodade
- **Sessions**: expo-secure-store för auth-tokens (inte AsyncStorage)
- **Validering**: Zod för all extern data (Supabase responses, formulär, deeplinks)
- **Budget**: Gratis (Supabase free tier för enskild användare); Apple Developer-licens krävs först när TestFlight blir aktuellt
- **Tidsram**: Kvällar/helger, inga hårda deadlines; mål V1 körbar inom 4–6 veckors arbete

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Expo (vs vanilla RN, Flutter, SwiftUI) | Snabbast iteration, EAS hanterar bygg, ingen Mac krävs initialt | — Pending |
| Supabase (vs Firebase, egen Node + Postgres) | Open source, SQL, RLS gör auth-säkerhet enkelt | — Pending |
| TypeScript (vs JS) | Typkontroll mot Supabase-schema → färre runtime-buggar, IDE-stöd | — Pending |
| NativeWind (vs StyleSheet, Tamagui) | Tailwind-syntax är snabb och välkänd | — Pending |
| TanStack Query v5 + Zustand (vs Redux) | TanStack för server-state cache, Zustand för UI-state — enklare än Redux | — Pending |
| react-hook-form + zod (forms + validering) | Typsäkra scheman, single source of truth | — Pending |
| expo-secure-store för sessions (inte AsyncStorage) | Säkrare lagring av JWT-tokens | — Pending |
| Inget förladdat övningsbibliotek i V1 | Enklast V1; schema stödjer global seed senare utan migration | — Pending |
| Offline-stöd = Måste i V1 (bumpat från Bör → Måste) | "Får aldrig förlora ett set" + dålig täckning i gymkällare → online-only V1 är inte trovärdigt | — Pending |
| Apple Sign-In = V1.1 (inte V1.0) | Krävs senare för App Store men inte för personlig användning först | — Pending |
| Projekt- och repo-namn = FitnessMaxxing | Konsekvent över repo, app.json, Supabase, PROJECT.md | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-13 after Phase 5 (Active Workout Hot Path — F13 lives or dies) completion — F5/F6/F7/F8/F13 all wired end-to-end with offline-first guarantees: 13 setMutationDefaults registered at module top-level with FIFO scope.id replay (`session:<id>`), MMKV persister throttleTime 500ms + AppState background-flush two-belt durability, ActiveSessionBanner cross-tab + draft-resume cold-start overlay + "Passet sparat ✓" toast, `test-rls.ts` extended to 38 cross-user assertions (≥35 threshold) for workout_sessions + exercise_sets. F13 brutal-test recipe (10 phases, 244 LOC) ships at `app/scripts/manual-test-phase-05-f13-brutal.md` — full physical-iPhone run deferred as HUMAN-UAT.

*Previous update: 2026-05-09 after Phase 2 (Schema, RLS & Type Generation) completion — V1 schema deployed to remote project mokmiuifpdzwnceufduu with errata-fixed RLS, generated `types/database.ts` wired through `createClient<Database>`, cross-user RLS test harness 22/22 PASS, F17 validated, DB conventions codified in CLAUDE.md*
