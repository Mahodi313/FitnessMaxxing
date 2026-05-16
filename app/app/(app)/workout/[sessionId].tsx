// app/app/(app)/workout/[sessionId].tsx
//
// Phase 5: Active-workout screen. The hot path that F13 lives or dies on.
//
// Architecture:
//   - useSessionQuery seeds from sessionsKeys.active() via initialData
//     (Phase 4 Plan 04-04 commit b87bddf inheritance) so the screen never
//     renders "Laddar…" for an in-progress session.
//   - useSetsForSessionQuery hydrates the logged set rows from persister
//     cache. Called twice — once at WorkoutScreen (to derive
//     loggedSetCount for AvslutaOverlay copy per BLOCKER-01 fix) and
//     once inside WorkoutBody — TanStack dedupes by queryKey so the
//     duplicate is a zero-cost subscriber.
//   - useLastValueQuery is pre-fetched per plan_exercises.exercise_id on
//     mount (CONTEXT.md D-20) — staleTime 15min keeps F7 chips
//     offline-ready.
//   - useAddSet / useUpdateSet / useRemoveSet are scope-bound to
//     `session:${sessionId}` so all set-mutations replay FIFO under one
//     scope on reconnect (Pitfall 5.3).
//   - Avsluta-overlay uses the Phase 4 inline-overlay-confirm pattern
//     (commit e07029a) — NOT modal portal (commit 1f4d8d0 reserves
//     modal-presentation for picker/edit routes, not the workout screen).
//   - useFocusEffect cleanup resets showAvslutaOverlay + per-card
//     edit-mode state on blur (Pitfall 5 — freezeOnBlur retains React
//     state).
//
// Anti-patterns avoided (PLAN gates):
//   - Klart / Avsluta / Add / Update / Remove all use mutate (NOT
//     mutateAsync) — paused offline mutations don't resolve mutateAsync
//     under networkMode: 'offlineFirst' (Phase 4 commit 5d953b6).
//   - The Avsluta primary button is accent-blue, NOT red (PITFALLS §6.6
//     — finishing a pass is the intended terminal state, not data loss).
//   - Workout route is NOT modal (D-03 — declared in (app)/_layout.tsx
//     without presentation: 'modal').
//
// References:
//   - 05-CONTEXT.md D-01, D-04..D-23
//   - 05-UI-SPEC.md §lines 188-632
//   - 05-PATTERNS.md §workout/[sessionId].tsx
//   - 05-RESEARCH.md §useAddSet call-site + Open Q#4 (RESOLVED — second
//     OfflineBanner instance)
//   - PITFALLS §1.4, §5.3, §6.1, §6.2, §6.3, §6.6, §8.1, §8.13

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { randomUUID } from "@/lib/utils/uuid";

import { useFinishSession, useSessionQuery } from "@/lib/queries/sessions";
import {
  useAddSet,
  useRemoveSet,
  useSetsForSessionQuery,
  useUpdateSet,
} from "@/lib/queries/sets";
import { usePersistenceStore } from "@/lib/persistence-store";
import { OfflineBanner } from "@/components/offline-banner"; // Open Q#4 (RESOLVED) — second instance inside the F13 hot path
import { useLastValueQuery } from "@/lib/queries/last-value";
import { usePlanExercisesQuery } from "@/lib/queries/plan-exercises";
import { useExercisesQuery } from "@/lib/queries/exercises";

import {
  setFormSchema,
  type SetFormOutput,
  type SetRow,
} from "@/lib/schemas/sets";
import type { SessionRow } from "@/lib/schemas/sessions";
import type { PlanExerciseRow } from "@/lib/schemas/plan-exercises";

// RHF v7 3-generic shape (Phase 4 D-11 / commit f8b75b6):
// setFormSchema uses z.coerce.number() on weight_kg + reps so its INPUT
// type is `unknown` and OUTPUT type is `number`. The third generic
// (TTransformedValues) takes the OUTPUT alias so handleSubmit receives
// the parsed shape. Two-arg form triggers TS2322 due to
// @hookform/resolvers Resolver invariance.
type SetFormInput = z.input<typeof setFormSchema>;

// ---------------------------------------------------------------------------
// Default export — WorkoutScreen
// ---------------------------------------------------------------------------

export default function WorkoutScreen() {
  const router = useRouter();
  // WR-07 (05-REVIEW.md): useLocalSearchParams' generic argument is a TYPE
  // ASSERTION, not a runtime guard. The actual runtime shape is
  // Record<string, string | string[]> — a param could be string[] for
  // catch-all routes or malformed deep-links. Narrow explicitly so downstream
  // code (queryKey, route push back, etc.) never receives an array.
  const rawParams = useLocalSearchParams<{ sessionId: string }>();
  const sessionId =
    typeof rawParams.sessionId === "string" ? rawParams.sessionId : undefined;
  const [showAvslutaOverlay, setShowAvslutaOverlay] = useState(false);

  // Pitfall 5 + Phase 4 D-08 (commit af6930c) — freezeOnBlur retains React
  // state across navigation. Reset overlay state on blur so it doesn't
  // re-appear on focus.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setShowAvslutaOverlay(false);
      };
    }, []),
  );

  const { data: session } = useSessionQuery(sessionId ?? "");

  // BLOCKER-01 fix: derive loggedSetCount for AvslutaOverlay's D-23 copy
  // variants ('{N} set sparade…' vs 'Inget set är loggat…'). TanStack
  // dedupes by queryKey, so calling useSetsForSessionQuery here AND inside
  // WorkoutBody is zero extra fetch — both subscribers share the same
  // cache entry under setsKeys.list(sessionId).
  const { data: setsData } = useSetsForSessionQuery(session?.id ?? "");
  const loggedSetCount = setsData?.length ?? 0;

  // Plan 05-05 (FIT-8): hydration gate. PersistQueryClientProvider in
  // _layout.tsx fires onSuccess → setHydrated(true) once AsyncStorage
  // round-trip completes. Before that, useSetsForSessionQuery returns
  // undefined (offlineFirst, no cache yet) and exercise cards render
  // empty — the F13 brutal-test UAT (2026-05-13) observed this as
  // perceived data loss. On a warm app, hydrated is already true so
  // this affordance renders for 0 frames; on cold-start after force-
  // quit, it shows for the hydration window (~hundreds of ms).
  const hydrated = usePersistenceStore((s) => s.hydrated);

  if (!hydrated) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <Stack.Screen options={{ headerShown: true, title: "Pass" }} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-gray-500 dark:text-gray-400">
            Återställer pass…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Loading gate: gate on `!session` (NOT isPending) per Phase 4 plans/[id]
  // pattern — initialData seeding from sessionsKeys.active() makes
  // `session` populated synchronously for any active session.
  if (!session) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <Stack.Screen options={{ headerShown: true, title: "Pass" }} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-gray-500 dark:text-gray-400">
            Laddar…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        className="flex-1 bg-white dark:bg-gray-900"
        edges={["bottom"]}
      >
        <Stack.Screen
          options={{
            headerShown: true,
            title: "Pass",
            headerRight: () => (
              <Pressable
                onPress={() => setShowAvslutaOverlay(true)}
                accessibilityRole="button"
                accessibilityLabel="Avsluta passet"
                hitSlop={8}
                className="px-3 py-2 active:opacity-80"
              >
                <Text className="text-base font-semibold text-blue-600 dark:text-blue-400">
                  Avsluta
                </Text>
              </Pressable>
            ),
          }}
        />
        {/* WARNING-01 fix (Open Q#4 RESOLVED): second OfflineBanner
            instance mounted inside /workout/[sessionId] because the route
            is outside (tabs). Both instances state-mirror via
            useOnlineStatus(); F13 brutal-test asserts this banner is
            visible after force-quit re-open. */}
        <OfflineBanner />
        <WorkoutBody session={session} />
        {showAvslutaOverlay && (
          <AvslutaOverlay
            sessionId={session.id}
            loggedSetCount={loggedSetCount}
            onCancel={() => setShowAvslutaOverlay(false)}
            onFinish={() => {
              setShowAvslutaOverlay(false);
              router.replace("/(app)/(tabs)");
            }}
          />
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ---------------------------------------------------------------------------
// WorkoutBody — exercise-card list + KeyboardAvoidingView + defensive empty
// ---------------------------------------------------------------------------

function WorkoutBody({ session }: { session: SessionRow }) {
  const router = useRouter();
  const { data: planExercises } = usePlanExercisesQuery(session.plan_id ?? "");
  const { data: setsData } = useSetsForSessionQuery(session.id);
  const { data: exercises } = useExercisesQuery();

  // Exercise-name lookup via Map<id, name> per Phase 4 Plan 04-04 commit
  // 3bfaba8 (avoids a join in the queryFn; exercises cache is hot from
  // the picker route).
  const exerciseNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of exercises ?? []) m.set(e.id, e.name);
    return m;
  }, [exercises]);

  // Defensive empty-state per UI-SPEC line 236. The Phase 5 Starta-pass
  // CTA on plans/[id].tsx disables when planExercises.length === 0, so
  // this state is reachable only if a plan's exercises were removed
  // mid-pass — but the fallback keeps the screen usable.
  if ((planExercises?.length ?? 0) === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6 gap-3">
        <Ionicons name="list-outline" size={64} color="#2563EB" />
        <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50 text-center">
          Den här planen har inga övningar än
        </Text>
        <Text className="text-base text-gray-900 dark:text-gray-50 text-center">
          Gå tillbaka och lägg till några.
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Tillbaka till planen"
          className="rounded-lg bg-blue-600 dark:bg-blue-500 px-4 py-4 mt-3 active:opacity-80"
        >
          <Text className="text-base font-semibold text-white">
            Tillbaka till planen
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          paddingBottom: 96,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {(planExercises ?? []).map((pe) => (
          <ExerciseCard
            key={pe.id}
            planExercise={pe}
            exerciseName={
              exerciseNameById.get(pe.exercise_id) ?? "(övning saknas)"
            }
            sessionId={session.id}
            allSets={setsData ?? []}
          />
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// ExerciseCard — header + logged set-rows + always-visible set-input row
// ---------------------------------------------------------------------------

function ExerciseCard({
  planExercise,
  exerciseName,
  sessionId,
  allSets,
}: {
  planExercise: PlanExerciseRow;
  exerciseName: string;
  sessionId: string;
  allSets: SetRow[];
}) {
  // Pre-fetch F7 data on card mount per CONTEXT.md D-20. staleTime 15min
  // keeps the result in cache offline.
  const { data: lastValueMap } = useLastValueQuery(
    planExercise.exercise_id,
    sessionId,
  );

  // Filter logged sets for this exercise, sorted by set_number.
  const setsForThisExercise = useMemo(
    () =>
      allSets
        .filter((s) => s.exercise_id === planExercise.exercise_id)
        .sort((a, b) => a.set_number - b.set_number),
    [allSets, planExercise.exercise_id],
  );

  const loggedCount = setsForThisExercise.length;
  const currentSetNumber = loggedCount + 1;

  // D-10 pre-fill: after first set in this session, pre-fill from the
  // most-recent set in the same exercise in the same session. For set 1
  // (no prior in this session), pre-fill from F7 (last finished session,
  // set-position-aligned to currentSetNumber).
  const sessionPrefill =
    setsForThisExercise[setsForThisExercise.length - 1] ?? null;
  const f7PrefillEntry = lastValueMap?.[currentSetNumber];
  const prefillWeight =
    sessionPrefill?.weight_kg ?? f7PrefillEntry?.weight_kg ?? null;
  const prefillReps = sessionPrefill?.reps ?? f7PrefillEntry?.reps ?? null;

  // RHF for the always-visible inline set-input row (per-card form-state).
  // mode: 'onSubmit' per Phase 3 D-15 — avoid mid-typing "1.0 is invalid"
  // flicker on weight_kg.
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SetFormInput, undefined, SetFormOutput>({
    resolver: zodResolver(setFormSchema),
    mode: "onSubmit",
    defaultValues: {
      weight_kg: prefillWeight ?? undefined,
      reps: prefillReps ?? undefined,
      set_type: "working",
    },
  });

  // Re-hydrate defaults when prefill changes (e.g., after a set lands and
  // setsForThisExercise.length increments). Pin set_type to 'working' so
  // the schema default is preserved on every reset.
  useEffect(() => {
    reset({
      weight_kg: prefillWeight ?? undefined,
      reps: prefillReps ?? undefined,
      set_type: "working",
    });
  }, [prefillWeight, prefillReps, reset]);

  const addSet = useAddSet(sessionId);

  const onKlart = (input: SetFormOutput) => {
    // D-16 SUPERSEDED by Plan 05-04: server-side trigger assigns set_number;
    // client omits it on payload. Optimistic UI uses provisional value
    // computed in setMutationDefaults onMutate.
    addSet.mutate(
      {
        id: randomUUID(),
        session_id: sessionId,
        exercise_id: planExercise.exercise_id,
        weight_kg: input.weight_kg,
        reps: input.reps,
        rpe: input.rpe ?? null,
        completed_at: new Date().toISOString(),
        set_type: "working",
      },
      {
        onSuccess: () => {
          // D-10: pre-fill the next blank row with the just-logged values.
          // Optimistic onMutate already appended to setsKeys.list — the
          // useEffect-driven hydrate above will pick up the new prefill
          // shortly. We also call reset() to short-circuit form-state if
          // RHF retained the prior values.
          reset({
            weight_kg: input.weight_kg,
            reps: input.reps,
            set_type: "working",
          });
        },
        // onError: optimistic onMutate already wrote the row; rollback
        // happens in setMutationDefaults. Silent-optimistic per UI-SPEC
        // line 303.
      },
    );
  };

  // Plan-target chip + counter chip (header)
  const targetChip = formatTargetChip(planExercise);
  const counterChipText =
    planExercise.target_sets != null
      ? `${loggedCount}/${planExercise.target_sets} set klart`
      : `${loggedCount} set`;
  const counterReached =
    planExercise.target_sets != null &&
    loggedCount >= planExercise.target_sets;

  return (
    <View className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
      {/* Card header */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 gap-1 mr-3">
          <Text
            className="text-2xl font-semibold text-gray-900 dark:text-gray-50"
            numberOfLines={1}
          >
            {exerciseName}
          </Text>
          {(targetChip || planExercise.notes) && (
            <View className="flex-row flex-wrap gap-2 mt-1">
              {targetChip && (
                <View className="bg-gray-200 dark:bg-gray-700 rounded-full px-3 py-1">
                  <Text className="text-sm text-gray-900 dark:text-gray-50">
                    {targetChip}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
        <View
          className={`rounded-full px-3 py-1 ${
            counterReached
              ? "bg-green-100 dark:bg-green-900"
              : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          <Text
            className={`text-sm font-semibold ${
              counterReached
                ? "text-green-900 dark:text-green-100"
                : "text-gray-900 dark:text-gray-50"
            }`}
          >
            {counterChipText}
          </Text>
        </View>
      </View>

      {/* Logged set rows */}
      {setsForThisExercise.length > 0 && (
        <View className="gap-2 mt-2">
          {setsForThisExercise.map((set) => (
            <LoggedSetRow
              key={set.id}
              set={set}
              sessionId={sessionId}
            />
          ))}
        </View>
      )}

      {/* Always-visible inline set-input row */}
      <View className="flex-row items-center gap-2 mt-3">
        <Controller
          control={control}
          name="weight_kg"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View className="flex-1">
              <TextInput
                value={value == null ? "" : String(value)}
                onChangeText={onChange}
                placeholder="Vikt"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                inputMode="decimal"
                returnKeyType="done"
                autoCorrect={false}
                autoCapitalize="none"
                selectTextOnFocus={true}
                accessibilityLabel="Vikt i kilo"
                className={`rounded-md bg-white dark:bg-gray-900 border px-3 py-3 text-base font-semibold text-gray-900 dark:text-gray-50 min-h-[56px] ${
                  error
                    ? "border-red-600 dark:border-red-400"
                    : "border-gray-300 dark:border-gray-700"
                } focus:border-blue-600 dark:focus:border-blue-500`}
              />
              {error && (
                <Text
                  className="text-base text-red-600 dark:text-red-400 mt-1 px-1"
                  accessibilityLiveRegion="polite"
                >
                  {error.message}
                </Text>
              )}
            </View>
          )}
        />
        <Controller
          control={control}
          name="reps"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View className="flex-1">
              <TextInput
                value={value == null ? "" : String(value)}
                onChangeText={onChange}
                placeholder="Reps"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                inputMode="numeric"
                returnKeyType="done"
                autoCorrect={false}
                autoCapitalize="none"
                selectTextOnFocus={true}
                accessibilityLabel="Antal repetitioner"
                className={`rounded-md bg-white dark:bg-gray-900 border px-3 py-3 text-base font-semibold text-gray-900 dark:text-gray-50 min-h-[56px] ${
                  error
                    ? "border-red-600 dark:border-red-400"
                    : "border-gray-300 dark:border-gray-700"
                } focus:border-blue-600 dark:focus:border-blue-500`}
              />
              {error && (
                <Text
                  className="text-base text-red-600 dark:text-red-400 mt-1 px-1"
                  accessibilityLiveRegion="polite"
                >
                  {error.message}
                </Text>
              )}
            </View>
          )}
        />
        <Controller
          control={control}
          name="rpe"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View className="w-16">
              <TextInput
                value={value == null ? "" : String(value)}
                onChangeText={onChange}
                placeholder="RPE"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                inputMode="decimal"
                returnKeyType="done"
                autoCorrect={false}
                autoCapitalize="none"
                selectTextOnFocus={true}
                accessibilityLabel="Upplevd ansträngning, valfri"
                maxLength={4}
                className={`rounded-md bg-white dark:bg-gray-900 border px-2 py-3 text-base font-semibold text-gray-900 dark:text-gray-50 min-h-[56px] text-center ${
                  error
                    ? "border-red-600 dark:border-red-400"
                    : "border-gray-300 dark:border-gray-700"
                } focus:border-blue-600 dark:focus:border-blue-500`}
              />
              {error && (
                <Text
                  className="text-base text-red-600 dark:text-red-400 mt-1 px-1"
                  accessibilityLiveRegion="polite"
                >
                  {error.message}
                </Text>
              )}
            </View>
          )}
        />
        <Pressable
          onPress={handleSubmit(onKlart)}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Spara set"
          className="w-16 min-h-[56px] rounded-md bg-blue-600 dark:bg-blue-500 items-center justify-center disabled:opacity-60 active:opacity-80"
        >
          <Text className="text-base font-semibold text-white">Klart</Text>
        </Pressable>
      </View>

      {/* F7 chip — set-position-aligned. D-19: not rendered when no data. */}
      <LastValueChip
        exerciseId={planExercise.exercise_id}
        sessionId={sessionId}
        setNumber={currentSetNumber}
      />

      {/* Generic form-level error fallback (rare — Controller already
          renders per-field errors above) */}
      {errors.root && (
        <Text
          className="text-base text-red-600 dark:text-red-400 mt-2"
          accessibilityLiveRegion="polite"
        >
          {errors.root.message}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// LoggedSetRow — display + tap-to-edit + swipe-left-to-delete
// ---------------------------------------------------------------------------

function LoggedSetRow({
  set,
  sessionId,
}: {
  set: SetRow;
  sessionId: string;
}) {
  const [isEditing, setIsEditing] = useState(false);

  // Reset edit mode on screen blur (Pitfall 5 — freezeOnBlur).
  useFocusEffect(
    useCallback(() => {
      return () => setIsEditing(false);
    }, []),
  );

  const updateSet = useUpdateSet(sessionId);
  const removeSet = useRemoveSet(sessionId);

  if (isEditing) {
    return (
      <EditableSetRow
        set={set}
        onDone={(updated) => {
          if (updated) {
            updateSet.mutate({
              id: set.id,
              session_id: sessionId,
              weight_kg: updated.weight_kg,
              reps: updated.reps,
            });
          }
          setIsEditing(false);
        }}
      />
    );
  }

  const handleDelete = () => {
    removeSet.mutate({ id: set.id, session_id: sessionId });
  };

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={48}
      renderRightActions={() => (
        <Pressable
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel="Ta bort set"
          className="bg-red-600 dark:bg-red-500 justify-center items-center px-6 rounded-md"
        >
          <Text className="text-base font-semibold text-white">Ta bort</Text>
        </Pressable>
      )}
    >
      <Pressable
        onPress={() => setIsEditing(true)}
        accessibilityRole="button"
        accessibilityLabel={`Set ${set.set_number}: ${set.weight_kg} kilo gånger ${set.reps} reps. Tryck för att redigera.`}
        className="flex-row items-center bg-white dark:bg-gray-900 rounded-md px-3 py-3 active:opacity-80"
      >
        <Ionicons
          name="checkmark-circle"
          size={20}
          color="#16A34A"
        />
        <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 mx-2">
          Set {set.set_number}
        </Text>
        <Text className="text-base font-normal text-gray-900 dark:text-gray-50 flex-1">
          {`${set.weight_kg} × ${set.reps}`}
        </Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

// EditableSetRow — inline edit mode for a logged set. Mirrors the
// always-visible input row but pre-filled with the existing set values
// and submits via useUpdateSet (not useAddSet).
function EditableSetRow({
  set,
  onDone,
}: {
  set: SetRow;
  onDone: (updated: { weight_kg: number; reps: number } | null) => void;
}) {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SetFormInput, undefined, SetFormOutput>({
    resolver: zodResolver(setFormSchema),
    mode: "onSubmit",
    defaultValues: {
      weight_kg: set.weight_kg,
      reps: set.reps,
      set_type: set.set_type,
    },
  });

  return (
    <View className="flex-row items-center gap-2 bg-white dark:bg-gray-900 rounded-md px-3 py-3">
      <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400">
        Set {set.set_number}
      </Text>
      <Controller
        control={control}
        name="weight_kg"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <TextInput
            value={value == null ? "" : String(value)}
            onChangeText={onChange}
            placeholder="Vikt"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            inputMode="decimal"
            returnKeyType="done"
            autoCorrect={false}
            autoCapitalize="none"
            selectTextOnFocus={true}
            accessibilityLabel="Vikt i kilo"
            className={`flex-1 rounded-md bg-white dark:bg-gray-900 border px-3 py-2 text-base text-gray-900 dark:text-gray-50 min-h-[44px] ${
              error
                ? "border-red-600 dark:border-red-400"
                : "border-gray-300 dark:border-gray-700"
            }`}
          />
        )}
      />
      <Controller
        control={control}
        name="reps"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <TextInput
            value={value == null ? "" : String(value)}
            onChangeText={onChange}
            placeholder="Reps"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="done"
            autoCorrect={false}
            autoCapitalize="none"
            selectTextOnFocus={true}
            accessibilityLabel="Antal repetitioner"
            className={`flex-1 rounded-md bg-white dark:bg-gray-900 border px-3 py-2 text-base text-gray-900 dark:text-gray-50 min-h-[44px] ${
              error
                ? "border-red-600 dark:border-red-400"
                : "border-gray-300 dark:border-gray-700"
            }`}
          />
        )}
      />
      <Pressable
        onPress={handleSubmit((input) =>
          onDone({ weight_kg: input.weight_kg, reps: input.reps }),
        )}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Spara redigering"
        className="w-16 min-h-[44px] rounded-md bg-blue-600 dark:bg-blue-500 items-center justify-center disabled:opacity-60 active:opacity-80"
      >
        <Text className="text-base font-semibold text-white">Klart</Text>
      </Pressable>
      <Pressable
        onPress={() => onDone(null)}
        accessibilityRole="button"
        accessibilityLabel="Avbryt redigering"
        className="px-2 active:opacity-80"
        hitSlop={8}
      >
        <Ionicons name="close-outline" size={20} color="#6B7280" />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// LastValueChip — F7 set-position-aligned "Förra: 82.5 × 8" chip
// ---------------------------------------------------------------------------

function LastValueChip({
  exerciseId,
  sessionId,
  setNumber,
}: {
  exerciseId: string;
  sessionId: string;
  setNumber: number;
}) {
  const { data: lastValueMap } = useLastValueQuery(exerciseId, sessionId);
  const prev = lastValueMap?.[setNumber];
  if (!prev) return null; // D-19 — not rendered when no data
  return (
    <View className="flex-row items-center gap-1 px-3 py-1 mt-1">
      <Text className="text-base font-normal text-gray-500 dark:text-gray-400">
        Förra:
      </Text>
      <Text className="text-base font-semibold text-gray-500 dark:text-gray-400">
        {`${prev.weight_kg} × ${prev.reps}`}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// AvslutaOverlay — inline-overlay-confirm (NOT modal portal)
// ---------------------------------------------------------------------------
//
// Why inline-overlay, not Modal portal (verbatim plans/[id].tsx UAT
// 2026-05-10):
//   NativeWind/flex layout inside the Modal portal silently collapsed
//   (no scrim, dialog rendered at top-left). Explicit RN styles on the
//   layout primitives; NativeWind retained for the inner card content
//   where it works reliably.
//
// D-23 + PITFALLS §6.6 — the primary "Avsluta" button is accent-blue
// (NOT red). Finishing a pass is the intended terminal state, not a
// data-loss action. Red is reserved for the "Avsluta sessionen" button
// in the draft-resume overlay (Plan 03), where finishing an orphaned
// draft IS data-loss-adjacent.

function AvslutaOverlay({
  sessionId,
  loggedSetCount,
  onCancel,
  onFinish,
}: {
  sessionId: string;
  loggedSetCount: number;
  onCancel: () => void;
  onFinish: () => void;
}) {
  const finishSession = useFinishSession(sessionId);
  // D-N4: local notes state; nollställs vid unmount (Option A — minimal coupling).
  const [notes, setNotes] = useState<string>("");
  // D-N4 cleanup: reset notes-draft when the overlay unmounts (backdrop-tap,
  // Fortsätt, or Avsluta). Re-open mounts fresh with empty state.
  useEffect(() => () => setNotes(""), []);
  // Track keyboard height manually — KeyboardAvoidingView's `padding`/`height`
  // behaviors do not lift an absolutely-positioned, flex-end-anchored card on
  // iOS 15+/RN 0.81; the card visually moves to the bottom but stays under the
  // keyboard (UAT bug reported 2026-05-16, iPhone 15 Pro / iOS 26.4.2).
  // Solution: read the actual keyboard frame and apply paddingBottom directly.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const title = "Avsluta passet?";
  const body =
    loggedSetCount > 0
      ? `${loggedSetCount} set sparade. Avsluta passet?`
      : "Inget set är loggat. Avsluta utan att spara?";
  const primaryLabel =
    loggedSetCount > 0 ? "Avsluta" : "Avsluta utan att spara";

  const handleConfirm = () => {
    // mutate (NOT mutateAsync) — Phase 4 commit 5d953b6.
    // D-N3: include notes in payload; trim/null-normalization happens in
    // the ['session','finish'] mutationFn (Task 1 — client.ts).
    finishSession.mutate(
      { id: sessionId, finished_at: new Date().toISOString(), notes },
      {
        // onError: optimistic onMutate in Plan 01 setMutationDefaults
        // already cleared sessionsKeys.active(); rollback handled there.
      },
    );
    // Synchronous navigation — works even when mutation is paused
    // offline. The setMutationDefaults['session','finish'] onSettled
    // invalidates lastValueKeys.all (Open Q#2) so the next session's F7
    // chips include this session's working sets.
    onFinish();
  };

  // WR-05 (05-REVIEW.md): backdrop-tap dismisses (onPress={onCancel}). This
  // DIVERGES from the draft-resume overlay in (tabs)/index.tsx which uses
  // force-decision UX (no backdrop dismiss). Rationale: Avsluta-during-workout
  // is recoverable — the user can re-tap Avsluta in the header — whereas the
  // draft-resume overlay surfaces an orphan session that MUST be either
  // resumed or explicitly closed, so backdrop-dismiss there would leave the
  // user in an ambiguous state. UI-SPEC §line 250 (force-decision) vs
  // §line 558 (Avsluta-during-workout, dismissible).
  return (
    <Pressable
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        // D-N1 (revised 2026-05-16, iter 3): center the card normally; only
        // when the iOS keyboard is up do we switch to flex-end + paddingBottom
        // = keyboardHeight + 16 so the card lifts exactly above the keyboard.
        // This avoids the "modal slammed against bottom" look when no input
        // is focused while still solving the original UAT-blocker.
        justifyContent: keyboardHeight > 0 ? "flex-end" : "center",
        paddingHorizontal: 32,
        paddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : 0,
        zIndex: 2000,
      }}
      onPress={onCancel}
      accessibilityRole="button"
      accessibilityLabel="Stäng dialog"
    >
      {/* Inner Pressable claims the touch so backdrop-onPress (onCancel) does
          NOT fire when tapping the card itself (PATTERNS.md landmine #6).
          Doubling as a tap-to-dismiss-keyboard target: tap on the card body
          (outside TextInput / buttons) closes the keyboard, matching native
          iOS expectation. TextInput + button taps consume the event first,
          so this only fires on empty card surface. */}
      <Pressable
        style={{ width: "100%", maxWidth: 400 }}
        onPress={() => Keyboard.dismiss()}
      >
          <View
            className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6"
            style={{ gap: 16 }}
          >
            <View style={{ gap: 8 }}>
              <Text
                className="text-2xl font-semibold text-gray-900 dark:text-gray-50"
                accessibilityRole="header"
              >
                {title}
              </Text>
              <Text className="text-base text-gray-900 dark:text-gray-50">
                {body}
              </Text>
            </View>
            {/* D-N2: multi-line notes TextInput + char-counter */}
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anteckningar (valfri)"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              maxLength={500}
              style={{ minHeight: 80, maxHeight: 160 }}
              textAlignVertical="top"
              accessibilityLabel="Anteckningar för passet, valfri"
              className="rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 text-base text-gray-900 dark:text-gray-50"
            />
            {/* Counter: always visible; flips to red when > 480 (D-N2 warning threshold) */}
            <Text
              className={`text-sm text-right ${notes.length > 480 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}
            >
              {`${notes.length}/500`}
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Fortsätt passet"
                className="flex-1 py-4 rounded-lg bg-gray-200 dark:bg-gray-700 items-center justify-center active:opacity-80"
              >
                <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
                  Fortsätt
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
                className="flex-1 py-4 rounded-lg bg-blue-600 dark:bg-blue-500 items-center justify-center active:opacity-80"
              >
                <Text className="text-base font-semibold text-white">
                  {primaryLabel}
                </Text>
              </Pressable>
            </View>
          </View>
      </Pressable>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// formatTargetChip — UI-SPEC §lines 351-373 — render plan-target chip text
// ---------------------------------------------------------------------------

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
