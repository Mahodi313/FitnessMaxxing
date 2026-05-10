# Phase 4: Plans, Exercises & Offline-Queue Plumbing - Research

**Researched:** 2026-05-10
**Domain:** Offline-first CRUD plumbing on TanStack Query v5 + Supabase + drag-to-reorder + NetInfo wiring (Expo SDK 54, RN 0.81, React 19.1)
**Confidence:** HIGH (every load-bearing claim verified against Context7 docs, npm registry as of 2026-05-10, official Expo SDK 54 docs, and the existing repo's Phase 1+3 code)

## Summary

Phase 4 wires the offline-first CRUD plumbing for plans / exercises / plan_exercises (F2/F3/F4) and refactors `app/lib/query-client.ts` (Phase 1) into the four-file `lib/query/{client,persister,network,keys}.ts` split that Phase 5 inherits. The architecture is already locked by `04-CONTEXT.md` (D-01 through D-18) and `research/ARCHITECTURE.md` Pattern 1 — this research document confirms the current API surface of every library involved, names the exact code shapes the planner should reach for, and surfaces the few landmines that have shifted since the project's bootstrap research (specifically: NetInfo `isConnected: null` handling already shipped in Phase 1, `expo-crypto` SDK 54 line is `~15.0.9`, and `react-native-draggable-flatlist@4.0.3` works with Reanimated 4.1.x in the wild despite a stale README).

The single biggest finding that **could** affect a CONTEXT.md decision: the existing `app/app/_layout.tsx` already calls `onlineManager.setEventListener` and the existing `lib/query-client.ts` already calls `persistQueryClient` — but **nowhere does it call `queryClient.resumePausedMutations()` on the persister's `onSuccess` callback**, which is the load-bearing hook for the airplane-mode-test (success #4). The Phase 1 setup uses the imperative `persistQueryClient(...)` (not the `<PersistQueryClientProvider>` component), which has **no** `onSuccess` callback. Phase 4 must add the resume call somewhere — either by adopting `PersistQueryClientProvider` (the canonical TanStack v5 pattern) OR by adding an explicit `onlineManager.subscribe()` listener that fires `resumePausedMutations()` on offline→online transitions. CONTEXT.md D-01 says Phase 4 will add the latter inside `lib/query/network.ts`. This research confirms that approach is sufficient, and details exactly where it must run relative to `setMutationDefaults` registration.

**Primary recommendation:** Refactor as CONTEXT.md D-01 specifies (`lib/query/{client,persister,network,keys}.ts` split). In `lib/query/network.ts`, add an `onlineManager.subscribe(online => { if (online) queryClient.resumePausedMutations(); })` call AFTER `lib/query/client.ts` has executed all `setMutationDefaults` calls at module load. Keep the imperative `persistQueryClient(...)` (no need to switch to `PersistQueryClientProvider`). Use `expo-crypto.randomUUID()` (SDK 54 line is `~15.0.9`) for client-generated UUIDs. Use `react-native-draggable-flatlist@4.0.3` (gesture-handler + Reanimated 4 peer deps already installed). No new schema migrations required — the Phase 2 schema already has `default gen_random_uuid()` on every table, which Postgres treats as a fallback when the client supplies its own `id`. Server-side conflict resolution is "primary key wins" — duplicate replays fail with PG error code `23505` (unique_violation), which TanStack v5 surfaces as a normal mutation error and is then a no-op because the row already exists.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**F13 plumbing scope (Phase 4 vs Phase 5)**
- **D-01:** Refactor `app/lib/query-client.ts` (Phase 1) → `app/lib/query/{client,persister,network,keys}.ts` per research/ARCHITECTURE.md §3. Move `focusManager.setEventListener` + `onlineManager.setEventListener` from `app/app/_layout.tsx` into `lib/query/network.ts`.
- **D-02:** AsyncStorage-flush-on-background hook (Pitfall 1.3) → **Phase 5 owns**. Plans/exercises CRUD is low-frequency; default persister-throttle (1000ms) + manual reload suffices for Phase 4 success #4.
- **D-03:** Redundant Zustand "pending mutations"-store (Pitfall 1.3 belt-and-braces) → **Phase 5 owns**. Plans-CRUD is unthreatened by sub-3s SLA.
- **D-04:** `setMutationDefaults` per `mutationKey` MUST be registered before `persistQueryClient` mounts. Phase 4 keys: `['plan','create']`, `['plan','update']`, `['plan','archive']`, `['exercise','create']`, `['plan-exercise','add']`, `['plan-exercise','update']`, `['plan-exercise','remove']`, `['plan-exercise','reorder']`.
- **D-05:** OfflineBanner is **binary** in V1 — copy: "Du är offline — ändringar synkar när nätet är tillbaka." Triggered by custom `useOnlineStatus()` hook over `onlineManager.isOnline()`.
- **D-06:** Client-generated UUIDs via `expo-crypto.randomUUID()` in `app/lib/utils/uuid.ts`. All mutations that create rows pass `id: randomUUID()` so optimistic-update + replay are idempotent.
- **D-07:** `networkMode: 'offlineFirst'` on BOTH queries and mutations in `lib/query/client.ts`.

**Drag-to-reorder UX & library**
- **D-08:** `react-native-draggable-flatlist`. Drag-handle (≡) always visible to the right of each row.
- **D-09:** Reorder = bulk-update of all changed rows on `onDragEnd`, one mutation per changed row, all with `scope: { id: 'plan:<planId>' }` for serial replay.
- **D-10:** `order_index` numbering = **dense** (0, 1, 2, 3...). Sparse fractional deferred to V1.1+.

**Plan-editor scope & exercise-add UX**
- **D-11:** Plan-editor exposes full target fields per plan_exercise: `target_sets`, `target_reps_min`, `target_reps_max`, `notes`.
- **D-12:** Plan deletion = **archive** (`UPDATE workout_plans SET archived_at = now()`); list filters `WHERE archived_at IS NULL`.
- **D-13:** Exercise-add UX = inline-create-or-pick sheet triggered from plan-detail.
- **D-14:** Empty-state CTA on Planer-tab: centered icon + "Inga planer än. Skapa din första plan." + primary button.

**(tabs) skeleton + sign-out**
- **D-15:** Full V1 tab skeleton lands in Phase 4: Planer + Historik (placeholder) + Inställningar (placeholder + sign-out).
- **D-16:** Sign-out moves from `(app)/index.tsx` to `(tabs)/settings.tsx`. `(app)/index.tsx` is **deleted**.
- **D-17:** Tab labels in Swedish: "Planer" / "Historik" / "Inställningar".
- **D-18:** Default Expo Router `<Tabs>` with Ionicons + NativeWind dark-mode styling.

### Claude's Discretion (planner picks)

- `@expo/vector-icons` exact icon name for tab-bar (already locked in UI-SPEC: `barbell` / `time` / `settings`).
- Exercise-add sheet presentation (already locked in UI-SPEC: `expo-router presentation: 'modal'`).
- Drag-handle icon-design (already locked in UI-SPEC: Ionicons `reorder-three-outline`).
- Search implementation in exercise-add sheet (already locked in UI-SPEC: client-side `.filter()`).
- Optimistic-update snapshotting (research recommends partial-key snapshot per mutation — see §4 below).
- `useOnlineStatus()` placement — research recommends `lib/query/network.ts` (see §6 below).
- Plan-edit autosave vs explicit-save (already locked in UI-SPEC: explicit `Spara`, RHF `mode: 'onSubmit'`).
- Plan-list ordering (already locked in UI-SPEC: `created_at desc`).
- `exercises` LIST scope (already locked in UI-SPEC: `user_id = (select auth.uid())`).

### Deferred Ideas (OUT OF SCOPE)

- AsyncStorage-flush-on-background hook → Phase 5
- Redundant Zustand pending-mutations-store → Phase 5
- Pending-mutations-counter in OfflineBanner → V2 (F24)
- Sparse fractional `order_index` → V1.1 optimization
- Restore-arkiverad-plan-flow → V1.1
- Long-press menu on plan-row → V1.1
- Multi-select in exercise-picker → V1.1
- "Senast använda övningar" view in exercise-picker → V1.1
- Drag-att-ordna planer in plan-list → V1.1
- Bottom-sheet via `@gorhom/bottom-sheet` → V1.1
- Custom tab-bar → Phase 7
- Förladdat globalt övningsbibliotek (F20) → V2
- Plan duplicate / "kopiera plan" → V1.1
- Plan-templates (F30) → V2
- Exercise CSV export (F27) → V2

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| F2 | User can create, edit, and delete (archive) workout plans | §1 (Stack), §3 (drag library N/A here), §4 (TanStack v5 mutation patterns), §5 (idempotent UUIDs + Postgres `default gen_random_uuid()` accepts client UUIDs), §10 (Validation Architecture) |
| F3 | User can create their own exercises | §1 (no new libs), §4 (mutation pattern + RHF + Zod), §5 (idempotent UUIDs), §10 |
| F4 | User can add and drag-reorder exercises in a plan | §3 (`react-native-draggable-flatlist@4.0.3`), §4 (optimistic snapshot pattern for reorder), §5 (`scope.id: 'plan:<id>'` for serial replay), §10 |

All three requirements depend on the offline plumbing (CONTEXT.md success #4 — airplane-mode test). The plumbing is shared across all three; that's why CONTEXT.md treats Phase 4 as one bundle, not three independent slices.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plan CRUD (create / update / archive) | API / Backend (Supabase REST + RLS) | Browser / Client (TanStack Query cache + optimistic update) | RLS enforces `user_id = auth.uid()` server-side; client cache is a UX optimization. Source of truth lives in Postgres. |
| Exercise create | API / Backend (Supabase REST + RLS) | Browser / Client (TanStack Query cache) | Same as above. RLS policy `Users can insert own exercises` already in place from Phase 2. |
| plan_exercises add / update / remove / reorder | API / Backend (Supabase REST + RLS via `EXISTS` subquery on `workout_plans`) | Browser / Client (TanStack Query cache + drag library state) | RLS uses an `EXISTS` subquery against `workout_plans` to verify ownership transitively. Already in place from Phase 2. |
| Offline mutation queue | Browser / Client (TanStack Query v5 paused-mutations) | Browser / Client (AsyncStorage via persister) | The "queue" is TanStack v5's paused-mutation list; persister dehydrates it to AsyncStorage. No backend involvement. |
| Network state detection | Browser / Client (NetInfo → `onlineManager`) | — | Pure client-side concern. |
| App-foreground refetch | Browser / Client (AppState → `focusManager`) | — | Pure client-side concern. |
| Offline UI banner | Browser / Client (custom `useOnlineStatus()` hook) | — | Pure client-side concern. |
| Client-generated UUIDs | Browser / Client (`expo-crypto.randomUUID()`) | Database / Storage (Postgres `default gen_random_uuid()` as fallback when no client UUID is supplied) | Client supplies the UUID for offline idempotency; server schema accepts it via column default that only fires when client doesn't supply one. Per Postgres semantics, `DEFAULT` is only consulted when the column is absent from the INSERT — supplying `id` overrides the default. |
| Drag gesture | Browser / Client (`react-native-gesture-handler` + `react-native-reanimated` via `react-native-draggable-flatlist`) | — | Pure client-side concern. |

## Project Constraints (from CLAUDE.md)

These are non-negotiable directives the planner MUST honor:

- **Tech stack locked:** Expo SDK 54 + React 19.1 + RN 0.81.5; TanStack Query 5.100.9; Zustand 5.0.13; RHF 7.75 + Zod 4.4.3 + @hookform/resolvers 5.2.2; date-fns 4.1.0; @supabase/supabase-js 2.105.4; NativeWind 4.2.3 + tailwindcss 3.4.19. No version bumps; no library substitutions.
- **iOS-only V1.** No Android-specific code paths.
- **Performance SLA:** ≤3s from "log set" tap to local-save. Phase 4 doesn't log sets but every Phase 4 mutation must follow the same `mutationKey` + `setMutationDefaults` pattern Phase 5 will use.
- **Data integrity:** never lose a logged set. Phase 4 establishes the queue plumbing Phase 5 stress-tests.
- **RLS mandatory** on all tables — Phase 2 already enabled it on all 6 tables. Phase 4 adds NO new schema (no new tables) so no new policies.
- **Service-role key forbidden in client code.** Audit gate: `git grep "service_role\|SERVICE_ROLE"` must match only `app/scripts/test-rls.ts`, `app/.env.example`, `.planning/`, and `CLAUDE.md`.
- **Sessions in `expo-secure-store` via `LargeSecureStore`** — Phase 1 already wired; Phase 4 doesn't touch.
- **Zod for ALL external data** — every Supabase response, every form input, every queue payload (when restoring from persister).
- **`(select auth.uid())` wrap** in any new RLS policy — Phase 4 adds no new policies but the principle is locked.
- **Migration-as-truth** — Phase 4 adds NO migrations. The Phase 2 schema is already complete for plans/exercises/plan_exercises.
- **Type-gen** runs after every schema migration. Since Phase 4 adds none, `app/types/database.ts` does not change.
- **kebab-case filenames** — `lib/queries/plan-exercises.ts` (not `planExercises.ts`).
- **Path-alias `@/*` → `./*`** — established Phase 1.
- **Inner Expo project under `app/` cwd** — every npm/expo command runs from `app/`.
- **GSD workflow** — all file edits go through GSD commands; no ad-hoc edits.

## Stack & Library Versions Confirmed (May 2026)

All versions verified against npm registry on 2026-05-10. Items already in `app/package.json` are marked "(installed)".

### Already installed (Phase 1+2+3)

| Library | Installed version | npm `latest` | SDK 54 dist-tag (if applicable) | Verification |
|---------|-------------------|--------------|----------------------------------|--------------|
| `expo` | `~54.0.33` | `~54.0.33` | sdk-54 | [VERIFIED: package.json] |
| `react` | `19.1.0` | (transitive) | — | [VERIFIED: package.json] |
| `react-native` | `0.81.5` | (transitive) | — | [VERIFIED: package.json] |
| `expo-router` | `~6.0.23` | (SDK 54 line) | sdk-54 | [VERIFIED: package.json] |
| `nativewind` | `^4.2.3` | `4.2.x` line | n/a | [VERIFIED: package.json] |
| `tailwindcss` | `^3.4.19` | (3.x line — NativeWind 4 hard-pins) | n/a | [VERIFIED: package.json] |
| `@tanstack/react-query` | `^5.100.9` | `5.100.9` | n/a | [VERIFIED: npm view 2026-05-10] |
| `@tanstack/query-async-storage-persister` | `^5.100.9` | `5.100.9` | n/a | [VERIFIED: npm view 2026-05-10] |
| `@tanstack/react-query-persist-client` | `^5.100.9` | `5.100.9` | n/a | [VERIFIED: npm view 2026-05-10] |
| `@react-native-async-storage/async-storage` | `2.2.0` | (SDK 54 line) | sdk-54 | [VERIFIED: package.json] |
| `@react-native-community/netinfo` | `11.4.1` | (SDK 54 line) | sdk-54 | [VERIFIED: package.json] |
| `@supabase/supabase-js` | `^2.105.4` | `2.105.4` | n/a | [VERIFIED: npm view] |
| `expo-secure-store` | `~15.0.8` | (SDK 54 line) | sdk-54 | [VERIFIED: package.json + npm view dist-tags showed `sdk-54: 15.0.x`] |
| `aes-js` | `^3.1.2` | n/a | n/a | [VERIFIED: package.json] |
| `react-native-get-random-values` | `~1.11.0` | n/a | n/a | [VERIFIED: package.json] — already installed for the LargeSecureStore pattern; not needed by `expo-crypto.randomUUID()` itself which uses native crypto, but kept because LargeSecureStore depends on it |
| `react-hook-form` | `^7.75.0` | `7.75.0` | n/a | [VERIFIED: npm view] |
| `@hookform/resolvers` | `^5.2.2` | `5.2.2` | n/a | [VERIFIED: npm view] |
| `zod` | `^4.4.3` | `4.4.3` | n/a | [VERIFIED: npm view] |
| `zustand` | `^5.0.13` | `5.0.13` | n/a | [VERIFIED: npm view] |
| `@expo/vector-icons` | `^15.0.3` | (SDK 54 line) | sdk-54 | [VERIFIED: package.json] — Ionicons subset already shipped |
| `react-native-gesture-handler` | `~2.28.0` | (SDK 54 line) | sdk-54 | [VERIFIED: package.json] — required peer dep of draggable-flatlist |
| `react-native-reanimated` | `~4.1.1` | (SDK 54 line) | sdk-54 | [VERIFIED: package.json] — required peer dep of draggable-flatlist |
| `react-native-worklets` | `0.5.1` | (SDK 54 line) | sdk-54 | [VERIFIED: package.json] — Reanimated 4.1+ peer dep |
| `react-native-safe-area-context` | `~5.6.0` | (SDK 54 line) | sdk-54 | [VERIFIED: package.json] — needed for OfflineBanner top-inset |

### NEW dependencies entering Phase 4

| Library | Version to install | Install command | Why | Verification |
|---------|---------------------|------------------|-----|--------------|
| `expo-crypto` | `~15.0.9` (SDK 54 line per dist-tag `sdk-54`) | `npx expo install expo-crypto` (NOT `npm install` — `npm view expo-crypto@latest` returns `55.0.14` which is the SDK 55 line; `npx expo install` reads the installed Expo SDK and resolves to the SDK 54 line) | Provides `Crypto.randomUUID()` per RFC4122 v4, used for client-generated row IDs (D-06, Pitfall 5.1) | [VERIFIED: `npm view expo-crypto dist-tags` returned `sdk-54: 15.0.9`, `latest: 55.0.14`, on 2026-05-10] [CITED: docs.expo.dev/versions/latest/sdk/crypto/] |
| `react-native-draggable-flatlist` | `^4.0.3` | `npm install react-native-draggable-flatlist` (no `npx expo install` because the package isn't part of the Expo SDK; npm install + the already-installed gesture-handler + Reanimated peer deps is sufficient) | Drag-to-reorder for plan_exercises (D-08); battle-tested community standard built on gesture-handler + Reanimated | [VERIFIED: `npm view react-native-draggable-flatlist version` returned `4.0.3`, last published 2025-05-06] [VERIFIED: peer deps `react-native: >=0.64.0`, `react-native-gesture-handler: >=2.0.0`, `react-native-reanimated: >=2.8.0` — all satisfied by the existing repo] [VERIFIED: WebSearch 2026-05-10 confirmed `4.0.3` works with Expo SDK 54 + Reanimated 4.1.x in production projects, despite the package's stale README that doesn't mention Reanimated 4 specifically] |

**Installation commands (planner sequences these):**

```bash
# From app/ cwd
npx expo install expo-crypto
npm install react-native-draggable-flatlist
```

That's the entire dependency delta for Phase 4. Two packages.

**Version verification commands run 2026-05-10:**

```bash
$ npm view expo-crypto version              # 55.0.14 (SDK 55 — NOT what we want)
$ npm view expo-crypto dist-tags --json     # { "sdk-54": "15.0.9", "latest": "55.0.14", ... }
$ npm view react-native-draggable-flatlist version    # 4.0.3
$ npm view react-native-draggable-flatlist@4.0.3 peerDependencies
  # { 'react-native': '>=0.64.0',
  #   'react-native-gesture-handler': '>=2.0.0',
  #   'react-native-reanimated': '>=2.8.0' }
$ npm view @tanstack/react-query version              # 5.100.9 (matches installed)
$ npm view @tanstack/query-async-storage-persister version  # 5.100.9
$ npm view @tanstack/react-query-persist-client version    # 5.100.9
```

## Architecture Recommendation

This is the chosen architecture for the offline queue + persistence + sync. It is **already** prescribed by `04-CONTEXT.md` D-01 / D-04 / D-07 and `research/ARCHITECTURE.md` Pattern 1; this section confirms it remains canonical against current TanStack v5 docs and surfaces one gap in the Phase 1 setup the planner must close.

### The single architecture (no alternatives)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Component layer                            │
│   useCreatePlan()    useReorderPlanExercises()    useCreateExercise()│
│   ─ all use TanStack useMutation({ mutationKey: ['plan','create'] })│
│   ─ NO mutationFn at call site (footgun — see Pitfall §8.1)         │
│   ─ payloads include client-generated id from expo-crypto           │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  lib/query/client.ts                                                 │
│  ─ creates QueryClient(defaultOptions: { networkMode: 'offlineFirst'})│
│  ─ at module load, calls setMutationDefaults for ALL 8 phase 4 keys │
│    BEFORE any persister hydration runs                              │
│  ─ each default: mutationFn + onMutate + onError + onSettled +      │
│    optional scope.id for serial-ordering                            │
│  ─ exports queryClient singleton                                     │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  lib/query/persister.ts                                              │
│  ─ creates createAsyncStoragePersister({ storage: AsyncStorage })   │
│  ─ calls persistQueryClient({ queryClient, persister, maxAge: 24h })│
│  ─ default throttle (1000ms) — Phase 5 D-02 will lower this         │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  lib/query/network.ts                                                │
│  ─ onlineManager.setEventListener(NetInfo)                          │
│  ─ focusManager.setEventListener(AppState)                          │
│  ─ NEW IN PHASE 4: onlineManager.subscribe(online => {              │
│      if (online) queryClient.resumePausedMutations();               │
│    })                                                                │
│  ─ exports useOnlineStatus() hook (subscribes to onlineManager)     │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AsyncStorage (persisted to disk, survives app force-quit)           │
│  ─ dehydrated query cache (results)                                 │
│  ─ dehydrated paused mutations (the queue)                          │
└──────────┬───────────────────────────────────────────────────────────┘
           │  (HTTPS when online)
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Supabase REST (PostgREST + RLS)                                     │
│  ─ INSERT/UPDATE with client-supplied id; default gen_random_uuid()  │
│    only fires when id is absent                                      │
│  ─ Duplicate replays fail with PG code 23505 (unique_violation) —   │
│    safe to ignore at the app level (row is already there)            │
└─────────────────────────────────────────────────────────────────────┘
```

### Module-load order (LOAD-BEARING — get this wrong and the queue silently drops mutations)

The persister must hydrate **after** all `setMutationDefaults` are registered. Otherwise, paused mutations rehydrated from AsyncStorage cannot find their `mutationFn` and hang forever (TanStack v5 docs Anti-Pattern 1; CONTEXT.md D-04 footgun).

**Correct module-load chain:**

1. `app/app/_layout.tsx` imports `@/lib/query/client` (which creates `queryClient` AND registers all 8 `setMutationDefaults` at module top-level)
2. `app/app/_layout.tsx` imports `@/lib/query/persister` (which calls `persistQueryClient(...)` at module top-level — hydrates from AsyncStorage)
3. `app/app/_layout.tsx` imports `@/lib/query/network` (which wires NetInfo + AppState listeners + the `resumePausedMutations` subscription)
4. Render `<QueryClientProvider client={queryClient}>` as before

JavaScript module caching guarantees each of these runs exactly once per JS bundle load. The `import` order in `_layout.tsx` determines the run order.

### Why NOT switch to `<PersistQueryClientProvider>`

The TanStack v5 docs canonical example uses `<PersistQueryClientProvider>` (a component) which has a built-in `onSuccess` callback for calling `resumePausedMutations` after hydration. We could switch to it. **We don't, because:**

- Phase 1 already shipped with the imperative `persistQueryClient(...)` pattern. Switching is a churn cost with no behavioral upside — both approaches achieve the same lifecycle, just expressed differently.
- The `onSuccess` of `<PersistQueryClientProvider>` only fires ONCE on first hydration. We need `resumePausedMutations()` to fire **every** time the network comes back online (not just on app launch). The `onlineManager.subscribe()` approach handles BOTH cases (initial-online-after-launch AND every offline→online transition).
- `onlineManager.subscribe()` callback runs after `setMutationDefaults` registration because module load order guarantees it (see above).

This is consistent with `research/ARCHITECTURE.md` §1's diagram: "onlineManager (NetInfo) + focusManager (AppState) → triggers `resumePausedMutations()`".

### What the planner must NOT do

- Do NOT inline `mutationFn` at component-level `useMutation` call sites — defaults must own the function reference (Pitfall 8.1).
- Do NOT set `setMutationDefaults` inside React components — must be at module top-level (Pitfall 8.5).
- Do NOT wrap the entire component tree in a fresh `QueryClient` — Phase 1 already created the singleton; reuse it.
- Do NOT add `networkMode: 'always'` anywhere — would break offline pause behavior.
- Do NOT skip `retry: 1` on mutation defaults — `retry: 0` (the v5 default for mutations) drops queued offline mutations on the first network blip (Pitfall 5.4 from research/PITFALLS.md).

### Concrete file outline

```
app/lib/query/
├── client.ts        # QueryClient + 8x setMutationDefaults — ~250 LOC
├── persister.ts     # createAsyncStoragePersister + persistQueryClient — ~15 LOC
├── network.ts       # onlineManager + focusManager + useOnlineStatus hook — ~50 LOC
└── keys.ts          # Query key factory — ~30 LOC

app/lib/queries/     # Resource-scoped hook re-exports
├── plans.ts         # usePlansQuery, usePlanQuery, useCreatePlan, useUpdatePlan, useArchivePlan
├── exercises.ts     # useExercisesQuery, useCreateExercise
└── plan-exercises.ts # usePlanExercisesQuery, useAddExerciseToPlan, useUpdatePlanExercise, useRemovePlanExercise, useReorderPlanExercises

app/lib/schemas/
├── auth.ts          # (Phase 3 — unchanged)
├── plans.ts         # NEW: workout_plans Insert/Update + form-input shapes
├── exercises.ts     # NEW: exercises Insert/Update
└── plan-exercises.ts # NEW: plan_exercises Insert/Update + reps_min ≤ reps_max refine

app/lib/utils/
└── uuid.ts          # NEW: thin wrapper around expo-crypto.randomUUID()

app/lib/hooks/
└── (nothing new — useOnlineStatus lives in lib/query/network.ts and is re-exported from there)

app/components/
└── offline-banner.tsx  # NEW: binary banner

app/app/(app)/(tabs)/   # NEW route group
├── _layout.tsx      # Tabs config + OfflineBanner mount
├── index.tsx        # Planer (default tab)
├── history.tsx      # placeholder
└── settings.tsx     # placeholder + sign-out

app/app/(app)/plans/    # NEW
├── new.tsx          # create plan
├── [id].tsx         # plan detail/edit + draggable list
└── [id]/
    ├── exercise-picker.tsx  # modal route — exercise add sheet
    └── exercise/[planExerciseId]/edit.tsx  # modal route — per plan_exercise targets edit

app/app/_layout.tsx       # MODIFIED: removes inline focusManager+onlineManager;
                          # imports @/lib/query/{client,persister,network} for side-effects
app/lib/query-client.ts   # DELETED after migration (replaced by lib/query/client.ts)
app/app/(app)/index.tsx   # DELETED (Phase 3 placeholder)
app/lib/auth-store.ts     # MODIFIED: import path bumped @/lib/query-client → @/lib/query/client
```

This matches CONTEXT.md `<code_context>` "Integration Points" 1:1.

## Drag-to-Reorder Approach

### Library: `react-native-draggable-flatlist@^4.0.3`

[VERIFIED: npm view 2026-05-10] `4.0.3` is the current `latest` dist-tag, published 2025-05-06. Note: there's a `next: 2.0.9` tag pointing at an older v2 line and a `beta: 4.0.0-beta.12` — these are NOT what we want. Use `latest` (`4.0.3`).

[VERIFIED: peer deps `react-native: >=0.64.0`, `react-native-gesture-handler: >=2.0.0`, `react-native-reanimated: >=2.8.0`] All satisfied by the repo (RN 0.81.5, gesture-handler 2.28, Reanimated 4.1.1). The `>=2.8.0` peer dep on Reanimated is loose — production users have confirmed v4.0.3 works with Reanimated 4.1.x (WebSearch 2026-05-10).

[ASSUMED] No known incompatibilities with React 19.1 — the library uses standard hooks and `useSharedValue` from Reanimated; no React-internals coupling. (Risk if wrong: drag gesture doesn't fire OR list crashes on render. Mitigation: verify in Plan 02 with a 5-minute smoke test before building the full plan-detail screen.)

### Why this library, not alternatives

- `react-native-reorderable-list` (newer, Reanimated 4 native) — would also work but isn't in the recommended stack and the repo doesn't have it. CONTEXT.md D-08 explicitly picked `react-native-draggable-flatlist`.
- Hand-rolled with `Reanimated 4 + gesture-handler` — 1-2 days of work + edge cases (Pitfall §8.4); CONTEXT.md rejected.
- Up/down pillar buttons (no drag) — fails F4 acceptance criterion ("drag-att-ordna"); CONTEXT.md rejected.

### Ordering scheme: dense integers (0, 1, 2, 3...)

CONTEXT.md D-10 picks dense. This research confirms it's the right call for V1:

- Plan size in V1 = 5–10 exercises typical; max ~30. Reorder cost = O(N) writes per drag = trivial (10 mutations queued sequentially via `scope.id`).
- Sparse fractional indexing (1024, 2048, 3072 — bisect on insert) is the classic optimization but adds complexity that V1 doesn't need. Deferred to V1.1 per CONTEXT.md `<deferred>`.
- The Phase 2 schema already enforces `unique (plan_id, order_index)` — meaning **dense reorders MUST update all changed rows in the same transaction OR use a temporary "move to high index" trick** to avoid the unique-constraint violation mid-update.

### **CRITICAL** — the unique constraint trap on dense reorder

[VERIFIED: `app/supabase/migrations/0001_initial_schema.sql` line 59: `unique (plan_id, order_index)`]

If the planner naively fires N independent `UPDATE` mutations (one per changed row) and they replay in any order, Postgres will reject the second mutation with a unique-violation error if it tries to write `order_index = 3` while the existing row at index 3 hasn't been moved yet.

**Three solutions, ranked by complexity:**

1. **(RECOMMENDED for V1)** **Two-phase update via `scope.id` serial replay.** First mutation moves all changed rows to `order_index = -1, -2, -3, ...` (negative offset = guaranteed-unused range). Second pass writes the final positions. Because `scope.id: 'plan:<id>'` enforces serial replay, the negative-offset writes complete before the final-position writes start. **Drawback:** doubles the mutation count (10 reorders → 20 mutations). For V1 single-user this is fine.

2. **Single bulk RPC.** Create a Supabase Edge Function or Postgres RPC `reorder_plan_exercises(plan_id, ordered_ids[])` that does the reorder in a single transaction with `WITH ordered AS (...) UPDATE ... FROM ordered WHERE ...`. Atomic. **Drawback:** new RPC = new migration = new RLS surface = scope creep beyond CONTEXT.md.

3. **Drop the unique constraint, replace with index.** Remove `unique (plan_id, order_index)`, replace with `create index ... on (plan_id, order_index)`. Then naive concurrent updates are safe (just sort-on-read). **Drawback:** drift detection + new migration + loses a useful invariant.

**Recommendation:** Plan 02 should pick **(1) Two-phase update**. The CONTEXT.md D-09 says "fire one mutation per changed row with `scope.id='plan:<id>'`" — this research clarifies that strategy needs the negative-offset trick to avoid the unique constraint, and the planner MUST account for it. Without this, the airplane-mode reorder test will fail on reconnect with PG error `23505`.

[ASSUMED] Postgres allows negative integers in `int` columns even though semantically `order_index` represents a position. The schema doesn't constrain `>= 0`. (Risk if wrong: reorder fails with constraint violation. Mitigation: Plan 02 verifies by running a manual `UPDATE plan_exercises SET order_index = -1 WHERE id = ...` against the live DB during scaffold.)

**Alternative the planner can choose** if the two-phase approach feels brittle: use `.upsert()` with `ignoreDuplicates: false` and a single mutation that sends the entire reordered list. Postgres handles the swap atomically. **Issue:** Supabase `upsert` updates by primary key (`id`) — every row in the upsert payload still gets a unique `(plan_id, order_index)` post-state, so unique-constraint applies the same way. The two-phase approach (or option 2/3) is unavoidable. The planner should document the chosen approach explicitly in the plan.

### Drag-handle UX

UI-SPEC locks `Ionicons reorder-three-outline` (≡ glyph), always visible at the right edge of each row. Long-press on the handle starts the drag (`onLongPress={drag}` callback from `react-native-draggable-flatlist`). Long-press anywhere on the row also starts drag (the library wires this by default if `onPressIn` isn't claimed). Both paths route through the same `onDragEnd` callback.

## Optimistic Updates + Cache Strategy

### TanStack Query v5 canonical pattern (verified via Context7 2026-05-10)

The v5 API for offline-persistent mutations with optimistic updates is documented as:

```typescript
queryClient.setMutationDefaults(['plan', 'create'], {
  mutationFn: (variables: PlanInsert) =>
    supabase.from('workout_plans').insert(variables).select().single().then(r => {
      if (r.error) throw r.error;
      return r.data;
    }),
  onMutate: async (variables, context) => {
    await context.client.cancelQueries({ queryKey: plansKeys.list() });
    const previous = context.client.getQueryData(plansKeys.list());
    context.client.setQueryData(plansKeys.list(), (old: Plan[] = []) =>
      [...old, { ...variables, created_at: new Date().toISOString() }]
    );
    return { previous };
  },
  onError: (error, variables, onMutateResult, context) => {
    if (onMutateResult?.previous) {
      context.client.setQueryData(plansKeys.list(), onMutateResult.previous);
    }
  },
  onSettled: (data, error, variables, onMutateResult, context) => {
    context.client.invalidateQueries({ queryKey: plansKeys.list() });
  },
  retry: 1,
});
```

**Note on the v5 callback signature change** [CITED: Context7 `/tanstack/query` 2026-05-10]: as of v5.84+, `onMutate`/`onError`/`onSuccess`/`onSettled` receive a `context` argument with `.client` (the QueryClient). This means inside `setMutationDefaults` the planner can access the QueryClient via `context.client` instead of importing the singleton — which avoids circular-dependency risk between `lib/query/client.ts` and `lib/queries/plans.ts`. Use this pattern.

### Snapshot strategy: **partial-key snapshot per mutation**

For `useCreatePlan` / `useUpdatePlan` / `useArchivePlan`: snapshot only the affected query key (`plansKeys.list()` or `plansKeys.detail(id)`). Don't snapshot the whole cache.

For `useReorderPlanExercises`: snapshot `planExercisesKeys.list(planId)` once at the start of the user's drag-end handler (NOT once per mutation), apply the new ordering optimistically as one cache write, then fire the N mutations. Each individual mutation's `onMutate` is a no-op (the cache is already correct); each `onError` rolls back the snapshot. This is "shared snapshot across a logical group" — pattern documented in TanStack v5 docs under "Optimistic updates with multiple mutations".

```typescript
// Conceptually (pseudocode):
function handleDragEnd(newOrder: PlanExercise[]) {
  const previous = queryClient.getQueryData(planExercisesKeys.list(planId));
  queryClient.setQueryData(planExercisesKeys.list(planId), newOrder);

  const changedRows = diff(previous, newOrder);
  for (const row of changedRows) {
    updatePlanExerciseMutation.mutate(
      { id: row.id, order_index: row.newOrderIndex },
      { onError: () => queryClient.setQueryData(planExercisesKeys.list(planId), previous) }
    );
  }
}
```

### Query key factory

`lib/query/keys.ts` exports a typed factory (TanStack v5 recommended pattern):

```typescript
export const plansKeys = {
  all: ['plans'] as const,
  list: () => [...plansKeys.all, 'list'] as const,
  detail: (id: string) => [...plansKeys.all, 'detail', id] as const,
};

export const exercisesKeys = {
  all: ['exercises'] as const,
  list: () => [...exercisesKeys.all, 'list'] as const,
};

export const planExercisesKeys = {
  all: ['plan-exercises'] as const,
  list: (planId: string) => [...planExercisesKeys.all, 'list', planId] as const,
};
```

Hierarchical keys let `invalidateQueries({ queryKey: plansKeys.all })` invalidate every plan-related query at once — useful in `onSettled` after archive.

## Idempotency & FK-Safety on Sync

### UUID strategy: `expo-crypto.randomUUID()`

[VERIFIED: docs.expo.dev/versions/latest/sdk/crypto via Context7] `Crypto.randomUUID()` returns a string conforming to RFC4122 v4. Cryptographically secure (uses platform-native crypto, not the JS-only `react-native-get-random-values` polyfill).

Wrapper file `app/lib/utils/uuid.ts`:

```typescript
import * as Crypto from 'expo-crypto';
export const randomUUID = (): string => Crypto.randomUUID();
```

Use site (in mutationFn or call site):

```typescript
useCreatePlan().mutate({
  id: randomUUID(),
  name: 'Push Day',
  description: null,
  user_id: session.user.id,  // RLS will reject if mismatched
});
```

### Why client-generated UUIDs (not server-generated)

[CITED: research/PITFALLS.md §5.1]

1. **Optimistic update needs a stable key from millisecond zero.** If the cache holds a row with a temp-id, the React `key` prop changes when the server returns the real id, causing remount + state loss.
2. **FK references must work offline.** A `plan_exercises` row references `workout_plans.id`. If the plan was created offline (no server id yet) and we add an exercise to it offline (also no server id), the FK can't be filled. Client UUIDs solve this: parent and child both get IDs synchronously, FK is satisfied locally, both rows queue, both replay with their stable IDs.
3. **Replay safety.** If a queued mutation actually succeeded server-side but the response was lost (network drop after commit), replay would create a duplicate **unless** the `id` is stable. With client UUIDs, the replayed `INSERT` violates the primary key constraint and Postgres returns `23505 unique_violation` — which is a no-op semantically (the row is already there).

### Schema compatibility (NO migration required)

[VERIFIED: app/supabase/migrations/0001_initial_schema.sql lines 32, 41, 50] All three tables have `id uuid primary key default gen_random_uuid()`. Postgres `DEFAULT` only fires when the column is **absent** from the INSERT. Supplying `id: <client-uuid>` overrides the default with no schema change.

[CITED: PostgreSQL docs] `INSERT INTO t (id, name) VALUES ('client-uuid', 'foo')` ignores the `DEFAULT gen_random_uuid()` for that row.

This means **Phase 4 introduces ZERO schema migrations.** The Phase 2 schema already supports both server-generated (legacy) and client-generated (offline) IDs.

### Upsert config for replay safety

When replaying a queued mutation that the server already processed, two outcomes are possible:

1. **`.insert()` on a duplicate id** → PG `23505 unique_violation` → TanStack treats as mutation error → optimistic state is rolled back via `onError`. **This is the wrong outcome** because the row IS there; rolling back the cache erases the user's data from the UI even though it persisted.

2. **`.upsert(rows, { onConflict: 'id', ignoreDuplicates: true })`** → if `id` matches, skip the row → no error returned → optimistic state stays → cache is invalidated by `onSettled` → subsequent fetch confirms the row exists. **This is the correct outcome.**

[VERIFIED: Context7 `/supabase/supabase-js` 2026-05-10] `.upsert(values, { onConflict: 'id', ignoreDuplicates: true })` is the canonical idempotent-insert pattern. The `ignoreDuplicates` option (boolean, default false) instructs Supabase to issue `INSERT ... ON CONFLICT (id) DO NOTHING` instead of `DO UPDATE`.

**Recommended mutation pattern:**

```typescript
// In lib/query/client.ts setMutationDefaults
mutationFn: async (vars) => {
  const { data, error } = await supabase
    .from('workout_plans')
    .upsert(vars, { onConflict: 'id', ignoreDuplicates: true })
    .select()
    .single();
  if (error) throw error;
  return data;
},
```

**Use `.upsert(..., { ignoreDuplicates: true })` instead of `.insert(...)`** for all CREATE mutations in Phase 4. For UPDATE mutations (`useUpdatePlan`, `useUpdatePlanExercise`), use `.update(...)` directly — replays on UPDATE are inherently idempotent (running the same UPDATE twice doesn't dubbletter; the second run is a no-op when the row already has the new values).

For DELETE/`useArchivePlan` (which is `UPDATE archived_at = now()`): also idempotent — replay sets `archived_at` to a slightly later timestamp, which is semantically fine.

### FK ordering: solved by `scope.id` + client UUIDs

The classic pitfall (Pitfall 5.3): user creates Plan A offline, adds Exercise X to Plan A, goes online — the "add exercise" mutation may run before "create plan" finishes, FK violation.

**Solution:** Both mutations include `scope: { id: 'plan:<planId>' }` in their `setMutationDefaults`. TanStack v5 enforces serial replay within a scope — the create-plan mutation completes before the add-exercise mutation starts.

Concretely:

```typescript
queryClient.setMutationDefaults(['plan', 'create'], {
  scope: { id: (vars: PlanInsert) => `plan:${vars.id}` },
  // ...
});

queryClient.setMutationDefaults(['plan-exercise', 'add'], {
  scope: { id: (vars: PlanExerciseInsert) => `plan:${vars.plan_id}` },
  // ...
});
```

Same scope (`plan:<UUID>`) → serial replay, parent before child. Different scopes → parallel.

For `useCreateExercise` (which has no parent — exercises belong to the user, not to a plan): use a global scope `'exercise:create'` or omit `scope` entirely (parallel-OK). UI-SPEC's "+ Skapa & lägg till" flow chains an exercise create + a plan-exercise add — these need to be in the same scope (`plan:<planId>`) so the exercise lands before the plan-exercise references it. **The planner MUST set the exercise create's scope to `plan:<planId>` when triggered from the picker, NOT to a global exercise scope.**

[VERIFIED: Context7 TanStack v5 docs — mutation scopes documentation states "All mutations sharing the same scope.id will run sequentially. Mutations with no scope or with different scope.ids run in parallel."]

### Conflict resolution policy (V1 single-user, single-device)

Per `research/ARCHITECTURE.md` §5.3 and `research/PITFALLS.md` §5.2:

- `workout_plans` (low-frequency edits): last-write-wins by client `updated_at`. **However, the schema does not currently have an `updated_at` column on `workout_plans`** — Phase 4 would need to add one if true LWW were required. For V1 single-device (this is locked: "V1 är personligt verktyg på iPhone"), there are no concurrent writes from a second device, so LWW is unnecessary. **Recommendation: do not add `updated_at` in Phase 4.** Single device + queue replay = monotonic write order anyway.
- `exercises`: same as workout_plans.
- `plan_exercises`: append-only via add/remove; updates only modify `target_*` and `order_index` of existing rows. Client UUIDs guarantee idempotency of inserts; UPDATEs are last-write-wins by replay order (single device = one writer = no conflict).

[ASSUMED] Single-device V1 means no LWW conflict scenarios in practice. (Risk if wrong: data corruption if user installs on a second device. Mitigation: PROJECT.md explicitly scopes V1 to "personlig V1" with second device deferred to V2.)

## NetInfo + onlineManager Wiring

### Concrete pattern (already partially shipped in Phase 1; Phase 4 refactors + extends)

The existing Phase 1 setup in `app/app/_layout.tsx` (lines 36-52, verified) already does:

```typescript
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (s) => {
    if (Platform.OS !== 'web') setFocused(s === 'active');
  });
  return () => sub.remove();
});

onlineManager.setEventListener((setOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);  // null → online (cold-start before first probe)
  });
  return unsubscribe;
});
```

Phase 4 moves both blocks into `app/lib/query/network.ts` (CONTEXT.md D-01) and **adds** the missing piece — the resume-on-online subscription:

```typescript
// app/lib/query/network.ts (NEW FILE — Phase 4)
import { AppState, Platform } from 'react-native';
import { focusManager, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { useSyncExternalStore } from 'react';
import { queryClient } from './client';  // <-- import order: client.ts MUST execute first

// 1. focusManager: app-foreground triggers query refetch
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (s) => {
    if (Platform.OS !== 'web') setFocused(s === 'active');
  });
  return () => sub.remove();
});

// 2. onlineManager: NetInfo state propagates to TanStack
onlineManager.setEventListener((setOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);  // Phase 1 invariant: null → online
  });
  return unsubscribe;
});

// 3. NEW IN PHASE 4: resume paused mutations on every offline→online transition
let wasOnline = onlineManager.isOnline();
onlineManager.subscribe((online) => {
  if (online && !wasOnline) {
    void queryClient.resumePausedMutations();
  }
  wasOnline = online;
});

// 4. useOnlineStatus() hook for OfflineBanner
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,  // SSR fallback (not used in RN but required by useSyncExternalStore)
  );
}
```

Notes on this code:
- `onlineManager.subscribe()` returns an unsubscribe fn but we don't unsubscribe (module-scope, lives for app lifetime). [VERIFIED: TanStack v5 docs — `subscribe(listener)` API].
- The `wasOnline` guard prevents `resumePausedMutations()` from firing on every NetInfo update event (e.g., network type changes from wifi→cellular while still online). Only **transitions** from offline to online trigger replay.
- `useSyncExternalStore` is React 19's canonical way to subscribe to external stores. `onlineManager.subscribe` matches its signature exactly. [CITED: react.dev/reference/react/useSyncExternalStore]

### File-tree placement

CONTEXT.md "Claude's Discretion" left this open: `lib/hooks/use-online-status.ts` vs `lib/query/network.ts` re-export. **Recommendation: keep `useOnlineStatus()` in `lib/query/network.ts`** (no separate `lib/hooks/` folder for one hook). If Phase 5 grows the hook count beyond 3, the planner can refactor then.

Import path:

```typescript
// In app/components/offline-banner.tsx
import { useOnlineStatus } from '@/lib/query/network';
```

### Race condition: NetInfo says online but Supabase request still fails

This happens when NetInfo flips to "online" during a captive-portal warmup (e.g., gym wifi requires login) or when the device has connectivity but Supabase is unreachable. The `resumePausedMutations()` call fires the queued mutations; they hit the network; they fail with a generic fetch error.

**Mitigation built into the chosen architecture:**

- `setMutationDefaults({ retry: 1 })` — first failure is retried after the default exponential backoff (~1-30s).
- `networkMode: 'offlineFirst'` — if the second attempt also fails, the mutation pauses again instead of erroring out permanently.
- The next NetInfo event (or AppState foreground) triggers another `resumePausedMutations()` cycle.

Net effect: a captive-portal scenario causes one round of "try and fail" then the queue parks itself again until truly online. Acceptable for V1.

[ASSUMED] `networkMode: 'offlineFirst'` re-pauses a mutation that fails with a generic network error after retry exhaustion. (Risk if wrong: mutation enters terminal `error` state and is removed from the queue. Mitigation: Plan 02 should add a manual smoke test — captive-portal simulator scenario — before Phase 4 closes.)

### Mounting the OfflineBanner

UI-SPEC says: mount in `app/app/(app)/(tabs)/_layout.tsx`, ABOVE the `<Tabs>` component, INSIDE the SafeAreaView top inset.

```typescript
// app/app/(app)/(tabs)/_layout.tsx (sketch)
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { OfflineBanner } from '@/components/offline-banner';

export default function TabsLayout() {
  return (
    <SafeAreaView edges={['top']} className="flex-1">
      <OfflineBanner />
      <Tabs screenOptions={{ ... }}>
        ...
      </Tabs>
    </SafeAreaView>
  );
}
```

(The exact wrapper structure is the planner's call; the constraint is "OfflineBanner is above the tab-bar and below the safe-area top inset".)

## Schema Changes Required

**None.**

The Phase 2 schema (`0001_initial_schema.sql`) already provides every column, constraint, FK, and RLS policy Phase 4 needs:

- `workout_plans` — has `id` (default `gen_random_uuid()`), `user_id`, `name`, `description`, `created_at`, `archived_at`. RLS policy `Users can manage own plans` (FOR ALL with USING + WITH CHECK).
- `exercises` — has `id`, `user_id` (nullable for V2 globals), `name`, `muscle_group`, `equipment`, `notes`. RLS policies for select/insert/update/delete already in place.
- `plan_exercises` — has `id`, `plan_id`, `exercise_id`, `order_index`, `target_sets`, `target_reps_min`, `target_reps_max`, `notes`. Constraint `unique (plan_id, order_index)`. RLS policy via `EXISTS` subquery on `workout_plans`.
- All policies use `(select auth.uid())` wrapping per CLAUDE.md conventions (verified in 0001).

**Type-gen:** Since no schema changes, `app/types/database.ts` does NOT need regeneration.

**`unique (plan_id, order_index)` constraint** — confirmed exists. Triggers the two-phase reorder requirement documented in §3 above. Planner MUST account for this.

**No `updated_at` column on `workout_plans` / `exercises`** — confirmed missing. As §5 covers, V1 single-device doesn't need it. If V1.1 introduces multi-device sync, a migration will add it then.

## Pitfalls & Landmines

### 8.1 — TanStack Query: inline `mutationFn` at component-level loses on offline replay

**What goes wrong:** A component does `useMutation({ mutationFn: async (v) => supabase.from('plans').insert(v), mutationKey: ['plan','create'] })`. Mutation pauses offline, app force-quits, persister dehydrates the mutation to AsyncStorage with its `variables` but NOT the `mutationFn` (functions can't be serialized). On rehydrate, TanStack has variables but no function — mutation hangs forever in `isPaused: true`. User opens the app, network is back, and the queued plan never reaches Supabase.

**Why it happens:** The TanStack v5 docs example for `useMutation` shows inline `mutationFn`. The persistence-aware pattern requires `setMutationDefaults` and is documented separately under "Persisting offline mutations".

**How to avoid:** Every `mutationKey` used with `useMutation` MUST have a registered `setMutationDefaults` in `lib/query/client.ts` at module top-level. Components specify ONLY `mutationKey` — never `mutationFn`. The plan-checker should grep for `useMutation\(\s*\{\s*mutationFn` in `app/lib/queries/` and fail if any match.

**Warning signs:**
- A mutation works online but rows never appear in Supabase after airplane-mode-test.
- `isPaused: true` mutations in the dev-tools that never resume.
- The `mutationFn` import in a component file under `app/lib/queries/`.

### 8.2 — TanStack Query: `setMutationDefaults` registered after `persistQueryClient` runs

**What goes wrong:** The persister hydrates AsyncStorage at module load. If `setMutationDefaults` is registered later (in a `useEffect`, in a different module loaded later, or after the `persistQueryClient` import), rehydrated paused mutations have no defaults to bind to → same hang as Pitfall 8.1.

**Why it happens:** Module-load order isn't enforced by TypeScript or by lint rules. Easy to forget.

**How to avoid:** In `app/app/_layout.tsx`, import in this exact order: `'@/lib/query/client'` → `'@/lib/query/persister'` → `'@/lib/query/network'`. Document the order in a comment at the top of `_layout.tsx`. The plan-checker can add an assertion test (Plan 04) that verifies the import order via AST.

**Warning signs:**
- Reordering imports in `_layout.tsx` "for cleanliness" and the airplane-mode test starts failing.
- A new file imports `lib/query/client` AFTER importing something that triggers persister hydration.

### 8.3 — Supabase: `.insert()` on a replayed mutation throws unique-violation

Already covered in §5. **Mitigation:** use `.upsert(..., { onConflict: 'id', ignoreDuplicates: true })` for all create mutations.

### 8.4 — react-native-draggable-flatlist + Reanimated 4: `'worklet ref error'`

**What goes wrong:** v4.0.1 had a "worklet ref error" bug fixed in v4.0.2 (verified from release notes). Using v4.0.0 or v4.0.1 with Reanimated 4.x throws `'cannot find ref to ...'` on first drag.

**Why it happens:** Reanimated 4 changed how worklet refs are passed; older drag-flatlist worklet code didn't propagate refs correctly.

**How to avoid:** Pin to `^4.0.3` minimum. The repo will install latest at install time; CI lockfile will pin. Don't ever pin below `4.0.2`.

**Warning signs:** First drag throws a red-screen worklet error. Drag handle visible but drag does nothing.

### 8.5 — react-native-draggable-flatlist: Don't put it inside a `<ScrollView>` or another `<FlatList>`

**What goes wrong:** Issue #617 on the GitHub repo — nested in a parent `<FlatList>`, drag gestures bubble to the parent and steal scroll. UI-SPEC has the planner using `<DraggableFlatList>` as the screen-level scrollable in `plans/[id].tsx`, with the plan-meta form rendered as `ListHeaderComponent`. Do NOT wrap the draggable list in a `<ScrollView>`.

**Why it happens:** Nested scroll-claim semantics in RN are quirky.

**How to avoid:** Use `<DraggableFlatList>` as the top-level scroller; everything that would have been "above the list" goes in `ListHeaderComponent`. UI-SPEC §"Screen container" already prescribes this layout.

**Warning signs:** Drag works but the underlying scroll stops working, OR scroll works but drag doesn't fire.

### 8.6 — `@react-native-async-storage/async-storage`: 6MB warning at ~2-4MB cache size

**What goes wrong:** AsyncStorage on iOS has a soft cap (~6MB on iOS 13+ default; configurable but Expo Go uses default). A `gcTime: 24h` cache on every query can balloon. Phase 4 plans/exercises/plan_exercises queries are small (typical user = 5 plans × 8 exercises × small target objects = under 50KB) so this is not a Phase 4 risk. But Phase 5 will add 25-set workout sessions × N sessions × 24h retention — flag this for Phase 5 planning.

**Mitigation now:** Don't add `dehydrateOptions: { shouldDehydrateQuery: () => true }` — the default already excludes ephemeral queries. Use the default persister config.

### 8.7 — Expo Go vs dev-client compatibility check (LIBRARY-BY-LIBRARY)

| Library entering Phase 4 | Expo Go compatible? | Reason |
|--------------------------|---------------------|--------|
| `expo-crypto@~15.0.9` | ✅ YES | Pure JS API; uses native crypto bridges available in Expo Go runtime |
| `react-native-draggable-flatlist@^4.0.3` | ✅ YES | Pure JS + relies on already-installed gesture-handler + Reanimated which are Expo Go included |

Both Phase 4 dependencies work in Expo Go. **No dev-client build required for Phase 4.** This is verified — no native module installation step.

### 8.8 — NetInfo `isConnected: null` on cold-start

**What goes wrong:** First read of `NetInfo.fetch()` or first event from `addEventListener` may return `isConnected: null` (unknown — probe hasn't completed). If `onlineManager.setOnline(null)` is called, TanStack treats it as falsy and pauses all mutations until a real probe completes — making the first launch feel offline even when connected.

**How to avoid:** [Already done in Phase 1, verified in `app/app/_layout.tsx` line 49] use `state.isConnected !== false` (treats `null` as online). Phase 4 must preserve this when moving the listener to `lib/query/network.ts`.

### 8.9 — Reanimated 4 needs `react-native-worklets` peer dep

[VERIFIED: package.json] Already installed at `0.5.1`. Phase 4 doesn't change this.

### 8.10 — `LargeSecureStore` is for auth tokens only — DO NOT route the queue through it

The queue lives in plain AsyncStorage via `createAsyncStoragePersister`. CLAUDE.md security conventions accept this for V1: the queue payloads contain plan names, exercise names, target sets/reps — no PII or credentials. Plain AsyncStorage is the canonical TanStack pattern. **Do NOT route the persister through `LargeSecureStore`** (it would 4-5x slowdown every dehydrate, and the threat model doesn't justify it for non-credential data).

### 8.11 — Race: optimistic delete + reconnect + server returns the deleted row

**What goes wrong:** User removes Plan A offline. Optimistic update removes from cache. Reconnect fires `resumePausedMutations`. Mutation runs successfully. `onSettled` invalidates the list query. Background refetch returns... the plan, because some other path (Phase 6 history? a stale query?) re-inserted the plan during the offline window. This is mostly theoretical for V1 single-device but documented as a known limitation.

**Mitigation:** For V1, accept that on offline-archive, the plan stays "removed" in cache until the next list refetch. The list refetch is the source of truth. If the server still has the plan (unexpected), it'll reappear — that's actually correct behavior, because the user's archive intent failed at the data layer for some reason and the user should see the row again.

### 8.12 — Phase 1 has NO `resumePausedMutations()` call anywhere

[VERIFIED: grep across `app/lib/query-client.ts` and `app/app/_layout.tsx`] No call to `queryClient.resumePausedMutations()` exists. The only mechanism resuming mutations today is TanStack v5's auto-resume-on-mount behavior, which fires once per persister hydration. Without the offline→online subscription, mutations queued during the SAME app session (no force-quit) won't resume when network returns.

**Phase 4 closes this gap** by adding the `onlineManager.subscribe` block in `lib/query/network.ts` (see §6). This is the load-bearing change for the airplane-mode-test (success #4).

### 8.13 — Zod 4 schemas at the response boundary, not just the form boundary

CLAUDE.md V5 / SECURITY: "Zod schemas vid varje form-boundary OCH varje Supabase-respons". Phase 4 mutationFns receive Supabase responses — the planner must `parse()` them, not cast. Pattern:

```typescript
const PlanSchema = z.object({ id: z.string().uuid(), name: z.string(), ... });

mutationFn: async (vars) => {
  const { data, error } = await supabase.from('workout_plans').upsert(...).select().single();
  if (error) throw error;
  return PlanSchema.parse(data);  // <-- THIS, not `return data as Plan`
},
```

Why: Supabase returns `database.ts` types based on what was generated at type-gen time. If the schema drifts (e.g., a column is added between regen runs), TypeScript thinks the response matches but at runtime there's a missing field. Zod parse catches this.

## Vertical Slice Suggestions (MVP-mode planner input)

Per CLAUDE.md and CONTEXT.md MVP-mode: organize as vertical slices, not horizontal layers. Each slice ends with a visible verifiable thing. Slices below are sized for one Plan node each (per ARCHITECTURE/REVIEW node-sizing convention).

| Slice | Capability | Files touched | Verification |
|-------|------------|---------------|--------------|
| **A. Infra** | `lib/query/{client,persister,network,keys}.ts` split + 8 `setMutationDefaults` registrations + `onlineManager.subscribe(resumePausedMutations)` + `useOnlineStatus()` hook + delete `lib/query-client.ts` + update `lib/auth-store.ts` import | `app/lib/query/*` (4 files NEW), `app/lib/query-client.ts` (DELETE), `app/lib/auth-store.ts` (1-line import update), `app/app/_layout.tsx` (remove inline manager wiring; add new imports) | Manual: airplane mode → console-log paused mutation count > 0; reconnect → console log "resumed N mutations"; airplane-mode airplane-mode-test (success #4) without UI involvement (use a debug button) |
| **B. UUID + schemas** | `lib/utils/uuid.ts` (`expo-crypto.randomUUID()` wrapper) + `lib/schemas/{plans,exercises,plan-exercises}.ts` (Zod 4 + form schemas) | `app/lib/utils/uuid.ts` (NEW), `app/lib/schemas/{plans,exercises,plan-exercises}.ts` (3 NEW) | Unit test: parse a sample row, assert types match `database.ts`; run `randomUUID()` 10000x in a tight loop, assert no collisions |
| **C. Resource hooks** | `lib/queries/{plans,exercises,plan-exercises}.ts` — useQuery + useMutation hooks per resource (mutations specify only `mutationKey`, never `mutationFn`) | `app/lib/queries/*` (3 NEW) | Storybook-equivalent: render a list, fire a create mutation, watch optimistic update → console log → server confirm |
| **D. (tabs) skeleton** | `(tabs)/_layout.tsx` (Tabs config, dark-mode tints, OfflineBanner mount) + `(tabs)/index.tsx` (placeholder Planer for now) + `(tabs)/history.tsx` (placeholder) + `(tabs)/settings.tsx` (sign-out moved from (app)/index.tsx) + DELETE `(app)/index.tsx` | All under `app/app/(app)/(tabs)/`, plus delete | iPhone: tabs render, tap each, sign-out works from settings, dark mode toggles via system pref |
| **E. OfflineBanner** | `components/offline-banner.tsx` (binary, ✕ close-affordance per Phase 3 quick-task convention) | `app/components/offline-banner.tsx` (NEW) | Toggle airplane mode in simulator → banner appears; tap ✕ → banner dismisses; reconnect → banner re-arms for next offline event |
| **F. Plans CRUD UI (slice 1)** | `(tabs)/index.tsx` real plan-list + empty-state + FAB + `plans/new.tsx` (RHF form + `useCreatePlan`) | `app/app/(app)/(tabs)/index.tsx` (REPLACE placeholder), `app/app/(app)/plans/new.tsx` (NEW) | Create a plan online → see it in list; create a plan offline → see optimistic add; reconnect → still in list, no dubbletter |
| **G. Plan detail + meta-edit** | `plans/[id].tsx` (read plan, edit name/description with explicit Spara, archive via overflow menu confirm) | `app/app/(app)/plans/[id].tsx` (NEW) | Open plan, rename, save online → confirms; rename offline → optimistic update; archive → row disappears from list |
| **H. Exercise picker + create** | `plans/[id]/exercise-picker.tsx` (modal route — search list + inline-create form) | `app/app/(app)/plans/[id]/exercise-picker.tsx` (NEW) | Open picker, search, tap exercise → row added to plan; create new exercise → it appears in list AND added to plan in one chained-scope flow |
| **I. plan_exercise add + edit** | `useAddExerciseToPlan` + `useUpdatePlanExercise` (target_sets/reps_min/reps_max/notes edit screen at `plans/[id]/exercise/[planExerciseId]/edit.tsx`) | `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` (NEW) | Add exercise to plan, edit targets, save → reflects in plan-detail row chip "3×8–12" |
| **J. plan_exercise reorder + remove** | `useReorderPlanExercises` (two-phase update — see §3 unique constraint trap) + `useRemovePlanExercise` + drag-handle UI in `plans/[id].tsx` via `react-native-draggable-flatlist` | `app/app/(app)/plans/[id].tsx` (extend slice G), `app/lib/queries/plan-exercises.ts` (extend slice C) | Drag a row, release, see new order; force-quit, reopen, order persists; airplane mode + drag + force-quit + reconnect → no FK errors, no PG `23505` errors, new order in DB |
| **K. Manual airplane-mode acceptance test** | Documented manual test script (success criterion #4): airplane mode → create plan → add 3 exercises (chained-scope create-exercise + add-to-plan) → drag-reorder → force-quit → reopen offline (cache hydrated, all visible) → reconnect → verify Supabase Studio: all rows landed correctly, no dubbletter, no FK errors | `app/scripts/manual-test-phase-04-airplane-mode.md` (NEW) — checklist for human runner | Pass = success criterion #4 met |

The planner can fold/split these as needed — sizing is a hint, not a contract.

## Validation Architecture

> Required per `.planning/config.json` `workflow.nyquist_validation: true`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed yet — Phase 1+2+3 used **manual + scripted** validation only (no Jest/Vitest); test scripts run via `tsx` directly with `--env-file=.env.local`. Planner must decide between (a) keep this convention for Phase 4 (`scripts/test-*.ts` + manual airplane-mode), (b) introduce Jest/Vitest now. CONTEXT.md does not lock this — it's planner discretion. |
| Existing test scripts | `app/scripts/test-rls.ts` (cross-user RLS), `app/scripts/test-auth-schemas.ts` (Phase 3 Zod schema unit-style coverage), `app/scripts/verify-deploy.ts` (post-migration drift) |
| Quick run command | `npx tsx --env-file=.env.local scripts/<test-file>.ts` from `app/` cwd |
| Full suite command | `npm run test:rls && npm run test:auth-schemas` (no glob runner today) |

**Recommendation:** for Phase 4 keep the `tsx`-script convention to match Phase 1+2+3. Adding Jest is a Phase 5 or polish-phase decision.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| F2 | Create plan online | unit (schema) | `npx tsx --env-file=.env.local scripts/test-plan-schemas.ts` (asserts Zod plansSchema parse round-trips a valid sample) | ❌ Wave 0 — `app/scripts/test-plan-schemas.ts` |
| F2 | Create plan optimistic update + rollback on error | manual (Expo Go) | Manual: open Planer tab, create plan, observe row appears instantly; throw a forced 500 from a dev-only debug button to trigger rollback path | manual-only |
| F2 | Update plan name | unit (schema) + manual (Expo Go) | Schema test: `tsx scripts/test-plan-schemas.ts` updates a parse roundtrip; manual: edit name + Spara | partial — schema test in Wave 0 |
| F2 | Archive plan | unit (RLS) + manual | RLS test extends `test-rls.ts` with archive cross-user assertion; manual: tap "Arkivera plan", confirm dialog, plan vanishes from list | extend `app/scripts/test-rls.ts` |
| F3 | Create custom exercise | unit (schema) + manual | Schema test: `tsx scripts/test-exercise-schemas.ts`; manual: open picker, "+ Skapa ny övning", inline form, submit | ❌ Wave 0 — `app/scripts/test-exercise-schemas.ts` |
| F3 | Exercise visible in library at plan-edit | manual (Expo Go) | Manual: create exercise via picker, verify it shows in same picker's search list | manual-only |
| F4 | Add exercise to plan | unit (RLS — plan_exercises insert via plan-owner) + manual | RLS test extends `test-rls.ts`; manual: tap exercise in picker, see row appear in plan | extend `app/scripts/test-rls.ts` |
| F4 | Drag-reorder persistence | unit (constraint) + manual | Constraint test: `tsx scripts/test-reorder-constraint.ts` writes 5 plan_exercises, performs the two-phase reorder, asserts unique-constraint never violates; manual: drag in Expo Go, force-quit, reopen, order persists | ❌ Wave 0 — `app/scripts/test-reorder-constraint.ts` |
| F13 (success #4) | Airplane-mode + force-quit + reconnect | manual (Expo Go on device) | Manual: documented in `app/scripts/manual-test-phase-04-airplane-mode.md` (NEW Wave 0). Steps: 1) airplane on, 2) create plan + 3 exercises + drag-reorder, 3) force-quit Expo Go, 4) reopen still offline (verify cache hydrated, all visible), 5) airplane off, 6) verify Supabase Studio Tables view shows all rows, correct order, no dubbletter | ❌ Wave 0 — manual checklist file |
| F13 | OfflineBanner appears/disappears | manual (Expo Go) | Manual: airplane on → banner appears; airplane off → banner disappears | manual-only |
| Idempotency | Replayed mutation doesn't dubbletter | unit (Supabase upsert) + manual | Unit: `tsx scripts/test-upsert-idempotency.ts` calls `.upsert(..., { onConflict: 'id', ignoreDuplicates: true })` twice with same id, asserts second call returns no error and row count is 1; manual: airplane test #4 covers the end-to-end | ❌ Wave 0 — `app/scripts/test-upsert-idempotency.ts` |
| FK ordering | Child mutation waits for parent in same scope | unit (TanStack scope) + manual | Difficult to unit-test cleanly without mocking TanStack internals. **Manual + observation is canonical:** create plan offline → add exercise to it offline → reconnect → verify Supabase logs show plan INSERT before plan_exercise INSERT. **OR:** rely on TanStack v5 docs as the contract (scope.id semantics are library-level invariants). | observe-only — TanStack contract |
| Optimistic rollback | Server-side rejection rolls back UI | manual (Expo Go) + dev-only forced-error | Manual: temporarily set `mutationFn` to throw → trigger create → observe optimistic row appears then disappears | manual-only |

### Sampling Rate

- **Per task commit:** run the relevant `tsx scripts/test-*.ts` for the file just touched (planner decides which scripts map to which slices).
- **Per wave merge:** `npm run test:rls && npx tsx scripts/test-plan-schemas.ts && npx tsx scripts/test-exercise-schemas.ts && npx tsx scripts/test-reorder-constraint.ts && npx tsx scripts/test-upsert-idempotency.ts`
- **Phase gate:** all of the above + manual airplane-mode acceptance script + `npx tsx scripts/verify-deploy.ts` (no schema changes, but confirms no drift)

### Wave 0 Gaps

- [ ] `app/scripts/test-plan-schemas.ts` — covers F2 schema parse round-trip
- [ ] `app/scripts/test-exercise-schemas.ts` — covers F3 schema parse round-trip
- [ ] `app/scripts/test-plan-exercise-schemas.ts` — covers F4 schema parse round-trip + reps_min ≤ reps_max refine
- [ ] `app/scripts/test-reorder-constraint.ts` — covers the unique-constraint two-phase reorder algorithm
- [ ] `app/scripts/test-upsert-idempotency.ts` — covers replay safety (a single mutation replayed twice doesn't dubbletter)
- [ ] Extend `app/scripts/test-rls.ts` — add cross-user CRUD assertions for archive flow on `workout_plans` and add/remove on `plan_exercises` from a different user (must fail)
- [ ] `app/scripts/manual-test-phase-04-airplane-mode.md` — checklist for the airplane-mode acceptance test (human runner)
- [ ] Add `npm run test:plan-schemas`, `npm run test:exercise-schemas`, etc. scripts to `app/package.json`

(No framework install needed — `tsx` and `postgres` are already in devDependencies.)

## Security Domain

### Applicable ASVS L1 Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherits Phase 3) | `LargeSecureStore` already in place; Phase 4 doesn't touch auth surface |
| V3 Session Management | yes (inherits Phase 3) | `(select auth.uid())` in every RLS policy; `Stack.Protected` route guard already in `(app)/_layout.tsx` |
| V4 Access Control | yes — primary Phase 4 surface | RLS policies on workout_plans, exercises, plan_exercises (all in 0001 schema, verified). No new policies in Phase 4. Cross-user regression test in `app/scripts/test-rls.ts` MUST be extended for plan_exercises CRUD per CLAUDE.md "Cross-user verification is a gate" rule |
| V5 Input Validation | yes | Zod 4 schemas at form-boundary (RHF resolver) AND at every Supabase response boundary (`PlanSchema.parse(data)` not cast). New schemas: `lib/schemas/{plans,exercises,plan-exercises}.ts` |
| V6 Cryptography | partial | `expo-crypto.randomUUID()` is the ONLY new crypto surface — uses native UUIDv4 generator, not hand-rolled. No bespoke crypto in Phase 4 |

### STRIDE Threat Patterns for Phase 4

Per CLAUDE.md "Forms phase (Phase 4 — F2/F4): Threat IDs T-04-*"

| Pattern | STRIDE | Standard Mitigation | Notes |
|---------|--------|---------------------|-------|
| API1 / V4 — broken object-level authorization (e.g., user A creates a plan_exercise for user B's plan via crafted POST) | Tampering, Elevation of Privilege | RLS `Users can manage own plan exercises` policy — `EXISTS (SELECT 1 FROM workout_plans WHERE id = plan_id AND user_id = (select auth.uid()))` already in 0001 | T-04-01 |
| API4 — rate-limiting on user-triggered loops (e.g., user spams "+ add exercise" → 100 queued mutations on flush) | Denial of Service | Phase 4 plans CRUD is NOT loop-triggered (manual taps); no client-side throttle needed in V1. Supabase platform applies coarse rate-limits. **Document as accepted-risk in SECURITY.md.** | T-04-02 (accepted) |
| V5 — input validation bypass (e.g., NULL injection in exercise name, oversized notes field DoS-ing the renderer) | Tampering | Zod `.min(1).max(80)` on names; `.max(500)` on notes/description. Zod is applied at BOTH form input AND Supabase response parse | T-04-03 |
| V5 — XSS in user-provided plan name / exercise name (RN context: `<Text>` doesn't render HTML so XSS is not a concern, but if name leaks into a deep-link or web view it would matter) | Tampering | RN `<Text>` is XSS-safe; no HTML render path. Document as not-applicable. | T-04-04 (N/A in RN context) |
| M2 — insecure data storage (queue payload may contain plan/exercise text) | Information Disclosure | Plan/exercise text is non-PII (no health info, no credentials). Plain AsyncStorage acceptable per CLAUDE.md. **Document explicitly in SECURITY.md** as accepted (V1 single-user device, no PII). | T-04-05 (accepted) |
| API3 — excessive data exposure on response (e.g., a malformed query returns plans for all users) | Information Disclosure | RLS scopes at the DB layer; client never relies on filter for security. Cross-user RLS test enforces. | T-04-06 |
| API8 — security misconfiguration (e.g., exposing service-role key in queue payload, accidental log of auth token) | Information Disclosure | Service-role audit gate (CLAUDE.md). No `console.log` of session/token in Phase 4 code. The persister dehydrates QueryClient state — verify no auth tokens leak into the persisted snapshot (TanStack persists query data, not React state, so this is structurally safe — but document the audit). | T-04-07 |
| FK constraint violation on replay (covered in §3 above — unique violation on dense reorder) | Tampering (data integrity) | Two-phase update via `scope.id` serial replay (covered in §3). Without this mitigation, the airplane-mode test fails. | T-04-08 |
| Captive-portal scenario: NetInfo says online, Supabase fails | Denial of Service (self-inflicted) | `networkMode: 'offlineFirst'` + `retry: 1` re-pauses on sub-network failure | T-04-09 |
| Replayed mutation creates dubbletter (covered in §5) | Data Integrity | `.upsert(..., { onConflict: 'id', ignoreDuplicates: true })` for all create mutations | T-04-10 |

The full T-04-* threat register goes into Plan 02's `<threat_model>` block. The `gsd-secure-phase 4` audit closes the register before phase exit (`threats_open: 0`).

## Sources

### Primary (HIGH confidence)

- Context7 `/tanstack/query` — `setMutationDefaults`, `persistQueryClient`, `resumePausedMutations`, `dehydrate`/`hydrate`, `onlineManager.subscribe`, mutation `scope.id` semantics, `networkMode: 'offlineFirst'`. Fetched 2026-05-10 via `npx ctx7 docs '/tanstack/query' '...'`.
- Context7 `/supabase/supabase-js` — `.upsert(values, { onConflict: 'id', ignoreDuplicates: true })` semantics. Fetched 2026-05-10.
- Context7 `/expo/expo` `__branch__sdk-54` — `Crypto.randomUUID()` API and SDK 54 line. Fetched 2026-05-10.
- `npm view expo-crypto dist-tags` — confirmed SDK 54 line is `15.0.9`. Fetched 2026-05-10.
- `npm view react-native-draggable-flatlist version` + `peerDependencies` — confirmed `4.0.3` is current and peer deps are already satisfied. Fetched 2026-05-10.
- `app/supabase/migrations/0001_initial_schema.sql` — schema is already complete for plans/exercises/plan_exercises; `unique (plan_id, order_index)` constraint exists; RLS policies in place.
- `app/lib/query-client.ts` (Phase 1) — verified Phase 1's persister setup uses `persistQueryClient(...)` (imperative, no `onSuccess` callback), confirming Phase 4 must add the resume-on-online subscription explicitly.
- `app/app/_layout.tsx` (Phase 1+3) — verified existing `onlineManager.setEventListener` and `focusManager.setEventListener` blocks (Phase 4 moves them to `lib/query/network.ts`).
- `app/lib/auth-store.ts` (Phase 3) — verified `queryClient.clear()` on signOut + module-scope listener pattern; Phase 4 reuses this for `useAuthStore(s => s.session?.user.id)` reads where needed.

### Secondary (MEDIUM confidence)

- WebSearch (2026-05-10) — `react-native-draggable-flatlist 4.0.3` confirmed working with Expo SDK 54 + Reanimated 4.1 in production projects (medium.com upgrade story; community-confirmed). Stale README on the package's GitHub doesn't reflect current Reanimated 4 compat but real-world usage does.
- WebFetch — `https://github.com/computerjazz/react-native-draggable-flatlist/releases` for v4.x release notes (`v4.0.3 — Fix glitch on drag end`, `v4.0.2 — fix worklet ref error`).
- `research/ARCHITECTURE.md` (Phase 0 research, 2026-05-07) — Pattern 1 offline-first mutation with optimistic update + paused-mutation persistence; setMutationDefaults #1 footgun documentation.
- `research/PITFALLS.md` (Phase 0 research, 2026-05-07) — Pitfalls 1.3, 5.1, 5.2, 5.3, 5.4 directly applicable to Phase 4.

### Tertiary (LOW confidence — flagged for plan-time validation)

- [ASSUMED] Postgres `int` columns accept negative values — needed for the two-phase dense reorder. Recommendation: Plan 02 adds a 30-second SQL smoke test confirming `UPDATE plan_exercises SET order_index = -1 WHERE id = 'sample'` succeeds. (Risk if wrong: fall back to RPC or add a check constraint workaround.)
- [ASSUMED] `react-native-draggable-flatlist@4.0.3` works correctly with React 19.1 (no React-internals coupling). Verified by community usage but not by direct test in this repo. Plan 02 includes a 5-minute smoke-test slice (render an empty draggable list with 3 dummy items and try to drag) before scaling to the full plan-detail screen.
- [ASSUMED] Single-device V1 means no cross-device LWW conflicts. Locked by PROJECT.md scope (V1 = personal iPhone). Risk: V1.1 multi-device requires schema additions (`updated_at`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Postgres allows negative integers in `plan_exercises.order_index` (no `CHECK >= 0` constraint exists) | §3 Drag-to-Reorder, §8.4 | Two-phase reorder fails with constraint violation; Plan 02 must fall back to RPC or DROP the unique constraint and rely on app-side ordering. **Mitigation:** 30s SQL smoke test in Plan 02 scaffold step. |
| A2 | `react-native-draggable-flatlist@4.0.3` is React 19.1-compatible | §3, §8.4 | Drag library crashes on render; fall back to a simpler library or hand-rolled gesture. **Mitigation:** 5-minute Plan 02 smoke test (render 3-item dummy list and drag). |
| A3 | `networkMode: 'offlineFirst'` re-pauses a mutation after `retry: 1` exhausts (does NOT enter terminal `error` state) | §6 Captive-portal mitigation | Captive-portal scenarios drop mutations permanently; queue silently shrinks. **Mitigation:** add a captive-portal manual smoke test to the airplane-mode acceptance script. |
| A4 | Single-device V1 means no LWW conflict scenarios | §5 Conflict Resolution | If user adds a second device in V1, conflict resolution is undefined. Locked by PROJECT.md scope; revisit at V1.1 multi-device. |
| A5 | Plain AsyncStorage for the queue is acceptable per the V1 threat model (queue payloads contain no PII) | §8.10, Security Domain T-04-05 | If a future feature persists PII through the queue (e.g., user notes containing health data), queue must move to encrypted storage. **Mitigation:** SECURITY.md V1 accepted-risk; revisit if Phase 7 polish adds PII surfaces. |

## Open Questions

1. **Should `useReorderPlanExercises` use the two-phase update or fall back to a Supabase RPC?**
   - What we know: the unique constraint forces SOME ordering trick; two-phase is simpler but doubles mutation count; RPC requires a new migration.
   - What's unclear: whether 2x mutation count materially affects the airplane-mode test under realistic load (10 reorders × 2 = 20 mutations is still trivial).
   - Recommendation: Plan 02 picks two-phase; if the airplane-mode test reveals issues, escalate to an RPC in a follow-up plan.

2. **Should `useArchivePlan` show a different optimistic-update visual state ("archiving...") or just remove from list?**
   - What we know: UI-SPEC says "row disappears from list immediately" (optimistic remove from `plansKeys.list()` cache).
   - What's unclear: nothing functionally — the UI-SPEC is unambiguous. This is closed.

3. **Should the ID generation utility live at `lib/utils/uuid.ts` (CONTEXT.md D-06) or be inlined per call site?**
   - What we know: CONTEXT.md D-06 picks `lib/utils/uuid.ts`. Single source = easy to swap implementation later.
   - What's unclear: nothing — closed.

4. **Should the `(tabs)/settings.tsx` placeholder ship the dark-mode toggle stub?**
   - What we know: F15-toggle is V1.1 (REQUIREMENTS.md). UI-SPEC says "Mer kommer i Phase 7" placeholder.
   - What's unclear: nothing — Phase 7 owns the toggle.

## Environment Availability

> Skip rationale: phase has external service deps (Supabase) but they're already wired by Phase 1+2+3. No new tools or runtimes added in Phase 4.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 20+ | Expo CLI, npm scripts | ✓ | (assumed — Phase 1 verified) | — |
| Expo Go on iPhone | Manual airplane-mode test (success #4) | ✓ | (assumed — Phase 3 used it) | — |
| Supabase project | All persistence | ✓ | (Phase 2 deployed) | — |
| Postgres `gen_random_uuid()` | Schema default (still fires for non-Phase-4 callers if any) | ✓ | (Phase 2 verified) | — |
| `expo-crypto` native bridge | Client UUID generation | (will be after install) | `~15.0.9` (SDK 54) | If install fails on Expo Go: fall back to `react-native-uuid` (pure JS, no native module). Not expected to be needed. |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified via `npm view` 2026-05-10 + Context7 cross-check
- Architecture (offline queue, persister, network manager): HIGH — Pattern 1 from research/ARCHITECTURE.md confirmed against current TanStack v5 docs; one gap identified (no `resumePausedMutations` call in Phase 1) and the fix specified
- Idempotency (UUIDs, upsert, FK ordering): HIGH — Postgres `DEFAULT` semantics verified; Supabase upsert API verified via Context7; TanStack `scope.id` semantics verified
- Drag-to-reorder library: MEDIUM — peer deps verified, community confirms RN 0.81 + Reanimated 4.1 work, but the unique-constraint two-phase update is novel-to-this-repo and has assumption A1
- Pitfalls: HIGH — drawn from research/PITFALLS.md (already validated) + verified Phase 1 code state
- Validation Architecture: MEDIUM — depends on Plan 02's choice between extending the existing `tsx`-script convention vs introducing a test framework

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (stable libraries; revisit only if `npx expo install` resolves a different SDK 54 line for `expo-crypto` or if `react-native-draggable-flatlist` ships a 4.0.4+ with breaking changes)
