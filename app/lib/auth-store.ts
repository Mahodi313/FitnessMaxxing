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
//
// FIT-5 fix — persisted-cache isolation on sign-out:
//   queryClient.clear() clears the in-memory TanStack Query cache but does NOT
//   clear the AsyncStorage persisted snapshot written by persistQueryClient
//   (lib/query/persister.ts). Without also calling asyncStoragePersister
//   .removeClient(), the next sign-in (including a completely new user) would
//   hydrate the in-memory cache from the prior session's AsyncStorage snapshot
//   and momentarily see the previous user's plans / exercises / sessions.
//   Fix: call asyncStoragePersister.removeClient() alongside queryClient.clear()
//   in both the explicit signOut action AND the SIGNED_OUT event branch of
//   onAuthStateChange (covers session-expiry / server-side revocation).
//
// Load-order note: asyncStoragePersister is imported from lib/query/persister.ts.
// app/app/_layout.tsx imports lib/query/client → lib/query/persister → lib/query/network
// → lib/auth-store in that order, so asyncStoragePersister is always defined
// before any code in this file runs.

import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query/client";
import { asyncStoragePersister } from "@/lib/query/persister";

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
    // WR-06: signOut FIRST, then clear cache. Reversing the previous order
    // closes a window where in-flight queries (mounted on protected screens)
    // could refetch with the still-valid session token and repopulate the
    // cache between queryClient.clear() and signOut() returning. By the time
    // we reach the clear() call below, the listener has fired SIGNED_OUT,
    // protected screens have unmounted, and any in-flight queries are
    // cancelled — so clear() runs against an empty active set.
    const { error } = await supabase.auth.signOut();
    // Clear in-memory cache AND the AsyncStorage persisted snapshot so a
    // subsequent sign-in (including a different user) starts with a clean
    // slate. FIT-5: removeClient() is the complement of persistQueryClient;
    // without it stale plan/exercise/session rows from the prior account
    // survive in AsyncStorage and re-hydrate on the next app launch.
    queryClient.clear();
    void asyncStoragePersister.removeClient();
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
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.setState({
    session,
    status: session ? "authenticated" : "anonymous",
  });
  // FIT-5: on session loss (SIGNED_OUT or TOKEN_REFRESHED with null session),
  // fire-and-forget the AsyncStorage cache wipe so no stale cross-user data
  // can re-hydrate on the next mount. This covers server-side token revocation
  // and session expiry — cases where the signOut action above was never called.
  // void (fire-and-forget) is safe here because the synchronous setState above
  // already flips the UI to anonymous; the async IO follows independently.
  if (!session) {
    queryClient.clear();
    void asyncStoragePersister.removeClient();
  }
});

// CONTEXT.md D-06 (locked): explicit getSession() at module init. Result is
// written into the store; listener will subsequently overwrite with the same
// value when INITIAL_SESSION fires. Redundant but locked — see header comment.
//
// Race-safety (CR-01): both branches read-modify-write so they only take effect
// while status === "loading". If the listener already won (INITIAL_SESSION fired
// first and flipped status to authenticated/anonymous), bootstrap is a no-op.
// Without this guard, the .catch arm could clobber a valid authenticated state
// when getSession() rejects after a successful INITIAL_SESSION.
void supabase.auth
  .getSession()
  .then(({ data: { session } }) => {
    useAuthStore.setState((prev) =>
      prev.status === "loading"
        ? { session, status: session ? "authenticated" : "anonymous" }
        : prev,
    );
  })
  .catch((err) => {
    // Corrupt LargeSecureStore decrypt or other IO failure (D-07): treat as
    // anonymous ONLY if listener hasn't already resolved. Splash hides.
    console.warn("[auth-store] getSession init failed:", err);
    useAuthStore.setState((prev) =>
      prev.status === "loading" ? { session: null, status: "anonymous" } : prev,
    );
  });
