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

### Tabeller

```sql
-- Profiles: extra fält för auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_unit text default 'kg' check (preferred_unit in ('kg', 'lb')),
  created_at timestamptz default now()
);

-- Övningsbibliotek (globala + användarens egna)
create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- null = global
  name text not null,
  muscle_group text,                                          -- 'chest', 'back', 'legs', etc.
  equipment text,                                              -- 'barbell', 'dumbbell', 'machine', 'bodyweight'
  notes text,
  created_at timestamptz default now()
);

-- Träningsplaner
create table workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now(),
  archived_at timestamptz
);

-- Kopplingstabell: vilka övningar i vilken plan, i vilken ordning
create table plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references workout_plans(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  order_index int not null,
  target_sets int,
  target_reps_min int,
  target_reps_max int,
  notes text,
  unique (plan_id, order_index)
);

-- Ett genomfört (eller pågående) pass
create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references workout_plans(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,                                  -- null = pågående
  notes text,
  created_at timestamptz default now()
);

-- Ett enskilt set
create table exercise_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  set_number int not null,
  reps int not null,
  weight_kg numeric(6,2) not null,
  rpe numeric(3,1),                                          -- 1-10, valfritt
  is_warmup boolean default false,
  completed_at timestamptz default now(),
  notes text
);

-- Index för snabba queries
create index idx_exercise_sets_session on exercise_sets(session_id);
create index idx_exercise_sets_exercise on exercise_sets(exercise_id, completed_at desc);
create index idx_sessions_user on workout_sessions(user_id, started_at desc);
create index idx_plans_user on workout_plans(user_id) where archived_at is null;
```

### Row Level Security (RLS)

Alla tabeller måste ha RLS aktiverat. Generell princip: användare ser bara sina egna rader.

```sql
-- Aktivera RLS
alter table profiles enable row level security;
alter table exercises enable row level security;
alter table workout_plans enable row level security;
alter table plan_exercises enable row level security;
alter table workout_sessions enable row level security;
alter table exercise_sets enable row level security;

-- Profiles: bara dig själv
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Exercises: globala (user_id null) ELLER egna
create policy "Users can view global and own exercises" on exercises
  for select using (user_id is null or user_id = auth.uid());
create policy "Users can insert own exercises" on exercises
  for insert with check (user_id = auth.uid());
create policy "Users can update own exercises" on exercises
  for update using (user_id = auth.uid());
create policy "Users can delete own exercises" on exercises
  for delete using (user_id = auth.uid());

-- Workout plans: bara egna
create policy "Users can manage own plans" on workout_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Plan exercises: via plan-ägaren
create policy "Users can manage own plan exercises" on plan_exercises
  for all using (
    exists (select 1 from workout_plans where id = plan_id and user_id = auth.uid())
  );

-- Sessions: bara egna
create policy "Users can manage own sessions" on workout_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Sets: via session-ägaren
create policy "Users can manage own sets" on exercise_sets
  for all using (
    exists (select 1 from workout_sessions where id = session_id and user_id = auth.uid())
  );
```

## 5. Nyckel-queries

### Senaste värdet för en övning
```sql
select reps, weight_kg, completed_at
from exercise_sets
where exercise_id = $1
  and is_warmup = false
order by completed_at desc
limit 5;
```

### Max-vikt över tid (för graf)
```sql
select date_trunc('day', completed_at) as day,
       max(weight_kg) as max_weight
from exercise_sets
where exercise_id = $1 and is_warmup = false
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
