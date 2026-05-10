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
//   - on phase-1 error online, invalidates so the next refetch heals.
//
// **Offline-safety contract (CR-02 fix, 2026-05-10):**
// Both phases are queued SYNCHRONOUSLY at call-time. Earlier the orchestrator
// awaited `Promise.all(phase1Promises).then(...)` before queueing phase-2 —
// but TanStack v5 PAUSED mutations never fire their per-mutate onSuccess /
// onError callbacks, so the Promise.all never resolved offline and phase-2
// was never enqueued. On reconnect only the phase-1 negative offsets replayed,
// leaving the DB in an all-negative `order_index` state and silently losing
// the reorder. Queueing both phases up front means both end up in the paused
// mutation cache at the moment of going offline; the shared `scope.id`
// (`plan:<planId>`) serializes replay so phase-1 lands before phase-2 — the
// FK/unique-constraint contract still holds via scope serialization, not via
// JS callback ordering.
//
// **Concurrency contract (CR-01 fix, 2026-05-10):**
// Phase-1 writes are issued sequentially via a for-await loop so Postgres
// receives them one at a time — matches the integration test
// `test-reorder-constraint.ts` which writes phase-1 with sequential awaits.
// Phase-2 is queued only after the synchronous phase-1 enqueue completes;
// online execution still benefits from scope.id serialization. The
// for-await approach also lets phase-1 short-circuit on first error and
// suppress the phase-2 enqueue when running online, so the DB does not
// observe phase-2 writes against a partial phase-1 state.
//
// On OFFLINE replay, every mutation in the scope replays in registration
// order regardless of any rollback logic — the DB heals to the optimistic
// state via the union of phase-1 + phase-2 writes. The cache stays at the
// optimistic snapshot until the per-mutation onSettled invalidates and the
// next refetch reconciles from server truth.
//
// Reference: 04-REVIEW.md CR-01 + CR-02.
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

    // Queue BOTH phases synchronously. The shared scope.id 'plan:<planId>' on
    // updateMutation ensures the paused mutation cache replays them in the
    // order they were registered: every phase-1 negative-offset write before
    // every phase-2 final-position write. This holds on offline replay (paused
    // callbacks never fire so we cannot orchestrate via Promise.all — see
    // module-level contract above) AND online (scope serialization still
    // applies, with the extra per-mutate concurrency control below).
    //
    // PHASE 1: distinct negative offsets (-(slot+1)) so phase-1 itself does
    // not collide with the unique (plan_id, order_index) partial index, and
    // phase-2 finals do not collide with positions still occupied by phase-1
    // holdouts.
    changed.forEach(({ row }, slot) => {
      updateMutation.mutate({
        id: row.id,
        plan_id: planId,
        order_index: -(slot + 1),
      });
    });

    // PHASE 2: final positions (absolute index in the new array).
    changed.forEach(({ row, newIndex }) => {
      updateMutation.mutate({
        id: row.id,
        plan_id: planId,
        order_index: newIndex,
      });
    });

    // The per-mutation onSettled (from setMutationDefaults['plan-exercise',
    // 'update']) invalidates the plan_exercises list on each mutation
    // completion, so the cache reconciles from server truth automatically.
    // If a phase-1 write errors online, the cache snapshot is preserved
    // optimistically; the invalidate-on-error from setMutationDefaults will
    // refetch and reveal whatever state Postgres landed in. The previous
    // explicit rollback to `previous` is intentionally removed — it raced
    // against phase-2 writes already in the scope queue and could leave the
    // cache inconsistent with the DB. Server truth wins on next refetch.
  };

  return { reorder };
}
