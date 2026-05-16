---
phase: 03-auth-persistent-session
plan: "03"
subsystem: auth
tags: [auth, sign-up, app-group, redirect, sign-out, rhf, zod, nativewind, dark-mode]
dependency_graph:
  requires:
    - "app/lib/schemas/auth.ts (Plan 03-01 — signUpSchema, SignUpInput)"
    - "app/lib/auth-store.ts (Plan 03-01 — useAuthStore, session, signOut)"
    - "app/lib/supabase.ts (Phase 1 — LargeSecureStore client)"
    - "app/app/_layout.tsx (Plan 03-02 — Stack.Protected routing)"
    - "app/app/(auth)/_layout.tsx (Plan 03-02 — auth group layout)"
    - "react-hook-form + @hookform/resolvers/zod (Phase 1 installed)"
  provides:
    - "app/app/(auth)/sign-up.tsx — Sign-up screen with RHF + Zod 4 + 7-case error mapping"
    - "app/app/(app)/_layout.tsx — Authenticated group layout with Redirect defense-in-depth"
    - "app/app/(app)/index.tsx — Post-login placeholder with email greeting + sign-out"
  affects:
    - "03-04 (manual verification) — all 5 ROADMAP F1 success criteria now exercisable end-to-end"
tech_stack:
  added: []
  patterns:
    - "signUpSchema with 3-field RHF form (email + password + confirmPassword)"
    - "7-case error.code switch: user_already_exists, email_exists, weak_password, over_request_rate_limit, over_email_send_rate_limit, signup_disabled, validation_failed"
    - "(app) group Redirect defense-in-depth: narrow session selector + conditional Redirect"
    - "Narrow Zustand selectors: separate selectors for email and signOut in (app)/index.tsx"
    - "Helper text pattern: rendered before validation, replaced by error on Zod failure"
    - "autoComplete=new-password + textContentType=newPassword for sign-up password fields"
    - "Declarative sign-out: onPress={signOut} without imperative router.replace (D-16)"
key_files:
  created:
    - "app/app/(auth)/sign-up.tsx"
    - "app/app/(app)/_layout.tsx"
    - "app/app/(app)/index.tsx"
  modified: []
  deleted:
    - "app/app/index.tsx (Phase 1 smoke-test — semantically replaced by (app)/index.tsx)"
decisions:
  - "D-03 honored: duplicate-email error inline under email field (email-existence disclosure accepted per Supabase API behavior)"
  - "D-12 honored: password.min(12) in signUpSchema; server-side weak_password as final arbiter"
  - "D-14 honored: confirmPassword refine via signUpSchema (.refine with path: [confirmPassword])"
  - "D-15 honored: Swedish error copy throughout sign-up screen"
  - "D-16 honored: declarative routing only — no router.replace on success or sign-out"
  - "Pitfall §6 documented: Studio Confirm-email toggle assumption (D-01 = OFF); V1.1 plan note added"
  - "Pitfall §7 mitigated: placeholderTextColor prop used (not placeholder:text-gray-* class)"
  - "Phase 1 smoke-test deletion chosen (Option A per PATTERNS.md) for cleaner end state"
metrics:
  duration: "4m"
  completed: "2026-05-09T12:57:14Z"
  tasks_completed: 4
  tasks_total: 4
  files_created: 3
  files_modified: 0
  files_deleted: 1
---

# Phase 3 Plan 03: Sign-Up Screen + (app) Group + Phase 1 Cleanup Summary

**One-liner:** Sign-up screen with RHF + Zod 4 + 7-case Supabase error mapping, (app) group layout with Redirect defense-in-depth, and post-login placeholder with narrow Zustand selectors — completing the F1 vertical slice.

## What Was Built

Four tasks deliver the final pieces of the Phase 3 auth vertical slice:

1. **`app/app/(auth)/sign-up.tsx` (new)** — Sign-up screen mirroring sign-in's structure with:
   - 3-field form (email + password + confirmPassword) using `zodResolver(signUpSchema)`
   - `mode: "onBlur"` validation; `defaultValues` for all 3 fields
   - `supabase.auth.signUp({ email, password })` with 7-case `error.code` switch
   - Helper text "Minst 12 tecken" rendered before validation fires; replaced by inline error on Zod failure
   - `autoComplete="new-password"` + `textContentType="newPassword"` (sign-up specific, not "password")
   - 25 `dark:` class occurrences; `placeholderTextColor="#9CA3AF"` prop (Pitfall §7)
   - Declarative success routing (D-16): no `router.replace` on successful signUp

2. **`app/app/(app)/_layout.tsx` (new)** — Authenticated group layout with:
   - Narrow `useAuthStore((s) => s.session)` selector (D-10: limits re-renders to session changes)
   - `<Redirect href="/(auth)/sign-in" />` when session is null (defense-in-depth per ROADMAP SC#5)
   - `<Stack screenOptions={{ headerShown: false }} />` when session present

3. **`app/app/(app)/index.tsx` (new)** — Post-login placeholder with:
   - Two narrow Zustand selectors: `s.session?.user.email` and `s.signOut`
   - "Inloggad som {email}" greeting + "FitnessMaxxing" heading + "Plan-skapande kommer i nästa fas."
   - Sign-out `Pressable` with `onPress={signOut}` (no inline arrow; no `router.replace`)
   - Full dark-mode class pairs per UI-SPEC.md Color §60/30/10

4. **`app/app/index.tsx` (deleted)** — Phase 1 "Hello FitnessMaxxing" smoke-test removed; replaced by `(app)/index.tsx` as the post-login route entry.

## Sign-Up Error Code Coverage

| Error Code | Mapped To | Copy |
|------------|-----------|------|
| `user_already_exists` | `setError("email", ...)` | "Detta email är redan registrerat — försök logga in" |
| `email_exists` | `setError("email", ...)` | "Detta email är redan registrerat — försök logga in" |
| `weak_password` | `setError("password", ...)` | "Lösen för svagt — minst 12 tecken" |
| `over_request_rate_limit` | `setBannerError(...)` | "För många försök. Försök igen om en stund." |
| `over_email_send_rate_limit` | `setBannerError(...)` | "För många försök. Försök igen om en stund." |
| `signup_disabled` | `setBannerError(...)` | "Registrering är tillfälligt avstängd." |
| `validation_failed` | `setBannerError(...)` | "Email eller lösen ogiltigt format." |
| default | `setBannerError(...)` | "Något gick fel. Försök igen." |

## (app) Group Defense-in-Depth Pattern

```
Root _layout.tsx:
  Stack.Protected guard={!!session}  →  (app) group (when authenticated)
  Stack.Protected guard={!session}   →  (auth) group (when anonymous)

(app)/_layout.tsx (defense-in-depth):
  session === null  →  <Redirect href="/(auth)/sign-in" />
  session present   →  <Stack screenOptions={{ headerShown: false }} />
```

Two-layer guard prevents any stale-frame flash from root guard into protected screens (ROADMAP success criterion #5).

## Sign-Out Flow Trace

```
User taps "Logga ut"
  → onPress={signOut}
  → useAuthStore.signOut()
    → queryClient.clear()           (flush TanStack cache before auth state changes)
    → supabase.auth.signOut()
    → onAuthStateChange fires SIGNED_OUT
    → useAuthStore.setState({ session: null, status: 'anonymous' })
  → root Stack.Protected guard={!!session} re-evaluates (session now null)
  → routes to (auth) group → sign-in screen
  → NO imperative router.replace
```

Cache clear happens BEFORE `supabase.auth.signOut()` per Plan 01 contract (T-03-16 mitigation).

## Phase 1 Smoke-Test Handoff

`app/app/index.tsx` (11 lines — "Hello FitnessMaxxing") was verified as the Phase 1 smoke-test before deletion. No other file imported from it. The `(app)/index.tsx` (Task 3) is now the post-login route entry under `Stack.Protected`.

## Dark-Mode Class Coverage (F15 Convention)

All three new screens verified against UI-SPEC.md checklist:

| Screen | dark: count | Required |
|--------|-------------|---------|
| sign-up.tsx | 25 | ≥ 18 |
| (app)/_layout.tsx | 0 (no UI) | n/a |
| (app)/index.tsx | 5 | ≥ 5 |

All required color pairs present: `bg-white/gray-900`, `text-gray-900/gray-50`, `bg-gray-100/gray-800`, `border-gray-300/gray-700`, `bg-blue-600/blue-500`, `text-blue-600/blue-400`, `text-red-600/red-400`, `text-gray-500/gray-400`.

## Verification Results

```
npx tsc --noEmit → CLEAN (0 errors)
npm run test:auth-schemas → 8/8 PASS (Plan 01 schemas not regressed)
grep service_role sign-up.tsx (app)/_layout.tsx (app)/index.tsx → 0 matches
grep -c "<Controller" sign-up.tsx → 3 (expected 3)
grep -c "^      case " sign-up.tsx → 7 (expected 7)
test ! -f app/app/index.tsx → PASS (Phase 1 file deleted)
test -f app/app/(app)/index.tsx → PASS (replacement exists)
grep -r "app/app/index" → 0 matches (no broken imports)
npm run lint → PASS (exit 0)
```

## Threat Model Coverage (Plan 03)

| Threat ID | Mitigation | Verified |
|-----------|------------|---------|
| T-03-14 | D-03 accepted: Supabase API discloses email existence regardless; UI is consistent | user_already_exists + email_exists both map to same inline copy |
| T-03-15 | Two-tier password validation: Zod min(12) + server-side weak_password mapping | Both cases handled in code |
| T-03-16 | queryClient.clear() before supabase.auth.signOut() (Plan 01 contract) | onPress={signOut} calls auth-store action which owns the ordering |
| T-03-17 | Pitfall §6 documented in code comment near signUp call | D-01 assumption hard-coded; V1.1 migration path noted |
| T-03-18 | (app)/_layout.tsx Redirect as defense-in-depth | session=null → Redirect before any protected screen mounts |
| T-03-19 | Sign-out timing accepted (V1 personal app, single user) | console.warn logs only error.message, not credentials |
| T-03-20 | Only session.user.email rendered; no access_token, user.id, etc. in JSX | Verified by reading (app)/index.tsx JSX |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Sign-up screen | `c4d8dec` | feat(03-03): create sign-up screen with RHF + Zod 4 + Supabase error mapping |
| Task 2: (app) group layout | `347dfe0` | feat(03-03): create (app) group layout with Redirect defense-in-depth |
| Task 3: Post-login placeholder | `1876101` | feat(03-03): create post-login placeholder screen with sign-out button |
| Task 4: Delete smoke-test | `3ce8292` | chore(03-03): delete Phase 1 smoke-test (app/app/index.tsx) |

## Deviations from Plan

None — plan executed exactly as written. The sign-up screen was created verbatim from the plan's EXACT contents block; (app) layout and (app)/index.tsx likewise followed the plan's canonical shapes. Node_modules installed in worktree as expected (same pattern as Wave 1, documented as standard worktree setup).

## Known Stubs

`app/app/(app)/index.tsx` is an intentional placeholder surface per CONTEXT.md D-17. It renders `email` from the session (wired data — not a stub) and a "Plan-skapande kommer i nästa fas." note signaling its provisional status. Phase 4 replaces this screen with the real plans/exercises home. This stub does NOT prevent Plan 03's goal (auth vertical slice) from being achieved — the auth flow is complete.

## Open: Hand off to Plan 04

Plan 04 (manual iPhone verification) is the next step. All 5 ROADMAP F1 success criteria are now exercisable end-to-end:

1. Cold-start authenticated → lands in (app)/index.tsx directly (no flicker)
2. Cold-start anonymous → lands in (auth)/sign-in.tsx
3. Sign-in with valid credentials → routes to (app)/index.tsx declaratively
4. Sign-up creates account → routes to (app)/index.tsx declaratively
5. Sign-out → routes back to (auth)/sign-in.tsx declaratively

## Self-Check

### Files Exist

- [x] `app/app/(auth)/sign-up.tsx` — FOUND
- [x] `app/app/(app)/_layout.tsx` — FOUND
- [x] `app/app/(app)/index.tsx` — FOUND
- [x] `app/app/index.tsx` — DELETED (PASS)

### Commits Exist

- [x] `c4d8dec` — feat(03-03): create sign-up screen — FOUND
- [x] `347dfe0` — feat(03-03): create (app) group layout — FOUND
- [x] `1876101` — feat(03-03): create post-login placeholder — FOUND
- [x] `3ce8292` — chore(03-03): delete Phase 1 smoke-test — FOUND

### TypeScript Clean

- [x] `cd app && npx tsc --noEmit` exits 0 — PASS

### Schema Tests Not Regressed

- [x] `npm run test:auth-schemas` → 8/8 PASS

### Lint Clean

- [x] `npm run lint` exits 0 — PASS

## Self-Check: PASSED
