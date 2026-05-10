// app/lib/queries/plans.ts
//
// Phase 4: Resource hooks for workout_plans.
//
// Conventions:
//   - Pitfall 8.1: every useMutation specifies ONLY mutationKey + scope. The
//     mutationFn + onMutate/onError/onSettled live in lib/query/client.ts
//     setMutationDefaults so paused mutations re-hydrate against the same
//     logic the developer wrote (Pitfall 8.2).
//   - scope.id correction: TanStack v5's MutationScope.id is a STATIC string,
//     read at runtime via `mutation.options.scope?.id`. Per-call dynamic scope
//     is NOT supported in v5 — scope must be set at useMutation() time. To
//     get per-plan scope grouping, useCreatePlan/useUpdatePlan/useArchivePlan
//     accept a `planId` parameter and bake `scope: { id: 'plan:<planId>' }`
//     into the hook instance. The plan-list "create new plan" call site uses
//     useCreatePlan(undefined) → falls back to a generic 'plan:create' scope.
//
// Query-side: Pitfall 8.13 — every Supabase response is fed through
// PlanRowSchema.parse() (NOT cast as Database type).
//
// References:
//   - 04-CONTEXT.md (D-12 archive vs hard-delete)
//   - 04-RESEARCH.md §4, §5
//   - PITFALLS §8.1, §8.13

import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { plansKeys } from "@/lib/query/keys";
import { PlanRowSchema, type PlanRow } from "@/lib/schemas/plans";

// ---- Queries ---------------------------------------------------------------

// usePlansQuery — list non-archived plans for the current user (RLS scopes).
// Sorted by created_at desc per UI-SPEC plan-list ordering decision.
export function usePlansQuery() {
  return useQuery<PlanRow[]>({
    queryKey: plansKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_plans")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => PlanRowSchema.parse(row));
    },
  });
}

// usePlanQuery — single plan detail (Plan 03 plan-detail screen consumes).
export function usePlanQuery(id: string) {
  return useQuery<PlanRow>({
    queryKey: plansKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return PlanRowSchema.parse(data);
    },
    enabled: !!id,
  });
}

// ---- Mutations -------------------------------------------------------------
// Variables-typed wrappers. mutationFn lives in lib/query/client.ts.
// scope.id is set at useMutation() time so paused mutations group correctly
// for serial-replay; pass `planId` to bind the hook to a specific plan-scope.

type CreateVars = {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  archived_at?: string | null;
};
type UpdateVars = {
  id: string;
  name?: string;
  description?: string | null;
  archived_at?: string | null;
};
type ArchiveVars = { id: string };

// useCreatePlan accepts no planId — the new plan's id IS the scope identifier.
// The hook reads vars.id for scope grouping with chained child mutations
// (e.g. plan_exercises that reference the new plan id) by setting scope to
// the new plan's id at mutate-time. Since v5 scope is static, callers wanting
// chained-create-and-add must pass `useCreatePlan({ planId })` ahead of time.
export function useCreatePlan(opts?: { planId?: string }) {
  return useMutation<PlanRow, Error, CreateVars>({
    mutationKey: ["plan", "create"] as const,
    scope: opts?.planId ? { id: `plan:${opts.planId}` } : undefined,
  });
}

export function useUpdatePlan(planId?: string) {
  return useMutation<PlanRow, Error, UpdateVars>({
    mutationKey: ["plan", "update"] as const,
    scope: planId ? { id: `plan:${planId}` } : undefined,
  });
}

export function useArchivePlan(planId?: string) {
  return useMutation<PlanRow, Error, ArchiveVars>({
    mutationKey: ["plan", "archive"] as const,
    scope: planId ? { id: `plan:${planId}` } : undefined,
  });
}
