// app/app/_layout.tsx
import "../global.css";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

import { queryClient } from "@/lib/query-client";
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

focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener("change", (s) => {
    if (Platform.OS !== "web") setFocused(s === "active");
  });
  return () => sub.remove();
});

onlineManager.setEventListener((setOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    // NetInfo's isConnected is boolean | null; null = unknown (cold start
    // before first probe). Treat unknown as online so TanStack Query doesn't
    // mark mutations offline before we know — only an explicit `false` flips
    // us offline.
    setOnline(state.isConnected !== false);
  });
  return unsubscribe;
});

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
  return (
    <QueryClientProvider client={queryClient}>
      <SplashScreenController />
      <RootNavigator />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
