---
phase: 13-pr-celebration-f18
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - app/lib/e1rm.ts
  - app/lib/queries/best-e1rm.ts
  - app/lib/queries/exercise-sets-in-range.ts
  - app/lib/queries/pr-history.ts
  - app/lib/queries/session-pr-flags.ts
  - app/lib/query/keys.ts
  - app/lib/query/client.ts
  - app/lib/units.ts
  - app/components/ui/PrTrophy.tsx
  - app/components/ui/PrBanner.tsx
  - app/app/(app)/workout/[sessionId].tsx
  - app/app/(app)/(tabs)/history.tsx
  - app/app/(app)/history/[sessionId].tsx
  - app/app/(app)/exercise/[exerciseId]/chart.tsx
  - app/supabase/migrations/0012_phase13_pr_rpcs.sql
  - app/scripts/test-rls.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-06-14
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 13 ships four read-only SECURITY-INVOKER RPCs, a TanStack query layer, live
in-workout PR detection, and read-side PR markup. The security posture is strong:
all RPCs are `security invoker` with `set search_path = ''` and fully-qualified
schema references, RLS inheritance is exercised by genuine cross-user assertions in
`test-rls.ts` (with admin-side defense-in-depth), every Supabase boundary Zod-parses
rather than `as`-casts, the single Epley source (`lib/e1rm.ts`) is honored
everywhere, and the D-17 fire-and-forget log-budget constraint is respected (the PR
detection runs AFTER `addSet.mutate`, never awaited). No service-role leak, no
hardcoded secret, no injection surface (parameterized RPC args, no string-built SQL).

No Critical issues found. The findings below are correctness-divergence and
robustness concerns — chief among them an asymmetry between the live PR banner and
the derived per-row trophy that can surface a banner without a matching trophy (and
vice-versa) on the same set, plus a lexicographic timestamp sort that is not robust
to PostgREST's timezone-offset formatting.

## Warnings

### WR-01: Live PR banner and derived row-trophy can disagree on the same set (warmups in cache)

**File:** `app/app/(app)/workout/[sessionId].tsx:700-708` (live) vs `:606-628` (derived `prSetIds`)

**Issue:** The two PR determinations compute `sessionMax` / `runningMax` over
different set populations and can produce opposite verdicts for the same physical set.

- Live detection (`onKlart`) folds the running max over **all** `setsForThisExercise`:
  `setsForThisExercise.reduce((mx, s) => Math.max(mx, epley1RM(s.weight_kg, s.reps)), 0)`.
- Derived `prSetIds` folds the running max over `setsForThisExercise` too, but seeds
  it differently (`runningMax = best ? epley1RM(...) : 0`, `hasPrior = !!best`) and
  walks set-by-set.

`setsForThisExercise` is filtered only by `exercise_id` (`:530`), NOT by
`set_type === 'working'`. The active-workout screen always logs `set_type: 'working'`
today, so this is latent — but `EditableSetRow`/`useUpdateSet` and any future warmup
UI can place non-working rows into the same cache. The SQL engine and the cached
`bestE1rm` baseline both filter `set_type = 'working'` (migration `:114`, `:162`),
so the client's in-session max is computed over a *different* population than the
baseline it compares against. The result is a banner that fires on a set the trophy
logic (or the eventual read-side `was_pr`) does not mark, or vice-versa.

**Fix:** Filter both folds to working sets so the two paths and the server agree:
```ts
const workingSets = setsForThisExercise.filter((s) => s.set_type === "working");
const sessionMax = workingSets.reduce(
  (mx, s) => Math.max(mx, epley1RM(s.weight_kg, s.reps)), 0,
);
const hasPriorReference = !!best || workingSets.length > 0;
```
Apply the same `set_type === "working"` filter inside the `prSetIds` memo loop.

### WR-02: Chart-hero "earliest" sort compares ISO timestamps lexicographically — not offset-robust

**File:** `app/app/(app)/exercise/[exerciseId]/chart.tsx:369-371` (and the same idiom at `history` hero is parsed identically)

**Issue:** `SetInRangeRowSchema.completed_at` is `z.string()` (no datetime coercion).
The hero's "earliest" determination sorts by raw string comparison:
```ts
const ordered = [...sets].sort((a, b) =>
  a.completed_at < b.completed_at ? -1 : a.completed_at > b.completed_at ? 1 : 0,
);
const earliestE1rmKg = epley1RM(ordered[0].weight_kg, ordered[0].reps);
```
Lexicographic ordering of timestamps is only correct when every value is in an
identical, zero-padded, UTC-`Z` format. PostgREST/Postgres `timestamptz` can serialize
with a numeric offset (e.g. `2026-01-01T12:00:00+01:00`) depending on the session
`timezone` GUC, and `+01:00` sorts *after* `Z` (`+` is 0x2B, `Z` is 0x5A — actually
`+` < `Z`, so the offset row sorts *earlier* than a same-instant UTC row). Mixed
formats within one result set therefore mis-pick the earliest set and corrupt the
range-delta chip. The RPC does `order by es.completed_at` server-side, so the wire
order is already correct; the defensive client re-sort is what introduces the risk.

**Fix:** Either trust the RPC's `order by completed_at` and take `sets[0]` without
re-sorting, or parse to epoch before comparing:
```ts
const ordered = [...sets].sort(
  (a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime(),
);
```
Same change applies anywhere a `completed_at` string is range-sorted on the client.

### WR-03: `bestE1rm` baseline is not invalidated when a set is deleted/edited mid-session — stale PR verdicts

**File:** `app/lib/query/client.ts:945-950` (`['set','remove']` onSettled), `:1000-1005` (`['set','update']` onSettled); consumed at `workout/[sessionId].tsx:368,611,696`

**Issue:** `bestE1rmKeys.all` is invalidated only on `['session','finish']`
(`client.ts:853`). Within a live session the cached all-time best is intentionally
frozen (offline-first). But the live banner and the derived trophy compare against
`bestE1rm[exercise_id]` which is the all-time best across **finished** sessions only.
If the user logs a genuine PR, then deletes or edits that set down via `useRemoveSet`
/ `useUpdateSet`, `prSetIds` recomputes correctly from `setsForThisExercise` (good),
but the **banner already fired** for the now-deleted set and cannot be recalled, and
any *subsequent* set is judged against a `runningMax` that still includes the deleted
set's e1RM because `prSetIds` re-walks the (now-shorter) list — actually self-heals
for trophies, but the transient banner is a one-shot. This is a UX-honesty gap rather
than data loss.

**Fix:** Acceptable to accept as a documented limitation (banner is ephemeral delight,
trophies self-heal). If tighter honesty is wanted, gate the banner spawn on the set
surviving the optimistic window, or suppress re-fire for an `id` already dismissed.
At minimum, document this in the file header so a future reader does not "fix" the
self-healing trophy path and break the offline contract.

### WR-04: `useSessionPrFlags` queryKey hashes a comma-join that collides across id sets

**File:** `app/lib/query/keys.ts:209-215`

**Issue:** `byIds` keys off `[...sessionIds].sort().join(",")`. UUIDs never contain
commas so a literal collision is impossible today, but the cache slot is keyed on a
single flattened string rather than the array itself. Because the join sorts a copy,
two different visible windows that happen to contain the same id set map to one entry
(intended). The subtle risk: the query runs with `enabled: sessionIds.length > 0` and
a `staleTime` of 5 min, but the RPC is called with the **current** `sessionIds`
array, not the sorted one used in the key. If the FlatList paginates and the visible
set grows, the key changes (correct), but a previously-cached smaller-set entry for an
*identical sorted prefix* is never reused — minor cache churn, not a correctness bug.
More importantly, an empty-array render produces `enabled:false` and the consumer reads
`prFlags?.[id]` as `undefined` → no trophy, which is the right empty behavior.

**Fix:** Low severity. Consider keying on the sorted array elements directly
(`[...sessionPrFlagsKeys.all, "by-ids", ...sorted]`) so TanStack's structural hash owns
equality, avoiding the string-flatten entirely. Not blocking.

### WR-05: `formatYAxisLabel` ignores `formatWeightValue` and re-implements numeral formatting

**File:** `app/app/(app)/exercise/[exerciseId]/chart.tsx:337-342`

**Issue:** The y-axis tick formatter re-implements the integer-vs-`toFixed(1)` logic
(`Number.isInteger(n) ? String(n) : n.toFixed(1)`) that `formatWeightValue` in
`units.ts:48-50` already provides. The file imports `formatWeightValue` (`:101`) and
uses it for the hero numeral but not the axis. Two copies of the same numeral
convention drift over time (e.g. if `formatWeightValue` later rounds to 0.5 plate
granularity, the axis would not follow).

**Fix:** Route the weight branch through the shared helper:
```ts
const formatYAxisLabel = (n: number) =>
  metric === "volume"
    ? Math.round(n).toLocaleString("sv-SE")
    : formatWeightValue(n);
```

### WR-06: `PrBanner` sub-label string-replace is locale-fragile (silently no-ops for non-"kg" templates)

**File:** `app/components/ui/PrBanner.tsx:167-170`

**Issue:** The unit-honesty workaround interpolates the fully-formatted weight into the
`pbSub` key, then strips a trailing `" kg"` literal:
```ts
const pbSubRaw = t("pbSub", { kg: weightLabel, reps: String(reps) });
const pbSubFixed = pbSubRaw.replace(`${weightLabel} kg`, weightLabel);
```
This depends on the `pbSub` translation containing the exact substring
`"{{kg}} kg"`. If the English (or any future) locale phrases it differently
(`"{{kg}}kg"`, `"{{kg}} kilo"`, or reorders the interpolation), the `.replace`
silently matches nothing and an imperial banner renders `"220.5 lb kg × 6 reps"` —
a double/wrong unit. The fix is invisible at compile time and only shows on-device in
imperial mode. The comment claims metric is unchanged, but metric also relies on the
literal: `formatWeight(kg,"metric")` returns `"105 kg"`, so the replace target is
`"105 kg kg"` which does NOT exist in `"105 kg × 6 reps"` → the replace no-ops and the
metric string is correct only by accident of the template already reading `"105 kg"`.

**Fix:** Stop post-processing translated output. Add a dedicated key that takes the
pre-formatted weight WITHOUT a unit literal in the template, e.g.
`pbSub: "{{weight}} × {{reps}} reps"` and pass `weight: formatWeight(weightKg, unit)`.
This removes the string-surgery and is locale-proof.

## Info

### IN-01: `epley1RM` reps guard rejects fractional reps silently

**File:** `app/lib/e1rm.ts:50`

**Issue:** `if (reps <= 0) return 0` plus `Number.isFinite` guards are correct, but
reps are not floored. The form schema enforces `int()` (`schemas/sets.ts:55-57`), so a
fractional rep cannot reach here from the form — but the RPC-sourced `reps` is
`z.coerce.number().int()` in the query schemas, so this is consistent. No action; noting
that `epley1RM` itself does not assume integer reps, which is fine.

### IN-02: `get_best_working_sets` tie-break is non-deterministic across equal e1RM sets

**File:** `app/supabase/migrations/0012_phase13_pr_rpcs.sql:154-166`

**Issue:** `distinct on (es.exercise_id) ... order by es.exercise_id,
(es.weight_kg * (1 + es.reps / 30.0)) desc` picks the top set per exercise, but when
two sets share the identical max e1RM (e.g. 100×5 logged twice) there is no further
tiebreak (`completed_at`/`id`), so Postgres may return either row arbitrarily. Both
have the same weight/reps so the consumed `{weight_kg, reps}` is identical — harmless
today. Add `, es.completed_at desc, es.id desc` for reproducibility if a future column
(e.g. session_id) is ever surfaced.

### IN-03: `useExerciseSetsInRangeQuery` lacks `staleTime` — refetches on every focus

**File:** `app/lib/queries/exercise-sets-in-range.ts:36-61`

**Issue:** Unlike `useBestE1rmQuery` (15 min) and `useSessionPrFlags` (5 min), this
hook sets no `staleTime`, so it inherits the global 30s default (`client.ts:74`). The
chart hero will refetch on every screen focus after 30s. Not a correctness issue and
arguably desirable for a read-side chart, but inconsistent with the sibling PR query
slots. Confirm 30s is intended; if the chart is meant to be offline-snappy, add a
staleTime.

### IN-04: `pr-history.ts` has no `staleTime` and runs per-exercise on session-detail

**File:** `app/lib/queries/pr-history.ts:38-50`; consumed `history/[sessionId].tsx:815`

**Issue:** Same as IN-03 — `usePrHistoryQuery` inherits the 30s default. On the
session-detail screen it is called once per `ExerciseCard`, so a multi-exercise
session fires N parallel `get_exercise_pr_history` RPCs, each refetching after 30s.
Each RPC scans the full exercise history to derive `was_pr`. For V1 single-user scale
this is fine; flagging for awareness since the data (PR-at-log-time) never migrates and
could carry a much longer staleTime.

### IN-05: Misleading comment references `expo-secure-store 14` / non-existent line numbers

**File:** `app/lib/queries/best-e1rm.ts:9-13`, `:55-57`

**Issue:** Header comments cite "`last-value.ts:18-22`", "`last-value.ts:63`" as
load-bearing line anchors. Line-number references in comments rot the moment the
referenced file changes and become actively misleading. (Project-wide pattern, not new
to this phase.) Non-blocking; prefer symbolic references ("the Record-not-Map rationale
in last-value.ts") over line numbers.

---

_Reviewed: 2026-06-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
