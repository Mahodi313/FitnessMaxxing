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
import type { Database } from "@/types/database";
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
  SessionRowSchema,
  type SessionRow,
} from "@/lib/schemas/sessions";
import {
  SetRowSchema,
  type SetRow,
} from "@/lib/schemas/sets";
import {
  plansKeys,
  exercisesKeys,
  planExercisesKeys,
  sessionsKeys,
  setsKeys,
  lastValueKeys,
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

// ---- Phase 5 type aliases (sessions + sets) --------------------------------
// SessionInsertVars: useStartSession(...).mutate({ id, user_id, plan_id, started_at })
// — id required, user_id required, plan_id + started_at optional (defaulted DB-side).
type SessionInsertVars = Partial<SessionRow> & {
  id: string;
  user_id: string;
  plan_id?: string | null;
  started_at?: string;
};
// SessionFinishVars: useFinishSession(...).mutate({ id, finished_at })
// — single-column UPDATE to flip finished_at from null to ISO string.
type SessionFinishVars = { id: string; finished_at: string };

// SetInsertVars: useAddSet(sessionId).mutate({ id, session_id, exercise_id, reps, weight_kg, ... })
// — id, session_id, exercise_id, reps, weight_kg required. Optional:
// set_number (Migration 0004 trigger assigns server-side — SUPERSEDES D-16),
// completed_at (defaulted DB-side), set_type (default 'working'), rpe, notes.
type SetInsertVars = Partial<SetRow> & {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number?: number;
  reps: number;
  weight_kg: number;
};
// SetUpdateVars: useUpdateSet(sessionId).mutate({ id, session_id, reps?, weight_kg?, ... })
// — id + session_id required (scope.id is built from session_id at call site).
type SetUpdateVars = { id: string; session_id: string } & Partial<
  Pick<SetRow, "reps" | "weight_kg" | "rpe" | "notes" | "set_type">
>;
// SetRemoveVars: useRemoveSet(sessionId).mutate({ id, session_id })
type SetRemoveVars = { id: string; session_id: string };

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
// Phase 5 additions (D-12 + RESEARCH §Replay-order — every mutation under a
// shared session scope replays FIFO so START lands before SETs, SETs land
// before FINISH, no FK violations on 23503):
//   ['session','start']         → scope.id = `session:${vars.id}`
//   ['session','finish']        → scope.id = `session:${vars.id}`
//   ['set','add']               → scope.id = `session:${vars.session_id}`
//   ['set','update']            → scope.id = `session:${vars.session_id}`
//   ['set','remove']            → scope.id = `session:${vars.session_id}`
//
// NOTE Pitfall 3 (function-shaped scope.id silently fails): scope.id MUST be
// a static string at useMutation() time (v5 reads mutation.options.scope?.id
// with typeof === 'string' gate). The 5 Phase 5 hooks accept their sessionId
// parameter at construction time and bake it into the useMutation scope
// option (in lib/queries/sessions.ts + lib/queries/sets.ts — Plan 02 owns
// those files).
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
    // Dual-write to LIST and DETAIL caches.
    // UAT 2026-05-10: an offline-created plan was visible in Planer (list cache
    // populated) but plan-detail showed "Laddar…" forever because
    // usePlanQuery(id) reads plansKeys.detail(id) — which was empty — and the
    // queryFn paused under networkMode: 'offlineFirst'. Mirroring the pattern
    // used by ['plan','update']/['plan-exercise','update'] keeps both caches
    // hot from millisecond zero.
    await queryClient.cancelQueries({ queryKey: plansKeys.list() });
    await queryClient.cancelQueries({ queryKey: plansKeys.detail(vars.id) });
    const previousList = queryClient.getQueryData<PlanRow[]>(plansKeys.list());
    const previousDetail = queryClient.getQueryData<PlanRow>(
      plansKeys.detail(vars.id),
    );
    queryClient.setQueryData<PlanRow[]>(plansKeys.list(), (old = []) => [
      vars as PlanRow,
      ...old,
    ]);
    queryClient.setQueryData<PlanRow>(
      plansKeys.detail(vars.id),
      vars as PlanRow,
    );
    return { previousList, previousDetail };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as
      | { previousList?: PlanRow[]; previousDetail?: PlanRow }
      | undefined;
    if (c?.previousList)
      queryClient.setQueryData(plansKeys.list(), c.previousList);
    // previousDetail is undefined for a freshly-created plan — explicitly clear
    // the optimistic detail row so the next usePlanQuery refetches from server.
    queryClient.setQueryData(plansKeys.detail(vars.id), c?.previousDetail);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({ queryKey: plansKeys.list() });
    void queryClient.invalidateQueries({
      queryKey: plansKeys.detail(vars.id),
    });
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

// ===========================================================================
// Phase 5: 5 new mutationDefaults for the active-workout hot path.
//
// Module-load-order invariant (Pitfall 1): these MUST register at module
// top-level BEFORE persister.ts hydrates paused mutations from AsyncStorage,
// otherwise a paused ['set','add'] from the previous app session would
// re-hydrate with no mutationFn and silently never replay (= lost set).
//
// scope.id contract (Phase 5 additions): the 5 hooks in lib/queries/sessions.ts
// + lib/queries/sets.ts (Plan 02) bake `scope: { id: 'session:<sessionId>' }`
// at useMutation() construction time so chained START → SETs → FINISH replay
// FIFO under a shared session scope (RESEARCH §Replay-order, T-05-11
// mitigation). The bodies below DO NOT declare scope — that lives at the
// call site per Pitfall 3 ("function-shaped scope.id silently fails").
// ===========================================================================

// ===========================================================================
// 9) ['session','start'] — workout_sessions INSERT (idempotent upsert).
// Dual-write optimistic onMutate: writes BOTH sessionsKeys.active() (so the
// persistent banner + (tabs)/index draft-resume render the new session) AND
// sessionsKeys.detail(vars.id) (so useSessionQuery on the new /workout/<id>
// route doesn't blink "Laddar…" before the server-trip completes — same
// initialData seeding lesson as ['plan','create'] from Phase 4 Plan 04-04
// commits eca0540 + b87bddf).
// ===========================================================================
queryClient.setMutationDefaults(["session", "start"], {
  mutationFn: async (vars: SessionInsertVars) => {
    const { data, error } = await supabase
      .from("workout_sessions")
      .upsert(vars, { onConflict: "id", ignoreDuplicates: true })
      .select()
      .single();
    if (error) throw error;
    return SessionRowSchema.parse(data);
  },
  onMutate: async (vars: SessionInsertVars) => {
    // Dual-write to active + detail caches (mirrors ['plan','create']).
    await queryClient.cancelQueries({ queryKey: sessionsKeys.active() });
    await queryClient.cancelQueries({ queryKey: sessionsKeys.detail(vars.id) });
    const previousActive = queryClient.getQueryData<SessionRow | null>(
      sessionsKeys.active(),
    );
    const previousDetail = queryClient.getQueryData<SessionRow>(
      sessionsKeys.detail(vars.id),
    );
    // WR-03 (05-REVIEW.md): build a complete SessionRow with explicit nulls for
    // optional fields rather than casting Partial<SessionRow>. The mutationFn
    // round-trips through SessionRowSchema.parse() on success — this keeps the
    // optimistic cache shape Zod-equivalent during the offline window so
    // consumers reading the cache during that window see the same shape they
    // see post-reconciliation.
    const optimisticRow = {
      id: vars.id,
      user_id: vars.user_id,
      plan_id: vars.plan_id ?? null,
      started_at: vars.started_at ?? new Date().toISOString(),
      finished_at: vars.finished_at ?? null,
      notes: vars.notes ?? null,
      created_at: vars.created_at ?? null,
    } satisfies SessionRow;
    queryClient.setQueryData<SessionRow | null>(
      sessionsKeys.active(),
      optimisticRow,
    );
    queryClient.setQueryData<SessionRow>(
      sessionsKeys.detail(vars.id),
      optimisticRow,
    );
    return { previousActive, previousDetail };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as
      | { previousActive?: SessionRow | null; previousDetail?: SessionRow }
      | undefined;
    if (c?.previousActive !== undefined)
      queryClient.setQueryData(sessionsKeys.active(), c.previousActive);
    // previousDetail is undefined for a freshly-started session — explicitly
    // clear the optimistic detail row so the next useSessionQuery refetches.
    queryClient.setQueryData(sessionsKeys.detail(vars.id), c?.previousDetail);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.active() });
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(vars.id) });
  },
  retry: 1,
});

// ===========================================================================
// 10) ['session','finish'] — workout_sessions UPDATE finished_at.
// Optimistic clears sessionsKeys.active() (banner disappears + draft-resume
// modal stops showing for this session). RESEARCH Open Q#2 (RESOLVED): the
// onSettled body invalidates lastValueKeys.all so a back-to-back session's
// F7 chips reflect THIS just-finished session's working sets without waiting
// for the 15-min staleTime (CONTEXT.md D-20) to expire.
// ===========================================================================
queryClient.setMutationDefaults(["session", "finish"], {
  mutationFn: async (vars: SessionFinishVars) => {
    const { id, finished_at } = vars;
    const { data, error } = await supabase
      .from("workout_sessions")
      .update({ finished_at })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return SessionRowSchema.parse(data);
  },
  onMutate: async (vars: SessionFinishVars) => {
    await queryClient.cancelQueries({ queryKey: sessionsKeys.active() });
    await queryClient.cancelQueries({ queryKey: sessionsKeys.detail(vars.id) });
    const previousActive = queryClient.getQueryData<SessionRow | null>(
      sessionsKeys.active(),
    );
    const previousDetail = queryClient.getQueryData<SessionRow>(
      sessionsKeys.detail(vars.id),
    );
    // Active cache: if the just-finished session WAS the active one, clear it
    // so the banner disappears immediately. Otherwise leave active alone.
    if (previousActive && previousActive.id === vars.id) {
      queryClient.setQueryData<SessionRow | null>(sessionsKeys.active(), null);
    }
    // Detail cache: merge finished_at into the snapshot if present.
    if (previousDetail) {
      queryClient.setQueryData<SessionRow>(sessionsKeys.detail(vars.id), {
        ...previousDetail,
        finished_at: vars.finished_at,
      });
    }
    return { previousActive, previousDetail };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as
      | { previousActive?: SessionRow | null; previousDetail?: SessionRow }
      | undefined;
    if (c?.previousActive !== undefined)
      queryClient.setQueryData(sessionsKeys.active(), c.previousActive);
    if (c?.previousDetail)
      queryClient.setQueryData(sessionsKeys.detail(vars.id), c.previousDetail);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.active() });
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(vars.id) });
    // RESEARCH Open Q#2 (RESOLVED): invalidate last-value cache so back-to-
    // back sessions' F7 chips surface this session's working sets without
    // waiting for the 15-min staleTime to expire.
    void queryClient.invalidateQueries({ queryKey: lastValueKeys.all });
  },
  retry: 1,
});

// ===========================================================================
// 11) ['set','add'] — exercise_sets INSERT (idempotent upsert).
// Optimistic append to setsKeys.list(vars.session_id) so the just-logged set
// renders instantly. Idempotent via .upsert({ onConflict: 'id',
// ignoreDuplicates: true }) — replay against an already-committed row is a
// no-op (T-05-12 mitigation).
// ===========================================================================
queryClient.setMutationDefaults(["set", "add"], {
  mutationFn: async (vars: SetInsertVars) => {
    if (!vars.session_id)
      throw new Error("session_id required for ['set','add']");
    // set_number may be omitted from vars; Migration 0004's
    // assign_set_number_before_insert trigger assigns it server-side.
    // Payload-level type made optional in SetInsertVars (sets.ts).
    //
    // Cast: types/database.ts gen:types doesn't surface trigger DEFAULTs so
    // exercise_sets.Insert still types set_number as required (number).
    // Runtime correctness is owned by Migration 0004 (trigger fills NULL→
    // value BEFORE the NOT NULL check) + Migration 0003 (UNIQUE constraint
    // is the data-integrity gate regardless of client UUID). Drop the cast
    // once Supabase gen:types learns trigger-DEFAULT surfacing.
    const upsertPayload =
      vars as Database["public"]["Tables"]["exercise_sets"]["Insert"];
    const { data, error } = await supabase
      .from("exercise_sets")
      .upsert(upsertPayload, { onConflict: "id", ignoreDuplicates: true })
      .select()
      .single();
    if (error) throw error;
    return SetRowSchema.parse(data);
  },
  // scope.id is set at call-site via mutate() options — pass `scope: { id: 'session:<sessionId>' }`.
  onMutate: async (vars: SetInsertVars) => {
    await queryClient.cancelQueries({
      queryKey: setsKeys.list(vars.session_id),
    });
    const previous = queryClient.getQueryData<SetRow[]>(
      setsKeys.list(vars.session_id),
    );
    // PROVISIONAL set_number for optimistic UI only — server-assigned value
    // reconciles via onSettled invalidate. Race is NOT a data-integrity risk
    // anymore because the persisted payload omits set_number entirely
    // (Migration 0004 trigger + Migration 0003 UNIQUE constraint own
    // correctness).
    //
    // WR-06 (05-REVIEW.md): derive from MAX(set_number)+1 across already-
    // cached rows for this (session, exercise), NOT from `length + 1`. After
    // a cold-start replay, the persister may have rehydrated optimistic rows
    // from a previous session whose provisional set_numbers are non-contiguous
    // — `length + 1` would collide with an existing provisional row and
    // briefly render "Set 3" twice in the UI before the onSettled invalidate
    // refetches the canonical list. MAX+1 correctly bumps past any rehydrated
    // value regardless of cache shape. Filter excludes other exercises so we
    // measure max within the (session, exercise) tuple the UNIQUE constraint
    // also scopes against.
    const filteredSetNumbers = (previous ?? [])
      .filter((s) => s.exercise_id === vars.exercise_id)
      .map((s) => s.set_number);
    const provisionalSetNumber =
      vars.set_number ?? Math.max(...filteredSetNumbers, 0) + 1;
    // WR-03 (05-REVIEW.md): build a complete SetRow with explicit nulls/defaults
    // for optional fields. The cache row matches SetRowSchema during the
    // offline window — same shape as the post-reconciliation row from the
    // mutationFn's SetRowSchema.parse() call.
    const optimisticRow = {
      id: vars.id,
      session_id: vars.session_id,
      exercise_id: vars.exercise_id,
      set_number: provisionalSetNumber,
      reps: vars.reps,
      weight_kg: vars.weight_kg,
      rpe: vars.rpe ?? null,
      set_type: vars.set_type ?? "working",
      completed_at: vars.completed_at ?? new Date().toISOString(),
      notes: vars.notes ?? null,
    } satisfies SetRow;
    queryClient.setQueryData<SetRow[]>(
      setsKeys.list(vars.session_id),
      (old = []) => [...old, optimisticRow],
    );
    return { previous };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as { previous?: SetRow[] } | undefined;
    if (c?.previous)
      queryClient.setQueryData(setsKeys.list(vars.session_id), c.previous);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({
      queryKey: setsKeys.list(vars.session_id),
    });
  },
  retry: 1,
});

// ===========================================================================
// 12) ['set','update'] — exercise_sets UPDATE (id + partial).
// REQUIRES vars.session_id at call-site so scope.id can compute
// `session:<sessionId>` AND so the optimistic onMutate can target the right
// list cache (T-05-11 + Pitfall 3 mitigation).
// ===========================================================================
queryClient.setMutationDefaults(["set", "update"], {
  mutationFn: async (vars: SetUpdateVars) => {
    if (!vars.session_id)
      throw new Error("session_id required for scope.id on ['set','update']");
    const { id, session_id: _sessionId, ...rest } = vars;
    void _sessionId;
    const { data, error } = await supabase
      .from("exercise_sets")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return SetRowSchema.parse(data);
  },
  // scope.id is set at call-site via mutate() options — pass `scope: { id: 'session:<sessionId>' }`.
  onMutate: async (vars: SetUpdateVars) => {
    await queryClient.cancelQueries({
      queryKey: setsKeys.list(vars.session_id),
    });
    const previous = queryClient.getQueryData<SetRow[]>(
      setsKeys.list(vars.session_id),
    );
    if (previous) {
      // WR-03 (05-REVIEW.md): {...r, ...vars} structurally produces a complete
      // SetRow (r has all keys; vars only fills a subset). `satisfies SetRow`
      // keeps TS honest without the bare `as` escape hatch.
      queryClient.setQueryData<SetRow[]>(
        setsKeys.list(vars.session_id),
        previous.map((r) =>
          r.id === vars.id ? ({ ...r, ...vars } satisfies SetRow) : r,
        ),
      );
    }
    return { previous };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as { previous?: SetRow[] } | undefined;
    if (c?.previous)
      queryClient.setQueryData(setsKeys.list(vars.session_id), c.previous);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({
      queryKey: setsKeys.list(vars.session_id),
    });
  },
  retry: 1,
});

// ===========================================================================
// 13) ['set','remove'] — exercise_sets DELETE.
// REQUIRES vars.session_id at call-site so scope.id can compute
// `session:<sessionId>` AND the optimistic onMutate can filter from the
// right list cache.
// ===========================================================================
queryClient.setMutationDefaults(["set", "remove"], {
  mutationFn: async (vars: SetRemoveVars) => {
    if (!vars.session_id)
      throw new Error("session_id required for scope.id on ['set','remove']");
    const { error } = await supabase
      .from("exercise_sets")
      .delete()
      .eq("id", vars.id);
    if (error) throw error;
    return undefined as void;
  },
  // scope.id is set at call-site via mutate() options — pass `scope: { id: 'session:<sessionId>' }`.
  onMutate: async (vars: SetRemoveVars) => {
    await queryClient.cancelQueries({
      queryKey: setsKeys.list(vars.session_id),
    });
    const previous = queryClient.getQueryData<SetRow[]>(
      setsKeys.list(vars.session_id),
    );
    queryClient.setQueryData<SetRow[]>(
      setsKeys.list(vars.session_id),
      (old = []) => old.filter((r) => r.id !== vars.id),
    );
    return { previous };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as { previous?: SetRow[] } | undefined;
    if (c?.previous)
      queryClient.setQueryData(setsKeys.list(vars.session_id), c.previous);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({
      queryKey: setsKeys.list(vars.session_id),
    });
  },
  retry: 1,
});
