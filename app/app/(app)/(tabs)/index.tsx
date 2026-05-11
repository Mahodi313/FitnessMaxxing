// app/app/(app)/(tabs)/index.tsx
//
// Phase 4 Plan 02 Task 2: Planer tab — three states:
//   1. Loading (isPending): centered ActivityIndicator (≤500ms typical due
//      to AsyncStorage cache hydration per UI-SPEC §"Loading / cold-start").
//   2. Empty (plans.length === 0): centered Ionicons barbell-outline +
//      "Inga planer än" + "Skapa din första plan." + inline "Skapa plan"
//      CTA per CONTEXT.md D-14 / UI-SPEC §"Empty states".
//   3. Populated: "Mina planer" Display heading + FlatList of plan-rows +
//      floating "Skapa ny plan" FAB per UI-SPEC §Planer tab.
//
// Empty-state CTA is INLINE (NOT the FAB) per UI-SPEC §"Empty states":
// when plans.length===0 the centered CTA shows; the FAB only appears once
// there's at least 1 plan, so it doesn't hover over the empty state's
// primary CTA.
//
// usePlansQuery (Plan 04-01) already filters .is('archived_at', null) so
// archived plans never appear here (CONTEXT.md D-12).
//
// router.push('/plans/new') routes to plans/new.tsx (Task 3, this plan).
// router.push(`/plans/${plan.id}`) routes to plans/[id].tsx (Plan 04-03).
// Until Plan 04-03 ships, plan-row tap will Expo-Router 404 — acceptable
// per Plan 04-02's verification scope.
//
// `as Href` casts on the two route strings: app.json has experiments
// .typedRoutes=true, so Expo Router validates path literals against the
// auto-generated .expo/types/router.d.ts. Those types only include routes
// whose source files currently exist; /plans/new and /plans/[id] are owned
// by this plan's Task 3 and Plan 04-03 respectively. The `as Href` cast is
// a localized Rule 3 fix that defers type-validation until the dev server
// regenerates router.d.ts (which it does on the next `expo start`). Once
// both routes ship, the casts can be dropped — this comment serves as a
// breadcrumb for that V1.1 cleanup.
//
// References:
//   - 04-CONTEXT.md D-12, D-14
//   - 04-UI-SPEC.md §Planer tab + §Visuals plan-list-row + §Visuals FAB
import { useRouter, type Href } from "expo-router";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePlansQuery } from "@/lib/queries/plans";

export default function PlansTab() {
  const router = useRouter();
  const { data: plans, isPending } = usePlansQuery();
  const scheme = useColorScheme();
  const accent = scheme === "dark" ? "#60A5FA" : "#2563EB";
  const muted = scheme === "dark" ? "#9CA3AF" : "#6B7280";

  // Loading state (≤500ms typical due to AsyncStorage cache hydration —
  // UI-SPEC §"Loading / cold-start").
  if (isPending) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  const isEmpty = !plans || plans.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      {!isEmpty && (
        <View className="px-4 pt-4 pb-2">
          <Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
            Mina planer
          </Text>
        </View>
      )}

      <FlatList
        data={plans ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 96,
          flexGrow: 1,
        }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center gap-6 px-4">
            <Ionicons name="barbell-outline" size={64} color={accent} />
            <View className="gap-2 items-center">
              <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                Inga planer än
              </Text>
              <Text className="text-base text-gray-500 dark:text-gray-400">
                Skapa din första plan.
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/plans/new" as Href)}
              accessibilityRole="button"
              accessibilityLabel="Skapa plan"
              className="rounded-lg bg-blue-600 dark:bg-blue-500 px-6 py-4 active:opacity-80"
            >
              <Text className="text-base font-semibold text-white">
                Skapa plan
              </Text>
            </Pressable>
          </View>
        }
        renderItem={({ item: plan }) => (
          <Pressable
            onPress={() => router.push(`/plans/${plan.id}` as Href)}
            accessibilityRole="button"
            accessibilityLabel={`Öppna plan ${plan.name}`}
            className="flex-row items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-4 active:opacity-80"
          >
            <View className="flex-1 mr-2">
              <Text
                className="text-base font-semibold text-gray-900 dark:text-gray-50"
                numberOfLines={1}
              >
                {plan.name}
              </Text>
              {plan.description ? (
                <Text
                  className="text-base text-gray-500 dark:text-gray-400"
                  numberOfLines={1}
                >
                  {plan.description}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={muted} />
          </Pressable>
        )}
      />

      {!isEmpty && (
        <Pressable
          onPress={() => router.push("/plans/new" as Href)}
          accessibilityRole="button"
          accessibilityLabel="Skapa ny plan"
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 dark:bg-blue-500 items-center justify-center shadow-lg active:opacity-80"
        >
          <Ionicons name="add" size={28} color="white" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}
