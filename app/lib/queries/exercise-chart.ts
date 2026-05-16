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
import { subMonths, subYears } from "date-fns";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { exerciseChartKeys, exerciseTopSetsKeys } from "@/lib/query/keys";

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
