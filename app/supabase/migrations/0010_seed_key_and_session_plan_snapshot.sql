-- File: app/supabase/migrations/0010_seed_key_and_session_plan_snapshot.sql
--
-- Phase 10 (Plans & Exercises Re-Skin), Plan 10-01.
-- One cohesive migration laying the schema foundation for the phase (D-06 + D-11,
-- 10-RESEARCH §migration cohesion). Additive only — no DROP, no destructive DDL.
--
-- Contents (in order):
--   (1) exercises.seed_key       — D-06: nullable bilingual seed identifier.
--   (2) workout_sessions.plan_name_snapshot — D-11: load-bearing for hard-delete
--       history readability (plan_id FK is already ON DELETE SET NULL from 0001).
--   (3) one-time backfill of plan_name_snapshot for pre-existing sessions.
--   (4) get_session_summaries re-deploy — coalesce(p.name, s.plan_name_snapshot)
--       so a hard-deleted plan's sessions still render the plan name in history.
--
-- ----------------------------------------------------------------------------
-- (1) exercises.seed_key (D-06)
--
-- RLS: NO new policy. public.exercises is already RLS-enabled (0001 lines 116-124)
-- with own-row policies that are COLUMN-AGNOSTIC — they scope by (user_id IS NULL
-- OR user_id = (select auth.uid())) on the ROW, so the new column inherits the
-- same protection. Adding a per-column policy would be redundant and is forbidden
-- by CLAUDE.md DB conventions (one policy pair per table).
-- ----------------------------------------------------------------------------
alter table public.exercises
  add column seed_key text;

-- ----------------------------------------------------------------------------
-- (2) workout_sessions.plan_name_snapshot (D-11)
--
-- load-bearing for D-11; plan_id FK is already ON DELETE SET NULL (0001 line 65),
-- so hard-deleting a plan nulls workout_sessions.plan_id without removing the
-- session. The snapshot column preserves the plan's display name for history.
-- Own-row workout_sessions policies (0001) cover this column unchanged.
-- ----------------------------------------------------------------------------
alter table public.workout_sessions
  add column plan_name_snapshot text;

-- ----------------------------------------------------------------------------
-- (3) one-time backfill — populate plan_name_snapshot for sessions that still
-- have a live plan_id (so pre-existing history reads identically after the
-- coalesce switch below). Only touches rows where the snapshot is NULL.
-- ----------------------------------------------------------------------------
update public.workout_sessions s
   set plan_name_snapshot = p.name
  from public.workout_plans p
 where p.id = s.plan_id
   and s.plan_name_snapshot is null;

-- ----------------------------------------------------------------------------
-- (4) get_session_summaries re-deploy (verbatim 0006 body, one-line change).
--
-- ONLY change vs 0006: `p.name as plan_name` → `coalesce(p.name, s.plan_name_snapshot)`
-- and `s.plan_name_snapshot` added to the GROUP BY (functionally dependent on the
-- already-grouped s.id). Everything else — language sql / security invoker /
-- stable / set search_path = '' + the revoke/grant pair — is preserved EXACTLY so
-- the security posture (T-10-03) does not regress.
-- ----------------------------------------------------------------------------
create or replace function public.get_session_summaries(
  p_cursor timestamptz,
  p_page_size int default 20
)
returns table (
  id uuid,
  user_id uuid,
  plan_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  plan_name text,
  set_count bigint,
  total_volume_kg numeric
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    s.id,
    s.user_id,
    s.plan_id,
    s.started_at,
    s.finished_at,
    coalesce(p.name, s.plan_name_snapshot) as plan_name,
    coalesce(count(es.id), 0)::bigint as set_count,
    coalesce(sum(es.weight_kg * es.reps), 0) as total_volume_kg
  from public.workout_sessions s
  left join public.workout_plans p
    on p.id = s.plan_id
  left join public.exercise_sets es
    on es.session_id = s.id
   and es.set_type = 'working'
  where s.finished_at is not null
    and (p_cursor is null or s.started_at < p_cursor)
  group by s.id, p.name, s.plan_name_snapshot
  order by s.started_at desc
  limit p_page_size;
$$;

revoke all on function public.get_session_summaries(timestamptz, int) from public;
grant execute on function public.get_session_summaries(timestamptz, int) to authenticated;
