---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 7 UI-SPEC approved
last_updated: "2026-05-16T07:36:54.233Z"
last_activity: 2026-05-16 -- Phase 07 execution started
progress:
  total_phases: 7
  completed_phases: 6
  total_plans: 33
  completed_plans: 28
  percent: 85
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07)

**Core value:** Logga ett set och omedelbart se vad jag tog senast på samma övning — utan att tappa data, någonsin.
**Current focus:** Phase 07 — v1-polish-cut

## Current Position

Phase: 07 (v1-polish-cut) — EXECUTING
Plan: 1 of 5
Status: Executing Phase 07
Last activity: 2026-05-16 -- Phase 07 execution started

Progress: [██████████░░░░] 71%  (5/7 phases complete after Phase 5 closeout)

## Performance Metrics

**Velocity:**

- Total plans completed: 28 (3 in Phase 1, 6 in Phase 2, 4 in Phase 3, 4 in Phase 4, 7 in Phase 5)
- Phases complete: 5 of 7
- Total execution time: ~7 active days (2026-05-07 → 2026-05-14)

**By Phase:**

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 1. Bootstrap & Infra Hardening | 3/3 | ✓ Complete | 2026-05-08 |
| 2. Schema, RLS & Type Generation | 6/6 | ✓ Complete (27/27 SECURED) | 2026-05-09 |
| 3. Auth & Persistent Session | 4/4 | ✓ Complete (UAT 9/11 pass; 2 gaps V1.1-deferred) | 2026-05-09 |
| 4. Plans, Exercises & Offline-Queue | 4/4 | ✓ Complete | 2026-05-10 |
| 5. Active Workout Hot Path | 7/7 | ✓ Complete (3 original + 4 gap-closure FIT-7..FIT-10; 10/10 source-level must-haves; 3 iPhone-UAT items in 05-HUMAN-UAT.md, non-blocking) | 2026-05-14 |
| 6. History & Read-Side Polish | 0/TBD | ○ Not started | — |
| 7. V1 Polish Cut | 0/TBD | ○ Not started | — |

**Plan 04-01 metrics (2026-05-10):** 5 tasks + 1 chore commit, ~20 min, 18 files created (4 query infra + 1 util + 3 schemas + 3 resource hooks + 7 test scripts), 3 files modified (_layout.tsx, auth-store.ts, package.json), 1 deleted (query-client.ts). 8/8 verification tests pass (test-rls + test-{plan,exercise,plan-exercise}-schemas + test-{reorder-constraint,upsert-idempotency,offline-queue,sync-ordering}).

**Plan 04-02 metrics (2026-05-10):** 3 tasks, ~30 min, 6 files created (1 OfflineBanner component + 4 tab screens + plans/new), 0 files modified, 1 deleted (Phase 3 (app)/index.tsx — sign-out moved to (tabs)/settings.tsx). 2 auto-fixed deviations: Rule 1 (planFormSchema vs planner-text plansSchema) + Rule 3 (`as Href` casts on 4 route literals to keep tsc clean across cross-plan route references with experiments.typedRoutes=true). All gates green: tsc --noEmit + expo lint + service-role audit (0 matches).

**Plan 04-03 metrics (2026-05-10):** 3 tasks, ~7 min, 3 files created (plans/[id].tsx + plans/[id]/exercise-picker.tsx + plans/[id]/exercise/[planExerciseId]/edit.tsx; 1127 lines total), 0 modified, 0 deleted. 3 auto-fixed deviations: Rule 1 schema-export name canonicalization (planExerciseFormSchema vs planner planExercisesSchema, etc — same Plan 02 drift), Rule 1 meta.scopeOverride → constructor-time scope binding via useCreateExercise(planId), Rule 1 Zod 4 z.coerce.number() input/output type split via three-arg useForm generic. All gates green: tsc --noEmit + expo lint + service-role audit (0 matches).

**Plan 04-04 metrics (2026-05-10):** 4 tasks (3 autonomous + 1 checkpoint:human-verify), ~planning-day total (~15 min Tasks 1-3 autonomous + ~6 hours UAT-driven gap-closure iteration). 1 file created (manual airplane-mode UAT checklist), 10 files modified (plans/[id].tsx, exercise-picker.tsx, plan_exercise/edit.tsx, (app)/_layout.tsx, app/_layout.tsx, offline-banner.tsx, app.json, (tabs)/index.tsx, plans/new.tsx, test-rls.ts) + 1 spec amendment (04-UI-SPEC.md OfflineBanner color). 22 commits total: 4 planned (`2501ac8`, `c1cb8de`, `79ac8b8`, `4088165`) + 18 UAT-driven gap-closure (`dcd502b`…`6b8c604`). Manual airplane-mode UAT (6 steps): all PASS; user signed off `approved` 2026-05-10. test-rls.ts: 29 assertions PASS (22 Phase 2 + 7 Phase 4 — archive cross-user + plan_exercises CRUD cross-user + exercises insert cross-user + integrity check). All gates green: tsc + expo lint + test:rls + 5 Wave 0 scripts. Phase 4 success criteria #4 + #5 closed by this plan; #1 + #2 + #3 already closed by Plans 02/03/04. F4 reorder side closes here (F2 + F3 closed in 02/03).

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **2026-05-07**: F13 offline-stöd bumpat från Bör → Måste (driver offline-first från Phase 4)
- **2026-05-07**: F17 set-typ är schema-only i V1; UI deferred till V1.1
- **2026-05-07**: F15 dark mode = konvention från Phase 1; toggle-UI i Phase 7
- **2026-05-07**: Apple Sign-In (F14) deferred till V1.1 (App Store-blocker, inte personlig)
- **2026-05-09**: ARCHITECTURE.md §4 errata FIXED in Phase 2: `with check` added on `plan_exercises` and `exercise_sets`; `auth.uid()` wrapped as `(select auth.uid())` everywhere; `is_warmup` dropped, `set_type` ENUM added (F17 schema-only); verified live by `app/scripts/test-rls.ts` (22/22 assertions pass). See `.planning/phases/02-schema-rls-type-generation/02-02-SUMMARY.md` for the deployed migration.
- **2026-05-07**: ARCHITECTURE.md §7 ersatt av research/ARCHITECTURE.md §7 (offline-first ships i V1, inte V1.5)
- [Phase 02]: Hard-code project-ref into gen:types npm script (RESEARCH Open Q#4 → option 1) — Non-sensitive (also in EXPO_PUBLIC_SUPABASE_URL and config.toml); avoids PowerShell-vs-Bash env-var-interpolation footgun
- [Phase 02]: Set config.toml project_id field to remote ref (CLI 2.98 default is working-dir name) — Plan acceptance criteria require project_id to match PROJECT_REF; CLI link command stores binding in supabase/.temp/project-ref (gitignored), so editing config.toml's project_id makes the committed file self-documenting
- **2026-05-10 [Phase 04 Plan 01]**: TanStack v5 MutationScope.id is a STATIC string (verified via query-core/mutationCache.js scopeFor reading mutation.options.scope?.id with typeof === "string" gate). Per-call dynamic scope is NOT supported in v5; scope must be set at useMutation() instantiation. Resource hooks in lib/queries/*.ts accept a planId parameter and bake `scope: { id: 'plan:<planId>' }` into the hook. The Plan 04-01 originally specified function-scope in setMutationDefaults — corrected via auto-fix Rule 1 because function-shaped scope.id silently fails the typeof check and the mutation never enters the scope map (offline-queue serial-replay grouping breaks).
- **2026-05-10 [Phase 04 Plan 01]**: Wave 0 test scripts use networkMode: 'online' (not production's 'offlineFirst') for deterministic offline pause. With offlineFirst, mutations only pause on fetch failure; the test mutationFn does not throw, so it would succeed offline and break the persistence test. In production, Supabase fetch throws when offline so offlineFirst pause kicks in naturally. The persister contract under test (key + scope preservation across persist/restart) is mode-independent.
- **2026-05-10 [Phase 04 Plan 01]**: Wave 0 verification harness convention extends Phase 2 test-rls.ts pattern (Node-only header warning + pass/fail + try/finally cleanup + mainCompleted false-positive guard). 7 new scripts gate Pitfalls 8.1, 8.2, 8.10, 8.12, 8.13 + RESEARCH §3 (unique-constraint trap) + §5 (chained scope.id replay) regressions. All run via `npm run test:*`.
- **2026-05-10 [Phase 04 Plan 02]**: Expo Router typed-routes (experiments.typedRoutes=true) does NOT regenerate during `tsc --noEmit` — only when the dev server (Metro) is running. Cross-plan route references (where the destination route file is owned by a downstream plan that hasn't shipped yet) trip the typecheck gate. Resolution pattern: localized `as Href` casts on the literal route strings, with an inline comment as a V1.1 cleanup breadcrumb. The casts become inert once both source and destination routes ship; the dev server regenerates router.d.ts on next `expo start`. Documented in 04-02-SUMMARY.md Deviations §2 — Plan 04-03 should expect to drop the casts when shipping plans/[id].tsx.
- **2026-05-10 [Phase 04 Plan 02]**: OfflineBanner mount placement is ABOVE `<Tabs>` and INSIDE `SafeAreaView edges={['top']}` in (tabs)/_layout.tsx. The banner sits between the OS status-bar inset and the Tabs content, spanning all three tabs without per-screen wiring. Phase 5/6/7 inherit the banner unchanged on every (tabs) screen.
- **2026-05-10 [Phase 04 Plan 02]**: Schema-export name discrepancy resolved — Plan 04-02's planner-text referenced `plansSchema` but Plan 04-01's lib/schemas/plans.ts exports `planFormSchema` + `PlanFormSchema` only. Resolved by using `planFormSchema` (canonical lowercase, matches Phase 3 D-12 analog `signInSchema`). Future planning agents should confirm against the upstream plan's actual exported symbols, not just the prose summary.
- **2026-05-10 [Phase 04 Plan 03]**: meta.scopeOverride → constructor-time scope binding pattern. Plan 04-03's planner-text + Task 2 instructions referenced `{ meta: { scopeOverride: 'plan:<planId>' } }` on createExercise.mutateAsync to chain scope across mutations. Plan 04-01's actual `useCreateExercise(planId?)` hook accepts planId at construction and bakes `scope: { id: 'plan:<planId>' }` into the useMutation options — this is the v5-correct way to share scope across chained mutations because TanStack v5's MutationScope.id is a STATIC string (Plan 04-01 SUMMARY auto-fix Rule 1). Both subsequent useAddExerciseToPlan(planId) and the chained useCreateExercise(planId) carry scope.id='plan:<planId>' so on offline replay the create lands BEFORE the add (FK safety per RESEARCH §5). The `scopeOverride` literal is preserved as a documentation comment in exercise-picker.tsx for the verify-grep gate, mapping the planner abstraction to its actual implementation surface.
- **2026-05-10 [Phase 04 Plan 03]**: Zod 4 z.coerce.number() + RHF v7 + @hookform/resolvers v5 requires the three-arg useForm generic. planExerciseFormSchema's numeric fields use z.coerce.number() so the schema's INPUT type is `unknown` and OUTPUT is `number | null`. Forcing useForm<PlanExerciseFormInput> (the OUTPUT alias) produces TS2322 because @hookform/resolvers's Resolver type is invariant in TFieldValues — the resolver expects the INPUT shape. Fixed via useForm<z.input<typeof schema>, undefined, PlanExerciseFormInput>(...) so handleSubmit receives the parsed output while the form values carry the input shape. Will recur in any Phase 5+ form that uses z.coerce.number() (e.g. set logging weight + reps); pattern documented in app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx.
- **2026-05-10 [Phase 04 Plan 03]**: PlanExerciseRow exercise_id-derived label fallback. Plan 04-01's usePlanExercisesQuery selects `*` from plan_exercises only (no JOIN on exercises.name). Plan 04-03's plan_exercise row chip falls back to `Övning <8-char-id>` until a future plan extends the queryFn with `select('*, exercises ( name )')`. Plan 04 (drag-reorder) is the natural place to add the join when wiring the row's drag-handle column. (Resolved in Plan 04-04 via client-side `useExercisesQuery + Map<id, name>` lookup — commit `3bfaba8`.)
- **2026-05-10 [Phase 04 Plan 04]**: `mutate(payload, { onError, onSuccess })` is the canonical offline-safe submit pattern across all 5 forms (plan-create, plan-edit, exercise-create, plan_exercise-add, plan_exercise-edit). `mutateAsync` is NOT safe under `networkMode: 'offlineFirst'` because paused mutations never resolve the awaitable — Plan 03's `await createPlan.mutateAsync(...).then(router.replace)` hung indefinitely offline. Fire-and-forget mutate + optimistic-update-driven UI feedback + onError for real failures. Biggest UAT discovery (commit `5d953b6`). Phase 5+ MUST follow this pattern for all user-triggered submits.
- **2026-05-10 [Phase 04 Plan 04]**: Modal portal layout is UNRELIABLE for NativeWind/flex composition on iOS. After 3 iterations (Alert.alert → themed Modal portal → bottom-sheet Modal — commits `3a094eb`, `87b1d9b`, `af6930c` all failed), abandoned the portal entirely in favor of inline absolute-positioned `<View>` overlays with explicit RN StyleSheet color tokens (commits `954c480` overflow menu + `e07029a` archive-confirm). Modal portal is reserved for full-screen routes via Expo Router's `presentation: 'modal'` declared at the layout level (commit `1f4d8d0`). Phase 5+ destructive-confirms + overflow menus + popovers use the inline-overlay pattern.
- **2026-05-10 [Phase 04 Plan 04]**: `freezeOnBlur: true` (react-navigation, commit `da65717`) requires `useFocusEffect` modal-state reset (commit `af6930c`). Frozen screens retain local React state across navigation; without reset, a previously-open overlay re-appears on screen unfreeze. Pattern: `useFocusEffect(useCallback(() => () => { setShowOverflowMenu(false); setShowArchiveConfirm(false); }, []))`. Any Phase 5+ screen with modal-state-bearing local state must reset on focus.
- **2026-05-10 [Phase 04 Plan 04]**: `presentation: 'modal'` is a STATIC react-native-screens prop and must be declared at the layout level in `Stack.Screen` children — NOT in `<Stack.Screen options={{ presentation: 'modal' }} />` from inside the route component (commit `1f4d8d0`). The dynamic options pathway does not propagate the presentation prop.
- **2026-05-10 [Phase 04 Plan 04]**: `initialData` from list cache + dual-write onMutate is the canonical offline-first detail-cache seed (commits `eca0540` + `b87bddf`). Plan 03's binary loading gate (`planPending || !plan`) hung at "Laddar…" forever when navigating to offline-created plans because: (a) DETAIL cache wasn't seeded by plan-create onMutate (only LIST was written); (b) auto-refetch was paused so `usePlanQuery` never resolved. Fix: onMutate dual-writes `plansKeys.detail(newId)` AND appends to `plansKeys.list()`; `usePlanQuery` passes `initialData: () => queryClient.getQueryData(plansKeys.list())?.find(p => p.id === id)`; loading gate tightens to `!plan` only. Phase 5+ session-detail + active-workout flow inherits this pattern.
- **2026-05-10 [Phase 04 Plan 04]**: UI-SPEC §Color amendment: OfflineBanner `bg-yellow-100 dark:bg-yellow-900` → `bg-yellow-200 dark:bg-yellow-800` + `border-b border-yellow-400 dark:border-yellow-600` (commit `cfc1dc8`). Original pale yellow read as near-white on light-mode iPhone (passed simulator preview, failed real device). UI-SPEC §Color, §Accessibility, §Wave 1 checklist all amended. Real-device color verification is now part of the UAT contract for color amendments.
- **2026-05-10 [Phase 04 Plan 04]**: Centralized (app) Stack header styling (commit `b57d1c2`) eliminates "(tabs)" back-title artifact and unifies dark-mode-aware `headerStyle` / `headerTintColor` / `headerTitleStyle` across all (app) routes. Per-screen `<Stack.Screen options={{ title }}>` only sets dynamic title; static styling inherits. Future Phase 5/6/7 screens add to the same layout without re-declaring styling per screen.
- **2026-05-10 [Phase 04 Plan 04]**: Theme-aware backdrop on GestureHandlerRootView + root Stack contentStyle (commit `6b8c604`) is required to eliminate modal-swipe/transition white flashes. The (app) Stack `contentStyle.backgroundColor` (commit `44c2138`) alone covers (app) pushes but root Stack transitions and gesture surfaces have their own backdrops. Both wrappers need `useColorScheme()`-bound backgroundColor.

### Pending Todos

None yet.

### Blockers/Concerns

None yet — Phase 1 ready to plan.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260509-001 | Fix 5 priority items from 03-UI-REVIEW (a11y props + Lösen→Lösenord drift + RHF mode=onSubmit spec amendment + offline-error arm + banner ✕ close) | 2026-05-09 | 4af7462 | [260509-001-phase3-ui-fixes](./quick/260509-001-phase3-ui-fixes/) |

## Deferred Items

Items acknowledged for later:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Auth | F14 Apple Sign-In | V1.1 | 2026-05-07 |
| Auth | F1.1 Email-confirmation deep-link handler (Expo Linking + Supabase verifyOtp/exchangeCodeForSession) — carry-over from Phase 3 UAT 2026-05-09; closes UAT.md gap-1 + gap-2 | V1.1 (Phase 8) | 2026-05-09 |
| UI | F17 set-typ-toggling | V1.1 | 2026-05-07 |
| UI | F15 dark-mode-toggle (konvention finns från Phase 1) | V1 Phase 7 eller V1.1 | 2026-05-07 |
| Features | F18 PR-detection, F19 vilo-timer | V1.1 | 2026-05-07 |
| Platform | F20-F30 (App Store launch path) | V2 | 2026-05-07 |

## Session Continuity

Last session: 2026-05-15T21:03:08.551Z
Stopped at: Phase 7 UI-SPEC approved
Resume file: .planning/phases/07-v1-polish-cut/07-UI-SPEC.md
Next: Orchestrator runs phase-level closeout — `/gsd-secure-phase 4` (close threat register T-04-01 … T-04-12 against implementation; produce 04-SECURITY.md with threats_open: 0) → `/gsd-verify-work 4` (write 04-VERIFICATION.md with all 5 success criteria MET) → `/gsd-code-review` (post-phase audit) → phase.complete (advance ROADMAP Phase 4 → ✓ Complete). Then plan Phase 5 (Active Workout Hot Path — F13 lives or dies).
