// app/app/(auth)/sign-up.tsx
//
// Phase 3 sign-up screen — RHF + Zod 4 + supabase.auth.signUp.
//
// Locked decisions implemented:
//   D-01: Email-confirmation = OFF in Supabase Studio. signUp returns a session
//         immediately; no email-confirm round trip in V1. See Pitfall §6 below.
//   D-03: Duplicate-email error inline under email field (NOT generic) — accepts
//         email-existence disclosure since Supabase API exposes it regardless.
//   D-12: signUpSchema enforces password.min(12) (ASVS V2.1.1 / NIST SP 800-63B —
//         no complexity rule).
//   D-14: confirmPassword refine via signUpSchema (.refine).
//   D-15: Swedish error copy, inline.
//   D-16: NO imperative router.replace on success — declarative routing via root
//         Stack.Protected.
//
// UI-SPEC.md compliance: NativeWind Color §60/30/10 + F15 dark-mode pairs;
// helper text "Minst 12 tecken" renders BELOW password before validation fires
// and is replaced by error text on Zod failure; touch targets ≥ 44pt.
//
// Pitfall §6 (RESEARCH.md): if Studio "Confirm email" toggle is flipped ON in
// V1.1, signUp returns { session: null, user: {...} } and this code path will
// fall through to the "no error" branch but the listener will fire with
// session=null. The user would stay on the sign-up screen with no feedback.
// V1.1 plan: add `if (!data.session) return navigateToCheckEmail()` after the
// signUp call. Phase 3 hard-codes the D-01 assumption.
//
// Pitfall §7 (NativeWind): use `placeholderTextColor` prop, NOT a
// `placeholder:text-gray-*` class.
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
import { signUpSchema, type SignUpInput } from "@/lib/schemas/auth";
import { supabase } from "@/lib/supabase";

export default function SignUpScreen() {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    // mode: "onSubmit" (RHF default) — errors surface only after the user
    // presses the CTA, not when they tab between empty fields. After first
    // submit, RHF auto-revalidates onChange (default reValidateMode).
    mode: "onSubmit",
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async ({ email, password }: SignUpInput) => {
    setBannerError(null);
    setInfoBanner(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (!error) {
      // Pitfall §6 (debug session signup-silent-no-ui-feedback): if the project
      // has email confirmation enabled server-side, signUp returns
      // { error: null, data: { session: null, user: {...} } }. The auth-state
      // listener will NOT fire SIGNED_IN (session is null), so the user would
      // be stuck on this screen with no feedback. Detect it and show an info
      // banner directing them to the inbox.
      if (!data.session) {
        setInfoBanner(
          `Vi har skickat ett bekräftelsemail till ${email}. Klicka på länken i mailet och logga sedan in.`,
        );
        // Clear the form so the user doesn't see stale credentials behind the
        // info banner — the next interaction is "go to inbox", not "edit and
        // resubmit".
        reset();
        return;
      }
      // Happy path: session present → listener fires SIGNED_IN; root
      // Stack.Protected re-evaluates; user lands in (app) without an imperative
      // router.replace (D-16).
      return;
    }
    // Map AuthApiError.code → field-level or banner error.
    // VERIFIED codes from auth-js error-codes.ts (RESEARCH.md §E table).
    switch (error.code) {
      case "user_already_exists":
      case "email_exists":
        // D-03: inline under email; we accept that this discloses email
        // existence because Supabase API exposes it regardless of UI.
        setError("email", {
          message: "Detta email är redan registrerat — försök logga in",
        });
        break;
      case "weak_password":
        // Server-side rejection (in addition to client-side D-12 min(12)).
        setError("password", { message: "Lösenord för svagt — minst 12 tecken" });
        break;
      case "over_request_rate_limit":
      case "over_email_send_rate_limit":
        setBannerError("För många försök. Försök igen om en stund.");
        break;
      case "signup_disabled":
        setBannerError("Registrering är tillfälligt avstängd.");
        break;
      case "validation_failed":
        setBannerError("Email eller lösen ogiltigt format.");
        break;
      default:
        // Network errors (no .code), unexpected_failure, etc.
        // WR-04: log the full error shape so future unmapped codes are
        // diagnosable from the Metro log without needing to repro.
        setBannerError("Något gick fel. Försök igen.");
        console.error("[sign-up] unexpected error:", {
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
                Skapa konto
              </Text>
            </View>

            {/* Banner error */}
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

            {/* Info banner — shown when signup succeeded but session is null
                (email confirmation required server-side). Pitfall §6 path. */}
            {infoBanner && (
              <Pressable
                onPress={() => setInfoBanner(null)}
                accessibilityRole="button"
                accessibilityLabel={infoBanner}
              >
                <Text
                  className="text-base text-blue-700 dark:text-blue-300"
                  accessibilityLiveRegion="polite"
                >
                  {infoBanner}
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

              {/* Password field — with helper text "Minst 12 tecken" before validation */}
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
                      autoComplete="new-password"
                      textContentType="newPassword"
                      accessibilityLabel="Lösenord"
                      className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${
                        errors.password
                          ? "border-red-600 dark:border-red-400"
                          : "border-gray-300 dark:border-gray-700"
                      } focus:border-blue-600 dark:focus:border-blue-500`}
                    />
                    {errors.password ? (
                      <Text
                        className="text-base text-red-600 dark:text-red-400"
                        accessibilityLiveRegion="polite"
                      >
                        {errors.password.message}
                      </Text>
                    ) : (
                      // UI-SPEC.md helper text: visible until validation fires.
                      <Text className="text-base text-gray-500 dark:text-gray-400">
                        Minst 12 tecken
                      </Text>
                    )}
                  </View>
                )}
              />

              {/* Confirm password field */}
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View className="gap-2">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      Bekräfta lösenord
                    </Text>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      accessibilityLabel="Bekräfta lösenord"
                      className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${
                        errors.confirmPassword
                          ? "border-red-600 dark:border-red-400"
                          : "border-gray-300 dark:border-gray-700"
                      } focus:border-blue-600 dark:focus:border-blue-500`}
                    />
                    {errors.confirmPassword && (
                      <Text
                        className="text-base text-red-600 dark:text-red-400"
                        accessibilityLiveRegion="polite"
                      >
                        {errors.confirmPassword.message}
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
              accessibilityLabel={isSubmitting ? "Skapar konto" : "Skapa konto"}
              className="w-full rounded-lg bg-blue-600 dark:bg-blue-500 py-4 items-center justify-center disabled:opacity-60 active:opacity-80"
            >
              <Text className="text-base font-semibold text-white">
                {isSubmitting ? "Skapar konto…" : "Skapa konto"}
              </Text>
            </Pressable>

            {/* Nav link to sign-in */}
            <View className="flex-row items-center justify-center mt-8 gap-1">
              <Text className="text-base text-gray-900 dark:text-gray-50">
                Har du redan ett konto?
              </Text>
              <Pressable
                onPress={() => router.replace("/(auth)/sign-in")}
                accessibilityRole="link"
                accessibilityLabel="Logga in"
                className="py-3 px-2"
              >
                <Text className="text-base font-semibold text-blue-600 dark:text-blue-400">
                  Logga in
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
