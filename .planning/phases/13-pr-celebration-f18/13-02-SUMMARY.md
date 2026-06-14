---
phase: 13-pr-celebration-f18
plan: 02
subsystem: database
tags: [postgres, supabase, rpc, rls, window-function, pr-detection, e1rm]

# Dependency graph
requires:
  - phase: 13-01
    provides: lib/e1rm.ts (D-08 single Epley e1RM source the JS side recomputes display numerals from)
  - phase: 02-schema-rls-type-generation
    provides: exercise_sets + workout_sessions RLS policies (migration 0001) the INVOKER RPCs inherit
  - phase: 06-history-read-side
    provides: 0006 distinct-on top-set precedent + verify-deploy.ts/test-rls.ts cross-user RPC harness shape
  - phase: 12-history-detail-chart-home-dashboard
    provides: 0011 RPC convention (security invoker + search_path='' + working-set/finished-only) + phase12Functions/phase12 cross-user blocks mirrored here
provides:
  - get_exercise_pr_history(p_exercise_id) — chronological running-max window engine flagging was_pr (PR-at-log-time)
  - get_best_working_sets() — all-time-best working set per exercise (offline-first live-detection baseline, D-06)
  - get_exercise_sets_in_range(p_exercise_id, p_since) — raw working sets in range for the chart hero e1RM + range delta (D-16)
  - get_session_pr_flags(p_session_ids uuid[]) — session-level has_pr aggregator (per-exercise running-max + bool_or, D-14)
  - phase13Functions deploy gate (INVOKER + search_path) covering all four RPCs
  - Phase 13 cross-user + was_pr/has_pr correctness assertions in test-rls.ts
affects: [13-03, 13-04, 13-05, pr-detection, live-pr-banner, chart-pr-markers, history-session-trophies]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chronological running-max PR engine: coalesce(sql_e1rm > max(sql_e1rm) over (order by completed_at, id rows between unbounded preceding and 1 preceding), false) → was_pr PR-at-log-time; strictly-prior frame (Pitfall 1) + deterministic tiebreak (Pitfall 2) + first-set baseline=false (D-02) + strict > (D-05)"
    - "Session-level has_pr = same engine PARTITION BY exercise_id (per-exercise PR semantics) aggregated via bool_or over = any(p_session_ids) (one-call history-list trophy derivation, hooks-legal)"
    - "Internal SQL e1RM (weight_kg * (1 + reps/30.0), float div) is ordering/flagging ONLY — never a returned column (D-08); RAW weight_kg/reps returned, JS recomputes display via lib/e1rm.ts"

key-files:
  created:
    - app/supabase/migrations/0012_phase13_pr_rpcs.sql
  modified:
    - app/types/database.ts
    - app/scripts/verify-deploy.ts
    - app/scripts/test-rls.ts

key-decisions:
  - "Four-RPC split (Claude's-discretion per CONTEXT / RESEARCH A3-A5): per-exercise PR-history engine + all-time-best baseline + raw-range-sets + session-level has_pr aggregator. The session aggregator was shipped (RESEARCH Open Question 1) because the history-list per-session trophy is otherwise unworkable without a rules-of-hooks violation."
  - "get_best_working_sets ordered by the internal e1RM expression in the distinct-on ORDER BY (leading key = exercise_id to satisfy distinct on, then e1RM desc breaks the tie to the single best set)."
  - "PR fixture uses three chronologically-separated finished sessions (100x5 baseline / 110x5 higher / 110x5 tie) seeded via clientA so user-cascade cleans them up; asserts was_pr=[false,true,false] and has_pr=[S1:false,S2:true,S3:false]."

patterns-established:
  - "Pattern 1: PR-at-log-time via strictly-prior window frame — reused verbatim in both the per-exercise history RPC and the session aggregator (the latter adds partition by exercise_id)."
  - "Pattern 2: read-only RPC deploy gate — phase13Functions mirrors phase12Functions pg_proc INVOKER+search_path loop with its own failure counter + non-zero exit."

requirements-completed: [PR-01, PR-04, PR-05]

# Metrics
duration: ~18min
completed: 2026-06-14
---

# Phase 13 Plan 02: PR Read-Side RPCs Summary

**Migration 0012 ships four read-only SECURITY INVOKER RPCs — a chronological running-max `was_pr` engine, an all-time-best offline baseline, raw range-sets for the chart hero, and a per-exercise-partitioned `bool_or` session-level `has_pr` aggregator — pushed live with regenerated types, deploy-gate + cross-user RLS coverage.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-14T14:35:46Z
- **Completed:** 2026-06-14T14:53:00Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `get_exercise_pr_history(p_exercise_id)` — chronological running-max window engine flagging each working set `was_pr` PR-at-log-time: strictly-prior frame (`rows between unbounded preceding and 1 preceding`, Pitfall 1), deterministic `order by completed_at, set_id` tiebreak (Pitfall 2), first set → `coalesce(..., false)` baseline (D-02), strict `>` so a tie is not a PR (D-05).
- `get_best_working_sets()` — all-time-best working set per exercise via `distinct on (exercise_id) ... order by exercise_id, e1rm desc`; the offline-first live-detection baseline (D-06), RAW `weight_kg/reps` only (D-08).
- `get_exercise_sets_in_range(p_exercise_id, p_since)` — raw working sets in range feeding the chart hero e1RM max + earliest-vs-best delta (D-16); nullable-`p_since` "All" idiom.
- `get_session_pr_flags(p_session_ids uuid[])` — same running-max engine `partition by exercise_id` (per-exercise PR semantics so a heavy bench can't suppress a squat PR), aggregated to session granularity via `bool_or` over `= any(p_session_ids)`; the one-call history-list trophy derivation (D-14, RESEARCH Open Question 1).
- All four are `security invoker` + `stable` + `set search_path = ''` + `set_type='working'` (D-03) + `weight_kg > 0` (D-04) + finished-sessions-only; internal SQL e1RM (`* (1 + reps/30.0)`, float div) never returned as a column (D-08).
- Pushed live via `echo "" | npx supabase db push`; `database.ts` regenerated; `verify-deploy.ts` phase13Functions green for all four (INVOKER + search_path); `test-rls.ts` extended with cross-user isolation + was_pr/has_pr correctness (7 new assertions, all PASS).

## Task Commits

Each task was committed atomically:

1. **Task 1: Write migration 0012 (four read-only RPCs)** - `ac03527` (feat)
2. **Task 2: [BLOCKING] Push live, regen types, extend deploy gate** - `8ffdde2` (feat)
3. **Task 3: Extend test-rls — cross-user + was_pr/has_pr correctness** - `ec485ea` (test)

**Plan metadata:** see final docs commit.

## Files Created/Modified
- `app/supabase/migrations/0012_phase13_pr_rpcs.sql` - The four read-only PR RPCs (created)
- `app/types/database.ts` - Regenerated against live DB; carries the four new RPC function types (modified)
- `app/scripts/verify-deploy.ts` - Added `phase13Functions` pg_proc INVOKER + search_path deploy gate (modified)
- `app/scripts/test-rls.ts` - Phase 13 cross-user isolation per RPC + seeded was_pr/has_pr correctness fixture (modified)

## Decisions Made
- **Four-RPC split** as the objective specifies (Claude's-discretion per CONTEXT / RESEARCH A3-A5). The session-level `get_session_pr_flags` aggregator (RESEARCH Open Question 1, "optional") was shipped because the history-list per-session trophy is otherwise unworkable without a rules-of-hooks violation — it reuses the identical PR-at-log-time engine, only partitioned per exercise and aggregated via `bool_or`.
- **`get_best_working_sets` distinct-on ORDER BY** leads with `exercise_id` (required by `distinct on (exercise_id)`) then orders by the internal e1RM expression desc to break to the single best set — the 0006 top-pick precedent.
- **PR-correctness fixture** seeds three chronologically-separated finished sessions (100×5 baseline / 110×5 higher / 110×5 tie) via `clientA`, so user-cascade in the existing finally block cleans them up (no new explicit teardown needed). Asserts `was_pr=[false,true,false]` and `has_pr=[S1:false,S2:true,S3:false]`, exercising D-02 baseline + D-05 strict-`>` + D-14 session-consistency in one fixture.

## Deviations from Plan

None - plan executed exactly as written. (The only adjustment was the CLI invocation form — see Issues Encountered — which is the same `supabase db push` command via its resolvable entry point, not an alternative auth path.)

## Issues Encountered
- **`supabase` not on the bash PATH.** The plan's literal `echo "" | supabase db push` failed with `command not found` in this shell. The Supabase CLI is resolvable via `npx supabase` (v2.106.0) — the SAME form `package.json`'s `gen:types` script already uses. Ran `echo "" | npx supabase db push`, which is the identical command and the identical non-interactive auth path (SUPABASE_DB_PASSWORD from `.env.local`, empty stdin → default Y); migration applied successfully. No improvised alternative auth path was used.

## User Setup Required
None - no external service configuration required. The migration was pushed live to the linked Supabase project as part of execution.

## Next Phase Readiness
- PR-01 (D-06 offline baseline), PR-04 (D-14/D-15 chronological derivation), PR-05 (D-16 range sets) are all live and RLS-scoped, plus the session-level `has_pr` aggregator the history list needs.
- Wave 2 consumers (live PR-detection banner, chart PR markers + range delta, history-list session trophies) can now build against the four RPCs and `lib/e1rm.ts` (13-01).
- Known-amber `test:f13-brutal` (FIT-107) is a live-DB count precondition unaffected by these read-only RPCs — exit 0 (no-recent-session no-op) this run.

## Self-Check: PASSED

All created/modified files exist on disk; all three task commits (`ac03527`, `8ffdde2`, `ec485ea`) present in git history.

---
*Phase: 13-pr-celebration-f18*
*Completed: 2026-06-14*
