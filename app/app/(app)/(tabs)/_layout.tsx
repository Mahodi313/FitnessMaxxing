// app/app/(app)/(tabs)/_layout.tsx
//
// Phase 4 Plan 02: (tabs) skeleton — Default Expo Router <Tabs> with Swedish
// labels and Ionicons (CONTEXT.md D-15/D-17/D-18; UI-SPEC §Tab-bar).
//
// OfflineBanner mounts ABOVE <Tabs>, INSIDE SafeAreaView edges={['top']} so
// the banner sits below the status bar but above the tab content (UI-SPEC
// §Visuals OfflineBanner + RESEARCH §6).
//
// NO <Redirect> guard here — the parent (app)/_layout.tsx already protects
// the route group (Phase 3 D-08). The tabs layout is rendered INSIDE the
// protected tree.
//
// Tab tints bound via useColorScheme() — Forge re-skin (Plan 09-02 UAT, color-
// only, no nav/structure/icon change): active accent (#E14E10 light / #FF5A1F
// dark), inactive forge-text2 (#4D4D4D light / rgba(255,255,255,0.62) dark),
// surface + hairline border match the Forge dark chrome elsewhere on screen.
//
// headerShown: false at the (tabs) layer because each tab screen renders
// its own SafeAreaView + heading. Plan-detail (Plan 03) will opt headers in
// per-screen via <Stack.Screen options={{ headerShown: true, ... }} />.
//
// References:
//   - 04-CONTEXT.md D-15, D-16, D-17, D-18
//   - 04-UI-SPEC.md §Tab-bar + §Color

import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { OfflineBanner } from "@/components/offline-banner";
import { ActiveSessionBanner } from "@/components/active-session-banner";

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-forge-bg-light dark:bg-forge-bg"
    >
      <OfflineBanner />
      <ActiveSessionBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: isDark ? "#0E0E10" : "#FFFFFF",
            borderTopColor: isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.07)",
          },
          tabBarActiveTintColor: isDark ? "#FF5A1F" : "#E14E10",
          tabBarInactiveTintColor: isDark
            ? "rgba(255,255,255,0.62)"
            : "#4D4D4D",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Planer",
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? "barbell" : "barbell-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "Historik",
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? "time" : "time-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Inställningar",
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? "settings" : "settings-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
