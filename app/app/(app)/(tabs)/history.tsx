// app/app/(app)/(tabs)/history.tsx
//
// Phase 4 Plan 02: Historik tab — placeholder per CONTEXT.md D-15.
// Phase 6 fills the real surface (F9/F10 history list + per-exercise graph).
//
// Centered "Historik" Display heading + "Historik kommer i Phase 6." Body
// text per UI-SPEC §Historik tab Copywriting Contract.
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HistoryTab() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
          Historik
        </Text>
        <Text className="text-base text-gray-500 dark:text-gray-400">
          Historik kommer i Phase 6.
        </Text>
      </View>
    </SafeAreaView>
  );
}
