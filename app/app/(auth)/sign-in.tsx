// app/app/(auth)/sign-in.tsx
//
// Phase 3 sign-in screen — RHF + Zod 4 + supabase.auth.signInWithPassword.
//
// Locked decisions implemented:
//   D-13: signInSchema requires password.min(1) only — server is the final arbiter
//   D-15: Swedish error copy, inline
//   D-16: NO imperative router.replace on success — declarative routing via
//         Stack.Protected handles it
//   ASVS V2.1.4: invalid_credentials → generic "Fel email eller lösen" (NOT
//   distinguishing wrong-email from wrong-password)
//
// UI-SPEC.md compliance: NativeWind classes per UI-SPEC Color §60/30/10 + F15
// dark-mode pairs; touch targets ≥ 44pt via py-4 on CTA / py-3 on nav link;
// keyboardType="email-address" + autoCapitalize="none" + autoComplete="email"
// for iOS AutoFill.
//
// Pitfall §7 (NativeWind placeholder: text-color conflict): use the native
// `placeholderTextColor` prop, NOT a `placeholder:text-gray-*` class.
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
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, type SignInInput } from "@/lib/schemas/auth";
import { supabase } from "@/lib/supabase";

export default function SignInScreen() {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    // mode: "onSubmit" (RHF default) — errors surface only after the user
    // presses the CTA, not when they tab between empty fields. After first
    // submit, RHF auto-revalidates onChange (default reValidateMode), so the
    // error clears as the user types a fix.
    mode: "onSubmit",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async ({ email, password }: SignInInput) => {
    setBannerError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      // Listener fires SIGNED_IN; root Stack.Protected re-evaluates; user lands
      // in (app) without an imperative router.replace (D-16).
      return;
    }
    // Map AuthApiError.code → field-level or banner error.
    // VERIFIED codes from auth-js error-codes.ts (RESEARCH.md §E table).
    switch (error.code) {
      case "invalid_credentials":
        // ASVS V2.1.4: do NOT distinguish wrong-email vs wrong-password.
        setError("password", { message: "Fel email eller lösenord" });
        break;
      case "email_not_confirmed":
        // Surfaced when the project has email confirmation enabled server-side
        // and the user has registered but not yet clicked the confirmation link.
        // Debug session: signup-silent-no-ui-feedback.
        setBannerError(
          "Bekräfta ditt email först. Kolla din inkorg för bekräftelselänken.",
        );
        break;
      case "over_request_rate_limit":
        setBannerError("För många försök. Försök igen om en stund.");
        break;
      case "validation_failed":
        setBannerError("Email eller lösen ogiltigt format.");
        break;
      default:
        // Network errors (no .code), unexpected_failure, etc.
        // WR-04: log the full error shape so future unmapped codes are
        // diagnosable from the Metro log without needing to repro.
        setBannerError("Något gick fel. Försök igen.");
        console.error("[sign-in] unexpected error:", {
          code: error.code,
          message: error.message,
          status: (error as { status?: number }).status,
          name: error.name,
        });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
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
            {/* Heading block */}
            <View className="gap-2">
              <Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
                Logga in
              </Text>
            </View>

            {/* Banner error (network / rate-limit / unknown) */}
            {bannerError && (
              <Pressable
                onPress={() => setBannerError(null)}
                accessibilityRole="button"
                accessibilityLabel={bannerError}
              >
                <Text
                  className="text-base text-red-600 dark:text-red-400"
                  accessibilityLiveRegion="polite"
                >
                  {bannerError}
                </Text>
              </Pressable>
            )}

            {/* Field block */}
            <View className="gap-4">
              {/* Email field */}
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View className="gap-2">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      Email
                    </Text>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="du@example.com"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      textContentType="emailAddress"
                      accessibilityLabel="Email"
                      className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${
                        errors.email
                          ? "border-red-600 dark:border-red-400"
                          : "border-gray-300 dark:border-gray-700"
                      } focus:border-blue-600 dark:focus:border-blue-500`}
                    />
                    {errors.email && (
                      <Text
                        className="text-base text-red-600 dark:text-red-400"
                        accessibilityLiveRegion="polite"
                      >
                        {errors.email.message}
                      </Text>
                    )}
                  </View>
                )}
              />

              {/* Password field */}
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View className="gap-2">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      Lösenord
                    </Text>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="password"
                      textContentType="password"
                      accessibilityLabel="Lösenord"
                      className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${
                        errors.password
                          ? "border-red-600 dark:border-red-400"
                          : "border-gray-300 dark:border-gray-700"
                      } focus:border-blue-600 dark:focus:border-blue-500`}
                    />
                    {errors.password && (
                      <Text
                        className="text-base text-red-600 dark:text-red-400"
                        accessibilityLiveRegion="polite"
                      >
                        {errors.password.message}
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
              accessibilityLabel={isSubmitting ? "Loggar in" : "Logga in"}
              className="w-full rounded-lg bg-blue-600 dark:bg-blue-500 py-4 items-center justify-center disabled:opacity-60 active:opacity-80"
            >
              <Text className="text-base font-semibold text-white">
                {isSubmitting ? "Loggar in…" : "Logga in"}
              </Text>
            </Pressable>

            {/* Nav link to sign-up */}
            <View className="flex-row items-center justify-center mt-8 gap-1">
              <Text className="text-base text-gray-900 dark:text-gray-50">
                Inget konto?
              </Text>
              <Pressable
                onPress={() => router.replace("/(auth)/sign-up")}
                accessibilityRole="link"
                accessibilityLabel="Registrera"
                className="py-3 px-2"
              >
                <Text className="text-base font-semibold text-blue-600 dark:text-blue-400">
                  Registrera
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
