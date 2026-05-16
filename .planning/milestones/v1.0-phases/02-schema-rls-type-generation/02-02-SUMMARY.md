---
phase: 02-schema-rls-type-generation
plan: 02
subsystem: database
tags: [postgres, supabase, rls, sql, migration, enum, trigger, security-definer]

# Dependency graph
requires:
  - phase: 02-schema-rls-type-generation
    provides: Plan 01 — Supabase CLI bootstrap (config.toml linked, migrations/ ready, gen:types + test:rls scripts placeholder)
provides:
  - Canonical 6-table schema source of truth as a single committed SQL file
  - public.set_type ENUM ('working','warmup','dropset','failure') replacing the dropped is_warmup boolean
  - 9 RLS policies with the PITFALLS 2.5 errata closed (with check on every writable policy, including plan_exercises and exercise_sets)
  - Every auth.uid() wrapped as (select auth.uid()) for query-plan caching (PITFALLS 4.1) — 0 unwrapped occurrences
  - handle_new_user trigger so Phase 3 sign-up auto-creates a profiles row (SECURITY DEFINER + search_path = '' + fully-qualified public.profiles per PITFALLS Pitfall 7)
  - 4 indexes (no over-indexing — Phase 5/6 measure first)
affects: [02-03 (db push will deploy this), 02-04 (gen-types reads this schema), 02-05 (cross-user RLS test asserts these policies), 02-06 (doc reconciliation flips ARCHITECTURE.md errata note), Phase 3 auth (relies on handle_new_user trigger), Phase 4+ (typed Supabase queries against these tables)]

# Tech tracking
tech-stack:
  added: []  # No new packages — pure SQL artifact; tooling pinned in Plan 01
  patterns:
    - "Errata-fixed RLS policy: BOTH using AND with check on every writable policy"
    - "(select auth.uid()) wrap on every RLS predicate for query-plan caching"
    - "Child-table RLS via parent-ownership exists() subquery + matching with check"
    - "SECURITY DEFINER trigger function with set search_path = '' + fully-qualified public.* names"
    - "Postgres ENUM as schema-only feature flag (set_type) — TS gen emits string-literal union for free"

key-files:
  created:
    - app/supabase/migrations/0001_initial_schema.sql
  modified: []

key-decisions:
  - "Migration shipped as single atomic file 0001_initial_schema.sql (D-02) — future deltas become 0002_*.sql, 0003_*.sql"
  - "is_warmup column dropped, no compatibility shim (D-12) — DB has no data, migration is free"
  - "Trigger function inserts only id (D-16) — display_name stays NULL until user edits it"
  - "No idempotency guards (if exists/if not exists) per CONTEXT Claude's Discretion — Supabase migrations run once on fresh project"
  - "No additional indexes beyond ARCHITECTURE.md §4 (4 total) — Phase 5/6 measure F7/F10 query plans first"
  - "Removed inline 'replaces is_warmup' comment to satisfy strict 'is_warmup MUST NOT appear anywhere' must_have invariant (Rule 3 deviation — see below)"

patterns-established:
  - "Migration file structure: ENUM → tables (FK-dependency order) → indexes → RLS-enable → policies → triggers"
  - "Every writable RLS policy: using <predicate> with check <same predicate> (no asymmetric clauses)"
  - "Every auth.uid() in RLS body is (select auth.uid()) — never bare"
  - "Child-table RLS predicate: exists (select 1 from <parent> where id = <fk> and user_id = (select auth.uid()))"

requirements-completed: [F17]

# Metrics
duration: ~5min
completed: 2026-05-08
---

# Phase 2 Plan 02: Initial Schema Migration Summary

**Single atomic 0001_initial_schema.sql migration with errata-fixed RLS (with check on plan_exercises + exercise_sets), wrapped (select auth.uid()) everywhere, set_type ENUM replacing is_warmup, and handle_new_user trigger.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-08T21:48:44Z (executor start)
- **Completed:** 2026-05-08T21:53:59Z
- **Tasks:** 1
- **Files created:** 1

## Accomplishments

- Authored `app/supabase/migrations/0001_initial_schema.sql` (147 non-blank lines, 1 file) — the canonical Phase 2 schema source of truth
- Closed two long-standing ARCHITECTURE.md §4 errata in source: `with check` on `plan_exercises` and `exercise_sets` policies
- Wrapped every `auth.uid()` reference as `(select auth.uid())` for query-plan caching (16 occurrences total, 0 unwrapped)
- F17 schema-only ENUM (`public.set_type`) shipped with `is_warmup` fully dropped — no compatibility shim, no dual-write window
- `handle_new_user()` trigger function ships with `SECURITY DEFINER set search_path = ''` + fully-qualified `public.profiles` (PITFALLS Pitfall 7 mitigation)
- All 6 user-scoped tables have `enable row level security` AND at least one policy in the same file (PITFALLS 2.1 + 2.2 closed)

## Task Commits

1. **Task 1: Author 0001_initial_schema.sql with errata-fixed schema, RLS, ENUM, and trigger** — `3fff397` (feat)

**Plan metadata commit:** added separately at end of plan with this SUMMARY.md.

## Files Created

- `app/supabase/migrations/0001_initial_schema.sql` (147 non-blank lines) — Initial 6-table schema for FitnessMaxxing V1: 1 ENUM + 6 tables (profiles, exercises, workout_plans, plan_exercises, workout_sessions, exercise_sets) + 4 indexes + 6 RLS-enable statements + 9 policies + 1 trigger function + 1 trigger.

## Static Verification (grep gates from PLAN acceptance_criteria)

| Gate | Expected | Actual | Status |
|------|----------|--------|--------|
| `^create type public.set_type as enum` line count | 1 | 1 | PASS |
| Tables (6 distinct `^create table public.X (`) | 6 | 6 | PASS |
| `set_type public.set_type not null default 'working'` | 1 | 1 | PASS |
| `is_warmup` anywhere in file | 0 | 0 | PASS (after Rule 3 fix) |
| `^alter table public.X enable row level security;` | 6 | 6 | PASS |
| `with check` lines (no comments) | ≥6 | 7 | PASS |
| `(select auth.uid())` line count (no comments) | ≥14 | 12 | See deviation |
| `(select auth.uid())` occurrence count (no comments) | n/a (semantic invariant) | 16 | PASS (semantic) |
| Unwrapped `auth.uid()` outside `select` (no comments) | 0 | 0 | PASS (real security gate) |
| `^create index ` count | 4 | 4 | PASS |
| `security definer set search_path = ''` | present | present | PASS |
| `insert into public.profiles (id) values (new.id);` | 1 | 1 | PASS |
| `create trigger on_auth_user_created` | present | present | PASS |
| `after insert on auth.users` | present | present | PASS |
| ENUM line < profiles table line | true | line 19 < line 24 | PASS |
| Trigger line > last policy line | true | line 163 > line 141 | PASS |
| Non-blank line count | ≥130 | 147 | PASS |
| `if (not )?exists` count (no idempotency guards) | 0 | 0 | PASS |

## Errata-fixed Policies (audit excerpt)

The two policies that closed the documented PITFALLS 2.5 errata, both with the new `with check`:

```sql
-- plan_exercises (errata fixed):
create policy "Users can manage own plan exercises" on public.plan_exercises
  for all
  using (exists (select 1 from public.workout_plans where id = plan_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_plans where id = plan_id and user_id = (select auth.uid())));

-- exercise_sets (errata fixed):
create policy "Users can manage own sets" on public.exercise_sets
  for all
  using (exists (select 1 from public.workout_sessions where id = session_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_sessions where id = session_id and user_id = (select auth.uid())));
```

Both clauses use the identical predicate (using ↔ with check parity) so a User A cannot insert a child row pointing at User B's parent — exactly the threat T-02-06 / T-02-07 mitigation in the threat register.

## Decisions Made

Followed the plan as specified. The plan's verbatim SQL block was copy-pasted into `0001_initial_schema.sql` with two minor in-comment edits (see Deviations below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed `is_warmup` mentions from inline SQL comments**

- **Found during:** Task 1 (acceptance-criteria verification)
- **Issue:** The plan's verbatim SQL block included the string `is_warmup` inside two SQL comments (header `--   - exercise_sets.is_warmup intentionally NOT created ...` and inline `-- F17 schema-only; replaces is_warmup (D-11/D-12)` on the `set_type` column line). The plan's `<verify>` automated check uses `! grep -q "is_warmup"` which matches BOTH SQL code AND comments, and the plan's `must_haves.truths` is the strict invariant "exercise_sets.is_warmup does NOT appear anywhere in the migration (D-12 — dropped, no compatibility shim)." This produced an internal plan contradiction: the verbatim SQL FAILS its own verify gate.
- **Fix:** Rewrote both comment fragments to convey the same meaning without naming the dropped column:
  - Header comment: `-- exercise_sets has no boolean warmup flag (dropped per D-12 — DB has no data, migration is free; set_type='warmup' is the canonical classification)`
  - Inline comment: `-- F17 schema-only (D-11/D-12)`
- **Files modified:** `app/supabase/migrations/0001_initial_schema.sql`
- **Verification:** Re-ran `grep -v '^[[:space:]]*--' "$SQL" | grep -q "is_warmup"` — PASS (no matches). Also `grep -q "is_warmup" "$SQL"` — PASS (no matches anywhere in file, including comments). Strict must_have satisfied.
- **Committed in:** `3fff397` (Task 1 commit)

### Verification-script counting note (NOT a code deviation)

The plan's automated `<verify>` block contains `grep -cE "\(select auth\.uid\(\)\)" >= 14` (line count). The migration produces 12 unique LINES that contain `(select auth.uid())`, but those 12 lines hold 16 OCCURRENCES because lines like `for update using (...) with check (...)` contain the wrap twice but `grep -c` counts each matching line only once. The semantic invariant the plan actually cares about — "Every auth.uid() reference inside an RLS policy is wrapped as (select auth.uid())" — is fully satisfied: the orthogonal check `grep -v '^--' | grep -cE "[^t] auth\.uid\(\)"` returns 0 unwrapped occurrences, and `grep -oE "\(select auth\.uid\(\)\)" | wc -l` returns 16 wrapped occurrences. This is a counting bug in the plan's verify script, not a deviation in the deployed schema. Recommend Plan 02-06 (doc reconciliation) update either the count threshold or use `grep -o ... | wc -l` for occurrence count instead of line count.

---

**Total deviations:** 1 auto-fixed (1 Rule-3 blocking — plan's verbatim SQL contradicted its own must_haves invariant)
**Impact on plan:** Comment-only edits, zero impact on deployed schema semantics. The Rule-3 fix preserves the rationale (D-11/D-12) in different wording. Verification-script counting note flagged for Plan 02-06 to address.

## Issues Encountered

None. The migrations directory did not exist (Plan 01's `supabase init` only created `app/supabase/.gitignore` and `app/supabase/config.toml`); created with `mkdir -p app/supabase/migrations` before writing the file. Pre-existing `app/supabase/.gitignore` was inspected and confirmed not to ignore `migrations/`.

## Known Stubs

None. This plan ships pure DDL — every table, column, ENUM, index, RLS policy, and trigger has its final V1 form. The `display_name` column on `profiles` is intentionally NOT populated by the trigger (D-16, deferred to user-driven Settings UI in V1.1) but the column itself is fully shaped and not a stub.

## Next Plan Readiness

- **Plan 02-03 (db push):** Migration file is ready for `cd app && npx supabase db push`. The link to project `mokmiuifpdzwnceufduu` was established in Plan 01 (verified by config.toml committed). Plan 02-03 will need `SUPABASE_DB_PASSWORD` from `app/.env.local` per Plan 01's credential surface.
- **Plan 02-04 (gen:types):** After 02-03 push lands, the generated `app/types/database.ts` should mention all 6 tables AND emit `set_type` as a TS string-literal union `'working' | 'warmup' | 'dropset' | 'failure'`.
- **Plan 02-05 (cross-user RLS test):** The `with check` errata fixes on `plan_exercises` and `exercise_sets` are the load-bearing assertions in the test script — User A inserting a child row pointing at User B's parent must be rejected. This is the regression test for the errata fix.
- **Plan 02-06 (doc reconciliation):** Should also fix the verify-script line-count vs occurrence-count bug noted in the Deviations section above.

## Self-Check: PASSED

Verified before commit:
- File `app/supabase/migrations/0001_initial_schema.sql` exists at the worktree path: FOUND
- Commit `3fff397` exists in `git log`: FOUND
- All static-grep gates listed in the verification table above resolved as documented (10 PASS / 1 semantic-PASS / 1 noted as plan verify-script bug)

---
*Phase: 02-schema-rls-type-generation*
*Completed: 2026-05-08*
