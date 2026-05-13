// app/lib/schemas/sessions.ts
//
// Phase 5: Zod 4 schemas for workout_sessions.
//
// Two schema flavors per surface (mirrors plans.ts):
//   - SessionFormInput: what the RHF form yields (notes only — F12 schema-ready,
//     Phase 7 wires UI).
//   - SessionRowSchema: Zod equivalent of `Tables<'workout_sessions'>` — used at
//     the Supabase-response boundary inside lib/queries/sessions.ts to parse,
//     NOT cast, incoming JSON (Pitfall 8.13 — V5 input validation per CLAUDE.md
//     Forms phase).
//
// Zod 4 idioms (verified via app/lib/schemas/plans.ts analog):
//   - `error:` parameter on issue locales (`message:` deprecated)
//   - .nullable() at the end of optional/nullable chains
//
// Constraints from 05-CONTEXT.md scope:
//   - notes: 0..500 chars, nullable, optional (F12 schema-ready)

import { z } from "zod";

// ---- Form-input shape (Avsluta-flow + F12 schema-ready) --------------------
// What the (future, F12) Avsluta-pass form will yield. id/user_id/plan_id/
// started_at/finished_at are managed by the mutation hook. V1 does NOT wire
// any UI for notes — schema exists so Phase 7 can drop in a TextInput without
// touching this file.
export const sessionFormSchema = z.object({
  notes: z
    .string()
    .max(500, { error: "Max 500 tecken" })
    .nullable()
    .optional(),
});
export type SessionFormInput = z.infer<typeof sessionFormSchema>;

// ---- DB Row shape (Supabase response boundary) -----------------------------
// Mirrors Tables<'workout_sessions'> from app/types/database.ts. Used by
// lib/queries/sessions.ts queryFns to parse `data` BEFORE handing rows to React
// (Pitfall 8.13 — never cast Supabase responses, always Zod-parse).
//
// Column shape per 0001_initial_schema.sql lines 62–70:
//   id           uuid          primary key default gen_random_uuid()
//   user_id      uuid          not null references auth.users(id)
//   plan_id      uuid          references workout_plans(id) — nullable
//   started_at   timestamptz   not null default now()
//   finished_at  timestamptz   nullable
//   notes        text          nullable
//   created_at   timestamptz   default now() — nullable in generated types
export const sessionRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  plan_id: z.string().uuid().nullable(),
  started_at: z.string(), // ISO timestamp, not-null in schema
  finished_at: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type SessionRow = z.infer<typeof sessionRowSchema>;

// Backwards-friendly aliases for downstream Plan 02 consumption (mirrors
// plans.ts lines 51–53 pattern). Both camelCase and PascalCase exports so
// consumers can use whichever matches their local style.
export const SessionFormSchema = sessionFormSchema;
export const SessionRowSchema = sessionRowSchema;
