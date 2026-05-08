// app/app/_layout.tsx
import "../global.css";
import { AppState, Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

import { queryClient } from "@/lib/query-client";

// ---- Module-level listeners (Recipe §B). Set once when module loads. ----

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

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
