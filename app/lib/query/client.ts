// app/lib/query/client.ts
//
// Phase 4 D-01 + D-04 + D-07: TanStack Query v5 client + ALL setMutationDefaults
// for Phase 4 mutationKeys. This file is the load-bearing entry point of the
// offline-first plumbing.
//
// LOAD-BEARING module-load-order rules (RESEARCH.md §"Module-load order" + Pitfall 8.2):
//   1. THIS FILE must execute FIRST in app/app/_layout.tsx — before persister
//      hydrates from AsyncStorage. Reason: a paused mutation hydrated from disk
//      WITHOUT a registered setMutationDefaults entry has lost its mutationFn
//      reference and CANNOT be resumed (Pitfall 8.12).
//   2. lib/query/persister.ts runs SECOND (hydrates the cache from AsyncStorage).
//   3. lib/query/network.ts runs THIRD (wires NetInfo + AppState + the
//      onlineManager.subscribe(resumePausedMutations) block that closes Pitfall 8.12).
//
// All 8 Phase 4 mutationKeys are registered at module top-level (Pitfall 8.5 —
// NEVER inside a function or hook; defaults must be live BEFORE any
// useMutation call mounts).
//
// Mutation hook conventions (Pitfall 8.1):
//   - app/lib/queries/*.ts useMutation calls specify ONLY mutationKey.
//   - mutationFn lives HERE in setMutationDefaults — never inline in component.
//   - This guarantees that paused mutations re-hydrated after app-kill replay
//     against the same mutationFn the user originally wrote, not undefined.
//
// References:
//   - 04-CONTEXT.md D-01, D-04, D-06, D-07
//   - 04-RESEARCH.md §4 (TanStack v5 setMutationDefaults canonical pattern), §5
//   - 04-PATTERNS.md §client
//   - PITFALLS §5.1, §5.3, §8.1, §8.2, §8.5, §8.12, §8.13

import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  PlanRowSchema,
  type PlanRow,
} from "@/lib/schemas/plans";
import {
  ExerciseRowSchema,
  type ExerciseRow,
} from "@/lib/schemas/exercises";
import {
  PlanExerciseRowSchema,
  type PlanExerciseRow,
} from "@/lib/schemas/plan-exercises";
import {
  plansKeys,
  exercisesKeys,
  planExercisesKeys,
} from "@/lib/query/keys";

// ---------------------------------------------------------------------------
// QueryClient — same defaults as Phase 1 query-client.ts plus offlineFirst.
// ---------------------------------------------------------------------------

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30s staleTime per Phase 1 D-08; persister maxAge = 24h.
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 60 * 24,
      // D-07: queries serve cache without throwing when offline.
      networkMode: "offlineFirst",
    },
    mutations: {
      // D-07: mutations PAUSE when offline (instead of erroring).
      // Resumed by lib/query/network.ts onlineManager.subscribe block.
      networkMode: "offlineFirst",
      // PITFALLS §5.4: retry once for transient network failure between paused
      // and finally-committed; second failure surfaces to user as Supabase error.
      retry: 1,
    },
  },
});

// Default for queryClient (so legacy `import queryClient from ...` works too).
export default queryClient;

// ---------------------------------------------------------------------------
// Type aliases (read directly from schemas instead of types/database.ts so the
// Zod parse boundary owns the truth — Pitfall 8.13).
// ---------------------------------------------------------------------------

// Insert/Update payload shapes — these are what the mutationFn consumes.
// Optional fields stay optional; the planner expects callers to fill `id` via
// randomUUID() before invoking, but it stays optional here so update/archive
// payloads (which only have { id, ...partial }) compile.
type PlanInsertVars = Partial<PlanRow> & {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  archived_at?: string | null;
};
type PlanUpdateVars = { id: string } & Partial<
  Pick<PlanRow, "name" | "description" | "archived_at">
>;
type PlanArchiveVars = { id: string };

type ExerciseInsertVars = Partial<ExerciseRow> & {
  id: string;
  user_id: string;
  name: string;
};

type PlanExerciseAddVars = Partial<PlanExerciseRow> & {
  id: string;
  plan_id: string;
  exercise_id: string;
  order_index: number;
};
type PlanExerciseUpdateVars = { id: string; plan_id: string } & Partial<
  Pick<
    PlanExerciseRow,
    "order_index" | "target_sets" | "target_reps_min" | "target_reps_max" | "notes"
  >
>;
type PlanExerciseRemoveVars = { id: string; plan_id: string };

// ---------------------------------------------------------------------------
// Mutation defaults — register all 8 keys at MODULE TOP-LEVEL.
//
// Optimistic-update contract (every CREATE/UPDATE/REMOVE):
//   onMutate: cancelQueries → snapshot → setQueryData(optimistic) → return { previous }
//   onError:  rollback to previous snapshot
//   onSettled: invalidate the affected key
//
// Idempotency (every CREATE):
//   .upsert(values, { onConflict: 'id', ignoreDuplicates: true })
//   — replay against an already-committed row is a no-op (Pitfall 8.10).
//
// Scope chaining (parent.create + child.add):
//   shared scope.id = `plan:${planId}` ensures serial replay within the scope
//   (RESEARCH §5 + Pitfall 5.3) so create lands BEFORE child add — no FK errors.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// scope.id contract (TanStack v5 — verified via query-core mutationCache.js
// scopeFor function): scope.id is a STATIC string read at runtime via
// `mutation.options.scope?.id`. There is NO function-scope support in v5.
//
// To get per-call dynamic scope (e.g. `plan:<vars.plan_id>`), the resource
// hook in lib/queries/*.ts MUST pass `scope: { id: '...' }` through the
// mutate() options at the call-site. The defaults below DO NOT set scope —
// it is callers' responsibility. This file documents the canonical scope.id
// values each mutationKey expects:
//
//   ['plan','create']           → scope.id = `plan:${vars.id}`
//   ['plan','update']           → scope.id = `plan:${vars.id}`
//   ['plan','archive']          → scope.id = `plan:${vars.id}`
//   ['exercise','create']       → scope.id = caller's choice — typically
//                                 `plan:<planId>` when called from the picker
//                                 (chains with subsequent add-to-plan), or
//                                 `exercise:<vars.id>` when standalone.
//   ['plan-exercise','add']     → scope.id = `plan:${vars.plan_id}`
//   ['plan-exercise','update']  → scope.id = `plan:${vars.plan_id}`
//   ['plan-exercise','remove']  → scope.id = `plan:${vars.plan_id}`
//   ['plan-exercise','reorder'] → no-op default; orchestrator hook handles scope
//
// Reference: query-core mutationCache.js:118-120 — `scopeFor(mutation) =
// mutation.options.scope?.id`. A function-shaped scope.id silently fails
// the typeof === "string" check so the mutation never enters the scope map
// and serial-replay is not enforced. Plan 04-01 originally specified
// function-scope; we corrected this Rule-1 bug per CLAUDE.md scope-correction
// guidance.
// ---------------------------------------------------------------------------

// ===========================================================================
// 1) ['plan','create'] — workout_plans INSERT (idempotent upsert)
// ===========================================================================
queryClient.setMutationDefaults(["plan", "create"], {
  mutationFn: async (vars: PlanInsertVars) => {
    const { data, error } = await supabase
      .from("workout_plans")
      .upsert(vars, { onConflict: "id", ignoreDuplicates: true })
      .select()
      .single();
    if (error) throw error;
    return PlanRowSchema.parse(data);
  },
  onMutate: async (vars: PlanInsertVars) => {
    await queryClient.cancelQueries({ queryKey: plansKeys.list() });
    const previous = queryClient.getQueryData<PlanRow[]>(plansKeys.list());
    queryClient.setQueryData<PlanRow[]>(plansKeys.list(), (old = []) => [
      vars as PlanRow,
      ...old,
    ]);
    return { previous };
  },
  onError: (_err, _vars, ctx) => {
    const c = ctx as { previous?: PlanRow[] } | undefined;
    if (c?.previous) queryClient.setQueryData(plansKeys.list(), c.previous);
  },
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: plansKeys.list() });
  },
  retry: 1,
});

// ===========================================================================
// 2) ['plan','update'] — workout_plans UPDATE (id + partial)
// ===========================================================================
queryClient.setMutationDefaults(["plan", "update"], {
  mutationFn: async (vars: PlanUpdateVars) => {
    const { id, ...rest } = vars;
    const { data, error } = await supabase
      .from("workout_plans")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return PlanRowSchema.parse(data);
  },
  // scope.id is set at call-site via mutate() options — see scope.id contract above.
  onMutate: async (vars: PlanUpdateVars) => {
    await queryClient.cancelQueries({ queryKey: plansKeys.detail(vars.id) });
    await queryClient.cancelQueries({ queryKey: plansKeys.list() });
    const previousDetail = queryClient.getQueryData<PlanRow>(plansKeys.detail(vars.id));
    const previousList = queryClient.getQueryData<PlanRow[]>(plansKeys.list());
    if (previousDetail) {
      queryClient.setQueryData<PlanRow>(plansKeys.detail(vars.id), {
        ...previousDetail,
        ...vars,
      } as PlanRow);
    }
    if (previousList) {
      queryClient.setQueryData<PlanRow[]>(
        plansKeys.list(),
        previousList.map((r) => (r.id === vars.id ? ({ ...r, ...vars } as PlanRow) : r)),
      );
    }
    return { previousDetail, previousList };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as
      | { previousDetail?: PlanRow; previousList?: PlanRow[] }
      | undefined;
    if (c?.previousDetail)
      queryClient.setQueryData(plansKeys.detail(vars.id), c.previousDetail);
    if (c?.previousList) queryClient.setQueryData(plansKeys.list(), c.previousList);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({ queryKey: plansKeys.detail(vars.id) });
    void queryClient.invalidateQueries({ queryKey: plansKeys.list() });
  },
  retry: 1,
});

// ===========================================================================
// 3) ['plan','archive'] — soft-delete (UPDATE archived_at = now())
// ===========================================================================
queryClient.setMutationDefaults(["plan", "archive"], {
  mutationFn: async (vars: PlanArchiveVars) => {
    const { data, error } = await supabase
      .from("workout_plans")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", vars.id)
      .select()
      .single();
    if (error) throw error;
    return PlanRowSchema.parse(data);
  },
  // scope.id is set at call-site via mutate() options — see scope.id contract above.
  onMutate: async (vars: PlanArchiveVars) => {
    await queryClient.cancelQueries({ queryKey: plansKeys.list() });
    const previous = queryClient.getQueryData<PlanRow[]>(plansKeys.list());
    queryClient.setQueryData<PlanRow[]>(plansKeys.list(), (old = []) =>
      old.filter((r) => r.id !== vars.id),
    );
    return { previous };
  },
  onError: (_err, _vars, ctx) => {
    const c = ctx as { previous?: PlanRow[] } | undefined;
    if (c?.previous) queryClient.setQueryData(plansKeys.list(), c.previous);
  },
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: plansKeys.list() });
  },
  retry: 1,
});

// ===========================================================================
// 4) ['exercise','create'] — exercises INSERT (idempotent upsert)
// scope.id reads meta._scopeOverride first (so the picker can chain a create
// + plan_exercise add under shared `plan:<id>` scope) — fallback to a unique
// per-exercise scope when called standalone.
// ===========================================================================
queryClient.setMutationDefaults(["exercise", "create"], {
  mutationFn: async (vars: ExerciseInsertVars) => {
    const { data, error } = await supabase
      .from("exercises")
      .upsert(vars, { onConflict: "id", ignoreDuplicates: true })
      .select()
      .single();
    if (error) throw error;
    return ExerciseRowSchema.parse(data);
  },
  // scope.id is set at call-site via mutate() options — when triggered from the
  // picker chain pass `scope: { id: 'plan:<planId>' }` so the chained
  // ['plan-exercise','add'] mutation replays AFTER the exercise insert. When
  // standalone, pass `scope: { id: 'exercise:<vars.id>' }`.
  onMutate: async (vars: ExerciseInsertVars) => {
    await queryClient.cancelQueries({ queryKey: exercisesKeys.list() });
    const previous = queryClient.getQueryData<ExerciseRow[]>(exercisesKeys.list());
    queryClient.setQueryData<ExerciseRow[]>(exercisesKeys.list(), (old = []) => [
      vars as ExerciseRow,
      ...old,
    ]);
    return { previous };
  },
  onError: (_err, _vars, ctx) => {
    const c = ctx as { previous?: ExerciseRow[] } | undefined;
    if (c?.previous) queryClient.setQueryData(exercisesKeys.list(), c.previous);
  },
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: exercisesKeys.list() });
  },
  retry: 1,
});

// ===========================================================================
// 5) ['plan-exercise','add'] — plan_exercises INSERT (idempotent upsert)
// scope.id = `plan:${vars.plan_id}` so chained mutations within the same plan
// replay serially (RESEARCH §5 — preserves FK + unique-constraint ordering).
// ===========================================================================
queryClient.setMutationDefaults(["plan-exercise", "add"], {
  mutationFn: async (vars: PlanExerciseAddVars) => {
    if (!vars.plan_id) throw new Error("plan_id required for ['plan-exercise','add']");
    const { data, error } = await supabase
      .from("plan_exercises")
      .upsert(vars, { onConflict: "id", ignoreDuplicates: true })
      .select()
      .single();
    if (error) throw error;
    return PlanExerciseRowSchema.parse(data);
  },
  // scope.id is set at call-site via mutate() options — pass `scope: { id: 'plan:<planId>' }`.
  onMutate: async (vars: PlanExerciseAddVars) => {
    await queryClient.cancelQueries({
      queryKey: planExercisesKeys.list(vars.plan_id),
    });
    const previous = queryClient.getQueryData<PlanExerciseRow[]>(
      planExercisesKeys.list(vars.plan_id),
    );
    queryClient.setQueryData<PlanExerciseRow[]>(
      planExercisesKeys.list(vars.plan_id),
      (old = []) => [...old, vars as PlanExerciseRow],
    );
    return { previous };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as { previous?: PlanExerciseRow[] } | undefined;
    if (c?.previous)
      queryClient.setQueryData(planExercisesKeys.list(vars.plan_id), c.previous);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({
      queryKey: planExercisesKeys.list(vars.plan_id),
    });
  },
  retry: 1,
});

// ===========================================================================
// 6) ['plan-exercise','update'] — plan_exercises UPDATE (id + partial)
// REQUIRES vars.plan_id at call-site so scope.id can compute `plan:<planId>`.
// ===========================================================================
queryClient.setMutationDefaults(["plan-exercise", "update"], {
  mutationFn: async (vars: PlanExerciseUpdateVars) => {
    if (!vars.plan_id)
      throw new Error("plan_id required for scope.id on ['plan-exercise','update']");
    const { id, plan_id: _planId, ...rest } = vars;
    void _planId;
    const { data, error } = await supabase
      .from("plan_exercises")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return PlanExerciseRowSchema.parse(data);
  },
  // scope.id is set at call-site via mutate() options — pass `scope: { id: 'plan:<planId>' }`.
  onMutate: async (vars: PlanExerciseUpdateVars) => {
    await queryClient.cancelQueries({
      queryKey: planExercisesKeys.list(vars.plan_id),
    });
    const previous = queryClient.getQueryData<PlanExerciseRow[]>(
      planExercisesKeys.list(vars.plan_id),
    );
    if (previous) {
      queryClient.setQueryData<PlanExerciseRow[]>(
        planExercisesKeys.list(vars.plan_id),
        previous.map((r) =>
          r.id === vars.id ? ({ ...r, ...vars } as PlanExerciseRow) : r,
        ),
      );
    }
    return { previous };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as { previous?: PlanExerciseRow[] } | undefined;
    if (c?.previous)
      queryClient.setQueryData(planExercisesKeys.list(vars.plan_id), c.previous);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({
      queryKey: planExercisesKeys.list(vars.plan_id),
    });
  },
  retry: 1,
});

// ===========================================================================
// 7) ['plan-exercise','remove'] — plan_exercises DELETE
// ===========================================================================
queryClient.setMutationDefaults(["plan-exercise", "remove"], {
  mutationFn: async (vars: PlanExerciseRemoveVars) => {
    if (!vars.plan_id)
      throw new Error("plan_id required for scope.id on ['plan-exercise','remove']");
    const { error } = await supabase
      .from("plan_exercises")
      .delete()
      .eq("id", vars.id);
    if (error) throw error;
    return undefined as void;
  },
  // scope.id is set at call-site via mutate() options — pass `scope: { id: 'plan:<planId>' }`.
  onMutate: async (vars: PlanExerciseRemoveVars) => {
    await queryClient.cancelQueries({
      queryKey: planExercisesKeys.list(vars.plan_id),
    });
    const previous = queryClient.getQueryData<PlanExerciseRow[]>(
      planExercisesKeys.list(vars.plan_id),
    );
    queryClient.setQueryData<PlanExerciseRow[]>(
      planExercisesKeys.list(vars.plan_id),
      (old = []) => old.filter((r) => r.id !== vars.id),
    );
    return { previous };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as { previous?: PlanExerciseRow[] } | undefined;
    if (c?.previous)
      queryClient.setQueryData(planExercisesKeys.list(vars.plan_id), c.previous);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({
      queryKey: planExercisesKeys.list(vars.plan_id),
    });
  },
  retry: 1,
});

// ===========================================================================
// 8) ['plan-exercise','reorder'] — orchestrator-only key, registered as a
// no-op default so any stray uses do not crash. The actual reorder logic lives
// in lib/queries/plan-exercises.ts useReorderPlanExercises which orchestrates
// N × ['plan-exercise','update'] mutations under a shared scope.id.
// ===========================================================================
queryClient.setMutationDefaults(["plan-exercise", "reorder"], {
  mutationFn: async () => {
    // Intentional no-op: reorder is composed of N child ['plan-exercise','update']
    // mutations orchestrated by useReorderPlanExercises. This default exists
    // only so a stray useMutation({ mutationKey: ['plan-exercise','reorder'] })
    // wouldn't crash with "no mutationFn" if hydrated from disk.
    return undefined as void;
  },
  retry: 0,
});
