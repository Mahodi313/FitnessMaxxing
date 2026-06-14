---
phase: 12-history-detail-chart-home-dashboard
plan: 10
subsystem: ui
tags: [expo-router, react-native, navigation, i18n, react-i18next, nativewind, accessibility]

# Dependency graph
requires:
  - phase: 12-history-detail-chart-home-dashboard (12-07)
    provides: FSessionDetail re-skin (D-15 hybrid ExerciseCard, D-17 custom header) — the surface this gap plan re-wires
  - phase: 12-history-detail-chart-home-dashboard (12-08)
    provides: FChart re-skin + MOTN-03 line draw-on-mount — the orphaned route this restores access to
  - phase: 06-history-read-side
    provides: original Phase-6 ExerciseCard cross-link semantics (router.push /exercise/[exerciseId]/chart)
provides:
  - Session-detail ExerciseCard is once again a tappable cross-link to /exercise/[exerciseId]/chart
  - The exercise chart screen (and its MOTN-03 draw-on-mount) is reachable from the UI again
  - viewExerciseChart a11y locale key (sv+en) with {{exercise}} interpolation
affects: [phase-12 UAT re-run (test 3 chart draw, test 4 reduce-motion chart, test 5 chart fidelity), phase-13 PR/e1RM chart hero]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Re-introduce a navigation affordance on an existing Forge card WITHOUT reverting the re-skin: View -> Pressable keeping the SAME className box-decoration, pressed-opacity via style() callback only (NativeWind box-decoration-via-className learning honored)"

key-files:
  created: []
  modified:
    - "app/app/(app)/history/[sessionId].tsx — ExerciseCard View->Pressable + exerciseId/onPress props + chevronRight affordance; call site router.push; stale comment replaced"
    - "app/locales/en.json — +viewExerciseChart"
    - "app/locales/sv.json — +viewExerciseChart"

key-decisions:
  - "D-15 honored: made the EXISTING hybrid card Pressable (frame + max-weight stat + per-set list preserved) rather than reverting to the Phase-6 grey card"
  - "D-17 honored: chart entry lives on the breakdown card; the custom Forge header was NOT reverted to a native headerRight button"
  - "D-21 honored: a11y label is a new sv+en flat key (viewExerciseChart) routed through t() with {{exercise}} interpolation"
  - "chevronRight affordance composed to the RIGHT of the max-weight stat column (small gap) — the regression's root harm was an invisible affordance; chevron matches the Forge history-row convention"

patterns-established:
  - "Pressable card with a trailing chevronRight cue is the Forge convention for 'this row/card opens another screen' (matches history.tsx rows)"

requirements-completed: [SKIN-06, MOTN-03]

# Metrics
duration: ~8min
completed: 2026-06-14
---

# Phase 12 Plan 10: Session-detail → Chart cross-link restore (FIT-110) Summary

**Re-introduced the orphaned `/exercise/[exerciseId]/chart` navigation entry point by making the re-skinned Forge ExerciseCard a Pressable with a visible chevron cue — without reverting the 12-07 re-skin (D-15/D-17 intact).**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-06-14
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Restored the session-detail → exercise-chart navigation that the 12-07 re-skin dropped (regression FIT-110), which had left the fully-built + 12-08-re-skinned chart screen and its MOTN-03 draw-on-mount animation completely unreachable from the UI.
- `ExerciseCard` root changed `<View>` → `<Pressable>` with the **byte-identical Forge className box-decoration** preserved (no naked re-skin); pressed feedback via the `style={({ pressed }) => ...}` opacity-only callback exception.
- Added a `chevronRight` Icon affordance to the right of the max-weight stat column so the card visibly signals it is tappable (the regression's root harm was an invisible affordance).
- Replaced the now-false stale "informational only" comment block (L757-759) with a FIT-110 restore note.
- New `viewExerciseChart` flat locale key in both sv + en with `{{exercise}}` interpolation, routed through `t()` for the card's `accessibilityLabel`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make ExerciseCard a tappable chart cross-link** - `cb5e440` (feat)
2. **Task 2: Add the chart-link a11y locale key (sv + en parity)** - `817b98d` (feat)

## Files Created/Modified
- `app/app/(app)/history/[sessionId].tsx` - ExerciseCard is now a Pressable accepting `exerciseId` + `onPress`; chevronRight affordance added; call site passes `exerciseId` and `onPress={() => router.push(\`/exercise/${exerciseId}/chart\` as Href)}`; stale comment replaced with FIT-110 note.
- `app/locales/en.json` - Added `viewExerciseChart: "View progress chart for {{exercise}}"`.
- `app/locales/sv.json` - Added `viewExerciseChart: "Visa progressionsgraf för {{exercise}}"`.

## Decisions Made
- Composed the chevron as a sibling to the existing right-aligned stat column (wrapped both in a `flex-row items-center`) rather than crowding the max-weight stat — cleanest way to add the cue while keeping the D-15 stat layout intact.
- Kept the `as Href` cast on the route literal (Phase 4-02 precedent): `experiments.typedRoutes` does not regenerate `router.d.ts` during `tsc --noEmit`, so a bare literal can trip the gate on a cross-route reference. `Href` was already imported (12-07 left it in scope), so no import change was needed. tsc passed with the cast.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `exerciseId` prop unused by the component body**
- **Found during:** Task 1 (ExerciseCard signature change)
- **Issue:** The plan specifies an `exerciseId: string` prop, but the navigation is wired at the call site via `onPress` (where `router` is in scope), so the component body never reads `exerciseId`. An unused destructured prop would trip `expo lint` (no-unused-vars) and block the verify gate.
- **Fix:** Added an explicit `void exerciseId;` with a comment noting it carries the a11y/navigation context; the prop stays on the public signature per the plan's must_haves contract (`ExerciseCard accepts an exerciseId prop`).
- **Files modified:** app/app/(app)/history/[sessionId].tsx
- **Verification:** `npx expo lint` exits 0 with no warnings.
- **Committed in:** cb5e440 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal. The `void exerciseId;` satisfies both the plan's prop-contract and the lint gate; no scope creep. The plan's stated locale key count ("213/214") was a source miscount — the live files are at 190 → 191; the parity script asserts equality not an absolute count, so it passes. The chart route literal kept the `as Href` cast (plan allowed it as a fallback); `Href` was already imported by 12-07 so no import deviation.

## Issues Encountered
None — both gates (tsc + expo lint) clean on first run after the edits.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The chart route is reachable again from session-detail → unblocks the phase-12 UAT re-run for test 3 (chart line draw-on-mount), the chart portion of test 4 (reduce-motion), and test 5 (chart visual fidelity).
- Device re-test required: open a session detail → tap an exercise card → confirm the chart screen opens and the line draws left→right on mount (MOTN-03).
- F13 hot path untouched (read-side nav-only change); no mutation/queue/persister touched (D-24 spirit preserved).

## Self-Check: PASSED

- FOUND: `.planning/phases/12-history-detail-chart-home-dashboard/12-10-SUMMARY.md`
- FOUND commit cb5e440 (Task 1)
- FOUND commit 817b98d (Task 2)
- FOUND route literal `exercise/${exerciseId}/chart` in `[sessionId].tsx`

---
*Phase: 12-history-detail-chart-home-dashboard*
*Completed: 2026-06-14*
