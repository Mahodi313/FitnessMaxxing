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

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
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
import { useStartSession } from "@/lib/queries/sessions";
import { useAuthStore } from "@/lib/auth-store";
import { randomUUID } from "@/lib/utils/uuid";
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

  // Phase 5 D-02 "Starta pass" CTA.
  //
  // useState lazy-init (NOT a bare randomUUID()) so the new session id is
  // STABLE across re-renders. Without lazy init randomUUID() would re-run
  // each render and the scope.id baked into useStartSession would change
  // every render, breaking serial replay (Pitfall 3 + Plan 04-01 SUMMARY
  // auto-fix Rule 1).
  //
  // Passing newSessionId into useStartSession at constructor time makes the
  // hook's scope: { id: `session:${newSessionId}` } a STATIC string — the
  // only valid shape per TanStack v5's static-scope contract.
  const [newSessionId] = useState(() => randomUUID());
  const userId = useAuthStore((s) => s.session?.user.id);
  const startSession = useStartSession(newSessionId);

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

  // freezeOnBlur (set on the (app) Stack screenOptions) keeps this screen
  // mounted across navigation. Without this hook a modal left open before
  // navigating away would still be visible when returning to this screen.
  // Reset modal state every time the screen gains focus.
  useFocusEffect(
    useCallback(() => {
      setShowOverflowMenu(false);
      setShowArchiveConfirm(false);
    }, []),
  );

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

  // Phase 5 D-02 — "Starta pass" handler.
  //
  // mutate (NOT mutateAsync) per Phase 4 commit 5d953b6 UAT lesson: paused
  // mutations under networkMode: 'offlineFirst' never resolve mutateAsync,
  // leaving the button stuck forever offline. The optimistic onMutate in
  // Plan 01's setMutationDefaults dual-writes sessionsKeys.active() and
  // sessionsKeys.detail(newSessionId), so the destination /workout/<id>
  // screen has data immediately on router.push regardless of network.
  const canStart = (planExercises?.length ?? 0) > 0;
  const onStarta = () => {
    if (!userId || !plan) return;
    setBannerError(null);
    startSession.mutate(
      {
        id: newSessionId,
        user_id: userId,
        plan_id: plan.id,
        started_at: new Date().toISOString(),
      },
      {
        onError: () =>
          setBannerError("Kunde inte starta passet. Försök igen."),
      },
    );
    // Optimistic navigation — onMutate already populated the active +
    // detail caches; works online and offline.
    //
    // `as Href` cast: cross-plan route literal — the destination route
    // `/workout/[sessionId]` is registered in (app)/_layout.tsx (this plan),
    // but router.d.ts may not have regenerated yet when this code first
    // type-checks. The cast becomes inert after the dev server regenerates
    // .expo/types. Phase 4 Plan 04-02 Deviation §2 precedent.
    router.push(`/workout/${newSessionId}` as Href);
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

              {/* Phase 5 D-02 — "Starta pass" primary CTA. Helper text only
                  rendered when the plan has zero exercises (button disabled
                  state — UI-SPEC). */}
              {!canStart && (
                <Text className="text-base text-gray-500 dark:text-gray-400 px-1 mt-2">
                  Lägg till minst en övning för att kunna starta.
                </Text>
              )}
              <Pressable
                onPress={onStarta}
                disabled={!canStart}
                accessibilityRole="button"
                accessibilityLabel={
                  canStart ? "Starta pass" : "Lägg till minst en övning först"
                }
                className="rounded-lg bg-blue-600 dark:bg-blue-500 py-4 mt-2 active:opacity-80 disabled:opacity-50 items-center justify-center"
              >
                <Text className="text-base font-semibold text-white">
                  Starta pass
                </Text>
              </Pressable>

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

      {/* Overflow menu — iOS-style popover anchored top-right under the
          ellipsis. Replaces a bottom-sheet Modal whose NativeWind layout
          classes wouldn't apply reliably inside the Modal portal (UAT
          2026-05-10). No Modal here, just an absolute-positioned overlay
          rendered inline — the styling pipeline is the same as the rest of
          the screen so it can't silently break.

          Tap outside the popover (anywhere on the transparent backdrop) to
          dismiss. Explicit React Native StyleSheet values for visual props
          (shadows, popover background) so dark-mode is bound to the
          useColorScheme() value already in scope. */}
      {showOverflowMenu && (
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
          }}
          onPress={() => setShowOverflowMenu(false)}
          accessibilityRole="button"
          accessibilityLabel="Stäng meny"
        >
          <View
            style={{
              position: "absolute",
              // The popover lives inside the Stack.Screen content container, so
              // top: 0 = just below the navigation header. A small 4pt gap
              // makes it feel like it dropped down from the ellipsis button.
              top: 4,
              right: 16,
              minWidth: 200,
              backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
              borderRadius: 12,
              paddingVertical: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 8,
              borderWidth: isDark ? 1 : 0,
              borderColor: isDark ? "#374151" : "transparent",
            }}
          >
            <Pressable
              onPress={onOverflowArchivePress}
              accessibilityRole="button"
              accessibilityLabel="Arkivera plan"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  color: isDark ? "#F87171" : "#DC2626",
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                Arkivera plan
              </Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* Themed archive-confirm dialog. Inline absolute-positioned overlay
          (not a Modal) — same pattern as the overflow popover, for the same
          reason: NativeWind/flex layout inside the Modal portal silently
          collapsed (UAT 2026-05-10 — no scrim, dialog rendered at top-left).
          Explicit RN styles on the layout primitives; NativeWind retained
          for the inner card content where it works reliably. */}
      {showArchiveConfirm && (
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
            paddingHorizontal: 32,
            zIndex: 2000,
          }}
          onPress={() => setShowArchiveConfirm(false)}
          accessibilityRole="button"
          accessibilityLabel="Stäng dialog"
        >
          <Pressable
            style={{
              width: "100%",
              maxWidth: 400,
              backgroundColor: isDark ? "#111827" : "#FFFFFF",
              borderRadius: 12,
              padding: 24,
              gap: 12,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: isDark ? "#F9FAFB" : "#111827",
              }}
              accessibilityRole="header"
            >
              Arkivera &ldquo;{plan.name}&rdquo;?
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: isDark ? "#9CA3AF" : "#6B7280",
              }}
            >
              Planen tas bort från listan. Pass som använt planen behåller sin
              historik.
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <Pressable
                onPress={() => setShowArchiveConfirm(false)}
                accessibilityRole="button"
                accessibilityLabel="Avbryt"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: isDark ? "#F9FAFB" : "#111827",
                  }}
                >
                  Avbryt
                </Text>
              </Pressable>
              <Pressable
                onPress={onArchiveConfirm}
                accessibilityRole="button"
                accessibilityLabel="Arkivera plan"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: isDark ? "#EF4444" : "#DC2626",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#FFFFFF",
                  }}
                >
                  Arkivera
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      )}
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
