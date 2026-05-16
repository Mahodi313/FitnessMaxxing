---
phase: 03-auth-persistent-session
plan: "01"
subsystem: auth
tags: [auth, zod, zustand, supabase, schemas, store, typescript]
dependency_graph:
  requires:
    - "app/lib/supabase.ts (Phase 1 — LargeSecureStore Supabase client)"
    - "app/lib/query-client.ts (Phase 1 — TanStack Query + AsyncStorage persister)"
    - "zod@^4.4.3 (installed in Phase 1)"
    - "zustand@^5.0.13 (installed in Phase 1)"
  provides:
    - "app/lib/schemas/auth.ts — signUpSchema, signInSchema, SignUpInput, SignInInput"
    - "app/lib/auth-store.ts — useAuthStore (session, status, signOut)"
    - "app/scripts/test-auth-schemas.ts — 8-case Node-only schema test"
    - "npm run test:auth-schemas — automated schema validation gate"
  affects:
    - "03-02 (sign-up screen) — imports signUpSchema + useAuthStore"
    - "03-03 (sign-in screen) — imports signInSchema + useAuthStore"
    - "03-04 (root layout) — imports useAuthStore for session routing"
tech_stack:
  added: []
  patterns:
    - "Zod 4 z.email() top-level (not z.string().email()) with error: parameter"
    - "Zustand module-scope onAuthStateChange listener (Strict-Mode safe)"
    - "D-06 redundancy: explicit getSession() + listener (both setState — idempotent)"
    - "signOut: queryClient.clear() before supabase.auth.signOut() for cache flush"
key_files:
  created:
    - "app/lib/schemas/auth.ts"
    - "app/lib/auth-store.ts"
    - "app/scripts/test-auth-schemas.ts"
  modified:
    - "app/package.json"
decisions:
  - "D-06 honored (locked): explicit supabase.auth.getSession() call preserved alongside onAuthStateChange listener — documented as redundant (INITIAL_SESSION covers it) but locked per CONTEXT.md"
  - "Q3 Claude's Discretion: confirmPassword.min(1) with error 'Bekräfta ditt lösen' for empty-state UX clarity distinct from mismatch error"
  - "Test script uses relative import from '../lib/schemas/auth' (not @/* alias) — tsx does not resolve path aliases in ad-hoc scripts without tsconfig-paths"
metrics:
  duration: "6m"
  completed: "2026-05-09T12:36:47Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 1
---

# Phase 3 Plan 01: Zod 4 Auth Schemas + Zustand Auth-Store Summary

**One-liner:** Zod 4 signUp/signIn schemas with Swedish error copy + module-scope Zustand auth-store wired to Supabase onAuthStateChange listener, all verified by an 8-case Node-only schema test.

## What Was Built

Three new files and one script update lay down the data + state foundation for Phase 3's auth vertical slice:

1. **`app/lib/schemas/auth.ts`** — Zod 4 schemas for sign-up and sign-in forms
2. **`app/lib/auth-store.ts`** — Zustand auth-store with module-scope Supabase listener
3. **`app/scripts/test-auth-schemas.ts`** — 8-case Node-only test for schema correctness
4. **`app/package.json`** — Added `test:auth-schemas` npm script

## Test Results

All 8 schema cases passed:

```
  PASS  signUp accepts valid input
  PASS  signUp rejects malformed email
  PASS  signUp rejects password.length<12 (D-12)
  PASS  signUp rejects confirmPassword mismatch (D-14)
  PASS  signUp rejects empty confirmPassword
  PASS  signIn accepts password.length=1 (D-13: server is final arbiter)
  PASS  signIn rejects empty password
  PASS  signIn rejects empty email

All 8 schema cases passed.
```

## Decisions Made

### D-06 Redundancy (Honored Locked Decision)

CONTEXT.md D-06 requires an explicit `supabase.auth.getSession()` call at module init alongside the `onAuthStateChange` listener. RESEARCH.md Q1 documents that `onAuthStateChange` auto-fires `INITIAL_SESSION` (auth-js GoTrueClient.ts L2122 `_emitInitialSession`), making D-06's getSession() call redundant.

**Decision:** Honor D-06 as a locked decision. Both code paths (`onAuthStateChange` + `getSession()`) call `useAuthStore.setState()` with the same session value — idempotent and harmless. Documented in a detailed code comment explaining the redundancy and what would need to change to remove it.

### Q3 Claude's Discretion: confirmPassword empty-state UX

Added `confirmPassword: z.string().min(1, { error: "Bekräfta ditt lösen" })` to provide a distinct "please fill in" error when confirmPassword is empty, vs the "Lösen matchar inte" mismatch error. This gives clearer UX guidance when the field is unfilled vs when passwords don't match.

### Test script uses relative import, not @/* alias

`tsx scripts/test-auth-schemas.ts` is an ad-hoc Node script; `tsx` does not resolve Expo's `@/*` path alias by default without `tsconfig-paths`. Used `"../lib/schemas/auth"` relative import per plan requirement.

## Cross-Links

Plans consuming these contracts:
- **Plan 03-02** (sign-up screen): imports `signUpSchema` from `@/lib/schemas/auth` + `useAuthStore` from `@/lib/auth-store`
- **Plan 03-03** (sign-in screen): imports `signInSchema` from `@/lib/schemas/auth` + `useAuthStore` from `@/lib/auth-store`
- **Plan 03-04** (root layout): reads `status` from `useAuthStore` for session-based routing

## Threat Model Coverage

| Threat ID | Mitigation | Verified |
|-----------|------------|---------|
| T-03-01 | LargeSecureStore AES-256 (Phase 1) | Inherited |
| T-03-02 | Synchronous-only onAuthStateChange callback | grep confirms no `await` in callback |
| T-03-03 | queryClient.clear() before signOut | Code + acceptance criteria verified |
| T-03-04 | No credential logging | Callback has no console.*; signOut logs only error.message |
| T-03-05 | Zod schema at form boundary | 8-case test confirms schema correctness |
| T-03-06 | No audit log (accepted) | V1 personal app — accepted per CLAUDE.md |
| T-03-07 | Module-scope listener (no useEffect) | grep -c onAuthStateChange = 1 |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Zod 4 auth schemas | `be2616d` | feat(03-01): create Zod 4 auth schemas |
| Task 2: Zustand auth-store | `6195ae2` | feat(03-01): create Zustand auth-store with module-scope listener |
| Task 3: Schema test + npm script | `3cda8bf` | feat(03-01): add Node-only schema test script + npm test:auth-schemas |

## Deviations from Plan

### Worktree node_modules

**Found during:** Task 1 verification
**Issue:** Git worktree at `.claude/worktrees/agent-a6e23dfe3588d3554/app/` had no `node_modules` — the worktree gets file content from git but not installed packages.
**Fix:** Ran `npm install --silent` in the worktree's `app/` directory to install packages. TypeScript compilation and test execution then worked normally.
**Classification:** [Rule 3 - Blocking Issue] — resolved automatically without architectural impact.

### Linter modified main repo file (non-blocking)

**Found during:** Task 1
**Issue:** A linter modified `C:/Users/Mahod/Desktop/Projects/FitnessMaxxing/app/lib/schemas/auth.ts` (main repo file, NOT worktree) changing `"Bekräfta ditt lösen"` to `"Bekräfta ditt lösenord"` and `"Lösen krävs"` to `"Lösenord krävs"`. These changes conflict with the plan's test case expectations.
**Fix:** Worktree file maintained the plan-specified strings `"Bekräfta ditt lösen"` and `"Lösen krävs"` which match the test script's `expectErrorIncludes` checks. The worktree is the canonical output — the main repo file will be overwritten when the orchestrator merges the worktree branch.
**Classification:** Out-of-scope (linter on main repo working directory, not worktree).

## Self-Check

### Files exist

- [x] `app/lib/schemas/auth.ts` — FOUND
- [x] `app/lib/auth-store.ts` — FOUND
- [x] `app/scripts/test-auth-schemas.ts` — FOUND
- [x] `app/package.json` contains `test:auth-schemas` — FOUND

### Commits exist

- [x] `be2616d` — FOUND
- [x] `6195ae2` — FOUND
- [x] `3cda8bf` — FOUND

### Tests pass

- [x] `npm run test:auth-schemas` exits 0 — 8/8 cases passed
- [x] `npx tsc --noEmit` exits 0

## Self-Check: PASSED
