---
phase: 3
slug: auth-persistent-session
status: planner-finalized
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-09
finalized: 2026-05-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `.planning/phases/03-auth-persistent-session/03-RESEARCH.md` § Validation Architecture.
> Finalized after PLAN.md files created (03-01 through 03-04).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — Plan 01 introduces a Node-only schema test (`tsx scripts/test-auth-schemas.ts`) instead of Vitest/Jest. Consistent with Phase 1+2 (no test framework in V1). |
| **Config file** | None |
| **Quick run command** | `cd app && npm run test:auth-schemas` (schema unit tests, ~1 second runtime) |
| **Full suite command** | `cd app && npx tsc --noEmit && npm run test:auth-schemas && npm run test:rls && npx expo-doctor && npm run lint` (TS + schema + RLS + Doctor + lint) |
| **Estimated runtime** | ~30 seconds full suite; ~1 second schema-only |
| **Manual iOS smoke** | `cd app && npm run start` then scan QR in Expo Go on physical iPhone (Plan 04) |

---

## Sampling Rate

- **After every task commit:** `cd app && npx tsc --noEmit` (TypeScript clean)
- **After every plan wave:** Above + `cd app && npm run test:auth-schemas` (Wave 1+) + `cd app && npm run test:rls` (Phase 2 regression)
- **Before `/gsd-verify-work 3`:** Full suite green AND manual iPhone checklist signed off in `03-VERIFICATION.md` (success criterion #3 — kill-and-reopen — has no automated counterpart in V1; Plan 04 is the manual gate)
- **Max feedback latency:** ≤ 30 seconds (auto) + ≤ 5 minutes (manual iPhone session)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-T1 | 03-01 | 1 | F1 | T-03-05 | `signUpSchema` enforces D-12 (`password.min(12)`) and D-14 (`refine` matches confirmPassword) and Zod 4 idiom (`z.email()`) | unit | `cd app && npm run test:auth-schemas` | ✅ (script created in 03-01-T3) | ⬜ pending |
| 03-01-T2 | 03-01 | 1 | F1 | T-03-01, T-03-02, T-03-07 | `auth-store.ts` registers exactly one module-scope `onAuthStateChange` listener (Strict-Mode safe); `signOut` action calls `queryClient.clear()` BEFORE `supabase.auth.signOut()` (T-03-03 mitigation); listener callback contains no `await` (T-03-02 deadlock prevention) | grep + tsc | `grep -c "supabase.auth.onAuthStateChange(" app/lib/auth-store.ts` returns `1` AND `cd app && npx tsc --noEmit` exits 0 | ✅ | ⬜ pending |
| 03-01-T3 | 03-01 | 1 | F1 | T-03-05 | Schema test exercises 8 cases: D-12 min(12), D-13 min(1), D-14 refine, Q3 empty-confirmPassword, Zod 4 idiom; exits 0 on pass | unit | `cd app && npm run test:auth-schemas` | ✅ | ⬜ pending |
| 03-02-T1 | 03-02 | 2 | F1 (SC#5) | T-03-08, T-03-13 | Root layout: `SplashScreen.preventAutoHideAsync()` at module scope (Pitfall §3); `RootNavigator` returns `null` while `status === "loading"` (Pitfall §5); `Stack.Protected guard={!!session}` for (app); `Stack.Protected guard={!session}` for (auth) | grep + tsc | `grep -c "Stack.Protected" app/app/_layout.tsx` returns `2` AND `grep -c "preventAutoHideAsync" app/app/_layout.tsx` returns `1` AND `cd app && npx tsc --noEmit` exits 0 | ✅ | ⬜ pending |
| 03-02-T2 | 03-02 | 2 | F1 | (none — pure structural) | (auth) group layout renders bare `<Stack screenOptions={{ headerShown: false }} />` (CLAUDE.md ## Conventions) | grep + tsc | `grep -q "headerShown: false" app/app/(auth)/_layout.tsx` AND `cd app && npx tsc --noEmit` exits 0 | ✅ | ⬜ pending |
| 03-02-T3 | 03-02 | 2 | F1 (SC#2) | T-03-09, T-03-10, T-03-11 | Sign-in screen: `zodResolver(signInSchema)` + `mode: "onBlur"`; `supabase.auth.signInWithPassword`; ASVS V2.1.4 generic error mapping (`invalid_credentials` → "Fel email eller lösen" under password); rate-limit banner; no `placeholder:text-gray` (Pitfall §7) | grep + tsc | `grep -c "signInWithPassword" app/app/(auth)/sign-in.tsx` returns `1` AND `! grep -q "placeholder:text-gray" app/app/(auth)/sign-in.tsx` AND `cd app && npx tsc --noEmit` exits 0 | ✅ | ⬜ pending |
| 03-03-T1 | 03-03 | 3 | F1 (SC#1, SC#2) | T-03-14, T-03-15, T-03-17 | Sign-up screen: 3-field form (email + password + confirmPassword); 7-case error mapping (`user_already_exists`, `email_exists`, `weak_password`, `over_request_rate_limit`, `over_email_send_rate_limit`, `signup_disabled`, `validation_failed`); Pitfall §6 documented near `signUp` call; helper text "Minst 12 tecken" branch | grep + tsc | `grep -c "<Controller" app/app/(auth)/sign-up.tsx` returns `3` AND `grep -c "case \"" app/app/(auth)/sign-up.tsx` returns `7` AND `cd app && npx tsc --noEmit` exits 0 | ✅ | ⬜ pending |
| 03-03-T2 | 03-03 | 3 | F1 (SC#5) | T-03-18 | (app) group layout: `<Redirect href="/(auth)/sign-in" />` when `session === null`; defense-in-depth per success criterion #5; narrow selector `useAuthStore((s) => s.session)` per D-10 | grep + tsc | `grep -q "Redirect" app/app/(app)/_layout.tsx` AND `grep -q "useAuthStore((s) => s.session)" app/app/(app)/_layout.tsx` AND `cd app && npx tsc --noEmit` exits 0 | ✅ | ⬜ pending |
| 03-03-T3 | 03-03 | 3 | F1 (SC#4) | T-03-16, T-03-20 | (app)/index.tsx: narrow selectors for `email` + `signOut`; sign-out via store action (NO imperative `router.replace` per D-16); `Logga ut` Swedish copy; only `email` rendered (no other PII per T-03-20) | grep + tsc | `grep -c "useAuthStore((s) =>" app/app/(app)/index.tsx` returns ≥`2` AND `! grep -q "router\." app/app/(app)/index.tsx` AND `cd app && npx tsc --noEmit` exits 0 | ✅ | ⬜ pending |
| 03-03-T4 | 03-03 | 3 | F1 | (none — file deletion) | Phase 1 smoke-test `app/app/index.tsx` deleted; Stack.Protected has clean route children | shell test | `test ! -f app/app/index.tsx` exits 0 | ✅ | ⬜ pending |
| 03-04-T1 | 03-04 | 4 | F1 (all) | (none — verification gate) | Pre-flight automated chain: TSC + schema test + RLS + lint + Doctor + security-audit + listener-count + smoke-test-deleted ALL pass | shell chain | `cd app && npx tsc --noEmit && npm run test:auth-schemas && npm run test:rls && npm run lint && npx expo-doctor` exits 0 AND service_role grep returns 0 matches | ✅ | ⬜ pending |
| 03-04-T2 | 03-04 | 4 | F1 (SC#1) | T-03-17 | Studio "Confirm email" toggle confirmed OFF (Pitfall §6 mitigation; D-01 dependency) | manual (Studio UI) | (none — checkpoint:human-action; user-attested in 03-VERIFICATION.md frontmatter) | — | ⬜ pending |
| 03-04-T3 | 03-04 | 4 | F1 (SC#1, SC#2, SC#3, SC#4, SC#5) | T-03-08, T-03-09, T-03-14, T-03-16, T-03-18 | All 5 ROADMAP success criteria + 2 edge cases (duplicate email, network failure) + dark-mode rendering pass on iPhone via Expo Go | manual iPhone | (none — checkpoint:human-verify; user-attested per criterion in 03-VERIFICATION.md) | — | ⬜ pending |
| 03-04-T4 | 03-04 | 4 | F1 | (none) | 03-VERIFICATION.md written with frontmatter `status: complete` (or `blocked` with failure list); test account convention recorded (researcher Q5) | file-existence + grep | `test -f .planning/phases/03-auth-persistent-session/03-VERIFICATION.md` AND `grep -q "Success Criterion" .planning/phases/03-auth-persistent-session/03-VERIFICATION.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**Phase 3 Wave 0 = Plan 01.** No separate Wave 0 needed because:

- **Test framework decision:** No Vitest / Jest install. Plan 01 Task 3 ships `app/scripts/test-auth-schemas.ts` (Node-only via `tsx`) instead. Lighter footprint, consistent with Phase 1+2 conventions, ~30 lines of code, runs in <1s. The schema layer (the only Phase 3 surface that's testable without a runtime) is fully covered.
- **Schema unit tests scaffolded:** Plan 01 Task 3 creates the test script + adds `npm run test:auth-schemas` to `app/package.json`. Covers D-12, D-13, D-14, Q3 (empty confirmPassword), and the Zod 4 idiom (`z.email()` + `error:`).
- **TypeScript test config:** No changes needed — `app/tsconfig.json` already includes `**/*.ts` so the script is type-checked under `npx tsc --noEmit`.
- **Runtime UI tests:** Deliberately deferred to manual iPhone verification (Plan 04). Phase 1+2 set this convention; Phase 3 inherits it. Five of six F1 manual criteria require iOS-specific behavior that can't be jsdom'd meaningfully.

`nyquist_compliant: true` — every code-producing task has an automated `<verify>` (TSC + schema test where applicable). Manual-only tasks are the documented runtime-verification path consistent with V1 conventions.

---

## Manual-Only Verifications

iOS / Expo Go behavior is the authoritative validation surface for Phase 3 — no integration framework exists in V1. The kill-and-reopen success criterion (#3) has no automated counterpart in V1 because Expo Go re-launches are not driven by any test runner.

| Behavior | Requirement | Why Manual | Test Plan |
|----------|-------------|------------|-----------|
| **Sign-up → land in (app)** | F1 (SC#1) | RHF + Zod runtime + Supabase API + Expo Router transition | Plan 04 Task 3 step "Success Criterion #1" |
| **Sign-in inline errors** | F1 (SC#2) | RHF onBlur + Zod 4 error formatting; visual-only behavior | Plan 04 Task 3 step "Success Criterion #2" |
| **Cold-start session restore** | F1 (SC#3) | LargeSecureStore round-trip + onAuthStateChange race; only reproducible via real app restart | Plan 04 Task 3 step "Success Criterion #3" |
| **Sign-out cache invalidation** | F1 (SC#4) | `queryClient.clear()` + `onAuthStateChange` propagation | Plan 04 Task 3 step "Success Criterion #4" — partial (full cross-user verification deferred to Phase 4) |
| **Stack.Protected + Redirect defense-in-depth** | F1 (SC#5) | Two-layer guard pattern; flicker prevention is the whole point | Plan 04 Task 3 step "Success Criterion #5" |
| **Duplicate-email signup** | F1 / D-03 | Supabase `error.code === 'user_already_exists'` mapping | Plan 04 Task 3 edge case |
| **Network-failure handling** | F1 / D-15 | `default` branch banner mapping | Plan 04 Task 3 edge case |
| **Dark mode (F15)** | F15 convention | NativeWind `dark:` class pairs visual coverage | Plan 04 Task 3 dark-mode block |
| **Studio "Confirm email" = OFF** | D-01 + Pitfall §6 | Studio UI; no CLI exposure | Plan 04 Task 2 (checkpoint:human-action) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicit manual checkpoints (Plan 04 Task 2/Task 3)
- [x] Sampling continuity: every code-producing task has TSC + grep gates; no 3 consecutive tasks without automated verify
- [x] Wave 0 (= Plan 01) covers all MISSING references (test framework via Node-only `tsx` script)
- [x] No watch-mode flags (schema test runs once, exits 0/1)
- [x] Feedback latency < 30s (TSC + schema + RLS) + 5min manual iPhone session per phase gate
- [x] `nyquist_compliant: true` — frontmatter set after planner finalized per-task IDs

**Approval:** finalized 2026-05-09 — ready for execute-phase 3.

---

## Notes on D-06 vs RESEARCH.md Q1

**Decision:** Honor CONTEXT.md D-06 (locked decision) — Plan 01 Task 2 keeps the explicit `supabase.auth.getSession()` call alongside the module-scope `onAuthStateChange` listener.

**Rationale:** D-06 is a locked user decision; the planner has no authority to drop it. The redundancy with `INITIAL_SESSION` (auth-js master GoTrueClient.ts L2122) is documented in the auth-store.ts header comment so a future revision can drop it cleanly if D-06 is revised.

**Validation impact:** The `getSession()` resolution and the `INITIAL_SESSION` listener fire produce identical setState calls — idempotent and harmless. SC#3 (cold-start session restore) is verified end-to-end in Plan 04; the test does not need to distinguish which code path provided the initial session because both run.

If a future revision adopts the researcher's recommendation (drop D-06), update Plan 01 Task 2 acceptance criteria (`grep -c "getSession(" app/lib/auth-store.ts` returns 0 instead of 1) and remove the `void supabase.auth.getSession()...` block. Listener alone suffices.

---

## Threat-ID Cross-Reference

Threat IDs T-03-* are defined in PLAN.md `<threat_model>` blocks per plan:

| Threat ID | Defined In Plan | Manual Verify In Plan | Notes |
|-----------|----------------|------------------------|-------|
| T-03-01 | 03-01 | inherit (Phase 1 LargeSecureStore wiring) | LargeSecureStore session blob — AES-256-CTR + iOS Keychain key |
| T-03-02 | 03-01 | grep gate (no `await` in listener) | onAuthStateChange callback deadlock prevention |
| T-03-03 | 03-01 | 03-04 SC#4 | TanStack Query cache leak via signOut → queryClient.clear() |
| T-03-04 | 03-01 | grep gate (no `console.log(session)`) | Console-log credential leak prevention |
| T-03-05 | 03-01 | 03-01 schema tests | Schema-bypass via malformed input |
| T-03-06 | 03-01 | accept (V1 personal app, no audit log) | Repudiation — sign-up/sign-in event logging |
| T-03-07 | 03-01 | grep gate (listener count == 1) | Strict-Mode dual-mount duplicate-listener |
| T-03-08 | 03-02 | 03-04 SC#3, SC#5 | Splash hide before status flip → blank flicker |
| T-03-09 | 03-02 | 03-04 SC#2 | Sign-in error reveals which field is wrong (ASVS V2.1.4) |
| T-03-10 | 03-02 | accept-transfer (Supabase platform) | Brute-force credential stuffing rate-limit |
| T-03-11 | 03-02 | grep gate (no console.log of credentials) | Console-log credential leak in sign-in |
| T-03-12 | 03-02 | inherit (Zod schemas as first-tier validator) | XSS/RCE via TextInput → SQL |
| T-03-13 | 03-02 | 03-04 SC#5 | Stack.Protected guard staleness → race |
| T-03-14 | 03-03 | 03-04 edge case (duplicate email) | Sign-up duplicate-email disclosure (accepted per D-03) |
| T-03-15 | 03-03 | 03-04 (manual server-reject path) | Weak password client-bypass → server reject |
| T-03-16 | 03-03 | 03-04 SC#4 + Phase 4 | TanStack Query cache leak (full verification deferred to Phase 4) |
| T-03-17 | 03-03 | 03-04 Task 2 (Studio toggle) | Email-confirm Studio toggle silent breakage |
| T-03-18 | 03-03 | 03-04 SC#5 | Stack.Protected staleness → defense-in-depth Redirect |
| T-03-19 | 03-03 | accept (V1 personal app) | Sign-out side-channel timing |
| T-03-20 | 03-03 | grep gate (only email rendered) | (app)/index.tsx PII leak prevention |
| T-03-21 | 03-04 | accept (V1 solo workflow) | Verification record unfalsifiable / no audit log |
| T-03-22 | 03-04 | accept (test email is non-sensitive) | 03-VERIFICATION.md commits test email to git |
| T-03-23 | 03-04 | accept (solo-dev trust model) | User signs PASS but actual behavior failed |

`/gsd-secure-phase 3` runs the full audit against this register and writes `03-SECURITY.md` with `threats_open: 0` requirement before phase advancement.
