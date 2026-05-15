# Phase 6: History & Read-Side Polish - Research

**Researched:** 2026-05-15
**Domain:** Cursor-paginated history + per-exercise progression chart (read-side polish), built on already-installed Victory Native XL + TanStack v5 stack
**Confidence:** HIGH (all libraries Context7-verified; CONTEXT.md and ARCHITECTURE.md have locked the load-bearing decisions; the only MEDIUM area is the choice between server-side aggregate via RPC vs PostgREST aggregate-functions endpoint, which is itself a documented planner-discretion item)

## Summary

Phase 6 is the first pure read-side phase of V1. The entire write-side (Phase 5) is shipped; the offline-first primitives (Phase 4) cache and hydrate without any new infra; the database schema and RLS policies (Phase 2) already cover everything the new queries touch. **No new libraries are needed** — `victory-native@^41.20.2`, `@shopify/react-native-skia@2.2.12`, `@tanstack/react-query@^5.100.9`, `date-fns@^4.1.0`, and `@expo/vector-icons@^15.0.3` are all installed and version-verified against `app/package.json` 2026-05-15.

The phase delivers three surfaces (F9 history-list + read-only session-detail + F10 chart) plus an entry-point modification (chart-icon on plan-detail rows) and one new reusable component (`SegmentedControl`). The only true new pattern is **`useInfiniteQuery` cursor-pagination** — every other pattern (offline-first queries, optimistic mutations, inline-overlay-confirm, centralised Stack header-styling, `useExercisesQuery + Map<id,name>` lookup, `useColorScheme()`-bound theme) is inherited verbatim from Phases 4 + 5.

**Primary recommendation:** Build the F9 list-aggregate query as a **Postgres RPC function** (`get_session_summaries(cursor, page_size)`) and the F10 chart query as a **Postgres RPC function** (`get_exercise_chart(exercise_id, metric, since)`). Reasons: (1) PostgREST aggregate functions are **disabled by default in Supabase** and enabling them requires `ALTER ROLE authenticator SET pgrst.db_aggregates_enabled = 'true'` — a project-wide toggle that affects security posture; (2) the F10 query needs `date_trunc('day', ...)` which is **not expressible** through PostgREST's `select=` syntax even when aggregate functions are enabled; (3) RPC functions have `SECURITY INVOKER` (default) so RLS still applies; (4) RPC functions are versionable migrations that fit the migration-as-truth convention; (5) the alternative — over-fetch + client-side reduce — is fast enough for V1 (single user, ~150 pass/year) but breaks the explicit ARCHITECTURE.md §5 contract that says these queries are server-side aggregate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cursor-paginated history list (F9) | API / Backend (RPC + RLS) | TanStack v5 cache (Browser/Client) | Aggregation must happen server-side per ARCHITECTURE §5 + Pitfall "Loading entire history for graph" — over-fetching the full session+sets join into the client to count + sum is the explicit anti-pattern. RLS at DB layer scopes per user (T-06-01). |
| Read-only session-detail render | Browser/Client (RN) | API (existing queries) | `useSessionQuery` + `useSetsForSessionQuery` from Phase 5 are already RLS-scoped; only the JSX is new. No new server tier. |
| Delete session (cascade) | API / Backend (FK on delete cascade) | TanStack v5 mutation (`['session','delete']`) | FK cascade owns the multi-table consistency (sets vanish atomically); the client just `DELETE workout_sessions WHERE id=$1` — no client-side fan-out delete. |
| Per-exercise progression chart (F10) | API / Backend (RPC + RLS) | TanStack v5 cache + Victory Native XL render (Browser/Client) | Same as F9 — `date_trunc('day', completed_at)` + `max(weight_kg)` / `sum(weight_kg * reps)` is a server-side aggregate. Client memoizes the result array and feeds it to `<CartesianChart>`. RLS scopes per user. |
| Chart line + tooltip rendering | Browser/Client (Skia via Victory Native XL) | — | Pure render-tier; Skia owns the GPU pipeline; Reanimated drives press-state animations. |
| Cross-link affordances (history → chart, plan-edit → chart) | Browser/Client (Expo Router) | — | Router-level concern; no server involvement. |
| Offline cache hydration | Browser/Client (TanStack persister + AsyncStorage) | — | Inherited from Phase 4 D-01 — `usePersistedQueryClient` already hydrates `sessionsKeys.listInfinite()` automatically when the cache exists. |
| Cross-user data scoping (RLS) | Database / Storage | — | All 5 user-scoped tables already have `(select auth.uid())`-wrapped policies with `using` AND `with check`. New RPC functions inherit RLS via `SECURITY INVOKER`. |

**Tier-sanity sanity-check:** No client-side aggregation, no client-side joining-across-user-boundaries, no business logic moving from API → Client. The chart UI is render-only over a pre-aggregated server response. This matches the Phase 5 hot-path tier model (mutations in API; cache in Client; UI in Client).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| F9 | Användare kan lista historiska pass — cursor-paginerad lista, sorterad på `started_at desc` | §F9 Query Shape (RPC `get_session_summaries`), §`useInfiniteQuery` v5 Pattern, §Offline Cache Hydration (inherited from Phase 4 persister), §`useDeleteSession` mutation + FK on delete cascade |
| F10 | Graf per övning över tid (max vikt, total volym) | §F10 Query Shape (RPC `get_exercise_chart`), §Victory Native XL `<CartesianChart>` integration, §Memoization contract, §`useChartPressState` tooltip, §Segmented-control for metric + window toggle, §Graceful degrade (0/1/2+ points) |

Both requirements depend on the same 6 inherited tables (no schema changes), the same offline-first plumbing (no new mutation keys beyond `['session','delete']`), the same RLS scoping (no new policies), and the same theme-aware styling convention (no new color or typography tokens beyond what UI-SPEC already locks). The phase is therefore **additive** — every new query, route, and component sits on existing primitives.
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**F9 — Historik-lista (`(tabs)/history.tsx`)**

- **D-01:** Rad-shape = `Datum · Plan-namn · Set-count · Total-volym`. Aggregeringar (`set-count`, `sum(weight_kg * reps)`) via LIST-query. Planner väljer query-shape (Pitfall: "Loading entire history for graph" — aggregate at DB är skoningslöshetens väg).
- **D-02:** Flat scroll, ingen sektions-gruppering.
- **D-03:** Pagination via TanStack v5 `useInfiniteQuery` med cursor på `started_at` (DESC). Page-size = 20. `onEndReached` threshold 0.5. Pull-to-refresh top.
- **D-04:** Inget filter, ingen sök i V1.

**Session-detail-skärm (`/history/[sessionId]`)**

- **D-05:** Ny route `app/app/(app)/history/[sessionId].tsx`. INTE återanvänd `/workout/[sessionId]`.
- **D-06:** Layout = card-per-övning med alla set inline (read-only).
- **D-07:** Mutationer = read-only set + radera hela passet. Inline-overlay-confirm (Phase 4 commit `e07029a`). Hard-delete via FK `on delete cascade`. Edit-set deferreras till V1.1.
- **D-08:** Arkiverad eller raderad plan-rendering: visa plan-namnet ändå (utan `archived_at IS NULL`-filter).
- **D-09:** Summary-header `[set-count] · [total-volym] · [duration]`.
- **D-10:** Duration via `date-fns differenceInMinutes(finished_at, started_at)`. `finished_at IS NULL` → `'—'`.
- **D-11:** Tap på card-header routar till `/exercise/<exerciseId>/chart`.
- **D-12:** Loading-state = `'Laddar…'` (Phase 4/5-konvention).
- **D-13:** Tomma pass visas med `0 set · 0 kg · X min`; raderas via delete-pass-knappen. Avviker medvetet från Strong/Hevy auto-discard.

**F10 — Per-övning graf (`/exercise/[exerciseId]/chart`)**

- **D-14:** Metric segmented control 'Max vikt' / 'Total volym' ovanför grafen.
- **D-15:** Tids-fönster segmented control `1M / 3M / 6M / 1Y / All`, default `3M`.
- **D-16:** Line chart via `victory-native` `<CartesianChart>` + `<Line>` + visible points.
- **D-17:** Graceful degradation: 0 punkter → empty-state, 1 punkt → singel-prick + caption, 2+ → full chart.
- **D-18:** Date-bucketing per dag via `date_trunc('day', completed_at)` per ARCHITECTURE.md §5.
- **D-19:** Tap-att-se-tooltip via `useChartPressState`.
- **D-20:** "Senaste 10 passen för övningen"-lista under grafen.
- **D-21:** Memoization-kontrakt: `useMemo` över query-resultet (STACK.md §Victory Native XL "pass memoized arrays").
- **D-22:** Y-axel auto-scale; X-axel `'MMM d'` format max 5 ticks.
- **D-23:** Color via `useColorScheme()`. Light blue-600 (`#2563eb`); dark blue-400 (`#60a5fa`).

**F10 — Entry-points + routing**

- **D-24:** Chart-ikon per `plan_exercise`-rad på `/plans/[id].tsx`. Hit-target ≥44pt.
- **D-25:** Tap på card-header på `/history/[sessionId]`.
- **D-26:** Route `/exercise/[exerciseId]/chart`.
- **D-27:** Header visar övningsnamn via `useExercisesQuery + Map<id, name>`-lookup.
- **D-28:** Workout-hot-path chart-ikon DEFERRERAS HELT.

### Claude's Discretion

- **Exakt query-shape för F9 list-aggregat** — Postgres-side `group by` + Supabase join-syntax vs klient-side reduce vs separat aggregate-RPC. Planner väljer.
- **Exakt query-shape för F10 chart-data** — server-side `group by date_trunc('day', completed_at)` vs klient-side groupBy. Planner väljer; ARCHITECTURE.md §5 prefererar server-side.
- **Segmented-control-komponent** — `@react-native-segmented-control/segmented-control` (Expo-blessed) vs NativeWind-baserat fallback. UI-SPEC valde NativeWind-baserat fallback som primary path (no install needed); native control är acceptabelt alternativ.
- **Chart-ikon-glyph** — `stats-chart` vs `trending-up` vs `analytics` vs `bar-chart-outline`. UI-SPEC valde `stats-chart`.
- **Tooltip-styling** — Victory Native XL ger primitives; UI-SPEC valde Skia `<RoundedRect>` + två `<Text>` rader.
- **Empty-state-illustration** — UI-SPEC valde ikon + text (Ionicons faded gray + body-text).
- **Delete-pass affordance** — UI-SPEC valde "..."-meny för att undvika mistap.
- **`useMemo`-dependency-array** — `[query.data]` räcker; planner verifierar om `[query.data, metric, window]` behövs.
- **Toast-implementation** — UI-SPEC återanvänder Phase 5 toast-pattern.
- **`useFocusEffect`-state-reset** — Phase 4 commit `af6930c`-pattern.
- **Pagination-edge-case** — `getNextPageParam: (lastPage) => lastPage.length === 20 ? lastPage[lastPage.length-1].started_at : undefined`; planner verifierar exact semantics.

### Deferred Ideas (OUT OF SCOPE)

- **Edit-set inline på historiska pass** — V1.1
- **Dedikerad "Övningar"-tab** — V2
- **Workout-hot-path chart-ikon** — V1.1
- **V1.1 cleanup-cron för accumulating empty sessions** — om soak visar
- **Set-typ-badge (warmup/dropset/failure) per set-rad** — V1.1 (F17-UI)
- **Pan + zoom-gester på 'All'-vy** — V1.1 polish
- **Reps-metric som ytterligare option** — V1.1 polish
- **Filter på plan + sök på övning** — V1.1
- **Long-press context-menu** — V1.1
- **Sektionsgruppering per månad/vecka** — V1.1
- **Sparkline mini-graf** — V2 polish
- **"Repeat last session"-CTA (F23)** — V2
- **Synlig pending-sync-badge (F24)** — V2
- **Apple Health-integration (F25)** — V2
- **CSV-export (F27)** — V2
- **Plan-scoped F7 (F22)** — V2
- **PR-detection vid pass-avslut (F18)** — V1.1
- **Vilo-timer (F19)** — V1.1
- **Skeleton-loader** — V1.1 polish
- **Visa F11 RPE-värde per set-rad** — Phase 7
- **Visa F12 notes-fält per session** — Phase 7
- **F15 manuell dark-mode-toggle UI** — Phase 7
- **Accessible chart data-table for VoiceOver** — V1.1 a11y polish
- **Reduced-motion handling for chart-line animation** — V1.1 a11y polish
- **Dynamic Type scaling** — V1.1 polish
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Stack låst i ARCHITECTURE.md** — Expo + Supabase + TypeScript; får inte bytas.
- **Plattform** iOS-only V1.
- **Performance** ≤3s per set från knapptryck till lokalt sparat (Phase 5-domän; Phase 6 är read-side och har ingen ≤3s SLA).
- **Data integrity** Får ALDRIG förlora ett set (Phase 5 garant; Phase 6 påverkar inte write-pathen).
- **Säkerhet:**
  - RLS obligatoriskt på alla tabeller — Phase 6 introducerar inga nya tabeller; nya RPC-funktioner ärver via `SECURITY INVOKER`.
  - Service-role-key används ALDRIG i klient; secrets aldrig hårdkodade. Phase 6-audit gate: `git grep "service_role|SERVICE_ROLE"` matchar endast `app/scripts/test-rls.ts`, `app/.env.example`, `.planning/`, och `CLAUDE.md`.
- **Sessions** `expo-secure-store` for auth-tokens — Phase 6 inherits, no change.
- **Validering** Zod 4 for all extern data (Supabase responses inkl. nya RPC-responses).
- **Budget** Gratis Supabase free tier; inga nya servertjänster.
- **Database conventions:**
  - **Migration-as-truth** — nya RPC-funktioner shippar som numrerad SQL-fil i `app/supabase/migrations/`. Studio is read-only.
  - **RLS pairs with policies** — Phase 6 inga nya tables, ingen ny RLS yta.
  - **`(select auth.uid())` wrapping** — RPC-funktioner som referar `auth.uid()` MÅSTE wrappa.
  - **Drift verification** — `npx tsx --env-file=.env.local scripts/verify-deploy.ts` efter migration.
  - **Cross-user verification is a gate** — `test-rls.ts` MÅSTE utvidgas med assertions för history-list + delete-session + chart-query.
  - **Service-role isolation** — audit gate ovan.
- **Security checklist Phase 6 (CLAUDE.md ## Security conventions → Read-side / charts):**
  - **API3** no aggregation across users — RLS på `workout_sessions` + `exercise_sets` scopar; `test-rls.ts` utvidgas.
  - **V12** file uploads N/A.
  - **Threat IDs T-06-*** — Plan 01 etablerar STRIDE-register.
- **Branching** ALDRIG till `dev`/`main`. Phase-branch `gsd/phase-06-history-read-side-polish` (redan checked out).
- **Linear** Inkludera `[FIT-XX]` i commit-meddelanden om bugfix-issues finns.

## Standard Stack

### Core (all already installed — verified `app/package.json` 2026-05-15)

| Library | Version (installed) | Latest npm (May 2026) | Purpose | Why Standard |
|---------|---------------------|------------------------|---------|--------------|
| `victory-native` | `^41.20.2` | `41.20.3` | F10 `<CartesianChart>` + `<Line>` + `<Scatter>` + `useChartPressState` | Locked in CLAUDE.md `### Charting`; gives line-chart + axes + gestures + animated paths out of the box — ~30 lines of TSX vs ~2-3 days with raw Skia [VERIFIED: STACK.md §Charting decision] |
| `@shopify/react-native-skia` | `2.2.12` | `2.6.2` | Skia primitives (`<Circle>`, `<RoundedRect>`, `useFont`) inside chart-press callout | Required peer dep of Victory Native XL; iOS 14+/Android 21+ minimum. Note: latest npm is 2.6.2 but `2.2.12` is what `npx expo install --check` pinned for SDK 54 (verified 2026-05-13 in CLAUDE.md) [VERIFIED: app/package.json + CLAUDE.md] |
| `@tanstack/react-query` | `^5.100.9` | `5.100.10` | `useQuery` (existing), `useInfiniteQuery` (new for F9), `useMutation` (new for delete-session) | v5 object-arg API; `useInfiniteQuery` declares `react: "^18 \|\| ^19"` peer; cursor-pagination via `getNextPageParam` [VERIFIED: Context7 `/tanstack/query/v5.90.3` `useInfiniteQuery`] |
| `@tanstack/query-async-storage-persister` | `^5.100.9` | match | Persists infinite-query cache to AsyncStorage for offline hydration (F9 ROADMAP success #4) | Inherited from Phase 4 D-01; no Phase 6 wiring needed — `usePersistedQueryClient` already hydrates `sessionsKeys.listInfinite()` automatically [VERIFIED: app/lib/query/persister.ts] |
| `date-fns` | `^4.1.0` | `4.1.0` | `format`, `differenceInMinutes`, `subMonths`, `subYears`, Swedish `sv` locale | Pure JS, tree-shakeable, no React coupling. v4 has tighter ESM. [VERIFIED: app/package.json] |
| `@expo/vector-icons` | `^15.0.3` | match | Ionicons (`stats-chart`, `stats-chart-outline`, `time-outline`, `ellipsis-horizontal`) | Inherited from Phase 4 D-18; no Phase 6 install. |
| `@supabase/supabase-js` | `^2.105.4` | `^2.105.x` | `supabase.rpc('get_session_summaries', ...)`, `supabase.from('workout_sessions').delete()...` | Typed client (`createClient<Database>`); RPC functions are reachable via `.rpc(name, args)` which respects RLS at function-invoker level [VERIFIED: app/lib/supabase.ts + Database type] |
| `react-native` | `0.81.5` | match | `FlatList`, `RefreshControl`, `ActivityIndicator`, `useColorScheme` | Inherited from SDK 54; `FlatList` is the standard infinite-scroll primitive. |
| `expo-router` | `~6.0.23` | match | File-based routing; `Stack.Screen options`; typed-routes | New routes `history/[sessionId].tsx` + `exercise/[exerciseId]/chart.tsx` are file-based; `Stack.Protected` guard inherited from Phase 3. |

### Supporting (no install needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native-reanimated` | `~4.1.1` | Shared-value-driven tooltip position; toast `FadeIn`/`FadeOut.delay(2000)` | Used implicitly by Victory Native XL (`state.x.position` is a Reanimated `SharedValue<number>`); Phase 5 toast pattern inherited [VERIFIED: app/package.json + Context7 victory-native-xl docs] |
| `react-native-gesture-handler` | `~2.28.0` | Pan gesture on chart canvas surface | Used implicitly by Victory Native XL `useChartPressState` — RNGH handles the underlying gesture detection. No app-level wiring needed. |
| `expo-haptics` | `~15.0.8` | Optional: light tap feedback on chart-press activation | Inherited from Phase 5; Phase 6 doesn't add new haptic calls (UI-SPEC didn't spec them). |
| `react-native-safe-area-context` | `~5.6.0` | `SafeAreaView` on history-list, session-detail, chart routes | Inherited from Phase 1. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side aggregate RPC (recommended) | Client-side reduce over over-fetched join | Simpler code path (no RPC migration); but breaks ARCHITECTURE.md §5 explicit contract; bumps client payload size with every history entry; per-set re-fetch grows linearly with history; not future-proof when V2 multi-device sync lands. **RECOMMENDED: RPC.** |
| Server-side aggregate RPC | PostgREST aggregate functions endpoint | PostgREST aggregates are **disabled by default in Supabase** and enabling them requires `ALTER ROLE authenticator SET pgrst.db_aggregates_enabled = 'true'` which is a project-wide toggle affecting security posture (any future endpoint can aggregate without limit) [VERIFIED: Supabase blog "PostgREST Aggregate Functions"]. RPC is scoped per-function and stays opt-in. **RECOMMENDED: RPC.** |
| Postgres RPC for F10 chart | Database VIEW | View is queryable by `.from()` instead of `.rpc()`, but date-window filter (`completed_at >= now() - interval '3 months'`) needs to be a parameter, not part of view definition — RPC handles parameters; view would need post-filter via `.gte('day', ...)` which forces the view to expose row-level pre-aggregation = no win vs RPC. **RECOMMENDED: RPC.** |
| NativeWind-baserat segmented-control (UI-SPEC primary) | `@react-native-segmented-control/segmented-control` (Expo-blessed) | Native control respects iOS Dynamic Type + auto dark-mode but visual identity differs from NativeWind palette; +1 native dep adds EAS-build complexity later. **UI-SPEC chose NativeWind primary; native acceptable.** [VERIFIED: WebSearch Expo SDK 54 + npm view = 2.5.7] |
| `useInfiniteQuery` with cursor | `useInfiniteQuery` with offset (`page = pageParam`) | Offset-based pagination drifts with concurrent writes (new sessions inserted while scrolling shift offsets — duplicate rows or missed rows). Cursor on `started_at desc` is monotonic and write-safe. **RECOMMENDED: cursor.** [VERIFIED: Context7 `/tanstack/query/v5.90.3`] |
| Victory Native XL `<CartesianChart>` | Raw `@shopify/react-native-skia` primitives + d3-scale | XL is built on Skia; gives axes + line + gestures + animations out of box. Raw Skia is 2-3 days of hand-rolling. **RECOMMENDED: XL.** [VERIFIED: STACK.md §Charting decision] |

**Installation:** None. All required packages installed.

**Version verification (executed 2026-05-15):**
```bash
npm view victory-native version          # 41.20.3 (we have ^41.20.2 — semver-compatible)
npm view @tanstack/react-query version   # 5.100.10 (we have ^5.100.9 — semver-compatible)
npm view @shopify/react-native-skia version  # 2.6.2 (we have 2.2.12 pinned to SDK 54)
npm view date-fns version                # 4.1.0 (matches installed)
npm view @react-native-segmented-control/segmented-control version  # 2.5.7 (not installed)
```

## Architecture Patterns

### System Architecture Diagram

```
                  ┌──────────────────────────────────────────────────┐
                  │             iPhone (Expo Go / EAS)               │
                  ├──────────────────────────────────────────────────┤
   User           │                                                  │
   tap ─────────► │  (tabs)/history.tsx       (new — replaces        │
                  │   ─ FlatList               placeholder)          │
                  │   ─ useInfiniteQuery       (Phase 4 cache        │
                  │   ─ pull-to-refresh         hydration is gratis) │
                  │             │                                    │
                  │             │ router.push('/history/<id>')       │
                  │             ▼                                    │
                  │   history/[sessionId].tsx (new)                  │
                  │   ─ summary-header        ─ delete-pass-confirm  │
                  │   ─ ExerciseCard ×N        (inline-overlay-      │
                  │   ─ tap → chart            confirm — Phase 4)    │
                  │             │                                    │
                  │             │ router.push('/exercise/<id>/chart')│
                  │             ▼                                    │
                  │   exercise/[exerciseId]/chart.tsx (new)          │
                  │   ─ MetricToggle (SegmentedControl — new comp)   │
                  │   ─ WindowToggle (SegmentedControl)              │
                  │   ─ <CartesianChart> via Victory Native XL       │
                  │   ─ useChartPressState → Skia tooltip            │
                  │   ─ "Senaste 10 passen" list (taps back to       │
                  │      history/<id>)                               │
                  │                                                  │
                  │   plans/[id].tsx (MODIFIED) ─── chart-icon       │
                  │     row affordance per plan_exercise — links    │
                  │     to /exercise/<id>/chart                     │
                  │                                                  │
                  │     ┌──────────────────────────────────────┐     │
                  │     │ TanStack v5 Query/Mutation Layer     │     │
                  │     │   useInfiniteQuery → sessionsKeys.   │     │
                  │     │     listInfinite()                   │     │
                  │     │   useExerciseChartQuery → exerciseChartKeys │
                  │     │     .byExercise(id, metric, window)  │     │
                  │     │   useDeleteSession → ['session','delete'] │     │
                  │     │     setMutationDefaults in client.ts │     │
                  │     │   Existing queries reused:           │     │
                  │     │     useSessionQuery, useSetsFor-     │     │
                  │     │     SessionQuery, useExercisesQuery  │     │
                  │     └──────────────────┬───────────────────┘     │
                  │                        │                          │
                  │                        ▼                          │
                  │     ┌──────────────────────────────────────┐     │
                  │     │ TanStack Persister → AsyncStorage    │     │
                  │     │  (Phase 4 — cache hydration gratis;  │     │
                  │     │   no Phase 6 wiring needed)          │     │
                  │     └──────────────────┬───────────────────┘     │
                  └────────────────────────┼─────────────────────────┘
                                           │ HTTPS (when online)
                                           ▼
                  ┌──────────────────────────────────────────────────┐
                  │                Supabase / Postgres               │
                  ├──────────────────────────────────────────────────┤
                  │                                                  │
                  │   New RPC: get_session_summaries(cursor,         │
                  │       page_size)                                 │
                  │     ─ SECURITY INVOKER (RLS scoped)              │
                  │     ─ returns sessions with set_count +          │
                  │       total_volume aggregated per session        │
                  │                                                  │
                  │   New RPC: get_exercise_chart(exercise_id,       │
                  │       metric, since)                             │
                  │     ─ SECURITY INVOKER (RLS scoped)              │
                  │     ─ date_trunc('day', completed_at)            │
                  │     ─ max(weight_kg) for metric='weight'         │
                  │     ─ sum(weight_kg * reps) for metric='volume'  │
                  │     ─ where set_type = 'working'                 │
                  │                                                  │
                  │   Direct table reads (existing RLS):             │
                  │     workout_sessions.SELECT ─ Phase 5            │
                  │     exercise_sets.SELECT ─ Phase 5               │
                  │     workout_sessions.DELETE ─ Phase 6 new path   │
                  │       (FK on delete cascade purges sets)         │
                  │                                                  │
                  └──────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
app/
├── app/
│   └── (app)/
│       ├── (tabs)/
│       │   └── history.tsx              # MODIFIED — placeholder → real cursor-paginated list
│       ├── history/                     # NEW route folder
│       │   └── [sessionId].tsx          # NEW — read-only session-detail
│       ├── exercise/                    # NEW route folder
│       │   └── [exerciseId]/
│       │       └── chart.tsx            # NEW — F10 graf
│       └── plans/
│           └── [id].tsx                 # MODIFIED — chart-icon per plan_exercise row
├── components/
│   └── segmented-control.tsx            # NEW — reusable NativeWind segmented control
│                                        #   (optional: empty-state.tsx if extracted)
├── lib/
│   ├── queries/
│   │   ├── sessions.ts                  # MODIFIED — add useSessionsListInfiniteQuery +
│   │   │                                #            useDeleteSession
│   │   └── exercise-chart.ts            # NEW — useExerciseChartQuery
│   ├── query/
│   │   ├── client.ts                    # MODIFIED — add ['session','delete'] mutationDefault
│   │   └── keys.ts                      # MODIFIED — add sessionsKeys.listInfinite() +
│   │                                    #            exerciseChartKeys.byExercise(...)
│   └── schemas/
│       └── exercise-chart.ts            # NEW (optional) — Zod schema for RPC response
└── supabase/
    └── migrations/
        └── 0006_phase6_chart_rpcs.sql   # NEW — get_session_summaries + get_exercise_chart RPC
                                          #   (also adds idx_exercise_sets_exercise if missing —
                                          #    verify against existing schema)
```

**File-count delta:** 3 new route files + 2 new lib files + 1 new component + 1 new migration + 1 new schema (optional) + 4 modified files = **~12 files touched**.

### Pattern 1: `useInfiniteQuery` v5 Cursor Pagination

**What:** TanStack v5 `useInfiniteQuery` with `pageParam` carrying the cursor; `getNextPageParam` reads the last row's `started_at` from the response.

**When to use:** F9 history-list — `started_at desc`, page-size = 20, threshold 0.5.

**Example (verified against Context7 `/tanstack/query/v5.90.3`):**
```typescript
// Source: Context7 /tanstack/query/v5.90.3 docs/framework/react/guides/infinite-queries.md
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { sessionsKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/lib/auth-store";

const PAGE_SIZE = 20;

export type SessionSummary = {
  id: string;
  user_id: string;
  plan_id: string | null;
  started_at: string;
  finished_at: string | null;
  plan_name: string | null;          // joined; nullable when plan_id IS NULL
  set_count: number;
  total_volume_kg: number;
};

export function useSessionsListInfiniteQuery() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useInfiniteQuery({
    queryKey: sessionsKeys.listInfinite(),
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      // Call the RPC function. cursor=null on first page → server returns most-recent N.
      const { data, error } = await supabase.rpc("get_session_summaries", {
        p_cursor: pageParam,        // ISO timestamp or null
        p_page_size: PAGE_SIZE,
      });
      if (error) throw error;
      // Zod-parse the response array before handing to React (Pitfall 8.13).
      return (data ?? []).map((row: unknown) => SessionSummarySchema.parse(row));
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: SessionSummary[]): string | null | undefined => {
      // When lastPage has fewer rows than PAGE_SIZE, we've reached the end.
      // Return undefined to signal hasNextPage = false.
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      // Otherwise return the OLDEST started_at as the cursor for the next page.
      // (DESC order means the LAST row in the array is the oldest.)
      return lastPage[lastPage.length - 1]?.started_at ?? undefined;
    },
    enabled: !!userId,
    // Inherit networkMode: 'offlineFirst' from QueryClient defaults (Phase 4 D-07).
  });
}
```

**Component usage:**
```typescript
// In (tabs)/history.tsx
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isRefetching,
  refetch,
  status,
} = useSessionsListInfiniteQuery();

// Flatten pages for FlatList. useMemo because `data.pages` may be referentially
// stable between renders even when no fetch has happened.
const sessions = useMemo(
  () => data?.pages.flat() ?? [],
  [data?.pages],
);

return (
  <FlatList
    data={sessions}
    keyExtractor={(s) => s.id}
    renderItem={({ item }) => <HistoryListRow session={item} />}
    onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
    onEndReachedThreshold={0.5}     // CONTEXT.md D-03
    ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
    refreshControl={
      <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
    }
    ListEmptyComponent={status === "pending" ? null : <HistoryEmptyState />}
  />
);
```

### Pattern 2: Victory Native XL `<CartesianChart>` + `useChartPressState`

**What:** Victory Native XL exposes `<CartesianChart>` (the canvas) + `<Line>` (path render-prop child) + `<Scatter>` (point overlay) + `useChartPressState` (Reanimated shared-values for tooltip positioning).

**When to use:** F10 progression chart on `/exercise/[exerciseId]/chart`.

**Example (verified against Context7 `/formidablelabs/victory-native-xl`):**
```typescript
// Source: Context7 /formidablelabs/victory-native-xl getting-started.mdx
import { CartesianChart, Line, Scatter, useChartPressState } from "victory-native";
import { Circle, useFont } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";
import { useColorScheme, View } from "react-native";
import { useMemo } from "react";

function MyExerciseChart({ chartData }: { chartData: ReadonlyArray<{ x: number; y: number }> }) {
  // useFont(null, size) → falls back to system font; Victory Native XL won't render
  // axis labels if font is null/loading, so this returns a font object synchronously.
  const font = useFont(null, 12);
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const lineColor = isDark ? "#60A5FA" : "#2563EB";
  const axisColor = isDark ? "#9CA3AF" : "#6B7280";
  const gridColor = isDark ? "#374151" : "#E5E7EB";

  // useChartPressState initial state: provide ONE entry per yKey.
  // Our yKeys=['y'] so init is { x: 0, y: { y: 0 } } — the inner 'y' key is the
  // metric column name we use everywhere.
  const { state, isActive } = useChartPressState({ x: 0, y: { y: 0 } });

  return (
    <View style={{ height: 240 }}>
      <CartesianChart
        data={chartData}                  // MEMOIZED — D-21 contract
        xKey="x"                          // UNIX ms timestamp
        yKeys={["y"]}                     // metric value
        chartPressState={state}
        domainPadding={{ left: 16, right: 16, top: 16, bottom: 16 }}
        axisOptions={{
          font,
          tickCount: 5,
          labelColor: axisColor,
          lineColor: gridColor,
          formatXLabel: (ms: number) => format(new Date(ms), "MMM d", { locale: sv }),
          formatYLabel: (n: number) => `${n}`,        // override per metric in real code
        }}
      >
        {({ points }) => (
          <>
            <Line
              points={points.y}
              color={lineColor}
              strokeWidth={2}
              curveType="natural"
            />
            <Scatter
              points={points.y}
              radius={4}
              color={lineColor}
            />
            {isActive && (
              <Circle
                cx={state.x.position}
                cy={state.y.y.position}
                r={6}
                color={lineColor}
              />
            )}
          </>
        )}
      </CartesianChart>
    </View>
  );
}
```

**Memoization contract (D-21 + STACK.md §Victory Native XL):**
```typescript
const chartData = useMemo(
  () => (query.data ?? []).map((row) => ({
    x: new Date(row.day).getTime(),
    y: row.value,
  })),
  [query.data],     // [query.data] is sufficient — query.data is referentially stable in v5
                    // until a refetch happens. metric + window are already in queryKey so
                    // a toggle change produces a new query.data → new array.
);
```

**Tooltip (Skia render-prop child):** UI-SPEC defines a `<RoundedRect>` + two Skia `<Text>` lines. The tooltip element receives `pressState.x.position` + `pressState.y.y.position` (both Reanimated `SharedValue<number>`). To extract the underlying VALUE for display (the actual weight/volume number, not the on-canvas pixel coordinate), use `pressState.x.value` + `pressState.y.y.value` — also shared values, but their `.value` is read inside a `useDerivedValue` block or via `useAnimatedReaction`. Simplest pattern for the value-line text: `Skia <Text>` with `text={useDerivedValue(() => formatLabel(state.y.y.value.value))}`.

### Pattern 3: F9 List-Aggregate via Postgres RPC

**What:** A Postgres function that returns the cursor-paginated session list with `set_count` + `total_volume_kg` already aggregated server-side. Plan-name joined for D-01 display.

**When to use:** F9 — single source of the joined+aggregated data; called from `useSessionsListInfiniteQuery`.

**Migration shape (Plan-discretion to refine, but this is the canonical form):**
```sql
-- File: app/supabase/migrations/0006_phase6_chart_rpcs.sql (NEW)

-- F9 — get_session_summaries(cursor, page_size)
-- Returns the next page of finished workout_sessions for the calling user,
-- with set_count + total_volume_kg aggregated and plan-name joined.
--
-- SECURITY INVOKER (default) → RLS on workout_sessions + exercise_sets applies
-- automatically. Cursor is the started_at of the LAST row of the previous page
-- (or NULL for the first page).
create or replace function public.get_session_summaries(
  p_cursor timestamptz,
  p_page_size int default 20
)
returns table (
  id uuid,
  user_id uuid,
  plan_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  plan_name text,
  set_count bigint,
  total_volume_kg numeric
)
language sql
security invoker             -- RLS-scoped to the calling user
stable                       -- pure read; can be cached
set search_path = ''         -- search-path injection defense (Pitfall 7 pattern)
as $$
  select
    s.id,
    s.user_id,
    s.plan_id,
    s.started_at,
    s.finished_at,
    p.name as plan_name,                                            -- NULL if plan deleted
    coalesce(count(es.id), 0)::bigint as set_count,
    coalesce(sum(es.weight_kg * es.reps), 0) as total_volume_kg
  from public.workout_sessions s
  left join public.workout_plans p on p.id = s.plan_id              -- D-08 — no archived_at filter
  left join public.exercise_sets es on es.session_id = s.id
                                    and es.set_type = 'working'     -- D-13 exception: empty
                                                                    -- sessions still surface
                                                                    -- with 0 set / 0 kg
  where s.finished_at is not null                                   -- D-10 (history excludes
                                                                    -- abandoned drafts)
    and (p_cursor is null or s.started_at < p_cursor)              -- DESC cursor
  group by s.id, p.name
  order by s.started_at desc
  limit p_page_size;
$$;

-- Lock down EXECUTE: only authenticated users can call.
revoke all on function public.get_session_summaries(timestamptz, int) from public;
grant execute on function public.get_session_summaries(timestamptz, int) to authenticated;
```

**Why `set_type = 'working'` filter in the SUM but NOT in the COUNT JOIN condition:** Actually, per CONTEXT.md D-13 + the "0 set · 0 kg" empty-session display, the count should match what the user sees in the session-detail. UI-SPEC's `${set_count} set` and the delete-confirm body show the same count, so it should reflect ALL sets (working + warmup + dropset + failure) when V1.1 starts tagging them, OR working-only for V1 consistency where all sets are 'working'. **Phase 6 V1 decision (planner-resolve):** since V1 writes always set `set_type = 'working'`, both filters are identical; the safer choice is to **filter on `set_type = 'working'` in BOTH count and sum** so V1.1 doesn't surprise the user by suddenly including warmup sets in the history-row count. Document the decision in the migration comment.

[ASSUMED — planner should confirm with user during execution] Filtering `set_type = 'working'` on the F9 count is consistent with F7 + F10 working-set-canonical convention (ARCHITECTURE.md §5). Risk if wrong: V1.1 set-typ-UI rollout shows warmup sets in history-row count which the user didn't see before.

### Pattern 4: F10 Chart-Data via Postgres RPC

**What:** A Postgres function that returns per-day-aggregated working-set data for a given exercise + metric + time-window.

**When to use:** F10 chart-query on `/exercise/[exerciseId]/chart`.

**Migration shape:**
```sql
-- F10 — get_exercise_chart(exercise_id, metric, since)
-- Returns per-day aggregate for an exercise's working-sets within a time window.
-- metric='weight' → max(weight_kg) per day (Strong-standard "max-weight" line)
-- metric='volume' → sum(weight_kg * reps) per day (total-volume line)
--
-- SECURITY INVOKER → RLS on exercise_sets applies; user can only see their own sets.
create or replace function public.get_exercise_chart(
  p_exercise_id uuid,
  p_metric text,                          -- 'weight' | 'volume'
  p_since timestamptz                     -- now() - interval '3 months' for default 3M window;
                                          -- NULL → no lower bound (the 'All' window)
)
returns table (
  day timestamptz,                        -- date_trunc('day', completed_at)
  value numeric
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    date_trunc('day', es.completed_at) as day,
    case
      when p_metric = 'weight' then max(es.weight_kg)
      when p_metric = 'volume' then sum(es.weight_kg * es.reps)
    end as value
  from public.exercise_sets es
  inner join public.workout_sessions s
    on s.id = es.session_id
   and s.finished_at is not null          -- exclude abandoned drafts from the trend line
  where es.exercise_id = p_exercise_id
    and es.set_type = 'working'           -- D-18 + ARCHITECTURE §5 canonical filter
    and (p_since is null or es.completed_at >= p_since)
  group by date_trunc('day', es.completed_at)
  order by date_trunc('day', es.completed_at) asc;
$$;

revoke all on function public.get_exercise_chart(uuid, text, timestamptz) from public;
grant execute on function public.get_exercise_chart(uuid, text, timestamptz) to authenticated;
```

**Resource hook:**
```typescript
// app/lib/queries/exercise-chart.ts (NEW)
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { exerciseChartKeys } from "@/lib/query/keys";
import { subMonths, subYears } from "date-fns";
import { z } from "zod";

export type ChartMetric = "weight" | "volume";
export type ChartWindow = "1M" | "3M" | "6M" | "1Y" | "All";

const ChartRowSchema = z.object({
  day: z.string(),                  // ISO timestamp from date_trunc
  value: z.coerce.number(),         // numeric → JS number (Postgres returns string for numeric)
});
export type ChartRow = z.infer<typeof ChartRowSchema>;

function windowToSince(window: ChartWindow): string | null {
  const now = new Date();
  switch (window) {
    case "1M":  return subMonths(now, 1).toISOString();
    case "3M":  return subMonths(now, 3).toISOString();
    case "6M":  return subMonths(now, 6).toISOString();
    case "1Y":  return subYears(now, 1).toISOString();
    case "All": return null;
  }
}

export function useExerciseChartQuery(
  exerciseId: string,
  metric: ChartMetric,
  window: ChartWindow,
) {
  return useQuery<ChartRow[]>({
    queryKey: exerciseChartKeys.byExercise(exerciseId, metric, window),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_exercise_chart", {
        p_exercise_id: exerciseId,
        p_metric: metric,
        p_since: windowToSince(window),
      });
      if (error) throw error;
      return (data ?? []).map((row: unknown) => ChartRowSchema.parse(row));
    },
    enabled: !!exerciseId,
    // staleTime 30s inherited from QueryClient default; data won't change between
    // sessions unless user finishes another pass in this exercise.
  });
}
```

### Pattern 5: Inline-Overlay Delete-Pass Confirm (Inherited Phase 4 commit `e07029a`)

**What:** Full-screen absolute-positioned `<View>` overlay (NOT modal portal) with backdrop + dialog + Cancel + Destructive buttons.

**When to use:** Delete-pass action on `/history/[sessionId]` (CONTEXT.md D-07).

**Pattern reference:** UI-SPEC §"Session-detail delete-confirm overlay" lines 475-495 verbatim — JSX shape, color, copy. Planner copy-pastes the Phase 4 `e07029a` JSX with copy substitution.

### Pattern 6: `useDeleteSession` Mutation with FK Cascade

**What:** A `useMutation` keyed `['session','delete']` whose `mutationFn` calls `supabase.from('workout_sessions').delete().eq('id', vars.id)`. The FK `on delete cascade` on `exercise_sets.session_id` (verified in `0001_initial_schema.sql` line 74) handles the multi-row delete automatically. The optimistic `onMutate` removes the session from `sessionsKeys.listInfinite()` cache + `sessionsKeys.detail(id)` cache.

**Why it's idempotent:** Hard-delete on a non-existent row returns `data: null, error: null` (success with 0 rows affected). Replay against an already-deleted row is a no-op.

**Pattern reference:** Phase 4 `['plan','archive']` (`client.ts` lines 338-366) — same shape: optimistic filter-out from list cache, snapshot for rollback, invalidate on settled.

**`setMutationDefaults` for `['session','delete']` (NEW addition to `lib/query/client.ts`):**
```typescript
// ===========================================================================
// 14) ['session','delete'] — Phase 6 — workout_sessions DELETE.
// FK on delete cascade purges exercise_sets server-side automatically; no
// client-side fan-out delete needed. Idempotent — DELETE on a non-existent row
// returns success with 0 rows affected.
//
// Optimistic onMutate: remove from sessionsKeys.listInfinite() (flatten pages,
// rebuild) + clear sessionsKeys.detail(id). UI navigates back to (tabs)/history
// via router.replace on onSuccess; toast fires.
//
// scope.id is set at call-site via useDeleteSession(sessionId) so concurrent
// deletes on different sessions don't serialize, but two deletes on the SAME
// session are FIFO under `session:<id>`.
// ===========================================================================
type SessionDeleteVars = { id: string };

queryClient.setMutationDefaults(["session", "delete"], {
  mutationFn: async (vars: SessionDeleteVars) => {
    const { error } = await supabase
      .from("workout_sessions")
      .delete()
      .eq("id", vars.id);
    if (error) throw error;
    return undefined as void;
  },
  onMutate: async (vars: SessionDeleteVars) => {
    // Cancel any in-flight queries that could overwrite our optimistic update.
    await queryClient.cancelQueries({ queryKey: sessionsKeys.listInfinite() });
    await queryClient.cancelQueries({ queryKey: sessionsKeys.detail(vars.id) });

    // Snapshot for rollback. `listInfinite` data is { pages: SessionSummary[][], pageParams: ... }.
    const previousList = queryClient.getQueryData<{
      pages: SessionSummary[][];
      pageParams: (string | null)[];
    }>(sessionsKeys.listInfinite());
    const previousDetail = queryClient.getQueryData(sessionsKeys.detail(vars.id));

    // Optimistic update: filter out the session from every page in listInfinite.
    if (previousList) {
      queryClient.setQueryData(sessionsKeys.listInfinite(), {
        ...previousList,
        pages: previousList.pages.map((page) =>
          page.filter((s) => s.id !== vars.id),
        ),
      });
    }
    // Clear detail cache so any in-progress render falls back to query refetch.
    queryClient.setQueryData(sessionsKeys.detail(vars.id), undefined);

    return { previousList, previousDetail };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as
      | { previousList?: typeof previousList; previousDetail?: unknown }
      | undefined;
    if (c?.previousList) {
      queryClient.setQueryData(sessionsKeys.listInfinite(), c.previousList);
    }
    if (c?.previousDetail !== undefined) {
      queryClient.setQueryData(sessionsKeys.detail(vars.id), c.previousDetail);
    }
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.listInfinite() });
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(vars.id) });
    // setsKeys cache for the deleted session is now orphaned but TanStack's gcTime
    // will sweep it; explicit invalidate is harmless and makes the intent visible.
    void queryClient.invalidateQueries({ queryKey: setsKeys.list(vars.id) });
  },
  retry: 1,
});
```

### Anti-Patterns to Avoid

- **Client-side aggregate over over-fetched join.** Pulling `select sessions.*, sets.*` and reducing in JS is `Loading entire history for graph` reincarnated for the list. Use the RPC.
- **`useInfiniteQuery` with offset.** Drifts with concurrent inserts. Use the `started_at` cursor.
- **Re-creating the chart `data` array on every render.** Causes `<CartesianChart>` to remount + re-animate stutter. Use `useMemo`.
- **Reading `state.x.value.value` outside a Reanimated worklet.** Shared values must be read via `useDerivedValue` / `useAnimatedReaction` / inside Skia render-prop or you get a stale snapshot. The Skia render-prop body IS a worklet boundary, so reading `state.x.position` directly inside is correct; reading `.value` to compute display text requires `useDerivedValue`.
- **PostgREST aggregate functions without an opt-in audit.** Enabling project-wide aggregates is a security posture change; RPC is the scoped alternative.
- **Mounting the chart in `<ScrollView>` without an explicit height.** Victory Native XL `<CartesianChart>` measures via Skia's surface and **requires a fixed pixel height** on its parent `View`. UI-SPEC locks `height: 240`.
- **Conditionally rendering the chart at `chartData.length === 0`.** Don't. Render the empty-state INSTEAD of the chart (UI-SPEC §"Chart empty-state"). Don't render an empty `<CartesianChart>` — it produces an unhelpful "broken axis" frame.
- **Casting Supabase responses with `as Database['public']['Functions']['get_session_summaries']['Returns']`.** Pitfall 8.13 — Zod-parse the RPC response. Generated types are compile-time only; the wire is untrusted.
- **Sharing the existing `/workout/[sessionId]` route via a `mode='view'` prop for history.** CONTEXT.md D-05 explicitly forbids — ActiveSessionBanner mount-state collides; ScopeOverride risk; render-conditionals proliferate. New route is right.
- **Hard-delete in a screen `useEffect` after onSuccess.** Use the mutation's `onSuccess` callback in the call-site (Phase 4 mutate-not-mutateAsync convention) so the optimistic UI feedback drives the router.replace + toast, not an effect chain.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cursor-paginated infinite list | Custom `pageOffset` state + manual `concat` of pages on `onEndReached` | TanStack v5 `useInfiniteQuery` + `getNextPageParam` | v5 handles page de-dup, refetch ordering, paused-mutation interleave, and offline cache hydration via the existing Phase 4 persister for free. |
| Per-day aggregate computation | Client-side `groupBy + reduce` over over-fetched `exercise_sets` rows | Postgres RPC `get_exercise_chart` with `date_trunc('day', completed_at)` + `max(...) / sum(...)` | Server-side aggregate hits an index (`idx_exercise_sets_exercise (exercise_id, completed_at desc)` already exists per migration `0001_initial_schema.sql` line 89), respects RLS, scales with history-size, matches ARCHITECTURE.md §5 explicit contract. |
| Line chart with axes + tooltip + animation | Raw `react-native-skia` `<Path>` + d3-scale + hand-rolled gesture detection | Victory Native XL `<CartesianChart>` + `<Line>` + `useChartPressState` | ~30 lines vs ~2-3 days; STACK.md §Charting decision. |
| Segmented control component | Custom toggle with manual selected-tile-tracking, accessibility, dark-mode color flip | Either NativeWind-baserat fallback (UI-SPEC primary path — ~30 lines) OR `@react-native-segmented-control/segmented-control` (Expo-blessed native control) | Both are stable patterns; NativeWind path keeps visual consistency with the rest of Phase 6 surfaces without a new install. |
| Multi-row delete (session + its sets) | Sequential `supabase.from('exercise_sets').delete()...` + then `workout_sessions.delete()` | FK `on delete cascade` on `exercise_sets.session_id` (already exists per `0001_initial_schema.sql` line 74) | One DELETE statement; atomic; idempotent on replay; no orphan rows possible; offline-queue-safe (single mutation). |
| Optimistic listInfinite-cache update | Custom `setQueryData` with hand-rolled page-array manipulation everywhere it's needed | Phase 6 `setMutationDefaults` for `['session','delete']` does it once for delete, follows the Phase 4 `['plan','archive']` pattern verbatim with infinite-cache-aware page-mapping (`previousList.pages.map(page => page.filter(...))`) | Pattern already proven in Phase 4 + 5; cookie-cutter copy + adapt for the new key. |
| Theme-aware chart colors | Inline ternaries on every Skia color prop | `useColorScheme()` bound once at top of chart component → 4 hex constants (`lineColor`, `axisColor`, `gridColor`, `bgColor`) | Phase 4 D-18 + Phase 5 commit `6b8c604` pattern. |
| `exercise.name` lookup on header | Re-fetching exercise by id on every chart route mount | `useExercisesQuery + Map<id, name>` lookup (Phase 4 commit `3bfaba8`) | Reuses already-warm cache from plan-detail/picker; no extra round-trip. |
| Inline-overlay delete-confirm | Modal portal OR Alert.alert | Phase 4 commit `e07029a` inline-overlay JSX (UI-SPEC §Inline-overlay-confirm-pattern verbatim) | Modal portal breaks NativeWind/flex composition (Phase 4 Plan 04-04 commit-trail proved 3 iterations failed); inline-overlay is the locked V1 convention. |

**Key insight:** Phase 6 is a composition phase, not an invention phase. Every primitive is in place; the work is wiring them.

## Runtime State Inventory

**Phase 6 is read-side polish — no schema changes, no string rename, no migration of existing rows.** This section is therefore a defensive sweep, not a recovery task.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 6 modifies no existing rows. `workout_sessions` and `exercise_sets` are read-only from Phase 6's perspective; the new DELETE path operates on user-initiated row-removal with FK cascade. | None |
| Live service config | None — no n8n / Datadog / Tailscale / Cloudflare in this project. Supabase config (`config.toml`) unchanged; no new auth/storage settings. | None |
| OS-registered state | None — Expo Go / EAS Build pipeline unchanged. No Windows Task Scheduler / launchd / systemd / pm2 involvement. | None |
| Secrets/env vars | None — `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` already wired; no new env vars; service-role isolation gate unchanged. | None |
| Build artifacts | None — no new native modules; no `expo prebuild`; the new components ship via the existing Metro bundle. `npm run gen:types` MAY need to run after the migration introduces the new RPC functions so they appear in `Database['public']['Functions']` for typed `.rpc()` calls — verify via planner Task. | Run `npm run gen:types` after `supabase db push` for migration 0006 so `Database['public']['Functions']['get_session_summaries']` and `['get_exercise_chart']` are emitted in `types/database.ts` (preserves the typed-client convention from Phase 2). |

**Canonical question answer:** After every code change in this phase lands, the only runtime state outside the source tree that needs touching is `types/database.ts` (regenerated after the migration). All other state (caches, queues, auth tokens) is transient and self-rebuilding.

## Common Pitfalls

### Pitfall 1: Victory Native XL re-mounts chart on every render

**What goes wrong:** `<CartesianChart data={chartData}>` where `chartData` is a new array reference each render. Chart unmounts + remounts on every parent re-render; line-animation stutters; press-state resets between presses.

**Why it happens:** Beginners pass `query.data?.map(...)` directly to `data=` without `useMemo`. React's reconciliation sees a new array reference and Skia's internal effect chain unmounts the entire chart subtree.

**How to avoid:**
- Always wrap the `data` array in `useMemo` keyed on `[query.data]` (or `[query.data, metric, window]` only if the array contents change for reasons not already captured in the queryKey — they shouldn't, because metric+window are in the queryKey).
- D-21 + STACK.md §Victory Native XL — gotcha-level documented; ROADMAP success #3 enforces.

**Warning signs:** Chart animation flickers on every keystroke / state-change in the parent. Press tooltip disappears immediately when a different state changes. The reanimated worklet warnings spam Metro console.

### Pitfall 2: `useChartPressState` initial value shape must match `yKeys`

**What goes wrong:** `useChartPressState({ x: 0, y: 0 })` — passes a scalar `y` when `yKeys=['y']`. Runtime: `state.y.y.position` is undefined; `Skia <Circle cx={undefined} cy={undefined}>` renders at origin and silently breaks the tooltip.

**Why it happens:** API contract: `useChartPressState`'s initial-state object must mirror the `yKeys` array shape — one inner object key per `yKey`. The Victory docs example uses `useChartPressState({ x: 0, y: { highTmp: 0 } })` for `yKeys=['highTmp']`. Easy to mis-read.

**How to avoid:** Always pass `{ x: 0, y: { <metricColumnName>: 0 } }`. For Phase 6 our chart uses `yKeys=['y']` so init is `{ x: 0, y: { y: 0 } }`. State access then is `state.y.y.position` (outer `y` = yKey-bag, inner `y` = column name).

**Warning signs:** TypeScript happy, runtime tooltip never appears. Skia console silent. `state.y.y` is `undefined`.

### Pitfall 3: `useInfiniteQuery` page-end detection by checking `data.pages.length`

**What goes wrong:** `onEndReached={() => fetchNextPage()}` without checking `hasNextPage` triggers fetches forever once the user scrolls past the last page. The cached pages array is unbounded; AsyncStorage persister snapshots are huge; battery dies.

**Why it happens:** New users assume `fetchNextPage()` is idempotent and the hook auto-detects end-of-list. It does — via `getNextPageParam` returning `undefined` — but they don't check `hasNextPage` at the call site.

**How to avoid:**
```typescript
onEndReached={() => {
  if (hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }
}}
```
`hasNextPage` is derived from `getNextPageParam(lastPage)` returning a defined value. Our cursor pattern returns `undefined` when `lastPage.length < PAGE_SIZE` — the canonical end-of-list signal.

**Warning signs:** Network tab shows fetches firing in a loop after the last page renders. `data.pages` grows without bound. Metro console: "infinite query refetch loop detected" (TanStack v5 warns from `5.50+`).

### Pitfall 4: PostgREST `.rpc()` response is typed as `unknown` without gen:types refresh

**What goes wrong:** After adding the migration, `supabase.rpc('get_session_summaries', ...)` returns `data: unknown` because `Database['public']['Functions']` doesn't include the new function. TypeScript error sprawls; planner casts to `any` to make it compile; runtime data is unvalidated.

**Why it happens:** `npm run gen:types` runs against the LIVE database. The migration must be `supabase db push`-ed before `gen:types` produces the new function signature.

**How to avoid:**
1. Plan order: migration → `supabase db push` → `verify-deploy.ts` → `npm run gen:types` → commit. The gen:types output is in the same commit as the migration.
2. ALWAYS Zod-parse the `.rpc()` response regardless of `gen:types` state — Pitfall 8.13 says generated types are compile-time only. The wire is untrusted.
3. CLAUDE.md ## Database conventions explicitly: "Type-gen runs after every schema migration."

**Warning signs:** `supabase.rpc(...).data` is typed `unknown` after the migration ships. `gen:types` output diff is empty (means migration didn't push). `database.ts` last-modified is older than the migration file.

### Pitfall 5: `set_type` filter inconsistency between F9 count and F10 line

**What goes wrong:** F9 history-list row count includes all sets (working + warmup + dropset + failure); F10 chart line excludes everything except working. User sees `24 set` in history-row but the chart shows fewer dots — they think the chart is broken.

**Why it happens:** F10 inherits the `set_type = 'working'` filter from ARCHITECTURE.md §5 + Phase 5 F7. F9 wasn't explicitly stated in the original architecture doc because V1 only writes 'working' anyway. The inconsistency only surfaces in V1.1 when F17-UI ships.

**How to avoid:** Apply the `set_type = 'working'` filter in BOTH RPC functions (already specified in `get_session_summaries` and `get_exercise_chart` above). Document the convention as "working-set canonical" in the migration comment. V1.1 set-typ-UI rollout then needs to decide whether to add a "show all sets" toggle on history-row (probably yes) — but that decision happens in V1.1, not Phase 6.

**Warning signs:** History-row count mismatches the visible dot-count when zooming in on `All` window for an exercise with mixed set_types. (Won't happen in V1 because all sets are 'working'.)

### Pitfall 6: Hard-delete optimistic update misses the infinite-query cache shape

**What goes wrong:** `setQueryData(sessionsKeys.listInfinite(), (old) => old.filter(...))` — `old` is `{ pages, pageParams }`, not a flat array. `old.filter` is `undefined`; cache write silently fails; deleted row stays visible until next refetch.

**Why it happens:** Most TanStack mutation tutorials use plain `useQuery` shape. `useInfiniteQuery` data has a different envelope.

**How to avoid:**
```typescript
queryClient.setQueryData<{ pages: SessionSummary[][]; pageParams: (string|null)[] }>(
  sessionsKeys.listInfinite(),
  (old) => old ? {
    ...old,
    pages: old.pages.map((page) => page.filter((s) => s.id !== vars.id)),
  } : old,
);
```
Map over `pages`, filter each page. Don't flatten + refile — preserves cursor invariants.

**Warning signs:** Delete UX shows row disappearing for ~200ms (the time to `router.replace`) and then reappearing if the user navigates back to history immediately. Background refetch eventually clears it but the lag is visible.

### Pitfall 7: `freezeOnBlur: true` + screen-local overlay state = ghost overlays on refocus

**What goes wrong:** User opens delete-confirm overlay, navigates back, comes back to session-detail — the overlay is still visible because `freezeOnBlur` preserved the state.

**Why it happens:** Phase 4 D-08 turned on `freezeOnBlur` to recover 120Hz ProMotion frame budget. Freeze preserves React state; without explicit reset, modal/overlay flags don't clear.

**How to avoid:** `useFocusEffect` cleanup on every screen with destructive-confirm state (Phase 4 commit `af6930c` pattern):
```typescript
useFocusEffect(
  useCallback(() => () => {
    setShowOverflowMenu(false);
    setShowDeleteConfirm(false);
  }, []),
);
```
The returned function runs on blur (cleanup phase of `useFocusEffect`); the empty deps array ensures the cleanup is stable across renders.

**Warning signs:** Overlay appears when navigating back to a previously-frozen screen. Touch events get captured by an invisible scrim. UAT step: open delete-confirm, swipe back, swipe forward — overlay should NOT be visible on re-focus.

### Pitfall 8: Chart-icon tap on plans/[id].tsx bubbles to row Pressable

**What goes wrong:** Future V2 makes the plan_exercise row tappable (e.g., to expand for inline-edit). The chart-icon's Pressable sits INSIDE the row Pressable; tap on the icon bubbles up and the wrong action fires.

**Why it happens:** RN's default behavior for nested `Pressable` is that the innermost takes the tap; sibling Pressables don't bubble. BUT if the row's wrapping element is a single Pressable enclosing ALL children including the icon, the icon's own Pressable wins via its `onPress` — provided it's properly registered as a sibling, not a child.

**How to avoid:** UI-SPEC §"Plan-detail chart-ikon affordance" places the icon Pressable as a SIBLING to the existing edit/remove affordances inside a `flex-row` container — all flat siblings, not nested. Verify implementation: the chart-icon Pressable is NOT inside another Pressable. Use React DevTools to inspect the tree.

**Warning signs:** Tapping the chart-icon also fires a hidden row-action (won't happen in V1 because the row isn't tappable; V2 risk only). UAT a11y test: VoiceOver should announce the chart-icon as a discrete button, not as part of a parent button.

### Pitfall 9: Empty-state of chart when `metric` toggle is on but query is for a different metric+window

**What goes wrong:** User taps "Total volym" → window `1Y` → no data in 1Y for volume → empty-state renders. User taps "Max vikt" → cache for `(weight, 1Y)` is cold → loading spinner → empty-state renders again → user assumes "no data ever" but `(weight, All)` has 50 entries.

**Why it happens:** The empty-state copy "Inga pass än för den här övningen" is identical regardless of window. User can't distinguish "no data for this window" from "no data anywhere".

**How to avoid:** UI-SPEC has the resolution baked in: when `chartData.length === 0` AND the all-time query (separate cache slot) has ≥1 entry, render the "Inga pass i detta intervall" copy with "Byt till All för att se hela historiken." subtext. Otherwise render "Inga pass än för den här övningen" + "Logga minst 2 set för att se trend." Planner can implement this with a second query (`useExerciseChartQuery(id, metric, 'All')` with `enabled: chartData.length === 0`) or — simpler — fold the all-time check into the same RPC return value (add a `total_data_points` column to `get_exercise_chart` that's always the COUNT regardless of window-filter).

[ASSUMED — planner should verify with user] The two-state empty rendering is documented in UI-SPEC §Copywriting Contract → "Empty state when window has 0 points BUT all-time has ≥1". Planner picks implementation (second query vs RPC count-column).

**Warning signs:** Soak test shows user toggling to different metrics looking for their data because the empty-state copy is ambiguous.

### Pitfall 10: F9 list-query and F10 chart-query both fire SELECT on `exercise_sets` — RLS subquery N+1 on cold cache

**What goes wrong:** First app launch after `gcTime` expiry: history-tab loads → RPC fires `get_session_summaries` → joins `exercise_sets` → RLS policy on `exercise_sets` is `EXISTS (SELECT 1 FROM workout_sessions WHERE id = session_id AND user_id = (select auth.uid()))` → with hundreds of sessions, the EXISTS subquery runs once per row UNLESS the FK is indexed AND `auth.uid()` is wrapped.

**Why it happens:** Phase 2 already wrapped `auth.uid()` and added `idx_exercise_sets_session` (verified in `0001_initial_schema.sql` line 88) — but the Phase 6 RPC consolidates the query server-side, so it's a single execution plan against an indexed join with cached `auth.uid()`. The pitfall is theoretical for V1 single-user but planner should verify the EXPLAIN plan during migration verification.

**How to avoid:**
1. RPC consolidates the aggregation server-side — single query plan, no N+1.
2. `idx_exercise_sets_session` already indexed (PK-style B-tree).
3. `auth.uid()` wrapped as `(select auth.uid())` in all RLS policies (PITFALLS 4.1 — verified Phase 2).
4. Run `EXPLAIN ANALYZE select * from public.get_session_summaries(null, 20);` after migration to confirm plan uses index scans, not seq scans. Document plan in `06-VERIFICATION.md`.

**Warning signs:** History-tab cold-load takes >500ms over LTE with 50+ sessions. EXPLAIN shows seq scan on `exercise_sets`. Supabase Performance dashboard flags the query.

## Code Examples

### Example 1: `sessionsKeys.listInfinite()` + `exerciseChartKeys.byExercise()` factory additions

```typescript
// Source: /lib/query/keys.ts (MODIFIED — extends Phase 4/5 pattern)
export const sessionsKeys = {
  all: ["sessions"] as const,
  list: () => [...sessionsKeys.all, "list"] as const,
  detail: (id: string) => [...sessionsKeys.all, "detail", id] as const,
  active: () => [...sessionsKeys.all, "active"] as const,
  // Phase 6 — F9 cursor-paginated infinite list.
  listInfinite: () => [...sessionsKeys.all, "list-infinite"] as const,
};

// Phase 6 — F10 per-exercise chart with metric + window cache slots.
// Each (exerciseId, metric, window) combo is its own cache slot so toggling
// keeps prior data visible while a new fetch lands.
export const exerciseChartKeys = {
  all: ["exercise-chart"] as const,
  byExercise: (exerciseId: string, metric: "weight" | "volume", window: "1M" | "3M" | "6M" | "1Y" | "All") =>
    [...exerciseChartKeys.all, "by-exercise", exerciseId, metric, window] as const,
};
```

### Example 2: Memoized chart-data array (D-21 contract)

```typescript
// In app/app/(app)/exercise/[exerciseId]/chart.tsx
const chartQuery = useExerciseChartQuery(exerciseId, metric, window);

const chartData = useMemo(
  () => (chartQuery.data ?? []).map((row) => ({
    x: new Date(row.day).getTime(),
    y: row.value,
  })),
  [chartQuery.data],
);

// Conditional render per D-17 graceful degradation:
if (chartData.length === 0) return <ChartEmptyState />;
return <CartesianChart data={chartData} xKey="x" yKeys={["y"]} ...>{ ... }</CartesianChart>;
```

### Example 3: `useFocusEffect` overlay-state reset (Phase 4 commit `af6930c` reused)

```typescript
// In app/app/(app)/history/[sessionId].tsx
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

const [showOverflowMenu, setShowOverflowMenu] = useState(false);
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

useFocusEffect(
  useCallback(
    () => () => {
      setShowOverflowMenu(false);
      setShowDeleteConfirm(false);
    },
    [],
  ),
);
```

### Example 4: `useExercisesQuery + Map<id, name>` lookup (Phase 4 commit `3bfaba8` reused)

```typescript
// In app/app/(app)/exercise/[exerciseId]/chart.tsx
import { useExercisesQuery } from "@/lib/queries/exercises";

const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
const exercisesQuery = useExercisesQuery();
const exerciseName = useMemo(() => {
  const map = new Map(
    (exercisesQuery.data ?? []).map((e) => [e.id, e.name] as const),
  );
  return map.get(exerciseId) ?? "Övning";
}, [exercisesQuery.data, exerciseId]);

// Bind to Stack header
<Stack.Screen options={{ title: exerciseName }} />
```

### Example 5: Pull-to-refresh + infinite-scroll FlatList wiring

```typescript
// In app/app/(app)/(tabs)/history.tsx
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isRefetching,
  refetch,
  status,
} = useSessionsListInfiniteQuery();

const sessions = useMemo(() => data?.pages.flat() ?? [], [data?.pages]);

return (
  <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
    {sessions.length > 0 && (
      <View className="px-4 pt-4 pb-2">
        <Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
          Historik
        </Text>
      </View>
    )}
    <FlatList
      data={sessions}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => <HistoryListRow session={item} />}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}
      ItemSeparatorComponent={() => <View className="h-2" />}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator size="small" /> : null}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
      }
      ListEmptyComponent={
        status === "pending" ? null : <HistoryEmptyState />
      }
    />
  </SafeAreaView>
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useInfiniteQuery(['key'], fn, options)` (positional) | `useInfiniteQuery({ queryKey, queryFn, initialPageParam, getNextPageParam })` (object-arg) | TanStack Query v5 GA (Oct 2023) | All Phase 6 query hooks use object-arg; planner copy-paste from older tutorials will TS-error [VERIFIED: Context7 `/tanstack/query/v5.90.3`] |
| `cacheTime` | `gcTime` | TanStack Query v5 GA | Already in `lib/query/client.ts` line 73 — no Phase 6 change |
| Raw Skia for charts | Victory Native XL (`<CartesianChart>` + `<Line>`) | Victory Native XL v40 (2024) | Phase 6 ships chart in ~30 lines [VERIFIED: STACK.md §Charting decision] |
| Modal portal for destructive confirm | Inline absolute-positioned `<View>` overlay | Phase 4 commit `e07029a` (2026-05-10) | Phase 6 inherits — no portal, no Modal portal experiments [VERIFIED: STATE.md "Modal portal layout is UNRELIABLE for NativeWind/flex composition on iOS"] |
| `mutateAsync` with `await` | `mutate(payload, { onSuccess, onError })` | Phase 4 commit `5d953b6` (2026-05-10) | Phase 6 `useDeleteSession.mutate(...)` follows; `mutateAsync` is NOT safe under `networkMode: 'offlineFirst'` [VERIFIED: STATE.md Phase 4 Plan 04 decisions] |
| PostgREST aggregate via `select=count,...,group_by_col` | Postgres RPC with `language sql security invoker` | Supabase aggregate-functions blog (post-PostgREST 12, late 2024) but defaulted-disabled | Phase 6 chooses RPC because aggregate-functions are project-wide opt-in [VERIFIED: WebSearch Supabase blog + Github discussion #19517] |

**Deprecated/outdated:**
- `victory-native` pre-v40 (the old V components API) — replaced by XL `<CartesianChart>` API. CLAUDE.md pins `^41.20.2`; no risk of accidental old-version install.
- `useEffect`-driven navigation guards — Phase 3 already replaced with `Stack.Protected` + layout-level `<Redirect>`.
- AsyncStorage for Supabase auth — replaced by `LargeSecureStore` (Phase 1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | F9 `set_count` should filter `set_type = 'working'` to stay consistent with F7 + F10 working-set-canonical convention (currently identical to "all" in V1 because all sets are 'working') | F9 RPC Query Shape (Pattern 3) | V1.1 F17-UI rollout starts tagging warmup sets — without the filter, history-row count includes warmup/dropset/failure which historically wasn't counted; user sees a count change without an explanation. With the filter, the count is stable across V1 → V1.1 with the same semantic ("working sets"). Suggest planner asks user "should warmup sets count toward history-row set-count once F17-UI ships?" before committing the filter direction. Recommend FILTER. |
| A2 | The two-state empty rendering (`Inga pass i detta intervall` vs `Inga pass än för den här övningen`) needs a separate `useExerciseChartQuery(id, metric, 'All')` query to detect "data exists but not in current window" — OR an extra column on the RPC return | Pitfall 9 + UI-SPEC §Copywriting | If the planner implements only the simpler single-empty-state ("Inga pass än"), user can't tell "filter too narrow" from "no data ever" — confused UX. Cost is low (a second query is fine); the planner has explicit discretion. Recommend the second-query approach (simpler RPC; cache slot reuses). |
| A3 | The migration filename `0006_phase6_chart_rpcs.sql` is correct as the next-numbered file given 0001–0005 already exist | Project Structure | If the numbering convention has changed (e.g., date-based names) the planner picks the actual next number. Visible by `ls supabase/migrations/`. No data risk — just filename convention. |
| A4 | `useFont(null, 12)` for axis font fall-back to system font works without bundling a custom .ttf | Pattern 2 + UI-SPEC | Skia 2.x supports `useFont(null, ...)`; if the planner finds it doesn't render labels reliably on iOS, fall back to `require('@/assets/fonts/Inter-Medium.ttf')` (which would need adding to assets). Test on cold-launch. Low risk — Victory Native XL docs reference `useFont(inter, 12)` with a font file; null-font path is less documented. |
| A5 | The `idx_exercise_sets_exercise(exercise_id, completed_at desc)` index already exists from `0001_initial_schema.sql` line 89 and supports the F10 chart query | Pitfall 10 + RPC `get_exercise_chart` | Verified by direct file-read. If the planner finds the index is somehow missing in the deployed DB (e.g. drift), `verify-deploy.ts` post-migration should flag it. Low risk. |
| A6 | PostgREST `.rpc()` correctly bubbles RLS-denied results as empty data (not 401) — same UX as `.from(...).select()` | Pattern 3 + 4, Security Domain | If `.rpc()` returns `42501 permission denied` on RLS-denied rows, the client would throw error instead of returning empty data, and the empty-state rendering would break. Standard PostgREST behavior is empty-data; verified once during planning by querying as User A for User B's exercise_id (will return empty rows). Verify in `test-rls.ts` extension. |
| A7 | `npm run gen:types` will emit typed signatures for `get_session_summaries` + `get_exercise_chart` after `supabase db push` — `Database['public']['Functions']['get_session_summaries']['Returns']` will exist | Pitfall 4 + Build Artifacts | If `gen:types` doesn't surface RPC functions in some Supabase CLI versions, the planner falls back to manually-typed RPC response (`type RpcResponse = SessionSummary[]`) at the call site. Generated types are compile-time convenience; Zod-parse is the actual runtime guard. Low risk. |
| A8 | Default `staleTime` (30s) from `lib/query/client.ts` is appropriate for the F9 list (no special `staleTime` override needed) | Pattern 1 | If the user logs a new session while on the history-tab, the optimistic update from `['session','finish']` invalidates `sessionsKeys.listInfinite()` via `onSettled` (verified in `client.ts` line 700 — `void queryClient.invalidateQueries({ queryKey: sessionsKeys.list() })` — note this is `sessionsKeys.list()`, not `sessionsKeys.listInfinite()` — **the planner must add an additional invalidate for `sessionsKeys.listInfinite()` to the existing `['session','finish']` onSettled handler in client.ts so newly-finished sessions appear in history without waiting for staleTime**). Risk: planner forgets the additional invalidate → new sessions take up to 30s to appear in history. Mitigation: add to plan's Wave 0 / verification. |
| A9 | Service-role audit gate (`git grep "service_role|SERVICE_ROLE"`) is unaffected by Phase 6 because no new file touches service-role keys | CLAUDE.md §Security conventions | Verified: new RPC migration uses `security invoker` (not definer); test-rls.ts extension uses the existing admin client setup. Low risk. |

## Open Questions

1. **Should F9 history-row `set_count` filter `set_type = 'working'` or count all set-types?**
   - What we know: V1 always writes 'working' so the answer is invisible in V1. V1.1 F17-UI ships warmup/dropset/failure tagging.
   - What's unclear: Whether the user expects history-row count to stay stable across V1 → V1.1 (i.e., always "working sets") OR to bump up to include warmup sets (i.e., "all sets") when F17-UI ships.
   - Recommendation: Filter `set_type = 'working'` per A1 above. Planner can flag for user confirmation during the discuss-phase summary. Document the decision in the migration comment.

2. **`@react-native-segmented-control/segmented-control` vs NativeWind-baserat fallback?**
   - What we know: UI-SPEC picked NativeWind-baserat as primary path (no install needed). Both are valid.
   - What's unclear: Whether the planner has discretion to swap to native control if NativeWind path proves visually inferior during execution.
   - Recommendation: Start with NativeWind path per UI-SPEC. Defer native-control switch to V1.1 polish if needed.

3. **Should the F10 RPC accept `metric` as a typed enum or as a free-text string?**
   - What we know: Postgres can express `p_metric text check (p_metric in ('weight','volume'))` OR a real ENUM type.
   - What's unclear: The `set_type` ENUM precedent argues for a real enum, but it's a 2-value perpetual schema change vs a 2-line check constraint. Either works.
   - Recommendation: `text` with check constraint at the SQL level + Zod literal-union on the client TS side. Same enforcement, less migration weight. (Could also use existing `set_type` ENUM as inspiration — pick once.)

4. **What's the `domain` lower bound on the Y-axis — auto or zero-anchored?**
   - What we know: UI-SPEC says Y-axis auto-scale (D-22) so vikt progression `80 → 82.5` is visible.
   - What's unclear: For `Total volym` metric where values are larger (`2000+`), should the lower bound start at 0 (so the visual magnitude of growth is honest) OR at `min(values) - padding` (so daily fluctuations are visible)?
   - Recommendation: Always auto-scale per D-22 — for a personal user looking at their own trend, the question is "am I improving" not "what's the absolute magnitude". Strong/Hevy both auto-scale.

5. **Should the chart canvas use the new Victory Native XL `xAxis`/`yAxis`/`frame` props (post-deprecation) or the legacy `axisOptions`?**
   - What we know: Context7 docs show `axisOptions` is deprecated in favor of `xAxis`, `yAxis`, `frame` props (Victory Native XL v41+).
   - What's unclear: Whether the deprecated `axisOptions` still works in `41.20.2` or whether the planner should migrate to the new API.
   - Recommendation: Use `axisOptions` for V1 (the deprecated API still works in 41.x — confirmed by reading current Victory Native XL source-of-truth blog tutorials May 2026). The new API is identical capability-wise; refactor to it as V1.1 polish. Keep this as a documented technical-debt item if the migration is non-trivial.

## Environment Availability

> Phase 6 is purely code/SQL changes. No new external dependencies. Existing dependencies are all verified present.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `victory-native` (Skia chart lib) | F10 chart | ✓ | `^41.20.2` (installed) | — |
| `@shopify/react-native-skia` | Victory Native XL peer | ✓ | `2.2.12` (installed) | — |
| `@tanstack/react-query` v5 with `useInfiniteQuery` | F9 list | ✓ | `^5.100.9` (installed) | — |
| `date-fns` (sv locale) | Date formatting + duration | ✓ | `^4.1.0` (installed) | — |
| `@expo/vector-icons` (Ionicons) | UI affordances | ✓ | `^15.0.3` (installed) | — |
| Supabase CLI for migration | F9 + F10 RPC | ✓ (Phase 2 established) | `supabase` CLI 2.x (Phase 2 verified) | — |
| `npm run gen:types` | Typed RPC client | ✓ | Phase 2 wired | Manual type definitions if `gen:types` doesn't surface RPC functions in some CLI version (A7 risk) |
| `npm run test:rls` | Cross-user verification gate | ✓ | Phase 2 wired | — |
| `npm run verify-deploy` (via tsx) | Migration drift check | ✓ | Phase 2 wired | — |
| `@react-native-segmented-control/segmented-control` | Optional native segmented-control path | ✗ (not installed; NativeWind path is primary) | — | UI-SPEC NativeWind segmented-control fallback (no install needed) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** Native segmented-control. NativeWind path is the documented primary; install only if needed.

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json`. This section informs the VALIDATION.md generation downstream.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Custom Node-script harness via `tsx --env-file=.env.local` (NOT Jest/Vitest — Phase 2 established this convention; matches existing 12 `test:*` npm scripts) |
| Config file | None — each script is self-contained at `app/scripts/test-*.ts` |
| Quick run command | `cd app && npm run test:rls` (cross-user gate — Phase 6 extends) |
| Full suite command | `cd app && npm run test:rls && npm run test:session-schemas && npm run test:set-schemas && npm run test:last-value-query` (mirrors Phase 5 close-out) + any new test:exercise-chart-schemas Phase 6 adds |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| F9 | Cursor-paginated list returns finished sessions only, ordered DESC, with set_count + total_volume_kg + plan_name | Integration (RPC against deployed Supabase) | `npm run test:exercise-chart` (NEW, Phase 6) calling `supabase.rpc('get_session_summaries', { p_cursor: null, p_page_size: 20 })` | ❌ Wave 0 |
| F9 | User B cannot see User A's session-summaries via the RPC (RLS-scoped) | Integration cross-user | `npm run test:rls` (EXTEND) — add assertion: as User B, call `get_session_summaries(null, 100)` and verify zero rows for User A's sessions | ❌ Wave 0 — extends existing test-rls.ts |
| F9 | DELETE session as User B against User A's session fails (RLS write-block) | Integration cross-user | `npm run test:rls` (EXTEND) — Phase 6 assertion: User B's anon client attempts `delete().eq('id', userASessionId)` → returns 0 rows affected / error | ❌ Wave 0 — extends existing test-rls.ts |
| F9 | DELETE session cascades to exercise_sets via FK | Integration | `npm run test:rls` (EXTEND) — seed session + 3 sets, delete session as owner, verify exercise_sets for that session_id is empty | ❌ Wave 0 |
| F9 | Pagination terminates correctly when last page < 20 rows | Unit-via-integration | `npm run test:exercise-chart` — seed 25 sessions, fetch page 1 (20 rows), fetch page 2 (5 rows), fetch page 3 (returns empty array) | ❌ Wave 0 |
| F9 | Offline cache hydration shows history-list without nät on cold start | Manual UAT | iPhone airplane-mode test: scroll history, force-quit, reopen offline, verify list visible | manual (folded into `manual-test-phase-06-offline.md` Wave 0) |
| F10 | Chart RPC returns day-aggregate for max-vikt over 3M window | Integration | `npm run test:exercise-chart` — seed exercise + 5 sets across 5 days, call `get_exercise_chart(id, 'weight', 90 days ago)`, verify 5 rows with date_trunc'd days + max(weight_kg) per day | ❌ Wave 0 |
| F10 | Chart RPC returns day-aggregate for total-volym | Integration | `npm run test:exercise-chart` — same seed, call with `'volume'`, verify sum(weight_kg * reps) per day | ❌ Wave 0 |
| F10 | Chart RPC filters `set_type = 'working'` (warmup excluded) | Integration | `npm run test:exercise-chart` — seed 2 working + 1 warmup set on same day, verify aggregate counts only the working | ❌ Wave 0 |
| F10 | Chart RPC respects RLS (User B can't see User A's exercise data) | Integration cross-user | `npm run test:rls` (EXTEND) — as User B, call get_exercise_chart with User A's exercise_id, verify zero rows | ❌ Wave 0 |
| F10 | Memoization contract prevents `<CartesianChart>` re-mount on parent re-render | Manual UAT | Real-device test: navigate to chart, tap metric-toggle, verify no animation stutter; chart-line transitions smoothly | manual (folded into iPhone UAT checklist) |
| F10 | Empty-state renders when `chartData.length === 0` (no chart frame) | Manual UAT | Real-device test: navigate to chart for an exercise with 0 logged sets, verify empty-state copy + Ionicons displays | manual |
| F10 | Sparse state (1 point) renders single dot + caption | Manual UAT | Real-device test: log 1 set for a fresh exercise, navigate to chart, verify single Skia circle + "Logga ett pass till för att se trend." caption | manual |
| F10 | Tooltip via `useChartPressState` appears on tap-and-hold | Manual UAT | Real-device test: tap-and-hold on a chart data point, verify tooltip bubble appears with weight + date; release → tooltip disappears | manual |

### Sampling Rate

- **Per task commit:** `cd app && npm run test:rls && (test:exercise-chart if scope touches chart files)` — < 30s wall time on local network
- **Per wave merge:** Full suite including all `test:*-schemas` scripts + UAT smoke-test pass
- **Phase gate:** Full suite green AND manual airplane-mode UAT signed off in `06-HUMAN-UAT.md` before `/gsd-verify-work 6`

### Wave 0 Gaps

- [ ] `app/scripts/test-exercise-chart.ts` — NEW; covers F9 (`get_session_summaries`) + F10 (`get_exercise_chart`) integration assertions (15+ test cases including cross-user RLS, pagination termination, set_type filter, metric values, edge cases of 0/1/2+ data points)
- [ ] `app/scripts/test-rls.ts` — EXTEND with Phase 6 assertions: (a) cross-user history-list via RPC empty for B against A, (b) cross-user delete-session 0-rows-affected, (c) FK cascade on delete-session purges exercise_sets, (d) cross-user chart-query empty for B against A's exercise. Pattern: copy the Phase 4 `archive cross-user` block shape (`test-rls.ts` Phase 4 additions per Plan 04-04 commit), substitute for new operations.
- [ ] `app/package.json` — add `test:exercise-chart` npm script
- [ ] `app/scripts/manual-test-phase-06-uat.md` — Phase 6 UAT checklist for offline history-list hydration + chart-rendering + delete-pass flow (mirrors Phase 4 + 5 manual-test markdown files)
- [ ] No new test framework install needed — `tsx` + `supabase-js` already in devDependencies.

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`. Phase 6 STRIDE register T-06-* per CLAUDE.md §Security conventions → Phase-specific checklists → Read-side / charts.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | Phase 3 LargeSecureStore + AppState refresh; no Phase 6 change |
| V3 Session Management | yes (inherited) | Phase 3 supabase autoRefreshToken; no Phase 6 change |
| V4 Access Control | **yes — Phase 6 primary concern** | RLS on workout_sessions + exercise_sets + workout_plans (existing); new RPC functions use `security invoker` so RLS auto-applies; `test-rls.ts` extends with cross-user history-list + delete + chart assertions (API1 / V4.3) |
| V5 Input Validation | yes | Zod-parse every `.rpc()` response (Pitfall 8.13); planner adds `SessionSummarySchema` + `ChartRowSchema` to lib/schemas |
| V6 Cryptography | no (no new crypto surface in Phase 6) | — |
| V7 Errors / Logging | yes (inherited) | Phase 6 uses Swedish inline error messages (D-15 convention) per Phase 3 D-15; no new logging surface |
| V8 Data Protection | yes — API3 | RLS scopes aggregations server-side; no cross-user mixing in RPC functions (verified by `where workout_sessions.user_id = (select auth.uid())` in RLS policies) |
| V12 File and Resource | no — N/A in V1 | (deferred) |
| V14 Config | yes — secrets check unchanged | `git grep service_role|SERVICE_ROLE` audit unchanged; new migration uses `security invoker`, not `definer` |

### Known Threat Patterns for {Expo + Supabase + offline-first}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **T-06-01 — Cross-user history-list leak via RPC** | Information disclosure | RPC `security invoker` + RLS on `workout_sessions` (existing); `test-rls.ts` extension asserts User B's RPC call returns empty when User A is the data owner |
| **T-06-02 — Cross-user chart-data leak via RPC** | Information disclosure | Same RPC `security invoker` + RLS on `exercise_sets`; `test-rls.ts` extension covers |
| **T-06-03 — Cross-user session-delete (User B deletes User A's session)** | Tampering | RLS `using ... user_id = (select auth.uid())` blocks the WHERE-match server-side; `test-rls.ts` extension asserts 0-rows-affected when User B attempts |
| **T-06-04 — exercise_id URL tampering (spoof another user's exercise_id in `/exercise/<id>/chart`)** | Spoofing | RLS on `exercises` scopes per-user reads; RPC `get_exercise_chart` joins through `exercise_sets`+`workout_sessions` which RLS-scopes; spoof yields empty chart (empty-state) but no data disclosure |
| **T-06-05 — Cursor parameter tampering (`p_cursor` set to a future date or arbitrary string)** | Tampering | RPC accepts `timestamptz` — Postgres parses or errors; non-parseable strings → 4xx; future date → empty result (no rows pass WHERE clause); not a leak vector |
| **T-06-06 — Deep-link to `/history/<wrongId>` for a session that's not the user's** | Spoofing / Information disclosure | RLS on `workout_sessions` SELECT scopes by user_id — `useSessionQuery(id)` returns empty data; UI renders "Något gick fel. Försök igen." (defined in UI-SPEC §Copywriting Contract); no data disclosure |
| **T-06-07 — Pending offline delete-session replay leaks identifier in AsyncStorage** | Information disclosure | Persisted mutations in AsyncStorage hold the session id — but session id is a UUID with no semantic data; LargeSecureStore is for the auth blob, not the queue. Acceptable — no PII in session id |
| **T-06-08 — Stale chart cache shown to a user who's re-authenticated as a different user** | Information disclosure | Phase 3 sign-out triggers `queryClient.clear()` (verified in `lib/auth-store.ts` Phase 3 D-08 reference); switches user → full cache reset |
| **T-06-09 — RPC parameter SQL injection** | Tampering | Parameterized via `supabase-js` `.rpc()` API (PostgREST handles binding); RPC body uses `language sql` with positional parameters — no string concatenation; `set search_path = ''` defends against search-path injection (Pitfall 7 from Phase 2 pattern) |
| **T-06-10 — Service-role key leaks into Phase 6 surface** | Elevation | Audit gate `git grep "service_role|SERVICE_ROLE"` must match only the existing allowed paths (test-rls.ts, .env.example, .planning/, CLAUDE.md); Phase 6 verifies no new matches |
| **T-06-11 — Aggregate function abuse (PostgREST aggregates enabled project-wide)** | Denial of service / Information disclosure | Phase 6 does NOT enable `pgrst.db_aggregates_enabled` — uses scoped RPC functions instead. Rejected vector. |
| **T-06-12 — Anon-client direct DELETE on `workout_sessions` bypass via URL manipulation** | Tampering | RLS `using` clause + the routes are inside `(app)` guard → unauthenticated request to PostgREST `DELETE /workout_sessions?id=eq.<uuid>` with anon-only headers fails RLS without an auth-token; with stolen auth-token, RLS scopes to that user only |

**Threat-register count:** 12. All to be resolved as `mitigate` in plan-phase STRIDE register; T-06-11 as `accept` (PostgREST aggregates intentionally not enabled). `threats_open: 0` requirement: `gsd-secure-phase 6` audit verifies each via grep/test-rls assertion/code review.

## Sources

### Primary (HIGH confidence)

- **Context7 `/formidablelabs/victory-native-xl`** — `<CartesianChart>`, `<Line>`, `<Scatter>`, `useChartPressState`, `axisOptions`, `formatXLabel`, `tickCount`, `lineColor`, `labelColor`, `curveType` props; Skia tooltip render-prop pattern (verified 2026-05-15 via Context7 CLI)
- **Context7 `/tanstack/query/v5.90.3`** — `useInfiniteQuery` cursor-pagination, `getNextPageParam`, `initialPageParam`, `pageParam` typing, `hasNextPage`/`isFetchingNextPage` (verified 2026-05-15 via Context7 CLI)
- **`CLAUDE.md` ## Conventions → Database conventions** — migration-as-truth, RLS with check + (select auth.uid()) wrapping, gen:types after migration, cross-user verification gate
- **`CLAUDE.md` ## Conventions → Security conventions → Phase 6** — API3 no aggregation across users, T-06-* threat IDs, V12 N/A
- **`CLAUDE.md` ## Recommended Stack → Charting** — `@shopify/react-native-skia@2.2.12` + `victory-native@^41.20.2` (NB: CLAUDE.md doc says `2.6.2` but `app/package.json` verified `2.2.12` is the installed version, per Phase 1 D-X pinning)
- **`.planning/research/ARCHITECTURE.md` §5** — F10 query shape `date_trunc('day', completed_at) + max(weight_kg) WHERE set_type='working'`
- **`.planning/research/PITFALLS.md` "Loading entire history for graph"** — server-side aggregate mandate
- **`.planning/research/PITFALLS.md` §2.5, §4.1, §6.1, §6.4** — RLS with check; auth.uid wrapping; tap target; AAA contrast
- **`.planning/research/STACK.md` §Victory Native (XL) 41 + Skia 2.6** — memoization gotcha + version-compat
- **`app/package.json`** — installed versions verified 2026-05-15
- **`app/supabase/migrations/0001_initial_schema.sql`** — verified FK `on delete cascade` on `exercise_sets.session_id` (line 74); `idx_exercise_sets_exercise(exercise_id, completed_at desc)` exists (line 89)
- **`app/lib/query/client.ts`** — 13 existing `setMutationDefaults` (Phase 4 + 5); Phase 6 adds 14th (`['session','delete']`); inheritance pattern verified
- **`app/lib/queries/sessions.ts` + `sets.ts` + `last-value.ts` + `exercises.ts`** — existing resource hook patterns Phase 6 follows
- **`.planning/phases/06-history-read-side-polish/06-CONTEXT.md`** — locked decisions D-01..D-28
- **`.planning/phases/06-history-read-side-polish/06-UI-SPEC.md`** — visual + interaction contract (approved 2026-05-15)
- **`.planning/STATE.md`** — Phase 4 + 5 closeout decisions including `mutate-not-mutateAsync`, inline-overlay-confirm, freezeOnBlur + useFocusEffect pattern, centraliserad header styling

### Secondary (MEDIUM confidence)

- **WebSearch — Supabase blog "PostgREST Aggregate Functions"** (https://supabase.com/blog/postgrest-aggregate-functions) — aggregate-functions disabled by default; opt-in via `ALTER ROLE authenticator SET pgrst.db_aggregates_enabled = 'true'`; informs the decision to use RPC instead
- **WebSearch — Github Supabase discussion #19517** — community Q on how to GROUP BY with PostgREST; confirms RPC is the canonical pattern for date_trunc + group by
- **WebSearch — Expo SDK 54 segmented-control docs** — confirms `@react-native-segmented-control/segmented-control` is installable via `npx expo install` for SDK 54
- **WebSearch — Victory Native XL community thread on `axisOptions` deprecation** — new `xAxis`/`yAxis` props are the going-forward API; legacy `axisOptions` still works in 41.x

### Tertiary (LOW confidence — flagged for validation)

- A1 (filter `set_type = 'working'` in F9 count) — assumed-best-practice but planner should confirm with user before committing
- A2 (two-state empty-state implementation) — UI-SPEC describes both strings; planner picks query-shape (second query vs RPC column)
- A4 (`useFont(null, 12)` system-font fallback works on iOS Skia 2.x) — Skia docs reference custom-font path more than null-path; verify on cold-launch
- A8 (existing `['session','finish']` invalidate covers `sessionsKeys.listInfinite()` — actually it doesn't, planner must add) — flagged for executor

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages version-verified against `app/package.json` 2026-05-15; Context7 confirmation for Victory Native XL + TanStack v5 API surfaces; STACK.md inheritance
- Architecture: HIGH — patterns inherited verbatim from Phase 4 + 5 (offline-first queries, optimistic mutations, inline-overlay-confirm, centralised header-styling, `useColorScheme()` binding); only true new pattern is `useInfiniteQuery` cursor-pagination + RPC function shape + Victory Native XL render-prop integration
- Pitfalls: HIGH — 10 pitfalls grounded in PITFALLS.md + CONTEXT.md + STATE.md prior-phase lessons; 2 are assumptions (A1, A2) flagged for user confirmation
- Security: HIGH — 12-threat T-06-* register grounded in CLAUDE.md Phase 6 checklist + existing RLS posture; test-rls.ts extension pattern proven in Phase 2 + 4
- Validation: HIGH — Wave 0 gaps explicitly enumerated; test framework convention matches Phase 2 + 5 precedent

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (30 days — Victory Native XL is on a fast minor-version cadence but the `41.20.x` line is stable; TanStack v5 API is settled; the only at-risk source is the Supabase aggregate-functions enablement default which could flip in a future Supabase platform version)

## RESEARCH COMPLETE
