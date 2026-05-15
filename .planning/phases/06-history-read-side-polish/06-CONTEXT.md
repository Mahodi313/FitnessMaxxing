# Phase 6: History & Read-Side Polish - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 levererar **F9 (cursor-paginerad lista över historiska pass)** + **F10 (per-övning progressionsgraf: max-vikt eller total-volym över tid)**. Det är V1:s första rena read-side-fas — all write-data finns redan från Phase 2–5; Phase 6 är surfacen där användaren *ser* den. Inga schema-ändringar. Inga nya offline-first-mönster (TanStack persister + AsyncStorage från Phase 4 hydrerar automatiskt; F10/F9 funkar offline ur lådan).

**App Store-standard ledstjärna:** UX-besluten matchar mönster i Strong/Hevy/Jefit/Fitbod där det inte krockar med FitnessMaxxings differentiatorer ("får aldrig förlora ett set" + "ingen Discard-knapp"). Skillnaden vs Strong: vi auto-discardar INTE tomma pass — vi visar dem + ger user-driven delete (matchar Phase 5 D-23).

**In scope:**
- Historik-fliken (`app/app/(app)/(tabs)/history.tsx`) byts från placeholder till real cursor-paginerad lista. Varje rad: `Datum · Plan-namn · Set-count · Total-volym`. Flat scroll (ingen sektions-gruppering). Pull-to-refresh + infinite-scroll via TanStack `useInfiniteQuery` med `started_at` som cursor. Inget filter/sök i V1.
- Ny route `app/app/(app)/history/[sessionId].tsx` — read-only session-detail. Layout: kompakt summary-header (set-count + total-volym + duration) + card-per-övning med alla set inline (read-only) + delete-pass-knapp (header right via inline-overlay-confirm). Tap på card-header routar till `/exercise/<exerciseId>/chart`.
- Ny route `app/app/(app)/exercise/[exerciseId]/chart.tsx` — F10 graf-vy. Layout: segmented control för metric ('Max vikt' / 'Total volym') ovanför grafen, segmented control för tids-fönster (1M / 3M / 6M / 1Y / All; default 3M) under grafen, line chart i mitten, lista "Senaste 10 passen för övningen" under grafen. Tap-att-se-tooltip på data-punkter. Graceful degrade: 0 punkter → empty-state-text, 1 punkt → singel-prick, 2+ → full line chart.
- Entry-points till F10-grafen (utöver tap från `/history/[sessionId]` card-header):
  - Plan-detail (`app/app/(app)/plans/[id].tsx` — Phase 4-route) UTVIDGAS med chart-ikon på höger sida av varje `plan_exercise`-rad. Ikon-tap routar till `/exercise/<exerciseId>/chart`. Hit-target ≥44pt (Pitfall 6.1).
- Ny resource-hook `app/lib/queries/sessions.ts` UTVIDGAS med `useSessionsListInfiniteQuery()` (cursor på `started_at`) + `useDeleteSession(sessionId)` (hard-delete cascade via FK on delete cascade — ingen migration).
- Ny resource-hook `app/lib/queries/exercise-chart.ts` (eller `lib/queries/sessions.ts`-extension) — `useExerciseChartQuery(exerciseId, metric, window)` returnerar memoiserade chart-arrays (per-dag-aggregat via `date_trunc('day', completed_at)` + `max(weight_kg)` ELLER `sum(weight_kg * reps)` beroende på `metric`, `where set_type = 'working'` filter). Cache-key inkluderar `metric` + `window`.
- `app/lib/query/keys.ts` UTVIDGAS med `sessionsKeys.listInfinite()`, `exerciseChartKeys.byExercise(exerciseId, metric, window)`.
- `app/lib/query/client.ts` UTVIDGAS med `setMutationDefaults` för `['session','delete']` (optimistic onMutate: remove from `sessionsKeys.listInfinite()` cache + invalidate; idempotent — hard-delete är intrinsisk-idempotent eftersom 0-rader-affected är success).
- `app/scripts/test-rls.ts` UTVIDGAS med cross-user assertions för history-list (User B kan inte se User A:s sessions/sets/charts) + delete-session (User B kan inte radera User A:s session). RLS-policies finns redan från Phase 2; detta är test-täckning för det.
- Memoization-kontrakt på alla chart-data-arrays (`useMemo` över query-resultet) per STACK.md §Victory Native XL ("pass memoized arrays, otherwise the chart re-mounts on every render and animations stutter") och ROADMAP success #3 ("data är memoiserad så grafen inte re-mountar").

**Out of scope (belongs to later phases or V1.1+):**
- F11 RPE-fält per set inline (schema-redo) → Phase 7
- F12 Anteckningar per pass (schema-redo) → Phase 7
- F15 manuell dark-mode-toggle UI → Phase 7
- F17-UI set-typ-toggling (warmup/dropset/failure) → V1.1
- F18 PR-detection vid pass-avslut (Epley `w * (1 + r/30)`, max-vikt/-volym per övning) → V1.1
- F19 Vilo-timer → V1.1
- F20 Förladdat seed-library → V2
- F22 Plan-scoped F7 ("Förra X-passet"-specifik) → V2
- F23 "Repeat last session"-CTA på hemskärm → V2
- F24 Synlig pending-sync-badge med count → V2
- F25 Apple Health-integration → V2
- F27 CSV-export per session → V2
- Edit-set inline på historiska pass — V1.1 (samtidigt som F17-UI + F11-RPE öppnar edit-formuläret ändå; bygga edit två gånger är slöseri)
- Dedikerad "Övningar"-tab (4 tabs i bottom-nav) → V2 (naturlig samtidig leverans med F20 seed-library)
- Workout-hot-path chart-ikon mid-pass — bryter Phase 5 ≤3s SLA-spirit; defer V1.1 om soak visar behov
- V1.1 cleanup-cron för tomma sessions om soak visar ackumulering
- Set-typ-badge (warmup/dropset/failure) per set-rad i history-detail → V1.1 (F17-UI)
- Pan + zoom-gester på 'All'-vy → V1.1 polish
- Reps-metric som ytterligare option i metric-toggle → V1.1 polish
- "Senast använda övningar"-shortcut i workout → V1.1
- Filter på plan + sök på övning i history-listan → V1.1 om soak visar behov
- Long-press context-menu på history-rad ('Kopiera pass', 'Repetera' etc.) → V1.1
- Sektionsgruppering per månad/vecka → V1.1 om listan blir lång
- Sparkline mini-graf per övnings-card på history-detail (inline trend-visning) → V2 polish

</domain>

<decisions>
## Implementation Decisions

### F9 — Historik-lista (`(tabs)/history.tsx`)

- **D-01:** Rad-shape = `Datum · Plan-namn · Set-count · Total-volym`. Format-exempel: `14 maj 2026 · Push A · 24 set · 3 240 kg`. Aggregeringar (`set-count`, `sum(weight_kg * reps)`) kommer via en LIST-query som joinar in `exercise_sets`-aggregat per session — antingen via Postgres `select sessions.*, count(sets.id), sum(sets.weight_kg * sets.reps) ... group by sessions.id` eller via klient-side reduce över en JOIN-fetched payload. Planner väljer query-shape (Pitfall: PITFALLS.md "Loading entire history for graph" — aggregate at DB är skoningslöshetens väg).
- **D-02:** Flat scroll, ingen sektions-gruppering. Datum på varje rad ger anv. tillräcklig tids-kontext utan SectionList-overhead. Sektion-gruppering per månad/vecka deferreras till V1.1 om listan växer (anv. har sällan >50 pass första 4 veckorna; soak validerar).
- **D-03:** Pagination via TanStack v5 `useInfiniteQuery` med cursor på `started_at` (DESC). Page-size = 20. `onEndReached` (threshold 0.5) auto-fetcha nästa sida; pull-to-refresh top för att invalidera + refetcha fr sidan 1. Matchar ROADMAP success #1 ("cursor-paginerad lista, sorterad på `started_at desc`") explicit. Standard FlatList-pattern. **Offline-friendly:** TanStack persister cache-hydrerar listan vid kall-start (success #4) — anv. ser senaste 20 pass utan nät.
- **D-04:** Inget filter, ingen sök i V1. För personlig användare i V1 är listan tillräckligt kort. Filter på plan / sök på övning deferreras till V1.1 om soak visar behov. Matchar PROJECT.md "personligt verktyg i V1".

### Session-detail-skärm (`/history/[sessionId]`)

- **D-05:** Ny route `app/app/(app)/history/[sessionId].tsx`. Tap på history-list-rad → `router.push('/history/<id>')`. **Inte** återanvänd `/workout/[sessionId]` (Phase 5) i `mode='view'` — det skulle introducera conditionals i Phase 5:s hot-path-route och kollidera med ActiveSessionBanner-mount-state (banner mountas när `finished_at IS NULL`; history-detail har alltid `finished_at IS NOT NULL`). Ny route är ren scope-isolation.
- **D-06:** Layout = card-per-övning med alla set inline (read-only). Card-header: övningsnamn + chip-rad (set-count för övningen i passet, max-vikt för övningen i passet). Sets listas under headern som rader (`set#: vikt × reps`). Samma visuella card-paradigm som workout-screen (`bg-gray-100 dark:bg-gray-800 rounded-lg`) för konsistens. Set-typ-badge per rad är V1.1 (F17-UI); V1 skriver alltid `set_type='working'` så vi visar inte badge förrän det finns något att skilja på.
- **D-07:** Mutationer = read-only set + radera hela passet. Header right "..."-meny eller direkt-tryckbar 🗑-knapp triggar inline-overlay-confirm (Phase 4-konvention, commit `e07029a`-pattern) "Ta bort detta pass? Set och vikt försvinner permanent." Tap "Ta bort" → `useDeleteSession(sessionId).mutate({ id })` — hard-delete via Supabase (FK `on delete cascade` på `exercise_sets.session_id` raderar alla set automatiskt; ingen migration behövs). `router.replace('/(tabs)/history')` efter onSuccess + toast "Passet borttaget". **Edit-set deferreras till V1.1** eftersom F17-UI + F11-RPE + F18 PR-detection samtliga kräver edit-formuläret i V1.1 — bygga det två gånger är slöseri.
- **D-08:** Arkiverad eller raderad plan-rendering: visa plan-namnet ändå (utan `archived_at IS NULL`-filter på plans-joinen — Phase 4 D-12 arkiverar via flag, raden finns kvar). Om `plan_id IS NULL` (på `workout_sessions.plan_id ON DELETE SET NULL` cascade — kan teoretiskt ske men ovanligt) visas `'— ingen plan'`. Krav i history-listan + detail-headern.
- **D-09:** Summary-header ovanför första cardet: kompakt rad `[set-count] · [total-volym] · [duration]`. Format: `24 set · 3 240 kg · 45 min`. Återanvänder samma aggregeringar som F9 list-rad (D-01) — gratis i query.
- **D-10:** Duration-rendering via `date-fns` `differenceInMinutes(finished_at, started_at)`. Vid `finished_at IS NULL` (abandonerat pass — kan komma upp i V1.1 om recovery-flow ändras) visa `'—'`. V1 history-listan filtrerar `finished_at IS NOT NULL` så det här är defensive.
- **D-11:** Tap på en card-header (övningsnamn eller en liten chart-ikon i headern) routar till `/exercise/<exerciseId>/chart`. Cross-link mellan detail och F10-grafen. Naturlig "jag just loggade det här — visa mig trenden"-affordance.
- **D-12:** Loading-state = liten 'Laddar…'-text centrerad (matchar Phase 4/5-konvention). Cache-hit gör att det syns nästan aldrig när anv. kommer från history-listan (TanStack-cache redan varm). Skeleton-loader är V1.1 polish om det blir motiverat.
- **D-13:** Tomma pass (`finished_at IS NOT NULL` men 0 set — t.ex. anv. tryckte Starta + Avsluta av misstag) **visas i listan med `0 set · 0 kg · X min`** och kan raderas via delete-pass-knappen på detail-routen. Matchar Phase 5 D-23 ("empty-session-Avsluta är acceptabelt — sessionen är finished eller abandoned, aldrig destructive"). **Avviker medvetet från Strong/Hevy-mönstret** (där tomma pass auto-discardas) — vår "får aldrig förlora ett set"-doktrin innebär att vi trustar datan och låter anv. rensa upp explicit. V1.1 cleanup-cron kan rensa accumulating empty sessions om soak visar behov.

### F10 — Per-övning graf (`/exercise/[exerciseId]/chart`)

- **D-14:** Metric-presentation = segmented control 'Max vikt' / 'Total volym' ovanför grafen. App Store-standard (Strong, Hevy). Anv. tappar för att swappa metric; en graf-yta, segmented control byter `data`-prop till `<CartesianChart>`. Matchar PRD §F10 ("max vikt, total volym") som båda måste levereras i V1.
- **D-15:** Tids-fönster-väljare = segmented control `1M / 3M / 6M / 1Y / All`, default `3M`. Pinnar på App Store-standard (Strong, Hevy). Under grafen (eller toppen tillsammans med metric — UI-SPEC väljer). Affecterar `where completed_at >= now() - interval 'X'` på chart-query.
- **D-16:** Chart-typ = line chart med data-punkter via `victory-native` `<CartesianChart>` + `<Line>` med visible points (`<Scatter>` overlay eller `<Line points>`-prop — UI-SPEC väljer). Standard för "progression över tid". Bar-chart och area-chart deferreras (mer specialiserad UX, mindre standard).
- **D-17:** Graceful degradation för data-mängd:
  - **0 punkter**: empty-state-text "Inga pass än för den här övningen. Logga minst 2 set för att se trend." + dimmad/tom chart-area.
  - **1 punkt**: singel-prick rendrad (Victory Native `<Line>` med 1-element array renderar 1 dot automatiskt). Caption-text under: "Logga ett pass till för att se trend."
  - **2+ punkter**: full line chart med data-points.
- **D-18:** Date-bucketing per dag — `date_trunc('day', completed_at)` per ARCHITECTURE.md §5 F10-query. Om anv. kör samma övning i 2 pass samma dag aggregeras dagsmax (för Max vikt) eller dagstotal (för Total volym). Strong-standard. Cleanare graf på lång sikt än per-pass-bucketing.
- **D-19:** Interaktivitet = tap-att-se-tooltip via Victory Native XL `useChartPressState`. Tap-on-chart highlights den närmaste punkten + visar tooltip-bubblan med exakt värde + datum. Standard på Strong/Hevy. Implementation finns i CartesianChart-docs. Pan + zoom-gester deferreras till V1.1.
- **D-20:** "Senaste 10 passen för övningen"-lista under grafen. Per rad: `Datum · Max-vikt · Set-count` (eller bara `Datum · "X kg × Y reps" på topp-setet`). Tap-att-routa till `/history/<sessionId>` för det passet. Matchar PRD §5.5 explicit ("graf över tid + senaste 10 passen som lista"). Skön cross-link mellan graf-vyn och history-detail.
- **D-21:** Memoization-kontrakt: `useMemo` över query-resultet för stable referens till `<CartesianChart>.data`-propen. STACK.md §Victory Native XL: "pass memoized arrays, otherwise the chart re-mounts on every render and animations stutter". ROADMAP success #3 kräver detta explicit. Pattern: `const chartData = useMemo(() => parseRowsToChartFormat(query.data), [query.data])`.
- **D-22:** Axes = Y-axel auto-scale (data-range driver y-min/y-max så vikt-progression syns även när 80 → 82.5kg); X-axel datum-labels max 5 ticks (Victory Native `tickValues` / `formatTicks` med `date-fns` format). Default-format: `'MMM d'` (svenska: 'maj 14').
- **D-23:** Färg-tematik = theme-aware via `useColorScheme()`. Light-mode: linje + punkt-fill = `#2563eb` (blue-600 — matchar Phase 4 D-18 tab-active-tint-konvention). Dark-mode: `#60a5fa` (blue-400). Axel-color: `gray-500` / `gray-400`. Bakgrund: transparent (inherit från `bg-white dark:bg-gray-900`-container).

### F10 — Entry-points + routing

- **D-24:** F10-entry-point #1 = chart-ikon per `plan_exercise`-rad på `/plans/[id].tsx` (Phase 4-route). Ikon-design: Ionicons `stats-chart` eller `trending-up` (UI-SPEC väljer). Position: höger-justerad i row-end, efter target-chips. Hit-target ≥44pt (Pitfall 6.1). Tap routar till `/exercise/<exerciseId>/chart`. Tap-bubblar **inte** upp till row-tap (om/när row-tap landar i framtida features). Natural discovery i plan-edit-context.
- **D-25:** F10-entry-point #2 = tap på card-header (övningsnamn) på `/history/[sessionId]` (D-11). Naturlig "jag just loggade det här — visa mig trenden"-flow.
- **D-26:** Route-struktur = `/exercise/[exerciseId]/chart`. Tydlig URL-state, exercise-id i path. Path-segment `chart` är explicit om vad sidan visar; öppet för V2-utvidgning till `/exercise/[id]/index` (full exercise-stats-page med PR-history + edit etc.). Matchar ARCHITECTURE.md §3 skiss "`/exercise/[id]` Övningsdetalj + historik/graf" anpassad för V1-scope (bara chart-vyn levereras nu).
- **D-27:** Header på `/exercise/[exerciseId]/chart` visar övningsnamn (resolved via `useExercisesQuery().data` → `Map<id, name>`-lookup; Phase 4 Plan 04-04-pattern commit `3bfaba8`). Centraliserad (app) Stack header-styling (Phase 4 commit `b57d1c2`) ger automatiskt headerStyle/tintColor.
- **D-28:** Workout-hot-path chart-ikon (mid-pass tap för att se trend) **DEFERRERAS HELT**. Bryter Phase 5 ≤3s SLA-spirit (distractions från set-logging-loop). V1.1 om soak visar behov ("jag ville se min trend mellan set 3 och 4 men måste navigera bort"). Dedikerad "Övningar"-tab (4 tabs i bottom-nav) deferreras till V2 (naturlig samtidig leverans med F20 seed-library).

### Claude's Discretion

- **Exakt query-shape för F9 list-aggregat** — Postgres-side `group by` + Supabase join-syntax vs klient-side reduce över JOIN-fetched data vs separat aggregate-RPC. Planner väljer per perf-realism (för en personlig anv. <100 pass går klient-side; för App Store V2 bör DB-side aggregate landa). Pitfall PITFALLS.md "loading entire history for graph" varnar; samma princip gäller history-list-aggregat.
- **Exakt query-shape för F10 chart-data** — server-side `group by date_trunc('day', completed_at)` (matchar ARCHITECTURE.md §5) vs klient-side groupBy efter över-fetch. Planner väljer; ARCHITECTURE.md §5 prefererar server-side.
- **Segmented-control-komponent** — anv. `react-native`'s `<SegmentedControlIOS>` (iOS-native men deprecated), `@react-native-segmented-control/segmented-control` (Expo-blessed wrapper), eller hemlös Pressable-based via NativeWind. Planner/UI-SPEC väljer; default = `@react-native-segmented-control/segmented-control` om Expo-install funkar, annars NativeWind-baserat fallback.
- **Chart-ikon-glyph på plan_exercise-rad** — `stats-chart` vs `trending-up` vs `analytics` vs `bar-chart-outline` (alla Ionicons). UI-SPEC väljer baserat på visuell konsistens.
- **Tooltip-styling på data-punkt-tap** — bubble vs callout-card vs inline-label. Victory Native XL ger primitives; UI-SPEC väljer.
- **Empty-state-illustration** — bara text vs ikon + text vs SVG-illustration (overkill för V1). Default = ikon + text (`Ionicons stats-chart` faded gray + body-text).
- **Delete-pass affordance på `/history/[sessionId]`** — header-right "..."-meny som expanderar till en inline-options-overlay (Phase 4 commit `954c480`-pattern) vs direkt 🗑-knapp i header-right vs sliding-action på listan. Default = "..."-meny för att inte exponera radera direkt vid mistap (Phase 5 D-23-spirit).
- **`useMemo`-dependency-array** — `[query.data]` räcker (TanStack v5 garanterar stable referens på `data` när inget refetchas). Om vi behöver beräkna over `[query.data, metric, window]` får planner välja.
- **Toast-implementation efter delete-pass** — återanvänd Phase 5 toast-pattern (Reanimated FadeIn/FadeOut, commit `8a18a51` om Plan 02 etablerat det) eller bygg en context-provider. Planner väljer baserat på existing pattern.
- **`useFocusEffect`-state-reset på `/history/[sessionId]`** — `freezeOnBlur: true` (Phase 4 D-08 + commit `da65717`) innebär att lokal state (delete-overlay-state) behöver reset:as på blur via `useFocusEffect` (Phase 4 commit `af6930c`-pattern). Planner verifierar.
- **Pagination-edge-case när cursor=last-page-empty** — TanStack v5 `useInfiniteQuery` med `getNextPageParam: (lastPage) => lastPage.length === 20 ? lastPage[lastPage.length-1].started_at : undefined` är standardpattern; planner verifierar exact semantics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 requirement & architecture authority
- `PRD.md` §F9, §F10 — F9 Måste (cursor-paginerad lista), F10 Bör (max vikt + total volym, båda)
- `PRD.md` §5.5 — "Per övning: graf över tid (max vikt, total volym), senaste 10 passen som lista" — explicit krav för D-20
- `ARCHITECTURE.md` §3 — Projekt-struktur skiss inkl. `app/(app)/exercise/[id].tsx` (Övningsdetalj + historik/graf) — V1 levererar sub-route `/chart` av denna
- `ARCHITECTURE.md` §4 — `workout_sessions` + `exercise_sets` schema (kolumner, FK:s, `on delete cascade` på `exercise_sets.session_id` — driver D-07 hard-delete via FK), `idx_exercise_sets_exercise(exercise_id, completed_at desc)` (driver F10 chart-query)
- `ARCHITECTURE.md` §5 — F10-query (date_trunc + max(weight_kg) WHERE set_type='working') = locked SQL-shape för D-18
- `ARCHITECTURE.md` §6 — Auth/session redan Phase 3; Phase 6 lever bakom (app)-guarden
- `ARCHITECTURE.md` §8 — RLS som primärt skydd; Phase 6 utvidgar `test-rls.ts` med cross-user assertions för history-list + delete-session
- `.planning/REQUIREMENTS.md` — F9 (Pending → Phase 6), F10 (Pending → Phase 6), traceability mappning
- `.planning/ROADMAP.md` Phase 6 — Success criteria #1–#4 (cursor-paginerad lista; öppna pass + se alla set; graf via `<CartesianChart>` med memoiserad data; offline-funktion via cache-hydration)
- `.planning/PROJECT.md` Core Value + Constraints — "får aldrig förlora ett set" (driver D-13 + D-07 explicit delete-vector istället för auto-discard)

### Phase 6 implementation pitfalls (load-bearing)
- `.planning/research/PITFALLS.md` "Loading entire history for graph" (App freeze on F10) — driver D-18 server-side aggregat via `date_trunc`/`max` + tids-fönster-LIMIT (D-15)
- `.planning/research/PITFALLS.md` §2.5 — RLS `with check` på `exercise_sets` + parent-FK-check; Phase 6 utvidgar `test-rls.ts` med cross-user assertions för history-list + delete-session
- `.planning/research/PITFALLS.md` §6.1 — Tap target ≥44pt (driver D-24 chart-ikon hit-target)
- `.planning/research/PITFALLS.md` §6.4 — AAA-kontrast på siffror (driver D-22/D-23 axes + theme-färg)

### Phase 6 stack reference (allt redan installerat — verifierat i `app/package.json`)
- `CLAUDE.md ### Charting` — `@shopify/react-native-skia@2.2.12` + `victory-native@^41.20.2` installerade
- `CLAUDE.md First-Time-User Gotchas → Victory Native (XL) 41` — "data-prop måste vara memoized array, annars re-mountar grafen" (driver D-21)
- `CLAUDE.md First-Time-User Gotchas → @shopify/react-native-skia 2.6` — Expo Go SDK 54 inkluderar Skia 2.6.x; ingen extra config för dev
- `.planning/research/STACK.md` §Charting decision — Victory Native XL över raw Skia: `<CartesianChart>` ger line/bar/area + axes + gestures + animated paths out-of-the-box; F10 är ~30 rader TSX med XL vs ~2-3 dagar med raw Skia
- `.planning/research/STACK.md` §Victory Native (XL) 41 + Skia 2.6 — peer-dep-warning loose; verified May 2026 att v41.20.2 funkar med Skia 2.x + Reanimated 4.1.x

### Phase 6 architecture context (offline-first patterns ärvs)
- `.planning/research/ARCHITECTURE.md` §1 — System overview offline-first (history-list cache-hydreras automatiskt vid kall-start; ROADMAP success #4)
- `.planning/research/ARCHITECTURE.md` §3 — `app/(app)/exercise/[id].tsx` route-skiss (V1 levererar `/exercise/[id]/chart` sub-segment); `lib/queries/exercise-chart.ts` Phase 6 owner
- `.planning/research/ARCHITECTURE.md` §4 Pattern 1 — Offline-first queries (Phase 6 läser; ingen ny mutation-yta utöver `['session','delete']`)
- `.planning/research/ARCHITECTURE.md` §5 — F7/F10-query-shapes; F10 = `select date_trunc('day', completed_at) as day, max(weight_kg) ... group by day order by day` (för max-vikt; ersätt `max(weight_kg)` med `sum(weight_kg * reps)` för total-volym)

### Phase 1–5 inheritance (CRITICAL — Phase 6 bygger PÅ deras output)
- `.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md` D-06/D-07 — `app/lib/supabase.ts` typed client; Phase 6 importerar direkt
- `.planning/phases/02-schema-rls-type-generation/02-CONTEXT.md` D-04/D-05 — `createClient<Database>` typad; Phase 6 ärver `Tables<'workout_sessions'>` / `Tables<'exercise_sets'>` / `Tables<'exercises'>` / `Tables<'workout_plans'>`
- `.planning/phases/02-schema-rls-type-generation/02-CONTEXT.md` D-08 — `test-rls.ts` Node-only fixture-pattern; Phase 6 utvidgar med history + delete-session cross-user assertions
- `.planning/phases/02-schema-rls-type-generation/02-CONTEXT.md` D-11 — `set_type` ENUM ('working'/'warmup'/'dropset'/'failure'); F10-query filtrerar `set_type = 'working'` per ARCHITECTURE §5
- `.planning/phases/03-auth-persistent-session/03-CONTEXT.md` D-08–D-10 — Zustand auth-store `useAuthStore(s => s.session?.user.id)` om explicit user-id behövs (sällan — RLS hanterar)
- `.planning/phases/03-auth-persistent-session/03-CONTEXT.md` D-15 — Svenska felmeddelanden inline; Phase 6 fortsätter konvention
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` D-01 — `lib/query/{client,persister,network,keys}.ts` 4-fil-split; Phase 6 utvidgar `client.ts` (`['session','delete']` setMutationDefault) + `keys.ts` (`sessionsKeys.listInfinite()`, `exerciseChartKeys.byExercise()`)
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` D-12 — Plan-arkivering via `archived_at`-flag; plans listas WHERE archived_at IS NULL. Phase 6 history-detail joinar PLANS **utan** filter på archived_at (D-08) — arkiverade plans har fortfarande namn
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` D-18 — `useColorScheme()`-bound tab-bar styling; Phase 6 chart-färg följer (D-23)
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 mutate-not-mutateAsync (`commit 5d953b6`) — Phase 6 `useDeleteSession.mutate(...)` följer
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 inline-overlay-confirm (`commit e07029a`) — Phase 6 delete-pass-confirm följer; **inte modal portal**
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 freezeOnBlur + `useFocusEffect` state-reset (`commit af6930c`) — Phase 6 history-detail-screen-state måste reset:as
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 centraliserad (app) Stack header-styling (`commit b57d1c2`) — Phase 6 history-detail + exercise-chart routes ärver
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 `useExercisesQuery + Map<id, name>` lookup (`commit 3bfaba8`) — Phase 6 history-detail + exercise-chart header resolverar exercise-name samma
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 `initialData` cache-seed-pattern (`commits eca0540 + b87bddf`) — Phase 6 `useSessionQuery(id)` (Phase 5) ärver redan; history-detail når detalj utan loading-flash om kommer från list
- `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-CONTEXT.md` D-14 — "edit-set kräver att passet är aktivt" → Phase 6 history-detail är read-only; edit defer V1.1 (D-07)
- `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-CONTEXT.md` D-23 — "empty-session-Avsluta är acceptabelt" → Phase 6 visar tomma pass + delete-vector (D-13); avviker medvetet från Strong/Hevy auto-discard
- `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-CONTEXT.md` D-18 — F7 query använder `workout_sessions!inner` join med `finished_at IS NOT NULL` + `set_type='working'` filter; Phase 6 F10-query-pattern är samma struktur med per-dag-aggregat över tids-fönster

### Project conventions (etablerade tidigare)
- `CLAUDE.md ## Conventions → Navigation header & status bar` — Phase 6 history-detail + exercise-chart routes opt-in headerShown via centraliserad (app) Stack-styling (Phase 4 commit `b57d1c2`); back-knapp-default
- `CLAUDE.md ## Conventions → Database conventions` — Phase 6 introducerar INGA schema-ändringar (alla 6 tabeller finns sedan Phase 2; FK on delete cascade på `exercise_sets.session_id` driver D-07 hard-delete utan migration). `test-rls.ts`-utvidgning räknas inte som schema-ändring men kommer med per "Cross-user verification is a gate"
- `CLAUDE.md ## Conventions → Security conventions → Phase-specific checklists → Read-side / charts (Phase 6 — F9/F10)`:
  - **API3** (no aggregation across users) — RLS på `workout_sessions` + `exercise_sets` scopar all aggregation server-side; `test-rls.ts` utvidgas med cross-user history-list + chart-query assertions för regression-skydd
  - **V12** (file/data uploads N/A i V1)
  - **Threat IDs T-06-*** — Plan 01 etablerar STRIDE-register; relevanta hot: spoofing av exercise-id i URL (`/exercise/<wrong-id>/chart`) → RLS-skydd; tampering av cursor-param på infinite-query → server-side begränsar; info disclosure via chart-data om RLS missar — `test-rls.ts` cross-user assertions täcker
- `CLAUDE.md ## Recommended Stack → Charting` — `@shopify/react-native-skia@2.2.12` + `victory-native@^41.20.2` (NB: CLAUDE.md listar pinned `2.6.2` men `app/package.json` har `2.2.12` faktiskt installerat — Phase 1 D-X pinnade till verified version)
- `CLAUDE.md ## Recommended Stack → State & Data` — `@tanstack/react-query@^5.100.9` (med `useInfiniteQuery`); `zustand@^5.0.13` (Phase 6 läser auth-store); `react-hook-form` — inga formulär i Phase 6; `zod@^4.4.3` — Phase 6 parse:ar Supabase-responses via existing schemas
- `CLAUDE.md ### Backend & Auth` — `@supabase/supabase-js@^2.105.4` installerad; Phase 6 använder existing typed client
- `CLAUDE.md First-Time-User Gotchas → TanStack Query v5` — `useInfiniteQuery` object-arg API, `gcTime` rename; Phase 6 ärver Phase 1-konfig

### Stack reference (allt installerat — inga nya libs i Phase 6)
- `app/package.json`:
  - `@shopify/react-native-skia: 2.2.12` ✓
  - `victory-native: ^41.20.2` ✓
  - `@tanstack/react-query: ^5.100.9` ✓ (med `useInfiniteQuery`)
  - `date-fns: ^4.1.0` ✓ (för X-axis tick-format + duration `differenceInMinutes`)
  - `@expo/vector-icons: ^15.0.3` ✓ (för chart-ikon på plan_exercise-rad)
  - **Optional V1.1**: `@react-native-segmented-control/segmented-control` — Phase 6 planner kan välja Expo-install eller bygga NativeWind-baserat segmented-control
- **Optional**: ingen ny native-modul behövs

### Source-of-truth diff target (vad Phase 6 modifierar)
- `app/app/(app)/(tabs)/history.tsx` (Phase 4 placeholder) — ERSÄTTS med real cursor-paginerad lista + `useInfiniteQuery`
- `app/app/(app)/plans/[id].tsx` (Phase 4) — UTVIDGAS med chart-ikon på höger sida av varje plan_exercise-rad; ikon-tap routar till `/exercise/<exerciseId>/chart`
- `app/lib/queries/sessions.ts` (Phase 5) — UTVIDGAS med `useSessionsListInfiniteQuery()` (cursor på `started_at`) + `useDeleteSession(sessionId)` (hard-delete via FK on delete cascade)
- `app/lib/query/keys.ts` (Phase 4/5) — UTVIDGAS med `sessionsKeys.listInfinite()`, `exerciseChartKeys.byExercise(exerciseId, metric, window)`
- `app/lib/query/client.ts` (Phase 4/5) — UTVIDGAS med `setMutationDefaults` för `['session','delete']` (optimistic remove from listInfinite + invalidate)
- `app/scripts/test-rls.ts` (Phase 2+) — UTVIDGAS med cross-user assertions för: history-list (User B kan inte se User A:s sessions); chart-data (User B kan inte se User A:s sets via exercise-chart-query); delete-session (User B kan inte radera User A:s session)
- NYA filer:
  - `app/app/(app)/history/[sessionId].tsx` — read-only session-detail
  - `app/app/(app)/exercise/[exerciseId]/chart.tsx` — F10 graf-vy
  - `app/lib/queries/exercise-chart.ts` (eller extend `sessions.ts`) — `useExerciseChartQuery(exerciseId, metric, window)`
  - Eventuellt: `app/components/segmented-control.tsx` (om NativeWind-baserat fallback för metric/window-toggle)
  - Eventuellt: `app/components/empty-state.tsx` (återanvändbar för chart-empty + history-empty om utvecklat tillsammans)
- INGEN ändring:
  - `app/types/database.ts` — schema oförändrat
  - `app/supabase/migrations/*` — inga nya migrations
  - `app/lib/schemas/{sessions,sets}.ts` — existing schemas räcker; Phase 6 parse:ar history-rader via samma
  - `app/lib/supabase.ts` — typed client oförändrat
  - `app/app/_layout.tsx` + `app/app/(app)/_layout.tsx` + `app/app/(app)/(tabs)/_layout.tsx` — Stack/Tabs-skeletten oförändrade (history-tabben fylls; ActiveSessionBanner kvarstår)

### Codebase reusable assets för Phase 6
- **`app/lib/queries/sessions.ts`** (Phase 5) — `useSessionQuery(id)` med `initialData`-pattern; Phase 6 history-detail ärver för zero-flash navigation från list
- **`app/lib/queries/sets.ts`** (Phase 5) — `useSetsForSessionQuery(sessionId)` ger sets ORDER BY exercise_id, set_number för history-detail card-grouping
- **`app/lib/queries/exercises.ts`** (Phase 4) — `useExercisesQuery()` för exercise-name-lookup på history-detail card-headers + chart-route header
- **`app/lib/queries/last-value.ts`** (Phase 5) — 2-step SQL-pattern (find-finished-session → fetch-sets) är **mall för F10 chart-query** men aggregeras (date_trunc) istället för set-position-aligned
- **`app/lib/query/persister.ts`** (Phase 4) — TanStack persister + AsyncStorage hydrerar history-list-cache vid kall-start (ROADMAP success #4 är gratis)
- **`app/lib/query/network.ts`** (Phase 4) — `useOnlineStatus()`-hook + `OfflineBanner` synlig på (tabs)/history; Phase 5 D-25 AppState-flush gäller även Phase 6 mutations (delete-session)
- **Phase 4 inline-overlay-destructive-confirm-pattern** (`commit e07029a`) — Phase 6 delete-pass-confirm följer exakt; inte modal portal
- **Phase 4 `useFocusEffect`-state-reset-pattern** (`commit af6930c`) — Phase 6 history-detail-screen-state (delete-overlay-state)
- **Phase 4 centraliserad (app) Stack header-styling** (`commit b57d1c2`) — Phase 6 history-detail + exercise-chart routes ärver headerStyle/tintColor; per-screen `<Stack.Screen options={{ title }}>` sätter dynamisk titel
- **Phase 4 mutate-not-mutateAsync-konvention** (`commit 5d953b6`) — `useDeleteSession.mutate(...)` med `{ onError, onSuccess }`
- **Phase 4 `useExercisesQuery + Map<id, name>` lookup-pattern** (`commit 3bfaba8`) — Phase 6 history-detail + exercise-chart header resolverar exercise-name
- **Phase 5 `useColorScheme`-bound theme-aware backdrop** (`commit 6b8c604`) — Phase 6 chart-färg + axes (D-23) följer samma signal-källa
- **NativeWind dark-mode-konvention** (Phase 1) — `bg-white dark:bg-gray-900`-pairs på alla nya komponenter; chart-container respekterar

### Established Patterns (Phase 6 fortsätter)
- **`networkMode: 'offlineFirst'`** (Phase 4 D-07) — history-list query + chart-query ärver; queries serverar cache utan att kasta nätverksfel
- **Hierarkisk queryKey-factor** (Phase 4 D-01) — `sessionsKeys.listInfinite()`, `exerciseChartKeys.byExercise(id, metric, window)` följer
- **Module-scope side-effects** — Phase 6 lägger till `setMutationDefaults` för `['session','delete']` i `lib/query/client.ts` vid modul-load (Pitfall 8.1)
- **Path-alias `@/*`** (Phase 1 D-12) — Phase 6 använder `@/lib/queries/sessions`, `@/lib/queries/exercise-chart`, etc.
- **Filnamns-konvention = kebab-case** (Phase 1 D-11) — `exercise-chart.ts`, `history/[sessionId].tsx`, `exercise/[exerciseId]/chart.tsx`
- **Svensk inline-kopia** (Phase 3 D-15) — "Inga pass än", "Logga minst 2 set för att se trend", "Passet borttaget", "Ta bort detta pass?"
- **Empty-state-konvention** (Phase 4 D-14) — centered ikon (`Ionicons stats-chart` faded) + Display heading + Body text; primärknapp om relevant CTA

### Integration Points
- **New: `app/lib/queries/exercise-chart.ts`** — `useExerciseChartQuery(exerciseId, metric, window)` returnerar memoiserad data-array
- **New: `app/app/(app)/history/[sessionId].tsx`** — read-only session-detail
- **New: `app/app/(app)/exercise/[exerciseId]/chart.tsx`** — F10 graf
- **New: `app/lib/query/keys.ts`** UTVIDGAS — `sessionsKeys.listInfinite()`, `exerciseChartKeys.byExercise(id, metric, window)`
- **New: `app/lib/query/client.ts`** UTVIDGAS — `setMutationDefaults(['session','delete'], ...)`
- **New: `app/lib/queries/sessions.ts`** UTVIDGAS — `useSessionsListInfiniteQuery()`, `useDeleteSession(sessionId)`
- **Modified: `app/app/(app)/(tabs)/history.tsx`** — placeholder → real list
- **Modified: `app/app/(app)/plans/[id].tsx`** (Phase 4) — chart-ikon per plan_exercise-rad
- **Modified: `app/scripts/test-rls.ts`** — cross-user assertions för history + delete-session

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`app/lib/queries/sessions.ts`** (Phase 5) — `useSessionQuery(id)` med `initialData`-pattern + `useActiveSessionQuery()`; Phase 6 utvidgar med `useSessionsListInfiniteQuery()` + `useDeleteSession(sessionId)` i samma fil
- **`app/lib/queries/sets.ts`** (Phase 5) — `useSetsForSessionQuery(sessionId)` med ordning `exercise_id ASC, set_number ASC`; Phase 6 history-detail bygger card-grouping från denna utan re-sort
- **`app/lib/queries/exercises.ts`** (Phase 4) — `useExercisesQuery()` returnerar anv. egna övningar; Phase 6 history-detail + exercise-chart header resolverar exercise-name via `Map<id, name>`-lookup (Phase 4 Plan 04-04 commit `3bfaba8`-pattern)
- **`app/lib/queries/last-value.ts`** (Phase 5) — 2-step query-pattern (find-source-session → fetch-rows-from-it); F10 chart-query följer samma 2-step-tankebana men aggregeras (date_trunc) istället för set-position-aligned
- **`app/lib/query/persister.ts`** (Phase 4) — `createAsyncStoragePersister({ throttleTime: 500 })`; history-list-cache hydreras gratis vid kall-start (ROADMAP success #4)
- **`app/lib/query/client.ts`** (Phase 4/5) — 13 `setMutationDefaults` redan registrerade (8 Phase 4 + 5 Phase 5); Phase 6 lägger till en 14:e för `['session','delete']` i SAMMA fil; module-load-order-invariant gäller
- **`app/components/offline-banner.tsx`** — synlig på (tabs)/history när NetInfo rapporterar offline; ingen ändring
- **`app/components/active-session-banner.tsx`** (Phase 5) — synlig på (tabs)/history när finished_at IS NULL session finns; ingen ändring
- **Inline-overlay-destructive-confirm-pattern** (Phase 4 commit `e07029a`) — delete-pass-confirm; identisk pattern
- **`useFocusEffect`-state-reset-pattern** (Phase 4 commit `af6930c`) — history-detail-state (delete-overlay)
- **Centraliserad (app) Stack header-styling** (Phase 4 commit `b57d1c2`) — history-detail + exercise-chart routes ärver
- **mutate-not-mutateAsync-konvention** (Phase 4 commit `5d953b6`) — `useDeleteSession.mutate(payload, { onSuccess, onError })`
- **`useColorScheme()`-bound theme-aware backdrop** (Phase 4 D-18, Phase 5 commit `6b8c604`) — Phase 6 chart-färg + axes
- **`useExercisesQuery + Map<id, name>` lookup** (Phase 4 commit `3bfaba8`) — exercise-name-resolution

### Established Patterns
- **`networkMode: 'offlineFirst'`** (Phase 4 D-07) — history-list + chart-queries ärver
- **Hierarkisk queryKey-factor** (Phase 4 D-01) — Phase 6 utvidgar `sessionsKeys` + adderar `exerciseChartKeys`
- **Optimistic onMutate → snapshot → setQueryData → return {previous}** (Phase 4 alla 8 keys + Phase 5 alla 5 nya) — Phase 6 `['session','delete']` följer
- **Path-alias `@/*`** (Phase 1 D-12) — Phase 6 använder `@/lib/queries/...`, `@/lib/query/...`
- **Filnamns-konvention = kebab-case** (Phase 1 D-11) — `exercise-chart.ts`, `history/[sessionId].tsx`, `exercise/[exerciseId]/chart.tsx`
- **Svensk inline-felmeddelanden + AAA-kontrast på siffror** (Phase 3 D-15 + Pitfall 6.4) — Phase 6 chart-värden + axes-labels
- **Module-scope side-effects** (Phase 3 D-09) — Phase 6 utvidgar `lib/query/client.ts` med `['session','delete']`-default vid modul-load

### Integration Points
- **New: `app/app/(app)/history/[sessionId].tsx`** — read-only session-detail
- **New: `app/app/(app)/exercise/[exerciseId]/chart.tsx`** — F10 graf
- **New: `app/lib/queries/exercise-chart.ts`** — `useExerciseChartQuery(exerciseId, metric, window)`
- **Modified: `app/lib/queries/sessions.ts`** — `useSessionsListInfiniteQuery()` + `useDeleteSession(sessionId)`
- **Modified: `app/lib/query/keys.ts`** — `sessionsKeys.listInfinite()` + `exerciseChartKeys.*`
- **Modified: `app/lib/query/client.ts`** — `setMutationDefaults(['session','delete'], ...)`
- **Modified: `app/app/(app)/(tabs)/history.tsx`** — placeholder → real list
- **Modified: `app/app/(app)/plans/[id].tsx`** (Phase 4-route) — chart-ikon per plan_exercise-rad
- **Modified: `app/scripts/test-rls.ts`** — cross-user history + delete-session assertions

</code_context>

<specifics>
## Specific Ideas

- **History list rad-render**: `<Pressable onPress={() => router.push(\`/history/${session.id}\`)}>` runt en `<View>` med tre/fyra spans: datum (left), plan-namn (mid), set-count + total-volym (right, justified). Format-exempel: `14 maj 2026 · Push A · 24 set · 3 240 kg`. Phase 4 plan-list-row som visual-mall.
- **History list aggregat-query**: server-side `select sessions.id, sessions.started_at, sessions.finished_at, sessions.plan_id, plans.name as plan_name, count(sets.id) as set_count, coalesce(sum(sets.weight_kg * sets.reps), 0) as total_volume from workout_sessions sessions left join workout_plans plans on plans.id = sessions.plan_id left join exercise_sets sets on sets.session_id = sessions.id where sessions.finished_at is not null group by sessions.id, plans.name order by sessions.started_at desc limit 20 offset ?` — alternativt `useInfiniteQuery` med cursor på `started_at`. Planner väljer Supabase-PostgREST-syntax (kan vara `select('*, exercise_sets(count), plans:workout_plans(name)')` med inline aggregat — verifiera Supabase JS-syntax). Plan-namn-join utan `archived_at`-filter (D-08).
- **Delete-pass-confirm-overlay**: identisk visual pattern som Phase 4 archive-confirm. Title: "Ta bort detta pass?". Body: "X set och Y kg total volym försvinner permanent. Det går inte att ångra." (visa exakt count från cached data — anv. ska se vad de raderar). Knappar: "Avbryt" (cancel) + "Ta bort" (destructive, red-500). Tap "Ta bort" → `useDeleteSession.mutate({ id: sessionId }, { onSuccess: () => { router.replace('/(tabs)/history'); /* toast */ } })`.
- **F10 chart-query för max-vikt**: `select date_trunc('day', completed_at) as day, max(weight_kg) as value from exercise_sets where exercise_id = $1 and set_type = 'working' and completed_at >= $2 group by day order by day` — `$2` = `now() - interval '3 months'` för default 3M-window. Supabase-PostgREST kan behöva en database function (`rpc`) eftersom date_trunc + group by inte trivialt expressible via filter-only chain. Planner väljer: RPC-funktion `get_exercise_max_weight(exercise_id, since)` eller `get_exercise_volume(exercise_id, since)` är cleanaste; alternativt en `.select()` med Supabase's gränsad GROUP-syntax om den finns för v2.105.
- **F10 chart-query för total-volym**: `select date_trunc('day', completed_at) as day, sum(weight_kg * reps) as value from exercise_sets where exercise_id = $1 and set_type = 'working' and completed_at >= $2 group by day order by day` — samma RPC-pattern.
- **Memoization**: `const chartData = useMemo(() => (query.data ?? []).map((row) => ({ x: new Date(row.day).getTime(), y: row.value })), [query.data])`. Pass `chartData` to `<CartesianChart data={chartData} xKey="x" yKeys={["y"]}>`. STACK.md §Victory Native varnar explicit för re-mount om data-prop inte är memoized.
- **Tooltip via useChartPressState**: Victory Native XL docs ger `const { state, isActive } = useChartPressState({ x: 0, y: { y: 0 } });` + `<CartesianChart chartPressState={state}>` + render-prop som tar `({ points })` och visar `<Line points={points.y}>` + `{isActive && <Tooltip x={state.x.position} y={state.y.y.position} />}`.
- **Segmented-control NativeWind-baserat fallback**: `<View className="flex-row rounded-lg bg-gray-100 dark:bg-gray-800 p-1">` med två/fem `<Pressable className={cn("flex-1 py-2 rounded-md", selected && "bg-white dark:bg-gray-700 shadow")}>`. Standard NativeWind-pattern.
- **Tap-att-routa från history-list**: `router.push({ pathname: '/history/[sessionId]', params: { sessionId: row.id } })` — typed-routes från Expo Router 6.
- **Exercise-name-resolution**: `const exMap = useExercisesQuery().data?.reduce((m, e) => { m.set(e.id, e.name); return m; }, new Map<string, string>())` — Phase 4 commit `3bfaba8`-mall.
- **Duration via date-fns**: `import { differenceInMinutes } from 'date-fns'; const minutes = finished_at && started_at ? differenceInMinutes(new Date(finished_at), new Date(started_at)) : null; const label = minutes != null ? \`${minutes} min\` : '—'`.

</specifics>

<deferred>
## Deferred Ideas

- **Edit-set inline på historiska pass** — V1.1 (samtidigt som F17-UI + F11-RPE öppnar edit-formuläret ändå; bygga edit två gånger är slöseri)
- **Dedikerad "Övningar"-tab (4 tabs i bottom-nav)** — V2 (naturlig samtidig leverans med F20 seed-library)
- **Workout-hot-path chart-ikon (mid-pass tap för att se trend)** — V1.1 om soak visar behov (bryter Phase 5 ≤3s SLA-spirit nu)
- **V1.1 cleanup-cron för accumulating empty sessions** — om soak visar ackumulering
- **Set-typ-badge (warmup/dropset/failure) per set-rad på history-detail** — V1.1 (F17-UI; V1 skriver alltid 'working' så det finns inget att skilja på)
- **Pan + zoom-gester på 'All'-vy i chart** — V1.1 polish (Victory Native XL stöder; mer UX-yta)
- **Reps-metric som ytterligare option i metric-toggle** — V1.1 polish
- **Filter på plan + sök på övning i history-listan** — V1.1 om soak visar behov
- **Long-press context-menu på history-rad ('Kopiera pass', 'Repetera plan-template' etc.)** — V1.1
- **Sektionsgruppering per månad/vecka i history-listan** — V1.1 om listan blir lång efter 4-veckors soak
- **Sparkline mini-graf per övnings-card på history-detail (inline trend-visning)** — V2 polish
- **"Repeat last session"-CTA på hemskärm (F23)** — V2
- **Synlig pending-sync-badge med count (F24)** — V2; V1 trustar TanStack-persister + OfflineBanner
- **Apple Health-integration (F25)** — V2
- **CSV-export per session (F27)** — V2
- **Plan-scoped F7 (F22 — "Förra X-passet"-specifik)** — V2
- **PR-detection vid pass-avslut (F18 — Epley `w * (1 + r/30)`, max-vikt/-volym per övning)** — V1.1
- **Vilo-timer (F19)** — V1.1 (research-flag på `expo-notifications` + `expo-keep-awake`)
- **Skeleton-loader för chart + history-detail** — V1.1 polish om text-loading visar sig sköpligt
- **Visa F11 RPE-värde per set-rad om non-null** — Phase 7 V1 Kan (när F11 UI landar; schema redo)
- **Visa F12 notes-fält per session om non-null** — Phase 7 V1 Kan (när F12 UI landar; schema redo)
- **F15 manuell dark-mode-toggle UI** — Phase 7

### Reviewed Todos (not folded)
None — STATE.md "Pending Todos" är tom; `gsd-sdk query todo.match-phase 6` returnerade 0 matches.

</deferred>

---

*Phase: 6-history-read-side-polish*
*Context gathered: 2026-05-15*
