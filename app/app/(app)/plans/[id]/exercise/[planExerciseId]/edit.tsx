// app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx
//
// Phase 4 Plan 03 Task 3: Per-plan_exercise targets edit (modal route).
//
// 4 fields driven by planExerciseFormSchema:
//   - target_sets, target_reps_min, target_reps_max (numeric, nullable)
//   - notes (multiline, nullable)
//
// Cross-field refine in the schema (target_reps_min ≤ target_reps_max when
// both set) attaches the error to target_reps_min via path: ['target_reps_min']
// — the error renders under the min field automatically.
//
// Hook contract:
//   - usePlanExercisesQuery(planId) is reused (already in cache from
//     plan-detail; no need for a new usePlanExerciseQuery(id) in V1).
//     The current row is found by .find on planExerciseId — 1ms on the
//     small per-plan list.
//   - useUpdatePlanExercise(planId) bakes scope.id='plan:<planId>'. The
//     UPDATE payload MUST include plan_id so Plan 04-01's setMutationDefaults
//     mutationFn can validate it (it throws if missing) — but plan_id is
//     stripped from the actual UPDATE body via destructuring inside the
//     default mutationFn so we don't write plan_id twice.
//
// Modal: <Stack.Screen options={{ presentation: 'modal', headerShown: true,
// title: 'Redigera mål' }} />. Avbryt is the auto-rendered header back-button.
//
// References:
//   - 04-CONTEXT.md D-11
//   - 04-UI-SPEC.md §"Plan_exercise edit screen" + §"Inline error states"
//     target_* error copy table
//   - 04-RESEARCH.md §5

import { useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  planExerciseFormSchema,
  type PlanExerciseFormInput,
} from "@/lib/schemas/plan-exercises";
import {
  usePlanExercisesQuery,
  useUpdatePlanExercise,
} from "@/lib/queries/plan-exercises";

// The schema uses z.coerce.number() on the numeric fields, so its INPUT type is
// `unknown` and its OUTPUT type is `number | null`. RHF v7's third generic
// (TTransformedValues) lets handleSubmit hand us the parsed output shape while
// the form values themselves carry the input shape (matches RHF's "form holds
// strings, schema parses to numbers" contract).
type PlanExerciseFormValues = z.input<typeof planExerciseFormSchema>;

export default function PlanExerciseEditScreen() {
  const router = useRouter();
  const { id: planId, planExerciseId } = useLocalSearchParams<{
    id: string;
    planExerciseId: string;
  }>();

  const { data: planExercises } = usePlanExercisesQuery(planId!);
  const updatePlanExercise = useUpdatePlanExercise(planId!);

  const planExercise = useMemo(
    () => planExercises?.find((px) => px.id === planExerciseId),
    [planExercises, planExerciseId],
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlanExerciseFormValues, undefined, PlanExerciseFormInput>({
    resolver: zodResolver(planExerciseFormSchema),
    mode: "onSubmit",
    defaultValues: {
      target_sets: planExercise?.target_sets ?? null,
      target_reps_min: planExercise?.target_reps_min ?? null,
      target_reps_max: planExercise?.target_reps_max ?? null,
      notes: planExercise?.notes ?? "",
    },
  });

  // Hydrate defaults once the cached row resolves. RHF's defaultValues only
  // apply on first mount; if the cache hasn't hydrated yet on first render,
  // we re-seed the form via reset() once it does.
  useEffect(() => {
    if (planExercise) {
      reset({
        target_sets: planExercise.target_sets ?? null,
        target_reps_min: planExercise.target_reps_min ?? null,
        target_reps_max: planExercise.target_reps_max ?? null,
        notes: planExercise.notes ?? "",
      });
    }
  }, [planExercise, reset]);

  const onSave = async (input: PlanExerciseFormInput) => {
    if (!planId || !planExerciseId) return;
    await updatePlanExercise.mutateAsync({
      id: planExerciseId,
      // plan_id is REQUIRED for scope.id='plan:<planId>' on the mutationFn
      // (Plan 04-01 setMutationDefaults throws when missing). The default's
      // mutationFn destructures plan_id out before sending the UPDATE so we
      // do not double-write it.
      plan_id: planId,
      target_sets: input.target_sets ?? null,
      target_reps_min: input.target_reps_min ?? null,
      target_reps_max: input.target_reps_max ?? null,
      notes: input.notes ?? null,
    });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <Stack.Screen
        options={{
          presentation: "modal",
          title: "Redigera mål",
          headerShown: true,
        }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 24,
            gap: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {(["target_sets", "target_reps_min", "target_reps_max"] as const).map(
            (fieldName) => {
              const labels: Record<typeof fieldName, string> = {
                target_sets: "Set",
                target_reps_min: "Reps min",
                target_reps_max: "Reps max",
              };
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
                        value={value == null ? "" : String(value)}
                        onChangeText={(t) => {
                          if (t === "") {
                            onChange(null);
                          } else {
                            const n = parseInt(t, 10);
                            onChange(Number.isNaN(n) ? null : n);
                          }
                        }}
                        onBlur={onBlur}
                        placeholder="—"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        inputMode="numeric"
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

          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <View className="gap-2">
                <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                  Anteckningar
                </Text>
                <TextInput
                  value={value ?? ""}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="t.ex. tempo, vinklar, deload-vecka"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={{ minHeight: 80 }}
                  accessibilityLabel="Anteckningar"
                  className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${
                    errors.notes
                      ? "border-red-600 dark:border-red-400"
                      : "border-gray-300 dark:border-gray-700"
                  } focus:border-blue-600 dark:focus:border-blue-500`}
                />
                {errors.notes && (
                  <Text
                    className="text-base text-red-600 dark:text-red-400"
                    accessibilityLiveRegion="polite"
                  >
                    {errors.notes.message}
                  </Text>
                )}
              </View>
            )}
          />

          <Pressable
            onPress={handleSubmit(onSave)}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={isSubmitting ? "Sparar" : "Spara"}
            className="w-full rounded-lg bg-blue-600 dark:bg-blue-500 py-4 items-center justify-center disabled:opacity-60 active:opacity-80"
          >
            <Text className="text-base font-semibold text-white">
              {isSubmitting ? "Sparar…" : "Spara"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
