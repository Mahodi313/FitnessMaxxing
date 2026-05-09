---
phase: 03-auth-persistent-session
reviewed: 2026-05-09T14:00:00Z
fixed_at: 2026-05-09T15:30:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - app/app/_layout.tsx
  - app/app/(auth)/_layout.tsx
  - app/app/(auth)/sign-in.tsx
  - app/app/(auth)/sign-up.tsx
  - app/app/(app)/_layout.tsx
  - app/app/(app)/index.tsx
  - app/lib/auth-store.ts
  - app/lib/schemas/auth.ts
  - app/scripts/test-auth-schemas.ts
  - app/package.json
findings:
  critical: 0
  warning: 0
  info: 4
  total: 11
fixed_findings: [CR-01, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06]
status: fixed
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-09T14:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 3 ships an F1 vertical slice (auth + persistent session) that mostly honors the locked decisions documented in `03-CONTEXT.md` (D-01 through D-16). RHF + Zod 4 wiring is correct, the `Stack.Protected` declarative routing pattern is implemented end-to-end, and security conventions (no service-role leak, LargeSecureStore, no PII in AsyncStorage plaintext) hold. Schema unit tests are thorough.

However, the review surfaces one **BLOCKER**: a state-overwrite race in `auth-store.ts` between the bootstrap `getSession()` Promise and the `onAuthStateChange` listener that can spuriously sign out an authenticated user when `getSession()` rejects after a successful `INITIAL_SESSION`. Six **WARNING**-class issues affect robustness: a missing symmetric `<Redirect>` defense-in-depth in `(auth)/_layout.tsx`, side-effect-during-render in `SplashScreenController`, an unhandled `preventAutoHideAsync()` rejection, an unguarded `AppState` listener in `supabase.ts` that can leak under Fast Refresh, the unmapped `error.code` path already flagged in `03-VERIFICATION.md` Issue 1, and a sign-out ordering window that lets in-flight queries repopulate the cache between `queryClient.clear()` and the actual sign-out completing.

## Critical Issues

### CR-01: Race between `getSession()` bootstrap and `onAuthStateChange` listener can sign out an authenticated user

**File:** `app/lib/auth-store.ts:61-84`
**Issue:** Two module-scope async paths write `session/status` with no ordering guarantee:

1. `supabase.auth.onAuthStateChange((_event, session) => useAuthStore.setState({...}))` — fires `INITIAL_SESSION` shortly after registration with the resolved session.
2. `void supabase.auth.getSession().then(...).catch(...)` — also writes session/status, with a `.catch` that **unconditionally sets `{ session: null, status: 'anonymous' }`** on any rejection.

The `.catch` is the dangerous arm. Sequence that breaks the user:

- `t=0` — listener registers; Supabase begins reading the encrypted session blob from `LargeSecureStore`.
- `t=10ms` — `INITIAL_SESSION` fires with a valid session → store flips to `{session: <real>, status: 'authenticated'}`.
- `t=20ms` — `getSession()` Promise rejects (transient I/O hiccup, AsyncStorage being warmed by another caller, simulator clock skew, decrypt-during-rotate, etc.) → catch fires → store overwrites to `{session: null, status: 'anonymous'}`.
- The user is rendered to `(auth)/sign-in`, even though their session is valid and persisted.

The header comment claims the two writes are "idempotent and harmless," but that is only true on the **success** paths (both resolve to the same Session). The catch path is **not** symmetric — it doesn't compare against current state and unconditionally clobbers. The `auth-store.ts` comment block even acknowledges D-06 redundancy ("If a future revision drops D-06, delete the bootstrap() block; the listener alone suffices") — that confirms the bootstrap is doing nothing useful on the happy path while introducing this regression on the failure path.

**Fix:** Either (a) drop the bootstrap entirely and rely on `onAuthStateChange`'s built-in `INITIAL_SESSION` (the recommended path per RESEARCH.md Q1), or (b) make the catch path read-modify-write so it only clears when the listener has not already authenticated.

```ts
// Option A — recommended: drop the bootstrap entirely.
// onAuthStateChange auto-fires INITIAL_SESSION; the bootstrap is redundant.
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.setState({
    session,
    status: session ? "authenticated" : "anonymous",
  });
});
// (delete the void supabase.auth.getSession()... block entirely)

// Option B — keep D-06, but never overwrite an already-resolved authenticated state.
void supabase.auth
  .getSession()
  .then(({ data: { session } }) => {
    useAuthStore.setState((prev) =>
      prev.status === "loading"
        ? { session, status: session ? "authenticated" : "anonymous" }
        : prev, // listener already won — do nothing
    );
  })
  .catch((err) => {
    console.warn("[auth-store] getSession init failed:", err);
    useAuthStore.setState((prev) =>
      prev.status === "loading"
        ? { session: null, status: "anonymous" }
        : prev, // listener already authenticated — don't clobber
    );
  });
```

If D-06 is keeping the bootstrap for symmetry/auditability, Option B preserves it without the regression. If D-06 can be revisited (the comment block already flags it as redundant), Option A is cleaner and closes a class of races permanently.

## Warnings

### WR-01: Missing `<Redirect>` defense-in-depth in `(auth)/_layout.tsx` — asymmetric with `(app)/_layout.tsx`

**File:** `app/app/(auth)/_layout.tsx:9-11`
**Issue:** `(app)/_layout.tsx` correctly implements defense-in-depth — even with root `Stack.Protected guard={!!session}`, it independently checks `session` and `<Redirect>`s to `/(auth)/sign-in` if null (line 22-24). The symmetric `(auth)/_layout.tsx` does **not** do the same: if a stale frame ever lets the `(auth)` group render while `session` is present, the user would see the auth screens for a frame instead of being redirected to `(app)`. The PHASE 3 success criterion #5 asks both guards to "hindrar protected screens från att flicker-rendera när session saknas" — but the inverse (already-signed-in user landing on auth screens) is also a flicker the defense-in-depth pattern should catch.

**Fix:**

```tsx
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/lib/auth-store";

export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);
  if (session) {
    return <Redirect href="/(app)" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

### WR-02: `SplashScreenController` performs a side-effect during render

**File:** `app/app/_layout.tsx:52-58`
**Issue:** The component calls `SplashScreen.hide()` directly in the render body when `status !== 'loading'`. React's rules of rendering require render to be pure (no side effects, no I/O). The comment correctly notes idempotence makes Strict-Mode dual-render safe in practice, but the React docs and `react-hooks/exhaustive-deps` lint rules treat this as an anti-pattern because:

- React 19 concurrent features can render a component, then throw the result away (e.g., during transitions, suspense, or error boundary recovery). A render that hid the splash but never committed leaves the splash hidden with no actual content visible.
- Native module calls (Expo `SplashScreen.hide()` is a native bridge call) are not safe to invoke during render — they assume mount semantics.

**Fix:** Move the call into an effect so it only fires after commit.

```tsx
import { useEffect } from "react";

function SplashScreenController() {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status !== "loading") {
      SplashScreen.hideAsync().catch(() => {
        // Already hidden / not visible — safe to ignore.
      });
    }
  }, [status]);
  return null;
}
```

Note `hideAsync()` (not `hide()`) is the documented current API for `expo-splash-screen` in SDK 54+; pair with a `.catch` since it can reject if the splash was already hidden.

### WR-03: `SplashScreen.preventAutoHideAsync()` rejection is unhandled

**File:** `app/app/_layout.tsx:27`
**Issue:** `SplashScreen.preventAutoHideAsync()` returns a Promise. The current call ignores it entirely. If it rejects (e.g., the splash has already been auto-hidden because the JS bundle started slowly), the rejection becomes an unhandled promise rejection, which RN logs as a yellow box on dev and silently drops on release. The splash gating logic then no longer holds, but no fallback path exists.

**Fix:**

```ts
SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may have already auto-hidden if JS started slowly; safe to ignore —
  // SplashScreenController will still fire hideAsync() once auth resolves.
});
```

### WR-04: Unmapped `error.code` path in sign-up triggers generic copy on first-time failures (already documented in 03-VERIFICATION.md Issue 1)

**File:** `app/app/(auth)/sign-up.tsx:74-101` (and analogously `app/app/(auth)/sign-in.tsx:61-76`)
**Issue:** `03-VERIFICATION.md` records that the very first iPhone sign-up attempt returned the `default:` branch — meaning `error.code` did not match any of the seven mapped Supabase auth codes. The user has not yet captured the Metro `[sign-up] unexpected error:` log to identify which code Supabase returned. The current default copy "Något gick fel. Försök igen." is uninformative for what is, evidently, a reproducible-on-first-attempt code path — not a rare unexpected failure.

The same pattern applies to `sign-in.tsx` for any unmapped code (only `invalid_credentials | over_request_rate_limit | validation_failed` are mapped explicitly there — narrower than sign-up).

**Fix:** Two-part:

1. Until the actual `error.code` is captured, log the full error shape (not just `error`) so the diagnostic captures both `code` and `message`:

```ts
default:
  setBannerError("Något gick fel. Försök igen.");
  console.error("[sign-up] unexpected error:", {
    code: error.code,
    message: error.message,
    status: (error as any).status,
    name: error.name,
  });
```

2. Once the actual code is identified from the captured log, add a `case` arm with appropriate Swedish copy (per CLAUDE.md D-15 inline-error convention). Plan a follow-up `/gsd-debug` or gap-closure plan as recommended in `03-VERIFICATION.md` Issue 1.

This issue blocks the `/gsd-secure-phase 3` audit (per VERIFICATION.md "Threats Audit Hand-Off" — T-03-09 still pending) and ROADMAP F1 SC#1 manual verification.

### WR-05: `AppState.addEventListener` in `supabase.ts` is registered at module scope without cleanup — will leak under Metro Fast Refresh

**File:** `app/lib/supabase.ts:83-87`
**Issue:** `AppState.addEventListener("change", ...)` is called at module top level with no corresponding `remove()`. In normal app lifetime this is fine — the singleton lives for the app's lifetime. But Metro Fast Refresh re-evaluates modules on hot reload, which re-runs this line and registers a duplicate listener every save. After several saves during development, every AppState transition fires `startAutoRefresh/stopAutoRefresh` N times, which (a) wastes work, (b) can race with itself if the previous handler hasn't completed, and (c) makes profiling/debugging confusing.

The same concern applies to `focusManager.setEventListener` and `onlineManager.setEventListener` in `app/_layout.tsx:29-45`, but those use `setEventListener` (singular — TanStack swaps the previous one), so no leak there. The bare `AppState.addEventListener` here is the leaky one.

**Fix:** Either use a module-scope `const sub = AppState.addEventListener(...)` and rely on `if (__DEV__) module.hot?.dispose(() => sub.remove())` (Metro bundler hook), or accept the leak in dev-only and document it explicitly:

```ts
const appStateSub = AppState.addEventListener("change", (state) => {
  if (Platform.OS === "web") return;
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

// HMR cleanup so Fast Refresh doesn't pile up duplicate listeners.
if (__DEV__ && (module as any).hot) {
  (module as any).hot.dispose(() => appStateSub.remove());
}
```

Acceptable alternative if the HMR plumbing feels heavy: keep as-is but add a comment explaining the dev-time leak is known and benign.

### WR-06: `signOut` ordering allows in-flight queries to repopulate cache between `queryClient.clear()` and `supabase.auth.signOut()` resolving

**File:** `app/lib/auth-store.ts:39-53`
**Issue:** The order is:

1. `queryClient.clear()` — synchronous, clears all caches.
2. `await supabase.auth.signOut()` — network round-trip, can take seconds.

Between (1) and (2), any active subscription on a query (e.g., a `useQuery` mounted on a still-rendered protected screen) sees `isFetching=false, data=undefined` and refetches. That refetch goes out with the **still-valid** Supabase session token in the Authorization header (signOut hasn't completed yet), succeeds, and repopulates the cache with the about-to-be-signed-out user's data. After signOut completes, the listener fires SIGNED_OUT and the user lands in `(auth)`, but the cache now contains stale per-user data that will be visible if/when the next user signs in (until `queryClient.clear()` runs again on next sign-out, or the data goes stale via `gcTime`).

For Phase 3 the protected screen is just `(app)/index.tsx` with no `useQuery` calls, so the impact is currently zero. But as soon as Phase 4 ships real queries on `(app)`, this ordering becomes a real cache-leak vector.

**Fix:** Reverse the order — sign out first (server-side invalidates the session, listener fires, navigation happens), then clear the cache after. The listener-driven navigation is fast enough that any in-flight query during the clear window will be cancelled by the screen unmount.

```ts
signOut: async () => {
  const { error } = await supabase.auth.signOut();
  // Listener fires SIGNED_OUT → store flips to anonymous → root Stack.Protected
  // re-evaluates → user lands in (auth). Now the protected screens have unmounted
  // and any in-flight queries are cancelled. Safe to clear.
  queryClient.clear();
  if (error) {
    set({ session: null, status: "anonymous" });
    console.warn("[auth-store] signOut error:", error.message);
  }
},
```

If keeping clear-first is intentional (e.g., to immediately hide stale data on slow networks before signOut returns), the alternative is to also call `queryClient.cancelQueries()` before `clear()` and again after `signOut()` completes — but the simpler reorder above closes the window without complexity.

## Info

### IN-01: Email is not trimmed before passing to Supabase auth

**File:** `app/app/(auth)/sign-in.tsx:53` and `app/app/(auth)/sign-up.tsx:66`
**Issue:** iOS AutoFill and password managers occasionally include trailing whitespace in autocompleted email fields. Supabase normalizes server-side for sign-up (lowercases) but does **not** trim whitespace — a sign-in attempt with `"foo@bar.com "` (trailing space) fails with `invalid_credentials` even when the password is correct, and the user has no way to see the whitespace exists.

**Fix:** Trim at the schema layer so RHF receives the trimmed value before submit:

```ts
// app/lib/schemas/auth.ts
export const signInSchema = z.object({
  email: z.email({ error: "Email måste vara giltigt" }).transform((s) => s.trim()),
  password: z.string().min(1, { error: "Lösen krävs" }),
});
```

Same pattern for `signUpSchema`. Note: Zod 4's `transform` runs after parse, and zodResolver returns the transformed values to RHF.

### IN-02: `signOut` button has no `disabled` state and no haptic / loading feedback

**File:** `app/app/(app)/index.tsx:38-43`
**Issue:** Tapping "Logga ut" issues a network call (`supabase.auth.signOut()`) that can take seconds on a flaky connection. The button is not disabled while in-flight, so a user can double-tap and queue two signOut calls. The second one will fail (token already invalid) but the catch path force-clears state regardless, so the visible failure is just a yellow-box log line in dev. Not a correctness bug, but the same UX polish as sign-in/sign-up's `isSubmitting` disabled state would be nice. Phase 3 is acknowledged-cosmetic per `03-CONTEXT.md` D-17 ("Knappen är inte snyggt placerad — den är funktionell") so this is INFO not WARNING.

**Fix:** When Phase 4 builds the real settings surface, gate `onPress` with a local `isSigningOut` ref or pull `status === 'loading'` from the store and disable while in-flight.

### IN-03: `Case` type union in `test-auth-schemas.ts` is loose; typing per-schema would catch case drift

**File:** `app/scripts/test-auth-schemas.ts:11-17`
**Issue:** `schema: typeof signUpSchema | typeof signInSchema` lets the test array intermix schemas without TS catching, e.g., a sign-in case using `signUpSchema` accidentally still typechecks. Not a correctness bug — runtime behavior is fine — but a discriminated union would let TS verify the input shape matches the schema being parsed.

**Fix (optional polish):**

```ts
type Case<S extends z.ZodTypeAny> = {
  name: string;
  schema: S;
  input: z.input<S> | unknown; // allow invalid inputs by union
  expectSuccess: boolean;
  // ...
};
```

This is style-only; current code is correct.

### IN-04: `(_event, session)` ignored event arg means `TOKEN_REFRESHED` and `USER_UPDATED` events overwrite session with the new value — fine today, but worth a comment for Phase 5+

**File:** `app/lib/auth-store.ts:61-66`
**Issue:** The listener writes session unconditionally for every event. For `TOKEN_REFRESHED` and `USER_UPDATED` this is correct (new session payload includes refreshed token / updated user). For `PASSWORD_RECOVERY` the session may be a recovery-only session, which Phase 3 doesn't handle but which Phase 5+ password-reset flow will need to distinguish. No bug today, but worth a code comment so future-you remembers why the event arg is ignored.

**Fix:** Add a comment:

```ts
supabase.auth.onAuthStateChange((_event, session) => {
  // _event is ignored because every event we care about in Phase 3 (SIGNED_IN,
  // SIGNED_OUT, INITIAL_SESSION, TOKEN_REFRESHED, USER_UPDATED) reduces to
  // "write the new session." Phase 5+ password-recovery flow MUST branch on
  // _event === 'PASSWORD_RECOVERY' before this point.
  useAuthStore.setState({
    session,
    status: session ? "authenticated" : "anonymous",
  });
});
```

---

_Reviewed: 2026-05-09T14:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
