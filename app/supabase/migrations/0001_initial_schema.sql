-- File: app/supabase/migrations/0001_initial_schema.sql
--
-- Initial schema for FitnessMaxxing V1.
-- Mirrors ARCHITECTURE.md §4 with errata fixed:
--   1. with check on every writable policy (PITFALLS 2.5 — closes the errata noted in STATE.md)
--   2. (select auth.uid()) wrapping in every policy (PITFALLS 4.1 — query-plan caching)
-- Plus F17 schema-only:
--   - CREATE TYPE public.set_type as ENUM ('working','warmup','dropset','failure')
--   - exercise_sets.set_type column with default 'working'
--   - exercise_sets has no boolean warmup flag (dropped per D-12 — DB has no data, migration is free; set_type='warmup' is the canonical classification)
-- Plus handle_new_user trigger so sign-up (Phase 3) auto-creates a profiles row (D-15/D-16/D-17).
--
-- See .planning/phases/02-schema-rls-type-generation/02-CONTEXT.md for the full rationale.
-- See .planning/research/PITFALLS.md §2.1, §2.2, §2.5, §4.1, §4.4 for the pitfalls this file closes.

-- ============================================================================
-- 1. ENUM types
-- ============================================================================
create type public.set_type as enum ('working', 'warmup', 'dropset', 'failure');

-- ============================================================================
-- 2. Tables (in FK-dependency order — parents before children)
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_unit text default 'kg' check (preferred_unit in ('kg', 'lb')),
  created_at timestamptz default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- null = global (V2 seed); user_id set = personal
  name text not null,
  muscle_group text,
  equipment text,
  notes text,
  created_at timestamptz default now()
);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now(),
  archived_at timestamptz
);

create table public.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  order_index int not null,
  target_sets int,
  target_reps_min int,
  target_reps_max int,
  notes text,
  unique (plan_id, order_index)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number int not null,
  reps int not null,
  weight_kg numeric(6,2) not null,
  rpe numeric(3,1),
  set_type public.set_type not null default 'working',  -- F17 schema-only (D-11/D-12)
  completed_at timestamptz default now(),
  notes text
);

-- ============================================================================
-- 3. Indexes (per ARCHITECTURE.md §4 — drives F7 last-value and F10 max-graph queries)
-- ============================================================================
create index idx_exercise_sets_session on public.exercise_sets(session_id);
create index idx_exercise_sets_exercise on public.exercise_sets(exercise_id, completed_at desc);
create index idx_sessions_user on public.workout_sessions(user_id, started_at desc);
create index idx_plans_user on public.workout_plans(user_id) where archived_at is null;

-- ============================================================================
-- 4. Row Level Security — enable on every user-scoped table (PITFALLS 2.1)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_sets enable row level security;

-- ============================================================================
-- 5. RLS policies — errata-fixed (PITFALLS 2.5 + 4.1)
--    Every writable policy has BOTH using AND with check.
--    Every auth.uid() is wrapped as (select auth.uid()) for query-plan caching.
-- ============================================================================

-- profiles: own row only
create policy "Users can view own profile" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "Users can update own profile" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- (no INSERT policy — handle_new_user trigger inserts via SECURITY DEFINER, bypassing RLS by design)

-- exercises: globals (user_id null) ELLER egna
create policy "Users can view global and own exercises" on public.exercises
  for select using (user_id is null or user_id = (select auth.uid()));
create policy "Users can insert own exercises" on public.exercises
  for insert with check (user_id = (select auth.uid()));
create policy "Users can update own exercises" on public.exercises
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users can delete own exercises" on public.exercises
  for delete using (user_id = (select auth.uid()));

-- workout_plans: own rows only
create policy "Users can manage own plans" on public.workout_plans
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- plan_exercises: via plan-ägaren — ERRATA FIX (PITFALLS 2.5): with check added
create policy "Users can manage own plan exercises" on public.plan_exercises
  for all
  using (exists (select 1 from public.workout_plans where id = plan_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_plans where id = plan_id and user_id = (select auth.uid())));

-- workout_sessions: own rows only
create policy "Users can manage own sessions" on public.workout_sessions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- exercise_sets: via session-ägaren — ERRATA FIX (PITFALLS 2.5): with check added
create policy "Users can manage own sets" on public.exercise_sets
  for all
  using (exists (select 1 from public.workout_sessions where id = session_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_sessions where id = session_id and user_id = (select auth.uid())));

-- ============================================================================
-- 6. handle_new_user trigger — auto-create profiles row on auth.users insert
--    SECURITY DEFINER + SET search_path = '' + fully-qualified names defends
--    against PostgreSQL search-path injection (PITFALLS Pitfall 7; Supabase canonical pattern).
--    Body inserts only id (D-16) — display_name stays NULL until the user edits it.
-- ============================================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
