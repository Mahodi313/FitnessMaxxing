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
- **F5 / F6 / F7 / F8 / F13** — Validated in Phase 5: full active-workout hot path with offline-first guarantees. Server-owned `set_number` via Postgres BEFORE INSERT trigger + UNIQUE(`session_id, exercise_id, set_number`) constraint (D-16 SUPERSEDED via Plan 05-04 / FIT-7); `PersistQueryClientProvider` with hydration-ready signal feeding "Återställer pass…" affordance on workout screen (Plan 05-05 / FIT-8); locale-tolerant weight input via `z.preprocess` comma → period normalization (Plan 05-06 / FIT-9); ActiveSessionBanner mount-scope clarified as `(tabs)`-only in UI-SPEC (Plan 05-07 / FIT-10). 10/10 source-level must-haves verified post gap-closure; 7 code-review findings (1 CR + 6 WR) fixed in `chore/05-review-fixes-post-gap-closure`; test-fixture regression closed by FIT-13. Migration 0005 (TOCTOU-safe combined dedupe + UNIQUE superseder) applied to deployed DB 2026-05-14. iPhone UAT (F13 brutal-test + Swedish-locale + hydration affordance) persisted to `05-HUMAN-UAT.md` for separate physical-device run.

### Active

<!-- Current scope. Building toward these. Mappade från PRD F1-F15. -->

#### V1 Måste (kärnflöde)

- [x] **F1** — Användarregistrering med email + lösen (Phase 3, 2 V1.1-deferred UAT gaps)
- [x] **F2** — Skapa, redigera, ta bort träningsplaner (Phase 4)
- [x] **F3** — Övningsbibliotek (egna övningar, ingen seed i V1) (Phase 4)
- [x] **F4** — Lägga till och ordna om övningar i en plan (Phase 4)
- [x] **F5** — Starta pass från en plan (Phase 5)
- [x] **F6** — Logga set (vikt + reps) under pass (Phase 5)
- [x] **F7** — Visa senaste värdet per övning vid loggning (Phase 5)
- [x] **F8** — Avsluta och spara pass (Phase 5)
- [ ] **F9** — Lista historiska pass
- [x] **F13** — Offline-stöd: pass kan loggas utan nät, synkar när det kommer tillbaka *(bumpat från Bör → Måste pga "får aldrig förlora ett set")* (Phase 5; full iPhone brutal-test deferred till HUMAN-UAT)

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
*Last updated: 2026-05-14 after Phase 5 gap-closure completion — F5/F6/F7/F8/F13 fully validated. Original Phase 5 work (Plans 05-01..05-03) shipped 2026-05-13 with 6/6 must-haves source-level passed + F13 brutal-test partial (deferred to iPhone UAT). UAT 2026-05-13 surfaced 4 gaps (FIT-7..FIT-10) closed via Plans 05-04..05-07 merged 2026-05-14: D-16 SUPERSEDED by server-owned `set_number` + UNIQUE(`session_id, exercise_id, set_number`) constraint; `PersistQueryClientProvider` hydration gate; Swedish-locale comma decimal input; ActiveSessionBanner mount-scope spec clarification. Post-gap-closure code review applied 1 CR + 6 WR fixes (`chore/05-review-fixes-post-gap-closure`) including Migration 0005 (TOCTOU-safe superseder). Migration 0005 applied to deployed DB 2026-05-14 (`Local 0005 ↔ Remote 0005`). Final state: 10/10 source-level must-haves verified, test:rls 39/39 PASS, test:set-schemas 13/13 PASS, test:last-value-query 9/9 PASS (after FIT-13 fixture fix). 3 iPhone-UAT items persisted to `05-HUMAN-UAT.md` for separate physical-device verification.

*Previous update: 2026-05-09 after Phase 2 (Schema, RLS & Type Generation) completion — V1 schema deployed to remote project mokmiuifpdzwnceufduu with errata-fixed RLS, generated `types/database.ts` wired through `createClient<Database>`, cross-user RLS test harness 22/22 PASS, F17 validated, DB conventions codified in CLAUDE.md*
