// app/app/(app)/plans/[id]/exercise-picker.tsx
//
// Phase 4 Plan 03 Task 2: Exercise-add sheet (modal route).
//
// Two states on a single screen:
//   1. Default — search input + "+ Skapa ny övning" toggle button + filtered
//      list of useExercisesQuery() results (client-side .filter() per
//      UI-SPEC §"Exercise search implementation"). Tapping a row optimistically
//      inserts a plan_exercises row and dismisses the modal.
//   2. Create-form — same screen, search/list hidden; replaced with an
//      inline RHF form (name, muscle_group, equipment, notes) +
//      "Skapa & lägg till" CTA + "Avbryt" text link that returns to default
//      state (does NOT dismiss the sheet — Avbryt-as-back is the modal-close
//      auto-rendered by Expo Router 6 presentation: 'modal').
//
// Chained-create-and-add flow (RESEARCH §5 — load-bearing for FK safety on
// offline replay):
//   - useCreateExercise(planId) BAKES scope.id='plan:<planId>' into the
//     mutation hook instance. This is the v5-correct way to share scope
//     across mutations — the planner's <interfaces> block phrased it as
//     "meta.scopeOverride" but Plan 01's actual hook signature accepts
//     planId directly. The intent is identical: both subsequent
//     useAddExerciseToPlan(planId) and the chained useCreateExercise(planId)
//     mutations carry scope.id='plan:<planId>', so on reconnect the create
//     replays BEFORE the add (FK ordering preserved).
//
// Why no meta.scopeOverride here: TanStack v5's MutationScope.id is a
// STATIC string read at runtime — there is no per-mutate dynamic scope.
// scopeOverride was a planner-side abstraction; the implementation surface
// it maps to is `useCreateExercise(planId)` (Plan 04-01 SUMMARY auto-fix
// Rule 1 documents this correction).
//
// References:
//   - 04-CONTEXT.md D-13
//   - 04-UI-SPEC.md §"Exercise-add sheet"
//   - 04-RESEARCH.md §5
//   - 04-01-SUMMARY.md "scope.id correction" + Plan 04-01 hook signatures

import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  exerciseFormSchema,
  type ExerciseFormInput,
} from "@/lib/schemas/exercises";
import { useExercisesQuery, useCreateExercise } from "@/lib/queries/exercises";
import {
  useAddExerciseToPlan,
  usePlanExercisesQuery,
} from "@/lib/queries/plan-exercises";
import { useAuthStore } from "@/lib/auth-store";
import { randomUUID } from "@/lib/utils/uuid";

export default function ExercisePicker() {
  const router = useRouter();
  const { id: planId } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.session?.user.id);
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const accent = isDark ? "#60A5FA" : "#2563EB";

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const { data: exercises } = useExercisesQuery();
  const { data: planExercises } = usePlanExercisesQuery(planId!);

  // BOTH mutations carry scope.id='plan:<planId>' — see file header for the
  // scopeOverride contract. useCreateExercise(planId) baking the scope is the
  // canonical implementation of the planner's "meta.scopeOverride" intent.
  const createExercise = useCreateExercise(planId);
  const addExerciseToPlan = useAddExerciseToPlan(planId!);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!exercises) return [];
    if (!q) return exercises;
    return exercises.filter((e) => e.name.toLowerCase().includes(q));
  }, [exercises, searchQuery]);

  const maxOrderIndex = useMemo(() => {
    if (!planExercises || planExercises.length === 0) return -1;
    return planExercises.reduce(
      (m, px) => (px.order_index > m ? px.order_index : m),
      -1,
    );
  }, [planExercises]);

  const onPickExisting = (exerciseId: string) => {
    if (!planId) return;
    addExerciseToPlan.mutate({
      id: randomUUID(),
      plan_id: planId,
      exercise_id: exerciseId,
      order_index: maxOrderIndex + 1,
    });
    router.back();
  };

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExerciseFormInput>({
    resolver: zodResolver(exerciseFormSchema),
    mode: "onSubmit",
    defaultValues: { name: "", muscle_group: "", equipment: "", notes: "" },
  });

  const onCreateAndAdd = (input: ExerciseFormInput) => {
    if (!userId || !planId) {
      setBannerError("Du måste vara inloggad.");
      return;
    }
    setBannerError(null);
    const exerciseId = randomUUID();
    // Both mutations share scope.id='plan:<planId>' (set on hook instances).
    // TanStack v5 serializes mutations within a scope, so on offline replay
    // create lands BEFORE add (FK safety per RESEARCH §5). Firing both with
    // mutate (not mutateAsync) returns immediately so we can router.back()
    // even when offline — UAT 2026-05-10 regression: mutateAsync stalled
    // "Skapa & lägg till" forever in airplane mode.
    createExercise.mutate(
      {
        id: exerciseId,
        user_id: userId,
        name: input.name,
        muscle_group: input.muscle_group ?? null,
        equipment: input.equipment ?? null,
        notes: input.notes ?? null,
      },
      { onError: () => setBannerError("Något gick fel. Försök igen.") },
    );
    addExerciseToPlan.mutate({
      id: randomUUID(),
      plan_id: planId,
      exercise_id: exerciseId,
      order_index: maxOrderIndex + 1,
    });
    reset();
    router.back();
  };

  return (
    // Modal screens are presented in a separate native UIViewController on
    // iOS, which does NOT inherit the root <GestureHandlerRootView> from
    // app/_layout.tsx. Each modal must wrap its own content. UAT 2026-05-10:
    // tapping "Lägg till övning" threw "GestureDetector must be used as a
    // descendant of GestureHandlerRootView" until this wrapper landed.
    // https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <Stack.Screen
          options={{
            presentation: "modal",
            title: "Lägg till övning",
            headerShown: true,
          }}
        />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {showCreateForm ? (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: 24,
              gap: 24,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              Ny övning
            </Text>

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
                  className="px-2 py-1"
                  hitSlop={8}
                >
                  <Text className="text-base font-semibold text-red-600 dark:text-red-400">
                    ✕
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Four Controller-wrapped fields: name (required), muscle_group,
                equipment, notes. Iterating over a tuple keeps the form layout
                consistent and the labels/placeholders co-located with their
                fields per UI-SPEC §"Inline create-form". */}
            {(["name", "muscle_group", "equipment", "notes"] as const).map(
              (fieldName) => {
                const labels: Record<typeof fieldName, string> = {
                  name: "Namn",
                  muscle_group: "Muskelgrupp",
                  equipment: "Utrustning",
                  notes: "Anteckningar",
                };
                const placeholders: Record<typeof fieldName, string> = {
                  name: "t.ex. Bänkpress",
                  muscle_group: "t.ex. Bröst",
                  equipment: "t.ex. Skivstång",
                  notes: "(valfritt)",
                };
                const isMultiline = fieldName === "notes";
                return (
                  <Controller
                    key={fieldName}
                    control={control}
                    name={fieldName}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <View className="gap-2">
                        <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                          {labels[fieldName]}
                        </Text>
                        <TextInput
                          value={value ?? ""}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholder={placeholders[fieldName]}
                          placeholderTextColor="#9CA3AF"
                          autoCapitalize="sentences"
                          autoComplete="off"
                          textContentType="none"
                          multiline={isMultiline}
                          numberOfLines={isMultiline ? 3 : undefined}
                          textAlignVertical={isMultiline ? "top" : undefined}
                          style={isMultiline ? { minHeight: 80 } : undefined}
                          accessibilityLabel={labels[fieldName]}
                          className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${
                            errors[fieldName]
                              ? "border-red-600 dark:border-red-400"
                              : "border-gray-300 dark:border-gray-700"
                          } focus:border-blue-600 dark:focus:border-blue-500`}
                        />
                        {errors[fieldName] && (
                          <Text
                            className="text-base text-red-600 dark:text-red-400"
                            accessibilityLiveRegion="polite"
                          >
                            {errors[fieldName]?.message}
                          </Text>
                        )}
                      </View>
                    )}
                  />
                );
              },
            )}

            <Pressable
              onPress={handleSubmit(onCreateAndAdd)}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={
                isSubmitting ? "Skapar" : "Skapa & lägg till"
              }
              className="w-full rounded-lg bg-blue-600 dark:bg-blue-500 py-4 items-center justify-center disabled:opacity-60 active:opacity-80"
            >
              <Text className="text-base font-semibold text-white">
                {isSubmitting ? "Skapar…" : "Skapa & lägg till"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowCreateForm(false);
                reset();
                setBannerError(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Avbryt"
              className="items-center justify-center py-3"
            >
              <Text className="text-base text-blue-600 dark:text-blue-400">
                Avbryt
              </Text>
            </Pressable>
          </ScrollView>
        ) : (
          <View className="flex-1 px-4 pt-4 gap-3">
            <Pressable
              onPress={() => setShowCreateForm(true)}
              accessibilityRole="button"
              accessibilityLabel="Skapa ny övning"
              className="flex-row items-center gap-2 rounded-lg border border-blue-600 dark:border-blue-500 px-4 py-3 active:opacity-80"
            >
              <Ionicons name="add" size={20} color={accent} />
              <Text className="text-base font-semibold text-blue-600 dark:text-blue-400">
                + Skapa ny övning
              </Text>
            </Pressable>

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Sök övning…"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Sök övning"
              className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border border-gray-300 dark:border-gray-700 focus:border-blue-600 dark:focus:border-blue-500"
            />

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
              ItemSeparatorComponent={() => <View className="h-2" />}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center gap-4 px-4 mt-12">
                  <Ionicons
                    name="add-circle-outline"
                    size={48}
                    color={accent}
                  />
                  <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                    {searchQuery.trim()
                      ? "Inga matchande övningar."
                      : "Inga övningar än"}
                  </Text>
                  <Text className="text-base text-gray-500 dark:text-gray-400 text-center">
                    {searchQuery.trim()
                      ? 'Tryck "+ Skapa ny övning".'
                      : "Skapa din första."}
                  </Text>
                </View>
              }
              renderItem={({ item: exercise }) => {
                const subtitle = [exercise.muscle_group, exercise.equipment]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Pressable
                    onPress={() => onPickExisting(exercise.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Lägg till ${exercise.name}`}
                    className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-4 active:opacity-80"
                  >
                    <View className="flex-1 mr-2">
                      <Text
                        className="text-base font-semibold text-gray-900 dark:text-gray-50"
                        numberOfLines={1}
                      >
                        {exercise.name}
                      </Text>
                      {subtitle ? (
                        <Text
                          className="text-sm text-gray-500 dark:text-gray-400"
                          numberOfLines={1}
                        >
                          {subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name="add-circle-outline"
                      size={24}
                      color={accent}
                    />
                  </Pressable>
                );
              }}
            />
          </View>
        )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
