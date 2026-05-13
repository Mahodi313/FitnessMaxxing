# Phase 5: Active Workout Hot Path (F13 lives or dies) — Research

**Researched:** 2026-05-12
**Domain:** Per-set persistence on TanStack Query v5 paused-mutation queue + Supabase `exercise_sets`/`workout_sessions` + draft-recovery cold-start + set-position-aligned F7 query (Expo SDK 54, RN 0.81.5, React 19.1)
**Confidence:** HIGH — every load-bearing claim is verified against the Phase 4 implementation already shipped in `app/lib/query/*`, the Phase 2 schema (`0001_initial_schema.sql`), CONTEXT.md D-01…D-25, UI-SPEC §Visuals/§Interaction, and the canonical research docs (`PITFALLS.md` §1.1–§1.6, §5.1–§5.4, §6.1–§6.6; `ARCHITECTURE.md` §4–§7).

## Summary

Phase 5 is **not a new architecture**. It is a faithful application of the Phase 4 offline-first plumbing (`lib/query/client.ts` with `setMutationDefaults` + `lib/query/persister.ts` + `lib/query/network.ts` with `onlineManager.subscribe(resumePausedMutations)`) to a hotter, more-stressed workload: per-set logging during an active workout. The architectural risk is not "will it work" — Phase 4 already proved the queue replays under airplane-mode + force-quit. The risk is **durability of the most-recent mutation under force-quit/battery-pull within the AsyncStoragePersister throttle window** (PITFALLS §1.3) and **FIFO replay correctness for 25 sets under one shared `scope.id = 'session:<id>'`**. Both are addressable inside the existing four-file query plumbing — no new persistence library is needed; CONTEXT.md D-25 explicitly forbids a redundant Zustand pending-store and instead specifies (a) flush-on-background via `AppState` listener inside `lib/query/network.ts` and (b) lowering persister `throttleTime` from default `1000ms` to `500ms`. Both are minimal additions.

The phase ships **zero schema migrations** — `workout_sessions` and `exercise_sets` were created in Phase 2 (`0001_initial_schema.sql`) with the right shape (client-supplied UUID PKs, `set_type` ENUM defaulting to `'working'`, `weight_kg numeric(6,2)`, RLS policies on both tables with `(select auth.uid())` wrapping and `with check` on the parent-FK subquery for `exercise_sets`). The Phase 5 work is entirely additive at the application layer: 5 new `setMutationDefaults` keys, 3 new resource-hook files (`sessions.ts`, `sets.ts`, `last-value.ts`), 2 new Zod schema files, 1 new screen (`/workout/[sessionId].tsx`), 1 new global component (`<ActiveSessionBanner />`), and incremental edits to four existing files (`(tabs)/_layout.tsx` mounts the banner, `(tabs)/index.tsx` mounts the draft-recovery overlay, `plans/[id].tsx` adds the "Starta pass" CTA, `scripts/test-rls.ts` extends with sessions+sets cross-user assertions).

**Primary recommendation:** Follow CONTEXT.md D-01…D-25 verbatim. The planner does NOT need to re-litigate the architecture — it needs to (1) **operationalize** the 5 new mutation defaults so they mirror the Phase 4 setMutationDefaults pattern exactly (idempotent `.upsert(..., { onConflict: 'id', ignoreDuplicates: true })`, dual-write `onMutate` for create-flows, snapshot+rollback `onError`, `invalidateQueries` `onSettled`, `retry: 1`), (2) **honor the FIFO contract** by giving every set-mutation `scope: { id: 'session:<id>' }` at the `useMutation` call site (TanStack v5 scope is a STATIC string at instantiation time — Phase 4 Plan 04-01 SUMMARY learning), (3) **wire the F13 durability gates** (AppState-background flush in `network.ts`, `throttleTime: 500` in `persister.ts`), and (4) **design and document the manual brutal-test recipe** that closes ROADMAP success #6.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Set-mutation queue infrastructure:**
- **D-13:** Per-set persistence via `useAddSet`; the `workout_sessions` row is created at "Starta pass" tap, **NOT** at "Avsluta" (closes PITFALLS §1.1).
- **D-25:** Phase 4 D-02 + D-03 deferrals close here. AppState-listener flushes `persistQueryClient.persistClient()` on `background`/`inactive`. Persister `throttleTime` drops from default `1000ms` → `500ms` for mutations. **No** redundant Zustand pending-mutations-store — TanStack persister + client-UUID + scope.id was validated in Phase 4 airplane-mode UAT and is sufficient for the same plumbing under hot-path load.

**Mutation keys (5 new):**
- **D-04 extension:** `['session','start']`, `['session','finish']`, `['set','add']`, `['set','update']`, `['set','remove']` — all registered at module top-level in `lib/query/client.ts` BEFORE `lib/query/persister.ts` hydrates. Module-load-order rule from Phase 4 D-01 + PITFALLS §8.2 carries forward.
- **D-14:** Set-edit (tap row → inline edit) and set-delete (swipe-left → red action) are in scope. The original ARCHITECTURE.md §5.3 "V1 is append-only — no edit-set UI" is **explicitly overridden** by CONTEXT.md D-14 because typo correction via delete-and-relog is surrier than tap-to-fix. Conflict resolution stays LWW per `completed_at`.

**Scope.id contract (FIFO replay):**
- **D-12:** `useAddSet`, `useUpdateSet`, `useRemoveSet`, `useStartSession`, `useFinishSession` all bake `scope: { id: 'session:<id>' }` into the `useMutation` instantiation (TanStack v5 scope is STATIC — see Phase 4 Plan 04-01 SUMMARY auto-fix Rule 1). For `useStartSession`, the scope is the new session's UUID (the `id` parameter from the mutate payload); the hook accepts a `sessionId?` param and creates a scope-bound instance per session. All in-flight set-mutations replay AFTER the `['session','start']` create on reconnect, before any `['session','finish']` UPDATE that the user may have queued.

**Workout-screen layout (single-scroll, alltid-synlig inline-edit-rad):**
- **D-01, D-08, D-09:** Single-scroll list of exercise-cards. Each card has header + previously-logged set-rows + always-visible empty set-row at bottom. Set-input row is `[vikt-TextInput][reps-TextInput][Klart-Pressable]` with `keyboardType="decimal-pad"` (closes PITFALLS §6.1).
- **D-05:** Scroll position is **preserved** at "Klart"-tap. The newly-logged row appears in the list; a new empty input row renders below it; scroll does not jump.
- **D-10:** Pre-fill policy — after the first set in the session, the empty row pre-fills weight+reps from the user's most-recent set in the SAME exercise in the SAME session. For set 1 of the session, pre-fill comes from the F7 last-value query (set-position-aligned working set from history excl. current session). When no F7 data exists (first-ever logging of the exercise), the row is blank.
- **D-12:** "Klart" tap commits via `useAddSet.mutate({ id: randomUUID(), session_id, exercise_id, set_number: clientCount+1, weight_kg, reps, completed_at: new Date().toISOString(), set_type: 'working' })`. No confirmation modal. Optimistic-update writes to cache immediately (closes PITFALLS §6.2). Edit/delete via tap-to-edit (D-14) and swipe-left.
- **D-15:** Zod validation strict — `weight_kg = z.coerce.number().min(0).max(500).multipleOf(0.25)`, `reps = z.coerce.number().int().min(1).max(60)` (closes PITFALLS §1.5). RHF resolver-pattern with three-arg generic per Phase 4 D-11.
- **D-16:** `set_number` is **client-computed** at log-time: `set_number = existingSetsInCacheForThisExercise.length + 1`. No DB unique-constraint on `(session_id, exercise_id, set_number)` — duplicate-set_number from a hypothetical race is acceptable per "more data > losing data" (PITFALLS §1.1 mindset).

**F7 last-value rendering:**
- **D-17, D-18, D-19, D-20:** Set-position-aligned `Förra:`-chip per active set-row. Query source = the most-recent `workout_sessions WHERE finished_at IS NOT NULL` for the given `exercise_id`, excl. current session, grouped by `set_number`, filtered `set_type = 'working'`. Hook: `useLastValueQuery(exerciseId, currentSessionId)` returns `Map<setNumber, { weight_kg, reps, completed_at }>`. Pre-fetched on workout-screen mount (or `useStartSession.onSuccess`) — staleTime `15min`; offline-cache via persister. When data absent: chip not rendered.

**Session lifecycle:**
- **D-02:** Entry-point = "Starta pass" CTA on `plans/[id].tsx`. Tap calls `useStartSession.mutate({ id: randomUUID(), plan_id, user_id, started_at: new Date().toISOString() }, { onSuccess: () => router.push('/workout/<newId>') })`. The optimistic `onMutate` dual-writes `sessionsKeys.active()` + `sessionsKeys.detail(newId)` so the workout screen has data on push even offline.
- **D-03:** Dedicated route `/workout/[sessionId].tsx` on the (app) Stack — NOT a modal. User can navigate back to (tabs) mid-session; the session lives in the URL and the global `<ActiveSessionBanner />` provides the affordance to return.
- **D-21:** Cold-start draft-recovery on `(tabs)/index.tsx`. `useActiveSessionQuery()` (auto-enabled) → if hit, render inline-overlay-modal "Återuppta passet från [HH:MM]?" with "Återuppta" (`router.push('/workout/<id>')`) and "Avsluta sessionen" (`useFinishSession.mutate({ id, finished_at: now() })`). Modal triggered via `useFocusEffect` so it re-appears if the user backs into the tab from elsewhere (closes PITFALLS §1.6).
- **D-22:** Persistent `<ActiveSessionBanner />` mounted in `(tabs)/_layout.tsx` BELOW `<OfflineBanner />` and ABOVE `<Tabs>` inside the same `SafeAreaView edges={['top']}`. Subscriber to `useActiveSessionQuery()`. Tap → `router.push('/workout/<id>')`. Hidden inside `/workout/[sessionId]` itself via route-check.
- **D-23:** Avsluta-flow uses inline-overlay-confirm (Phase 4 commit `e07029a` pattern, NOT modal portal). Two copy variants: ≥1 set → "X set sparade. Avsluta passet?" / "Avsluta" (accent-blue, non-destructive); 0 sets → "Inget set är loggat. Avsluta utan att spara?" / "Avsluta utan att spara". **No Discard button** (closes PITFALLS §6.6). Tap "Avsluta" → `useFinishSession.mutate({ id, finished_at: new Date().toISOString() }, { onSuccess: () => router.replace('/(app)/(tabs)/'); /* trigger toast */ })`.
- **D-24:** "Passet sparat ✓" toast on `(tabs)/index.tsx` after successful finish — Reanimated `Animated.View` with `entering={FadeIn}` + `exiting={FadeOut.delay(2000)}`, success-green background.

### Claude's Discretion (planner picks)

- Exact `lib/queries/last-value.ts` API shape (Map vs nested object vs separate hook per `(exerciseId, setNumber)`)
- `<ActiveSessionBanner />` icon (clock vs play — UI-SPEC §Visuals locks to Ionicons `time`)
- Toast implementation (Reanimated `Animated.View` vs Zustand-flag-coordinated component — UI-SPEC §Toast specifies Reanimated)
- `useFocusEffect`-state-reset specifics for the workout screen (which local state to reset on blur — Phase 4 commit `af6930c` precedent)
- Numpad keyboard-dismiss trigger (`keyboardWillHide` event vs `Pressable onPress={Keyboard.dismiss}` on card background — UI-SPEC §Container hints at `keyboardDismissMode="on-drag"`)
- RHF mode for set-input-form (CONTEXT.md `<specifics>` says onSubmit per Phase 3 D-15 precedent; UI-SPEC §Inline error states confirms onSubmit)
- Empty-state on workout/[sessionId] when `plan_exercises.length === 0` (defensive UI vs router-guard — UI-SPEC §Empty-states specifies defensive UI with `Tillbaka till planen` CTA)
- Set-row visual differentiation logged-vs-empty (UI-SPEC §Visuals proposes `bg-white dark:bg-gray-900` for logged rows on `bg-gray-100 dark:bg-gray-800` card)

### Deferred Ideas (OUT OF SCOPE)

- F9 Historik-list + F10 graf-per-övning → Phase 6
- F11 RPE per set (schema-ready) → Phase 7
- F12 Notes per session (schema-ready) → Phase 7
- F15 dark-mode toggle UI → Phase 7
- F17-UI set-typ toggling (warmup/working/dropset/failure) → V1.1
- F18 PR-detection at finish → V1.1
- F19 Rest timer (`expo-notifications`/`expo-keep-awake`, JS-suspension trap per PITFALLS §6.5) → V1.1
- Soft-warn on weight > F7_max * 1.3 → V1.1 polish
- Ad-hoc exercise mid-session → V1.1
- 6h auto-finish cron for abandoned sessions → V1.1 if soak shows need
- F24 visible sync-state badge with pending-count → V2
- Senast-använda-övningar shortcut in workout → V1.1
- Apple Health integration / widgets / CSV export → V2 (F25-F27)
- Multi-device conflict resolution beyond LWW (CRDTs/vector clocks) → V2+
- Long-press meny on logged set-row (copy/repeat/comment) → V1.1
- Sparkline mini-graph per exercise-card (F10 territory inline) → V2

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| F5 | User can start a workout session from a plan; `workout_sessions` row created at "Starta pass" tap | §Active-Session Lifecycle (start flow), §`useStartSession` shape, §Schema (no migration needed — Phase 2 `0001_initial_schema.sql` already provides the row) |
| F6 | User can log a set (weight + reps) during a session; ≤3s from tap to local save; per-set persistence | §Per-Set Persistence Architecture, §`useAddSet` + Optimistic Cache, §Pitfalls 1.1/1.3/1.4 |
| F7 | User sees the previous value per exercise at logging time, **set-position-aligned** | §Set-Position-Aligned "Last Value" Query (SQL + hook shape), §Pitfalls 6.3 |
| F8 | User can finish and save the session via "Avsluta" — sets `finished_at`; no Discard button | §Active-Session Lifecycle (finish flow), §`useFinishSession` shape, §Pitfalls 6.6 |
| F13 | Sets logged offline must survive airplane-mode + force-quit + battery-pull and replay in correct order on reconnect | §Per-Set Persistence Architecture (full F13 reasoning), §F13 Brutal-Test Recipe, §Pitfalls 1.1/1.3/5.1/5.3/5.4/8.2 |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session lifecycle (create at start, mark finished_at at finish) | API / Backend (Supabase REST + RLS on `workout_sessions`) | Browser / Client (TanStack Query cache + optimistic dual-write) | RLS `Users can manage own sessions` enforces user-scoping at DB layer; cache is UX optimization. |
| Per-set logging | API / Backend (Supabase REST + RLS on `exercise_sets` via parent-session) | Browser / Client (TanStack Query paused-mutation queue + AsyncStoragePersister + client-UUID) | The "queue" IS TanStack v5's paused-mutations + persister; survives force-quit. RLS uses `EXISTS` subquery on `workout_sessions` for transitive ownership check. |
| F7 "previous value per exercise, aligned by set position" | API / Backend (Supabase REST query, RLS scopes naturally) | Browser / Client (TanStack Query cache with `staleTime: 15min` per exercise) | Two-step query (find most-recent finished session for exercise + fetch its working sets) executed via Supabase JS; results cached client-side for offline access. |
| Draft-session-recovery on cold-start | Browser / Client (`useActiveSessionQuery` hydrated from persister + UI overlay) | API / Backend (Supabase query refresh in background) | Cached active-session row hydrates before network resolves; offline cold-start still recovers. |
| ActiveSessionBanner global visibility | Browser / Client (subscriber to `useActiveSessionQuery()`) | — | Pure client-side; same query feeds the banner and the draft-recovery overlay. |
| Idempotent replay on reconnect | Browser / Client (client-UUID at `randomUUID()` + `.upsert({ onConflict: 'id', ignoreDuplicates: true })`) | Database (PK constraint on `exercise_sets.id`) | Schema accepts client-supplied UUIDs (Postgres `DEFAULT gen_random_uuid()` only fires when `id` is absent from the INSERT). Duplicate replay → DO NOTHING semantically. |
| FIFO scope ordering (start session → log sets → finish) | Browser / Client (TanStack v5 mutation scopes — `scope: { id: 'session:<id>' }`) | — | Pure client-side: scope serializes the in-flight mutation queue per session, so on reconnect the parent INSERT lands before child INSERTs, and finish UPDATE lands after all set INSERTs. |

## Project Constraints (from CLAUDE.md)

Non-negotiable directives the planner MUST honor:

- **Tech stack locked:** Expo SDK 54 + RN 0.81.5 + React 19.1 + Expo Router 6; TanStack Query 5.100.x (verified `5.100.10` is current latest [VERIFIED: `npm view @tanstack/react-query version` 2026-05-12]); Zustand 5.0.13; RHF 7.75 + Zod 4.4.3 + @hookform/resolvers 5.2.2; date-fns 4.1.0; @supabase/supabase-js 2.105+; NativeWind 4.2.3 + tailwindcss 3.4.x. No version bumps; no library substitutions.
- **iOS-only V1.** No Android-specific code paths.
- **Performance SLA: ≤3s from "log set" tap to local-save.** The optimistic-update writes synchronously to cache in `onMutate`; persister flush is throttled but the in-memory cache is the perceived "save" (the user sees the row immediately). Realistic latency budget: tap → Zod parse → mutate() → onMutate runs synchronously → cache write → re-render ≈ <100ms. The `useAddSet.mutate` returns immediately (offlineFirst); the network round-trip happens out-of-band.
- **Data integrity: NEVER lose a logged set.** The F13 contract. Driven by the per-set persistence model.
- **RLS mandatory** on all tables — Phase 2 already enabled it on `workout_sessions` + `exercise_sets`. Phase 5 adds NO new schema, so no new policies. **HOWEVER:** Phase 5 MUST extend `app/scripts/test-rls.ts` with cross-user CRUD assertions for both tables (CLAUDE.md "Cross-user verification is a gate" rule).
- **`(select auth.uid())` wrap + `with check` on every writable policy** — already in place per Phase 2 `0001_initial_schema.sql` (verified lines 137–144: `Users can manage own sessions` and `Users can manage own sets` both have `using` + `with check` and both wrap `auth.uid()`).
- **Service-role isolation.** No change in Phase 5 surface area; service-role audit gate stays clean.
- **Sessions in `expo-secure-store` via `LargeSecureStore`** — Phase 1 wired; Phase 5 doesn't touch auth.
- **Zod for ALL external data** — every Supabase response in new resource hooks (`sessions.ts`, `sets.ts`, `last-value.ts`) MUST `parse()`, not cast. PITFALLS §8.13.
- **Migration-as-truth** — Phase 5 adds NO migrations. The Phase 2 schema is already complete for sessions+sets.
- **Type-gen** runs after every schema migration. Since Phase 5 adds none, `app/types/database.ts` does NOT change.
- **kebab-case filenames** — `last-value.ts`, `active-session-banner.tsx`, `workout/[sessionId].tsx`.
- **Path-alias `@/*` → `./*`** — established Phase 1.
- **`mutate(payload, { onError, onSuccess })` convention** — Phase 4 Plan 04-04 commit `5d953b6` proved `mutateAsync` is **unsafe** under `networkMode: 'offlineFirst'` because paused mutations never resolve the awaitable. ALL Phase 5 submit-flows use `mutate(...)`, never `mutateAsync(...)`.
- **Inline-overlay-confirm pattern (Phase 4 commit `e07029a`)** for draft-resume modal + Avsluta-confirm; NOT modal portal.
- **`freezeOnBlur: true` + `useFocusEffect` state-reset** (Phase 4 commit `af6930c`) for workout-screen local state.

## Stack & Library Versions Confirmed (May 2026)

All versions verified against npm registry and the existing `app/package.json` on 2026-05-12.

### Already installed (Phase 1–4 inheritance — nothing new required)

| Library | Installed version | Verification | Phase 5 use |
|---------|-------------------|--------------|-------------|
| `expo` | `~54.0.33` | [VERIFIED: package.json] | base SDK |
| `react` | `19.1.0` | [VERIFIED: transitive] | base |
| `react-native` | `0.81.5` | [VERIFIED: transitive] | base |
| `expo-router` | `~6.0.23` | [VERIFIED: package.json] | `/workout/[sessionId]` route |
| `@tanstack/react-query` | `^5.100.9` (current `5.100.10`) | [VERIFIED: npm view 2026-05-12] | mutation queue + cache |
| `@tanstack/query-async-storage-persister` | `^5.100.9` | [VERIFIED: package.json] | `createAsyncStoragePersister({ throttleTime: 500 })` |
| `@tanstack/react-query-persist-client` | `^5.100.9` | [VERIFIED: package.json] | `persistQueryClient` |
| `@react-native-async-storage/async-storage` | `2.2.0` | [VERIFIED: package.json] | persister backing store |
| `@react-native-community/netinfo` | `11.4.1` | [VERIFIED: package.json] | `onlineManager` source |
| `@supabase/supabase-js` | `^2.105.4` | [VERIFIED: package.json] | REST client |
| `react-hook-form` | `^7.75.0` | [VERIFIED: package.json] | set-row form |
| `@hookform/resolvers` | `^5.2.2` | [VERIFIED: package.json] | Zod resolver |
| `zod` | `^4.4.3` | [VERIFIED: package.json] | set/session schemas |
| `date-fns` | `^4.1.0` | [VERIFIED: package.json] | `format(startedAt, 'HH:mm')` for draft-recovery copy |
| `expo-crypto` | `~15.0.9` (SDK 54 line — [VERIFIED: `npm view expo-crypto dist-tags`: `sdk-54: 15.0.9`, `latest: 55.0.14` 2026-05-12]) | [VERIFIED: package.json] | `randomUUID()` via `lib/utils/uuid.ts` wrapper |
| `react-native-gesture-handler` | `~2.28.0` | [VERIFIED: package.json] | swipe-left set-row delete |
| `react-native-reanimated` | `~4.1.1` | [VERIFIED: package.json] | toast `FadeIn`/`FadeOut.delay(2000)` |
| `@expo/vector-icons` | `^15.0.3` | [VERIFIED: package.json] | Ionicons (`time`, `flag`, `checkmark-circle`, `trash-outline`, `play`) |
| `react-native-safe-area-context` | `~5.6.0` | [VERIFIED: package.json] | ActiveSessionBanner top-inset slot |

### NEW dependencies entering Phase 5

**ZERO new packages required.** Phase 5 is plumbing + UI on top of the Phase 1–4 stack.

**Optional (Plan 02 discretion per UI-SPEC §Registry):** `expo-haptics` (`npx expo install expo-haptics`) for `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` on Klart-tap. Default = off per CONTEXT.md `<deferred>`.

## Per-Set Persistence Architecture

This is the load-bearing section. F13 lives or dies here. The architecture is **already** specified by Phase 4 D-01/D-04/D-07 + CONTEXT.md D-12/D-13/D-25; this section is the operational recipe.

### The single architecture (no alternatives — locked by CONTEXT.md)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Component layer (workout/[sessionId].tsx — single screen)            │
│   useAddSet(sessionId).mutate({                                       │
│     id: randomUUID(),                                                 │
│     session_id, exercise_id,                                          │
│     set_number: clientCount+1,                                        │
│     weight_kg, reps,                                                  │
│     completed_at: new Date().toISOString(),                           │
│     set_type: 'working',                                              │
│   })                                                                  │
│                                                                       │
│  - mutationKey: ['set','add']  (registered in lib/query/client.ts)   │
│  - scope:     { id: `session:${sessionId}` }  (set at useMutation)   │
│  - NO inline mutationFn — defaults own it (PITFALLS §8.1)            │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼  (immediately — synchronous)
┌─────────────────────────────────────────────────────────────────────┐
│ onMutate (in setMutationDefaults):                                   │
│   await cancelQueries({ queryKey: setsKeys.list(sessionId) })        │
│   const previous = getQueryData<SetRow[]>(setsKeys.list(sessionId))  │
│   setQueryData<SetRow[]>(setsKeys.list(sessionId),                   │
│     (old = []) => [...old, vars as SetRow])                          │
│   return { previous }                                                 │
│  → UI re-renders with new row in <100ms                              │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼  (asynchronously — after onMutate returns)
┌─────────────────────────────────────────────────────────────────────┐
│ mutationFn (in setMutationDefaults):                                 │
│   if (onlineManager.isOnline()) {                                    │
│     await supabase.from('exercise_sets')                             │
│       .upsert(vars, { onConflict: 'id', ignoreDuplicates: true })    │
│       .select().single()                                              │
│     return SetRowSchema.parse(data)                                  │
│   } else {                                                            │
│     // networkMode: 'offlineFirst' has already PAUSED this mutation  │
│     // before mutationFn ran. The mutation sits in the cache as      │
│     // isPaused=true with its variables.                             │
│   }                                                                   │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼  (if paused — TanStack writes to persister cache)
┌─────────────────────────────────────────────────────────────────────┐
│ AsyncStoragePersister                                                 │
│   throttleTime: 500ms  (lowered from 1000ms per CONTEXT.md D-25)     │
│   Serializes paused mutations + query cache to AsyncStorage           │
│   Triggered: on every mutation cache mutation (subject to throttle)   │
│              + on AppState 'background'/'inactive' (D-25 flush)       │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼  (on next online transition — `onlineManager.subscribe`)
┌─────────────────────────────────────────────────────────────────────┐
│ queryClient.resumePausedMutations()                                  │
│   For every paused mutation:                                          │
│     1. Look up its setMutationDefaults entry by mutationKey           │
│     2. Re-execute the mutationFn with the stored variables            │
│     3. Within a scope.id, mutations replay in registration order      │
│        (FIFO) — so set 1 lands before set 2 before set 25             │
│        AND the parent ['session','start'] (same scope) lands first    │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Supabase REST (PostgREST + RLS)                                       │
│   INSERT exercise_sets WITH client-supplied id (PK)                   │
│   .upsert({ onConflict: 'id', ignoreDuplicates: true }) →             │
│     ON CONFLICT (id) DO NOTHING → idempotent replay                   │
│   RLS policy: `Users can manage own sets` via EXISTS subquery on      │
│     workout_sessions where user_id = (select auth.uid())              │
└─────────────────────────────────────────────────────────────────────┘
```

### Exact `lib/query/client.ts` extension (5 new setMutationDefaults blocks)

Each new block follows the Phase 4 pattern verbatim. The planner reads Phase 4's `app/lib/query/client.ts` lines 168–495 and replicates the pattern.

```typescript
// ===========================================================================
// 9) ['session','start'] — workout_sessions INSERT (idempotent upsert)
// scope.id = `session:${vars.id}` — set at useMutation call-site
// Dual-write onMutate: sessionsKeys.active() AND sessionsKeys.detail(vars.id)
// so the workout screen has the session row instantly via initialData.
// ===========================================================================
queryClient.setMutationDefaults(['session','start'], {
  mutationFn: async (vars: SessionInsertVars) => {
    const { data, error } = await supabase
      .from('workout_sessions')
      .upsert(vars, { onConflict: 'id', ignoreDuplicates: true })
      .select().single();
    if (error) throw error;
    return SessionRowSchema.parse(data);
  },
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: sessionsKeys.active() });
    await queryClient.cancelQueries({ queryKey: sessionsKeys.detail(vars.id) });
    const previousActive = queryClient.getQueryData<SessionRow | null>(sessionsKeys.active());
    const previousDetail = queryClient.getQueryData<SessionRow>(sessionsKeys.detail(vars.id));
    queryClient.setQueryData<SessionRow>(sessionsKeys.active(), vars as SessionRow);
    queryClient.setQueryData<SessionRow>(sessionsKeys.detail(vars.id), vars as SessionRow);
    return { previousActive, previousDetail };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as { previousActive?: SessionRow | null; previousDetail?: SessionRow } | undefined;
    queryClient.setQueryData(sessionsKeys.active(), c?.previousActive ?? null);
    queryClient.setQueryData(sessionsKeys.detail(vars.id), c?.previousDetail);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.active() });
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(vars.id) });
  },
  retry: 1,
});

// ===========================================================================
// 10) ['session','finish'] — workout_sessions UPDATE finished_at = now()
// scope.id = `session:${vars.id}` — set at useMutation call-site
// Optimistic: clear active-session cache (since active = finished_at IS NULL)
// ===========================================================================
queryClient.setMutationDefaults(['session','finish'], {
  mutationFn: async (vars: SessionFinishVars) => {
    const { data, error } = await supabase
      .from('workout_sessions')
      .update({ finished_at: vars.finished_at })
      .eq('id', vars.id)
      .select().single();
    if (error) throw error;
    return SessionRowSchema.parse(data);
  },
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: sessionsKeys.active() });
    await queryClient.cancelQueries({ queryKey: sessionsKeys.detail(vars.id) });
    const previousActive = queryClient.getQueryData<SessionRow | null>(sessionsKeys.active());
    const previousDetail = queryClient.getQueryData<SessionRow>(sessionsKeys.detail(vars.id));
    queryClient.setQueryData<SessionRow | null>(sessionsKeys.active(), null);
    if (previousDetail) {
      queryClient.setQueryData<SessionRow>(sessionsKeys.detail(vars.id), {
        ...previousDetail,
        finished_at: vars.finished_at,
      });
    }
    return { previousActive, previousDetail };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as { previousActive?: SessionRow | null; previousDetail?: SessionRow } | undefined;
    queryClient.setQueryData(sessionsKeys.active(), c?.previousActive);
    if (c?.previousDetail) queryClient.setQueryData(sessionsKeys.detail(vars.id), c.previousDetail);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.active() });
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(vars.id) });
  },
  retry: 1,
});

// ===========================================================================
// 11) ['set','add'] — exercise_sets INSERT (idempotent upsert)
// scope.id = `session:${vars.session_id}` — set at useMutation call-site
// Optimistic: append to setsKeys.list(session_id) cache
// ===========================================================================
queryClient.setMutationDefaults(['set','add'], {
  mutationFn: async (vars: SetInsertVars) => {
    if (!vars.session_id) throw new Error("session_id required for ['set','add']");
    const { data, error } = await supabase
      .from('exercise_sets')
      .upsert(vars, { onConflict: 'id', ignoreDuplicates: true })
      .select().single();
    if (error) throw error;
    return SetRowSchema.parse(data);
  },
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: setsKeys.list(vars.session_id) });
    const previous = queryClient.getQueryData<SetRow[]>(setsKeys.list(vars.session_id));
    queryClient.setQueryData<SetRow[]>(setsKeys.list(vars.session_id), (old = []) => [
      ...old,
      vars as SetRow,
    ]);
    return { previous };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as { previous?: SetRow[] } | undefined;
    if (c?.previous) queryClient.setQueryData(setsKeys.list(vars.session_id), c.previous);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({ queryKey: setsKeys.list(vars.session_id) });
  },
  retry: 1,
});

// ===========================================================================
// 12) ['set','update'] — exercise_sets UPDATE (id + partial)
// scope.id = `session:${vars.session_id}` — set at useMutation call-site
// REQUIRES vars.session_id at call-site so scope can compute the key.
// ===========================================================================
queryClient.setMutationDefaults(['set','update'], {
  mutationFn: async (vars: SetUpdateVars) => {
    if (!vars.session_id) throw new Error("session_id required for scope on ['set','update']");
    const { id, session_id: _sid, ...rest } = vars;
    void _sid;
    const { data, error } = await supabase
      .from('exercise_sets')
      .update(rest)
      .eq('id', id)
      .select().single();
    if (error) throw error;
    return SetRowSchema.parse(data);
  },
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: setsKeys.list(vars.session_id) });
    const previous = queryClient.getQueryData<SetRow[]>(setsKeys.list(vars.session_id));
    if (previous) {
      queryClient.setQueryData<SetRow[]>(setsKeys.list(vars.session_id),
        previous.map((r) => (r.id === vars.id ? { ...r, ...vars } as SetRow : r)),
      );
    }
    return { previous };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as { previous?: SetRow[] } | undefined;
    if (c?.previous) queryClient.setQueryData(setsKeys.list(vars.session_id), c.previous);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({ queryKey: setsKeys.list(vars.session_id) });
  },
  retry: 1,
});

// ===========================================================================
// 13) ['set','remove'] — exercise_sets DELETE
// scope.id = `session:${vars.session_id}` — set at useMutation call-site
// ===========================================================================
queryClient.setMutationDefaults(['set','remove'], {
  mutationFn: async (vars: SetRemoveVars) => {
    if (!vars.session_id) throw new Error("session_id required for scope on ['set','remove']");
    const { error } = await supabase.from('exercise_sets').delete().eq('id', vars.id);
    if (error) throw error;
    return undefined as void;
  },
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: setsKeys.list(vars.session_id) });
    const previous = queryClient.getQueryData<SetRow[]>(setsKeys.list(vars.session_id));
    queryClient.setQueryData<SetRow[]>(setsKeys.list(vars.session_id),
      (old = []) => old.filter((r) => r.id !== vars.id),
    );
    return { previous };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as { previous?: SetRow[] } | undefined;
    if (c?.previous) queryClient.setQueryData(setsKeys.list(vars.session_id), c.previous);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({ queryKey: setsKeys.list(vars.session_id) });
  },
  retry: 1,
});
```

### Idempotent insert SQL pattern (Postgres + Supabase JS)

Same pattern as Phase 4 — verified to work with the existing `0001_initial_schema.sql`:

- `exercise_sets.id` is `uuid primary key default gen_random_uuid()`. Postgres `DEFAULT` only fires when `id` is **absent** from the INSERT. Supplying `id` overrides it (Postgres semantics — [CITED: PostgreSQL docs]).
- `.upsert(vars, { onConflict: 'id', ignoreDuplicates: true })` issues `INSERT ... ON CONFLICT (id) DO NOTHING` instead of `DO UPDATE`. [VERIFIED: Context7 `/supabase/supabase-js` 2026-05-10 via Phase 4 RESEARCH §5.] On replay of a paused mutation whose row already exists server-side, the upsert returns no error and the optimistic cache stays intact.
- For UPDATE flows (`useUpdateSet`, `useFinishSession`): `.update(rest).eq('id', id)` is inherently idempotent — running the same UPDATE twice writes the same final state.
- For DELETE flow (`useRemoveSet`): `.delete().eq('id', id)` is idempotent — second delete is a no-op.

### Replay-order guarantees (FIFO within scope)

**The contract that makes F13 work:**

1. All session-lifecycle + set-mutations for a given session share `scope: { id: 'session:<sessionId>' }`.
2. TanStack v5 enforces serial replay within a scope ([VERIFIED: Phase 4 RESEARCH §5; query-core `mutationCache.js:118–120` `scopeFor(mutation) = mutation.options.scope?.id`]).
3. Mutations within a scope replay in **registration order** (FIFO) — the order they were enqueued during the offline window.
4. Therefore, on reconnect after a 25-set offline workout: `['session','start']` replays first → 25× `['set','add']` replay in their tap-order → `['session','finish']` replays last (if the user already tapped Avsluta).
5. FK safety holds because the parent `workout_sessions` row INSERTs before any child `exercise_sets` row. Phase 4 proved this for `workout_plans` → `plan_exercises`; Phase 5 uses the same plumbing.

**Phase 4 Plan 04-01 critical learning (must be replicated):** TanStack v5 `scope.id` is a STATIC string read at instantiation time via `mutation.options.scope?.id` with `typeof === 'string'` gate. A function-shaped scope.id **silently fails** and the mutation does NOT enter the scope map — serial-replay grouping is broken. Phase 5 resource hooks MUST accept `sessionId` as a parameter and bake `scope: { id: 'session:<sessionId>' }` into the `useMutation` call at hook construction. See Phase 4 `app/lib/queries/plan-exercises.ts` for the canonical pattern.

```typescript
// lib/queries/sets.ts (Phase 5 NEW)
export function useAddSet(sessionId: string) {
  return useMutation<SetRow, Error, SetInsertVars>({
    mutationKey: ['set', 'add'] as const,
    scope: { id: `session:${sessionId}` },
  });
}

export function useUpdateSet(sessionId: string) {
  return useMutation<SetRow, Error, SetUpdateVars>({
    mutationKey: ['set', 'update'] as const,
    scope: { id: `session:${sessionId}` },
  });
}

export function useRemoveSet(sessionId: string) {
  return useMutation<void, Error, SetRemoveVars>({
    mutationKey: ['set', 'remove'] as const,
    scope: { id: `session:${sessionId}` },
  });
}
```

### Durability gates (CONTEXT.md D-25 — closes Phase 4 D-02 deferral)

**1. Persister throttle:** lower `throttleTime` from default `1000ms` → `500ms` for mutation persistence. Reduces the "lose the last mutation on force-quit" window to ≤500ms.

```typescript
// lib/query/persister.ts (Phase 5 modification)
const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 500, // Phase 5 D-25 — lowered from default 1000 for hot-path durability
});
```

[ASSUMED] `throttleTime` is the correct option name for `createAsyncStoragePersister` in v5.100.x. The Phase 4 setup uses defaults; Plan 02 should verify the option-name via Context7 or by reading `@tanstack/query-async-storage-persister` package source if it doesn't resolve. Fallback: pass through `{ storage, throttleTime: 500 }` and verify a unit test that the persister fires within 500ms of a mutation.

**2. AppState flush on background:** extend `lib/query/network.ts` with an AppState listener that flushes the persister synchronously when the app backgrounds or becomes inactive.

```typescript
// lib/query/network.ts (Phase 5 addition — appended after existing AppState/NetInfo wiring)
import { persister } from '@/lib/query/persister'; // re-export the persister instance

AppState.addEventListener('change', (state) => {
  if (Platform.OS !== 'web' && (state === 'background' || state === 'inactive')) {
    // Fire-and-forget — flush whatever is in the throttle buffer to disk
    void persister.persistClient();
  }
});
```

**Implementation note:** `lib/query/persister.ts` currently doesn't export the persister instance — only calls `persistQueryClient` for side-effect. Plan 02 must refactor `persister.ts` to export the `asyncStoragePersister` instance so `network.ts` can call `persistClient()` on it. Alternatively, call `persistQueryClient`'s underlying mechanism by importing and calling the persister's `persistClient()` method.

[ASSUMED] The `createAsyncStoragePersister` return value exposes a `persistClient()` method for ad-hoc flush. Plan 02 verifies via Context7 or package source. Worst-case fallback: re-create the persister, or use the lower-level `Persister` interface and serialize/write manually.

**3. NO redundant Zustand pending-store** — CONTEXT.md D-25 explicitly rejects this. Phase 4 already validated that TanStack persister + client-UUID + scope.id replay is sufficient for plan-CRUD. The same plumbing handles sets; if V1 personal soak reveals dropped sets, V1.1 adds it as belt-and-braces.

## Draft-Session-Recovery

### Query timing & placement

**Hook:** `useActiveSessionQuery()` lives in `lib/queries/sessions.ts`. Auto-enabled (no `enabled: false`); fires on mount.

**Mount location:** `(tabs)/index.tsx` AND `(tabs)/_layout.tsx` (the latter for `<ActiveSessionBanner />`). Same hook, same queryKey (`sessionsKeys.active()`), so TanStack deduplicates fetches — both consumers share one network call.

**Cold-start order:**
1. Native splash holds via `expo-splash-screen` until `useAuthStore.status !== 'loading'` (Phase 3 D-04 inheritance).
2. `app/_layout.tsx` imports `@/lib/query/client` → `@/lib/query/persister` → `@/lib/query/network` in that order (Phase 4 module-load contract).
3. Persister hydrates the cache from AsyncStorage — including any cached `sessionsKeys.active()` result from the previous app session.
4. `<RootNavigator />` renders; `(tabs)/_layout.tsx` mounts `<ActiveSessionBanner />` which fires `useActiveSessionQuery()`.
5. If persister hydrated a `workout_sessions` row with `finished_at IS NULL`, the banner renders **immediately** from cache via `initialData` (no spinner).
6. The query's `queryFn` runs in the background to refresh from Supabase; if offline (`networkMode: 'offlineFirst'`), cache stays.
7. `(tabs)/index.tsx` mounts; `useActiveSessionQuery()` returns same cached value; inline-overlay-modal renders if `activeSession !== null && !dismissed`.

### Query SQL shape

```typescript
// lib/queries/sessions.ts
export function useActiveSessionQuery() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<SessionRow | null>({
    queryKey: sessionsKeys.active(),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', userId)
        .is('finished_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? SessionRowSchema.parse(data) : null;
    },
    enabled: !!userId,
  });
}
```

**Why `.maybeSingle()` not `.single()`:** `.single()` errors if 0 rows; `.maybeSingle()` returns `null`. The expected state for a freshly-signed-in user with no active session is null, not an error.

**Why filter `user_id` client-side AND let RLS scope server-side:** belt-and-braces. RLS guarantees the server returns 0 rows for other users; the explicit `eq('user_id', userId)` lets the planner reason about the query semantics without RLS in their head. No security cost — both apply.

### UI flow

Per CONTEXT.md D-21 + UI-SPEC §Copywriting Contract / §Visuals:

1. `(tabs)/index.tsx` mounts → `useActiveSessionQuery()` returns row.
2. Local state `[dismissed, setDismissed] = useState(false)` gates whether the overlay renders.
3. `useFocusEffect(() => { setDismissed(false); }, [])` resets dismiss on re-focus so the overlay re-appears if the user backs into the tab without resolving the draft.
4. Inline-overlay-modal (Phase 4 commit `e07029a` pattern — `<View className="absolute inset-0 bg-black/40">` + centered panel):
   - Title: `Återuppta passet?`
   - Body (≥1 set logged): `Du har ett pågående pass från [HH:MM] med [N] set sparade.` — `HH:MM` formatted via `date-fns format(new Date(activeSession.started_at), 'HH:mm')`; N from `useSetsForSessionQuery(activeSession.id)` cached count.
   - Body (0 sets): `Du startade ett pass [HH:MM] men har inte loggat något set än.`
   - Primary `Återuppta` (accent-blue): `router.push('/workout/<id>')` + `setDismissed(true)`.
   - Secondary `Avsluta sessionen` (red — destructive variant in this context only, per UI-SPEC §Color): `useFinishSession.mutate({ id, finished_at: new Date().toISOString() }, { onSuccess: () => { setDismissed(true); /* trigger toast */ } })`.

**No backdrop tap-to-dismiss on this overlay** (UI-SPEC §Copywriting — "Overlay does NOT have a 'X' close affordance"). Force-decision UX for data-loss-adjacent state.

### Multi-draft edge case (CONTEXT.md `<deferred>` decision)

PROJECT.md scope is V1 single-device. Multi-draft can only occur if (a) user signs in on a second device (out of scope) OR (b) `useFinishSession` mutation errored out and left a stale draft + the user created a new session. For (b), the `.order('started_at', { ascending: false }).limit(1)` semantics in `useActiveSessionQuery` picks the **most recent** draft. The older orphan stays in the DB but is invisible to the user. V1.1 can add a "abandoned sessions cleanup" cron OR a Settings-tab "view orphaned sessions" UI; V1 accepts this edge case.

### Offline cold-start

If the user is offline at cold-start:
1. Persister hydrates cache. If the previous session left `sessionsKeys.active()` in the cache, it surfaces immediately.
2. `useActiveSessionQuery`'s `queryFn` runs but the Supabase fetch fails / pauses under `networkMode: 'offlineFirst'`.
3. UI renders the overlay using the cached row.
4. User taps Återuppta → routes to `/workout/<id>` → `useSessionQuery(id)` seeds from `sessionsKeys.detail(id)` via `initialData` (which was dual-written by `['session','start']` onMutate when the session was originally created), OR seeds from the active-session cache.

**Critical:** the `sessionsKeys.detail(id)` cache MUST be dual-written by `useStartSession.onMutate` (Phase 4 Plan 04-04 pattern — commit `eca0540` + `b87bddf`). Without this, an offline cold-start would route the user to `/workout/<id>` and the screen would render "Laddar…" forever because `useSessionQuery(id)` has no cache to hydrate from and the fetch is paused.

## Active-Session Hosting

### Where the banner mounts

`<ActiveSessionBanner />` mounts in `(tabs)/_layout.tsx`, **below** `<OfflineBanner />` and **above** `<Tabs>`, inside the same `SafeAreaView edges={['top']}` slot established by Phase 4 D-05.

```typescript
// (tabs)/_layout.tsx (Phase 5 modification)
return (
  <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
    <OfflineBanner />
    <ActiveSessionBanner /> {/* NEW Phase 5 — D-22 */}
    <Tabs screenOptions={{ ... }}>
      ...
    </Tabs>
  </SafeAreaView>
);
```

### How the banner learns of the active session

The banner subscribes to `useActiveSessionQuery()`. Same hook, same queryKey, same cache as `(tabs)/index.tsx`'s draft-recovery overlay — TanStack deduplicates the fetch.

```typescript
// app/components/active-session-banner.tsx
export function ActiveSessionBanner() {
  const router = useRouter();
  const { data: activeSession } = useActiveSessionQuery();
  const pathname = usePathname();

  // Hide banner when user is already inside /workout/[sessionId]
  // (UI-SPEC §Visuals — banner conditionally hidden via route-check)
  const isOnWorkoutScreen = pathname?.startsWith('/workout/');
  if (!activeSession || isOnWorkoutScreen) return null;

  return (
    <Pressable
      onPress={() => router.push(`/workout/${activeSession.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel="Återgå till pågående pass"
      className="flex-row items-center justify-between gap-2 bg-blue-100 dark:bg-blue-950 border border-blue-300 dark:border-blue-800 px-4 py-3 mx-4 mt-2 rounded-lg active:opacity-80"
    >
      {/* …UI-SPEC §ActiveSessionBanner structure… */}
    </Pressable>
  );
}
```

### Cross-tab visibility & dismissal lifecycle

- Banner is visible across **all three tabs** (Planer, Historik, Inställningar) when `activeSession !== null`.
- Hidden inside the workout screen itself (route-check via `usePathname()` or `useSegments()`).
- The only way to remove the banner is to finish the session via the Avsluta-overlay (or from the draft-recovery modal). No close (✕) affordance — adding one would hide the recovery affordance for the in-progress session.
- When the user finishes the session, `useFinishSession.onMutate` sets `sessionsKeys.active()` to `null` optimistically → banner subscriber re-evaluates → banner unmounts immediately.

### `useSessionQuery(id)` with initialData (Phase 4 Plan 04-04 pattern)

For the workout screen to render the session row offline, `useSessionQuery(id)` needs `initialData` that falls back to the active-session cache:

```typescript
// lib/queries/sessions.ts
export function useSessionQuery(id: string) {
  return useQuery<SessionRow>({
    queryKey: sessionsKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions').select('*').eq('id', id).single();
      if (error) throw error;
      return SessionRowSchema.parse(data);
    },
    enabled: !!id,
    initialData: () => {
      const active = queryClient.getQueryData<SessionRow | null>(sessionsKeys.active());
      return active?.id === id ? active : undefined;
    },
  });
}
```

Per Phase 4 Plan 04-04 commit `b87bddf` SUMMARY: `initialData` makes TanStack v5 start the query at `status='success'` regardless of any background fetch state, so the workout screen never renders "Laddar…" for an in-progress session.

## Set-Position-Aligned "Last Value" Query

### The SQL pattern

For F7 we need: **"For this exercise, give me the working sets from the user's most-recent finished session of that exercise, indexed by set_number."**

**Two-step query (preferred — simpler, RLS-safe, cacheable per-exercise):**

```typescript
// lib/queries/last-value.ts
export function useLastValueQuery(exerciseId: string, currentSessionId: string) {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<Map<number, { weight_kg: number; reps: number; completed_at: string }>>({
    queryKey: lastValueKeys.byExercise(exerciseId),
    queryFn: async () => {
      if (!userId) return new Map();

      // STEP 1: find the most-recent finished session that contains this exercise
      //         (and is not the current session).
      const { data: sessionRow, error: sessionErr } = await supabase
        .from('exercise_sets')
        .select('session_id, completed_at, workout_sessions!inner(id, user_id, finished_at, started_at)')
        .eq('exercise_id', exerciseId)
        .eq('set_type', 'working')
        .not('workout_sessions.finished_at', 'is', null)  // only finished sessions
        .neq('session_id', currentSessionId)              // exclude current
        .eq('workout_sessions.user_id', userId)           // belt-and-braces (RLS also scopes)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sessionErr) throw sessionErr;
      if (!sessionRow) return new Map();
      const targetSessionId = sessionRow.session_id;

      // STEP 2: fetch all working sets from that session for this exercise,
      //         ordered by set_number.
      const { data: sets, error: setsErr } = await supabase
        .from('exercise_sets')
        .select('set_number, weight_kg, reps, completed_at')
        .eq('session_id', targetSessionId)
        .eq('exercise_id', exerciseId)
        .eq('set_type', 'working')
        .order('set_number', { ascending: true });
      if (setsErr) throw setsErr;

      const map = new Map<number, { weight_kg: number; reps: number; completed_at: string }>();
      for (const s of sets ?? []) {
        const parsed = SetRowSchema.partial().parse(s); // partial — only the columns we selected
        if (parsed.set_number != null && parsed.weight_kg != null && parsed.reps != null && parsed.completed_at != null) {
          map.set(parsed.set_number, {
            weight_kg: parsed.weight_kg,
            reps: parsed.reps,
            completed_at: parsed.completed_at,
          });
        }
      }
      return map;
    },
    enabled: !!exerciseId && !!userId,
    staleTime: 1000 * 60 * 15, // 15 min — CONTEXT.md D-20
  });
}
```

**Index coverage:** `idx_exercise_sets_exercise(exercise_id, completed_at desc)` (verified in `0001_initial_schema.sql` line 89) covers the STEP 1 ordering — Postgres can use the index to find the most-recent row for the exercise without a full-table scan. STEP 2's `(session_id, exercise_id)` filter benefits from `idx_exercise_sets_session(session_id)` (line 88).

**Performance for a 10-exercise plan × 4 sets:** 10 exercises × 1 STEP 1 query + 10 × 1 STEP 2 query = 20 round-trips. CONTEXT.md D-20 pre-fetches on workout-screen mount with `staleTime: 15min`; per-exercise queryKey (`lastValueKeys.byExercise(exerciseId)`) so each runs in parallel via React Query's concurrent-fetch behavior. Plan 02 may batch via a single PostgREST query (`select * from exercise_sets where exercise_id in (...) and set_type='working' order by ...`) and do the most-recent-session grouping client-side; the two-step approach is simpler to reason about and was specified by CONTEXT.md.

**RLS interaction:** the `workout_sessions!inner(...)` join in STEP 1 is RLS-scoped by the `Users can manage own sessions` policy (via `user_id = (select auth.uid())`); the explicit `.eq('workout_sessions.user_id', userId)` is redundant but defensive. STEP 2's query is RLS-scoped via the `EXISTS` subquery in `Users can manage own sets`.

[ASSUMED] Supabase PostgREST `select` with embedded resource via `!inner` syntax correctly applies RLS to the joined table. Plan 02 verifies via the cross-user RLS extension in `test-rls.ts`.

### Alternative: Window function via Postgres view (out of V1 scope)

A single-query window-function approach (`ROW_NUMBER() OVER (PARTITION BY exercise_id ORDER BY completed_at DESC)`) would require either (a) a Postgres view or (b) a Supabase RPC. Both are new schema artifacts — out of CONTEXT.md scope. V1.1 can refactor if the two-step approach shows latency issues in soak.

### Hook return shape

`Map<setNumber, { weight_kg, reps, completed_at }>` per CONTEXT.md D-18 + UI-SPEC. The card's set-input row reads `map.get(currentSetNumber)` and renders the chip if hit. Components handle "no data" by checking `map.has(currentSetNumber) === false` and omitting the chip.

## `useAddSet` + Optimistic Cache

The mutation shape is detailed in §Per-Set Persistence Architecture above. Here is the **call-site usage** in the workout-screen exercise card.

### Mutation call shape

```typescript
// app/app/(app)/workout/[sessionId].tsx (inside ExerciseCard sub-component)
const addSet = useAddSet(sessionId);

const onKlart = (input: { weight_kg: number; reps: number }) => {
  if (!sessionId || !exerciseId) return;
  // Count existing logged sets in cache for this exercise to compute set_number.
  const allSets = queryClient.getQueryData<SetRow[]>(setsKeys.list(sessionId)) ?? [];
  const setsForThisExercise = allSets.filter((s) => s.exercise_id === exerciseId);
  const setNumber = setsForThisExercise.length + 1;

  addSet.mutate(
    {
      id: randomUUID(),
      session_id: sessionId,
      exercise_id: exerciseId,
      set_number: setNumber,
      weight_kg: input.weight_kg,
      reps: input.reps,
      completed_at: new Date().toISOString(),
      set_type: 'working',
    },
    {
      onSuccess: () => {
        // Reset RHF form to either blank or pre-filled from new latest per D-10
        reset({ weight_kg: input.weight_kg, reps: input.reps });
      },
      onError: () => {
        // Optimistic onMutate already wrote the row; setMutationDefaults onError
        // rolled back. Surface a screen-level banner so the user knows replay failed.
        setBannerError('Något gick fel när set sparades. Försök igen.');
      },
    },
  );
};
```

### Cache invalidation strategy

- `setMutationDefaults['set','add'].onSettled` calls `invalidateQueries({ queryKey: setsKeys.list(sessionId) })`. After the server confirms, the list refetches and reconciles cache with server truth.
- **NO invalidation of `lastValueKeys`** on a set add — the F7 last-value query is scoped to **finished** sessions, so logging a set in the active session doesn't change the F7 data. (When the session is finished via `useFinishSession`, plan 02 may invalidate `lastValueKeys.all` so the next session's F7 reflects this session's working sets. CONTEXT.md doesn't specify; recommendation: invalidate on finish.)
- **NO invalidation of `sessionsKeys`** on a set add — the session row is unchanged.

### Optimistic update interaction with offline queue

The `onMutate` runs **synchronously** before the mutation queue evaluates `networkMode: 'offlineFirst'`. So even when offline:
1. User taps Klart.
2. `mutate()` is called.
3. `onMutate` runs synchronously — cache is updated, UI re-renders showing the new row.
4. TanStack then evaluates: am I online? `onlineManager.isOnline() === false` → mutation enters `isPaused: true` state without firing `mutationFn`.
5. Persister serializes the paused mutation (subject to `throttleTime: 500`) to AsyncStorage.
6. On AppState background, the AppState flush forces immediate persistence (closes the throttle window).
7. On reconnect, `onlineManager.subscribe` callback fires `queryClient.resumePausedMutations()` → mutation's `mutationFn` runs against Supabase → idempotent `.upsert` either inserts or no-ops.

The user **sees their set logged in the cache from millisecond zero** regardless of network state. This is the ≤3s SLA delivery mechanism (PROJECT.md performance constraint).

## Active-Session Lifecycle

### Starta-pass flow (D-02 + CONTEXT.md `<canonical_refs>`)

```typescript
// app/app/(app)/plans/[id].tsx — extension to add "Starta pass" CTA
const startSession = useStartSession();
const userId = useAuthStore((s) => s.session?.user.id);

const onStartPass = () => {
  if (!plan || !userId) return;
  const newSessionId = randomUUID();
  startSession.mutate(
    {
      id: newSessionId,
      user_id: userId,
      plan_id: plan.id,
      started_at: new Date().toISOString(),
      finished_at: null,
      notes: null,
      created_at: new Date().toISOString(),
    },
    {
      onSuccess: ({ id }) => {
        // Optimistic dual-write in onMutate already populated active + detail cache,
        // so router.push works even offline.
        router.push(`/workout/${id}` as Href);
      },
      onError: () => {
        setBannerError('Kunde inte starta pass. Försök igen.');
      },
    },
  );
  // Optimistically navigate even when the mutate is queued offline — onMutate
  // already wrote the cache so the destination screen has data.
  router.push(`/workout/${newSessionId}` as Href);
};
```

**Important: optimistic navigation pattern.** Phase 4 Plan 04-04 SUMMARY established that `mutate` (not `mutateAsync`) is the offline-safe submit pattern — `mutateAsync` hangs forever offline because paused mutations never resolve. With `mutate`, the navigation should happen **synchronously** at the call site (NOT inside `onSuccess`) because `onSuccess` only fires on actual server success — and offline, the mutation pauses. Same pattern as Phase 4 plan-create flow. Plan 02 confirms this in the UI-SPEC interaction contract.

`useStartSession`-scope binding for `scope: { id: 'session:<newId>' }`:

```typescript
// lib/queries/sessions.ts
export function useStartSession(sessionId?: string) {
  return useMutation<SessionRow, Error, SessionInsertVars>({
    mutationKey: ['session', 'start'] as const,
    scope: sessionId ? { id: `session:${sessionId}` } : undefined,
  });
}
```

But scope.id is static — the new session's UUID isn't known until `randomUUID()` runs at call-site. **Pattern adjustment**: the call-site generates the UUID **before** instantiating the hook, OR the hook accepts the UUID as a parameter:

**Recommended pattern (matches Phase 4 `useCreatePlan({ planId })` convention):**
```typescript
// In plans/[id].tsx
const [newSessionId] = useState(() => randomUUID()); // stable across renders
const startSession = useStartSession(newSessionId);  // scope = `session:<newSessionId>`
```

**OR Plan 02 picks: omit scope on `useStartSession` entirely** and bind scope via mutate-call-site options:
```typescript
// Note: TanStack v5 mutate() options.scope is NOT a thing — scope is at useMutation only.
// So this alternative is NOT viable. Use the constructor-time pattern.
```

The first pattern is required. Same as Phase 4 `useCreatePlan({ planId })` (commit history learning, Plan 04-01 SUMMARY auto-fix Rule 1).

### Avsluta-pass flow (D-23)

```typescript
// app/app/(app)/workout/[sessionId].tsx — inside the screen
const finishSession = useFinishSession(sessionId);

const onAvslutaConfirm = () => {
  finishSession.mutate(
    { id: sessionId, finished_at: new Date().toISOString() },
    {
      onSuccess: () => {
        // Optimistic onMutate already cleared the active-session cache, so the
        // banner unmounts immediately. Navigate home; toast renders on (tabs)/index.
        router.replace('/(app)/(tabs)/');
      },
      onError: () => {
        setBannerError('Kunde inte avsluta passet. Försök igen.');
      },
    },
  );
  // Navigate optimistically (Phase 4 mutate pattern)
  router.replace('/(app)/(tabs)/');
};
```

### `finished_at` UPDATE idempotency

UPDATE statements are inherently idempotent: running `UPDATE workout_sessions SET finished_at = '2026-05-12T15:00:00Z' WHERE id = 'X'` twice writes the same final state. The second replay is a no-op semantically. **No special idempotency handling needed.**

### In-flight set mutations queued behind the Avsluta UPDATE

Scenario: user is offline. They log set 25, immediately tap Avsluta, confirm. Three mutations are now in the offline queue:
1. `['set','add']` #25
2. `['session','finish']`

All share `scope: { id: 'session:<id>' }`. They replay in registration order on reconnect:
1. Set 25 INSERT lands first.
2. `finished_at` UPDATE lands second.

The session row gets its `finished_at` AFTER all 25 sets are saved server-side. Correct behavior.

**Edge case: what if the user logs a set AFTER tapping Avsluta but BEFORE reconnect?** The Avsluta optimistically cleared the active-session cache → `<ActiveSessionBanner />` unmounts → user can't easily navigate back to the session unless they keep the workout screen open. UI-SPEC says `router.replace('/(app)/(tabs)/')` happens optimistically, so the user actively leaves the workout screen. They can navigate back via deep-link or by re-opening the in-progress workout — but the active-session cache is `null` so `useSessionQuery(id)` would fetch from server (which fails offline). Realistic: the user is done; they don't re-enter. Edge case accepted.

## F13 Brutal-Test Recipe

### Test goal

ROADMAP success #6: "airplane mode + force-quit + battery-pull-simulering under 25-set-pass = alla 25 set överlever och synkar i rätt ordning vid återanslutning (idempotent via klient-genererade UUIDs + `scope.id` serial replay)."

### Why automated tests are insufficient

This test is a **system test** combining native OS behavior (airplane mode, force-quit, OS-level process kill), JS engine lifecycle, AsyncStorage durability, Supabase REST round-trips, and visual confirmation in Supabase Studio. **No off-the-shelf React Native test runner can simulate all of these.** Detox can airplane-mode and force-quit but cannot simulate a true battery-pull (it shuts the app via JS bridge, not kill -9). Maestro is similar.

**Recommendation:** Phase 5 MUST ship a **manual test recipe** (the Phase 4 convention — `app/scripts/manual-test-phase-04-airplane-mode.md` template). Plan 02 authors the recipe; the human (mehdiipays@gmail.com) runs it on a physical iPhone before phase closeout.

### The brutal-test recipe (Plan 02 ships this as `app/scripts/manual-test-phase-05-f13-brutal.md`)

**Preconditions:**
- Physical iPhone running Expo Go with the Phase 5 build loaded.
- Test user account signed in (e.g. `f13-brutal-test-user@fitnessmaxxing.local` created via Supabase Studio).
- At least one plan with ≥3 plan_exercises configured for this user (a "Push Day" or similar with bench/squat/row).
- Supabase Studio open in browser, ready to inspect `workout_sessions` and `exercise_sets` tables (filter by user_id).
- Airplane-mode toggle accessible (iOS Control Center).
- Network reachable WiFi to reconnect.

**Phase 1 — Setup (online):**
1. Confirm `<OfflineBanner />` is NOT visible (online state).
2. Confirm no `<ActiveSessionBanner />` is visible (no draft session).
3. Open Supabase Studio; note current row counts in `workout_sessions` (call it `S0`) and `exercise_sets` (call it `E0`) for the test user.

**Phase 2 — Go offline + start workout:**
4. **Toggle airplane mode ON.** Confirm `<OfflineBanner />` appears within 2s.
5. Navigate to the test plan (`plans/[id]`).
6. Tap **"Starta pass"**. Confirm:
   - The screen routes to `/workout/<sessionId>` within 500ms (optimistic navigation).
   - The exercise-card list renders.
   - `<ActiveSessionBanner />` is hidden (we're on the workout screen).
7. Note the URL's `sessionId` (call it `SESSION_ID`).

**Phase 3 — Log 10 sets (slow tempo, mixed exercises):**
8. For each of the first 3 exercises:
   - Log set 1: weight 100 kg, reps 8. Tap **Klart**. Confirm:
     - New row appears above the input row within 200ms.
     - Set counter chip updates ("1/X set klart" or "1 set").
     - F7 chip ("Förra: ...") may or may not be present depending on prior history.
9. Log sets 2 and 3 for the same 3 exercises, varying weights (e.g. 100/102.5/105) and reps (8/7/6).
10. **Total so far: 9 sets across 3 exercises.**

**Phase 4 — Force-quit (battery-pull simulation):**
11. From the workout screen with the keyboard NOT shown (tap outside any input first), **double-tap the home indicator** and swipe up to force-close Expo Go from the iOS app switcher.
12. Wait 5 seconds. (Simulates the OS reclaiming the app's RAM.)
13. Re-open Expo Go and load the project.

**Phase 5 — Verify offline cache survived force-quit:**
14. After splash dismisses, confirm:
    - User lands on `(tabs)/index.tsx`.
    - `<OfflineBanner />` is visible (still in airplane mode).
    - `<ActiveSessionBanner />` is visible with copy "Pågående pass · Tryck för att återgå" or similar.
    - The draft-resume overlay renders on `(tabs)/index` with copy "Du har ett pågående pass från [HH:MM] med 9 set sparade." — confirms persister hydrated both the session cache AND the sets cache.
15. Tap **Återuppta**. Confirm:
    - Screen routes to `/workout/<SESSION_ID>` (same ID as before).
    - All 9 previously-logged sets are visible in the cards.

**Phase 6 — Log another 16 sets while still offline (reaches 25 total):**
16. Continue logging across all 3 exercises until total = 25 sets. Vary tempo: log some quickly, pause 30s between others, scroll between cards, dismiss and re-show the keyboard.
17. **Force-quit AGAIN** after set 15 (this re-tests durability mid-flight). Re-open. Verify the 15 logged sets are still in the cache (draft-resume overlay should say "15 set sparade"). Continue logging to 25 total.
18. After 25 sets: confirm the counter chips on each card sum to 25 across the 3 exercises.

**Phase 7 — Tap Avsluta while still offline (optional sub-scenario):**
19. **Optionally** tap Avsluta and confirm. Otherwise skip to Phase 8 with the session still active.

**Phase 8 — Reconnect:**
20. **Toggle airplane mode OFF.** Confirm:
    - `<OfflineBanner />` disappears within 5s.
    - Within ~10s, mutations begin replaying. Monitor Expo Go's JS console (if running with dev menu) for any errors.
21. Wait ~30s for replay to complete.

**Phase 9 — Verify in Supabase Studio:**
22. Open Supabase Studio. Run:
    ```sql
    SELECT id, started_at, finished_at FROM workout_sessions
    WHERE id = '<SESSION_ID>';
    ```
    Confirm exactly 1 row exists with `finished_at` set (if Phase 7 was done) or NULL (if not).
23. Run:
    ```sql
    SELECT exercise_id, set_number, weight_kg, reps, completed_at, set_type
    FROM exercise_sets
    WHERE session_id = '<SESSION_ID>'
    ORDER BY exercise_id, set_number;
    ```
    Confirm:
    - Exactly **25 rows** returned.
    - `set_number` values are contiguous per `exercise_id` (1, 2, 3, …).
    - `weight_kg` and `reps` match what was tapped during Phase 3 + Phase 6.
    - All `set_type = 'working'`.
    - All `completed_at` are valid ISO timestamps within the test window.
24. Verify total row count changed by exactly +1 for `workout_sessions` and +25 for `exercise_sets` since the `S0` / `E0` baseline.

**Phase 10 — Verify no FK errors or duplicates:**
25. In Supabase Studio Database > Logs, scan for any 23505 (unique_violation) or 23503 (foreign_key_violation) errors during the test window. Expected: **zero**.
26. Verify the in-app session row is now in Historik (Phase 6 territory — defer to Phase 6 verification if Historik isn't built yet; this Phase 5 test cares only about DB state).

**Pass criteria:**
- All 25 sets appear in Supabase with correct values.
- No FK errors, no duplicate-PK errors.
- The `workout_sessions` row's UUID matches the client-generated one.
- Set numbers are contiguous per exercise.
- (If Phase 7 ran) `finished_at` is the latest timestamp (sets all have earlier `completed_at`).

**Failure modes to look for:**
- Missing sets in Supabase → persister failed to serialize OR scope-replay dropped a mutation.
- Out-of-order `set_number` (e.g. `1, 2, 4` skipping 3) → scope-replay broke FIFO order.
- Duplicate rows with different `id`s → optimistic-update fired without client UUID OR upsert used wrong onConflict.
- FK errors in Supabase logs → `useStartSession` mutation replayed AFTER `useAddSet` mutations.
- Session row's `finished_at` set before all sets are in → finish UPDATE landed before set INSERTs (scope-replay broken).

### Why the brutal-test is irreducible to automated assertions

The Wave 0 verification scripts (`test-offline-queue.ts`, `test-sync-ordering.ts` from Phase 4) prove the **contract layer**: that paused mutations serialize across persist/restart and that scope.id serializes replay. But they cannot prove the **end-to-end system** because they don't exercise iOS-specific lifecycle (background → SIGKILL → reload). The brutal-test is the system-level acceptance gate; the Wave 0 scripts are the unit-/contract-level gates.

## Schema Changes

**ZERO schema changes required.** Confirmed by reading `app/supabase/migrations/0001_initial_schema.sql` (Phase 2 — already deployed):

- `workout_sessions` (lines 62–70): has `id`, `user_id`, `plan_id`, `started_at`, `finished_at`, `notes`, `created_at`. Constraint: `id uuid primary key default gen_random_uuid()`. FK: `plan_id REFERENCES workout_plans(id) ON DELETE SET NULL`. RLS: `Users can manage own sessions` FOR ALL with `using (user_id = (select auth.uid()))` AND `with check (user_id = (select auth.uid()))`. **All Phase 5 needs.**

- `exercise_sets` (lines 72–83): has `id`, `session_id`, `exercise_id`, `set_number`, `reps`, `weight_kg numeric(6,2)`, `rpe numeric(3,1)`, `set_type` ENUM default `'working'`, `completed_at`, `notes`. PK: `id uuid primary key default gen_random_uuid()`. FK: `session_id REFERENCES workout_sessions(id) ON DELETE CASCADE` + `exercise_id REFERENCES exercises(id) ON DELETE RESTRICT`. RLS: `Users can manage own sets` via EXISTS subquery on `workout_sessions` for parent-FK ownership check, with `with check` per Phase 2 errata fix. **All Phase 5 needs.**

- **Indexes** (lines 88–91): `idx_exercise_sets_session` (session_id) — supports `useSetsForSessionQuery`. `idx_exercise_sets_exercise(exercise_id, completed_at desc)` — supports F7 last-value query STEP 1. `idx_sessions_user(user_id, started_at desc)` — supports `useActiveSessionQuery` and the future Historik query (Phase 6). **All Phase 5 needs.**

- **No `updated_at` columns on `workout_sessions` or `exercise_sets`** — V1 single-device per PROJECT.md scope means no LWW conflict resolution is needed. PITFALLS §5.2 special-cases `workout_sessions.finished_at` as monotonic — once set, never cleared by sync. Phase 5 implements this by client-side enforcement: `useFinishSession` writes `finished_at = new Date().toISOString()`; there's no UI to un-finish a session. If a server-side fail-safe is desired, V1.1 can add a `CHECK (finished_at IS NULL OR finished_at >= started_at)` constraint OR a `BEFORE UPDATE` trigger preventing `finished_at` from being unset. V1 accepts client-side enforcement.

- **`exercise_sets` has no unique constraint on `(session_id, exercise_id, set_number)`** — verified by re-reading the migration. CONTEXT.md D-16 explicitly accepts this: duplicate `set_number` from a hypothetical race is acceptable per "more data > losing data" mindset. Replay is still idempotent via the `id` PK.

### Required Phase 5 schema-adjacent work

**Type-gen:** NOT required since no migration is added. `app/types/database.ts` stays unchanged.

**Test-RLS extension:** REQUIRED per CLAUDE.md "Cross-user verification is a gate" rule. Phase 5 MUST extend `app/scripts/test-rls.ts` with cross-user assertions for `workout_sessions` and `exercise_sets`:

- User B cannot SELECT User A's workout_sessions (already covered by Phase 2 setup, but Phase 5 verifies with active-session-specific INSERTs).
- User B cannot INSERT a workout_sessions row with `user_id = userA` (RLS `with check` blocks).
- User B cannot INSERT an exercise_sets row pointing at User A's session_id (RLS `with check` via parent-FK EXISTS subquery blocks).
- User B cannot UPDATE/DELETE User A's exercise_sets rows.
- User B cannot UPDATE User A's workout_sessions row to set `finished_at`.

The existing `test-rls.ts` (Phase 2) covers some of this generically across all 5 user-scoped tables; Phase 5 verifies the assertions explicitly tag `T-05-*` threats and pass for the active-workout-specific flows.

## Validation Architecture (Nyquist)

> Required per `.planning/config.json` `workflow.nyquist_validation: true`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — Phase 1–4 used `tsx`-script convention (Node-only with `--env-file=.env.local`). Phase 5 inherits this. No Jest/Vitest/Detox install. |
| Existing test scripts (Phase 4 inheritance) | `app/scripts/test-rls.ts` (cross-user RLS, currently 29 assertions), `app/scripts/test-auth-schemas.ts`, `app/scripts/test-plan-schemas.ts`, `app/scripts/test-exercise-schemas.ts`, `app/scripts/test-plan-exercise-schemas.ts`, `app/scripts/test-reorder-constraint.ts`, `app/scripts/test-upsert-idempotency.ts`, `app/scripts/test-offline-queue.ts`, `app/scripts/test-sync-ordering.ts`, `app/scripts/verify-deploy.ts`, `app/scripts/manual-test-phase-04-airplane-mode.md` |
| Quick run command | `npx tsx --env-file=.env.local scripts/<file>.ts` from `app/` cwd |
| Full suite command | `npm run test:rls && npm run test:auth-schemas && npm run test:plan-schemas && npm run test:exercise-schemas && npm run test:plan-exercise-schemas && npm run test:reorder-constraint && npm run test:upsert-idempotency && npm run test:offline-queue && npm run test:sync-ordering` (Phase 5 adds 2 more — see below) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| F5 | Start session writes `workout_sessions` row with client UUID | unit (schema parse) | `tsx scripts/test-session-schemas.ts` (asserts SessionRowSchema parses a valid sample) | ❌ Wave 0 — `app/scripts/test-session-schemas.ts` |
| F5 | Cross-user session insert is blocked by RLS | unit (RLS) | `npm run test:rls` (extend with `workout_sessions.user_id` cross-write assertion — currently covered generically but Phase 5 makes the active-session-INSERT case explicit) | extend `app/scripts/test-rls.ts` |
| F5 | `workout_sessions` row idempotent on replay (.upsert with onConflict: id) | unit (Supabase upsert) | `tsx scripts/test-session-upsert-idempotency.ts` — calls `.upsert` twice with same id, asserts row count = 1 + no error | ❌ Wave 0 — `app/scripts/test-session-upsert-idempotency.ts` OR extend `test-upsert-idempotency.ts` |
| F6 | Set-add writes `exercise_sets` row with client UUID | unit (schema parse) | `tsx scripts/test-set-schemas.ts` (asserts SetRowSchema parses + setFormSchema rejects weight>500/reps>60) | ❌ Wave 0 — `app/scripts/test-set-schemas.ts` |
| F6 | Cross-user set-INSERT pointing at User A's session_id is blocked by RLS | unit (RLS) | `npm run test:rls` (extend with `exercise_sets` cross-INSERT assertion — currently covered by Phase 2 generic test; Phase 5 adds explicit set_type='working' coverage) | extend `app/scripts/test-rls.ts` |
| F6 | Optimistic-update flow: set appears in cache instantly | manual (Expo Go) | Manual: log a set offline, observe row appears <200ms after Klart-tap | manual-only |
| F6 | Set-row force-quit + reload preserves row in cache | unit (TanStack persister) | Extend `test-offline-queue.ts` with a 25-set replay scenario specific to `['set','add']` mutationKey | extend `app/scripts/test-offline-queue.ts` |
| F7 | Last-value query returns set-position-aligned working sets, excluding current session | unit (Supabase query) | `tsx --env-file=.env.local scripts/test-last-value-query.ts` — seeds 2 sessions of same exercise via service-role; asserts the query returns set 1 from the second session, set 2 from session 2, etc., and excludes session 3 (the current) | ❌ Wave 0 — `app/scripts/test-last-value-query.ts` |
| F7 | Last-value query respects RLS (User B cannot see User A's history) | unit (RLS) | `npm run test:rls` (extend with last-value query cross-user assertion) | extend `app/scripts/test-rls.ts` |
| F8 | Finish session UPDATE writes `finished_at` | unit (Supabase) | `tsx --env-file=.env.local scripts/test-finish-session.ts` — service-role INSERTs a session with `finished_at=null`, runs the `useFinishSession` mutationFn pattern, asserts `finished_at` is set | ❌ Wave 0 — OPTIONAL; the existing `test-rls.ts` covers UPDATE permissions and the upsert-idempotency test covers the SQL shape; this script can be deferred unless Plan 02 wants explicit coverage |
| F13 | 25 paused mutations under shared scope.id replay in FIFO order | unit (TanStack scope) | Extend `test-sync-ordering.ts` with a 25-set scenario under `scope: { id: 'session:test-session' }` | extend `app/scripts/test-sync-ordering.ts` |
| F13 (success #6) | Airplane mode + force-quit + battery-pull-simulering under 25-set-pass | MANUAL (physical iPhone) | See §F13 Brutal-Test Recipe above. File: `app/scripts/manual-test-phase-05-f13-brutal.md` | ❌ Wave 0 — `app/scripts/manual-test-phase-05-f13-brutal.md` |
| F13 | Persister `throttleTime: 500` actually causes flush within 500ms | unit (TanStack persister) | Extend `test-offline-queue.ts` or new `test-persister-throttle.ts` — fire a mutation, wait 600ms, read AsyncStorage, assert the mutation is serialized | ❌ Wave 0 — extend existing OR add `app/scripts/test-persister-throttle.ts` |
| F13 | AppState background flush triggers immediate persistence | manual (Expo Go) | Manual: fire a mutation offline, immediately background the app via home indicator swipe (within 500ms throttle), wait 1s, foreground app, force-quit, reload — confirm mutation still in cache | manual-only (Expo Go) |

### Sampling Rate

- **Per task commit:** run the relevant `tsx scripts/test-*.ts` for the file just touched.
- **Per wave merge:** all schema tests + `test:rls` + `test:offline-queue` + `test:sync-ordering` + `test:last-value-query` (new) + `test:session-upsert-idempotency` (new).
- **Phase gate:** full suite + manual F13 brutal-test (the airplane-mode + force-quit recipe) + manual Expo Go AppState-flush smoke test.

### Wave 0 Gaps

- [ ] `app/scripts/test-session-schemas.ts` — Zod schema round-trip for SessionRowSchema + sessionFormSchema; asserts notes ≤500 chars (F12 schema-ready), started_at/finished_at ISO format.
- [ ] `app/scripts/test-set-schemas.ts` — Zod schema round-trip for SetRowSchema + setFormSchema; asserts weight_kg.min(0).max(500).multipleOf(0.25), reps.int().min(1).max(60), set_type enum default 'working'.
- [ ] `app/scripts/test-last-value-query.ts` — service-role seeds 2 finished sessions for same exercise across 2 users; runs the F7 two-step query as User A; asserts set-position-aligned return for User A's history and zero results for User B (RLS).
- [ ] Extend `app/scripts/test-offline-queue.ts` — 25 paused `['set','add']` mutations under `scope: { id: 'session:test' }`; serialize via persister; restart persister; assert 25 paused mutations restored.
- [ ] Extend `app/scripts/test-sync-ordering.ts` — `['session','start']` + 25× `['set','add']` + 1× `['session','finish']` all in same scope; replay; assert order = start → all sets → finish.
- [ ] Extend `app/scripts/test-rls.ts` — add 4 cross-user assertions for `workout_sessions` (own SELECT/INSERT/UPDATE) + 4 for `exercise_sets` (parent-FK INSERT/UPDATE/DELETE checks via session-ownership) — currently the Phase 2 test covers these generically; Phase 5 makes them explicit with set_type='working' + finished_at boundary cases.
- [ ] OPTIONAL: `app/scripts/test-session-upsert-idempotency.ts` — call `.upsert` for `workout_sessions` twice with same id, assert row count = 1. (Alternatively extend `test-upsert-idempotency.ts`.)
- [ ] OPTIONAL: `app/scripts/test-persister-throttle.ts` — verify the 500ms throttle option actually fires.
- [ ] `app/scripts/manual-test-phase-05-f13-brutal.md` — the brutal-test recipe above as a human-runner checklist.
- [ ] Add new `npm run test:*` scripts to `app/package.json`: `test:session-schemas`, `test:set-schemas`, `test:last-value-query`.

## Security Domain

### Applicable ASVS L1 Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherits Phase 3) | `LargeSecureStore` already in place; Phase 5 doesn't touch auth surface |
| V3 Session Management | yes (inherits Phase 3) | `(select auth.uid())` in every RLS policy; `Stack.Protected` route guard already in `(app)/_layout.tsx` |
| V4 Access Control | yes — primary Phase 5 surface | RLS policies on `workout_sessions` + `exercise_sets` (already in 0001 schema; Phase 2 verified). Phase 5 adds NO new policies. Cross-user regression test in `app/scripts/test-rls.ts` MUST be extended (CLAUDE.md "Cross-user verification is a gate") |
| V5 Input Validation | yes | Zod 4 schemas at form-boundary (RHF resolver) AND at every Supabase response boundary (`SetRowSchema.parse(data)` not cast). New schemas: `lib/schemas/{sessions,sets}.ts` |
| V6 Cryptography | partial | `expo-crypto.randomUUID()` — same as Phase 4. No new crypto surface. |
| V11 Anti-Flood | yes (CLAUDE.md Phase 5 checklist) | TanStack `retry: 1` + `scope.id` serialization prevents flood by definition — paused mutations queue rather than retry-storm |

### Known Threat Patterns for Phase 5 (T-05-*)

Per CLAUDE.md Phase 5 security checklist:

| Pattern | STRIDE | Standard Mitigation | Threat ID |
|---------|--------|---------------------|-----------|
| API1/V4 — User B forges a request to INSERT an exercise_sets row pointing at User A's session_id | Tampering, Elevation of Privilege | RLS `Users can manage own sets` with EXISTS subquery on workout_sessions for ownership check; cross-user regression test in `test-rls.ts` | T-05-01 |
| API1/V4 — User B INSERTs a workout_sessions row with `user_id = userA` | Tampering, Elevation of Privilege | RLS `Users can manage own sessions` with `with check (user_id = (select auth.uid()))` | T-05-02 |
| API1/V4 — User B SELECTs User A's exercise_sets via direct REST query | Information Disclosure | RLS `Users can manage own sets` `using` clause filters at the row level | T-05-03 |
| API1/V4 — User B SELECTs User A's F7 last-value query result | Information Disclosure | The two-step query in `useLastValueQuery` joins through `workout_sessions` which is RLS-scoped; the embedded `!inner` Postgres join applies RLS to both tables | T-05-04 |
| V5 — User submits weight_kg = 99999.99 (overflowing schema or implausible) | Tampering | Zod schema enforces `.max(500)` at form-boundary; rejects before mutate; closes PITFALLS §1.5 | T-05-05 |
| V5 — User submits reps = -5 or non-integer | Tampering | Zod schema enforces `.int().min(1)`; rejects before mutate | T-05-06 |
| API3 — Supabase response over-fetches columns | Information Disclosure | All resource hooks use `.select('*')` only on user-scoped tables (RLS already filters); `useLastValueQuery` STEP 2 narrows to `(set_number, weight_kg, reps, completed_at)` to avoid leaking notes/rpe via cache | T-05-07 |
| API4/V11 — User taps Klart 25× in 5s; mutations flood the server on reconnect | DoS (self-inflicted) | `scope: { id: 'session:<id>' }` serializes replay — server sees one INSERT at a time, not 25 in parallel; `retry: 1` + `networkMode: 'offlineFirst'` re-pauses on captive-portal failures | T-05-08 |
| M2 — Queue payload contains user's training data in plaintext AsyncStorage | Information Disclosure | weight_kg + reps + exercise names are NOT PII per V1 threat model (no health diagnosis, no medical data). Plain AsyncStorage acceptable per CLAUDE.md (queue payloads for sets are non-PII). Document as accepted-risk in SECURITY.md. F12 notes (Phase 7) MAY contain PII — revisit then. | T-05-09 (accepted) |
| API8 — Service-role key leaks via test-rls.ts extension | Information Disclosure | Service-role audit gate already in place: `git grep "service_role"` must match only test-rls.ts, .env.example, .planning/, CLAUDE.md. Phase 5 extends test-rls.ts which stays within the allowed list. | T-05-10 |
| FK constraint violation: child set INSERT replays before parent session INSERT | Tampering (data integrity) | `scope: { id: 'session:<id>' }` shared between `['session','start']` and `['set','add']` ensures FIFO replay; parent INSERTs first | T-05-11 |
| Replayed mutation creates duplicate row | Data Integrity | `.upsert(vars, { onConflict: 'id', ignoreDuplicates: true })` semantics: replay = `INSERT ... ON CONFLICT (id) DO NOTHING` | T-05-12 |
| Force-quit during set-logging loses mutation that was within throttle window | Data Integrity (F13 violation) | `throttleTime: 500ms` (down from 1000ms) + AppState background-flush listener ensures the throttle window is ≤500ms or the next AppState change, whichever comes first | T-05-13 |
| Captive-portal / wifi-without-internet causes mutation to fire-and-error permanently | Data Integrity, DoS (self-inflicted) | `networkMode: 'offlineFirst'` + `retry: 1` re-pauses on sub-network failure; next NetInfo event triggers another `resumePausedMutations` cycle | T-05-14 |
| User B sees User A's draft session via cross-user query injection | Information Disclosure | `useActiveSessionQuery` filters by `user_id = (select auth.uid())` + RLS on `workout_sessions`; both gate the read | T-05-15 |
| User accidentally taps "Avsluta sessionen" in draft-resume and loses an active session | Data Loss (UX) | Per CONTEXT.md D-23 + UI-SPEC §Copywriting: "Avsluta sessionen" in draft-resume is destructive-styled (red) and labeled clearly. No second confirmation per UX simplicity. **Accepted-risk:** the alternative (two-tap discard) blocks fast recovery and has been weighed against the data-loss risk. Recovery path: the session row is NOT deleted — it's just finished. The user can still see its sets in Historik (Phase 6). | T-05-16 (accepted-risk) |

The full T-05-* threat register goes into Plan 02's `<threat_model>` block. `gsd-secure-phase 5` audits the register and produces `05-SECURITY.md` with `threats_open: 0` before phase exit.

## Environment Availability

> Skip rationale: phase has external service dep (Supabase) already wired by Phase 1–4. No new tools, runtimes, or services entering.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 20+ | Expo CLI, npm scripts | ✓ | (Phase 1 verified) | — |
| Expo Go on iPhone | Manual F13 brutal-test (success #6) + AppState-flush smoke test | ✓ | (Phase 3+4 used it) | — |
| Supabase project | All persistence | ✓ | (Phase 2 deployed) | — |
| Postgres `gen_random_uuid()` | Schema default | ✓ | (Phase 2 verified) | — |
| `expo-crypto` native bridge | `randomUUID()` via `lib/utils/uuid.ts` | ✓ | `~15.0.9` (SDK 54) | (Phase 4 verified) |
| `AppState` event listener | CONTEXT.md D-25 background-flush | ✓ | RN core (no install) | — |
| Physical iPhone (for brutal-test) | F13 success criterion #6 | ✓ (user's iPhone via Expo Go) | iOS 17+ | — |

## Pitfalls

The top 5 ways Phase 5 fails. Drawn from `.planning/research/PITFALLS.md` + Phase 4 SUMMARY learnings + my own digging.

### Pitfall 1 — Module-load-order breakage drops paused set mutations

**What goes wrong:** New Phase 5 `setMutationDefaults['set','add']` etc. are imported into `lib/query/client.ts` LATER than `lib/query/persister.ts` runs. On cold-start after a 25-set offline workout, the persister hydrates 25 paused mutations from AsyncStorage but they have no `mutationFn` bound (because the defaults registered after hydration). The 25 sets hang forever in `isPaused: true` and never replay. User loses 25 sets.

**Why it happens:** Easy to forget. The Phase 4 import order in `app/app/_layout.tsx` is `client.ts → persister.ts → network.ts` (documented in the file's load-bearing comment lines 16–24). Phase 5 adds 5 new keys inside `client.ts` — that's the right place. But if Plan 02 inadvertently puts the 5 new keys into a separate module (e.g. `lib/query/client-sessions.ts`) that's imported in a different order, the contract breaks.

**How to avoid:**
- **Add the 5 new setMutationDefaults blocks INSIDE the existing `lib/query/client.ts` file**, not a sibling module. Maintain the single-file contract.
- Plan-check: AST-assert that `lib/query/client.ts` registers all 13 mutation keys (8 from Phase 4 + 5 from Phase 5) at module top-level, NOT inside a function/hook.
- Add a Wave 0 verification: extend `test-offline-queue.ts` to serialize a paused `['set','add']` mutation, restart the persister in a child process, then assert the mutation re-hydrates with its mutationFn bound. (Phase 4's `test-offline-queue.ts` already does this for plans; Phase 5 extends to sets.)

**Warning signs:**
- A new file `lib/query/sets-client.ts` or similar is created.
- The F13 brutal-test fails at Phase 9 — Supabase rows are missing.
- `isPaused: true` mutations linger in dev-tools that never resume.

### Pitfall 2 — Force-quit within the persister throttle window drops the most-recent set

**What goes wrong:** User taps Klart at T=0. The persister has a throttle of 500ms. User force-quits at T=300ms. The mutation is in the in-memory mutation cache but hasn't been serialized to AsyncStorage yet. App reloads — that one set is gone.

**Why it happens:** Throttling is a performance optimization. Sub-500ms force-quit is possible in real-world conditions (phone jostled, OS reclaims RAM during heavy memory pressure).

**How to avoid:**
- **AppState background-flush listener (D-25).** Extend `lib/query/network.ts` with `AppState.addEventListener('change', s => { if (s === 'background' || s === 'inactive') void persister.persistClient(); })`. This synchronously flushes the throttle buffer when the OS signals the app is leaving the foreground — which iOS does BEFORE killing the process for memory pressure.
- **Lower throttle to 500ms** (CONTEXT.md D-25). Halves the window from default 1000ms.
- **Document the residual risk:** there's still a sub-500ms window where the user taps Klart, the AppState change doesn't fire (e.g. battery-pull), and the set is in memory only. Mitigations: client-UUID makes the user-recoverable; even if the set is lost from the queue, the in-memory cache snapshot may still be rehydrated next launch if the persister had partially serialized. V1 accepts the residual ≤500ms risk. V1.1 belt-and-braces is the redundant Zustand store, deferred per CONTEXT.md D-25.

**Warning signs:**
- Brutal-test Phase 4 (force-quit after 9 sets) reveals fewer than 9 sets in cache after reload.
- The AppState listener doesn't fire — verify by adding a one-time `console.log('appstate change', s)` in dev.
- `persister.persistClient` is not called or throws.

### Pitfall 3 — `scope.id` is a function instead of a string (TanStack v5 silent failure)

**What goes wrong:** Plan 02 writes `useAddSet(sessionId) → useMutation({ scope: { id: (vars) => 'session:' + vars.session_id }, ... })`. Looks reasonable. Compiles. Mutations replay in **parallel** instead of serial because TanStack v5's `scopeFor(mutation)` does `typeof mutation.options.scope?.id === 'string'` — a function-shaped scope.id silently fails the gate, the mutation is treated as scope-less, parallel replay → FK violations or out-of-order sets.

**Why it happens:** TypeScript doesn't catch it (the `scope.id` type accepts `unknown`); the bug surfaces only at runtime under offline-replay conditions. Phase 4 Plan 04-01 hit this exact bug and resolved via auto-fix Rule 1 — constructor-time scope binding.

**How to avoid:**
- **Hook constructor takes `sessionId` as a parameter and bakes it into scope at instantiation.** Pattern (verbatim Phase 4 inheritance):
  ```typescript
  export function useAddSet(sessionId: string) {
    return useMutation<SetRow, Error, SetInsertVars>({
      mutationKey: ['set', 'add'] as const,
      scope: { id: `session:${sessionId}` },  // STATIC STRING at instantiation
    });
  }
  ```
- Call site: `const addSet = useAddSet(sessionId);` — the hook is bound to the session for its lifetime.
- Plan-check: grep for `scope: { id: (` (regex match for function-shaped scope) and fail if found.
- Brutal-test Phase 9 (Supabase verification) catches it: out-of-order `set_number` per exercise indicates parallel replay.

**Warning signs:**
- Set numbers in Supabase are out of contiguous order (1, 2, 4, 3, …).
- FK errors in Supabase logs during reconnect.
- Dev-console logs of mutation `mutationKey` + `scope` show scope as undefined.

### Pitfall 4 — F7 last-value query returns the last set of last session (not set-position-aligned)

**What goes wrong:** Plan 02 writes the F7 query as `ORDER BY completed_at DESC LIMIT 1` → returns the very last set of the user's last session for that exercise. UI renders "Förra: 85 × 6" on the current set 1, but that was actually the last working set of the last session (set 4 with deload). User trains incorrectly. Closes PITFALLS §6.3 the wrong way.

**Why it happens:** "Last value" is ambiguous in the requirement; the two-step query is harder than the naive query; the bug is silent (the chip renders something).

**How to avoid:**
- Implement the two-step query per §Set-Position-Aligned "Last Value" Query above: STEP 1 find target session by `(exercise_id, set_type='working', finished_at IS NOT NULL)` ordered by `completed_at desc LIMIT 1`. STEP 2 fetch all working sets from that session, return as `Map<setNumber, ...>`.
- Wave 0 test `test-last-value-query.ts` seeds two finished sessions of the same exercise with deliberately different set counts (Session A: 4 sets; Session B: 3 sets) and asserts the returned Map has keys 1, 2, 3 (from B — the more recent), not the absolute most-recent set.
- UI assertion: render the F7 chip only when `map.has(currentSetNumber)`. When the user is on set 4 of an exercise where the previous session only logged 3 sets, the chip is NOT rendered (per CONTEXT.md D-19) — NOT rendered as "Förra: 85 × 6" from the next-best position.

**Warning signs:**
- F7 chip on set 1 shows a weight that doesn't match what the user expects to have done on set 1 last time.
- Wave 0 test failing on the multi-set assertion.

### Pitfall 5 — Inline-overlay state retained across navigation (Phase 4 freezeOnBlur trap)

**What goes wrong:** User opens the Avsluta overlay on the workout screen, decides to keep training, taps Fortsätt. Goes home tab. Comes back. The Avsluta overlay re-appears unprompted. Or: the draft-resume overlay on `(tabs)/index` doesn't re-show after the user has dismissed it once and then backed into the tab from another route.

**Why it happens:** Phase 4 set `freezeOnBlur: true` on the (app) Stack to fix the 60Hz nav perf issue. Frozen screens retain local React state — including `showAvslutaOverlay = true` if it wasn't reset before navigation. Phase 4 commit `af6930c` established the `useFocusEffect` cleanup pattern that Phase 5 must inherit.

**How to avoid:**
- Every Phase 5 screen with modal-state-bearing local state MUST reset on focus:
  ```typescript
  useFocusEffect(useCallback(() => {
    return () => {
      setShowAvslutaOverlay(false);
      setBannerError(null);
      // ... etc
    };
  }, []));
  ```
- For `(tabs)/index.tsx` draft-resume overlay: `dismissed` state resets on focus so the overlay re-appears if the user comes back from elsewhere with a still-active session.
- Plan-check: verify the `useFocusEffect` hook is present in both `/workout/[sessionId].tsx` and `(tabs)/index.tsx` and that all overlay/banner-error state appears in its cleanup function.

**Warning signs:**
- Brutal-test or routine use: Avsluta overlay appears unprompted on screen re-focus.
- Draft-resume overlay only shows on first cold-start, never on re-entry to (tabs)/index.

## File List

The planner uses this as input to gsd-pattern-mapper.

### NEW files

| File | Purpose |
|------|---------|
| `app/lib/queries/sessions.ts` | `useActiveSessionQuery`, `useSessionQuery(id)`, `useStartSession(sessionId)`, `useFinishSession(sessionId)` |
| `app/lib/queries/sets.ts` | `useSetsForSessionQuery(sessionId)`, `useAddSet(sessionId)`, `useUpdateSet(sessionId)`, `useRemoveSet(sessionId)` |
| `app/lib/queries/last-value.ts` | `useLastValueQuery(exerciseId, currentSessionId)` — set-position-aligned F7 query |
| `app/lib/schemas/sessions.ts` | `sessionRowSchema` + `sessionFormSchema` (notes ≤500 chars schema-ready for F12) |
| `app/lib/schemas/sets.ts` | `setRowSchema` + `setFormSchema` with strict Zod (weight_kg multipleOf(0.25), reps int, set_type enum) |
| `app/components/active-session-banner.tsx` | Persistent global banner for active session indicator |
| `app/app/(app)/workout/_layout.tsx` | OPTIONAL — Plan 02 decides if route-grouping is needed; alternatively the route is declared in `(app)/_layout.tsx` directly |
| `app/app/(app)/workout/[sessionId].tsx` | Main workout screen — single-scroll card-per-exercise, always-visible set-input row, F7 chips, Avsluta-overlay |
| `app/scripts/test-session-schemas.ts` | Wave 0 — Zod round-trip for session schemas |
| `app/scripts/test-set-schemas.ts` | Wave 0 — Zod round-trip for set schemas (strict validation) |
| `app/scripts/test-last-value-query.ts` | Wave 0 — F7 query correctness + RLS cross-user |
| `app/scripts/manual-test-phase-05-f13-brutal.md` | The brutal-test recipe checklist for the human runner |

### MODIFIED files

| File | Modification |
|------|--------------|
| `app/lib/query/client.ts` | Add 5 new `setMutationDefaults` blocks at module top-level: `['session','start']`, `['session','finish']`, `['set','add']`, `['set','update']`, `['set','remove']`. Mirror Phase 4 pattern (idempotent upsert, optimistic onMutate with snapshot, rollback on error, invalidate on settled, retry: 1). |
| `app/lib/query/keys.ts` | Add 3 new key-factories: `sessionsKeys = { all, list, detail(id), active }`, `setsKeys = { all, list(sessionId) }`, `lastValueKeys = { all, byExercise(exerciseId) }`. |
| `app/lib/query/persister.ts` | Pass `{ throttleTime: 500 }` to `createAsyncStoragePersister(...)`. Export the `asyncStoragePersister` instance for the AppState-flush listener. |
| `app/lib/query/network.ts` | Add AppState listener that calls `persister.persistClient()` (or `persistQueryClient.persistClient()` equivalent) on `'background'`/`'inactive'` state changes. |
| `app/app/(app)/(tabs)/_layout.tsx` | Mount `<ActiveSessionBanner />` between `<OfflineBanner />` and `<Tabs>`, inside the same `SafeAreaView edges={['top']}`. |
| `app/app/(app)/(tabs)/index.tsx` | Mount `useActiveSessionQuery()` + render the inline-overlay draft-resume modal when hit; include `useFocusEffect`-cleanup for `dismissed` state. Also mount the post-finish toast (or the toast is mounted in a context provider — Plan 02 picks). |
| `app/app/(app)/plans/[id].tsx` | Add "Starta pass" CTA below the plan-exercises list, above the existing "Lägg till övning"-CTA. Disabled when `plan_exercises.length === 0` with helper text. Tap → `useStartSession.mutate` + optimistic `router.push('/workout/<newId>')`. |
| `app/scripts/test-rls.ts` | Extend with cross-user assertions for `workout_sessions` (own SELECT/INSERT/UPDATE for active sessions) + `exercise_sets` (parent-FK INSERT/UPDATE/DELETE checks via session-ownership). Currently at 29 assertions; Phase 5 likely brings to ~35–40. |
| `app/package.json` | Add `npm run test:session-schemas`, `test:set-schemas`, `test:last-value-query` scripts. |

### NO CHANGE

| File | Why |
|------|-----|
| `app/types/database.ts` | No schema migrations — table types already match what's deployed (verified Phase 2). |
| `app/supabase/migrations/0001_initial_schema.sql` | No new migration. |
| `app/lib/supabase.ts` | Typed client unchanged. |
| `app/lib/utils/uuid.ts` | `randomUUID()` wrapper unchanged. |
| `app/lib/auth-store.ts` | Auth surface untouched. |
| `app/components/offline-banner.tsx` | Inherited as-is. |
| `app/app/_layout.tsx` | Module-load order already correct (Phase 4); no changes needed. The AppState listener for background-flush lives in `lib/query/network.ts`, imported here for side-effects. |
| `app/app/(app)/_layout.tsx` | Centralized Stack header-styling already set (Phase 4 commit `b57d1c2`); workout-route inherits via `<Stack.Screen options={{ headerShown: true, headerRight: ... }} />` per-screen. The `workout/[sessionId]` route declaration may need adding here as a `<Stack.Screen name="workout/[sessionId]" />` if Plan 02 chooses NOT to add `(app)/workout/_layout.tsx` — both options work; the existing modal-presentation pattern (Phase 4 commit `1f4d8d0`) suggests the picker/edit modals are declared explicitly here. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `createAsyncStoragePersister` accepts `{ throttleTime: number }` option in v5.100.x | §Per-Set Persistence Architecture (Durability gates) | Throttle adjustment fails silently OR throws on construction. **Mitigation:** Plan 02 verifies via Context7 `/tanstack/query` or by reading `@tanstack/query-async-storage-persister` source. Worst-case: pass options via a different mechanism (e.g. wrap the storage adapter to manually rate-limit). |
| A2 | The `asyncStoragePersister` instance exposes a `persistClient()` method for ad-hoc flush | §Per-Set Persistence Architecture (Durability gates), §Pitfall 2 | AppState background-flush has no API to trigger. **Mitigation:** Plan 02 verifies via Context7 or source. Worst-case: re-create the persister + call `persistQueryClient` again on background, OR use the lower-level `Persister` interface with explicit `dehydrate` + `AsyncStorage.setItem`. |
| A3 | Supabase PostgREST `select` with `!inner` embedded resource correctly applies RLS to the joined `workout_sessions` table in the F7 last-value STEP 1 query | §Set-Position-Aligned "Last Value" Query | F7 query may leak data across users OR return zero results when it should return data. **Mitigation:** Wave 0 `test-last-value-query.ts` includes a cross-user assertion (User B's anon client should return empty Map even when User A has prior sessions of the same exercise_id). |
| A4 | Phase 4's `useFocusEffect`-cleanup pattern for modal state (commit `af6930c`) applies cleanly to Phase 5's Avsluta-overlay and draft-resume modal under `freezeOnBlur: true` | §Pitfall 5 | Overlays persist or fail to re-show on re-focus. **Mitigation:** explicit `useFocusEffect(() => () => { resetAllOverlayState(); }, [])` per screen; manually verify on device during brutal-test. |
| A5 | TanStack v5 `resumePausedMutations()` replays mutations within a scope in **registration order** (FIFO), where "registration order" is the order they were originally enqueued during the offline window | §Per-Set Persistence Architecture (Replay-order guarantees), §F13 Brutal-Test Recipe Pass criteria | Sets replay out of order → `set_number` non-contiguous OR FK violation if start-session lands after set-add. **Mitigation:** Wave 0 `test-sync-ordering.ts` extension with 25-set scenario; brutal-test verifies via Supabase Studio SQL inspection. [VERIFIED partially via Phase 4 RESEARCH §5 + Phase 4 04-04 SUMMARY for plan-create-then-exercise-add scope replay; not yet stress-tested at 25-mutation scale, hence A5.] |
| A6 | Postgres accepts a client-supplied UUID for `exercise_sets.id` that overrides the column's `DEFAULT gen_random_uuid()` (i.e. `DEFAULT` only fires when `id` is absent) | §Schema Changes (idempotency) | Duplicate inserts on replay → 23505 errors. **Mitigation:** Phase 4 already proved this for `workout_plans` + `plan_exercises`; Phase 5's pattern is identical. Wave 0 `test-upsert-idempotency.ts` extension covers the `exercise_sets` case explicitly. [VERIFIED via Phase 4 RESEARCH §5 + PostgreSQL docs on DEFAULT semantics.] |
| A7 | The "Sverige-only V1" / kg-only scope makes `weight_kg` storage and display interchangeable (no unit-conversion at the boundary) | §Per-Set Persistence Architecture | If V2 adds lb support, all V1 weight_kg displays as kg without conversion — correct for V1 user but historical data needs migration when V2 ships. **Accepted-risk** per PROJECT.md scope; V1.1+ revisits. |

## Open Questions (RESOLVED)

1. **Should the F7 last-value query batch across all plan-exercises into a single PostgREST query?**
   - What we know: CONTEXT.md D-20 specifies per-exercise pre-fetch via `useLastValueQuery(exerciseId)` with staleTime 15min. Plan 02 prefetches one per `plan_exercises.exercise_id` on workout-screen mount or `useStartSession.onSuccess`.
   - What's unclear: 10 exercises × 2 queries = 20 round-trips. Acceptable for a 4G connection (≤2s total); arguable on a slow gym wifi.
   - Recommendation: Plan 02 implements per-exercise as specified by CONTEXT.md (simpler). V1.1 can batch via single RPC if latency soak shows ≥5s pre-fetch time.
   - **RESOLVED:** Per-exercise pre-fetch as CONTEXT.md D-20 specifies (no batching in V1). V1.1 may revisit if a 10-exercise plan's pre-fetch consistently exceeds 5s on gym wifi.

2. **Should the `useFinishSession` hook also invalidate `lastValueKeys.all` so the next session's F7 reflects this session's working sets?**
   - What we know: CONTEXT.md doesn't specify. The F7 query is `staleTime: 15min` so even without invalidation, the cache will refresh within 15min. But if the user starts a second session within 15min, the F7 chip shows stale data (still referencing the previous-previous session).
   - Recommendation: Plan 02 invalidates `lastValueKeys.all` in the `setMutationDefaults['session','finish'].onSettled` block. Trivial cost; correct semantics.
   - **RESOLVED:** `setMutationDefaults[['session','finish']].onSettled` invalidates `lastValueKeys.all` in addition to the existing Phase 4 invalidations. Implemented in Plan 01 Task 05-01-02 Step C Block 10 (revision WARNING-03 closure). Grep gate in Task 05-01-02 `<done>` asserts the call exists in `client.ts`.

3. **Where does the "Passet sparat ✓" toast actually live?**
   - What we know: CONTEXT.md D-24 says "on (tabs)/index". UI-SPEC §Toast specifies Reanimated `Animated.View` mounted via a Zustand flag or router-param hand-off from `useFinishSession.onSuccess`. CONTEXT.md `<discretion>` left to Plan 02.
   - Recommendation: Plan 02 picks. Simplest approach: a `useState`-backed toast inside `(tabs)/index.tsx` that gets triggered via a query-side-effect (`useEffect` watching `sessionsKeys.active()` for transition from non-null → null) OR via a Zustand "lastFinishedSessionId" flag set in `useFinishSession.onSuccess`. Reanimated `entering={FadeIn}` + `exiting={FadeOut.delay(2000)}` handles the timing.
   - **RESOLVED:** Plan 03 Task 05-03-02 implements the toast in `(tabs)/index.tsx` via a `useEffect` that watches the `useActiveSessionQuery` value transitioning from non-null → null; uses `useState` + `setTimeout(2000)` for the 2s visibility window paired with Reanimated `entering={FadeIn.duration(200)}` + `exiting={FadeOut.duration(200)}`. The `FadeOut.delay(2000)` form from the recommendation prose was a flawed reading — `delay` blocks the start of the unmount fade, not the entire visible duration. The `setTimeout` + state-flip pattern is the correct primitive. (WARNING-04 revision closure.) No Zustand flag is introduced (CONTEXT.md D-25 explicitly forbids).

4. **Should the workout screen mount a second `<OfflineBanner />` instance inside the SafeAreaView?**
   - What we know: UI-SPEC §Offline state surfaces recommends YES — mount a second instance below the header so offline state is visible during the hot path. The (tabs) banner is invisible inside `/workout/[sessionId]` because the route is outside the (tabs) layout.
   - Recommendation: Plan 02 mounts the second `<OfflineBanner />` per UI-SPEC. Both instances state-mirror via `useOnlineStatus()` so they appear/disappear simultaneously.
   - **RESOLVED:** Plan 02 Task 05-02-03 Step A mounts `<OfflineBanner />` as a sibling above `<WorkoutBody>` inside the WorkoutScreen SafeAreaView. WARNING-01 revision closure. Grep gate in Task 05-02-03 `<done>` asserts the mount exists. Plan 03's F13 brutal-test recipe (Task 05-03-04) explicitly asserts "OfflineBanner visible" after the force-quit re-open in the workout screen.

5. **`exercise_sets.set_number` race condition under rapid Klart-tap**
   - What we know: CONTEXT.md D-16 accepts client-side `set_number = existingSets.length + 1` with no DB uniqueness constraint. Two rapid taps on Klart for the same exercise (within the same render frame, before optimistic update completes) could compute the same `set_number`.
   - What's unclear: TanStack onMutate is synchronous; the cache write is synchronous. The next tap reads `queryClient.getQueryData` which returns the just-updated array. So two taps in two render frames cannot collide. Within ONE render frame, React doesn't fire two onPress handlers — Pressable debounces.
   - Recommendation: Plan 02 documents this in the `useAddSet` hook comment. Defensive: log a warning if `setNumber` would duplicate an existing cached value (cheap sanity check), but do NOT block the insert (per CONTEXT.md "more data > losing data").
   - **RESOLVED:** Accept as documented — TanStack onMutate is synchronous so within-frame collision is not possible (the second tap reads the just-updated cache), and Pressable's native debounce blocks within-frame double-fires. Plan 02 Task 05-02-03 Step D action body computes set_number from `queryClient.getQueryData<SetRow[]>(setsKeys.list(sessionId))` per CONTEXT.md D-16; defensive logging is deferred to V1.1.

## Sources

### Primary (HIGH confidence)

- `app/lib/query/client.ts` (Phase 4 — 495 LOC) — verified setMutationDefaults pattern, scope.id static-string contract, idempotent upsert, optimistic onMutate/onError/onSettled
- `app/lib/query/network.ts` (Phase 4) — verified `onlineManager.subscribe(resumePausedMutations)` block + `wasOnline` guard
- `app/lib/query/persister.ts` (Phase 4) — verified `createAsyncStoragePersister` + `persistQueryClient` usage
- `app/lib/queries/plan-exercises.ts` (Phase 4 — 209 LOC) — verified two-phase reorder pattern + scope-bound resource-hook pattern that Phase 5 mirrors
- `app/lib/queries/plans.ts` (Phase 4) — verified `initialData` pattern, `useCreatePlan({ planId })` constructor-time scope binding
- `app/supabase/migrations/0001_initial_schema.sql` (Phase 2) — verified workout_sessions + exercise_sets schema + RLS policies + indexes + set_type ENUM
- `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-CONTEXT.md` — all D-01…D-25 decisions sourced verbatim
- `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-UI-SPEC.md` — visual + interaction contract sourced
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-RESEARCH.md` — TanStack v5 patterns + scope.id semantics + idempotent upsert pattern + module-load-order rule
- `.planning/research/PITFALLS.md` §1.1–1.6, §5.1–5.4, §6.1–6.6, §8.1, §8.2, §8.12, §8.13 — all Phase 5-applicable pitfalls
- `npm view @tanstack/react-query version` 2026-05-12 → `5.100.10` [VERIFIED]
- `npm view expo-crypto dist-tags` 2026-05-12 → `sdk-54: 15.0.9` [VERIFIED]

### Secondary (MEDIUM confidence — verified via Phase 4 cross-check)

- TanStack v5 `setMutationDefaults` + persisted-mutations pattern — verified via Phase 4 RESEARCH §4 (which cited Context7 `/tanstack/query` 2026-05-10) [CITED via Phase 4]
- Supabase JS `.upsert(values, { onConflict: 'id', ignoreDuplicates: true })` semantics — verified via Phase 4 RESEARCH §5 (which cited Context7 `/supabase/supabase-js` 2026-05-10) [CITED via Phase 4]
- `useFocusEffect` + `freezeOnBlur` interaction — verified via Phase 4 commit `af6930c` SUMMARY learning
- `mutate` vs `mutateAsync` offline-safe convention — verified via Phase 4 Plan 04-04 commit `5d953b6` SUMMARY learning

### Tertiary (LOW confidence — assumed; flagged in Assumptions Log)

- A1, A2 — `throttleTime` option name and `persistClient()` API surface — Plan 02 verifies
- A3 — PostgREST `!inner` RLS interaction — Wave 0 test verifies
- A5 — Scope replay FIFO at 25-mutation scale — extended Wave 0 test + brutal-test verify

## Metadata

**Confidence breakdown:**
- Per-set persistence architecture: HIGH — directly inherits Phase 4 plumbing verified in 04-RESEARCH.md + Phase 4 implementation; only adds 5 new mutation keys following the same pattern
- Draft-session-recovery: HIGH — query shape is straightforward Supabase REST; `initialData` + `useFocusEffect` patterns proven in Phase 4
- F7 last-value query: MEDIUM — two-step query design verified against schema + indexes, but `!inner`-with-RLS interaction (A3) needs explicit test
- F13 brutal-test recipe: HIGH — recipe is comprehensive and mirrors Phase 4 airplane-mode UAT shape (which signed off `approved`)
- Schema changes: HIGH — confirmed zero migrations by reading the deployed `0001_initial_schema.sql`
- Pitfalls: HIGH — drawn from PITFALLS.md + Phase 4 SUMMARY learnings
- Validation Architecture: HIGH — follows the established `tsx`-script convention; Wave 0 gaps clearly enumerated
- Security: HIGH — RLS already in place; T-05-* threats are direct adaptations of the established Phase 4 T-04-* register

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (TanStack v5.100, Supabase JS 2.105, Expo SDK 54 are all stable; revisit only on stack version bump)
