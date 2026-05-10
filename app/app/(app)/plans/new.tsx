// app/app/(app)/plans/new.tsx
//
// Phase 4 Plan 02 Task 3: Create-plan form.
//
// Stack:
//   - RHF + zodResolver(planFormSchema) at form boundary (Pitfall 8.13 V5
//     input validation per CLAUDE.md Forms phase / Phase 3 D-12).
//   - useCreatePlan from @/lib/queries/plans (Plan 04-01 — mutationKey-only;
//     mutationFn lives in lib/query/client.ts setMutationDefaults).
//   - randomUUID() from @/lib/utils/uuid generates the row id at the
//     mutate-call site so optimistic update has a stable key from the first
//     millisecond and replay is idempotent (CONTEXT.md D-06 + Pitfall 5.1).
//
// Patterns inherited verbatim from Phase 3 (auth)/sign-in.tsx:
//   - SafeAreaView → KeyboardAvoidingView → ScrollView container
//   - Banner+✕ pattern for form-level errors (red color tokens — distinct
//     from OfflineBanner yellow)
//   - Controller-wrapped TextInput with error border swap
//   - mode: 'onSubmit' (matches Phase 3 D-15 amendment + UI-SPEC plan-edit)
//   - placeholderTextColor="#9CA3AF" (Pitfall 7 NativeWind workaround)
//
// Header: <Stack.Screen options={{ headerShown: true, title: 'Ny plan' }} />
// per-screen header opt-in (CLAUDE.md ## Conventions). Back-arrow is
// auto-rendered; no in-screen "Avbryt" button per UI-SPEC §"Cancel/back link".
//
// Submit flow:
//   - On valid submit, generate UUID client-side, call createPlan.mutateAsync
//     with id + user_id (from auth-store) + name + (description ?? null).
//   - On success: router.replace(`/plans/${id}`) — Plan 04-03 owns that
//     route. Until Plan 04-03 ships the navigation 404s, but the row is
//     already in the cache via optimistic update so no data is lost.
//   - On offline: setMutationDefaults pauses the mutation (networkMode:
//     'offlineFirst'); mutateAsync resolves once optimistic-update fires
//     so we still navigate. The OfflineBanner up the tree communicates
//     queue state.
//   - On online error: setMutationDefaults onError rolls back; we surface
//     a banner with "Något gick fel. Försök igen."
//
// References:
//   - 04-CONTEXT.md D-05, D-06, D-07
//   - 04-UI-SPEC.md §Plan create Copywriting Contract + §Visuals
//   - 04-RESEARCH.md §5
//   - PITFALLS §8.1, §8.13, §5.1, §7

import { useState } from "react";
import {
  Text,
  TextInput,
  View,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, type Href } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { planFormSchema, type PlanFormInput } from "@/lib/schemas/plans";
import { useCreatePlan } from "@/lib/queries/plans";
import { useAuthStore } from "@/lib/auth-store";
import { randomUUID } from "@/lib/utils/uuid";

export default function NewPlanScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user.id);
  const createPlan = useCreatePlan();
  const [bannerError, setBannerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormInput>({
    resolver: zodResolver(planFormSchema),
    // mode: 'onSubmit' — matches Phase 3 D-15 amendment + UI-SPEC plan-edit
    // form-mode decision. Errors surface only after the user presses the CTA;
    // RHF auto-revalidates onChange (default reValidateMode) afterwards so
    // errors clear as the user types a fix.
    mode: "onSubmit",
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = async (input: PlanFormInput) => {
    if (!userId) {
      setBannerError("Du måste vara inloggad för att skapa en plan.");
      return;
    }
    setBannerError(null);
    const id = randomUUID();
    try {
      await createPlan.mutateAsync({
        id,
        user_id: userId,
        name: input.name,
        description: input.description ?? null,
      });
      // Navigate even when offline — optimistic insert already populated
      // the cache so /plans/[id] (Plan 04-03) renders the row immediately.
      router.replace(`/plans/${id}` as Href);
    } catch {
      // Online error: setMutationDefaults onError already rolled back the
      // optimistic state. Offline mutations are paused (networkMode:
      // 'offlineFirst') and don't throw — they queue and replay on
      // reconnect. So this catch only fires on actual server-side errors.
      setBannerError("Något gick fel. Försök igen.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <Stack.Screen options={{ headerShown: true, title: "Ny plan" }} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 16,
            paddingVertical: 48,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-6">
            {/* Heading is rendered by Stack.Screen header — no in-screen
                <Text> heading per UI-SPEC §Plan create. */}

            {/* Banner error (server / unmapped error) — red tokens to
                distinguish from yellow OfflineBanner. */}
            {bannerError && (
              <Pressable
                onPress={() => setBannerError(null)}
                accessibilityRole="button"
                accessibilityLabel={bannerError}
                accessibilityHint="Tryck för att stänga"
              >
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
              </Pressable>
            )}

            {/* Field block */}
            <View className="gap-4">
              {/* Name field */}
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

              {/* Description field (optional, multiline) */}
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
                    {errors.description ? (
                      <Text
                        className="text-base text-red-600 dark:text-red-400"
                        accessibilityLiveRegion="polite"
                      >
                        {errors.description.message}
                      </Text>
                    ) : (
                      <Text className="text-base text-gray-500 dark:text-gray-400">
                        Valfritt — beskriv vad planen är till för.
                      </Text>
                    )}
                  </View>
                )}
              />
            </View>

            {/* Primary CTA */}
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={isSubmitting ? "Skapar plan" : "Skapa plan"}
              className="w-full rounded-lg bg-blue-600 dark:bg-blue-500 py-4 items-center justify-center disabled:opacity-60 active:opacity-80"
            >
              <Text className="text-base font-semibold text-white">
                {isSubmitting ? "Skapar plan…" : "Skapa plan"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
