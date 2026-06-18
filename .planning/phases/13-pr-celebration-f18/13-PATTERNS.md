# Phase 13: PR Celebration (F18) - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 16 (5 new, 11 modified)
**Analogs found:** 16 / 16 (every file has an exact in-repo precedent — zero invented patterns)

All analog line numbers below were verified against the live codebase this session (not transcribed from RESEARCH). Where RESEARCH cited a stale range, the corrected live range is given.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/lib/e1rm.ts` (NEW) | utility (pure module) | transform | `app/lib/units.ts` | exact |
| `app/scripts/test-e1rm.ts` (NEW) | test | batch (assertion table) | `app/scripts/test-units.ts` | exact |
| `app/supabase/migrations/0012_*.sql` (NEW) | migration (read-only RPC) | request-response | `0011_phase12_dashboard_rpcs.sql` + `0006_phase6_chart_rpcs.sql` | exact |
| `app/lib/queries/best-e1rm.ts` (NEW) | service (query hook) | request-response (offline-first) | `app/lib/queries/last-value.ts` | exact |
| `app/lib/queries/pr-history.ts` (NEW) | service (query hook) | request-response | `app/lib/queries/exercise-chart.ts` | exact |
| PR banner component (NEW) | component (UI) | event-driven (fire-and-forget) | `app/components/ui/Sparkline.tsx` | exact |
| set-row trophy component (NEW) | component (UI) | event-driven | `Sparkline.tsx` (Skia) + `[sessionId].tsx:906-970` (slot) + `Icon.tsx` | exact |
| `app/app/(app)/workout/[sessionId].tsx` (MOD) | route (hot path) | event-driven | self §554-562 (haptic) + §906-970 (slot) + §1294-1305 (overlay) | exact (self-precedent) |
| `app/app/(app)/(tabs)/history.tsx` (MOD) | route | request-response | self (existing session row) + `pr-history.ts` consume | role-match |
| `app/app/(app)/history/[sessionId].tsx` (MOD) | route | request-response | self (Phase 12 D-15 card) + `e1rm.ts` | role-match |
| `app/app/(app)/exercise/[exerciseId]/chart.tsx` (MOD) | route | request-response | self §342-451 (hero) | exact (self-precedent) |
| `app/lib/query/client.ts` (MOD — additive only) | config | event-driven | self §830-836 (`onSettled`) | exact (self-precedent) |
| `app/scripts/test-rls.ts` (MOD) | test | request-response | self §963-1009 (per-RPC cross-user) | exact (self-precedent) |
| `app/scripts/verify-deploy.ts` (MOD) | test (deploy gate) | request-response | self §121-140 (`phase12Functions`) | exact (self-precedent) |
| `app/types/database.ts` (MOD — regen) | config (generated) | n/a | `npm run gen:types` (package.json:12) | exact |
| `app/locales/{sv,en}.json` (MOD) | config (i18n) | n/a | self (`personalBest`/`pbSub`/`estimated1RM`) | exact |

---

## Pattern Assignments

### `app/lib/e1rm.ts` (utility, transform) — NEW

**Analog:** `app/lib/units.ts` (pure Node-importable transform module, no React, no side effects). This is the structural template — header doc-comment with Decisions, exported pure functions, non-finite guard.

**Structure pattern** (`units.ts:36-39`):
```typescript
export function toDisplayWeight(kg: number, unit: UnitPref): number {
  if (!Number.isFinite(kg)) return 0;   // Pitfall 5 guard — non-finite never propagates
  return unit === "imperial" ? roundHalf(kg / KG_PER_LB) : kg;
}
```

**Apply to e1RM** (Epley, D-01/D-04/D-08; recommended shape from RESEARCH Pattern 1):
```typescript
// Epley: e1RM = weight_kg * (1 + reps/30). Pure number→number. D-02/D-03 are
// CALLER concerns (first-set baseline / set_type filter), NOT formula concerns.
export function epley1RM(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return 0; // units.ts Pitfall-5 precedent
  if (weightKg <= 0) return 0; // D-04 — Epley meaningless without external load
  if (reps <= 0) return 0;     // a 0-rep "set" is not a lift
  return weightKg * (1 + reps / 30);
}
```

**Critical:** storage stays canonical kg; e1RM is computed in kg, THEN display-converted via `toDisplayWeight`/`formatWeight` + `useUnitStore` (D-20). e1RM is NOT its own unit — it is a kg figure that flows through the SAME `units.ts` converters every other weight uses.

---

### `app/scripts/test-e1rm.ts` (test, batch) — NEW

**Analog:** `app/scripts/test-units.ts` — `Case[]` table + loop + exit-code skeleton; pure, no Supabase/Expo, runs `<1s` via `tsx`.

**Imports + Case-table pattern** (`test-units.ts:12-45`):
```typescript
import { epley1RM } from "../lib/e1rm";   // note: ../lib (script is in app/scripts/)

type Case = { name: string; actual: number; expected: number; tol?: number };

const cases: Case[] = [
  { name: "epley1RM(100,5) ≈ 116.67", actual: epley1RM(100, 5), expected: 116.6667, tol: 0.01 },
  { name: "epley1RM(90,10) ≈ 120 — D-01: high-rep beats heavy", actual: epley1RM(90, 10), expected: 120, tol: 0.01 },
  { name: "epley1RM(0,5) === 0 — D-04 weight≤0 guard", actual: epley1RM(0, 5), expected: 0 },
  { name: "epley1RM(NaN,5) === 0 — non-finite guard", actual: epley1RM(NaN, 5), expected: 0 },
  { name: "epley1RM(100,0) === 0 — reps≤0 guard", actual: epley1RM(100, 0), expected: 0 },
];
```
The `tol` field already exists in the analog for irrational float compares (`test-units.ts:26-28`) — reuse it for the `/30` division. Must assert the **D-01 worked example** `90×10 (120) > 100×5 (116.67)`.

**Wire the npm script** — add to `app/package.json` mirroring `test:units` (`package.json:15`):
```json
"test:e1rm": "tsx scripts/test-e1rm.ts",
```

---

### `app/supabase/migrations/0012_*.sql` (migration, read-only RPC) — NEW

**Analog:** `0011_phase12_dashboard_rpcs.sql` (primary) + `0006_phase6_chart_rpcs.sql` (secondary). The convention is byte-identical across both and is the locked DB-conventions contract.

**Function-header convention** (`0011:207-224` — copy verbatim, change the body):
```sql
create or replace function public.get_exercise_summary(
  p_exercise_id uuid,
  p_metric text,
  p_since timestamptz
)
returns table ( ... )
language sql
security invoker          -- caller JWT → RLS on exercise_sets+workout_sessions (0001). NO `security definer`.
stable
set search_path = ''      -- defense-in-depth, applies to INVOKER too (Pitfall 7 / T-12-04)
as $$
  ...
$$;

revoke all on function public.get_exercise_summary(uuid, text, timestamptz) from public;
grant execute on function public.get_exercise_summary(uuid, text, timestamptz) to authenticated;
```

**Inner-query RLS + filter convention** (`0011:228-243` — the `sets` CTE; every new RPC body copies this join shape):
```sql
from public.exercise_sets es
inner join public.workout_sessions s
  on s.id = es.session_id
 and s.finished_at is not null            -- finished sessions only (0006/0011 convention)
where es.exercise_id = p_exercise_id
  and es.set_type = 'working'             -- D-03
  and (p_since is null or es.completed_at >= p_since)   -- nullable-since "All" idiom
```
Note: fully-qualified `public.exercise_sets` / `public.workout_sessions`; no explicit `auth.uid()` inside the function (it inherits the 0001 parent-table policies via INVOKER — same as 0006/0011, confirmed `0011:37-42`).

**New chronological window-function body** (D-14/D-15 — the one genuinely-new SQL; RESEARCH Pattern 2). Add `and es.weight_kg > 0` (D-04) to the filter above, then:
```sql
-- SQL e1RM is INTERNAL ordering/flagging ONLY — never returned as a display column.
es.weight_kg * (1 + es.reps / 30.0) as sql_e1rm   -- 30.0 float div, NOT integer 30 (Pitfall 3)
-- ...
coalesce(
  sql_e1rm > max(sql_e1rm) over (
    order by completed_at, set_id              -- set_id tiebreak = deterministic (Pitfall 2)
    rows between unbounded preceding and 1 preceding   -- STRICTLY prior sets (Pitfall 1)
  ),
  false                                        -- first set: empty frame → NULL → false (D-02 baseline)
) as was_pr
```

**Discretion (Claude's call per CONTEXT "RPC shape"):** combined vs split RPCs — recommended split per RESEARCH: (1) `get_exercise_pr_history(p_exercise_id)` window engine → feeds set-row/history/detail trophies + the all-time-best reference (its running-max endpoint IS the best); (2) optional thin session-level aggregator `get_session_pr_flags(p_session_ids uuid[])` so `history.tsx` does one call not N; (3) `get_exercise_sets_in_range(p_exercise_id, p_since)` raw-sets for the chart hero. Return RAW `weight_kg/reps` everywhere — JS computes displayed e1RM via `e1rm.ts` (D-08; never return `sql_e1rm`).

---

### `app/lib/queries/best-e1rm.ts` (service, offline-first query) — NEW

**Analog:** `app/lib/queries/last-value.ts` — the canonical offline-first, persister-hydrated, RLS-scoped read hook. Mirror EXACTLY: `Record` not `Map`, per-exercise queryKey, `userId` belt-and-braces, `enabled: !!exerciseId && !!userId`.

**Record-not-Map contract** (`last-value.ts:60-63, 99-117` — load-bearing for the persister):
```typescript
return useQuery<Record<number, LastValueEntry>>({   // Record, NOT Map — survives JSON.stringify persist
  queryKey: lastValueKeys.byExercise(exerciseId),
  queryFn: async () => {
    if (!userId) return {};
    // ... supabase query ...
    const record: Record<number, LastValueEntry> = {};
    for (const s of sets ?? []) {
      const parsed = SetRowSchema.partial().parse(s);   // Zod parse at boundary, NOT cast (Pitfall 8.13)
      // ... push complete entries ...
    }
    return record;
  },
  enabled: !!exerciseId && !!userId,
  staleTime: 1000 * 60 * 15,
});
```
> **Why Record:** TanStack persists via `JSON.stringify` through the AsyncStorage persister; a `Map` rehydrates as `{}` and `.get` throws (`last-value.ts:18-22`). The best-e1RM reference MUST be `Record<exerciseId, {weight_kg, reps}>`.

**RPC-call + Zod-parse boundary** (from `exercise-chart.ts:243-259` — for the `.rpc()` variant of the best-reference / sets-in-range):
```typescript
const { data, error } = await supabase.rpc("get_best_working_sets", { ... });
if (error) throw error;
return (data ?? []).map((row: unknown) => RowSchema.parse(row));   // parse every row, never `as`-cast
```
Nullable-timestamptz param cast (`exercise-chart.ts:122-127`): `p_since: since as unknown as string` (Supabase type-gen treats nullable timestamptz as required string; SQL guards NULL).

**Live compare (PR-01):** `epley1RM(candidate) > epley1RM(best[exerciseId])` AND `> max(epley1RM of earlier in-session working sets)` (D-07, from `useSetsForSessionQuery` in `sets.ts`).

---

### `app/lib/queries/pr-history.ts` (service, query) — NEW

**Analog:** `app/lib/queries/exercise-chart.ts` (the `useExerciseSummaryQuery` shape) — `supabase.rpc()` + Zod schema + per-tuple queryKey + nullable-since cast.

**Schema + hook pattern** (`exercise-chart.ts:209-280`):
```typescript
const PrHistoryRowSchema = z.object({
  set_id: z.string().uuid(),
  session_id: z.string().uuid(),
  completed_at: z.string(),
  weight_kg: z.coerce.number(),         // PostgREST numeric → string → coerce
  reps: z.coerce.number().int(),        // reps is int NOT NULL on the wire
  was_pr: z.boolean(),
});

export function usePrHistoryQuery(exerciseId: string) {
  return useQuery({
    queryKey: prHistoryKeys.byExercise(exerciseId),   // add a key factory in lib/query/keys.ts
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_exercise_pr_history", { p_exercise_id: exerciseId });
      if (error) throw error;
      return (data ?? []).map((row: unknown) => PrHistoryRowSchema.parse(row));
    },
    enabled: !!exerciseId,
  });
}
```
Add the key factory alongside the existing `exerciseSummaryKeys` / `lastValueKeys` in `app/lib/query/keys.ts` (imported at `last-value.ts:45`, `exercise-chart.ts:53-57`).

---

### PR banner component + set-row trophy (component, event-driven) — NEW

**Analog:** `app/components/ui/Sparkline.tsx` — THE canonical Skia `<Canvas>` + `<LinearGradient>` + Reanimated precedent. Copy the spring constant, the reduce-motion snap, and the `useDerivedValue` animated-geometry mechanism.

**§07 spring + reduce-motion snap** (`Sparkline.tsx:64-92` — verbatim pattern):
```typescript
const SPRING = { damping: 18, stiffness: 220 } as const;   // §07 motion (Sparkline.tsx:65)

const reduced = useReducedMotion();        // synchronous boolean (Sparkline.tsx:80)
const drawProgress = useSharedValue(0);

useEffect(() => {
  if (reduced) {
    drawProgress.value = 1;                 // D-19: snap to final, no animation
  } else {
    drawProgress.value = withSpring(1, SPRING);
  }
}, [reduced, drawProgress]);
```
For the banner: `scale = useSharedValue(0.96)` → `withSpring(1, SPRING)` (D-10 entrance 0.96→1); `sweep = useSharedValue(0)` → `withTiming(1, {duration: 600})` (§07 ~600ms sweep).

**Animated gradient geometry via `useDerivedValue`** (`Sparkline.tsx:121-128` — same mechanism, applied to gradient `start`/`end` instead of a clip rect):
```typescript
const clipRect = useDerivedValue(() =>
  Skia.XYWHRect(0, 0, canvasW * drawProgress.value, canvasH),
);
```
For the sweep: a `useDerivedValue` recomputes the `<LinearGradient>` `start`/`end` `vec(...)` from `sweep.value`, translating a bright band across the surface. UI-thread + GPU-composited → cannot touch the ≤3s budget.

**Skia imports** (`Sparkline.tsx:34-50`): `Canvas, Circle, Group, LinearGradient, Path, Skia, vec` from `@shopify/react-native-skia`; `useDerivedValue, useReducedMotion, useSharedValue, withDelay, withSpring` from `react-native-reanimated`.

**Set-row trophy** — the gradient circle + white `trophy` glyph reuses `Icon` (`app/components/ui/Icon.tsx`, names `trophy`/`arrowUp`/`checkCircle`). The gradient circle is a small Skia surface (or a NativeWind-classed View with the gradient) — see the box-decoration rule below.

> **NativeWind 4 box-decoration (MEMORY `feedback_nativewind_box_deco_via_classname`, Pitfall 6):** banner-surface + trophy-tile bg/border/radius/size go in `className`, NOT an inline `style()` callback (renders NAKED otherwise). Keep `style()` for shadow/opacity/transform only. This is the Phase 10 "naked re-skin" root cause.

---

### `app/app/(app)/workout/[sessionId].tsx` (route, hot path — MOD)

**Self-precedent — three exact in-file patterns to copy:**

**1. Fire-and-forget detection + haptic AFTER mutate (D-17/D-18)** (`[sessionId].tsx:521-563`). The PR detection + banner mount go HERE — after `addSet.mutate`, never awaited, never preceding it (T-11-06):
```typescript
addSet.mutate({ ... }, { onSuccess: () => { reset({ ... }); } });

// MOTN-01/MOTN-05 — fire-and-forget AFTER the optimistic mutate, NEVER awaited.
void getPref("fm:haptics").then((on) => {           // D-18 gate — SAME gate as set-logged haptic
  if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
});
// → PR adds here: void getPref("fm:haptics").then(on => on && Haptics.notificationAsync(Success))
//   + setState to mount a fresh banner per PR set (D-11)
```
The PR haptic is `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` through the SAME `getPref("fm:haptics")` gate.

**2. Set-row check → trophy swap (D-12/D-13)** (`[sessionId].tsx:964-970` — the 36px glyph column). The trophy REPLACES the check on PR-at-log-time rows:
```typescript
{/* Success check (plain checkCircle — no trophy, D-06 [Phase 11]). */}
<View style={{ width: 36 }} className="items-center">
  <Animated.View style={checkStyle}>
    <Icon name="checkCircle" size={20} color={successInk} />
  </Animated.View>
</View>
// → D-13: on a PR-at-log-time row, render the 24px gradient trophy circle INSTEAD
//   (never stacked). The check-scale entrance pattern (§856-864) is the motion template.
```
The check uses `withTiming(1, {duration: 180, easing: Easing.out(Easing.quad)})` NOT the §07 spring — the device-UAT precedent (`§856-864`) switched away because the spring "popped." Flag the banner's 0.96→1 scale for the same fallback if it pops on device (RESEARCH A7).

**3. Floating overlay shape (D-09)** (`[sessionId].tsx:1291-1305` — the finish-modal overlay). The banner mirrors the in-tree animated-overlay structure but with NO backdrop, NO Modal portal (D-22), and `position: absolute` so the set list / input row / "Klart" never shift (Pitfall 4):
```typescript
// MOTN-04 §07 overlay: shared values animate on mount, inline-rendered (no Modal portal, D-15).
const cardTranslateY = useSharedValue(24);
useEffect(() => {
  cardTranslateY.value = withSpring(0, { damping: 18, stiffness: 220 });
}, [cardTranslateY]);
```
Banner = a `position:absolute` floating `<View>` over the set list (no backdrop), auto-dismiss ~3-4s (D-10).

---

### `app/app/(app)/(tabs)/history.tsx` (route — MOD)

**Analog:** existing session-row markup (already Forge, Phase 12) + consume `usePrHistoryQuery`-derived `has_pr` per session. Add a 24px gradient trophy circle (same trophy component as the set row) on rows where any set was a PR-at-log-time (D-14). Trophy is a non-interactive status glyph inside the existing ≥44px row — no new tap target. Mock ref `forge-screens.jsx:627-635`.

---

### `app/app/(app)/history/[sessionId].tsx` (route — MOD)

**Analog:** the Phase 12 D-15 hybrid exercise card (existing in this file) + `e1rm.ts`. Add per-exercise e1RM stat (computed `epley1RM` from the exercise's top working set, display-converted via `useUnitStore`/`formatWeight` — D-20) + an 18px gradient trophy circle on exercises that hit a PR-at-the-time in that session (D-15). Exact placement inside the card = planner's call. Mock ref `forge-screens.jsx:739-746`.

---

### `app/app/(app)/exercise/[exerciseId]/chart.tsx` (route — MOD)

**Self-precedent:** the hero is the Phase 12 D-12 current-best placeholder, explicitly built to be swapped here (D-16). **Swap the DATA, keep the GEOMETRY.**

**Hero numeral computation** (`chart.tsx:342-349`) — change the source from `summary.current_best` to `max(epley1RM(...))` over RPC range sets:
```typescript
const heroNumeral =
  summary != null
    ? metric === "volume"
      ? toDisplayVolume(summary.current_best, units).toLocaleString("sv-SE")
      : String(toDisplayWeight(summary.current_best, units))   // ← swap to toDisplayWeight(maxE1rmInRange, units)
    : "–";
const heroUnit = units === "imperial" ? "lb" : "kg";
const deltaChip = summary != null ? computeDelta(summary, metric, units, t) : null;  // ← delta = best-in-range − earliest-in-range
```

**Hero markup geometry — UNCHANGED** (`chart.tsx:410-451`): 52px `font-display-bold` numeral (`letterSpacing -2, lineHeight 56`, tabular-nums) + 18px `font-medium` unit + 11px eyebrow + 13px `font-bold` success delta chip with `arrowUp` icon. Only the eyebrow key changes `currentBest` → `estimated1RM` (`:418`). The chip color/`success`/`arrowUp` and `rounded-forge-sm px-2.5 py-1.5` are the ratified Forge tokens — keep them.

**Unit reactivity already wired** (`chart.tsx:163-169, 227, 316`): `useUnitStore((s) => s.unit)` is read and `units` is in the `chartData` memo dep array — a kg↔lbs toggle re-renders the hero live (D-20). e1RM computed in kg, then display-converted.

---

### `app/lib/query/client.ts` (config — MOD, ADDITIVE ONLY)

**Self-precedent:** the `['session','finish'].onSettled` invalidation block (`client.ts:830-838`). The ONLY allowed edit — add the new best-reference query key next to the existing `lastValueKeys.all` invalidate:
```typescript
onSettled: (_d, _e, vars) => {
  void queryClient.invalidateQueries({ queryKey: sessionsKeys.active() });
  void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(vars.id) });
  void queryClient.invalidateQueries({ queryKey: lastValueKeys.all });
  // → PR adds: void queryClient.invalidateQueries({ queryKey: bestE1rmKeys.all });
};
```
> **D-17 HARD LINE:** do NOT touch `setMutationDefaults` bodies, `mutationKey`s, `onMutate`/`onError` rollback, or any persister scope-binding. This is one additive `invalidateQueries` line in an EXISTING `onSettled` — read-side, never a mutation-default change. `npm run test:f13-brutal` must stay green.

---

### `app/scripts/test-rls.ts` (test — MOD)

**Self-precedent:** the per-RPC cross-user block (`test-rls.ts:963-1009` for `get_exercise_chart` / `get_exercise_top_sets`; Phase 12 extension `:1011+`). Add ONE block per new RPC — A calls the RPC with B's `exercise_id`, asserts empty (RLS-filtered), not error:
```typescript
{
  const { data: prAsA, error: prErr } =
    await clientA.rpc("get_exercise_pr_history", { p_exercise_id: exB.id });
  if (prErr) {
    fail("Phase 13: get_exercise_pr_history returned error for A on B's exercise", { error: prErr });
  } else if (prAsA && prAsA.length > 0) {
    fail("Phase 13: A's get_exercise_pr_history leaked B's exercise sets", { count: prAsA.length });
  } else {
    pass("Phase 13: A's get_exercise_pr_history on B's exercise returns empty (RLS-filtered)");
  }
}
```
Additionally assert `was_pr` correctness on a seeded progression fixture (PR/baseline edge: first set → `was_pr=false` per D-02; a higher set → `true`; a tie → `false` per D-05). Cross-user assertion per new RPC is a CLAUDE.md gate.

---

### `app/scripts/verify-deploy.ts` (test, deploy gate — MOD)

**Self-precedent:** `phase12Functions` array + pg_proc INVOKER + `search_path` loop (`verify-deploy.ts:121-140`, mirroring `phase6Functions` `:81-119`). Add:
```typescript
console.log("\n=== Phase 13 RPC verification (Migration 0012) ===");
const phase13Functions = ["get_exercise_pr_history", /* + any sibling/best-reference/range RPC names */];
// ... identical pg_proc loop asserting prosecdef === false (INVOKER) + proconfig includes 'search_path=' ...
```

---

### `app/types/database.ts` (config, generated — MOD)

**Regen, never hand-edit.** Run `npm run gen:types` (`package.json:12`) after `0012_*.sql` is pushed; co-commit the regenerated `database.ts` with the migration (CLAUDE.md Database conventions — hand-editing is forbidden).

---

### `app/locales/{sv,en}.json` (config, i18n — MOD)

**Self-precedent:** existing flat keys (`sv.json:106-107, 138` — `personalBest`, `pbSub`, `estimated1RM` all present; `currentBest:150`). Reuse those; add ONE new key at sv/en parity (UI-SPEC fixes the name + string):
```json
"pbSetSuffix": "· set {{n}}"
```
Identical in both locales (sv uses "set" not "sätt" per the in-app convention `sv.json:91-92` `"set":"Set"` / `"sets":"set"` — overrides the mock's "sätt"). `{{n}}` is the 1-based session set ordinal. Rendered concatenated after `pbSub` → e.g. `"105 kg × 6 reps · set 3"`.

---

## Shared Patterns

### Read-side RPC convention (DB)
**Source:** `0011_phase12_dashboard_rpcs.sql:207-224` + `0006_phase6_chart_rpcs.sql`
**Apply to:** every function in `0012_*.sql`
`security invoker` (NO `definer`) + `stable` + `set search_path = ''` + fully-qualified `public.*` + `set_type='working'` + `s.finished_at is not null` + `revoke all … from public; grant execute … to authenticated`. No explicit `auth.uid()` — inherits 0001 parent-table RLS via INVOKER.

### Zod-parse-at-boundary
**Source:** `exercise-chart.ts:66-82, 129, 209-259` ; `last-value.ts:103`
**Apply to:** `best-e1rm.ts`, `pr-history.ts`, any `.rpc()` consumer
`z.coerce.number()` for PostgREST numerics, `.int()` for reps, parse every row (`(data ?? []).map(row => Schema.parse(row))`), NEVER `as`-cast (PITFALLS §8.13 — generated types are compile-time only).

### Offline-first persisted query
**Source:** `last-value.ts:18-22, 60-63, 99-117`
**Apply to:** `best-e1rm.ts` (the live-detection baseline)
`Record` not `Map` (survives JSON persist), per-exercise queryKey, `userId` belt-and-braces filter, `enabled: !!exerciseId && !!userId`. Invalidate on `['session','finish'].onSettled`.

### Skia + Reanimated UI-thread animation
**Source:** `Sparkline.tsx:64-92, 121-128`
**Apply to:** PR banner + set-row trophy
`SPRING = {damping:18, stiffness:220}`; `useReducedMotion()` → snap to final (D-19); `useDerivedValue` for animated Skia geometry (GPU-composited, zero JS-thread cost — cannot touch ≤3s budget).

### Fire-and-forget post-mutate side effect (hot-path safety)
**Source:** `[sessionId].tsx:554-562`
**Apply to:** PR detection + banner mount + PR haptic (D-17/D-18)
AFTER `addSet.mutate`, never awaited, never preceding. Haptic through `getPref("fm:haptics")` gate. A failed/offline best-reference query silently yields "no PR" — never an error, never a block (UI-SPEC §Error state).

### Unit display via reactive store
**Source:** `chart.tsx:163-169` + `units.ts:36-53`
**Apply to:** every PR numeral (banner kg/reps, hero e1RM, session-detail e1RM)
`useUnitStore((s) => s.unit)` + `toDisplayWeight`/`formatWeight`; e1RM computed in kg then display-converted; `units` in the memo dep array so kg↔lbs re-renders live (D-20 / FIT-111).

### NativeWind 4 box-decoration in className
**Source:** MEMORY `feedback_nativewind_box_deco_via_classname` (Phase 10 root cause)
**Apply to:** banner surface + all trophy tiles
bg/border/radius/size in `className`; `style()` for shadow/opacity/transform only.

---

## No Analog Found

None. Every file has an exact or strong in-repo precedent. The two "novel" surfaces (chronological window-function RPC; Skia gradient-sweep banner) are compositions of existing precedents (`0011`/`0006` RPC convention + standard SQL window frame; `Sparkline.tsx` Skia+Reanimated) — no greenfield pattern is invented.

| File | Role | Data Flow | Status |
|------|------|-----------|--------|
| — | — | — | (none) |

---

## Metadata

**Analog search scope:** `app/lib/`, `app/lib/queries/`, `app/lib/query/`, `app/components/ui/`, `app/supabase/migrations/`, `app/scripts/`, `app/app/(app)/`, `app/locales/`, `app/package.json`
**Files scanned (read this session):** `units.ts`, `last-value.ts`, `exercise-chart.ts`, `0011_phase12_dashboard_rpcs.sql`, `Sparkline.tsx`, `workout/[sessionId].tsx` (§500-575, §840-979, §1285-1313), `chart.tsx` (§340-454 + greps), `client.ts` (§775-838), `verify-deploy.ts` (§60-140), `test-rls.ts` (§943-1032), `test-units.ts` (§1-45), `package.json`, `sv.json` (key greps)
**Project skills:** `.claude/skills/` present (design-taste-frontend, emil-design-eng, high-end-visual-design, impeccable, redesign-existing-projects) — relevant to the banner/trophy UI work; planner/executor should read the matching SKILL.md on the UI re-skin per MEMORY `feedback_use_design_taste_skills`.
**Pattern extraction date:** 2026-06-14
