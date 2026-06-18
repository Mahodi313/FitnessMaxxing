---
phase: 12-history-detail-chart-home-dashboard
plan: 04
subsystem: api
tags: [tanstack-query, zod, supabase-rpc, offline-first, react-query-keys, expo-localization]

# Dependency graph
requires:
  - phase: 12-01
    provides: get_dashboard_summary + get_exercise_summary RPCs (migration 0011) + regenerated database.ts return types
  - phase: 06
    provides: exercise-chart.ts hook idiom (supabase.rpc → Zod parse → since-cast) + exerciseChartKeys/exerciseTopSetsKeys 5-state factories
  - phase: 05
    provides: sessions.ts offline-first/enabled/z.coerce.number() hook pattern
provides:
  - useDashboardSummaryQuery + DashboardSummarySchema (offline-first Home/History/lifetime data layer)
  - useExerciseSummaryQuery + ExerciseSummarySchema (chart hero + 3-stat row)
  - 3-state ChartRange ("30d" | "90d" | "All") + exported rangeToSince
  - additive dashboardKeys + exerciseSummaryKeys query-key factories
affects: [12-05, 12-06, 12-07, 12-08, home-dashboard, chart-detail, history-card]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive query-key factories (D-24): new read-side surfaces get brand-new cache slots; existing 5-state window factories never widened/mutated"
    - "Offline-first hook by inheritance: omit networkMode so the single PersistQueryClientProvider hydrates the new slot for free (D-03)"
    - "3-state ChartRange added alongside the v1 5-state ChartWindow without conflation; rangeToSince via date-fns subDays mirrors windowToSince"

key-files:
  created:
    - app/lib/queries/dashboard.ts
  modified:
    - app/lib/query/keys.ts
    - app/lib/queries/exercise-chart.ts

key-decisions:
  - "rangeToSince exported (unlike v1 windowToSince) to satisfy the 12-04 acceptance contract — chart-detail screen can reuse the since-resolution for x-axis range labels"
  - "useExerciseSummaryQuery returns ExerciseSummary | null (empty range → no rows → null) so the chart screen can render an empty state"

patterns-established:
  - "D-24 additive-only: import statements expanded multiline but no existing factory body, ChartWindow union, or windowToSince logic altered"
  - "Zod boundary parse on both new RPC hooks (T-12-08); z.coerce.number() on every numeric field for PostgREST string serialization; avg_rpe nullable; weekly_volume_series jsonb → typed array"

requirements-completed: [DASH-05, DASH-01, DASH-02, DASH-03, DASH-04, SKIN-06]

# Metrics
duration: ~12min
completed: 2026-06-13
---

# Phase 12 Plan 04: Wave-3 Query Layer Summary

**Offline-first useDashboardSummaryQuery + chart-summary useExerciseSummaryQuery with a new 3-state ChartRange, both Zod-parsed at the RPC wire boundary and wired through additive query-key factories that leave the v1 5-state factories byte-unchanged (D-24).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-13T17:00:11Z
- **Completed:** 2026-06-13
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `useDashboardSummaryQuery` reads `get_dashboard_summary` with the device IANA `p_tz`, parses the single 8-field row (incl. `weekly_volume_series` jsonb → typed array) with Zod, and is offline-first by inheritance — the persister hydrates `dashboardKeys.summary()` for free (D-03).
- New 3-state `ChartRange` ("30d" | "90d" | "All", default 90d) + exported `rangeToSince` (date-fns `subDays`) added WITHOUT touching the v1 5-state `ChartWindow` union or `windowToSince` (D-11/D-24).
- `useExerciseSummaryQuery(exerciseId, metric, range)` reads `get_exercise_summary` for the chart hero (`current_best` + `range_first_value`) and 3-stat row (top set / volume-per-session / nullable `avg_rpe`) — D-12/D-14.
- Two additive key factories (`dashboardKeys`, `exerciseSummaryKeys`); the Phase 6 `exerciseChartKeys`/`exerciseTopSetsKeys` factories are untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dashboardKeys + exerciseSummaryKeys factories (additive)** - `7648d97` (feat)
2. **Task 2: Create useDashboardSummaryQuery hook (offline-first, Zod-parsed)** - `05349ca` (feat)
3. **Task 3: Add useExerciseSummaryQuery + ChartRange + rangeToSince** - `179b7cc` (feat)

## Files Created/Modified
- `app/lib/queries/dashboard.ts` (created) - `DashboardSummarySchema` + `useDashboardSummaryQuery`; offline-first single-row aggregate hook for Home hero / History card / lifetime eyebrow.
- `app/lib/query/keys.ts` (modified) - added `dashboardKeys` (all + summary) and `exerciseSummaryKeys` (all + byExercise keyed on 3-state range).
- `app/lib/queries/exercise-chart.ts` (modified) - added `ChartRange`, exported `rangeToSince`, `ExerciseSummarySchema`, `useExerciseSummaryQuery`; v1 `ChartWindow`/`windowToSince` left intact.

## Decisions Made
- **rangeToSince exported** (the v1 `windowToSince` is module-private) — the 12-04 acceptance criteria explicitly list `rangeToSince` among the file's exports so the chart-detail screen can reuse since-resolution for x-axis range labels. Harmless additive export; no v1 surface changed.
- **useExerciseSummaryQuery returns `ExerciseSummary | null`** — an exercise with no sets in the selected range yields no RPC rows; returning `null` lets the screen render its empty state rather than throwing a Zod parse error on `undefined`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported rangeToSince to satisfy the acceptance contract**
- **Found during:** Task 3 (useExerciseSummaryQuery)
- **Issue:** The plan `<action>` described `function rangeToSince` (module-private, mirroring v1 `windowToSince`), but acceptance criteria line 140 lists `rangeToSince` among the file's required exports. Left private, the criterion would fail.
- **Fix:** Added the `export` keyword to `rangeToSince` with an inline comment noting why it diverges from the private `windowToSince`.
- **Files modified:** app/lib/queries/exercise-chart.ts
- **Verification:** `tsc --noEmit` exits 0; `grep -q "rangeToSince"` passes.
- **Committed in:** `179b7cc` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — export visibility to match the stated contract)
**Impact on plan:** Additive export only; no v1 factory/union/logic altered. D-24 holds. No scope creep.

## Issues Encountered
None. All three changes were additive; the only friction was the `windowToSince`-private vs `rangeToSince`-exported contract mismatch, resolved as above.

## D-24 Compliance (existing-surface preservation)
- `git diff` of the plan range shows the only removed lines in the two modified files are import statements (re-added multiline with the new symbols). No `exerciseChartKeys`/`exerciseTopSetsKeys` body, `ChartWindow` union, or `windowToSince` logic was changed.
- No mutation defaults, persister scope, or `exercise_sets` behavior touched — F13 hot path untouched (T-12-10).

## Threat-Model Notes
- **T-12-08 (Tampering, RPC wire shape):** mitigated — `DashboardSummarySchema.parse` and `ExerciseSummarySchema.parse` at both hook boundaries; `z.coerce.number()` on all numerics for PostgREST string serialization; `avg_rpe` nullable; `weekly_volume_series` parsed as `array({week, volume_kg})`.
- **T-12-09 (Information Disclosure):** mitigated by inheritance — both RPCs are SECURITY INVOKER (12-01); client never aggregates across users.
- **T-12-10 (Tampering/DoS via shared query infra):** mitigated — new read-only slots only; no existing keys/persister/mutation defaults touched.
- **T-12-SC (npm installs):** no packages installed.

## Next Phase Readiness
- Wave-3 screens (12-05..08) can now import typed hooks instead of raw `supabase.rpc` calls: `useDashboardSummaryQuery()` for Home/History/lifetime, `useExerciseSummaryQuery(exerciseId, metric, range)` + `ChartRange` for the chart detail.
- Screen-side contracts to honor: skeleton gate = `isPending && data === undefined` (empty cache); all-zero dashboard row = new-user state (D-04); the chart screen owns the `ChartRange` selector state (default `"90d"`).
- No blockers.

## Self-Check: PASSED
- FOUND: app/lib/queries/dashboard.ts
- FOUND commit 7648d97 (Task 1)
- FOUND commit 05349ca (Task 2)
- FOUND commit 179b7cc (Task 3)

---
*Phase: 12-history-detail-chart-home-dashboard*
*Completed: 2026-06-13*
