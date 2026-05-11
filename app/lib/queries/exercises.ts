// app/lib/queries/exercises.ts
//
// Phase 4: Resource hooks for exercises (egna övningar).
//
// V1 LIST scope (CONTEXT.md Discretion confirmed): user_id = auth.uid() only —
// no global seed (V2 only). RLS already filters on the server.
//
// scope.id contract (TanStack v5 limitation): scope is static per useMutation
// instance. useCreateExercise accepts a `planId` parameter so when called
// from the picker chain (create-exercise-then-add-to-plan flow), the same
// scope.id = `plan:<planId>` is used for both mutations and the offline
// queue replays them in FK-safe order.
//
// References: 04-CONTEXT.md D-13, 04-RESEARCH.md §5, PITFALLS §8.1.

import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { exercisesKeys } from "@/lib/query/keys";
import { ExerciseRowSchema, type ExerciseRow } from "@/lib/schemas/exercises";

// ---- Queries ---------------------------------------------------------------

export function useExercisesQuery() {
  return useQuery<ExerciseRow[]>({
    queryKey: exercisesKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ExerciseRowSchema.parse(row));
    },
  });
}

// ---- Mutations -------------------------------------------------------------

type CreateVars = {
  id: string;
  user_id: string;
  name: string;
  muscle_group?: string | null;
  equipment?: string | null;
  notes?: string | null;
};

// Pass `planId` when calling from the picker so the chained add-to-plan
// mutation shares the same scope and replays after this create on reconnect.
// Pass `undefined` when standalone (e.g. exercise library admin).
export function useCreateExercise(planId?: string) {
  return useMutation<ExerciseRow, Error, CreateVars>({
    mutationKey: ["exercise", "create"] as const,
    scope: planId ? { id: `plan:${planId}` } : undefined,
  });
}
