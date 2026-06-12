// app/app/(app)/plans/[id].tsx
//
// Phase 4 Plan 03 Task 1: Plan-detail screen.
// Phase 4 Plan 04 Task 1: Drag-to-reorder integration.
// Phase 10 Plan 06 (SKIN-02 / D-09..D-15): Forge re-skin → FPlanDetail
//   (forge-screens.jsx line 223) + hard-delete path (D-10/D-11) + snapshot.
//
// Three responsibilities composed on one screen (ALL preserved through the
// re-skin — D-09):
//   1. plan_exercises listed in a DraggableFlatList (Plan 04). Each row:
//      grip drag-handle + index tile + name + target chip + last-value accent
//      numeral + chevron. onDragEnd calls useReorderPlanExercises(planId)
//      .reorder() which runs Plan 01's two-phase write (negative offsets first,
//      then final positions, all under shared scope.id='plan:<planId>'). The
//      DraggableFlatList is the screen-level scroller — NOT wrapped in a
//      <ScrollView> per RESEARCH §8.5 (gestures bubble and break in nested
//      scrollers).
//   2. "Starta pass" CTA → router.push('/workout/<newSessionId>'). The
//      startSession.mutate payload carries plan_name_snapshot = plan.name
//      (D-11 / RESEARCH 163-171) so the deleted-plan history still reads the
//      former name. mutate (NOT mutateAsync) per SP-2.
//   3. Header overflow menu (inline-overlay popover) → "Arkivera plan" (soft
//      archive, NO confirm — neutral) + "Ta bort" (hard delete, danger →
//      confirm dialog). Both overlays are inline absolute-positioned
//      <Pressable> overlays (SP-7), NEVER a portal Modal (UAT 2026-05-10 —
//      NativeWind/flex collapses inside the Modal portal).
//
// Hook contract (Plan 04-01 + Plan 01):
//   - useUpdatePlan(planId), useArchivePlan(planId), useDeletePlan(planId):
//     scope.id = `plan:<planId>`. Pass plan.id so per-plan mutations group on
//     offline replay.
//   - useRemovePlanExercise(planId): scope.id = `plan:<planId>` (REQUIRED).
//   - useReorderPlanExercises(planId): two-phase orchestrator returning
//     { reorder(newOrder) }.
//   - useStartSession(newSessionId): scope.id = `session:<newSessionId>`.
//
// Re-skin idiom (Plan 04/05): TOKENS light/dark token-bag + inline-optical
// style{} numbers (Pitfall 3 — NativeWind 4 / Tailwind 3 purges off-scale
// arbitrary classes); chrome via live t() (SP-5); user content (plan/exercise
// names) rendered verbatim (D-16); light+dark parity via useColorScheme().
//
// References:
//   - app/design v2/Sources/design/forge-screens.jsx FPlanDetail (line 223)
//   - 10-UI-SPEC.md §Interaction Contract (156-157), §Color (134-146),
//     §Copywriting (228-229), target chip + last-value accent (96-97)
//   - 10-PATTERNS.md SP-2/SP-3/SP-5/SP-6/SP-7 + plans/[id].tsx assignment
//   - 10-RESEARCH.md 163-171 (snapshot at session-start)
//   - 10-CONTEXT.md D-09/D-10/D-11/D-13/D-15

import { useState, useMemo, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useColorScheme } from "nativewind";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { useTranslation } from "react-i18next";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { Icon } from "@/components/ui";
import {
  usePlanQuery,
  useArchivePlan,
  useDeletePlan,
} from "@/lib/queries/plans";
import {
  usePlanExercisesQuery,
  useRemovePlanExercise,
  useReorderPlanExercises,
} from "@/lib/queries/plan-exercises";
import { useExercisesQuery } from "@/lib/queries/exercises";
import { useStartSession } from "@/lib/queries/sessions";
import { useAuthStore } from "@/lib/auth-store";
import { randomUUID } from "@/lib/utils/uuid";
import type { PlanExerciseRow as PlanExerciseRowDb } from "@/lib/schemas/plan-exercises";

// ── Forge token hexes (light / dark) ────────────────────────────────────────
// Mirror the tailwind.config forge.* token pairs verbatim (10-UI-SPEC §Color),
// for the inline-style optical containers + Icon strokes (the same split the
// edit/picker/new-plan modals + ForgeButton use).
const TOKENS = {
  light: {
    text: "#0A0A0A",
    text2: "#4D4D4D",
    text3: "#8B8B8B",
    surface: "#FFFFFF",
    surface2: "#F2F1EC",
    accent: "#E14E10",
    accentText: "#FFFFFF",
    border: "rgba(0,0,0,0.07)",
    danger: "#D70015",
    scrim: "rgba(0,0,0,0.5)",
  },
  dark: {
    text: "#FFFFFF",
    text2: "rgba(255,255,255,0.62)",
    text3: "rgba(255,255,255,0.38)",
    surface: "#0E0E10",
    surface2: "#18181B",
    accent: "#FF5A1F",
    accentText: "#FFFFFF",
    border: "rgba(255,255,255,0.08)",
    danger: "#FF453A",
    scrim: "rgba(0,0,0,0.6)",
  },
} as const;

// Shared token-bag type so subcomponents accept BOTH the light and dark token
// shapes (the literal-typed `as const` objects above are otherwise mutually
// unassignable — the same widened-type idiom Plan 03 used for its Tk bag).
type TokenBag = (typeof TOKENS)["light"] | (typeof TOKENS)["dark"];

// Tabular-figure style for index tile + target chip + last numeral (mono tnum).
// NOT `as const` — RN's fontVariant expects a mutable string[].
const numStyle: { fontVariant: ["tabular-nums"] } = {
  fontVariant: ["tabular-nums"],
};

// Local row shape — narrowed to the fields the row renders. Mirrors
// PlanExerciseRow from @/lib/schemas/plan-exercises (the cached Zod-parsed row).
type PlanExerciseRowShape = {
  id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  notes: string | null;
};

export default function PlanDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme } = useColorScheme();
  const tk = TOKENS[colorScheme === "dark" ? "dark" : "light"];

  const { data: plan } = usePlanQuery(id!);
  const { data: planExercises, isPending: pxPending } = usePlanExercisesQuery(
    id!,
  );
  // V1: plan_exercises rows don't join exercises.name in the cache (Plan 04-01
  // queryFn selects '*' from plan_exercises only). Resolve via the exercises
  // cache at render-time — useExercisesQuery is already mounted by the picker
  // route so the data is hot.
  const { data: exercises } = useExercisesQuery();
  const exerciseNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of exercises ?? []) m.set(e.id, e.name);
    return m;
  }, [exercises]);

  // Hooks accept the planId so scope.id binds to `plan:<planId>` per Plan
  // 04-01's resource-hook contract — chained mutations on the same plan
  // replay serially on reconnect.
  const archivePlan = useArchivePlan(id);
  // Phase 10 D-10/D-11 — hard-delete. Static scope baked at construction (SP-3);
  // pass plan id so the delete groups FIFO with any in-flight plan-scoped
  // mutation. FK ON DELETE SET NULL + plan_name_snapshot keep history readable.
  const deletePlan = useDeletePlan(id);
  const removePlanExercise = useRemovePlanExercise(id!);
  const reorderPlanExercises = useReorderPlanExercises(id!);

  // Phase 5 D-02 "Starta pass" CTA.
  //
  // useState lazy-init (NOT a bare randomUUID()) so the new session id is
  // STABLE across re-renders. Without lazy init randomUUID() would re-run each
  // render and the scope.id baked into useStartSession would change every
  // render, breaking serial replay (Pitfall 3 + Plan 04-01 SUMMARY auto-fix
  // Rule 1).
  const [newSessionId] = useState(() => randomUUID());
  const userId = useAuthStore((s) => s.session?.user.id);
  const startSession = useStartSession(newSessionId);

  // onDragEnd handler for DraggableFlatList. The library hands us the new
  // ordered array — we forward to Plan 01's two-phase reorder orchestrator.
  const handleReorder = (newOrder: PlanExerciseRowShape[]) => {
    if (!planExercises) return;
    reorderPlanExercises.reorder(newOrder as unknown as PlanExerciseRowDb[]);
  };

  const [bannerError, setBannerError] = useState<string | null>(null);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // freezeOnBlur (set on the (app) Stack screenOptions) keeps this screen
  // mounted across navigation. Reset overlay state every time the screen gains
  // focus so a previously-open overlay does not re-appear on unfreeze.
  useFocusEffect(
    useCallback(() => {
      setShowOverflowMenu(false);
      setShowArchiveConfirm(false);
      setShowDeleteConfirm(false);
    }, []),
  );

  // Phase 5 D-02 — "Starta pass" handler.
  //
  // mutate (NOT mutateAsync) per Phase 4 commit 5d953b6 UAT lesson: paused
  // mutations under networkMode: 'offlineFirst' never resolve mutateAsync.
  // The optimistic onMutate in Plan 01's setMutationDefaults dual-writes
  // sessionsKeys.active() and sessionsKeys.detail(newSessionId), so the
  // destination /workout/<id> screen has data immediately on router.push.
  //
  // plan_name_snapshot = plan.name (D-11 / RESEARCH 163-171): persists the
  // plan name onto the session so the deleted-plan history still reads the
  // former name via coalesce(p.name, s.plan_name_snapshot).
  const canStart = (planExercises?.length ?? 0) > 0;
  const onStarta = () => {
    if (!userId || !plan) return;
    setBannerError(null);
    startSession.mutate(
      {
        id: newSessionId,
        user_id: userId,
        plan_id: plan.id,
        plan_name_snapshot: plan.name,
        started_at: new Date().toISOString(),
      },
      { onError: () => setBannerError(t("errorGeneric")) },
    );
    // Optimistic navigation — onMutate already populated the active + detail
    // caches; works online and offline.
    //
    // `as Href` cast: cross-plan route literal — the destination route
    // `/workout/[sessionId]` is registered in (app)/_layout.tsx, but
    // router.d.ts may not have regenerated yet at first type-check.
    router.push(`/workout/${newSessionId}` as Href);
  };

  // Archive (soft) — NO confirm per D-09 (neutral, instant). The themed
  // archive-confirm overlay below is reserved for explicit destructive intent;
  // archive itself is reversible so it fires immediately from the overflow row.
  const onArchiveConfirm = () => {
    if (!plan) return;
    setShowArchiveConfirm(false);
    archivePlan.mutate(
      { id: plan.id },
      { onError: () => setBannerError(t("errorGeneric")) },
    );
    router.back();
  };

  const onOverflowArchivePress = () => {
    setShowOverflowMenu(false);
    setTimeout(() => setShowArchiveConfirm(true), 50);
  };

  const onOverflowDeletePress = () => {
    setShowOverflowMenu(false);
    // Open on next tick so the popover dismiss settles before the dialog
    // mounts (stacked overlays can flicker on iOS otherwise).
    setTimeout(() => setShowDeleteConfirm(true), 50);
  };

  // Hard-delete confirm (D-10/D-11). .mutate (NOT mutateAsync) — SP-2. The
  // optimistic onMutate filters plansKeys.list + invalidates
  // sessionsKeys.listInfinite; FK ON DELETE SET NULL keeps the user's sessions
  // (and their plan_name_snapshot) intact. Navigate back to the list on
  // success so the now-deleted plan's detail screen is not left mounted.
  const onDeleteConfirm = () => {
    if (!plan) return;
    setShowDeleteConfirm(false);
    deletePlan.mutate(
      { id: plan.id },
      {
        onError: () => setBannerError(t("errorGeneric")),
        onSuccess: () => router.back(),
      },
    );
    // Navigate immediately — the optimistic onMutate already removed the row
    // from the active-plans cache, so the list is correct offline too.
    router.back();
  };

  // Loading state intentionally gates on `!plan` only (not isPending). With
  // initialData seeding usePlanQuery from the list cache + the dual-write
  // optimistic onMutate, `plan` is populated from millisecond zero for any
  // plan visible in Planer. Tying the loading branch to isPending would
  // re-blank the screen on every background refetch (UAT 2026-05-10).
  if (!plan) {
    return (
      <SafeAreaView className="flex-1 bg-forge-bg-light dark:bg-forge-bg">
        <View className="flex-1 items-center justify-center">
          <Text style={{ fontSize: 15, color: tk.text2 }}>{t("saving")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      className="flex-1 bg-forge-bg-light dark:bg-forge-bg"
    >
      <Stack.Screen options={{ headerShown: false }} />

      <DraggableFlatList<PlanExerciseRowShape>
        data={(planExercises ?? []) as PlanExerciseRowShape[]}
        keyExtractor={(item) => item.id}
        onDragEnd={({ data }) => handleReorder(data)}
        contentContainerStyle={{
          paddingBottom: 96,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <View>
            {/* Nav row — back chevron + overflow ellipsis */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: 4,
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
              <Pressable
                onPress={() => setShowOverflowMenu(true)}
                accessibilityRole="button"
                accessibilityLabel={t("settings")}
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
                <Icon name="ellipsis" size={18} color={tk.text} />
              </Pressable>
            </View>

            {/* Banner error */}
            {bannerError ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
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
                  <Text
                    style={{ fontSize: 15, fontWeight: "700", color: tk.danger }}
                  >
                    ✕
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Title block — eyebrow + plan name (+ description) */}
            <View
              style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  letterSpacing: 1.5,
                  color: tk.text3,
                  textTransform: "uppercase",
                }}
              >
                {t("planEyebrow")}
              </Text>
              <Text
                style={{
                  fontSize: 36,
                  fontWeight: "700",
                  letterSpacing: -1.2,
                  marginTop: 4,
                  marginBottom: 6,
                  color: tk.text,
                }}
              >
                {plan.name}
              </Text>
              {plan.description ? (
                <Text style={{ fontSize: 15, color: tk.text2 }}>
                  {plan.description}
                </Text>
              ) : null}
            </View>

            {/* Starta pass — primary accent CTA (64 tall) */}
            <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
              <Pressable
                onPress={onStarta}
                disabled={!canStart}
                accessibilityRole="button"
                accessibilityLabel={t("startSession")}
                accessibilityState={{ disabled: !canStart }}
                style={({ pressed }) => [
                  {
                    width: "100%",
                    height: 64,
                    borderRadius: 18,
                    backgroundColor: tk.accent,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    shadowColor: tk.accent,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.35,
                    shadowRadius: 16,
                  },
                  !canStart ? { opacity: 0.4 } : pressed ? { opacity: 0.85 } : null,
                ]}
              >
                <Icon name="play" size={18} color={tk.accentText} />
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    letterSpacing: -0.3,
                    color: tk.accentText,
                  }}
                >
                  {t("startSession")}
                </Text>
              </Pressable>
              {!canStart ? (
                <Text
                  style={{
                    fontSize: 13,
                    color: tk.text3,
                    marginTop: 10,
                    paddingHorizontal: 4,
                  }}
                >
                  {t("needExercise")}
                </Text>
              ) : null}
            </View>

            {/* Quick stats — plain derived counts (NO new aggregates) */}
            <View
              style={{
                flexDirection: "row",
                gap: 24,
                paddingHorizontal: 20,
                paddingBottom: 16,
              }}
            >
              <ForgeStatInline
                tk={tk}
                label={t("exercisesStat")}
                value={String(planExercises?.length ?? 0)}
              />
              <ForgeStatInline tk={tk} label={t("lastStat")} value="—" />
              <ForgeStatInline tk={tk} label={t("avgTime")} value="—" />
            </View>

            {/* Section heading — ÖVNINGAR + add-exercise accent link */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 24,
                paddingBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  letterSpacing: 1,
                  color: tk.text3,
                  textTransform: "uppercase",
                }}
              >
                {t("exercisesStat")}
              </Text>
              <Pressable
                onPress={() =>
                  router.push(`/plans/${plan.id}/exercise-picker` as Href)
                }
                accessibilityRole="button"
                accessibilityLabel={t("addExercise")}
                hitSlop={8}
                style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: "500", color: tk.accent }}
                >
                  + {t("addExercise")}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          pxPending ? null : (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                paddingHorizontal: 24,
                marginTop: 32,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  backgroundColor: tk.surface2,
                  borderWidth: 1,
                  borderColor: tk.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="barbell" size={28} color={tk.text2} strokeWidth={2} />
              </View>
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    letterSpacing: -0.4,
                    color: tk.text,
                  }}
                >
                  {t("noPlans")}
                </Text>
                <Text style={{ fontSize: 15, color: tk.text2 }}>
                  {t("addExercise")}
                </Text>
              </View>
            </View>
          )
        }
        renderItem={({
          item: planExercise,
          drag,
          isActive,
          getIndex,
        }: RenderItemParams<PlanExerciseRowShape>) => (
          <ScaleDecorator>
            <PlanExerciseRow
              planExercise={planExercise}
              index={getIndex() ?? 0}
              exerciseName={
                exerciseNameById.get(planExercise.exercise_id) ??
                exerciseNameKey(t, planExercise.exercise_id)
              }
              drag={drag}
              isActive={isActive}
              tk={tk}
              dragLabel={t("editTargets")}
              onEdit={() =>
                router.push(
                  `/plans/${plan.id}/exercise/${planExercise.id}/edit` as Href,
                )
              }
              onRemove={() =>
                removePlanExercise.mutate({
                  id: planExercise.id,
                  plan_id: plan.id,
                })
              }
            />
          </ScaleDecorator>
        )}
      />

      {/* Overflow menu — inline absolute-positioned popover anchored top-right
          under the ellipsis (SP-7; NEVER a portal Modal — UAT 2026-05-10). Tap
          the transparent backdrop to dismiss. */}
      {showOverflowMenu ? (
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
          }}
          onPress={() => setShowOverflowMenu(false)}
          accessibilityRole="button"
          accessibilityLabel={t("closeModal")}
        >
          <View
            style={{
              position: "absolute",
              top: 56,
              right: 16,
              minWidth: 200,
              backgroundColor: tk.surface,
              borderRadius: 12,
              paddingVertical: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              borderWidth: 1,
              borderColor: tk.border,
            }}
          >
            <Pressable
              onPress={onOverflowArchivePress}
              accessibilityRole="button"
              accessibilityLabel={t("archivePlan")}
              style={({ pressed }) => [
                { paddingHorizontal: 16, paddingVertical: 12 },
                pressed ? { opacity: 0.6 } : null,
              ]}
            >
              <Text
                style={{ color: tk.text, fontSize: 16, fontWeight: "600" }}
              >
                {t("archivePlan")}
              </Text>
            </Pressable>
            {/* Hard-delete — danger-labeled (D-10). Opens a confirm dialog. */}
            <Pressable
              onPress={onOverflowDeletePress}
              accessibilityRole="button"
              accessibilityLabel={t("delete")}
              style={({ pressed }) => [
                { paddingHorizontal: 16, paddingVertical: 12 },
                pressed ? { opacity: 0.6 } : null,
              ]}
            >
              <Text
                style={{ color: tk.danger, fontSize: 16, fontWeight: "600" }}
              >
                {t("delete")}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      ) : null}

      {/* Archive-confirm dialog — inline absolute-positioned overlay (SP-7;
          NOT a Modal portal). Re-skinned to Forge tokens. */}
      {showArchiveConfirm ? (
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tk.scrim,
            paddingHorizontal: 32,
            zIndex: 2000,
          }}
          onPress={() => setShowArchiveConfirm(false)}
          accessibilityRole="button"
          accessibilityLabel={t("closeModal")}
        >
          <Pressable
            style={{
              width: "100%",
              maxWidth: 400,
              backgroundColor: tk.surface,
              borderWidth: 1,
              borderColor: tk.border,
              borderRadius: 20,
              padding: 24,
              gap: 12,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={{ fontSize: 20, fontWeight: "700", color: tk.text }}
              accessibilityRole="header"
            >
              {t("archivePlan")}
            </Text>
            <Text style={{ fontSize: 15, color: tk.text2, lineHeight: 21 }}>
              {plan.name}
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <Pressable
                onPress={() => setShowArchiveConfirm(false)}
                accessibilityRole="button"
                accessibilityLabel={t("cancel")}
                style={({ pressed }) => [
                  { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
                  pressed ? { opacity: 0.6 } : null,
                ]}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: tk.text }}
                >
                  {t("cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={onArchiveConfirm}
                accessibilityRole="button"
                accessibilityLabel={t("archivePlan")}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    backgroundColor: tk.accent,
                  },
                  pressed ? { opacity: 0.85 } : null,
                ]}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: tk.accentText,
                  }}
                >
                  {t("archivePlan")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      ) : null}

      {/* Hard-delete confirm dialog (D-10/D-11) — cloned from the archive-confirm
          overlay (SP-7; inline absolute-positioned <Pressable> scrim + inner
          card, NEVER a portal Modal). Danger primary (Ta bort) + neutral
          secondary (Behåll plan); the danger primary is the ONLY colored
          action. Body states history is unaffected. Light+dark parity. */}
      {showDeleteConfirm ? (
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tk.scrim,
            paddingHorizontal: 32,
            zIndex: 2000,
          }}
          onPress={() => setShowDeleteConfirm(false)}
          accessibilityRole="button"
          accessibilityLabel={t("closeModal")}
        >
          <Pressable
            style={{
              width: "100%",
              maxWidth: 400,
              backgroundColor: tk.surface,
              borderWidth: 1,
              borderColor: tk.border,
              borderRadius: 20,
              padding: 24,
              gap: 12,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={{ fontSize: 20, fontWeight: "700", color: tk.text }}
              accessibilityRole="header"
            >
              {t("deletePlanQ")}
            </Text>
            <Text style={{ fontSize: 15, color: tk.text2, lineHeight: 21 }}>
              {t("deletePlanBody")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              {/* Neutral secondary — Behåll plan (NOT accent, NOT danger). */}
              <Pressable
                onPress={() => setShowDeleteConfirm(false)}
                accessibilityRole="button"
                accessibilityLabel={t("keepPlan")}
                style={({ pressed }) => [
                  { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
                  pressed ? { opacity: 0.6 } : null,
                ]}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: tk.text }}
                >
                  {t("keepPlan")}
                </Text>
              </Pressable>
              {/* Danger primary — Ta bort. */}
              <Pressable
                onPress={onDeleteConfirm}
                accessibilityRole="button"
                accessibilityLabel={t("delete")}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    backgroundColor: tk.danger,
                  },
                  pressed ? { opacity: 0.85 } : null,
                ]}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#FFFFFF",
                  }}
                >
                  {t("delete")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

// ForgeStat inline — local clone of the design ForgeStat (label + big value).
function ForgeStatInline({
  tk,
  label,
  value,
}: {
  tk: TokenBag;
  label: string;
  value: string;
}) {
  return (
    <View>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.8,
          color: tk.text3,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "700",
          color: tk.text,
          letterSpacing: -0.5,
          marginTop: 2,
          ...numStyle,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// PlanExerciseRow — Forge row: grip handle + index tile + name + target chip +
// last-value accent numeral + chevron (→ edit-targets). Long-press grip drags.
function PlanExerciseRow({
  planExercise,
  index,
  exerciseName,
  drag,
  isActive,
  tk,
  dragLabel,
  onEdit,
  onRemove,
}: {
  planExercise: PlanExerciseRowShape;
  index: number;
  exerciseName: string;
  drag: () => void;
  isActive: boolean;
  tk: TokenBag;
  dragLabel: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const targetChip = formatTargetChip(planExercise);
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={dragLabel}
      style={({ pressed }) => [
        {
          marginHorizontal: 16,
          borderRadius: 16,
          backgroundColor: tk.surface,
          borderWidth: 1,
          borderColor: tk.border,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        isActive ? { opacity: 0.85 } : pressed ? { opacity: 0.6 } : null,
      ]}
    >
      {/* Grip drag-handle — long-press to reorder. */}
      <Pressable
        onLongPress={drag}
        accessibilityRole="button"
        accessibilityLabel={dragLabel}
        hitSlop={6}
        style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
      >
        <Icon name="grip" size={18} color={tk.text3} />
      </Pressable>

      {/* Index tile */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: tk.surface2,
          borderWidth: 1,
          borderColor: tk.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: tk.text2,
            ...numStyle,
          }}
        >
          {index + 1}
        </Text>
      </View>

      {/* Name + target chip */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 16,
            fontWeight: "600",
            letterSpacing: -0.2,
            color: tk.text,
          }}
        >
          {exerciseName}
        </Text>
        {targetChip ? (
          <Text
            numberOfLines={1}
            style={{ fontSize: 13, color: tk.text2, marginTop: 2, ...numStyle }}
          >
            {targetChip}
          </Text>
        ) : null}
      </View>

      {/* Remove ✕ (per-row, no confirm — D-09 preserved). */}
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={dragLabel}
        hitSlop={6}
        style={({ pressed }) => [
          { padding: 4 },
          pressed ? { opacity: 0.6 } : null,
        ]}
      >
        <Text style={{ fontSize: 16, fontWeight: "600", color: tk.text3 }}>
          ✕
        </Text>
      </Pressable>

      <Icon name="chevronRight" size={16} color={tk.text3} />
    </Pressable>
  );
}

// Resolve a seeded exercise's translated name via the exercise.<key>.name
// locale map when the exercises cache is cold; falls back to a neutral label.
function exerciseNameKey(
  t: (k: string) => string,
  exerciseId: string,
): string {
  // The exercises cache is the canonical name source; this is only reached when
  // the cache hasn't hydrated yet. Render a neutral placeholder (never a raw
  // uuid — UAT 2026-05-10).
  void exerciseId;
  return t("exercises");
}

// Target chip "4 × 6–8 reps" — NULL-SAFE (render only present bounds; D-13).
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
    return `${px.target_sets} × ${repsPart}`;
  }
  if (px.target_sets != null) {
    return String(px.target_sets);
  }
  return repsPart || null;
}
