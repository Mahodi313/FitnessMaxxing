// app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx
//
// Phase 10 Plan 04 (SKIN-03 / I18N-05): Forge re-skin of the plan-exercise
// target-edit modal → FExerciseEdit (forge-screens.jsx line 1438).
//
// Surfaces the schema fields v1 hid as a designed control set:
//   - target preview chip (`4 × 6–8 reps`, null-safe from the live stepper state)
//   - sets stepper (single FStepperInput)
//   - reps Min/Max stepper pair (two FStepperInputs + "–" separator)
//   - notes (multiline ForgeField, stored RAW — D-16)
//   - remove-from-plan (danger-ghost ForgeButton, no confirm — reversible)
//
// Targets are FULLY OPTIONAL (D-14): a range, one bound, or none. Every stepper
// is clearable to null (the − tile decrements; an explicit "clear" via long-press
// is out of scope — tapping − at the floor sets null). target_sets /
// target_reps_min / target_reps_max are independent nullable bounds.
//
// Header (UI-SPEC §Interaction Contract + §Copywriting):
//   - dismiss = `t('closeModal')` (Stäng, accent) — modal-close affordance,
//     abandons edits and returns to plan detail. NOT a generic "Avbryt".
//   - confirm = `t('saveTargets')` (Spara mål, accent bold) — saves the
//     target/notes edits. NOT a bare "Spara".
//   - title  = `t('editTargets')` (Redigera mål).
//
// Submit contract (SP-2 / Phase 4 UAT 2026-05-10):
//   useUpdatePlanExercise(planId).mutate({ id, plan_id, target_*, notes },
//   { onError }) — .mutate NOT mutateAsync. Paused offline mutations never
//   resolve mutateAsync, leaving the save stuck forever in airplane mode. The
//   optimistic onMutate in Plan 01's setMutationDefaults updates the cache
//   instantly so router.back() lands on plan-detail with the new targets.
//   plan_id is REQUIRED so the default mutationFn can read scope.id; it is
//   stripped from the UPDATE body inside the default (no double-write).
//
// Modal patterns (Phase 4 locked / 10-UI-SPEC §Modal & overlay):
//   - own GestureHandlerRootView wrapper with a theme-aware backdrop (the root
//     wrapper in app/_layout.tsx does not propagate into iOS modal
//     UIViewControllers).
//   - useFocusEffect resets local overlay state on focus (freezeOnBlur
//     precedent — frozen screens retain React state across navigation).
//
// Optical values (10-UI-SPEC §Spacing — NativeWind 4 / Tailwind 3 purges
// off-scale arbitrary classes, so these are inline `style={{}}` numbers,
// Pitfall 3):
//   - FStepperInput container 120×64 radius 14 borderStrong; ± tiles 32×32
//     radius 8 (− on surface2, + on accent); stepper value 22px Inter Display tnum.
//   - target chip padding 6×12 radius 10 accentSoft; remove button 52 tall radius 14.
//
// References:
//   - app/design v2/Sources/design/forge-screens.jsx FExerciseEdit (1438) + FStepperInput (1553)
//   - .planning/phases/10-plans-exercises-re-skin/10-UI-SPEC.md §Interaction Contract / §Copywriting
//   - 10-PATTERNS.md edit assignment + SP-2/SP-5/SP-6/SP-7/SP-8
//   - app/app/(app)/plans/[id]/exercise-picker.tsx (GHRV wrapper idiom)

import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useColorScheme } from "nativewind";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from "expo-router";
import { useTranslation } from "react-i18next";

import { ForgeButton, Icon } from "@/components/ui";
import {
  usePlanExercisesQuery,
  useUpdatePlanExercise,
  useRemovePlanExercise,
} from "@/lib/queries/plan-exercises";
import { useExercisesQuery } from "@/lib/queries/exercises";

// ── Forge token hexes (light / dark) ────────────────────────────────────────
// Inline raw colors are needed where a prop takes a color (Icon stroke, stepper
// tile backgrounds, optical-value containers). They mirror the tailwind.config
// forge.* token pairs verbatim (10-UI-SPEC §Color). Class-driven surfaces still
// use the `-light dark:` token classes; these hexes are only for the optical
// inline-style containers + Icon strokes (the same split ForgeButton uses).
const TOKENS = {
  light: {
    text: "#0A0A0A",
    text2: "#4D4D4D",
    text3: "#8B8B8B",
    surface: "#FFFFFF",
    surface2: "#F2F1EC",
    accent: "#E14E10",
    accentText: "#FFFFFF",
    accentSoft: "rgba(225,78,16,0.10)",
    border: "rgba(0,0,0,0.07)",
    borderStrong: "rgba(0,0,0,0.14)",
    danger: "#D70015",
  },
  dark: {
    text: "#FFFFFF",
    text2: "rgba(255,255,255,0.62)",
    text3: "rgba(255,255,255,0.38)",
    surface: "#0E0E10",
    surface2: "#18181B",
    accent: "#FF5A1F",
    accentText: "#FFFFFF",
    accentSoft: "rgba(255,90,31,0.14)",
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.14)",
    danger: "#FF453A",
  },
} as const;

// ── FStepperInput (composed from tokens — forge-screens.jsx line 1553) ───────
// A nullable numeric stepper. The − tile decrements (clamped to a floor → null
// at/below the floor, so targets stay fully optional, D-14); the + tile
// increments (null → start). The value reads tabular-nums (DSGN-03) in Inter
// Display 22px. `sub` is the 9px UPPERCASE sub-label (Min / Max). Touch targets
// are ≥44px via hitSlop even though the visible tile is 32×32.
function FStepperInput({
  value,
  onChange,
  sub,
  start = 1,
  floor = 1,
  step = 1,
  incrementLabel,
  decrementLabel,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  sub?: string;
  start?: number;
  floor?: number;
  step?: number;
  incrementLabel: string;
  decrementLabel: string;
}) {
  const { colorScheme } = useColorScheme();
  const tk = TOKENS[colorScheme === "dark" ? "dark" : "light"];

  const increment = () =>
    onChange(value == null ? start : value + step);
  const decrement = () => {
    if (value == null) return;
    const next = value - step;
    onChange(next < floor ? null : next);
  };

  return (
    <View
      style={{
        width: 120,
        height: 64,
        borderRadius: 14,
        backgroundColor: tk.surface,
        borderWidth: 1,
        borderColor: tk.borderStrong,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 8,
      }}
    >
      <Pressable
        onPress={decrement}
        accessibilityRole="button"
        accessibilityLabel={decrementLabel}
        hitSlop={8}
        className="w-8 h-8 rounded-lg items-center justify-center bg-forge-surface2-light dark:bg-forge-surface2"
        style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
      >
        {/* − glyph: a 14×2.4 rounded bar (matches FStepperInput line 1567) */}
        <View style={{ width: 14, height: 2.4, borderRadius: 2, backgroundColor: tk.text2 }} />
      </Pressable>

      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: tk.text,
            letterSpacing: -0.5,
            lineHeight: 24,
            fontVariant: ["tabular-nums"],
          }}
        >
          {value == null ? "–" : String(value)}
        </Text>
        {sub ? (
          <Text
            style={{
              fontSize: 9,
              fontWeight: "700",
              color: tk.text3,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              marginTop: 3,
            }}
          >
            {sub}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={increment}
        accessibilityRole="button"
        accessibilityLabel={incrementLabel}
        hitSlop={8}
        className="w-8 h-8 rounded-lg items-center justify-center bg-forge-accent-light dark:bg-forge-accent"
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      >
        <Icon name="plus" size={14} color={tk.accentText} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

export default function PlanExerciseEditScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const tk = TOKENS[colorScheme === "dark" ? "dark" : "light"];

  const { id: planId, planExerciseId } = useLocalSearchParams<{
    id: string;
    planExerciseId: string;
  }>();

  const { data: planExercises } = usePlanExercisesQuery(planId!);
  const { data: exercises } = useExercisesQuery();
  const updatePlanExercise = useUpdatePlanExercise(planId!);
  const removePlanExercise = useRemovePlanExercise(planId!);

  const planExercise = planExercises?.find((px) => px.id === planExerciseId);

  // Hero name: resolve the exercise by exercise_id; bilingual seed rows render
  // via t('exercise.<seed_key>.name'), user rows render their raw name verbatim
  // (D-16 — user content never auto-translated). Null-safe: no row → no hero.
  const exercise = exercises?.find((e) => e.id === planExercise?.exercise_id);
  const exerciseName = exercise
    ? exercise.seed_key
      ? t(`exercise.${exercise.seed_key}.name`, { defaultValue: exercise.name })
      : exercise.name
    : null;

  // Local stepper state, seeded from the cached row. Targets are fully optional
  // (D-14) so every field is `number | null`. We re-seed on focus (below) so a
  // late-hydrating cache or a re-open after a prior edit shows fresh values.
  const [sets, setSets] = useState<number | null>(
    planExercise?.target_sets ?? null,
  );
  const [repsMin, setRepsMin] = useState<number | null>(
    planExercise?.target_reps_min ?? null,
  );
  const [repsMax, setRepsMax] = useState<number | null>(
    planExercise?.target_reps_max ?? null,
  );
  const [notes, setNotes] = useState<string>(planExercise?.notes ?? "");

  // SP-7: reset local edit state on focus. Frozen screens (freezeOnBlur) retain
  // React state across navigation; re-seed from the freshest cached row each
  // time the modal gains focus so stale local edits never linger.
  //
  // WR-03: read planExercises IMPERATIVELY via a ref so the callback identity
  // stays stable ([planExerciseId] only). Depending on `planExercises` directly
  // made useFocusEffect re-run on every background refetch of the
  // plan_exercises cache (stale after 30s / reconnect / a prior mutation's
  // onSettled invalidate) — silently wiping the user's in-progress stepper and
  // notes edits while the modal was open.
  const planExercisesRef = useRef(planExercises);
  planExercisesRef.current = planExercises;
  useFocusEffect(
    useCallback(() => {
      const row = planExercisesRef.current?.find(
        (px) => px.id === planExerciseId,
      );
      setSets(row?.target_sets ?? null);
      setRepsMin(row?.target_reps_min ?? null);
      setRepsMax(row?.target_reps_max ?? null);
      setNotes(row?.notes ?? "");
    }, [planExerciseId]),
  );

  // Null-safe target preview string from the LIVE stepper state (not the cached
  // row) so the chip tracks edits in real time. `4 × 6–8 reps`, `4 sets`,
  // `6–8 reps`, `6+ reps`, etc. Renders only the bounds that are present.
  const repsLabel =
    repsMin != null && repsMax != null
      ? `${repsMin}–${repsMax}`
      : repsMin != null
        ? `${repsMin}+`
        : repsMax != null
          ? `≤${repsMax}`
          : null;
  const previewParts: string[] = [];
  if (sets != null) previewParts.push(`${sets} × `);
  if (repsLabel != null) previewParts.push(`${repsLabel} ${t("reps")}`);
  const previewText = previewParts.length > 0 ? previewParts.join("") : null;

  const onSave = () => {
    if (!planId || !planExerciseId) return;
    // .mutate (not mutateAsync) — SP-2. plan_id REQUIRED for scope.id resolution
    // in Plan 01's default mutationFn (stripped from the UPDATE body there).
    updatePlanExercise.mutate(
      {
        id: planExerciseId,
        plan_id: planId,
        target_sets: sets,
        target_reps_min: repsMin,
        target_reps_max: repsMax,
        notes: notes.trim() === "" ? null : notes,
      },
      {
        onError: () => {
          // Optimistic onMutate already updated the cache; a real failure rolls
          // back via the default's onError. Surfacing is handled by the global
          // offline banner — no local error UI needed on this modal.
        },
      },
    );
    router.back();
  };

  const onRemove = () => {
    if (!planId || !planExerciseId) return;
    // No confirm — removing the plan_exercises template row is reversible by
    // re-adding from the picker (10-UI-SPEC §Destructive actions #2).
    removePlanExercise.mutate({ id: planExerciseId, plan_id: planId });
    router.back();
  };

  return (
    // Modal screens need their own GestureHandlerRootView with a theme-aware
    // backdrop — the root wrapper does not propagate into iOS modal
    // UIViewControllers (Phase 4 UAT 2026-05-10).
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: tk.surface }}>
      <SafeAreaView className="flex-1 bg-forge-bg-light dark:bg-forge-bg">
        <Stack.Screen
          options={{ presentation: "modal", headerShown: false }}
        />
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Modal header — Stäng (close, accent) + title + Spara mål (accent bold) */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t("closeModal")}
              hitSlop={8}
              style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: tk.accent,
                  letterSpacing: -0.2,
                }}
              >
                {t("closeModal")}
              </Text>
            </Pressable>

            <Text
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
              pointerEvents="none"
            >
              {t("editTargets")}
            </Text>

            <Pressable
              onPress={onSave}
              accessibilityRole="button"
              accessibilityLabel={t("saveTargets")}
              hitSlop={8}
              style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: tk.accent,
                  letterSpacing: -0.2,
                }}
              >
                {t("saveTargets")}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Exercise hero (null-safe) */}
            {exerciseName ? (
              <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 1.5,
                    color: tk.text3,
                    textTransform: "uppercase",
                  }}
                >
                  {t("planEyebrow")}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 32,
                    fontWeight: "700",
                    letterSpacing: -1.1,
                    lineHeight: 34,
                    marginTop: 6,
                    color: tk.text,
                  }}
                >
                  {exerciseName}
                </Text>
              </View>
            ) : null}

            {/* Target preview chip (null-safe, from live stepper state) */}
            {previewText ? (
              <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignSelf: "flex-start",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: tk.accentSoft,
                    borderWidth: 1,
                    borderColor: `${tk.accent}30`,
                  }}
                >
                  <Icon name="spark" size={12} color={tk.accent} strokeWidth={2.2} />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: tk.accent,
                      letterSpacing: 0.2,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {previewText}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Sets */}
            <View style={{ paddingHorizontal: 16, paddingBottom: 18 }}>
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
                {t("targetSets")}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <FStepperInput
                  value={sets}
                  onChange={setSets}
                  start={1}
                  floor={1}
                  incrementLabel={t("increment")}
                  decrementLabel={t("decrement")}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: tk.text2,
                    lineHeight: 18,
                  }}
                >
                  {t("setsHelp")}
                </Text>
              </View>
            </View>

            {/* Reps range */}
            <View style={{ paddingHorizontal: 16, paddingBottom: 18 }}>
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
                {t("reps")}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <FStepperInput
                  value={repsMin}
                  onChange={setRepsMin}
                  sub={t("repsMin")}
                  start={1}
                  floor={1}
                  incrementLabel={t("increment")}
                  decrementLabel={t("decrement")}
                />
                <Text style={{ fontSize: 18, color: tk.text3, fontWeight: "400" }}>
                  –
                </Text>
                <FStepperInput
                  value={repsMax}
                  onChange={setRepsMax}
                  sub={t("repsMax")}
                  start={1}
                  floor={1}
                  incrementLabel={t("increment")}
                  decrementLabel={t("decrement")}
                />
              </View>
              <Text
                style={{
                  fontSize: 12,
                  color: tk.text3,
                  marginTop: 8,
                  paddingLeft: 2,
                }}
              >
                {t("repsHelp")}
              </Text>
            </View>

            {/* Notes (multiline, stored RAW — D-16) */}
            <View style={{ paddingHorizontal: 16, paddingBottom: 18 }}>
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
                {t("notes")}{" "}
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
                  minHeight: 92,
                  borderRadius: 14,
                  backgroundColor: tk.surface,
                  borderWidth: 1,
                  borderColor: tk.border,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
              >
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t("notesPlaceholder")}
                  placeholderTextColor={tk.text3}
                  multiline
                  textAlignVertical="top"
                  accessibilityLabel={t("notes")}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: tk.text,
                    lineHeight: 20,
                    letterSpacing: -0.1,
                    minHeight: 68,
                  }}
                />
              </View>
            </View>

            {/* Remove from plan — danger ghost (no confirm, reversible) */}
            <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
              <ForgeButton
                label={t("removeFromPlan")}
                variant="destructive"
                size="md"
                icon="trash"
                fullWidth
                onPress={onRemove}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
