---
phase: 10-plans-exercises-re-skin
plan: 01
subsystem: database
tags: [supabase, postgres, rls, zod, react-query, migration, seed-key, hard-delete]

# Dependency graph
requires:
  - phase: 02-database-foundation
    provides: column-agnostic own-row RLS on exercises + workout_sessions, migration-as-truth harness (verify-deploy.ts, test-rls.ts)
  - phase: 06-history-read-side
    provides: get_session_summaries RPC (security invoker + search_path='') re-deployed here with coalesce
provides:
  - "exercises.seed_key column (nullable bilingual seed identifier, D-06) — live + RLS-covered"
  - "workout_sessions.plan_name_snapshot column (D-11 hard-delete history readability) — live + backfilled"
  - "get_session_summaries re-deployed with coalesce(p.name, s.plan_name_snapshot)"
  - "useDeletePlan hook + ['plan','delete'] hard-delete mutation default"
  - "plan_name_snapshot on SessionInsertVars + ['session','start'] optimisticRow"
  - "ExerciseRowSchema.seed_key + exerciseFormSchema muscle_group D-01 enum"
  - "verify-deploy + test-rls + test-exercise-schemas extended to lock the new schema"
affects: [exercise-picker, exercise-edit, plans-trio, plan-detail, hard-delete-dialog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration-as-truth co-commit: 0010 SQL + regenerated types/database.ts in one commit"
    - "Column-agnostic RLS reuse: new columns inherit own-row policies — no per-column policy"
    - "Static mutation scope baked at construction (SP-3): scope: planId ? { id: `plan:${planId}` } : undefined"
    - "Loose wire-boundary / strict form-boundary split for seed_key + muscle_group"

key-files:
  created:
    - app/supabase/migrations/0010_seed_key_and_session_plan_snapshot.sql
  modified:
    - app/types/database.ts
    - app/lib/schemas/exercises.ts
    - app/lib/schemas/sessions.ts
    - app/lib/query/client.ts
    - app/lib/queries/plans.ts
    - app/app/(app)/plans/[id]/exercise-picker.tsx
    - app/scripts/verify-deploy.ts
    - app/scripts/test-rls.ts
    - app/scripts/test-exercise-schemas.ts

key-decisions:
  - "D-06: exercises.seed_key is nullable + additive; existing column-agnostic own-row RLS covers it (no new policy)"
  - "D-11: hard-delete preserves history via plan_id ON DELETE SET NULL (already present) + plan_name_snapshot backfill + coalesce in get_session_summaries + useDeletePlan mutation"
  - "Row schema stays loose (string|null) for seed_key; form schema constrains muscle_group to the 5 D-01 keys"

patterns-established:
  - "Migration + gen:types co-commit gate enforced (CLAUDE.md DB conventions)"
  - "Additive nullable column with backfill + RPC coalesce switch keeps history readable after FK SET NULL"
  - "['plan','delete'] optimistic mutation filters the FLAT plansKeys.list cache, invalidates both plans.list + sessions.listInfinite"

requirements-completed: [SKIN-02, SKIN-03, SKIN-08]

# Metrics
duration: ~5min (resumed segment; Task 1 authored in prior session)
completed: 2026-06-12
---

# Phase 10 Plan 01: Schema & Data-Mutation Foundation Summary

**Migration 0010 ships exercises.seed_key + workout_sessions.plan_name_snapshot live (additive, RLS-covered, backfilled), the ['plan','delete'] hard-delete mutation + useDeletePlan hook, and the get_session_summaries coalesce re-deploy that keeps deleted-plan history readable.**

## Performance

- **Duration:** ~5 min (resumed segment — Task 1 authored in the prior executor session; this session completed the Task 2 co-commit and Task 3)
- **Started (Task 1):** 2026-06-12T20:35:46+02:00
- **Completed (Task 3):** 2026-06-12T20:40:45+02:00
- **Tasks:** 3
- **Files modified:** 10 (1 created, 9 modified)

## Accomplishments
- **Migration 0010 deployed live** — `exercises.seed_key` (D-06) + `workout_sessions.plan_name_snapshot` (D-11), both additive nullable, with a one-time backfill and the `get_session_summaries` coalesce re-deploy (`coalesce(p.name, s.plan_name_snapshot)`), security posture preserved verbatim (`security invoker` + `set search_path = ''`).
- **Hard-delete plumbing** — `useDeletePlan` hook + `['plan','delete']` mutation default (optimistic flat-cache filter, dual invalidation of `plans.list` + `sessions.listInfinite`, rollback on error). Server cascade handles children; FK `ON DELETE SET NULL` keeps sessions intact.
- **Snapshot-on-start** — `plan_name_snapshot` threaded through `SessionInsertVars` + the `['session','start']` optimisticRow under the `satisfies SessionRow` discipline.
- **Schema contracts** — `ExerciseRowSchema.seed_key` (loose wire boundary) + `exerciseFormSchema.muscle_group` constrained to the 5 D-01 keys (strict form boundary).
- **Regression locks** — `verify-deploy.ts` (column existence + `confdeltype='n'` FK), `test-rls.ts` (cross-user seed_key SELECT/UPDATE block + re-affirmed plan-delete), `test-exercise-schemas.ts` (seed_key + muscle-group-enum cases). All green.

## Task Commits

1. **Task 1: Author migration 0010 + extend schema + delete/snapshot mutations** - `0260245` (feat) — *prior session*
2. **Task 2: Push migration 0010 + regen types + extend verify-deploy/test-rls** - `bfb45cd` (feat) — migration SQL + regenerated `database.ts` + both scripts co-committed (migration-as-truth gate)
3. **Task 3: Extend exercise-schema unit test + confirm F13 no-regression** - `31f611b` (test)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `app/supabase/migrations/0010_seed_key_and_session_plan_snapshot.sql` - Additive seed_key + plan_name_snapshot columns, backfill, get_session_summaries coalesce re-deploy
- `app/types/database.ts` - Regenerated post-push (seed_key + plan_name_snapshot)
- `app/lib/schemas/exercises.ts` - seed_key on row schema; muscle_group D-01 enum on form schema
- `app/lib/schemas/sessions.ts` - plan_name_snapshot on session schema
- `app/lib/query/client.ts` - ['plan','delete'] default; plan_name_snapshot in ['session','start'] optimisticRow
- `app/lib/queries/plans.ts` - useDeletePlan hook (clone of useArchivePlan, static scope)
- `app/app/(app)/plans/[id]/exercise-picker.tsx` - seed_key-aware picker wiring (Task 1)
- `app/scripts/verify-deploy.ts` - Phase 10 column + FK confdeltype assertions
- `app/scripts/test-rls.ts` - cross-user seed_key block (D-06) + re-affirmed plan-delete
- `app/scripts/test-exercise-schemas.ts` - seed_key row cases + D-01 muscle-group enum cases

## Decisions Made
- **Migrated legacy free-text muscle_group test cases to D-01 keys.** Task 1 changed `exerciseFormSchema.muscle_group` from a length-bounded string to a `z.enum(MUSCLE_GROUP_KEYS)`. The pre-existing test cases used Swedish free-text ("Bröst") and the "muscle_group too long" case, both of which the enum now rejects with "Ogiltig muskelgrupp". Updated those cases to use D-01 keys and replaced the length-reject case with an off-list-reject case so the harness asserts the actual enum behavior. This is test maintenance to match the Task 1 schema change — not a scope deviation.
- Row schema kept loose for seed_key (legacy/user rows are NULL; V2 seed rows carry a key) while the form schema is strict — the established wire-vs-form split.

## Deviations from Plan

None - plan executed exactly as written. (The test-case migration to D-01 keys above is the test-side mirror of the Task 1 schema change, explicitly anticipated by the Task 3 action text: "match whatever Task 1 implemented.")

## Issues Encountered
None. The Task 2 human-action checkpoint (live-DB push) was performed and verified green by the orchestrator before this resumed segment; tsc errors in `lib/query/client.ts` cleared once `database.ts` was regenerated (`npx tsc --noEmit` exits 0).

## User Setup Required
None - no external service configuration required. The Supabase migration push was completed during the Task 2 checkpoint.

## Next Phase Readiness
- Foundation contracts shipped for all downstream Phase 10 plans: `seed_key` column (bilingual seed rendering), `useDeletePlan` (hard-delete dialog), `plan_name_snapshot` + coalesce (history readability).
- All verification scripts green: `tsc --noEmit`, `verify-deploy.ts`, `test:rls`, `test:exercise-schemas`, `test:f13-brutal` (SKIN-08 no-regression), `check:locale-parity`.
- No blockers.

## Self-Check: PASSED

- FOUND: `app/supabase/migrations/0010_seed_key_and_session_plan_snapshot.sql`
- FOUND: `.planning/phases/10-plans-exercises-re-skin/10-01-SUMMARY.md`
- FOUND: commit `0260245` (Task 1)
- FOUND: commit `bfb45cd` (Task 2)
- FOUND: commit `31f611b` (Task 3)

---
*Phase: 10-plans-exercises-re-skin*
*Completed: 2026-06-12*
