// app/lib/queries/sets.ts
//
// Phase 5: Resource hooks for exercise_sets.
//
// Same conventions as sessions.ts. scope.id is bound to the parent session
// for FIFO replay (Pitfall 5.3 + RESEARCH §Replay-order — 25 paused
// set-mutations replay in registration order under a shared scope, AFTER
// the parent ['session','start'] lands, BEFORE the trailing
// ['session','finish']).
//
// Pitfall 8.1 — every useMutation specifies ONLY mutationKey + scope.
// mutationFn + onMutate/onError/onSettled live in lib/query/client.ts
// setMutationDefaults (Plan 01).
//
// Pitfall 8.13 — every Supabase response is parsed via SetRowSchema.parse(),
// never cast as Database type.
//
// References:
//   - 05-CONTEXT.md D-12, D-13, D-14, D-16
//   - PITFALLS §8.1, §8.13, §3, §5.3

import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { setsKeys } from "@/lib/query/keys";
import { SetRowSchema, type SetRow } from "@/lib/schemas/sets";

// ---- Mutation variable shapes ----------------------------------------------

type SetInsertVars = {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  completed_at?: string;
  set_type?: "working" | "warmup" | "dropset" | "failure";
  rpe?: number | null;
  notes?: string | null;
};
type SetUpdateVars = {
  id: string;
  session_id: string;
} & Partial<Pick<SetRow, "reps" | "weight_kg" | "rpe" | "notes" | "set_type">>;
type SetRemoveVars = { id: string; session_id: string };

// ---- Queries ---------------------------------------------------------------

// useSetsForSessionQuery — list all exercise_sets for a given session.
// Ordered (exercise_id asc, set_number asc) so the in-memory groupings the
// workout screen builds keep set-position order without re-sorting.
//
// RLS scopes via `Users can manage own sets` using clause; queryFn does not
// accept user_id as a parameter (server owns scoping — T-05-03).
export function useSetsForSessionQuery(sessionId: string) {
  return useQuery<SetRow[]>({
    queryKey: setsKeys.list(sessionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_sets")
        .select("*")
        .eq("session_id", sessionId)
        .order("exercise_id", { ascending: true })
        .order("set_number", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => SetRowSchema.parse(row));
    },
    enabled: !!sessionId,
  });
}

// ---- Mutations -------------------------------------------------------------
// All three hooks accept `sessionId` and bake scope: { id: `session:${sessionId}` }
// into the useMutation instance so the per-session FIFO replay contract holds.

export function useAddSet(sessionId: string) {
  return useMutation<SetRow, Error, SetInsertVars>({
    mutationKey: ["set", "add"] as const,
    scope: { id: `session:${sessionId}` },
  });
}

export function useUpdateSet(sessionId: string) {
  return useMutation<SetRow, Error, SetUpdateVars>({
    mutationKey: ["set", "update"] as const,
    scope: { id: `session:${sessionId}` },
  });
}

export function useRemoveSet(sessionId: string) {
  return useMutation<void, Error, SetRemoveVars>({
    mutationKey: ["set", "remove"] as const,
    scope: { id: `session:${sessionId}` },
  });
}
