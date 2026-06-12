// app/app/(app)/plans/new.tsx
//
// Phase 10 Plan 05 (SKIN-02 / D-12 / I18N-05): Forge re-skin of the create-plan
// form → FNewPlan (forge-screens.jsx line 1113).
//
// Layout (FNewPlan): modal-style header (back chevron + centered title) → large
// H1 title + description-help paragraph → name field (focused = 2px accent
// border, 56 tall) → description multiline box (optional, minHeight 110) →
// primary CTA "Skapa plan" with a trailing arrowRight (accent shadow).
//
// `workout_plans.description` already exists — NO migration (D-12). This screen
// surfaces the existing-but-hidden description field as a designed control.
//
// Validation boundary (CLAUDE.md Forms phase / Pitfall 8.13): RHF +
// zodResolver(planFormSchema) is preserved so name (required, ≤80) + description
// (optional, ≤500) are validated at the form boundary before the mutate. The
// name field's focused = 2px accent border is driven by RHF/Controller focus
// state through ForgeField's controlled `state` prop (ForgeField.tsx ln 68-72).
//
// Submit (SP-2 / Phase 4 UAT 2026-05-10): generate the row id client-side, then
// useCreatePlan().mutate({ id, user_id, name, description }, { onError }) —
// .mutate NOT mutateAsync (paused offline mutations never resolve mutateAsync,
// leaving "Skapar plan…" stuck forever in airplane mode). The optimistic
// onMutate has already written the row to the cache, so router.replace lands on
// plans/[id] instantly, online and offline.
//
// Modal patterns (10-UI-SPEC §Modal & overlay): own GestureHandlerRootView
// wrapper with a theme-aware backdrop (the root wrapper does not propagate into
// iOS modal UIViewControllers). Chrome via live t() (SP-5); plan name +
// description are user content, stored + rendered verbatim (D-16).
//
// Optical values (10-UI-SPEC §Spacing — inline style{} numbers, Pitfall 3):
// nav-row chevron button 40×40 radius 20; name field 56 tall; description box
// minHeight 110; primary CTA 60 tall radius 16.
//
// References:
//   - app/design v2/Sources/design/forge-screens.jsx FNewPlan (line 1113)
//   - .planning/phases/10-plans-exercises-re-skin/10-UI-SPEC.md §Interaction Contract / §Copywriting
//   - 10-PATTERNS.md SP-2/SP-5/SP-6/SP-8 + new.tsx assignment
//   - app/app/(app)/plans/[id]/exercise-picker.tsx (GHRV wrapper idiom)

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
import { useColorScheme } from "nativewind";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, type Href } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";

import { Icon } from "@/components/ui";
import { planFormSchema, type PlanFormInput } from "@/lib/schemas/plans";
import { useCreatePlan } from "@/lib/queries/plans";
import { useAuthStore } from "@/lib/auth-store";
import { randomUUID } from "@/lib/utils/uuid";

// ── Forge token hexes (light / dark) ────────────────────────────────────────
// Mirror the tailwind.config forge.* token pairs verbatim (10-UI-SPEC §Color),
// for the inline-style optical containers + Icon strokes (same split the
// edit/picker modals + ForgeButton use).
const TOKENS = {
  light: {
    text: "#0A0A0A",
    text2: "#4D4D4D",
    text3: "#8B8B8B",
    surface: "#FFFFFF",
    accent: "#E14E10",
    accentText: "#FFFFFF",
    border: "rgba(0,0,0,0.07)",
    danger: "#D70015",
  },
  dark: {
    text: "#FFFFFF",
    text2: "rgba(255,255,255,0.62)",
    text3: "rgba(255,255,255,0.38)",
    surface: "#0E0E10",
    accent: "#FF5A1F",
    accentText: "#FFFFFF",
    border: "rgba(255,255,255,0.08)",
    danger: "#FF453A",
  },
} as const;

export default function NewPlanScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const tk = TOKENS[colorScheme === "dark" ? "dark" : "light"];

  const userId = useAuthStore((s) => s.session?.user.id);
  const createPlan = useCreatePlan();
  const [bannerError, setBannerError] = useState<string | null>(null);
  // Track which field is focused so the name field shows the 2px accent border
  // (FNewPlan line 1156) — the description box stays a hairline border.
  const [focusedField, setFocusedField] = useState<
    "name" | "description" | null
  >(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormInput>({
    // mode: 'onSubmit' — errors surface only after the CTA; RHF auto-revalidates
    // onChange afterwards so errors clear as the user types a fix.
    resolver: zodResolver(planFormSchema),
    mode: "onSubmit",
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = (input: PlanFormInput) => {
    if (!userId) {
      setBannerError(t("errorNotSignedIn"));
      return;
    }
    setBannerError(null);
    const id = randomUUID();
    // .mutate (NOT mutateAsync) — SP-2. Optimistic onMutate has already written
    // the row to the cache, so navigate immediately. Works online + offline.
    createPlan.mutate(
      {
        id,
        user_id: userId,
        name: input.name,
        description: input.description ?? null,
      },
      { onError: () => setBannerError(t("errorGeneric")) },
    );
    router.replace(`/plans/${id}` as Href);
  };

  return (
    // Modal route — own GHRV wrapper with a theme-aware backdrop (SP-8).
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: tk.surface }}>
      <SafeAreaView className="flex-1 bg-forge-bg-light dark:bg-forge-bg">
        <Stack.Screen options={{ presentation: "modal", headerShown: false }} />
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Modal-style header — back chevron + centered title */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t("back")}
              hitSlop={8}
              style={({ pressed }) => [
                {
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: tk.surface,
                  borderWidth: 1,
                  borderColor: tk.border,
                  alignItems: "center",
                  justifyContent: "center",
                },
                pressed ? { opacity: 0.6 } : null,
              ]}
            >
              <Icon
                name="chevronLeft"
                size={18}
                color={tk.text}
                strokeWidth={2.2}
              />
            </Pressable>
            <Text
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                textAlign: "center",
                fontSize: 15,
                fontWeight: "600",
                color: tk.text,
                letterSpacing: -0.2,
              }}
            >
              {t("newPlan")}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hero title + description-help paragraph */}
            <View
              style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 }}
            >
              <Text
                style={{
                  fontSize: 36,
                  fontWeight: "700",
                  letterSpacing: -1.2,
                  lineHeight: 38,
                  color: tk.text,
                }}
              >
                {t("newPlan")}
              </Text>
              <Text
                style={{
                  marginTop: 10,
                  fontSize: 15,
                  color: tk.text2,
                  lineHeight: 21,
                  maxWidth: 320,
                }}
              >
                {t("planDescHelp")}
              </Text>
            </View>

            {/* Banner error (auth / server) — danger tokens. */}
            {bannerError ? (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <Pressable
                  onPress={() => setBannerError(null)}
                  accessibilityRole="button"
                  accessibilityLabel={bannerError}
                  accessibilityHint={t("closeModal")}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <Text
                    accessibilityLiveRegion="polite"
                    style={{ flex: 1, fontSize: 15, color: tk.danger }}
                  >
                    {bannerError}
                  </Text>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: tk.danger }}>
                    ✕
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={{ paddingHorizontal: 16, gap: 20 }}>
              {/* Name field (required, focused = 2px accent border) */}
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => {
                  const isFocused = focusedField === "name";
                  const borderColor = errors.name
                    ? tk.danger
                    : isFocused
                      ? tk.accent
                      : tk.border;
                  return (
                    <View>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          letterSpacing: 1.5,
                          color: tk.text3,
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        {t("name")}
                      </Text>
                      <View
                        style={{
                          height: 56,
                          borderRadius: 14,
                          backgroundColor: tk.surface,
                          // Constant 2px border width so focusing never resizes
                          // the field (UAT 09-03) — only the COLOR changes.
                          borderWidth: 2,
                          borderColor,
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 16,
                        }}
                      >
                        <TextInput
                          value={value ?? ""}
                          onChangeText={onChange}
                          onFocus={() => setFocusedField("name")}
                          onBlur={() => {
                            setFocusedField((f) => (f === "name" ? null : f));
                            onBlur();
                          }}
                          placeholder={t("namePlaceholder")}
                          placeholderTextColor={tk.text3}
                          autoCapitalize="sentences"
                          autoComplete="off"
                          textContentType="none"
                          accessibilityLabel={t("name")}
                          style={{
                            flex: 1,
                            fontSize: 16,
                            color: tk.text,
                            letterSpacing: -0.2,
                          }}
                        />
                      </View>
                      {errors.name ? (
                        <Text
                          accessibilityLiveRegion="polite"
                          style={{ fontSize: 13, color: tk.danger, marginTop: 6 }}
                        >
                          {errors.name.message}
                        </Text>
                      ) : null}
                    </View>
                  );
                }}
              />

              {/* Description field (optional, multiline) */}
              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, onBlur, value } }) => {
                  const isFocused = focusedField === "description";
                  const borderColor = errors.description
                    ? tk.danger
                    : isFocused
                      ? tk.accent
                      : tk.border;
                  return (
                    <View>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          letterSpacing: 1.5,
                          color: tk.text3,
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        {t("description")}{" "}
                        <Text
                          style={{
                            fontWeight: "400",
                            color: tk.text3,
                            letterSpacing: 0,
                            textTransform: "none",
                          }}
                        >
                          {t("optional")}
                        </Text>
                      </Text>
                      <View
                        style={{
                          minHeight: 110,
                          borderRadius: 14,
                          backgroundColor: tk.surface,
                          borderWidth: 1,
                          borderColor,
                          paddingHorizontal: 16,
                          paddingVertical: 14,
                        }}
                      >
                        <TextInput
                          value={value ?? ""}
                          onChangeText={onChange}
                          onFocus={() => setFocusedField("description")}
                          onBlur={() => {
                            setFocusedField((f) =>
                              f === "description" ? null : f,
                            );
                            onBlur();
                          }}
                          placeholder={t("optional")}
                          placeholderTextColor={tk.text3}
                          autoCapitalize="sentences"
                          multiline
                          textAlignVertical="top"
                          accessibilityLabel={t("description")}
                          style={{
                            flex: 1,
                            fontSize: 16,
                            color: tk.text,
                            lineHeight: 22,
                            letterSpacing: -0.1,
                            minHeight: 82,
                          }}
                        />
                      </View>
                      {errors.description ? (
                        <Text
                          accessibilityLiveRegion="polite"
                          style={{ fontSize: 13, color: tk.danger, marginTop: 6 }}
                        >
                          {errors.description.message}
                        </Text>
                      ) : null}
                    </View>
                  );
                }}
              />
            </View>

            {/* Primary CTA — Skapa plan, trailing arrowRight (accent shadow) */}
            <View style={{ paddingHorizontal: 16, paddingTop: 32 }}>
              <Pressable
                onPress={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={t("createPlan")}
                accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
                style={({ pressed }) => [
                  {
                    width: "100%",
                    height: 60,
                    borderRadius: 16,
                    backgroundColor: tk.accent,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    shadowColor: "#FF5A1F",
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.4,
                    shadowRadius: 16,
                  },
                  isSubmitting
                    ? { opacity: 0.5 }
                    : pressed
                      ? { opacity: 0.85 }
                      : null,
                ]}
              >
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "600",
                    letterSpacing: -0.2,
                    color: tk.accentText,
                  }}
                >
                  {t("createPlan")}
                </Text>
                <Icon
                  name="arrowRight"
                  size={18}
                  color={tk.accentText}
                  strokeWidth={2.2}
                />
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
