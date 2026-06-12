// app/app/(app)/plans/[id]/exercise-picker.tsx
//
// Phase 10 Plan 03 (SKIN-03 / I18N-05): Forge re-skin of the exercise picker
// → FExercisePicker (browse) + FExercisePickerNew (inline create-new).
// (forge-screens.jsx FExercisePicker line 1215, FExercisePickerNew line 1334.)
//
// Two states on one modal screen:
//   1. Browse (FExercisePicker) — modal header (Stäng dismiss + centered title),
//      48-tall search field with inline magnifier, a single-select muscle-group
//      filter-pill row (D-04: Alla + 5 D-01 keys), a dashed create-new CTA, and
//      the bilingual exercise list. Tapping a row's + add-button inserts a
//      plan_exercises row with null targets and dismisses (add-now-set-later,
//      D-14). The filtered memo AND-combines the active group with the displayed
//      (translated) name search (D-05).
//   2. Create-new (FExercisePickerNew) — name ForgeField (raw, D-16) +
//      muscle-group dropdown (D-01 — emits one of the 5 keys) + free-text
//      equipment ForgeField (stored as written, D-02) + multiline notes. Submit
//      chains create→add under the shared scope.id='plan:<planId>' (FK-safe
//      offline replay). `← Tillbaka` returns to browse.
//
// Bilingual display rule (Plan 01/02): a row with seed_key !== null renders
//   displayName = t('exercise.'+seed_key+'.name'); equipment = t('equip.'+equipment)
//   else displayName = row.name (raw); equipment = row.equipment (raw).
//
// Chained-create-and-add (RESEARCH §5 — load-bearing for FK safety on offline
// replay): useCreateExercise(planId) + useAddExerciseToPlan(planId) BOTH bake
// scope.id='plan:<planId>' so on reconnect the create replays BEFORE the add.
// Fire with .mutate(payload, { onError }) NOT mutateAsync — paused offline
// mutations never resolve the awaitable (SP-2 / Phase-4 UAT 2026-05-10).
//
// Modal patterns (Phase 4 locked / 10-UI-SPEC §Modal & overlay): own
// GestureHandlerRootView wrapper with a theme-aware backdrop (the root wrapper
// in app/_layout.tsx does not propagate into iOS modal UIViewControllers).
//
// Optical values (10-UI-SPEC §Spacing — NativeWind 4 / Tailwind 3 purges
// off-scale arbitrary classes, so these are inline style={{}} numbers,
// Pitfall 3): search 48 tall radius 14; filter pill padding 6×12 radius 18 gap 6;
// create-new CTA padding 12×16 radius 14 dashed; row icon tile 36×36 radius 10;
// row add-button 30×30 radius 15; mg-dropdown 56 tall; notes minHeight 92.
//
// References:
//   - app/design v2/Sources/design/forge-screens.jsx FExercisePicker (1215) + FExercisePickerNew (1334)
//   - .planning/phases/10-plans-exercises-re-skin/10-UI-SPEC.md §Interaction Contract / §Copywriting
//   - 10-PATTERNS.md SP-2/SP-5/SP-6/SP-8 + picker assignment
//   - app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx (Forge re-skin idiom)
//   - app/lib/muscle-group.ts (resolveMuscleGroupKey)

import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useColorScheme } from "nativewind";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import Svg, { Path, Circle } from "react-native-svg";

import { Icon } from "@/components/ui";
import {
  exerciseFormSchema,
  MUSCLE_GROUP_KEYS,
  type ExerciseFormInput,
  type ExerciseRow,
} from "@/lib/schemas/exercises";
import {
  resolveMuscleGroupKey,
  type MuscleGroupKey,
} from "@/lib/muscle-group";
import { useExercisesQuery, useCreateExercise } from "@/lib/queries/exercises";
import {
  useAddExerciseToPlan,
  usePlanExercisesQuery,
} from "@/lib/queries/plan-exercises";
import { useAuthStore } from "@/lib/auth-store";
import { randomUUID } from "@/lib/utils/uuid";

// ── Forge token hexes (light / dark) ────────────────────────────────────────
// Mirror the tailwind.config forge.* token pairs verbatim (10-UI-SPEC §Color),
// for the inline-style optical containers + Icon strokes (the same split the
// edit modal + ForgeButton use). Class-driven surfaces still use token classes.
const TOKENS = {
  light: {
    text: "#0A0A0A",
    text2: "#4D4D4D",
    text3: "#8B8B8B",
    bg: "#FAFAF7",
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
    bg: "#000000",
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

// Capitalize a D-01 key for the `mg<Key>` locale lookup (chest → mgChest).
function mgLabelKey(key: MuscleGroupKey): string {
  return `mg${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

// Inline magnifier SVG — there is no named `search` icon (10-UI-SPEC §Icon;
// matches FExercisePicker line 1245 + Phase 9 search-field precedent).
function MagnifierIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={1.8} />
      <Path
        d="M21 21l-4.3-4.3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function ExercisePicker() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id: planId } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { colorScheme } = useColorScheme();
  const tk = TOKENS[colorScheme === "dark" ? "dark" : "light"];

  const [searchQuery, setSearchQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<MuscleGroupKey | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const { data: exercises } = useExercisesQuery();
  const { data: planExercises } = usePlanExercisesQuery(planId!);

  // BOTH mutations carry scope.id='plan:<planId>' (set on the hook instances)
  // so on offline replay the create lands BEFORE the add (FK safety, RESEARCH §5).
  const createExercise = useCreateExercise(planId);
  const addExerciseToPlan = useAddExerciseToPlan(planId!);

  // Bilingual display name: seed rows via t('exercise.<seed_key>.name'); user
  // rows render their raw name verbatim (D-16). Used by BOTH the search filter
  // (search matches the TRANSLATED name, D-05) and the list-row label.
  const displayName = (e: ExerciseRow): string =>
    e.seed_key
      ? t(`exercise.${e.seed_key}.name`, { defaultValue: e.name })
      : e.name;

  // Bilingual equipment: seed rows via t('equip.<equipment>'); user rows raw.
  const displayEquipment = (e: ExerciseRow): string | null => {
    if (!e.equipment) return null;
    return e.seed_key
      ? t(`equip.${e.equipment}`, { defaultValue: e.equipment })
      : e.equipment;
  };

  // AND-combine the active group filter (D-04) with the displayed-name search
  // (D-05). resolveMuscleGroupKey is total (never throws on legacy data).
  const filtered = useMemo(() => {
    if (!exercises) return [];
    const q = searchQuery.toLowerCase().trim();
    return exercises.filter(
      (e) =>
        (!activeGroup ||
          resolveMuscleGroupKey(e.muscle_group) === activeGroup) &&
        (!q || displayName(e).toLowerCase().includes(q)),
    );
    // displayName is stable per-render (depends only on `t`); exercises +
    // searchQuery + activeGroup are the real inputs. `t` is referenced through
    // displayName; the i18n instance is stable so omitting it is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, searchQuery, activeGroup, t]);

  const maxOrderIndex = useMemo(() => {
    if (!planExercises || planExercises.length === 0) return -1;
    return planExercises.reduce(
      (m, px) => (px.order_index > m ? px.order_index : m),
      -1,
    );
  }, [planExercises]);

  // Tapping a row's + : insert plan_exercises with null targets + dismiss (D-14).
  const onPickExisting = (exerciseId: string) => {
    if (!planId) return;
    addExerciseToPlan.mutate({
      id: randomUUID(),
      plan_id: planId,
      exercise_id: exerciseId,
      order_index: maxOrderIndex + 1,
    });
    router.back();
  };

  // ── Create-new form (RHF + zod; muscle_group constrained to the 5 D-01 keys) ─
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExerciseFormInput>({
    resolver: zodResolver(exerciseFormSchema),
    mode: "onSubmit",
    defaultValues: { name: "", muscle_group: null, equipment: "", notes: "" },
  });

  const onCreateAndAdd = (input: ExerciseFormInput) => {
    if (!userId || !planId) {
      setBannerError(t("errorNotSignedIn"));
      return;
    }
    setBannerError(null);
    const exerciseId = randomUUID();
    // Both mutations share scope.id='plan:<planId>' (set on hook instances).
    // Fire with .mutate (NOT mutateAsync) so router.back() lands immediately
    // even offline — mutateAsync stalls forever on paused mutations (SP-2).
    // User-created → seed_key omitted (NULL on the wire → raw render, D-16).
    createExercise.mutate(
      {
        id: exerciseId,
        user_id: userId,
        name: input.name,
        muscle_group: input.muscle_group ?? null,
        equipment: input.equipment ?? null,
        notes: input.notes ?? null,
      },
      { onError: () => setBannerError(t("errorGeneric")) },
    );
    addExerciseToPlan.mutate({
      id: randomUUID(),
      plan_id: planId,
      exercise_id: exerciseId,
      order_index: maxOrderIndex + 1,
    });
    reset();
    router.back();
  };

  const dismissCreate = () => {
    setShowCreateForm(false);
    reset();
    setBannerError(null);
  };

  return (
    // Modal screens need their own GestureHandlerRootView with a theme-aware
    // backdrop (the root wrapper does not propagate into iOS modal
    // UIViewControllers — Phase 4 UAT 2026-05-10). SP-8.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: tk.bg }}>
      <SafeAreaView className="flex-1 bg-forge-bg-light dark:bg-forge-bg">
        <Stack.Screen
          options={{ presentation: "modal", headerShown: false }}
        />

        {/* Modal header — Stäng (dismiss, accent) + centered title (browse:
            Lägg till övning; create: Ny övning). Create mode shows ← Tillbaka
            instead of Stäng so the back affordance returns to browse. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 8,
            minHeight: 44,
          }}
        >
          <Pressable
            onPress={showCreateForm ? dismissCreate : () => router.back()}
            accessibilityRole="button"
            accessibilityLabel={showCreateForm ? t("back") : t("closeModal")}
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
              {showCreateForm ? t("back") : t("closeModal")}
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
            {showCreateForm ? t("createExercise") : t("addExercise")}
          </Text>

          {/* Spacer to balance the header so the title stays centered. */}
          <View style={{ width: 56 }} pointerEvents="none" />
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {showCreateForm ? (
            // ── FExercisePickerNew — inline create-new form ────────────────
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 32,
                gap: 20,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "400",
                  color: tk.text3,
                  lineHeight: 17,
                }}
              >
                {t("createExerciseSub")}
              </Text>

              {bannerError ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <Text
                    accessibilityLiveRegion="polite"
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: "600",
                      color: tk.danger,
                    }}
                  >
                    {bannerError}
                  </Text>
                  <Pressable
                    onPress={() => setBannerError(null)}
                    accessibilityRole="button"
                    accessibilityLabel={t("closeModal")}
                    hitSlop={8}
                    style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
                  >
                    <Icon name="close" size={16} color={tk.danger} strokeWidth={2} />
                  </Pressable>
                </View>
              ) : null}

              {/* Name (raw, D-16) — barbell icon */}
              <FieldBlock label={t("name")} tk={tk}>
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <ForgeFieldRow
                      tk={tk}
                      icon="barbell"
                      value={value ?? ""}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder={t("name")}
                      error={!!errors.name}
                      accessibilityLabel={t("name")}
                    />
                  )}
                />
                {errors.name ? (
                  <FieldError tk={tk}>{errors.name.message}</FieldError>
                ) : null}
              </FieldBlock>

              {/* Muscle-group dropdown (D-01 — emits one of the 5 keys) */}
              <FieldBlock label={t("muscleGroup")} tk={tk}>
                <Controller
                  control={control}
                  name="muscle_group"
                  render={({ field: { onChange, value } }) => (
                    <MuscleGroupDropdown
                      tk={tk}
                      value={(value as MuscleGroupKey | null) ?? null}
                      onChange={onChange}
                      placeholder={t("selectMuscleGroup")}
                      labelFor={(k) => t(mgLabelKey(k))}
                    />
                  )}
                />
                {errors.muscle_group ? (
                  <FieldError tk={tk}>{errors.muscle_group.message}</FieldError>
                ) : null}
              </FieldBlock>

              {/* Equipment free-text (stored as written, D-02) — scale icon */}
              <FieldBlock label={t("equipment")} tk={tk}>
                <Controller
                  control={control}
                  name="equipment"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <ForgeFieldRow
                      tk={tk}
                      icon="scale"
                      value={value ?? ""}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder={t("equipmentPlaceholder")}
                      error={!!errors.equipment}
                      accessibilityLabel={t("equipment")}
                    />
                  )}
                />
                {errors.equipment ? (
                  <FieldError tk={tk}>{errors.equipment.message}</FieldError>
                ) : null}
              </FieldBlock>

              {/* Notes multiline (raw, D-16) */}
              <FieldBlock
                label={`${t("notes")} ${t("optional")}`}
                tk={tk}
              >
                <Controller
                  control={control}
                  name="notes"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View
                      style={{
                        minHeight: 92,
                        borderRadius: 14,
                        backgroundColor: tk.surface,
                        borderWidth: 1,
                        borderColor: errors.notes ? tk.danger : tk.border,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                      }}
                    >
                      <TextInput
                        value={value ?? ""}
                        onChangeText={onChange}
                        onBlur={onBlur}
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
                  )}
                />
                {errors.notes ? (
                  <FieldError tk={tk}>{errors.notes.message}</FieldError>
                ) : null}
              </FieldBlock>

              {/* Submit — chains create→add under shared scope (SP-2 .mutate) */}
              <Pressable
                onPress={handleSubmit(onCreateAndAdd)}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={t("createAndAdd")}
                style={({ pressed }) => [
                  {
                    height: 60,
                    borderRadius: 18,
                    backgroundColor: tk.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 8,
                    shadowColor: tk.accent,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.45,
                    shadowRadius: 16,
                  },
                  isSubmitting ? { opacity: 0.4 } : pressed ? { opacity: 0.85 } : null,
                ]}
              >
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "600",
                    color: tk.accentText,
                    letterSpacing: -0.2,
                  }}
                >
                  {t("createAndAdd")}
                </Text>
                <Icon name="plus" size={18} color={tk.accentText} strokeWidth={2.2} />
              </Pressable>
            </ScrollView>
          ) : (
            // ── FExercisePicker — browse (search + filter pills + list) ─────
            <View style={{ flex: 1 }}>
              {/* Search field (48 tall, inline magnifier) */}
              <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: tk.surface,
                    borderWidth: 1,
                    borderColor: tk.border,
                    paddingHorizontal: 14,
                  }}
                >
                  <MagnifierIcon color={tk.text3} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={t("searchExercise")}
                    placeholderTextColor={tk.text3}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel={t("searchExercise")}
                    style={{
                      flex: 1,
                      fontSize: 16,
                      color: tk.text,
                      letterSpacing: -0.2,
                    }}
                  />
                </View>
              </View>

              {/* Filter-pill row (D-04 — single-select: Alla + 5 D-01 keys) */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  gap: 6,
                }}
              >
                <FilterPill
                  tk={tk}
                  label={t("mgAll")}
                  active={activeGroup === null}
                  onPress={() => setActiveGroup(null)}
                />
                {MUSCLE_GROUP_KEYS.map((key) => (
                  <FilterPill
                    key={key}
                    tk={tk}
                    label={t(mgLabelKey(key))}
                    active={activeGroup === key}
                    // Tapping the active pill clears (back to Alla); else select.
                    onPress={() =>
                      setActiveGroup((prev) => (prev === key ? null : key))
                    }
                  />
                ))}
              </ScrollView>

              {/* Create-new CTA (dashed accent border + accent plus tile) */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                <Pressable
                  onPress={() => setShowCreateForm(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("createExercise")}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor: `${tk.accent}80`,
                      backgroundColor: tk.accentSoft,
                    },
                    pressed ? { opacity: 0.85 } : null,
                  ]}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: tk.accent,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="plus" size={18} color={tk.accentText} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: tk.accent,
                        letterSpacing: -0.2,
                      }}
                    >
                      {t("createExercise")}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "400",
                        color: tk.text2,
                        marginTop: 1,
                      }}
                    >
                      {t("createExerciseSub")}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {/* Exercise list (bilingual rows) */}
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingBottom: 32,
                  flexGrow: 1,
                  gap: 8,
                }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingTop: 48,
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: tk.text2,
                        textAlign: "center",
                      }}
                    >
                      {t("noExercisesMatch")}
                    </Text>
                  </View>
                }
                renderItem={({ item: exercise }) => {
                  const name = displayName(exercise);
                  const mgKey = resolveMuscleGroupKey(exercise.muscle_group);
                  const equip = displayEquipment(exercise);
                  const subtitle = [
                    mgKey ? t(mgLabelKey(mgKey)) : null,
                    equip,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        backgroundColor: tk.surface,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: tk.border,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: tk.surface2,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon name="barbell" size={18} color={tk.text2} strokeWidth={1.8} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 15,
                            fontWeight: "600",
                            color: tk.text,
                            letterSpacing: -0.2,
                          }}
                        >
                          {name}
                        </Text>
                        {subtitle ? (
                          <Text
                            numberOfLines={1}
                            style={{
                              fontSize: 12,
                              fontWeight: "400",
                              color: tk.text2,
                              marginTop: 1,
                            }}
                          >
                            {subtitle}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => onPickExisting(exercise.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`${t("addExercise")}: ${name}`}
                        hitSlop={8}
                        style={({ pressed }) => [
                          {
                            width: 30,
                            height: 30,
                            borderRadius: 15,
                            backgroundColor: tk.accentSoft,
                            borderWidth: 1,
                            borderColor: `${tk.accent}66`,
                            alignItems: "center",
                            justifyContent: "center",
                          },
                          pressed ? { opacity: 0.7 } : null,
                        ]}
                      >
                        <Icon name="plus" size={16} color={tk.accent} strokeWidth={2.4} />
                      </Pressable>
                    </View>
                  );
                }}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ── Local composed controls ─────────────────────────────────────────────────

// Widened token-bag type (the literal `typeof TOKENS.light` would make the
// dark variant non-assignable since each hex infers as a distinct literal).
type Tk = Record<keyof (typeof TOKENS)["light"], string>;

// Eyebrow field label + a vertical-stack wrapper for a form control.
function FieldBlock({
  label,
  tk,
  children,
}: {
  label: string;
  tk: Tk;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 1.5,
          color: tk.text3,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function FieldError({ tk, children }: { tk: Tk; children: React.ReactNode }) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={{ fontSize: 13, fontWeight: "400", color: tk.danger }}
    >
      {children}
    </Text>
  );
}

// A single-line ForgeField-shaped input row with a leading Icon. Inline-styled
// to carry the optical 56-tall field height (FNewPlan precedent); border flips
// to danger on error.
function ForgeFieldRow({
  tk,
  icon,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  accessibilityLabel,
}: {
  tk: Tk;
  icon: "barbell" | "scale";
  value: string;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  placeholder: string;
  error: boolean;
  accessibilityLabel: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        height: 56,
        borderRadius: 14,
        backgroundColor: tk.surface,
        borderWidth: error ? 2 : 1,
        borderColor: error ? tk.danger : tk.border,
        paddingHorizontal: 16,
      }}
    >
      <Icon name={icon} size={18} color={tk.text3} strokeWidth={1.8} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={tk.text3}
        autoCapitalize="sentences"
        autoComplete="off"
        accessibilityLabel={accessibilityLabel}
        style={{
          flex: 1,
          fontSize: 16,
          color: tk.text,
          letterSpacing: -0.2,
        }}
      />
    </View>
  );
}

// Muscle-group dropdown (D-01): a button showing the placeholder or the current
// value (via labelFor), trailing chevronDown, that toggles an inline selector
// over the 5 D-01 keys. The selected value is STORED as the key; displayed via
// labelFor(key). Inline overlay (no portal Modal — Phase 4 lesson).
function MuscleGroupDropdown({
  tk,
  value,
  onChange,
  placeholder,
  labelFor,
}: {
  tk: Tk;
  value: MuscleGroupKey | null;
  onChange: (next: MuscleGroupKey) => void;
  placeholder: string;
  labelFor: (key: MuscleGroupKey) => string;
}) {
  const [open, setOpen] = useState(false);
  const currentLabel = value ? labelFor(value) : placeholder;
  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={currentLabel}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            height: 56,
            borderRadius: 14,
            backgroundColor: tk.surface,
            borderWidth: 1,
            borderColor: open ? tk.accent : tk.border,
            paddingHorizontal: 16,
          },
          pressed ? { opacity: 0.85 } : null,
        ]}
      >
        <Text
          style={{
            fontSize: 16,
            color: value ? tk.text : tk.text3,
            letterSpacing: -0.2,
          }}
        >
          {currentLabel}
        </Text>
        <Icon name="chevronDown" size={18} color={tk.text2} strokeWidth={2} />
      </Pressable>

      {open ? (
        <View
          style={{
            marginTop: 8,
            borderRadius: 14,
            backgroundColor: tk.surface,
            borderWidth: 1,
            borderColor: tk.border,
            overflow: "hidden",
          }}
        >
          {MUSCLE_GROUP_KEYS.map((key, i) => {
            const selected = value === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  onChange(key);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={labelFor(key)}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: tk.border,
                    backgroundColor: selected ? tk.accentSoft : "transparent",
                  },
                  pressed ? { opacity: 0.7 } : null,
                ]}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: selected ? tk.accent : tk.text,
                    fontWeight: selected ? "600" : "400",
                    letterSpacing: -0.2,
                  }}
                >
                  {labelFor(key)}
                </Text>
                {selected ? (
                  <Icon name="check" size={18} color={tk.accent} strokeWidth={2.2} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// Single filter pill (D-04). Active = accent fill + accentText; inactive =
// surface + border + text2. Optical: padding 6×12, radius 18.
function FilterPill({
  tk,
  label,
  active,
  onPress,
}: {
  tk: Tk;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={6}
      style={({ pressed }) => [
        {
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 18,
          backgroundColor: active ? tk.accent : tk.surface,
          borderWidth: 1,
          borderColor: active ? tk.accent : tk.border,
        },
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: active ? tk.accentText : tk.text2,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
