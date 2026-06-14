---
phase: 13-pr-celebration-f18
plan: 03
subsystem: api
tags: [tanstack-query, zod, supabase-rpc, offline-first, react-hooks]

# Dependency graph
requires:
  - phase: 13-02
    provides: "Migration 0012 — four read-only PR RPCs (get_exercise_pr_history, get_best_working_sets, get_exercise_sets_in_range, get_session_pr_flags) + regenerated database.ts types"
  - phase: 13-01
    provides: "lib/e1rm.ts epley1RM — the single Epley source consumers use to compute displayed/compared e1RM over the raw sets these hooks return"
provides:
  - "useBestE1rmQuery() — offline-first Record<exerciseId,{weight_kg,reps}> all-time-best reference for live PR detection (D-06/PR-01)"
  - "usePrHistoryQuery(exerciseId) — chronological was_pr-per-set rows for read-side session-detail trophies (D-14/D-15/PR-04)"
  - "useExerciseSetsInRangeQuery(exerciseId, since) — raw range working sets for chart e1RM hero + delta (D-16/PR-05)"
  - "useSessionPrFlags(sessionIds) — ONE-call history-LIST has_pr aggregator → Record<session_id,has_pr> (D-14, hooks-legal)"
  - "bestE1rmKeys / prHistoryKeys / exerciseSetsInRangeKeys / sessionPrFlagsKeys factories"
  - "ONE additive bestE1rmKeys.all invalidate in the existing session-finish onSettled (D-17)"
affects: [13-04, 13-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Offline-first RPC hook over a SINGLE no-arg cache slot (bestE1rmKeys.all), Record-not-Map for persister safety (mirrors dashboardKeys.summary())"
    - "Hooks-legal list aggregator: ONE rpc call over a visible-id array → Record, replacing a rules-of-hooks-violating per-item hook loop"
    - "sessionPrFlagsKeys keyed off a SORTED-id stable join so order-independent visible sets share one cache entry"

key-files:
  created:
    - app/lib/queries/best-e1rm.ts
    - app/lib/queries/pr-history.ts
    - app/lib/queries/exercise-sets-in-range.ts
    - app/lib/queries/session-pr-flags.ts
  modified:
    - app/lib/query/keys.ts
    - app/lib/query/client.ts

key-decisions:
  - "bestE1rmKeys has NO per-exercise arg — get_best_working_sets returns all exercises in one call, so it mirrors the single dashboardKeys.summary() slot, not the per-exercise lastValueKeys.byExercise shape"
  - "since=null → p_since omitted (undefined) rather than passing a Date object; PostgREST defaults the omitted param to NULL and the SQL body guards it via (p_since is null or ...)"
  - "sessionPrFlagsKeys.byIds sorts a COPY of the id list before joining so the caller's array is never mutated and order-independent visible sets hit one cache entry"

patterns-established:
  - "PR read-side hooks all Zod-parse every RPC row at the boundary (T-13-06); raw weight_kg/reps returned, JS owns the e1RM via lib/e1rm.ts (D-08)"
  - "Record<key,V> over Map everywhere a persister-hydrated/JSON-round-tripped query value is returned (last-value.ts:18-22 rationale)"

requirements-completed: [PR-01, PR-04, PR-05]

# Metrics
duration: ~8min
completed: 2026-06-14
---

# Phase 13 Plan 03: PR Read-Side Query Layer Summary

**Four Zod-parsed TanStack hooks over the 13-02 PR RPCs — offline-first all-time-best reference, was_pr-per-set history, raw range sets, and a hooks-legal session-list has_pr aggregator — plus the single additive session-finish invalidate (D-17 preserved).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-14T14:43:00Z (approx)
- **Completed:** 2026-06-14T14:51:00Z
- **Tasks:** 2
- **Files modified:** 6 (4 created + 2 modified)

## Accomplishments
- `useBestE1rmQuery()` — offline-first, persister-hydrated `Record<exerciseId,{weight_kg,reps}>` over `get_best_working_sets`, mirroring `last-value.ts` exactly (userId belt-and-braces, Record-not-Map, 15-min staleTime). The live PR-detection baseline (D-06/PR-01).
- `usePrHistoryQuery` / `useExerciseSetsInRangeQuery` / `useSessionPrFlags` — three read-side RPC hooks, each Zod-parsing every row at the boundary (never `as`-cast).
- `useSessionPrFlags` is the hooks-legal history-LIST aggregator: ONE `get_session_pr_flags` call over the visible session-id array → `Record<session_id,has_pr>` (replaces the unworkable per-exercise hook loop, D-14 / RESEARCH Open Q1).
- Four additive key factories in `keys.ts`; the single additive `bestE1rmKeys.all` invalidate in the existing `['session','finish'].onSettled` (D-17 hard line — no mutation-default/onMutate/scope edit touched).

## Task Commits

Each task was committed atomically:

1. **Task 1: key factories + best-e1rm.ts + client.ts invalidate** - `a2d30b9` (feat)
2. **Task 2: pr-history + exercise-sets-in-range + session-pr-flags hooks** - `7849e45` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `app/lib/queries/best-e1rm.ts` - Offline-first all-time-best reference hook (Record, D-06/D-08)
- `app/lib/queries/pr-history.ts` - Chronological was_pr-per-set rows for read-side trophies (D-14/D-15)
- `app/lib/queries/exercise-sets-in-range.ts` - Raw range working sets for chart e1RM hero + delta (D-16)
- `app/lib/queries/session-pr-flags.ts` - History-LIST has_pr aggregator (ONE call → Record, D-14)
- `app/lib/query/keys.ts` - Added bestE1rmKeys/prHistoryKeys/exerciseSetsInRangeKeys/sessionPrFlagsKeys (additive)
- `app/lib/query/client.ts` - ONE additive bestE1rmKeys.all invalidate in session-finish onSettled + the key import (D-17)

## Decisions Made
- **`bestE1rmKeys` has no per-exercise arg.** `get_best_working_sets` returns one row per exercise in a single call, so the cache slot mirrors `dashboardKeys.summary()` (one slot) rather than `lastValueKeys.byExercise` (per-exercise). This is the slot the session-finish onSettled invalidates.
- **`since=null` omits the param.** `useExerciseSetsInRangeQuery` passes `since?.toISOString()` which is `undefined` for the "All" case; PostgREST omits the param and the SQL guards NULL via `(p_since is null or ...)`. Equivalent to the plan's `as unknown as string` cast intent, type-clean against the generated `p_since: string` arg.
- **`get_best_working_sets` called with no second argument.** Its generated `Args: never` means passing `{}` would not typecheck; `supabase.rpc("get_best_working_sets")` is the correct no-arg form.
- **`sessionPrFlagsKeys.byIds` sorts a copy.** `[...sessionIds].sort().join(",")` gives an order-independent stable cache key without mutating the caller's array.

## Deviations from Plan

None - plan executed exactly as written. The two minor implementation specifics above (no-arg `get_best_working_sets` call; `since` omitted rather than cast) are type-correctness refinements that match the generated `database.ts` signatures, not behavioral deviations — the runtime contract (NULL since = full history; best-per-exercise) is identical to the plan's intent.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **13-04 (live detection)** consumes `useBestE1rmQuery` as the offline baseline and computes the candidate-vs-best e1RM compare via `lib/e1rm.ts` (D-07 in-session max is the caller's concern, sourced from existing `useSetsForSessionQuery`).
- **13-05 (read-side)** consumes `usePrHistoryQuery` (session-detail trophies), `useExerciseSetsInRangeQuery` (chart hero/delta), and `useSessionPrFlags` (history-LIST trophies, ONE call — no per-exercise loop).
- Interface-first: all four hooks ship Zod-parsed with stable cache keys; downstream consumers import with zero codebase exploration.
- D-17 preserved: client.ts diff is exactly the one additive invalidate line + the key import. `test:f13-brutal` green (no-op no-recent-session, FIT-107 window — not a regression).

## Self-Check: PASSED

- FOUND: app/lib/queries/best-e1rm.ts
- FOUND: app/lib/queries/pr-history.ts
- FOUND: app/lib/queries/exercise-sets-in-range.ts
- FOUND: app/lib/queries/session-pr-flags.ts
- FOUND: commit a2d30b9
- FOUND: commit 7849e45
- tsc --noEmit exits 0; test:f13-brutal exits 0

---
*Phase: 13-pr-celebration-f18*
*Completed: 2026-06-14*
