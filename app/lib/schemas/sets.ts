// app/lib/schemas/sets.ts
//
// Phase 5: Zod 4 schemas for exercise_sets.
//
// SetFormSchema is the STRICT validation boundary per 05-CONTEXT.md D-15:
//   - weight_kg: min(0) max(500) multipleOf(0.25)  — PITFALLS §1.5 numeric(6,2)
//     truncation guard. weight_kg is `numeric(6,2)` so a client value like
//     82.501 truncates server-side to 82.50; multipleOf(0.25) is the
//     load-bearing guard that catches this BEFORE the mutation fires.
//   - reps:      int() min(1) max(60)              — guards typos like 0,
//     5.5, 9999.
//   - set_type:  enum default 'working'            — F17-UI deferred to V1.1;
//     V1 always logs 'working' but the schema accepts all enum values so the
//     parse boundary doesn't reject historical or future rows.
//
// Type split: setFormSchema uses z.coerce.number() on the numeric fields, so
// its INPUT type is `unknown` and OUTPUT type is `number | null`. RHF v7's
// third generic (TTransformedValues) takes the OUTPUT alias so handleSubmit
// receives the parsed shape. See Phase 4 D-11 precedent (commit f8b75b6 —
// app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx lines 62–63
// for the verbatim convention).
//
// Anti-pattern to AVOID: do NOT relax multipleOf(0.25). It is the
// load-bearing PITFALLS §1.5 guard for the F13 "never lose set fidelity"
// contract.

import { z } from "zod";

// ---- Form-input shape (per-set logging row) --------------------------------
// What the workout/[sessionId].tsx inline set-row form yields. id/session_id/
// exercise_id/set_number/completed_at are added by useAddSet at call-site
// (the hook bakes randomUUID() + the set_number count); this schema is the
// strict gate the form crosses BEFORE the mutate() fires.
export const setFormSchema = z.object({
  weight_kg: z
    .coerce.number({ error: "Vikt krävs" })
    .min(0, { error: "Vikt måste vara 0 eller högre" })
    .max(500, { error: "Vikt över 500kg verkar fel — kontrollera" })
    .multipleOf(0.25, { error: "Vikt i steg om 0.25kg" }),
  reps: z
    .coerce.number({ error: "Reps krävs" })
    .int({ error: "Reps måste vara ett heltal" })
    .min(1, { error: "Minst 1 rep" })
    .max(60, { error: "Över 60 reps verkar fel — kontrollera" }),
  set_type: z
    .enum(["working", "warmup", "dropset", "failure"])
    .default("working"),
  // F11 schema-ready (Phase 7 wires UI). rpe is numeric(3,1) in the DB.
  rpe: z.coerce.number().nullable().optional(),
  // F12 schema-ready (Phase 7 wires UI).
  notes: z
    .string()
    .max(500, { error: "Max 500 tecken" })
    .nullable()
    .optional(),
});
// Both INPUT and OUTPUT types are exported so RHF v7's 3-generic shape
// (TFieldValues, TContext, TTransformedValues) can split form-state-shape
// from handleSubmit-callback-shape. Phase 4 D-11 verbatim.
export type SetFormInput = z.input<typeof setFormSchema>;
export type SetFormOutput = z.output<typeof setFormSchema>;

// ---- DB Row shape (Supabase response boundary) -----------------------------
// Mirrors Tables<'exercise_sets'> from app/types/database.ts. Used by
// lib/queries/sets.ts queryFns to parse `data` BEFORE handing rows to React
// (Pitfall 8.13 — never cast Supabase responses, always Zod-parse).
//
// Column shape per 0001_initial_schema.sql lines 72–83:
//   id           uuid              primary key default gen_random_uuid()
//   session_id   uuid              not null references workout_sessions(id)
//   exercise_id  uuid              not null references exercises(id)
//   set_number   int               not null
//   reps         int               not null
//   weight_kg    numeric(6,2)      not null
//   rpe          numeric(3,1)      nullable (F11 schema-ready)
//   set_type     enum              not null default 'working'
//   completed_at timestamptz       default now() — nullable in generated types
//   notes        text              nullable (F12 schema-ready)
export const setRowSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  set_number: z.number().int(),
  reps: z.number().int(),
  weight_kg: z.number(),
  rpe: z.number().nullable(),
  set_type: z.enum(["working", "warmup", "dropset", "failure"]),
  completed_at: z.string().nullable(),
  notes: z.string().nullable(),
});
export type SetRow = z.infer<typeof setRowSchema>;

// Backwards-friendly aliases for downstream Plan 02 consumption (mirrors
// plans.ts lines 51–53 pattern). Both camelCase and PascalCase exports.
export const SetFormSchema = setFormSchema;
export const SetRowSchema = setRowSchema;
