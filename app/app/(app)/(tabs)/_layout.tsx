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
// Tab tints bound via useColorScheme() per UI-SPEC §Color (light: #2563EB
// active / #6B7280 inactive; dark: #60A5FA / #9CA3AF).
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
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-gray-900">
      <OfflineBanner />
      <ActiveSessionBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: isDark ? "#1F2937" : "#F3F4F6",
            borderTopColor: isDark ? "#374151" : "#E5E7EB",
          },
          tabBarActiveTintColor: isDark ? "#60A5FA" : "#2563EB",
          tabBarInactiveTintColor: isDark ? "#9CA3AF" : "#6B7280",
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
