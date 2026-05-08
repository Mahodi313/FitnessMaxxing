# ARCHITECTURE — Gym Tracker

## 1. Översikt på hög nivå

```
┌────────────────────────┐         ┌──────────────────────┐
│   React Native (Expo)  │         │      Supabase        │
│   iPhone via Expo Go   │ ◄──────►│  Postgres + Auth +   │
│   TypeScript           │  HTTPS  │  Auto REST API       │
│   Expo Router          │         │  Realtime (optional) │
└────────────────────────┘         └──────────────────────┘
        ▲                                     ▲
        │ Local cache (TanStack Query)        │ RLS policies
        │ AsyncStorage (offline queue)        │
        └─────────────────────────────────────┘
```

- All affärslogik på frontend (V1) — Supabase är "bara" databas + auth + REST
- Vid behov senare: Supabase Edge Functions (Deno) för logik som inte hör hemma på klient

## 2. Frontend-stack

| Lager | Val | Varför |
|-------|-----|--------|
| Ramverk | Expo SDK (senaste stable) | Snabbaste vägen till iOS, EAS Build, Expo Go för dev |
| Språk | TypeScript | Typkontroll = färre buggar, bättre IDE-stöd |
| Navigation | Expo Router | File-based routing, modern standard |
| Styling | NativeWind (Tailwind för RN) | Snabb iteration, samma syntax som webb-Tailwind |
| State (server) | TanStack Query v5 | Caching, refetch, optimistic updates out of the box |
| State (lokal) | Zustand | Enklare än Redux, räcker för UI-state |
| Forms | react-hook-form + zod | Validering, typsäkra schemas |
| Datum | date-fns | Lättviktigt, tree-shakeable |
| Diagram | victory-native (eller react-native-skia) | Performance på telefon |
| Backend-klient | @supabase/supabase-js | Officiell, fungerar i RN |

## 3. Mappstruktur (Expo-appen i `app/`)

```
app/
├── app/                      # Expo Router rutter (file-based)
│   ├── (auth)/
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx       # Tab-navigation
│   │   ├── index.tsx         # Hem (lista över planer)
│   │   ├── history.tsx       # Pass-historik
│   │   └── settings.tsx
│   ├── plan/
│   │   ├── [id].tsx          # Visa/redigera plan
│   │   └── new.tsx           # Skapa ny plan
│   ├── workout/
│   │   ├── [sessionId].tsx   # Aktivt pass
│   │   └── start.tsx         # Välj plan att starta
│   ├── exercise/
│   │   └── [id].tsx          # Övningsdetalj + historik/graf
│   └── _layout.tsx           # Root-layout
├── components/               # Återanvändbara UI-komponenter
│   ├── ui/                   # Knappar, kort, inputs, etc.
│   ├── ExerciseCard.tsx
│   ├── SetRow.tsx
│   └── PlanList.tsx
├── lib/
│   ├── supabase.ts           # Supabase-klient
│   ├── queries/              # TanStack Query hooks
│   │   ├── plans.ts
│   │   ├── exercises.ts
│   │   └── workouts.ts
│   ├── stores/               # Zustand stores
│   ├── schemas/              # Zod-scheman
│   └── utils/
├── types/                    # TypeScript-typer (genereras från Supabase)
└── assets/                   # Bilder, ikoner
```

## 4. Datamodell (Supabase / PostgreSQL)

> **Phase 2 closed errata** (originally noted 2026-05-07, fixed 2026-05-09): `with check` is now present on every writable policy (`plan_exercises`, `exercise_sets`), and every `auth.uid()` is wrapped as `(select auth.uid())`. The deployed migration is `app/supabase/migrations/0001_initial_schema.sql`; this section transcribes that file verbatim. See `.planning/phases/02-schema-rls-type-generation/` for the migration that landed this fix.

### ENUM types (Phase 2)

```sql
create type public.set_type as enum ('working', 'warmup', 'dropset', 'failure');
```

F17 schema-only: the `set_type` column lands in V1; UI for tagging warmup/dropset/failure is deferred to V1.1. Working sets are the canonical "what I lifted" — F7's last-value display and F10's max-vikt graph filter on `set_type = 'working'`. `supabase gen types` emits this as a TS string-literal union, giving compile-time narrowing for free.

### Tabeller

```sql
-- Profiles: extra fält för auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_unit text default 'kg' check (preferred_unit in ('kg', 'lb')),
  created_at timestamptz default now()
);

-- Övningsbibliotek (globala + användarens egna)
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- null = global (V2 seed); user_id set = personal
  name text not null,
  muscle_group text,                                          -- 'chest', 'back', 'legs', etc.
  equipment text,                                              -- 'barbell', 'dumbbell', 'machine', 'bodyweight'
  notes text,
  created_at timestamptz default now()
);

-- Träningsplaner
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now(),
  archived_at timestamptz
);

-- Kopplingstabell: vilka övningar i vilken plan, i vilken ordning
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

-- Ett genomfört (eller pågående) pass
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,                                  -- null = pågående
  notes text,
  created_at timestamptz default now()
);

-- Ett enskilt set
create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number int not null,
  reps int not null,
  weight_kg numeric(6,2) not null,
  rpe numeric(3,1),                                          -- 1-10, valfritt
  set_type public.set_type not null default 'working',       -- F17 schema-only (V1.1 adds UI for tagging)
  completed_at timestamptz default now(),
  notes text
);

-- Index för snabba queries
create index idx_exercise_sets_session on public.exercise_sets(session_id);
create index idx_exercise_sets_exercise on public.exercise_sets(exercise_id, completed_at desc);
create index idx_sessions_user on public.workout_sessions(user_id, started_at desc);
create index idx_plans_user on public.workout_plans(user_id) where archived_at is null;
```

### Row Level Security (RLS)

Alla tabeller måste ha RLS aktiverat. Generell princip: användare ser bara sina egna rader.

```sql
-- Aktivera RLS
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_sets enable row level security;

-- All auth.uid() references wrapped as (select auth.uid()) per PITFALLS 4.1 (query-plan caching).
-- Profiles: bara dig själv
create policy "Users can view own profile" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "Users can update own profile" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- (no INSERT policy — handle_new_user trigger inserts via SECURITY DEFINER, bypassing RLS by design)

-- Exercises: globala (user_id null) ELLER egna
create policy "Users can view global and own exercises" on public.exercises
  for select using (user_id is null or user_id = (select auth.uid()));
create policy "Users can insert own exercises" on public.exercises
  for insert with check (user_id = (select auth.uid()));
create policy "Users can update own exercises" on public.exercises
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users can delete own exercises" on public.exercises
  for delete using (user_id = (select auth.uid()));

-- Workout plans: bara egna
create policy "Users can manage own plans" on public.workout_plans
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Plan exercises: via plan-ägaren — ERRATA FIX (Phase 2): with check added per PITFALLS 2.5
create policy "Users can manage own plan exercises" on public.plan_exercises
  for all
  using (exists (select 1 from public.workout_plans where id = plan_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_plans where id = plan_id and user_id = (select auth.uid())));

-- Sessions: bara egna
create policy "Users can manage own sessions" on public.workout_sessions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Sets: via session-ägaren — ERRATA FIX (Phase 2): with check added per PITFALLS 2.5
create policy "Users can manage own sets" on public.exercise_sets
  for all
  using (exists (select 1 from public.workout_sessions where id = session_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_sessions where id = session_id and user_id = (select auth.uid())));
```

### Profiles trigger (Phase 2)

`handle_new_user` auto-creates a `profiles` row whenever `auth.users` gets a new sign-up. Without it, even the cross-user RLS test would have to manually paper-insert profiles after seeding auth users.

```sql
-- handle_new_user trigger (Phase 2): auto-creates profiles row on auth.users insert.
-- SECURITY DEFINER + SET search_path = '' defends against PG search-path injection (PITFALLS Pitfall 7).
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
```

## 5. Nyckel-queries

> Working sets (`set_type = 'working'`) are the canonical "what I lifted" — warmup, dropset, and failure sets are excluded from F7's last-value display and F10's max-vikt graph because they would mislead the read-out (D-13).

### F7 — Senaste värdet för en övning
```sql
select reps, weight_kg, completed_at
from public.exercise_sets
where exercise_id = $1
  and set_type = 'working'
order by completed_at desc
limit 5;
```

### F10 — Max-vikt över tid (för graf)
```sql
select date_trunc('day', completed_at) as day,
       max(weight_kg) as max_weight
from public.exercise_sets
where exercise_id = $1 and set_type = 'working'
group by day
order by day;
```

## 6. Autentisering

- Email/lösen i V1 (Supabase Auth)
- Apple Sign-In i V1.1 (krav för App Store senare)
- Session lagras i SecureStore (Expo SecureStore), inte AsyncStorage
- Auto-refresh av JWT via supabase-js-klienten

## 7. Offline-strategi (V1.5)

V1: kräver internet. V1.5:
- Mutationer queueas i AsyncStorage om offline
- TanStack Query optimistic updates
- Vid återanslutning: spela av kön mot Supabase
- Konflikthantering: senaste klient-tidsstämpeln vinner

## 8. Säkerhet

- All client→server-kommunikation över HTTPS (Supabase default)
- RLS som primärt skydd (klient kan aldrig se annans data även om den modifierar requests)
- Anon-nyckel är OK i klienten (det är vad RLS är för)
- Service role-nyckel används ALDRIG i klienten

## 9. Deployment

| Miljö | Mål |
|-------|-----|
| Development | Expo Go på egen iPhone, lokal `.env.local` |
| Preview/TestFlight | EAS Build → TestFlight (kräver Apple Developer-konto) |
| Production | EAS Submit → App Store |

## 10. Beslutsregister
| Beslut | Alternativ övervägt | Motivering |
|--------|---------------------|-----------|
| Expo (vs vanilla RN) | Vanilla, Flutter, SwiftUI | Snabbast iteration, EAS hanterar bygg, ingen Mac krävs initialt |
| Supabase (vs Firebase, egen) | Firebase, Node + Postgres | Open source, SQL, RLS gör auth-säkerhet enkelt |
| TypeScript (vs JS) | JS | Typkontroll mot Supabase-schema = mycket färre runtime-buggar |
| NativeWind (vs StyleSheet) | StyleSheet, Tamagui | Tailwind-syntax är snabb och välkänd |
