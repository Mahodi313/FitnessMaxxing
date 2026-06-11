// app/app/(auth)/sign-in.tsx
//
// Phase 9 (Plan 09-03) — Forge VISUAL re-skin of the Phase 3 sign-in screen.
//
// D-17: PURE visual re-skin. The RHF + Zod validation, the `error.code` switch
// mapping, the banner-error / field-error split, and ALL copy are UNCHANGED from
// Phase 3 — presentation only. Raw TextInput/Pressable → ForgeField/ForgeButton;
// hardcoded Swedish → t() (D-12, so the live language toggle reaches auth);
// field errors inline beneath each ForgeField (D-18); server failures form-level
// above the CTA (D-18); CTA spinner+disabled during async (D-19).
//
// Locked decisions still implemented (Phase 3, unchanged):
//   D-13: signInSchema requires password.min(1) only — server is the final arbiter
//   D-16: NO imperative router.replace on success — declarative routing via
//         Stack.Protected handles it
//   ASVS V2.1.4: invalid_credentials → generic "Fel email eller lösenord"
//
// FIT-66: every Pressable's pressed feedback uses a `style={({pressed})=>...}`
// callback — never the className-based pressed/shadow utilities (css-interop crash).
// Forge tokens carry light+dark parity (`-light` base + `dark:` DEFAULT sibling).
import { useId, useState } from "react";
import {
  Text,
  View,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";

import { signInSchema, type SignInInput } from "@/lib/schemas/auth";
import { supabase } from "@/lib/supabase";
import { ForgeField } from "@/components/ui/ForgeField";
import { ForgeButton } from "@/components/ui/ForgeButton";
import { Logo } from "@/components/ui/Logo";

// 28×28 brand-mark tile (FSignIn line 11) — Logo (white) on the brand gradient.
// react-native-svg engine, same pattern as settings.tsx ProfileAvatar; NativeWind
// cannot render a gradient fill. Brand-only surface (Ascend mark discipline).
function BrandMark() {
  const id = useId();
  const size = 28;
  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={size} y2={size} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FF7A2E" />
            <Stop offset="1" stopColor="#FF2D55" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} rx={8} ry={8} fill={`url(#${id})`} />
      </Svg>
      <Logo size={18} variant="white" />
    </View>
  );
}

export default function SignInScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
        // UR-04: detect AuthRetryableFetchError (offline / network failure) BEFORE
        // the truly-unmapped fall-through. Network failure is expected — not
        // diagnostic-worthy — so we surface a helpful copy and skip the WR-04
        // console.error to avoid Metro-log noise. UAT Test 8 reported the original
        // generic mapping created friction.
        if (error.name === "AuthRetryableFetchError") {
          setBannerError("Du verkar vara offline. Kontrollera din anslutning.");
          break;
        }
        // True unmapped error path. WR-04: log the full error shape so future
        // unmapped codes are diagnosable from the Metro log without needing to
        // repro.
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
    <SafeAreaView className="flex-1 bg-forge-bg-light dark:bg-forge-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            // FSignIn optical padding: 24px sides / 28px top / 32px bottom.
            paddingHorizontal: 28,
            paddingTop: 24,
            paddingBottom: 32,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1">
            {/* Brand mark (FSignIn line 11) */}
            <View className="flex-row items-center gap-2 pt-1">
              <BrandMark />
              <Text
                className="text-forge-text2-light dark:text-forge-text2"
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                FitnessMaxxing
              </Text>
            </View>

            {/* Hero heading (FSignIn line 27) — pushed to bottom via mt-auto */}
            <View style={{ marginTop: "auto", marginBottom: 36 }}>
              <Text
                className="text-forge-text-light dark:text-forge-text font-display-bold"
                style={{ fontSize: 44, letterSpacing: -1.4, lineHeight: 45 }}
              >
                {t("welcome")}
              </Text>
              <Text
                className="text-forge-text2-light dark:text-forge-text2"
                style={{ marginTop: 14, fontSize: 16, lineHeight: 22 }}
              >
                {t("welcomeSub")}
              </Text>
            </View>

            {/* Form (FSignIn line 39) — 14px field gap via inline gap */}
            <View style={{ gap: 14 }}>
              {/* Form-level server error (D-18) — above the field stack / CTA,
                  dismissible. Server-error literal copy stays inline per D-17. */}
              {bannerError && (
                <Pressable
                  onPress={() => setBannerError(null)}
                  accessibilityRole="button"
                  accessibilityLabel={bannerError}
                  accessibilityHint="Tryck för att stänga"
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <Text
                      className="flex-1 text-base text-forge-danger-light dark:text-forge-danger"
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
                      <Text className="text-base font-semibold text-forge-danger-light dark:text-forge-danger">
                        ✕
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              )}

              {/* Email field */}
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <View style={{ gap: 6 }}>
                    <ForgeField
                      icon="mail"
                      state={errors.email ? "error" : "default"}
                      value={value}
                      onChangeText={onChange}
                      placeholder={t("email")}
                      keyboardType="email-address"
                      accessibilityLabel={t("email")}
                    />
                    {errors.email && (
                      <Text
                        className="text-sm text-forge-danger-light dark:text-forge-danger"
                        accessibilityLiveRegion="polite"
                      >
                        {errors.email.message}
                      </Text>
                    )}
                  </View>
                )}
              />

              {/* Password field — ForgeField with its integrated `secureToggle`
                  eye (D-18). The eye now lives INSIDE the field as a trailing
                  flex child (right-aligned, vertically centered, FIT-66-safe);
                  no absolute positioning → no drift / no focus layout shift. */}
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <View style={{ gap: 6 }}>
                    <ForgeField
                      icon="lock"
                      state={errors.password ? "error" : "default"}
                      value={value}
                      onChangeText={onChange}
                      placeholder={t("password")}
                      secureToggle
                      showPasswordLabel={t("showPassword")}
                      hidePasswordLabel={t("hidePassword")}
                      accessibilityLabel={t("password")}
                    />
                    {errors.password && (
                      <Text
                        className="text-sm text-forge-danger-light dark:text-forge-danger"
                        accessibilityLiveRegion="polite"
                      >
                        {errors.password.message}
                      </Text>
                    )}
                  </View>
                )}
              />

              {/* Primary CTA (D-19 — loading prop = built-in spinner + disabled) */}
              <View style={{ marginTop: 12 }}>
                <ForgeButton
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isSubmitting}
                  label={t("signIn")}
                  onPress={handleSubmit(onSubmit)}
                />
              </View>

              {/* Forgot-password (FSignIn line 55) */}
              <View style={{ alignItems: "center", marginTop: 6 }}>
                <Text className="text-sm text-forge-text3-light dark:text-forge-text3">
                  {t("forgotPassword")}
                </Text>
              </View>
            </View>

            {/* Sign-up nav link (FSignIn line 61) — 6px gap, pushed to bottom */}
            <View
              className="flex-row items-center justify-center"
              style={{ marginTop: "auto", paddingTop: 24, gap: 6 }}
            >
              <Text className="text-forge-text2-light dark:text-forge-text2" style={{ fontSize: 15 }}>
                {t("noAccount")}
              </Text>
              <Pressable
                onPress={() => router.replace("/(auth)/sign-up")}
                accessibilityRole="link"
                accessibilityLabel={t("signUp")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
              >
                <Text
                  className="text-forge-accent-light dark:text-forge-accent"
                  style={{ fontSize: 15, fontWeight: "600" }}
                >
                  {t("signUp")}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
