# Phase 13: PR Celebration (F18) - Research

**Researched:** 2026-06-14
**Domain:** Client-side PR (Epley e1RM) detection + read-side chronological PR derivation (Postgres window functions) + Skia/Reanimated celebration banner
**Confidence:** HIGH

## Summary

Phase 13 has exactly **two genuinely-new technical surfaces**; everything else is precedented in code and only needs confirmation + citation:

1. **Chronological running-max e1RM derivation in a read-only Postgres RPC.** History trophies (D-14) and session-detail per-exercise trophies (D-15) must be "was a PR *when logged*" — historically honest, never migrating. This is a `max(...) over (partition by exercise_id order by completed_at rows between unbounded preceding and 1 preceding)` window comparison: a set is a PR-at-log-time iff its e1RM strictly exceeds the running max of all *prior* working sets for that exercise. The window function orders/derives **using a SQL-side e1RM expression** `weight_kg * (1 + reps/30.0)`, but the **displayed** e1RM numerals everywhere come from `lib/e1rm.ts` (D-08) — the SQL e1RM is used **only for ordering/flagging**, never returned as a display figure, so there is no drift surface. The RPC follows the exact convention already shipped in migrations `0006` and `0011` (`security invoker` + `stable` + `set search_path=''` + `set_type='working'` + fully-qualified `public.*` + finished sessions only).

2. **Skia + Reanimated gradient-sweep celebration banner.** This is **already-solved in the codebase**: `app/components/ui/Sparkline.tsx` is the canonical precedent — Skia `<Canvas>` + `<LinearGradient>` driven by a Reanimated `useSharedValue` → `useDerivedValue` clip, on the §07 spring (`damping 18 / stiffness 220`), with `useReducedMotion()` snapping to the final state. The banner is a floating absolutely-positioned overlay (D-09), fire-and-forget after `addSet.mutate` (D-17), with the haptic gated through `fm:haptics` (D-18) exactly as the set-logged haptic already is (`workout/[sessionId].tsx:560`).

**Primary recommendation:** Ship a NEW pure `lib/e1rm.ts` (Epley, with a `test:e1rm` script), a NEW migration `0012_phase13_pr_rpcs.sql` with **one combined RPC** (`get_exercise_pr_history`) returning per-set `(set_id, session_id, exercise_id, completed_at, weight_kg, reps, was_pr)` via the running-max window function — feeding BOTH the history-row trophy and the session-detail per-exercise trophy — plus a separate **all-time-best reference** path. Mirror `Sparkline.tsx` for the banner. Touch ZERO hot-path write code.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Live in-workout PR detection (PR-01) | Client (JS) | — | Must work offline over local cache (D-06); `lib/e1rm.ts` compares candidate vs all-time-best (persisted RPC) + in-session sets (`useSetsForSessionQuery`) |
| All-time-best-per-exercise reference (D-06) | API/DB (RPC) | Client cache | RLS-scoped read-side RPC, persisted through TanStack persister; offline = last-synced |
| Chronological PR-at-log-time derivation (D-14/D-15) | API/DB (RPC) | Client (display) | Running-max window function ordered by `completed_at`; ordering in SQL, display e1RM in JS |
| Chart hero e1RM + range delta (D-16/PR-05) | Client (JS) | API/DB (RPC) | `lib/e1rm.ts` computes from raw RPC sets; hero/delta are pure client math |
| Celebration banner animation (PR-03) | Client (UI thread) | — | Reanimated worklet + Skia render; fire-and-forget overlay, never blocks save |
| Set-row / history / detail trophies (PR-02/04) | Client (UI) | API/DB | Status glyphs driven by `was_pr` flags from the RPC + in-session compare |
| Unit display of every PR numeral (D-20) | Client (store) | — | `useUnitStore` (FIT-111) reactive; e1RM computed kg → display-converted |

## Standard Stack

### Core (ALL already installed — zero new dependencies)

| Library | Version (verified) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| `@shopify/react-native-skia` | `2.2.12` [VERIFIED: npm registry — `npm view` 2026-06-14 confirms 2.2.12 exists] | Banner gradient surface + sweep render | Already in `package.json:45`; canonical precedent `Sparkline.tsx` |
| `react-native-reanimated` | `~4.1.1` (installed); registry latest `4.4.1` [VERIFIED: npm registry] | Drive scale spring + sweep + `useReducedMotion()` | Already in `package.json:78`; §07 spring already used app-wide |
| `expo-haptics` | `~15.0.8` (installed); registry latest `56.0.3` [VERIFIED: npm registry — latest is a different SDK line, do NOT bump] | `notificationSuccess` PR haptic | Already in `package.json:56`; `Haptics.impactAsync` already used at `workout/[sessionId].tsx:561` |
| `@supabase/supabase-js` | `^2.105.3` (per CLAUDE.md) | `.rpc()` call for new PR RPC | Existing `supabase.rpc(...)` pattern in `exercise-chart.ts` |
| `zod` | `^4.4.3` (per CLAUDE.md) | Parse RPC rows at the boundary | Existing `ChartRowSchema`/`ExerciseSummarySchema` precedent |
| `date-fns` | `^4.1.0` (per CLAUDE.md) | `rangeToSince` for chart range | Already imported in `exercise-chart.ts` |

**Installation:** None. This phase introduces **zero new packages** (UI-SPEC §Registry Safety confirms). Verify with `npx expo install --check` if any drift suspected, but no install step is required.

> **Haptics version note:** `expo-haptics` registry "latest" is `56.0.3` (Expo SDK 56 line). The installed `~15.0.8` is the **SDK-54-pinned** version. Do NOT bump — follow CLAUDE.md `npx expo install` discipline. [VERIFIED: npm registry + CLAUDE.md version matrix]

### Supporting — NEW first-party modules (not packages)

| Module | Status | Purpose | Mirror |
|--------|--------|---------|--------|
| `app/lib/e1rm.ts` | NEW (D-08) | Pure Epley util — single formula source | `lib/units.ts` / `lib/resolve-language.ts` (pure, Node-importable, `tsx`-testable) |
| `app/lib/queries/pr-history.ts` (or similar) | NEW | Hook over the new chronological RPC | `lib/queries/exercise-chart.ts` |
| `app/lib/queries/best-e1rm.ts` (or similar) | NEW | All-time-best reference (offline-first, persisted) | `lib/queries/last-value.ts` |
| `app/supabase/migrations/0012_*.sql` | NEW | Read-only PR RPC(s) | `0006` + `0011` |
| `app/scripts/test-e1rm.ts` + `test:e1rm` script | NEW | Unit test the formula | `scripts/test-units.ts` + `test:units` script (`package.json:15`) |

## Package Legitimacy Audit

> Not applicable in the usual sense — **this phase installs no external packages.** All libraries are already present, version-pinned, and verified in `app/package.json` and CLAUDE.md's version matrix.

| Package | Registry | Status | Disposition |
|---------|----------|--------|-------------|
| `@shopify/react-native-skia@2.2.12` | npm | Already installed, pinned | Approved (no install) |
| `react-native-reanimated@~4.1.1` | npm | Already installed, pinned | Approved (no install) |
| `expo-haptics@~15.0.8` | npm | Already installed, pinned (SDK-54 line) | Approved (no install) |

**Packages removed due to slopcheck [SLOP] verdict:** none (no install action this phase)
**Packages flagged [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                         ACTIVE WORKOUT (hot path — ≤3s sacred)
  ┌─────────────────────────────────────────────────────────────────────┐
  │  user taps "Klart"                                                    │
  │       │                                                              │
  │       ▼                                                              │
  │  addSet.mutate(...)  ──────────────► optimistic write (UNTOUCHED)    │
  │       │  (returns immediately)                                        │
  │       │                                                              │
  │       └──fire-and-forget, AFTER mutate, NEVER awaited (D-17)──┐       │
  │                                                               ▼       │
  │   isPR = e1rm(candidate) > max(                                       │
  │            allTimeBest_e1rm,          ◄── persisted RPC cache (D-06)  │
  │            max(e1rm of earlier working sets this session))  ◄── (D-07)│
  │                  via lib/e1rm.ts (the ONLY formula, D-08)             │
  │       │                                                              │
  │       ├─ isPR && weight>0 && not-first-set ─► mount floating banner   │
  │       │        (Skia sweep + scale spring + notificationSuccess)      │
  │       │        gated: fm:haptics (D-18), reduce-motion snap (D-19)    │
  │       └─ isPR ─► mark THIS set row's trophy slot (D-12/D-13)          │
  └─────────────────────────────────────────────────────────────────────┘

                         READ-SIDE (history / detail / chart)
  ┌─────────────────────────────────────────────────────────────────────┐
  │  get_exercise_pr_history RPC (NEW, security invoker)                  │
  │     running max e1RM over (partition by exercise_id                   │
  │                            order by completed_at)                     │
  │     → per set: was_pr = (sql_e1rm > running_max_of_prior)             │
  │       │                                                              │
  │       ├─► history.tsx     : session has trophy if ANY was_pr (D-14)   │
  │       ├─► history/[id].tsx: per-exercise trophy if any was_pr (D-15)  │
  │       │                     + per-exercise e1RM via lib/e1rm.ts       │
  │       └─► chart.tsx       : hero = max(lib/e1rm.ts over range sets)   │
  │                             delta = best_in_range − earliest_in_range │
  │                             (PR-05/D-16) — RPC returns RAW sets        │
  └─────────────────────────────────────────────────────────────────────┘
```

### Pattern 1: Pure Epley util — `lib/e1rm.ts` (D-08)

**What:** One exported function, Node-importable, no React. Mirrors `lib/units.ts` structure.
**When to use:** EVERYWHERE an e1RM is computed — live detection, chart hero, session detail, range delta.

```typescript
// app/lib/e1rm.ts — Source pattern: app/lib/units.ts (pure, Node-importable, tsx-testable)
// Epley: e1RM = weight_kg * (1 + reps/30). D-04 guard: weight_kg <= 0 => 0.
// [ASSUMED — exact signature is planner's call; this is the recommended shape]
export function epley1RM(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return 0; // units.ts Pitfall-5 precedent
  if (weightKg <= 0) return 0; // D-04 — Epley meaningless without external load
  if (reps <= 0) return 0;     // a 0-rep "set" is not a lift
  return weightKg * (1 + reps / 30);
}
```

- Storage stays canonical kg; e1RM is computed in kg then display-converted via `useUnitStore` + `toDisplayWeight`/`formatWeight` (D-20). [CITED: `lib/units.ts:36-53`]
- A `test:e1rm` npm script (`tsx scripts/test-e1rm.ts`) follows the `test:units` precedent (`package.json:15`). [CITED: `package.json`]
- Worked example to assert: `90×10 ≈ 120` beats `100×5 ≈ 116.67` (D-01). First-set baseline (D-02) and working-sets-only (D-03) are **caller** concerns, not formula concerns — keep `e1rm.ts` a pure number→number function.

### Pattern 2: Chronological running-max PR-at-log-time RPC (D-14/D-15) — the new SQL shape

**What:** A window function flags each working set as a PR iff its e1RM strictly exceeds the running max of all **prior** working sets for the same exercise.
**When to use:** History-row trophy (any set was a PR) + session-detail per-exercise trophy.

```sql
-- app/supabase/migrations/0012_phase13_pr_rpcs.sql
-- Convention copied verbatim from 0006/0011: security invoker + stable +
-- set search_path = '' + set_type = 'working' + finished sessions + fully-qualified public.*
-- [CITED: 0011_phase12_dashboard_rpcs.sql:37-67, 0006_phase6_chart_rpcs.sql:62-88]
create or replace function public.get_exercise_pr_history(
  p_exercise_id uuid
)
returns table (
  set_id       uuid,
  session_id   uuid,
  completed_at timestamptz,
  weight_kg    numeric,
  reps         int,
  was_pr       boolean
)
language sql
security invoker          -- caller JWT → RLS on exercise_sets+workout_sessions (0001) [D-06/D-14]
stable
set search_path = ''      -- defense-in-depth, applies to INVOKER too (Pitfall 7)
as $$
  with ranked as (
    select
      es.id            as set_id,
      es.session_id,
      es.completed_at,
      es.weight_kg,
      es.reps,
      -- SQL-side e1RM used ONLY for ordering/flagging — NEVER returned/displayed
      -- (display e1RM is lib/e1rm.ts, D-08; no drift because SQL e1rm is internal).
      es.weight_kg * (1 + es.reps / 30.0) as sql_e1rm
    from public.exercise_sets es
    inner join public.workout_sessions s
      on s.id = es.session_id
     and s.finished_at is not null            -- finished sessions only (0006/0011 convention)
    where es.exercise_id = p_exercise_id
      and es.set_type = 'working'             -- D-03
      and es.weight_kg > 0                    -- D-04 (weight>0 required; e1RM=0 can never PR)
  )
  select
    set_id, session_id, completed_at, weight_kg, reps,
    -- running max of e1RM over all PRIOR sets (exclude the current row via
    -- "rows between unbounded preceding and 1 preceding"); the FIRST set has a
    -- NULL prior-max (no prior best) → was_pr = false (D-02 baseline, not a PR).
    coalesce(
      sql_e1rm > max(sql_e1rm) over (
        order by completed_at, set_id
        rows between unbounded preceding and 1 preceding
      ),
      false                                   -- first set: prior-max is NULL → false (D-02)
    ) as was_pr
  from ranked
  order by completed_at, set_id;
$$;

revoke all on function public.get_exercise_pr_history(uuid) from public;
grant execute on function public.get_exercise_pr_history(uuid) to authenticated;
```

**Key mechanics (HIGH confidence — window-function semantics are standard SQL):**
- `rows between unbounded preceding and 1 preceding` makes the running max cover **strictly prior** sets, so a set is compared against its history, not itself. The first set's frame is empty → `max(...)` is NULL → `coalesce(... , false)` yields `was_pr = false` (exactly D-02). [ASSUMED — verify the frame yields NULL not error on empty frame; Postgres returns NULL for `max` over an empty frame — standard behavior]
- `order by completed_at, set_id` gives a **deterministic** tiebreak when two sets share a `completed_at` timestamp (rapid logging) — without the `set_id` tiebreak, two simultaneous sets could each see the other as "prior" non-deterministically.
- **Strict `>`** matches D-05 (any increase counts) — a tie is NOT a new PR.
- **RLS:** `security invoker` + the existing `exercise_sets`/`workout_sessions` policies from migration 0001 scope rows to the caller's JWT. No `(select auth.uid())` is written *in this function* because it inherits the parent-table policies (same as 0006/0011 — those functions also contain no explicit `auth.uid()`). [CITED: `0011_phase12_dashboard_rpcs.sql:37-42`]

**Consuming the RPC:**
- **History list (D-14):** the history screen needs "does session X contain any PR set?" The cleanest consumer is either (a) call `get_exercise_pr_history` per exercise and fold in JS, or (b) **add a sibling RPC** `get_session_pr_flags(p_session_ids uuid[])` that returns `(session_id, has_pr)` by running the same window logic across all exercises and aggregating. **Recommendation: ship the per-exercise RPC as the engine + a thin session-level aggregating RPC** so `history.tsx` does one call, not N. [ASSUMED — exact split is Claude's discretion per CONTEXT D-"RPC shape"]
- **Session detail (D-15):** call `get_exercise_pr_history` per exercise in the session, find rows where `session_id = thisSession AND was_pr`, render the trophy + the per-exercise e1RM (computed from the row's raw `weight_kg/reps` via `lib/e1rm.ts`).

### Pattern 3: All-time-best reference, offline-first + persisted (D-06) — mirror `last-value.ts`

**What:** A read-side query returning the best working set per exercise, cached + persisted through the existing TanStack persister so live detection works offline.
**When to use:** The live in-workout compare baseline (PR-01).

```typescript
// Mirror app/lib/queries/last-value.ts: Record (NOT Map) for JSON round-trip
// through the AsyncStorage persister; per-exercise queryKey; set_type='working';
// RLS via the inner join + belt-and-braces user_id filter; invalidate on
// ['session','finish'].onSettled. [CITED: last-value.ts:13-41]
//
// Returns Record<exerciseId, { weight_kg, reps }> — the best working set.
// Live compare: epley1RM(candidate) > epley1RM(best[exerciseId]) → PR (PR-01).
```

- **Record, not Map** — TanStack persists via `JSON.stringify`; a `Map` rehydrates as `{}` and `.get` throws. [CITED: `last-value.ts:18-22`]
- **Invalidation:** add the new query key to the `['session','finish'].onSettled` block at `lib/query/client.ts:830-836` (right next to the existing `lastValueKeys.all` invalidation) — so a finished session refreshes the best-reference. This is an **additive line in an existing onSettled**, NOT a mutation-default change → does not breach D-17. [CITED: `lib/query/client.ts:830-836`]
- **Best-reference source options:** either a PostgREST query like `last-value.ts`, OR reuse the chronological RPC's last row (its running-max endpoint IS the all-time best). **Recommendation:** a small dedicated RPC `get_best_working_sets()` (all exercises, one call, returns `(exercise_id, weight_kg, reps)` of the max-e1RM working set per exercise) — but since e1RM ordering must not live in two formula homes, have the RPC order by the SQL e1RM expression and return **raw** `weight_kg/reps`; JS recomputes via `lib/e1rm.ts` to confirm. Returning raw sets keeps `lib/e1rm.ts` the only **displayed** formula. [ASSUMED — shape is Claude's discretion]

### Pattern 4: Skia + Reanimated gradient-sweep banner (PR-03) — mirror `Sparkline.tsx`

**What:** A floating overlay: gradient-wash surface + 36px gradient trophy tile + title/sub, entering with scale `0.96→1` + a gradient sweep translating across the surface, `notificationSuccess` haptic, ~3-4s dwell, fade out.
**When to use:** PR-03 celebration. **This is the highest-novelty UI piece but is fully precedented.**

```tsx
// CANONICAL PRECEDENT: app/components/ui/Sparkline.tsx:64-92 — Skia <Canvas> +
// <LinearGradient> driven by Reanimated shared values on the §07 spring, with
// useReducedMotion() snapping to final. Copy this exact structure for the banner.

// §07 spring (already a module constant in Sparkline.tsx:65) [CITED: Sparkline.tsx:65]
const SPRING = { damping: 18, stiffness: 220 } as const;

const reduced = useReducedMotion();         // synchronous boolean [CITED: Sparkline.tsx:80]
const scale = useSharedValue(0.96);         // D-10 entrance 0.96→1
const sweep = useSharedValue(0);            // 0→1 gradient translate across surface

useEffect(() => {
  if (reduced) {                            // D-19: snap to final, no animation
    scale.value = 1;
    sweep.value = 1;
  } else {
    scale.value = withSpring(1, SPRING);    // §07 entrance (Sparkline.tsx:89 precedent)
    sweep.value = withTiming(1, { duration: 600 }); // §07 ~600ms sweep
  }
}, [reduced, scale, sweep]);
```

**Sweep implementation — recommendation: Skia `<LinearGradient>` with an animated `start`/`end` via `useDerivedValue`** (the Sparkline pattern: animate the gradient geometry, not a CSS class). A `useDerivedValue` recomputes the gradient `start`/`end` `vec(...)` from `sweep.value`, translating a bright band across the surface. This runs on the UI thread and is GPU-composited — zero JS-thread cost, so it **cannot** touch the ≤3s budget. [CITED: `Sparkline.tsx:121-128` `useDerivedValue` clip pattern — same mechanism, applied to gradient coords instead of a clip rect]

**Scale spring caveat (device-UAT precedent):** the set-row check (`workout/[sessionId].tsx:856-864`) **switched away** from the §07 spring (`damping 18`) to a short `withTiming` because the spring "read as a bouncy pop." The banner spec (§07) explicitly wants the spring, but flag for device-UAT: if the `0.96→1` spring pops, fall back to `withTiming(1, {duration: 200, easing: Easing.out(Easing.quad)})` exactly as the check did. [CITED: `workout/[sessionId].tsx:856-864`]

**Floating overlay placement (D-09):** absolutely-positioned, inline-rendered, **no Modal portal** (Phase 11/12 D-22). The modal precedent in `workout/[sessionId].tsx:1294-1303` shows the in-tree animated-overlay shape (backdrop + card with §07 spring) — but the banner needs NO backdrop and NO portal; it's a position-absolute View over the set list that never shifts the "Klart" button. [CITED: `workout/[sessionId].tsx:1294-1303`]

**Fire-and-forget + haptic gate (D-17/D-18):** trigger the banner the same way the set-logged haptic fires — AFTER `addSet.mutate`, never awaited:

```tsx
// EXACT precedent: workout/[sessionId].tsx:554-562
void getPref("fm:haptics").then((on) => {                       // D-18 gate
  if (on) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
});
// + setState to mount the banner (each PR set → fresh banner, D-11)
```

[CITED: `workout/[sessionId].tsx:554-562` — set-logged haptic uses `Haptics.impactAsync(Medium)`; PR uses `notificationAsync(Success)` through the same `fm:haptics` gate]

### Pattern 5: Chart hero e1RM swap (PR-05/D-16) — pure client math over RPC raw sets

**What:** Swap the `chart.tsx` hero from current-best (Phase 12 D-12) to: big numeral = max e1RM among working sets in range; delta chip = best-in-range − earliest-in-range.
**When to use:** PR-05.

- The existing hero markup (`chart.tsx:410-451`) already renders a 52px numeral + 18/500 unit + 11/600 eyebrow + 13/700 success delta chip. **D-16 swaps the data, not the geometry** — only the numeral source and eyebrow key change (`currentBest` → `estimated1RM`). [CITED: `chart.tsx:410-451`]
- The hero data currently comes from `get_exercise_summary` (`current_best`/`range_first_value`). For e1RM, the cleanest path is to **return raw range sets** and compute `max(epley1RM(...))` + earliest-vs-best delta in JS (D-08 single-formula). **Extension-vs-new-function (D-16 discretion):** `get_exercise_summary` returns only aggregates (`current_best`, `top_set_weight_kg/reps`), NOT all sets, so it **cannot** be extended to yield per-set e1RM without a second pass. **Recommendation: a NEW small RPC `get_exercise_sets_in_range(p_exercise_id, p_since)`** returning raw `(completed_at, weight_kg, reps)` working sets in range; JS computes the e1RM hero + delta. This avoids putting an e1RM formula in SQL for display. (Or extend `get_exercise_summary` to add `best_e1rm`/`first_e1rm` columns computed SQL-side — but that re-introduces a second formula home and violates D-08's spirit. Prefer raw-sets.) [ASSUMED — Claude's discretion per CONTEXT; recommendation is raw-sets to honor D-08]
- `chartData` memo already deps `useUnitStore` (CONTEXT D-16) so a kg↔lbs toggle re-renders live. [CITED: CONTEXT 13 line 99/138]

### Anti-Patterns to Avoid

- **Computing display e1RM in SQL.** The window-function RPC computes a SQL e1RM **only to order/flag** `was_pr`; it must NEVER return a SQL-computed e1RM as a displayed numeral. Every numeral the user sees comes from `lib/e1rm.ts` (D-08). Returning `sql_e1rm` as a column would re-open the drift surface the whole design exists to close.
- **Touching the hot-path write.** No `setMutationDefaults`, no `mutationKey`, no persister scope-bindings, no `exercise_sets` logging change (D-17). The ONLY allowed `client.ts` edit is adding a query-key to the existing `['session','finish'].onSettled` invalidation list (`client.ts:830-836`) — additive, read-side.
- **Awaiting detection before the save.** Detection + banner must run AFTER `addSet.mutate`, never before, never awaited (T-11-06 precedent). A failed/offline best-reference query silently yields "no PR" — never an error, never a block (UI-SPEC §Error state).
- **`is_pr` column / any schema write.** Out of scope (REQUIREMENTS). PR is derived. RPCs are read-only.
- **Box-decoration in `style()` under NativeWind 4.** Per MEMORY (`feedback_nativewind_box_deco_via_classname`): Pressable/View bg/border/radius/size must be in `className`, not an inline `style()` callback — keep `style()` for shadow/opacity/transform only. Applies to the banner surface + trophy tiles.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Running-max "was a PR when logged" | A retrospective JS scan that re-derives PRs from full history on the client | Postgres window function `max() over (... rows unbounded preceding to 1 preceding)` (Pattern 2) | RLS-scoped, single pass, deterministic; trophies never migrate (D-14) |
| Gradient sweep across a surface | A JS-thread `setInterval` translating a `<View>` | Skia `<LinearGradient>` + Reanimated `useDerivedValue` (Pattern 4 / `Sparkline.tsx`) | UI-thread, GPU-composited — cannot touch ≤3s budget |
| Reduce-motion detection | `AccessibilityInfo.isReduceMotionEnabled()` + manual subscription | Reanimated `useReducedMotion()` (synchronous boolean) | Already the app convention (`Sparkline.tsx:80`); no async, no listener bookkeeping |
| kg↔lbs display of e1RM | Ad-hoc `* 2.2046` math per screen | `toDisplayWeight`/`formatWeight` + `useUnitStore` (D-20) | Reactive, canonical-kg, half-rounding handled (`units.ts`) |
| Epley in multiple places | Inline `w*(1+r/30)` in detection AND chart AND detail | One `lib/e1rm.ts` (D-08) | Eliminates the SQL/JS + screen-to-screen drift surface |
| RPC row trust | `as` cast of `supabase.rpc(...)` data | Zod parse at the boundary | Generated types are compile-time only (`exercise-chart.ts:25-28` PITFALLS §8.13) |

**Key insight:** Both new surfaces have an exact in-repo precedent. The banner = `Sparkline.tsx` (Skia+Reanimated+reduce-motion). The RPC = `0006`/`0011` conventions + a standard SQL window frame. The detection = `last-value.ts` offline-first pattern. There is almost nothing to invent — only to compose precedent.

## Common Pitfalls

### Pitfall 1: Window frame includes the current row
**What goes wrong:** Using `max(sql_e1rm) over (order by completed_at)` (default frame = `range unbounded preceding and current row`) compares each set against **itself**, so every set "ties" its own e1RM and `>` is always false — no PR ever flags.
**Why it happens:** The default window frame includes the current row.
**How to avoid:** Explicit `rows between unbounded preceding and 1 preceding` so the running max covers strictly-prior sets. First row → empty frame → NULL → `coalesce(...,false)` (D-02 baseline).
**Warning signs:** `was_pr` is `false` for every row in a test fixture that clearly contains progressions.

### Pitfall 2: Non-deterministic tiebreak on identical `completed_at`
**What goes wrong:** Two working sets logged in the same second (rapid logging) have equal `completed_at`; ordering by `completed_at` alone makes "which was prior" undefined, so `was_pr` flips run-to-run.
**Why it happens:** `order by completed_at` is not a total order.
**How to avoid:** `order by completed_at, set_id` (or `set_number`) as a stable tiebreak. Matches the determinism the `f13-brutal` 25-set fixture needs.
**Warning signs:** `test:rls` / a PR-derivation test is flaky on a dense fixture.

### Pitfall 3: e1RM formula drift between SQL ordering and JS display
**What goes wrong:** SQL uses `reps/30.0` (numeric) while JS uses `reps/30` — or SQL rounds and JS doesn't — so the set SQL flags `was_pr` differs from the set JS would compute as best. Trophy and numeral disagree.
**Why it happens:** Two formula homes.
**How to avoid:** SQL e1RM is **internal-only** (ordering/flagging), never displayed. All displayed numerals come from `lib/e1rm.ts`. Use `reps / 30.0` in SQL (float division — integer `reps/30` would truncate). Because the SQL value is never shown, minor float differences don't surface to the user; the only requirement is that the **ordering** agrees, which it does for monotonic Epley. (D-08 rationale, CONTEXT line 42.)
**Warning signs:** A set has a trophy but its displayed e1RM is lower than another trophy-less set's displayed e1RM.

### Pitfall 4: Banner shifts the "Klart" button
**What goes wrong:** Rendering the banner inline-in-flow (as the mock literally shows, line 389) pushes the set list + input row + "Klart" down — breaks the muscle-memory tap target mid-pass.
**Why it happens:** Following the mock's literal placement instead of D-09's override.
**How to avoid:** Absolutely-positioned floating overlay (D-09) — `position: absolute`, never in the flex flow. Same look, safe geometry. No Modal portal (D-22).
**Warning signs:** The "Klart" button visibly jumps when a PR banner appears.

### Pitfall 5: Detection blocking or preceding the save
**What goes wrong:** Computing the PR (or awaiting the best-reference query) before/within `addSet.mutate` adds latency to the sacred ≤3s path; an offline best-reference fetch could hang the save.
**Why it happens:** Treating detection as part of the write instead of a post-write side effect.
**How to avoid:** Detection + banner are fire-and-forget AFTER the mutate, exactly like the set-logged haptic (`workout/[sessionId].tsx:554-562`). Best-reference comes from already-cached/persisted data (no fresh fetch in the hot path). `npm run test:f13-brutal` stays green.
**Warning signs:** Set-log latency regresses; `test:f13-brutal` fails timing (vs the known-amber FIT-107 count-only precondition).

### Pitfall 6: NativeWind 4 box-decoration in `style()`
**What goes wrong:** Banner surface / trophy-tile bg/border/radius render NAKED if put in an inline `style()` callback under NativeWind 4.
**Why it happens:** Documented NativeWind 4 behavior (MEMORY `feedback_nativewind_box_deco_via_classname`, the Phase 10 "naked re-skin" root cause).
**How to avoid:** Box styling (bg/border/radius/size) in `className`; keep `style()` for shadow/opacity/transform only.
**Warning signs:** The banner gradient wash or trophy circle has no visible background/border on device.

## Runtime State Inventory

> Not a rename/refactor/migration phase — but it DOES add a new SQL migration, so the deploy-state items below matter.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — PR is derived, never stored (no `is_pr` column, out of scope). No existing rows change. | None |
| Live service config | New RPC(s) in `0012_*.sql` deployed to Supabase via `supabase db push`; must appear in `pg_proc`. | `verify-deploy.ts` must add the new function name(s) to its INVOKER + `search_path` pg_proc check (mirror `phase12Functions`, `verify-deploy.ts:129`). |
| OS-registered state | None. | None |
| Secrets/env vars | None — no new keys; RPC uses caller JWT via existing RLS. | None |
| Build artifacts | `app/types/database.ts` is stale until regenerated after the migration. | `npm run gen:types` co-committed with `0012_*.sql` (CLAUDE.md Database conventions). |

**Nothing found:** Stored data, OS-registered state, secrets — explicitly None (verified against CONTEXT out-of-scope + CLAUDE.md conventions).

## Code Examples

(All load-bearing examples are inline in Patterns 1–5 above, each cited to its in-repo precedent: `lib/units.ts`, `0011_phase12_dashboard_rpcs.sql`, `0006_phase6_chart_rpcs.sql`, `lib/queries/last-value.ts`, `components/ui/Sparkline.tsx`, `app/(app)/workout/[sessionId].tsx`, `lib/query/client.ts`, `app/(app)/exercise/[exerciseId]/chart.tsx`.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 12 chart hero = real current-best (placeholder, D-12) | Phase 13 hero = e1RM + range delta (D-16) | This phase | Swap data, keep geometry (`chart.tsx:410-451`) |
| Phase 11/12 set rows: no trophy markup (deliberately omitted) | Phase 13 adds trophy/banner markup | This phase | Additive UI only; screens already Forge |
| No e1RM anywhere (grep-confirmed: only comments in `chart.tsx`/`_forge-gallery.tsx`) | `lib/e1rm.ts` single formula source | This phase | New pure module |

**Deprecated/outdated:** none relevant.

## Validation Architecture

> `workflow.nyquist_validation` not disabled — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `tsx` runner over hand-written assertion scripts (NO jest/vitest in repo) — `tsx scripts/test-*.ts` |
| Config file | none — each test is a standalone `scripts/test-*.ts` with a `test:*` npm script |
| Quick run command | `npm run test:e1rm` (new) — pure formula, sub-second, no DB |
| Full suite command | `npm run test:rls && npm run test:f13-brutal && npm run test:e1rm` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PR-01 | Epley e1RM correctness + D-04 weight≤0 guard + D-01 (90×10 beats 100×5) | unit | `npm run test:e1rm` | ❌ Wave 0 (`scripts/test-e1rm.ts`) |
| PR-01 | All-time-best reference RPC cross-user isolation | integration | `npm run test:rls` (extend) | ✅ extend `scripts/test-rls.ts` |
| PR-04 | Chronological `get_exercise_pr_history` cross-user isolation + `was_pr` correctness on a known fixture | integration | `npm run test:rls` (extend) | ✅ extend `scripts/test-rls.ts` |
| PR-04/05 | New RPC(s) are INVOKER + `search_path=''` at deploy | deploy-gate | `npx tsx --env-file=.env.local scripts/verify-deploy.ts` | ✅ extend `phase13Functions` array |
| D-17 | Hot path unregressed after read-side additions | regression | `npm run test:f13-brutal` | ✅ exists (known-amber FIT-107) |
| PR-02/03 | Trophy replaces check; banner floats, never shifts "Klart" | manual UAT | device (Expo Go) | ❌ manual |
| PR-03/D-18/D-19 | Haptic respects `fm:haptics`; reduce-motion snaps to final | manual UAT | device (toggle OS reduce-motion + `fm:haptics`) | ❌ manual |

### Sampling Rate
- **Per task commit:** `npm run test:e1rm` (instant; formula correctness)
- **Per wave merge:** `npm run test:rls && npm run test:f13-brutal` (DB isolation + hot-path regression)
- **Phase gate:** all three green + `verify-deploy.ts` clean + manual reduce-motion/haptic/banner-geometry UAT before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `app/scripts/test-e1rm.ts` — covers PR-01 (Epley correctness, D-01/D-02/D-03/D-04 guards) + `test:e1rm` npm script
- [ ] `app/scripts/test-rls.ts` — extend with cross-user assertions for `get_exercise_pr_history` + the best-reference RPC (per CLAUDE.md "cross-user verification is a gate"); assert `was_pr` correctness on a seeded progression fixture (PR/baseline edge cases)
- [ ] `app/scripts/verify-deploy.ts` — add `phase13Functions` array (new RPC names) to the INVOKER + `search_path` pg_proc check (mirror `verify-deploy.ts:129`)
- [ ] `app/types/database.ts` — regenerate via `npm run gen:types`, co-commit with `0012_*.sql`

## Security Domain

> `security_enforcement` enabled (CLAUDE.md OWASP MASVS L1 + API Top 10) — section included.

### Applicable ASVS / OWASP Categories

| Category | Applies | Standard Control |
|----------|---------|-----------------|
| API1/API3 / V4 — Broken object-level auth / excessive data exposure | **yes** | New RPCs are `security invoker` → inherit `exercise_sets`/`workout_sessions` RLS from migration 0001; caller JWT scopes rows. Cross-user `test:rls` assertion per new RPC (CLAUDE.md gate). The RPC returns only the caller's own sets. |
| API8 / V14 — Security misconfiguration | **yes** | `set search_path = ''` on every new function (Pitfall 7); fully-qualified `public.*`; migration-as-truth (`0012_*.sql`, no Studio edits); `gen:types` co-commit; `verify-deploy.ts` confirms INVOKER + search_path. |
| V5 — Input validation | **yes** | Every RPC row Zod-parsed at the boundary (`exercise-chart.ts` precedent), not `as`-cast. `p_exercise_id uuid` is type-checked by Postgres; no dynamic SQL. |
| V6 — Cryptography | no | No crypto in this phase. |
| API2 / V2 — Authentication | no (unchanged) | No auth surface change; existing session handling untouched. |
| M2 — Insecure storage | no (unchanged) | Persisted best-reference is non-PII workout data through the existing encrypted persister; no new sensitive storage. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user data leak via new RPC | Information disclosure | `security invoker` + inherited RLS + cross-user `test:rls` assertion (gate) |
| `search_path` hijack on the function | Tampering/Elevation | `set search_path = ''` + fully-qualified `public.*` (defense-in-depth, applies to INVOKER) |
| SQL injection via params | Tampering | Typed params (`uuid`); no dynamic SQL / string concatenation in the RPC body |
| Untyped RPC row trusted blindly | Tampering | Zod parse at the `supabase.rpc()` boundary (PITFALLS §8.13) |

**Threat-model note for the planner:** every PLAN.md must carry a `<threat_model>` STRIDE register (`T-13-XX`); the new-RPC cross-user-leak threat + the search_path threat are the load-bearing entries. `gsd-secure-phase 13` must close `threats_open: 0`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `epley1RM` exact signature/guards (returns 0 for reps≤0) | Pattern 1 | Low — planner finalizes; D-02/D-03 are caller concerns, formula is pure |
| A2 | Empty window frame → `max()` returns NULL (not error) so first set → `was_pr=false` | Pattern 2 / Pitfall 1 | Low — standard Postgres semantics; verify on the seeded fixture in `test:rls` |
| A3 | RPC split: per-exercise engine + thin session-level aggregator for history (vs N client calls) | Pattern 2 | Low — Claude's discretion per CONTEXT; both work, perf-only tradeoff |
| A4 | Chart hero swap uses a NEW raw-sets RPC rather than extending `get_exercise_summary` | Pattern 5 | Medium — extending would re-introduce a 2nd formula home (violates D-08 spirit); raw-sets is the safer call but planner confirms |
| A5 | Best-reference is a dedicated `get_best_working_sets()` RPC returning raw sets | Pattern 3 | Low — could also derive from chronological RPC's last row; offline-first persistence is the firm requirement |
| A6 | Banner sweep = animate Skia `LinearGradient` start/end via `useDerivedValue` | Pattern 4 | Low — exact Sparkline mechanism; alternative (animated Reanimated LinearGradient) also viable |
| A7 | Scale spring may need `withTiming` fallback if it "pops" on device | Pattern 4 | Low — device-UAT decision; check-icon precedent already did this |

## Open Questions

1. **History-row PR aggregation: per-exercise RPC + JS fold vs a dedicated session-level RPC?**
   - What we know: `get_exercise_pr_history` per exercise gives `was_pr` per set; history needs "any PR set in session X."
   - What's unclear: whether one aggregating RPC (`get_session_pr_flags`) is cleaner than N per-exercise calls in `history.tsx`.
   - Recommendation: ship the per-exercise window-function engine + a thin session-level aggregating RPC so `history.tsx` does one call. Planner decides (CONTEXT "RPC shape" discretion).

2. **Chart hero: new raw-sets RPC vs extend `get_exercise_summary`?**
   - What we know: `get_exercise_summary` returns aggregates only, not per-set rows; e1RM hero/delta need per-set e1RM via `lib/e1rm.ts`.
   - What's unclear: cost of a new RPC vs adding SQL-side `best_e1rm`/`first_e1rm` columns.
   - Recommendation: NEW raw-sets-in-range RPC; compute e1RM in JS (honors D-08 single-formula). Avoid SQL-side display e1RM.

3. **`pbSetSuffix` set-ordinal source.** UI-SPEC fixes the key name + string (`"· set {{n}}"`); `{{n}}` is the 1-based set ordinal within the session. The candidate set's `set_number` (server-assigned) is the natural source — confirm it's available at banner-mount time (it is, post-optimistic-append). Low risk.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@shopify/react-native-skia` | Banner sweep | ✓ | 2.2.12 | — |
| `react-native-reanimated` | Scale spring + reduce-motion | ✓ | ~4.1.1 | — |
| `expo-haptics` | PR `notificationSuccess` | ✓ | ~15.0.8 | — |
| Supabase project (RPC deploy) | New `0012_*` RPCs | ✓ | live (project `mokmiuifpdzwnceufduu`) | — |
| `tsx` (test/gen/verify scripts) | `test:e1rm`, `test:rls`, `gen:types`, `verify-deploy` | ✓ | per `package.json` | — |
| Docker | NOT required | n/a | — | `verify-deploy.ts` queries `pg_catalog` directly (D-04 / CLAUDE.md) — no `supabase db diff` |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — Docker is intentionally avoided via `verify-deploy.ts` (CLAUDE.md convention).

## Project Constraints (from CLAUDE.md)

- **Migration-as-truth:** new schema = numbered SQL (`0012_*.sql`); Supabase Studio is read-only. `gen:types` co-committed; `verify-deploy.ts` after push.
- **RLS conventions:** read-only RPCs are `security invoker` + `stable` + `set search_path = ''` + fully-qualified `public.*` + `set_type = 'working'` + finished sessions; inherit migration-0001 policies via caller JWT. Writable-policy `using`/`with check` rules N/A (no writes this phase).
- **Cross-user `test:rls` is a gate:** every new RPC touching user-scoped tables MUST add cross-user CRUD/read assertions to `scripts/test-rls.ts`.
- **No `is_pr` column / no schema beyond read-only RPCs** (REQUIREMENTS out-of-scope).
- **F13 / ≤3s sacred (D-17 / SKIN-08):** no mutation defaults / queryKeys / persister scope-bindings / `exercise_sets` logging touched; `test:f13-brutal` stays green. Only allowed `client.ts` edit is adding a key to the existing `['session','finish'].onSettled` invalidation list.
- **Zod at every boundary** (Supabase responses, forms, deeplinks) — RPC rows parsed, not `as`-cast.
- **`expo-secure-store` for auth (unchanged); service-role key never in client** (no change this phase).
- **i18n via `t()`, flat sv/en parity** (D-21); new key `pbSetSuffix` `"· set {{n}}"` at sv+en parity.
- **`useUnitStore` for every weight/e1RM numeral** (D-20 / FIT-111); canonical kg storage, display-converted.
- **NativeWind 4: box-decoration in `className`, not `style()`** (MEMORY — Phase 10 naked-re-skin root cause).
- **Branching:** never commit to `dev`/`main`; phase work on `gsd/phase-13-*` via PR. FF `dev` before cutting the branch (MEMORY).
- **Linear:** `linear:sync-phase --phase 13` after planning; `[FIT-XX]` in commits.

## Sources

### Primary (HIGH confidence — in-repo, read this session)
- `app/lib/units.ts` — pure Node-importable helper structure for `lib/e1rm.ts` (D-08)
- `app/supabase/migrations/0011_phase12_dashboard_rpcs.sql` — RPC convention (invoker/stable/search_path/working/finished); `get_exercise_summary` shape (D-16 extension tradeoff)
- `app/supabase/migrations/0006_phase6_chart_rpcs.sql` — second RPC convention reference; `distinct on` top-set precedent
- `app/lib/queries/last-value.ts` — offline-first persister-hydrated Record-not-Map RLS read-side pattern (D-06)
- `app/lib/queries/exercise-chart.ts` — `supabase.rpc()` + Zod-parse boundary + `useExerciseSummaryQuery` (D-16)
- `app/app/(app)/exercise/[exerciseId]/chart.tsx` (hero 410-451) — geometry the e1RM data swaps into (PR-05)
- `app/components/ui/Sparkline.tsx` (64-92, 121-128) — CANONICAL Skia+Reanimated+reduce-motion sweep precedent (PR-03)
- `app/app/(app)/workout/[sessionId].tsx` (505-562 mutate/haptic; 856-864 check-scale; 906-970 set-row trophy slot; 1294-1303 overlay) — hot-path + fire-and-forget + trophy slot
- `app/lib/query/client.ts` (779-838) — `['session','finish'].onSettled` invalidation site (the ONE allowed edit)
- `app/lib/units-store.ts` — `useUnitStore` reactive display pref (D-20)
- `app/scripts/verify-deploy.ts` (64-131) — pg_proc INVOKER + search_path check to extend
- `app/scripts/test-rls.ts` (943-1081) — cross-user RPC assertion pattern to extend
- `app/package.json` — installed versions + `test:*` script conventions
- `.planning/phases/13-pr-celebration-f18/13-CONTEXT.md` + `13-UI-SPEC.md` — locked decisions D-01..D-21 + ratified UI contract
- `.planning/REQUIREMENTS.md` (PR-01..PR-05 + out-of-scope) ; `CLAUDE.md` (DB + security conventions)

### Secondary (MEDIUM confidence)
- `npm view` (2026-06-14): `@shopify/react-native-skia@2.2.12` exists; `react-native-reanimated` latest `4.4.1`; `expo-haptics` latest `56.0.3` (SDK-56 line, do not bump from installed SDK-54 `~15.0.8`)

### Tertiary (LOW confidence)
- none — no external/unverified claims; all patterns are in-repo precedent.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; all versions verified installed + on registry
- Architecture (RPC window function + Skia banner): HIGH — both have exact in-repo precedents (`0011`/`Sparkline.tsx`)
- Pitfalls: HIGH — drawn from in-repo conventions + documented MEMORY items + standard SQL window semantics
- RPC shape splits (A3/A4/A5): MEDIUM — Claude's-discretion items; recommendations given, planner finalizes

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (stable — internal codebase patterns; no fast-moving external deps)
