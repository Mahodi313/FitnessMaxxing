// app/lib/query/keys.ts
//
// Phase 4 D-01: Query-key factories for plans, exercises, plan_exercises.
// Hierarchical keys per TanStack v5 best-practice — invalidating ['plans']
// matches every list/detail key under it.
//
// Plan 02-04 import these factories rather than re-typing array literals.
// Reference: 04-RESEARCH.md §4 (Query-key strategy).

export const plansKeys = {
  all: ["plans"] as const,
  list: () => [...plansKeys.all, "list"] as const,
  detail: (id: string) => [...plansKeys.all, "detail", id] as const,
};

export const exercisesKeys = {
  all: ["exercises"] as const,
  list: () => [...exercisesKeys.all, "list"] as const,
};

export const planExercisesKeys = {
  all: ["plan-exercises"] as const,
  list: (planId: string) => [...planExercisesKeys.all, "list", planId] as const,
};

// ---------------------------------------------------------------------------
// Phase 5 — sessions + sets + last-value factories.
//
// sessionsKeys.active() is the load-bearing key for the draft-resume cold-
// start flow (CONTEXT.md D-21) and the persistent banner (D-22). It seeds
// useSessionQuery.initialData (Phase 4 Plan 04-04 UAT pattern, commit
// eca0540) so an offline-created session renders instantly on its detail
// route.
//
// setsKeys.list(sessionId) is the per-session set list cache that the
// optimistic onMutate for ['set','add'/'update'/'remove'] writes to.
//
// lastValueKeys.byExercise(exerciseId) drives the F7 "Förra: 82.5 × 8" chip
// per active set-row. Pre-fetched on workout-screen mount per CONTEXT.md
// D-20 (15-min staleTime) so the chips have data before the user starts
// logging. RESEARCH Open Q#2 (RESOLVED): the ['session','finish'] mutation
// invalidates lastValueKeys.all on onSettled so a back-to-back session
// surfaces the just-finished session's working sets without waiting for
// the 15-min staleTime.
// ---------------------------------------------------------------------------

export const sessionsKeys = {
  all: ["sessions"] as const,
  list: () => [...sessionsKeys.all, "list"] as const,
  detail: (id: string) => [...sessionsKeys.all, "detail", id] as const,
  active: () => [...sessionsKeys.all, "active"] as const,
  // Phase 6 — F9 cursor-paginated infinite list (06-CONTEXT.md D-03,
  // 06-RESEARCH §Pattern 1). Distinct from `list()` so the existing 30s
  // stale-time and any future single-page consumers stay isolated from the
  // useInfiniteQuery cache slot (which has a `{ pages, pageParams }`
  // envelope — see Pitfall 6 in 06-RESEARCH).
  listInfinite: () => [...sessionsKeys.all, "list-infinite"] as const,
};

export const setsKeys = {
  all: ["sets"] as const,
  list: (sessionId: string) => [...setsKeys.all, "list", sessionId] as const,
};

export const lastValueKeys = {
  all: ["last-value"] as const,
  byExercise: (exerciseId: string) =>
    [...lastValueKeys.all, "by-exercise", exerciseId] as const,
};

// ---------------------------------------------------------------------------
// Phase 6 — F10 per-exercise progressionsgraf cache slots.
//
// `exerciseChartKeys.byExercise(exerciseId, metric, window)` makes each
// (exercise, metric, window) tuple its own cache slot so toggling Max vikt /
// Total volym or 1M / 3M / 6M / 1Y / All produces a distinct queryKey. Re-
// selecting a previously fetched combination is an instant cache hit (D-14,
// D-15, 06-CONTEXT.md).
//
// `exerciseTopSetsKeys.byExercise(exerciseId, window)` powers the "Senaste
// 10 passen" list under the chart. The tuple deliberately EXCLUDES `metric`
// because the top-sets list is metric-agnostic — the same source-session
// rows surface regardless of which metric the chart renders (D-20 + BLOCKER-2
// fix).
// ---------------------------------------------------------------------------

export const exerciseChartKeys = {
  all: ["exercise-chart"] as const,
  byExercise: (
    exerciseId: string,
    metric: "weight" | "volume",
    window: "1M" | "3M" | "6M" | "1Y" | "All",
  ) =>
    [
      ...exerciseChartKeys.all,
      "by-exercise",
      exerciseId,
      metric,
      window,
    ] as const,
};

export const exerciseTopSetsKeys = {
  all: ["exercise-top-sets"] as const,
  byExercise: (
    exerciseId: string,
    window: "1M" | "3M" | "6M" | "1Y" | "All",
  ) =>
    [
      ...exerciseTopSetsKeys.all,
      "by-exercise",
      exerciseId,
      window,
    ] as const,
};

// ---------------------------------------------------------------------------
// Phase 12 — Home dashboard + chart-detail summary cache slots (12-04, D-24).
//
// These factories are ADDITIVE. The Phase 6 exerciseChartKeys /
// exerciseTopSetsKeys 5-state `window` unions above remain BYTE-UNCHANGED —
// the v1 chart still types against them until the screens migrate. D-24
// forbids widening/mutating any existing factory; new read-side surfaces get
// brand-new cache slots instead.
//
// `dashboardKeys.summary()` is the single offline-first slot for
// get_dashboard_summary (Home hero + History card + lifetime eyebrow — D-03).
// The single PersistQueryClientProvider hydrates it for free.
//
// `exerciseSummaryKeys.byExercise(exerciseId, metric, range)` is keyed against
// the NEW 3-state ChartRange ("30d" | "90d" | "All", default 90d — D-11) so
// the chart-summary slot is distinct from the v1 5-state exerciseChartKeys
// slot and toggling range produces a fresh cache entry.
// ---------------------------------------------------------------------------

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
};

export const exerciseSummaryKeys = {
  all: ["exercise-summary"] as const,
  byExercise: (
    exerciseId: string,
    metric: "weight" | "volume",
    range: "30d" | "90d" | "All",
  ) =>
    [
      ...exerciseSummaryKeys.all,
      "by-exercise",
      exerciseId,
      metric,
      range,
    ] as const,
};

// ---------------------------------------------------------------------------
// Phase 13 (13-03) — PR-celebration read-side cache slots (F18).
//
// These factories are ADDITIVE (D-24 lineage): no existing factory above is
// widened or mutated. Each new read-side surface from the four PR RPCs
// (migration 0012, Plan 13-02) gets its own brand-new cache slot.
//
// `bestE1rmKeys.all` is the SINGLE offline-first slot for get_best_working_sets
// — the all-time-best-working-set reference per exercise that feeds live PR
// detection (D-06/PR-01). It has NO per-exercise arg because the RPC returns
// every exercise's best in one call (mirrors the dashboardKeys.summary() single
// slot rather than the per-exercise lastValueKeys.byExercise shape). Finishing a
// session invalidates this slot (the ONE additive line in client.ts onSettled).
//
// `prHistoryKeys.byExercise(exerciseId)` keys the chronological was_pr-per-set
// rows for the read-side session-detail trophies (D-14/D-15).
//
// `exerciseSetsInRangeKeys.byExerciseSince(exerciseId, since)` keys raw range
// working sets for the chart e1RM hero + delta (D-16). `since` is the ISO
// string (or null for "All") so toggling range produces a distinct slot.
//
// `sessionPrFlagsKeys.byIds(sessionIds)` keys the history-LIST has_pr aggregator
// off a STABLE join of the SORTED id list — the same visible session set hits
// one cache entry regardless of input ordering (D-14, one call over the list).
// ---------------------------------------------------------------------------

export const bestE1rmKeys = {
  all: ["best-e1rm"] as const,
};

export const prHistoryKeys = {
  all: ["pr-history"] as const,
  byExercise: (exerciseId: string) =>
    [...prHistoryKeys.all, "by-exercise", exerciseId] as const,
};

export const exerciseSetsInRangeKeys = {
  all: ["exercise-sets-in-range"] as const,
  byExerciseSince: (exerciseId: string, since: string | null) =>
    [
      ...exerciseSetsInRangeKeys.all,
      "by-exercise",
      exerciseId,
      since,
    ] as const,
};

export const sessionPrFlagsKeys = {
  all: ["session-pr-flags"] as const,
  // Key off a stable join of the SORTED id list so the same visible set of
  // sessions maps to ONE cache entry regardless of array ordering. A copy is
  // sorted (never mutate the caller's array).
  byIds: (sessionIds: string[]) =>
    [
      ...sessionPrFlagsKeys.all,
      "by-ids",
      [...sessionIds].sort().join(","),
    ] as const,
};
