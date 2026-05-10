---
phase: 04-plans-exercises-offline-queue-plumbing
plan: 01
subsystem: infra
tags: [tanstack-query, offline-first, expo-crypto, zod, supabase, react-native, persistence, mutation-replay]

requires:
  - phase: 01-bootstrap-infra-hardening
    provides: query-client persister scaffold (24h maxAge); _layout.tsx focusManager + onlineManager wiring; LargeSecureStore Supabase client
  - phase: 02-schema-rls-type-generation
    provides: workout_plans + exercises + plan_exercises tables with RLS; types/database.ts; cross-user RLS test harness
  - phase: 03-auth-persistent-session
    provides: Zod 4 schema idiom (z.email + error: + .refine path:); Zustand auth-store; (app)/(auth) Stack.Protected gates
provides:
  - lib/query/{client,persister,network,keys}.ts four-file split with 8 setMutationDefaults registered at module top-level
  - onlineManager.subscribe(resumePausedMutations) block (closes Pitfall 8.12 — mutations queued offline now actually replay on reconnect)
  - useOnlineStatus() React hook backed by useSyncExternalStore (Plan 02 OfflineBanner consumer)
  - lib/utils/uuid.ts (expo-crypto randomUUID wrapper) — every Phase 4/5 CREATE mutation generates client-UUIDs before invoke for idempotent replay
  - lib/schemas/{plans,exercises,plan-exercises}.ts Zod 4 form-input + DB Row schemas
  - lib/queries/{plans,exercises,plan-exercises}.ts resource hooks (useQuery + useMutation; mutationKey-only — no inline mutationFn per Pitfall 8.1)
  - useReorderPlanExercises two-phase reorder algorithm (negative offsets bridge to dodge unique (plan_id, order_index))
  - Wave 0 verification harness: 7 tsx scripts gating Pitfalls 8.1, 8.2, 8.10, 8.12, 8.13 + RESEARCH §3 (unique-constraint trap) + §5 (chained scope.id replay) regressions
affects: [04-02 (OfflineBanner consumer of useOnlineStatus), 04-03 (plan-detail picker chains useCreateExercise + useAddExerciseToPlan via shared scope.id), 04-04 (drag-reorder consumer of useReorderPlanExercises + airplane-mode test), 05 (active workout hot path inherits the same plumbing for ['set','add'] / ['session','start'] / ['session','finish'] keys)]

tech-stack:
  added:
    - expo-crypto ~15.0.9 (SDK 54 line; randomUUID for client-generated UUIDs)
    - react-native-draggable-flatlist ^4.0.3 (Plan 04-04 drag-to-reorder consumer; landed now to keep all Phase 4 deps in one commit)
    - node-localstorage ^3.0.5 + @types/node-localstorage ^1.3.3 (devDeps; AsyncStorage-shaped Node shim consumed only by scripts/test-offline-queue.ts)
  patterns:
    - "LOAD-BEARING module-load order in app/app/_layout.tsx: client.ts → persister.ts → network.ts. Reordering breaks the offline-queue replay contract because hydrated paused mutations need their setMutationDefaults entries already registered when persister rebuilds them."
    - "Pitfall 8.1 enforced: every useMutation in lib/queries/*.ts specifies ONLY mutationKey + scope. mutationFn lives in setMutationDefaults so paused mutations re-hydrate against the same logic the developer wrote."
    - "Pitfall 8.13 enforced: every Supabase response is fed through SchemaName.parse(data), NOT cast as Database type. Zod is the security-relevant boundary that catches schema drift at runtime."
    - "Idempotent CREATE convention: every CREATE mutationFn uses .upsert(values, { onConflict: 'id', ignoreDuplicates: true }) instead of .insert. Replay against an already-committed row is a no-op."
    - "Two-phase reorder algorithm: snapshot → optimistic write → phase 1 (negative offsets) → phase 2 (final positions). Both phases share scope.id 'plan:<planId>' for serial replay so phase-1 always lands before phase-2 even on app-restart mid-reorder."
    - "Client-UUID generation at mutate-call site (NOT mutationFn body): caller passes id: randomUUID() so the optimistic update has a stable key from the first millisecond and replay is idempotent."
    - "scope.id v5 contract documented inline in client.ts: scope.id is a STATIC string read at runtime via mutation.options.scope?.id. Per-call dynamic scope is set at useMutation() instantiation by passing planId to the resource hook (useAddExerciseToPlan(planId), useUpdatePlanExercise(planId), etc.). NOT a function in setMutationDefaults — function-shaped scope.id silently fails the typeof === 'string' check."

key-files:
  created:
    - app/lib/query/client.ts (QueryClient + 8 setMutationDefaults at module top-level)
    - app/lib/query/persister.ts (createAsyncStoragePersister + persistQueryClient 24h)
    - app/lib/query/network.ts (focusManager + onlineManager listeners + onlineManager.subscribe(resumePausedMutations) + useOnlineStatus hook)
    - app/lib/query/keys.ts (plansKeys, exercisesKeys, planExercisesKeys factories)
    - app/lib/utils/uuid.ts (expo-crypto randomUUID wrapper)
    - app/lib/schemas/plans.ts (planFormSchema + planRowSchema)
    - app/lib/schemas/exercises.ts (exerciseFormSchema + exerciseRowSchema)
    - app/lib/schemas/plan-exercises.ts (planExerciseFormSchema with cross-field refine + planExerciseRowSchema)
    - app/lib/queries/plans.ts (usePlansQuery, usePlanQuery, useCreatePlan, useUpdatePlan, useArchivePlan)
    - app/lib/queries/exercises.ts (useExercisesQuery, useCreateExercise — accepts planId for picker chain)
    - app/lib/queries/plan-exercises.ts (usePlanExercisesQuery, useAddExerciseToPlan, useUpdatePlanExercise, useRemovePlanExercise, useReorderPlanExercises)
    - app/scripts/test-plan-schemas.ts
    - app/scripts/test-exercise-schemas.ts
    - app/scripts/test-plan-exercise-schemas.ts
    - app/scripts/test-reorder-constraint.ts
    - app/scripts/test-upsert-idempotency.ts
    - app/scripts/test-offline-queue.ts
    - app/scripts/test-sync-ordering.ts
  modified:
    - app/app/_layout.tsx (trim AppState/Platform/focusManager/onlineManager/NetInfo imports + setEventListener blocks; add LOAD-BEARING import-order comment)
    - app/lib/auth-store.ts (single line — import path bumped to @/lib/query/client)
    - app/package.json (deps + 7 new test:* scripts)
    - app/package-lock.json
  deleted:
    - app/lib/query-client.ts (replaced by lib/query/{client,persister}.ts)

key-decisions:
  - "Auto-fix Rule 1: corrected scope.id contract from function to static-per-hook-instance. Plan 04-01 originally specified scope: { id: vars => `plan:${vars.id}` } in setMutationDefaults; this is incompatible with TanStack v5 where MutationScope.id is read at runtime via mutation.options.scope?.id and the typeof === 'string' check would silently exclude function-shaped scopes from the scope map. Fixed by setting scope at useMutation() instantiation per resource hook with hooks accepting a planId parameter. Documented in client.ts header + each resource-hook header."
  - "Wave 0 test scripts use networkMode: 'online' (not production's 'offlineFirst') for deterministic offline pause. With offlineFirst, mutations only pause on fetch failure; the test mutationFn does not throw, so it would succeed even offline (defeating the persistence test). In production, Supabase fetch throws when offline so the natural offlineFirst pause kicks in. The persistence/replay contract under test (key + scope preservation across persist/restart) is identical between the two modes."
  - "useReorderPlanExercises uses absolute newIndex from the full reordered array (not within the changed-row subset) for phase-2 final positions. The slot index drives phase-1 negative offsets so phase-1 itself doesn't violate the unique constraint."

patterns-established:
  - "Resource-hook signature with planId scope binding: useAddExerciseToPlan(planId), useUpdatePlanExercise(planId), useRemovePlanExercise(planId), useReorderPlanExercises(planId), useCreateExercise(planId?), useUpdatePlan(planId?), useArchivePlan(planId?). Pass planId so the hook instance binds scope: { id: 'plan:<planId>' } and offline-replay groups all mutations within that plan into a single serial-replay bucket. Pass undefined when standalone (useCreatePlan, useCreateExercise from a non-picker path)."
  - "Module-level side-effects at lib/query/network.ts: setting focusManager + onlineManager listeners + the onlineManager.subscribe block runs on first import. _layout.tsx imports the module for side-effects via `import \"@/lib/query/network\"` so setup runs without an explicit setupNetwork() call."
  - "Wave 0 test convention (carry-over from Phase 2 test-rls.ts): every Node-only script header carries the same isolation warning ('MUST NEVER be imported from app/lib/, app/app/, or any other Metro-bundled path'); pass/fail harness uses console.log for PASS/FAIL lines + final ALL ASSERTIONS PASSED / N FAILURE(S) summary; process.exit(failures > 0 ? 1 : 0); cleanup runs in finally regardless of assertion success; mainCompleted flag prevents false-positive when main() throws before assertions run."

requirements-completed: [F2, F3, F4]

duration: ~20min
completed: 2026-05-10
---

# Phase 4 Plan 01: Offline-Queue Plumbing & Wave 0 Harness Summary

**TanStack v5 query-client refactored to a four-file split, all 8 Phase 4 mutation defaults registered, the missing onlineManager.subscribe(resumePausedMutations) block (Pitfall 8.12) added, plus 7 Wave 0 verification scripts gating the offline-replay contract.**

## Performance

- **Duration:** ~20 min (2026-05-10T17:30:03Z → 2026-05-10T17:49:44Z)
- **Started:** 2026-05-10T17:30:03Z
- **Completed:** 2026-05-10T17:49:44Z
- **Tasks:** 5 (+ 1 chore commit for @types/node-localstorage)
- **Files created:** 18 (4 query infra + 1 util + 3 schemas + 3 resource hooks + 7 test scripts)
- **Files modified:** 3 (app/app/_layout.tsx, app/lib/auth-store.ts, app/package.json)
- **Files deleted:** 1 (app/lib/query-client.ts)

## Accomplishments

- **Closed Pitfall 8.12** — `app/lib/query/network.ts` adds `onlineManager.subscribe((online) => { if (online && !wasOnline) void queryClient.resumePausedMutations(); })` so mutations queued during a single offline session actually replay on reconnect. Phase 1 omitted this; without it, the offline-banner UX in Plan 02 + the airplane-mode test in Plan 04 would silently lose data.
- **Closed Pitfall 8.1** — every `useMutation` in `lib/queries/*.ts` specifies only `mutationKey` + `scope`; `mutationFn` lives in `setMutationDefaults` at module top-level so paused mutations re-hydrate from AsyncStorage with their function reference intact.
- **Closed Pitfall 8.13** — every queryFn maps `data.map(r => SchemaName.parse(r))`; every mutationFn returns `SchemaName.parse(data)`. Zod-parse, never cast.
- **Documented v5 scope.id contract correction** in `client.ts` header — TanStack v5's `MutationScope.id` is a STATIC string. Plan originally specified function-scope; fixed via Rule 1 auto-fix (see Deviations below).
- **Two-phase reorder algorithm** ships in `useReorderPlanExercises(planId)` with empirical proof via `test-reorder-constraint.ts` that Postgres int allows negative offsets and that the naive single-phase swap DOES violate the unique constraint (negative control assertion).
- **Idempotent replay** proved end-to-end: `test-upsert-idempotency.ts` (replayed upsert preserves original row) + `test-sync-ordering.ts` (chained create + add replay in FK-safe order, second replay produces no duplicates).
- **Persister contract** proved end-to-end: `test-offline-queue.ts` simulates a force-quit → cold-start cycle with a Node shim and asserts `mutationKey` + `scope.id` survive serialization + `resumePausedMutations()` fires the rehydrated mutationFn.

## Task Commits

Each task was committed atomically:

1. **Task 1: lib/query split + 8 setMutationDefaults + UUID util + schemas + resource hooks + _layout.tsx + auth-store.ts** — `2208b13` (feat)
2. **Task 2: Wave 0 schema parse harness (3 scripts)** — `b0383d8` (test)
3. **Task 3: Wave 0 DB integration tests (test-reorder-constraint, test-upsert-idempotency)** — `3bc00b7` (test)
4. **Task 4: Wave 0 persister contract test (test-offline-queue)** — `8a7499c` (test)
5. **Task 5: Wave 0 chained-mutation FK ordering test (test-sync-ordering)** — `731956e` (test)
6. **Chore: @types/node-localstorage devDep** — `9482097` (chore — keeps `npx tsc --noEmit` clean for Task 4 script)

## Files Created/Modified

### Created (18)

- `app/lib/query/client.ts` — QueryClient singleton + 8 setMutationDefaults (plan/create, plan/update, plan/archive, exercise/create, plan-exercise/add, plan-exercise/update, plan-exercise/remove, plan-exercise/reorder no-op default).
- `app/lib/query/persister.ts` — createAsyncStoragePersister + persistQueryClient (24h maxAge, copied verbatim from Phase 1).
- `app/lib/query/network.ts` — focusManager + onlineManager listeners + onlineManager.subscribe(resume) + useOnlineStatus React hook.
- `app/lib/query/keys.ts` — plansKeys / exercisesKeys / planExercisesKeys hierarchical factories.
- `app/lib/utils/uuid.ts` — `randomUUID = () => Crypto.randomUUID()` wrapper.
- `app/lib/schemas/plans.ts` — planFormSchema (RHF input) + planRowSchema (Supabase response parse).
- `app/lib/schemas/exercises.ts` — exerciseFormSchema + exerciseRowSchema.
- `app/lib/schemas/plan-exercises.ts` — planExerciseFormSchema with cross-field refine target_reps_min ≤ target_reps_max + planExerciseRowSchema.
- `app/lib/queries/plans.ts` — usePlansQuery, usePlanQuery, useCreatePlan, useUpdatePlan, useArchivePlan (mutation hooks accept planId for scope binding).
- `app/lib/queries/exercises.ts` — useExercisesQuery, useCreateExercise(planId?) — planId binds scope so picker chain shares scope with subsequent add-to-plan.
- `app/lib/queries/plan-exercises.ts` — usePlanExercisesQuery + 4 mutation hooks + useReorderPlanExercises(planId) two-phase orchestrator.
- `app/scripts/test-plan-schemas.ts` — 7 Zod cases.
- `app/scripts/test-exercise-schemas.ts` — 8 Zod cases.
- `app/scripts/test-plan-exercise-schemas.ts` — 8 Zod cases (incl. cross-field refine).
- `app/scripts/test-reorder-constraint.ts` — proves two-phase reorder + negative ints + 23505 negative control.
- `app/scripts/test-upsert-idempotency.ts` — proves .upsert ignoreDuplicates contract.
- `app/scripts/test-offline-queue.ts` — proves persister contract via node-localstorage shim.
- `app/scripts/test-sync-ordering.ts` — proves chained create + add FK-safe replay + idempotency.

### Modified (3)

- `app/app/_layout.tsx` — trimmed AppState/Platform/focusManager/onlineManager/NetInfo imports; removed the two setEventListener blocks (now in network.ts); added LOAD-BEARING import-order comment for client → persister → network.
- `app/lib/auth-store.ts` — single line: `@/lib/query-client` → `@/lib/query/client`.
- `app/package.json` — added expo-crypto, react-native-draggable-flatlist, node-localstorage + @types/node-localstorage, +7 test:* scripts.

### Deleted (1)

- `app/lib/query-client.ts` — Phase 1 single-file form, replaced by the 4-file split. No remaining imports anywhere in app/ (verified via grep).

## Decisions Made

- **scope.id correction (auto-fix Rule 1):** the plan specified function-scope (`scope: { id: vars => 'plan:' + vars.id }`) in setMutationDefaults. TanStack v5 reads scope.id at runtime via `mutation.options.scope?.id` and only enters the mutation into the scope map when `typeof === "string"`. Function-shaped scope.id silently fails this check and the mutation never participates in serial-replay, breaking the FK-ordering contract. Fixed by setting scope at `useMutation()` instantiation in each resource hook, with hooks accepting a `planId` parameter so callers pick the correct scope-bucket. Documented inline in `client.ts` header + each resource-hook header.
- **Wave 0 test scripts use networkMode: 'online' (not production's 'offlineFirst')** for deterministic offline pause. The persistence/replay contract under test is identical between the two modes; only the pause-trigger differs (offlineFirst pauses on fetch failure, online pauses on offline state). The test mutationFn does not throw, so 'offlineFirst' would not pause it — 'online' provides a clean pause without needing to simulate a failing fetch.
- **react-native-draggable-flatlist + expo-crypto installed in this plan** (not deferred to Plan 04-04 / etc.). Keeps all Phase 4 dependency landings in a single commit and avoids cross-plan dep churn.
- **useReorderPlanExercises absolute-newIndex semantics:** phase-2 writes `order_index = newIndex` (absolute position in the full new array, not within the changed-row subset). Phase-1 uses `-(slot+1)` where slot is the row's position in the changed-row subset, ensuring distinct negative offsets that don't collide with each other or with unchanged rows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected scope.id contract from function to static-per-hook-instance**
- **Found during:** Task 1 — TypeScript compile against the plan-specified `scope: { id: (vars) => ... }` failed with `Type '(vars: PlanInsertVars) => string' is not assignable to type 'string'`.
- **Issue:** TanStack v5's `MutationScope` type declares `{ id: string }`. The runtime in `query-core/mutationCache.js` reads scope.id via `mutation.options.scope?.id` and only registers the mutation in the scope map when `typeof scope === "string"`. Function-shaped scope.id silently fails this check, breaking the serial-replay contract that Plan 04-01's offline-replay design depends on.
- **Fix:** Removed all 7 function-scope entries from `setMutationDefaults`. Updated each resource hook in `lib/queries/*.ts` to accept a `planId` parameter and set `scope: { id: 'plan:<planId>' }` at `useMutation()` instantiation. Documented the v5 scope.id contract inline in `client.ts` (immediately above the first setMutationDefaults call) + in each resource-hook file header. Wave 0 tests (test-offline-queue, test-sync-ordering) use the same correct shape: scope set at mutation construction time via `getMutationCache().build(client, { mutationKey, scope: { id: 'plan:<planId>' } })`.
- **Files modified:** app/lib/query/client.ts, app/lib/queries/plans.ts, app/lib/queries/exercises.ts, app/lib/queries/plan-exercises.ts, app/scripts/test-offline-queue.ts, app/scripts/test-sync-ordering.ts.
- **Verification:** `npx tsc --noEmit` clean; `npm run test:offline-queue` PASS (mutationKey + scope.id intact across persist/restart); `npm run test:sync-ordering` PASS (create runs BEFORE add — scope.id serialization works against real Postgres FK).
- **Committed in:** `2208b13` (Task 1) + `8a7499c` (Task 4) + `731956e` (Task 5).

**2. [Rule 2 - Missing Critical] Installed @types/node-localstorage to keep tsc --noEmit green**
- **Found during:** Final verification gate after Task 5 — `npx tsc --noEmit` flagged TS7016 on the `node-localstorage` import in test-offline-queue.ts.
- **Issue:** node-localstorage ships without bundled types; the plan installed only the runtime package, not the @types declaration. Without it, the verification gate `cd app && npx tsc --noEmit && ... ALL_CHECKS_PASS` from Task 1's `<verify>` block would fail when re-run after Task 4 ships test-offline-queue.ts.
- **Fix:** `npm install --save-dev @types/node-localstorage` (^1.3.3).
- **Files modified:** app/package.json, app/package-lock.json.
- **Verification:** `npx tsc --noEmit` exits 0.
- **Committed in:** `9482097` (chore commit, separate from Task 5 since strictly speaking it's a tooling correction).

---

**Total deviations:** 2 auto-fixed (1 Rule-1 bug, 1 Rule-2 missing-critical).
**Impact on plan:** Rule-1 fix was necessary for the offline-replay contract to actually work — without it, scope.id would silently be ignored at runtime, defeating the whole serial-replay mechanism the plan designs around. Rule-2 fix was a tooling correction. Neither introduced scope creep.

## Issues Encountered

- **TanStack v5 scope.id is static-only** (vs. function-scope as the plan specified). Verified via reading `node_modules/@tanstack/query-core/build/modern/mutationCache.js` `scopeFor` function (line 118-120). Resolved by Rule-1 fix (see Deviations above) — set scope at `useMutation()` instantiation per resource hook.
- **Test mutation pausing requires either networkMode='online' OR a throwing mutationFn**: with `offlineFirst`, the runtime doesn't preemptively check `onlineManager.isOnline()` — it only pauses-and-retries when the mutationFn throws. In production this is fine because Supabase fetch throws when offline. In tests with no real network call, the mutationFn just succeeds. Resolved by using `networkMode: 'online'` in the Wave 0 scripts (documented in test-offline-queue.ts header).

## User Setup Required

None — no external service configuration needed. expo-crypto + react-native-draggable-flatlist auto-link via Expo SDK 54; node-localstorage is a Node-only devDep used by one script.

## Wave 0 Test Results

All 7 Wave 0 scripts (+ Phase 2 regression `test:rls`) exit 0 on the same `gsd/phase-04-plans-exercises-offline-queue-plumbing` branch:

| Script | Result | Sample output line |
|---|---|---|
| `npm run test:rls` | ALL ASSERTIONS PASSED | `[test-rls] ALL ASSERTIONS PASSED` |
| `npm run test:plan-schemas` | All 7 schema cases passed | `All 7 schema cases passed.` |
| `npm run test:exercise-schemas` | All 8 schema cases passed | `All 8 schema cases passed.` |
| `npm run test:plan-exercise-schemas` | All 8 schema cases passed (incl. cross-field refine) | `All 8 schema cases passed.` |
| `npm run test:reorder-constraint` | ALL ASSERTIONS PASSED (incl. 23505 negative control) | `[test-reorder-constraint] ALL ASSERTIONS PASSED` |
| `npm run test:upsert-idempotency` | ALL ASSERTIONS PASSED (workout_plans + plan_exercises) | `[test-upsert-idempotency] ALL ASSERTIONS PASSED` |
| `npm run test:offline-queue` | ALL ASSERTIONS PASSED (persister contract closed Pitfall 8.2 + 8.12) | `[test-offline-queue] ALL ASSERTIONS PASSED` |
| `npm run test:sync-ordering` | ALL ASSERTIONS PASSED (chained scope.id replay + idempotency) | `[test-sync-ordering] ALL ASSERTIONS PASSED` |

## Grep Gates

```
$ cd app && grep -c "setMutationDefaults" lib/query/client.ts
12  (≥ 8 — 8 keys + helper docs)

$ cd app && grep -c "resumePausedMutations" lib/query/network.ts
3   (1 import-site comment + 1 active subscription call + 1 doc comment)

$ cd app && grep -L "mutationFn" lib/queries/exercises.ts lib/queries/plan-exercises.ts
lib/queries/exercises.ts          ← clean (no inline mutationFn)
lib/queries/plan-exercises.ts     ← clean (no inline mutationFn)
                                  ← lib/queries/plans.ts has TWO comment-only matches in
                                  the file header documenting that mutationFn lives in
                                  client.ts; manually verified no actual mutationFn
                                  callsite exists in any lib/queries/*.ts.

$ cd app && grep -l "SERVICE_ROLE\|service_role" lib app components 2>/dev/null
(no matches)                      ← service-role audit clean

$ cd app && ls lib/query-client.ts 2>&1
ls: cannot access 'lib/query-client.ts': No such file or directory  ← Phase 1 file removed

$ grep -q "@/lib/query-client" app/lib/auth-store.ts && echo "STILL THERE" || echo "MIGRATED"
MIGRATED                          ← auth-store imports from @/lib/query/client
```

## Note for Downstream Plan 02

The OfflineBanner component (Plan 04-02) consumes `useOnlineStatus` directly:

```typescript
import { useOnlineStatus } from "@/lib/query/network";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  // ... binary banner per CONTEXT.md D-05
}
```

`useOnlineStatus` is built on `useSyncExternalStore` so concurrent React renders see a consistent value. Server-side fallback returns `true` (online) so the banner doesn't flash on initial mount.

## Next Phase Readiness

Phase 4 plumbing complete; downstream plans can now consume the resource hooks + useOnlineStatus + randomUUID without redoing any infra:

- **Plan 04-02** ((tabs) skeleton + Planer list + plans/new + OfflineBanner): `usePlansQuery()`, `useCreatePlan()`, `useOnlineStatus()` all wired.
- **Plan 04-03** (plan-detail + exercise-picker + plan_exercise targets edit): `usePlanQuery()`, `useUpdatePlan(planId)`, `useArchivePlan(planId)`, `useExercisesQuery()`, `useCreateExercise(planId)`, `useAddExerciseToPlan(planId)`, `useUpdatePlanExercise(planId)`, `useRemovePlanExercise(planId)` all wired with correct scope binding for FK-safe replay of picker-chain create-and-add.
- **Plan 04-04** (drag-to-reorder integration + airplane-mode test): `useReorderPlanExercises(planId)` wired; the manual airplane-mode test in 04-04's final task can rely on the persister contract proven by `test-offline-queue.ts`.
- **Phase 5** (active workout hot path): inherits the same plumbing for `['set','add']`, `['session','start']`, `['session','finish']` — only needs to add 3 new `setMutationDefaults` entries to `lib/query/client.ts` (no further refactor).

No blockers. Phase 4 success criteria #4 (airplane-mode-test) and #5 (offline banner) are now plausible because the load-bearing plumbing they depend on is in place AND verified by Wave 0.

## Self-Check: PASSED

Verified at completion (2026-05-10T17:49:44Z):

- File existence: all 18 created files present (4 query infra + 1 util + 3 schemas + 3 resource hooks + 7 test scripts).
- Commit existence: `git log --oneline gsd/phase-04-plans-exercises-offline-queue-plumbing` shows all 6 commits (`2208b13`, `b0383d8`, `3bc00b7`, `8a7499c`, `731956e`, `9482097`) ahead of the planning baseline `0eee4bd`.
- Verification suite: `tsc --noEmit` + `expo lint` + 8 `npm run test:*` scripts all exit 0 in a single sequential pass.

---

*Phase: 04-plans-exercises-offline-queue-plumbing*
*Completed: 2026-05-10*
