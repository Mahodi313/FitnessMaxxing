# Phase 5: Active Workout Hot Path (F13 lives or dies) - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 levererar **F5 + F6 + F7 + F8 + F13** — den enda fasen där "logga ett set och omedelbart se vad jag tog senast — utan att tappa data, någonsin" går från löfte till körbar kod. Efter Phase 5 ska F13-acceptance-testet passera: airplane mode + force-quit + battery-pull-simulering under ett 25-set-pass = alla 25 set överlever och synkar i rätt ordning vid återanslutning, idempotent via klient-genererade UUIDs och `scope.id`-serialiserat replay. Phase 4-plumbingen (offline-first `lib/query/*`, mutationKey-pattern, `mutate(... { onError, onSuccess })`-konvention, inline-overlay-confirm, `freezeOnBlur`-reset-pattern) ärvs in oförändrad; Phase 5 utvidgar med 3+ nya mutationKeys för sets/sessions och en ny route `/workout/[sessionId]`.

**In scope:**
- Nya Zod-schemas i `app/lib/schemas/`:
  - `sessions.ts` — `workout_sessions` Insert/Update; `started_at`/`finished_at` ISO-strings; `notes ≤ 500 chars` (F12 schema-ready)
  - `sets.ts` — `exercise_sets` Insert/Update + form-input-shape med strikt validation: `weight_kg = z.coerce.number().min(0).max(500).multipleOf(0.25)` (Pitfall 1.5), `reps = z.coerce.number().int().min(1).max(60)`, `set_type = z.enum(['working','warmup','dropset','failure']).default('working')`, `rpe`/`notes` nullable (F11/F12 schema-ready)
- Nya resource-hooks i `app/lib/queries/`:
  - `sessions.ts` — `useActiveSessionQuery()` (LIST `WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1`), `useSessionQuery(id)`, `useStartSession()` (mutationKey `['session','start']`, scope `session:<newId>`), `useFinishSession()` (mutationKey `['session','finish']`, scope `session:<id>`)
  - `sets.ts` — `useSetsForSessionQuery(sessionId)` (ORDER BY exercise_id, set_number), `useAddSet(sessionId)` (mutationKey `['set','add']`, scope `session:<id>`), `useUpdateSet(sessionId)` (mutationKey `['set','update']`, scope `session:<id>`), `useRemoveSet(sessionId)` (mutationKey `['set','remove']`, scope `session:<id>`)
  - `last-value.ts` (eller `sets.ts` extension) — `useLastValueQuery(exerciseId, currentSessionId)` returnerar set-position-aligned senaste-värde från senaste `finished_at IS NOT NULL`-pass exklusive aktuellt pass, filtrera `set_type = 'working'`
- 5 nya `setMutationDefaults`-keys i `app/lib/query/client.ts`: `['session','start']`, `['session','finish']`, `['set','add']`, `['set','update']`, `['set','remove']` — alla med idempotent `.upsert({ onConflict: 'id', ignoreDuplicates: true })` för CREATE/ADD, optimistic `onMutate` med `cancelQueries` → snapshot → optimistic write → return `{previous}`, `onError` rollback, `onSettled` invalidate
- Ny route: `app/app/(app)/workout/[sessionId].tsx` — single-scroll-card-per-övning, alltid-synlig-inline-edit-rad, `keyboardType="decimal-pad"`, header right "Avsluta"-knapp via `<Stack.Screen options={{ headerRight: ... }} />`
- "Starta pass"-knapp på `app/app/(app)/plans/[id].tsx` (Phase 4-route) — entry-point per PRD §5.2; tap kallar `useStartSession()` med klient-UUID + `plan_id`, sedan `router.push('/workout/<newId>')`
- Draft-session-recovery: `useActiveSessionQuery()` mountas i `app/app/(app)/(tabs)/index.tsx` — vid hit visas inline-overlay-modal ("Återuppta passet från HH:MM?" / "Avsluta sessionen") per Phase 4-konvention; resume routes till `/workout/<id>`, avsluta kallar `useFinishSession()` med klient-toast
- Persistent "Pågående pass"-banner: ny `app/components/active-session-banner.tsx` mountad i `app/app/(app)/(tabs)/_layout.tsx` **under** `<OfflineBanner />` men ovanför `<Tabs />` (samma SafeAreaView edges=top); subscriber till `useActiveSessionQuery()`; tap routes till `/workout/<currentId>`
- Hot-path durability (Phase 4 D-02 deferral): `app/app/_layout.tsx` AppState-listener flushar `persister.persistClient()` vid `state === 'background' || 'inactive'`; persister `throttleTime` sänks specifikt för mutationer från default 1000ms → 500ms (Pitfall 1.3). **Ingen** redundant Zustand-store (Phase 4 D-03 deferral) — Phase 4 har visat sig att TanStack-persister räcker för plan-CRUD; sets är samma plumbing, samma idempotency-garantier
- Pre-fetch-strategi för F7: vid mount av `/workout/[sessionId].tsx` (eller direkt efter `useStartSession`-success) fire en `useLastValueQuery(exerciseId, sessionId)` per `plan_exercises.exercise_id` i planen — staleTime 15min; offline-cache via persister; ny `last-value`-queryKey-faktor i `app/lib/query/keys.ts`
- Test-script `app/scripts/test-rls.ts` UTVIDGAS med cross-user assertions för `workout_sessions` + `exercise_sets` (parent-FK-check via session-ägaren — PITFALLS 2.5; redan i schemat men test saknas)
- Manuell F13-acceptanstest: airplane mode → starta pass från plan med ≥3 övningar → logga 25 set spridda på övningarna → force-quit → öppna offline (alla set finns kvar i cache) → connect → kontrollera Supabase Studio: alla 25 set landar i rätt ordning utan FK-fel/dubbletter

**Out of scope (belongs to later phases):**
- F9 Historik-lista + F10 graf-per-övning → Phase 6
- F11 RPE-fält per set (schema ready: `exercise_sets.rpe`) → Phase 7
- F12 Anteckningar per pass (schema ready: `workout_sessions.notes`, `exercise_sets.notes`) → Phase 7
- F15 dark-mode-toggle UI → Phase 7
- F17-UI set-typ-toggling under aktivt pass (schema ready, UI deferred per PROJECT.md) → V1.1
- F18 PR-detection vid pass-avslut (Epley `w * (1 + r/30)`, max-vikt/-volym) → V1.1
- F19 Vilo-timer (kräver `expo-notifications` + `expo-keep-awake`; Pitfall 6.5 JS-suspension-trap) → V1.1
- Soft-warn på vikt > F7_max * 1.3 (Pitfall 1.5 "är du säker"-popup) → V1.1 polish
- Ad-hoc-övning mid-pass (lägga till övning som inte fanns i planen) → V1.1
- 6h auto-finish-cron för abandoned sessions (Pitfall 6.6 alternativ) → V1.1 om soak visar behov
- F24 "Synlig sync-state-badge med pending-count" — explicit V2-deferred per REQUIREMENTS.md
- "Senast använda övningar"-shortcut i workout — V1.1 polish
- Apple Health-integration / widgets / CSV-export → V2 (F25-F27)
- Multi-device-conflict-resolution utöver senaste-`completed_at`-LWW (research/ARCHITECTURE.md §5.3 ramp): CRDTs/vector clocks är V2+

</domain>

<decisions>
## Implementation Decisions

### Workout screen layout

- **D-01:** Single-scroll lista över alla planens övningar. Card-per-övning där varje card har: header (övningsnamn + plan-targets-chips: `target_sets×target_reps_min-target_reps_max`-text + utrustning-chip + inline counter "X/target_sets set klart") + lista över redan loggade set-rader + alltid-synlig tom set-rad längst ned. Anv. scrollar fritt mellan övningarna. Matchar Strong/Hevy-paradigmet och Pitfall 6.2 "no modal per set". Card-styling kan återanvända samma `bg-gray-100 dark:bg-gray-800 rounded-lg`-pattern som plan-list-row i Phase 4.
- **D-02:** Entry-point = "Starta pass"-knapp på `plans/[id].tsx`. Tap kallar `useStartSession({ plan_id, id: randomUUID() })`, optimistic-update till active-session-cache, `router.push('/workout/<newId>')`. Per PRD §5.2: "väljer plan → 'Starta pass'". Ingen entry från plans-listan eller (tabs)/index — minskar test-surface och håller flow tydligt knutet till plan.
- **D-03:** Dedikerad route `/workout/[sessionId]` push:as på (app)-stacken. Inte modal — anv. kan navigera tillbaka till (tabs) under pass, men aktiva sessionen lever i URL:n och kan resumeras via `/workout/<id>`. Cold-start-resume-flow använder samma route. Matchar research/ARCHITECTURE.md §3 (`app/(app)/workout/[sessionId].tsx`).
- **D-04:** Card-header per övning: övningsnamn (display heading, samma typografi som plan-detail) + chips på rad under: `target_sets×target_reps_min-target_reps_max` (om båda satta), `equipment` (om satt), `set_type`-badge är inte synlig (V1 alltid 'working' — F17-UI är V1.1). Inline counter "X/3 set klart" till höger om headern; om `target_sets` är NULL visas "X set" utan limit. Plan-targets från `plan_exercises` läses via existerande `usePlanExercisesQuery(planId)` (Phase 4) som tar `enabled: !!planId` — Phase 5 utvidgar med exercise-name join eller använder Phase 4 Plan 04-04-mönstret (client-side `useExercisesQuery + Map<id,name>` lookup, commit `3bfaba8`).
- **D-05:** Scroll-position stannar kvar vid "Klart"-tap. Det nyloggade settet renderas i listan, en ny tom rad dyker upp under, men scrollen flyttar sig inte. Anv. äger sin scroll-position. `keyboardWillHide`-event räcker för att stänga numpad utan att rycka scrollen.
- **D-06:** "Avsluta pass"-knapp = header right via `<Stack.Screen options={{ headerRight: () => <Pressable ... /> }} />` i workout/[sessionId].tsx. Centralized (app) Stack-styling (Phase 4 commit `b57d1c2`) ger headerStyle/headerTintColor automatiskt. Knappen är inte stor och inte i scrollbar yta — minskar misstap-risken som Pitfall 6.6 varnar för. Inline-overlay-confirm vid tap.
- **D-07:** Inga ad-hoc-övningar mid-pass i V1. Vill anv. lägga till en övning som inte fanns i planen får man gå tillbaka till plan-editorn (Phase 4 plans/[id].tsx). Holds scope tight; matchar PRD §5.2 "ser lista över planens övningar i ordning".
- **D-08:** Tom set-rad on-demand-pattern. En tom set-rad finns alltid längst ned per övning oavsett om `target_sets` är satt. Anv. fyller i, trycker Klart, ny tom rad dyker upp under den loggade. Om `target_sets=3` räknas counter "X/3"; om NULL visas bara "X set" utan tak. Gör att både planerade och unplanned-set får samma flow utan att UI:t behöver två lägen.

### Set input UX (≤3s SLA hot path)

- **D-09:** Alltid-synlig inline-edit-rad: `[vikt-TextInput][reps-TextInput][Klart-Pressable]`. Inputs har `keyboardType="decimal-pad"` (Pitfall 6.1). Tap på input öppnar numpad; tap "Klart" eller numpad "Färdig" submittar. Form-state lift:as till parent-card-komponenten (Pitfall 1.4 — undvik unmount-data-loss); ALTERNATIVT: använd `react-hook-form` med form-context på workout-screen-nivå så varje card är `<Controller>`-baserad. RHF-pattern matchar Phase 3 D-12 / Phase 4 D-11.
- **D-10:** Pre-fill-policy: efter första set i ett pass pre-fylls vikt+reps på den tomma raden från det senast loggade settet i SAMMA övning i SAMMA aktiva pass. För set 1 i passet (ingen tidigare logg) pre-fylls från F7-värdet (senaste working-set från historik, set-position-aligned per D-19). Om F7 saknas (första gången övningen körs någonsin) blir raden blank. Matchar Pitfall 6.2 "pre-fill next set's reps/weight".
- **D-11:** Input-metod = numpad-only (`decimal-pad`). Inga +/− stepper-knappar, inga quick-pick-chips. Mest universell för udda vikter (52.5kg etc.); enklast att rendera; matchar Pitfall 6.1. ±-stepper är V1.1-polish om soak visar behov.
- **D-12:** Commit-flow vid "Klart"-tap = optimistisk + osynlig undo. Tap → `useAddSet().mutate({ id: randomUUID(), session_id, exercise_id, set_number, reps, weight_kg, completed_at: new Date().toISOString(), set_type: 'working' })` per Phase 4 mutate-not-mutateAsync-konvention. Optimistic-update från `onMutate` skriver direkt till `setsKeys.list(sessionId)`-cachen → ny rad syns instant + ny tom rad rendreras under. Ingen snackbar, ingen popup. Edit/delete via interaktion på loggad rad (D-14).
- **D-13:** Per-set persistens (inte "save on finish") — `useAddSet().mutate` fire:as omedelbart vid varje Klart-tap. `workout_sessions`-raden skapas vid "Starta pass" (D-02), inte vid Avsluta. Matchar Pitfall 1.1 och PRD §6 F6 acceptans ("per-set persistens").
- **D-14:** Edit/delete av loggade set = **tap = inline-edit, swipe-left = delete**. Tap på en loggad rad flippar vikt/reps till editable (`isFocused` state per row); Klart kommitar via `useUpdateSet().mutate` (mutationKey `['set','update']`). Swipe-left avslöjar röd "Ta bort"-knapp (iOS Reminders-mönster); tap delete kallar `useRemoveSet().mutate` (mutationKey `['set','remove']`). **NOTERAT divergens:** research/ARCHITECTURE.md §5.3 säger "V1 är append-only — ingen edit-set UI i F6"; vi gör avsteg explicit eftersom no-edit = en lite-typo-set kräver delete+omlogg-flow som är surrigare än en tap-och-rätta. Conflict-resolution är fortfarande LWW per `completed_at` på server-sidan. Lägger till två extra mutationKeys (`['set','update']` + `['set','remove']`) men plumbingen är samma som Phase 4 plan-exercise-update/remove.
- **D-15:** Zod-validation strikt: `weight_kg = z.coerce.number({ error: 'Vikt krävs' }).min(0, { error: 'Vikt måste vara 0 eller högre' }).max(500, { error: 'Vikt över 500kg verkar fel — kontrollera' }).multipleOf(0.25, { error: 'Vikt i steg om 0.25kg' })`; `reps = z.coerce.number().int().min(1, { error: 'Minst 1 rep' }).max(60, { error: 'Över 60 reps verkar fel — kontrollera' })`. Stoppar typos som 1255kg och negativa reps innan mutationen fire:s. RHF-resolver-pattern per Phase 4 D-11 (z.input/z.output split p.g.a. `z.coerce.number()` invarians) — `useForm<z.input<typeof setFormSchema>, undefined, SetFormOutput>(...)`.
- **D-16:** `set_number` = client-side count + 1 vid logg-tid. Per Klart-tap: `set_number = (existingSets.filter(s => s.exercise_id === currentExId).length) + 1`. Optimistic-update gör att counter:n stämmer omedelbart. Inget unique-constraint på `(session_id, exercise_id, set_number)` finns i schemat (verified `0001_initial_schema.sql`) — dubblet-set_number vid race är möjligt men accepterat (mer data > förlust per "får aldrig förlora ett set"). Replay är ändå idempotent via klient-UUID. Matchar Pitfall 1.1.

### F7 "Senaste värdet" rendering

- **D-17:** Set-position-aligned chip per aktiv set-rad. Den tomma set-raden visar (efter pre-fill) en liten chip till höger om vikt/reps-fälten: "Förra: 82.5kg × 8". Set 1 jämför mot senaste passets set 1, set 2 mot set 2, osv. Matchar PRD §6 F7 acceptans ("set-position-aligned 'Förra: set 1: 82.5kg × 8'") och Pitfall 6.3. Aggregate-header-format (D-04) **inkluderar inte** "förra"-data — bara plan-targets.
- **D-18:** Query för F7-källa = senaste `workout_sessions` med `finished_at IS NOT NULL` ORDER BY `finished_at DESC` för aktuell `exercise_id`, exklusive aktuellt `session_id`. Sätten från det sessionen returneras grupperat per `set_number`, filtrerade `set_type = 'working'` (matchar ARCHITECTURE.md §5 + Phase 2 D-13). Hook: `useLastValueQuery(exerciseId, currentSessionId)` returnerar `Map<setNumber, { weight_kg, reps, completed_at }>`.
- **D-19:** Fallback-text när F7-data saknas: chip-en visar tom dash "—" eller renderas inte alls (designer's choice; default = inte rendera så raden är ren). När hela övningen saknar historik (första gången), card-headern kan visa en liten badge "Första gången" under övningsnamnet — V1.1 polish om motiverat; V1 = bara avsaknad-av-chip.
- **D-20:** Pre-fetch vid "Starta pass". `useStartSession`-onSuccess (eller workout/[sessionId].tsx-mount) triggar en `useLastValueQuery`-per `plan_exercises.exercise_id`. Resultaten lagras i TanStack-cachen med staleTime 15min. När anv. börjar logga set har F7-chipsen redan data; offline från första millisekunden. Lägger till en ny query-key-factor i `app/lib/query/keys.ts`: `lastValueKeys.byExercise(exerciseId)`.

### Session lifecycle UX

- **D-21:** Cold-start draft-session-recovery på `(tabs)/index.tsx`. Mount kör `useActiveSessionQuery()` (auto-enabled). Hit → render inline-overlay-modal (samma pattern som Phase 4 commit `e07029a` archive-confirm) med text "Återuppta passet från [HH:MM]?" + två knappar: "Återuppta" (router.push(`/workout/<id>`)) / "Avsluta sessionen" (useFinishSession().mutate({ id, finished_at: now() })). Implementeras med `useFocusEffect` så modal också fire:s om anv. backar tillbaka till (tabs)/index från ett annat ställe. Matchar Pitfall 1.6.
- **D-22:** Persistent "Pågående pass"-banner i `(tabs)/_layout.tsx`. Ny komponent `app/components/active-session-banner.tsx`: subscriber till `useActiveSessionQuery()`; om hit visas en banner med text "Pågående pass · Tryck för att återgå" och tap routes till `/workout/<id>`. Mountad **under** `<OfflineBanner />` men **ovanför** `<Tabs />` inom `SafeAreaView edges={['top']}` (samma slot-pattern som Phase 4 D-05 OfflineBanner). Färg: t.ex. `bg-blue-100 dark:bg-blue-900` med `border-b border-blue-300 dark:border-blue-700` (UI-SPEC-detalj — designer's choice). Visible på alla tre tabbar — Planer/Historik/Inställningar — sa länge `finished_at IS NULL`.
- **D-23:** Avsluta-flow = inline-overlay-confirm + navigate hem + toast. Tap header-right "Avsluta" → render inline-overlay (`presentation: 'modal'` inte används; samma View-overlay-pattern som Phase 4): titel "Avsluta passet?" + text-body (om 0 set: "Inget set är loggat. Avsluta utan att spara?"; om ≥1 set: "X set sparade. Avsluta passet?") + tre knappar: "Avsluta" / "Fortsätt". Tap Avsluta → `useFinishSession().mutate({ id, finished_at: new Date().toISOString() }, { onSuccess: () => { router.replace('/(app)/(tabs)/'); /* trigger toast */ } })`. Empty-session-Avsluta är acceptabelt per Pitfall 6.6 ("session är finished eller abandoned, aldrig destructive"). Ingen "Discard"-knapp.
- **D-24:** Toast-affordance på sparat pass: efter `useFinishSession`-success visas en kort toast på (tabs)/index ("Passet sparat ✓") i ~2s. Implementation: enkel Reanimated-fade-View triggad av router-state eller en Zustand-flagga; eller använd existing inline-overlay-mönster utan confirm-knappar (auto-dismiss timer). Designer's choice; matchar PRD §5.4 "sparar med tidsstämpel → tillbaka till hem".
- **D-25:** Hot-path durability = **flush-on-background + persister throttle 500ms**. I `app/lib/query/network.ts` (Phase 4) utvidgas AppState-listenern: vid `state === 'background' || 'inactive'` triggas `persistQueryClient.persistClient()` (eller motsvarande API på den hydrerade persister-instansen). Persister `throttleTime` sänks specifikt för mutationer från default 1000ms → 500ms via `createAsyncStoragePersister({ throttleTime: 500 })`. Matchar Pitfall 1.3. **Ingen** redundant Zustand "pending mutations"-store (Phase 4 D-03 deferral) — Phase 4 har validerat att TanStack-persister + klient-UUID + scope.id räcker för plan-CRUD; sets är samma plumbing, samma idempotency-garantier, samma `setMutationDefaults`-patrun. Belt-and-braces läggs till bara om soak under V1-personlig användning visar tappade set.

### Claude's Discretion

- **Exact `lib/queries/last-value.ts` API shape** — Map vs nested object vs separate hook per (exerciseId, setNumber); Plan 02 väljer baserat på render-ergonomi i workout-card-komponenten.
- **`active-session-banner.tsx` styling** — färgton (`bg-blue-100` vs `bg-indigo-100` vs något annat), texthöjd, ikon (clock vs play), animation in/ut (Reanimated `withTiming` 300ms vs ingen animation). Phase 5 UI-spec-agent fyller; matchar konvention med OfflineBanner.
- **Toast-implementation på "Passet sparat"** — Reanimated-fade vs ny utility-komponent vs återanvändning av en befintlig pattern. Designer's choice; matchar Phase 4 UAT-color-amendment-konvention om real-device-verifiering.
- **`useFocusEffect`-state-reset på workout/[sessionId].tsx** — Phase 4 D-08 (Plan 04-04 commit `af6930c`) etablerade pattern att modal-state måste reset:as via `useFocusEffect` p.g.a. `freezeOnBlur: true`. Workout-screen har lokal state för aktiv-set-rad-edit-mode + Avsluta-overlay-state — Plan 02 verifierar att state-reset är konsekvent.
- **Numpad-keyboard-dismiss-trigger** — `keyboardWillHide` vs `Pressable onPress={Keyboard.dismiss}` på card-background. Plan 02 väljer.
- **RHF mode för set-input-form** — `'onChange'` ger inline-validation-feedback medan anv. skriver (kanske störande på vikt-fältet där 1.0 är ogiltigt mid-typing); `'onSubmit'` (matchar Phase 3 RHF mode-amendment för auth) ger fel först vid Klart. Plan 02 väljer; Phase 3 D-15-precedent säger onSubmit för formulär.
- **Empty-state på workout/[sessionId] när plan har 0 övningar** — `useStartSession` blockerar troligen detta redan via UI på plan-detail (Starta-knapp disabled om `plan_exercises.length === 0`), men workout-screen-fallback ("Den här planen har inga övningar än — gå tillbaka och lägg till några") är defensiv. Plan 02 väljer om defensive-UI eller bara router-guard.
- **`useExercisesQuery + Map<id, name>` lookup vs `select('*, exercises ( name )')` join** — Phase 4 Plan 04-04 valde client-side lookup (commit `3bfaba8`). Phase 5 ärver konventionen; om join visar sig mer ergonomisk på set-with-exercise-name-rendering, Plan 02 motiverar deviation.
- **Set-row visuell skillnad mellan loggad och tom rad** — Phase 4 plan-list-row-pattern (`bg-gray-100 dark:bg-gray-800`) räcker troligen för tom; loggade rader kan vara `bg-green-50 dark:bg-green-950/40` eller behålla samma tone med en check-ikon till vänster. UI-spec-agent föreslår.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 5 requirement & architecture authority
- `PRD.md` §F5/F6/F7/F8 — starta pass, logga set, senaste värde, avsluta pass; §F13 offline-stöd Måste
- `PRD.md` §5.2–§5.4 — kärnflödet (Starta pass → Logga set → Avsluta pass)
- `PRD.md` §7 — Snabb (≤3s set logging), Pålitlig (får aldrig förlora ett set), Offline-tolerant
- `ARCHITECTURE.md` §4 — `workout_sessions` + `exercise_sets` schemat (kolumner, FK:s, index `idx_exercise_sets_session`, `idx_exercise_sets_exercise(exercise_id, completed_at desc)`, `idx_sessions_user`); RLS-policies "Users can manage own sessions" + "Users can manage own sets" (with check via parent-FK efter Phase 2 errata)
- `ARCHITECTURE.md` §5 — F7 last-value query och F10 max-vikt-query med `set_type = 'working'`-filter (D-13)
- `ARCHITECTURE.md` §6 — Auth/session redan Phase 3-implementerad; Phase 5 lever bakom (app)-guarden
- `ARCHITECTURE.md` §7 — superseded av research/ARCHITECTURE.md §7 (offline-first ships V1)
- `.planning/REQUIREMENTS.md` — F5, F6, F7, F8, F13 traceability + acceptanstexter
- `.planning/ROADMAP.md` Phase 5 — Success criteria #1–#6 (start session, ≤3s set-log + persistens, set-position-aligned F7, Avsluta utan Discard, draft-recovery, F13-25-set-acceptance)
- `.planning/PROJECT.md` Core Value + Constraints — "får aldrig förlora ett set" är fas-invariant

### Phase 5 implementation pitfalls (load-bearing)
- `.planning/research/PITFALLS.md` §1.1 — Per-set persistens, INTE save-on-finish (D-13)
- `.planning/research/PITFALLS.md` §1.2 — Optimistic-update måste persistera intent INNAN cache-update (D-12; Phase 4 setMutationDefaults-pattern garanterar detta)
- `.planning/research/PITFALLS.md` §1.3 — Persister throttle + flush-on-background (D-25 — Phase 4 D-02 deferral)
- `.planning/research/PITFALLS.md` §1.4 — Numeric input loses input-in-progress (D-09 lifted form state)
- `.planning/research/PITFALLS.md` §1.5 — `weight_kg numeric(6,2)` truncation + Zod multipleOf(0.25) (D-15)
- `.planning/research/PITFALLS.md` §1.6 — Draft-session-recovery (D-21)
- `.planning/research/PITFALLS.md` §2.5 — RLS `with check` på `exercise_sets` (parent-FK-check); Phase 2 fixade errata, Phase 5 extending `test-rls.ts` med cross-user-assertions för sessions+sets
- `.planning/research/PITFALLS.md` §5.1 — Klient-UUID via expo-crypto (ärvs från Phase 4 `lib/utils/uuid.ts`)
- `.planning/research/PITFALLS.md` §5.2 — LWW conflict resolution via klient-`completed_at`
- `.planning/research/PITFALLS.md` §5.3 — Mutation `scope.id` för serial replay (`session:<id>`-scope för alla set-mutationer)
- `.planning/research/PITFALLS.md` §5.4 — `retry: 1` på mutations (ärvs från Phase 4 client.ts)
- `.planning/research/PITFALLS.md` §6.1 — Tap target ≥56pt + decimal-pad keyboard (D-11)
- `.planning/research/PITFALLS.md` §6.2 — No modal-per-set + pre-fill next set (D-10, D-12)
- `.planning/research/PITFALLS.md` §6.3 — Set-position-aligned "last value" (D-17)
- `.planning/research/PITFALLS.md` §6.6 — No "Discard workout" button (D-23)

### Phase 5 architecture context (offline-first patterns)
- `.planning/research/ARCHITECTURE.md` §1 — System overview offline-first
- `.planning/research/ARCHITECTURE.md` §3 — Project structure incl. `app/(app)/workout/[sessionId].tsx` (D-03) och `lib/queries/sessions.ts` + `sets.ts` + `last-value.ts` (Phase 5 owns)
- `.planning/research/ARCHITECTURE.md` §4 Pattern 1 — Offline-first mutation med setMutationDefaults (Phase 5 utvidgar med 5 nya keys)
- `.planning/research/ARCHITECTURE.md` §4 Pattern 3 — `scope.id = "session:<id>"` (D-12; literal example match)
- `.planning/research/ARCHITECTURE.md` §4 Pattern 4 — Idempotenta inserts via klient-UUID + upsert
- `.planning/research/ARCHITECTURE.md` §5 — Data-flow online + offline-write path (sektion 5.2 är **direkta blueprint för F13-test**)
- `.planning/research/ARCHITECTURE.md` §5.3 — Conflict resolution V1 (NOTERAT divergens i D-14: V1 är inte längre rent append-only — set-edit/delete läggs till; LWW gäller fortfarande)
- `.planning/research/ARCHITECTURE.md` §6 step 14 — "Workout flow — start + log set (THE hot path)": föreskriver airplane mode + 20 set + force-quit + reopen offline + reconnect som **build-time-validering**; Phase 5 ROADMAP success #6 är 25 set

### Phase 1–4 inheritance (CRITICAL — Phase 5 bygger PÅ deras output)
- `.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md` D-06 — `app/app/_layout.tsx` providers-ordning (refaktorerat i Phase 4 D-01); Phase 5 utvidgar AppState-flush-callback här
- `.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md` D-07 — `app/lib/supabase.ts` typed client; Phase 5 importerar `supabase` direkt
- `.planning/phases/02-schema-rls-type-generation/02-CONTEXT.md` D-04/D-05 — `createClient<Database>` typad client; Phase 5 ärver `Tables<'workout_sessions'>`/`Tables<'exercise_sets'>` från `app/types/database.ts`
- `.planning/phases/02-schema-rls-type-generation/02-CONTEXT.md` D-08 — `test-rls.ts` Node-only fixture-pattern; Phase 5 utvidgar med sessions+sets cross-user-assertions (parent-FK-check per Pitfall 2.5)
- `.planning/phases/02-schema-rls-type-generation/02-CONTEXT.md` D-11 — `set_type` ENUM ('working'/'warmup'/'dropset'/'failure') — Phase 5 skriver alltid 'working' (F17-UI är V1.1)
- `.planning/phases/03-auth-persistent-session/03-CONTEXT.md` D-08–D-10 — Zustand auth-store + selektor-pattern; Phase 5 kan läsa `useAuthStore(s => s.session?.user.id)` om explicit user_id behövs (sällan — RLS hanterar)
- `.planning/phases/03-auth-persistent-session/03-CONTEXT.md` D-15 — Svenska felmeddelanden inline; Phase 5 fortsätter
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` D-01 — `app/lib/query/{client,persister,network,keys}.ts` 4-fil-split; Phase 5 utvidgar `client.ts` (5 nya `setMutationDefaults`), `keys.ts` (nya `sessionsKeys`/`setsKeys`/`lastValueKeys`-factorer), `queries/`-mappen (sessions.ts, sets.ts, last-value.ts)
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` D-02 — AsyncStorage-flush-on-background **deferred till Phase 5** (D-25 äger nu)
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` D-03 — Redundant Zustand pending-store deferred till Phase 5; Phase 5 **avslår** (D-25 motiv: TanStack-persister räcker per Phase 4-validation)
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` D-04 — Phase 5 lägger till `['session','start']`, `['session','finish']`, `['set','add']`, `['set','update']`, `['set','remove']` (5 keys, inte 3 — D-14 utökar)
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` D-06 — `app/lib/utils/uuid.ts` `randomUUID()`-wrapper; Phase 5 importerar direkt
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` D-07 — `networkMode: 'offlineFirst'`; Phase 5 ärver
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 mutate-not-mutateAsync-fix (commit `5d953b6`) — Phase 5 **MÅSTE** använda `mutate(payload, { onError, onSuccess })`-pattern för alla submit-flows
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 inline-overlay-pattern (commits `954c480`, `e07029a`) — Phase 5 draft-resume-modal + Avsluta-confirm använder samma pattern; **inte modal portal**
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 `freezeOnBlur: true` + `useFocusEffect` state-reset (commit `af6930c`) — Phase 5 workout-screen-state måste reset:as via samma pattern
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 `initialData` + dual-write onMutate (commits `eca0540` + `b87bddf`) — Phase 5 useSessionQuery seedar från active-session-cache; useStartSession onMutate dual-writes active-session-key + sessions-detail-key
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 `presentation: 'modal'` på layout-nivå (commit `1f4d8d0`) — Phase 5 använder INTE modal-presentation för /workout (D-03 dedikerad route, inte modal)
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 centraliserad (app) Stack header-styling (commit `b57d1c2`) — Phase 5 workout-route använder samma header-style; "Avsluta"-knappen i headerRight
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 theme-aware backdrop (commit `6b8c604`) — Phase 5 ärver utan ändring

### Project conventions (etablerade tidigare)
- `CLAUDE.md ## Conventions → Navigation header & status bar` — `headerShown: false` på root; Phase 5 workout-route opt-in `headerShown: true` med Avsluta i headerRight (inheriterar (app) Stack-styling)
- `CLAUDE.md ## Conventions → Database conventions` — INGA nya schema-ändringar i Phase 5 (sessions + sets fanns sedan Phase 2). Inga nya migrations. `test-rls.ts` utvidgning räknas inte som schema-ändring men måste komma med per "Cross-user verification is a gate"
- `CLAUDE.md ## Conventions → Security conventions → Phase-specific checklists → Active workout / offline (Phase 5 — F5/F6/F7/F13)`:
  - **M2** (offline queue krypterar PII at rest) — sets är inte PII per definition; AsyncStorage-persister sparar TanStack-cache + paused mutations. Konsult: `weight_kg` + `reps` är inte PII-känsligt men `notes`-fältet (F12 Phase 7) kan vara — Phase 5 skriver inte notes men reservation behålls
  - **API4** (sync rate-limiting) — Supabase platform-rate-limit räcker för enskild användare; ingen klient-side throttle
  - **V11** (anti-flood på rapid set-logging) — TanStack `retry: 1` + `scope.id` serialisering förhindrar flood per definition
  - **Threat IDs T-05-***  — Plan 01 etablerar STRIDE-register
- `CLAUDE.md ## Recommended Stack` → State & Data: alla deps redan installerade (TanStack v5, RHF, Zod 4, Zustand); ingen ny library i Phase 5
- `CLAUDE.md First-Time-User Gotchas` → "TanStack Query v5" + "react-hook-form 7 + Zod 4 + @hookform/resolvers 5" — Phase 5 fortsätter Phase 3/4-mönstret

### Stack reference (inga nya libs i Phase 5)
- `CLAUDE.md ### Backend & Auth` — `@supabase/supabase-js@^2.105.3` installerad (Phase 1)
- `CLAUDE.md ### State & Data` — TanStack Query, Zustand, RHF, Zod 4, date-fns installerade
- Expo-crypto-wrapper i `app/lib/utils/uuid.ts` installerad i Phase 4
- **Optional**: `expo-haptics` för Klart-tap haptic feedback — Plan 02 väljer; om scope:as in är detta nya dep via `npx expo install expo-haptics`. Default = utan haptics

### Source-of-truth diff target (vad Phase 5 modifierar)
- `app/lib/query/client.ts` (Phase 4) — UTVIDGAS med 5 nya `setMutationDefaults`-block (`['session','start']`, `['session','finish']`, `['set','add']`, `['set','update']`, `['set','remove']`); inga andra ändringar
- `app/lib/query/keys.ts` (Phase 4) — UTVIDGAS med `sessionsKeys = { all, list, detail(id), active }`, `setsKeys = { all, list(sessionId) }`, `lastValueKeys = { all, byExercise(exerciseId) }`
- `app/lib/query/network.ts` (Phase 4) — UTVIDGAS med AppState-listener som flushar persister vid background/inactive (D-25)
- `app/lib/query/persister.ts` (Phase 4) — `createAsyncStoragePersister`-anrop ger `{ throttleTime: 500 }` (D-25)
- `app/lib/queries/` — NYA filer: `sessions.ts`, `sets.ts`, `last-value.ts`
- `app/lib/schemas/` — NYA filer: `sessions.ts`, `sets.ts`
- `app/scripts/test-rls.ts` (Phase 2/4) — UTVIDGAS med 4+ cross-user-assertions för `workout_sessions` (manage own) + `exercise_sets` (manage own via parent session)
- `app/app/(app)/plans/[id].tsx` (Phase 4 Plan 03/04) — UTVIDGAS med "Starta pass"-knapp (Pressable som kallar useStartSession + router.push)
- `app/app/(app)/(tabs)/index.tsx` (Phase 4 Plan 02) — UTVIDGAS med `useActiveSessionQuery` + inline-overlay-modal för draft-resume
- `app/app/(app)/(tabs)/_layout.tsx` (Phase 4 Plan 02) — UTVIDGAS med `<ActiveSessionBanner />` mountad under OfflineBanner
- `app/components/active-session-banner.tsx` — NY
- `app/app/(app)/workout/_layout.tsx` — NY (om route-grupp-segmentering behövs; alternativt deklareras i (app)/_layout.tsx direkt)
- `app/app/(app)/workout/[sessionId].tsx` — NY (huvudskärm för aktivt pass)
- `app/types/database.ts` — INGEN ändring; sessions+sets-typer redan genererade i Phase 2

### Codebase reusable assets för Phase 5
- `app/lib/supabase.ts` — typed `createClient<Database>` (Phase 1+2)
- `app/lib/utils/uuid.ts` — `randomUUID()` (Phase 4 D-06)
- `app/lib/query/client.ts` — QueryClient + 8 existing mutationDefaults (Phase 4 D-04); Phase 5 utvidgar i samma fil
- `app/lib/query/network.ts` — `useOnlineStatus()` hook + onlineManager.subscribe → resumePausedMutations (Phase 4 D-05)
- `app/lib/queries/plans.ts` — `usePlanQuery(id)` med `initialData`-pattern (Phase 4 Plan 04-04); Phase 5 ärver för "Starta pass"-knapp på plans/[id].tsx
- `app/lib/queries/plan-exercises.ts` — `usePlanExercisesQuery(planId)` ger plan_exercises i `order_index`-ordning; Phase 5 workout-screen läser denna för att rendera card-listan
- `app/lib/queries/exercises.ts` — `useExercisesQuery()` returnerar anv. egna övningar; Phase 5 workout-screen joinar exercise-name via `Map<id, name>` (Phase 4 Plan 04-04 commit `3bfaba8`-pattern)
- `app/lib/schemas/plan-exercises.ts` — Zod-pattern för `z.coerce.number()` + `useForm<z.input, undefined, z.output>` (Phase 4 D-11); Phase 5 set-form-schema följer
- `app/components/offline-banner.tsx` — visual-style template för Phase 5 active-session-banner (slot-pattern + closeable ✕ från Phase 3 quick-task `260509-001`)
- Inline-overlay-destructive-confirm-pattern (Phase 4 commit `e07029a`) — Phase 5 draft-resume-modal + Avsluta-confirm
- `useFocusEffect` state-reset-pattern (Phase 4 commit `af6930c`) — Phase 5 workout-screen-lokal-state

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`app/lib/query/client.ts`** (Phase 4) — 8 `setMutationDefaults` redan registrerade; Phase 5 utvidgar med 5 nya keys i SAMMA fil (module-load-order-invariant från Phase 4 D-04 gäller — alla defaults registreras vid modul-load BEFORE persister hydrerar)
- **`app/lib/utils/uuid.ts`** — Phase 4 D-06; Phase 5 importerar `randomUUID` i alla `useStartSession`/`useAddSet`-call-sites
- **`app/lib/queries/plan-exercises.ts`** + **`exercises.ts`** — Phase 5 läser plan_exercises (för ordning + targets per card-header) + exercises (för namn-lookup); samma queryKey-factor (`planExercisesKeys.list(planId)`)
- **`app/components/offline-banner.tsx`** — visuell mall för `active-session-banner.tsx`; samma slot-pattern, samma closeable ✕-konvention (om relevant)
- **Inline-overlay-confirm-pattern** (Phase 4 commits `954c480`, `e07029a`) — Phase 5 Avsluta-confirm + draft-resume-prompt
- **`useFocusEffect` modal-state-reset-pattern** (Phase 4 commit `af6930c`) — Phase 5 workout-screen-state (aktiv-set-rad-edit-mode + Avsluta-overlay-state) måste reset:as på blur p.g.a. `freezeOnBlur: true`
- **`initialData` cache-seed-pattern** (Phase 4 commits `eca0540` + `b87bddf`) — Phase 5 `useSessionQuery` läser från active-session-cache; `useStartSession`-onMutate dual-writes active-session + detail
- **Centraliserad (app) Stack header-styling** (Phase 4 commit `b57d1c2`) — Phase 5 workout-route ärver headerStyle/tintColor; `headerRight` är per-skärm
- **mutate-not-mutateAsync-konvention** (Phase 4 Plan 04-04 commit `5d953b6`) — `mutate(payload, { onError, onSuccess })` för ALLA submit-flows
- **Phase 4 freezeOnBlur + contentStyle theme-aware** (commits `b57d1c2`, `44c2138`, `6b8c604`) — Phase 5 inheriterar utan modifications

### Established Patterns
- **`networkMode: 'offlineFirst'` på både queries och mutations** (Phase 4 D-07) — Phase 5 ärver
- **`retry: 1` på alla mutations** (Phase 4 client.ts) — kritiskt för Pitfall 5.4
- **Optimistic onMutate → snapshot → setQueryData → return { previous }** (Phase 4 alla 8 keys) — Phase 5 alla 5 nya keys följer
- **Idempotent upsert med `{ onConflict: 'id', ignoreDuplicates: true }`** för CREATE-mutationer — Phase 5 useStartSession + useAddSet
- **`scope.id` per session/plan via mutate-call-site** (Phase 4 D-09 + scope-correction i client.ts) — Phase 5 hooks tar `sessionId`-param och bakar `scope: { id: 'session:<id>' }` in i useMutation
- **Svensk inline-felmeddelanden + AAA-kontrast på siffror** (Phase 3 D-15 + Pitfall 6.4) — Phase 5 fortsätter; weight + reps har AAA-kontrast mot card-background
- **Path-alias `@/*`** (Phase 1 D-12) — Phase 5 använder `@/lib/queries/sessions`, `@/lib/schemas/sets`, etc.
- **Filnamns-konvention = kebab-case** (Phase 1 D-11) — Phase 5: `last-value.ts`, `active-session-banner.tsx`, `workout/[sessionId].tsx`
- **Module-scope side-effects** (Phase 3 D-09) — Phase 5 utvidgar Phase 4 `network.ts` med AppState-flush-listener på modul-load

### Integration Points
- **New: `app/lib/queries/sessions.ts`** — `useStartSession`, `useFinishSession`, `useActiveSessionQuery`, `useSessionQuery(id)`
- **New: `app/lib/queries/sets.ts`** — `useAddSet(sessionId)`, `useUpdateSet(sessionId)`, `useRemoveSet(sessionId)`, `useSetsForSessionQuery(sessionId)`
- **New: `app/lib/queries/last-value.ts`** — `useLastValueQuery(exerciseId, currentSessionId)`; returnerar `Map<setNumber, { weight_kg, reps, completed_at }>`
- **New: `app/lib/schemas/sessions.ts`** — `sessionRowSchema` + `sessionFormSchema` (för Avsluta-flow notes om F12 skulle ärvas)
- **New: `app/lib/schemas/sets.ts`** — `setRowSchema` + `setFormSchema` med strikt Zod (D-15)
- **New: `app/components/active-session-banner.tsx`** — Persistent indikator
- **New: `app/app/(app)/workout/_layout.tsx`** (om route-grupp-segmentering — annars deklareras i `(app)/_layout.tsx` Stack.Screen-block)
- **New: `app/app/(app)/workout/[sessionId].tsx`** — Huvudskärm
- **Modified: `app/lib/query/client.ts`** — +5 setMutationDefaults
- **Modified: `app/lib/query/keys.ts`** — +3 key-factorer
- **Modified: `app/lib/query/network.ts`** — AppState-flush-listener
- **Modified: `app/lib/query/persister.ts`** — `createAsyncStoragePersister({ throttleTime: 500 })`
- **Modified: `app/app/(app)/plans/[id].tsx`** — "Starta pass"-knapp; route till `/workout/<newId>` efter useStartSession-onMutate
- **Modified: `app/app/(app)/(tabs)/index.tsx`** — useActiveSessionQuery + inline-overlay draft-resume-prompt
- **Modified: `app/app/(app)/(tabs)/_layout.tsx`** — `<ActiveSessionBanner />` mountad under OfflineBanner
- **Modified: `app/scripts/test-rls.ts`** — sessions + sets cross-user-assertions

</code_context>

<specifics>
## Specific Ideas

- **Card-header chip-rad-render**: "3×8-12" som chip för `target_sets×target_reps_min-target_reps_max` när alla tre är satta; "3 set" när bara `target_sets`; "8-12 reps" när bara range; tom när inget. Counter-chip ("2/3 set klart") sitter till höger om de andra chipsen, högerjusterad i card-header.
- **F7-chip layout**: liten chip till höger om vikt+reps-inputs på tom set-rad. Format: "Förra: 82.5 × 8" (utan kg-suffix eftersom V1 är kg-only — PROJECT.md "Sverige-only V1"). Färg: muted (gray-500 dark:gray-400). Tap på chip-en gör inget i V1; V1.1 kan addera quick-fill.
- **Klart-button storlek**: minst 56pt height (Pitfall 6.1 ≥56pt; ≥64pt rekommenderat) — på inline-rad får den dock konkurrera med vikt/reps-input-bredd. Pattern: `[vikt: flex-1][reps: flex-1][Klart: w-20]` på en 360pt-bred iPhone = ~76pt × 56pt Klart-knapp. AAA-kontrast på "Klart"-texten mot blue-600-bakgrunden.
- **AppState-flush-implementation**: i `app/lib/query/network.ts`, utvidga AppState-listenern: `if (Platform.OS !== 'web' && (s === 'background' || s === 'inactive')) { void persistQueryClient.persistClient(); }`. Importera `persistQueryClient` från `lib/query/persister.ts`. Verifiera att API:n finns; alternativt direkt-access till persister-instansen via `asyncStoragePersister.persistClient(...)`.
- **Persister-throttle-implementation**: `createAsyncStoragePersister({ storage: AsyncStorage, throttleTime: 500 })` — verify att option-namn matchar API:n i v5.105+; alternativt `throttleMs` eller via separat opts.
- **Draft-resume-modal trigger**: `useFocusEffect(() => { if (activeSession && !dismissed) setShowModal(true); }, [activeSession, dismissed])`. `dismissed`-state lokal till komponenten reset:as på blur via samma `useFocusEffect`-cleanup (Phase 4 D-08-pattern).
- **Toast-implementation**: enklast = Reanimated 4 `Animated.View` med `entering={FadeIn}` + `exiting={FadeOut}`-delay 2s; alternativt en context-baserad toast-Provider i `app/_layout.tsx`. Plan 02 väljer per ergonomi.
- **Zod set-form med RHF**: följer Phase 4 Plan 03-pattern (commit `f8b75b6`): `useForm<z.input<typeof setFormSchema>, undefined, SetFormOutput>({ resolver: zodResolver(setFormSchema), defaultValues: { weight_kg: prefillWeight, reps: prefillReps } })`. defaultValues uppdateras när prefill ändras via `reset()` i useEffect.

</specifics>

<deferred>
## Deferred Ideas

- **Soft-warn på vikt > F7_max * 1.3** (Pitfall 1.5 "Är du säker? Förra var 80kg") — V1.1 polish om soak visar typos är frekventa
- **Haptic feedback på Klart-tap** (`expo-haptics` ImpactFeedbackStyle.Medium) — V1 default = utan haptics; addera i V1.1 om visuell flash inte räcker som confirm
- **PR-detection F18** (Epley `w * (1 + r/30)`, max-vikt, max-volym per övning) — V1.1
- **Vilo-timer F19** (`expo-keep-awake` + `expo-notifications`, JS-suspension-trap per Pitfall 6.5) — V1.1 research-flag
- **Sparkline mini-graf per övning-card** (5 senaste working-set weight_kg som inline trend) — V2 polish; matchar F10 Phase 6 territory men inline-context = polish
- **"Senast använda övningar"-shortcut mid-pass** — V1.1 om soak visar behov
- **Plan-scoped F7** ("Förra X-passet"-specifik istället för global per övning) — V2 (F22)
- **"Repeat last session"-CTA på hemskärm** — V2 (F23)
- **Synlig pending-sync-badge med count** — V2 (F24); V1 trustar TanStack-persister-cache + OfflineBanner-konventionen
- **Ad-hoc-övning mid-pass** ("+ Lägg till övning"-knapp på workout-screen som öppnar exercise-picker) — V1.1 om personlig användning visar behov
- **6h auto-finish av abandoned sessions** (Pitfall 6.6 alternativ) — V1.1 om soak visar behov
- **Redundant Zustand pending-mutations-store** (Phase 4 D-03 belt-and-braces) — addera bara om V1 soak visar tappade set
- **Multi-unfinished-session edge case** (anv. har två sessions med finished_at IS NULL p.g.a. cross-device-race) — V1.1; V1 = pick LIMIT 1 ORDER BY started_at DESC
- **Long-press-meny på loggad set-rad** (kopiera, repetera, kommentera) — V1.1 polish
- **Set-typ-toggling (warmup/working/dropset/failure) under aktivt pass** (F17-UI) — V1.1; schema redo sedan Phase 2
- **RPE-fält (F11) per set inline** — Phase 7 V1 Kan
- **Anteckningar per pass (F12)** — Phase 7 V1 Kan
- **Apple Health-integration** — V2

### Reviewed Todos (not folded)
None — STATE.md "Pending Todos" är tom.

</deferred>

---

*Phase: 5-active-workout-hot-path-f13-lives-or-dies*
*Context gathered: 2026-05-11*
