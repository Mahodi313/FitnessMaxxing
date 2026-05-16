---
phase: 03-auth-persistent-session
plan: "02"
subsystem: auth
tags: [auth, expo-router, splash-screen, stack-protected, sign-in, rhf, zod, nativewind, dark-mode]
dependency_graph:
  requires:
    - "app/lib/auth-store.ts (Plan 03-01 — useAuthStore, AuthStatus, session, status, signOut)"
    - "app/lib/schemas/auth.ts (Plan 03-01 — signInSchema, SignInInput)"
    - "app/lib/supabase.ts (Phase 1 — LargeSecureStore client)"
    - "app/lib/query-client.ts (Phase 1 — TanStack Query client)"
    - "expo-splash-screen (Phase 1 installed)"
    - "react-hook-form + @hookform/resolvers/zod (Phase 1 installed)"
  provides:
    - "app/app/_layout.tsx — root layout with SplashScreen.preventAutoHideAsync() + SplashScreenController + RootNavigator (Stack.Protected)"
    - "app/app/(auth)/_layout.tsx — auth group layout (bare Stack, headerShown:false)"
    - "app/app/(auth)/sign-in.tsx — sign-in screen with RHF + Zod 4 + Supabase error mapping"
  affects:
    - "03-03 (sign-up + (app) group) — (auth) layout and Stack.Protected routing are now live; sign-in nav link references (auth)/sign-up"
    - "03-04 (manual verification) — cold-start splash + Stack.Protected routing verifiable once (app) group is complete"
tech_stack:
  added: []
  patterns:
    - "SplashScreen.preventAutoHideAsync() at module scope (before any render) — D-04"
    - "SplashScreenController render-side controller: synchronous SplashScreen.hide() on status flip"
    - "RootNavigator returns null while status=loading (Pitfall §5 — prevents blank flash)"
    - "Stack.Protected guard={!!session} / guard={!session} — declarative auth routing (D-16)"
    - "useAuthStore narrow selectors — separate selectors for session vs status vs signOut"
    - "RHF mode=onBlur + zodResolver(signInSchema) — onBlur validation, submit triggers all errors"
    - "Supabase error.code switch mapping — invalid_credentials / over_request_rate_limit / validation_failed / default"
    - "placeholderTextColor prop instead of placeholder:text-* class — Pitfall §7 NativeWind fix"
    - "60/30/10 NativeWind dark-mode class pairs — every styled surface has light + dark variant"
key_files:
  created:
    - "app/app/(auth)/_layout.tsx"
    - "app/app/(auth)/sign-in.tsx"
  modified:
    - "app/app/_layout.tsx"
decisions:
  - "D-04/D-05 honored (locked): SplashScreen.preventAutoHideAsync() at module scope; hide triggered by SplashScreenController render-side when status leaves loading"
  - "D-16 honored (locked): no imperative router.replace on sign-in success — Stack.Protected re-evaluation handles routing declaratively"
  - "ASVS V2.1.4 honored: invalid_credentials maps to generic 'Fel email eller lösen' under password field (does not reveal which field is wrong)"
  - "T-03-10 transfer accepted: rate-limit defense via Supabase platform (over_request_rate_limit code) — client-side rate-limit deferred per CLAUDE.md out-of-scope"
  - "TDD deviation: tdd=true flag on Task 3 skipped RED phase — no React Native component test framework (Jest + Testing Library) wired in this project. Implementation matches all behavior requirements; behavioral verification deferred to Plan 04 manual verification."
metrics:
  duration: "12m"
  completed: "2026-05-09T13:10:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
---

# Phase 3 Plan 02: Root Auth Shell + Sign-In Screen Summary

**One-liner:** Root layout wired with module-scope SplashScreen hold + Stack.Protected auth guard + SplashScreenController; (auth) group layout and sign-in screen created with RHF + Zod 4 + Supabase error.code mapping and full dark-mode class coverage.

## What Was Built

Three file changes implement the "user-can-sign-in" vertical slice foundation:

1. **`app/app/_layout.tsx` (modified)** — Root layout extended with:
   - `SplashScreen.preventAutoHideAsync()` at module scope (D-04: holds native splash before any React render)
   - `import { useAuthStore }` at module scope (triggers Plan 01's onAuthStateChange listener)
   - `SplashScreenController` component: calls `SplashScreen.hide()` synchronously in render when status leaves `'loading'` (Strict-Mode safe via idempotency)
   - `RootNavigator` component: returns `null` while `status === 'loading'` (Pitfall §5 — prevents blank flash); renders `Stack.Protected` for `(app)` and `(auth)` groups
   - All Phase 1 listeners (`focusManager`, `onlineManager`) and `StatusBar style="auto"` preserved

2. **`app/app/(auth)/_layout.tsx` (new)** — Bare auth group layout with `<Stack screenOptions={{ headerShown: false }} />` per CLAUDE.md navigation convention. No auth-state coupling (root + (app) handle all routing).

3. **`app/app/(auth)/sign-in.tsx` (new)** — Sign-in screen with:
   - `useForm<SignInInput>({ resolver: zodResolver(signInSchema), mode: "onBlur" })` — onBlur validation
   - `supabase.auth.signInWithPassword({ email, password })` with structured error.code switch
   - Error mapping: `invalid_credentials` → inline under password field (ASVS V2.1.4 generic); `over_request_rate_limit` → dismissible banner; `validation_failed` → banner; default → banner
   - Swedish copy: "Logga in" heading, "Email" / "Lösen" labels, "Loggar in…" loading state, "Inget konto? Registrera" nav link
   - 18 `dark:` class occurrences — every styled surface paired
   - `placeholderTextColor="#9CA3AF"` prop (Pitfall §7: NativeWind `placeholder:` class conflicts avoided)
   - Declarative success routing: no `router.replace` on success (D-16)

## Verification Results

```
npx tsc --noEmit → CLEAN (0 errors)
npm run test:auth-schemas → 8/8 PASS (Plan 01 schemas not regressed)
grep -c "service_role|SERVICE_ROLE" _layout.tsx (auth)/_layout.tsx sign-in.tsx → 0 matches
grep -c "preventAutoHideAsync" _layout.tsx → 1
grep -c "dark:" sign-in.tsx → 18 (≥ 12 required)
```

## Splash Hold + Stack.Protected Pattern Verified

```bash
# Module-scope splash hold
grep -n "preventAutoHideAsync" app/app/_layout.tsx
# → line 28: SplashScreen.preventAutoHideAsync();  (before any function/export)

# Stack.Protected guard forms
grep -n "Stack.Protected" app/app/_layout.tsx
# → line 74: <Stack.Protected guard={!!session}>
# → line 77: <Stack.Protected guard={!session}>
# (2 functional opening tags; comment mention on line 61 is documentation only)

# Loading guard (Pitfall §5 mitigation)
grep "if (status === \"loading\") return null" app/app/_layout.tsx
# → line 71: if (status === "loading") return null;
```

## Sign-In Error Code Coverage

| Error Code | Mapped To | Copy |
|------------|-----------|------|
| `invalid_credentials` | `setError("password", ...)` | "Fel email eller lösen" (generic per ASVS V2.1.4) |
| `over_request_rate_limit` | `setBannerError(...)` | "För många försök. Försök igen om en stund." |
| `validation_failed` | `setBannerError(...)` | "Email eller lösen ogiltigt format." |
| default (network, unexpected) | `setBannerError(...)` | "Något gick fel. Försök igen." |

## Dark-Mode Class Pairs Verification (F15 Convention)

All 7 UI-SPEC.md required pairs present in sign-in.tsx:

- [x] Background: `bg-white dark:bg-gray-900` (SafeAreaView)
- [x] Body text: `text-gray-900 dark:text-gray-50` (heading, labels, nav-link prefix)
- [x] Field background: `bg-gray-100 dark:bg-gray-800` (TextInput)
- [x] Field border: `border-gray-300 dark:border-gray-700` (default) + `border-red-600 dark:border-red-400` (error)
- [x] CTA button: `bg-blue-600 dark:bg-blue-500`
- [x] Link text: `text-blue-600 dark:text-blue-400` ("Registrera")
- [x] Error text: `text-red-600 dark:text-red-400` (inline field error + banner)

Total `dark:` occurrences: 18 (≥ 12 required by plan)

## Open Notes for Plan 03

1. **`(auth)/sign-up.tsx` required**: sign-in's nav link calls `router.replace("/(auth)/sign-up")`. Plan 03 must create this file before the nav link resolves.
2. **`(app)/_layout.tsx` + `(app)/index.tsx` required**: the `Stack.Protected guard={!!session}` branch routes to the `(app)` group. Plan 03 creates these files, completing the full auth flow.
3. **Manual verification gate**: Plans 02 + 03 together enable SC#1 (cold-start no-flicker), SC#3 (sign-in succeeds → routes to (app)), SC#4 (sign-up creates account), SC#5 (authenticated cold-start skips auth). Plan 04 is the manual verification checkpoint.
4. **Current smoke-test `app/app/index.tsx`**: Plan 03 handles this file (relocate or delete per PATTERNS.md option A/B).

## Deviations from Plan

### TDD RED Phase Skipped (Task 3)

**Found during:** Task 3 start (tdd="true" flag)
**Issue:** Task 3 has `tdd="true"` with 7 behavior test cases. React Native component testing (blur events, submit events, navigation) requires Jest + React Native Testing Library. Neither is configured in this project — only Node `tsx` scripts exist (`test:rls`, `test:auth-schemas`).
**Fix:** Implemented directly per the plan's EXACT `<action>` code block. All 7 behaviors are implemented in the component:
  - Test 1 (onBlur invalid email → error): handled by RHF `mode="onBlur"` + zodResolver
  - Test 2 (empty password → error): handled by signInSchema `.min(1, "Lösen krävs")`
  - Test 3 (invalid_credentials → inline error): error.code switch → setError("password", ...)
  - Test 4 (rate_limit → banner): error.code switch → setBannerError(...)
  - Test 5 (valid credentials → declarative routing): no router.replace; Stack.Protected handles
  - Test 6 (nav link → router.replace): `router.replace("/(auth)/sign-up")` on Pressable
  - Test 7 (dark mode): 18 dark: class pairs, all UI-SPEC surfaces covered
**Classification:** [Rule 3 - Blocking Issue] — no test framework available; TDD RED phase structurally impossible. Behavioral correctness verified by code inspection + TSC.
**Deferred:** Component test infrastructure setup is deferred to a future phase (Phase 5+ or as a standalone plan).

### Stack.Protected grep count (minor discrepancy)

**Found during:** Task 1 acceptance criteria verification
**Issue:** `grep -c "Stack.Protected" app/app/_layout.tsx` returns 5, not 2 as stated in the plan's verification section. The count includes the JSDoc comment on line 61 ("Stack.Protected gates (app) and (auth)..."), the 2 opening `<Stack.Protected>` tags, and 2 closing `</Stack.Protected>` tags. The plan's EXACT template includes the JSDoc comment which was not counted in the spec's grep check.
**Impact:** None — 2 functional `<Stack.Protected guard={...}>` opening tags exist (correct). The count discrepancy is in the plan spec, not in the implementation.
**Classification:** Out-of-scope (plan spec imprecision, not an implementation issue).

## Threat Model Coverage (Plan 02)

| Threat ID | Mitigation | Verified |
|-----------|------------|---------|
| T-03-08 | RootNavigator returns null while status=loading; SplashScreenController hides splash on flip | grep confirms `if (status === "loading") return null` |
| T-03-09 | invalid_credentials → generic "Fel email eller lösen" (no field distinction) | setError("password", ...) in switch case |
| T-03-10 | over_request_rate_limit → banner (client maps Supabase platform rate-limit) | setBannerError("För många...") |
| T-03-11 | console.error logs only error object, not email/password | grep confirms no console.log(password/email/session) |
| T-03-12 | Zod schema validates before any Supabase call | zodResolver(signInSchema) in useForm |
| T-03-13 | Stack.Protected guard evaluated only after status leaves loading | RootNavigator null-guard + SplashScreenController ordering |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Root layout (SplashScreen + Stack.Protected) | `339c6f2` | feat(03-02): add SplashScreen hold + Stack.Protected to root layout |
| Task 2: (auth) group layout | `f3df8d6` | feat(03-02): create (auth) group layout with headerShown:false |
| Task 3: Sign-in screen | `f6bea27` | feat(03-02): create sign-in screen with RHF + Zod 4 + Supabase error mapping |

## Known Stubs

None. The sign-in screen is fully wired: RHF form state → Zod validation → Supabase call → error.code mapping → UI. The `(auth)/sign-up.tsx` nav link target is a known forward reference (Plan 03), not a stub in this plan.

## Self-Check

### Files Exist

- [x] `app/app/_layout.tsx` — FOUND (modified)
- [x] `app/app/(auth)/_layout.tsx` — FOUND (created)
- [x] `app/app/(auth)/sign-in.tsx` — FOUND (created)
- [x] `.planning/phases/03-auth-persistent-session/03-02-root-auth-signin-SUMMARY.md` — FOUND

### Commits Exist

- [x] `339c6f2` — feat(03-02): add SplashScreen hold + Stack.Protected to root layout — FOUND
- [x] `f3df8d6` — feat(03-02): create (auth) group layout with headerShown:false — FOUND
- [x] `f6bea27` — feat(03-02): create sign-in screen with RHF + Zod 4 + Supabase error mapping — FOUND

### TypeScript Clean

- [x] `cd app && npx tsc --noEmit` exits 0 — PASS

### Schema Tests Not Regressed

- [x] `npm run test:auth-schemas` → 8/8 PASS

## Self-Check: PASSED
