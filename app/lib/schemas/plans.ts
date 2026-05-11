// app/lib/schemas/plans.ts
//
// Phase 4: Zod 4 schemas for workout_plans.
//
// Two schema flavors per surface:
//   - PlanFormInput (and form-input alias `plansSchema`): what the RHF form yields
//     before id/user_id/created_at are added. Used by `plans/new.tsx`.
//   - PlanRowSchema: Zod equivalent of `Tables<'workout_plans'>` — used at the
//     Supabase-response boundary inside lib/queries/plans.ts to parse, NOT cast,
//     incoming JSON (Pitfall 8.13 — V5 input validation per CLAUDE.md Forms phase).
//
// Zod 4 idioms (verified via app/lib/schemas/auth.ts analog):
//   - Top-level z.email() (z.string().email() deprecated in v4)
//   - `error:` parameter on issue locales (`message:` deprecated)
//   - .nullable() at the end of optional/nullable chains
//
// Constraints from 04-CONTEXT.md scope + 04-UI-SPEC.md error copy table.

import { z } from "zod";

// ---- Form-input shape ------------------------------------------------------
// What the create-/edit-plan RHF form yields. id/user_id/created_at/archived_at
// are added by the mutation hook before calling Supabase.
export const planFormSchema = z.object({
  name: z
    .string()
    .min(1, { error: "Namn krävs" })
    .max(80, { error: "Max 80 tecken" }),
  description: z
    .string()
    .max(500, { error: "Max 500 tecken" })
    .nullable()
    .optional(),
});
export type PlanFormInput = z.infer<typeof planFormSchema>;

// ---- DB Row shape (Supabase response boundary) -----------------------------
// Mirrors Tables<'workout_plans'> from app/types/database.ts. Used by
// lib/queries/plans.ts queryFns to parse `data` BEFORE handing rows to React
// (Pitfall 8.13 — never cast Supabase responses, always Zod-parse).
export const planRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.string().nullable(),
  archived_at: z.string().nullable(),
});
export type PlanRow = z.infer<typeof planRowSchema>;

// Backwards-friendly aliases for downstream Plan 02 consumption.
export const PlanFormSchema = planFormSchema;
export const PlanRowSchema = planRowSchema;
