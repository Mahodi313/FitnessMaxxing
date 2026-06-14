# Phase 12: History, Detail, Chart & Home Dashboard - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 13 new/modified
**Analogs found:** 13 / 13 (every file has a same-repo proven analog)

> This is a **read-side re-skin + 2 new read-only RPCs** phase. There is no new algorithm except the streak gaps-and-islands SQL. Every file below copies a proven in-repo pattern. The RESEARCH.md already cites most line numbers; this map pins the *exact excerpt to copy* and the *delta* the planner must call out per file.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/supabase/migrations/0011_phase12_dashboard_rpcs.sql` (NEW) | migration / RPC | aggregate read-only | `app/supabase/migrations/0006_phase6_chart_rpcs.sql` | exact (same RPC family) |
| `app/lib/queries/dashboard.ts` (NEW) | query hook | request-response (RPC) | `app/lib/queries/sessions.ts` (`useSessionsListInfiniteQuery`) + `exercise-chart.ts` | exact |
| `app/lib/queries/exercise-chart.ts` (MODIFY — add `useExerciseSummaryQuery` + `rangeToSince`) | query hook | request-response (RPC) | itself (`useExerciseChartQuery`) | exact |
| `app/lib/query/keys.ts` (MODIFY — add `dashboardKeys`, `exerciseSummaryKeys`, 3-state range factories) | config / factory | n/a | existing `exerciseChartKeys` / `sessionsKeys` | exact |
| `app/lib/units.ts` (MODIFY — add `toDisplayVolume` / `formatVolume`) | utility | transform | itself (`toDisplayWeight` / `formatWeight`) | exact |
| `app/components/ui/ProgressRing.tsx` (MODIFY — add animated fill, lift static restriction) | component (Skia) | animation | itself + `chart.tsx` `useDerivedValue`/`useSharedValue` | role+flow match |
| `app/components/ui/Sparkline.tsx` (MODIFY — add draw-in animation) | component (Skia) | animation | itself + `chart.tsx` worklet idiom | role+flow match |
| `app/app/(app)/(tabs)/index.tsx` (MODIFY — add ring hero + active swap) | screen (tab) | request-response | itself (Phase 10 Forge re-skin) + `active-session-banner.tsx` | exact |
| `app/app/(app)/(tabs)/history.tsx` (MODIFY — re-skin FHistory + volume card + eyebrow) | screen (tab) | CRUD list | `(tabs)/index.tsx` Forge re-skin (composition) + its own v1 logic | role match (re-skin) |
| `app/app/(app)/history/[sessionId].tsx` (MODIFY — re-skin FSessionDetail + custom header) | screen (detail) | request-response + delete | itself (preserve overlays) + Phase 11 D-09 custom header | exact (logic preserved) |
| `app/app/(app)/exercise/[exerciseId]/chart.tsx` (MODIFY — re-skin FChart + 3-state range + hero + draw) | screen (detail) | streaming/chart | itself (matchFont/tooltip/routing preserved) | exact (logic preserved) |
| `app/scripts/verify-deploy.ts` (MODIFY — add `phase12Functions` block) | test/verify | n/a | its `phase6Functions` block (lines 81-119) | exact |
| `app/scripts/test-rls.ts` (MODIFY — cross-user assertion per new RPC) | test | n/a | its Phase 6 RPC blocks (lines 938-1009) | exact |
| `app/locales/{sv,en}.json` (MODIFY — new flat keys + `weeks`/`week`) | config / i18n | n/a | existing flat keys (`weekVolume`, `streak`, `days`) | exact |
| `app/types/database.ts` (REGENERATE — `npm run gen:types`) | types | n/a | (generated — never hand-edit) | n/a |

---

## Pattern Assignments

### `app/supabase/migrations/0011_phase12_dashboard_rpcs.sql` (NEW — migration/RPC)

**Analog:** `app/supabase/migrations/0006_phase6_chart_rpcs.sql`

**RPC skeleton to copy verbatim** (`0006` lines 96-128 — `get_exercise_chart`):
```sql
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
```

**Every non-negotiable clause (CITED in 0006, MUST replicate per D-23):**
- `language sql` + `security invoker` + `stable` (0006:63-66, 105-108, 153-156)
- `set search_path = ''` (0006:66, 108, 156)
- Fully-qualified `public.workout_sessions` / `public.exercise_sets` / `public.profiles` (0006:77-81, 116-118)
- `set_type = 'working'` on EVERY volume aggregate (0006:82, 121, 170)
- `s.finished_at is not null` filter — only finished sessions count (0006:83, 119, 168)
- `coalesce(sum(es.weight_kg * es.reps), 0)` tonnage idiom (0006:76)
- Per-function trailer: `revoke all ... from public; grant execute ... to authenticated;` (0006:90-91, 127-128, 178-179)
- File-header comment block enumerating each function + "referenced by verify-deploy.ts" note (0006:1-44)

**Deltas the planner MUST call out (NOT in the 0006 analog — see RESEARCH Mandate 1 & 2):**
1. **Two functions, not three:** `get_dashboard_summary(p_tz text default 'Europe/Stockholm')` (combined Home+History aggregate, single-row return) + `get_exercise_summary(p_exercise_id uuid, p_metric text, p_since timestamptz)` (chart hero + 3-stat row). Return shapes spelled out in RESEARCH §Mandate 1 (8 cols) and §Mandate 2 (6 cols).
2. **Local-time week bucketing (NEW idiom, not in 0006):** `date_trunc('week', s.started_at at time zone p_tz)` — `date_trunc('week')` is Monday-based (matches D-06); `AT TIME ZONE p_tz` converts UTC→local before truncating. Client passes IANA tz. (RESEARCH §Mandate 1 "local-time nuance".)
3. **Streak = gaps-and-islands** (RESEARCH §Mandate 1 streak sketch). MEDIUM-confidence SQL; planner must lock the in-progress-week `<= 2` boundary with a test fixture.
4. **`jsonb_agg` sparkline series** (`weekly_volume_series`, last 12 weeks via `generate_series`) — new shape; parse client-side as `z.array(z.object({week, volume_kg}))`.
5. **avg-RPE NULL handling:** `avg(es.rpe) filter (where es.set_type = 'working')` — Postgres `AVG` ignores NULLs, returns NULL only when all NULL → UI shows `–` (RESEARCH §Mandate 2; `exercise_sets.rpe` is nullable per `0001`).

---

### `app/lib/queries/dashboard.ts` (NEW — query hook)

**Analog:** `app/lib/queries/sessions.ts` `useSessionsListInfiniteQuery` (lines 196-230) for the offline-first/`enabled`/Zod pattern; `exercise-chart.ts` for the `supabase.rpc` + parse boundary.

**Hook shape to copy** (`sessions.ts` 196-218 — the RPC + Zod-parse + `enabled` gate):
```typescript
export function useSessionsListInfiniteQuery() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useInfiniteQuery({
    queryKey: sessionsKeys.listInfinite(),
    queryFn: async ({ pageParam }): Promise<SessionSummary[]> => {
      const { data, error } = await supabase.rpc("get_session_summaries", {
        p_cursor: pageParam as unknown as string,
        p_page_size: PAGE_SIZE,
      });
      if (error) throw error;
      return (data ?? []).map((row: unknown) => SessionSummarySchema.parse(row));
    },
    enabled: !!userId,   // gates on auth; persister hydrates the slot at cold-start
  });
}
```

**Zod boundary idiom to copy** (`sessions.ts` 185-194 — `z.coerce.number()` because PostgREST serializes numeric/bigint as string):
```typescript
const SessionSummarySchema = z.object({
  id: z.string().uuid(),
  set_count: z.coerce.number(),        // numeric/bigint arrive as string over the wire
  total_volume_kg: z.coerce.number(),
});
```

**Deltas (per RESEARCH §Mandate 4):**
- Use `useQuery` (single-row), NOT `useInfiniteQuery`. `queryFn` returns `DashboardSummarySchema.parse(data?.[0] ?? null)` — the RPC returns a single-row table, take `[0]`.
- Pass IANA tz: `const tz = Localization.getCalendars()[0]?.timeZone ?? "Europe/Stockholm";` then `supabase.rpc("get_dashboard_summary", { p_tz: tz })`.
- DO NOT override `networkMode` — inherit `offlineFirst` default so the persister hydrates for free (RESEARCH §Mandate 4 step 2).
- Skeleton gate: `if (isPending && data === undefined) → skeleton; else → render hero with data (zeros = new-user D-04)`. Distinguish new-user (`data` present, all-zero) from loading (`data === undefined`).

---

### `app/lib/queries/exercise-chart.ts` (MODIFY — add `useExerciseSummaryQuery` + `rangeToSince`)

**Analog:** itself — `useExerciseChartQuery` (lines 104-129) + `windowToSince` (lines 84-98).

**Existing hook to mirror for the new summary hook** (lines 104-129):
```typescript
export function useExerciseChartQuery(exerciseId, metric, window) {
  return useQuery<ChartRow[]>({
    queryKey: exerciseChartKeys.byExercise(exerciseId, metric, window),
    queryFn: async () => {
      const since = windowToSince(window);
      const { data, error } = await supabase.rpc("get_exercise_chart", {
        p_exercise_id: exerciseId,
        p_metric: metric,
        p_since: since as unknown as string,   // documented nullable-timestamptz type-gen cast
      });
      if (error) throw error;
      return (data ?? []).map((row: unknown) => ChartRowSchema.parse(row));
    },
    enabled: !!exerciseId,
  });
}
```

**Deltas (per RESEARCH §Mandate 2):**
- ADD `export type ChartRange = "30d" | "90d" | "All";` and `rangeToSince(range)` using `subDays(now, 30/90)` / `null` — do NOT mutate the existing `ChartWindow` 5-state union or `windowToSince` (the v1 chart still types against them until fully migrated). **D-24 forbids editing existing query-key/type shapes — add new ones.**
- ADD `useExerciseSummaryQuery(exerciseId, metric, range)` → `supabase.rpc("get_exercise_summary", {p_exercise_id, p_metric, p_since})` with a new `ExerciseSummarySchema` (6 fields, `z.coerce.number().nullable()` for `avg_rpe`).
- Keep the SAME `since as unknown as string` cast (line 122 comment documents the Supabase type-gen limitation for nullable timestamptz params).

---

### `app/lib/query/keys.ts` (MODIFY — add factories)

**Analog:** existing `exerciseChartKeys` (lines 87-101) + `sessionsKeys` (47-58).

**Factory shape to copy** (lines 87-101):
```typescript
export const exerciseChartKeys = {
  all: ["exercise-chart"] as const,
  byExercise: (exerciseId, metric, window) =>
    [...exerciseChartKeys.all, "by-exercise", exerciseId, metric, window] as const,
};
```

**Deltas (RESEARCH §Mandate 4 + §Mandate 2 note):**
- ADD `dashboardKeys = { all: ["dashboard"], summary: () => [...dashboardKeys.all, "summary"] }`.
- ADD `exerciseSummaryKeys.byExercise(exerciseId, metric, range)` — a NEW factory with the 3-state range param; do NOT widen the existing 5-state `exerciseChartKeys`/`exerciseTopSetsKeys` window unions (D-24).

---

### `app/lib/units.ts` (MODIFY — add `toDisplayVolume` / `formatVolume`)

**Analog:** itself — `toDisplayWeight` (lines 28-31) + `formatWeight` (lines 37-45).

**Existing helpers (CITED API — D-20 conversions route through these):**
```typescript
const KG_PER_LB = 0.45359237;
const roundHalf = (n) => Math.round(n * 2) / 2;   // nearest 0.5 (weights ONLY)
export type UnitPref = "metric" | "imperial";

export function toDisplayWeight(kg, unit) {
  if (!Number.isFinite(kg)) return 0;
  return unit === "imperial" ? roundHalf(kg / KG_PER_LB) : kg;
}
export function formatWeight(kg, unit) {  // "100 kg" / "220.5 lb"
  const v = toDisplayWeight(kg, unit);
  const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return `${fmt(v)} ${unit === "imperial" ? "lb" : "kg"}`;
}
```

**Deltas (per RESEARCH §Mandate 5 "volume-conversion nuance"):**
- ADD `toDisplayVolume(kg, unit)` = `kg / KG_PER_LB` for imperial, passthrough for metric — **NO `roundHalf`** (0.5-lb plate granularity is meaningless on a 28,720 kg tonnage sum). Keep the `Number.isFinite` guard.
- ADD `formatVolume(kg, unit)` returning a unit-suffixed, locale-formatted string (`toLocaleString("sv-SE")` for the Swedish non-breaking-space separator — see the `formatNumber` idiom in `history.tsx:77` and `chart.tsx:90`).
- Pure module, importable from `.tsx` tests like the existing helpers.

---

### `app/components/ui/ProgressRing.tsx` (MODIFY — animated fill, MOTN-02 + D-19)

**Analog:** itself (static arc) + `chart.tsx` Reanimated→Skia worklet idiom (lines 66, 224-234).

**Static arc to make reactive** (`ProgressRing.tsx` lines 68-77):
```typescript
const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));  // current clamp
const fg = Skia.Path.Make();
fg.addArc({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, -90, 360 * v);
```

**Reanimated→Skia derived-value idiom to copy** (`chart.tsx` 224-228 — the worklet reads a SharedValue and Skia re-renders reactively):
```typescript
const tooltipValueText = useDerivedValue(() => {
  const idx = pressState.matchedIndex.value;
  const arr = valueTextsSV.value;
  return idx >= 0 && idx < arr.length ? arr[idx] : "";
});
```

**`withSpring` §07-curve idiom already in repo** (`(tabs)/index.tsx:62` imports it; spec curve damping 18 / stiffness 220):
```typescript
import { useSharedValue, useDerivedValue, withSpring, useReducedMotion } from "react-native-reanimated";
const reduced = useReducedMotion();
useEffect(() => {
  progress.value = reduced ? v : withSpring(v, { damping: 18, stiffness: 220 });
}, [v, reduced]);
const fgPath = useDerivedValue(() => {
  const p = Skia.Path.Make();
  p.addArc({ x: cx-r, y: cy-r, width: 2*r, height: 2*r }, -90, 360 * progress.value);
  return p;
});
```

**Deltas:**
- The file header (lines 9-12) explicitly forbids `useSharedValue`/`useDerivedValue`/`withTiming` — **Phase 12 lifts this restriction.** Update the header comment.
- Keep the `value` math + `useColorScheme()` track-resolution (lines 63-66) intact; animation is additive (pass-driven SharedValue form recommended).
- D-19 overflow: when `value > 1`, DON'T clamp — draw a second-lap arc for `(progress-1)*360` + a Skia `<Blur>`/wide low-opacity stroke glow. Center label always shows the REAL count (e.g. "5 / 4"), never the capped fraction.
- Honor reduce-motion: `useReducedMotion()` is a synchronous boolean (RESEARCH §Mandate 3) → snap to final.

---

### `app/components/ui/Sparkline.tsx` (MODIFY — draw-in, D-18)

**Analog:** itself (static line/area paths, lines 74-83) + the same Reanimated clip technique as the chart.

**Static paths to wrap in an animated clip** (`Sparkline.tsx` 74-83):
```typescript
const line = Skia.Path.Make();
pts.forEach(([x, y], i) => (i === 0 ? line.moveTo(x, y) : line.lineTo(x, y)));
const area = line.copy();
area.lineTo(halo + width - pad, baseY);
area.lineTo(halo + pad, baseY);
area.close();
```

**Deltas (RESEARCH §Mandate 3 "Sparkline draw-in"):**
- Wrap line+area in a `<Group clip={clipRect}>` whose width animates 0→full via a `useSharedValue` + `useDerivedValue(() => Skia.XYWHRect(...))`.
- Last-point dot (lines 106-113) fades/scales in at the end of the draw (`withDelay` or a second SharedValue).
- Lift the static-only header restriction (lines 11-13).
- Snap-to-final on `useReducedMotion()`.

---

### `app/app/(app)/(tabs)/index.tsx` (MODIFY — add ring hero + active swap, DASH-01/02, D-01/D-02)

**Analog:** itself (Phase 10 Forge composition) + `active-session-banner.tsx` (the swap-in component).

**Forge token-hex split to reuse verbatim** (`index.tsx` 84-111 — `TOKENS.light`/`.dark`; the Skia primitives + Icon strokes consume these hexes since NativeWind classes don't apply inside a Skia canvas):
```typescript
const TOKENS = {
  light: { accent: "#E14E10", success: "#1E9E45", gradFrom: "#FF7A2E", gradTo: "#FF3D5E", ... },
  dark:  { accent: "#FF5A1F", success: "#30D158", gradFrom: "#FF7A2E", gradTo: "#FF2D55", ... },
} as const;
const tk = TOKENS[colorScheme === "dark" ? "dark" : "light"];
```

**Active-session swap source — already Forge, render in the hero slot when active** (`active-session-banner.tsx` is fully Forge: `bg-forge-accentSoft-light dark:bg-forge-accentSoft`, live dot, `tabular-nums` timer, `Icon name="chevronRight"`). The Home already imports `useActiveSessionQuery` (`index.tsx:68`) — gate: `activeSession ? <ActiveSessionBanner/> : <RingHero/>`.

> Note: `active-session-banner.tsx` is normally rendered by `(tabs)/_layout.tsx` above the tabs. For D-02 the **hero region** itself swaps idle ring → banner. Confirm whether to reuse the existing component or compose `FActiveSessionBanner` markup; the existing component is the proven Forge analog either way.

**tabular-nums idiom for count-up numerals** (`active-session-banner.tsx:122`, also `index.tsx`): `style={{ fontVariant: ["tabular-nums"] }}` — apply to ring count, streak, volume.

**Deltas:**
- ADD ring hero ABOVE the existing plan list (the plan list is unchanged Phase 10 code). Use `ProgressRing` (animated), `ForgeChip` (streak + volume chips), `Icon name="flame"` for streak.
- Wire `useDashboardSummaryQuery()` (new hook). D-04 zeroed-hero is the success branch with all-zero data + an accent "Logga ditt första pass" CTA (`ForgeButton`).
- Streak chip uses `t('weeks')`/`t('week')` (NEW keys, D-07), NOT `t('days')`.

---

### `app/app/(app)/(tabs)/history.tsx` (MODIFY — re-skin FHistory + volume card + eyebrow)

**Analog:** the v1 file's own logic (`useSessionsListInfiniteQuery`, cursor pagination, RefreshControl, post-delete toast, empty state — all preserved) + `(tabs)/index.tsx` for the Forge composition idiom (TOKENS split, `useTranslation`, `Icon`, `ForgeCard`).

**Preserve verbatim from v1** (only re-skin chrome):
- Infinite-list plumbing: `data?.pages.flat()` memo (lines 139-142), `onEndReached` guard `hasNextPage && !isFetchingNextPage` (lines 164-171), `RefreshControl` (180-186).
- Post-delete toast read-and-clear (lines 108-134) — `params.toast === "deleted"` → 2.2s timer → `router.setParams({toast: undefined})`, with the unmount cleanup ref (WR-02).
- Plan-name fallback (line 228): `session.plan_name ?? <t('noPlanFallback')>`.

**Deltas (D-05/D-09/D-16/D-21):**
- Replace `bg-white dark:bg-gray-900` / `bg-gray-100 dark:bg-gray-800` / `text-blue-600` greys with `forge-*` tokens (see UI-SPEC Color table).
- ADD lifetime eyebrow (D-09) + volume-overview card (`ForgeCard` + big numeral + success delta chip + animated `Sparkline`, D-05) ABOVE the list — both fed by `useDashboardSummaryQuery()`.
- Row (D-16): `ForgeCard` radius 16, 44px `surface2` date-badge (DD/MON) + plan name + meta "X set · Y kg · Z min" + trailing `Icon name="chevronRight"`. **OMIT any trophy (D-13).**
- All hardcoded Swedish ("Historik", "Inga pass än", "— ingen plan") → `t()` keys.
- Convert volume/weight figures via `formatVolume`/`formatWeight` (D-20) — currently raw `${kg} kg` (lines 261, 239).

---

### `app/app/(app)/history/[sessionId].tsx` (MODIFY — re-skin FSessionDetail + custom header, D-15/D-17/D-22)

**Analog:** itself — ALL overlay + delete + notes logic is offline-critical and preserved verbatim (D-22). Custom header pattern: Phase 11 D-09 (workout screen) + UI-SPEC layout.

**Preserve VERBATIM (offline-critical — D-22, do NOT touch the logic, re-skin chrome only):**
- Keyboard-height lift (lines 136-152): the `Keyboard.addListener` show/hide + `paddingBottom = keyboardHeight + 16` (line 624). Documented UAT 2026-05-16 fix; KeyboardAvoidingView does NOT work here.
- `useFocusEffect` overlay reset on blur (lines 158-167) — prevents ghost overlay under freezeOnBlur.
- `mutate`-not-`mutateAsync` for delete (lines 285-298) + edit-notes (lines 180-190).
- Inline-overlay pattern (NOT Modal portal): overflow menu (436-496), delete-confirm (502-601), edit-notes (609-689). Tap-on-scrim dismisses; `setTimeout(...50)` before opening the stacked confirm (line 475).
- Post-delete `router.replace({pathname:"/(tabs)/history", params:{toast:"deleted"}})` (294-298) — toast lives on the list screen (WR-01).
- Loading gate on `!session` NOT `isPending` (line 258); `initialData` seeding via `useSessionQuery`.

**Deltas (D-15/D-17/D-21):**
- D-17 custom header: `Stack.Screen options={{ headerShown: false }}` and render an in-content Forge header — 40px circular back (`chevronLeft`) + 40px circular ellipsis (hosts the existing overflow→delete flow). a11y: `accessibilityLabel={t('back')}` / `t('moreOptions')`, `accessibilityRole="button"`, 44px hit-slop (UI-SPEC FLAG-1). Replaces the current `headerRight` ellipsis (lines 310-320).
- D-15 hybrid `ExerciseCard` (lines 701-776): Forge card frame (name + right-aligned max-weight stat) WITH the kept expanded per-set list (`{w} × {r}` + RPE, lines 757-772). Re-skin greys→`forge-*`.
- Delete-confirm button colored `forge-danger` (`#D70015 → #FF453A`) per UI-SPEC Color table — replaces the current `#EF4444`/`#DC2626` (line 585).
- Convert per-set weights + max-weight + volume via `formatWeight`/`formatVolume` (D-20) — currently raw kg (lines 400, 547, 750, 764).
- All hardcoded Swedish → `t()`.

---

### `app/app/(app)/exercise/[exerciseId]/chart.tsx` (MODIFY — re-skin FChart + 3-state range + hero + draw, D-10/D-11/D-12/D-14/D-17/D-18)

**Analog:** itself — matchFont (FIT-67), tooltip callout, Senaste-10 routing, memo contract all preserved.

**Preserve VERBATIM (regression-critical):**
- **matchFont FIT-67 fix** (line 195): `const font = matchFont({ fontFamily: "Helvetica", fontSize: 12 });` — NEVER revert to `useFont(null, ...)` (returns null on Skia 2.x → invisible axis/tooltip). Any new in-canvas count-up text must also use a `matchFont`-resolved SkFont.
- **Memo contract** (lines 146-153): `chartData` dep array EXACTLY `[chartQuery.data]` — Victory re-mounts on data-identity change, so the stable reference is load-bearing.
- **Tooltip worklet→SharedValue mirror** (lines 210-234): pre-format on JS thread, mirror into SharedValues via `useEffect`, worklet reads `.value`. (Reanimated 4 doesn't re-capture closure vars in `useDerivedValue`.)
- **Senaste-10 tap-to-source-session routing** (lines 376-379): `router.push(`/history/${row.session_id}`)` (Phase 6 BLOCKER-2). Keep `useExerciseTopSetsQuery`.
- **SegmentedControl** reuse for metric toggle (lines 258-263) — Phase 9 component, already imported.

**Deltas (D-10/D-11/D-12/D-14/D-17/D-18/D-20):**
- D-11 range: replace the 5-state `WINDOW_OPTIONS` (lines 82-88, `1M/3M/6M/1Y/All`) with 3-state `30d / 90d (default) / All`, mapped via the NEW `rangeToSince`. Default state `"90d"` not `"3M"` (line 119). Use the new `ChartRange` type.
- D-17 custom header: `Stack.Screen options={{ headerShown: false }}` (currently `headerShown: true`, line 248) + in-content Forge header (back + ellipsis, same a11y labels as session detail).
- D-12 hero: 52px display numeral = active-metric current-best + range-delta success chip, from `useExerciseSummaryQuery` (NEW). Real data, NOT e1RM (Phase 13).
- D-14 3-stat row (`FChartStat`: Top set / Vol-per-session / Avg RPE) from the summary RPC; `–` when `avg_rpe` is null.
- MOTN-03 chart draw-on-mount: Reanimated-driven Skia clip rect, re-fire when `chartQuery.data` identity changes (honor the memo contract). Snap on reduce-motion.
- D-20: route `${row.weight_kg} kg × ${row.reps}` (line 389), tooltip strings (167-182), y-axis `formatYAxisLabel` (236-237) through `formatWeight`/`formatVolume` — v1 chart predates the units helper (RESEARCH §Mandate 5 regression points).
- Re-skin `bg-gray-100 dark:bg-gray-800` chart card + greys → `forge-*` tokens; Skia color props (`accent`, `gridColor`, `tooltipBg`, lines 108-115) re-derive from `forge-*` hexes.
- All hardcoded Swedish ("Senaste 10 passen", "Max vikt", "Inga pass i detta intervall") → `t()`.

---

### `app/scripts/verify-deploy.ts` (MODIFY — add `phase12Functions` block)

**Analog:** the `phase6Functions` block (lines 81-119) — copy the exact pg_proc INVOKER + search_path check shape:
```typescript
const phase6Functions = ["get_session_summaries", "get_exercise_chart", "get_exercise_top_sets"];
for (const fname of phase6Functions) {
  const rows = await sql`select proname, prosecdef, proconfig from pg_proc
    where pronamespace = 'public'::regnamespace and proname = ${fname}`;
  if (rows.length === 0) { /* FAIL: not deployed */ }
  const hasSecurityInvoker = row.prosecdef === false;   // INVOKER
  const hasSearchPath = cfg.includes("search_path=");
  // PASS only if both
}
```

**Delta:** add `const phase12Functions = ["get_dashboard_summary", "get_exercise_summary"];` with the identical loop + a `phase12Failures` counter and `process.exit(1)` on failure (mirror lines 113-119).

---

### `app/scripts/test-rls.ts` (MODIFY — cross-user assertion per new RPC)

**Analog:** the Phase 6 cross-user RPC blocks (lines 938-1009) — one block per RPC asserting A's call does not surface B's data:
```typescript
// get_exercise_chart cross-user (lines 963-985) — copy this shape:
const { data: chartAsA, error: chartErr } =
  await clientA.rpc("get_exercise_chart", { p_exercise_id: exB.id, p_metric: "weight", p_since: null as unknown as string });
if (chartErr) fail(...);
else if (chartAsA && chartAsA.length > 0) fail("A's RPC leaked B's data");
else pass("A's RPC on B's data returns empty (RLS-filtered)");
```

**Deltas (D-23 — assertion PER new RPC):**
- `get_dashboard_summary`: A calls it, assert the returned aggregates reflect ONLY A's seeded sessions (B's finished sessions must NOT inflate A's `lifetime_sessions`/`volume`/`sessions_this_week`). Pattern mirrors the `get_session_summaries` non-leak block (lines 938-961).
- `get_exercise_summary`: A calls it with B's `exId` → expect empty/zeroed (RLS-filtered), mirroring lines 987-1009.

---

### `app/locales/{sv,en}.json` (MODIFY — new flat keys + `weeks`/`week`)

**Analog:** existing flat key→string map. Existing in-surface keys: `weekVolume` (sv "Veckans volym"), `weekSessions` ("Pass denna vecka"), `streak` ("streak"), `days`/`day`, `history`, `sets`.

**Deltas (D-07/D-21, flat 1:1 keys per Phase 8 D-10):**
- ADD `weeks` ("veckor"/"weeks") + `week` ("vecka"/"week") for the streak chip (D-07). DO NOT use the existing `days`/`day` for the streak chip; leave those keys in place (may be used elsewhere).
- ADD all new dashboard/chart/lifetime/empty-state/delete-confirm/a11y keys from the UI-SPEC Copywriting Contract (lines 127-160): `back`, `moreOptions`, lifetime eyebrow, volume-card copy, range/metric labels, "Senaste 10 passen", delete-confirm copy, etc.

---

### `app/types/database.ts` (REGENERATE — never hand-edit)

`npm run gen:types` AFTER `supabase db push` of `0011`; commit `database.ts` in the SAME commit as the migration (CLAUDE.md DB convention — hand-editing forbidden). The new RPC return types appear automatically.

---

## Shared Patterns

### Read-side RPC (D-23)
**Source:** `app/supabase/migrations/0006_phase6_chart_rpcs.sql` (whole file)
**Apply to:** both new RPCs in `0011`.
`language sql` + `security invoker` + `stable` + `set search_path = ''`, fully-qualified `public.*`, `set_type = 'working'`, `s.finished_at is not null`, per-function `revoke/grant` trailer. RLS scoping is free via the caller's JWT through the 0001 policies.

### Zod wire-boundary parse (PITFALLS §8.13)
**Source:** `app/lib/queries/sessions.ts:185-217`, `exercise-chart.ts:62-78`
**Apply to:** every new RPC consumer (`dashboard.ts`, `useExerciseSummaryQuery`).
Generated types are compile-time only; `Schema.parse(row)` at the wire is the runtime guard. `z.coerce.number()` because PostgREST serializes numeric/bigint as strings. Nullable RPC timestamptz params: `since as unknown as string` cast (documented type-gen limitation).

### Offline-first read (D-03)
**Source:** `app/lib/queries/sessions.ts:166-169 + :196-230`
**Apply to:** `useDashboardSummaryQuery`.
Stable hierarchical query key + inherit `networkMode: 'offlineFirst'` (don't override) + `enabled: !!userId`. The single `PersistQueryClientProvider` (`_layout.tsx:243`) hydrates EVERY cache slot at cold-start — no per-query opt-in.

### Reanimated→Skia animation (MOTN-02/03/D-18)
**Source:** `chart.tsx:66,210-234` (worklet/SharedValue mirror) + `(tabs)/index.tsx:56-62` (`withSpring`)
**Apply to:** `ProgressRing`, `Sparkline`, chart line draw.
Drive a `useSharedValue` 0→target via `withSpring({damping:18, stiffness:220})`; feed into Skia via `useDerivedValue` rebuilding the path on the UI thread. `useReducedMotion()` (sync boolean) → snap to final.

### Forge token-hex split for Skia + Icon strokes
**Source:** `(tabs)/index.tsx:84-111` (`TOKENS` map) + `chart.tsx:108-115`
**Apply to:** every re-skinned screen feeding hexes to `ProgressRing`/`Sparkline`/`CartesianChart`/`Icon`.
NativeWind `dark:` classes do NOT apply inside a Skia canvas — resolve `forge-*` to hex via `useColorScheme()` and pass as props. Class-driven surfaces still use token classes.

### Unit conversion (D-20)
**Source:** `app/lib/units.ts:28-45` + new `toDisplayVolume`/`formatVolume`
**Apply to:** every weight/volume figure on all three screens + Home + sparkline + chart axes.
Storage stays kg; RPCs return kg; client converts. `formatWeight` (nearest-0.5-lb) for individual weights; `toDisplayVolume` (NO half-rounding) for tonnage sums.

### Inline-overlay (never Modal portal) + keyboard lift (D-22)
**Source:** `history/[sessionId].tsx:136-152, 436-689`
**Apply to:** session-detail overflow/delete-confirm/edit-notes re-skin (chrome only).
Absolute-positioned `Pressable` scrim, manual `paddingBottom = keyboardHeight + 16`, `useFocusEffect` reset, `mutate`-not-`mutateAsync`. Re-skin colors/radii only — preserve the logic verbatim.

### Custom in-content Forge header (D-17)
**Source:** Phase 11 D-09 (workout screen) + UI-SPEC Layout Contract lines 202-203
**Apply to:** session detail + chart.
`Stack.Screen options={{ headerShown: false }}` + in-content header: 40px circular back/ellipsis (`surface`+`border`), `accessibilityLabel` via `t('back')`/`t('moreOptions')`, `accessibilityRole="button"`, 44px hit-slop.

### i18n flat keys (D-21)
**Source:** `app/locales/sv.json` (flat key→string, Phase 8 D-10) + `active-session-banner.tsx` `useTranslation`/`t()` usage
**Apply to:** all four screens. Live `t()` so the language toggle re-renders instantly. User content (plan/exercise names, notes) never translated.

---

## No Analog Found

None. Every file maps to a same-repo proven analog. The only genuinely novel logic is the **streak gaps-and-islands SQL** inside `0011` — which has no in-repo precedent (RESEARCH §Mandate 1 provides the sketch + MEDIUM confidence flag + the required test fixtures). The planner should treat the streak SQL as the single research-driven piece, not an analog-copy.

---

## Metadata

**Analog search scope:** `app/supabase/migrations/`, `app/lib/queries/`, `app/lib/query/`, `app/lib/units.ts`, `app/components/ui/`, `app/components/active-session-banner.tsx`, `app/app/(app)/(tabs)/`, `app/app/(app)/history/`, `app/app/(app)/exercise/`, `app/scripts/`, `app/locales/`
**Files read in full:** 0006 migration, exercise-chart.ts, sessions.ts, units.ts, keys.ts, ProgressRing.tsx, Sparkline.tsx, history.tsx, history/[sessionId].tsx, chart.tsx, active-session-banner.tsx, verify-deploy.ts; targeted reads of test-rls.ts (938-1009) + index.tsx (1-130)
**Pattern extraction date:** 2026-06-13
