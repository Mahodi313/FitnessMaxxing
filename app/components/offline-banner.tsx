// app/components/offline-banner.tsx
//
// Phase 4 Plan 02: binary OfflineBanner per CONTEXT.md D-05.
//
// Visibility logic: visible iff useOnlineStatus() === false AND local
// `dismissed` state === false. Tap on ✕ sets `dismissed = true` for the
// lifetime of the offline event. When useOnlineStatus() flips back to true,
// the useEffect cleanup resets `dismissed` so a fresh offline event re-shows
// the banner. Matches the Phase 3 quick-task convention from commit 4af7462.
//
// Mounted in app/app/(app)/(tabs)/_layout.tsx ABOVE <Tabs> and INSIDE
// SafeAreaView edges={['top']} per UI-SPEC + RESEARCH §6.
//
// Color: bg-yellow-100 / dark:bg-yellow-900 with text-yellow-900 /
// dark:text-yellow-100 (UI-SPEC Color §Warning/Info — yellow signals "system
// condition affecting your work" without escalating to red, which is reserved
// for errors and destructive actions).
//
// References:
//   - 04-CONTEXT.md D-05
//   - 04-UI-SPEC.md §Visuals OfflineBanner + §Color Warning/Info
//   - PITFALLS §8.12 (the resumePausedMutations contract this banner reflects)

import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useOnlineStatus } from "@/lib/query/network";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismiss state when online (so the next offline event re-shows the banner).
  useEffect(() => {
    if (isOnline) setDismissed(false);
  }, [isOnline]);

  if (isOnline || dismissed) return null;

  return (
    <View
      className="flex-row items-start justify-between gap-2 bg-yellow-100 dark:bg-yellow-900 px-4 py-3 mx-4 mt-2 rounded-lg"
      accessibilityRole="alert"
    >
      <Text
        className="flex-1 text-base text-yellow-900 dark:text-yellow-100"
        accessibilityLiveRegion="polite"
      >
        Du är offline — ändringar synkar när nätet är tillbaka.
      </Text>
      <Pressable
        onPress={() => setDismissed(true)}
        accessibilityRole="button"
        accessibilityLabel="Stäng"
        accessibilityHint="Tryck för att stänga"
        className="px-2 py-1"
        hitSlop={8}
      >
        <Text className="text-base font-semibold text-yellow-900 dark:text-yellow-100">
          ✕
        </Text>
      </Pressable>
    </View>
  );
}
