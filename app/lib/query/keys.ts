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
