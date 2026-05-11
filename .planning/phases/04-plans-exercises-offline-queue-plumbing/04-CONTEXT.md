# Phase 4: Plans, Exercises & Offline-Queue Plumbing - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 levererar F2 (skapa/redigera/arkivera träningsplaner), F3 (skapa egna övningar), F4 (lägga till och drag-att-ordna övningar i en plan) — helt offline med synk vid återanslutning. Phase 4 etablerar också den TanStack-Query-baserade offline-queue-plumbing som Phase 5 (active workout hot path) ärver för F13. Efter Phase 4 ska airplane-mode-testet (success #4) passera: airplane → skapa plan → 3 övningar → force-quit → öppna offline → återanslut → alla rader landar utan FK-fel/dubbletter. Det är på den här plumbingen Phase 5 sedan stress-testar set-logging.

**In scope:**
- Refaktorera `app/lib/query-client.ts` (Phase 1) → `app/lib/query/{client,persister,network,keys}.ts` per research/ARCHITECTURE.md §3 (D-01)
  - `lib/query/client.ts`: skapar `QueryClient` med `networkMode: 'offlineFirst'` (queries + mutations) + registrerar `setMutationDefaults` per `mutationKey` (D-04)
  - `lib/query/persister.ts`: `createAsyncStoragePersister` + `persistQueryClient`-wiring (24h `maxAge`, default throttle)
  - `lib/query/network.ts`: flyttar `focusManager.setEventListener` (AppState) + `onlineManager.setEventListener` (NetInfo) ut ur `app/app/_layout.tsx`; lägger till `onlineManager`-transition-listener som triggar `queryClient.resumePausedMutations()` vid offline→online
  - `lib/query/keys.ts`: query-key-factory (`plansKeys`, `exercisesKeys`, `planExercisesKeys`)
- `app/lib/utils/uuid.ts` — wrapper kring `expo-crypto` `randomUUID()` per Pitfall 5.1; alla nya rader (workout_plans, exercises, plan_exercises) får klient-genererat UUID innan mutationen körs
- Zod-schemas i `app/lib/schemas/`:
  - `plans.ts` — `workout_plans` Insert/Update + form-input-shapes (`name` 1–80 chars, `description` ≤ 500 chars, optional `archived_at`)
  - `exercises.ts` — `exercises` Insert/Update (`name` 1–80, `muscle_group` ≤ 40, `equipment` ≤ 40, `notes` ≤ 500)
  - `plan-exercises.ts` — `plan_exercises` Insert/Update (`order_index` int ≥ 0, optional `target_sets`, `target_reps_min`, `target_reps_max`, `notes` ≤ 500); validerar `target_reps_min ≤ target_reps_max` när båda satta
- Resurs-hooks i `app/lib/queries/`:
  - `plans.ts` — `usePlansQuery()` (LIST WHERE archived_at IS NULL ORDER BY created_at desc), `usePlanQuery(id)`, `useCreatePlan()`, `useUpdatePlan()`, `useArchivePlan()` (sätter archived_at = now())
  - `exercises.ts` — `useExercisesQuery()` (anv. egna), `useCreateExercise()`
  - `plan-exercises.ts` — `usePlanExercisesQuery(planId)` (ORDER BY order_index asc), `useAddExerciseToPlan()`, `useUpdatePlanExercise()`, `useRemovePlanExercise()`, `useReorderPlanExercises()` (bulk-update via flera mutationer med `scope.id='plan:<id>'` per Pitfall 5.3)
  - Alla mutationer: `mutationKey` registrerade via `setMutationDefaults` så de överlever JSON-serialisering vid app-kill (research/ARCHITECTURE.md Pattern 1; Pitfall 5.3 #1 footgun)
  - Optimistic updates via `onMutate` → `cancelQueries` + `setQueryData` snapshot+rollback; `onError` rollbackar; `onSettled` invaliderar
- Route-grupper:
  - `app/app/(app)/(tabs)/_layout.tsx` — Default Expo Router `<Tabs>` med svenska labels + ikoner från `@expo/vector-icons` (Ionicons): Planer (barbell), Historik (calendar/time), Inställningar (settings) (D-15)
  - `app/app/(app)/(tabs)/index.tsx` — Planer-listan (default tabb). Empty-state: ikon + "Inga planer än. Skapa din första plan." + primärknapp (D-13)
  - `app/app/(app)/(tabs)/history.tsx` — placeholder ("Historik kommer i Phase 6")
  - `app/app/(app)/(tabs)/settings.tsx` — temporär hem för sign-out-knappen + "Mer kommer i Phase 7" (D-14); placeholder-content gäller tills Phase 7 fyller dark-mode-toggle etc.
- Plan-detail/edit-skärmar:
  - `app/app/(app)/plans/new.tsx` — skapa plan (RHF + `plansSchema`; namn obligatoriskt, beskrivning optional)
  - `app/app/(app)/plans/[id].tsx` — visa + redigera plan; lista plan_exercises via `react-native-draggable-flatlist`; drag-handle-ikon (≡) per rad (D-08); `onDragEnd` → bulk-mutationer per ändrad rad med `scope.id='plan:<id>'` (D-09); per-rad `target_sets/target_reps_min/target_reps_max/notes`-redigering (D-11); '+ Lägg till övning' öppnar inline-create-or-pick sheet (D-12); 'Arkivera plan' i menyn (D-10)
- Exercise-add sheet:
  - Bottom-sheet/full-screen-modal triggad från plan-detail/[id].tsx
  - Sökbar lista över befintliga `exercises` (anv. egna)
  - 'Skapa ny övning'-knapp högst upp → expanderar inline form (namn, muscle_group, equipment, notes) → skapar exercise → läggs direkt till plan
- `app/components/offline-banner.tsx` — binär banner (D-05): visas när `useOnlineStatus()` (en custom hook ovanpå `onlineManager`) returnerar `false`. Copy: "Du är offline — ändringar synkar när nätet är tillbaka." Mountas i `app/app/(app)/(tabs)/_layout.tsx` så den ligger ovanför tab-bar och under safe-area top. Stängbar via ✕ per Phase 3 quick-task-konventionen (260509-001)
- Radera placeholder `app/app/(app)/index.tsx` — sign-out-knappen flyttas till `(tabs)/settings.tsx` (D-14)
- Manuell airplane-mode-test (success #4): airplane mode → skapa plan + 3 övningar + drag-reorder → force-quit → öppna offline (data finns kvar) → återanslut → kontrollera Supabase Studio: alla rader landar i rätt ordning utan dubbletter och utan FK-fel

**Out of scope (belongs to later phases):**
- AsyncStorage-flush-on-background hook (Pitfall 1.3) → Phase 5 (D-02 — set-logging hot path)
- Redundant Zustand "pending mutations"-store (Pitfall 1.3 belt-and-braces) → Phase 5 (D-03)
- Pending-mutations-counter i OfflineBanner ("3 ändringar väntar") → V2-deferred (F24)
- Active workout / set-logging / draft-session-recovery → Phase 5 (F5/F6/F7/F8/F13)
- Historik-listning + per-övning-graf → Phase 6 (F9/F10)
- Dark-mode-toggle UI i Inställningar-tabben → Phase 7 (F15-toggle)
- Sparse fractional order_index (1024,2048,3072...) → optimization deferred (D-09)
- Apple Sign-In, lösen-återställning, settings-skärmens fulla yta → V1.1 (carry-over från Phase 3)
- Förladdat globalt övningsbibliotek → V2 (F20)
- "Senast använda övningar"-vy i exercise-add-sheet → V1.1 polish om soak visar behov
- "Restore arkiverad plan"-flow → V1.1 (om/när arkiv-listan växer)
- Apple Health-integration → V2

</domain>

<decisions>
## Implementation Decisions

### F13 plumbing scope (Phase 4 vs Phase 5)
- **D-01:** Refaktorera `app/lib/query-client.ts` (Phase 1) till `app/lib/query/{client,persister,network,keys}.ts` per research/ARCHITECTURE.md §3. `focusManager.setEventListener` + `onlineManager.setEventListener` flyttas ut ur `app/app/_layout.tsx` och in i `lib/query/network.ts`. Phase 4 är det naturliga refaktor-ögonblicket eftersom 6+ `setMutationDefaults` + en key-factory + `lib/queries/*.ts` landar — splitten betalar sig direkt. Phase 5 ärver target-arkitekturen utan ytterligare refaktor.
- **D-02:** AsyncStorage-flush-on-background hook (Pitfall 1.3) → **Phase 5**. Plans/exercises/plan-exercises CRUD är låg-frekvens; default persister-throttle (1000ms) + manuell reload räcker för Phase 4 success #4 (force-quit-replay). Pitfall 1.3 är explicit hot-path-grej för set-logging där användaren spammar mutationer ≤3s — där lever-eller-dör F13 och flush-hooken motiverar yt-arean.
- **D-03:** Redundant Zustand "pending mutations"-store (Pitfall 1.3 belt-and-braces) → **Phase 5**. Plans-CRUD är ohotad av sub-3s SLA; TanStack persister räcker. Phase 5 äger den belt-and-braces-mönstret eftersom det är där queue-korruption kostar verkliga set-data. Färre rörliga delar i Phase 4 = mindre att bryta när Phase 5 stressar plumbingen.
- **D-04:** `setMutationDefaults` per `mutationKey` (research/ARCHITECTURE.md Pattern 1 #1 footgun): MÅSTE registreras innan `persistQueryClient` mountar, annars överlever inte queueade mutationer JSON-dehydrering. Phase 4-keys: `['plan','create']`, `['plan','update']`, `['plan','archive']`, `['exercise','create']`, `['plan-exercise','add']`, `['plan-exercise','update']`, `['plan-exercise','remove']`, `['plan-exercise','reorder']`. Phase 5 lägger till `['set','add']`, `['session','start']`, `['session','finish']` i samma `lib/query/client.ts`.
- **D-05:** OfflineBanner är **binär** i V1 — copy: "Du är offline — ändringar synkar när nätet är tillbaka." Triggas av en custom `useOnlineStatus()`-hook ovanpå `onlineManager.isOnline()`. F24 "sync-state-badge med pending-count" är explicit V2-deferred per REQUIREMENTS.md; pending-counter korsar V2-territoriet.
- **D-06:** Klient-genererade UUIDs via `expo-crypto` `randomUUID()` i `app/lib/utils/uuid.ts` (Pitfall 5.1). Alla mutationer som skapar rader skickar med `id: randomUUID()` så optimistic-update + replay är idempotent — Phase 5 ärver konventionen utan att behöva retrofitta.
- **D-07:** `networkMode: 'offlineFirst'` på BÅDE queries och mutations i `lib/query/client.ts` (research/ARCHITECTURE.md Pattern 1 default). Mutations pausas vid offline istället för att felsla; queries serverar cache utan att kasta nätverksfel.

### Drag-to-reorder UX & library
- **D-08:** `react-native-draggable-flatlist` för plan_exercises-reorder. Battle-tested, byggt på `react-native-gesture-handler 2.x` (redan installerad via Expo SDK 54). Drag-handle-ikon (≡) **alltid synlig** till höger om varje rad — discoverable, kolliderar inte med tap-on-row (när framtida exercise-detalj-tryck adderas). Matchar iOS Reminders/Notes-UX.
- **D-09:** Reorder-mutation strategi: bulk-update av alla **ändrade** rader på `onDragEnd`. Räkna ut diff vs gammal ordning (klient-side), fire en `useUpdatePlanExercise`-mutation per ändrad rad med `scope: { id: 'plan:<planId>' }` (Pitfall 5.3 — samma scope = sequential replay). Optimistic-update av query-cachen omedelbart; mutationer flushas serial efter scope-id. Idempotent via klient-UUID på alla plan_exercises-rader.
- **D-10:** `order_index`-numrering: **dense** (0, 1, 2, 3...). Reorder skriver flera rader per drag (för 5–10 övningar/plan = trivial cost). Sparse fractional (1024, 2048, 3072) är pre-mature optimization för V1 enskild användare. Phase 5 berörs inte (set-ordering använder `set_number`, inte `order_index`).

### Plan-editor scope & exercise-add UX
- **D-11:** Plan-editor exponerar **fulla** target-fält per plan_exercise: `target_sets`, `target_reps_min`, `target_reps_max`, `notes`. Schema-redo sedan Phase 2; Phase 5/6 läser inte targets i V1 (set-logging är fritt vikt+reps-input). Targets-UI i V1 ger användaren möjlighet att planera "3x8-12 reps på Bench" trots att appen inte påminner under passet — V1.1 polish kan addera "auto-fyll-targets" på set-input.
- **D-12:** Plan-radering = **archive** (`UPDATE workout_plans SET archived_at = now()`). Plans listas WHERE `archived_at IS NULL`. Bevarar historisk integritet — workout_sessions med `plan_id` överlever (FK ON DELETE SET NULL i schemat skulle annars trigga). Pitfall 4.4 vinkar för hard-delete; arkiv-state är mer tillgivet. Ingen "restore arkiverad plan"-UI i V1 (V1.1 om/när arkiv-listan växer).
- **D-13:** Exercise-add UX = **inline-create-or-pick sheet** triggad från plan-detail. Bottom-sheet/full-screen-modal: (a) sökbar lista över anv. egna `exercises`, (b) "Skapa ny övning"-knapp högst upp som expanderar inline-form. Skapar man ny övning hamnar den i listan + plockas direkt till planen. F4-flow:n håller sig i plan-edit-context. **Ingen separat Bibliotek-tabb i V1.** Phase 7 polish får addera om soak visar behov.
- **D-14:** Empty-state CTA på Planer-tabben: centered ikon (dumbbell/barbell) + "Inga planer än. Skapa din första plan." + primärknapp som routar till `app/app/(app)/plans/new.tsx`. Konventionellt iOS empty-state — funktionellt för både personlig V1 och App Store senare.

### (tabs) skeleton breadth + sign-out placering
- **D-15:** **Full V1-tabb-skeleton landar i Phase 4**: Planer + Historik (placeholder) + Inställningar (placeholder + sign-out). Historik-tab visar "Historik kommer i Phase 6"; Inställningar-tab äger sign-out-knappen + "Mer kommer i Phase 7". Phase 6/7 fyller sina egna tabbar utan att röra `(tabs)/_layout.tsx`. Risken med placeholder-skärmar är minimal — de är två triviala vyer som ändå måste byggas senare.
- **D-16:** Sign-out-knappen från `app/app/(app)/index.tsx` flyttas till `app/app/(app)/(tabs)/settings.tsx` som permanent hem. Phase 7 fyller på med dark-mode-toggle, ev. radera-konto. Användaren lär sig "sign-out finns i Inställningar" från start. **`app/app/(app)/index.tsx` raderas** (Phase 3 placeholder är inte längre nödvändig — `(tabs)/index.tsx` blir default route inom `(app)`-gruppen via Expo Router 6 group-default-resolution).
- **D-17:** Tab-labels på **svenska**: "Planer" / "Historik" / "Inställningar". Matchar appens primärspråk (PROJECT.md, Phase 3 D-15). Pre-mature i18n undviks; engelska just-in-case är V2 App Store-grej.
- **D-18:** Tab-bar = **default Expo Router `<Tabs>`** med svenska labels + `@expo/vector-icons` Ionicons (barbell för Planer, calendar för Historik, settings för Inställningar). NativeWind `dark:`-klasser på `tabBarStyle` + `tabBarActiveTintColor`/`tabBarInactiveTintColor` för F15 dark-mode. Custom tab-bar = Phase 7 polish om motiverat.

### Claude's Discretion
- **`@expo/vector-icons` ikon-set i tab-baren** — Ionicons är defaultval (ingår i scaffold), exakt ikon-namn (t.ex. `barbell` vs `barbell-outline` vs `fitness`) väljs av Plan 02 baserat på visuell konsekvens.
- **Bottom-sheet vs full-screen-modal** för exercise-add-sheet — `expo-router` `presentation: 'modal'` ger out-of-the-box iOS modal; `react-native-actions-sheet` eller `@gorhom/bottom-sheet` ger snyggare bottom-sheet men extra dep. Plan 02 väljer; default = expo-router presentation modal eftersom inga nya deps krävs.
- **Drag-handle-ikon-design** (≡-glyph vs `MaterialIcons drag-indicator` vs grid-of-dots) — Plan 02 väljer; matchar iOS-feel.
- **Search-implementation i exercise-add-sheet** (klient-side `.filter()` på query-cache vs server-side `.ilike('%q%')`-query) — för V1 personlig (få egna övningar) räcker klient-side; Plan 02 väljer.
- **Optimistic-update-snapshotting** (helcache-snapshot vs partial-key-snapshot) — TanStack v5 mönster; Plan 02 väljer per mutation.
- **`useOnlineStatus()` placering** — `lib/hooks/use-online-status.ts` eller `lib/query/network.ts` (re-export). Plan 01 väljer.
- **Plan-edit autosave vs explicit-save-knapp** — för V1 personlig är autosave på blur (RHF `mode: 'onBlur'`) bekvämare; explicit save-knapp är säkrare. Plan 02 väljer baserat på UX-feel; matchar Phase 3 D-15 (svenska, inline-fel) och Phase 3 RHF mode-amendment (onSubmit för auth-formulär).
- **Plan-list ordering** (created_at desc, name asc, eller drag-bara) — V1 simplest = `created_at desc`. Drag-bar plan-list är V1.1 polish.
- **`exercises` LIST-query scope** — anv. egna ENBART (`user_id = (select auth.uid())`) i V1; V2 lägger global seed med `user_id IS NULL`. Plan 02 verifierar att RLS-policyn matchar.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 4 requirement & architecture authority
- `PRD.md` §F2/F3/F4 — plan-CRUD, egna övningar, drag-att-ordna; F13 offline-stöd (Måste, bumpat 2026-05-07)
- `ARCHITECTURE.md` §3 — projekt-struktur skiss (`(tabs)/_layout.tsx` etc.)
- `ARCHITECTURE.md` §4 — schema (workout_plans, plan_exercises, exercises) + index — read-only spegling, Phase 2 äger SQL
- `ARCHITECTURE.md` §5 — F7/F10-queries (Phase 6 territorium men ARCHITECTURE-rebuild i Phase 2 dokumenterar set_type='working'-filter; Phase 4 berör ej)
- `ARCHITECTURE.md` §7 — V1: kräver internet (ROOT — superseded av research/ARCHITECTURE.md för V1; F13 bumpades till V1)
- `ARCHITECTURE.md` §8 — RLS som primärt skydd, anon-key OK i klient
- `.planning/REQUIREMENTS.md` — F2 (plan-CRUD), F3 (egna övningar), F4 (ordna i plan), F13 (offline-stöd Måste)
- `.planning/ROADMAP.md` Phase 4 — Success criteria #1–#5 (CRUD plans + optimistic; egna övningar; drag-reorder + persistens; airplane-mode-test #4; offline-banner #5)
- `.planning/PROJECT.md` — Core value, constraints (offline-first sedan F13-bumpning, RLS, expo-secure-store, Zod för extern data)

### Phase 4 implementation pitfalls (load-bearing)
- `.planning/research/PITFALLS.md` §1.3 — Persister throttle window + flush-on-background → Phase 5 äger (D-02); Phase 4 trustar default
- `.planning/research/PITFALLS.md` §3.2 — NativeWind v4 setup (Phase 1-jurisdiction; Phase 4 förlitar sig på rätt babel/metro)
- `.planning/research/PITFALLS.md` §4.4 — ON DELETE CASCADE chains; informerar D-12 (archive vs hard-delete)
- `.planning/research/PITFALLS.md` §5.1 — Klient-UUID via `expo-crypto` (D-06)
- `.planning/research/PITFALLS.md` §5.2 — LWW conflict resolution via klient-`completed_at` (research-default)
- `.planning/research/PITFALLS.md` §5.3 — Mutation `scope.id` för serial replay (D-09 driver detta för plan_exercises)

### Phase 4 architecture context (offline-first patterns)
- `.planning/research/ARCHITECTURE.md` §1 — System overview (offline-first V1; AsyncStorage cache+queue; TanStack onlineManager + focusManager)
- `.planning/research/ARCHITECTURE.md` §3 — `lib/query/{client,persister,network,keys}.ts` 4-fil-split (D-01); `lib/queries/*.ts` per resurs; `lib/schemas/*.ts`; `lib/utils/uuid.ts`
- `.planning/research/ARCHITECTURE.md` §4 — Pattern 1: offline-first mutation med optimistic update + paused-mutation persistence; `setMutationDefaults` #1 footgun (D-04)
- `.planning/research/SUMMARY.md` — Hög-nivå research-roundup

### Phase 1 + Phase 2 + Phase 3 inheritance (CRITICAL — Phase 4 bygger PÅ deras output)
- `.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md` D-06 — STACK.md Critical Recipe §B wirad i `app/app/_layout.tsx`: QueryClientProvider + AppState + NetInfo + persistQueryClient — Phase 4 refaktorerar D-06:s `_layout.tsx`-bitar till `lib/query/network.ts`
- `.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md` D-07 — `app/lib/supabase.ts` med LargeSecureStore — Phase 4 importerar `supabase` direkt, ändrar inget
- `.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md` D-08 — TanStack persister 24h `maxAge` — Phase 4 ärver i `lib/query/persister.ts`
- `.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md` D-10 — Feature-folder-konventionen DEFERRADES TILL PHASE 4 — Phase 4 commits: `lib/query/`-split + `lib/queries/`-resource-hooks + `lib/schemas/`-zod + `lib/utils/`-helpers — flat ovanpå feature-folders **inte** valt; struktur följer research/ARCHITECTURE.md §3
- `.planning/phases/02-schema-rls-type-generation/02-CONTEXT.md` D-04/D-05 — `createClient<Database>(...)` typad client; Phase 4 ärver typsäkra `Tables<'workout_plans'>`, `TablesInsert<'plan_exercises'>` etc. från `app/types/database.ts`
- `.planning/phases/02-schema-rls-type-generation/02-CONTEXT.md` D-15/D-16/D-17 — `handle_new_user`-trigger skapar profiles-rad; Phase 4 förlitar sig på det. Ingen explicit profiles-INSERT från Phase 4-kod
- `.planning/phases/03-auth-persistent-session/03-CONTEXT.md` D-08/D-09/D-10 — Zustand auth-store + `onAuthStateChange` modul-listener + selektor-pattern — Phase 4 läser `useAuthStore(s => s.session?.user.id)` när det behövs (sällan — RLS gör det implicit på servern)
- `.planning/phases/03-auth-persistent-session/03-CONTEXT.md` D-11 — Phase 3 placerade auth-kod i `app/lib/`; Phase 4 utvidgar `app/lib/`-mönstret med `lib/query/`, `lib/queries/`, `lib/schemas/`, `lib/utils/` — INGEN `app/features/<domain>/` i V1 per research/ARCHITECTURE.md §3
- `.planning/phases/03-auth-persistent-session/03-CONTEXT.md` D-15 — Svenska felmeddelanden inline; Phase 4 fortsätter konventionen
- `.planning/phases/03-auth-persistent-session/quick/260509-001-phase3-ui-fixes/` — quick-task etablerade ✕ close-affordance på offline-banner; Phase 4 OfflineBanner ärver mönstret

### Project conventions (etablerade tidigare)
- `CLAUDE.md ## Conventions` → Navigation header & status bar (Phase 1) — `headerShown: false` på root, opt headers per skärm; Phase 4 plan-detail/edit-skärmar kan opt-in header för "Tillbaka"-knappen via `<Stack.Screen options={{ headerShown: true, ... }} />`
- `CLAUDE.md ## Conventions` → Database conventions (Phase 2) — alla schema-frågor via migrations, `(select auth.uid())` wrap, `using` + `with check` på writable policies — Phase 4 introducerar **inga** nya schema-ändringar (alla 3 tabeller finns sedan Phase 2)
- `CLAUDE.md ## Conventions` → Security conventions → Phase-specific checklists → **Forms phase (Phase 4 — F2/F4)**:
  - **API4** (rate-limiting om writes är user-triggered loops) — plan/exercise CRUD är inte loop-triggered; ingen klient-side throttle nödvändig i V1
  - **V5** (input validation — Zod schemas vid varje form-boundary OCH varje Supabase-respons) — Phase 4 lägger `lib/schemas/{plans,exercises,plan-exercises}.ts`; ALL Supabase-respons parse:as via Zod (inte cast) per CLAUDE.md V5
  - **Threat IDs T-04-***
- `CLAUDE.md ## Recommended Stack` → State & Data — `@tanstack/react-query@^5.100.9`, `zustand@^5.0.13`, `react-hook-form@^7.75.0`, `@hookform/resolvers@^5.2.2`, `zod@^4.4.3` — alla installerade
- `CLAUDE.md ## Recommended Stack` → "Charting" — Skia + Victory Native; **Phase 4 berör ej**, Phase 6
- `CLAUDE.md First-Time-User Gotchas` → "TanStack Query v5" (object-arg API, `gcTime`-rename, AppState/NetInfo) — Phase 4 ärver Phase 1-konfig
- `CLAUDE.md First-Time-User Gotchas` → "react-hook-form 7 + Zod 4 + @hookform/resolvers 5" — Phase 4 fortsätter Phase 3 D-12-mönstret (`zodResolver(...)`)

### New library entering Phase 4
- `react-native-draggable-flatlist` — D-08; library docs på https://github.com/computerjazz/react-native-draggable-flatlist; peer-deps `react-native-gesture-handler` (redan installerat 2.28) + `react-native-reanimated` (redan 4.1.1). **Plan 02-research-flag**: bekräfta version-kompat mot Reanimated 4.1 (commit-research vid plan-time)

### Stack reference
- `CLAUDE.md ### Backend & Auth` — `@supabase/supabase-js@^2.105.3` redan installerad (Phase 1)
- `CLAUDE.md ### State & Data` — TanStack Query, Zustand, RHF, Zod 4, date-fns; alla installerade
- `expo-crypto` — `randomUUID()` för D-06; **kontrollera om redan installerat via `npx expo install`**, annars Plan 01 lägger till det

### Source-of-truth diff target (vad Phase 4 modifierar)
- `app/app/_layout.tsx` (nuvarande Phase 1+3-form) — `focusManager.setEventListener` + `onlineManager.setEventListener` flyttas till `lib/query/network.ts`; `_layout.tsx` importerar `lib/query/network` så side-effects körs vid module load (eller anropar `setupNetwork()` explicit i RootLayout)
- `app/lib/query-client.ts` (Phase 1) — splittas till `app/lib/query/{client,persister,network,keys}.ts`; gammal fil tas bort efter att alla imports migrerats. Path-alias `@/lib/query-client` → `@/lib/query/client` (eller breaking-change kommentar i Plan 01)
- `app/lib/auth-store.ts` (Phase 3) — INGEN ÄNDRING; importerar fortfarande `queryClient` från `@/lib/query/client` (path-update på en rad)
- `app/app/(app)/_layout.tsx` (Phase 3) — INGEN ÄNDRING (Stack.Protected guard kvar; (tabs) är en child route inom (app))
- `app/app/(app)/index.tsx` (Phase 3) — **RADERAS**; (tabs)/index.tsx blir default route inom (app)-gruppen via Expo Router 6 group-resolution
- `app/lib/schemas/auth.ts` (Phase 3) — INGEN ÄNDRING; bara nya filer i `lib/schemas/`

### Codebase reusable assets för Phase 4
- `app/lib/supabase.ts` — typed `createClient<Database>` med LargeSecureStore (Phase 1+2)
- `app/lib/auth-store.ts` — `useAuthStore(s => s.session?.user.id)` om någon screen behöver explicit user-id (sällan — RLS hanterar)
- `app/types/database.ts` — `Tables<'workout_plans'>`, `TablesInsert<'plan_exercises'>` etc.
- `app/lib/schemas/auth.ts` — Zod 4-mönster (z.email(), `error:` parameter, `.refine` med `path:`) som plans/exercises/plan-exercises-schemas följer

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`app/lib/supabase.ts`** (Phase 1+2) — Typed Supabase-klient med LargeSecureStore, AppState-listener för `start/stopAutoRefresh`. Phase 4 importerar `supabase` i alla `lib/queries/*.ts`-hooks; INGEN ÄNDRING i filen.
- **`app/lib/query-client.ts`** (Phase 1) — `QueryClient` + `persistQueryClient` (24h `maxAge`). Phase 4 refaktorerar (D-01) men logiken (gcTime: 24h, staleTime: 30s, AsyncStorage-persister) återanvänds 1:1.
- **`app/lib/auth-store.ts`** (Phase 3) — Zustand-store. Phase 4 läser `session.user.id` om behov (sällan).
- **`app/types/database.ts`** (Phase 2) — Genererade typer för alla 6 tabeller + `set_type` enum + `Tables`/`TablesInsert`/`TablesUpdate`-helpers.
- **`app/lib/schemas/auth.ts`** (Phase 3) — Zod 4-mönster mall för nya schemas.
- **NativeWind dark-mode-konvention** (Phase 1) — `bg-white dark:bg-gray-900`-pairs på alla nya komponenter (F15 etablerad).
- **Phase 3 quick-task UI-fixes** (commit 4af7462) — offline-error-arm-mönster + ✕ close-affordance på banner — OfflineBanner.tsx ärver konventionen.

### Established Patterns
- **Inre Expo-projekt under `app/`-subdir.** Alla Expo/npm-kommandon från `app/` cwd (Phase 1 D-01).
- **Path-alias `@/*` → `./*`** (Phase 1 D-12). Phase 4 använder `@/lib/query/client`, `@/lib/queries/plans`, `@/lib/schemas/plans`, `@/lib/utils/uuid`, `@/components/offline-banner`.
- **`headerShown: false` på root-Stack** (Phase 1). Phase 4 plan-edit-skärmar opt-in `headerShown: true` via `<Stack.Screen options={...} />` för "Tillbaka"-knappen.
- **Filnamns-konvention = kebab-case** (Phase 1 D-11). Phase 4 fortsätter: `lib/queries/plan-exercises.ts`, `components/offline-banner.tsx`, etc.
- **Module-scope side-effects + Zustand selektorer** (Phase 3 D-09/D-10). Phase 4 mutation-defaults registreras vid modul-load i `lib/query/client.ts`.
- **Svensk inline-felmeddelanden** (Phase 3 D-15). Phase 4 plan-form, exercise-form, plan-exercise-targets-form följer mönstret.
- **TanStack persister 24h `maxAge`** (Phase 1 D-08). Phase 4 ärver utan ändring; mutationer registrerade via `setMutationDefaults` överlever JSON-dehydrering.

### Integration Points
- **New: `app/lib/query/{client,persister,network,keys}.ts`** — refactor av Phase 1's `lib/query-client.ts`
- **New: `app/lib/queries/{plans,exercises,plan-exercises}.ts`** — resource-hooks (useQuery + useMutation per resurs)
- **New: `app/lib/schemas/{plans,exercises,plan-exercises}.ts`** — Zod 4-schemas
- **New: `app/lib/utils/uuid.ts`** — `expo-crypto` `randomUUID()` wrapper
- **New: `app/lib/hooks/use-online-status.ts`** (eller re-export från `lib/query/network.ts`) — `useOnlineStatus()` hook ovanpå `onlineManager`
- **New: `app/components/offline-banner.tsx`** — binär banner mountad i `(tabs)/_layout.tsx`
- **New: `app/app/(app)/(tabs)/_layout.tsx`** — Tabs med svenska labels + Ionicons
- **New: `app/app/(app)/(tabs)/index.tsx`** — Planer-tabben (default), empty-state CTA, plan-list
- **New: `app/app/(app)/(tabs)/history.tsx`** — placeholder
- **New: `app/app/(app)/(tabs)/settings.tsx`** — sign-out (flyttad från (app)/index.tsx) + "Mer kommer i Phase 7"
- **New: `app/app/(app)/plans/new.tsx`** — skapa plan
- **New: `app/app/(app)/plans/[id].tsx`** — visa + redigera plan; draggable-flatlist; '+ Lägg till övning'-knapp
- **New: `app/app/(app)/plans/[id]/exercise-picker.tsx`** (eller modal-route) — exercise-add-sheet (inline-create-or-pick)
- **Modified: `app/app/_layout.tsx`** — focusManager + onlineManager-bitarna flyttade ut till `lib/query/network.ts`; importerar `@/lib/query/network` för side-effects
- **Modified: `app/lib/auth-store.ts`** — bara import-path-uppdatering (`@/lib/query-client` → `@/lib/query/client`)
- **Deleted: `app/lib/query-client.ts`** — efter att alla imports flyttats till `lib/query/client`
- **Deleted: `app/app/(app)/index.tsx`** — Phase 3-placeholder; (tabs)/index.tsx blir default route
- **Modified: `app/package.json`** — possibly add `expo-crypto`, `react-native-draggable-flatlist`; verifiera via `npx expo install`

</code_context>

<specifics>
## Specific Ideas

- **`lib/query/`-split-ordningsföljd**: börja med `lib/query/persister.ts` (lyfter bara persister-creation), sedan `lib/query/keys.ts` (rena typ-strukturer), sedan `lib/query/network.ts` (focusManager + onlineManager), sist `lib/query/client.ts` (QueryClient + setMutationDefaults). Det minimerar in-flight-imports under refaktor.
- **`setMutationDefaults` MÅSTE registreras före `persistQueryClient()`-anropet.** Per research/ARCHITECTURE.md Pattern 1 #1 footgun: en mutation som hydreras från AsyncStorage utan registered defaults har förlorad `mutationFn`-referens och kan inte resumeras. Plan 01 kan lägga ett runtime-assert "every queue mutation has a registered default" om det är värt det.
- **Klient-UUID-mönstret**: `lib/utils/uuid.ts` exporterar bara `randomUUID()`. Anrop i `useCreatePlan`-hookens `mutationFn`: `await supabase.from('workout_plans').insert({ id: randomUUID(), ...input })`. Optimistic-update i `onMutate` använder samma UUID så list-rendering har stabil key från första millisekunden.
- **Drag-handle-ikon**: `react-native-draggable-flatlist` ger en `drag`-callback per rad. Standard-pattern: `<TouchableOpacity onLongPress={drag}>` runt en `<MaterialCommunityIcons name="drag" size={24} />` eller liknande. iOS Reminders/Notes använder ≡ (3-line burger) som standard.
- **Optimistic update för reorder**: `onDragEnd` ger ny array. Snapshotta query-cachen för key `plansKeys.detail(planId)` (som inkluderar plan_exercises), skriv ny ordning till cache OMEDELBART, fire mutationerna i bakgrunden. Vid någon mutation `onError` rollbackar HELA snapshotten (inte per rad). Servern är källa till sanning vid `onSettled`-invalidering.
- **OfflineBanner-mount**: i `(tabs)/_layout.tsx` ovanför `<Tabs>`-komponenten, inom safe-area top-insets. Animera in/ut via Reanimated 4 `withTiming` eller `LayoutAnimation` (300ms ease-in/out) — V1 kan punta animation och bara conditionalt rendera.
- **Default route i (app)-gruppen**: Expo Router 6 group-resolution: `app/app/(app)/(tabs)/index.tsx` blir default när användaren navigerar till `/(app)/`. INGET `(app)/index.tsx` behövs (Phase 3-placeholder raderas).
- **Plan-form vs inline-edit**: två vägar — (a) "Skapa plan"-skärm som gör en mutation och navigerar till plan-detail, eller (b) skapa en local draft + add övningar + save-allt-på-en-gång. Pattern (a) är offline-friendly: skapa plan → mutation queueas → optimistic-update visar planen direkt, även om mutation pausas. Pattern (b) frestande men introducerar "draft"-state som inte synkas. **Default = (a)**.

</specifics>

<deferred>
## Deferred Ideas

- **Sparse fractional `order_index`** (1024, 2048, 3072...) — V1.1+ optimization om plan-storlek växer förbi 30+ övningar. För V1 (5–10 övningar/plan) är dense O(N) write per drag triviell.
- **Restore-arkiverad-plan-flow** — V1.1 om/när arkiv-listan växer och soak-test visar behov.
- **Pending-mutations-counter i OfflineBanner** ("Du är offline — 3 ändringar väntar") — V2 (F24 sync-state-badge är explicit V2-deferred per REQUIREMENTS.md).
- **AsyncStorage-flush-on-background hook** (Pitfall 1.3) — Phase 5 äger; plans-CRUD är låg-frekvens.
- **Redundant Zustand "pending mutations"-store** (Pitfall 1.3 belt-and-braces) — Phase 5 äger; set-logging är hot path.
- **Custom tab-bar (own Pressable + Reanimated)** — Phase 7 polish om motiverat.
- **Bottom-sheet via `@gorhom/bottom-sheet` eller `react-native-actions-sheet`** — V1 default = expo-router presentation modal (inga nya deps).
- **Förladdat globalt övningsbibliotek** (F20) — V2 App Store-pre-work; schema tillåter `user_id IS NULL` så addition är icke-disruptiv.
- **"Senast använda övningar"-vy i exercise-add-sheet** — V1.1 polish.
- **Drag-att-ordna planer i plan-listan** — V1.1 polish; V1 = `created_at desc` ordering.
- **Per-plan duplicate / "kopiera plan"-flow** — V1.1.
- **Plan-templates ("Push/Pull/Legs", "5x5"-startset)** — V2 (F30).
- **Övning-export / CSV** — V2 (F27).
- **Långpress-meny på plan-rad i listan ("Arkivera", "Duplicera")** — V1.1 UX-polish.
- **Energy-saver: pausa onlineManager-polling när app är i bakgrund** — Phase 5 owns när high-frequency mutations gör polling-cost mätbart.

### Reviewed Todos (not folded)
None — STATE.md "Pending Todos" är tom.

</deferred>

---

*Phase: 4-plans-exercises-offline-queue-plumbing*
*Context gathered: 2026-05-09*
