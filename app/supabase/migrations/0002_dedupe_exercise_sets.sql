-- ============================================================================
-- Phase 5 gap-closure (FIT-7) — Migration 0002
--
-- Removes duplicate (session_id, exercise_id, set_number) rows produced under
-- the D-16 client-side set_number race (UAT 2026-05-13, session
-- 379cfd29-a06f-4dbc-b429-ab273b16c096 — 6 silent duplicates). Keeps the
-- OLDEST row by completed_at per tuple, then `id` as a deterministic
-- tiebreaker when completed_at ties or is null.
--
-- MUST run BEFORE 0003 (UNIQUE constraint) or 0003 will fail.
--
-- References Gap #1 in 05-HUMAN-UAT.md. The kept-row choice is auditable from
-- inspect-duplicate-sets.ts output captured pre-migration.
-- ============================================================================

begin;

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

commit;
