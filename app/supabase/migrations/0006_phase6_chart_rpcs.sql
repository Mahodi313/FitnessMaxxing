-- ============================================================================
-- Phase 6 — Migration 0006
--
-- THREE RPC functions for read-side polish (F9 history list + F10 chart):
--   - public.get_session_summaries(p_cursor timestamptz, p_page_size int)
--       F9 cursor-paginated list of finished sessions with aggregated
--       set_count + total_volume_kg + LEFT JOIN plan name. Used by the
--       client's useSessionsListInfiniteQuery (Plan 06-01b).
--   - public.get_exercise_chart(p_exercise_id uuid, p_metric text, p_since timestamptz)
--       F10 per-day aggregate (max weight OR total volume) for a single
--       exercise. Used by the client's useExerciseChartQuery (Plan 06-03).
--   - public.get_exercise_top_sets(p_exercise_id uuid, p_since timestamptz, p_limit int)
--       F10 "Senaste 10 passen" list (BLOCKER-2 fix). Returns ONE ROW PER
--       SOURCE SESSION — the top working-set of that session for the given
--       exercise (max weight, tiebreak on most-recent completed_at) — with
--       (session_id, completed_at, weight_kg, reps) so the UI can render
--       `${top_set.weight_kg} kg × ${top_set.reps}` per UI-SPEC line 265
--       and route to the source session (D-20 tap-to-route).
--
-- All three functions are SECURITY INVOKER (default — NO `security definer`)
-- so they respect RLS on workout_sessions + exercise_sets + workout_plans.
-- The caller's JWT user_id flows into the underlying RLS policies that
-- already exist from migration 0001 (lines 110-144), giving server-side
-- cross-user scoping for free.
--
-- Defense-in-depth: `set search_path = ''` per CLAUDE.md security conventions
-- (Pitfall 7 — applies to INVOKER functions too). All schema references
-- inside the function bodies are fully qualified (`public.workout_sessions`,
-- `public.exercise_sets`, `public.workout_plans`).
--
-- Set-type canonical: every aggregate filters `set_type = 'working'` so the
-- aggregates and chart values match F7's last-value semantics and the existing
-- working-set convention (ARCHITECTURE §5 + RESEARCH A1 — V1.1 F17-UI rollout
-- will not retroactively change history counts).
--
-- FK on delete cascade: `exercise_sets.session_id` already has
-- `references public.workout_sessions(id) on delete cascade` from migration
-- 0001 (line 74) — no schema change needed for Plan 06-02 delete-session
-- cascade behaviour. Plan 06-01a's test-rls.ts extension asserts this works
-- for the owner-DELETE path.
--
-- Function identifiers are referenced by app/scripts/verify-deploy.ts
-- (pg_proc output).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. get_session_summaries — F9 history list, cursor-paginated.
-- ---------------------------------------------------------------------------
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
    p.name as plan_name,
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
  group by s.id, p.name
  order by s.started_at desc
  limit p_page_size;
$$;

revoke all on function public.get_session_summaries(timestamptz, int) from public;
grant execute on function public.get_session_summaries(timestamptz, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_exercise_chart — F10 per-day aggregate for one exercise.
-- ---------------------------------------------------------------------------
create or replace function public.get_exercise_chart(
  p_exercise_id uuid,
  p_metric text,
  p_since timestamptz
)
returns table (
  day timestamptz,
  value numeric
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    date_trunc('day', es.completed_at) as day,
    case
      when p_metric = 'weight' then max(es.weight_kg)
      when p_metric = 'volume' then sum(es.weight_kg * es.reps)
    end as value
  from public.exercise_sets es
  inner join public.workout_sessions s
    on s.id = es.session_id
   and s.finished_at is not null
  where es.exercise_id = p_exercise_id
    and es.set_type = 'working'
    and (p_since is null or es.completed_at >= p_since)
  group by date_trunc('day', es.completed_at)
  order by date_trunc('day', es.completed_at) asc;
$$;

revoke all on function public.get_exercise_chart(uuid, text, timestamptz) from public;
grant execute on function public.get_exercise_chart(uuid, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_exercise_top_sets — F10 "Senaste 10 passen" list (BLOCKER-2 fix).
--
-- Returns ONE ROW PER SOURCE SESSION — the top working-set of that session
-- for the given exercise (max weight, tiebreak on most-recent completed_at).
-- The outer wrapper re-orders most-recent-session first and applies p_limit.
--
-- The `distinct on (es.session_id) order by es.session_id, es.weight_kg desc`
-- collapse picks the max-weight working-set per session in one pass (no
-- window-function overhead). The outer ORDER BY does NOT have to match the
-- inner ORDER BY column-by-column — Postgres re-sorts the deduplicated rows.
-- ---------------------------------------------------------------------------
create or replace function public.get_exercise_top_sets(
  p_exercise_id uuid,
  p_since timestamptz,
  p_limit int default 10
)
returns table (
  session_id uuid,
  completed_at timestamptz,
  weight_kg numeric,
  reps int
)
language sql
security invoker
stable
set search_path = ''
as $$
  select session_id, completed_at, weight_kg, reps
  from (
    select distinct on (es.session_id)
      es.session_id,
      es.completed_at,
      es.weight_kg,
      es.reps
    from public.exercise_sets es
    inner join public.workout_sessions s
      on s.id = es.session_id
     and s.finished_at is not null
    where es.exercise_id = p_exercise_id
      and es.set_type = 'working'
      and (p_since is null or es.completed_at >= p_since)
    order by es.session_id, es.weight_kg desc, es.completed_at desc
  ) tops
  order by completed_at desc
  limit p_limit;
$$;

revoke all on function public.get_exercise_top_sets(uuid, timestamptz, int) from public;
grant execute on function public.get_exercise_top_sets(uuid, timestamptz, int) to authenticated;
