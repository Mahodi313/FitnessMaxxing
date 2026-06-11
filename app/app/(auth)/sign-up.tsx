// app/app/(auth)/sign-up.tsx
//
// Phase 9 (Plan 09-03) — Forge VISUAL re-skin of the Phase 3 sign-up screen,
// mirroring sign-in.tsx exactly.
//
// D-17: PURE visual re-skin. The RHF + Zod validation, the `onSubmit` flow
// (incl. the Pitfall §6 session-null info-banner path), the `error.code` switch
// mapping, the banner/field error split, and ALL copy are UNCHANGED from Phase 3.
// Raw TextInput/Pressable → ForgeField/ForgeButton; hardcoded Swedish → t() (D-12);
// field errors inline beneath each ForgeField (D-18); server failures form-level
// above the CTA (D-18); CTA spinner+disabled during async (D-19).
//
// Locked decisions still implemented (Phase 3, unchanged):
//   D-01: Email-confirmation = OFF in Studio; signUp returns a session immediately.
//   D-03: Duplicate-email error inline under email field.
//   D-12: signUpSchema enforces password.min(12) (ASVS V2.1.1 / NIST SP 800-63B).
//   D-14: confirmPassword refine via signUpSchema (.refine).
//   D-16: NO imperative router.replace on success — declarative Stack.Protected.
//
// Pitfall §6: if Studio "Confirm email" is flipped ON in V1.1, signUp returns
// { session: null, user: {...} } and the listener won't fire SIGNED_IN. The
// info-banner path below detects it and directs the user to their inbox.
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

import { signUpSchema, type SignUpInput } from "@/lib/schemas/auth";
import { supabase } from "@/lib/supabase";
import { ForgeField } from "@/components/ui/ForgeField";
import { ForgeButton } from "@/components/ui/ForgeButton";
import { Logo } from "@/components/ui/Logo";

// 28×28 brand-mark tile (mirrors sign-in.tsx BrandMark) — Logo (white) on the
// brand gradient via react-native-svg. NativeWind cannot render a gradient fill.
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

export default function SignUpScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async ({ name, email, password }: SignUpInput) => {
    setBannerError(null);
    setInfoBanner(null);
    // Pass the display name as user metadata. The 0008 handle_new_user trigger
    // reads raw_user_meta_data->>'display_name' and writes it to
    // profiles.display_name on the auth.users insert. Trimmed at the form
    // boundary (Zod also caps it at 80 chars).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name.trim() } },
    });
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
        console.error("[sign-up] unexpected error:", {
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
            // FSignUp optical padding: 24px sides / 28px top / 32px bottom.
            paddingHorizontal: 28,
            paddingTop: 24,
            paddingBottom: 32,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1">
            {/* Brand mark */}
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

            {/* Hero heading — pushed to bottom via mt-auto */}
            <View style={{ marginTop: "auto", marginBottom: 36 }}>
              <Text
                className="text-forge-text-light dark:text-forge-text font-display-bold"
                style={{ fontSize: 44, letterSpacing: -1.4, lineHeight: 45 }}
              >
                Skapa konto
              </Text>
            </View>

            {/* Form — 14px field gap via inline gap */}
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

              {/* Info banner — shown when signup succeeded but session is null
                  (email confirmation required server-side). Pitfall §6 path. */}
              {infoBanner && (
                <Pressable
                  onPress={() => setInfoBanner(null)}
                  accessibilityRole="button"
                  accessibilityLabel={infoBanner}
                  accessibilityHint="Tryck för att stänga"
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <Text
                      className="flex-1 text-base text-forge-accent-light dark:text-forge-accent"
                      accessibilityLiveRegion="polite"
                    >
                      {infoBanner}
                    </Text>
                    <Pressable
                      onPress={() => setInfoBanner(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Stäng"
                      className="px-2 py-1"
                      hitSlop={8}
                    >
                      <Text className="text-base font-semibold text-forge-accent-light dark:text-forge-accent">
                        ✕
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              )}

              {/* Name field (FSignUp line 1061) — first field, person icon.
                  Collected here and stored to profiles.display_name via the
                  0008 trigger + signUp metadata. */}
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, value } }) => (
                  <View style={{ gap: 6 }}>
                    <ForgeField
                      icon="user"
                      state={errors.name ? "error" : "default"}
                      value={value}
                      onChangeText={onChange}
                      placeholder={t("name")}
                      accessibilityLabel={t("name")}
                    />
                    {errors.name && (
                      <Text
                        className="text-sm text-forge-danger-light dark:text-forge-danger"
                        accessibilityLiveRegion="polite"
                      >
                        {errors.name.message}
                      </Text>
                    )}
                  </View>
                )}
              />

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

              {/* Password field — ForgeField with integrated `secureToggle`
                  eye (D-18). Helper text "Minst 12 tecken" stays until
                  validation fires (D-17 copy). */}
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
                    {errors.password ? (
                      <Text
                        className="text-sm text-forge-danger-light dark:text-forge-danger"
                        accessibilityLiveRegion="polite"
                      >
                        {errors.password.message}
                      </Text>
                    ) : (
                      // UI-SPEC.md helper text: visible until validation fires.
                      <Text className="text-sm text-forge-text3-light dark:text-forge-text3">
                        Minst 12 tecken
                      </Text>
                    )}
                  </View>
                )}
              />

              {/* Confirm password field — ForgeField with integrated
                  `secureToggle` eye (D-18). */}
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, value } }) => (
                  <View style={{ gap: 6 }}>
                    <ForgeField
                      icon="lock"
                      state={errors.confirmPassword ? "error" : "default"}
                      value={value}
                      onChangeText={onChange}
                      placeholder={t("password")}
                      secureToggle
                      showPasswordLabel={t("showPassword")}
                      hidePasswordLabel={t("hidePassword")}
                      accessibilityLabel="Bekräfta lösenord"
                    />
                    {errors.confirmPassword && (
                      <Text
                        className="text-sm text-forge-danger-light dark:text-forge-danger"
                        accessibilityLiveRegion="polite"
                      >
                        {errors.confirmPassword.message}
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
                  label="Skapa konto"
                  onPress={handleSubmit(onSubmit)}
                />
              </View>
            </View>

            {/* Sign-in nav link — 6px gap, pushed to bottom */}
            <View
              className="flex-row items-center justify-center"
              style={{ marginTop: "auto", paddingTop: 24, gap: 6 }}
            >
              <Text className="text-forge-text2-light dark:text-forge-text2" style={{ fontSize: 15 }}>
                Har du redan ett konto?
              </Text>
              <Pressable
                onPress={() => router.replace("/(auth)/sign-in")}
                accessibilityRole="link"
                accessibilityLabel={t("signIn")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
              >
                <Text
                  className="text-forge-accent-light dark:text-forge-accent"
                  style={{ fontSize: 15, fontWeight: "600" }}
                >
                  {t("signIn")}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
