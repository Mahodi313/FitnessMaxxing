// app/lib/query/keys.ts
//
// Phase 4 D-01: Query-key factories for plans, exercises, plan_exercises.
// Hierarchical keys per TanStack v5 best-practice — invalidating ['plans']
// matches every list/detail key under it.
//
// Plan 02-04 import these factories rather than re-typing array literals.
// Reference: 04-RESEARCH.md §4 (Query-key strategy).

export const plansKeys = {
  all: ["plans"] as const,
  list: () => [...plansKeys.all, "list"] as const,
  detail: (id: string) => [...plansKeys.all, "detail", id] as const,
};

export const exercisesKeys = {
  all: ["exercises"] as const,
  list: () => [...exercisesKeys.all, "list"] as const,
};

export const planExercisesKeys = {
  all: ["plan-exercises"] as const,
  list: (planId: string) => [...planExercisesKeys.all, "list", planId] as const,
};

// ---------------------------------------------------------------------------
// Phase 5 — sessions + sets + last-value factories.
//
// sessionsKeys.active() is the load-bearing key for the draft-resume cold-
// start flow (CONTEXT.md D-21) and the persistent banner (D-22). It seeds
// useSessionQuery.initialData (Phase 4 Plan 04-04 UAT pattern, commit
// eca0540) so an offline-created session renders instantly on its detail
// route.
//
// setsKeys.list(sessionId) is the per-session set list cache that the
// optimistic onMutate for ['set','add'/'update'/'remove'] writes to.
//
// lastValueKeys.byExercise(exerciseId) drives the F7 "Förra: 82.5 × 8" chip
// per active set-row. Pre-fetched on workout-screen mount per CONTEXT.md
// D-20 (15-min staleTime) so the chips have data before the user starts
// logging. RESEARCH Open Q#2 (RESOLVED): the ['session','finish'] mutation
// invalidates lastValueKeys.all on onSettled so a back-to-back session
// surfaces the just-finished session's working sets without waiting for
// the 15-min staleTime.
// ---------------------------------------------------------------------------

export const sessionsKeys = {
  all: ["sessions"] as const,
  list: () => [...sessionsKeys.all, "list"] as const,
  detail: (id: string) => [...sessionsKeys.all, "detail", id] as const,
  active: () => [...sessionsKeys.all, "active"] as const,
};

export const setsKeys = {
  all: ["sets"] as const,
  list: (sessionId: string) => [...setsKeys.all, "list", sessionId] as const,
};

export const lastValueKeys = {
  all: ["last-value"] as const,
  byExercise: (exerciseId: string) =>
    [...lastValueKeys.all, "by-exercise", exerciseId] as const,
};
