// app/app/(app)/history/[sessionId].tsx
//
// Phase 6 Plan 06-02: F9 session-detail + delete vertical slice.
//
// Read-only session-detail screen. The route is reached from the Historik
// tab (Plan 06-01b rewrote that screen as a cursor-paginated FlatList; each
// row's onPress lands here). Composition:
//
//   - Stack.Screen with a dynamic date title + a headerRight ellipsis
//     trigger for the overflow menu.
//   - SafeAreaView/ScrollView with a SummaryHeader (chip row: set-count,
//     total-volume, duration) above a list of ExerciseCard components
//     (one per exercise that appears in this session's set list).
//   - Each ExerciseCard's header is a Pressable cross-link to
//     /exercise/<exerciseId>/chart (D-11 + D-25 — the route ships in Plan
//     06-03 so the path literal is cast `as Href` until that lands; see
//     Phase 4 D-X cross-plan-route convention from (tabs)/index.tsx).
//   - Inline-overlay overflow menu (Phase 4 commit 954c480 pattern — NOT a
//     Modal portal; NativeWind/flex layout silently collapses inside the
//     Modal portal per UAT 2026-05-10).
//   - Inline-overlay delete-confirm (Phase 4 commit e07029a pattern); body
//     shows the exact set-count + total-volume so the user sees what is
//     being deleted (D-07).
//   - Toast on success — emitted on the destination route via
//     router.replace({ params: { toast: "deleted" } }); the list screen
//     (tabs)/history.tsx renders the toast on mount and clears the param.
//     Mounting it here (WR-01 in 06-REVIEW.md) was a visibility dead-zone
//     because router.replace synchronously blurs the detail screen.
//
// useFocusEffect cleanup resets the two overlay-state flags on blur so
// freezeOnBlur (Phase 4 D-08) does not leave a ghost overlay on re-focus
// (Pitfall 7 in 06-RESEARCH.md).
//
// Delete-handler convention (mutate-not-mutateAsync — Phase 4 commit
// 5d953b6): deleteSession.mutate({ id }, { onError }); the toast fires
// immediately after the optimistic remove from cache. router.replace lands
// the user back on Historik. Offline: paused mutation queues under
// networkMode:'offlineFirst' (Phase 4 D-07) and replays on reconnect via
// resumePausedMutations (Plan 04-01); FK on delete cascade then purges
// the now-orphaned exercise_sets server-side.
//
// Theme — useColorScheme() drives the muted/accent values used by the
// header ellipsis Ionicon, the chart-link Ionicon on each card, and the
// toast bg-blue accent (Phase 4 D-18 / Plan 06-PATTERNS shared pattern).
//
// Loading-gate (Phase 4 plans/[id] pattern): gate on `!session` (NOT
// isPending). useSessionQuery has initialData seeding from
// sessionsKeys.active() so when the user reaches this route by tapping
// from the Historik list, `session` is populated synchronously. Error
// state surfaces the generic Swedish copy.
//
// References:
//   - 06-02-PLAN.md Task 2 + acceptance criteria
//   - 06-UI-SPEC.md §Session-detail screen container + §Session-detail
//     summary-header + §Session-detail exercise-card + §Session-detail
//     overflow-menu trigger + §Session-detail overflow-menu overlay +
//     §Session-detail delete-confirm overlay + §Post-delete toast
//   - 06-CONTEXT.md D-05/D-06/D-07/D-09/D-10/D-11/D-12/D-13
//   - 06-PATTERNS.md "app/app/(app)/history/[sessionId].tsx" full section
//   - 06-RESEARCH.md Pitfall 6 (InfiniteQuery envelope) + Pitfall 7
//     (freezeOnBlur overlay reset)

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
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { differenceInMinutes, format } from "date-fns";
import { sv } from "date-fns/locale";

import { useDeleteSession, useSessionQuery, useUpdateSessionNotes } from "@/lib/queries/sessions";
import { useSetsForSessionQuery } from "@/lib/queries/sets";
import { useExercisesQuery } from "@/lib/queries/exercises";
import type { SetRow } from "@/lib/schemas/sets";

// Swedish non-breaking-space thousands separator: 3240 → "3 240".
// Same helper as (tabs)/history.tsx — V1.1 may extract to a shared util.
function formatNumber(n: number): string {
  return n.toLocaleString("sv-SE");
}

// ---------------------------------------------------------------------------
// Default export — SessionDetailScreen
// ---------------------------------------------------------------------------

export default function SessionDetailScreen() {
  const router = useRouter();
  // useLocalSearchParams' generic is a TYPE ASSERTION, not a runtime guard
  // (per workout/[sessionId].tsx WR-07). Narrow explicitly so any malformed
  // deep-link with an array param does not poison the queryKey or router
  // push back.
  const rawParams = useLocalSearchParams<{ sessionId: string }>();
  const sessionId =
    typeof rawParams.sessionId === "string" ? rawParams.sessionId : undefined;

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const muted = isDark ? "#9CA3AF" : "#6B7280";
  const accent = isDark ? "#60A5FA" : "#2563EB";

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
        onError: () =>
          setBannerError("Kunde inte spara anteckningen. Försök igen."),
      },
    );
  }, [draftNotes, session, updateNotes]);

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

  // Aggregates for SummaryHeader (D-09). Empty pass (D-13) gracefully
  // produces `0 set · 0 kg · X min` because the reduce over an empty array
  // returns 0.
  const setCount = (setsQuery.data ?? []).length;
  const totalVolumeKg = (setsQuery.data ?? []).reduce(
    (sum, s) => sum + s.weight_kg * s.reps,
    0,
  );
  // D-10: '—' when finished_at is null. V1 history filters
  // finished_at IS NOT NULL so this path is defensive.
  const durationMin =
    session?.finished_at && session?.started_at
      ? differenceInMinutes(
          new Date(session.finished_at),
          new Date(session.started_at),
        )
      : null;
  const durationLabel = durationMin != null ? `${durationMin} min` : "—";

  // Error gate — useSessionQuery returns no data when RLS blocks (T-06-06
  // mitigation: spoofed/missing id renders generic copy, no data
  // disclosure).
  if (sessionQuery.error) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <Stack.Screen options={{ headerShown: true, title: "Pass" }} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-gray-500 dark:text-gray-400 text-center">
            Något gick fel. Försök igen.
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
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <Stack.Screen options={{ headerShown: true, title: "Pass" }} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-gray-500 dark:text-gray-400">
            Laddar…
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
  // synchronously blurs this screen so the user never sees it. The error
  // banner stays here because mutation failure surfaces (rarely) after the
  // user has navigated away, which is its own UX gap; closing that gap is
  // tracked separately (V1.1 polish).
  const onDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    deleteSession.mutate(
      { id: session.id },
      {
        onError: () =>
          setBannerError("Kunde inte ta bort passet. Försök igen."),
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

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <Stack.Screen
        options={{
          headerShown: true,
          title: formattedTitle,
          headerRight: () => (
            <Pressable
              onPress={() => setShowOverflowMenu(true)}
              accessibilityRole="button"
              accessibilityLabel="Pass-menyn"
              hitSlop={8}
              className="px-2 py-1"
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={muted} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 96,
        }}
      >
        <View className="gap-6">
          {/* F12 Notes-block — above SummaryHeader chiparna (D-E4).
              Two modes: text + pencil (notes present) OR add-affordance (notes null).
              Both open edit-notes-overlay via openEditNotes. */}
          <View className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 flex-row items-start gap-2">
            {session.notes ? (
              <>
                <Text className="flex-1 text-base text-gray-900 dark:text-gray-50">
                  {session.notes}
                </Text>
                <Pressable
                  onPress={openEditNotes}
                  accessibilityRole="button"
                  accessibilityLabel="Redigera anteckning"
                  hitSlop={8}
                >
                  <Ionicons name="pencil-outline" size={18} color={muted} />
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={openEditNotes}
                accessibilityRole="button"
                accessibilityLabel="Lägg till anteckning"
                hitSlop={8}
                className="flex-row items-center gap-2 flex-1"
              >
                <Ionicons name="add-circle-outline" size={18} color={accent} />
                <Text className="text-base text-gray-500 dark:text-gray-400">
                  Lägg till anteckning
                </Text>
              </Pressable>
            )}
          </View>

          {/* Transient banner-error (rare — surfaces if eventual replay
              fails after reconnect). Mirrors plans/[id].tsx convention. */}
          {bannerError && (
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
                accessibilityHint="Tryck för att stänga"
                className="px-2 py-1"
                hitSlop={8}
              >
                <Text className="text-base font-semibold text-red-600 dark:text-red-400">
                  ✕
                </Text>
              </Pressable>
            </View>
          )}

          {/* SummaryHeader — three chips: set-count, total-volume, duration
              (D-09 + UI-SPEC §Session-detail summary-header). */}
          <View className="flex-row gap-2 flex-wrap">
            <View className="bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1">
              <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {`${setCount} set`}
              </Text>
            </View>
            <View className="bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1">
              <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {`${formatNumber(totalVolumeKg)} kg`}
              </Text>
            </View>
            <View className="bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1">
              <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {durationLabel}
              </Text>
            </View>
          </View>

          {/* Exercise-cards. Empty pass (D-13 — 0 sets but
              finished_at IS NOT NULL) renders zero cards here; the summary
              chips still surface `0 set · 0 kg · X min` and the user can
              still delete via the overflow menu. */}
          <View className="gap-2">
            {Array.from(setsByExercise.entries()).map(([exerciseId, sets]) => (
              <ExerciseCard
                key={exerciseId}
                exerciseId={exerciseId}
                exerciseName={
                  exerciseNameById.get(exerciseId) ?? "(övning saknas)"
                }
                sets={sets}
                accent={accent}
                onShowChart={() =>
                  router.push(`/exercise/${exerciseId}/chart` as Href)
                }
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Overflow-menu overlay (UI-SPEC §Session-detail overflow-menu
          overlay) — Phase 4 commit 954c480 inline-overlay-menu pattern.
          Tap-outside scrim dismisses. */}
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
          accessibilityLabel="Stäng meny"
        >
          <View
            style={{
              position: "absolute",
              top: 4,
              right: 16,
              minWidth: 200,
              backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
              borderRadius: 12,
              paddingVertical: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 8,
              borderWidth: isDark ? 1 : 0,
              borderColor: isDark ? "#374151" : "transparent",
            }}
          >
            <Pressable
              onPress={() => {
                setShowOverflowMenu(false);
                // Open confirm overlay on next tick so the menu dismiss
                // animation can finish first; stacked overlays on iOS can
                // flicker otherwise (plans/[id].tsx commit 954c480
                // precedent).
                setTimeout(() => setShowDeleteConfirm(true), 50);
              }}
              accessibilityRole="button"
              accessibilityLabel="Ta bort pass"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  color: isDark ? "#F87171" : "#DC2626",
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                Ta bort pass
              </Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* Inline-overlay delete-confirm (UI-SPEC §Session-detail
          delete-confirm overlay) — Phase 4 commit e07029a pattern verbatim.
          Tap-on-scrim DISMISSES (matches plans/[id].tsx archive-confirm —
          UAT showed users expected scrim-tap to mean Avbryt). */}
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
          accessibilityLabel="Stäng dialog"
        >
          <Pressable
            style={{
              width: "100%",
              maxWidth: 400,
              backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
              borderRadius: 12,
              padding: 24,
              gap: 16,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: isDark ? "#F9FAFB" : "#111827",
              }}
              accessibilityRole="header"
            >
              Ta bort detta pass?
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: isDark ? "#9CA3AF" : "#6B7280",
              }}
            >
              {`${setCount} set och ${formatNumber(totalVolumeKg)} kg total volym försvinner permanent. Det går inte att ångra.`}
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
                accessibilityLabel="Avbryt"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: isDark ? "#F9FAFB" : "#111827",
                  }}
                >
                  Avbryt
                </Text>
              </Pressable>
              <Pressable
                onPress={onDeleteConfirm}
                accessibilityRole="button"
                accessibilityLabel="Ta bort pass"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: isDark ? "#EF4444" : "#DC2626",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#FFFFFF",
                  }}
                >
                  Ta bort
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      )}

      {/* F12 Edit-notes overlay — Phase 4 commit e07029a inline-overlay pattern
          (NOT Modal portal — PATTERNS landmine #3). Uses direct keyboard
          measurement (see keyboardHeight state above) instead of
          KeyboardAvoidingView — KAV behaviors ("padding"/"height"/"position")
          did not lift this card on iOS 26.4.2 inside an absolute-positioned,
          flex-end-anchored backdrop (UAT bug reported 2026-05-16). */}
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
            // = keyboardHeight + 16 when keyboard is open. Matches AvslutaOverlay
            // (workout [sessionId].tsx) iter-3 fix.
            justifyContent: keyboardHeight > 0 ? "flex-end" : "center",
            backgroundColor: "rgba(0,0,0,0.5)",
            paddingHorizontal: 32,
            paddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : 0,
            zIndex: 2000,
          }}
          onPress={() => setShowEditNotesOverlay(false)}
          accessibilityRole="button"
          accessibilityLabel="Stäng dialog"
        >
          <Pressable
            style={{ width: "100%", maxWidth: 400 }}
            onPress={() => Keyboard.dismiss()}
          >
              <View
                className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6"
                style={{ gap: 16 }}
              >
                <Text
                  className="text-2xl font-semibold text-gray-900 dark:text-gray-50"
                  accessibilityRole="header"
                >
                  Redigera anteckning
                </Text>
                <TextInput
                  value={draftNotes}
                  onChangeText={setDraftNotes}
                  placeholder="Anteckningar (valfri)"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  style={{ minHeight: 80, maxHeight: 160 }}
                  textAlignVertical="top"
                  autoFocus
                  accessibilityLabel="Anteckningar för passet, valfri"
                  className="rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 text-base text-gray-900 dark:text-gray-50"
                />
                <Text
                  className={`text-sm text-right ${draftNotes.length > 480 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}
                >
                  {`${draftNotes.length}/500`}
                </Text>
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => setShowEditNotesOverlay(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Avbryt"
                    className="flex-1 py-4 rounded-md bg-gray-200 dark:bg-gray-700 items-center justify-center active:opacity-80"
                  >
                    <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
                      Avbryt
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onSaveNotes}
                    accessibilityRole="button"
                    accessibilityLabel="Spara anteckning"
                    className="flex-1 py-4 rounded-md bg-blue-600 dark:bg-blue-500 items-center justify-center active:opacity-80"
                  >
                    <Text className="text-base font-semibold text-white">
                      Spara
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
// ExerciseCard — read-only card. Header is a Pressable cross-link to the
// F10 chart route (D-11 + D-25); the set list below is plain text.
// ---------------------------------------------------------------------------

function ExerciseCard({
  exerciseId,
  exerciseName,
  sets,
  accent,
  onShowChart,
}: {
  exerciseId: string;
  exerciseName: string;
  sets: SetRow[];
  accent: string;
  onShowChart: () => void;
}) {
  // Per-exercise aggregates for the header chip row (UI-SPEC §Session-detail
  // exercise-card). max_weight is the top set's weight in this session for
  // this exercise.
  const setCount = sets.length;
  const maxWeight = sets.reduce(
    (max, s) => (s.weight_kg > max ? s.weight_kg : max),
    0,
  );
  // void unused param to keep type-checker happy when exerciseId is not
  // referenced elsewhere in this component (it's used only by the parent
  // for keying + onShowChart routing).
  void exerciseId;

  return (
    <View className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-2">
      <Pressable
        onPress={onShowChart}
        accessibilityRole="button"
        accessibilityLabel={`Visa graf för ${exerciseName}`}
        className="flex-row items-start justify-between active:opacity-80"
      >
        <View className="flex-1 mr-3">
          <Text
            className="text-2xl font-semibold text-gray-900 dark:text-gray-50"
            numberOfLines={1}
          >
            {exerciseName}
          </Text>
          <View className="flex-row gap-2 mt-1">
            <View className="bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-1">
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {`${setCount} set`}
              </Text>
            </View>
            <View className="bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-1">
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {`${maxWeight} kg`}
              </Text>
            </View>
          </View>
        </View>
        <Ionicons name="stats-chart" size={22} color={accent} />
      </Pressable>
      <View className="mt-3 gap-1">
        {sets.map((set) => (
          <View key={set.id} className="flex-row items-baseline">
            <Text className="text-base text-gray-500 dark:text-gray-400">
              {`Set ${set.set_number}: `}
            </Text>
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
              {`${set.weight_kg} × ${set.reps}`}
            </Text>
            {set.rpe != null && (
              <Text className="text-base text-gray-500 dark:text-gray-400">
                {` · RPE ${set.rpe}`}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
