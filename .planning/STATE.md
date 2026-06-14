---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: — Forge Redesign
status: ready_to_plan
stopped_at: Phase 12 complete (11/11) — ready to discuss Phase 13
last_updated: 2026-06-14T07:40:20.373Z
last_activity: 2026-06-14
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 25
  completed_plans: 28
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-09)

**Core value:** Logga ett set och omedelbart se vad jag tog senast på samma övning — utan att tappa data, någonsin.
**Current focus:** Phase 13 — pr celebration (f18)

## Current Position

Phase: 13
Plan: Not started
Status: Ready to plan
Last activity: 2026-06-14

## Performance Metrics

**Velocity:**

- Total plans completed: 58 (3 in Phase 1, 6 in Phase 2, 4 in Phase 3, 4 in Phase 4, 7 in Phase 5)
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
| Phase 08 P01 | ~20min | 3 tasks | 9 files |
| Phase 08 P02 | ~15min | 3 tasks | 7 files |
| Phase 08 P03 | ~12min | 2 tasks | 5 files |
| Phase 08 P04 | ~18min | 3 tasks | 7 files |
| Phase 08 P05 | ~20min | 2 tasks | 2 files |
| Phase 09 P01 | ~18min | 3 tasks | 12 files |
| Phase 10 P10-01 | 5 | 3 tasks | 10 files |
| Phase 10 P10-02 | ~4min | 3 tasks | 8 files |
| Phase 10 P10-04 | ~4min | 2 tasks | 3 files |
| Phase 10 P10-03 | ~4min | 3 tasks | 3 files |
| Phase 10 P10-05 | ~4min | 3 tasks | 5 files |
| Phase 10 P10-06 | ~6min | 3 tasks | 4 files |
| Phase 11 P01 | 7min | 2 tasks | 3 files |
| Phase 12 P01 | ~35min | 3 tasks | 6 files |
| Phase 12 P03 | ~12min | 2 tasks | 2 files |
| Phase 12 P04 | ~12min | 3 tasks | 3 files |
| Phase 12 P07 | ~18min | 2 tasks | 3 files |
| Phase 12 P05 | ~15min | 2 tasks | 1 file |
| Phase 12 P06 | ~18min | 2 tasks | 1 file |
| Phase 12 P08 | ~20min | 2 tasks | 3 files |
| Phase 12 P09 (FIT-109) | ~6min | 2 tasks | 1 file |
| Phase 12 P10 (FIT-110) | ~8min | 2 tasks | 3 files |
| Phase 12 P11 (FIT-111) | ~14min | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **2026-06-13 (11-03)**: D-16 — draft-resume End-session button är en danger ghost (ForgeButton destructive); data-loss-adjacent är enda stället rött är rätt
- **2026-06-13 (11-03)**: D-11/MOTN-04 — §07 overlay-spring (damping 18 / stiffness 220) på draft-resume; saved-toast behöll FadeIn/FadeOut; båda inline (D-15, ingen Modal-portal)
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
- [Phase ?]: 2026-06-10 [Phase 08 Plan 01]: Locale key count is 93 per locale (true lib.jsx I18N map count); the plan's '188' was a source miscount. sv.json/en.json carry identical 93-key sets; check-locale-parity.ts PASS at 93. Downstream plans expect 93.
- [Phase ?]: 2026-06-10 [Phase 08 Plan 02]: No D-05 fallback — all 3 genuine Inter Display weights sourced from official OFL 1.1 releases (rsms/inter v4.1 + JetBrains v2.304); fonts self-hosted, combined OFL.txt bundled. _layout.tsx imports i18n twice by design (side-effect for LOAD-BEARING init ordering after @/lib/query/*, default import for LocaleBootstrap.changeLanguage), eslint-disable import/no-duplicates, lint 0 warnings. F13 untouched.
- [Phase ?]: 08-03: Icon/Logo/AppIcon via react-native-svg (D-11); ProgressRing/Sparkline static Skia, no new dep (D-08)
- [Phase ?]: Forge light+dark token parity: base = forge-<token>-light + dark: sibling = forge-<token> DEFAULT (Plan 08-04, first forge.* consumer)
- [Phase ?]: TabBar built standalone (active/onSelect props), NOT wired to live <Tabs> per OQ-5 — live re-skin deferred to Phase 9+ (Plan 08-04)
- [Phase ?]: Phase 8 Plan 05: dev-only Forge gallery at (app)/_forge-gallery.tsx — __DEV__-guarded, outside (tabs), reachable via router.push('/_forge-gallery'); added components/ui barrel; live <Tabs> untouched (OQ-5)
- **2026-06-11 [Phase 09 Plan 01]**: resolveLanguage pure core extracted to lib/resolve-language.ts — importing lib/i18n.ts under Node tsx breaks (expo-localization → untranspiled react-native; esbuild "Unexpected typeof" in react-native/index.js). lib/i18n.ts keeps a `resolveLanguage(pref, deviceLang?)` wrapper delegating to the core (supplies live Localization locale by default); pure unit tests import resolveLanguageCore from the pure module. Pattern: any Phase 9+ Node test of i18n-adjacent logic must target a pure module, not i18n.ts. Same boundary will apply if units/prefs ever gain Expo imports.
- **2026-06-11 [Phase 09 Plan 01]**: profiles.weekly_goal landed live (0007) — int NOT NULL DEFAULT 3 CHECK (1..7); no new RLS policy (own-row profiles policies from 0001 cover the column). Checkpoint:human-action push resolved non-interactively (`supabase db push` with empty stdin → Y). fm:* prefs centralized in lib/prefs.ts with catch-parse on every read + booleans as "true"/"false" strings (no JSON.parse throw surface). Plans 09-02/03 consume these.
- [Phase ?]: D-06: exercises.seed_key nullable additive column; reuses column-agnostic own-row RLS (no new policy)
- [Phase ?]: D-11: hard-delete preserves history via FK ON DELETE SET NULL + plan_name_snapshot backfill + get_session_summaries coalesce + useDeletePlan
- [Phase ?]: Phase 10 Plan 02: resolveMuscleGroupKey pure Node-importable taxonomy resolver (5 D-01 keys + other); 18-row hardcoded-UUID bilingual seed via auth-gated ExerciseSeedBootstrap, idempotent via upsert, no new dep.
- [Phase ?]: Phase 10 Plan 04: edit modal re-skinned to FExerciseEdit — FStepperInput nullable steppers (D-14), live preview chip, raw notes (D-16), danger-ghost remove (no confirm), Stäng/Spara mål header; save via useUpdatePlanExercise.mutate (SP-2). Dropped RHF/zod for local useState. 10 edit locale keys at parity (119).
- [Phase ?]: Phase 10 Plan 03: exercise picker re-skinned to FExercisePicker/New — single-select muscle-group filter pills (D-04) AND-combined with translated-name search (D-05), bilingual rows, mg dropdown (D-01) emitting the 5 keys, free-text equipment (D-02), add-now-set-later (D-14); preserved chained create-then-add scope.id=plan:<planId> (SP-2 .mutate). Widened Tk token-bag type so tk-prop subcomponents accept both themes. 13 picker locale keys at parity (132).
- [Phase ?]: Plan 10-05: tab bar re-skinned via custom ForgeTabBar tabBar renderer over live <Tabs> (keeps expo-router navigation; Phase-8 TabBar shell stays gallery-only)
- [Phase ?]: Plan 10-05: plan-card meta renders existing description (not an exercise count) — avoids per-plan N+1 / new aggregate (activity-ring hero is the Phase 12 boundary)
- [Phase ?]: Plan 10-06 plan-detail FPlanDetail re-skin + hard-delete D-10/D-11 + plan_name_snapshot on start
- [Phase ?]: 11-01: progress dots replace counter chip; Forge set-table with x-delete and always-on RPE; trophy omitted (D-02/D-03/D-04/D-05/D-06)
- [Phase ?]: 11-01: custom in-content Forge header + live started_at timer; native Stack header hidden (D-07/D-09)
- [Phase ?]: 11-01: this plan owns all phase locale keys at sv/en parity for 11-02/11-03 to consume (D-14)
- [Phase 11]: 11-02: Forge set-input row (56px accent ForgeNumField + 50px Klart CTA); set-logged SlideInDown+check-scale motion (ungated) + fm:haptics-gated Medium haptic, fire-and-forget after addSet.mutate (D-10/D-11/D-12)
- [Phase 11]: 11-02: AvslutaOverlay re-skinned to FFinishOverlay — client-derived 3-cell stats row, §07 overlay spring, accent-not-red Avsluta, inline (no Modal); frozen write path untouched (D-08/D-15/D-16/D-17)
- **2026-06-13 [12-02]**: D-20 — toDisplayVolume/formatVolume added to units.ts; imperial divides by KG_PER_LB with NO roundHalf (0.5-lb granularity meaningless on tonnage sums); formatVolume rounds to whole unit then sv-SE NBSP-groups + kg/lb suffix. Weights helpers untouched.
- **2026-06-13 [12-02]**: D-21/D-07 — full phase-12 sv+en locale key set at parity (180 keys). Added weeks/week streak relabel (days/day preserved); back relabeled to no-arrow "Tillbaka"/"Back" per UI-SPEC FLAG-1 a11y (cosmetic arrow-drop on 2 out-of-scope visible buttons); new keys (thisWeekVolume, rangeAll) over mutating overloaded existing keys to avoid cross-screen drift. Wave-3 screens (12-05..08) import with zero invention.
- **2026-06-13 [12-03]**: MOTN-02/D-19 — ProgressRing animates 0→value via withSpring(§07 damping 18/stiffness 220), arc Path rebuilt in useDerivedValue on UI thread; overflow = second-lap arc + wide low-opacity glow stroke (no Skia <Blur>), upper clamp removed (first lap capped at 360° in worklet), center label shows real count; useReducedMotion snaps to final
- **2026-06-13 [12-03]**: D-18 — Sparkline draws in left→right via animated-width <Group clip>; last-point dot fades/scales in at end of draw via delayed (withDelay 260ms) second shared value; Reanimated hooks hoisted above the data-guard early-return (rules-of-hooks); path math unchanged, F13 untouched (D-24). Phase-8 static-only headers lifted on both primitives. Plan verify referenced non-existent `npm run typecheck` → used `tsc --noEmit` (project canonical)
- **2026-06-13 [12-04]**: D-03/D-11/D-24 — Wave-3 query layer. useDashboardSummaryQuery (offline-first by inheritance: no networkMode override → persister hydrates dashboardKeys.summary() for free) parses the 8-field get_dashboard_summary row (weekly_volume_series jsonb → typed array) with device IANA p_tz. New 3-state ChartRange (30d/90d/All, default 90d) + EXPORTED rangeToSince (date-fns subDays) added alongside v1 5-state ChartWindow/windowToSince (byte-unchanged). useExerciseSummaryQuery returns ExerciseSummary|null (empty range → null for empty-state). Additive dashboardKeys/exerciseSummaryKeys; Phase-6 exerciseChartKeys/exerciseTopSetsKeys untouched. Zod parse on both hooks (T-12-08); avg_rpe nullable. 1 deviation (Rule 3): rangeToSince exported to satisfy acceptance contract (v1 windowToSince stays private). No `npm run typecheck` script → tsc --noEmit (project canonical).
- **2026-06-13 [12-07]**: D-15/D-17/D-22/D-24 — session-detail re-skinned to FSessionDetail (SKIN-06). Custom in-content Forge header (headerShown:false, 40px circular back + ellipsis-hosted delete, FLAG-1 a11y via t('back')/t('moreOptions') + 44px hit-slop) replaces the native headerRight ellipsis. 3-stat grid (Set/kg·volym/min, dividers, tabular-nums) + D-15 hybrid exercise cards (name + right max-weight stat + kept per-set list w × r + RPE). accentSoft notes block (F12 note verbatim). delete-confirm forge-danger (#D70015→#FF453A); PB trophy omitted (D-13). ALL overlay/delete/notes logic byte-preserved (mutate-not-mutateAsync, useFocusEffect reset, keyboard-lift, inline overlays — no Modal portal). fm:units read via settings.tsx useState+getPref idiom; volume cell renders toDisplayVolume numeral + dynamic kg/lb micro-label (no raw kg literal, D-20). Executed out-of-wave (depends only on 12-02); 12-05/06/08 still pending. 2 deviations (Rule 3 plan_name→plan_name_snapshot; Rule 2 added editNote key). tsc+lint clean, test:f13-brutal exit 0.
- **2026-06-13 [12-05]**: DASH-01/02/05 + MOTN-02 + D-01/D-02/D-03/D-04/D-07/D-18/D-20 — Home activity-ring hero on the Planer tab above the unchanged Phase-10 plan list. Animated 104px ProgressRing (sessions/weekly_goal, accent + [gradFrom,gradTo] brand gradient, real count in center overlay), weeks-streak ForgeChip (flame, t('weeks')/t('week') singular at N=1 — NEVER t('days')) + this-week-volume ForgeChip via formatVolume + fm:units pref (no raw kg). D-02 swap: `activeSession ? <ActiveSessionBanner/> : <HomeHero/>`. D-04 new-user nudge gated on lifetime_sessions===0 (returning-user mid-week with 0 sessions gets zeroed ring/chips, NOT the 'first workout' CTA). D-03 skeleton only on isPending && data===undefined. Hero is a className-decorated static View (bg/border in className, radius 24/padding 20/margin 16 inline) — exact FHome optical contract, not ForgeCard (xl=28). 2 Rule-3 deviations (no `npm run typecheck` script → tsc --noEmit; HeroSkeleton tk-prop widened to light|dark union). D-24 isolation intact: no mutation/queryKey/persister/exercise_sets touched. test:f13-brutal amber on a live-DB precondition (FIT-107) — 25-set fixture missing, not a regression; the test imports nothing from app/app/**.
- **2026-06-13 [12-06]**: SKIN-06 + DASH-03/DASH-04 (D-05 split) — History re-skinned to FHistory. Lifetime eyebrow (D-09) + weekly-volume overview card carrying the DASH-03/DASH-04 mock-literals ON History (not Home): big formatVolume numeral + forge-success delta chip (up-arrow, prior-week %, success-ONLY — a down-week shows NO chip, never red) + animated accent Sparkline fed weekly_volume_series via toDisplayVolume. Forge rows (D-16): 44px surface2 DD/MON date-badge + plan name + 'X set · Y kg · Z min' meta + chevronRight; row duration derived client-side from finished_at−started_at (SessionSummary has no duration column); PR trophy omitted (D-13). volumeTrendEmpty gated on lifetime_sessions>0 && series.length>=2 (Sparkline needs ≥2 pts). successSoft chip bg = inline theme hex (no forge-successSoft token). Eyebrow+title+card hosted in FlatList ListHeaderComponent (scrolls + inherits pull-to-refresh). All v1 plumbing byte-preserved; units D-20 + i18n D-21; D-24 read-only isolation intact. 2 Rule-3 deviations (no `npm run typecheck` → tsc --noEmit; client-derived duration). F13 amber on FIT-107 count precondition only.
- **2026-06-13 [12-08]**: SKIN-06 + MOTN-03 — Chart re-skinned to FChart. D-17 custom Forge header (headerShown:false, 40px circular back + symmetric ellipsis with no menu — chart is read-only — FLAG-1 a11y on both). D-11 3-state ChartRange (30d/90d-default/All) replaces the v1 5-state WINDOW_OPTIONS; default "90d". D-12 hero = 52px current_best numeral + forge-success range-delta chip (weight=+kg abs, volume=+%) from useExerciseSummaryQuery — REAL data, e1RM omitted (D-13). D-14 3-stat row (top-set/vol-per-session/avg-RPE '-' on null). MOTN-03 line+scatter wrapped in <Group clip={drawClip}> animating 0→full width via withSpring §07, re-fires on chartData identity (memo contract), snaps under useReducedMotion. D-20 chartData itself converted (plotted line + y-axis in display unit) + hero/stats/tooltip/Senaste-10 via formatWeight/formatVolume. **rangeAsWindow D-24 bridge**: line/top-sets hooks stay on the v1 ChartWindow factories (30d→1M/90d→3M/All→All) — no union widening; hero/stats use the additive get_exercise_summary RPC with the exact rangeToSince day-boundary. matchFont FIT-67 + memo contract + tooltip SharedValue mirror + BLOCKER-2 routing preserved verbatim. 9 new chart locale keys (190 sv/en parity). 2 Rule-3/2 deviations (type bridge + missing copy); no `npm run typecheck` → tsc --noEmit. F13 amber on FIT-107 count precondition only (read-only, D-24 intact).
- **2026-06-14 [12-11]**: FIT-111 (D-20/D-08/D-24) — new app/lib/units-store.ts: a plain Zustand store (font-store/persistence-store precedent — no persist middleware) holding the LIVE display UnitPref so a kg↔lbs Settings toggle re-renders every read-side figure immediately (no restart). Root cause: each consumer read fm:units via a non-reactive local useState+useEffect(getPref) — AsyncStorage read once, no subscription — so format/convert helpers only re-ran on remount and settings' setPref notified nobody. hydrate(u) sets state only (boot path); setUnit(u) sets state AND persists via setPref("fm:units") (Settings write path). UnitsBootstrap in _layout.tsx hydrates from fm:units at boot (ThemeBootstrap precedent); NOT added to the splash gate (metric default renders fine pre-hydration). Settings units row reads useUnitStore selector + onUnitsChange→setUnit (mirrors the language control's live i18n.changeLanguage). 4 consumers (history/index-HomeHero/[sessionId]/chart) migrated to the selector; useUnitPref deleted from history.tsx; no getPref("fm:units") in any of the 4. chart.tsx chartData memo dep array keeps units (WR-01 — store source is what redraws line+y-axis live). D-20 storage canonical kg / display-only conversion + D-24 read-only isolation intact; FIT-110 cross-link preserved. New test:units-store (7 assertions, AsyncStorage stubbed in require cache for Node tsx). tsc+lint clean; test:f13-brutal exit 0 (no-recent-session no-op, FIT-107 window). 0 deviations.
- **2026-06-14 [12-10]**: FIT-110 (regression, D-15/D-17/D-21/D-24) — restored the session-detail ExerciseCard → /exercise/[exerciseId]/chart cross-link that the 12-07 re-skin dropped (chart route was orphaned — no nav entry anywhere, MOTN-03 draw-on-mount unreachable). Root cause: 12-07 (d7711f3) replaced the Phase-6 Pressable card with a plain View + a false "informational only" comment. Fix: ExerciseCard root View→Pressable keeping the SAME Forge className box-decoration (NativeWind box-decoration-via-className learning), pressed-opacity via style() callback only; chevronRight cue added right of the max-weight stat (the regression's harm was an invisible affordance); new exerciseId+onPress props; call site router.push(`/exercise/${exerciseId}/chart` as Href) — Href already imported by 12-07. New viewExerciseChart sv+en flat key (190→191 parity) with {{exercise}} interpolation routed through t() for accessibilityLabel. D-15 (hybrid card frame+stat+per-set list) + D-17 (custom header) untouched — no re-skin revert. 1 Rule-3 deviation (void exerciseId; — prop on signature per must_haves but nav wired at call site, satisfies lint). tsc+lint clean.
- **2026-06-14 [12-09]**: FIT-109 (D-03/D-24) — finishing a session now invalidates dashboardKeys.all in the EXISTING ['session','finish'] onSettled (after listInfinite). Root cause: onSettled invalidated active/detail/last-value/listInfinite but not dashboardKeys, so get_dashboard_summary cache stayed stale until an unrelated refetch (next session start). One broad-prefix fire-and-forget invalidate (matches lastValueKeys.all convention) refreshes the shared Home-ring + History-card + lifetime-eyebrow slot (D-03). D-24 intact: mutationFn/onMutate/onError/retry/scope byte-unchanged, no await on the finish write. tsc+lint clean, non-comment dashboardKeys.all count=1, test:f13-brutal exit 0 (no-recent-session no-op; FIT-107 window).
- [Phase ?]: 2026-06-13 [12-01]: Migration 0011 deployed live — get_dashboard_summary (combined 8-col single-row aggregate) + get_exercise_summary (chart hero/3-stat). Both security invoker + stable + search_path='' + set_type='working', finished-only. Streak <=2 in-progress-week island boundary LOCKED (D-07); local Mon-Sun bucketing via date_trunc('week', started_at at time zone p_tz) (D-06). Proven by test:dashboard.

### Pending Todos

None yet.

### Blockers/Concerns

- **FIT-107 (debt, medium):** `npm run test:f13-brutal` is amber on a live-DB precondition — it asserts a 25-set brutal fixture on the most-recent session, but the most-recent session has 3 sets. All set-integrity assertions PASS; only the count fails. The 12-05 hero is read-only and the test imports nothing from `app/app/**`, so this is NOT a regression. Re-run after a fresh 25-set device fixture, or scope the script to a tagged fixture session.

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

Last session: 2026-06-14T06:48:18.000Z
Stopped at: Completed 12-11-PLAN.md (gap-closure FIT-111 — reactive useUnitStore; kg↔lbs Settings toggle re-renders every read-side figure live, no restart). All 3 device-UAT gap plans (FIT-109/110/111) now executed.
Resume file: None
Next: Orchestrator runs phase-level closeout — `/gsd-secure-phase 4` (close threat register T-04-01 … T-04-12 against implementation; produce 04-SECURITY.md with threats_open: 0) → `/gsd-verify-work 4` (write 04-VERIFICATION.md with all 5 success criteria MET) → `/gsd-code-review` (post-phase audit) → phase.complete (advance ROADMAP Phase 4 → ✓ Complete). Then plan Phase 5 (Active Workout Hot Path — F13 lives or dies).

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
