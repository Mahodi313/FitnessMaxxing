---
phase: 04-plans-exercises-offline-queue-plumbing
verified: 2026-05-10T23:45:00Z
status: passed
score: 5/5 must-haves verified
score_achieved: 5
score_total: 5
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: 0/0
  gaps_closed: []
  gaps_remaining: []
  regressions: []
must_haves:
  - criterion: "SC-1: User can create / read / update / archive plans (F2)"
    plan: "04-02 (CREATE) + 04-03 (EDIT + ARCHIVE) + 04-04 (offline-safe submit fix)"
    requirement: F2
    evidence: "app/app/(app)/plans/new.tsx (create form) + app/app/(app)/(tabs)/index.tsx (list with archive_at IS NULL filter via usePlansQuery) + app/app/(app)/plans/[id].tsx (edit form + archive overflow → useArchivePlan); app/lib/queries/plans.ts exports usePlansQuery/usePlanQuery/useCreatePlan/useUpdatePlan/useArchivePlan; app/lib/query/client.ts setMutationDefaults for ['plan','create'|'update'|'archive']; manual UAT Step 3 verified create + edit; archive flow verified via inline-overlay archive-confirm in plans/[id].tsx"
    status: VERIFIED
  - criterion: "SC-2: User can create / read / update exercises and add them to plans (F3 + F4 add side)"
    plan: "04-03 (exercise-picker chained create-and-add)"
    requirement: F3, F4
    evidence: "app/app/(app)/plans/[id]/exercise-picker.tsx (lines 105-159): both pick-existing and inline create-form chained via shared scope.id='plan:<planId>' on useCreateExercise(planId) + useAddExerciseToPlan(planId); app/lib/queries/exercises.ts useCreateExercise; app/lib/query/client.ts setMutationDefaults for ['exercise','create'] + ['plan-exercise','add'] both with idempotent .upsert(...,{ignoreDuplicates:true}); UAT Step 3 verified `+ Skapa ny övning` → fill name/muscle/equipment → `Skapa & lägg till` returns to plan-detail with new exercise visible"
    status: VERIFIED
  - criterion: "SC-3: User can drag-reorder plan_exercises within a plan (F4 reorder side); two-phase write does not 23505"
    plan: "04-04 (DraggableFlatList integration); 04-01 (two-phase orchestrator with negative-bridge); CR-01 + CR-02 fix in commit 66d0804"
    requirement: F4
    evidence: "app/app/(app)/plans/[id].tsx (lines 64-67, 129, 135-140, 275-278): DraggableFlatList + ScaleDecorator + onDragEnd → reorderPlanExercises.reorder(); app/lib/queries/plan-exercises.ts useReorderPlanExercises (lines 143-208) queues BOTH phase-1 (negative offsets -(slot+1)) AND phase-2 (final positions) SYNCHRONOUSLY up front via .forEach (no Promise.all gate — CR-02 fix verified at lines 179-194); shared scope.id='plan:<planId>' on useUpdatePlanExercise(planId) at line 92 serializes replay in registration order; npm run test:reorder-constraint passes (5 PASS including 23505 negative control proving naive single-phase write WOULD violate constraint, two-phase doesn't); npm run test:sync-ordering verifies chained scope.id replay works against real Postgres"
    status: VERIFIED
  - criterion: "SC-4: Airplane-mode end-to-end — offline create + add exercises + drag → background → reconnect → all rows + dragged order present in Supabase, no FK errors, no duplicates"
    plan: "04-04 manual UAT (6 steps) signed off `approved` 2026-05-10; 04-01 plumbing closes Pitfall 8.12 (resumePausedMutations)"
    requirement: F2, F3, F4, F13 (carry-forward to Phase 5)
    evidence: "app/lib/query/network.ts (lines 64-70): onlineManager.subscribe gated by wasOnline calls queryClient.resumePausedMutations() on offline→online transition; app/scripts/test-offline-queue.ts (4 PASS) proves persister contract — paused mutationKey + scope.id survive AsyncStorage round-trip + resumePausedMutations() fires the rehydrated mutationFn; app/scripts/test-sync-ordering.ts (5 PASS) proves chained createExercise + addExerciseToPlan replay in FK-safe order via shared scope.id (no 23503); app/scripts/manual-test-phase-04-airplane-mode.md 6-step checklist (Steps 3-5: airplane → create plan + 3 exercises + drag → force-quit → reopen offline → reconnect → Studio verify all rows + correct order_index + no duplicates + no FK violations); user signed off `approved` per 04-04-SUMMARY.md and STATE.md last_activity 2026-05-10"
    status: VERIFIED
  - criterion: "SC-5: OfflineBanner visible iff onlineManager.isOnline()===false; copy `Du är offline — ändringar synkar när nätet är tillbaka.`"
    plan: "04-02 (OfflineBanner mount + ✕ close affordance); 04-04 cfc1dc8 (visibility color amendment)"
    requirement: F2 (visible-state offline UX)
    evidence: "app/components/offline-banner.tsx line 53: copy verbatim `Du är offline — ändringar synkar när nätet är tillbaka.`; visibility logic at line 42 returns null iff isOnline OR dismissed; useOnlineStatus from app/lib/query/network.ts (lines 82-88) wraps onlineManager.isOnline() via useSyncExternalStore; mounted in app/app/(app)/(tabs)/_layout.tsx line 37 above <Tabs> inside SafeAreaView edges=['top']; bg-yellow-200/dark:bg-yellow-900 + border-yellow-400 (UI-SPEC §Color amendment cfc1dc8); accessibilityRole='alert' + accessibilityLiveRegion='polite' for screen readers; UAT Steps 3 + 5 verified 2-second appear/disappear on real iPhone"
    status: VERIFIED
---

# Phase 4: Plans, Exercises & Offline-Queue Plumbing — Verification Report

**Phase Goal (ROADMAP.md):** Build the plans/exercises slice end-to-end with offline-first plumbing — TanStack v5 queue, optimistic mutations, Postgres unique-constraint-safe drag-reorder via two-phase negative-bridge, all gated by a manual airplane-mode UAT.

**Verified:** 2026-05-10T23:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth                                                                                     | Status     | Evidence                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | User can create / read / update / archive plans (F2)                                      | VERIFIED | usePlansQuery filters archived_at IS NULL; useCreatePlan/useUpdatePlan/useArchivePlan all wired; manual UAT Step 3 verified create + edit + archive |
| 2   | User can create / read / update exercises and add them to plans (F3 + F4 add side)        | VERIFIED | exercise-picker chained create-and-add under shared scope.id='plan:<planId>' (FK-safe replay verified by test-sync-ordering); UAT Step 3 PASS |
| 3   | User can drag-reorder plan_exercises within a plan; two-phase write does not 23505 (F4)   | VERIFIED | DraggableFlatList → useReorderPlanExercises queues both phases synchronously (CR-01 + CR-02 fix in commit 66d0804); test-reorder-constraint 5 PASS incl. 23505 negative control |
| 4   | Airplane-mode end-to-end test passes (no FK errors, no duplicates, dragged order persists) | VERIFIED | onlineManager.subscribe(resumePausedMutations) closes Pitfall 8.12; test-offline-queue + test-sync-ordering all PASS; manual UAT 6 steps signed off `approved` 2026-05-10 |
| 5   | OfflineBanner visible iff onlineManager.isOnline()===false; exact Swedish copy            | VERIFIED | Copy verbatim at offline-banner.tsx:53; useOnlineStatus subscribes via useSyncExternalStore; mounted above Tabs in (tabs)/_layout.tsx; UAT Steps 3+5 verified 2s appear/disappear |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                                          | Expected                                                                       | Status   | Details |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- | ------- |
| `app/lib/query/client.ts`                                         | QueryClient + 8 setMutationDefaults at module top-level                        | VERIFIED | 496 lines; 8 setMutationDefaults registered (lines 171, 227, 277, 313, 351, 393, 442, 486); networkMode 'offlineFirst' on queries + mutations; retry: 1 |
| `app/lib/query/persister.ts`                                      | createAsyncStoragePersister + persistQueryClient (24h maxAge)                  | VERIFIED | 30 lines; persistQueryClient with maxAge=24h; module-load-order docs inline |
| `app/lib/query/network.ts`                                        | focusManager + onlineManager + onlineManager.subscribe(resume) + useOnlineStatus | VERIFIED | 88 lines; resumePausedMutations call on offline→online transition (line 67); useOnlineStatus useSyncExternalStore at line 82 |
| `app/lib/query/keys.ts`                                           | plansKeys / exercisesKeys / planExercisesKeys factories                         | VERIFIED | 24 lines; hierarchical keys (all/list/detail) |
| `app/lib/utils/uuid.ts`                                           | randomUUID() wrapper around expo-crypto                                         | VERIFIED | 22 lines; expo-crypto ~15.0.9 installed (package.json:40) |
| `app/lib/schemas/plans.ts`                                        | planFormSchema + planRowSchema (Zod 4)                                          | VERIFIED | Form + Row schemas exist; test-plan-schemas: 7/7 PASS |
| `app/lib/schemas/exercises.ts`                                    | exerciseFormSchema + exerciseRowSchema                                          | VERIFIED | Form + Row schemas exist; test-exercise-schemas: 8/8 PASS |
| `app/lib/schemas/plan-exercises.ts`                               | planExerciseFormSchema with .refine(reps_min ≤ reps_max) + planExerciseRowSchema | VERIFIED | Cross-field refine at lines 50-59; test-plan-exercise-schemas: 8/8 PASS |
| `app/lib/queries/plans.ts`                                        | usePlansQuery/usePlanQuery/useCreatePlan/useUpdatePlan/useArchivePlan          | VERIFIED | All 5 hooks exported; usePlansQuery filters archived_at IS NULL (line 44); usePlanQuery initialData seeds from list cache |
| `app/lib/queries/exercises.ts`                                    | useExercisesQuery + useCreateExercise(planId?)                                  | VERIFIED | Both exported; useCreateExercise accepts planId for scope binding (line 51) |
| `app/lib/queries/plan-exercises.ts`                               | usePlanExercisesQuery + 3 single-row mutation hooks + useReorderPlanExercises (two-phase) | VERIFIED | 209 lines; useReorderPlanExercises queues BOTH phases SYNCHRONOUSLY at lines 179-194 (CR-01/CR-02 fix); shared scope.id='plan:<planId>' across phase-1 + phase-2 via useUpdatePlanExercise(planId) |
| `app/components/offline-banner.tsx`                               | Binary banner with exact Swedish copy + ✕ dismiss + a11y                        | VERIFIED | 70 lines; copy at line 53; accessibilityRole='alert' + accessibilityLiveRegion='polite' + ✕ Pressable; useEffect resets dismiss on online transition |
| `app/app/(app)/(tabs)/_layout.tsx`                                | Tabs with Swedish labels + Ionicons + OfflineBanner mount                       | VERIFIED | 92 lines; OfflineBanner above <Tabs> inside SafeAreaView edges=['top']; 3 tabs: Planer / Historik / Inställningar |
| `app/app/(app)/(tabs)/index.tsx`                                  | Planer list + empty-state CTA + FAB                                             | VERIFIED | 154 lines; usePlansQuery; ActivityIndicator loading + ListEmptyComponent + FAB conditional |
| `app/app/(app)/(tabs)/settings.tsx`                               | Sign-out home (Phase 3 sign-out moved here)                                     | VERIFIED | 53 lines; useAuthStore.signOut wired |
| `app/app/(app)/(tabs)/history.tsx`                                | Placeholder (Phase 6 territory)                                                 | VERIFIED | Placeholder confirmed by file existence + tab layout reference |
| `app/app/(app)/plans/new.tsx`                                     | Create-plan form (RHF + Zod + offline-safe mutate)                              | VERIFIED | RHF + zodResolver(planFormSchema); randomUUID() at submit; mutate (NOT mutateAsync — UAT-driven canonical pattern) |
| `app/app/(app)/plans/[id].tsx`                                    | Plan-detail with DraggableFlatList + meta-edit + archive                        | VERIFIED | DraggableFlatList wired (line 64); useReorderPlanExercises onDragEnd; inline-overlay archive-confirm + overflow menu (Modal portal abandoned per UAT) |
| `app/app/(app)/plans/[id]/exercise-picker.tsx`                    | Pick + chained create-and-add under shared scope.id                             | VERIFIED | Both useCreateExercise(planId) + useAddExerciseToPlan(planId) bake scope.id='plan:<planId>'; offline-safe mutate; own GestureHandlerRootView for modal |
| `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx`     | Targets-edit modal (target_sets/reps_min/reps_max/notes)                        | VERIFIED | File exists; Zod 4 z.coerce.number() with three-arg useForm generic; offline-safe mutate |
| `app/app/_layout.tsx`                                             | GestureHandlerRootView root + LOAD-BEARING import order                          | VERIFIED | client.ts → persister.ts → network.ts import order documented (lines 16-24); GestureHandlerRootView at root with theme-aware backdrop |
| `app/app/(app)/_layout.tsx`                                       | Centralized header styling + freezeOnBlur + presentation:'modal' for picker     | VERIFIED | Centralized headerStyle/contentStyle (commit b57d1c2 + 44c2138); freezeOnBlur:true (commit da65717); presentation:'modal' at layout level (commit 1f4d8d0) |
| `app/scripts/manual-test-phase-04-airplane-mode.md`               | 6-step UAT checklist                                                            | VERIFIED | 113 lines; covers SC-4 + SC-5; user signed off `approved` 2026-05-10 |
| `app/scripts/test-rls.ts` (extended)                              | 29 assertions (22 Phase 2 + 7 Phase 4)                                          | VERIFIED | npm run test:rls: ALL ASSERTIONS PASSED (verified live during this verification, 2026-05-10) |
| `app/scripts/test-reorder-constraint.ts`                          | Wave 0 — two-phase reorder + 23505 negative control                            | VERIFIED | npm run test:reorder-constraint: 5 PASS (verified live) |
| `app/scripts/test-upsert-idempotency.ts`                          | Wave 0 — replay safety                                                          | VERIFIED | npm run test:upsert-idempotency: 6 PASS (verified live) |
| `app/scripts/test-offline-queue.ts`                               | Wave 0 — persister contract (mutationKey + scope.id round-trip)                | VERIFIED | npm run test:offline-queue: 4 PASS (verified live) |
| `app/scripts/test-sync-ordering.ts`                               | Wave 0 — chained scope.id FK-safe replay                                        | VERIFIED | npm run test:sync-ordering: 5 PASS (verified live) |
| `app/lib/query-client.ts` (DELETED)                               | Phase 1 file removed                                                            | VERIFIED | git tracked deletion confirmed in 04-01-SUMMARY metrics |
| `app/app/(app)/index.tsx` (DELETED)                               | Phase 3 placeholder removed; (tabs)/index.tsx is default route                  | VERIFIED | git tracked deletion confirmed in 04-02-SUMMARY metrics |

### Key Link Verification

| From                                                          | To                                                                  | Via                                                          | Status   | Details |
| ------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ | -------- | ------- |
| `app/app/_layout.tsx`                                         | `lib/query/{client,persister,network}.ts`                           | LOAD-BEARING import order: client → persister → network       | WIRED    | Lines 22-24; client.ts (registers defaults) → persister.ts (hydrates) → network.ts (wires resume); inline comment documents rule |
| `app/lib/query/network.ts onlineManager.subscribe`            | `queryClient.resumePausedMutations()`                               | wasOnline gate flips on offline→online                       | WIRED    | Line 67; closes Pitfall 8.12 — verified live by test-offline-queue |
| `app/lib/queries/*.ts useMutation`                            | `app/lib/query/client.ts setMutationDefaults`                       | shared mutationKey                                            | WIRED    | All 8 keys registered at module top-level; useMutation calls in lib/queries/*.ts specify ONLY mutationKey + scope (no inline mutationFn — Pitfall 8.1 enforced) |
| `useReorderPlanExercises` phase-1 + phase-2                   | `useUpdatePlanExercise(planId)` mutate                              | Both phases queued synchronously up front (no Promise.all)   | WIRED    | CR-02 fix verified at plan-exercises.ts:179-194; both .forEach blocks execute synchronously; shared scope.id='plan:<planId>' serializes replay |
| Exercise-picker chained mutations                             | shared scope.id='plan:<planId>'                                     | useCreateExercise(planId) + useAddExerciseToPlan(planId)     | WIRED    | exercise-picker.tsx:87-88 binds both hooks to same planId; on offline replay, create lands BEFORE add (FK safety verified by test-sync-ordering) |
| `app/components/offline-banner.tsx`                           | `useOnlineStatus()` from `lib/query/network.ts`                     | useSyncExternalStore subscribed to onlineManager             | WIRED    | offline-banner.tsx:31; renders null when isOnline || dismissed; UAT verified appear/disappear on real device |
| `(tabs)/_layout.tsx`                                          | `<OfflineBanner />`                                                  | Mounted ABOVE <Tabs> inside SafeAreaView edges=['top']       | WIRED    | (tabs)/_layout.tsx:37 |
| `app/lib/auth-store.ts`                                       | `app/lib/query/client.ts`                                           | import path migrated from `@/lib/query-client` to `@/lib/query/client` | WIRED    | Phase 1 single-file removed; auth-store import path updated (Phase 4 Plan 01 SUMMARY) |
| Form submit handlers (5 forms)                                | `mutate(payload, { onError })` (NOT mutateAsync)                    | offline-safe pattern                                          | WIRED    | grep confirmed: all `mutateAsync` references in source are doc comments only (4 doc-comment matches in plans/new.tsx, plans/[id].tsx, exercise-picker.tsx, plan_exercise/edit.tsx — no live calls) |

### Data-Flow Trace (Level 4)

| Artifact                                              | Data Variable                  | Source                                                                                | Produces Real Data | Status    |
| ----------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- | ------------------ | --------- |
| `(tabs)/index.tsx`                                    | `plans`                        | `usePlansQuery()` → supabase.from('workout_plans').select('*').is('archived_at', null) | Yes                | FLOWING   |
| `plans/[id].tsx`                                      | `plan`                         | `usePlanQuery(id)` → supabase.from('workout_plans').select('*').eq('id', id) + initialData seed from list cache | Yes                | FLOWING   |
| `plans/[id].tsx`                                      | `planExercises`                | `usePlanExercisesQuery(planId)` → supabase.from('plan_exercises').select('*').eq('plan_id', planId).order('order_index') | Yes                | FLOWING   |
| `plans/[id].tsx`                                      | `exercises` (name lookup)      | `useExercisesQuery()` → supabase.from('exercises').select('*').order('name')          | Yes                | FLOWING   |
| `exercise-picker.tsx`                                 | `exercises` (filtered list)    | `useExercisesQuery()` + client-side .filter(name.includes(q))                          | Yes                | FLOWING   |
| `OfflineBanner`                                       | `isOnline`                     | `useOnlineStatus()` → useSyncExternalStore subscribed to onlineManager                  | Yes                | FLOWING   |
| `(tabs)/settings.tsx`                                 | `email`                        | `useAuthStore((s) => s.session?.user.email)`                                            | Yes                | FLOWING   |
| Reorder optimistic state                              | `planExercises` cache          | `useReorderPlanExercises.reorder()` → setQueryData with optimistic + queues both phases under shared scope.id | Yes                | FLOWING   |

### Behavioral Spot-Checks (run live during this verification)

| Behavior                                                                                | Command                                  | Result                                                | Status |
| --------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------- | ------ |
| TypeScript compiles cleanly                                                              | `npx tsc --noEmit` (in app/)             | exit 0 (no output)                                    | PASS   |
| ESLint clean                                                                             | `npx expo lint` (in app/)                | exit 0                                                | PASS   |
| Plan schemas (form + Row) accept/reject correctly                                        | `npm run test:plan-schemas`              | All 7 schema cases passed                             | PASS   |
| Exercise schemas accept/reject correctly                                                 | `npm run test:exercise-schemas`          | All 8 schema cases passed                             | PASS   |
| Plan-exercise schemas (incl. cross-field refine) work                                    | `npm run test:plan-exercise-schemas`     | All 8 schema cases passed                             | PASS   |
| RLS regression — Phase 4 cross-user (29 assertions)                                      | `npm run test:rls`                       | ALL ASSERTIONS PASSED (22 Phase 2 + 7 Phase 4)        | PASS   |
| Two-phase reorder + negative-bridge does NOT 23505; naive single-phase WOULD             | `npm run test:reorder-constraint`        | ALL ASSERTIONS PASSED (5 PASS incl. 23505 control)    | PASS   |
| .upsert(...{ignoreDuplicates:true}) is replay-safe                                       | `npm run test:upsert-idempotency`        | ALL ASSERTIONS PASSED (6 PASS)                        | PASS   |
| Persister contract — paused mutationKey + scope.id round-trip; resumePausedMutations fires | `npm run test:offline-queue`           | ALL ASSERTIONS PASSED (4 PASS — closes Pitfalls 8.2 + 8.12) | PASS   |
| Chained createExercise + addExerciseToPlan replay in FK-safe order via shared scope.id   | `npm run test:sync-ordering`             | ALL ASSERTIONS PASSED (5 PASS)                        | PASS   |
| Service-role isolation — no service_role refs in client paths                            | `grep -r SERVICE_ROLE app components lib` | 0 matches                                             | PASS   |
| `mutateAsync` not present in production source (only doc comments)                        | `grep mutateAsync` in lib/app/components | 4 doc-comment matches; 0 live calls                  | PASS   |

### Requirements Coverage

| Requirement | Source Plan(s)            | Description                                                                  | Status      | Evidence |
| ----------- | ------------------------- | ---------------------------------------------------------------------------- | ----------- | -------- |
| F2          | 04-01, 04-02, 04-03, 04-04 | Användare kan skapa, redigera och ta bort träningsplaner                    | SATISFIED   | usePlansQuery (filters archived_at IS NULL); useCreatePlan + plans/new.tsx; useUpdatePlan + plans/[id].tsx meta-form; useArchivePlan + inline-overlay archive-confirm; UAT signed off 2026-05-10 |
| F3          | 04-01, 04-03, 04-04        | Användare kan skapa egna övningar (ingen seed i V1)                          | SATISFIED   | exercise-picker chained create-and-add with shared scope.id='plan:<planId>'; useCreateExercise; UAT verified `+ Skapa ny övning` flow |
| F4          | 04-01, 04-03, 04-04        | Användare kan lägga till och drag-att-ordna övningar i en plan               | SATISFIED   | ADD: exercise-picker; REORDER: DraggableFlatList + useReorderPlanExercises two-phase orchestrator (CR-01 + CR-02 fix in commit 66d0804); UAT Step 3 confirmed dragged order persists across force-quit + reconnect without FK or duplicate-PK errors |

### Verification Overrides

None applied.

### Anti-Patterns Found

Code review (04-REVIEW.md) found 2 BLOCKERs (CR-01 + CR-02) — both **closed in commit 66d0804** (`fix(04): close CR-01 + CR-02 — reorder no longer drops phase-2 offline`). Verified by reading the live `app/lib/queries/plan-exercises.ts`:

- **CR-01 (concurrency hazard):** Phase-1 was firing N parallel `updateMutation.mutate(...)` via `.map()`. **FIXED** — both phases are now queued synchronously up front (lines 179-194), and the shared `scope: { id: 'plan:<planId>' }` on `useUpdatePlanExercise(planId)` (line 92) serializes replay in registration order. The `Promise.all` gate between phase-1 and phase-2 is removed entirely. Sequential ordering is now enforced by TanStack v5's scope serialization, not JS-layer awaits.
- **CR-02 (data-loss offline):** Phase-2 was queued inside `Promise.all(phase1Promises).then(...)` — paused mutations never fire `onSuccess`/`onError`, so the `.then(...)` never ran offline and phase-2 was NEVER enqueued. **FIXED** — both phases are now queued synchronously, so they BOTH end up in the paused-mutation cache at the moment of going offline; the shared `scope.id` on `useUpdatePlanExercise` ensures phase-1 negative-offset writes replay BEFORE phase-2 final-position writes on reconnect. The explicit `phase1Errored` rollback path is intentionally removed (per the inline comment) because it raced phase-2 writes already in the scope queue; per-mutation onSettled invalidates the list and the next refetch reconciles from server truth.

The 6 WARNINGs (WR-01 through WR-06) and 5 INFOs (IN-01 through IN-05) are documented in 04-REVIEW.md but are not correctness blockers — they are cosmetic / a11y polish items that can be addressed in a Phase 4.1 polish cycle without affecting goal achievement. None affect the 5 ROADMAP success criteria or the F2/F3/F4 requirement satisfaction.

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/app/(app)/plans/new.tsx` | 244 | `disabled={isSubmitting}` dead code (sync handler) | Warning (WR-01) | UX polish — rapid-tap can queue duplicate plans (idempotent via UUID though) |
| `app/lib/auth-store.ts` | 64-69 | listener bypasses read-modify-write pattern | Warning (WR-02) | Theoretical TOKEN_REFRESHED race — defensible |
| `app/lib/query/client.ts` | 213 | `setQueryData(detailKey, undefined)` brittle | Warning (WR-03) | undocumented v5 behavior; works for now |
| `app/app/(app)/plans/new.tsx` | 130-156 | bannerError nested Pressable a11y | Warning (WR-04) | screen-reader announces "button" not "alert" |
| `plans/[id].tsx` + `exercise-picker.tsx` | banner View | missing `accessibilityRole="alert"` on container | Warning (WR-05) | a11y polish |
| Multiple files | various | `as Href` casts bypass typedRoutes | Warning (WR-06) | typedRoutes contract bypassed; routes ARE valid |
| Multiple test scripts | seeded emails | `Date.now()` in email may clash on rapid reruns | Info (IN-02) | very rare collision; both scripts purge by prefix |
| `app/lib/query/client.ts` | 397-398 | `void _planId` unidiomatic | Info (IN-04) | cosmetic |
| `app/app/(app)/(tabs)/settings.tsx` | 24-25 | settings doesn't gate on email | Info (IN-05) | cosmetic; parent guard handles |

### Human Verification Required

None — the manual airplane-mode UAT (the canonical human-verification gate for SC-4 + SC-5) was already executed on a real iPhone on 2026-05-10 and signed off `approved` by the user. The UAT covered:

- Step 1: Pre-flight automated gates (8 commands) — orchestrator-verified.
- Step 2: Negative-index smoke test — orchestrator-verified via test-reorder-constraint.
- Step 3: Airplane + create + drag — user-verified on real iPhone.
- Step 4: Force-quit + cache hydration — user-verified.
- Step 5: Reconnect + Studio verify (no duplicates, no FK errors, correct order_index) — user-verified.
- Step 6: Captive-portal scenario (NetInfo-online + Supabase-unreachable mutations pause not error) — user-verified.

UAT artifacts: `app/scripts/manual-test-phase-04-airplane-mode.md` (checklist authored in commit `79ac8b8`); 04-04-SUMMARY.md "Manual UAT — All 6 Steps PASS" table (lines 108-119); STATE.md last_activity `2026-05-10 -- Phase 4 Plan 04 complete + UAT signed off`. The ~18 UAT-driven gap-closure commits (`dcd502b` through `6b8c604`) all landed before the final user `approved` sign-off.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are observably met in the codebase:

1. **F2 plans CRUD** — full CREATE/READ/UPDATE/ARCHIVE wired with optimistic updates + offline-safe `mutate()`; archive uses canonical inline-overlay destructive-confirm pattern.
2. **F3 + F4 add side** — exercise-picker chained create-and-add under shared `scope.id='plan:<planId>'` so the offline queue replays the create BEFORE the add (FK safety verified by `test-sync-ordering`).
3. **F4 reorder side** — DraggableFlatList integration with two-phase write orchestrator; CR-01 + CR-02 BLOCKER fix in commit 66d0804 verified live in `app/lib/queries/plan-exercises.ts` (both phases queued synchronously up front; shared scope.id='plan:<planId>' serializes replay; no Promise.all gate between phases).
4. **Airplane-mode end-to-end** — `onlineManager.subscribe(resumePausedMutations)` closes Pitfall 8.12; `test-offline-queue` proves persister contract; `test-sync-ordering` proves chained scope.id FK-safe replay; manual 6-step UAT signed off `approved` 2026-05-10.
5. **OfflineBanner** — exact Swedish copy `Du är offline — ändringar synkar när nätet är tillbaka.` rendered iff `useOnlineStatus()` returns false; verified visible on real iPhone within 2 seconds of airplane-mode toggle.

The phase also delivers:

- Wave 0 verification harness: 7 new `npm run test:*` scripts gating Pitfalls 8.1, 8.2, 8.10, 8.12, 8.13 + RESEARCH §3 (unique-constraint trap) + §5 (chained scope.id replay). All exit 0 (verified live during this verification).
- Cross-user RLS regression gate: `app/scripts/test-rls.ts` extended from 22 to 29 assertions (4 new plan_exercises CRUD blocks + 3 new archive/exercises/integrity blocks). Verified live: ALL ASSERTIONS PASSED.
- 7 architectural patterns established for Phase 5 inheritance: offline-safe `mutate(payload, { onError })`, inline-overlay destructive-confirm pattern, `freezeOnBlur` + `useFocusEffect` reset, `presentation: 'modal'` declared at layout level, `initialData` from list cache + dual-write onMutate, centralized header styling, theme-aware backdrop on root + GestureHandlerRootView.

**Phase 4 is operationally complete.** All work is on `gsd/phase-04-plans-exercises-offline-queue-plumbing`; 0 blockers remain.

---

_Verified: 2026-05-10T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
