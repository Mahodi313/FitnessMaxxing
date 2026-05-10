// app/app/_layout.tsx
import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
// react-native-gesture-handler must be imported in the entry file so its
// native modules register before any GestureDetector descendant renders. The
// named import below triggers the module load — separately importing it for
// side-effects only is no longer required in v2.x.
// See https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation.
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";

// LOAD-BEARING import order — see 04-RESEARCH.md §"Module-load order" + Pitfall 8.2.
// client.ts MUST execute first (registers all 8 setMutationDefaults), THEN
// persister.ts (hydrates the cache from AsyncStorage — paused mutations rehydrate
// against already-registered defaults), THEN network.ts (wires NetInfo +
// AppState + the onlineManager.subscribe(resumePausedMutations) block that closes
// Pitfall 8.12). Reordering these breaks the offline-queue replay contract.
import { queryClient } from "@/lib/query/client";
import "@/lib/query/persister";
import "@/lib/query/network";

// Importing useAuthStore here triggers the module-scope onAuthStateChange listener
// + getSession() init flow registered in app/lib/auth-store.ts. Order does not
// matter for correctness (listener registers exactly once on first import) but
// keeping this import near the top makes the side-effect explicit.
import { useAuthStore } from "@/lib/auth-store";

// ---- Module-level side-effects. Set once when module loads. ----

// Phase 3 D-04: hold the native splash until first session resolution. MUST be
// module scope (BEFORE any render); useEffect would fire too late and the
// splash would auto-hide before we get a chance to gate it. Per RESEARCH.md
// Pitfall §3 + docs.expo.dev/versions/latest/sdk/splash-screen.
//
// WR-03: Promise rejection is handled. If the splash already auto-hid because
// JS started slowly, preventAutoHideAsync rejects — safe to swallow because
// SplashScreenController will still call hideAsync() once auth resolves.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may have already auto-hidden if JS started slowly; safe to ignore.
});

// focusManager + onlineManager + onlineManager.subscribe(resumePausedMutations)
// are wired in @/lib/query/network.ts (imported above for side-effects).

/**
 * Render-side splash hide controller. When status flips out of 'loading',
 * fires SplashScreen.hideAsync() in an effect (post-commit) so React 19
 * concurrent renders that get thrown away don't leave the splash hidden
 * over no content. WR-02: native bridge call moved out of render.
 */
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

/**
 * Stack.Protected gates (app) and (auth) groups by session presence.
 * While status === 'loading', renders null so the native splash continues to
 * cover the screen (RESEARCH.md Pitfall §5 — prevents the empty-navigator
 * blank flash).
 */
function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  const status = useAuthStore((s) => s.status);

  if (status === "loading") return null;

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
  // GestureHandlerRootView wraps the entire app so descendants of any screen
  // (e.g., DraggableFlatList in plans/[id].tsx) can use GestureDetector without
  // triggering the "must be a descendant of GestureHandlerRootView" runtime
  // error. flex: 1 is required — without it children collapse to zero size.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SplashScreenController />
        <RootNavigator />
        <StatusBar style="auto" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
