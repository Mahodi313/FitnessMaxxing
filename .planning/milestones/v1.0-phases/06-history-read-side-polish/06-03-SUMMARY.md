---
phase: 06-history-read-side-polish
plan: 03
subsystem: ui
tags: [react-native, victory-native, skia, useChartPressState, useInfiniteQuery, tanstack-v5, expo-router, nativewind, zod, history, chart, F10, segmented-control, phase-6]

# Dependency graph
requires:
  - phase: 06-history-read-side-polish (Plan 06-01a)
    provides: get_exercise_chart RPC (day-aggregate max(weight_kg) / sum(weight_kg*reps), p_since filter, RLS via SECURITY INVOKER) + get_exercise_top_sets RPC (one row per source session with session_id, completed_at, weight_kg, reps int, p_limit honoured); Database['public']['Functions'] types regenerated; Wave 0 harness (13 assertions A-M including the chart + top-sets cross-user RLS assertions)
  - phase: 06-history-read-side-polish (Plan 06-01b)
    provides: sessionsKeys.listInfinite + SessionSummarySchema Zod boundary + queryClient invalidation conventions
  - phase: 06-history-read-side-polish (Plan 06-02)
    provides: /history/[sessionId] route (chart route's Senaste 10 list routes back to it without an 'as Href' cast); useFocusEffect overlay-reset pattern (Plan 06-03 chart route has no overlay so this is inherited but not consumed)
  - phase: 04-plans-exercises-offline-queue-plumbing
    provides: useColorScheme accent convention (D-18 + Phase 4 commit 6b8c604) — chart-route inherits same accent binding; useExercisesQuery + Map<id, name> lookup (Phase 4 commit 3bfaba8) — chart-route Stack header title resolution; centraliserad (app) Stack header styling (Phase 4 commit b57d1c2) — chart-route header inherits
  - phase: 02-schema-rls-type-generation
    provides: TanStack persister + AsyncStorage (chart cache hydrates from prior online fetches automatically — ROADMAP success #4 inherited)
provides:
  - "useExerciseChartQuery(exerciseId, metric, window) hook in lib/queries/exercise-chart.ts — Zod-parsed ChartRow[] response from get_exercise_chart RPC"
  - "useExerciseTopSetsQuery(exerciseId, window, limit=10) hook in lib/queries/exercise-chart.ts — Zod-parsed TopSetRow[] response from get_exercise_top_sets RPC with reps int constraint (BLOCKER-2 contract)"
  - "exerciseChartKeys.byExercise(id, metric, window) + exerciseTopSetsKeys.byExercise(id, window) factories in keys.ts — distinct cache slots per (metric, window) tuple"
  - "Reusable generic <SegmentedControl<T extends string>> NativeWind component — used twice by chart route, available for V1.1+ polish surfaces"
  - "/exercise/[exerciseId]/chart route — MetricToggle + WindowToggle + memoized <CartesianChart> + Skia tooltip callout via inline ChartPressCallout sub-component + two-state ChartEmptyState + tappable Senaste 10 passen list"
  - "plans/[id].tsx PlanExerciseRow chart-icon entry-point between edit + remove Pressables (D-24, WARN-6 fix with hitSlop={6})"
  - "Plan 06-03 chart-route UAT sections (97 new lines) appended to manual-test-phase-06-uat.md — 7 sections covering entry-points, toggles, memoization, two-state empty, Skia tooltip, theme awareness, top-sets list"
affects: [07-polish (F15 manual dark-mode toggle can reuse <SegmentedControl> primitive verbatim; chart-route is already F15-compliant), V1.1 (workout-hot-path chart-icon DEFERRED per D-28; segmented-control primitive available for RPE / set-typ toggles)]

# Tech tracking
tech-stack:
  added: []  # No new client-bundled dependency (Phase 6 rule + CONTEXT.md)
  patterns:
    - "Two Zod-parsed RPC hooks co-located in one file (exercise-chart.ts) — pattern for future read-side aggregate hooks; both hooks Zod-parse every row per Pitfall 8.13"
    - "TopSetRowSchema enforces reps as z.coerce.number().int() at the wire boundary so UI can render literal '${weight_kg} kg × ${reps}' without floating-point reps surprise (BLOCKER-2 contract)"
    - "Cache slot tuple — exerciseChartKeys includes metric+window; exerciseTopSetsKeys excludes metric (top-sets is metric-agnostic — D-20)"
    - "useChartPressState init shape MUST mirror yKeys=['y'] as { x: 0, y: { y: 0 } } so state.y.y.position is defined (RESEARCH Pitfall 2) — locked"
    - "Skia tooltip via useDerivedValue for ALL position + text props — UI-thread worklet so the rect + text follow the press gesture smoothly"
    - "useDerivedValue hooks hoisted to a dedicated ChartPressCallout sub-component — keeps top-level component's hook order stable and respects rules-of-hooks"
    - "Two-state empty disambiguation via a second useExerciseChartQuery(id, metric, 'All') call — cost is low + cache-shared, recommended by RESEARCH A2"
    - "useMemo dep array over chartQuery.data is EXACTLY [chartQuery.data] (D-21 + WARN-7) — metric/window already in queryKey would only cause redundant recomputes"
    - "Generic NativeWind segmented-control with cn() inline helper (no project-wide utility exists) — TypeScript generic <T extends string> for typed unions across V1.1+ uses"

key-files:
  created:
    - app/lib/queries/exercise-chart.ts
    - app/components/segmented-control.tsx
    - app/app/(app)/exercise/[exerciseId]/chart.tsx
  modified:
    - app/lib/query/keys.ts
    - app/app/(app)/plans/[id].tsx
    - app/scripts/manual-test-phase-06-uat.md

key-decisions:
  - "Plan 06-03 deliberately does NOT add chart-key invalidation to client.ts ['set','add'] onSettled because charts are read-side polish, not hot-path. The user would not be looking at the chart while mid-pass logging sets (chart route is reached from plan-detail or session-detail card-header, not from the active workout screen). Documented in exercise-chart.ts file-header — V1.1 follow-up if soak surfaces 'I logged sets but the chart shows yesterday's data'."
  - "Two queries (chartQuery + allTimeChartQuery) for BLOCKER-3 two-state empty rendering — RESEARCH §A2 confirmed cost is low + cache slots reuse. The second query is `enabled: !!exerciseId` so it always fires once on cold cache but subsequent toggles to All window are cache-hits (free)."
  - "ChartPressCallout extracted to its own sub-component — useDerivedValue hooks must live at function top level, not inside conditional `{isActive && ...}` JSX branches. Refactor keeps rules-of-hooks compliant while still rendering the callout only when pressed."
  - "WARN-5 deviation acknowledged + committed: chart-icon on plans/[id].tsx ships BETWEEN edit and remove per UI-SPEC §Visuals JSX lines 671-684 (NOT rightmost per UI-SPEC line 287 prose). The JSX is the authoritative contract; the prose-patch is paperwork. Justification documented in chart.tsx file-header comment block."
  - "Inline cn() helper in segmented-control.tsx — no project-wide @/lib/utils utility exists (verified via grep app/lib/ app/components/). 5 LoC + Boolean filter; replicable wherever a future component needs conditional NativeWind classes."

patterns-established:
  - "Pattern: Dual-RPC consumption for aggregated chart + per-source-session secondary list — when a chart aggregates by day, ship a sibling RPC for the per-source-session detail (D-20 + BLOCKER-2 closure). Replicable for future PR-history surfaces (V1.1) where the chart shows trend + a list shows source sessions."
  - "Pattern: Skia tooltip in Victory Native XL — extract the rect + text + highlight Circle to a sub-component so useDerivedValue hooks stay at top level. Position math: clamp via Math.min(Math.max(pressState.x.position - 60, chartBounds.left + 4), chartBounds.right - 124) so the rect never clips off the canvas."
  - "Pattern: Two-state empty rendering — for any windowed read-side query, fire a second window='All' query against the same RPC + branch on the combination (chartData.length === 0 && allTimeChartQuery.data?.length >= 1 → window-empty; chartData.length === 0 && allTimeChartQuery.data?.length === 0 → all-time-empty)."

requirements-completed: [F10]

# Metrics
duration: ~25 min
completed: 2026-05-15
---

# Phase 6 Plan 03: F10 per-exercise progressionsgraf vertical slice Summary

**Closes F10 end-to-end via TWO RPCs from Plan 06-01a (chart aggregate + per-source-session top-sets), a memoized <CartesianChart> with a full Skia tooltip callout on tap-and-hold, two-state empty rendering, and a tappable Senaste 10 passen list routing back to source sessions — all three BLOCKERS closed (D-17, D-19, D-20); all four WARNs closed (5, 6, 7, 9).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-15T19:00Z (approx)
- **Completed:** 2026-05-15T19:25Z (approx)
- **Tasks:** 4 (all autonomous)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- `useExerciseChartQuery(exerciseId, metric, window)` + `useExerciseTopSetsQuery(exerciseId, window, limit=10)` exported from `lib/queries/exercise-chart.ts` (149 lines). Both hooks call the matching SECURITY INVOKER RPC from migration 0006 (Plan 06-01a), throw on Supabase error, and Zod-parse every response row via `ChartRowSchema` / `TopSetRowSchema` (PITFALLS §8.13 boundary). The TopSetRowSchema enforces `reps: z.coerce.number().int()` so the UI can safely render the literal `${weight_kg} kg × ${reps}` (BLOCKER-2 contract). Inline `windowToSince()` helper resolves the 5 window values to ISO timestamps via `subMonths` / `subYears`; `All` returns null (server SQL handles it). `enabled: !!exerciseId` gate prevents fetch on empty URL params.
- `exerciseChartKeys.byExercise(id, metric, window)` + `exerciseTopSetsKeys.byExercise(id, window)` factories appended to `lib/query/keys.ts`. Cache slot tuples drive D-14 (metric toggle is instant on cache-hit) and D-15 (window toggle is same). Top-sets factory deliberately excludes `metric` because the source-session rows are metric-agnostic (D-20).
- `app/components/segmented-control.tsx` (96 lines) exports a generic `SegmentedControl<T extends string>` component — NativeWind primary path per CONTEXT.md + UI-SPEC. Parent `role="tablist"` + per-segment `role="tab"` + `accessibilityState.selected` + `hitSlop={{ top: 4, bottom: 4 }}` for the ≥44pt floor. Inline `cn()` helper (no project-wide @/lib/utils utility exists — verified via grep). Used twice on the chart route (MetricToggle + WindowToggle); reusable for V1.1+ surfaces (F15 manual dark-mode toggle, future RPE / set-typ toggles).
- `/exercise/[exerciseId]/chart.tsx` (428 lines, exceeds `min_lines: 150`) renders the full F10 vertical slice:
  - `<Stack.Screen options={{ headerShown: true, title: exerciseName }}>` resolves the title via `useExercisesQuery + Map<id, name>` (Phase 4 commit 3bfaba8 pattern) with fallback "Övning" for cold cache.
  - `useState<ChartMetric>("weight")` + `useState<ChartWindow>("3M")` for D-14 + D-15 defaults.
  - Three queries: `chartQuery` (active window), `allTimeChartQuery` (window='All' for BLOCKER-3 disambiguation), `topSetsQuery` (Senaste 10 list).
  - `chartData = useMemo(() => (chartQuery.data ?? []).map(...), [chartQuery.data])` with the WARN-7-exact dep array — metric/window are already in the queryKey.
  - Two-state empty rendering (BLOCKER-3): when chartData is empty AND allTimeChartQuery has ≥1 point → "Inga pass i detta intervall" + "Byt till All för att se hela historiken."; when both are empty → "Inga pass än för den här övningen" + "Logga minst 2 set för att se trend."
  - Sparse caption (1 data point): "Logga ett pass till för att se trend." below the canvas (Victory Native XL renders the single dot automatically).
  - `useChartPressState({ x: 0, y: { y: 0 } })` init shape mirrors yKeys=['y'] so `state.y.y.position` is defined (RESEARCH Pitfall 2).
  - **BLOCKER-1 closure:** `ChartPressCallout` sub-component renders the FULL Skia tooltip — `RoundedRect` background + two `SkiaText` nodes (value line + date line) + highlight `Circle`, all positioned via `useDerivedValue` with `chartBounds` clamping (`Math.min(Math.max(pos - 60, left + 4), right - 124)`) so the rect never clips off-canvas. NOT a placeholder highlight.
  - **BLOCKER-2 closure:** Senaste 10 passen list maps `topSetsQuery.data` to Pressable rows with `router.push(`/history/${row.session_id}`)` on tap + secondary text `${row.weight_kg} kg × ${row.reps}` (reps preserved as int through Zod parse).
  - Theme bindings via `useColorScheme()` once at top — chart line #2563EB light / #60A5FA dark; tooltip background #FFFFFF / #1F2937; axis labels #6B7280 / #9CA3AF (D-23).
- `plans/[id].tsx` PlanExerciseRow extended with chart-icon Pressable BETWEEN the edit-affordance (chevron-forward) and remove-affordance (close-outline) per UI-SPEC §Visuals JSX lines 671-684. `hitSlop={6}` (WARN-6 closure — NOT `hitSlop=4`). `p-3` padding around 22pt icon = 46pt hit-target. accessibilityLabel `Visa graf för ${exerciseName}` + accessibilityHint "Tryck för att se progressionsgraf". Routes to `/exercise/<exercise_id>/chart` without an `as Href` cast since the route file ships in the same wave. PlanExerciseRow component signature extended with `onShowChart` + `accent` props (mirrors existing `onEdit` / `onRemove` + `muted` pattern).
- `manual-test-phase-06-uat.md` extended from 237 → 334 lines (97 net new lines). Plan 06-03 TODO skeleton (29 lines) replaced with 7 detailed F10 sections: Chart route entry-points (D-24/D-25/D-26), Metric+Window toggles (D-14/D-15), Memoization verified (ROADMAP success #3 + WARN-7 dep-array exactness check), two-state empty state (BLOCKER-3), Skia tooltip on tap-and-hold (BLOCKER-1), Theme awareness (D-23), Senaste 10 passen tappable rows with reps preservation (BLOCKER-2). All Plan 06-01b + 06-02 sections preserved.

## Task Commits

Each task committed atomically (worktree-mode — orchestrator owns the final SUMMARY commit):

1. **Task 1: Extend keys.ts + author lib/queries/exercise-chart.ts (TWO hooks)** — `419e6de` (feat)
2. **Task 2: Author components/segmented-control.tsx NativeWind-baserat reusable** — `1ae1a75` (feat)
3. **Task 3: Author /exercise/[exerciseId]/chart.tsx — toggles + memoized chart + FULL Skia tooltip + two-state empty + tappable Senaste 10 passen** — `25911d4` (feat)
4. **Task 4: Extend plans/[id].tsx PlanExerciseRow with chart-icon (D-24) + UAT markdown** — `e7a83e4` (feat)

All four commits tagged `[FIT-65]` per Linear sub-issue manifest (`.planning/phases/06-history-read-side-polish/.linear-sync.json`).

## Files Created/Modified

### Created

- `app/lib/queries/exercise-chart.ts` (149 lines) — TWO hooks (`useExerciseChartQuery`, `useExerciseTopSetsQuery`) + two types (`ChartMetric`, `ChartWindow`) + two Zod schemas + inferred types (`ChartRow`, `TopSetRow`) + `windowToSince` helper. File-header comment block documents BLOCKER-2 dual-RPC rationale + chart-key invalidation deferral + the Supabase type-gen NULL workaround.
- `app/components/segmented-control.tsx` (96 lines) — Generic NativeWind `SegmentedControl<T extends string>` component with inline `cn()` helper. Parent `role="tablist"` + per-segment `role="tab"` + `accessibilityState.selected` + `hitSlop={{ top: 4, bottom: 4 }}`.
- `app/app/(app)/exercise/[exerciseId]/chart.tsx` (428 lines) — F10 chart route with MetricToggle + WindowToggle + memoized `<CartesianChart>` + inline `ChartPressCallout` sub-component (Skia tooltip) + two-state empty rendering + tappable Senaste 10 passen list. File-header comment block documents all three BLOCKER closures, the WARN-7 memoization contract, and the WARN-5 chart-icon position deviation.

### Modified

- `app/lib/query/keys.ts` — Appended `exerciseChartKeys.byExercise(id, metric, window)` + `exerciseTopSetsKeys.byExercise(id, window)` factories after existing `lastValueKeys`. 47 net new lines. Existing factories untouched.
- `app/app/(app)/plans/[id].tsx` — Inserted chart-icon Pressable BETWEEN edit and remove per UI-SPEC §Visuals JSX lines 671-684 (WARN-5 deviation). PlanExerciseRow signature extended with `onShowChart` + `accent` props. 22 net new lines (15 added inside the row JSX + 4 prop signature + 3 parent props pass-through). DraggableFlatList wiring + ScaleDecorator untouched.
- `app/scripts/manual-test-phase-06-uat.md` — Replaced Plan 06-03 TODO section (29 lines) with 7 detailed F10 UAT sections (97 lines). Net delta: 68 lines added; total file now 334 lines. All Plan 06-01b + 06-02 sections preserved verbatim.

## Decisions Made

- **`ChartPressCallout` as a sub-component (not inline JSX inside `<CartesianChart>` render-prop)** — `useDerivedValue` hooks must live at function top level per rules-of-hooks; putting them inside a conditional `{isActive && <>...</>}` JSX expression would be a hooks-order violation. Extracting to a sub-component keeps the hook order stable while still rendering the callout only when pressed (the parent gates via `{isActive ? <ChartPressCallout .../> : null}`).
- **Dual-RPC design over a single combined RPC** — Plan 06-01a deliberately shipped two RPCs (`get_exercise_chart` aggregates by day; `get_exercise_top_sets` returns per-source-session rows) because the chart aggregate cannot deliver reps preservation per session (BLOCKER-2 contract). Plan 06-03 consumes both. The two-RPC design also means the chart-side memoization is simpler (single data array, single useMemo) while the Senaste 10 list lives in its own query slot.
- **Two queries (chartQuery + allTimeChartQuery) for two-state empty** — Alternative considered: a single query with `p_since=null` (window='All') and client-side window-filtering. Rejected because: (1) the windowing logic is the SERVER's job (RPC handles `(p_since is null or es.completed_at >= p_since)`) and duplicating it client-side is duplication; (2) the cache slot for `(id, metric, 'All')` is reusable when the user explicitly toggles to All — they get instant render. RESEARCH §A2 confirmed cost is low.
- **`null as unknown as string` cast on `p_since`** — Generated `Database['public']['Functions']['get_exercise_chart']['Args']['p_since']` is typed as required `string` (Supabase type-gen limitation for nullable timestamptz RPC parameters). The SQL body handles NULL correctly via `(p_since is null or es.completed_at >= p_since)`. Cast scoped to the queryFn boundary; mirrors the same pattern in Plan 06-01a (test scripts) + Plan 06-01b (sessions.ts cursor pagination).
- **`accent` passed as a prop to PlanExerciseRow (not derived locally inside the row)** — Mirrors the existing `muted` prop wiring. Avoids two `useColorScheme()` calls on each row's render (PlanDetailScreen already binds once at line 108). One-extra-prop is a smaller surface than a per-row hook call.
- **No `useFocusEffect` on the chart route** — The route has no overlay state (no overflow menu, no destructive confirm). Plan 06-02's freezeOnBlur reset pattern doesn't apply here. Plan 06-03 chart route is pure read; the only mutating action is `router.push` which doesn't need cleanup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree bootstrap — missing .env.local + node_modules**

- **Found during:** Start of plan execution (running `npm run linear:plan-id` from the worktree)
- **Issue:** Worktree spawns inherit only committed files. `.env.local` (gitignored) and `app/node_modules` were absent so npm scripts that call `tsx --env-file=.env.local` would fail, and verification gates (`npx tsc`, `npx expo lint`, `npm run test:rls`) had no resolved dependencies.
- **Fix:** Copied `.env.local` from the main worktree (`cp /c/.../app/.env.local <worktree>/app/.env.local`) and ran `npm install --no-audit --no-fund --silent` in `app/` in the background while applying Task 1 edits. By the time Task 1 verification ran, `node_modules` was hydrated.
- **Files modified:** None tracked (`.env.local` is gitignored; `node_modules/` is gitignored).
- **Verification:** All subsequent verification gates ran green.
- **Committed in:** Not committed (per-worktree bootstrap, not a plan deliverable). Same pattern documented in 06-01a/06-01b/06-02 summaries' "Issues Encountered" / Deviations §1.

**2. [Rule 1 - Bug] `ReadonlyArray<T>` lint warning in SegmentedControl**

- **Found during:** Task 2 verification (`npx expo lint components/segmented-control.tsx`)
- **Issue:** Initial implementation used `options: ReadonlyArray<Option<T>>` per UI-SPEC's TypeScript-style example. ESLint `@typescript-eslint/array-type` rejects `ReadonlyArray<T>` in favor of `readonly T[]` (project config preference, established Phase 1).
- **Fix:** Changed `ReadonlyArray<Option<T>>` to `readonly Option<T>[]`. Same semantic, lint-compliant.
- **Files modified:** `app/components/segmented-control.tsx`
- **Verification:** `npx expo lint components/segmented-control.tsx` re-run: 0 errors, 0 warnings.
- **Committed in:** `1ae1a75` (Task 2 commit; the fix was applied before staging, no separate commit needed).

**3. [Rule 2 - Critical] `ChartPressCallout` hooks-order — refactor to sub-component**

- **Found during:** Drafting Task 3
- **Issue:** The PLAN.md task-3 action block sketched the Skia tooltip as inline JSX inside the `{isActive && <>...</>}` conditional within the `<CartesianChart>` render-prop child. That shape would put `useDerivedValue` hooks inside a conditional render, violating rules-of-hooks (hooks must run in the same order on every render).
- **Fix:** Extracted the tooltip to a dedicated `ChartPressCallout` sub-component whose hooks live at its own function top level. The parent gates via `{isActive ? <ChartPressCallout .../> : null}` — the sub-component is mounted/unmounted, but each render of the sub-component runs its hooks in stable order. The tooltipValueText + tooltipDateText useDerivedValue calls in the parent are also hoisted to top level (unconditional).
- **Files modified:** `app/app/(app)/exercise/[exerciseId]/chart.tsx`
- **Verification:** `npx tsc --noEmit` exits 0; `npx expo lint` exits 0 (no rules-of-hooks warning).
- **Committed in:** `25911d4` (Task 3 commit; the refactor was applied during initial authoring).

---

**Total deviations:** 3 (1 blocking — worktree bootstrap; 1 lint cleanup; 1 critical refactor to comply with React rules-of-hooks).
**Impact on plan:** All three are correctness / tooling necessities, not scope creep. The bootstrap is a known worktree-mode artifact (already documented in prior summaries); the lint cleanup is a 1-line type-style fix; the hooks-order refactor preserves the BLOCKER-1 Skia tooltip contract while complying with React's hooks rules (the contract requires the tooltip to be rendered + position-tracked, which works identically with the sub-component shape).

## Issues Encountered

- **None beyond the deviations noted above.** No regressions on prior-phase assertions — `test:rls` still 45/45 PASS, `test:exercise-chart` still 13/13 PASS. tsc 0 errors, expo lint 0 errors / 0 warnings. The new chart route is purely additive to the (app) stack — no other route or screen is affected.

## User Setup Required

None — no external service configuration required. The two RPCs Plan 06-03 consumes were already deployed by Plan 06-01a; the chart-icon entry-point on `plans/[id].tsx` is a single-file extension. Manual UAT on iPhone is documented in `app/scripts/manual-test-phase-06-uat.md` (now 334 lines; sign-off section updated to reflect Plan 06-03 sections instead of the TODO skeleton).

## Self-Check: PASSED

Verified deliverables on disk and in git:

- `app/lib/query/keys.ts` — MODIFIED (116 lines; contains `exerciseChartKeys` AND `exerciseTopSetsKeys` factories; literal `"weight"` AND `"All"` parameter typing visible)
- `app/lib/queries/exercise-chart.ts` — CREATED (149 lines; contains `useExerciseChartQuery`, `useExerciseTopSetsQuery`, `supabase.rpc("get_exercise_chart"`, `supabase.rpc("get_exercise_top_sets"`, `ChartRowSchema.parse`, `TopSetRowSchema.parse`, `reps: z.coerce.number().int()`, `subMonths`, `subYears`, `enabled: !!exerciseId`; no `export default`)
- `app/components/segmented-control.tsx` — CREATED (96 lines; contains `export function SegmentedControl`, generic `T extends string`, `bg-gray-100 dark:bg-gray-800`, `bg-white dark:bg-gray-700`, `text-sm font-semibold`, `accessibilityRole="tablist"`, `accessibilityRole="tab"`, `hitSlop`)
- `app/app/(app)/exercise/[exerciseId]/chart.tsx` — CREATED (428 lines; 25/25 acceptance grep checks PASS including `useExerciseChartQuery`, `useExerciseTopSetsQuery`, `useChartPressState`, `CartesianChart`, `RoundedRect`, `SkiaText`, `useDerivedValue`, `router.push(\`/history/\${row.session_id}\``, `kg × \${row.reps}`, `Inga pass än för den här övningen`, `Inga pass i detta intervall`, `Byt till All för att se hela historiken.`, `[chartQuery.data]` EXACT, `Logga minst 2 set`, `Logga ett pass till`, `Senaste 10 passen`, `{ x: 0, y: { y: 0 } }`, `xKey="x"`, `yKeys={["y"]}`, `height: 240`, `SegmentedControl`, `formatXLabel`, `locale: sv`, `useState<ChartWindow>("3M")`, deviation note; 0 Modal imports)
- `app/app/(app)/plans/[id].tsx` — MODIFIED (846 lines; contains `stats-chart`, `onShowChart`, `/exercise/${planExercise.exercise_id}/chart`, `accessibilityHint="Tryck för att se progressionsgraf"`, `hitSlop={6}`)
- `app/scripts/manual-test-phase-06-uat.md` — MODIFIED (334 lines, ≥90 minimum; 7 F10 sections + all Plan 06-01b + 06-02 sections preserved; `Inga pass i detta intervall`, `Byt till All`, `kg × \${reps}`, `Tap any row` all present)
- Commit hashes FOUND in `git log --oneline`: `419e6de`, `1ae1a75`, `25911d4`, `e7a83e4` (all tagged `[FIT-65]`)
- Verification gates: `npx tsc --noEmit` exits 0; `npx expo lint` exits 0 (0 errors, 0 warnings); `npm run test:rls` ALL ASSERTIONS PASSED (45); `npm run test:exercise-chart` ALL ASSERTIONS PASSED (13)
- Service-role audit clean: no `service_role` or `SERVICE_ROLE` import in any modified file in `app/lib/**` / `app/app/**` / `app/components/**`

## Next Phase Readiness

- **F10 closes end-to-end on the user-visible slice.** Combined with Plan 06-01a's DB-tier RPCs + Wave 0 harness + Plan 06-01b's history-list + Plan 06-02's session-detail, F10 satisfies ROADMAP success criteria #3 (chart via `<CartesianChart>` with memoized data) explicitly. The two-state empty rendering, the Skia tooltip on tap-and-hold, and the dual-RPC top-sets list all map to PRD §F10 + §5.5 requirements.
- **All three BLOCKERS closed end-to-end** — BLOCKER-1 (Skia tooltip, `chart.tsx` lines 256-268 + ChartPressCallout 340-408), BLOCKER-2 (tappable Senaste 10 rows with reps via dedicated RPC, `chart.tsx` 295-330), BLOCKER-3 (two-state empty disambiguation via second `useExerciseChartQuery(id, metric, 'All')`, `chart.tsx` 174-196).
- **All four WARNs closed** — WARN-5 (chart-icon position acknowledged + committed per JSX contract; prose-patch tracked as paperwork), WARN-6 (`hitSlop={6}` on the new Pressable, NOT 4), WARN-7 (useMemo dep array EXACTLY `[chartQuery.data]`, grep-verified), WARN-9 (chart.tsx 428 lines ≥150 min_lines).
- **Phase 6 ready for closing gates.** Recommended next step: `/gsd-secure-phase 6` (audit threat register T-06-* against the four plans' implementations + write `06-SECURITY.md` with `threats_open: 0`) + `/gsd-verify-work 6` (consume the manual UAT markdown for sign-off + ROADMAP success criteria check) + `/gsd-code-review 6` (service-role isolation gate, untyped client gate, unsafe SQL gate — all already green from the test:rls + lint runs but the formal review writes the closing artifact).
- **Threat register (06-03 scope):** T-06-02 covered by Plan 06-01a test-rls Phase 6 extension (the 5 cross-user assertions including the chart + top-sets RPCs), T-06-04 covered by the two-state empty-state rendering (spoofed exercise-id → RLS returns empty → empty-state surfaces), T-06-05 covered by Zod literal union types on metric/window + Postgres CASE WHEN in the RPC body, T-06-07/08/09 inherited.
- **V1.1 carry-over:** workout-hot-path chart-icon (mid-pass tap for trend) DEFERRED per D-28 (bryter Phase 5 ≤3s SLA-spirit). `<SegmentedControl>` primitive shipped and available for F15 manual dark-mode toggle in Phase 7. Chart-key invalidation on `['set','add']` deliberately NOT added — defer to V1.1 if soak surfaces "chart is stale after logging".

---
*Phase: 06-history-read-side-polish*
*Plan: 03*
*Completed: 2026-05-15*
