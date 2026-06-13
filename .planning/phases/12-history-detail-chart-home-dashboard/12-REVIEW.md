---
phase: 12-history-detail-chart-home-dashboard
reviewed: 2026-06-13T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - app/supabase/migrations/0011_phase12_dashboard_rpcs.sql
  - app/lib/queries/dashboard.ts
  - app/lib/queries/exercise-chart.ts
  - app/lib/query/keys.ts
  - app/lib/units.ts
  - app/components/ui/ProgressRing.tsx
  - app/components/ui/Sparkline.tsx
  - app/app/(app)/(tabs)/index.tsx
  - app/app/(app)/(tabs)/history.tsx
  - app/app/(app)/history/[sessionId].tsx
  - app/app/(app)/exercise/[exerciseId]/chart.tsx
  - app/scripts/test-dashboard-aggregates.ts
  - app/scripts/test-rls.ts
  - app/scripts/verify-deploy.ts
findings:
  critical: 0
  blocker: 0
  warning: 6
  info: 7
  total: 13
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-06-13
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the Phase 12 read-side re-skin + dashboard/exercise-summary RPC work. Security posture is solid: both new RPCs are `security invoker` + `stable` + `set search_path = ''` with fully-qualified `public.*` references, `set_type = 'working'` and `finished_at is not null` filters applied consistently, `p_tz` used only inside `at time zone` (no string concatenation → no injection), and grants are correctly scoped (`revoke ... from public; grant execute ... to authenticated`). The cross-user RLS gate (`test-rls.ts`) and the deploy-side INVOKER/search_path locks (`verify-deploy.ts`) both extend cleanly for the two new functions. The Mon–Sun local-week math (`at time zone p_tz` before `date_trunc`) and the gaps-and-islands streak logic are correct and well-covered by `test-dashboard-aggregates.ts`. D-24 isolation holds — the existing 5-state chart keys are byte-unchanged and new cache slots are additive.

No BLOCKER/Critical issues found. The notable findings are correctness/quality WARNINGs in the client layer: a stale-closure unit-conversion bug on the chart line (WR-01), a summary "always one row" semantics gap that defeats the empty-state path (WR-02), an unwired new-user CTA (WR-03), and a few aggregate-denominator / display nuances.

## Warnings

### WR-01: Chart line + y-axis render in stale units after the async unit-pref read settles

**File:** `app/app/(app)/exercise/[exerciseId]/chart.tsx:217-230`
**Issue:** `chartData` is memoized with a dep array of **exactly `[chartQuery.data]`**, but its body reads both `metric` and `units`. `units` starts at `"metric"` and is updated asynchronously by `getPref("fm:units").then(setUnits)` (lines 164-167). For an imperial user, the sequence is: mount → `units="metric"` → `chartQuery.data` arrives → `chartData` computed in **kg**; then `getPref` resolves → `units="imperial"` → re-render, but `chartQuery.data` identity is unchanged so the memo does **not** recompute. The plotted line and the `formatYAxisLabel` axis (which assumes `chartData` is already display-converted, comment line 313-314) stay in kg, while the tooltip (`tooltipValueTexts`, dep `[chartQuery.data, metric, units]`, line 245) correctly switches to lb. Result: the line/axis and the tooltip disagree for imperial users until the data identity changes (range/metric toggle). Verified `z`-independent — pure memo-dep bug. The "memo contract" comment justifies excluding `metric`/`range` (they live in the queryKey and trigger a refetch → new data identity) but `units` does **not** live in any queryKey, so its exclusion is unjustified and incorrect.
**Fix:** Add `units` (and `metric`, defensively) to the dep array — they do not break the Victory re-mount contract because a unit change is a legitimate reason to rebuild the point array:
```ts
const chartData = useMemo(
  () => (chartQuery.data ?? []).map((row) => ({
    x: new Date(row.day).getTime(),
    y: metric === "volume"
      ? toDisplayVolume(row.value, units)
      : toDisplayWeight(row.value, units),
  })),
  [chartQuery.data, metric, units],
);
```
If the Victory remount-on-identity behavior is genuinely fragile, gate the draw-on-mount effect on `chartQuery.data` only while still recomputing `chartData` on unit change.

### WR-02: `get_exercise_summary` always returns one row, so the client empty-state path is dead and zeros render as real data

**File:** `app/lib/queries/exercise-chart.ts:222-224` (consuming `0011_phase12_dashboard_rpcs.sql:251-275`)
**Issue:** `get_exercise_summary` is a single bare `select` with no `from` clause, so Postgres always returns **exactly one row** even when the exercise has zero matching sets — every column comes back `NULL`. The hook does `const row = (data ?? [])[0]; return row ? ExerciseSummarySchema.parse(row) : null;` expecting a possible row-absence, but `row` is always present. Worse, `ExerciseSummarySchema` types `current_best`, `range_first_value`, `top_set_weight_kg`, `top_set_reps`, `vol_per_session_kg` as `z.coerce.number()` (non-nullable), and `z.coerce.number()` coerces `null` → `0` (`Number(null) === 0`, verified). So a no-data summary parses successfully into all-zeros instead of `null`. Consequence in `chart.tsx`: `summary != null` is always true, so the D-14 3-stat row (line 546) renders even when there is no data — showing "0 kg × 0" for top set, "0 kg" for vol/session — and `heroNumeral` shows "0" rather than the intended "–" placeholder (line 333-338, the `summary != null ? ... : "–"` branch is unreachable). The chart-card empty states (`showAllTimeEmpty`/`showRangeEmpty`) still display correctly, but the hero and stat row below them contradict the "no workouts" message.
**Fix:** Either make the SQL return zero rows when there are no sets (e.g., wrap the select in `... where exists (select 1 from sets)` or select `from sets`/`from per_session` with a guard), OR make the schema nullable and have the consumer treat an all-null row as empty:
```ts
const ExerciseSummarySchema = z.object({
  current_best: z.coerce.number().nullable(),
  range_first_value: z.coerce.number().nullable(),
  top_set_weight_kg: z.coerce.number().nullable(),
  top_set_reps: z.coerce.number().int().nullable(),
  vol_per_session_kg: z.coerce.number().nullable(),
  avg_rpe: z.coerce.number().nullable(),
});
// then:
const row = (data ?? [])[0];
return row && row.current_best != null ? row : null;
```
Note `top_set_reps` also uses `z.coerce.number()` (not `.int()`) in the summary schema (line 198) — inconsistent with the top-sets schema (line 80) which enforces `.int()`.

### WR-03: New-user "Logga ditt första pass" CTA has an empty onPress — the primary new-user action is a no-op

**File:** `app/app/(app)/(tabs)/index.tsx:906-916`
**Issue:** The D-04 zeroed-hero new-user nudge renders a `ForgeButton` whose `onPress={() => {}}` does nothing. For a brand-new account this is the single most prominent call-to-action on the Home screen, and tapping it silently fails. The comment block (lines 757-770) describes this as "an accent 'Logga ditt första pass' nudge" but the action is unimplemented.
**Fix:** Route to the plan-creation or workout-start flow, matching the empty-state CTA elsewhere in the same file (`router.push("/plans/new")`):
```ts
onPress={() => router.push("/plans/new" as Href)}
```
(`router` is already in scope at the `HomeHero` level via `useRouter()` — add the hook to `HomeHero`, or hoist the handler.)

### WR-04: `vol_per_session_kg` denominator counts sessions that contain the exercise but possibly zero working sets edge — and `range_first_value` (weight) mixes earliest-session with heaviest-set semantics

**File:** `app/supabase/migrations/0011_phase12_dashboard_rpcs.sql:246-267`
**Issue:** Two subtle aggregate-semantics issues in `get_exercise_summary`:
1. `range_first_value` for the weight metric (lines 261-263) is `select weight_kg from sets order by finished_at asc, weight_kg desc limit 1` — i.e. the **heaviest** set of the **earliest** session. `current_best` (line 254) is `max(weight_kg)` across **all** sessions. The hero delta = `current_best - range_first_value`, comparing "all-time max" against "earliest session's top set". That is a defensible product choice, but it is asymmetric with the volume metric, where both `current_best` and `range_first_value` are per-session totals. A user whose earliest session happened to contain their all-time PR will see a non-positive delta (chip hidden) even if later sessions trend up. Worth confirming this matches the intended hero-delta semantics in the UI spec.
2. `per_session` (lines 246-250) groups `sets` (already filtered to working sets of THIS exercise) by session, so `vol_per_session_kg = avg(session_vol_kg)` is correctly "avg over sessions that contain this exercise" as documented. No bug, but note the average is over *working-set volume of this one exercise only*, which the label "Volym-pass" (volume per session) could be misread as whole-session volume. Confirm the label copy is unambiguous.
**Fix:** No code change required if both behaviors are intended; document the weight-delta asymmetry next to the hero computation and verify the "Volym-pass" label is scoped to the exercise in the copy. If symmetry is desired, define `range_first_value` (weight) as the earliest session's *max* consistently, or use the first chronological working set's weight.

### WR-05: History volume-delta chip suppressed in two distinct cases that read identically to the user

**File:** `app/app/(app)/(tabs)/history.tsx:305-308, 402`
**Issue:** `hasDelta = volumePriorWeek > 0` and the chip renders only when `hasDelta && deltaPct >= 0`. A week where volume *dropped* (deltaPct < 0) shows no chip, which is the documented "success-only" design. But a week where prior volume was 0 (new user's second week) *also* shows no chip, and a flat week (deltaPct === 0) shows "+0%". These three cases (no baseline / decline / flat) are visually conflated — and `+0%` is arguably noise. Minor UX inconsistency, not a data bug.
**Fix:** Consider suppressing the chip for `deltaPct === 0` as well, or showing a neutral indicator for declines so the absence of a chip is not ambiguous. Low priority.

### WR-06: `lifetime_hours` and per-session duration can be negative / inflated if `finished_at < started_at` or clock skew exists

**File:** `app/supabase/migrations/0011_phase12_dashboard_rpcs.sql:193-196`; `app/app/(app)/(tabs)/history.tsx:508-515`
**Issue:** `lifetime_hours = sum(extract(epoch from (finished_at - started_at)) / 3600.0)` has no `greatest(0, ...)` guard. Since sessions are client-created with client-supplied `started_at`/`finished_at` (offline-first, device clock), a session finished on a device whose clock rolled back, or a malformed offline replay, can yield a negative interval that silently reduces the lifetime total (or, with a far-future `started_at`, inflates it). The history-row `durationMin` (history.tsx:508) *does* clamp with `Math.max(0, ...)`, but the session-detail screen (`[sessionId].tsx:229-235`) and the SQL aggregate do not. Inconsistent defensive handling across the three duration computations.
**Fix:** Clamp the SQL aggregate and align the client computations:
```sql
sum(greatest(0, extract(epoch from (finished_at - started_at))) / 3600.0)
```
Low likelihood for a single-user V1, but cheap to harden and removes a silent-corruption path on the lifetime eyebrow.

## Info

### IN-01: `current_best`/`range_first_value` non-nullable schema relies on `Number(null) === 0` coercion quirk

**File:** `app/lib/queries/exercise-chart.ts:193-200`
**Issue:** The schema "works" only because `z.coerce.number()` happens to map `null → 0`. This is implicit and fragile — a future Zod major or a switch to `z.number()` would turn every no-data summary into a parse throw. Tied to WR-02; making the fields explicitly `.nullable()` documents intent.
**Fix:** Prefer explicit `.nullable()` (see WR-02 fix) over relying on coercion of null.

### IN-02: `void rangeToSince;` no-op statement to keep an import "load-bearing"

**File:** `app/app/(app)/exercise/[exerciseId]/chart.tsx:637-639`
**Issue:** `rangeToSince` is imported (line 93) solely to be referenced via `void rangeToSince;` for documentation. It is never called in this file (the line query uses `rangeAsWindow`, and the summary hook calls `rangeToSince` internally). This is dead code dressed up as a comment anchor; it will read as a mistake to the next maintainer.
**Fix:** Drop the import and the `void` statement; move the explanatory comment to where the behavior actually lives (`useExerciseSummaryQuery`).

### IN-03: `rangeAsWindow` makes the chart line use a coarser since-boundary than the hero/stats

**File:** `app/app/(app)/exercise/[exerciseId]/chart.tsx:209, 627-636`
**Issue:** The line/top-sets queries are routed through `rangeAsWindow` (30d→"1M", 90d→"3M") while the hero/stats use the exact `rangeToSince` day boundary. The header comment acknowledges the line's since "differs from the summary's day-bucket since by at most a couple of days". For "30d" the line actually shows ~1 calendar month (which can be 28-31 days) and "90d" shows 3 months (~89-92 days) — so the chart and the headline numbers describe slightly different windows. Acceptable per the documented D-24 trade-off, but a user comparing the hero delta against the visible line endpoints may notice the mismatch.
**Fix:** Document in-product or accept; if precision matters, migrate the v1 line hooks to the 3-state range in a follow-up rather than bucketing.

### IN-04: `chart.tsx` ellipsis header button is a non-interactive control with a button role + label

**File:** `app/app/(app)/exercise/[exerciseId]/chart.tsx:373-381`
**Issue:** The right-side ellipsis `Pressable` has `accessibilityRole="button"` and `accessibilityLabel={t("moreOptions")}` but no `onPress` — it exists only for "design symmetry" with session-detail. Screen-reader users will hear an actionable "More options" button that does nothing. Mild a11y defect.
**Fix:** Either remove the button (asymmetric header is fine), or give it `accessibilityElementsHidden`/`importantForAccessibility="no"` and drop the role/label so AT does not announce a dead control.

### IN-05: `formatVolume` uses fixed `sv-SE` locale grouping regardless of app language

**File:** `app/lib/units.ts:75-78`; `app/app/(app)/history/[sessionId].tsx:223-225`
**Issue:** `toLocaleString("sv-SE")` hardcodes Swedish non-breaking-space grouping even when the app language is English (i18n supports sv/en). The comment says this matches the existing `formatNumber` idiom, so it is intentional/consistent, but English users will see "28 720" rather than "28,720". Cosmetic only.
**Fix:** Pass the active locale, or accept as a documented convention.

### IN-06: `HomeHero` and `HistoryHeader` each independently read `fm:units` and re-fetch the dashboard summary

**File:** `app/app/(app)/(tabs)/index.tsx:789-798`; `app/app/(app)/(tabs)/history.tsx:114-126, 296`
**Issue:** The `getPref("fm:units")` useState+useEffect pattern is duplicated across `index.tsx` (inline), `history.tsx` (`useUnitPref` hook), `[sessionId].tsx`, and `chart.tsx`. `history.tsx` already factored it into `useUnitPref`; the others did not. Minor duplication; also each consumer of `useDashboardSummaryQuery` shares the same cache slot so the double-call is deduped by react-query (no real extra fetch) — purely a DRY note.
**Fix:** Promote `useUnitPref` to a shared hook (e.g. `lib/prefs` or `lib/units`) and import it in all four screens.

### IN-07: Streak guard `min(rn) <= 2` is correct but undocumented at the SQL boundary value

**File:** `app/supabase/migrations/0011_phase12_dashboard_rpcs.sql:177-184`
**Issue:** The gaps-and-islands streak is correct (verified against `test-dashboard-aggregates.ts` cases a/b/c). The `(select min(rn) from islands) <= 2` "live island" guard encodes the in-progress-week rule (rn=1 this week, rn=2 last week). This is subtle and load-bearing; it is explained in the CTE comment but the magic `2` is easy to misread as an off-by-one. No bug — flagging for maintainability since a future change to the spine ordering would silently break it.
**Fix:** None required; the test harness locks the behavior. Optionally name the boundary (`-- 2 = {this week (rn1), last week (rn2)}`) inline at the predicate.

---

_Reviewed: 2026-06-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
