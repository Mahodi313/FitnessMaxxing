-- ============================================================================
-- Phase 13 — Migration 0012 (PR celebration, F18)
--
-- FOUR read-only RPC functions backing the live PR-detection baseline, the
-- chronological PR-at-log-time derivation, the chart-hero range sets, and the
-- history-list session-level has_pr aggregator (PR-01 / PR-04 / PR-05,
-- D-02 / D-03 / D-04 / D-05 / D-06 / D-08 / D-14 / D-15 / D-16):
--
--   - public.get_exercise_pr_history(p_exercise_id uuid)
--       The chronological running-max window ENGINE. Returns every working set
--       of the exercise (finished sessions only) with a `was_pr` flag that is
--       PR-at-log-time (D-14 / D-15): a set is a PR iff its internal SQL e1RM
--       strictly exceeds the running max of all STRICTLY-PRIOR working sets.
--       Its running-max endpoint also IS the all-time best. Used by the chart's
--       per-set PR markers. RAW weight_kg / reps only — no e1RM column (D-08).
--
--   - public.get_best_working_sets()
--       All-time-best working set per exercise (max internal e1RM), across ALL
--       the caller's finished sessions. The OFFLINE-FIRST live-detection
--       baseline (D-06): the client caches this and compares a freshly-logged
--       set against it on-device. Returns RAW weight_kg / reps (D-08); JS
--       recomputes the displayed e1RM via lib/e1rm.ts.
--
--   - public.get_exercise_sets_in_range(p_exercise_id uuid, p_since timestamptz)
--       Raw working sets for ONE exercise in range (p_since null = "All"). Feeds
--       the chart hero e1RM max + earliest-vs-best range delta (D-16 / PR-05).
--       NOT an extension of get_exercise_summary — that would re-open a 2nd
--       formula home and violate D-08. RAW sets only; JS computes every numeral.
--
--   - public.get_session_pr_flags(p_session_ids uuid[])
--       Session-level has_pr aggregator: for each supplied session, true iff ANY
--       of its working sets was a PR-at-log-time. Reuses the SAME chronological
--       running-max engine as get_exercise_pr_history, but PARTITIONED PER
--       EXERCISE so PR semantics are per-exercise (a heavy bench must not
--       suppress a squat PR). Lets the history LIST derive per-session trophies
--       with ONE call over the visible session-id list (hooks-legal; RESEARCH A3
--       / Open Question 1). Returns only the boolean flag — no e1RM (D-08).
--
-- All four functions are SECURITY INVOKER (default — NO `security definer`) so
-- they respect RLS on exercise_sets + workout_sessions. The caller's JWT
-- user_id flows into the underlying RLS policies that already exist from
-- migration 0001 (lines 110-144), giving server-side cross-user scoping for
-- free — including get_session_pr_flags, whose `ranked` CTE only ever sees the
-- caller's own sets, so a caller passing B's session_ids gets zero rows for
-- them (the cross-user test:rls assertions in scripts/test-rls.ts prove this).
--
-- Defense-in-depth: `set search_path = ''` per CLAUDE.md security conventions
-- (Pitfall 7 — applies to INVOKER functions too; blocks search_path hijack,
-- T-13-02). All schema references inside the function bodies are fully qualified
-- (`public.exercise_sets`, `public.workout_sessions`).
--
-- Set-type / data-quality canonical: every aggregate filters
-- `es.set_type = 'working'` (D-03) AND `es.weight_kg > 0` (D-04) so warmups and
-- bodyweight/zero-load rows never enter the PR engine, and only finished
-- sessions count (`s.finished_at is not null`).
--
-- INTERNAL e1RM ordering (D-08, T-13-05): the SQL e1RM expression
-- `weight_kg * (1 + reps / 30.0)` is used ONLY for internal ordering / PR
-- flagging and is NEVER returned as a display column. `30.0` is float division
-- (NOT bare `/ 30` integer division — Pitfall 3) so e.g. reps=10 contributes
-- 0.3333…, not 0. Every displayed numeral comes from app/lib/e1rm.ts.
--
-- PR-window correctness (Pitfalls 1 + 2 + D-02 + D-05):
--   * `rows between unbounded preceding and 1 preceding` — the frame covers
--     STRICTLY-PRIOR sets only. The default window frame INCLUDES the current
--     row, which would make every set "not greater than itself" → no PR ever
--     flags. (Pitfall 1.)
--   * `order by completed_at, <id>` — deterministic tiebreak on identical
--     timestamps so the running max is reproducible. (Pitfall 2.)
--   * first set → empty frame → `max(...) over ...` is NULL → `coalesce(..., false)`
--     → was_pr = false (D-02 baseline is NOT a PR).
--   * strict `>` → a TIE is NOT a PR; only a genuine increase counts (D-05).
--
-- Function identifiers are referenced by app/scripts/verify-deploy.ts
-- (phase13Functions pg_proc INVOKER + search_path check) and the cross-user
-- assertions in app/scripts/test-rls.ts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. get_exercise_pr_history — chronological running-max window engine.
--    One row per working set of the exercise (finished sessions only), in
--    chronological order, each flagged was_pr (PR-at-log-time). RAW sets only.
-- ---------------------------------------------------------------------------
create or replace function public.get_exercise_pr_history(
  p_exercise_id uuid
)
returns table (
  set_id uuid,
  session_id uuid,
  completed_at timestamptz,
  weight_kg numeric,
  reps int,
  was_pr boolean
)
language sql
security invoker
stable
set search_path = ''
as $$
  with ranked as (
    select
      es.id           as set_id,
      es.session_id   as session_id,
      es.completed_at as completed_at,
      es.weight_kg    as weight_kg,
      es.reps         as reps,
      -- INTERNAL ordering/flagging only — NEVER returned (D-08). Float 30.0.
      es.weight_kg * (1 + es.reps / 30.0) as sql_e1rm
    from public.exercise_sets es
    inner join public.workout_sessions s
      on s.id = es.session_id
     and s.finished_at is not null
    where es.exercise_id = p_exercise_id
      and es.set_type = 'working'   -- D-03
      and es.weight_kg > 0          -- D-04
  )
  select
    r.set_id,
    r.session_id,
    r.completed_at,
    r.weight_kg,
    r.reps,
    coalesce(
      r.sql_e1rm > max(r.sql_e1rm) over (
        order by r.completed_at, r.set_id
        rows between unbounded preceding and 1 preceding
      ),
      false
    ) as was_pr
  from ranked r
  order by r.completed_at, r.set_id;
$$;

revoke all on function public.get_exercise_pr_history(uuid) from public;
grant execute on function public.get_exercise_pr_history(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_best_working_sets — all-time-best working set per exercise.
--    The offline-first live-detection baseline (D-06). RAW weight_kg / reps;
--    JS recomputes the displayed e1RM via lib/e1rm.ts (D-08).
--    `distinct on (exercise_id)` top-pick precedent from 0006_phase6_chart_rpcs.
-- ---------------------------------------------------------------------------
create or replace function public.get_best_working_sets()
returns table (
  exercise_id uuid,
  weight_kg numeric,
  reps int
)
language sql
security invoker
stable
set search_path = ''
as $$
  select distinct on (es.exercise_id)
    es.exercise_id,
    es.weight_kg,
    es.reps
  from public.exercise_sets es
  inner join public.workout_sessions s
    on s.id = es.session_id
   and s.finished_at is not null
  where es.set_type = 'working'   -- D-03
    and es.weight_kg > 0          -- D-04
  -- distinct on requires the leading order key to match the distinct expr;
  -- the internal e1RM expression breaks the tie to the single best set.
  order by es.exercise_id, (es.weight_kg * (1 + es.reps / 30.0)) desc;
$$;

revoke all on function public.get_best_working_sets() from public;
grant execute on function public.get_best_working_sets() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_exercise_sets_in_range — raw working sets for ONE exercise in range.
--    Feeds the chart hero e1RM max + earliest-vs-best range delta (D-16/PR-05).
--    RAW sets only; JS computes every numeral. p_since null = "All" idiom.
-- ---------------------------------------------------------------------------
create or replace function public.get_exercise_sets_in_range(
  p_exercise_id uuid,
  p_since timestamptz
)
returns table (
  completed_at timestamptz,
  weight_kg numeric,
  reps int
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    es.completed_at,
    es.weight_kg,
    es.reps
  from public.exercise_sets es
  inner join public.workout_sessions s
    on s.id = es.session_id
   and s.finished_at is not null
  where es.exercise_id = p_exercise_id
    and es.set_type = 'working'   -- D-03
    and es.weight_kg > 0          -- D-04
    and (p_since is null or es.completed_at >= p_since)
  order by es.completed_at;
$$;

revoke all on function public.get_exercise_sets_in_range(uuid, timestamptz) from public;
grant execute on function public.get_exercise_sets_in_range(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. get_session_pr_flags — session-level has_pr aggregator.
--    Reuses the SAME running-max engine as RPC (1), PARTITIONED PER EXERCISE so
--    the PR-at-log-time semantics are identical and per-exercise. Aggregated to
--    session granularity via bool_or, returning only the requested sessions.
--    Returns the boolean flag only — no e1RM (D-08). NULL/empty array → empty.
-- ---------------------------------------------------------------------------
create or replace function public.get_session_pr_flags(
  p_session_ids uuid[]
)
returns table (
  session_id uuid,
  has_pr boolean
)
language sql
security invoker
stable
set search_path = ''
as $$
  with ranked as (
    select
      es.session_id  as session_id,
      es.exercise_id as exercise_id,
      -- per-exercise PR-at-log-time: strictly greater than the running max of
      -- all strictly-prior working sets for the SAME exercise (D-14/D-15).
      coalesce(
        (es.weight_kg * (1 + es.reps / 30.0)) > max(es.weight_kg * (1 + es.reps / 30.0)) over (
          partition by es.exercise_id
          order by es.completed_at, es.id
          rows between unbounded preceding and 1 preceding
        ),
        false
      ) as was_pr
    from public.exercise_sets es
    inner join public.workout_sessions s
      on s.id = es.session_id
     and s.finished_at is not null
    where es.set_type = 'working'   -- D-03
      and es.weight_kg > 0          -- D-04
  )
  select
    r.session_id,
    bool_or(r.was_pr) as has_pr
  from ranked r
  where r.session_id = any(p_session_ids)
  group by r.session_id;
$$;

revoke all on function public.get_session_pr_flags(uuid[]) from public;
grant execute on function public.get_session_pr_flags(uuid[]) to authenticated;
