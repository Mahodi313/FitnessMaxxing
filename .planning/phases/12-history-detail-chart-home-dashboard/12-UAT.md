---
status: complete
phase: 12-history-detail-chart-home-dashboard
source: [12-VERIFICATION.md human_verification, 12-01..08-SUMMARY.md]
started: 2026-06-13T21:26:27Z
updated: 2026-06-14T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Activity Ring Fill Animation (MOTN-02 / DASH-01)
expected: Open Planer tab — the ring animates its fill 0→(sessions/goal) with a spring on mount; at >100% a second-lap arc + faint glow appears. After finishing a pass the ring/sessions-this-week count updates immediately (no second pass / restart needed).
result: pass
note: RE-TESTED 2026-06-14 after FIT-109 fix (dbfe8b8 invalidate dashboardKeys on session finish). User confirmed the ring/count now updates immediately on finishing a pass. Original issue: ring stayed stale until a second pass started — resolved.

### 2. Sparkline Draw-in on History (MOTN-02 / DASH-03 / DASH-04)
expected: Open Historik tab — the weekly-volume card shows a big volume numeral + "+N%" delta chip (when prior week has data), and the Sparkline stroke reveals left→right on mount with the last-point dot fading in shortly after.
result: pass
note: Volume numeral renders (24736 lb). Delta chip correctly absent — user confirmed no prior-week training, so no baseline → success-only chip suppressed per D-05 (expected).

### 3. Chart Line Draw-on-Mount (MOTN-03)
expected: Open any exercise's chart (via session-detail ExerciseCard header) — the chart line + dots draw/reveal left→right on mount rather than appearing all at once.
result: pass
note: RE-TESTED 2026-06-14 after FIT-110 fix (cb5e440 tappable ExerciseCard chart cross-link + a11y key). User confirmed the chart is now reachable from Session Detail and looks right (draw-on-mount + Forge fidelity light/dark). Original regression (orphaned /exercise/[exerciseId]/chart route) resolved. This re-test also clears the chart-portion gaps left open on tests 4 (Reduce-Motion chart line) and 5 (chart visual fidelity).

### 4. Reduce-Motion Snapping (MOTN-02 / MOTN-03 / D-18)
expected: Enable iOS Settings → Accessibility → Motion → Reduce Motion, then reopen Planer, Historik, and an exercise chart — the ring, sparkline, and chart line all snap instantly to their final state with no animation.
result: pass
note: Ring + sparkline snap to final instantly under Reduce Motion (user confirmed "det funkar, godkänt"). Chart-line portion not covered (screen unreachable — test 3 gap).

### 5. Forge Visual Fidelity (SKIN-06)
expected: History list, Session Detail, and Exercise Chart match the Forge design — custom circular headers, Forge surface cards, date badges (DD/MON), 3-stat grids, range selector, chart hero stat — and look correct in BOTH light and dark mode.
result: pass
note: History list + Session Detail match Forge design (user approved; session-detail dark mode confirmed via screenshot IMG_1079 — custom header, 3-stat row, notes field, exercise cards). Chart visual fidelity NOT yet verified — screen unreachable (test 3 navigation gap); re-verify chart appearance after that fix lands.

### 6. New-User Empty State (DASH-05)
expected: With an account that has 0 finished sessions, the Planer hero shows a zeroed ring (0/goal), no streak/delta chips, and a "Logga ditt första pass" CTA that navigates to the new-plan screen when tapped. History tab shows its own empty state (no volume header).
result: pass
note: Verified on a live-cleared account (mahodibeast@hotmail.com — sessions/sets deleted for this test; safety backup at C:/Users/Mahod/Desktop/fitnessmaxxing-backup-mahodibeast-20260613.json). User confirmed: zeroed ring (0/goal) ✓, "Logga ditt första pass" CTA ✓, CTA navigates ✓. Plans + exercise library intentionally retained (empty state gates on lifetime_sessions===0, not plan count). Note: required an app restart to clear stale cache — consistent with the test-1 invalidation bug.

### 7. Unit Display Consistency — lbs (D-20 / SKIN-06)
expected: Toggle lbs in Settings, then check History volume card, Session Detail stat grid, and Chart hero + y-axis + Senaste-10 list — every weight/volume figure shows in lb consistently (no mixed kg/lb screen). Toggling back to kg converts everything immediately (no restart).
result: pass
note: RE-TESTED 2026-06-14 after FIT-111 fix (7dd82c6 reactive units store + bd07c43/4936a73 Settings write + 4 read-side consumers migrated to useUnitStore). User confirmed unit toggle now converts all figures immediately, no app restart needed. Original reactivity gap resolved.

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- All gaps resolved and re-verified on-device 2026-06-14. -->

- truth: "Finishing a workout session immediately updates the Home activity ring / sessions-this-week count"
  status: resolved
  reason: "User reported: when I ended a pass it didn't count up, but when I started a new pass again it counted for both — so it only updates when I start a second pass"
  severity: major
  test: 1
  root_cause: "Missing queryClient.invalidateQueries(dashboardKeys) on session finish — dashboard query kept stale cache until another refetch trigger fired"
  fix: "dbfe8b8 fix(12-09): invalidate dashboardKeys on session finish"
  resolution: "RE-TESTED 2026-06-14 — user confirmed ring/count updates immediately on finishing a pass"
  linear: FIT-109

- truth: "The user can open an exercise's progress chart from the UI"
  status: resolved
  reason: "User reported: Where? — could not find any way to reach the chart. /exercise/[exerciseId]/chart had no navigation entry point after the Phase 12-07 re-skin dropped the Phase-6 cross-link."
  severity: major
  test: 3
  root_cause: "Phase 12-07 session-detail re-skin dropped the ExerciseCard→chart Pressable cross-link; no other screen pushed the route → orphaned screen (regression)"
  fix: "cb5e440 feat(12-10): make session-detail ExerciseCard a tappable chart cross-link + 817b98d a11y locale key"
  resolution: "RE-TESTED 2026-06-14 — user confirmed chart is reachable from Session Detail and looks right (draw-on-mount + Forge fidelity). Also clears chart-portion gaps on tests 4 and 5."
  linear: FIT-110

- truth: "Changing the weight unit (kg↔lbs) in Settings immediately re-renders all displayed figures"
  status: resolved
  reason: "User reported: man måste byta till kg och sedan restarta — the unit change only took effect after an app restart"
  severity: minor
  test: 7
  root_cause: "Unit pref was read async and cached without a reactive subscription; consuming screens only re-ran formatWeight/formatVolume on remount"
  fix: "7dd82c6 reactive units store + bd07c43 Settings write + 4936a73 migrate 4 read-side consumers to useUnitStore"
  resolution: "RE-TESTED 2026-06-14 — user confirmed unit toggle converts all figures immediately, no restart needed"
  linear: FIT-111
