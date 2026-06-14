// app/lib/queries/exercise-sets-in-range.ts
//
// Phase 13 (13-03): F18 PR-celebration — RAW range working sets for the chart
// e1RM hero + range delta (D-16/PR-05). Wraps `get_exercise_sets_in_range`
// (migration 0012, Plan 13-02).
//
// D-16 (chart hero from raw sets): the chart e1RM hero numeral + the
// best-in-range − earliest-in-range delta are PURE client math over these raw
// sets — `max(epley1RM(weight_kg, reps))` via `lib/e1rm.ts`. The RPC returns
// RAW completed_at + weight_kg + reps only (D-08); it never returns an e1RM.
//
// Analog: exercise-chart.ts — supabase.rpc + Zod schema + per-tuple queryKey +
// the nullable-since cast `since as unknown as string` (PostgREST type-gen
// treats the nullable timestamptz param as a required string; the SQL body
// guards NULL). Zod-parse boundary (T-13-06, PITFALLS §8.13): every row parsed,
// never `as`-cast.

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { exerciseSetsInRangeKeys } from "@/lib/query/keys";

// PostgREST numeric → string → coerce; reps is int NOT NULL on the wire.
const SetInRangeRowSchema = z.object({
  completed_at: z.string(),
  weight_kg: z.coerce.number(),
  reps: z.coerce.number().int(),
});
export type SetInRangeRow = z.infer<typeof SetInRangeRowSchema>;

export function useExerciseSetsInRangeQuery(
  exerciseId: string,
  since: Date | null,
) {
  return useQuery<SetInRangeRow[]>({
    queryKey: exerciseSetsInRangeKeys.byExerciseSince(
      exerciseId,
      since?.toISOString() ?? null,
    ),
    queryFn: async () => {
      // `p_since` is typed as a required `string` by the generated Database
      // types, but the SQL body guards NULL via `(p_since is null or ...)`.
      // Cast `null` at the call boundary — same documented type-gen limitation
      // as exercise-chart.ts.
      const { data, error } = await supabase.rpc("get_exercise_sets_in_range", {
        p_exercise_id: exerciseId,
        p_since: since?.toISOString() as unknown as string,
      });
      if (error) throw error;
      return (data ?? []).map((row: unknown) => SetInRangeRowSchema.parse(row));
    },
    enabled: !!exerciseId,
  });
}
