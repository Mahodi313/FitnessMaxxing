---
phase: 3
slug: auth-persistent-session
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `.planning/phases/03-auth-persistent-session/03-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TBD — planner finalizes (likely vitest 1.x or jest 29.x for Zod-schema unit tests; manual iPhone checklist for runtime) |
| **Config file** | TBD (Wave 0 installs if no framework detected; current repo has none) |
| **Quick run command** | TBD (e.g., `npm run test:schemas` from `app/` cwd) |
| **Full suite command** | TBD (e.g., `npm run test` from `app/` cwd) |
| **Estimated runtime** | ~< 5 seconds (schema unit tests only — no integration framework in V1) |

---

## Sampling Rate

- **After every task commit:** Run quick schema-test command (when framework wired)
- **After every plan wave:** Run full suite + manual sanity (Expo Go cold-start on iPhone)
- **Before `/gsd-verify-work`:** Full suite green AND manual iPhone checklist signed off (success criterion #3 — kill-and-reopen — has no automated counterpart in V1)
- **Max feedback latency:** ≤ 30 seconds (auto) + ≤ 5 minutes (manual iPhone session)

---

## Per-Task Verification Map

> Planner finalizes per-task IDs once PLAN.md files are written. Skeleton below maps F1 success criteria to verification gates surfaced by RESEARCH.md.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-XX-XX | TBD  | 0    | F1 | — | Wave 0: install test framework + scaffold `app/lib/schemas/auth.test.ts` | unit | `npm run test:schemas` | ❌ W0 | ⬜ pending |
| 03-XX-XX | TBD  | 1    | F1 | T-03-* | Zod sign-up schema rejects `password.length < 12` (D-12) | unit | `npm run test:schemas -- signUpSchema` | ❌ W0 | ⬜ pending |
| 03-XX-XX | TBD  | 1    | F1 | T-03-* | Zod sign-up schema rejects `password !== confirmPassword` (D-14) | unit | `npm run test:schemas -- signUpSchema` | ❌ W0 | ⬜ pending |
| 03-XX-XX | TBD  | 1    | F1 | T-03-* | Zod sign-up schema rejects invalid email (`z.email()` Zod 4 form) | unit | `npm run test:schemas -- signUpSchema` | ❌ W0 | ⬜ pending |
| 03-XX-XX | TBD  | 1    | F1 | T-03-* | Zod sign-in schema rejects empty password (D-13: `min(1)`, not `min(12)`) | unit | `npm run test:schemas -- signInSchema` | ❌ W0 | ⬜ pending |
| 03-XX-XX | TBD  | 2    | F1 | T-03-* | TypeScript: `Session` type from `@supabase/supabase-js` flows through `auth-store.ts` without `any` | tsc | `cd app && npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-XX-XX | TBD  | 2    | F1 | T-03-* | Lint: `app/lib/auth-store.ts` registers `onAuthStateChange` exactly once at module scope | lint+grep | `grep -c "onAuthStateChange" app/lib/auth-store.ts` (expect 1) | ✅ | ⬜ pending |
| 03-XX-XX | TBD  | 2    | F1 | T-03-* | `queryClient.clear()` is called inside `signOut` action, NOT inside the `onAuthStateChange` callback (deadlock risk per RESEARCH.md) | grep | `grep -A 5 "onAuthStateChange" app/lib/auth-store.ts \| grep -v "queryClient"` | ✅ | ⬜ pending |
| 03-XX-XX | TBD  | 3    | F1 (SC#1) | T-03-* | Sign-up flow lands user in `(app)` group post-success | manual iPhone | (none — see Manual-Only) | — | ⬜ pending |
| 03-XX-XX | TBD  | 3    | F1 (SC#2) | T-03-* | Sign-in inline-error: invalid email shows under field; bad credentials shows generic Swedish copy | manual iPhone | (none — see Manual-Only) | — | ⬜ pending |
| 03-XX-XX | TBD  | 3    | F1 (SC#3) | T-03-* | LargeSecureStore round-trip: sign-in → kill app → reopen → land directly in `(app)` (no flicker) | manual iPhone | (none — see Manual-Only) | — | ⬜ pending |
| 03-XX-XX | TBD  | 3    | F1 (SC#4) | T-03-* | Sign-out: returns to `(auth)/sign-in.tsx` AND `queryClient.clear()` runs (verify by grep + manual cache-state check) | manual iPhone | (none — see Manual-Only) | — | ⬜ pending |
| 03-XX-XX | TBD  | 3    | F1 (SC#5) | T-03-* | `Stack.Protected guard={!!session}` + `(app)/_layout.tsx <Redirect>` defense-in-depth: no flicker on cold start, no flash of `(app)` content when session is null | manual iPhone | (none — see Manual-Only) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Test framework decision:** vitest 1.x (recommended — fastest cold-start; no native deps) OR jest 29.x. Planner picks; install via `npm install --save-dev` from `app/` cwd.
- [ ] **`app/lib/schemas/auth.test.ts`** — schema unit tests for `signUpSchema` and `signInSchema`. Covers D-12 (min 12), D-13 (min 1), D-14 (refine matches), Zod 4 `z.email()` form per RESEARCH.md.
- [ ] **`app/package.json` script:** add `"test"` and `"test:schemas"` entries pointing to chosen framework.
- [ ] **`tsconfig.json` test config:** ensure test files are excluded from production build but type-checked under `npx tsc --noEmit`.

*If planner determines schema-only tests are not worth a framework install for V1 personal use, replace with a `gsd-tools verify`-style runtime check or fold into manual iPhone checklist with a note in `nyquist_compliant: false`-rationale below.*

---

## Manual-Only Verifications

iOS / Expo Go behavior is the authoritative validation surface for Phase 3 — no integration framework exists in V1 (D-10 deferred test-folder convention to Phase 4 anyway). The kill-and-reopen success criterion (#3) has no automated counterpart in V1 because Expo Go re-launches are not driven by any test runner.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **Sign-up → land in (app)** | F1 (SC#1) | RHF + Zod runtime + Supabase API + Expo Router transition; no integration framework in V1 | 1. Open Expo Go on iPhone. 2. Navigate to sign-up. 3. Enter `test+phase3@example.com` + 12-char password (twice). 4. Submit. 5. Verify: lands on `(app)/index.tsx` with "Hello {email}" + sign-out button visible. |
| **Sign-in inline errors** | F1 (SC#2) | RHF onBlur + Zod 4 error formatting; visual-only behavior | 1. Open sign-in. 2. Enter invalid email → blur. Expect: "Email måste vara giltigt" under email field. 3. Enter valid email + empty password → submit. Expect: "Lösen krävs". 4. Enter wrong password → submit. Expect: generic Swedish copy ("Fel email eller lösen") under password field. |
| **Cold-start session restore** | F1 (SC#3) | `LargeSecureStore` round-trip + `getSession()`/`onAuthStateChange` race; only reproducible via real app restart | 1. Sign in successfully. 2. Force-close Expo Go (swipe up + dismiss card). 3. Reopen Expo Go. 4. Verify: native iOS splash held briefly → lands in `(app)` directly. NO flash of `(auth)/sign-in.tsx`. NO flicker between splash and content. |
| **Sign-out cache invalidation** | F1 (SC#4) | `queryClient.clear()` + `onAuthStateChange` propagation; affects in-memory + AsyncStorage-persisted query cache | 1. Sign in as user A. 2. (Future Phase 4 setup not required — F1 only.) Tap sign-out. 3. Verify: redirect to `(auth)/sign-in.tsx` is atomic (no flash of empty `(app)`). 4. Sign in as user B. 5. Verify: no leaked react-query data from user A's session (inspect react-query devtools if installed; otherwise rely on grep gate above + behavioral check that `(app)/index.tsx` shows user B's email). |
| **Stack.Protected + Redirect defense-in-depth** | F1 (SC#5) | Two-layer guard pattern; flicker prevention is the whole point | 1. Sign in. 2. Force-close. 3. Edit `app/lib/auth-store.ts` to inject a 2-second artificial delay before status flips (manual debug step, revert after). 4. Reopen. 5. Verify: native iOS splash holds for the 2 seconds; no white flash; no `(auth)/sign-in.tsx` peek. 6. Revert delay. |
| **Duplicate-email signup** | F1 / D-03 | Supabase `AuthApiError.code === 'user_already_exists'` mapping per RESEARCH.md error table | 1. Sign up with an email already used. 2. Verify: "Detta email är redan registrerat — försök logga in" appears inline under email field. NOT a generic toast/alert. |
| **Network-failure handling** | F1 / D-15 | `AuthRetryableFetchError` mapping per RESEARCH.md | 1. Toggle airplane mode. 2. Attempt sign-up. 3. Verify: "Något gick fel. Försök igen." (or planner-finalized Swedish copy) inline under submit button. NO uncaught promise rejection. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (Wave 0 = test framework + schema unit tests; runtime is manual-only by design)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (planner enforces)
- [ ] Wave 0 covers all MISSING references (test framework currently absent in V1)
- [ ] No watch-mode flags (chosen framework runs once, exits 0/1)
- [ ] Feedback latency < 30s (schema-test target) + 5min manual iPhone session per wave
- [ ] `nyquist_compliant: true` set in frontmatter (after planner finalizes per-task IDs and threat-ref mapping)

**Approval:** pending — planner to finalize Per-Task Verification Map IDs after PLAN.md files are written.

---

## Notes for Planner

- **CONTEXT.md D-06 vs RESEARCH.md.** Researcher recommends dropping the explicit `getSession()` because `onAuthStateChange` auto-fires `INITIAL_SESSION`. If planner honors D-06 (locked), the validation map's "module-init flow" tasks need a verify gate that the explicit call still resolves before `status` flip. If planner adopts researcher recommendation, drop those gates and rely on the listener's `INITIAL_SESSION` fire.
- **Threat-ref column is intentionally `T-03-*` placeholder.** `gsd-secure-phase 3` will assign concrete IDs after threat-model expansion in PLAN.md `<threat_model>` blocks.
- **Skip framework option.** If planner decides Wave 0 schema-test framework install is overkill for V1 (single-developer, no CI in scope per CLAUDE.md), document in PLAN.md and update this VALIDATION.md to set `nyquist_compliant: true (manual-only path documented)` with explicit rationale.
