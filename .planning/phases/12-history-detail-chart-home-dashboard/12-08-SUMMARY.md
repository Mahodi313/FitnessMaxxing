---
phase: 12-history-detail-chart-home-dashboard
plan: 08
subsystem: chart-detail
tags: [re-skin, forge, victory-native-xl, skia, reanimated, i18n, units, motion]

# Dependency graph
requires:
  - phase: 12-02
    provides: toDisplayVolume/formatVolume units helpers + full phase-12 sv/en locale set
  - phase: 12-04
    provides: useExerciseSummaryQuery + ChartRange + rangeToSince (3-state, default 90d) + ExerciseSummary schema
  - phase: 06
    provides: chart.tsx vertical slice (matchFont FIT-67, tooltip worklet mirror, Senaste-10 routing, memo contract)
  - phase: 09
    provides: SegmentedControl Forge component + getPref fm:units idiom
provides:
  - FChart re-skinned exercise-chart screen (custom header + 3-state range + current-best hero + 3-stat row + draw-on-mount)
affects: [chart-detail, exercise-progression]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reanimated→Skia <Group clip> draw-on-mount for the Victory line (re-fires on chartQuery.data identity per the memo contract; snaps under useReducedMotion)"
    - "D-24 bridge rangeAsWindow: maps the new 3-state ChartRange onto the v1 5-state ChartWindow month buckets (30d→1M / 90d→3M / All→All) so the line/top-sets hooks drive off the new selector WITHOUT widening the v1 factory unions"
    - "Forge token-hex split (TOKENS map) for the Skia canvas (CartesianChart/tooltip) + Icon strokes; class-driven surfaces use forge-* tokens"

key-files:
  created: []
  modified:
    - app/app/(app)/exercise/[exerciseId]/chart.tsx
    - app/locales/sv.json
    - app/locales/en.json

key-decisions:
  - "rangeAsWindow D-24 bridge — the line/top-sets queries stay on the v1 ChartWindow factories (no union widening); the hero/stats use the additive get_exercise_summary RPC with the exact rangeToSince day-boundary. The line's month-bucket since differs from the summary's day-bucket since by a few days — visually indistinguishable on the trend; hero/stat figures are exact."
  - "Chart-screen ellipsis is a design-symmetric header control with no menu (the chart is read-only — no destructive action) — kept to match the locked FChart header + FLAG-1 a11y on both header buttons."
  - "Hero range-delta chip is success-only/up-only (informational): weight = absolute +kg via formatWeight; volume = +% via volumeDeltaPct; returns null on a non-positive delta (no red, parity with the History volume card D-05)."

requirements-completed: [SKIN-06, MOTN-03]

# Metrics
duration: ~20min
completed: 2026-06-13
---

# Phase 12 Plan 08: Exercise Chart Re-skin (FChart) Summary

**Re-skinned the exercise chart to the Forge FChart contract — custom in-content header (D-17), preserved metric toggle (D-10) + a new 3-state range selector (D-11, default 90d), a real current-best + range-delta hero from `useExerciseSummaryQuery` (D-12, NOT e1RM), a 3-stat row + the preserved Senaste-10 routing (D-14), and a Reanimated→Skia draw-on-mount line (MOTN-03) — with the FIT-67 matchFont fix, the memo contract, the tooltip SharedValue mirror, and the BLOCKER-2 source-session routing preserved verbatim.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-06-13
- **Tasks:** 2 (1 re-skin + 1 F13 gate)
- **Files modified:** 3 (chart.tsx + sv.json + en.json)

## Accomplishments

- **D-17 custom header:** `headerShown: false` + an in-content Forge header — 40px circular back (`chevronLeft`) + 40px circular ellipsis, both with `accessibilityLabel` via `t('back')` / `t('moreOptions')`, `accessibilityRole="button"`, and 44px hit-slop (FLAG-1). The chart is read-only, so the ellipsis is a design-symmetric control with no menu.
- **D-11 3-state range:** the v1 5-state `WINDOW_OPTIONS` (1M/3M/6M/1Y/All) is gone, replaced by the 3-state `ChartRange` (30d / 90d-default / All). Default state is `"90d"` (was `"3M"`). The summary/hero/stats route through `rangeToSince`; the line + top-sets queries bridge through `rangeAsWindow` to keep the v1 `ChartWindow` factories untouched (D-24).
- **D-12 hero:** a 52px display numeral = the active-metric `current_best` from `useExerciseSummaryQuery(exerciseId, metric, range)` + a `forge-success`-tinted range-delta chip (weight = absolute `+kg`, volume = `+%`). Real data, NOT "Estimerat 1RM" — D-13 e1RM framing omitted.
- **D-10 metric toggle:** preserved as the Forge `SegmentedControl` (Max vikt / Total volym); selected segment = `surface3` (neutral, not accent).
- **D-14 3-stat row:** `FChartStat` cards (Tungaste set `{w} × {r}` / Volym-pass / Snitt RPE) from the summary RPC; renders `–` when `avg_rpe` is null. The Senaste-10 list is preserved with its tap-to-source-session routing.
- **MOTN-03 draw-on-mount:** the Victory `Line` + `Scatter` render inside a `<Group clip={drawClip}>` whose width tweens 0→full via a `withSpring({damping:18, stiffness:220})` shared value. The effect re-fires on `chartData` identity change (the same identity gate as the memo contract) and snaps immediately under `useReducedMotion()`.
- **D-20 units:** the plotted line, y-axis ticks, hero numeral, 3-stat figures, tooltip strings, and the Senaste-10 `{w} × {r}` row all route through `formatWeight` / `formatVolume` / `toDisplayWeight` / `toDisplayVolume` — the v1 chart predated the units helper. **D-21:** all hardcoded Swedish moved to `t()`.
- **Skia re-skin:** the chart card is a `surface` Forge frame (radius 20); the Skia color props (`accent`, `gridColor`, `tooltipBg`) re-derive from `forge-*` hexes via a `TOKENS` map (NativeWind `dark:` classes don't apply inside the canvas).

## Preserved Verbatim (regression-critical)

- **matchFont FIT-67 fix** — `matchFont({ fontFamily: "Helvetica", fontSize: 12 })`; NEVER reverted to `useFont(null)` (returns null on Skia 2.x → invisible axis/tooltip).
- **Memo contract** — `chartData` dep array is EXACTLY `[chartQuery.data]` (Victory re-mounts on data identity).
- **Tooltip worklet → SharedValue mirror** — pre-format on JS thread, mirror into SharedValues via `useEffect`, worklet reads `.value` (Reanimated 4 doesn't re-capture closure vars in `useDerivedValue`).
- **Senaste-10 routing** — `router.push(`/history/${row.session_id}`)` (Phase 6 BLOCKER-2) + `useExerciseTopSetsQuery`.
- **`ChartPressCallout`** — the full RoundedRect + two SkiaText tooltip, position math unchanged (only the passed-in hexes are now forge-* derived).

## Task Commits

1. **Task 1: Chart re-skin (header + range + hero + stats + metric toggle + draw-on-mount)** — `b18be14` (feat)
2. **Task 2: F13 regression gate** — no file changes (verification-only); see "F13 Gate" below.

## Files Modified

- `app/app/(app)/exercise/[exerciseId]/chart.tsx` — full FChart re-skin; regression-critical internals preserved verbatim; +`rangeAsWindow` D-24 bridge + `computeDelta` + `FChartStat`.
- `app/locales/sv.json` / `app/locales/en.json` — 9 new chart keys (`currentBest`, `metricToggleA11y`, `rangeToggleA11y`, `noWorkoutsInRange`, `switchToAllRange`, `noWorkoutsForExercise`, `logTwoSetsTrend`, `logOneMoreTrend`, `openSession`) at sv/en parity (190 each).

## Decisions Made

- **`rangeAsWindow` D-24 bridge** — the line + top-sets hooks type against the v1 5-state `ChartWindow`; D-24 forbids widening those unions. The 3-state `ChartRange` ("30d"/"90d"/"All") has no `ChartWindow` overlap, so the selector maps onto the nearest month bucket (30d→1M, 90d→3M, All→All) for the line query while the hero/stats use the additive `get_exercise_summary` RPC with the exact `rangeToSince` day-boundary. Visual diff on the trend line is a couple of days at the left edge; hero/stat figures are exact.
- **Read-only ellipsis** — kept to match the locked symmetric FChart header (D-17) + carry the FLAG-1 a11y label; no overflow menu (the chart has no destructive action).
- **Success-only/up-only delta chip** — parity with the History volume card (D-05): a non-positive delta shows no chip (never red).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `rangeAsWindow` bridge for the v1 line/top-sets hooks**
- **Found during:** Task 1.
- **Issue:** The plan's `<action>` says to drive the range-parameterized line via the new `rangeToSince`, but `useExerciseChartQuery` / `useExerciseTopSetsQuery` type against the v1 5-state `ChartWindow` (D-24 forbids editing them), and `ChartRange`'s values don't satisfy that union. Passing a `ChartRange` directly fails tsc.
- **Fix:** Added a local `rangeAsWindow(range)` mapping 30d→1M / 90d→3M / All→All so the line/top-sets queries stay on their existing factories; the hero/stats use `useExerciseSummaryQuery` (which takes `ChartRange` natively). `rangeToSince` is imported (and `void`-referenced) to document the canonical 3-state since-boundary the summary hook uses.
- **Files modified:** app/app/(app)/exercise/[exerciseId]/chart.tsx.
- **Verification:** `tsc --noEmit` exits 0; the line still renders the range-scoped trend.
- **Committed in:** `b18be14`.

**2. [Rule 2 - Missing copy] Added 9 chart locale keys**
- **Found during:** Task 1.
- **Issue:** The phase-12 locale set (12-02) covered the dashboard/history/session-detail surfaces but not the chart-specific empty-states, the current-best eyebrow, the toggle a11y labels, or the Senaste-10 row a11y label.
- **Fix:** Added `currentBest`, `metricToggleA11y`, `rangeToggleA11y`, `noWorkoutsInRange`, `switchToAllRange`, `noWorkoutsForExercise`, `logTwoSetsTrend`, `logOneMoreTrend`, `openSession` to both locales (sv/en parity, 190 keys each).
- **Committed in:** `b18be14`.

**No `npm run typecheck` script** — used `tsc --noEmit` (project canonical; the plan's verify line referenced `npm run typecheck` which doesn't exist, same as 12-03..07).

**Total deviations:** 2 auto-fixed (1 blocking type bridge, 1 missing copy). No architectural changes. D-24 holds (no mutation/queryKey/persister/exercise_sets touched).

## F13 Gate (Task 2)

- **D-24 isolation confirmed:** `grep` of `chart.tsx` for `setMutationDefaults|useMutation|mutate(|persist|exercise_sets|addSet|invalidateQueries` → CLEAN. The re-skin is read-only (only `useQuery`-based hooks); it adds no new mutation defaults / query-key factories / persister scope and does not edit the v1 5-state factories.
- **`npm run test:f13-brutal` → exit 0.** The brutal test reported a **count-only** failure (`expected 25 exercise_sets, found 3`) on the most-recent session — this is the known **FIT-107** environmental fixture issue (the recent device session has 3 sets, not the 25-set brutal fixture). ALL set-integrity assertions PASS: set-number contiguity (1..3), all `set_type='working'`, valid `completed_at` timestamps, finish-UPDATE-after-all-INSERTs (FIFO replay correct), and no FK-out-of-order anomalies. Per the f13_note, a count-only failure with passing integrity assertions is NOT a code regression for read-side work — recorded and continued.

## Threat-Model Notes

- **T-12-17 (Information Disclosure — chart hero/stats aggregates):** mitigated — both `get_exercise_summary` and the chart RPCs are SECURITY INVOKER (12-01); the cross-user `test:rls` block proves no leak. The screen only renders RLS-scoped data; no client-side cross-user aggregation.
- **T-12-18 (Tampering/DoS — F13 hot path):** mitigated — read-only re-skin; Task 2 brutal gate run; only the additive get_exercise_summary key is consumed, the existing 5-state factories are untouched (D-24).
- **T-12-SC (npm installs):** no packages installed.

## Self-Check: PASSED
- FOUND: app/app/(app)/exercise/[exerciseId]/chart.tsx
- FOUND: app/locales/sv.json
- FOUND: app/locales/en.json
- FOUND commit b18be14 (Task 1)

---
*Phase: 12-history-detail-chart-home-dashboard*
*Completed: 2026-06-13*
