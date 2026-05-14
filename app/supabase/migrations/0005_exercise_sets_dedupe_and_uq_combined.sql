-- ============================================================================
-- Phase 5 review-fix (CR-01) — Migration 0005
--
-- SUPERSEDER + idempotent replay of 0002 + 0003 for V1.1+ multi-device
-- contract correctness. Authored 2026-05-14 in response to 05-REVIEW.md
-- CR-01: "Migrations 0002 + 0003 TOCTOU window — concurrent INSERTs during
-- dedupe can re-introduce duplicates before UNIQUE constraint lands."
--
-- Background — why this migration exists:
--   The original gap-closure split dedupe (0002) and constraint creation
--   (0003) into two separate migration files. Supabase CLI applies each
--   migration in its own top-level transaction. Between the commit of 0002
--   and the moment 0003's ALTER TABLE acquires ACCESS EXCLUSIVE, any client
--   running pre-FIT-7 code (computing set_number = count + 1 client-side)
--   could INSERT a fresh duplicate. Migration 0003 would then fail with
--   23505 unique_violation at constraint-creation time, leaving the schema
--   permanently out-of-sync with the migration chain until manual
--   remediation.
--
--   For personal V1 (single-user / single-device) the practical risk is
--   near-zero — the deployer IS the writer. But the migration files persist
--   for the lifetime of the codebase, and V1.1+ explicitly contemplates
--   multi-device sync. Re-running this migration chain on a fresh DB while
--   any D-16-era client is still installed on a user's phone WILL fire the
--   failure mode. The contract integrity that motivated D-16's supersession
--   in the first place demanded closing this hole on the migration path too.
--
-- What this migration does (idempotent — safe to replay on already-fixed DB):
--   1. Open an explicit `begin;` block (Supabase CLI does NOT auto-wrap
--      migrations in a transaction — observed empirically 2026-05-14 when
--      this file first hit the deployed DB and `LOCK TABLE` raised
--      SQLSTATE 25P01 "can only be used in transaction blocks"; the
--      sibling migration 0002 also uses explicit begin/commit). Take
--      `LOCK TABLE public.exercise_sets IN ACCESS EXCLUSIVE MODE` as the
--      first statement inside the block — this blocks ALL concurrent
--      INSERT/UPDATE/DELETE on the table from the moment of acquisition
--      until commit, closing the TOCTOU window.
--   2. Re-run the dedupe CTE from 0002. On a freshly-broken DB this deletes
--      duplicate rows. On the deployed DB (already deduped by 0002 + 0003)
--      the CTE produces no rn > 1 rows, so the DELETE is a no-op.
--   3. Conditionally add the natural-key UNIQUE constraint
--      `exercise_sets_session_exercise_setno_uq`. Postgres does not support
--      `ADD CONSTRAINT IF NOT EXISTS` directly for table constraints, so
--      this is wrapped in a DO block that checks pg_constraint first.
--      On the deployed DB the constraint already exists from 0003, so this
--      branch is skipped. On a fresh DB it adds the constraint while the
--      LOCK from step 1 is still held — preventing any racing INSERT from
--      slipping between dedupe and constraint creation.
--
-- Why we don't supersede 0002 + 0003 in place:
--   0002 and 0003 are ALREADY APPLIED to the deployed DB; rewriting them
--   would create a hash-mismatch on Supabase's `supabase_migrations` table
--   and break `supabase db push`. Adding 0005 as a SUPERSEDER preserves the
--   audit trail of what actually ran in deployment history while making the
--   contract reproducible against any fresh DB.
--
-- Keep-row policy (mirrors WR-05 clarification on 0002): `order by
-- completed_at asc nulls last, id asc` keeps the OLDEST non-NULL completed_at
-- row per (session_id, exercise_id, set_number) tuple. Rows with
-- completed_at IS NULL rank LAST under `nulls last` and become deletion
-- candidates — preserving the latest known completion time over an
-- in-flight/incomplete row. If ALL rows in a tuple have NULL completed_at
-- (unreachable in practice — exercise_sets.completed_at has `default now()`),
-- the tiebreaker falls to `id ASC`, deterministic but not temporally
-- meaningful.
--
-- References:
--   - 05-REVIEW.md CR-01
--   - 05-04-PLAN.md frontmatter `deviates_from` (D-16 supersession audit trail)
--   - app/scripts/verify-deploy.ts (asserts the constraint name)
-- ============================================================================

begin;

-- Step 1: exclusive lock — closes the TOCTOU window for the full transaction.
-- Released at COMMIT below.
lock table public.exercise_sets in access exclusive mode;

-- Step 2: idempotent dedupe — same CTE shape as 0002. On the already-deduped
-- deployed DB this matches zero rows (no rn > 1). On a fresh DB it removes
-- duplicates produced by D-16-era client races.
with ranked as (
  select
    id,
    row_number() over (
      partition by session_id, exercise_id, set_number
      order by completed_at asc nulls last, id asc
    ) as rn
  from public.exercise_sets
)
delete from public.exercise_sets es
using ranked r
where es.id = r.id
  and r.rn > 1;

-- Step 3: conditionally add the natural-key UNIQUE constraint. ALTER TABLE
-- ADD CONSTRAINT has no IF NOT EXISTS variant for table constraints in
-- Postgres 16, so we guard the ADD via a pg_constraint lookup wrapped in
-- a DO block. On the deployed DB (constraint added by 0003) this branch is
-- skipped; on a fresh DB the constraint lands while the table is still held
-- under ACCESS EXCLUSIVE from step 1.
do $$
begin
  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'exercise_sets'
      and con.conname = 'exercise_sets_session_exercise_setno_uq'
  ) then
    alter table public.exercise_sets
      add constraint exercise_sets_session_exercise_setno_uq
      unique (session_id, exercise_id, set_number);
  end if;
end
$$;

commit;
