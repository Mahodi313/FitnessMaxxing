---
phase: 06-history-read-side-polish
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - app/app/(app)/(tabs)/history.tsx
  - app/app/(app)/exercise/[exerciseId]/chart.tsx
  - app/app/(app)/history/[sessionId].tsx
  - app/app/(app)/plans/[id].tsx
  - app/components/segmented-control.tsx
  - app/lib/queries/exercise-chart.ts
  - app/lib/queries/sessions.ts
  - app/lib/query/client.ts
  - app/lib/query/keys.ts
  - app/scripts/test-exercise-chart.ts
  - app/scripts/test-rls.ts
  - app/scripts/verify-deploy.ts
  - app/supabase/migrations/0006_phase6_chart_rpcs.sql
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-05-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Adversarial review of the Phase 6 read-side polish slice (F9 history list/detail/delete + F10 per-exercise chart) covering the 0006 migration, three RPC contracts, the InfiniteQuery client wiring, the segmented-control primitive, and four screens.

**Security posture is strong.** RLS pre-condition holds across the three new RPCs (`security invoker` + `set search_path = ''` + `revoke ... from public` + `grant execute ... to authenticated`); the `app/scripts/test-rls.ts` Phase 6 extension exercises the cross-user gate end-to-end for all three RPCs plus the new owner-DELETE cascade; `test-exercise-chart.ts` covers 13 contract assertions (A–M). No service-role leak in `app/lib/`, `app/app/`, or `app/components/` paths (`SUPABASE_SERVICE_ROLE_KEY` referenced only by `app/scripts/test-*.ts` and `app/scripts/verify-deploy.ts`'s `SUPABASE_DB_PASSWORD` direct-postgres path, both Node-only). `createClient<Database>` is correctly typed in both test scripts (per WR-03 from 02-REVIEW.md). All Supabase responses cross a Zod parse boundary before reaching the UI.

**Functional correctness is mostly sound** — the `setMutationDefaults` block 14 for `['session','delete']` correctly preserves the `{ pages, pageParams }` envelope per Pitfall 6, the chart's `useMemo` dep array is exactly `[chartQuery.data]` per D-21, and the `useFocusEffect` overlay-reset closes Pitfall 7. The dual-RPC design (chart aggregate + top-sets) correctly implements the BLOCKER-2 reps-preservation contract.

**Five WARNINGs surface real defects** (or near-defects): a delete-flow toast/bannerError UX dead-zone driven by `router.replace` firing synchronously after `setShowToast`; a `setTimeout` cleanup gap that races with screen unmount; a Reanimated worklet that calls non-worklet JS (`date-fns.format` + `Number.prototype.toLocaleString`) inside `useDerivedValue` and will silently fall back to JS-thread (or crash on stricter Reanimated builds); a missing route-param narrowing in `chart.tsx` that breaks the parity established by `history/[sessionId].tsx`; and an unintuitive exercise ordering in the session detail card list (alphabetic UUID order, not plan/log order).

**Six INFO items** cover ergonomics, parity, and minor code-quality drift.

No BLOCKERs found.

## Critical Issues

None.

## Warnings

### WR-01: Toast and error-banner are unreachable after router.replace in delete handler

**File:** `app/app/(app)/history/[sessionId].tsx:217-229`

**Issue:** `onDeleteConfirm` performs three side effects in sequence:
1. `deleteSession.mutate({ id }, { onError: () => setBannerError(...) })`
2. `setShowToast(true)` + `setTimeout(() => setShowToast(false), 2200)`
3. `router.replace("/(tabs)/history")`

The toast `Animated.View` (lines 505-517) lives inside the `SessionDetailScreen` JSX tree. After `router.replace`, the user is on the history tab — they never see the toast that was just mounted on the (now blurred) detail screen. The intent (UI-SPEC §Post-delete toast: "Passet borttaget") is to confirm the delete on the destination screen.

Worse: if `deleteSession.mutate`'s `onError` fires after navigation (mutation pauses under `networkMode: 'offlineFirst'` and replay fails on reconnect), `setBannerError` is called on a backgrounded screen the user may never see. The banner copy ("Kunde inte ta bort passet. Försök igen.") is failure information that needs to surface where the user is, not where they were.

**Fix:** Either (a) move the toast/error surface to the destination route (e.g., set a transient toast flag via a Zustand store or `router.replace({ pathname: "/(tabs)/history", params: { deleted: "1" } })` and render the toast in `(tabs)/history.tsx`), or (b) defer `router.replace` to fire after the toast duration:

```ts
const onDeleteConfirm = () => {
  setShowDeleteConfirm(false);
  setShowToast(true);
  deleteSession.mutate(
    { id: session.id },
    { onError: () => {
        setShowToast(false);
        setBannerError("Kunde inte ta bort passet. Försök igen.");
      } },
  );
  // Let the toast play before navigating away.
  const t = setTimeout(() => {
    setShowToast(false);
    router.replace("/(tabs)/history" as Href);
  }, 2200);
  // (See WR-02 for cleanup.)
};
```

Option (a) is preferred because it survives the (rare) case where the user backgrounds the app mid-flow.

### WR-02: setTimeout in onDeleteConfirm leaks across unmount

**File:** `app/app/(app)/history/[sessionId].tsx:227`

**Issue:** `setTimeout(() => setShowToast(false), 2200)` is never cleared. The freezeOnBlur convention keeps this screen mounted across navigation, but it does NOT keep it mounted across sign-out, deep-link replacement, or app-process-kill mid-2.2s window. If the screen unmounts before the timer fires, React logs "Can't perform a React state update on an unmounted component" and (with `useFocusEffect` cleanup running) the state setter is called on a torn-down fiber.

Combined with WR-01, fixing this means tracking the timer in a ref so the cleanup can clear it:

**Fix:**

```ts
const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => () => {
  if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
}, []);

const onDeleteConfirm = () => {
  // ...
  toastTimerRef.current = setTimeout(() => setShowToast(false), 2200);
  // ...
};
```

### WR-03: useDerivedValue calls non-worklet JS (date-fns format + toLocaleString) inside the Reanimated worklet

**File:** `app/app/(app)/exercise/[exerciseId]/chart.tsx:151-160`

**Issue:** The two `useDerivedValue` callbacks read SharedValues (correct) but then call:
- `formatNumber(v)` which calls `Number.prototype.toLocaleString("sv-SE")` (`tooltipValueText`)
- `format(new Date(pressState.x.value.value), "d MMM yyyy", { locale: sv })` from `date-fns` (`tooltipDateText`)

Neither is marked `'worklet'`. Under Reanimated 4 (per CLAUDE.md stack), worklets that reference non-worklet JS functions either (a) throw at runtime — "Tried to synchronously call a non-worklet function on the UI thread", (b) silently fall back to JS-thread evaluation (you lose the 60fps press-tracking the comment claims at line 150), or (c) crash with a less-readable error depending on the build. The fact that the file header asserts "runs on the UI thread to follow the press gesture smoothly" (line 150) is not what actually happens given these dependencies.

The file is non-trivial to refactor: `toLocaleString` cannot be made a worklet, and `date-fns` is JS-only. The correct pattern is to compute formatted strings on the JS thread via `useAnimatedReaction` → `runOnJS` writing back into React state, OR to format inside SkiaText via a Skia-level string formatter, OR to accept the JS-thread fallback and remove the "UI thread" claim from the file header.

**Fix:** Convert to JS-thread state via `useAnimatedReaction` + `runOnJS`:

```ts
const [tooltipValue, setTooltipValue] = useState("");
const [tooltipDate, setTooltipDate] = useState("");
useAnimatedReaction(
  () => ({ x: pressState.x.value.value, y: pressState.y.y.value.value }),
  ({ x, y }) => {
    runOnJS(setTooltipValue)(metric === "volume" ? `${formatNumber(y)} kg` : `${y} kg`);
    runOnJS(setTooltipDate)(format(new Date(x), "d MMM yyyy", { locale: sv }));
  },
);
// SkiaText then receives the React state strings (no SharedValue), with a small JS-thread lag — acceptable for a static tooltip readout.
```

Alternative quicker patch: verify in dev that the press callout actually displays the right value+date when invoked; if it does, document the JS-thread fallback in the file header and remove the "UI thread" promise.

### WR-04: Missing route-param narrowing in chart.tsx (parity gap vs history/[sessionId].tsx)

**File:** `app/app/(app)/exercise/[exerciseId]/chart.tsx:94, 118, 126-128`

**Issue:** `useLocalSearchParams<{ exerciseId: string }>()` is a TYPE ASSERTION, not a runtime guard — Expo Router can return `string | string[]` for path params when a malformed deep-link arrives. `history/[sessionId].tsx` lines 99-105 correctly narrow this:

```ts
const rawParams = useLocalSearchParams<{ sessionId: string }>();
const sessionId =
  typeof rawParams.sessionId === "string" ? rawParams.sessionId : undefined;
```

`chart.tsx` does NOT narrow — it uses `exerciseId!` (non-null assertion) at lines 118, 126, 127, 128. A deep-link like `myapp:///exercise/foo/chart?exerciseId=other` could cause `exerciseId` to be a string array. Passing an array into `useExerciseChartQuery` poisons the queryKey (`["exercise-chart","by-exercise",["a","b"],"weight","3M"]`) and produces an invalid Postgres UUID at the RPC boundary (server-side error surfaced as query failure — not a security gap, but an avoidable error path).

**Fix:** Mirror the `history/[sessionId].tsx` pattern verbatim:

```ts
const rawParams = useLocalSearchParams<{ exerciseId: string }>();
const exerciseId =
  typeof rawParams.exerciseId === "string" ? rawParams.exerciseId : undefined;
// Then gate the hooks with `enabled: !!exerciseId` (already done) and use exerciseId without `!`.
```

This also lets you drop the four `exerciseId!` non-null assertions.

### WR-05: setsByExercise map iteration order is alphabetic UUID order, not plan/log order

**File:** `app/app/(app)/history/[sessionId].tsx:149-157, 311-326`

**Issue:** The comment at lines 147-149 claims insertion-order grouping reflects "the order of first appearance in the sets query, which is already exercise_id-grouped by useSetsForSessionQuery's ORDER BY exercise_id ASC, set_number ASC."

That ORDER BY makes first-seen exercise_id the alphabetically-lowest UUID, NOT the order the user added exercises to the plan, NOR the order they logged sets during the session. From a user perspective the exercise cards appear in random (UUID-derived) order. The current Phase 5 active-workout screen orders exercises by `plan_exercises.order_index` (plan order); the historik detail abandons that ordering with no mention in 06-CONTEXT or 06-UI-SPEC.

**Fix:** Either (a) order sets by `completed_at ASC` and group by first-completed-at-per-exercise so cards reflect logging order, or (b) join `plan_exercises.order_index` into the sets query / fetch separately and order cards by plan order. Option (b) matches user expectations (chronological consistency between the active screen and the historik review) but requires a query change. Minimum viable fix is to call out the deviation explicitly in 06-CONTEXT and the screen header so the next planner knows this is intentional.

## Info

### IN-01: Unused exerciseId prop in ExerciseCard

**File:** `app/app/(app)/history/[sessionId].tsx:528, 551`

**Issue:** `ExerciseCard` accepts `exerciseId` as a prop but only `void`s it at line 551 to silence the unused-var lint. The parent passes the value, but the child does not consume it (the parent already keys + builds the onShowChart handler from its own scope).

**Fix:** Drop the `exerciseId` prop from `ExerciseCard`'s type and call site. Cleans up the props surface and removes the `void exerciseId;` pattern.

### IN-02: formatNumber duplicated across 3 files (history.tsx, [sessionId].tsx, chart.tsx)

**File:** `app/app/(app)/(tabs)/history.tsx:76-78`, `app/app/(app)/history/[sessionId].tsx:89-91`, `app/app/(app)/exercise/[exerciseId]/chart.tsx:90`

**Issue:** Three identical implementations of `(n: number) => n.toLocaleString("sv-SE")`. The `history/[sessionId].tsx` comment line 88 even flags this: "Same helper as (tabs)/history.tsx — V1.1 may extract to a shared util." Drift risk is low (each is a one-liner) but the comment is the planner's flag that this is on their radar.

**Fix:** Extract to `app/lib/utils/format.ts` and import from the three call sites. Aligns with the Phase 6 "no new dependency" posture and removes the V1.1 follow-up.

### IN-03: ChartRowSchema accepts arbitrary strings for `day`

**File:** `app/lib/queries/exercise-chart.ts:62-65`

**Issue:** `z.string()` for the `day` field accepts any string. `new Date("not-a-date")` returns Invalid Date, which `.getTime()` returns NaN, which Victory Native XL would silently drop / mis-plot.

**Fix:** Tighten to `z.string().datetime()` (Zod v4 supports ISO 8601 validation). The RPC body always emits a `timestamptz` via `date_trunc('day', es.completed_at)` so the regression risk is in pg version drift or middleware tampering — defensive parse is cheap.

### IN-04: Map allocation in exerciseName useMemo on every chart.tsx render

**File:** `app/app/(app)/exercise/[exerciseId]/chart.tsx:113-119`

**Issue:** `useMemo` rebuilds a `Map` from the entire exercises list every time `exercisesQuery.data` reference changes. For a single-lookup use case, a `.find()` would allocate nothing:

**Fix:**

```ts
const exerciseName = useMemo(() => {
  return (exercisesQuery.data ?? []).find((e) => e.id === exerciseId)?.name
    ?? "Övning";
}, [exercisesQuery.data, exerciseId]);
```

Same pattern in `history/[sessionId].tsx:141-145` is justified because the map is reused inside the ExerciseCard render loop. `chart.tsx` only looks up one id.

### IN-05: Sparse-data chart still renders an empty line with 1 point

**File:** `app/app/(app)/exercise/[exerciseId]/chart.tsx:165, 221-272`

**Issue:** When `chartData.length === 1`, `sparseCaption` is set and the helper text "Logga ett pass till för att se trend." renders below the chart. However the `<CartesianChart>` is still mounted with a single-point dataset above the caption. Victory Native XL's `<Line points={points.y} curveType="natural" />` with one point either (a) renders a single dot (acceptable), (b) renders nothing (acceptable), or (c) renders a chart with axes but no visible data (the user sees axis labels but no line — confusing alongside the helper text).

**Fix:** Either short-circuit to render only the caption when `chartData.length === 1` (simpler), or render the chart with a `<Scatter>` only and skip the `<Line>` so the single point is visibly the data point.

### IN-06: Top-level ChartPressCallout type references useDerivedValue<string> generic in typeof context

**File:** `app/app/(app)/exercise/[exerciseId]/chart.tsx:351-362`

**Issue:** `tooltipValueText: ReturnType<typeof useDerivedValue<string>>` uses TypeScript's instantiation-expression syntax on a `typeof` reference. TS 4.7+ supports this, but Reanimated's `useDerivedValue` exports a function whose generic must be inferable from the callback return — this typeof form has worked historically but is fragile to library type changes. A simpler and more robust form is `import type { DerivedValue }` from react-native-reanimated and use `DerivedValue<string>`.

**Fix:**

```ts
import { useDerivedValue, type DerivedValue } from "react-native-reanimated";
// ...
tooltipValueText: DerivedValue<string>;
tooltipDateText: DerivedValue<string>;
```

---

_Reviewed: 2026-05-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
