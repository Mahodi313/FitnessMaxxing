---
status: complete
phase: 12-history-detail-chart-home-dashboard
source: [12-VERIFICATION.md human_verification, 12-01..08-SUMMARY.md]
started: 2026-06-13T21:26:27Z
updated: 2026-06-13T22:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Activity Ring Fill Animation (MOTN-02 / DASH-01)
expected: Open Planer tab — the ring animates its fill 0→(sessions/goal) with a spring on mount; at >100% a second-lap arc + faint glow appears.
result: issue
reported: "when I ended a pass it didn't count up, but when I started a new pass again it counted for both of them — so it only updates when I start a second pass"
severity: major
note: Data-freshness bug (DASH-01/DASH-05), not the animation itself. Finishing a session does not invalidate the dashboard-summary query, so sessions-this-week / the ring fill stay stale until a later refetch trigger (starting a new session) fires.

### 2. Sparkline Draw-in on History (MOTN-02 / DASH-03 / DASH-04)
expected: Open Historik tab — the weekly-volume card shows a big volume numeral + "+N%" delta chip (when prior week has data), and the Sparkline stroke reveals left→right on mount with the last-point dot fading in shortly after.
result: pass
note: Volume numeral renders (24736 lb). Delta chip correctly absent — user confirmed no prior-week training, so no baseline → success-only chip suppressed per D-05 (expected).

### 3. Chart Line Draw-on-Mount (MOTN-03)
expected: Open any exercise's chart (via History row or Plan detail) — the chart line + dots draw/reveal left→right on mount rather than appearing all at once.
result: issue
reported: "Where? (cannot find any way to open an exercise chart)"
severity: major
note: REGRESSION. The exercise chart route /exercise/[exerciseId]/chart has NO navigation entry point anywhere in the app. Phase 6 (57d792e) made each session-detail ExerciseCard header a Pressable cross-link to the chart (line 322); the Phase 12-07 re-skin (d7711f3) removed that link and left a self-contradictory comment ("chart route is reached from the chart screen per the Phase-12 IA"). No replacement was wired. The chart screen (fully re-skinned in 12-08) and the MOTN-03 draw-on-mount are unreachable → the animation cannot be observed. This blocks test 3 and partially blocks test 4 (chart-line portion).

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
expected: Toggle lbs in Settings, then check History volume card, Session Detail stat grid, and Chart hero + y-axis + Senaste-10 list — every weight/volume figure shows in lb consistently (no mixed kg/lb screen). Toggling back to kg converts everything immediately.
result: issue
reported: "man måste byta till kg och sedan restarta" (changing the unit only takes effect after an app restart — figures do not convert immediately)
severity: minor
note: Conversion VALUES are correct (lb display verified consistent in test 2 + screenshots), but the unit-pref change is not reactive — already-rendered screens keep the old unit until the app is restarted (or the query/screen remounts). Same root-cause family as test 1: a state/pref change does not invalidate/re-render the consuming screens. Likely the async getPref result is cached and not subscribed to, so formatWeight/formatVolume re-run only on remount. Expected: immediate conversion on toggle.

## Summary

total: 7
passed: 4
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Finishing a workout session immediately updates the Home activity ring / sessions-this-week count"
  status: failed
  reason: "User reported: when I ended a pass it didn't count up, but when I started a new pass again it counted for both — so it only updates when I start a second pass"
  severity: major
  test: 1
  root_cause: "Likely missing queryClient.invalidateQueries(dashboardKeys) on session finish — dashboard query keeps stale cache until another refetch trigger (starting a new session) fires"
  artifacts: []
  missing:
    - "Invalidate dashboardKeys (and history volume) in the session-finish mutation so the Home ring/count refreshes immediately"
  debug_session: ""
  linear: FIT-109

- truth: "The user can open an exercise's progress chart from the UI"
  status: failed
  reason: "User reported: Where? — could not find any way to reach the chart. Confirmed: /exercise/[exerciseId]/chart has no navigation entry point. Phase 6 linked it from session-detail ExerciseCard headers (57d792e:322); Phase 12-07 re-skin (d7711f3) removed the link and wired no replacement."
  severity: major
  test: 3
  root_cause: "Phase 12-07 session-detail re-skin dropped the ExerciseCard→chart Pressable cross-link; no other screen pushes the route → orphaned screen (regression)"
  artifacts:
    - path: "app/app/(app)/history/[sessionId].tsx"
      issue: "ExerciseCard breakdown is informational-only; the Phase-6 chart cross-link (router.push(`/exercise/${exerciseId}/chart`)) was removed in the re-skin (comment at L757-759)"
  missing:
    - "Restore a navigation entry point to /exercise/[exerciseId]/chart — e.g. re-add the tappable ExerciseCard header in session-detail, or add a chart link from an appropriate Phase-12 IA surface"
  debug_session: ""
  linear: FIT-110

- truth: "Changing the weight unit (kg↔lbs) in Settings immediately re-renders all displayed figures"
  status: failed
  reason: "User reported: man måste byta till kg och sedan restarta — the unit change only takes effect after an app restart; figures do not convert immediately"
  severity: minor
  test: 7
  root_cause: "Unit pref is read async and cached without a reactive subscription; consuming screens (History card, Session Detail, Chart) only re-run formatWeight/formatVolume on remount, so a live toggle doesn't update them until restart. Same reactivity-gap family as test 1."
  artifacts: []
  missing:
    - "Make the unit preference reactive — expose it via a store/query the screens subscribe to (or invalidate/refetch the consuming queries on pref change) so a toggle re-renders figures immediately"
  debug_session: ""
  linear: FIT-111
