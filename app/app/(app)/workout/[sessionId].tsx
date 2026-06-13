// app/app/(app)/workout/[sessionId].tsx
//
// Phase 5: Active-workout screen. The hot path that F13 lives or dies on.
//
// Architecture:
//   - useSessionQuery seeds from sessionsKeys.active() via initialData
//     (Phase 4 Plan 04-04 commit b87bddf inheritance) so the screen never
//     renders "Laddar…" for an in-progress session.
//   - useSetsForSessionQuery hydrates the logged set rows from persister
//     cache. Called twice — once at WorkoutScreen (to derive
//     loggedSetCount for AvslutaOverlay copy per BLOCKER-01 fix) and
//     once inside WorkoutBody — TanStack dedupes by queryKey so the
//     duplicate is a zero-cost subscriber.
//   - useLastValueQuery is pre-fetched per plan_exercises.exercise_id on
//     mount (CONTEXT.md D-20) — staleTime 15min keeps F7 chips
//     offline-ready.
//   - useAddSet / useUpdateSet / useRemoveSet are scope-bound to
//     `session:${sessionId}` so all set-mutations replay FIFO under one
//     scope on reconnect (Pitfall 5.3).
//   - Avsluta-overlay uses the Phase 4 inline-overlay-confirm pattern
//     (commit e07029a) — NOT modal portal (commit 1f4d8d0 reserves
//     modal-presentation for picker/edit routes, not the workout screen).
//   - useFocusEffect cleanup resets showAvslutaOverlay + per-card
//     edit-mode state on blur (Pitfall 5 — freezeOnBlur retains React
//     state).
//
// Anti-patterns avoided (PLAN gates):
//   - Klart / Avsluta / Add / Update / Remove all use mutate (NOT
//     mutateAsync) — paused offline mutations don't resolve mutateAsync
//     under networkMode: 'offlineFirst' (Phase 4 commit 5d953b6).
//   - The Avsluta primary button is accent-blue, NOT red (PITFALLS §6.6
//     — finishing a pass is the intended terminal state, not data loss).
//   - Workout route is NOT modal (D-03 — declared in (app)/_layout.tsx
//     without presentation: 'modal').
//
// References:
//   - 05-CONTEXT.md D-01, D-04..D-23
//   - 05-UI-SPEC.md §lines 188-632
//   - 05-PATTERNS.md §workout/[sessionId].tsx
//   - 05-RESEARCH.md §useAddSet call-site + Open Q#4 (RESOLVED — second
//     OfflineBanner instance)
//   - PITFALLS §1.4, §5.3, §6.1, §6.2, §6.3, §6.6, §8.1, §8.13

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useTranslation } from "react-i18next";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ForgeButton, Icon } from "@/components/ui";
import { getPref } from "@/lib/prefs";
import { randomUUID } from "@/lib/utils/uuid";

import { useFinishSession, useSessionQuery } from "@/lib/queries/sessions";
import {
  useAddSet,
  useRemoveSet,
  useSetsForSessionQuery,
  useUpdateSet,
} from "@/lib/queries/sets";
import { usePersistenceStore } from "@/lib/persistence-store";
import { OfflineBanner } from "@/components/offline-banner"; // Open Q#4 (RESOLVED) — second instance inside the F13 hot path
import { useLastValueQuery } from "@/lib/queries/last-value";
import { usePlanExercisesQuery } from "@/lib/queries/plan-exercises";
import { useExercisesQuery } from "@/lib/queries/exercises";

import {
  setFormSchema,
  type SetFormOutput,
  type SetRow,
} from "@/lib/schemas/sets";
import type { SessionRow } from "@/lib/schemas/sessions";
import type { PlanExerciseRow } from "@/lib/schemas/plan-exercises";

// RHF v7 3-generic shape (Phase 4 D-11 / commit f8b75b6):
// setFormSchema uses z.coerce.number() on weight_kg + reps so its INPUT
// type is `unknown` and OUTPUT type is `number`. The third generic
// (TTransformedValues) takes the OUTPUT alias so handleSubmit receives
// the parsed shape. Two-arg form triggers TS2322 due to
// @hookform/resolvers Resolver invariance.
type SetFormInput = z.input<typeof setFormSchema>;

// Animated wrapper over Pressable so the Avsluta backdrop can both (a) animate
// its scrim opacity (MOTN-04 §07 spring) and (b) keep backdrop-tap dismiss.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// mm:ss (or h:mm:ss past an hour) elapsed since `startedAt`. Copied from
// active-session-banner.tsx (module-private there) for the in-content header
// timer (D-07). Kept byte-identical so the two timers tick the same way.
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ---------------------------------------------------------------------------
// Default export — WorkoutScreen
// ---------------------------------------------------------------------------

export default function WorkoutScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  // WR-07 (05-REVIEW.md): useLocalSearchParams' generic argument is a TYPE
  // ASSERTION, not a runtime guard. The actual runtime shape is
  // Record<string, string | string[]> — a param could be string[] for
  // catch-all routes or malformed deep-links. Narrow explicitly so downstream
  // code (queryKey, route push back, etc.) never receives an array.
  const rawParams = useLocalSearchParams<{ sessionId: string }>();
  const sessionId =
    typeof rawParams.sessionId === "string" ? rawParams.sessionId : undefined;
  const [showAvslutaOverlay, setShowAvslutaOverlay] = useState(false);

  // Pitfall 5 + Phase 4 D-08 (commit af6930c) — freezeOnBlur retains React
  // state across navigation. Reset overlay state on blur so it doesn't
  // re-appear on focus.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setShowAvslutaOverlay(false);
      };
    }, []),
  );

  const { data: session } = useSessionQuery(sessionId ?? "");

  // BLOCKER-01 fix: derive loggedSetCount for AvslutaOverlay's D-23 copy
  // variants ('{N} set sparade…' vs 'Inget set är loggat…'). TanStack
  // dedupes by queryKey, so calling useSetsForSessionQuery here AND inside
  // WorkoutBody is zero extra fetch — both subscribers share the same
  // cache entry under setsKeys.list(sessionId).
  const { data: setsData } = useSetsForSessionQuery(session?.id ?? "");
  const loggedSetCount = setsData?.length ?? 0;

  // D-07: live header timer — tick every second from session.started_at.
  // Mirrors the active-session-banner ticker (L62-69) verbatim so both the
  // banner and this header advance in lockstep. Single 1s interval cleared on
  // unmount (T-11-03 — bounded, no leak, never touches the write path).
  const startedAt = session?.started_at;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  const timer = startedAt
    ? formatElapsed(now - new Date(startedAt).getTime())
    : null;

  // Plan 05-05 (FIT-8): hydration gate. PersistQueryClientProvider in
  // _layout.tsx fires onSuccess → setHydrated(true) once AsyncStorage
  // round-trip completes. Before that, useSetsForSessionQuery returns
  // undefined (offlineFirst, no cache yet) and exercise cards render
  // empty — the F13 brutal-test UAT (2026-05-13) observed this as
  // perceived data loss. On a warm app, hydrated is already true so
  // this affordance renders for 0 frames; on cold-start after force-
  // quit, it shows for the hydration window (~hundreds of ms).
  const hydrated = usePersistenceStore((s) => s.hydrated);

  if (!hydrated) {
    return (
      <SafeAreaView className="flex-1 bg-forge-bg-light dark:bg-forge-bg">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-forge-text2-light dark:text-forge-text2">
            {t("restoringWorkout")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Loading gate: gate on `!session` (NOT isPending) per Phase 4 plans/[id]
  // pattern — initialData seeding from sessionsKeys.active() makes
  // `session` populated synchronously for any active session.
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

  return (
    <SafeAreaView
      className="flex-1 bg-forge-bg-light dark:bg-forge-bg"
      edges={["bottom"]}
    >
      {/* D-09: native Stack header hidden; the in-content Forge header below
          owns the safe-area top inset + back navigation. */}
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutHeader
        timer={timer}
        onBack={() => router.back()}
        onFinish={() => setShowAvslutaOverlay(true)}
      />
      {/* WARNING-01 fix (Open Q#4 RESOLVED): second OfflineBanner
          instance mounted inside /workout/[sessionId] because the route
          is outside (tabs). Both instances state-mirror via
          useOnlineStatus(); F13 brutal-test asserts this banner is
          visible after force-quit re-open. */}
      <OfflineBanner />
      <WorkoutBody session={session} />
      {showAvslutaOverlay && (
        <AvslutaOverlay
          sessionId={session.id}
          loggedSetCount={loggedSetCount}
          sets={setsData ?? []}
          startedAt={session.started_at}
          onCancel={() => setShowAvslutaOverlay(false)}
          onFinish={() => {
            setShowAvslutaOverlay(false);
            router.replace("/(app)/(tabs)");
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// WorkoutHeader — D-07/D-09 in-content Forge header
//   left   : 40px circular back button (surface + border)
//   center : accentSoft live-timer pill (6px accent dot + MM:SS, tabular)
//   right  : accent "Avsluta" pill opening the existing Avsluta overlay
// Owns its safe-area top inset (the native header no longer provides it).
// ---------------------------------------------------------------------------

function WorkoutHeader({
  timer,
  onBack,
  onFinish,
}: {
  timer: string | null;
  onBack: () => void;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === "dark";
  const backInk = isDark ? "#FFFFFF" : "#0A0A0A";
  const accentInk = isDark ? "#FF5A1F" : "#E14E10";

  return (
    <View
      className="flex-row items-center justify-between px-4 pb-1"
      style={{ paddingTop: insets.top + 8 }}
    >
      {/* Left — 40px circular back button */}
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t("back")}
        hitSlop={8}
        className="w-10 h-10 rounded-forge-lg items-center justify-center border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border"
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      >
        <Icon name="chevronLeft" size={18} color={backInk} strokeWidth={2.2} />
      </Pressable>

      {/* Center — accentSoft live-timer pill */}
      <View className="flex-row items-center gap-2 px-3.5 py-2 rounded-forge-lg border bg-forge-accentSoft-light dark:bg-forge-accentSoft border-forge-border-light dark:border-forge-border">
        <View className="w-1.5 h-1.5 rounded-full bg-forge-accent-light dark:bg-forge-accent" />
        <Text
          className="text-[13px] font-semibold text-forge-accent-light dark:text-forge-accent"
          style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.1 }}
          accessibilityLiveRegion="polite"
        >
          {timer ?? "0:00"}
        </Text>
      </View>

      {/* Right — accent "Avsluta" pill (FIT-66 accent shadow in style()) */}
      <Pressable
        onPress={onFinish}
        accessibilityRole="button"
        accessibilityLabel={t("finish")}
        hitSlop={8}
        className="h-9 px-4 rounded-full items-center justify-center bg-forge-accent-light dark:bg-forge-accent"
        style={({ pressed }) => [
          {
            shadowColor: accentInk,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.45,
            shadowRadius: 16,
          },
          pressed ? { opacity: 0.85 } : null,
        ]}
      >
        <Text className="text-[14px] font-semibold text-forge-accentText-light dark:text-forge-accentText">
          {t("finish")}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// WorkoutBody — exercise-card list + KeyboardAvoidingView + defensive empty
// ---------------------------------------------------------------------------

function WorkoutBody({ session }: { session: SessionRow }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { data: planExercises } = usePlanExercisesQuery(session.plan_id ?? "");
  const { data: setsData } = useSetsForSessionQuery(session.id);
  const { data: exercises } = useExercisesQuery();

  // Exercise-name lookup via Map<id, name> per Phase 4 Plan 04-04 commit
  // 3bfaba8 (avoids a join in the queryFn; exercises cache is hot from
  // the picker route).
  const exerciseNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of exercises ?? []) m.set(e.id, e.name);
    return m;
  }, [exercises]);

  // Defensive empty-state per UI-SPEC line 236. The Phase 5 Starta-pass
  // CTA on plans/[id].tsx disables when planExercises.length === 0, so
  // this state is reachable only if a plan's exercises were removed
  // mid-pass — but the fallback keeps the screen usable.
  if ((planExercises?.length ?? 0) === 0) {
    // D-13: defensive empty-state, Forge-skinned + i18n'd. Mirrors the
    // (tabs)/index.tsx empty-state tile structure (surface2 icon tile +
    // heading + body + ForgeButton). Reachable only if a plan's exercises
    // were removed mid-pass.
    return (
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="w-16 h-16 rounded-forge-md items-center justify-center border bg-forge-surface2-light dark:bg-forge-surface2 border-forge-border-light dark:border-forge-border">
          <Icon
            name="list"
            size={28}
            color={isDark ? "rgba(255,255,255,0.62)" : "#4D4D4D"}
            strokeWidth={2}
          />
        </View>
        <View className="gap-2 items-center">
          <Text className="text-[22px] font-display-bold text-forge-text-light dark:text-forge-text text-center">
            {t("nothingToLog")}
          </Text>
          <Text className="text-[15px] text-forge-text2-light dark:text-forge-text2 text-center">
            {t("nothingToLogBody")}
          </Text>
        </View>
        <View className="flex-row">
          <ForgeButton
            label={t("back")}
            variant="primary"
            size="lg"
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          paddingBottom: 96,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {(planExercises ?? []).map((pe) => (
          <ExerciseCard
            key={pe.id}
            planExercise={pe}
            exerciseName={
              exerciseNameById.get(pe.exercise_id) ?? "(övning saknas)"
            }
            sessionId={session.id}
            allSets={setsData ?? []}
          />
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// ExerciseCard — header + logged set-rows + always-visible set-input row
// ---------------------------------------------------------------------------

function ExerciseCard({
  planExercise,
  exerciseName,
  sessionId,
  allSets,
}: {
  planExercise: PlanExerciseRow;
  exerciseName: string;
  sessionId: string;
  allSets: SetRow[];
}) {
  const { t } = useTranslation();
  const accentTextInk = "#FFFFFF"; // forge-accentText (light & dark are both white)
  // Pre-fetch F7 data on card mount per CONTEXT.md D-20. staleTime 15min
  // keeps the result in cache offline.
  const { data: lastValueMap } = useLastValueQuery(
    planExercise.exercise_id,
    sessionId,
  );

  // Filter logged sets for this exercise, sorted by set_number.
  const setsForThisExercise = useMemo(
    () =>
      allSets
        .filter((s) => s.exercise_id === planExercise.exercise_id)
        .sort((a, b) => a.set_number - b.set_number),
    [allSets, planExercise.exercise_id],
  );

  const loggedCount = setsForThisExercise.length;
  const currentSetNumber = loggedCount + 1;

  // D-10: F7 prev-value, folded INTO the input-row header (replaces the separate
  // LastValueChip below the row). Set-position-aligned to the row about to be
  // logged. Not rendered when no data (D-19).
  const prevValue = lastValueMap?.[currentSetNumber];
  const prevLabel = prevValue
    ? t("previous", { w: prevValue.weight_kg, r: prevValue.reps })
    : null;

  // D-10 pre-fill: after first set in this session, pre-fill from the
  // most-recent set in the same exercise in the same session. For set 1
  // (no prior in this session), pre-fill from F7 (last finished session,
  // set-position-aligned to currentSetNumber).
  const sessionPrefill =
    setsForThisExercise[setsForThisExercise.length - 1] ?? null;
  const f7PrefillEntry = lastValueMap?.[currentSetNumber];
  const prefillWeight =
    sessionPrefill?.weight_kg ?? f7PrefillEntry?.weight_kg ?? null;
  const prefillReps = sessionPrefill?.reps ?? f7PrefillEntry?.reps ?? null;

  // RHF for the always-visible inline set-input row (per-card form-state).
  // mode: 'onSubmit' per Phase 3 D-15 — avoid mid-typing "1.0 is invalid"
  // flicker on weight_kg.
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SetFormInput, undefined, SetFormOutput>({
    resolver: zodResolver(setFormSchema),
    mode: "onSubmit",
    defaultValues: {
      weight_kg: prefillWeight ?? undefined,
      reps: prefillReps ?? undefined,
      set_type: "working",
    },
  });

  // Re-hydrate defaults when prefill changes (e.g., after a set lands and
  // setsForThisExercise.length increments). Pin set_type to 'working' so
  // the schema default is preserved on every reset.
  useEffect(() => {
    reset({
      weight_kg: prefillWeight ?? undefined,
      reps: prefillReps ?? undefined,
      set_type: "working",
    });
  }, [prefillWeight, prefillReps, reset]);

  const addSet = useAddSet(sessionId);

  const onKlart = (input: SetFormOutput) => {
    // D-16 SUPERSEDED by Plan 05-04: server-side trigger assigns set_number;
    // client omits it on payload. Optimistic UI uses provisional value
    // computed in setMutationDefaults onMutate.
    addSet.mutate(
      {
        id: randomUUID(),
        session_id: sessionId,
        exercise_id: planExercise.exercise_id,
        weight_kg: input.weight_kg,
        reps: input.reps,
        rpe: input.rpe ?? null,
        completed_at: new Date().toISOString(),
        set_type: "working",
      },
      {
        onSuccess: () => {
          // D-10: pre-fill the next blank row with the just-logged values.
          // Optimistic onMutate already appended to setsKeys.list — the
          // useEffect-driven hydrate above will pick up the new prefill
          // shortly. We also call reset() to short-circuit form-state if
          // RHF retained the prior values.
          reset({
            weight_kg: input.weight_kg,
            reps: input.reps,
            set_type: "working",
          });
        },
        // onError: optimistic onMutate already wrote the row; rollback
        // happens in setMutationDefaults. Silent-optimistic per UI-SPEC
        // line 303.
      },
    );

    // MOTN-01 / MOTN-05 set-logged feedback — fire-and-forget, AFTER the
    // optimistic mutate above, NEVER awaited and NEVER preceding it (F13,
    // T-11-06). The VISUAL animation (row slide-in + check scale) is owned by
    // LoggedSetRow's Reanimated `entering` / scale — it plays automatically
    // when the just-appended row mounts and is NOT gated. The HAPTIC is gated
    // behind the fm:haptics pref (default on, D-12) and voided.
    void getPref("fm:haptics").then((on) => {
      if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });
  };

  // Plan-target chip (header)
  const targetChip = formatTargetChip(planExercise);
  // D-02: per-card set-progress dots replace the v1 "3/4 set klart" counter
  // chip. The "total" for the dot strip is the plan target_sets, falling back
  // to the logged count (so a target-less exercise still shows a filled strip).
  const targetSets = planExercise.target_sets ?? loggedCount;
  const dotCount = Math.max(targetSets, loggedCount, 1);

  return (
    <View className="bg-forge-surface-light dark:bg-forge-surface border border-forge-border-light dark:border-forge-border rounded-forge-lg p-4 mb-4">
      {/* Card header */}
      <View className="gap-1 mb-3">
        <Text
          className="text-[22px] font-display-bold text-forge-text-light dark:text-forge-text"
          numberOfLines={1}
        >
          {exerciseName}
        </Text>
        {targetChip && (
          <View className="flex-row flex-wrap gap-2 mt-1">
            <View className="bg-forge-surface2-light dark:bg-forge-surface2 rounded-full px-3 py-1">
              <Text className="text-[13px] text-forge-text2-light dark:text-forge-text2">
                {targetChip}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* D-02: set-progress dot strip + trailing N / M counter */}
      <SetProgressDots
        loggedCount={loggedCount}
        dotCount={dotCount}
        targetSets={planExercise.target_sets}
      />

      {/* Logged set rows — Forge set-table (D-03) */}
      {setsForThisExercise.length > 0 && (
        <View className="mt-3 rounded-forge-md border border-forge-border-light dark:border-forge-border overflow-hidden">
          {/* Column headers (D-03) — 10px uppercase, once per card */}
          <View
            className="flex-row items-center px-4 py-2.5 border-b border-forge-border-light dark:border-forge-border"
            style={{ gap: 12 }}
          >
            <Text
              className="text-[10px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3"
              style={{ width: 32, letterSpacing: 1 }}
            >
              #
            </Text>
            <Text
              className="flex-1 text-[10px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3"
              style={{ letterSpacing: 1 }}
            >
              {t("colWeight")}
            </Text>
            <Text
              className="flex-1 text-[10px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3"
              style={{ letterSpacing: 1 }}
            >
              {t("colReps")}
            </Text>
            <Text
              className="text-[10px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3"
              style={{ width: 56, letterSpacing: 1 }}
            >
              {t("colRpe")}
            </Text>
            <View style={{ width: 36 }} />
          </View>
          {setsForThisExercise.map((set) => (
            <LoggedSetRow
              key={set.id}
              set={set}
              sessionId={sessionId}
            />
          ))}
        </View>
      )}

      {/* D-10 Forge input row: accent-tinted card footer. "SET N" accent
          uppercase label + folded-in F7 prev-value on one header line; three
          56px accent-bordered fields (large display value + small uppercase
          unit label underneath); full-width 50px accent "Klart" CTA with a
          leading check icon. The raw TextInputs are restyled IN PLACE so every
          keyboard/RHF wiring prop survives byte-for-byte (D-17) — they are NOT
          swapped to ForgeField (which cannot carry inputMode/selectTextOnFocus/
          returnKeyType). Per FORGE InputField (forge-screens.jsx ForgeInput),
          the value renders as the TextInput's own large display text with the
          KG/REPS/RPE micro-label beneath it. */}
      <View
        className="rounded-forge-md mt-3 px-4 pt-4 pb-[18px] bg-forge-accentSoft-light dark:bg-forge-accentSoft"
        style={{ gap: 10 }}
      >
        {/* Header: "SET N" accent uppercase + folded-in prev-value (D-10, F7) */}
        <View className="flex-row items-center justify-between">
          <Text
            className="text-[11px] font-semibold uppercase text-forge-accent-light dark:text-forge-accent"
            style={{ letterSpacing: 1 }}
          >
            {`${t("set")} ${currentSetNumber}`}
          </Text>
          {prevLabel && (
            <Text
              className="text-[11px] text-forge-text2-light dark:text-forge-text2"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {prevLabel}
            </Text>
          )}
        </View>

        {/* Three fields grid: weight (1fr) · reps (1fr) · rpe (60px) */}
        <View className="flex-row items-start" style={{ gap: 8 }}>
          <Controller
            control={control}
            name="weight_kg"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <ForgeNumField
                value={value == null ? "" : String(value)}
                onChangeText={onChange}
                unit={t("kg")}
                placeholder="0"
                keyboardType="decimal-pad"
                inputMode="decimal"
                accessibilityLabel={t("weight")}
                error={!!error}
                errorMessage={error?.message}
                className="flex-1"
              />
            )}
          />
          <Controller
            control={control}
            name="reps"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <ForgeNumField
                value={value == null ? "" : String(value)}
                onChangeText={onChange}
                unit={t("reps")}
                placeholder="0"
                keyboardType="number-pad"
                inputMode="numeric"
                accessibilityLabel={t("reps")}
                error={!!error}
                errorMessage={error?.message}
                className="flex-1"
              />
            )}
          />
          <Controller
            control={control}
            name="rpe"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <ForgeNumField
                value={value == null ? "" : String(value)}
                onChangeText={onChange}
                unit={t("rpe")}
                placeholder="–"
                keyboardType="decimal-pad"
                inputMode="decimal"
                accessibilityLabel={t("rpe")}
                error={!!error}
                errorMessage={error?.message}
                maxLength={4}
                small
              />
            )}
          />
        </View>

        {/* Full-width 50px accent "Klart" CTA with leading check (D-10) */}
        <Pressable
          onPress={handleSubmit(onKlart)}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={t("done")}
          className="h-[50px] w-full rounded-forge-md bg-forge-accent-light dark:bg-forge-accent flex-row items-center justify-center gap-2 disabled:opacity-60"
          style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
        >
          <Icon name="check" size={18} color={accentTextInk} strokeWidth={2.4} />
          <Text
            className="text-base font-semibold text-forge-accentText-light dark:text-forge-accentText"
            style={{ letterSpacing: -0.2 }}
          >
            {t("done")}
          </Text>
        </Pressable>
      </View>

      {/* Generic form-level error fallback (rare — Controller already
          renders per-field errors above) */}
      {errors.root && (
        <Text
          className="text-base text-red-600 dark:text-red-400 mt-2"
          accessibilityLiveRegion="polite"
        >
          {errors.root.message}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SetProgressDots — D-02 per-card set-progress dot strip + N / M counter
//   done bars      : accent fill
//   current bar    : accentSoft fill + accent border
//   remaining bars : surface2 fill
// The 6px bar height is a declared spacing exception (UI-SPEC).
// ---------------------------------------------------------------------------

function SetProgressDots({
  loggedCount,
  dotCount,
  targetSets,
}: {
  loggedCount: number;
  dotCount: number;
  targetSets: number | null;
}) {
  const bars = Array.from({ length: dotCount }, (_, i) => i + 1);
  // Counter denominator = plan target when present, else the live logged count.
  const denom = targetSets ?? loggedCount;
  return (
    <View className="flex-row items-center" style={{ gap: 6 }}>
      {bars.map((n) => {
        const done = n <= loggedCount;
        const current = n === loggedCount + 1;
        const cls = done
          ? "bg-forge-accent-light dark:bg-forge-accent"
          : current
            ? "bg-forge-accentSoft-light dark:bg-forge-accentSoft border border-forge-accent-light dark:border-forge-accent"
            : "bg-forge-surface2-light dark:bg-forge-surface2";
        return (
          <View key={n} className={`flex-1 h-1.5 rounded-[3px] ${cls}`} />
        );
      })}
      <Text
        className="text-[12px] font-semibold text-forge-text2-light dark:text-forge-text2 ml-1.5"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {`${loggedCount} / ${denom}`}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// LoggedSetRow — Forge set-table row (D-03) + tap-to-edit + ✕-delete (D-04)
//   grid: 32px # · 1fr weight · 1fr reps · 56px RPE · 36px action
//   RPE always rendered, muted "–" when null (D-05). No trophy (D-06).
//   Swipe-to-delete removed; trailing ✕ replaces it (D-04).
// ---------------------------------------------------------------------------

function LoggedSetRow({
  set,
  sessionId,
}: {
  set: SetRow;
  sessionId: string;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [isEditing, setIsEditing] = useState(false);

  // MOTN-01 set-logged visual: the success check scales 0.8→1 on mount with
  // the §07 default spring (damping 18, stiffness 220). This plays whenever a
  // row first mounts (i.e. right after the optimistic addSet appends it) — it
  // is NOT gated by fm:haptics (only the haptic in onKlart is). Fire-and-forget
  // off the UI thread; never blocks the write (T-11-06).
  const checkScale = useSharedValue(0.8);
  useEffect(() => {
    checkScale.value = withSpring(1, { damping: 18, stiffness: 220 });
  }, [checkScale]);
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  // Reset edit mode on screen blur (Pitfall 5 — freezeOnBlur).
  useFocusEffect(
    useCallback(() => {
      return () => setIsEditing(false);
    }, []),
  );

  const updateSet = useUpdateSet(sessionId);
  const removeSet = useRemoveSet(sessionId);

  if (isEditing) {
    return (
      <EditableSetRow
        set={set}
        onDone={(updated) => {
          if (updated) {
            updateSet.mutate({
              id: set.id,
              session_id: sessionId,
              weight_kg: updated.weight_kg,
              reps: updated.reps,
            });
          }
          setIsEditing(false);
        }}
      />
    );
  }

  const handleDelete = () => {
    // D-17 frozen write path: payload shape unchanged.
    removeSet.mutate({ id: set.id, session_id: sessionId });
  };

  const successInk = isDark ? "#30D158" : "#1E9E45";
  const deleteInk = isDark ? "rgba(255,255,255,0.38)" : "#8B8B8B";

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(30).stiffness(220)}
      className="flex-row items-center px-4 border-b border-forge-border-light dark:border-forge-border"
      style={{ gap: 12, paddingVertical: 14 }}
    >
      {/* Tappable region (# + weight + reps + RPE + success) enters inline edit */}
      <Pressable
        onPress={() => setIsEditing(true)}
        accessibilityRole="button"
        accessibilityLabel={`Set ${set.set_number}: ${set.weight_kg} kg × ${set.reps}`}
        className="flex-row items-center flex-1"
        style={({ pressed }) => [{ gap: 12 }, pressed ? { opacity: 0.7 } : null]}
      >
        {/* Set-number badge — accent circle, accentText numeral */}
        <View
          className="items-center justify-center rounded-full bg-forge-accent-light dark:bg-forge-accent"
          style={{ width: 22, height: 22 }}
        >
          <Text
            className="text-[11px] font-bold text-forge-accentText-light dark:text-forge-accentText"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {set.set_number}
          </Text>
        </View>
        {/* Weight + kg unit suffix */}
        <View className="flex-1 flex-row items-baseline">
          <Text
            className="text-[18px] font-display-semibold text-forge-text-light dark:text-forge-text"
            style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.3 }}
          >
            {set.weight_kg}
          </Text>
          <Text className="text-[12px] text-forge-text3-light dark:text-forge-text3 ml-1">
            {t("kg")}
          </Text>
        </View>
        {/* Reps */}
        <Text
          className="flex-1 text-[18px] font-display-semibold text-forge-text-light dark:text-forge-text"
          style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.3 }}
        >
          {set.reps}
        </Text>
        {/* RPE — always rendered; muted "–" when null (D-05) */}
        <Text
          className="text-[14px] text-forge-text2-light dark:text-forge-text2"
          style={{ width: 56, fontVariant: ["tabular-nums"] }}
        >
          {set.rpe != null ? (
            String(set.rpe)
          ) : (
            <Text className="text-forge-text3-light dark:text-forge-text3">–</Text>
          )}
        </Text>
        {/* Success check (plain checkCircle — no trophy, D-06). MOTN-01: the
            icon scales 0.8→1 on mount (ungated visual). */}
        <View style={{ width: 36 }} className="items-center">
          <Animated.View style={checkStyle}>
            <Icon name="checkCircle" size={20} color={successInk} />
          </Animated.View>
        </View>
      </Pressable>
      {/* Trailing ✕-delete (D-04) — replaces swipe; muted, no confirm */}
      <Pressable
        onPress={handleDelete}
        accessibilityRole="button"
        accessibilityLabel={t("removeSet")}
        hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
        className="items-center justify-center"
        style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
      >
        <Icon name="close" size={18} color={deleteInk} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

// EditableSetRow — inline edit mode for a logged set. Mirrors the
// always-visible input row but pre-filled with the existing set values
// and submits via useUpdateSet (not useAddSet).
function EditableSetRow({
  set,
  onDone,
}: {
  set: SetRow;
  onDone: (updated: { weight_kg: number; reps: number } | null) => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  // D-17: RHF + keyboard wiring preserved byte-for-byte; chrome retoken only.
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SetFormInput, undefined, SetFormOutput>({
    resolver: zodResolver(setFormSchema),
    mode: "onSubmit",
    defaultValues: {
      weight_kg: set.weight_kg,
      reps: set.reps,
      set_type: set.set_type,
    },
  });

  return (
    <View className="flex-row items-center gap-2 bg-forge-surface-light dark:bg-forge-surface border-b border-forge-border-light dark:border-forge-border px-3 py-3">
      <Text className="text-[13px] font-semibold text-forge-text2-light dark:text-forge-text2">
        {t("set")} {set.set_number}
      </Text>
      <Controller
        control={control}
        name="weight_kg"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <TextInput
            value={value == null ? "" : String(value)}
            onChangeText={onChange}
            placeholder={t("weight")}
            placeholderTextColor="#8B8B8B"
            keyboardType="decimal-pad"
            inputMode="decimal"
            returnKeyType="done"
            autoCorrect={false}
            autoCapitalize="none"
            selectTextOnFocus={true}
            accessibilityLabel={t("weight")}
            className={`flex-1 rounded-forge-md bg-forge-bg-light dark:bg-forge-bg border px-3 py-2 text-base text-forge-text-light dark:text-forge-text min-h-[44px] ${
              error
                ? "border-forge-danger-light dark:border-forge-danger"
                : "border-forge-border-light dark:border-forge-border"
            }`}
          />
        )}
      />
      <Controller
        control={control}
        name="reps"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <TextInput
            value={value == null ? "" : String(value)}
            onChangeText={onChange}
            placeholder={t("reps")}
            placeholderTextColor="#8B8B8B"
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="done"
            autoCorrect={false}
            autoCapitalize="none"
            selectTextOnFocus={true}
            accessibilityLabel={t("reps")}
            className={`flex-1 rounded-forge-md bg-forge-bg-light dark:bg-forge-bg border px-3 py-2 text-base text-forge-text-light dark:text-forge-text min-h-[44px] ${
              error
                ? "border-forge-danger-light dark:border-forge-danger"
                : "border-forge-border-light dark:border-forge-border"
            }`}
          />
        )}
      />
      <Pressable
        onPress={handleSubmit((input) =>
          onDone({ weight_kg: input.weight_kg, reps: input.reps }),
        )}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={t("done")}
        className="w-16 min-h-[44px] rounded-forge-md bg-forge-accent-light dark:bg-forge-accent items-center justify-center disabled:opacity-60"
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      >
        <Text className="text-base font-semibold text-forge-accentText-light dark:text-forge-accentText">
          {t("done")}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onDone(null)}
        accessibilityRole="button"
        accessibilityLabel={t("cancel")}
        className="px-2"
        hitSlop={8}
        style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
      >
        <Icon
          name="close"
          size={20}
          color={isDark ? "rgba(255,255,255,0.62)" : "#4D4D4D"}
          strokeWidth={2}
        />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ForgeNumField — D-10 set-input field: a 56px accent-bordered cell where the
// raw TextInput IS the large display value (font-display-semibold, tabular,
// centered) with a small uppercase unit micro-label underneath (KG/REPS/RPE).
// The TextInput keeps ALL hot-path keyboard wiring (keyboardType/inputMode/
// returnKeyType/selectTextOnFocus/autoCorrect/autoCapitalize) — it is restyled
// in place, NOT swapped to ForgeField (D-17). Box styling (h/radius/border/bg)
// lives in className per the NativeWind-4 box-decoration rule; only nothing
// extra is needed in style().
// ---------------------------------------------------------------------------

function ForgeNumField({
  value,
  onChangeText,
  unit,
  placeholder,
  keyboardType,
  inputMode,
  accessibilityLabel,
  error,
  errorMessage,
  maxLength,
  small,
  className,
}: {
  value: string;
  onChangeText: (text: string) => void;
  unit: string;
  placeholder: string;
  keyboardType: "decimal-pad" | "number-pad";
  inputMode: "decimal" | "numeric";
  accessibilityLabel: string;
  error: boolean;
  errorMessage?: string;
  maxLength?: number;
  small?: boolean;
  className?: string;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  // Field fill: white in light, near-black translucent in dark (ForgeInput
  // L530-532). Inline because rgba(0,0,0,0.4) is off the Tailwind scale.
  const fieldBg = isDark ? "rgba(0,0,0,0.4)" : "#FFFFFF";
  const placeholderInk = isDark ? "rgba(255,255,255,0.38)" : "#8B8B8B";

  return (
    <View className={className} style={small ? { width: 60 } : undefined}>
      <View
        className={`h-14 rounded-forge-sm border items-center justify-center ${
          error
            ? "border-forge-danger-light dark:border-forge-danger"
            : "border-forge-accent-light/30 dark:border-forge-accent/30"
        }`}
        style={{ backgroundColor: fieldBg }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderInk}
          keyboardType={keyboardType}
          inputMode={inputMode}
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="none"
          selectTextOnFocus={true}
          accessibilityLabel={accessibilityLabel}
          maxLength={maxLength}
          textAlign="center"
          className="w-full text-center font-display-semibold text-forge-text-light dark:text-forge-text p-0"
          style={{
            fontSize: small ? 20 : 22,
            lineHeight: small ? 22 : 24,
            letterSpacing: -0.6,
            fontVariant: ["tabular-nums"],
          }}
        />
        <Text
          className="text-[9.5px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3 mt-0.5"
          style={{ letterSpacing: 1 }}
        >
          {unit}
        </Text>
      </View>
      {error && errorMessage && (
        <Text
          className="text-[11px] text-forge-danger-light dark:text-forge-danger mt-1 text-center"
          accessibilityLiveRegion="polite"
          numberOfLines={1}
        >
          {errorMessage}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// AvslutaOverlay — inline-overlay-confirm (NOT modal portal)
// ---------------------------------------------------------------------------
//
// Why inline-overlay, not Modal portal (verbatim plans/[id].tsx UAT
// 2026-05-10):
//   NativeWind/flex layout inside the Modal portal silently collapsed
//   (no scrim, dialog rendered at top-left). Explicit RN styles on the
//   layout primitives; NativeWind retained for the inner card content
//   where it works reliably.
//
// D-23 + PITFALLS §6.6 / D-16 — the primary "Avsluta" button is ACCENT
// (NOT red). Finishing a pass is the intended terminal state, not a
// data-loss action. Red is reserved for the "Avsluta sessionen" button
// in the draft-resume overlay (Plan 03), where finishing an orphaned
// draft IS data-loss-adjacent.
//
// Plan 11-02 (D-08/D-15/MOTN-04): re-skinned to FFinishOverlay — trophy hero
// (the overlay's OWN gradient icon, NOT the omitted PR banner), 3-cell
// client-derived stats row (sets / Σ kg / MM:SS), §07 spring open
// (backdrop 0→0.5 + card translateY 24→0), inline-rendered (no Modal portal).

function AvslutaOverlay({
  sessionId,
  loggedSetCount,
  sets,
  startedAt,
  onCancel,
  onFinish,
}: {
  sessionId: string;
  loggedSetCount: number;
  sets: SetRow[];
  startedAt: string | null;
  onCancel: () => void;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const accentTextInk = "#FFFFFF";
  const trophyGrad: [string, string] = isDark
    ? ["#FF7A2E", "#FF2D55"]
    : ["#FF7A2E", "#FF3D5E"];
  const finishSession = useFinishSession(sessionId);
  // D-N4: local notes state; nollställs vid unmount (Option A — minimal coupling).
  const [notes, setNotes] = useState<string>("");
  // D-N4 cleanup: reset notes-draft when the overlay unmounts (backdrop-tap,
  // Fortsätt, or Avsluta). Re-open mounts fresh with empty state.
  useEffect(() => () => setNotes(""), []);
  // Track keyboard height manually — KeyboardAvoidingView's `padding`/`height`
  // behaviors do not lift an absolutely-positioned, flex-end-anchored card on
  // iOS 15+/RN 0.81; the card visually moves to the bottom but stays under the
  // keyboard (UAT bug reported 2026-05-16, iPhone 15 Pro / iOS 26.4.2).
  // Solution: read the actual keyboard frame and apply paddingBottom directly.
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

  // D-08: 3-cell stats row, derived CLIENT-SIDE from the sets already loaded
  // for this session (no new query/aggregate; T-11-04). cell 1 = logged-set
  // count, cell 2 = Σ weight×reps (kg), cell 3 = MM:SS elapsed since started_at.
  const totalVolume = sets.reduce(
    (sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0),
    0,
  );
  const elapsedMs = startedAt
    ? Date.now() - new Date(startedAt).getTime()
    : 0;
  const elapsedLabel = formatElapsed(elapsedMs);
  // Volume formatted with a thin space thousands separator (mock "4 820").
  const volumeLabel = Math.round(totalVolume)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  const title = t("finishWorkoutQ");
  // Body copy folds the count + elapsed time (D-08 / Copywriting contract).
  const body = t("finishBody", { count: loggedSetCount, time: elapsedLabel });

  // MOTN-04 §07 overlay spring: backdrop opacity 0→0.5 + card translateY 24→0
  // (damping 18, stiffness 220, ~240ms), inline-rendered (no Modal portal,
  // D-15). Shared values animate on mount; never gate the write.
  const backdropOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(24);
  useEffect(() => {
    backdropOpacity.value = withSpring(0.5, { damping: 18, stiffness: 220 });
    cardTranslateY.value = withSpring(0, { damping: 18, stiffness: 220 });
  }, [backdropOpacity, cardTranslateY]);
  const backdropStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0,0,0,${backdropOpacity.value})`,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const handleConfirm = () => {
    // mutate (NOT mutateAsync) — Phase 4 commit 5d953b6.
    // D-N3: include notes in payload; trim/null-normalization happens in
    // the ['session','finish'] mutationFn (Task 1 — client.ts).
    finishSession.mutate(
      { id: sessionId, finished_at: new Date().toISOString(), notes },
      {
        // onError: optimistic onMutate in Plan 01 setMutationDefaults
        // already cleared sessionsKeys.active(); rollback handled there.
      },
    );
    // Synchronous navigation — works even when mutation is paused
    // offline. The setMutationDefaults['session','finish'] onSettled
    // invalidates lastValueKeys.all (Open Q#2) so the next session's F7
    // chips include this session's working sets.
    onFinish();
  };

  // WR-05 (05-REVIEW.md): backdrop-tap dismisses (onPress={onCancel}). This
  // DIVERGES from the draft-resume overlay in (tabs)/index.tsx which uses
  // force-decision UX (no backdrop dismiss). Rationale: Avsluta-during-workout
  // is recoverable — the user can re-tap Avsluta in the header — whereas the
  // draft-resume overlay surfaces an orphan session that MUST be either
  // resumed or explicitly closed, so backdrop-dismiss there would leave the
  // user in an ambiguous state. UI-SPEC §line 250 (force-decision) vs
  // §line 558 (Avsluta-during-workout, dismissible).
  const counterWarn = notes.length > 480;
  const placeholderInk = isDark ? "rgba(255,255,255,0.38)" : "#8B8B8B";

  return (
    <AnimatedPressable
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          // D-N1 (revised 2026-05-16, iter 3): center the card normally; only
          // when the iOS keyboard is up do we switch to flex-end + paddingBottom
          // = keyboardHeight + 16 so the card lifts exactly above the keyboard.
          // This avoids the "modal slammed against bottom" look when no input
          // is focused while still solving the original UAT-blocker.
          justifyContent: keyboardHeight > 0 ? "flex-end" : "center",
          paddingHorizontal: 24,
          paddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : 0,
          zIndex: 2000,
        },
        // MOTN-04: animated backdrop opacity 0→0.5 (replaces the static
        // rgba(0,0,0,0.5)).
        backdropStyle,
      ]}
      onPress={onCancel}
      accessibilityRole="button"
      accessibilityLabel={t("closeModal")}
    >
      {/* Inner Pressable claims the touch so backdrop-onPress (onCancel) does
          NOT fire when tapping the card itself (PATTERNS.md landmine #6).
          Doubling as a tap-to-dismiss-keyboard target: tap on the card body
          (outside TextInput / buttons) closes the keyboard, matching native
          iOS expectation. TextInput + button taps consume the event first,
          so this only fires on empty card surface. */}
      <Pressable
        style={{ width: "100%", maxWidth: 400 }}
        onPress={() => Keyboard.dismiss()}
      >
        {/* MOTN-04: card translateY 24→0 spring. Box styling in className per
            the NativeWind-4 rule; only the animated transform + shadow in
            style(). */}
        <Animated.View
          className="rounded-forge-lg p-6 border bg-forge-surface-light dark:bg-forge-surface2 border-forge-borderStrong-light dark:border-forge-borderStrong"
          style={[
            cardStyle,
            {
              gap: 0,
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 24 },
              shadowOpacity: 0.4,
              shadowRadius: 48,
            },
          ]}
        >
          {/* Trophy hero — the overlay's OWN gradient icon block (NOT the
              omitted PR banner). 52px rounded gradient tile + trophy. */}
          <LinearGradient
            colors={trophyGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Icon name="trophy" size={24} color="#FFFFFF" strokeWidth={2.2} />
          </LinearGradient>

          <Text
            className="text-[26px] font-display-bold text-forge-text-light dark:text-forge-text"
            style={{ letterSpacing: -0.8 }}
            accessibilityRole="header"
          >
            {title}
          </Text>
          <Text
            className="text-[15px] text-forge-text2-light dark:text-forge-text2 mt-2 mb-[18px]"
            style={{ lineHeight: 21, letterSpacing: -0.1 }}
          >
            {body}
          </Text>

          {/* D-N2: multi-line notes TextInput + char-counter (PRESERVED) */}
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t("notesPlaceholder")}
            placeholderTextColor={placeholderInk}
            multiline
            numberOfLines={3}
            maxLength={500}
            style={{ minHeight: 80, maxHeight: 160 }}
            textAlignVertical="top"
            accessibilityLabel={t("notes")}
            className="rounded-forge-sm bg-forge-bg-light dark:bg-forge-bg border border-forge-border-light dark:border-forge-border px-3.5 py-3 text-[15px] text-forge-text-light dark:text-forge-text"
          />
          {/* Counter: always visible; flips to danger when > 480 */}
          <Text
            className={`text-[11px] text-right mt-1.5 mb-[18px] ${counterWarn ? "text-forge-danger-light dark:text-forge-danger" : "text-forge-text3-light dark:text-forge-text3"}`}
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {`${notes.length}/500`}
          </Text>

          {/* D-08: 3-cell client-derived stats row (FFOStat) */}
          <View className="flex-row mb-5" style={{ gap: 8 }}>
            <FinishStat value={String(loggedSetCount)} label={t("sets")} />
            <FinishStat value={volumeLabel} label={t("kg")} />
            <FinishStat value={elapsedLabel} label={t("min")} />
          </View>

          {/* Buttons — neutral "Fortsätt" (surface3) + accent "Avsluta"
              (D-16, NOT red) with leading check. */}
          <View className="flex-row" style={{ gap: 10 }}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={t("continue")}
              className="flex-1 h-[52px] rounded-forge-md items-center justify-center bg-forge-surface3-light dark:bg-forge-surface3"
              style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
            >
              <Text
                className="text-[15px] font-semibold text-forge-text-light dark:text-forge-text"
                style={{ letterSpacing: -0.2 }}
              >
                {t("continue")}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel={t("finish")}
              className="h-[52px] rounded-forge-md flex-row items-center justify-center gap-2 bg-forge-accent-light dark:bg-forge-accent"
              style={({ pressed }) => [
                {
                  flexGrow: 1.6,
                  flexBasis: 0,
                  shadowColor: isDark ? "#FF5A1F" : "#E14E10",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                },
                pressed ? { opacity: 0.85 } : null,
              ]}
            >
              <Icon
                name="check"
                size={16}
                color={accentTextInk}
                strokeWidth={2.4}
              />
              <Text
                className="text-[15px] font-semibold text-forge-accentText-light dark:text-forge-accentText"
                style={{ letterSpacing: -0.2 }}
              >
                {t("finish")}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </AnimatedPressable>
  );
}

// FinishStat — D-08 single stat cell (FFOStat): centered display numeral +
// uppercase micro-label. Box styling in className.
function FinishStat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 py-2.5 rounded-forge-sm items-center border bg-forge-bg-light dark:bg-forge-bg border-forge-border-light dark:border-forge-border">
      <Text
        className="text-[18px] font-display-bold text-forge-text-light dark:text-forge-text"
        style={{ letterSpacing: -0.4, lineHeight: 20, fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
      <Text
        className="text-[9px] font-bold uppercase text-forge-text3-light dark:text-forge-text3 mt-1"
        style={{ letterSpacing: 0.8 }}
      >
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// formatTargetChip — UI-SPEC §lines 351-373 — render plan-target chip text
// ---------------------------------------------------------------------------

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
    return `${px.target_sets}×${repsPart}`;
  }
  if (px.target_sets != null) {
    return String(px.target_sets);
  }
  return repsPart || null;
}
