// app/lib/schemas/plan-exercises.ts
//
// Phase 4: Zod 4 schemas for plan_exercises (junction rows linking a plan to
// its exercises with order + targets).
//
// Constraints from 04-CONTEXT.md scope + 04-UI-SPEC.md error copy table:
//   - target_sets / target_reps_min / target_reps_max: int >= 0, nullable
//   - notes: 0..500 chars, nullable
//   - order_index: int — NO `.min(0)` on this schema because the two-phase
//     reorder algorithm (D-09 + RESEARCH §3) writes negative offsets mid-write.
//     Form-layer screens that take an order_index input (Plan 04 reorder) can
//     apply min(0) to the form schema separately if needed.
//   - Cross-field refine: target_reps_min <= target_reps_max when BOTH are set
//     (path: ['target_reps_min'] so the error renders under the min field).
//
// Form vs Row split mirrors plans.ts — see that file's header comment.

import { z } from "zod";

// ---- Form-input shape (per-row target editor) ------------------------------
// What the plan_exercise edit form yields. id/plan_id/exercise_id/order_index
// are added by the calling mutation hook (or already present on the row being
// edited).
export const planExerciseFormSchema = z
  .object({
    target_sets: z
      .coerce.number()
      .int()
      .min(0, { error: "Måste vara 0 eller högre" })
      .nullable()
      .optional(),
    target_reps_min: z
      .coerce.number()
      .int()
      .min(0, { error: "Måste vara 0 eller högre" })
      .nullable()
      .optional(),
    target_reps_max: z
      .coerce.number()
      .int()
      .min(0, { error: "Måste vara 0 eller högre" })
      .nullable()
      .optional(),
    notes: z
      .string()
      .max(500, { error: "Max 500 tecken" })
      .nullable()
      .optional(),
  })
  .refine(
    (d) =>
      d.target_reps_min == null ||
      d.target_reps_max == null ||
      d.target_reps_min <= d.target_reps_max,
    {
      error: "Min får inte vara större än max",
      path: ["target_reps_min"],
    },
  );
export type PlanExerciseFormInput = z.infer<typeof planExerciseFormSchema>;

// ---- DB Row shape ----------------------------------------------------------
// Mirrors Tables<'plan_exercises'>. NO `.min(0)` on order_index — the two-phase
// reorder algorithm intentionally writes negative offsets between phases.
export const planExerciseRowSchema = z.object({
  id: z.string().uuid(),
  plan_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  order_index: z.number().int(),
  target_sets: z.number().int().nullable(),
  target_reps_min: z.number().int().nullable(),
  target_reps_max: z.number().int().nullable(),
  notes: z.string().nullable(),
});
export type PlanExerciseRow = z.infer<typeof planExerciseRowSchema>;

// Aliases
export const PlanExerciseFormSchema = planExerciseFormSchema;
export const PlanExerciseRowSchema = planExerciseRowSchema;
