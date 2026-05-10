// app/app/(app)/(tabs)/index.tsx
//
// Phase 4 Plan 02 Task 1: PLACEHOLDER — Task 2 replaces with the full Planer
// list (empty-state + FlatList + FAB). Splitting the work this way unblocks
// tab-skeleton verification while the list logic lands separately.
//
// (tabs)/index.tsx is the default route inside the (app) group via Expo
// Router 6 group-default-resolution (CONTEXT.md D-16) — replaces the deleted
// Phase 3 (app)/index.tsx.
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PlansTab() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-base text-gray-500 dark:text-gray-400">
          Loading…
        </Text>
      </View>
    </SafeAreaView>
  );
}
