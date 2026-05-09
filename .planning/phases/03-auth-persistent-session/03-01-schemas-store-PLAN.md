---
phase: 03-auth-persistent-session
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/lib/schemas/auth.ts
  - app/lib/auth-store.ts
  - app/scripts/test-auth-schemas.ts
  - app/package.json
autonomous: true
requirements: [F1]
tags: [auth, zod, zustand, supabase, schemas, store]

must_haves:
  truths:
    - "Sign-up Zod schema rejects email='', invalid email format, password.length<12, and confirmPassword!==password"
    - "Sign-in Zod schema rejects email='' and password=''; accepts any non-empty password (D-13)"
    - "auth-store exports useAuthStore with shape { session, status, signOut } and registers exactly one module-scope onAuthStateChange listener"
    - "auth-store.signOut calls queryClient.clear() and supabase.auth.signOut() (cache flush per F1 success criterion #4)"
    - "TypeScript compiles cleanly (cd app && npx tsc --noEmit exits 0)"
  artifacts:
    - path: "app/lib/schemas/auth.ts"
      provides: "signUpSchema, signInSchema (Zod 4) + inferred SignUpInput, SignInInput types"
      contains: "z.email("
      min_lines: 20
    - path: "app/lib/auth-store.ts"
      provides: "useAuthStore Zustand store + module-scope onAuthStateChange listener"
      contains: "onAuthStateChange"
      exports: ["useAuthStore"]
      min_lines: 30
    - path: "app/scripts/test-auth-schemas.ts"
      provides: "Node-only Zod schema test (no React-Native runtime); exits 0 on pass, 1 on fail"
      contains: "signUpSchema.safeParse"
      min_lines: 30
    - path: "app/package.json"
      provides: "test:auth-schemas npm script"
      contains: "test:auth-schemas"
  key_links:
    - from: "app/lib/auth-store.ts"
      to: "app/lib/supabase.ts"
      via: "import { supabase } from '@/lib/supabase'"
      pattern: "from \"@/lib/supabase\""
    - from: "app/lib/auth-store.ts"
      to: "app/lib/query-client.ts"
      via: "import { queryClient } from '@/lib/query-client' for clear() in signOut"
      pattern: "queryClient\\.clear\\(\\)"
    - from: "app/scripts/test-auth-schemas.ts"
      to: "app/lib/schemas/auth.ts"
      via: "import { signUpSchema, signInSchema }"
      pattern: "from \"\\.\\./lib/schemas/auth\""
---

<objective>
Lay down the data + state foundation for Phase 3's vertical slice: Zod schemas, the Zustand auth-store with the module-scope Supabase listener, and a Node-only schema test that runs in <5 seconds via `tsx`.

Purpose: Downstream plans (02, 03) consume these contracts directly. Sign-in/sign-up screens import `signInSchema`/`signUpSchema` and bind them to RHF. Layouts read from `useAuthStore`. The test script gives Wave-1 automated coverage for D-12 (min 12), D-13 (sign-in min 1), D-14 (refine), and the Zod 4 idiom (`z.email()` + `error:`).

Output: Three new files (`schemas/auth.ts`, `auth-store.ts`, `scripts/test-auth-schemas.ts`) plus an `npm run test:auth-schemas` script in `app/package.json`. No UI, no route changes — pure foundation.
</objective>

<execution_context>
@C:/Users/Mahod/Desktop/Projects/FitnessMaxxing/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Mahod/Desktop/Projects/FitnessMaxxing/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/03-auth-persistent-session/03-CONTEXT.md
@.planning/phases/03-auth-persistent-session/03-RESEARCH.md
@.planning/phases/03-auth-persistent-session/03-PATTERNS.md
@CLAUDE.md
@app/lib/supabase.ts
@app/lib/query-client.ts
@app/tsconfig.json
@app/package.json

<interfaces>
<!-- Contracts this plan creates that Plans 02 + 03 will consume verbatim. -->
<!-- Executor: write these EXACTLY as specified — Plans 02/03 import them by name. -->

From `app/lib/schemas/auth.ts` (NEW):
```typescript
export const signUpSchema: z.ZodObject<...>; // see action below for exact shape
export type SignUpInput = z.infer<typeof signUpSchema>;
export const signInSchema: z.ZodObject<...>;
export type SignInInput = z.infer<typeof signInSchema>;
```

From `app/lib/auth-store.ts` (NEW):
```typescript
import type { Session } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "anonymous";
export interface AuthState {
  session: Session | null;
  status: AuthStatus;
  signOut: () => Promise<void>;
}
export const useAuthStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AuthState>>;
```

From `app/lib/supabase.ts` (EXISTING — DO NOT MODIFY):
```typescript
export const supabase: SupabaseClient<Database>;
// auth: { storage: LargeSecureStore, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
// AppState listener for startAutoRefresh/stopAutoRefresh already wired (lines 83-87)
```

From `app/lib/query-client.ts` (EXISTING — DO NOT MODIFY):
```typescript
export const queryClient: QueryClient;
// persistQueryClient wired with AsyncStorage; queryClient.clear() syncs in-memory + persisted cache
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create Zod 4 auth schemas (`app/lib/schemas/auth.ts`)</name>
  <files>app/lib/schemas/auth.ts</files>
  <read_first>
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md §B "Code Examples — `app/lib/schemas/auth.ts`" (canonical Zod 4 idiom: `z.email()`, `error:` not `message:`)
    - .planning/phases/03-auth-persistent-session/03-PATTERNS.md "`app/lib/schemas/auth.ts` (NEW — Zod 4 schemas)" section (path-alias + import-style conventions)
    - .planning/phases/03-auth-persistent-session/03-CONTEXT.md D-12, D-13, D-14, D-15 (locked decisions on validation rules + Swedish copy)
    - CLAUDE.md First-Time-User Gotchas → "react-hook-form 7 + Zod 4 + @hookform/resolvers 5" (Zod 4 idioms reminder)
    - app/lib/supabase.ts (project import-style: double quotes, named imports, side-effect imports first)
  </read_first>
  <behavior>
    - Test 1: `signUpSchema.safeParse({ email: "x@y.com", password: "twelve-chars", confirmPassword: "twelve-chars" })` → `success: true`
    - Test 2: `signUpSchema.safeParse({ email: "not-an-email", password: "twelve-chars", confirmPassword: "twelve-chars" })` → `success: false` AND error includes "Email måste vara giltigt"
    - Test 3: `signUpSchema.safeParse({ email: "x@y.com", password: "shortpw", confirmPassword: "shortpw" })` → `success: false` AND error includes "Minst 12 tecken"
    - Test 4: `signUpSchema.safeParse({ email: "x@y.com", password: "twelve-chars", confirmPassword: "different-12c" })` → `success: false` AND error path includes "confirmPassword" AND error includes "Lösen matchar inte"
    - Test 5: `signUpSchema.safeParse({ email: "x@y.com", password: "twelve-chars", confirmPassword: "" })` → `success: false` AND error path includes "confirmPassword" AND error includes "Bekräfta ditt lösen" (per researcher Q3 + Claude's Discretion)
    - Test 6: `signInSchema.safeParse({ email: "x@y.com", password: "a" })` → `success: true` (D-13: any non-empty password accepted at schema level)
    - Test 7: `signInSchema.safeParse({ email: "x@y.com", password: "" })` → `success: false` AND error includes "Lösen krävs"
    - Test 8: `signInSchema.safeParse({ email: "", password: "any" })` → `success: false` AND error includes "Email måste vara giltigt"
  </behavior>
  <action>
Create `app/lib/schemas/auth.ts` with EXACT contents below (per RESEARCH.md §B + CONTEXT.md D-12/D-13/D-14/D-15 + Q3 confirmPassword empty-error per Claude's Discretion).

Use double-quoted strings (project convention — `app/lib/supabase.ts`, `app/lib/query-client.ts` both use `"`). Use Zod 4 idioms: `z.email()` top-level (NOT `z.string().email()`), `error:` parameter (NOT `message:`).

```typescript
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
```

NOTE: The empty-string-email case yields Zod's email-format error "Email måste vara giltigt" (Test 8) because `z.email()` rejects `""` as invalid email format — no separate `.min(1)` needed. This matches UI-SPEC.md error copy ("Email måste vara giltigt") for both empty and malformed cases.

Create the parent directory `app/lib/schemas/` if it does not yet exist (the path is new in Phase 3).
  </action>
  <verify>
    <automated>cd app &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `app/lib/schemas/auth.ts`
    - File contains exactly: `import { z } from "zod";` (grep matches)
    - File contains: `z.email({ error: "Email måste vara giltigt" })` (Zod 4 top-level, NOT `z.string().email`)
    - File contains: `password: z.string().min(12, { error: "Minst 12 tecken" })`
    - File contains: `confirmPassword: z.string().min(1, { error: "Bekräfta ditt lösen" })`
    - File contains: `.refine((data) => data.password === data.confirmPassword, {`
    - File contains: `path: ["confirmPassword"]`
    - File contains: `error: "Lösen matchar inte"`
    - File contains: `password: z.string().min(1, { error: "Lösen krävs" })` (sign-in branch)
    - File exports: `signUpSchema`, `signInSchema`, `type SignUpInput`, `type SignInInput` (grep `^export` returns ≥4 lines)
    - File does NOT contain `z.string().email(` (Zod 3 deprecated form)
    - File does NOT contain ` message:` followed by a Zod error string (Zod 3 deprecated key — `error:` is correct)
    - `cd app && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    Schema file exists with exact Zod 4 idiom; both schemas export named + typed; TS compiles clean. Test script in Task 3 will exercise the runtime behavior.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create Zustand auth-store with module-scope Supabase listener (`app/lib/auth-store.ts`)</name>
  <files>app/lib/auth-store.ts</files>
  <read_first>
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md §A "Code Examples — `app/lib/auth-store.ts` — Zustand store with module-level listener (recommended)" (canonical implementation, copy verbatim with the D-06 adaptation noted below)
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md Pitfall §2 "onAuthStateChange callback deadlock (HIGH severity)"
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md Pitfall §4 "Listener inside useEffect → Strict Mode dual-mount"
    - .planning/phases/03-auth-persistent-session/03-PATTERNS.md "`app/lib/auth-store.ts`" (Module-scope singleton + side-effect pattern; Shared Patterns §1, §3, §8)
    - .planning/phases/03-auth-persistent-session/03-CONTEXT.md D-06, D-07, D-08, D-09, D-10, D-16 (locked decisions on store shape, listener registration, signOut flow)
    - app/lib/supabase.ts (lines 73-87 — module-scope side-effect pattern + supabase client export)
    - app/lib/query-client.ts (queryClient export shape)
  </read_first>
  <behavior>
    - Test 1: After importing `auth-store.ts`, `useAuthStore.getState()` returns object with keys `session: null`, `status: "loading"`, `signOut: function`
    - Test 2: `useAuthStore.getState().signOut` is an async function returning `Promise<void>`
    - Test 3: Module-scope code MUST contain exactly one `supabase.auth.onAuthStateChange(` call (grep -c expects 1)
    - Test 4: Module-scope code MUST contain exactly one `supabase.auth.getSession(` call to satisfy CONTEXT.md D-06 (locked) — this call IS redundant with `INITIAL_SESSION` per RESEARCH.md Q1, but D-06 is locked; the listener will overwrite with the same value (idempotent, harmless)
    - Test 5: The `onAuthStateChange` callback contains `useAuthStore.setState({` and does NOT contain `await ` inside the callback body (deadlock prevention per RESEARCH.md Pitfall §2)
    - Test 6: The `signOut` action body contains BOTH `queryClient.clear()` AND `supabase.auth.signOut()` (success criterion #4 + D-16)
  </behavior>
  <action>
Create `app/lib/auth-store.ts`. This file is the canonical RESEARCH.md §A example with one adaptation: D-06 is locked, so we keep the explicit `supabase.auth.getSession()` call alongside the listener. The listener auto-fires `INITIAL_SESSION` (per auth-js master line 2122) which would suffice on its own (RESEARCH.md Q1 recommendation), but D-06 is a locked decision. Per orchestrator instructions: honor D-06; document the redundancy in a comment.

Use double-quoted strings. Match the import-style of `app/lib/supabase.ts:8-14` (side-effect imports first if any, then named imports, then `import type { ... }`, then `@/`-alias imports last).

EXACT file contents:

```typescript
// app/lib/auth-store.ts
//
// Phase 3: Zustand store for { session, status, signOut }.
//
// Module-scope effects (run ONCE per JS bundle load — Strict-Mode safe via bundler import cache):
//   1. onAuthStateChange listener registered on the supabase singleton.
//   2. Explicit supabase.auth.getSession() init call (per CONTEXT.md D-06).
//
// On D-06 redundancy: RESEARCH.md Q1 notes that onAuthStateChange auto-fires
// INITIAL_SESSION (auth-js master GoTrueClient.ts L2122 _emitInitialSession),
// making the explicit getSession() call redundant. D-06 is a LOCKED decision
// in CONTEXT.md, so we honor it. Both code paths read the same LargeSecureStore
// blob and resolve to the same Session — calling setState twice with identical
// values is idempotent and harmless. If a future revision drops D-06, delete
// the bootstrap() block; the listener alone suffices.
//
// Listener callback rules (RESEARCH.md Pitfall §2 — auth-js issues #762, #2013):
//   - Callback MUST be synchronous. NO `await` inside.
//   - NO supabase.auth.* calls inside the callback (recursive lock = deadlock).
//   - Pure JS only: useAuthStore.setState({...}). All else (queryClient.clear,
//     navigation) lives in user-facing actions like signOut, NOT in the callback.

import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query-client";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthState {
  session: Session | null;
  status: AuthStatus;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  status: "loading",
  signOut: async () => {
    // Order: clear query cache FIRST, then signOut. If signOut errors mid-flow,
    // we don't leave the previous user's data visible. queryClient.clear()
    // syncs both in-memory cache AND persisted AsyncStorage cache (TanStack
    // discussion #3782 verified in RESEARCH.md).
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Network or token-already-invalid. Listener won't fire SIGNED_OUT in
      // that case; force-clear so the user lands in (auth) regardless.
      set({ session: null, status: "anonymous" });
      console.warn("[auth-store] signOut error:", error.message);
    }
    // Happy path: listener fires SIGNED_OUT → setState flips status to 'anonymous'.
  },
}));

// ---- Module-scope side-effects — run ONCE per JS bundle load ----
//
// onAuthStateChange registration. Bundler import cache + module singleton
// pattern guarantee one-time execution; Strict-Mode dual-mount cannot duplicate
// this. Callback MUST stay synchronous (see header comment + Pitfall §2).
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.setState({
    session,
    status: session ? "authenticated" : "anonymous",
  });
});

// CONTEXT.md D-06 (locked): explicit getSession() at module init. Result is
// written into the store; listener will subsequently overwrite with the same
// value when INITIAL_SESSION fires. Redundant but locked — see header comment.
void supabase.auth
  .getSession()
  .then(({ data: { session } }) => {
    useAuthStore.setState({
      session,
      status: session ? "authenticated" : "anonymous",
    });
  })
  .catch((err) => {
    // Corrupt LargeSecureStore decrypt or other IO failure (D-07): treat as
    // anonymous; listener's INITIAL_SESSION will also fire null. Splash hides.
    console.warn("[auth-store] getSession init failed:", err);
    useAuthStore.setState({ session: null, status: "anonymous" });
  });
```

The `void` keyword in front of the promise chain is intentional — it signals "fire-and-forget" to TypeScript and ESLint (`no-floating-promises`). Do NOT change to `await` (we're at module scope, not inside an async function).
  </action>
  <verify>
    <automated>cd app &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `app/lib/auth-store.ts`
    - File imports: `from "zustand"`, `from "@supabase/supabase-js"`, `from "@/lib/supabase"`, `from "@/lib/query-client"` (4 imports — verify by grep)
    - File contains: `export const useAuthStore = create<AuthState>` (typed Zustand store)
    - File contains: `export type AuthStatus = "loading" | "authenticated" | "anonymous";`
    - File contains: `export interface AuthState {` with `session: Session | null` and `status: AuthStatus` and `signOut: () => Promise<void>`
    - `grep -c "supabase.auth.onAuthStateChange(" app/lib/auth-store.ts` returns exactly `1`
    - `grep -c "supabase.auth.getSession(" app/lib/auth-store.ts` returns exactly `1` (D-06 locked)
    - The body of the `onAuthStateChange` callback (between the `(` after `onAuthStateChange` and the matching `)`) does NOT contain the string `await ` — verify by reading the callback. The string `await` MAY appear inside `signOut` (legitimate); ensure NO `await` between lines containing `onAuthStateChange((` and the next `});`
    - File contains: `useAuthStore.setState({` (at least 3 occurrences — listener, getSession-then, getSession-catch)
    - `signOut` body contains BOTH `queryClient.clear()` AND `await supabase.auth.signOut()`
    - File does NOT contain `useEffect` (listener must be module-scope, not in a hook)
    - `cd app && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    auth-store.ts exists with exact shape; module-scope listener registered once; D-06 explicit getSession() preserved with documentation comment explaining redundancy; signOut clears queryClient before calling supabase signOut; TS compiles clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Author Node-only schema test + add npm script (`app/scripts/test-auth-schemas.ts`, `app/package.json`)</name>
  <files>app/scripts/test-auth-schemas.ts, app/package.json</files>
  <read_first>
    - app/scripts/test-rls.ts (head — to mirror the tsx-script structure: shebang-less, imports, async main, exit code)
    - app/package.json (scripts section — to mirror the existing `test:rls` invocation pattern: `tsx --env-file=.env.local scripts/<file>.ts`)
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md "Validation Architecture" → "Wave 0 Gaps" (proposed `scripts/test-auth-schemas.ts` + `npm run test:auth-schemas` script)
    - .planning/phases/03-auth-persistent-session/03-CONTEXT.md D-12, D-13, D-14, D-15 (locked validation rules being tested)
    - app/lib/schemas/auth.ts (just-created Task 1 output — the test imports from here)
  </read_first>
  <behavior>
    - The script invokes signUpSchema.safeParse and signInSchema.safeParse with 8 fixture cases (mapping to Task 1 behavior list)
    - Pass cases produce `success: true`; fail cases produce `success: false` with EXPECTED error messages and paths
    - Script prints PASS/FAIL per case and exits 0 if all pass, 1 if any fail
    - `npm run test:auth-schemas` (executed from `app/` cwd) wires the script via `tsx scripts/test-auth-schemas.ts`
    - This script does NOT need `.env.local` (no Supabase calls — pure Zod) — omit `--env-file` to avoid coupling to env presence
  </behavior>
  <action>
**Step A — Create `app/scripts/test-auth-schemas.ts`** with the contents below.

This is a Node-only test (no React Native runtime, no Expo dependencies). It uses bare `console.assert`-style + a manual exit code so we don't pull in Vitest/Jest for V1. ~50 lines total.

```typescript
// app/scripts/test-auth-schemas.ts
//
// Phase 3 Wave 0: Node-only Zod schema test. Run via `npm run test:auth-schemas`.
// Verifies CONTEXT.md D-12 (sign-up password.min(12)), D-13 (sign-in password.min(1)),
// D-14 (confirmPassword refine), and the Zod 4 idiom (z.email() + error:).
//
// No Supabase calls — pure schema parse. Runs in <1 second via tsx.
import { signUpSchema, signInSchema } from "../lib/schemas/auth";

type Case = {
  name: string;
  schema: typeof signUpSchema | typeof signInSchema;
  input: unknown;
  expectSuccess: boolean;
  expectErrorIncludes?: string;
  expectErrorPath?: string[];
};

const cases: Case[] = [
  // Sign-up — happy path
  {
    name: "signUp accepts valid input",
    schema: signUpSchema,
    input: { email: "x@y.com", password: "twelve-chars", confirmPassword: "twelve-chars" },
    expectSuccess: true,
  },
  // Sign-up — invalid email
  {
    name: "signUp rejects malformed email",
    schema: signUpSchema,
    input: { email: "not-an-email", password: "twelve-chars", confirmPassword: "twelve-chars" },
    expectSuccess: false,
    expectErrorIncludes: "Email måste vara giltigt",
    expectErrorPath: ["email"],
  },
  // Sign-up — short password (D-12)
  {
    name: "signUp rejects password.length<12 (D-12)",
    schema: signUpSchema,
    input: { email: "x@y.com", password: "shortpw", confirmPassword: "shortpw" },
    expectSuccess: false,
    expectErrorIncludes: "Minst 12 tecken",
    expectErrorPath: ["password"],
  },
  // Sign-up — confirmPassword mismatch (D-14)
  {
    name: "signUp rejects confirmPassword mismatch (D-14)",
    schema: signUpSchema,
    input: { email: "x@y.com", password: "twelve-chars", confirmPassword: "different-12c" },
    expectSuccess: false,
    expectErrorIncludes: "Lösen matchar inte",
    expectErrorPath: ["confirmPassword"],
  },
  // Sign-up — empty confirmPassword (Q3 Claude's Discretion)
  {
    name: "signUp rejects empty confirmPassword",
    schema: signUpSchema,
    input: { email: "x@y.com", password: "twelve-chars", confirmPassword: "" },
    expectSuccess: false,
    expectErrorIncludes: "Bekräfta ditt lösen",
    expectErrorPath: ["confirmPassword"],
  },
  // Sign-in — accepts any non-empty password (D-13)
  {
    name: "signIn accepts password.length=1 (D-13: server is final arbiter)",
    schema: signInSchema,
    input: { email: "x@y.com", password: "a" },
    expectSuccess: true,
  },
  // Sign-in — empty password
  {
    name: "signIn rejects empty password",
    schema: signInSchema,
    input: { email: "x@y.com", password: "" },
    expectSuccess: false,
    expectErrorIncludes: "Lösen krävs",
    expectErrorPath: ["password"],
  },
  // Sign-in — invalid email
  {
    name: "signIn rejects empty email",
    schema: signInSchema,
    input: { email: "", password: "any" },
    expectSuccess: false,
    expectErrorIncludes: "Email måste vara giltigt",
    expectErrorPath: ["email"],
  },
];

let failed = 0;

for (const c of cases) {
  const result = c.schema.safeParse(c.input);
  if (c.expectSuccess) {
    if (result.success) {
      console.log(`  PASS  ${c.name}`);
    } else {
      console.error(`  FAIL  ${c.name} — expected success, got: ${JSON.stringify(result.error.issues)}`);
      failed++;
    }
    continue;
  }
  // Expect failure
  if (result.success) {
    console.error(`  FAIL  ${c.name} — expected failure, got success`);
    failed++;
    continue;
  }
  const issues = result.error.issues;
  const messages = issues.map((i) => i.message).join(" | ");
  const paths = issues.map((i) => i.path.join("."));
  if (c.expectErrorIncludes && !messages.includes(c.expectErrorIncludes)) {
    console.error(`  FAIL  ${c.name} — error did not include "${c.expectErrorIncludes}"; got: ${messages}`);
    failed++;
    continue;
  }
  if (c.expectErrorPath && !paths.some((p) => p === c.expectErrorPath!.join("."))) {
    console.error(`  FAIL  ${c.name} — error path did not include [${c.expectErrorPath.join(",")}]; got: ${paths.join(", ")}`);
    failed++;
    continue;
  }
  console.log(`  PASS  ${c.name}`);
}

if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} cases FAILED`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} schema cases passed.`);
process.exit(0);
```

**Step B — Add `test:auth-schemas` script to `app/package.json`**

Open `app/package.json` and add a new line in `"scripts"` IMMEDIATELY AFTER the existing `"test:rls"` entry. Do NOT modify any other scripts. The exact line to add:

```json
    "test:auth-schemas": "tsx scripts/test-auth-schemas.ts",
```

(Note: NO `--env-file=.env.local` — the test is pure Zod and needs no env vars. Compare to `test:rls` which DOES need `.env.local` because it talks to Supabase.)

After editing, the `"scripts"` block should contain (in order): `start`, `reset-project`, `android`, `ios`, `web`, `lint`, `gen:types`, `test:rls`, `test:auth-schemas`.
  </action>
  <verify>
    <automated>cd app &amp;&amp; npm run test:auth-schemas</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `app/scripts/test-auth-schemas.ts`
    - File imports: `from "../lib/schemas/auth"` (relative path — `tsx` does not resolve `@/*` alias by default in ad-hoc scripts)
    - File contains at least 8 case entries (grep `name:` returns ≥8 matches)
    - File contains: `process.exit(0)` AND `process.exit(1)`
    - `app/package.json` contains the line: `"test:auth-schemas": "tsx scripts/test-auth-schemas.ts"`
    - `app/package.json` is still valid JSON (`node -e "JSON.parse(require('fs').readFileSync('app/package.json','utf8'))"` exits 0)
    - `cd app && npm run test:auth-schemas` exits 0 AND prints "All 8 schema cases passed." (or similar success line)
    - `cd app && npx tsc --noEmit` exits 0 (script + new package.json are TS-compatible)
  </acceptance_criteria>
  <done>
    Schema test script exists, runs in <5 seconds, exercises all 8 cases (mapping to D-12, D-13, D-14, Zod 4 idiom). `npm run test:auth-schemas` exits 0. The test gives Wave 1 automated coverage for the schema layer; runtime UI is verified manually in Plan 04.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Zod schema (form input) | Untrusted user-typed strings cross into Supabase auth API only after schema parse — first defense |
| Module-scope listener registration | Imports of `auth-store.ts` trigger one-time side-effects; Strict-Mode safety relies on bundler import cache |
| Zustand store as session source-of-truth | All app code reads `session` from the store, not directly from `supabase.auth.getSession()` — single write path = consistent state |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-01 | Tampering | LargeSecureStore session blob (inherited from Phase 1) | mitigate | AES-256-CTR + iOS Keychain key (Phase 1 — `app/lib/supabase.ts:27-71`). Phase 3 adds NO new code touching SecureStore; auth-store reads via the existing typed supabase client only. |
| T-03-02 | DoS | onAuthStateChange callback deadlock (auth-js #762, #2013) | mitigate | Callback synchronous-only; only `useAuthStore.setState({...})` inside (pure JS). queryClient.clear() lives in `signOut` action, NOT in the listener. Verified via grep gate: no `await ` between `onAuthStateChange((` and `});`. |
| T-03-03 | Information Disclosure | TanStack Query cache leaks user A data to user B after signOut | mitigate | `queryClient.clear()` runs FIRST in `signOut`, BEFORE `supabase.auth.signOut()`. Syncs in-memory + AsyncStorage persister (TanStack discussion #3782). Success criterion #4 — verified manually in Plan 04. |
| T-03-04 | Information Disclosure | Console error logs may leak credentials/session | mitigate | Listener has no `console.*` calls. `signOut` logs only `error.message` (not session, not email, not password). `getSession` catch logs the error object (does not contain credentials — only IO failure). |
| T-03-05 | Spoofing | Schema bypass — malformed input reaches Supabase auth | mitigate | RHF + Zod 4 schemas validate at form boundary BEFORE any `supabase.auth.*` call (V5 Input Validation). Server (Supabase GoTrue) is the second-tier validator. |
| T-03-06 | Repudiation | No audit log for sign-up/sign-in events | accept | V1 personal app, no audit-logging requirement. Documented in CLAUDE.md ## Conventions → Security → Out-of-scope for V1. Supabase platform logs cover the IdP layer. |
| T-03-07 | Tampering | Strict-Mode dual-mount duplicates listener registration | mitigate | Listener registered at MODULE scope (NOT inside useEffect). Bundler import cache guarantees one-time execution; Strict Mode cannot duplicate. Verified via grep gate: `grep -c "supabase.auth.onAuthStateChange(" app/lib/auth-store.ts` returns exactly 1. |

**No HIGH-severity unmitigated threats.** Plan 01 builds the data + state layer; T-03-01..07 are all `mitigate` (or `accept` with rationale). Plans 02-03 cover the UI surface threats (T-03-08..N: phishing, generic-error policy, etc.). Phase gate `gsd-secure-phase 3` audits the full register.
</threat_model>

<verification>
- `cd app && npm run test:auth-schemas` exits 0 and reports "All 8 schema cases passed"
- `cd app && npx tsc --noEmit` exits 0
- `grep -c "onAuthStateChange(" app/lib/auth-store.ts` returns exactly `1`
- `grep -c "getSession(" app/lib/auth-store.ts` returns exactly `1` (D-06 locked)
- `grep -E "service_role|SERVICE_ROLE" app/lib/auth-store.ts app/lib/schemas/auth.ts app/scripts/test-auth-schemas.ts` returns zero matches (security audit gate per CLAUDE.md ## Conventions → Security)
- `cd app && npm run test:rls` still exits 0 (no regression in Phase 2 RLS test)
</verification>

<success_criteria>
- [ ] `app/lib/schemas/auth.ts` exists with `signUpSchema`, `signInSchema`, `SignUpInput`, `SignInInput` exports
- [ ] `app/lib/auth-store.ts` exists with `useAuthStore` export and exactly one module-scope `onAuthStateChange` registration + one `getSession()` call (D-06)
- [ ] `app/scripts/test-auth-schemas.ts` exists and runs green via `npm run test:auth-schemas`
- [ ] `app/package.json` has the new `test:auth-schemas` npm script
- [ ] TypeScript compiles clean: `cd app && npx tsc --noEmit` exits 0
- [ ] No service_role leak: `grep -E "service_role|SERVICE_ROLE"` against the three new files returns zero matches
- [ ] Phase 2 RLS regression intact: `cd app && npm run test:rls` exits 0
</success_criteria>

<output>
After completion, create `.planning/phases/03-auth-persistent-session/03-01-SUMMARY.md` documenting:
- Files created (3) + modified (1)
- Test cases covered + green run output
- D-06 redundancy decision (honored locked decision; documented in code comment)
- Cross-link to Plans 02 + 03 which consume `signUpSchema`, `signInSchema`, `useAuthStore`
</output>
