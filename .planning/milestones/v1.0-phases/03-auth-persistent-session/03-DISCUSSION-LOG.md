# Phase 3: Auth & Persistent Session - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 3-auth-persistent-session
**Areas discussed:** Email confirmation flow, Cold-start session loading & flicker, Auth state propagation pattern, Password validation strictness

---

## Email confirmation flow

| Option | Description | Selected |
|--------|-------------|----------|
| Off — signup = instant session | Disable 'Confirm email' in Supabase Studio. Signup returns a session immediately and the user lands in (app). Zero deep-link handling. Simplest path, matches ROADMAP #1 literally. Risk: typo'd emails create unverified accounts (no recovery channel). Acceptable for personal V1 — you ARE the user. | |
| Soft — instant session + 'Verify email' banner | Keep 'Confirm email' ON but read user.email_confirmed_at and show a small banner in (app) until confirmed. Signup still returns a session in this mode? — actually in current Supabase, ON = no session until confirmed. So 'Soft' would require disabling in Studio AND wiring a confirm-later flow ourselves. More moving parts than worth it for V1. | |
| Required — block sign-in until confirmed | 'Confirm email' ON in Supabase. Signup returns user but no session. User must click email link — we register a deep-link handler (`fitnessmaxxing://auth-callback`) so the app reopens to the verified state. App Store-ready. Cost: deep-link wiring (`expo-linking` + `app.json` scheme + `auth-callback.tsx` route) + you must access your email from the test device. | |
| Off in V1, document V1.1 flip | Same code path as 'Off', but Phase 3 leaves a TODO + a `Deferred` entry noting that V1.1 needs to flip the Studio toggle, add the deep-link handler, and gate `(app)` on `email_confirmed_at`. Captures the App Store path without paying for it now. Recommended for personal-tool V1. | ✓ |

**User's choice:** Off in V1, document V1.1 flip
**Notes:** Personal-use V1 path — ROADMAP success criterion #1 ("register → lands in (app)") is taken literally. V1.1 deep-link wiring captured in CONTEXT.md `<deferred>` with the full 5-step recipe.

---

## Cold-start session loading & flicker

| Option | Description | Selected |
|--------|-------------|----------|
| Hold splash via expo-splash-screen | `SplashScreen.preventAutoHideAsync()` in `app/_layout.tsx`; only call `SplashScreen.hideAsync()` after the initial `getSession()` resolves. User sees the native iOS splash until session is known — zero flicker, zero custom UI to design. Already half-wired (Expo SDK ships expo-splash-screen by default; app.json has splash plugin). Recommended — native, fast, no design work. | ✓ |
| Custom <AuthGate> loading view | Render a `<View className='flex-1 items-center justify-center'><ActivityIndicator/></View>` while `session === undefined`, then render the actual `<Stack>` once it's `Session | null`. Pure JS, no native splash dance. Simpler mental model but the user briefly sees JS-rendered loading instead of native splash, which feels janky on a cold start. | |
| Both — splash held + redirect-only fallback | Hold splash through first session resolution; if some later auth event leaves session in flux (e.g., manual sign-out mid-render), fall back to the guard's `<Redirect>` without re-showing splash. Belt-and-braces but probably over-engineered for V1. | |

**User's choice:** Hold splash via expo-splash-screen
**Notes:** Native iOS splash is held until `auth-store.status` flips out of `'loading'`. No timeout — `getSession()` is purely local (LargeSecureStore decrypt) so should be sub-100ms. Corrupt-store recovery handled by setting status to 'anonymous' on decrypt error.

---

## Auth state propagation pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Zustand store + onAuthStateChange listener | `useAuthStore()` exposes `{ session, user, status }`. A module-level `supabase.auth.onAuthStateChange((_, session) => useAuthStore.setState({ session }))` keeps it in sync. Components select with `const userId = useAuthStore(s => s.session?.user.id)`. Idiomatic Zustand, zero re-render cascade for screens that don't need the session, easy to mock in tests. Recommended — lightweight, matches ARCH 'Zustand for UI-state' lock since session-presence drives UI. | ✓ |
| TanStack Query useQuery(['session']) | Wrap `supabase.auth.getSession` in a query, and call `queryClient.invalidateQueries(['session'])` from `onAuthStateChange`. Components do `const { data: session } = useSession()`. Free caching + suspense-compat, but it's awkward: there's no network call, the 'query' is a thin wrapper, and `staleTime: Infinity` is required to stop weird refetches. Drag on cognitive overhead vs. Zustand for no real win. | |
| Custom useAuth() hook with useState | A hook that owns `useState<Session | null>` and subscribes to `onAuthStateChange` in `useEffect`. Every screen that calls `useAuth()` re-renders on every auth event. No external store needed. Simplest code today, but every component using it gets re-rendered on every sign-in/out — cheap in V1, fragile when Phase 5+ has many subscribers. | |

**User's choice:** Zustand store + onAuthStateChange listener
**Notes:** Store at `app/lib/auth-store.ts` (Phase 1 D-10 deferred feature-folder convention to Phase 4). Shape: `{ session, status, signOut }`. Module-level listener registered on first import — single source of truth for all consumers. Selector pattern `useAuthStore(s => s.session?.user.id)` minimizes re-renders.

---

## Password validation strictness

| Option | Description | Selected |
|--------|-------------|----------|
| ≥8 chars, no complexity rules | `z.string().min(8, 'Minst 8 tecken')`. Above Supabase's 6-char floor, below the friction wall most ASVS L1 enforcement creates. No 'must contain a number / symbol' rules — those drive users to predictable patterns ('Password1!') and are deprecated by NIST SP 800-63B. Practical default for personal-tool V1. | |
| ≥12 chars per CLAUDE.md security baseline | `z.string().min(12, 'Minst 12 tecken')`. Matches the OWASP ASVS V2.1.1 line in CLAUDE.md ## Conventions. Future-proof for App Store / V1.1 review. Cost: you'll have to type 12 chars yourself every time you sign in on a fresh device. Recommended if you want one-and-done with the security baseline. | ✓ |
| ≥8 + zxcvbn strength score ≥3 | Adds the `zxcvbn-ts` library (~30KB compressed) and refuses passwords whose strength score is <3. Reflects modern guidance better than length alone, but pulls in a new dep for V1 personal use. Probably over-engineered. | |
| Supabase default ≥6 chars | Don't enforce anything in the Zod schema beyond `.min(6)`. Supabase rejects shorter on its end. Simplest. Below the project's stated security baseline. Not recommended. | |

**User's choice:** ≥12 chars per CLAUDE.md security baseline
**Notes:** Sign-up schema enforces `min(12)`; sign-in schema only enforces `min(1)` (server-side validates) so future password rotation or test accounts aren't locked out by client-side schema drift. Error messages in Swedish per app primary-language convention.

---

## Claude's Discretion

Items the user explicitly handed to Claude — captured in CONTEXT.md `<decisions>` "Claude's Discretion" section:

- Exact file path for Zod schemas (`app/lib/schemas/auth.ts` vs alternatives)
- Where the splash-hide effect is triggered (RootLayout `useEffect` vs auth-store init)
- How `queryClient.clear()` is wired into the auth-store sign-out action
- Layout details for `(auth)/sign-up.tsx` and `(auth)/sign-in.tsx` (NativeWind class choices, button arrangement, navigation between screens)
- Exact RHF `mode` configuration (`onBlur` vs `onChange` vs `onSubmit`)
- Sign-out button placement in `(app)` group for V1 (functional, not permanent)
- Whether Phase 3 also creates `(app)/(tabs)/_layout.tsx` skeleton or defers entirely to Phase 4
- Offline-state UX for sign-up/sign-in (banner vs inline error vs nothing)
- Sub-decisions on email-confirmation flow: duplicate-email error copy specifics, V1.1 deferred-entry wording, whether to wire deep-link scheme placeholder preemptively (decided: NO, not preemptively)

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:

- Email-confirmation deep-link flow (V1.1) — full 5-step recipe documented
- Apple Sign-In F14 (V1.1)
- Password reset flow (V1.1)
- Settings screen: change email/password, delete account (V1.1)
- Profile-edit UI for `display_name` / `preferred_unit` (V1.1)
- Sentry / Crashlytics telemetry on auth errors (Phase 7 or V1.1)
- Refresh-token-revoking edge case UX (Phase 7 if observed)
- Client-side rate limiting on sign-in attempts (V1.1 if needed)
- NetInfo-driven offline banner in `(auth)` group (Phase 4 owns the pattern)
- Zustand devtools / persist middleware on auth-store (not needed — Supabase already persists session)
