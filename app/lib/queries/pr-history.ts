// app/lib/queries/pr-history.ts
//
// Phase 13 (13-03): F18 PR-celebration — chronological was_pr-per-set rows for
// the read-side session-detail trophies (D-14/D-15/PR-04). Wraps
// `get_exercise_pr_history` (migration 0012, Plan 13-02).
//
// D-14 (PR-at-log-time, chronological, never migrating): each row carries
// `was_pr` — whether THAT set was a PR at the moment it was logged, judged
// against the strictly-prior window (migration 0012). A PR flag never moves to
// a later set retroactively; the SQL window engine owns the determination, the
// client only displays it.
//
// D-08 (raw sets, JS owns the formula): the RPC returns RAW weight_kg + reps +
// the boolean was_pr flag — never a precomputed e1RM. Any displayed e1RM comes
// from `lib/e1rm.ts` on the client.
//
// Analog: exercise-chart.ts useExerciseSummaryQuery — supabase.rpc + Zod schema
// + per-tuple queryKey. Zod-parse boundary (T-13-06, PITFALLS §8.13): generated
// types are compile-time only; every row is parsed, never `as`-cast.

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { prHistoryKeys } from "@/lib/query/keys";

// PostgREST numeric → string → coerce; reps is int NOT NULL on the wire.
const PrHistoryRowSchema = z.object({
  set_id: z.string().uuid(),
  session_id: z.string().uuid(),
  completed_at: z.string(),
  weight_kg: z.coerce.number(),
  reps: z.coerce.number().int(),
  was_pr: z.boolean(),
});
export type PrHistoryRow = z.infer<typeof PrHistoryRowSchema>;

export function usePrHistoryQuery(exerciseId: string) {
  return useQuery<PrHistoryRow[]>({
    queryKey: prHistoryKeys.byExercise(exerciseId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_exercise_pr_history", {
        p_exercise_id: exerciseId,
      });
      if (error) throw error;
      return (data ?? []).map((row: unknown) => PrHistoryRowSchema.parse(row));
    },
    enabled: !!exerciseId,
  });
}
