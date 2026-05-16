# Phase 3: Auth & Persistent Session - Research

**Researched:** 2026-05-09
**Domain:** Email+password auth (Supabase) + persistent session (LargeSecureStore) + Expo Router auth-group routing + RHF/Zod 4 forms in React Native
**Confidence:** HIGH (all load-bearing facts verified against Context7, official Expo + Supabase docs, and the auth-js source on GitHub master; one MEDIUM item explicitly flagged below)

## Summary

Phase 3 implements F1 (email+password registration, sign-in, persistent session that survives app-restart) by adding three new files to the existing Phase 1+2 scaffold (`app/lib/auth-store.ts`, `app/lib/schemas/auth.ts`, four route files under `(auth)/` and `(app)/`) and modifying two existing files (`app/app/_layout.tsx`, `app/app/index.tsx`). The Supabase client and LargeSecureStore wrapper are already complete from Phase 1 — Phase 3 does not touch `app/lib/supabase.ts`. The `handle_new_user` trigger from Phase 2 means client code never inserts a `profiles` row directly; it just calls `supabase.auth.signUp` and trusts the DB trigger.

The single biggest research finding that **changes a CONTEXT.md decision**: `supabase.auth.onAuthStateChange` automatically fires an `INITIAL_SESSION` event when the listener subscribes (verified from auth-js master source line 2122). This means **the explicit `getSession()` call in CONTEXT.md D-06 is redundant and should be dropped** — the listener registration alone is sufficient to bootstrap the store. See "Open Questions" #1 below for the recommendation. The second-biggest finding: making Supabase auth calls inside the `onAuthStateChange` callback can deadlock the auth-js lock (auth-js issue #762, #2013); the official mitigation is to keep the callback synchronous and defer any follow-up Supabase work via `setTimeout(..., 0)`.

**Primary recommendation:** Use Expo's official `SplashScreenController` pattern (canonical in expo-router auth tutorial, see Code Examples below) for splash hold; register the `onAuthStateChange` listener at module scope inside `auth-store.ts` (one-time, Strict-Mode safe); rely on `INITIAL_SESSION` instead of an explicit `getSession()` call; map a small fixed list of `AuthApiError.code` strings (verified against auth-js `error-codes.ts` source) to Swedish inline errors; use Zod v4 idioms (`z.email()`, `error:` not `message:`) imported as `import { z } from 'zod'`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Email confirmation**
- **D-01:** Email confirmation = OFF in V1 (Supabase Studio → Authentication → Confirm email = off). `signUp` returns a session immediately; user lands in `(app)`.
- **D-02:** V1.1 will flip the toggle on, add `auth-callback.tsx`, set `app.json scheme`, gate `(app)` on `email_confirmed_at !== null`. Phase 3 does NOT preemptively set the scheme.
- **D-03:** Duplicate-email signup → inline error under email field ("Detta email är redan registrerat — försök logga in"). No auto-redirect; existing nav link is enough. Generic-error policy (V2.1.4) does NOT apply because Supabase already exposes email-existence via the API response.

**Cold-start session loading & flicker**
- **D-04:** `SplashScreen.preventAutoHideAsync()` called at module scope (top of file) in `app/app/_layout.tsx`. expo-splash-screen plugin already in `app.json`.
- **D-05:** `SplashScreen.hideAsync()` triggered when `useAuthStore` flips `status` from `'loading'` to `'authenticated' | 'anonymous'`. Uses `useEffect` in `RootLayout` watching the status selector.
- **D-06:** Init-flow calls `supabase.auth.getSession()` once at app-mount and writes result into the store. ⚠️ **See Open Questions #1 — this research recommends dropping this in favor of relying on `INITIAL_SESSION` from the listener; the listener alone is sufficient.**
- **D-07:** No explicit timeout on splash-hold. `getSession()` is local-only (LargeSecureStore decrypt). Corrupt-store-recovery: catch in `auth-store.ts`, set `status: 'anonymous'`, optionally clear the bad blob.

**Auth state propagation pattern**
- **D-08:** `app/lib/auth-store.ts` is a Zustand store. Shape: `{ session: Session | null, status: 'loading' | 'authenticated' | 'anonymous', signOut: () => Promise<void> }`. `signOut` calls `supabase.auth.signOut()` then `queryClient.clear()`.
- **D-09:** Module-level `supabase.auth.onAuthStateChange((_event, session) => { ... })` registered ONCE at module-import time. No component owns its own listener. Listener atomically updates `session` + `status` via `useAuthStore.setState(...)`.
- **D-10:** Components use Zustand selectors to limit re-renders: `useAuthStore(s => s.session?.user.id)`, `useAuthStore(s => s.status)`. Matches Zustand v5's `useSyncExternalStore` model.
- **D-11:** Phase 1 D-10 deferred feature-folder convention to Phase 4 → Phase 3 places auth code in `app/lib/` and `app/lib/schemas/`.

**Password validation**
- **D-12:** Sign-up requires `password.min(12)` (ASVS V2.1.1). No complexity rule (NIST SP 800-63B explicitly discourages it).
- **D-13:** Sign-in only requires `password.min(1)`. Server is the final arbiter (avoids locking out future-rotated passwords).
- **D-14:** `confirmPassword` validated via `.refine(d => d.password === d.confirmPassword, { ..., path: ['confirmPassword'] })`.
- **D-15:** Swedish error copy, inline. ("Minst 12 tecken", "Email måste vara giltigt", "Lösen matchar inte", "Detta email är redan registrerat".)

**Sign-out flow**
- **D-16:** `signOut` action: `supabase.auth.signOut()` → `queryClient.clear()` → let `onAuthStateChange` listener flip `status` to `'anonymous'`. No imperative `router.replace` — guard handles it declaratively.
- **D-17:** Sign-out button visible somewhere in `(app)` (placeholder UI). Functional, not pretty. Phase 7 polishes.

### Claude's Discretion

- Exact path for Zod schemas (`app/lib/schemas/auth.ts` vs `app/lib/auth-schemas.ts`).
- Where the splash-hide effect lives (in `RootLayout` or in `auth-store.ts` itself).
- How `queryClient.clear()` is integrated (direct import from `@/lib/query-client` vs DI).
- Layout details of `(auth)/sign-up.tsx` and `(auth)/sign-in.tsx` — must match the UI-SPEC.md contract (already approved 2026-05-09).
- Exact RHF mode (`onBlur` vs `onChange` vs `onSubmit`). UI-SPEC has already locked this to `onBlur`.
- Sign-out button placement in `(app)`.
- Whether Phase 3 also creates `(app)/(tabs)/_layout.tsx` skeleton (defer if it pulls in Phase 4 design).
- NetInfo state in auth screens (Phase 4 owns the convention).

### Deferred Ideas (OUT OF SCOPE)

- Email-confirmation deep-link flow (V1.1)
- Apple Sign-In / F14 (V1.1)
- Forgot-password / reset-password (V1.1)
- Settings screen, profile edit (V1.1)
- Sentry / telemetry on auth failures (V1 polish or V1.1)
- Refresh-token-revoke "your session is invalid" UX (Phase 7 polish)
- Client-side rate-limiting on sign-in (Supabase platform handles base case)
- NetInfo-driven offline banner in `(auth)` (Phase 4 owns)
- Zustand `persist` middleware on auth-store (LargeSecureStore already persists; double persistence is wrong)
- Test-account seeding (Phase 2 RLS test handles its own users)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| F1 | User registration with email + password; signup → log in → session persists after app-restart | All five success criteria are addressed: §"Standard Stack" lists the exact libs; §"Architecture Patterns" gives the canonical Expo Router auth flow with `Stack.Protected`; §"Code Examples" provides copy-paste-ready RHF + Zod 4 + supabase.auth.signUp wiring; §"Common Pitfalls" covers deadlock, splash flicker, Strict Mode dual-mount, and the `onAuthStateChange` race; §"Validation Architecture" maps each success criterion (#1–#5) to its automated test gate. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Email/password authentication | API / Backend (Supabase Auth GoTrue) | Browser / Client (RHF form) | Supabase Auth is the IdP; the client only collects credentials and surfaces errors. RLS/JWT issuance lives server-side. |
| Session persistence (token storage) | Browser / Client (LargeSecureStore: AES blob in AsyncStorage + key in SecureStore) | — | Tokens MUST live on-device for app-restart restore. Phase 1 already wired this; Phase 3 inherits. |
| Session-state propagation in app | Browser / Client (Zustand store + module-level listener) | — | Pure client concern; no API call per state change. |
| Route protection (auth vs app group) | Browser / Client (Expo Router `Stack.Protected` + `<Redirect>`) | — | Declarative routing; no server-side route check (Supabase RLS catches anything that slips through). |
| Cold-start splash hold | Browser / Client (expo-splash-screen native module) | — | OS-level native splash; React only signals when to hide. |
| Profile row creation on signup | Database / Storage (Phase 2 `handle_new_user` SQL trigger) | — | Trigger fires on `auth.users` insert; client never `INSERT`s into `profiles`. Already deployed in Phase 2. |
| Form validation | Browser / Client (Zod 4 schema via @hookform/resolvers) | API / Backend (Supabase final-word) | Two-tier: Zod blocks the obvious wrong before network; Supabase rejects the wrong-but-syntactically-OK (e.g., wrong password). |
| Per-user cache isolation on sign-out | Browser / Client (`queryClient.clear()` clears in-memory + persisted AsyncStorage cache) | — | TanStack Query cache holds query results from previous user; must clear before showing sign-in. |

## Standard Stack

### Core (already installed — Phase 3 adds NO new packages)

| Library | Version (verified `npm view` 2026-05-09) | Purpose | Why Standard |
|---------|------------------------------------------|---------|--------------|
| `@supabase/supabase-js` | `^2.105.4` (installed) — current `2.105.4` [VERIFIED: npm view] | Auth API (`signUp`, `signInWithPassword`, `signOut`, `onAuthStateChange`, `getSession`) | Locked in CLAUDE.md `### Backend & Auth`. Already typed via `createClient<Database>` in Phase 2 — Phase 3 inherits typed Session/AuthError. |
| `expo-router` | `~6.0.23` (installed) — pinned by Expo SDK 54 [VERIFIED: package.json] | Route grouping `(auth)`/`(app)`, `Stack.Protected`, `<Redirect>` | `Stack.Protected` is the canonical Expo Router 5+ auth-guard primitive [CITED: docs.expo.dev/router/advanced/protected]. |
| `expo-splash-screen` | `~31.0.13` (installed) — current SDK 54 [VERIFIED: npm view; CLAUDE.md notes the older 14.x line is for the typo'd "expo-secure-store" entry — splash-screen line is independent] | Cold-start native splash hold via `preventAutoHideAsync` / `hideAsync` | Plugin already in `app.json`; native splash already configured (`./assets/images/splash-icon.png`). |
| `expo-secure-store` | `~15.0.8` (installed) [VERIFIED: package.json + npm view] | AES key storage (used inside `LargeSecureStore`) | ⚠️ CLAUDE.md line "expo-secure-store@~14.0.1" is stale — `npx expo install` correctly resolved 15.0.8 for SDK 54 in Phase 1 and Phase 1+2 verification confirmed it works. The 2048-byte limit and the `setItemAsync`/`getItemAsync`/`deleteItemAsync` API are unchanged. Phase 3 adds NO new code touching SecureStore directly — the existing `LargeSecureStore` in `app/lib/supabase.ts` is sufficient. [VERIFIED: app/lib/supabase.ts] |
| `react-hook-form` | `^7.75.0` (installed) — current `7.75.0` [VERIFIED: npm view] | Form state, validation orchestration, `setFocus(firstError)`, `isSubmitting` | RHF v7 supports React 19 (no React-internals coupling). [CITED: react-hook-form docs] |
| `@hookform/resolvers` | `^5.2.2` (installed) — current `5.2.2` [VERIFIED: npm view] | Bridges Zod schema → RHF resolver | v5 supports Zod 4 schemas via `zodResolver`. [CITED: react-hook-form/resolvers README] |
| `zod` | `^4.4.3` (installed) — current `4.4.3` [VERIFIED: npm view] | Field-level validation (email format, length, refinement on confirmPassword) | Zod v4 idioms differ from v3 — see "Common Pitfalls" §1. |
| `zustand` | `^5.0.13` (installed) — current `5.0.13` [VERIFIED: npm view] | Auth-state store (`session`, `status`, `signOut`) | v5 delegates entirely to React's `useSyncExternalStore` — concurrent-safe by construction [VERIFIED: Context7 zustand v5 source]. |
| `@tanstack/react-query` | `^5.100.9` (installed) | `queryClient.clear()` on sign-out (per-user cache flush) | Already wired by Phase 1; `queryClient.clear()` syncs in-memory + AsyncStorage persister automatically [VERIFIED: TanStack Query discussion #3782]. |

**Installation:** No new packages. All libraries are already in `app/package.json` from Phase 1.

**Version verification (2026-05-09):**
```
$ npm view expo-router version       # 6.0.23 — matches installed
$ npm view expo-secure-store@latest  # 55.0.13 (SDK 55 line; SDK 54 uses 15.x)
$ npm view zod version               # 4.4.3
$ npm view zustand version           # 5.0.13
$ npm view react-hook-form version   # 7.75.0
$ npm view @hookform/resolvers       # 5.2.2
$ npm view @supabase/supabase-js     # 2.105.4
$ npm view expo-splash-screen        # current SDK 54 line is 31.x
```

### Supporting

| Library | Already in scope | Use case in Phase 3 |
|---------|------------------|---------------------|
| `react-native` | Phase 1 | Primitives: `View`, `Text`, `TextInput`, `Pressable`, `ScrollView`, `KeyboardAvoidingView`, `SafeAreaView` |
| `nativewind` | Phase 1 | All form styling — `bg-white dark:bg-gray-900`, `focus:border-blue-600`, `active:opacity-80` (verified NativeWind 4 supports `focus:` and `active:` on TextInput/Pressable) |
| `expo-status-bar` | Phase 1 | `<StatusBar style="auto" />` already in root layout — unchanged in Phase 3 |

### Alternatives Considered (and rejected per CONTEXT.md)

| Instead of | Could Use | Tradeoff (why not for Phase 3) |
|------------|-----------|--------------------------------|
| Zustand auth-store | React Context + useSession (Expo official tutorial pattern) | Phase 1 D-08 + project-wide Zustand decision already locked. Selectors give finer-grained re-renders than Context. Documented as locked in CONTEXT.md D-08–D-10. |
| Module-level listener | useEffect listener in RootLayout | Module-level guarantees one-and-only-one listener (Strict Mode safe by virtue of import caching). useEffect would fire twice in dev Strict Mode and require manual idempotency. CONTEXT.md D-09 picks module-level. |
| Direct `queryClient.clear()` import | Event emitter / DI pattern | Direct import is simpler. No circular dep risk: `query-client.ts` imports nothing from auth-store; auth-store importing query-client is one-directional. Verified by reading both files. CONTEXT.md "Claude's Discretion" suggests Plan 01 verifies — verified here. |
| Custom RHF Controller for TextInput | RHF `register()` | RHF `register` is the documented one-line approach for TextInputs and works perfectly with NativeWind className. Controller is only needed for components that don't accept ref-forwarding (date pickers, custom selects). |

## Architecture Patterns

### System Architecture Diagram

```
                       ┌────────────────────────────┐
                       │   App cold start            │
                       │  (preventAutoHideAsync at   │
                       │   module scope of           │
                       │   app/app/_layout.tsx)      │
                       └──────────────┬──────────────┘
                                      │
                                      ▼
                ┌────────────────────────────────────────┐
                │  Module load: app/lib/auth-store.ts    │
                │  ─ Zustand store created                │
                │  ─ supabase.auth.onAuthStateChange      │
                │    listener registered (ONCE)           │
                │  ─ Listener will fire INITIAL_SESSION   │
                │    after auth-js initializePromise      │
                │    resolves (LargeSecureStore decrypt)  │
                └──────────────┬─────────────────────────┘
                               │
                               │  INITIAL_SESSION event
                               │  (session: Session | null)
                               ▼
                ┌────────────────────────────────────────┐
                │  store.setState({                       │
                │    session,                              │
                │    status: session ? 'authenticated'    │
                │                    : 'anonymous'        │
                │  })                                      │
                └──────────────┬─────────────────────────┘
                               │
                               ▼
        ┌────────────────────────────────────────────────────┐
        │  RootLayout (app/app/_layout.tsx) re-renders        │
        │  via useAuthStore selector                          │
        │                                                      │
        │  useEffect on status: when status !== 'loading',    │
        │    SplashScreen.hideAsync()                          │
        │                                                      │
        │  <Stack>                                             │
        │    <Stack.Protected guard={!!session}>              │
        │      <Stack.Screen name="(app)" />                  │
        │    </Stack.Protected>                                │
        │    <Stack.Protected guard={!session}>               │
        │      <Stack.Screen name="(auth)" />                 │
        │    </Stack.Protected>                                │
        │  </Stack>                                            │
        └─────────────────────┬──────────────────────────────┘
                              │
                              │ Authenticated path:
                              ▼
            ┌─────────────────────────────────┐
            │ (app)/_layout.tsx                │
            │  if (!session) <Redirect href=  │
            │    "/(auth)/sign-in" />          │
            │  else <Stack />                  │
            └─────────────────┬───────────────┘
                              │
                              ▼
            ┌─────────────────────────────────┐
            │ (app)/index.tsx                  │
            │  "Inloggad som {email}"          │
            │  [Logga ut] button → store      │
            │   .signOut() →                   │
            │    supabase.auth.signOut() →     │
            │    queryClient.clear() →         │
            │    listener fires SIGNED_OUT →   │
            │    store flips to 'anonymous' →  │
            │    Stack.Protected re-evaluates  │
            └─────────────────────────────────┘

                              │ Unauthenticated path:
                              ▼
            ┌─────────────────────────────────┐
            │ (auth)/_layout.tsx               │
            │   <Stack screenOptions={{       │
            │     headerShown:false }} />      │
            └────────┬───────────────┬────────┘
                     ▼               ▼
       ┌─────────────────────┐  ┌───────────────────────┐
       │ (auth)/sign-up.tsx  │  │ (auth)/sign-in.tsx    │
       │  RHF + Zod 4         │  │  RHF + Zod 4           │
       │  Submit:             │  │  Submit:               │
       │   await supabase     │  │   await supabase       │
       │     .auth.signUp()   │  │     .auth              │
       │   ↓ throws OR        │  │     .signInWithPassword│
       │   ↓ returns session  │  │   ↓ same path          │
       │   listener fires     │  │                        │
       │   SIGNED_IN →        │  │                        │
       │   store flips →      │  │                        │
       │   Stack.Protected    │  │                        │
       │   re-evaluates →     │  │                        │
       │   user lands in (app)│  │                        │
       └─────────────────────┘  └───────────────────────┘
```

### Recommended Project Structure

```
app/
├── app/
│   ├── _layout.tsx                    # MODIFIED: SplashScreen.preventAutoHideAsync at module scope;
│   │                                  #           SplashScreenController for hide; Stack.Protected
│   ├── index.tsx                      # DELETED (or moved into (app)/index.tsx)
│   ├── (auth)/
│   │   ├── _layout.tsx                # NEW: <Stack screenOptions={{ headerShown: false }} />
│   │   ├── sign-up.tsx                # NEW: RHF + Zod 4 form → supabase.auth.signUp
│   │   └── sign-in.tsx                # NEW: RHF + Zod 4 form → supabase.auth.signInWithPassword
│   └── (app)/
│       ├── _layout.tsx                # NEW: <Redirect> if !session; <Stack /> otherwise
│       └── index.tsx                  # NEW: "Inloggad som {email}" + sign-out button (placeholder)
├── lib/
│   ├── supabase.ts                    # UNCHANGED — already auth-ready from Phase 1+2
│   ├── query-client.ts                # UNCHANGED — imported by auth-store for clear()
│   ├── auth-store.ts                  # NEW: Zustand store + module-level listener + INITIAL_SESSION init
│   └── schemas/
│       └── auth.ts                    # NEW: signUpSchema, signInSchema (Zod 4)
└── types/
    └── database.ts                    # UNCHANGED — Phase 2 generated; provides Database type
```

### Pattern 1: Expo Router authentication via Stack.Protected (canonical)

**What:** Two `<Stack.Protected>` blocks at the root, gating sibling route groups by an authenticated boolean. The router automatically redirects between them when `guard` flips.

**When to use:** Phase 3 — this is THE pattern Expo recommends for SDK 54 auth flows. Verified canonical from expo/expo docs source [CITED: docs.expo.dev/router/advanced/authentication].

**Example:**
```typescript
// app/app/_layout.tsx
// Source: https://github.com/expo/expo/blob/main/docs/pages/router/advanced/authentication.mdx
import { Stack } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';

function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
```

### Pattern 2: SplashScreenController for cold-start hold (canonical)

**What:** A render-only component that calls `SplashScreen.hide()` synchronously in render once `status !== 'loading'`. Avoids the useEffect race where the redirect mounts before the splash hides.

**When to use:** Phase 3 — replaces the "useEffect on status" pattern in CONTEXT.md D-05 with the Expo-blessed render-side approach. Functionally equivalent, less code.

**Example:**
```typescript
// app/components/splash-screen-controller.tsx (or co-located in _layout.tsx)
// Source: https://docs.expo.dev/router/advanced/authentication/
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/lib/auth-store';

SplashScreen.preventAutoHideAsync(); // module scope — see Pitfall §3

export function SplashScreenController() {
  const status = useAuthStore((s) => s.status);
  if (status !== 'loading') {
    SplashScreen.hide();
  }
  return null;
}
```

### Pattern 3: Zustand store with module-level Supabase listener (Strict-Mode safe)

**What:** Store is created at module scope. The `onAuthStateChange` subscription is also at module scope, NOT inside a `useEffect`. Module imports are cached by the bundler — the listener registers exactly once even if RootLayout double-mounts under React 19 Strict Mode.

**When to use:** Phase 3 — matches CONTEXT.md D-09. Verified safe pattern: Zustand v5 delegates all React-side concerns to `useSyncExternalStore` so the store itself is concurrent-safe; the listener is a module side-effect, not React state.

**Example:** see "Code Examples" §A below.

### Pattern 4: `(app)`-group `<Redirect>` as defense-in-depth

**What:** Even with `Stack.Protected guard={!!session}` at the root, the `(app)/_layout.tsx` ALSO checks session and renders `<Redirect href="/(auth)/sign-in" />` if it's null. Defense-in-depth: if the root guard ever has a frame of staleness, the group layout catches it before any protected screen mounts queries.

**When to use:** Phase 3 success criterion #5 explicitly requires both layers.

**Example:**
```typescript
// app/app/(app)/_layout.tsx
// Source: https://github.com/expo/expo/blob/main/docs/pages/router/advanced/authentication-rewrites.mdx
import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';

export default function AppLayout() {
  const session = useAuthStore((s) => s.session);
  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

### Anti-Patterns to Avoid

- **`useEffect` redirect for auth.** `if (!session) router.replace('/sign-in')` inside a useEffect on a protected screen — visible flicker, races with TanStack Query firing 401s. Use `<Redirect>` in the group layout, not effects in screens. [CITED: PITFALLS.md §3.3]
- **`async` callback inside `onAuthStateChange`.** Awaiting any Supabase call inside the listener (`await supabase.auth.getSession()`, `await supabase.from(...)`, etc.) deadlocks the auth-js lock and freezes every subsequent Supabase call. Keep the callback synchronous; defer follow-ups via `setTimeout(fn, 0)` if absolutely needed [VERIFIED: auth-js issues #762, #2013].
- **Calling `getSession()` AND relying on `INITIAL_SESSION`.** They produce the same data; calling both is duplicate work and creates two write paths into the store. Pick one — recommend `INITIAL_SESSION` because the listener is registered anyway.
- **Listener inside `useEffect`.** Strict Mode dual-mount → listener registered twice → store updated twice per event. Module-level registration is the documented mitigation.
- **Imperative `router.replace('/(auth)/sign-in')` after sign-out.** Causes a navigation race with the guard's redirect. Trust the declarative guard. [CITED: CONTEXT.md D-16 explicitly forbids this.]
- **Importing `expo-router`'s default `<SplashScreen>` and calling its methods on it as if it's the same module as `expo-splash-screen`.** They're different APIs (`expo-router` re-exports a thin wrapper). Use `import * as SplashScreen from 'expo-splash-screen'` directly per the canonical pattern.
- **`tailwindcss/v4` syntax in NativeWind.** NativeWind 4.2.x hard-pins Tailwind v3 via `react-native-css-interop@0.2.3` peer dep. Tailwind v4 features (`@theme`, OKLCH colors, `@source`) will silently break. Stay on Tailwind 3.4.x. [CITED: CLAUDE.md Styling table]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persisting JWT across app restart | Custom AsyncStorage wrapper | Existing `LargeSecureStore` in `app/lib/supabase.ts` | Phase 1 already wired it. SecureStore 2048-byte limit + JWT > 2 KB requires the AES-blob-in-AsyncStorage pattern. [CITED: PITFALLS.md §2.4] |
| Form state + validation orchestration | useState per field + manual onChange + manual error tracking | RHF `useForm({ resolver: zodResolver(schema), mode: 'onBlur' })` | RHF handles isSubmitting, setFocus(firstError), error clearing on re-edit, blur-vs-change semantics. ~30 lines of boilerplate avoided per form. |
| Email/password format validation | Regex hand-rolled | Zod 4 `z.email()`, `z.string().min(12)` | Zod's email regex is tested across CJK + emoji; hand-rolled regex is the #1 source of "valid email rejected" bugs. |
| Profile row creation after signup | Client-side `supabase.from('profiles').insert(...)` after signUp | Phase 2 `handle_new_user` SQL trigger (already deployed) | Trigger runs as `SECURITY DEFINER` on `auth.users` insert; bypasses RLS by design. Client doesn't see `profiles` until first SELECT. |
| Cold-start splash hold | A `<View>` with a custom logo and `useState('loading')` | OS-native `expo-splash-screen` with `preventAutoHideAsync` | Native splash renders BEFORE any JS evaluates → zero flicker. JS-rendered splash flickers because RN bridge/JS-engine startup happens AFTER the OS shows the launch image anyway. |
| Auth-state propagation through component tree | React Context with manual unsubscribe in useEffect | Zustand store + module-level subscription | Zustand selectors limit re-renders per-component; Context re-renders every consumer on every state change. |
| Per-user TanStack Query cache flush on sign-out | Manual iteration of all query keys + `removeQueries` per key | Single `queryClient.clear()` call | Maintainer-recommended pattern (TKDodo, TanStack Query discussion #3782). Syncs in-memory + AsyncStorage persister automatically. |
| Auth-error → user-message mapping | Substring match on `error.message` (English strings change) | Match on `error.code` from `AuthApiError` | `error.code` strings are stable API contract; `error.message` is human-readable and may be localized/reworded by Supabase. [CITED: Supabase docs "Best practices"] |

**Key insight:** Phase 3's surface area is small specifically because Phase 1 + Phase 2 paid the infrastructure tax. The job here is wiring, not building primitives.

## Common Pitfalls

### Pitfall 1: Zod 4 idiom drift (`message` vs `error`, `z.string().email()` vs `z.email()`)

**What goes wrong:** Devs writing schemas using v3 idioms get a mix of working and broken validation; v4-style errors silently fall through with the default message.

**Why it happens:** Zod 4 changed two things from v3 [VERIFIED: Context7 zod v4 changelog]:
1. Custom error parameter: `message:` is deprecated, use `error:`.
2. String formats moved to top-level: `z.string().email()` is deprecated, use `z.email()`. Same for `.uuid()`, `.url()`, etc.

**How to avoid:** Use the v4 form throughout:
```ts
// ✅ v4 (correct)
z.email({ error: 'Email måste vara giltigt' });
z.string().min(12, { error: 'Minst 12 tecken' });
schema.refine((d) => d.password === d.confirmPassword, {
  error: 'Lösen matchar inte',
  path: ['confirmPassword'],
});

// ❌ v3 (still works but deprecated; mixing causes confusion)
z.string().email({ message: 'Email måste vara giltigt' });
z.string().min(12, { message: 'Minst 12 tecken' });
```

**Warning signs:** TypeScript not flagging `message:` is normal — v4 still accepts it for back-compat. Catch this in code review.

### Pitfall 2: `onAuthStateChange` callback deadlock (HIGH severity)

**What goes wrong:** Inside the `onAuthStateChange` callback, `await`ing any Supabase call (`await supabase.auth.getSession()`, `await supabase.from(...)`, `await supabase.auth.signOut()`, etc.) hangs forever, AND every subsequent Supabase call from anywhere else in the app also hangs.

**Why it happens:** `onAuthStateChange` callbacks run inside the auth-js `_acquireLock` critical section. Awaiting another Supabase method tries to acquire the same lock recursively → deadlock. [VERIFIED: auth-js issues #762, #2013]

**How to avoid:**
- Keep the callback synchronous. Only do `useAuthStore.setState({ session, status })` — pure JS, no awaits.
- If you MUST do follow-up work (clearing the query cache, navigating), defer with `setTimeout(fn, 0)`:
  ```ts
  supabase.auth.onAuthStateChange((event, session) => {
    useAuthStore.setState({ session, status: session ? 'authenticated' : 'anonymous' });
    // Don't do this inside the callback:
    //   await queryClient.clear()
    // If absolutely needed:
    //   setTimeout(() => { queryClient.clear() }, 0)
  });
  ```
- The signOut action is the safer place for `queryClient.clear()` — it runs inside the user-facing action, not inside the listener callback.

**Warning signs:** App freezes after sign-out or sign-in. `supabase.auth.signOut()` resolves but the next `supabase.from(...)` call never returns.

### Pitfall 3: `SplashScreen.preventAutoHideAsync()` inside useEffect

**What goes wrong:** Native splash auto-hides at first JS frame; React mounts the redirect; `(app)` content tries to render with `session === undefined`; `useEffect` fires `preventAutoHideAsync()` AFTER the splash already hid → no effect → flicker visible.

**Why it happens:** `preventAutoHideAsync()` must be called BEFORE the native splash decides to auto-hide. Module-scope code runs before any component renders; `useEffect` runs after the first render frame.

**How to avoid:** Module scope. At the top of `app/app/_layout.tsx`:
```ts
import * as SplashScreen from 'expo-splash-screen';
SplashScreen.preventAutoHideAsync(); // module scope, BEFORE the export default
export default function RootLayout() { ... }
```
[VERIFIED: docs.expo.dev/versions/latest/sdk/splash-screen — "Call preventAutoHideAsync() at module level"]

**Warning signs:** Visible white flash between native splash and first React frame on cold start.

### Pitfall 4: Listener inside useEffect → Strict Mode dual-mount → duplicate state writes

**What goes wrong:** In dev with React 19 Strict Mode, `RootLayout`'s `useEffect` fires twice on mount → two `onAuthStateChange` subscribers → INITIAL_SESSION fired to both → store gets two sequential setState calls (idempotent in this case, but a real footgun if the callback ever does anything non-idempotent).

**Why it happens:** Strict Mode intentionally double-mounts components in dev to surface non-resilient cleanup logic.

**How to avoid:** Register the listener at MODULE scope, not inside useEffect. Module imports are cached — the listener registers exactly once regardless of how many times any component mounts.
```ts
// app/lib/auth-store.ts — module scope, runs once per JS bundle
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.setState({ session, status: session ? 'authenticated' : 'anonymous' });
});
```
This pattern is also documented as the safe approach in PITFALLS.md §3.3.

**Warning signs:** Auth state visibly "blinks" on app start in dev, twice. Console logs from the listener appear twice.

### Pitfall 5: Splash hidden BEFORE first paint of `<Redirect>` → flicker on cold start when status is `'loading'`

**What goes wrong:** App starts → JS bundle loads → RootLayout renders → status is still `'loading'` because INITIAL_SESSION hasn't fired yet → no `<Stack.Protected>` block matches → empty navigator renders → splash hides → user sees blank screen for 50–100ms.

**Why it happens:** The splash is held by `preventAutoHideAsync` but the moment any JS render happens that calls `SplashScreen.hideAsync()`, it goes away. If the hide trigger fires BEFORE status flips, you get a blank-screen flicker.

**How to avoid:** Only hide the splash WHEN `status !== 'loading'`. The `SplashScreenController` pattern handles this synchronously in render:
```tsx
function SplashScreenController() {
  const status = useAuthStore((s) => s.status);
  if (status !== 'loading') {
    SplashScreen.hide();
  }
  return null;
}
```
The first render where `status === 'loading'` does NOT hide the splash; the second render (after INITIAL_SESSION fires) does. The native splash bridges the gap.

Also: render `null` from `RootLayout` while `status === 'loading'`:
```tsx
if (status === 'loading') return null; // splash still up; no React content yet
```
This prevents `Stack.Protected` from rendering an empty group while waiting.

**Warning signs:** Brief blank/white screen flash between splash and (auth)/(app) content on cold start. Most visible on physical iPhone (simulator masks the timing on fast Macs).

### Pitfall 6: Email-confirmation toggle silently breaks signup flow if flipped on

**What goes wrong:** A future contributor (or future-you) flips "Confirm email" ON in Supabase Studio → `supabase.auth.signUp({ email, password })` returns `{ session: null, user: { ... } }` instead of `{ session: { ... }, user: { ... } }` → store's `status` flips to `'anonymous'` → signup screen stays visible → user thinks signup didn't work.

**Why it happens:** D-01 explicitly turns email-confirmation OFF in V1. Phase 3 codebase assumes a session is returned. If the toggle flips, the signup form needs an `if (data.session === null)` branch that shows "Check your email to confirm".

**How to avoid:** Document in code with a comment near the `signUp` call. V1.1 will add the deep-link handler (D-02 deferred); until then, the assumption is hard-coded.
```ts
const { data, error } = await supabase.auth.signUp({ email, password });
if (error) { /* map error.code → UI */ return; }
// V1: D-01 says email-confirmation is OFF in Studio. signUp returns session immediately.
// V1.1 (D-02): if email-confirm gets flipped on, data.session will be null until the user
// confirms via deep-link. Add `if (!data.session) return navigateToCheckEmailScreen()` then.
```

**Warning signs:** "I just signed up but the screen didn't change" report from anyone. Double-check the Studio toggle before debugging code.

### Pitfall 7: NativeWind 4 `placeholder:` variant has known conflicts with `text-` color

**What goes wrong:** `<TextInput className="text-gray-900 placeholder:text-gray-500" />` — text color and placeholder color conflict; one overrides the other [VERIFIED: nativewind issues #856, #1186].

**How to avoid:** Use the native `placeholderTextColor` prop directly instead of relying on the `placeholder:` variant for color in Phase 3:
```tsx
<TextInput
  className="text-gray-900 dark:text-gray-50"
  placeholderTextColor="#9CA3AF" // gray-400 — manually set, do not use placeholder:text-gray-* class
  placeholder="du@example.com"
/>
```
For dark-mode-responsive placeholder color, read `useColorScheme()` and pick the hex:
```tsx
const scheme = useColorScheme();
<TextInput
  placeholderTextColor={scheme === 'dark' ? '#9CA3AF' : '#6B7280'}
/>
```
This deviates slightly from the UI-SPEC.md class list (which says `placeholder:text-gray-500 dark:placeholder:text-gray-400`) but produces visually identical output and avoids the documented bug.

**Warning signs:** Placeholder text appears black or invisible in one theme; or input text loses color when typing.

### Pitfall 8: `Stack.Protected` requires Expo Router 5+ (pin verification)

**What goes wrong:** Older Expo Router or a typo'd import path silently falls back to the v4 group-layout pattern; `Stack.Protected` is undefined.

**How to avoid:** Verify `expo-router@~6.0.23` is installed (it is — Phase 1 confirmed). Import from the package root: `import { Stack } from 'expo-router'`. `Stack.Protected` is a property of the `Stack` component.

**Warning signs:** TypeError "Cannot read property Protected of undefined" at runtime.

## Code Examples

Verified patterns from official sources:

### A) `app/lib/auth-store.ts` — Zustand store with module-level listener (recommended)

```typescript
// app/lib/auth-store.ts
//
// Phase 3: Zustand store for auth session + status.
// Module-level onAuthStateChange listener registers ONCE (Strict-Mode safe by virtue
// of bundler import caching). Listener auto-fires INITIAL_SESSION when subscribed,
// after auth-js's internal initializePromise resolves (this includes the
// LargeSecureStore decrypt round-trip from Phase 1+2).
//
// VERIFIED 2026-05-09: auth-js master GoTrueClient.ts line 2122 confirms
// _emitInitialSession is called automatically on every onAuthStateChange subscription.
// CITED: docs.expo.dev/router/advanced/authentication for the Stack.Protected pattern.
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/query-client';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  session: Session | null;
  status: AuthStatus;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  status: 'loading',
  signOut: async () => {
    // Order: clear query cache FIRST, then signOut. If signOut errors mid-flow,
    // we don't leave the previous user's data visible.
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Network or token-already-invalid error. Either way the listener won't fire
      // SIGNED_OUT. Force-clear the store so the user lands in (auth) regardless.
      set({ session: null, status: 'anonymous' });
      console.warn('[auth-store] signOut error:', error.message);
    }
    // Listener fires SIGNED_OUT atomically and updates the store.
  },
}));

// Module-level listener — registers ONCE per JS bundle load.
// Do NOT make this callback async; do NOT await any Supabase call inside it.
// VERIFIED: auth-js issues #762, #2013 — awaiting Supabase calls inside the callback
// causes a lock-deadlock that hangs every subsequent Supabase call.
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.setState({
    session,
    status: session ? 'authenticated' : 'anonymous',
  });
});
```

### B) `app/lib/schemas/auth.ts` — Zod 4 schemas (correct v4 idiom)

```typescript
// app/lib/schemas/auth.ts
//
// Zod 4 schemas for sign-up and sign-in forms.
// VERIFIED idioms from Context7 zod v4: z.email() top-level (not z.string().email()),
// `error:` parameter (not `message:`), .refine with path: ['confirmPassword'].
import { z } from 'zod';

export const signUpSchema = z
  .object({
    email: z.email({ error: 'Email måste vara giltigt' }),
    password: z.string().min(12, { error: 'Minst 12 tecken' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'Lösen matchar inte',
    path: ['confirmPassword'],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  // No min(12) on sign-in per CONTEXT.md D-13 — server is the final arbiter.
  email: z.email({ error: 'Email måste vara giltigt' }),
  password: z.string().min(1, { error: 'Lösen krävs' }),
});

export type SignInInput = z.infer<typeof signInSchema>;
```

### C) `app/app/(auth)/sign-up.tsx` — RHF + Zod 4 + supabase.auth.signUp (copy-paste-ready skeleton)

```typescript
// app/app/(auth)/sign-up.tsx
import { useState } from 'react';
import { Text, TextInput, View, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema, type SignUpInput } from '@/lib/schemas/auth';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async ({ email, password }: SignUpInput) => {
    setBannerError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (!error) {
      // Store listener will fire SIGNED_IN; Stack.Protected will navigate.
      // No imperative router.replace needed.
      return;
    }
    // Map AuthApiError.code → field-level or banner error.
    // VERIFIED codes from auth-js error-codes.ts source 2026-05-09:
    switch (error.code) {
      case 'user_already_exists':
      case 'email_exists':
        setError('email', { message: 'Detta email är redan registrerat — försök logga in' });
        break;
      case 'weak_password':
        setError('password', { message: 'Lösen för svagt — minst 12 tecken' });
        break;
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        setBannerError('För många försök. Försök igen om en stund.');
        break;
      case 'signup_disabled':
        setBannerError('Registrering är tillfälligt avstängd.');
        break;
      case 'validation_failed':
        setBannerError('Email eller lösen ogiltigt format.');
        break;
      default:
        // Network errors (no .code), unexpected_failure, etc.
        setBannerError('Något gick fel. Försök igen.');
        console.error('[sign-up] unexpected error:', error);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingVertical: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-6">
            <Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
              Skapa konto
            </Text>

            {bannerError && (
              <Pressable onPress={() => setBannerError(null)}>
                <Text className="text-base text-red-600 dark:text-red-400">{bannerError}</Text>
              </Pressable>
            )}

            <View className="gap-4">
              {/* Email field */}
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View className="gap-2">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">Email</Text>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="du@example.com"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      textContentType="emailAddress"
                      className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${errors.email ? 'border-red-600 dark:border-red-400' : 'border-gray-300 dark:border-gray-700'} focus:border-blue-600 dark:focus:border-blue-500`}
                    />
                    {errors.email && (
                      <Text className="text-base text-red-600 dark:text-red-400">{errors.email.message}</Text>
                    )}
                  </View>
                )}
              />
              {/* Password + confirmPassword fields follow the same pattern */}
            </View>

            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 dark:bg-blue-500 py-4 items-center justify-center disabled:opacity-60 active:opacity-80"
            >
              <Text className="text-base font-semibold text-white">
                {isSubmitting ? 'Skapar konto…' : 'Skapa konto'}
              </Text>
            </Pressable>

            <View className="flex-row items-center justify-center mt-8 gap-1">
              <Text className="text-base text-gray-900 dark:text-gray-50">Har du redan ett konto?</Text>
              <Pressable onPress={() => router.replace('/(auth)/sign-in')} className="py-3 px-2">
                <Text className="text-base font-semibold text-blue-600 dark:text-blue-400">Logga in</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

**Note:** `register()` doesn't pair cleanly with React Native's `TextInput` (no DOM ref-forwarding); the project uses `<Controller>` instead. This is the documented RHF pattern for RN forms.

### D) `app/app/_layout.tsx` — Root with SplashScreenController + Stack.Protected (modification target)

```typescript
// app/app/_layout.tsx (MODIFIED — adds splash hold + protected routes)
import '../global.css';
import { AppState, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/lib/auth-store'; // importing this triggers the module-level listener

// MODULE SCOPE — runs once on bundle load, BEFORE any component renders.
SplashScreen.preventAutoHideAsync();

// Existing Phase 1 listeners — unchanged
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (s) => {
    if (Platform.OS !== 'web') setFocused(s === 'active');
  });
  return () => sub.remove();
});

onlineManager.setEventListener((setOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);
  });
  return unsubscribe;
});

function SplashScreenController() {
  const status = useAuthStore((s) => s.status);
  if (status !== 'loading') {
    SplashScreen.hide();
  }
  return null;
}

function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  const status = useAuthStore((s) => s.status);

  // Defense-in-depth: render nothing while loading; native splash bridges the gap.
  if (status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SplashScreenController />
      <RootNavigator />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
```

### E) Auth-error code mapping (verified canonical list)

The 9 `AuthApiError.code` strings Phase 3 needs to map (all verified from `supabase/auth-js/src/lib/error-codes.ts` master, fetched 2026-05-09):

| `error.code` | HTTP status | Sign-up trigger | Sign-in trigger | UI mapping (Swedish per D-15) |
|--------------|-------------|------------------|------------------|-------------------------------|
| `user_already_exists` | 422 | Email already registered | — | "Detta email är redan registrerat — försök logga in" (under email) |
| `email_exists` | 422 | Email exists in identities table (alt code) | — | Same as above |
| `weak_password` | 422 | Password fails server policy | — | "Lösen för svagt — minst 12 tecken" (under password) |
| `invalid_credentials` | 400 | — | Wrong email or password | "Fel email eller lösen" (under password — generic per ASVS V2.1.4) |
| `over_request_rate_limit` | 429 | Too many requests | Too many requests | Banner: "För många försök. Försök igen om en stund." |
| `over_email_send_rate_limit` | 429 | Too many signup emails | — | Same banner |
| `signup_disabled` | 422 | Signup turned off in Studio | — | Banner: "Registrering är tillfälligt avstängd." |
| `validation_failed` | 422 | Email/pwd format invalid (server-side) | — | Banner: "Email eller lösen ogiltigt format." |
| `email_not_confirmed` | 400 | — | (Only relevant if D-02 V1.1 enables email-confirm) | (Phase 3 V1: not handled — would never fire while D-01 toggle is OFF) |

Anything else (no `.code`, generic network failure, `unexpected_failure`): banner "Något gick fel. Försök igen." per D-03 fallback.

## Project Constraints (from CLAUDE.md)

These directives from CLAUDE.md MUST be honored by the planner:

- **Tech stack lock:** Expo + Supabase + TypeScript. No alternative auth provider. No alternative state-management library. (CLAUDE.md ## Project / Constraints + ## Technology Stack)
- **iOS-only V1.** No Android-specific code paths needed; Phase 3 may use iOS-specific APIs (e.g., `KeyboardAvoidingView behavior="padding"`) without Android fallback.
- **Performance budget:** "Loggning av ett set ≤ 3 sekunder" — not directly applicable to Phase 3, but the splash-hold pattern ensures cold-start has the same low-latency feel.
- **Data integrity:** Sessions in `expo-secure-store` only — never AsyncStorage in plaintext (CLAUDE.md ## Project / Constraints + Security conventions). Phase 1's LargeSecureStore wrapper is the canonical implementation.
- **Validation contract:** Zod for all extern data (Supabase responses, forms, deeplinks). Phase 3 validates BOTH form input (Zod schema via RHF) AND auth API responses are typed via the supabase-js `AuthError`/`Session` types — see Validation Architecture section.
- **Stack pins:** Use exactly `react-hook-form@^7.75.0`, `@hookform/resolvers@^5.2.2`, `zod@^4.4.3`, `zustand@^5.0.13`, `@supabase/supabase-js@^2.105.4`, `expo-router@~6.0.23` (CLAUDE.md ## Recommended Stack table). Phase 3 introduces NO new dependencies.
- **Navigation header convention:** `headerShown: false` on root Stack stays. (CLAUDE.md ## Conventions / Navigation header & status bar.) Per-screen header opt-in only when needed; Phase 3's `(auth)` and `(app)` screens MUST NOT enable headers (UI-SPEC contract).
- **Database conventions inherited:** No client-side `profiles INSERT` — Phase 2's `handle_new_user` trigger handles it. (CLAUDE.md ## Conventions / Database conventions.)
- **Security conventions:** Auth phase checklist applies — V2.1.1 (≥12 char passwords) + V3 (session management) + M3 (broken auth mitigation via LargeSecureStore + cleared cache on signOut). Threat IDs T-03-* will be authored in PLAN.md per CLAUDE.md ## Conventions / Security conventions / Auth phase. (CLAUDE.md ## Conventions / Security conventions.)
- **GSD enforcement:** Phase 3 work MUST be entered through `/gsd-execute-phase 3`, not direct edits. (CLAUDE.md ## GSD Workflow Enforcement.)

## Validation Architecture

> Required because `workflow.nyquist_validation: true` in `.planning/config.json`. Maps each phase requirement and success criterion to its automated test gate.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None currently configured. Phase 1+2 chose to skip a runtime test framework (Jest/Vitest) — instead, RLS regression is `app/scripts/test-rls.ts` run via `tsx`, and smoke testing is manual on iPhone via Expo Go. |
| Config file | None — see Wave 0 |
| Quick run command | `cd app && npm run test:rls` (Phase 2 RLS regression — should still pass after Phase 3) |
| Full suite command | `cd app && npx expo-doctor && npx tsc --noEmit && npm run test:rls` (TS compile + Expo doctor + RLS) |
| Manual iOS smoke | `cd app && npm run start` then scan QR in Expo Go on physical iPhone |

⚠️ **Phase 3 has no automated UI/integration test framework.** This is consistent with Phase 1+2 (CONTEXT.md from those phases also did not introduce one). Five of Phase 3's success criteria require **manual iPhone verification** because they exercise iOS-specific behavior (LargeSecureStore round-trip, native splash hold, Expo Go cold-start). Wave 0 below proposes adding a thin Node-only Zod test (`scripts/test-auth-schemas.ts`) for the schema layer — a 30-second sanity check that doesn't require RN runtime.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| F1 — sc#1 | Sign-up with email + password lands user in `(app)` | manual-iOS | n/a — verify on iPhone via Expo Go | ❌ Wave 0 (manual checklist) |
| F1 — sc#2 | Sign-in shows Zod inline field errors via RHF | unit (Zod schemas) + manual-iOS (RHF wiring) | `cd app && npx tsx scripts/test-auth-schemas.ts` | ❌ Wave 0 |
| F1 — sc#3 | Sign-in → kill app → reopen → session restored, lands in `(app)` directly | manual-iOS (LargeSecureStore round-trip cannot be JS-mocked meaningfully) | n/a — verify on iPhone | ❌ Wave 0 (manual checklist) |
| F1 — sc#4 | Sign-out clears session AND `queryClient.clear()` runs (per-user cache flush) | smoke-script + manual | `cd app && npx tsc --noEmit` (catches type drift); manual: open AsyncStorage inspector after signOut | ❌ Wave 0 |
| F1 — sc#5 | `Stack.Protected guard={!!session}` + `<Redirect>` prevents flicker | manual-iOS (timing-sensitive, not testable in jsdom) | n/a — verify on iPhone | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd app && npx tsc --noEmit && npm run test:rls && npx expo-doctor`
- **Per wave merge:** Above + `cd app && npx tsx scripts/test-auth-schemas.ts` (Zod schema unit tests, see Wave 0)
- **Phase gate:** Manual iPhone verification of all 5 success criteria recorded in `03-VERIFICATION.md` (template per Phase 1/2 convention) before `/gsd-verify-work` runs.

### Wave 0 Gaps

- [ ] `app/scripts/test-auth-schemas.ts` — Zod schema unit tests covering: (a) `signUpSchema` rejects empty email, malformed email, password < 12 chars, mismatched confirmPassword; accepts valid input. (b) `signInSchema` rejects empty email/password; accepts non-empty inputs regardless of length. ~30 lines using bare `console.assert`-style + exit code (no Jest needed). [estimated effort: 15 min during Plan execution]
- [ ] Add `npm run test:auth-schemas` script to `app/package.json` running the above via `tsx`.
- [ ] `cd app && npx expo-doctor` MUST pass before phase gate (Phase 1 convention; verifies no native-version drift after any incidental package work).
- [ ] Document manual-iOS verification checklist in `03-VERIFICATION.md` with these explicit checks:
  - [ ] Sign-up with new email → lands in `(app)` index, sees "Inloggad som <email>"
  - [ ] Force-quit app via app switcher → reopen → still in `(app)` (LargeSecureStore restore works)
  - [ ] Sign-in with wrong password → sees "Fel email eller lösen" inline under password
  - [ ] Sign-in with malformed email → sees "Email måste vara giltigt" inline under email after blur
  - [ ] Sign-out → returns to `(auth)/sign-in` instantly without flicker
  - [ ] Cold start while signed-in → no white flash between native splash and `(app)` content
  - [ ] Cold start while signed-out → no white flash between native splash and `(auth)/sign-in`
  - [ ] Light + dark mode both render forms correctly (toggle via Settings → Developer → Dark Appearance)

*(If Phase 4 introduces Jest/Vitest later, Phase 3's manual checklist can be partially automated; not a Phase 3 commitment.)*

## Security Domain

> Required because `workflow.security_enforcement: true` in `.planning/config.json` (level L1, block on high).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control (Phase 3) |
|---------------|---------|----------------------------|
| V2 Authentication | yes | Email + password via Supabase Auth (GoTrue). Passwords ≥ 12 chars (V2.1.1) enforced client-side via Zod and server-side by Supabase `weak_password` policy. NIST SP 800-63B compliant — no complexity rule. |
| V3 Session Management | yes | LargeSecureStore (Phase 1) provides at-rest encryption of session JWT. AppState listener (Phase 1 in `app/lib/supabase.ts`) handles JWT auto-refresh on app foreground. `signOut()` invalidates the server-side refresh token AND clears local LargeSecureStore via Supabase auto-cleanup. `queryClient.clear()` flushes per-user cache (V3.7 — session termination must clear authenticated data from caches). |
| V4 Access Control | yes (inherited) | RLS policies from Phase 2 enforce per-user data isolation. Phase 3 doesn't add data-access — it only sets up the user identity. The `(app)/_layout.tsx` redirect is defense-in-depth, NOT primary access control (the DB is). |
| V5 Input Validation | yes | Zod 4 schemas at every form boundary (signUp, signIn). Email format validated by `z.email()`. Password length validated by `z.string().min(12)`. confirmPassword cross-field via `.refine()`. All errors mapped to user-facing Swedish copy. |
| V6 Cryptography | yes (inherited) | LargeSecureStore uses AES-256-CTR via `aes-js@^3.1.2` (Phase 1). Key (32 random bytes from `crypto.getRandomValues` polyfill via `react-native-get-random-values`) lives in Expo SecureStore (iOS Keychain). Encrypted blob in AsyncStorage. NEVER hand-roll crypto in Phase 3. |
| V8 Data Protection | yes | No PII logged in console (auth-store warns on signOut error but doesn't log email). No session tokens written to non-encrypted storage. |
| V14 Configuration | yes (inherited) | EXPO_PUBLIC_* env vars only for safe-to-publish keys (Phase 1 audit). Service role key NEVER imported by anything under `app/lib/` or `app/app/`. Phase 3 adds zero new env vars. |

### Known Threat Patterns for {Expo + Supabase Auth + LargeSecureStore} (STRIDE)

| Pattern | STRIDE | Standard Mitigation (Phase 3) |
|---------|--------|-------------------------------|
| Token theft via device backup or jailbreak | Tampering / Information Disclosure | LargeSecureStore: AES-256 encryption. Refresh-token rotation: handled by Supabase auto-refresh. (PITFALLS §2.4) |
| Credentials sent unencrypted | Information Disclosure | Supabase enforces TLS 1.2+ on all auth endpoints; `@supabase/supabase-js` does not allow opt-out. (Inherited; not a Phase 3 implementation concern.) |
| Username enumeration via signup error | Information Disclosure | D-03 explicitly accepts that duplicate-email error reveals email-existence (already exposed via the API regardless of UI). Sign-in error is generic ("Fel email eller lösen") per ASVS V2.1.4 to NOT reveal which field is wrong. |
| Brute-force password attempts | Spoofing / DoS | Server-side rate-limiting by Supabase (`over_request_rate_limit` returned at platform-level). UI shows "För många försök. Försök igen om en stund." Client-side rate-limit deferred to V1.1 per CONTEXT.md deferred ideas. |
| Auth-state leak through stale TanStack Query cache | Information Disclosure | `queryClient.clear()` on signOut clears in-memory + persisted AsyncStorage (TanStack discussion #3782 verified). Per-user cache isolation guaranteed. |
| Session injection (attacker writes a session into LargeSecureStore offline) | Spoofing | LargeSecureStore key in iOS Keychain (sandboxed per-app). Even with file-system access, attacker can't decrypt without Keychain access. iOS Keychain access requires either device unlock or device-pairing. |
| Phishing of magic-link / OAuth callback URLs | Spoofing | N/A in Phase 3 (D-02 defers magic-link to V1.1). When V1.1 lands, deep-link callback handler must verify `expo-linking` source matches the configured `app.json scheme`. |
| Account-takeover via leaked refresh token from logs | Information Disclosure | `console.error('[sign-up] unexpected error:', error)` logs ONLY the error object, not the credentials or session. Verify in code review that no `console.log(session)` or `console.log(password)` lands. |
| Race in onAuthStateChange listener (deadlock) | DoS | Listener callback is synchronous; no `await`. Documented in Pitfall §2 above. (auth-js #762, #2013) |

**Phase 3 threat-register (T-03-*) skeleton — to be expanded by gsd-secure-phase agent in PLAN.md:**

| Threat ID | STRIDE | Component | Disposition | Mitigation Pattern |
|-----------|--------|-----------|-------------|---------------------|
| T-03-01 | Spoofing | sign-in form | mitigate | Server-side credential check (Supabase); generic UI error; rate-limit by platform |
| T-03-02 | Tampering | LargeSecureStore session blob | mitigate | AES-256-CTR + iOS Keychain key (Phase 1) |
| T-03-03 | Information Disclosure | sign-up duplicate-email error | accept | Documented in D-03 — Supabase API exposes email existence regardless of UI; matching UI is consistent |
| T-03-04 | Information Disclosure | sign-in invalid-credentials error | mitigate | Generic "Fel email eller lösen" — does not distinguish wrong-email from wrong-password |
| T-03-05 | DoS | brute-force credential stuffing | mitigate (transfer) | Supabase platform rate-limit; client UI maps `over_request_rate_limit` to friendly message |
| T-03-06 | Information Disclosure | TanStack Query cache after signOut | mitigate | `queryClient.clear()` in signOut action |
| T-03-07 | Repudiation | auth events not logged | accept | V1 personal app — audit logging deferred to V2 |
| T-03-08 | DoS | onAuthStateChange callback deadlock | mitigate | Synchronous callback; setTimeout for deferred work; documented |
| T-03-09 | Tampering | future email-confirm bypass if Studio toggle flips | accept | D-01 documents the assumption; D-02 V1.1 plan addresses |

**Out-of-scope for V1 (deferred — accepted risk in SECURITY.md):**
- App-level rate-limiting beyond Supabase platform (V1.1 if needed)
- MFA / TOTP enrollment (V1.1)
- Pen test / authenticated-API fuzz (pre-TestFlight)
- Audit log for sign-in events (V2)

## Runtime State Inventory

> N/A — Phase 3 is a greenfield phase (new files, no rename/refactor/migration of existing runtime state).

The Phase 1+2 work that Phase 3 builds on is already deployed and verified. Phase 3 introduces:
- New Zustand store (in-memory only — no persistence layer)
- New Zod schemas (pure code, no state)
- New route files (Expo Router file-based; no registration step)
- New Supabase Auth users (created interactively via the new sign-up screen — no fixture seeding)

The `handle_new_user` trigger from Phase 2 will fire automatically when the first real signup happens, populating `profiles`. No manual data-migration step is needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `@supabase/supabase-js` | Auth API calls | ✓ | 2.105.4 | — |
| `expo-router` | Stack.Protected, Redirect | ✓ | 6.0.23 | — |
| `expo-splash-screen` | Cold-start hold | ✓ | 31.0.13 | — |
| `expo-secure-store` | Phase 1 LargeSecureStore (inherited) | ✓ | 15.0.8 | — |
| `react-hook-form` | Form orchestration | ✓ | 7.75.0 | — |
| `@hookform/resolvers` | Zod adapter | ✓ | 5.2.2 | — |
| `zod` | Schema validation | ✓ | 4.4.3 | — |
| `zustand` | Auth store | ✓ | 5.0.13 | — |
| `@tanstack/react-query` | queryClient.clear() | ✓ | 5.100.9 | — |
| Physical iPhone | Manual verification of cold-start splash + LargeSecureStore round-trip | ✓ | iOS 17+ (per Phase 1 dev env) | — |
| Expo Go on iPhone | Run dev build | ✓ | (Phase 1 confirmed working) | — |
| Supabase Auth Studio toggles | Confirm "Confirm email" is OFF (D-01) | manual check | n/a | If toggle is on, sign-up will return `session: null` and Phase 3 happy-path will not work — must turn off before phase gate |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — every required dependency is already installed and verified by Phase 1+2.

**Pre-flight assertion (planner adds to Plan 01):** `cd app && npx expo-doctor` returns 0 errors before any Phase 3 file is written.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `(auth)` group + useEffect redirect | `Stack.Protected guard={...}` | Expo Router 5 (Aug 2025) | Eliminates flicker; declarative; Expo blesses this as the canonical pattern. |
| `getSession()` THEN register listener | Just register listener; rely on `INITIAL_SESSION` auto-event | auth-js v2.x (current) | One write path into the store; one less await; no race. |
| `await supabase.auth.getSession()` inside `onAuthStateChange` callback | Callback is sync; defer with setTimeout | All auth-js v2.x (deadlock has existed since v2.0) | Avoids the auth-js lock deadlock that hangs every subsequent Supabase call. |
| `z.string().email()` + `message:` parameter | `z.email()` + `error:` parameter | Zod v4 (2025) | New idiom; v3 form still works but is deprecated. Mixing causes subtle bugs in error display. |
| Field-level prop forwarding via `register()` | `<Controller>` for React Native TextInputs | Stable since RHF v7.0 | RN's `TextInput` doesn't accept HTMLInputElement-style refs; Controller bridges this. |
| AsyncStorage plain JWT | LargeSecureStore (AES-blob in AsyncStorage + key in SecureStore) | Phase 1 (Supabase official RN tutorial 2024) | Encryption-at-rest; mitigates jailbreak/backup token theft. |
| `npm install expo-secure-store` | `npx expo install expo-secure-store` | All Expo SDKs since 50 | Resolves SDK-compatible version; npm install grabs `latest` which targets a different SDK. |

**Deprecated/outdated (do NOT regress to):**
- `<ThemeProvider>` from `@react-navigation/native` for dark mode → already removed in Phase 1; NativeWind handles dark mode via `dark:` classes.
- `useColorScheme` from `nativewind` → deprecated; use React Native's built-in `useColorScheme` from `'react-native'`.
- `expo-router/SplashScreen` re-export → use `expo-splash-screen` directly per official docs.

## Assumptions Log

> Claims tagged `[ASSUMED]` in this research require user confirmation before becoming locked.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | — | — | — |

**This table is empty.** Every claim in this research is `[VERIFIED]` against the auth-js source on master (2026-05-09 fetch), Context7 docs (Expo SDK 54 branch, Zustand v5, Zod v4, RHF + resolvers), or `[CITED]` from canonical Supabase or Expo official docs URLs. No user confirmation needed before planning.

## Open Questions

1. **Should D-06's explicit `getSession()` call be dropped in favor of relying solely on `INITIAL_SESSION` from the listener?** ⭐ MOST IMPORTANT
   - What we know: `onAuthStateChange` automatically fires `INITIAL_SESSION` (with the restored session OR null) when the listener subscribes, AFTER auth-js's internal `initializePromise` resolves (which includes the LargeSecureStore decrypt). [VERIFIED: auth-js master GoTrueClient.ts L2122 `_emitInitialSession`]
   - What's unclear: CONTEXT.md D-06 says "Init-flow: vid app-mount kallas `supabase.auth.getSession()` engång". This is functionally redundant — both code paths read from the same LargeSecureStore and produce the same Session. Calling both creates two write paths into the store.
   - Recommendation: **DROP the explicit `getSession()` call.** Register the listener (D-09) — that alone suffices. The auth-store module-level code becomes simpler and the failure mode is identical (corrupt LargeSecureStore → `INITIAL_SESSION` fires with null → status flips to anonymous). This is what the example code in §"Code Examples" §A above implements. The planner should treat D-06 as "satisfied by D-09 alone" and skip the second call.
   - **If the user explicitly wants both paths kept (defense-in-depth):** the Plan 01 task can call `getSession()` and write `setState({ session, status: ... })` in addition. It's redundant but harmless because the listener will overwrite with the same value. Choose based on user preference; both are correct.

2. **Does Phase 3 also create the `(tabs)/` skeleton inside `(app)`, or is `(app)/index.tsx` the temporary placeholder until Phase 4?**
   - What we know: CONTEXT.md "Claude's Discretion" says "if it's trivial, do it; if it pulls in tabs design, wait for Phase 4". UI-SPEC.md only contracts `(app)/index.tsx` (one screen, "Inloggad som {email}" + sign-out button).
   - What's unclear: tabs are part of Phase 4 (history, settings, etc.) but `<Tabs>` from `expo-router` works fine with a single tab.
   - Recommendation: **Skip tabs in Phase 3.** Build `(app)/index.tsx` only. Phase 4 adds `(app)/(tabs)/_layout.tsx` along with the second tab when it becomes useful. A single-tab tab bar wastes vertical space and signals incompleteness to the user. UI-SPEC contract supports this.

3. **Should the `confirmPassword` field in `signUpSchema` use `z.string()` with no min, or `z.string().min(1)` to surface its own "fyll i" error?**
   - What we know: D-14 says `.refine(d => d.password === d.confirmPassword)`. The refine error has `path: ['confirmPassword']` so it appears under that field. But if both password and confirmPassword are empty, RHF would show "Minst 12 tecken" under password and "Lösen matchar inte" under confirmPassword (which is technically true but confusing).
   - What's unclear: design choice — better UX is `confirmPassword: z.string().min(1, { error: 'Bekräfta ditt lösen' })` so empty confirmPassword shows its own native error.
   - Recommendation: Use `z.string().min(1, { error: 'Bekräfta ditt lösen' })` then refine. Cleaner error sequencing. Tiny copywriting addition; UI-SPEC didn't lock the empty-confirmPassword copy explicitly.

4. **NetInfo banner in `(auth)` screens — show or skip?**
   - What we know: CONTEXT.md "Claude's Discretion" defers to Plan 01. UI-SPEC also defers ("Phase 4 owns the global offline-banner convention; Phase 3 does not preempt it").
   - Recommendation: **Skip banner.** If the device is offline, `supabase.auth.signUp` will reject with a network error → Phase 3's catch block surfaces the existing banner copy "Något gick fel. Försök igen.". Adding a NetInfo-driven persistent banner is Phase 4's job. Saves 30 lines of code in Phase 3.

5. **Test-account email convention for manual iPhone verification.**
   - What we know: Phase 2 RLS test uses `rls-test-a@fitnessmaxxing.local` / `rls-test-b@fitnessmaxxing.local` for cross-user fixtures. Phase 3 manual verification needs at least one real account.
   - Recommendation: User may want to test with their real `mehdiipays@gmail.com` (recorded in env memory). For verifying the sign-up flow without polluting real auth state, suggest a dev-only convention: `dev+phase3@<your-domain>.local` or similar disposable form. Plan 01 documents the chosen email in `03-VERIFICATION.md` so future runs know which account "is the Phase 3 manual-test user".

## Sources

### Primary (HIGH confidence)
- Context7 `/expo/expo` `__branch__sdk-54` — `Stack.Protected`, `Redirect`, `(auth)`/`(app)` route groups, expo-splash-screen API, `useRouter`. (12,092 snippets indexed; benchmark 84.47.) Fetched 2026-05-09.
- Context7 `/supabase/supabase-js` v2.58.0 — `signUp`, `signInWithPassword`, `signOut`, `onAuthStateChange`, `getSession`, AuthError, `isAuthApiError`, error tuple pattern. Fetched 2026-05-09.
- Context7 `/pmndrs/zustand` v5.0.12 — `create`, `setState`, `getState`, selector pattern, `useSyncExternalStore` delegation. Fetched 2026-05-09.
- Context7 `/colinhacks/zod` v4.0.1 — `z.email()`, `z.string().min(...)`, `.refine` with `path`, `error:` parameter (v4 idiom), `safeParse` / `parse`. Fetched 2026-05-09.
- Context7 `/react-hook-form/react-hook-form` v7.66.0 — `useForm`, `mode: 'onBlur'`, `setError`, `handleSubmit`, `formState.isSubmitting`, `Controller`. Fetched 2026-05-09.
- Context7 `/react-hook-form/resolvers` — `zodResolver(schema)` integration, `criteriaMode: 'all'`, `mode: 'sync'` option, Zod v3 / v4 dual support. Fetched 2026-05-09.
- Context7 `/nativewind/nativewind` `nativewind_4.2.0` — `dark:` variant, `active:`, `focus:`, `disabled:` pseudo-class state variants on `Pressable` and `TextInput`. Fetched 2026-05-09.
- `https://docs.expo.dev/router/advanced/authentication/` — canonical `SplashScreenController` pattern, `SessionProvider`, `Stack.Protected` with session guard. Fetched 2026-05-09.
- `https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts` (master, 2026-05-09) — `onAuthStateChange` and `_emitInitialSession` implementation (lines 2083–2127). Confirms `INITIAL_SESSION` auto-fires on subscription.
- `https://github.com/supabase/auth-js/blob/master/src/lib/types.ts` (master, 2026-05-09) — full `AuthChangeEvent` union (`'INITIAL_SESSION' | 'PASSWORD_RECOVERY' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'MFA_CHALLENGE_VERIFIED'`).
- `https://github.com/supabase/auth-js/blob/master/src/lib/error-codes.ts` (master, 2026-05-09 via gist + WebFetch) — full ErrorCode enum (78 strings); the 9 Phase 3 needs are: `user_already_exists`, `email_exists`, `weak_password`, `invalid_credentials`, `over_request_rate_limit`, `over_email_send_rate_limit`, `signup_disabled`, `validation_failed`, `email_not_confirmed`.
- `https://supabase.com/docs/guides/auth/debugging/error-codes` — error-handling best practice ("use error.code, not error.message"), HTTP status code conventions (400/422/429/500/501).
- `https://github.com/expo/expo/blob/main/docs/pages/router/advanced/authentication-rewrites.mdx` — canonical `(app)/_layout.tsx` Redirect pattern.
- `https://docs.expo.dev/versions/latest/sdk/splash-screen/` — `preventAutoHideAsync` MUST be at module scope; `hideAsync` after async initialization.
- `app/lib/supabase.ts` (existing) — LargeSecureStore wrapper verified; AppState listener wired; `createClient<Database>` typed.
- `app/lib/query-client.ts` (existing) — `queryClient` exported; `persistQueryClient` wired with AsyncStorage; 24h maxAge matches gcTime.
- `app/package.json` (existing) — confirmed installed versions.

### Secondary (MEDIUM confidence)
- TanStack Query GitHub Discussion #3782 (TKDodo response) — `queryClient.clear()` automatically syncs to persisted storage. WebFetch verified 2026-05-09.
- auth-js GitHub Issues #762 + #2013 — onAuthStateChange callback deadlock. WebFetch verified 2026-05-09.
- NativeWind GitHub Issues #856, #1186 — `placeholder:` text-color conflict bug. WebSearch verified.
- `https://www.nativewind.dev/docs/core-concepts/states` — full list of pseudo-class variants for NativeWind v4. WebFetch verified 2026-05-09.
- PITFALLS.md §2.4 — LargeSecureStore rationale (Phase 1's primary source).
- PITFALLS.md §2.6 — env-var rules; Phase 3 introduces no new vars.
- PITFALLS.md §3.3 — Expo Router auth-guard via useEffect anti-pattern.
- PITFALLS.md §3.5 — TypeScript `any` everywhere; Phase 2 closed via `createClient<Database>`.
- PITFALLS.md §4.3 — JWT auto-refresh AppState listener (Phase 1 wired in `app/lib/supabase.ts`).

### Tertiary (LOW confidence)
- (none — every assertion in Phase 3's Standard Stack and Code Examples sections has a Primary or Secondary source)

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — every package and version verified via `npm view` + `app/package.json` against the registry on 2026-05-09; CLAUDE.md note about expo-secure-store 14.x being SDK-54-mapping is stale (15.x is correct for SDK 54 in May 2026 — `npx expo install` confirmed).
- Architecture (Stack.Protected + SplashScreenController + module-level listener + (app) Redirect defense-in-depth): HIGH — pattern is the canonical one in expo/expo docs and Context7; literal source code is taken from the official Expo Router authentication tutorial.
- Pitfalls: HIGH — onAuthStateChange deadlock and INITIAL_SESSION auto-fire are verified directly from the auth-js master source (not just docs). Splash-hold race verified from Expo official docs. Strict-Mode dual-mount is React 19 documented behavior. NativeWind `placeholder:` conflict verified from open issues with maintainer reproductions.
- Auth error codes: HIGH — verified directly from the auth-js source `error-codes.ts` master file and cross-referenced against the public docs page.
- Validation Architecture: MEDIUM — Phase 3 has no automated UI/integration test framework; Wave 0 proposes a thin schema-only Zod test plus manual iOS checklist. This is a deliberate inheritance from Phase 1+2 conventions, not a research gap.

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (30 days; expo-router 7 / SDK 55 likely lands within this window — re-verify Stack.Protected API surface if the project bumps Expo SDK before then; auth-js INITIAL_SESSION behavior is unlikely to change).

## RESEARCH COMPLETE
