// app/components/active-session-banner.tsx
//
// Phase 5 D-22: persistent banner indicating an active workout session.
// Visible across all (tabs) when useActiveSessionQuery returns non-null AND
// the user is NOT inside /workout/[sessionId] (route-check via useSegments).
// Tap routes to the active workout. NO close affordance (UI-SPEC line 287 —
// dismissing would hide the affordance to return to the in-progress session).
//
// Color role: Info-blue (UI-SPEC §Color line 133) — distinct from yellow
// OfflineBanner (warning) and accent-blue CTAs (primary actions). When both
// banners visible (offline mid-pass): OfflineBanner stacks above this one.
// Real-device-verification convention from Phase 4 commit cfc1dc8 applies —
// if light-mode bg-blue-100 reads as near-white on physical iPhone, bump to
// bg-blue-200 + border-blue-400 per the UAT-color-amendment convention and
// document in 05-03-SUMMARY.md.
//
// A11y: full-row Pressable with accessibilityRole="button",
// accessibilityLabel="Återgå till pågående pass", and
// accessibilityLiveRegion="polite" on the inner label so VoiceOver announces
// on mount.
//
// References:
//   - 05-CONTEXT.md D-22
//   - 05-UI-SPEC.md §Color line 133 (info-blue role) + §lines 281-287 (copy + a11y)
//   - 05-PATTERNS.md §active-session-banner.tsx

import { View, Text, Pressable, useColorScheme } from "react-native";
import { useRouter, useSegments, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useActiveSessionQuery } from "@/lib/queries/sessions";

export function ActiveSessionBanner() {
  const router = useRouter();
  const segments = useSegments();
  const { data: activeSession } = useActiveSessionQuery();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  // UI-SPEC line 133: Icon colors track text color of info-blue role.
  // Light: blue-900 (#1E3A8A). Dark: blue-100 (#DBEAFE).
  const iconColor = isDark ? "#DBEAFE" : "#1E3A8A";

  // Hide-on-workout-route logic (UI-SPEC §line 509): don't double-stack with
  // workout-screen header. The active workout screen already has its own
  // Avsluta header action; banner duplication wastes vertical space.
  const onWorkoutRoute = segments.some((s) => s === "workout");
  if (!activeSession || onWorkoutRoute) return null;

  return (
    <Pressable
      onPress={() => router.push(`/workout/${activeSession.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel="Återgå till pågående pass"
      className="flex-row items-center justify-between gap-2 bg-blue-100 dark:bg-blue-950 border border-blue-300 dark:border-blue-800 px-4 py-3 mx-4 mt-2 rounded-lg active:opacity-80"
    >
      <View className="flex-row items-center gap-2 flex-1">
        <Ionicons name="time" size={20} color={iconColor} />
        <View className="flex-1">
          <Text
            className="text-base font-semibold text-blue-900 dark:text-blue-100"
            accessibilityLiveRegion="polite"
          >
            Pågående pass
          </Text>
          <Text className="text-base text-blue-900 dark:text-blue-100 opacity-80">
            Tryck för att återgå
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={iconColor} />
    </Pressable>
  );
}
