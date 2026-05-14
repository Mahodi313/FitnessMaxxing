-- ============================================================================
-- Phase 5 gap-closure (FIT-7) — Migration 0004
--
-- Server-side set_number assignment via BEFORE INSERT trigger.
-- SUPERSEDES Phase 5 D-16 (client-side count+1; race accepted). Combined
-- with Migration 0003 UNIQUE constraint, eliminates the slow-hydration
-- race documented in UAT 2026-05-13.
--
-- NOTE: function is SECURITY INVOKER (default — NO `security definer`) so
-- it respects the "Users can manage own sets" RLS policy on
-- public.exercise_sets. The SELECT MAX(set_number) inside the function
-- only sees rows the inserting user can read.
--
-- Defense-in-depth: `set search_path = ''` per CLAUDE.md security
-- conventions (Pitfall 7 — applies to INVOKER functions too). All schema
-- references inside the function body are fully qualified.
--
-- Concurrency: Two concurrent INSERTs into the same (session_id,
-- exercise_id) with NULL set_number could both compute the same MAX+1
-- before either commits. The UNIQUE constraint from Migration 0003
-- catches this — the second INSERT fails with 23505 unique_violation.
-- PostgREST surfaces 23505 as HTTP 409. The client retry path
-- (`retry: 1` in client.ts) plus the existing
-- `upsert(..., { onConflict: 'id', ignoreDuplicates: true })` handle it
-- idempotently because the id is client-generated and stable across
-- retries — the duplicate retry is a no-op once the first INSERT lands.
--
-- Trigger + function identifiers are referenced by
-- app/scripts/verify-deploy.ts (pg_proc + pg_trigger output).
-- ============================================================================

create or replace function public.assign_exercise_set_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Backward-compatible guard: callers that still supply set_number
  -- (e.g., test-rls.ts uniqueness assertion, replays of paused
  -- mutations from before this migration deploys) keep their value.
  -- New default behavior (omit set_number) lands here and the trigger
  -- assigns the next per-(session,exercise) value.
  if new.set_number is null then
    new.set_number := coalesce(
      (
        select max(set_number) + 1
        from public.exercise_sets
        where session_id = new.session_id
          and exercise_id = new.exercise_id
      ),
      1
    );
  end if;
  return new;
end;
$$;

create trigger assign_set_number_before_insert
  before insert on public.exercise_sets
  for each row
  execute function public.assign_exercise_set_number();
