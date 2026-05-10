// app/app/(app)/plans/[id].tsx
//
// Phase 4 Plan 03 Task 1: Plan-detail screen.
// Phase 4 Plan 04 Task 1: Drag-to-reorder integration.
//
// Three responsibilities composed on one screen:
//   1. Plan-meta read + edit (RHF + planFormSchema; explicit Spara button only
//      when isDirty per UI-SPEC §"Plan-edit form mode decision").
//   2. plan_exercises listed in a DraggableFlatList (Plan 04). Each row:
//      drag-handle column + name + optional target chip + edit chevron +
//      remove ✕. onDragEnd calls useReorderPlanExercises(planId).reorder()
//      which runs Plan 01's two-phase write (negative offsets first, then
//      final positions, all under shared scope.id='plan:<planId>'). The
//      DraggableFlatList is the screen-level scroller — NOT wrapped in a
//      <ScrollView> per RESEARCH §8.5 (gestures bubble and break in nested
//      scrollers).
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
//   - useReorderPlanExercises(planId): two-phase orchestrator returning
//     { reorder(newOrder) }. The hook owns its own optimistic-cache snapshot
//     and rollback; the screen only forwards the new array from
//     DraggableFlatList's onDragEnd callback.
//
// Header opt-in: <Stack.Screen options={{ headerShown: true, ... }} /> with
// useColorScheme()-bound headerStyle/headerTintColor per CLAUDE.md ## Conventions
// "Real screens (Phase 4+)".
//
// References:
//   - 04-CONTEXT.md D-08, D-09, D-10, D-11, D-12
//   - 04-UI-SPEC.md §Plan edit + §Visuals "Plan_exercise row" + §"Empty states"
//   - 04-RESEARCH.md §3 (drag library API + ScaleDecorator + scope.id),
//     §5 (FK-safe replay), §8.5 (do-not-nest-scrollers Pitfall)
//   - PITFALLS §8.1, §8.13

import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { planFormSchema, type PlanFormInput } from "@/lib/schemas/plans";
import {
  usePlanQuery,
  useUpdatePlan,
  useArchivePlan,
} from "@/lib/queries/plans";
import {
  usePlanExercisesQuery,
  useRemovePlanExercise,
  useReorderPlanExercises,
} from "@/lib/queries/plan-exercises";
import { useExercisesQuery } from "@/lib/queries/exercises";
import type { PlanExerciseRow as PlanExerciseRowDb } from "@/lib/schemas/plan-exercises";

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

  const { data: plan } = usePlanQuery(id!);
  const { data: planExercises, isPending: pxPending } = usePlanExercisesQuery(
    id!,
  );
  // V1: plan_exercises rows don't join exercises.name in the cache (Plan 04-01
  // queryFn selects '*' from plan_exercises only). Resolve via the exercises
  // cache at render-time — useExercisesQuery is already mounted by the picker
  // route so the data is hot. UAT 2026-05-10: replaced the "Övning <8-char-id>"
  // fallback that surfaced raw uuids in the list.
  const { data: exercises } = useExercisesQuery();
  const exerciseNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of exercises ?? []) m.set(e.id, e.name);
    return m;
  }, [exercises]);

  // Hooks accept the planId so scope.id binds to `plan:<planId>` per Plan
  // 04-01's resource-hook contract — chained mutations on the same plan
  // replay serially on reconnect.
  const updatePlan = useUpdatePlan(id);
  const archivePlan = useArchivePlan(id);
  const removePlanExercise = useRemovePlanExercise(id!);
  const reorderPlanExercises = useReorderPlanExercises(id!);

  // onDragEnd handler for DraggableFlatList. The library hands us the new
  // ordered array — we forward to Plan 01's two-phase reorder orchestrator
  // (which owns the optimistic-cache snapshot, phase-1 negative offsets,
  // phase-2 final positions, and rollback on phase-1 error).
  const handleReorder = (newOrder: PlanExerciseRowShape[]) => {
    if (!planExercises) return;
    // The drag library carries the same row objects through; cast to the
    // schema-parsed PlanExerciseRow type the reorder hook expects.
    reorderPlanExercises.reorder(newOrder as unknown as PlanExerciseRowDb[]);
  };

  const [bannerError, setBannerError] = useState<string | null>(null);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

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

  const onSaveMeta = (input: PlanFormInput) => {
    if (!plan) return;
    setBannerError(null);
    // mutate (not mutateAsync) so the call returns synchronously even when
    // the mutation is paused under networkMode: 'offlineFirst'. The optimistic
    // onMutate in Plan 01's setMutationDefaults updates the cache so the form
    // is instantly correct. UAT 2026-05-10 regression: mutateAsync left
    // "Sparar…" stuck forever in airplane mode.
    updatePlan.mutate(
      {
        id: plan.id,
        name: input.name,
        description: input.description ?? null,
      },
      { onError: () => setBannerError("Något gick fel. Försök igen.") },
    );
    reset({ name: input.name, description: input.description ?? "" });
  };

  // Archive uses an in-app themed Modal instead of Alert.alert because the
  // iOS native UIAlertController can't honour UI-SPEC §"Destructive
  // confirmation" (which mandates bg-red-600 dark:bg-red-500 on the
  // destructive button). UAT 2026-05-10: native alert looked out of place.
  const onArchivePress = () => {
    if (!plan) return;
    setShowArchiveConfirm(true);
  };
  const onArchiveConfirm = () => {
    if (!plan) return;
    setShowArchiveConfirm(false);
    archivePlan.mutate(
      { id: plan.id },
      { onError: () => setBannerError("Kunde inte arkivera. Försök igen.") },
    );
    // Navigate immediately — optimistic onMutate already removed the row from
    // the active-plans cache. Works offline (queued).
    router.back();
  };

  // Overflow menu used to be ActionSheetIOS — UAT 2026-05-10 showed it
  // rendering as a malformed floating pill on iOS dark mode that overlapped
  // the "Lägg till övning" CTA. Replaced with a themed bottom-sheet Modal so
  // it matches the rest of the app's design language (and is portable to
  // Android in the future without a second code path).
  const onOverflowPress = () => setShowOverflowMenu(true);
  const onOverflowArchivePress = () => {
    setShowOverflowMenu(false);
    // Open confirm modal on next tick so the bottom-sheet dismiss animation
    // can finish first; otherwise stacked modals on iOS can flicker.
    setTimeout(() => onArchivePress(), 50);
  };

  // Loading state intentionally gates on `!plan` only (not isPending). With
  // initialData seeding usePlanQuery from the list cache + the dual-write
  // optimistic onMutate in setMutationDefaults['plan','create'], `plan` is
  // populated from millisecond zero for any plan visible in Planer. Tying
  // the loading branch to isPending would re-blank the screen on every
  // background refetch (UAT 2026-05-10).
  if (!plan) {
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
          // headerStyle / headerTintColor / headerBackButtonDisplayMode are
          // inherited from (app)/_layout.tsx screenOptions (UAT 2026-05-10).
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
        <DraggableFlatList<PlanExerciseRowShape>
          data={(planExercises ?? []) as PlanExerciseRowShape[]}
          keyExtractor={(item) => item.id}
          onDragEnd={({ data }) => handleReorder(data)}
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
          renderItem={({
            item: planExercise,
            drag,
            isActive,
          }: RenderItemParams<PlanExerciseRowShape>) => (
            <ScaleDecorator>
              <PlanExerciseRow
                planExercise={planExercise}
                exerciseName={
                  exerciseNameById.get(planExercise.exercise_id) ??
                  "(övning saknas)"
                }
                drag={drag}
                isActive={isActive}
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
            </ScaleDecorator>
          )}
        />
      </KeyboardAvoidingView>

      {/* Themed overflow-menu bottom sheet. Replaces ActionSheetIOS which
          rendered as a malformed floating pill in iOS dark mode (UAT
          2026-05-10). Slides up from the bottom; tap scrim or "Avbryt" to
          dismiss. Currently only one meaningful action ("Arkivera plan") —
          extension point for future per-plan actions (duplicate, share, etc). */}
      <Modal
        visible={showOverflowMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOverflowMenu(false)}
        statusBarTranslucent
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setShowOverflowMenu(false)}
          accessibilityRole="button"
          accessibilityLabel="Stäng meny"
        >
          <Pressable
            className="bg-white dark:bg-gray-900 rounded-t-3xl pb-8"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            </View>
            <Pressable
              onPress={onOverflowArchivePress}
              accessibilityRole="button"
              accessibilityLabel="Arkivera plan"
              className="px-6 py-5 active:opacity-80 border-t border-gray-200 dark:border-gray-700"
            >
              <Text className="text-base font-semibold text-red-600 dark:text-red-400">
                Arkivera plan
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowOverflowMenu(false)}
              accessibilityRole="button"
              accessibilityLabel="Avbryt"
              className="px-6 py-5 active:opacity-80 border-t border-gray-200 dark:border-gray-700"
            >
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
                Avbryt
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Themed archive-confirmation dialog (UI-SPEC §Destructive confirmation).
          transparent + animationType="fade" keeps the underlying plan-detail
          visible behind the scrim so the user retains context. Tapping the
          scrim cancels (same affordance as the Avbryt button). */}
      <Modal
        visible={showArchiveConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowArchiveConfirm(false)}
        statusBarTranslucent
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 px-8"
          onPress={() => setShowArchiveConfirm(false)}
          accessibilityRole="button"
          accessibilityLabel="Stäng dialog"
        >
          <Pressable
            className="w-full bg-white dark:bg-gray-900 rounded-lg p-6 gap-3"
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              className="text-lg font-semibold text-gray-900 dark:text-gray-50"
              accessibilityRole="header"
            >
              Arkivera &ldquo;{plan.name}&rdquo;?
            </Text>
            <Text className="text-base text-gray-500 dark:text-gray-400">
              Planen tas bort från listan. Pass som använt planen behåller sin
              historik.
            </Text>
            <View className="flex-row gap-2 justify-end mt-2">
              <Pressable
                onPress={() => setShowArchiveConfirm(false)}
                accessibilityRole="button"
                accessibilityLabel="Avbryt"
                className="px-4 py-3 rounded-lg active:opacity-80"
              >
                <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
                  Avbryt
                </Text>
              </Pressable>
              <Pressable
                onPress={onArchiveConfirm}
                accessibilityRole="button"
                accessibilityLabel="Arkivera plan"
                className="bg-red-600 dark:bg-red-500 px-4 py-3 rounded-lg active:opacity-80"
              >
                <Text className="text-base font-semibold text-white">
                  Arkivera
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// PlanExerciseRow — local component (Plan 04 extends with drag-handle column).
// Keeping it inline avoids a 2-file diff for what is a single-component
// evolution.
//
// V1: the cached PlanExercise row does NOT join exercises.name (Plan 01's
// queryFn selects '*' from plan_exercises only). The parent screen resolves
// the name from useExercisesQuery and passes it down via the exerciseName
// prop. Optimistic and DB rows render the same way because the picker's
// optimistic onMutate populates the exercises cache before navigating back.
//
// Drag-handle (Plan 04 + UI-SPEC §Visuals "Plan_exercise row"): leading
// Pressable wrapping `Ionicons reorder-three-outline` with
// onLongPress={drag} + accessibilityLabel="Drag för att ändra ordning"
// + p-3 padding (48pt total touch target around the 24pt icon).
// `isActive` adds a subtle opacity-80 to the row body while dragging
// (ScaleDecorator already handles the scale-up on the parent renderItem).
function PlanExerciseRow({
  planExercise,
  exerciseName,
  drag,
  isActive,
  onEdit,
  onRemove,
  muted,
}: {
  planExercise: PlanExerciseRowShape;
  exerciseName: string;
  drag: () => void;
  isActive: boolean;
  onEdit: () => void;
  onRemove: () => void;
  muted: string;
}) {
  const targetChip = formatTargetChip(planExercise);
  return (
    <View
      className={`flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-4 ${
        isActive ? "opacity-80" : ""
      }`}
    >
      <Pressable
        onLongPress={drag}
        accessibilityRole="button"
        accessibilityLabel="Drag för att ändra ordning"
        className="p-3 active:opacity-80"
        hitSlop={4}
      >
        <Ionicons name="reorder-three-outline" size={24} color={muted} />
      </Pressable>
      <View className="flex-1 mx-2">
        <Text
          className="text-base font-semibold text-gray-900 dark:text-gray-50"
          numberOfLines={1}
        >
          {exerciseName}
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
