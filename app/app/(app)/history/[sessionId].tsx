// app/app/(app)/history/[sessionId].tsx
//
// Phase 12 Plan 12-07: FSessionDetail re-skin (SKIN-06).
//
// CHROME-ONLY re-skin over the Phase 6 / Phase 4 offline-critical logic. The
// session-detail screen is now a Forge surface:
//
//   - D-17 custom in-content Forge header (Stack native header hidden):
//     40px circular back (chevronLeft) + 40px circular ellipsis (hosts the
//     EXISTING overflow → delete flow). Icon-only controls carry
//     accessibilityLabel via t('back') / t('moreOptions') + role="button" +
//     44px hit target (FLAG-1). Replaces the old headerRight ellipsis.
//   - Eyebrow (plan-name snapshot, uppercase) + display date title.
//   - 3-stat grid card (Set / kg·volym / min) with cell dividers, tabular-nums,
//     every figure unit-converted (D-20 via formatWeight/formatVolume + units).
//   - Notes block: accentSoft card + accent border + accent pencil icon
//     (F12 note rendered verbatim, never translated).
//   - D-15 HYBRID exercise-breakdown cards: Forge frame + name + right-aligned
//     max-weight stat AND the kept expanded per-set list (w × r + RPE per set).
//   - Delete-confirm button colored forge-danger (#D70015 → #FF453A).
//   - PB trophy OMITTED everywhere (D-13).
//
// OFFLINE-CRITICAL LOGIC PRESERVED VERBATIM (D-22 — re-skin chrome only, do NOT
// touch the logic): keyboard-height lift + paddingBottom = keyboardHeight + 16;
// useFocusEffect overlay reset on blur (freezeOnBlur ghost-overlay guard);
// mutate-not-mutateAsync for delete + edit-notes; inline-overlay pattern (NEVER
// a Modal portal) for overflow menu / delete-confirm / edit-notes with
// tap-on-scrim dismiss + setTimeout(...50) before the stacked confirm;
// post-delete router.replace to /(tabs)/history with toast:"deleted"; loading
// gate on !session (NOT isPending) + initialData seeding.
//
// References:
//   - 12-07-PLAN.md Task 1 + acceptance criteria
//   - 12-UI-SPEC.md §Session detail (Layout Contract 202) + Copywriting Contract
//     + Color (forge-danger) + Icon-only-control accessibility (FLAG-1)
//   - 12-PATTERNS.md §history/[sessionId].tsx (deltas + preserve-verbatim list)
//   - 12-CONTEXT.md D-13/D-15/D-17/D-20/D-21/D-22/D-24
//   - design source: forge-screens.jsx FSessionDetail 649-764 (PB trophy 739-746 OMITTED)
//   - Phase 11 workout/[sessionId].tsx WorkoutHeader (D-09 custom-header precedent)

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColorScheme } from "nativewind";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { differenceInMinutes, format } from "date-fns";
import { sv } from "date-fns/locale";
import { useTranslation } from "react-i18next";

import { Icon } from "@/components/ui/Icon";
import { useDeleteSession, useSessionQuery, useUpdateSessionNotes } from "@/lib/queries/sessions";
import { useSetsForSessionQuery } from "@/lib/queries/sets";
import { useExercisesQuery } from "@/lib/queries/exercises";
import type { SetRow } from "@/lib/schemas/sets";
import { getPref, type UnitPref } from "@/lib/prefs";
import { formatWeight, toDisplayVolume } from "@/lib/units";

// ---------------------------------------------------------------------------
// Default export — SessionDetailScreen
// ---------------------------------------------------------------------------

export default function SessionDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // useLocalSearchParams' generic is a TYPE ASSERTION, not a runtime guard
  // (per workout/[sessionId].tsx WR-07). Narrow explicitly so any malformed
  // deep-link with an array param does not poison the queryKey or router
  // push back.
  const rawParams = useLocalSearchParams<{ sessionId: string }>();
  const sessionId =
    typeof rawParams.sessionId === "string" ? rawParams.sessionId : undefined;

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  // Forge token hexes for the inline-overlay surfaces (NativeWind dark: classes
  // do NOT apply inside the absolute-positioned RN-StyleSheet overlays per the
  // Phase 4 inline-overlay convention). Class-driven surfaces still use tokens.
  const ink = isDark ? "#FFFFFF" : "#0A0A0A";
  const muted2 = isDark ? "rgba(255,255,255,0.62)" : "#4D4D4D";
  const accentInk = isDark ? "#FF5A1F" : "#E14E10";
  const dangerInk = isDark ? "#FF453A" : "#D70015";
  const surfaceHex = isDark ? "#0E0E10" : "#FFFFFF";
  const borderHex = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  // D-20: read the unit pref into local state (settings.tsx idiom — useState +
  // useEffect getPref). Defaults metric; storage stays canonical kg, conversion
  // is display-only.
  const [units, setUnits] = useState<UnitPref>("metric");
  useEffect(() => {
    void getPref("fm:units").then(setUnits);
  }, []);

  const sessionQuery = useSessionQuery(sessionId ?? "");
  const setsQuery = useSetsForSessionQuery(sessionId ?? "");
  const exercisesQuery = useExercisesQuery();
  const deleteSession = useDeleteSession(sessionId);
  const updateNotes = useUpdateSessionNotes(sessionId);

  // Overlay state + transient banner-error. The post-delete toast was
  // moved to (tabs)/history.tsx (WR-01 fix) — emitting it here was a
  // visibility dead-zone because router.replace fires synchronously and the
  // user never sees a toast mounted on the (now blurred) detail screen.
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditNotesOverlay, setShowEditNotesOverlay] = useState(false);
  const [draftNotes, setDraftNotes] = useState<string>("");
  const [bannerError, setBannerError] = useState<string | null>(null);
  // Same direct-keyboard-measurement pattern as AvslutaOverlay (workout
  // [sessionId].tsx). KeyboardAvoidingView did not lift this card on iOS 26.4.2
  // inside an absolutely-positioned, flex-end-anchored backdrop; manual
  // measurement is the reliable fix. Listeners are always installed (cheap)
  // and only consulted when the overlay is open.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Pitfall 7 (06-RESEARCH.md): freezeOnBlur retains React state across
  // navigation; reset overlay flags on blur so a re-focus does not flash a
  // ghost overlay. Phase 4 commit af6930c precedent (plans/[id].tsx lines
  // 168-173).
  useFocusEffect(
    useCallback(() => {
      return () => {
        setShowOverflowMenu(false);
        setShowDeleteConfirm(false);
        setShowEditNotesOverlay(false);
        setDraftNotes("");
      };
    }, []),
  );

  const session = sessionQuery.data;

  // F12 edit-notes handlers. Defined before early returns (hooks-rules-of-hooks).
  // openEditNotes seeds draftNotes from current session.notes THEN opens overlay.
  // onSaveNotes dismisses overlay synchronously then fires the mutation
  // (mutate-not-mutateAsync per Phase 4 commit 5d953b6).
  const openEditNotes = useCallback(() => {
    setDraftNotes(session?.notes ?? "");
    setShowEditNotesOverlay(true);
  }, [session?.notes]);

  const onSaveNotes = useCallback(() => {
    if (!session) return;
    setShowEditNotesOverlay(false);
    updateNotes.mutate(
      { id: session.id, notes: draftNotes },
      {
        onError: () => setBannerError(t("errorGenericSub")),
      },
    );
  }, [draftNotes, session, updateNotes, t]);

  // Build the exercise-name lookup. Phase 4 Plan 04-04 commit 3bfaba8
  // pattern — avoids a join in the queryFn; the exercises cache is hot from
  // the picker route.
  const exerciseNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of exercisesQuery.data ?? []) m.set(e.id, e.name);
    return m;
  }, [exercisesQuery.data]);

  // Group sets by exercise_id. Iteration order of the resulting Map is
  // Map-insertion order, which here is the first-seen exercise_id from
  // useSetsForSessionQuery's `ORDER BY exercise_id ASC, set_number ASC`
  // — i.e. UUID-alphabetic order of exercise_id, NOT plan_exercises
  // .order_index and NOT chronological set-logging order. The active-
  // workout screen (Phase 5) orders by plan_exercises.order_index, so
  // this is a deviation. Closing that gap (joining order_index in or
  // ordering by min(completed_at)) is V1.1 polish — WR-05 in 06-REVIEW
  // .md documents the trade-off.
  const setsByExercise = useMemo(() => {
    const m = new Map<string, SetRow[]>();
    for (const s of setsQuery.data ?? []) {
      if (!m.has(s.exercise_id)) m.set(s.exercise_id, []);
      m.get(s.exercise_id)!.push(s);
    }
    return m;
  }, [setsQuery.data]);

  // Aggregates for the 3-stat grid (D-15). Empty pass (D-13) gracefully
  // produces zeros because the reduce over an empty array returns 0.
  const setCount = (setsQuery.data ?? []).length;
  const totalVolumeKg = (setsQuery.data ?? []).reduce(
    (sum, s) => sum + s.weight_kg * s.reps,
    0,
  );
  // D-20: the grid numeral renders the converted value WITHOUT a suffix (the
  // suffix lives in the micro-label "kg · volym" / "lb · volym"). Locale-group
  // for the Swedish non-breaking-space separator.
  const totalVolumeDisplay = Math.round(
    toDisplayVolume(totalVolumeKg, units),
  ).toLocaleString("sv-SE");
  const volumeUnitLabel = units === "imperial" ? "lb" : "kg";
  // D-10: '—' when finished_at is null. V1 history filters
  // finished_at IS NOT NULL so this path is defensive.
  const durationMin =
    session?.finished_at && session?.started_at
      ? differenceInMinutes(
          new Date(session.finished_at),
          new Date(session.started_at),
        )
      : null;
  const durationDisplay = durationMin != null ? String(durationMin) : "—";

  // Error gate — useSessionQuery returns no data when RLS blocks (T-06-06
  // mitigation: spoofed/missing id renders generic copy, no data
  // disclosure).
  if (sessionQuery.error) {
    return (
      <SafeAreaView className="flex-1 bg-forge-bg-light dark:bg-forge-bg">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-forge-text2-light dark:text-forge-text2 text-center">
            {t("errorGeneric")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Loading gate (D-12): gate on `!session` (NOT isPending) per Phase 4
  // plans/[id] pattern. useSessionQuery's initialData seeds from the
  // sessionsKeys.active() cache so a recently-finished session populates
  // synchronously when navigating in from /(tabs)/history.
  if (!session) {
    return (
      <SafeAreaView className="flex-1 bg-forge-bg-light dark:bg-forge-bg">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-forge-text2-light dark:text-forge-text2">
            {t("loading")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Delete handler — fires the optimistic remove + navigation synchronously.
  // setMutationDefaults['session','delete'].onMutate (block 14 in client.ts)
  // walks the listInfinite envelope to filter the deleted session before the
  // mutation resolves, so the user sees the row gone immediately on
  // /(tabs)/history. Paused mutations under networkMode:'offlineFirst' queue
  // and replay on reconnect.
  //
  // WR-01: the post-delete toast is emitted on the LIST route via the
  // `?toast=deleted` query param; the list screen consumes + clears it on
  // mount. Mounting the toast here was a dead-zone — router.replace
  // synchronously blurs this screen so the user never sees it.
  const onDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    deleteSession.mutate(
      { id: session.id },
      {
        onError: () => setBannerError(t("errorGenericSub")),
      },
    );
    router.replace({
      pathname: "/(tabs)/history",
      params: { toast: "deleted" },
    } as unknown as Href);
  };

  const formattedTitle = format(new Date(session.started_at), "d MMM yyyy", {
    locale: sv,
  });
  // Eyebrow = plan-name snapshot (uppercase, Phase 10 D-11). Falls back to the
  // no-plan copy for plan-less sessions.
  const eyebrow = (session.plan_name_snapshot ?? t("noPlan")).toUpperCase();

  return (
    <SafeAreaView
      className="flex-1 bg-forge-bg-light dark:bg-forge-bg"
      edges={["left", "right", "bottom"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: 32,
        }}
      >
        {/* D-17 custom in-content Forge header — owns the safe-area top inset
            now that the native Stack header is hidden. */}
        <View
          className="flex-row items-center justify-between px-4 pb-1"
          style={{ paddingTop: insets.top + 8 }}
        >
          {/* Left — 40px circular back button */}
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t("back")}
            hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
            className="w-10 h-10 rounded-forge-lg items-center justify-center border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border"
            style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
          >
            <Icon name="chevronLeft" size={18} color={ink} strokeWidth={2.2} />
          </Pressable>

          {/* Right — 40px circular ellipsis button (hosts the existing
              overflow → delete flow) */}
          <Pressable
            onPress={() => setShowOverflowMenu(true)}
            accessibilityRole="button"
            accessibilityLabel={t("moreOptions")}
            hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
            className="w-10 h-10 rounded-forge-lg items-center justify-center border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border"
            style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
          >
            <Icon name="ellipsis" size={18} color={ink} />
          </Pressable>
        </View>

        {/* Eyebrow + display date title */}
        <View className="px-5 pt-3 pb-4">
          <Text
            className="text-[11px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3"
            style={{ letterSpacing: 1.5 }}
            numberOfLines={1}
          >
            {eyebrow}
          </Text>
          <Text
            className="mt-1 text-[32px] font-display-bold text-forge-text-light dark:text-forge-text"
            style={{ letterSpacing: -1 }}
          >
            {formattedTitle}
          </Text>
        </View>

        {/* 3-stat grid card — Set / kg·volym / min (D-15). 1fr·1fr·1fr with
            cell dividers; tabular-nums; figures unit-converted (D-20). */}
        <View className="px-4 pb-3.5">
          <View className="flex-row rounded-forge-lg border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border">
            <View className="flex-1 items-center py-[18px] px-3.5 border-r border-forge-border-light dark:border-forge-border">
              <Text
                className="text-[28px] font-display-bold text-forge-text-light dark:text-forge-text"
                style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.6 }}
              >
                {setCount}
              </Text>
              <Text
                className="mt-0.5 text-[10px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3"
                style={{ letterSpacing: 1 }}
              >
                {t("sets")}
              </Text>
            </View>
            <View className="flex-1 items-center py-[18px] px-3.5 border-r border-forge-border-light dark:border-forge-border">
              <Text
                className="text-[28px] font-display-bold text-forge-text-light dark:text-forge-text"
                style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.6 }}
              >
                {totalVolumeDisplay}
              </Text>
              <Text
                className="mt-0.5 text-[10px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3"
                style={{ letterSpacing: 1 }}
              >
                {`${volumeUnitLabel} · ${t("volume").toLowerCase()}`}
              </Text>
            </View>
            <View className="flex-1 items-center py-[18px] px-3.5">
              <Text
                className="text-[28px] font-display-bold text-forge-text-light dark:text-forge-text"
                style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.6 }}
              >
                {durationDisplay}
              </Text>
              <Text
                className="mt-0.5 text-[10px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3"
                style={{ letterSpacing: 1 }}
              >
                {t("min")}
              </Text>
            </View>
          </View>
        </View>

        {/* F12 Notes block — accentSoft card + accent border + accent pencil
            icon (FSessionDetail 701-715). Two modes: note present (verbatim
            text + edit affordance) OR add-affordance (notes null). The note is
            NEVER translated (F12). Both open edit-notes-overlay via openEditNotes. */}
        <View className="px-4 pb-4">
          <Pressable
            onPress={openEditNotes}
            accessibilityRole="button"
            accessibilityLabel={session.notes ? t("editNote") : t("addNote")}
            className="flex-row items-start gap-2.5 rounded-forge-md border bg-forge-accentSoft-light dark:bg-forge-accentSoft border-forge-accent-light/25 dark:border-forge-accent/25 px-4 py-3.5"
            style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
          >
            <View className="pt-0.5">
              <Icon name="pencil" size={14} color={accentInk} />
            </View>
            {session.notes ? (
              <Text className="flex-1 text-[13px] leading-5 text-forge-text2-light dark:text-forge-text2">
                {session.notes}
              </Text>
            ) : (
              <Text className="flex-1 text-[13px] leading-5 text-forge-text3-light dark:text-forge-text3">
                {t("addNote")}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Transient banner-error (rare — surfaces if eventual replay fails
            after reconnect). */}
        {bannerError && (
          <View className="px-4 pb-4 flex-row items-start justify-between gap-2">
            <Text
              className="flex-1 text-base text-forge-danger-light dark:text-forge-danger"
              accessibilityLiveRegion="polite"
            >
              {bannerError}
            </Text>
            <Pressable
              onPress={() => setBannerError(null)}
              accessibilityRole="button"
              accessibilityLabel={t("closeModal")}
              className="px-2 py-1"
              hitSlop={8}
            >
              <Text className="text-base font-semibold text-forge-danger-light dark:text-forge-danger">
                ✕
              </Text>
            </Pressable>
          </View>
        )}

        {/* Exercises header */}
        <View className="px-6 pt-2 pb-3">
          <Text
            className="text-[13px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3"
            style={{ letterSpacing: 1 }}
          >
            {t("exercisesHeader")}
          </Text>
        </View>

        {/* D-15 HYBRID exercise-breakdown cards. Empty pass (D-13 — 0 sets but
            finished_at IS NOT NULL) renders zero cards; the stat grid still
            surfaces zeros and the user can still delete via the ellipsis. */}
        <View className="px-4 gap-2">
          {Array.from(setsByExercise.entries()).map(([exerciseId, sets]) => (
            <ExerciseCard
              key={exerciseId}
              exerciseId={exerciseId}
              exerciseName={
                exerciseNameById.get(exerciseId) ?? t("errorGeneric")
              }
              sets={sets}
              units={units}
              // FIT-110: restore the session-detail → chart entry point dropped
              // in the 12-07 re-skin. exerciseId is the setsByExercise Map key
              // (the caller's own RLS-scoped sets). Typed-route literal; if
              // experiments.typedRoutes trips on the cross-route reference, the
              // `as Href` cast is the Phase-4-02 precedent (Href already imported).
              onPress={() =>
                router.push(`/exercise/${exerciseId}/chart` as Href)
              }
            />
          ))}
        </View>
      </ScrollView>

      {/* Overflow-menu overlay — Phase 4 commit 954c480 inline-overlay-menu
          pattern (NOT a Modal portal). Tap-outside scrim dismisses. */}
      {showOverflowMenu && (
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
              top: insets.top + 52,
              right: 16,
              minWidth: 200,
              backgroundColor: surfaceHex,
              borderRadius: 14,
              paddingVertical: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 8,
              borderWidth: 1,
              borderColor: borderHex,
            }}
          >
            <Pressable
              onPress={() => {
                setShowOverflowMenu(false);
                // Open confirm overlay on next tick so the menu dismiss
                // animation can finish first; stacked overlays on iOS can
                // flicker otherwise (plans/[id].tsx commit 954c480 precedent).
                setTimeout(() => setShowDeleteConfirm(true), 50);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("deleteSession")}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  color: dangerInk,
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                {t("deleteSession")}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* Inline-overlay delete-confirm — Phase 4 commit e07029a pattern verbatim.
          Tap-on-scrim DISMISSES (matches plans/[id].tsx archive-confirm). The
          confirm button is colored forge-danger (D-13/Color table). */}
      {showDeleteConfirm && (
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
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
              backgroundColor: surfaceHex,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: borderHex,
              padding: 24,
              gap: 16,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: ink,
              }}
              accessibilityRole="header"
            >
              {t("deleteSessionQ")}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: muted2,
              }}
            >
              {t("cannotUndo")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <Pressable
                onPress={() => setShowDeleteConfirm(false)}
                accessibilityRole="button"
                accessibilityLabel={t("cancel")}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: ink,
                  }}
                >
                  {t("cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={onDeleteConfirm}
                accessibilityRole="button"
                accessibilityLabel={t("delete")}
                // forge-danger fill (#D70015 → #FF453A) — box styling kept in
                // this RN-StyleSheet branch because the whole overlay renders
                // off the NativeWind tree (inline-overlay convention).
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: dangerInk,
                }}
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
      )}

      {/* F12 Edit-notes overlay — Phase 4 commit e07029a inline-overlay pattern
          (NOT Modal portal). Uses direct keyboard measurement (keyboardHeight
          state above) instead of KeyboardAvoidingView (KAV did not lift this
          card on iOS 26.4.2 inside an absolute-positioned, flex-end-anchored
          backdrop — UAT bug 2026-05-16). */}
      {showEditNotesOverlay && (
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            // Center when keyboard is closed; lift to flex-end + paddingBottom
            // = keyboardHeight + 16 when keyboard is open.
            justifyContent: keyboardHeight > 0 ? "flex-end" : "center",
            backgroundColor: "rgba(0,0,0,0.5)",
            paddingHorizontal: 32,
            paddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : 0,
            zIndex: 2000,
          }}
          onPress={() => setShowEditNotesOverlay(false)}
          accessibilityRole="button"
          accessibilityLabel={t("closeModal")}
        >
          <Pressable
            style={{ width: "100%", maxWidth: 400 }}
            onPress={() => Keyboard.dismiss()}
          >
            <View
              className="rounded-forge-lg border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border p-6"
              style={{ gap: 16 }}
            >
              <Text
                className="text-2xl font-display-semibold text-forge-text-light dark:text-forge-text"
                accessibilityRole="header"
              >
                {t("editNote")}
              </Text>
              <TextInput
                value={draftNotes}
                onChangeText={setDraftNotes}
                placeholder={t("notesPlaceholder")}
                placeholderTextColor={isDark ? "rgba(255,255,255,0.38)" : "#8B8B8B"}
                multiline
                numberOfLines={3}
                maxLength={500}
                style={{ minHeight: 80, maxHeight: 160 }}
                textAlignVertical="top"
                autoFocus
                accessibilityLabel={t("notes")}
                className="rounded-forge-md bg-forge-surface2-light dark:bg-forge-surface2 border border-forge-border-light dark:border-forge-border px-3 py-2 text-base text-forge-text-light dark:text-forge-text"
              />
              <Text
                className={`text-sm text-right ${draftNotes.length > 480 ? "text-forge-danger-light dark:text-forge-danger" : "text-forge-text3-light dark:text-forge-text3"}`}
              >
                {`${draftNotes.length}/500`}
              </Text>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setShowEditNotesOverlay(false)}
                  accessibilityRole="button"
                  accessibilityLabel={t("cancel")}
                  className="flex-1 py-4 rounded-forge-md bg-forge-surface3-light dark:bg-forge-surface3 items-center justify-center active:opacity-80"
                >
                  <Text className="text-base font-semibold text-forge-text-light dark:text-forge-text">
                    {t("cancel")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onSaveNotes}
                  accessibilityRole="button"
                  accessibilityLabel={t("save")}
                  className="flex-1 py-4 rounded-forge-md bg-forge-accent-light dark:bg-forge-accent items-center justify-center active:opacity-80"
                >
                  <Text className="text-base font-semibold text-forge-accentText-light dark:text-forge-accentText">
                    {t("save")}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      )}

      {/* Post-delete toast — moved to (tabs)/history.tsx (WR-01 fix). */}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// ExerciseCard — D-15 hybrid: Forge frame with exercise name + right-aligned
// max-weight stat AND the kept expanded per-set list (w × r + RPE per set).
// PB trophy OMITTED (D-13). All weights unit-converted (D-20).
//
// FIT-110: tappable → /exercise/[exerciseId]/chart restored (the Phase-6
// cross-link was dropped in the 12-07 re-skin, orphaning the chart route). The
// Forge card frame is preserved (D-15) — only made Pressable + given a visible
// chevronRight affordance; box-decoration stays in className (NativeWind), the
// pressed-opacity is the documented style()-callback exception.
// ---------------------------------------------------------------------------

function ExerciseCard({
  exerciseId,
  exerciseName,
  sets,
  units,
  onPress,
}: {
  exerciseId: string;
  exerciseName: string;
  sets: SetRow[];
  units: UnitPref;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  // Per-exercise max-weight = top set's weight in this session.
  const maxWeightKg = sets.reduce(
    (max, s) => (s.weight_kg > max ? s.weight_kg : max),
    0,
  );
  // exerciseId is referenced for the a11y label routing context; the actual
  // navigation is wired at the call site via onPress (router in scope there).
  void exerciseId;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("viewExerciseChart", { exercise: exerciseName })}
      className="rounded-forge-md border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border px-4 py-3.5"
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text
            className="text-[15px] font-semibold text-forge-text-light dark:text-forge-text"
            style={{ letterSpacing: -0.2 }}
            numberOfLines={1}
          >
            {exerciseName}
          </Text>
        </View>
        {/* Right-aligned max-weight stat + a chevronRight "opens the chart" cue
            (FIT-110 — the regression's harm was an invisible affordance). The
            chevron sits to the right of the stat column with a small gap, the
            Forge history-row convention (text-forge-text3 token). */}
        <View className="flex-row items-center">
          <View className="items-end">
            <Text
              className="text-[18px] font-display-bold text-forge-text-light dark:text-forge-text"
              style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.3 }}
            >
              {formatWeight(maxWeightKg, units)}
            </Text>
            <Text
              className="text-[10px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3"
              style={{ letterSpacing: 0.5 }}
            >
              {t("maxWeight")}
            </Text>
          </View>
          <View className="ml-2.5">
            <Icon name="chevronRight" size={18} color="#9A9A9A" />
          </View>
        </View>
      </View>

      {/* Kept expanded per-set list (D-15 hybrid) — w × r + RPE per set,
          re-skinned greys → forge-* tokens. Weights unit-converted (D-20). */}
      <View className="mt-3 gap-1">
        {sets.map((set) => (
          <View key={set.id} className="flex-row items-baseline">
            <Text className="text-[13px] text-forge-text3-light dark:text-forge-text3">
              {`${t("set")} ${set.set_number}: `}
            </Text>
            <Text
              className="text-[13px] font-semibold text-forge-text2-light dark:text-forge-text2"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {`${formatWeight(set.weight_kg, units)} × ${set.reps}`}
            </Text>
            {set.rpe != null && (
              <Text
                className="text-[13px] text-forge-text3-light dark:text-forge-text3"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {` · ${t("rpe")} ${set.rpe}`}
              </Text>
            )}
          </View>
        ))}
      </View>
    </Pressable>
  );
}
