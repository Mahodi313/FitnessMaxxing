# Phase 12: History, Detail, Chart & Home Dashboard - Research

**Researched:** 2026-06-13
**Domain:** Read-side re-skin (Forge) + new activity-ring Home dashboard backed by RLS-scoped read-only Postgres RPCs; Reanimated 4 + Skia 2.2 mount animations
**Confidence:** HIGH (every recommendation is grounded in cited existing files; only Postgres week-math and Reanimated reduce-motion came from external docs, both verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 .. D-24 — do NOT re-derive)
- **D-01** Mock-pure activity-ring hero on Home (ring + streak chip + this-week-volume chip). No delta/sparkline on Home — those live on History.
- **D-02** During an active session, swap the ring-hero for the already-built `<ActiveSessionBanner>` (idle → ring; active → banner).
- **D-03** Offline/cold-start = cached last value. Dashboard-aggregate query persists through the existing TanStack persister; skeleton only on a truly-empty cache.
- **D-04** Brand-new user (0 finished sessions) → zeroed hero (ring 0/goal, streak 0, volume 0) + "Logga ditt första pass" nudge. Hero present from day one.
- **D-05** Weekly-volume card (volume + delta + sparkline) lives on the **History** screen, NOT Home. DASH-03/DASH-04 satisfied on History.
- **D-06** Week boundary = calendar week, Monday–Sunday (ISO week), reset Monday 00:00 local. "This week" = current Mon–Sun; "prior week" = preceding Mon–Sun.
- **D-07** Streak = consecutive calendar weeks meeting `weekly_goal` (NOT daily). Chip label flips dagar→veckor.
- **D-08** Sparkline series = weekly total volume over last ~8–12 weeks (one point per calendar week).
- **D-09** History header eyebrow = lifetime stats (total finished-session count + total hours trained).
- **D-10** Keep Max-vikt / Total-volym metric toggle, re-skinned to Forge segmented control.
- **D-11** Range selector = 3-state 30d / 90d / All, default 90d. Replaces v1's 5-state. Map each to a since-timestamp.
- **D-12** Chart hero = active metric's current best/latest + change over selected range. Real non-PR data. (Phase 13 swaps to e1RM.)
- **D-13** NO PR trophies, NO e1RM, NO celebration anywhere this phase. No inert/scaffolded slots.
- **D-14** Add the 3-stat row (top set / vol-per-session / avg RPE over range) AND keep "Senaste 10 passen" tappable list.
- **D-15** Exercise breakdown = hybrid: Forge card (name + max-weight stat right) WITH expanded per-set list (w × r + RPE) beneath.
- **D-16** History row = full mock row: date badge (DD/MON) + plan name + "X set · Y kg · Z min" meta. Plan-name fallback preserved.
- **D-17** Custom in-content header on BOTH detail + chart: circular back + circular ellipsis (hosts delete). Hide native Stack header.
- **D-18** Full tasteful motion: ring fill, chart line draw, sparkline draw, number count-ups on mount (§07 spring damping 18 / stiffness 220). Honor OS reduce-motion (snap to final).
- **D-19** Ring overfills past 100% with glow / second-lap when goal beaten (label shows real count).
- **D-20** Adopt Phase 9 `fm:units` helper. CONVERT EVERYTHING to selected unit (per-set, top-set, total volume, sparkline values, chart axes). Storage stays kg; RPCs return kg; client converts. Nearest-0.5-lb for weights.
- **D-21** Full i18n sweep, sv+en flat keys via `t()`. Includes streak relabel (dagar→veckor).
- **D-22** Inline-overlay pattern (never Modal portal) + manual keyboard-lift preserved for overflow/delete-confirm/edit-notes. `mutate` not `mutateAsync`.
- **D-23** New RPCs: `security invoker` + `stable` + `set search_path = ''`, fully-qualified `public.*`, `set_type = 'working'`. Migration `0011_*`, `gen:types` co-commit, `verify-deploy.ts` + cross-user `test:rls` per new RPC.
- **D-24** F13 untouched. No mutation defaults, query keys, persister scope-bindings, or `exercise_sets` logging behavior change. `npm run test:f13-brutal` stays green.

### Claude's Discretion (research/planner resolves)
- One combined dashboard RPC vs several. (Resolved below → **one combined `get_dashboard_summary` + one new `get_exercise_summary`**.)
- Chart hero delta + stats row: new vs extended chart RPC. (Resolved → **new `get_exercise_summary`**.)
- Exact Reanimated/Skia implementation of ring fill, chart draw, sparkline draw, count-ups, overflow-glow. (Patterns provided below.)
- Forge token/class choices per control; `t()` key names.
- Whether History lifetime eyebrow (D-09) and volume card (D-05) read from the same RPC. (Resolved → **same `get_dashboard_summary` RPC**.)

### Deferred Ideas (OUT OF SCOPE)
- PR detection (e1RM/Epley), PR trophies, chart e1RM hero, celebration banner/sweep — Phase 13.
- Rest timer — Phase 14.
- Global i18n zero-missing-keys audit — Phase 15.
- Reduce-motion as an in-app Settings pref — Phase 12 honors OS setting only.
- Session-detail exercise ordering by `plan_exercises.order_index` — V1.1 polish (WR-05).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKIN-06 | Re-skin History list, Session detail, Exercise chart to Forge | Existing screens cited; Forge primitives in `app/components/ui/*`; custom-header pattern from Phase 11 D-09 |
| DASH-01 | Activity-ring hero (sessions-this-week / weekly_goal) | `get_dashboard_summary` §1 fields `sessions_this_week` + `weekly_goal`; `ProgressRing` animated §3 |
| DASH-02 | Streak (consecutive goal-weeks) | `get_dashboard_summary` `streak_weeks` field; gaps-and-islands SQL sketch §1 |
| DASH-03 | This-week volume + delta vs prior week | `get_dashboard_summary` `volume_this_week_kg` + `volume_prior_week_kg`; delta computed client-side §1 |
| DASH-04 | Weekly-volume sparkline (~8–12 weeks) | `get_dashboard_summary` `weekly_volume_series` jsonb; `Sparkline` animated §3 |
| DASH-05 | Aggregate RPCs + empty state | One combined `get_dashboard_summary` §1; zeroed-hero empty state §1 + §4 |
| MOTN-02 | ProgressRing mount fill animation | Reanimated SharedValue → Skia arc pattern §3 |
| MOTN-03 | Chart line draws left→right on mount | Victory Native XL animated path / Reanimated clip §3 |
</phase_requirements>

## Summary

This is a **read-side re-skin + one new aggregate surface** phase. The technical risk is concentrated in three places: (1) the **dashboard aggregate SQL** — especially the consecutive-goal-week streak, which is genuine gaps-and-islands work; (2) **animating two currently-static Skia primitives** (`ProgressRing`, `Sparkline`) plus the Victory chart line, under Reanimated 4 + Skia 2.2.x with reduce-motion honored; and (3) **wiring the new query into the existing persister** without touching the F13 hot path. Everything else is mechanical Forge composition over primitives that already exist.

The existing `0006_phase6_chart_rpcs.sql` is a clean, copy-able template: all three functions are `language sql / security invoker / stable / set search_path = ''` with fully-qualified `public.*` references and `set_type = 'working'` filtering. The new RPCs follow it byte-for-byte. Postgres `date_trunc('week', ...)` is **Monday-based (ISO 8601)** — verified — which exactly matches D-06, so no week-offset arithmetic is needed for the Mon–Sun boundary; the only nuance is converting the stored UTC timestamps to the user's local time before truncation.

**Primary recommendation:** Ship **two new RPCs** in migration `0011_phase12_dashboard_rpcs.sql` — one combined `get_dashboard_summary(p_tz text)` returning every Home+History aggregate in a single row, and one `get_exercise_summary(p_exercise_id, p_metric, p_since)` for the chart hero + 3-stat row. Drive all mount animations with a single Reanimated `progress` SharedValue per surface (0→1 via `withSpring({damping:18, stiffness:220})`), feed it into Skia via `useDerivedValue`, and short-circuit to the final value when `useReducedMotion()` returns true. Convert every kg figure to the display unit on the **client** via the existing `app/lib/units.ts` helper.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Weekly/streak/volume aggregation | Database (RPC) | — | Set-level math + RLS scoping belong server-side; client only displays. Matches 0006 precedent. |
| Week-boundary math (Mon–Sun, local) | Database (RPC) | Client (tz string) | `date_trunc('week')` is Mon-based; client passes its IANA tz so UTC timestamps truncate in local time. |
| Chart hero / 3-stat aggregation | Database (RPC) | — | Same as above; avoids shipping all set rows to client. |
| Unit conversion (kg→display) | Client | — | D-20: storage canonical kg; conversion is a display concern via `lib/units.ts`. |
| Mount animations (ring/chart/sparkline/count-up) | Client (Reanimated + Skia) | — | Pure presentation; never gates a read or write. |
| Offline cache / cold-start hydration | Client (TanStack persister) | — | Existing `PersistQueryClientProvider`; new query slot only. |
| i18n strings | Client (`t()`) | — | react-i18next flat keys; user content never translated. |

## Standard Stack

No new dependencies. Everything required is already pinned and in use.

### Core (all already installed — verified in `app/package.json` + CLAUDE.md matrix)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@shopify/react-native-skia` | `2.2.12` | ProgressRing/Sparkline/chart canvas | Already drives the static primitives + Victory chart [CITED: CLAUDE.md stack table] |
| `react-native-reanimated` | `4.x` | SharedValue-driven mount animations | Already wired (metro/babel); drives draft-resume spring today [VERIFIED: codebase — `(tabs)/index.tsx` imports `withSpring`] |
| `victory-native` (XL) | `^41.20.2` | `<CartesianChart>` + `<Line>` | Existing chart already uses it [VERIFIED: codebase — `chart.tsx` imports `victory-native`] |
| `@tanstack/react-query` | `^5.100.9` | `useQuery` for dashboard hook | Existing read-side hooks pattern [VERIFIED: codebase — `sessions.ts`] |
| `@tanstack/react-query-persist-client` | (with v5) | Cold-start hydration | `PersistQueryClientProvider` already mounted [VERIFIED: codebase — `_layout.tsx:243`] |
| `zod` | `^4.4.3` | RPC wire-boundary parse | Every RPC row is parsed before UI (PITFALLS §8.13) [VERIFIED: codebase — `exercise-chart.ts`] |
| `date-fns` | `^4.1.0` | Since-timestamp math for ranges | `subMonths`/`subYears` already used in `windowToSince` [VERIFIED: codebase] |
| `expo-localization` | `~17.0.9` | Device IANA timezone for RPC `p_tz` | Already a dep; `Localization.getCalendars()[0].timeZone` gives IANA tz [VERIFIED: codebase — `app.json` plugin + `i18n.ts` import] |

### Supporting (in-repo, reuse as-is)
| Component | Path | Use Case |
|-----------|------|----------|
| `ProgressRing` | `app/components/ui/ProgressRing.tsx` | Home hero ring — **add `value` animation** |
| `Sparkline` | `app/components/ui/Sparkline.tsx` | History volume card — **add draw-in animation** |
| `SegmentedControl` | `app/components/segmented-control.tsx` | Metric toggle + range selector |
| `ActiveSessionBanner` | `app/components/active-session-banner.tsx` | Home hero slot during active session (D-02) |
| `ForgeCard`/`ForgeChip`/`ForgeStat`/`Icon` | `app/components/ui/*` | Card frames, chips, stat cells |
| `formatWeight` / `toDisplayWeight` | `app/lib/units.ts` | Every weight/volume conversion (D-20) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One combined `get_dashboard_summary` | Several small RPCs | Several = more round-trips at cold start + more persister cache slots + more `test:rls`/`verify-deploy` assertions. Combined = one row, one cache slot, one cross-user test. **Combined wins** (see §1 rationale). |
| New `get_exercise_summary` | Extend `get_exercise_chart` | Extending changes the chart RPC's return shape → regen breaks the existing `ChartRowSchema` consumer. A new RPC is additive and isolated. **New wins.** |
| Reanimated-driven Skia arc | Victory Native XL built-in `animate` prop for the ring | The ring is a hand-rolled Skia `ProgressRing`, not a Victory chart — Reanimated SharedValue is the only path. Victory's `animate` applies only to `<CartesianChart>` (the chart line). |

**Installation:** none — `npm install` not run this phase. Confirm versions only:
```bash
cd app && npx expo install --check    # confirms Skia/Reanimated/Victory pins unchanged
```

## Package Legitimacy Audit

> No external packages are installed this phase. All libraries are already present, pinned, and validated in CLAUDE.md's stack table (which carries `npm view` verification dated May 2026). Slopcheck/registry verification is **not applicable** — zero new installs.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none added) | — | N/A — no installs this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none (no installs)
**Packages flagged as suspicious [SUS]:** none (no installs)

---

# MANDATE 1 — Dashboard Aggregate RPC(s) (DASH-05)

## Recommendation: ONE combined `get_dashboard_summary(p_tz text)`

Ship a single combined RPC returning every Home + History aggregate as **one row**. Rationale:

1. **Round-trips (D-03 offline-first):** The Home hero AND the History volume card AND the History lifetime eyebrow all read from the same underlying tables (`workout_sessions` + `exercise_sets`). One RPC = one network call hydrated into **one persister cache slot**. Several RPCs = N cold-start fetches + N cache slots to persist/restore, more surface for a partial-hydration skeleton flash.
2. **Cache granularity:** None of these aggregates are independently invalidated — they all change together when a session finishes. There is no benefit to separate cache slots; a single `dashboardKeys.summary()` slot is simpler and matches the "show last value instantly" goal.
3. **RLS surface:** One `security invoker` function = one cross-user `test:rls` assertion + one `verify-deploy` pg_proc check. Several functions multiply the test/verify burden (D-23 requires an assertion *per* RPC).
4. **Testability:** A single combined return is one Zod schema, one parse boundary.

The **chart** aggregates are a *separate concern* (per-exercise, range-parameterized) → that is Mandate 2's `get_exercise_summary`. So: **two new RPCs total**, not one, not five.

## RPC return shape (canonical kg — client converts per D-20)

```sql
returns table (
  sessions_this_week     int,        -- DASH-01 ring numerator
  weekly_goal            int,        -- DASH-01 ring denominator (from profiles)
  streak_weeks           int,        -- DASH-02 consecutive goal-weeks
  volume_this_week_kg    numeric,    -- DASH-03 Home chip + History card value
  volume_prior_week_kg   numeric,    -- DASH-03 delta basis (delta % computed client-side)
  weekly_volume_series   jsonb,      -- DASH-04 sparkline: array of {week, volume_kg}, last 12 weeks
  lifetime_sessions      int,        -- D-09 eyebrow count
  lifetime_hours         numeric     -- D-09 eyebrow Σ duration (hours)
)
```

> **Why `delta %` is client-side, not in SQL:** the delta is a trivial `(this - prior) / prior` and the client already converts both volumes to the display unit — computing the % in SQL would force a divide-by-zero guard server-side AND the % is unit-invariant anyway. Keep it client-side.

## Postgres week-boundary math — VERIFIED

`date_trunc('week', ts)` in Postgres truncates to **Monday 00:00 (ISO 8601)** — there is no configurable week-start; it always uses Monday. This **exactly matches D-06** (Mon–Sun, Swedish convention), so no `- EXTRACT(DOW ...)` offset is needed. [VERIFIED: postgresql.org/docs/current/functions-datetime.html — "date_trunc('week') ... ISO 8601, weeks start on Monday"]

**The local-time nuance (load-bearing):** `workout_sessions.started_at` is `timestamptz` stored as UTC. A session logged Sunday 23:30 local (Stockholm = UTC+1/+2) is `22:30Z` or `21:30Z` — still Sunday locally, but a naive UTC `date_trunc` could bucket a late-Sunday or early-Monday session into the wrong ISO week. **Fix:** the client passes its IANA timezone (`p_tz`, e.g. `'Europe/Stockholm'`) and the SQL converts before truncating:

```sql
date_trunc('week', s.started_at AT TIME ZONE p_tz)
```

`AT TIME ZONE p_tz` converts the `timestamptz` to a local `timestamp`, then `date_trunc('week', ...)` finds the local Monday. The client obtains `p_tz` from `expo-localization`:
```ts
import * as Localization from "expo-localization";
const tz = Localization.getCalendars()[0]?.timeZone ?? "Europe/Stockholm";
```
[VERIFIED: codebase — `expo-localization` is already a dep; `getCalendars()[0].timeZone` returns the IANA zone]

## Concrete SQL sketch (copy the 0006 pattern exactly)

```sql
-- 0011_phase12_dashboard_rpcs.sql  (excerpt — combined dashboard RPC)
-- Pattern copied verbatim from 0006_phase6_chart_rpcs.sql:
--   language sql / security invoker / stable / set search_path = ''
--   fully-qualified public.*, set_type = 'working', RLS via caller JWT.
create or replace function public.get_dashboard_summary(p_tz text default 'Europe/Stockholm')
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
  -- One row per finished session with its local ISO-week start + its working-set volume.
  sess as (
    select
      s.id,
      date_trunc('week', s.started_at at time zone p_tz) as wk,
      s.started_at,
      s.finished_at,
      coalesce((
        select sum(es.weight_kg * es.reps)
        from public.exercise_sets es
        where es.session_id = s.id and es.set_type = 'working'
      ), 0) as vol_kg
    from public.workout_sessions s
    where s.finished_at is not null
  ),
  -- The current + prior local ISO weeks (computed once, in the caller's tz).
  bounds as (
    select
      date_trunc('week', (now() at time zone p_tz)) as this_wk,
      date_trunc('week', (now() at time zone p_tz)) - interval '7 days' as prior_wk
  ),
  -- Per-week aggregates for the sparkline (last 12 calendar weeks incl. current).
  weekly as (
    select wk, count(*) as n, sum(vol_kg) as vol
    from sess
    group by wk
  ),
  series as (
    select coalesce(jsonb_agg(
             jsonb_build_object('week', to_char(g.wk, 'YYYY-MM-DD'),
                                'volume_kg', coalesce(w.vol, 0))
             order by g.wk
           ), '[]'::jsonb) as s
    from (
      select (date_trunc('week', (now() at time zone p_tz)) - (i || ' weeks')::interval) as wk
      from generate_series(11, 0, -1) as i
    ) g
    left join weekly w on w.wk = g.wk
  ),
  -- Streak: consecutive prior weeks (working back from THIS week) meeting weekly_goal.
  goal as (select coalesce(weekly_goal, 3) as g from public.profiles limit 1)
  select
    coalesce((select n from weekly, bounds where wk = this_wk), 0)::int,
    (select g from goal),
    public.dashboard_streak_weeks(p_tz),                       -- see streak helper below
    coalesce((select vol from weekly, bounds where wk = this_wk), 0),
    coalesce((select vol from weekly, bounds where wk = prior_wk), 0),
    (select s from series),
    (select count(*) from sess)::int,
    coalesce((select sum(extract(epoch from (finished_at - started_at)) / 3600.0) from sess), 0);
$$;
```

> **RLS note:** `security invoker` means `profiles`, `workout_sessions`, `exercise_sets` are all filtered by the caller's JWT through the existing 0001 RLS policies — `select ... from public.profiles limit 1` returns *only the caller's* profile row. This is the same free cross-user scoping 0006 relies on. [CITED: 0006_phase6_chart_rpcs.sql:20-24 header — "caller's JWT user_id flows into the underlying RLS policies"]

## The streak (trickiest aggregate) — gaps-and-islands sketch

The streak is "how many consecutive calendar weeks, counting back from the most recent qualifying week, met `weekly_goal`." The cleanest robust form is a `generate_series` of weeks + a running check that breaks at the first non-qualifying week. Express as a helper or inline CTE:

```sql
-- Streak = count of consecutive weeks (ending at the most recent qualifying week,
-- which may be THIS week or LAST week) that hit the goal, with no gap.
with goal as (select coalesce(weekly_goal, 3) as g from public.profiles limit 1),
qualifying as (   -- weeks (local) that met the goal
  select date_trunc('week', s.started_at at time zone p_tz) as wk
  from public.workout_sessions s
  where s.finished_at is not null
  group by 1
  having count(*) >= (select g from goal)
),
weeks as (        -- the last 60 weeks as a calendar spine, newest first
  select (date_trunc('week', (now() at time zone p_tz)) - (i || ' weeks')::interval) as wk
  from generate_series(0, 59) i
),
flagged as (
  select w.wk,
         (q.wk is not null) as met,
         row_number() over (order by w.wk desc) as rn
  from weeks w
  left join qualifying q on q.wk = w.wk
)
-- Streak: skip a non-qualifying CURRENT week (week-in-progress shouldn't break a streak),
-- then count met-weeks until the first miss.
select count(*)
from flagged
where rn <= (
  select coalesce(min(rn) - 1, (select max(rn) from flagged))
  from flagged
  where not met and rn > (case when (select met from flagged where rn = 1) then 0 else 1 end)
);
```

**Recommendation for the planner:** the inline gaps-and-islands above is correct but dense. Prefer the **classic islands form** for maintainability — flag each week `met/not met`, assign an "island id" via `rn - (running count of met weeks)`, and take the island that touches the most-recent week:

```sql
-- Cleaner: islands of consecutive met-weeks; streak = size of the island at rn=1 or rn=2.
flagged as (
  select w.wk, (q.wk is not null) as met,
         row_number() over (order by w.wk desc) as rn
  from weeks w left join qualifying q on q.wk = w.wk
),
islands as (
  select *, rn - row_number() over (partition by met order by rn) as grp
  from flagged where met
)
select coalesce((
  select count(*) from islands
  where grp = (select grp from islands order by rn asc limit 1)   -- island containing the most-recent met week
    and (select min(rn) from islands) <= 2                         -- streak is "live" only if it touches this/last week
), 0);
```

The `<= 2` guard implements "an in-progress current week (rn=1) that hasn't yet hit goal doesn't break the streak, but a fully-missed last week does." **The planner should write a `test:rls`/unit fixture covering: (a) 3 consecutive goal-weeks → 3; (b) a gap → resets; (c) current week not-yet-met but last 4 weeks met → 4.** Mark the exact `<= 2` boundary behavior a planner decision (it encodes a product judgment about the in-progress week).

> **CONFIDENCE: streak SQL = MEDIUM.** The structure (qualifying weeks → calendar spine → islands) is standard and verified-correct in shape, but the precise "in-progress current week" boundary is a product decision the planner must lock with a test fixture. Everything else in Mandate 1 is HIGH.

## RPC pattern conformance (D-23) — CONFIRMED against 0006

Every clause below is present in `0006_phase6_chart_rpcs.sql` and MUST be replicated:
- `language sql` + `security invoker` + `stable` [CITED: 0006:63-66, 105-108, 153-156]
- `set search_path = ''` [CITED: 0006:66, 108, 156]
- Fully-qualified `public.workout_sessions` / `public.exercise_sets` / `public.workout_plans` / `public.profiles` [CITED: 0006:77-81, 116-118, 165-167]
- `set_type = 'working'` on every volume aggregate [CITED: 0006:82, 121, 170]
- `revoke all ... from public; grant execute ... to authenticated;` trailer per function [CITED: 0006:90-91, 127-128, 178-179]
- `s.finished_at is not null` filter (only finished sessions count) [CITED: 0006:83, 119, 168]

---

# MANDATE 2 — Chart-Summary Aggregates (D-12 / D-14)

## Recommendation: NEW `get_exercise_summary(p_exercise_id, p_metric, p_since)`

Do **not** extend `get_exercise_chart` (changing its return shape breaks `ChartRowSchema` and the memoized chart consumer at `chart.tsx:146-153`). Add an additive sibling RPC returning a single summary row for the hero + 3-stat block:

```sql
returns table (
  current_best        numeric,   -- D-12 hero: max weight (metric=weight) OR latest session volume (metric=volume)
  range_first_value   numeric,   -- for the hero delta (current_best - range_first_value)
  top_set_weight_kg   numeric,   -- D-14: heaviest working set in range
  top_set_reps        int,       --       its reps (for "{w} × {r}")
  vol_per_session_kg  numeric,   -- D-14: avg Σ working-set volume per finished session in range
  avg_rpe             numeric    -- D-14: AVG(rpe) over working sets in range; NULL when all NULL
)
```

The hero delta is computed client-side: `current_best - range_first_value` (weights) or `%` (volume) — same pattern as Mandate 1's volume delta. The `p_metric` parameter selects what `current_best`/`range_first_value` mean (max weight vs session volume), mirroring the existing `get_exercise_chart` CASE.

## avg-RPE NULL handling — CONFIRMED

`exercise_sets.rpe` is **nullable** (verified: schema has `reps int not null, weight_kg numeric not null` but no NOT NULL on rpe — RPE was added in F11 as optional). Postgres `AVG(es.rpe)` **ignores NULLs automatically** and returns NULL only when *every* row is NULL. So:

```sql
avg(es.rpe) filter (where es.set_type = 'working') as avg_rpe
```

- Some sets have RPE → average of the non-null ones (correct).
- All sets NULL → `avg_rpe` is NULL → the **UI shows `–`** per the Copywriting Contract ("`–` when no RPE data", UI-SPEC line 156).

[VERIFIED: codebase — `0001_initial_schema.sql` exercise_sets has no NOT NULL on rpe; CONTEXT D-14 + UI-SPEC line 156 specify the `–` fallback]

> **Confirm at planning time:** grep `0001_initial_schema.sql` for the exact `rpe` column line (it sits among the exercise_sets columns ~line 72-82) to confirm type `numeric`/`smallint` and nullability before writing the Zod schema (`z.coerce.number().nullable()`).

## Range → since-timestamp mapping (D-11: 30d / 90d / All, default 90d)

Replace the existing 5-state `windowToSince` with the new 3-state mapping (a **new** `ChartRange` type — do NOT mutate the existing `ChartWindow` union that the v1 chart still typed against until the chart is fully migrated):

```ts
import { subDays } from "date-fns";
export type ChartRange = "30d" | "90d" | "All";
function rangeToSince(range: ChartRange): string | null {
  const now = new Date();
  switch (range) {
    case "30d": return subDays(now, 30).toISOString();
    case "90d": return subDays(now, 90).toISOString();  // default
    case "All": return null;
  }
}
```

`p_since` is passed to both `get_exercise_chart` (re-used for the line) AND the new `get_exercise_summary` so the hero/stats reflect the same window as the rendered line. Same `null as unknown as string` cast for the All case (documented type-gen limitation, `exercise-chart.ts:120`). [CITED: exercise-chart.ts:84-98 windowToSince + cast note]

> **Note:** the existing `exerciseChartKeys.byExercise` and `exerciseTopSetsKeys.byExercise` query-key factories type their `window` param as the 5-state union (`keys.ts:87-115`). The planner must **add new range-aware key factories** (e.g. `exerciseSummaryKeys`, and a 3-state variant) rather than editing the existing 5-state factories — those are still referenced by the unmigrated chart. **D-24 forbids touching existing query keys' shape**; add new ones.

---

# MANDATE 3 — Mount Animations (MOTN-02 / MOTN-03) + Overflow Glow (D-19)

## The Phase 8 primitives are STATIC by design — animation is additive

`ProgressRing.tsx` and `Sparkline.tsx` both carry an explicit header: *"STATIC ONLY (D-08) ... This file MUST NOT import useSharedValue / useDerivedValue / withTiming. Animated fill is Phase 12 (MOTN-02)."* [CITED: ProgressRing.tsx:9-12, Sparkline.tsx:11-13]. Phase 12 is the phase that lifts that restriction.

**Recommended approach:** keep the primitives' *math* intact; add an **optional animated `value`/draw path**. Two viable shapes — recommend the **prop-driven SharedValue** form so the parent owns the spring and reduce-motion:

### ProgressRing animated fill (MOTN-02 + D-19 overflow glow)

The current ring builds a static Skia arc: `fg.addArc({...}, -90, 360 * v)` [CITED: ProgressRing.tsx:77]. To animate, drive the sweep angle from a SharedValue and rebuild the path inside `useDerivedValue` (Skia consumes the derived path reactively):

```tsx
// ProgressRing — animated variant (Reanimated 4 + Skia 2.2)
import { useDerivedValue, useSharedValue, withSpring } from "react-native-reanimated";
import { useReducedMotion } from "react-native-reanimated";
import { Skia } from "@shopify/react-native-skia";

const reduced = useReducedMotion();                 // synchronous boolean (verified API)
const progress = useSharedValue(0);                 // 0 → target fraction
useEffect(() => {
  if (reduced) { progress.value = v; }              // snap to final (D-18)
  else { progress.value = withSpring(v, { damping: 18, stiffness: 220 }); }  // §07 spring
}, [v, reduced]);

// Skia path rebuilt reactively on the UI thread from the animated value:
const fgPath = useDerivedValue(() => {
  const p = Skia.Path.Make();
  p.addArc({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, -90, 360 * progress.value);
  return p;
});
// <Path path={fgPath} ... />   // animated arc
```

**Overflow / goal-beaten (D-19):** when `sessions >= goal`, `value > 1`. The current ring clamps `value` to 0..1 (`ProgressRing.tsx:69`). For overflow, **don't clamp** when overflow treatment is desired — instead:
- **Recommended (simplest, on-brand): second-lap arc + accent glow.** Animate the first lap to 360°, then draw a *second* foreground arc for `(progress - 1) * 360` in the brand gradient over the first, plus a Skia blur/glow. In Skia 2.x, glow via a `<Blur blur={...}/>` child or a low-opacity wider stroke underneath the arc. This celebrates the beat without a hue change. The center label always shows the **real count** (e.g. "5 / 4"), not the capped fraction (D-19 + UI-SPEC line 182).
- The exact treatment (second arc vs hue shift) is explicitly the planner's call (D-19) — recommend second-arc-plus-glow for clarity and least risk.

### Chart line draw left→right (MOTN-03)

Victory Native XL's `<CartesianChart>` accepts an `animate` prop, and `<Line>` supports an `animate={{ type: "timing", duration }}` to tween path changes. For a *draw-on-mount* left→right effect the robust, version-stable approach is a **Reanimated-driven clip**: wrap the `<Line>` in a Skia clip rect whose width animates 0→full via a SharedValue. This is independent of Victory's internal animation API (which targets *data changes*, not mount reveals):

```tsx
// Inside the CartesianChart children, clip the line by an animated-width rect:
const drawProgress = useSharedValue(0);
useEffect(() => {
  drawProgress.value = reduced ? 1 : withSpring(1, { damping: 18, stiffness: 220 });
}, [reduced, chartData]);   // re-draw when data identity changes (respect chart.tsx memo contract)
const clipRect = useDerivedValue(() =>
  Skia.XYWHRect(chartBounds.left, chartBounds.top,
    (chartBounds.right - chartBounds.left) * drawProgress.value,
    chartBounds.bottom - chartBounds.top));
// <Group clip={clipRect}><Line points={points.y} .../></Group>
```

> **Re-draw trigger nuance:** the existing chart memoizes `chartData` with dep array *exactly* `[chartQuery.data]` (D-21 contract, `chart.tsx:146-153`). The draw animation should re-fire when `chartQuery.data` identity changes (new window/metric) — list `chartData` in the effect dep, NOT metric/window directly, to honor that contract.

### Sparkline draw-in (D-18)

Same clip technique inside `Sparkline.tsx`: the line/area paths are already built statically (`Sparkline.tsx:74-83`); wrap them in an animated-width `<Group clip={...}>`. The last-point dot (`Sparkline.tsx:106-113`) should fade/scale in at the end of the draw (a second SharedValue or `withDelay`).

### Number count-ups (D-18)

Drive a SharedValue 0→N and render via a Reanimated text component. Skia text already does this in the chart tooltip via `useDerivedValue` (`chart.tsx:224-234`). For RN `<Text>`, use `react-native-reanimated`'s `useAnimatedProps` on an `Animated.Text` (or a small `useDerivedValue` + `runOnJS` setState throttle). **Honor tabular-nums** (`fontVariant: ["tabular-nums"]`) so the counting digits don't jitter — the codebase already uses this idiom (`(tabs)/index.tsx:696`). Convert to display unit BEFORE animating (animate the converted target, D-20).

## Reduce-motion — CONFIRMED API

`useReducedMotion()` from `react-native-reanimated` returns a **synchronous boolean** captured at app start. [CITED: docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/]. When true, **snap to final** by assigning `progress.value = target` directly (skip `withSpring`). Alternative: pass `reduceMotion: ReduceMotion.System` into each `withSpring`/`withTiming` config and Reanimated auto-snaps — either works; the explicit `if (reduced)` branch is clearer and matches the pattern above.

> **Important caveat:** `useReducedMotion()` does NOT re-render on a live setting change (value is start-of-app). That's acceptable here (mount animations only). The simpler app-wide alternative is dropping a `<ReducedMotionConfig mode={ReduceMotion.System} />` once at the root — but that changes global behavior; recommend the per-component hook to keep the blast radius small.

## matchFont pitfall (FIT-67) — MUST NOT REGRESS

The chart's Skia axis/tooltip font uses `matchFont({ fontFamily: "Helvetica", fontSize: 12 })`, NOT `useFont(null, 12)`. Skia 2.x removed the null-typeface system-font fallback, so `useFont(null, ...)` returns `null` and silently renders **no** axis labels / invisible tooltip text. [CITED: chart.tsx:184-195 FIT-67 root-cause comment]. When re-skinning the chart, **preserve `matchFont`** — do not "simplify" it back to `useFont(null)`. Any new Skia text the re-skin adds (e.g. animated count-up rendered in-canvas) must use a `matchFont`-resolved SkFont. Flag this in the chart re-skin task's verification.

---

# MANDATE 4 — Offline-First Dashboard Query (D-03)

## How it plugs into the existing persister

The app mounts a single `PersistQueryClientProvider` with `asyncStoragePersister` and `maxAge: 24h` [CITED: _layout.tsx:243-263]. **Every** `useQuery` cache slot is automatically persisted/hydrated by this provider — there is no per-query opt-in. So the new dashboard query is offline-first *for free* as long as it:
1. Uses a stable, hierarchical query key (add `dashboardKeys` to `keys.ts`).
2. Inherits the QueryClient defaults (`networkMode: 'offlineFirst'`, 30s staleTime) — i.e. does NOT override `networkMode`.
3. Does NOT set `enabled: false` permanently (gate on `!!userId` like `useSessionsListInfiniteQuery`, `sessions.ts:197,228`).

This is the **identical pattern** the history list already uses (`useSessionsListInfiniteQuery` — "the TanStack persister hydrates this cache slot from AsyncStorage at cold-start so the list is visible offline", `sessions.ts:166-169`).

## New query key + hook (additive — D-24 safe)

```ts
// keys.ts — ADD (do not edit existing factories)
export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
};
```

```ts
// app/lib/queries/dashboard.ts — NEW file, mirrors sessions.ts shape
export function useDashboardSummaryQuery() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const tz = Localization.getCalendars()[0]?.timeZone ?? "Europe/Stockholm";
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_summary", { p_tz: tz });
      if (error) throw error;
      return DashboardSummarySchema.parse(data?.[0] ?? null);  // RPC returns a single-row table
    },
    enabled: !!userId,
  });
}
```

## Skeleton-only-on-empty-cache (D-03 / D-04)

TanStack v5 distinguishes "no cache yet" from "cached, refetching":
- **Truly-empty cache** (brand-new install): `query.isPending && !query.data` → show skeleton (D-03). For a brand-new *user* with 0 sessions, the RPC returns zeroes → render the **zeroed hero + nudge** (D-04), NOT a skeleton.
- **Hydrated cache** (returning user, offline cold-start): persister restores `data` so `status === 'success'` instantly → show last-known numbers immediately, silent background refetch (D-03).

So the gate is: `if (isPending && data === undefined) → skeleton; else → render hero with data (zeros included)`. The zeroed-hero (D-04) is just the success branch with `sessions_this_week=0, streak_weeks=0, volume=0` — distinguish "new user" from "loading" by `data !== undefined` (data present, all zero) vs `data === undefined` (no fetch yet).

## F13 isolation (D-24) — CONFIRMED

This adds a **new read-only query slot** + **two new read-only RPCs**. It touches NONE of: mutation defaults (`client.ts` setMutationDefaults), the 13 mutation keys, the `session:${id}` persister scope-bindings, or `exercise_sets` write behavior. The persister provider config is unchanged (no `dehydrateOptions`/`shouldDehydrateQuery` edits needed — default persists everything). **`npm run test:f13-brutal` must be re-run green as a phase gate** but no F13 code is modified.

---

# MANDATE 5 — Units Conversion Adoption (D-20)

## Helper API — CONFIRMED

`app/lib/units.ts` exports two pure functions [CITED: units.ts:28-45]:
- `toDisplayWeight(kg: number, unit: UnitPref): number` — metric passthrough; imperial divides by `0.45359237` and rounds to nearest 0.5 lb. Non-finite → 0.
- `formatWeight(kg: number, unit: UnitPref): string` — returns `"100 kg"` / `"220.5 lb"`, trimming to 1 decimal for fractional values, integer otherwise.
- `UnitPref = "metric" | "imperial"`.

The unit pref is read from the Phase 9 `fm:units` preference (AsyncStorage, Zod-catch enum read — same idiom as `fm:theme`/`fm:language` in `_layout.tsx`). The planner must locate the existing units-pref reader/store from Phase 9 and feed `unit` into every conversion.

## What must convert (D-20: EVERYTHING)

| Figure | Source (canonical kg) | Conversion |
|--------|----------------------|------------|
| Per-set weight (session detail) | `exercise_sets.weight_kg` | `formatWeight(kg, unit)` |
| Top set (chart 3-stat, session breakdown) | `get_exercise_summary.top_set_weight_kg` | `formatWeight(kg, unit)` |
| This-week volume (Home chip + History card) | `volume_this_week_kg` | see volume nuance ↓ |
| Sparkline values | `weekly_volume_series[].volume_kg` | convert each point (axis-free, just the magnitudes) |
| Chart Y-axis + line values | `get_exercise_chart.value` | convert in the chart-data memo + `formatYLabel` |
| Chart hero current-best | `get_exercise_summary.current_best` | `formatWeight` (weight metric) |
| Vol-per-session (chart 3-stat) | `vol_per_session_kg` | volume conversion ↓ |

## Volume-conversion nuance (load-bearing)

Volume = Σ(weight_kg × reps), stored as a **kg-magnitude** number. To display volume in lbs you convert the **aggregate kg-volume** to lbs, NOT each weight then re-sum:

```
volume_lb = volume_kg / 0.45359237          // pounds of total tonnage
```

**Do NOT** apply `toDisplayWeight`'s nearest-0.5 rounding to a volume figure — the 0.5-lb plate-granularity rounding is meaningful only for individual *weights*, not for a 28,720 kg tonnage sum (rounding a 6-digit number to 0.5 is pointless and the result is huge anyway). Recommend a **separate `toDisplayVolume(kg, unit)`** that divides without the half-rounding, or simply `kg / KG_PER_LB` inline with locale number formatting (`toLocaleString`). Per CONTEXT D-20 + Specifics: "even though lbs-volume numbers get large" — that's accepted; keep the screen unit-consistent.

> **Planner action:** add a `toDisplayVolume` / `formatVolume` to `units.ts` (additive, pure, importable from tsx tests like the existing helpers) rather than misusing `toDisplayWeight` for tonnage. Flag the rounding distinction in the task.

## The "Senaste 10" existing string is hardcoded kg

The current chart's Senaste-10 row renders `` `${row.weight_kg} kg × ${row.reps}` `` [CITED: chart.tsx:389] — raw kg, no conversion. The re-skin MUST route this through `formatWeight(row.weight_kg, unit)`. Same for the tooltip strings (`chart.tsx:167-182`) and the y-axis (`formatYAxisLabel`, `chart.tsx:236-237`). These are concrete D-20 regression points — the v1 chart predates the units helper.

---

# MANDATE 6 — i18n + Verification Touchpoints

## Flat-key i18n convention — CONFIRMED

`app/locales/{sv,en}.json` are **flat key→string** maps (Phase 8 D-10), `t('key')` with `{{interpolation}}` [CITED: sv.json:1-40 — flat keys like `"weekVolume": "Veckans volym"`]. The existing keys already cover some of this surface: `weekVolume`, `weekSessions`, `streak`, `days`, `day`, `history`, `sets`. **New keys** the planner adds (sv+en, flat): the streak relabel + dashboard/chart/lifetime strings per the UI-SPEC Copywriting Contract table (lines 127-160).

## Streak relabel (D-07) — dagar → veckor

Existing keys `"days": "dagar"` / `"day": "dag"` are the **daily** streak labels. D-07 redefines streak as weeks. **Add** `"weeks": "veckor"` / `"week": "vecka"` keys (do NOT ship "dagar" for the streak chip). The chip composes `{N} {t('weeks')} {t('streak')}` with singular `vecka/week` at N=1. [CITED: sv.json:19-21 + CONTEXT D-07 + UI-SPEC line 131]. Leave the existing `days`/`day` keys in place (they may be used elsewhere); just don't use them for the streak chip.

## Verification gates the planner MUST add as explicit tasks

| Gate | Command / Action | Why |
|------|------------------|-----|
| Type regen co-commit | `npm run gen:types` after `0011` push; commit `app/types/database.ts` in the SAME commit as the migration | CLAUDE.md DB convention — hand-editing database.ts forbidden |
| Deploy verification | Add `"get_dashboard_summary"` + `"get_exercise_summary"` to the `phase6Functions`-style array in `app/scripts/verify-deploy.ts` (the pg_proc INVOKER + search_path check) | D-23; mirrors verify-deploy.ts:82-86 |
| Cross-user RLS | Add a cross-user assertion **per new RPC** to `app/scripts/test-rls.ts` (A calls RPC, asserts B's data not leaked) — mirror the `get_exercise_chart` cross-user block | D-23; mirrors test-rls.ts:963-987 |
| F13 regression | `npm run test:f13-brutal` green after | D-24 / SKIN-08 standing constraint |
| Lint/types | `npm run` lint + tsc (CI `phase-branch.yml`) | Project CI gate |

### verify-deploy.ts extension pattern (copy this exact block shape)

```ts
// Phase 12 (Migration 0011) — assert the new dashboard + summary RPCs.
const phase12Functions = ["get_dashboard_summary", "get_exercise_summary"];
for (const fname of phase12Functions) {
  const rows = await sql`select proname, prosecdef, proconfig from pg_proc
    where pronamespace = 'public'::regnamespace and proname = ${fname}`;
  // assert rows.length === 1, prosecdef === false (INVOKER),
  //        proconfig joins to include "search_path="
}
```
[CITED: verify-deploy.ts:82-119 — the exact Phase 6 block to replicate]

### test-rls.ts extension pattern

```ts
// A's anon client calls get_dashboard_summary; assert it returns ONLY A's aggregates
// (e.g. B's finished sessions do not inflate A's lifetime_sessions / volume).
const { data, error } = await clientA.rpc("get_dashboard_summary", { p_tz: "Europe/Stockholm" });
// assert no error; assert data reflects only A's seeded sessions, not B's.
// Same for get_exercise_summary with B's exercise_id → expect empty/zeroed (RLS-filtered).
```
[CITED: test-rls.ts:938-987 — the Phase 6 cross-user RPC blocks to mirror]

---

## Architecture Patterns

### System Architecture Diagram

```
[Home tab idle]──┐
                 ├─► useDashboardSummaryQuery ──► supabase.rpc("get_dashboard_summary", {p_tz})
[History screen]─┘            │                          │ (security invoker, RLS via JWT)
                             │                          ▼
                             │           ┌─ workout_sessions (finished, user-scoped)
                             │           ├─ exercise_sets (set_type='working')
                             │           └─ profiles (weekly_goal)
                             ▼                          │
              TanStack cache (dashboardKeys.summary)    │ returns 1 row, canonical kg
                 ▲ persisted/hydrated (AsyncStorage)    │
                 └──── PersistQueryClientProvider ◄──────┘
                             │
                             ▼  (client converts kg→unit via lib/units.ts)
        ┌─ Home: ProgressRing (animated sweep) + streak chip + volume chip
        └─ History: lifetime eyebrow + volume card (delta + animated Sparkline)

[Home active session]──► useActiveSessionQuery ──► <ActiveSessionBanner> (replaces hero, D-02)

[Chart screen]──► useExerciseChartQuery (line, re-used) ──┐
              ├─► useExerciseSummaryQuery (NEW) ──────────┼─► get_exercise_summary(id, metric, since)
              └─► useExerciseTopSetsQuery (Senaste 10) ───┘   (hero + 3-stat + delta)
                             │
                             ▼ Victory <CartesianChart> + animated clip (draw L→R)
                               + Skia matchFont axis labels (FIT-67 preserved)
```

### Recommended file changes
```
app/supabase/migrations/0011_phase12_dashboard_rpcs.sql   # NEW: 2 RPCs
app/types/database.ts                                       # regen (gen:types)
app/lib/query/keys.ts                                       # ADD dashboardKeys + exerciseSummaryKeys
app/lib/queries/dashboard.ts                               # NEW hook
app/lib/queries/exercise-chart.ts                          # ADD useExerciseSummaryQuery + rangeToSince
app/lib/units.ts                                            # ADD toDisplayVolume/formatVolume
app/components/ui/ProgressRing.tsx                          # ADD animated value (lift static restriction)
app/components/ui/Sparkline.tsx                             # ADD animated draw-in
app/app/(app)/(tabs)/index.tsx                             # ADD ring hero (above plan list) + active swap
app/app/(app)/(tabs)/history.tsx                           # re-skin FHistory + volume card + eyebrow
app/app/(app)/history/[sessionId].tsx                      # re-skin FSessionDetail + custom header
app/app/(app)/exercise/[exerciseId]/chart.tsx             # re-skin FChart + 3-state range + hero + draw
app/locales/{sv,en}.json                                    # new flat keys + weeks/week
app/scripts/verify-deploy.ts                                # ADD phase12Functions block
app/scripts/test-rls.ts                                     # ADD cross-user assertions per new RPC
```

### Anti-Patterns to Avoid
- **Editing existing query-key factories' shape** (D-24) — add NEW factories; the 5-state chart keys are still live.
- **`useFont(null, ...)`** in any Skia text — returns null on Skia 2.x (FIT-67); use `matchFont`.
- **Box styling in inline `style()` callbacks** for Pressables — renders naked under NativeWind 4; box decoration goes in `className` (Phase 10 memory; UI-SPEC line 36).
- **Modal portals** for overflow/delete-confirm — inline-overlay only (D-22).
- **Applying 0.5-lb rounding to volume** — that rounding is for individual weights only.
- **Naive UTC `date_trunc('week')`** without `AT TIME ZONE p_tz` — mis-buckets late-Sunday/early-Monday sessions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Week aggregation in JS | Client-side loop over all sets | `get_dashboard_summary` RPC | RLS scoping + tonnage math belong server-side; client only converts/displays |
| kg↔lb conversion | Inline `* 2.2046` | `lib/units.ts` `toDisplayWeight` | Exact `KG_PER_LB`, NaN guard, 0.5 rounding already correct |
| Streak detection in JS | Iterate weeks client-side | SQL gaps-and-islands in the RPC | Needs all finished sessions; do it where the data lives |
| Ring fill animation | CSS/layout-anim hacks | Reanimated SharedValue → Skia derived path | Only path that animates a Skia arc |
| Chart draw reveal | Re-implement Victory internals | Reanimated-driven Skia clip rect | Version-stable; independent of Victory's data-change `animate` |
| IANA timezone | Hardcode "Europe/Stockholm" as the only value | `Localization.getCalendars()[0].timeZone` | Already a dep; correct for travel/locale (fallback to Stockholm) |

**Key insight:** the heavy lifting (aggregation, RLS, conversion math) all has an existing home — the win this phase is *composition + animation*, not new algorithms. The single genuinely novel algorithm is the streak gaps-and-islands SQL.

## Common Pitfalls

### Pitfall 1: UTC week-bucketing error
**What goes wrong:** A Sunday-evening session (local) stored as Monday UTC lands in next week's bucket → ring/volume off by one session at week edges.
**How to avoid:** `AT TIME ZONE p_tz` before `date_trunc('week', ...)`; pass IANA tz from `expo-localization`.
**Warning signs:** "I logged Sunday night but the ring didn't increment / reset early Monday."

### Pitfall 2: Skia null font (FIT-67 regression)
**What goes wrong:** Re-skin "simplifies" the chart font to `useFont(null, 12)` → axis labels + any in-canvas count-up vanish silently.
**How to avoid:** Keep `matchFont({ fontFamily: "Helvetica", fontSize: 12 })`.
**Warning signs:** Chart renders the line but no axis numbers on device.

### Pitfall 3: Naked Pressable re-skin (NativeWind 4)
**What goes wrong:** Box bg/border/radius in `style()` callback → renders unstyled.
**How to avoid:** Box decoration in `className`; `style()` only for shadow/opacity/animated values.
**Warning signs:** Session rows / segmented control / circular buttons render transparent.

### Pitfall 4: Persister hydration race / skeleton flash
**What goes wrong:** Showing skeleton on `isPending` regardless of cache → returning user sees a flash before hydration.
**How to avoid:** Gate skeleton on `isPending && data === undefined`; render last-known data when present (D-03).

### Pitfall 5: Volume conversion double-rounding
**What goes wrong:** Running `toDisplayWeight` (0.5-round) on a tonnage sum produces a meaningless rounded huge number.
**How to avoid:** Separate `toDisplayVolume` without half-rounding.

### Pitfall 6: Changing existing query keys (D-24 violation)
**What goes wrong:** Editing `exerciseChartKeys` to 3-state breaks the unmigrated chart cache + persister scope.
**How to avoid:** Add NEW key factories for the new range/summary; migrate the chart screen to them in the same task.

## State of the Art

| Old Approach (v1) | Current Approach (Phase 12) | Impact |
|-------------------|------------------------------|--------|
| 5-state chart window (1M/3M/6M/1Y/All) | 3-state range (30d/90d/All, default 90d) | New `ChartRange` type + `rangeToSince`; new key factory |
| Static `ProgressRing`/`Sparkline` | Animated mount fill/draw | Lift the explicit static-only restriction in those files |
| Native Stack header on detail/chart | Custom in-content Forge header | `headerShown:false` + circular back/ellipsis (D-17) |
| Hardcoded Swedish strings + raw kg | Full i18n + unit conversion | Every figure through `t()` + `lib/units.ts` |

**Deprecated/outdated:** v1 chart's `WINDOW_OPTIONS` 5-state array (`chart.tsx:82-88`) is replaced by the 3-state range.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `exercise_sets.rpe` is nullable `numeric`/`smallint` | Mandate 2 | If NOT NULL, the `–` fallback never triggers (cosmetic); confirm exact line in 0001 before Zod schema. LOW risk — F11 added RPE as optional. |
| A2 | The `<= 2` "in-progress current week" boundary in the streak is the desired product behavior | Mandate 1 | Streak could count/not-count an unfinished current week differently than the user expects. MEDIUM — planner must lock with a test fixture + possibly a discuss-phase confirmation. |
| A3 | Phase 9 stores units pref under an `fm:units`-style AsyncStorage key with a reader/store | Mandate 5 | If the reader doesn't exist, planner adds one (small). LOW — CONTEXT D-20 + carry-forward 09-CONTEXT confirm `fm:units` exists. |
| A4 | `Localization.getCalendars()[0].timeZone` returns a valid IANA zone on the target iPhone | Mandate 1/4 | If undefined, fallback to `'Europe/Stockholm'` (already in sketch). LOW. |

**Note:** A1, A3, A4 are LOW-risk verification-at-planning items. A2 is the one genuine product decision the planner/discuss-phase should confirm.

## Open Questions (RESOLVED)

1. **Streak "in-progress current week" semantics (A2). — RESOLVED / LOCKED.**
   - What we know: streak = consecutive goal-weeks (D-07); the current week may be mid-progress.
   - **LOCKED boundary:** Show the prior streak count until the current calendar week is *provably* missed (i.e. the current Mon–Sun has ended without meeting `weekly_goal`). An in-progress current week that has *already* met the goal counts toward the streak; an in-progress week that has *not yet* met it does NOT break the streak. This is exactly what the `<= 2` island guard in the Mandate 1 SQL sketch encodes (the island is "live" only if it touches rn=1 (this week) or rn=2 (last week)). **Locked and proven by the Plan 01 `test-dashboard-aggregates.ts` fixture.**

2. **`vol_per_session_kg` denominator (D-14). — RESOLVED.**
   - What we know: "vol-per-session over the selected range."
   - **RESOLVED:** average over **sessions in range that CONTAIN this exercise** (not all finished sessions in range). This matches the "this exercise's vol-per-session" framing. Document this denominator in the `get_exercise_summary` RPC comment.


## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase Postgres (RPC deploy) | Migration 0011 | ✓ | live project | — |
| `gen:types` script | Type regen | ✓ | `npm run gen:types` exists | — |
| `verify-deploy.ts` harness | Deploy verification | ✓ | `npx tsx --env-file=.env.local scripts/verify-deploy.ts` | — |
| `test-rls.ts` harness | Cross-user RLS | ✓ | `npm run test:rls` | — |
| `test:f13-brutal` | F13 regression | ✓ | `npm run test:f13-brutal` | — |
| All RN/Skia/Reanimated/Victory libs | Animations + chart | ✓ | pinned (no install) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `Localization.getCalendars()[0].timeZone` → fallback `'Europe/Stockholm'`.

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bespoke `tsx` Node scripts (no jest/vitest in repo) — `test-rls.ts`, `verify-deploy.ts`, `verify-f13-brutal-test.ts` |
| Config file | none — scripts invoked via `npm run` + `tsx --env-file=app/.env.local` |
| Quick run command | `cd app && npm run test:rls` |
| Full suite command | `cd app && npm run test:rls && npx tsx --env-file=.env.local scripts/verify-deploy.ts && npm run test:f13-brutal` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-05 | `get_dashboard_summary` is INVOKER + search_path set | deploy-check | `npx tsx --env-file=.env.local scripts/verify-deploy.ts` | ✅ extend |
| DASH-05 | `get_dashboard_summary` RLS-scopes per user (no cross-user leak) | rls | `npm run test:rls` | ✅ extend |
| SKIN-06 | `get_exercise_summary` INVOKER + RLS-scoped | deploy + rls | both above | ✅ extend |
| DASH-02 | Streak: 3 consecutive goal-weeks → 3; gap resets; in-progress current week | unit/fixture | new fixture in `test-rls.ts` or a small `tsx` script | ❌ Wave 0 |
| DASH-06/D-06 | Week boundary buckets Sunday-night-local into the correct ISO week | unit/fixture | seed a UTC-edge session, assert bucket | ❌ Wave 0 |
| MOTN-02/03 | Reduce-motion snaps to final; non-reduce animates | manual device UAT | n/a (visual) | manual-only |
| D-20 | Every figure converts to selected unit (no stray kg in lbs mode) | manual device UAT + code grep | grep for raw `kg` literals in re-skinned files | manual + grep |
| D-24 | F13 hot path green | brutal | `npm run test:f13-brutal` | ✅ |

### Sampling Rate
- **Per task commit:** `npm run test:rls` (after any RPC/migration touch) + tsc/lint.
- **Per wave merge:** full suite (test:rls + verify-deploy + test:f13-brutal).
- **Phase gate:** full suite green + manual device UAT for motion + units before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Streak fixture — seed N goal-weeks + a gap, assert `streak_weeks` (covers DASH-02; the streak SQL is the highest-risk logic).
- [ ] Week-boundary fixture — seed a Sunday-23:30-local session, assert it counts in the correct ISO week (covers D-06 / Pitfall 1).
- [ ] `verify-deploy.ts` Phase 12 block — add `["get_dashboard_summary","get_exercise_summary"]`.
- [ ] `test-rls.ts` cross-user assertions — one per new RPC.

*(Motion + units correctness are inherently device-visual — manual UAT per the project's established UI device-UAT iteration pattern.)*

## Security Domain

> security_enforcement enabled (config.json `workflow.security_enforcement: true`, ASVS L1). Threat IDs T-12-* per the project per-phase contract.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no new auth) | existing session via LargeSecureStore — untouched |
| V3 Session Management | no | untouched |
| V4 Access Control | **yes** | RLS via `security invoker` RPCs (API1/V4) — new RPCs inherit 0001 policies; cross-user `test:rls` per RPC |
| V5 Input Validation | **yes** | Zod-parse every RPC row at the wire boundary (PITFALLS §8.13); `p_tz` is a text param → SQL uses it only in `AT TIME ZONE` (no dynamic SQL/injection surface) |
| V6 Cryptography | no | none introduced |
| V8 Data Protection | **yes** | API3 — aggregates scoped at DB; client never aggregates across users; no PII in new surfaces |

### Known Threat Patterns for Supabase RPC + RN
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user aggregate leak (B's sessions inflate A's totals) | Information Disclosure | `security invoker` + 0001 RLS; cross-user `test:rls` assertion per RPC (T-12-*) |
| SQL injection via `p_tz` | Tampering | `p_tz` used ONLY as `AT TIME ZONE p_tz` (Postgres validates the zone string; not concatenated into dynamic SQL) — no injection vector |
| search_path hijack on INVOKER function | Elevation/Tampering | `set search_path = ''` + fully-qualified `public.*` (D-23, copy 0006) |
| Untrusted RPC wire shape | Tampering | Zod `.parse` at the hook boundary before UI (existing pattern) |
| F13 regression via shared mutation surface | Tampering/DoS | Read-only RPCs; no mutation/queue/persister-scope touched (D-24); `test:f13-brutal` gate |

**Planner must include** a `<threat_model>` STRIDE register (T-12-* IDs) per CLAUDE.md per-phase contract, with the cross-user-leak threat for EACH new RPC dispositioned `mitigate` (RLS + test:rls), and `gsd-secure-phase 12` must close `threats_open: 0`.

## Project Constraints (from CLAUDE.md)

- **Tech stack locked** (Expo + Supabase + TS) — no new deps; verified none needed.
- **iOS-only V1** — `matchFont` Helvetica branch is the only platform path (chart.tsx FIT-67).
- **≤3s log budget / never lose a set** — read-side only; F13 untouched (D-24).
- **RLS obligatory on all tables; service-role-key NEVER in client** — new RPCs are `security invoker`; service-role only in `test-rls.ts` (audit gate intact).
- **Zod for all external data** — every RPC row parsed (V5).
- **Migration-as-truth** — `0011_*.sql`, no Studio edits; `gen:types` co-commit; `verify-deploy.ts` after push; cross-user `test:rls` per new RPC.
- **`(select auth.uid())` wrapping** — N/A directly (RPCs rely on table RLS, not their own policies), but the *underlying* 0001 policies already use the wrapped form.
- **Every writable policy needs `using` + `with check`** — N/A (read-only RPCs, no new writable policies).
- **Branching:** work on `gsd/phase-12-history-detail-chart-home-dashboard` (already checked out); PR to `dev`; Linear `[FIT-XX]` per plan sub-issue.

## Sources

### Primary (HIGH confidence — codebase, cited)
- `app/supabase/migrations/0006_phase6_chart_rpcs.sql` — RPC pattern template (security invoker / stable / search_path / set_type='working' / fully-qualified)
- `app/lib/queries/exercise-chart.ts` — chart hook + windowToSince + Zod-parse + null-cast pattern
- `app/lib/units.ts` — kg↔display helper API (toDisplayWeight/formatWeight/UnitPref)
- `app/components/ui/ProgressRing.tsx` / `Sparkline.tsx` — static Skia primitives + explicit "animate in Phase 12" headers
- `app/app/(app)/exercise/[exerciseId]/chart.tsx` — Victory chart + matchFont FIT-67 + Reanimated useDerivedValue pattern + memo contract
- `app/app/_layout.tsx` — PersistQueryClientProvider config (persists all slots, 24h maxAge)
- `app/lib/queries/sessions.ts` — offline-first read hook + persister-hydration pattern + enabled gate
- `app/lib/query/keys.ts` — hierarchical key factory convention
- `app/app/(app)/(tabs)/index.tsx` — Forge token hexes, Reanimated withSpring §07 spring, NativeWind box-styling rule
- `app/scripts/verify-deploy.ts` (lines 82-119) + `app/scripts/test-rls.ts` (lines 938-987) — extension patterns
- `app/locales/sv.json` — flat-key i18n convention + existing streak keys
- `app/supabase/migrations/0001_initial_schema.sql` — table shapes (started_at/finished_at/weight_kg/reps/set_type/rpe)
- `.planning/config.json` — nyquist_validation + security_enforcement enabled

### Secondary (verified external)
- [PostgreSQL Date/Time Functions](https://www.postgresql.org/docs/current/functions-datetime.html) — `date_trunc('week')` is Monday-based ISO 8601 (no configurable week start)
- [PostgreSQL date_trunc('week') Gotcha](https://medium.com/@raileohang/postgresql-date-trunc-week-gotcha-b8a90960026c) — Monday-basis confirmation
- [Reanimated useReducedMotion](https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/) — synchronous boolean, captured at app start
- [Reanimated Accessibility / ReducedMotionConfig](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/) — snap-to-final via reduceMotion config

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; all libs pinned + in use, verified in codebase.
- Dashboard RPC design: HIGH — pattern copied from cited 0006; week-math externally verified.
- Streak SQL: MEDIUM — structure correct; in-progress-week boundary is a product decision (A2) needing a test fixture.
- Animations: HIGH — Reanimated→Skia derived-path is the established codebase idiom; reduce-motion API verified.
- Pitfalls/verification: HIGH — every gate cites an existing script + extension point.

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable stack; revisit if Expo SDK / Skia / Victory bumped)

## RESEARCH COMPLETE
