// app/app/(app)/plans/[id].tsx
//
// Phase 4 Plan 03 Task 1: Plan-detail screen.
//
// Three responsibilities composed on one screen:
//   1. Plan-meta read + edit (RHF + planFormSchema; explicit Spara button only
//      when isDirty per UI-SPEC §"Plan-edit form mode decision").
//   2. plan_exercises listed in a plain FlatList. Each row: name + optional
//      target chip + edit chevron + remove ✕. Plan 04 will swap the FlatList
//      for DraggableFlatList and add a drag-handle column to PlanExerciseRow
//      as a focused diff (intentionally deferred — keeps this plan within
//      context budget).
//   3. Header overflow menu (ActionSheetIOS — iOS-only V1) → "Arkivera plan"
//      → Alert.alert destructive confirm → useArchivePlan(planId) →
//      router.back() (CONTEXT.md D-12 + UI-SPEC §"Destructive confirmation").
//
// Hook contract (Plan 04-01):
//   - useUpdatePlan(planId), useArchivePlan(planId): scope.id = `plan:<planId>`.
//     Pass the plan.id once it has loaded so the same scope groups per-plan
//     mutations on offline replay.
//   - useRemovePlanExercise(planId): scope.id = `plan:<planId>` (REQUIRED — Plan
//     04-01's setMutationDefaults throws if plan_id is missing in the payload).
//
// Header opt-in: <Stack.Screen options={{ headerShown: true, ... }} /> with
// useColorScheme()-bound headerStyle/headerTintColor per CLAUDE.md ## Conventions
// "Real screens (Phase 4+)".
//
// References:
//   - 04-CONTEXT.md D-09, D-10, D-11, D-12
//   - 04-UI-SPEC.md §Plan edit + §Visuals "Plan_exercise row" + §"Empty states"
//   - 04-RESEARCH.md §5
//   - PITFALLS §8.1, §8.13

import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
  Alert,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { planFormSchema, type PlanFormInput } from "@/lib/schemas/plans";
import {
  usePlanQuery,
  useUpdatePlan,
  useArchivePlan,
} from "@/lib/queries/plans";
import {
  usePlanExercisesQuery,
  useRemovePlanExercise,
} from "@/lib/queries/plan-exercises";

// Local row shape — narrowed to the fields PlanExerciseRow renders. Mirrors
// PlanExerciseRow from @/lib/schemas/plan-exercises (the cached Zod-parsed
// row). Plan 01's usePlanExercisesQuery does NOT join exercises.name — V1's
// row chip falls back to "(övning saknas)" if the join is missing. Plan 04
// can extend the queryFn to fetch the joined name when wiring the
// drag-reorder UX if the UX requires showing exercise names without an
// extra useExercisesQuery() lookup.
type PlanExerciseRowShape = {
  id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  notes: string | null;
};

export default function PlanDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const muted = isDark ? "#9CA3AF" : "#6B7280";
  const accent = isDark ? "#60A5FA" : "#2563EB";

  const { data: plan, isPending: planPending } = usePlanQuery(id!);
  const { data: planExercises, isPending: pxPending } = usePlanExercisesQuery(
    id!,
  );

  // Hooks accept the planId so scope.id binds to `plan:<planId>` per Plan
  // 04-01's resource-hook contract — chained mutations on the same plan
  // replay serially on reconnect.
  const updatePlan = useUpdatePlan(id);
  const archivePlan = useArchivePlan(id);
  const removePlanExercise = useRemovePlanExercise(id!);

  const [bannerError, setBannerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<PlanFormInput>({
    resolver: zodResolver(planFormSchema),
    mode: "onSubmit",
    defaultValues: { name: plan?.name ?? "", description: plan?.description ?? "" },
  });

  // Hydrate RHF defaults once the plan loads from the cache. useEffect with the
  // plan-identity tuple as dep keeps reset() from firing on every render. After
  // a successful save we also call reset() in onSaveMeta so isDirty flips back
  // to false and the Spara button hides.
  useEffect(() => {
    if (plan) {
      reset({ name: plan.name, description: plan.description ?? "" });
    }
  }, [plan?.id, plan?.name, plan?.description, plan, reset]);

  const planNameTruncated = (plan?.name ?? "").slice(0, 24);

  const onSaveMeta = async (input: PlanFormInput) => {
    if (!plan) return;
    setBannerError(null);
    try {
      await updatePlan.mutateAsync({
        id: plan.id,
        name: input.name,
        description: input.description ?? null,
      });
      reset({ name: input.name, description: input.description ?? "" });
    } catch {
      setBannerError("Något gick fel. Försök igen.");
    }
  };

  const onArchivePress = () => {
    if (!plan) return;
    Alert.alert(
      `Arkivera "${plan.name}"?`,
      "Planen tas bort från listan. Pass som använt planen behåller sin historik.",
      [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Arkivera",
          style: "destructive",
          onPress: async () => {
            try {
              await archivePlan.mutateAsync({ id: plan.id });
              router.back();
            } catch {
              setBannerError("Kunde inte arkivera. Försök igen.");
            }
          },
        },
      ],
    );
  };

  const onOverflowPress = () => {
    // V1 is iOS-only; ActionSheetIOS is the canonical iOS overflow surface.
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Avbryt", "Arkivera plan"],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) onArchivePress();
      },
    );
  };

  if (planPending || !plan) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-gray-500 dark:text-gray-400">
            Laddar…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <Stack.Screen
        options={{
          headerShown: true,
          title: planNameTruncated,
          headerStyle: { backgroundColor: isDark ? "#111827" : "#FFFFFF" },
          headerTintColor: isDark ? "#F9FAFB" : "#111827",
          headerRight: () => (
            <Pressable
              onPress={onOverflowPress}
              accessibilityRole="button"
              accessibilityLabel="Plan-menyn"
              hitSlop={8}
              className="px-2 py-1"
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={muted} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList<PlanExerciseRowShape>
          data={(planExercises ?? []) as PlanExerciseRowShape[]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 96,
            flexGrow: 1,
          }}
          ListHeaderComponent={
            <View className="gap-6 mb-4">
              {bannerError && (
                <View className="flex-row items-start justify-between gap-2">
                  <Text
                    className="flex-1 text-base text-red-600 dark:text-red-400"
                    accessibilityLiveRegion="polite"
                  >
                    {bannerError}
                  </Text>
                  <Pressable
                    onPress={() => setBannerError(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Stäng"
                    accessibilityHint="Tryck för att stänga"
                    className="px-2 py-1"
                    hitSlop={8}
                  >
                    <Text className="text-base font-semibold text-red-600 dark:text-red-400">
                      ✕
                    </Text>
                  </Pressable>
                </View>
              )}

              <View className="gap-4">
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View className="gap-2">
                      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        Namn
                      </Text>
                      <TextInput
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="t.ex. Push, Pull, Ben"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="sentences"
                        autoComplete="off"
                        textContentType="none"
                        accessibilityLabel="Namn"
                        className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${
                          errors.name
                            ? "border-red-600 dark:border-red-400"
                            : "border-gray-300 dark:border-gray-700"
                        } focus:border-blue-600 dark:focus:border-blue-500`}
                      />
                      {errors.name && (
                        <Text
                          className="text-base text-red-600 dark:text-red-400"
                          accessibilityLiveRegion="polite"
                        >
                          {errors.name.message}
                        </Text>
                      )}
                    </View>
                  )}
                />
                <Controller
                  control={control}
                  name="description"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View className="gap-2">
                      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        Beskrivning
                      </Text>
                      <TextInput
                        value={value ?? ""}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="(valfritt)"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="sentences"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        style={{ minHeight: 80 }}
                        accessibilityLabel="Beskrivning"
                        className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${
                          errors.description
                            ? "border-red-600 dark:border-red-400"
                            : "border-gray-300 dark:border-gray-700"
                        } focus:border-blue-600 dark:focus:border-blue-500`}
                      />
                      {errors.description && (
                        <Text
                          className="text-base text-red-600 dark:text-red-400"
                          accessibilityLiveRegion="polite"
                        >
                          {errors.description.message}
                        </Text>
                      )}
                    </View>
                  )}
                />
              </View>

              {isDirty && (
                <Pressable
                  onPress={handleSubmit(onSaveMeta)}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel={isSubmitting ? "Sparar" : "Spara"}
                  className="w-full rounded-lg bg-blue-600 dark:bg-blue-500 py-4 items-center justify-center disabled:opacity-60 active:opacity-80"
                >
                  <Text className="text-base font-semibold text-white">
                    {isSubmitting ? "Sparar…" : "Spara"}
                  </Text>
                </Pressable>
              )}

              <View className="flex-row items-center justify-between mt-4">
                <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                  Övningar
                </Text>
                <Pressable
                  onPress={() =>
                    router.push(`/plans/${plan.id}/exercise-picker` as Href)
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Lägg till övning"
                  className="rounded-lg bg-blue-600 dark:bg-blue-500 px-4 py-3 active:opacity-80"
                >
                  <Text className="text-base font-semibold text-white">
                    Lägg till övning
                  </Text>
                </Pressable>
              </View>
            </View>
          }
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={
            pxPending ? null : (
              <View className="flex-1 items-center justify-center gap-6 px-4 mt-12">
                <Ionicons name="list-outline" size={64} color={accent} />
                <View className="gap-2 items-center">
                  <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                    Inga övningar än
                  </Text>
                  <Text className="text-base text-gray-500 dark:text-gray-400">
                    Lägg till din första övning.
                  </Text>
                </View>
              </View>
            )
          }
          renderItem={({ item: planExercise }) => (
            <PlanExerciseRow
              planExercise={planExercise}
              onEdit={() =>
                router.push(
                  `/plans/${plan.id}/exercise/${planExercise.id}/edit` as Href,
                )
              }
              onRemove={() =>
                removePlanExercise.mutate({
                  id: planExercise.id,
                  plan_id: plan.id,
                })
              }
              muted={muted}
            />
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// PlanExerciseRow — local component (Plan 04 will modify in-place to add the
// drag-handle column when the parent FlatList is swapped to DraggableFlatList).
// Keeping it inline avoids a 2-file diff for what is a single-component
// evolution.
//
// V1 limitation: the cached PlanExercise row does NOT carry the joined
// exercises.name — Plan 01's queryFn selects '*' from plan_exercises only.
// We render the exercise_id as a fallback ("Övning <short-id>") so users
// still see something meaningful per-row. Plan 04 (or a Plan 04-04 polish)
// can extend the queryFn with `select('*, exercises ( name )')` and update
// the row component accordingly.
function PlanExerciseRow({
  planExercise,
  onEdit,
  onRemove,
  muted,
}: {
  planExercise: PlanExerciseRowShape;
  onEdit: () => void;
  onRemove: () => void;
  muted: string;
}) {
  const exerciseLabel = `Övning ${planExercise.exercise_id.slice(0, 8)}`;
  const targetChip = formatTargetChip(planExercise);
  return (
    <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-4">
      <View className="flex-1 mr-2">
        <Text
          className="text-base font-semibold text-gray-900 dark:text-gray-50"
          numberOfLines={1}
        >
          {exerciseLabel}
        </Text>
        {targetChip && (
          <Text
            className="text-sm text-gray-500 dark:text-gray-400"
            numberOfLines={1}
          >
            {targetChip}
          </Text>
        )}
      </View>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel="Redigera mål"
        className="p-2 active:opacity-80"
      >
        <Ionicons name="chevron-forward" size={20} color={muted} />
      </Pressable>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel="Ta bort övning från plan"
        className="p-2 active:opacity-80"
      >
        <Ionicons name="close-outline" size={22} color={muted} />
      </Pressable>
    </View>
  );
}

function formatTargetChip(px: {
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
}): string | null {
  if (
    px.target_sets == null &&
    px.target_reps_min == null &&
    px.target_reps_max == null
  ) {
    return null;
  }
  let repsPart = "";
  if (px.target_reps_min != null && px.target_reps_max != null) {
    repsPart = `${px.target_reps_min}–${px.target_reps_max}`;
  } else if (px.target_reps_min != null) {
    repsPart = String(px.target_reps_min);
  } else if (px.target_reps_max != null) {
    repsPart = String(px.target_reps_max);
  }
  if (px.target_sets != null && repsPart) {
    return `${px.target_sets}×${repsPart}`;
  }
  if (px.target_sets != null) {
    return String(px.target_sets);
  }
  return repsPart || null;
}
