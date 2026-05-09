# Roadmap: FitnessMaxxing

**Created:** 2026-05-07
**Granularity:** standard (target 5-8 phases, 3-5 plans each)
**Total V1 phases:** 7
**V1 requirements mapped:** 15/15

## Overview

FitnessMaxxing levereras som en personlig iPhone gym-tracker via Expo Go. Resan börjar i två oundvikliga infrastruktur-faser (bootstrap + schema-med-RLS) som båda är gatade till verifierbar utfall, fortsätter genom auth (Phase 3), bevisar offline-kön på en förlåtande resurs (planer, Phase 4) innan det kritiska aktiva passet (Phase 5) där F13-löftet "får ALDRIG förlora ett set" lever eller dör. Phase 6 levererar historik och graf (read-side polish), Phase 7 wraps RPE, anteckningar och dark-mode-toggle som final V1-cut. V1.1 (Apple Sign-In, PR-detection, vilo-timer, set-typ-UI) och V2 (App Store-launch) skissas men mappas inte till V1-faser.

## Phases

**Phase Numbering:**
- Integer phases (1-7): Planned V1 milestone work
- Decimal phases reserved for urgent insertions (created via `/gsd-insert-phase` if needed)

- [x] **Phase 1: Bootstrap & Infra Hardening** - Locked stack installerad med rätt pins, NativeWind-smoke-test renderar på iPhone, dark-mode-konvention etablerad *(2026-05-08)*
- [x] **Phase 2: Schema, RLS & Type Generation** - Korrigerat schema applicerat i Supabase med både `using` och `with check`, cross-user-fixturer passerar (22/22), TS-typer genererade, 27/27 SECURED *(2026-05-09)*
- [ ] **Phase 3: Auth & Persistent Session** - Användare kan registrera, logga in, och sessioner överlever app-restart via LargeSecureStore
- [ ] **Phase 4: Plans, Exercises & Offline-Queue Plumbing** - Användare kan skapa planer och övningar offline; airplane-mode-test bekräftar att kön persisterar och replayas korrekt
- [ ] **Phase 5: Active Workout Hot Path (F13 lives or dies)** - Användare loggar set under pass; varje set överlever airplane mode + force-quit + battery-pull
- [ ] **Phase 6: History & Read-Side Polish** - Användare ser passhistorik och progressionsgraf per övning
- [ ] **Phase 7: V1 Polish Cut** - RPE, anteckningar och dark-mode-toggle färdiga; V1 redo för 4-veckors personlig validering

## Phase Details

### Phase 1: Bootstrap & Infra Hardening
**Goal**: Användaren kan starta appen på sin iPhone via Expo Go och se en NativeWind-styled startsida
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: F15 (konvention)
**Success Criteria** (what must be TRUE):
  1. Appen startar på iPhone via Expo Go QR-kod utan röd skärm; "Hello FitnessMaxxing"-text renderar med Tailwind-klasser (t.ex. `text-2xl text-blue-500`)
  2. `tailwind.config.js` har `darkMode: 'class'` och `dark:`-varianter används från start (F15-konvention etablerad)
  3. `expo-doctor` returnerar 0 fel; alla native-paket installerade via `npx expo install` (inte `npm install`)
  4. `.env.local` är gitignored; `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` läses korrekt i appen
  5. Reanimated 4.1 babel-plugin är konfigurerad utan dubbletter (ingen "Duplicate plugin/preset detected"-varning)
**Plans**: 3 plans
  - [x] 01-01-reset-and-install-stack-PLAN.md — Reset Expo-scaffolden och installera locked-stacken (CLAUDE.md TL;DR-pinnar) med rätt verktyg per pakettyp; expo-doctor 0 fel
  - [x] 01-02-nativewind-darkmode-smoketest-PLAN.md — NativeWind 4 + Tailwind 3-trippel + darkMode:'class'; smoke-test-vy renderar på iPhone via Expo Go med dark:-konvention
  - [x] 01-03-env-supabase-providers-PLAN.md — .env.local + lib/supabase.ts (LargeSecureStore) + lib/query-client.ts + provider-stack i _layout.tsx + connect-test bevisar Supabase-rundresan

### Phase 2: Schema, RLS & Type Generation
**Goal**: Korrigerat databas-schema är applicerat i Supabase, RLS-policys verifierade med cross-user-fixturer, TS-typer genererade
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: F17 (schema-only)
**Success Criteria** (what must be TRUE):
  1. Alla 6 tabeller (`profiles`, `exercises`, `workout_plans`, `plan_exercises`, `workout_sessions`, `exercise_sets`) finns i Supabase med RLS aktiverat
  2. RLS-policys har **både** `using` OCH `with check`-klausul på alla skrivbara tabeller (errata mot ARCHITECTURE.md §4 fixad); `auth.uid()` är wrappad som `(select auth.uid())` för query-plan-caching
  3. Cross-user-fixturtest visar att User B inte kan läsa eller skriva User A:s planer, övningar, pass eller set (både SELECT och INSERT/UPDATE blockas)
  4. `exercise_sets` har `set_type` enum-kolumn (working/warmup/dropset/failure) med default `'working'` (F17 schema, UI deferred till V1.1)
  5. `npm run gen:types` producerar `types/database.ts` som matchar applicerat schema; TS-kompileringen är ren
**Plans**: 6 plans
  - [x] 02-01-PLAN.md — CLI bootstrap & preflight (supabase init/link, tsx, npm scripts, .env.example, .env.local)
  - [x] 02-02-PLAN.md — Author 0001_initial_schema.sql (errata-fixed RLS, set_type ENUM, handle_new_user trigger)
  - [x] 02-03-PLAN.md — [BLOCKING] supabase db push + db diff + Studio sanity check
  - [x] 02-04-PLAN.md — Generate types/database.ts; type the supabase client; remove phase1ConnectTest
  - [x] 02-05-PLAN.md — Author scripts/test-rls.ts; npm run test:rls passes (proves errata closed)
  - [x] 02-06-PLAN.md — Doc reconciliation: ARCHITECTURE §4/§5, STATE.md, CLAUDE.md Database conventions

### Phase 3: Auth & Persistent Session
**Goal**: Användare kan registrera konto, logga in, och sessionen överlever app-restart även offline
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: F1
**Success Criteria** (what must be TRUE):
  1. Användare kan registrera nytt konto med email + lösen från `(auth)/sign-up.tsx` och hamnar inloggad i `(app)`-gruppen
  2. Användare kan logga in från `(auth)/sign-in.tsx`; fel-validering via Zod visar fältfel inline (RHF + Zod 4)
  3. Sign-in → kill app → reopen → session är återställd och användaren ser `(app)`-gruppen direkt (LargeSecureStore round-trip funkar)
  4. Sign-out tar användaren tillbaka till `(auth)/sign-in.tsx` och `queryClient.clear()` körs (per-user cache rensad)
  5. `Stack.Protected guard={!!session}` i root + `<Redirect>` i `(app)/_layout.tsx` hindrar protected screens från att flicker-rendera när session saknas
**Plans**: 4 plans
  - [x] 03-01-schemas-store-PLAN.md — Zod 4 schemas + Zustand auth-store with module-scope onAuthStateChange listener + Node-only schema test
  - [x] 03-02-root-auth-signin-PLAN.md — Root layout splash hold + Stack.Protected; (auth) group layout; sign-in screen (RHF + Zod + Supabase + error map)
  - [x] 03-03-signup-app-group-PLAN.md — Sign-up screen (RHF + Zod + 7-case error map); (app) group layout (Redirect defense-in-depth); (app)/index.tsx post-login placeholder; delete Phase 1 smoke-test
  - [x] 03-04-manual-verify-PLAN.md — Manual iPhone verification of all 5 ROADMAP success criteria + Studio toggle confirmation + 03-VERIFICATION.md sign-off
**UI hint**: yes

### Phase 4: Plans, Exercises & Offline-Queue Plumbing
**Goal**: Användare kan skapa, redigera och ordna träningsplaner med egna övningar — helt offline, med synk vid återanslutning
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: F2, F3, F4
**Success Criteria** (what must be TRUE):
  1. Användare kan skapa, redigera och ta bort träningsplaner från `(tabs)/index.tsx`; ändringar visas omedelbart (optimistic update)
  2. Användare kan skapa egna övningar (namn, muskelgrupp, utrustning) och se dem i biblioteket vid plan-edit (ingen seed i V1)
  3. Användare kan lägga till och drag-att-ordna om övningar i en plan; ny ordning persisterar
  4. **Airplane-mode-test passerar:** airplane mode → skapa plan → lägg till 3 övningar → force-quit appen → öppna offline (data finns kvar) → återanslut → alla rader landar i Supabase utan FK-fel eller dubbletter
  5. Offline-banner visas när NetInfo rapporterar `isConnected: false`; banner försvinner när enheten är online igen
**Plans**: TBD
**UI hint**: yes

### Phase 5: Active Workout Hot Path (F13 lives or dies)
**Goal**: Användare kan starta ett pass, logga set i ≤3 sekunder per set, se senaste värdet per övning, och avsluta passet — varje set överlever även mest extrema offline-scenarier
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: F5, F6, F7, F8, F13
**Success Criteria** (what must be TRUE):
  1. Användare kan starta pass från en plan; `workout_sessions`-rad skapas direkt vid "Starta pass"-tryck (inte vid "Avsluta")
  2. Användare loggar ett set (vikt + reps) på ≤3 sekunder från knapptryck till lokalt sparat; per-set persistens via `useAddSet` med `mutationKey: ['set', 'add']` + `scope.id = "session:<id>"` (ingen "save on finish")
  3. Användare ser set-position-aligned senaste värde ("Förra: set 1: 82.5kg × 8") vid loggning, inte bara senaste single-värdet
  4. Användare kan avsluta passet → `finished_at` sätts → tillbaka till hem; ingen "Discard workout"-knapp finns (data-loss-vector eliminerad)
  5. **Draft-session-recovery:** kall-start visar "Återuppta passet?" om `workout_sessions WHERE finished_at IS NULL` finns
  6. **F13 acceptance test passerar:** airplane mode + force-quit + battery-pull-simulering under 25-set-pass = alla 25 set överlever och synkar i rätt ordning vid återanslutning (idempotent via klient-genererade UUIDs + `scope.id` serial replay)
**Plans**: TBD
**UI hint**: yes

### Phase 6: History & Read-Side Polish
**Goal**: Användare kan bläddra historiska pass och se progressionsgraf per övning över tid
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: F9, F10
**Success Criteria** (what must be TRUE):
  1. Användare ser cursor-paginerad lista över historiska pass i `(tabs)/history.tsx`, sorterad på `started_at desc`
  2. Användare kan öppna ett historiskt pass och se alla loggade set per övning
  3. Användare kan se en graf (max vikt eller total volym över tid) per övning via `<CartesianChart>` från victory-native; data är memoiserad så grafen inte re-mountar vid varje render
  4. Historik-listan funkar offline (TanStack Query-cache hydrerad från AsyncStorage)
**Plans**: TBD
**UI hint**: yes

### Phase 7: V1 Polish Cut
**Goal**: Användare kan logga RPE, lägga anteckningar på pass, och toggla dark mode manuellt — V1 är redo för 4-veckors personlig validering
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: F10 (om inte i Phase 6), F11, F12, F15 (toggle-UI)
**Success Criteria** (what must be TRUE):
  1. Användare kan logga RPE (1-10) per set; värdet är optionellt (lämnas tomt → null)
  2. Användare kan lägga textanteckningar per pass (visas i historik-vyn)
  3. Användare kan toggla dark mode manuellt i Settings-fliken; valet persisterar via `expo-secure-store` eller AsyncStorage
  4. Användare kan ta hela kärnflödet (skapa plan → starta pass → logga set → avsluta → se historik) på ≤2 minuter utan fel
  5. V1 är redo för 4-veckors soak-test mot kriterier i PRD §8 (1 bug/vecka, alla pass loggade utan papper)
**Plans**: TBD
**UI hint**: yes

## V1.1 (Future — Not Mapped to V1 Phases)

Skjuts till nästa release efter V1 är personligt validerat 4 veckor. Skissas här för traceability.

### Phase 8 (V1.1): App Store Pre-Work
**Goal**: V1.1-features som möjliggör App Store-launch
**Mode:** mvp
**Depends on**: V1 complete (Phase 7) + 4-veckors soak
**Requirements (V1.1)**: F14 (Apple Sign-In), F15-toggle (om inte i V1 Phase 7), F17-UI (set-typ-toggling), F18 (PR-detection), F19 (vilo-timer)
**Research flag**: F19 vilo-timer (`expo-notifications` + `expo-keep-awake`, JS-suspension-trap)
**Plans**: TBD

## V2 (Future — App Store Launch Path)

Skissas för långsiktigt sammanhang. Mappas vid V2-planering.

### Phase 9+ (V2): App Store Launch
**Goal**: Public App Store launch
**Requirements (V2)**: F20 (seed exercise library), F21 (EAS Build + TestFlight), F22-F24 (differentiators), F25-F30 (integrationer/plattformar)
**Research flags**: EAS Build credential flow på Windows-only dev, Apple Health, hemskärms-widgets
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute sequentially: 1 → 2 → 3 → 4 → 5 → 6 → 7. Phase 5 må**ste** följa Phase 4 sekventiellt (offline-kön bevisad på planer först, sedan stressas på set).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bootstrap & Infra Hardening | 3/3 | ✓ Complete | 2026-05-08 |
| 2. Schema, RLS & Type Generation | 6/6 | ✓ Complete (27/27 SECURED, F17 validated) | 2026-05-09 |
| 3. Auth & Persistent Session | 4/4 plans, ◆ verification pending | ◆ Code complete; manual iPhone verification deferred (Supabase rate-limit) | — |
| 4. Plans, Exercises & Offline-Queue Plumbing | 0/TBD | ○ Not started | — |
| 5. Active Workout Hot Path | 0/TBD | ○ Not started | — |
| 6. History & Read-Side Polish | 0/TBD | ○ Not started | — |
| 7. V1 Polish Cut | 0/TBD | ○ Not started | — |

**Project progress:** 2 of 7 phases complete (~29%); 13 of 13 known plans summarised (Phase 3 verification pending; Phases 4-7 plan counts pending discuss/plan).

## Phase Ordering Rationale

- **Phase 1 → 2 → 3 → 4 → 5** måste vara sekventiella. Varje fas beror på att den föregående är korrekt; offline-första patterns kräver schema, schema kräver bootstrap, auth kräver schema (för `profiles`), offline-queue kräver auth (för RLS), hot path kräver offline-queue.
- **Phase 5 är högsta-risk-fasen.** F13-löftet komponeras här. Komprimering av Phase 4 → Phase 5 är exakt vägen som bryter F13.
- **Phase 6 → 7** kan parallellisera partiellt om tid finns; de delar inga load-bearing data-flöden.
- **F17 schema landar i Phase 2; UI deferred till V1.1 Phase 8.** Schema-migration är gratis innan data finns, dyr efter.
- **F15 dark mode är konvention från Phase 1**; manuell toggle-UI levereras i Phase 7 (eller V1.1 om scope-tryck uppstår).
- **F10 graf** kan landa antingen i Phase 6 eller Phase 7 — placerad i Phase 6 som primär; flexbar buffer.

## Research Flags

V1-faser med standardpatterns (ingen extra `/gsd-research-phase` behövs):
- Phase 1, 2, 3, 4, 5, 6, 7 — alla mönster är dokumenterade i `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`.

V1.1-faser som kräver research vid planering:
- Phase 8 — F19 vilo-timer (JS-suspension-trap, notification permission UX).

V2-faser som kräver research vid planering:
- EAS Build credential flow på Windows-only dev environment.
- Apple Health-integration scope.

---
*Roadmap created: 2026-05-07*
*Last updated: 2026-05-07 after initial creation*
