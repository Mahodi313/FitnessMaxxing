// app/lib/queries/exercise-chart.ts
//
// Phase 6: F10 per-exercise progressionsgraf — TWO hooks consuming the TWO
// RPCs deployed in Plan 06-01a migration 0006.
//
//   1. useExerciseChartQuery(exerciseId, metric, window)
//        → supabase.rpc("get_exercise_chart", { p_exercise_id, p_metric,
//          p_since }) returns per-day-aggregated chart rows (day, value).
//          metric drives the SQL CASE (max(weight_kg) vs sum(weight_kg*reps));
//          window resolves to a `since` timestamp via windowToSince().
//
//   2. useExerciseTopSetsQuery(exerciseId, window, limit = 10)
//        → supabase.rpc("get_exercise_top_sets", { p_exercise_id, p_since,
//          p_limit }) returns ONE row PER source session (session_id,
//          completed_at, weight_kg, reps). The chart route's "Senaste 10
//          passen" list consumes this; each row routes to /history/<id> and
//          renders `${weight_kg} kg × ${reps}` (D-20 + BLOCKER-2 fix —
//          chart-aggregated days cannot deliver reps preservation per source
//          session, so a dedicated RPC carries the load).
//
// RLS: both RPCs are SECURITY INVOKER (migration 0006). User B cannot see
// User A's data — cross-user gate covered by Plan 06-01a's test-rls Phase 6
// extension assertions.
//
// Zod-parse boundary: every RPC row is parsed via ChartRowSchema /
// TopSetRowSchema before being handed to the UI (PITFALLS §8.13 — generated
// types from `gen:types` are compile-time only; runtime parse is the actual
// guard).
//
// Cache key strategy: (exerciseId, metric, window) tuple for the chart key;
// (exerciseId, window) tuple for top-sets (metric-independent — D-20).
// staleTime inherits from QueryClient default (30s).
//
// Why no chart-key invalidation on `['set', 'add']`: charts are read-side
// polish, not hot-path. Plan 06-03 deliberately does NOT add invalidate-on-
// set-add to client.ts because the user would not be looking at the chart
// while mid-pass logging sets (chart route is reached from plan-detail or
// session-detail card-header, not from the active workout screen). If the
// V1 soak surfaces "I logged sets but the chart still shows yesterday's
// data" the V1.1 followup is to add invalidate-chart on `['session','finish']`
// onSettled (which already invalidates lastValueKeys.all + listInfinite).
//
// References:
//   - 06-CONTEXT.md D-14 / D-15 / D-17 / D-19 / D-20 / D-21
//   - 06-RESEARCH.md §Pattern 4 (verbatim hook shape)
//   - 06-UI-SPEC.md lines 258 + 555-574 + 599-615

import { useQuery } from "@tanstack/react-query";
import { subDays, subMonths, subYears } from "date-fns";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import {
  exerciseChartKeys,
  exerciseSummaryKeys,
  exerciseTopSetsKeys,
} from "@/lib/query/keys";

// ---------------------------------------------------------------------------
// Types + schemas
// ---------------------------------------------------------------------------

export type ChartMetric = "weight" | "volume";
export type ChartWindow = "1M" | "3M" | "6M" | "1Y" | "All";

const ChartRowSchema = z.object({
  day: z.string(),
  value: z.coerce.number(),
});
export type ChartRow = z.infer<typeof ChartRowSchema>;

// BLOCKER-2 contract: reps is `int` on the Postgres side (exercise_sets.reps
// is int NOT NULL). `.int()` enforces the wire shape at the Zod boundary so
// the UI can safely render `${weight_kg} kg × ${reps}` without a floating-
// point reps surprise.
const TopSetRowSchema = z.object({
  session_id: z.string().uuid(),
  completed_at: z.string(),
  weight_kg: z.coerce.number(),
  reps: z.coerce.number().int(),
});
export type TopSetRow = z.infer<typeof TopSetRowSchema>;

// ---------------------------------------------------------------------------
// Window helper
// ---------------------------------------------------------------------------

function windowToSince(window: ChartWindow): string | null {
  const now = new Date();
  switch (window) {
    case "1M":
      return subMonths(now, 1).toISOString();
    case "3M":
      return subMonths(now, 3).toISOString();
    case "6M":
      return subMonths(now, 6).toISOString();
    case "1Y":
      return subYears(now, 1).toISOString();
    case "All":
      return null;
  }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useExerciseChartQuery(
  exerciseId: string,
  metric: ChartMetric,
  window: ChartWindow,
) {
  return useQuery<ChartRow[]>({
    queryKey: exerciseChartKeys.byExercise(exerciseId, metric, window),
    queryFn: async () => {
      // `p_since` is typed as required `string` by the generated Database
      // types, but the SQL body in migration 0006 handles NULL via
      // `(p_since is null or es.completed_at >= p_since)`. Cast `null` at
      // the call boundary — same documented Supabase type-gen limitation
      // closed in 06-01a-SUMMARY.md Deviations §1 and 06-01b-SUMMARY.md
      // Decisions §1.
      const since = windowToSince(window);
      const { data, error } = await supabase.rpc("get_exercise_chart", {
        p_exercise_id: exerciseId,
        p_metric: metric,
        p_since: since as unknown as string,
      });
      if (error) throw error;
      return (data ?? []).map((row: unknown) => ChartRowSchema.parse(row));
    },
    enabled: !!exerciseId,
  });
}

export function useExerciseTopSetsQuery(
  exerciseId: string,
  window: ChartWindow,
  limit = 10,
) {
  return useQuery<TopSetRow[]>({
    queryKey: exerciseTopSetsKeys.byExercise(exerciseId, window),
    queryFn: async () => {
      // Same `null as unknown as string` cast as above (Supabase type-gen
      // limitation for nullable timestamptz RPC parameters).
      const since = windowToSince(window);
      const { data, error } = await supabase.rpc("get_exercise_top_sets", {
        p_exercise_id: exerciseId,
        p_since: since as unknown as string,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []).map((row: unknown) => TopSetRowSchema.parse(row));
    },
    enabled: !!exerciseId,
  });
}

// ===========================================================================
// Phase 12 (12-04) — chart-detail hero + 3-stat summary.
//
// ADDITIVE per D-24: the existing 5-state ChartWindow union + windowToSince()
// above are BYTE-UNCHANGED — the v1 chart route still types against them until
// the screen migrates. The new chart-detail screen uses the NEW 3-state
// ChartRange below ("30d" | "90d" | "All", default 90d — D-11) and the
// get_exercise_summary RPC (deployed in migration 0011) for the hero
// (current_best + range_first_value delta) and the 3-stat row (top set /
// volume-per-session / avg RPE — D-12/D-14).
// ===========================================================================

// 3-state range for the redesigned chart detail (D-11). DISTINCT from the v1
// 5-state ChartWindow; do not conflate.
export type ChartRange = "30d" | "90d" | "All";

// "All" → null (no lower bound; the RPC's `(p_since is null or ...)` guard
// returns the full history). 30d/90d → ISO timestamp via date-fns subDays.
// Exported (unlike the v1 windowToSince) so the chart-detail screen can reuse
// the same since-resolution for its x-axis range labels (12-04 acceptance).
export function rangeToSince(range: ChartRange): string | null {
  const now = new Date();
  switch (range) {
    case "30d":
      return subDays(now, 30).toISOString();
    case "90d":
      return subDays(now, 90).toISOString();
    case "All":
      return null;
  }
}

// get_exercise_summary 6-field shape (migration 0011). avg_rpe is nullable —
// RPE is optional per set, so a range with no RPE-tagged sets yields NULL.
// Every numeric field is z.coerce.number() (PostgREST numeric/bigint → string).
//
// WR-02 fix: get_exercise_summary is a single BARE `select` (no `from`), so
// Postgres ALWAYS returns exactly one row — even for an exercise with zero
// matching sets, in which case every aggregate column is NULL. The previous
// schema typed the figures as non-nullable `z.coerce.number()`, which silently
// coerced those NULLs to 0 (`Number(null) === 0`), so a no-data summary parsed
// into an all-zeros object instead of the intended empty state — the hero
// rendered "0", the 3-stat row showed "0 kg × 0", and the `summary != null`
// empty-state branch was unreachable. Marking the data-bearing figures
// `.nullable()` lets the consumer (useExerciseSummaryQuery below) detect the
// all-NULL no-data row and return `null`, so chart.tsx renders the "–"
// placeholder + hides the stat row (D-12 / D-14). `top_set_reps` also gets
// `.int()` here to match the TopSetRowSchema contract (reps is int NOT NULL on
// the wire when present). This is a client-only fix — no migration needed,
// because treating an all-null row as "no data" is purely a parse-boundary
// concern and the SQL already returns the correct (all-NULL) shape.
const ExerciseSummarySchema = z.object({
  current_best: z.coerce.number().nullable(),
  range_first_value: z.coerce.number().nullable(),
  top_set_weight_kg: z.coerce.number().nullable(),
  top_set_reps: z.coerce.number().int().nullable(),
  vol_per_session_kg: z.coerce.number().nullable(),
  avg_rpe: z.coerce.number().nullable(),
});
type ExerciseSummaryRow = z.infer<typeof ExerciseSummarySchema>;

// The consumer-facing summary type: when present, every data-bearing figure is
// non-null (the no-data row is mapped to `null` by the hook below, never to a
// partially-null object). avg_rpe stays nullable — a range can legitimately
// have sets but no RPE-tagged ones (D-14 → "–").
export type ExerciseSummary = {
  current_best: number;
  range_first_value: number;
  top_set_weight_kg: number;
  top_set_reps: number;
  vol_per_session_kg: number;
  avg_rpe: number | null;
};

export function useExerciseSummaryQuery(
  exerciseId: string,
  metric: ChartMetric,
  range: ChartRange,
) {
  return useQuery<ExerciseSummary | null>({
    queryKey: exerciseSummaryKeys.byExercise(exerciseId, metric, range),
    queryFn: async () => {
      // Same documented `null as unknown as string` cast as the v1 hooks above
      // — Supabase type-gen treats the nullable timestamptz RPC param as a
      // required string; the SQL body guards NULL via `(p_since is null or ...)`.
      const since = rangeToSince(range);
      const { data, error } = await supabase.rpc("get_exercise_summary", {
        p_exercise_id: exerciseId,
        p_metric: metric,
        p_since: since as unknown as string,
      });
      if (error) throw error;
      // WR-02: get_exercise_summary is a bare `select`, so it ALWAYS returns one
      // row — for an exercise with no sets in range that row is all-NULL. Detect
      // the no-data case via `current_best == null` (the metric's headline value;
      // it is NULL iff the `sets` CTE matched nothing) and return `null` so the
      // screen shows the "–" hero + hides the 3-stat row. A genuine summary has a
      // non-null current_best, so all data-bearing figures are present → narrow
      // to the non-null ExerciseSummary shape.
      const raw = (data ?? [])[0];
      if (!raw) return null;
      const parsed: ExerciseSummaryRow = ExerciseSummarySchema.parse(raw);
      if (
        parsed.current_best == null ||
        parsed.range_first_value == null ||
        parsed.top_set_weight_kg == null ||
        parsed.top_set_reps == null ||
        parsed.vol_per_session_kg == null
      ) {
        return null;
      }
      return {
        current_best: parsed.current_best,
        range_first_value: parsed.range_first_value,
        top_set_weight_kg: parsed.top_set_weight_kg,
        top_set_reps: parsed.top_set_reps,
        vol_per_session_kg: parsed.vol_per_session_kg,
        avg_rpe: parsed.avg_rpe,
      };
    },
    enabled: !!exerciseId,
  });
}
