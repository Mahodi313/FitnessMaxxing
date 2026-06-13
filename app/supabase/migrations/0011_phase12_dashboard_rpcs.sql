-- ============================================================================
-- Phase 12 — Migration 0011
--
-- TWO read-only aggregate RPC functions backing the Home dashboard hero, the
-- History volume card + lifetime eyebrow, and the Exercise-chart hero + 3-stat
-- row (DASH-01 … DASH-05, D-12 / D-14):
--
--   - public.get_dashboard_summary(p_tz text default 'Europe/Stockholm')
--       Single-row combined aggregate for BOTH the Home hero AND the History
--       volume card / lifetime eyebrow. Used by the client's
--       useDashboardSummaryQuery (Plan 12-02). Returns, in canonical kg
--       (client converts to display unit via lib/units.ts, D-20):
--         sessions_this_week    — DASH-01 ring numerator (current local Mon–Sun)
--         weekly_goal           — DASH-01 ring denominator (profiles.weekly_goal)
--         streak_weeks          — DASH-02 consecutive goal-weeks (gaps-and-islands)
--         volume_this_week_kg   — DASH-03 this-week working-set tonnage
--         volume_prior_week_kg  — DASH-03 prior-week tonnage (delta basis)
--         weekly_volume_series  — DASH-04 jsonb [{week, volume_kg}] last 12 weeks
--         lifetime_sessions     — D-09 eyebrow: total finished-session count
--         lifetime_hours        — D-09 eyebrow: Σ session duration (hours)
--
--   - public.get_exercise_summary(p_exercise_id uuid, p_metric text, p_since timestamptz)
--       Single-row per-exercise summary for the chart hero + 3-stat row. Used by
--       the client's useExerciseSummaryQuery (Plan 12-02). Returns (canonical kg):
--         current_best        — D-12 hero: max working weight (p_metric='weight')
--                               OR latest-finished-session volume (p_metric='volume')
--         range_first_value   — earliest in-range value of the same metric, for the
--                               client-computed hero delta (current_best - range_first_value)
--         top_set_weight_kg   — D-14: heaviest working set in range
--         top_set_reps        — D-14: its reps (renders "{w} × {r}")
--         vol_per_session_kg  — D-14: avg Σ working-set volume over finished
--                               sessions IN RANGE THAT CONTAIN this exercise (RESOLVED
--                               denominator — sessions containing the exercise, not all)
--         avg_rpe             — D-14: AVG(rpe) over working sets in range; NULL when
--                               every working set has NULL rpe → UI shows '–'
--
-- All functions are SECURITY INVOKER (default — NO `security definer`) so they
-- respect RLS on workout_sessions + exercise_sets + profiles. The caller's JWT
-- user_id flows into the underlying RLS policies that already exist from
-- migration 0001 (lines 110-144), giving server-side cross-user scoping for free
-- (the cross-user test:rls assertions in scripts/test-rls.ts prove B's data never
-- inflates A's aggregates). [D-23, copied from 0006_phase6_chart_rpcs.sql]
--
-- Defense-in-depth: `set search_path = ''` per CLAUDE.md security conventions
-- (Pitfall 7 — applies to INVOKER functions too; blocks search_path hijack,
-- T-12-04). All schema references inside the function bodies are fully qualified
-- (`public.workout_sessions`, `public.exercise_sets`, `public.profiles`).
--
-- Set-type canonical: every volume / weight / RPE aggregate filters
-- `set_type = 'working'` so the dashboard numbers match F7's last-value semantics
-- and the existing working-set convention (ARCHITECTURE §5; V1.1 F17-UI rollout
-- will not retroactively change history aggregates). Only finished sessions count
-- (`s.finished_at is not null`).
--
-- Week boundary (D-06): `date_trunc('week', ...)` is Monday-based (ISO 8601, no
-- configurable week start), exactly matching the Swedish Mon–Sun convention. The
-- load-bearing nuance is the local-time conversion: `started_at` is timestamptz
-- (UTC). A session logged Sunday 23:30 local is still Sunday locally, so we
-- convert to the caller's IANA timezone BEFORE truncating —
-- `date_trunc('week', s.started_at at time zone p_tz)` — to bucket
-- late-Sunday / early-Monday sessions into the correct ISO week (Pitfall 1).
-- `p_tz` is used ONLY inside `at time zone p_tz` (Postgres validates the zone
-- string; never concatenated into dynamic SQL → no injection vector, T-12-03).
--
-- Function identifiers are referenced by app/scripts/verify-deploy.ts
-- (phase12Functions pg_proc INVOKER + search_path check) and the cross-user
-- assertions in app/scripts/test-rls.ts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. get_dashboard_summary — combined Home hero + History card/eyebrow aggregate.
--    Single-row return (client takes data[0]). All figures in canonical kg.
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard_summary(
  p_tz text default 'Europe/Stockholm'
)
returns table (
  sessions_this_week   int,
  weekly_goal          int,
  streak_weeks         int,
  volume_this_week_kg  numeric,
  volume_prior_week_kg numeric,
  weekly_volume_series jsonb,
  lifetime_sessions    int,
  lifetime_hours       numeric
)
language sql
security invoker
stable
set search_path = ''
as $$
  with
  -- One row per finished session with its LOCAL ISO-week start (Mon-based) and
  -- its working-set tonnage. RLS scopes workout_sessions to the caller.
  sess as (
    select
      s.id,
      date_trunc('week', s.started_at at time zone p_tz) as wk,
      s.started_at,
      s.finished_at,
      coalesce((
        select sum(es.weight_kg * es.reps)
        from public.exercise_sets es
        where es.session_id = s.id
          and es.set_type = 'working'
      ), 0) as vol_kg
    from public.workout_sessions s
    where s.finished_at is not null
  ),
  -- Current + prior local ISO weeks, computed once in the caller's tz.
  bounds as (
    select
      date_trunc('week', (now() at time zone p_tz)) as this_wk,
      date_trunc('week', (now() at time zone p_tz)) - interval '7 days' as prior_wk
  ),
  -- Per-week aggregates (count + tonnage), keyed by local week-start.
  weekly as (
    select wk, count(*) as n, coalesce(sum(vol_kg), 0) as vol
    from sess
    group by wk
  ),
  -- Sparkline spine: last 12 calendar weeks incl. the current one (DASH-04, D-08).
  series as (
    select coalesce(jsonb_agg(
             jsonb_build_object(
               'week', to_char(g.wk, 'YYYY-MM-DD'),
               'volume_kg', coalesce(w.vol, 0)
             )
             order by g.wk
           ), '[]'::jsonb) as s
    from (
      select (date_trunc('week', (now() at time zone p_tz)) - (i || ' weeks')::interval) as wk
      from generate_series(11, 0, -1) as i
    ) g
    left join weekly w on w.wk = g.wk
  ),
  -- Streak: consecutive goal-weeks (D-07). Build a 60-week calendar spine
  -- (newest first), flag each week met/not-met vs weekly_goal, partition into
  -- islands of consecutive met-weeks (classic gaps-and-islands), and take the
  -- island that contains the most-recent met week — but only if that island is
  -- "live", i.e. it touches THIS week (rn=1) or LAST week (rn=2). This encodes
  -- the LOCKED in-progress-week boundary (RESEARCH A2 / OQ-1): an in-progress
  -- current week that has ALREADY met the goal counts; one that has NOT YET met
  -- it does not BREAK the prior streak; a fully-missed last week ends it.
  -- Locked + proven by scripts/test-dashboard-aggregates.ts.
  goal as (
    select coalesce(weekly_goal, 3) as g
    from public.profiles
    limit 1
  ),
  qualifying as (
    select date_trunc('week', s.started_at at time zone p_tz) as wk
    from public.workout_sessions s
    where s.finished_at is not null
    group by 1
    having count(*) >= (select g from goal)
  ),
  weeks as (
    select (date_trunc('week', (now() at time zone p_tz)) - (i || ' weeks')::interval) as wk
    from generate_series(0, 59) as i
  ),
  flagged as (
    select
      w.wk,
      (q.wk is not null) as met,
      row_number() over (order by w.wk desc) as rn
    from weeks w
    left join qualifying q on q.wk = w.wk
  ),
  islands as (
    select
      rn,
      rn - row_number() over (partition by met order by rn) as grp
    from flagged
    where met
  ),
  streak as (
    select coalesce((
      select count(*)::int
      from islands
      where grp = (select grp from islands order by rn asc limit 1)
        and (select min(rn) from islands) <= 2
    ), 0) as weeks
  )
  select
    coalesce((select n from weekly, bounds where wk = this_wk), 0)::int        as sessions_this_week,
    (select g from goal)::int                                                  as weekly_goal,
    (select weeks from streak)                                                 as streak_weeks,
    coalesce((select vol from weekly, bounds where wk = this_wk), 0)           as volume_this_week_kg,
    coalesce((select vol from weekly, bounds where wk = prior_wk), 0)          as volume_prior_week_kg,
    (select s from series)                                                     as weekly_volume_series,
    (select count(*) from sess)::int                                           as lifetime_sessions,
    coalesce((
      select sum(extract(epoch from (finished_at - started_at)) / 3600.0)
      from sess
    ), 0)                                                                      as lifetime_hours;
$$;

revoke all on function public.get_dashboard_summary(text) from public;
grant execute on function public.get_dashboard_summary(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_exercise_summary — chart hero + 3-stat row for ONE exercise over range.
--    Single-row return (client takes data[0]). All figures in canonical kg.
--    p_since null = "All" range (D-11); same nullable-timestamptz idiom as 0006.
-- ---------------------------------------------------------------------------
create or replace function public.get_exercise_summary(
  p_exercise_id uuid,
  p_metric text,
  p_since timestamptz
)
returns table (
  current_best       numeric,
  range_first_value  numeric,
  top_set_weight_kg  numeric,
  top_set_reps       int,
  vol_per_session_kg numeric,
  avg_rpe            numeric
)
language sql
security invoker
stable
set search_path = ''
as $$
  with
  -- Working sets of this exercise from finished sessions in range. RLS scopes
  -- exercise_sets + workout_sessions to the caller via the 0001 parent-FK policy.
  sets as (
    select
      es.weight_kg,
      es.reps,
      es.rpe,
      es.weight_kg * es.reps as vol_kg,
      s.id          as session_id,
      s.finished_at as finished_at
    from public.exercise_sets es
    inner join public.workout_sessions s
      on s.id = es.session_id
     and s.finished_at is not null
    where es.exercise_id = p_exercise_id
      and es.set_type = 'working'
      and (p_since is null or es.completed_at >= p_since)
  ),
  -- Per-session totals (for the volume metric + vol-per-session denominator),
  -- ordered so the latest finished session is identifiable.
  per_session as (
    select session_id, finished_at, sum(vol_kg) as session_vol_kg
    from sets
    group by session_id, finished_at
  )
  select
    -- current_best: max working weight (weight metric) OR latest-session volume.
    case
      when p_metric = 'weight' then (select max(weight_kg) from sets)
      when p_metric = 'volume' then (
        select session_vol_kg from per_session order by finished_at desc limit 1
      )
    end                                                              as current_best,
    -- range_first_value: earliest in-range value of the same metric (hero delta basis).
    case
      when p_metric = 'weight' then (
        select weight_kg from sets order by finished_at asc, weight_kg desc limit 1
      )
      when p_metric = 'volume' then (
        select session_vol_kg from per_session order by finished_at asc limit 1
      )
    end                                                              as range_first_value,
    -- top set: heaviest working set in range (tiebreak: most reps), and its reps.
    (select weight_kg from sets order by weight_kg desc, reps desc limit 1) as top_set_weight_kg,
    (select reps from sets order by weight_kg desc, reps desc limit 1)::int as top_set_reps,
    -- vol-per-session: averaged over sessions in range that CONTAIN this exercise.
    (select avg(session_vol_kg) from per_session)                   as vol_per_session_kg,
    -- avg RPE: AVG ignores NULLs, returns NULL only when ALL working sets are
    -- NULL → UI renders '–' (D-14). rpe is nullable numeric(3,1) per 0001.
    (select avg(rpe) from sets)                                     as avg_rpe;
$$;

revoke all on function public.get_exercise_summary(uuid, text, timestamptz) from public;
grant execute on function public.get_exercise_summary(uuid, text, timestamptz) to authenticated;
