---
phase: 12-history-detail-chart-home-dashboard
plan: 01
subsystem: database
tags: [supabase, postgres, rpc, rls, gaps-and-islands, date_trunc, security-invoker, zod-boundary, verification]

# Dependency graph
requires:
  - phase: 06-history-read-side-polish
    provides: 0006 read-side RPC template (security invoker / stable / search_path='' / set_type='working'), verify-deploy.ts + test-rls.ts extension patterns
  - phase: 09-auth-settings-preferences
    provides: profiles.weekly_goal column (0007, int 1..7 default 3) — streak/ring denominator
provides:
  - "Migration 0011 deployed live: public.get_dashboard_summary(p_tz) + public.get_exercise_summary(p_exercise_id, p_metric, p_since)"
  - "Regenerated app/types/database.ts with both new RPC return shapes"
  - "verify-deploy.ts phase12Functions gate (INVOKER + search_path)"
  - "test-rls.ts cross-user assertion per new RPC (T-12-01/T-12-02)"
  - "test-dashboard-aggregates.ts Wave-0 streak + week-boundary fixtures (test:dashboard)"
affects: [12-02 query hooks + units, 12-03 Home ring hero, History volume card, exercise chart re-skin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Combined single-row aggregate RPC (8-col dashboard) over several small RPCs — one network call, one persister slot, one cross-user test"
    - "Local-time ISO-week bucketing: date_trunc('week', ts at time zone p_tz) (Monday-based, DST-correct)"
    - "Streak via gaps-and-islands: 60-week calendar spine → met/not-met flags → island partition → live-island <=2 boundary"
    - "Wave-0 fixture harness for aggregate SQL (DST-exact local-wall-clock → UTC seeding via Intl offset)"

key-files:
  created:
    - app/supabase/migrations/0011_phase12_dashboard_rpcs.sql
    - app/scripts/test-dashboard-aggregates.ts
  modified:
    - app/types/database.ts
    - app/scripts/verify-deploy.ts
    - app/scripts/test-rls.ts
    - app/package.json

key-decisions:
  - "Two RPCs, not one or five: combined get_dashboard_summary (Home+History) + separate get_exercise_summary (per-exercise chart)"
  - "Streak in-progress-week boundary LOCKED at <=2 island guard — empty current week does NOT break a streak ending last week; an already-met current week counts"
  - "vol_per_session_kg denominator = finished sessions in range CONTAINING this exercise (not all finished sessions)"
  - "avg_rpe = avg(rpe) over working sets; SQL AVG ignores NULLs, returns NULL only when all NULL → UI shows '–'"

patterns-established:
  - "phase{N}Functions block in verify-deploy.ts: pg_proc INVOKER + search_path check + failure counter + process.exit(1)"
  - "Cross-user RPC no-leak test: A (zero data) calls RPC, asserts B's seeded finished data does not inflate A's aggregates"

requirements-completed: [DASH-05, SKIN-06, DASH-01, DASH-02, DASH-03, DASH-04]

# Metrics
duration: ~35min
completed: 2026-06-13
---

# Phase 12 Plan 01: Dashboard Aggregate RPCs Summary

**Two read-only security-invoker RPCs (get_dashboard_summary + get_exercise_summary) deployed live in migration 0011 — local-time Mon–Sun week bucketing, gaps-and-islands streak, 12-week sparkline jsonb, chart hero/3-stat — with all three verification gates (deploy-check, cross-user RLS, streak/week fixtures) green.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-13 (post UI-SPEC approval)
- **Completed:** 2026-06-13
- **Tasks:** 3
- **Files created:** 2 / **modified:** 4

## Accomplishments
- `get_dashboard_summary(p_tz)` — single-row aggregate: sessions-this-week, weekly_goal, streak_weeks, this/prior-week volume, 12-week sparkline jsonb, lifetime sessions + hours. Local Mon–Sun ISO-week bucketing via `date_trunc('week', started_at at time zone p_tz)` (D-06).
- `get_exercise_summary(p_exercise_id, p_metric, p_since)` — chart hero current_best + range_first_value (delta basis) + top set (w×r) + vol-per-session + avg_rpe (NULL-safe, D-14).
- Migration 0011 pushed live; `app/types/database.ts` regenerated and co-committed with the migration (CLAUDE.md DB convention).
- Three verification gates wired and green: `verify-deploy.ts` (phase12 INVOKER + search_path), `test:rls` (cross-user no-leak per RPC), `test:dashboard` (streak + week-boundary fixtures).

## Task Commits

1. **Task 1+2: Write migration 0011 + [BLOCKING] push + regen types** - `303b840` (feat) — migration SQL + co-committed regenerated database.ts (combined into one commit per the CLAUDE.md gen:types co-commit convention; the push is the gate that makes the types real)
2. **Task 3: Wire verify-deploy + cross-user test:rls + Wave-0 fixtures** - `f36b38a` (test)

**Plan metadata:** (final docs commit — this SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `app/supabase/migrations/0011_phase12_dashboard_rpcs.sql` (NEW) - The two aggregate RPCs (security invoker / stable / search_path='' / set_type='working' / finished-only).
- `app/types/database.ts` (regenerated) - New RPC argument + return types (24 lines added).
- `app/scripts/verify-deploy.ts` (modified) - phase12Functions pg_proc gate.
- `app/scripts/test-rls.ts` (modified) - one cross-user no-leak assertion per new RPC; seeds a finished B-session as leak bait.
- `app/scripts/test-dashboard-aggregates.ts` (NEW) - streak (3 consec → 3; gap → reset 2; in-progress current week + prior 4 → 4) + Sunday-23:30-local week-boundary fixtures.
- `app/package.json` (modified) - `test:dashboard` script alias.

## Decisions Made
- **Combined dashboard RPC** (8-col single row) over several small RPCs — one persister cache slot, one cross-user test, no partial-hydration skeleton flash (RESEARCH §Mandate 1).
- **Streak `<=2` live-island boundary LOCKED** by fixture (c): an empty in-progress current week (rn=1) does not break a streak ending at last week (rn=2); a fully-missed last week ends it. This was the one MEDIUM-confidence piece (RESEARCH A2/OQ-1) — now proven, not assumed.
- **vol_per_session denominator** = finished sessions in range that contain the exercise (RESOLVED OQ-2), documented in the RPC body.
- **Tasks 1 and 2 combined into one commit** — the migration SQL and the regenerated `database.ts` MUST land in the same commit per CLAUDE.md ("the generated database.ts is committed in the same commit as the migration that produced it"). Task 2's "push" is the action that makes the regenerated types correct; committing them separately would violate the convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Week-boundary fixture (d) produced a Monday instant instead of Sunday 23:30**
- **Found during:** Task 3 (test-dashboard-aggregates.ts first run)
- **Issue:** My initial `atLocalDaysAgo` helper subtracted `daysAgo*24h` from `mondayNoon` (which carried `now`'s stray minutes/seconds) and nudged only the hour, so "last Sunday 23:30 + 30 min" rolled over into Monday 00:00. The seeded session then correctly bucketed into *this* week — the assertion failed, but the RPC was right; the fixture was wrong.
- **Fix:** Rewrote the local-time helpers to build an exact UTC instant from a LOCAL wall-clock Y/M/D H:M using a DST-aware `Intl`-derived offset (`tzOffsetMs` + two-pass `localWallClockToUTC`). The fixture now seeds a precise Sunday-23:30-local instant.
- **Files modified:** app/scripts/test-dashboard-aggregates.ts (uncommitted-then-committed in `f36b38a`)
- **Verification:** Re-ran `npm run test:dashboard` — all 7 assertions PASS, including the Sunday-night session bucketing into last week (500 kg) with this-week at 0 kg, proving the RPC's `at time zone p_tz` math is correct.
- **Committed in:** `f36b38a` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — in test fixture, not production SQL)
**Impact on plan:** The deviation hardened the week-boundary fixture; it surfaced (and ruled out) a potential RPC bug, then proved the RPC correct. No production-SQL change, no scope creep.

## Issues Encountered
- **Inline `tsx -e` postgres connection threw a TLS TransformError** against the pooler when run as a one-liner. Worked around by running the canonical `verify-deploy.ts` harness (same connection pattern, runs fine as a file) to confirm both RPCs are deployed as INVOKER with `search_path=""`. No impact on deliverables.

## User Setup Required
None - no external service configuration required. The migration push used the existing `SUPABASE_DB_PASSWORD` in `app/.env.local` (no `SUPABASE_ACCESS_TOKEN` needed — linked project; `gen:types` resolved via project-id).

## Next Phase Readiness
- Data foundation complete: both RPCs live + typed. Plan 12-02 can now build `useDashboardSummaryQuery` + `useExerciseSummaryQuery` query hooks against real, RLS-scoped aggregates and the persister will hydrate them for free.
- Streak, week-boundary, and sparkline-series semantics are locked by fixtures — Wave 2/3 screens can trust the numbers.
- F13 untouched (D-24): no mutation defaults / query keys / persister scope / exercise_sets logging changed; `test:f13-brutal` exits 0.

## Self-Check: PASSED

- FOUND: app/supabase/migrations/0011_phase12_dashboard_rpcs.sql
- FOUND: app/scripts/test-dashboard-aggregates.ts
- FOUND: .planning/phases/12-history-detail-chart-home-dashboard/12-01-SUMMARY.md
- FOUND commit: 303b840 (Task 1+2 — migration + types)
- FOUND commit: f36b38a (Task 3 — verification gates)

---
*Phase: 12-history-detail-chart-home-dashboard*
*Completed: 2026-06-13*
