// app/lib/schemas/exercises.ts
//
// Phase 4: Zod 4 schemas for exercises (egna övningar — V1 has no global seed).
//
// Constraints from 04-CONTEXT.md scope + 04-UI-SPEC.md error copy table:
//   - name: 1..80 chars
//   - muscle_group / equipment: 0..40 chars (nullable)
//   - notes: 0..500 chars (nullable)
//
// Form vs Row split mirrors plans.ts — see that file's header comment for the
// rationale. ExerciseRowSchema is the Pitfall 8.13 parse boundary inside
// lib/queries/exercises.ts.

import { z } from "zod";

// ---- Muscle-group keys (Phase 10 D-01) -------------------------------------
// The exercise form's muscle-group dropdown only emits one of these 5 stable
// keys (rendered bilingually in the UI via i18n). The form schema constrains
// muscle_group to this set so a tampered form payload cannot persist an
// off-list value. The ROW schema (wire-boundary) stays LOOSE (z.string())
// because legacy free-text rows from Phase 4 predate the keyed dropdown and
// must still parse.
export const MUSCLE_GROUP_KEYS = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
] as const;
export type MuscleGroupKey = (typeof MUSCLE_GROUP_KEYS)[number];

// ---- Form-input shape ------------------------------------------------------
export const exerciseFormSchema = z.object({
  name: z
    .string()
    .min(1, { error: "Namn krävs" })
    .max(80, { error: "Max 80 tecken" }),
  muscle_group: z
    .enum(MUSCLE_GROUP_KEYS, { error: "Ogiltig muskelgrupp" })
    .nullable()
    .optional(),
  equipment: z
    .string()
    .max(40, { error: "Max 40 tecken" })
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(500, { error: "Max 500 tecken" })
    .nullable()
    .optional(),
});
export type ExerciseFormInput = z.infer<typeof exerciseFormSchema>;

// ---- DB Row shape ----------------------------------------------------------
// Mirrors Tables<'exercises'>. user_id is nullable in the schema (V2 global
// seed will leave it NULL); V1 RLS restricts SELECT to user_id IS NULL OR
// user_id = auth.uid() so the union surfaces here.
export const exerciseRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  name: z.string(),
  muscle_group: z.string().nullable(),
  equipment: z.string().nullable(),
  notes: z.string().nullable(),
  // Phase 10 D-06: nullable bilingual seed identifier (migration 0010). Stays
  // loose (string|null) on the wire — legacy/user rows are NULL; V2 global seed
  // rows carry a stable key. The form dropdown never writes this column.
  seed_key: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type ExerciseRow = z.infer<typeof exerciseRowSchema>;

// Aliases
export const ExerciseFormSchema = exerciseFormSchema;
export const ExerciseRowSchema = exerciseRowSchema;
