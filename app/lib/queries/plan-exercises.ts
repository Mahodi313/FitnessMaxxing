// app/lib/queries/plan-exercises.ts
//
// Phase 4: Resource hooks for plan_exercises + the load-bearing two-phase
// reorder algorithm.
//
// scope.id contract (TanStack v5 limitation): scope is static per useMutation
// instance. All hooks accept a `planId` parameter and bake
// `scope: { id: 'plan:<planId>' }` into the hook so all plan_exercise
// mutations within the same plan share a scope and replay serially on
// reconnect — preserving FK + unique-constraint ordering (RESEARCH §5).
//
// Two-phase reorder algorithm (D-09 + RESEARCH §3):
// Postgres unique (plan_id, order_index) constraint blocks the naive
// "swap two rows by writing their final positions sequentially" approach.
//   1. Snapshot cache once.
//   2. Optimistic-write the new order to cache (UI flips immediately).
//   3. PHASE 1: for every changed row, mutate to a guaranteed-unused
//      negative offset (-(slot+1)). Postgres int allows negatives;
//      no CHECK >= 0 in the schema (Open Q#1 verified by test-reorder-constraint).
//   4. PHASE 2: mutate every changed row to its final order_index.
// Both phases share the same scope.id so phase-1 ALWAYS lands before phase-2
// on offline replay.
//
// On any phase-1 error, rollback the cache to the snapshot.
//
// Reference:
//   - 04-CONTEXT.md D-08, D-09, D-10
//   - 04-RESEARCH.md §3 (unique-constraint trap), §5 (scope.id semantics)
//   - PITFALLS §8.1, §8.13

import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query/client";
import { planExercisesKeys } from "@/lib/query/keys";
import {
  PlanExerciseRowSchema,
  type PlanExerciseRow,
} from "@/lib/schemas/plan-exercises";

// ---- Queries ---------------------------------------------------------------

export function usePlanExercisesQuery(planId: string) {
  return useQuery<PlanExerciseRow[]>({
    queryKey: planExercisesKeys.list(planId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_exercises")
        .select("*")
        .eq("plan_id", planId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => PlanExerciseRowSchema.parse(row));
    },
    enabled: !!planId,
  });
}

// ---- Mutations -------------------------------------------------------------
// Variables-typed + scope-bound to the planId param.

type AddVars = {
  id: string;
  plan_id: string;
  exercise_id: string;
  order_index: number;
  target_sets?: number | null;
  target_reps_min?: number | null;
  target_reps_max?: number | null;
  notes?: string | null;
};
type UpdateVars = {
  id: string;
  plan_id: string;
  order_index?: number;
  target_sets?: number | null;
  target_reps_min?: number | null;
  target_reps_max?: number | null;
  notes?: string | null;
};
type RemoveVars = { id: string; plan_id: string };

export function useAddExerciseToPlan(planId: string) {
  return useMutation<PlanExerciseRow, Error, AddVars>({
    mutationKey: ["plan-exercise", "add"] as const,
    scope: { id: `plan:${planId}` },
  });
}

export function useUpdatePlanExercise(planId: string) {
  return useMutation<PlanExerciseRow, Error, UpdateVars>({
    mutationKey: ["plan-exercise", "update"] as const,
    scope: { id: `plan:${planId}` },
  });
}

export function useRemovePlanExercise(planId: string) {
  return useMutation<void, Error, RemoveVars>({
    mutationKey: ["plan-exercise", "remove"] as const,
    scope: { id: `plan:${planId}` },
  });
}

// ---- Two-phase reorder orchestrator ---------------------------------------
//
// Returns a single `reorder(newOrder)` function. The caller (drag-flatlist
// onDragEnd) passes the new array of plan_exercise rows in their desired
// final order. The orchestrator:
//   - snapshots the cache for rollback,
//   - optimistic-writes the new order,
//   - fires phase-1 + phase-2 update mutations under shared scope.id,
//   - rolls back on any phase-1 error.
//
// The hook instance's scope.id ('plan:<planId>') is shared across all phase-1
// and phase-2 mutate() calls because they all use the same updateMutation
// hook — that's how serial-replay grouping is achieved in v5.
export function useReorderPlanExercises(planId: string) {
  const updateMutation = useUpdatePlanExercise(planId);

  const reorder = (newOrder: PlanExerciseRow[]) => {
    const queryKey = planExercisesKeys.list(planId);
    const previous =
      queryClient.getQueryData<PlanExerciseRow[]>(queryKey) ?? [];

    // Optimistic: write the new order to cache immediately.
    const optimistic = newOrder.map((row, idx) => ({ ...row, order_index: idx }));
    queryClient.setQueryData<PlanExerciseRow[]>(queryKey, optimistic);

    // Diff: only rows whose order_index actually changed need writing.
    // newIndex is the absolute position in the full array (not within the
    // changed subset) — phase-2 writes the final value directly.
    const oldIndexById = new Map(previous.map((r, idx) => [r.id, idx]));
    const changed = optimistic
      .map((row, newIndex) => ({ row, newIndex }))
      .filter(({ row, newIndex }) => oldIndexById.get(row.id) !== newIndex);

    if (changed.length === 0) {
      return;
    }

    // PHASE 1: write distinct negative offsets (-(slot+1)) so phase-1 itself
    // doesn't collide with the unique (plan_id, order_index) constraint and
    // phase-2 finals don't collide with row positions still occupied by
    // phase-1 holdouts.
    let phase1Errored = false;
    const phase1Promises = changed.map(({ row }, slot) =>
      new Promise<void>((resolve) => {
        updateMutation.mutate(
          {
            id: row.id,
            plan_id: planId,
            order_index: -(slot + 1),
          },
          {
            onError: () => {
              phase1Errored = true;
              resolve();
            },
            onSuccess: () => resolve(),
          },
        );
      }),
    );

    // PHASE 2 fires only after phase-1 resolves. Both phases share scope.id
    // 'plan:<planId>' (set on the updateMutation hook instance) so on
    // offline-then-online replay, phase-1 entries replay before phase-2
    // entries.
    void Promise.all(phase1Promises).then(() => {
      if (phase1Errored) {
        // Roll back optimistic cache; server is in negative-offset state
        // which the next list refetch will heal via invalidateQueries
        // (handled by the update default's onSettled).
        queryClient.setQueryData<PlanExerciseRow[]>(queryKey, previous);
        console.warn(
          "[useReorderPlanExercises] Phase 1 errored, rolled back optimistic cache.",
        );
        void queryClient.invalidateQueries({ queryKey });
        return;
      }

      // PHASE 2: write final positions (absolute index in the new array).
      changed.forEach(({ row, newIndex }) => {
        updateMutation.mutate({
          id: row.id,
          plan_id: planId,
          order_index: newIndex,
        });
      });
    });
  };

  return { reorder };
}
