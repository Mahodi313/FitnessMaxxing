// app/lib/schemas/auth.ts
//
// Phase 3: Zod 4 schemas for sign-up and sign-in forms.
// VERIFIED idioms (RESEARCH.md §B + Context7 zod v4 changelog):
//   - z.email() top-level (z.string().email() is deprecated in v4)
//   - `error:` parameter on issue locales (`message:` is deprecated)
//   - `.refine` with `path: ['confirmPassword']` for cross-field validation
//
// Decisions implemented:
//   - D-12: sign-up password.min(12) per ASVS V2.1.1 + NIST SP 800-63B (no complexity rule)
//   - D-13: sign-in password.min(1) — server is final arbiter; avoids locking out rotated/legacy passwords
//   - D-14: confirmPassword refine with path: ['confirmPassword']
//   - D-15: Swedish error copy, inline
//   - Researcher Q3 (Claude's Discretion): confirmPassword.min(1) for empty-state UX clarity
import { z } from "zod";

export const signUpSchema = z
  .object({
    email: z.email({ error: "Email måste vara giltigt" }),
    password: z.string().min(12, { error: "Minst 12 tecken" }),
    confirmPassword: z.string().min(1, { error: "Bekräfta ditt lösen" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Lösen matchar inte",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  // No min(12) on sign-in per CONTEXT.md D-13 — server validates final.
  email: z.email({ error: "Email måste vara giltigt" }),
  password: z.string().min(1, { error: "Lösen krävs" }),
});

export type SignInInput = z.infer<typeof signInSchema>;
