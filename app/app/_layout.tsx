// app/app/_layout.tsx
import "../global.css";
import { useEffect } from "react";
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
import { phase1ConnectTest } from "@/lib/supabase";

// ---- Module-level listeners (Recipe §B). Set once when module loads. ----

focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener("change", (s) => {
    if (Platform.OS !== "web") setFocused(s === "active");
  });
  return () => sub.remove();
});

onlineManager.setEventListener((setOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
  return unsubscribe;
});

export default function RootLayout() {
  useEffect(() => {
    if (__DEV__) {
      phase1ConnectTest();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
