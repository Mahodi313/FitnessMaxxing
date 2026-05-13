// app/app/(app)/(tabs)/index.tsx
//
// Phase 4 Plan 02 Task 2: Planer tab — three states:
//   1. Loading (isPending): centered ActivityIndicator (≤500ms typical due
//      to AsyncStorage cache hydration per UI-SPEC §"Loading / cold-start").
//   2. Empty (plans.length === 0): centered Ionicons barbell-outline +
//      "Inga planer än" + "Skapa din första plan." + inline "Skapa plan"
//      CTA per CONTEXT.md D-14 / UI-SPEC §"Empty states".
//   3. Populated: "Mina planer" Display heading + FlatList of plan-rows +
//      floating "Skapa ny plan" FAB per UI-SPEC §Planer tab.
//
// Empty-state CTA is INLINE (NOT the FAB) per UI-SPEC §"Empty states":
// when plans.length===0 the centered CTA shows; the FAB only appears once
// there's at least 1 plan, so it doesn't hover over the empty state's
// primary CTA.
//
// usePlansQuery (Plan 04-01) already filters .is('archived_at', null) so
// archived plans never appear here (CONTEXT.md D-12).
//
// router.push('/plans/new') routes to plans/new.tsx (Task 3, this plan).
// router.push(`/plans/${plan.id}`) routes to plans/[id].tsx (Plan 04-03).
// Until Plan 04-03 ships, plan-row tap will Expo-Router 404 — acceptable
// per Plan 04-02's verification scope.
//
// `as Href` casts on the two route strings: app.json has experiments
// .typedRoutes=true, so Expo Router validates path literals against the
// auto-generated .expo/types/router.d.ts. Those types only include routes
// whose source files currently exist; /plans/new and /plans/[id] are owned
// by this plan's Task 3 and Plan 04-03 respectively. The `as Href` cast is
// a localized Rule 3 fix that defers type-validation until the dev server
// regenerates router.d.ts (which it does on the next `expo start`). Once
// both routes ship, the casts can be dropped — this comment serves as a
// breadcrumb for that V1.1 cleanup.
//
// Phase 5 D-21 + D-24 EXTENSION:
//   - Draft-resume overlay: when useActiveSessionQuery returns a non-null row
//     on cold-start (workout_sessions WHERE finished_at IS NULL exists for
//     this user — surface "Återuppta passet?" inline-overlay per UI-SPEC
//     §lines 240–250). The user must EXPLICITLY choose between Återuppta
//     (route to /workout/<id>) or Avsluta sessionen (mutate finished_at to
//     now() in place — closes the orphan without losing logged sets — Phase
//     6 Historik will still show those sets). The backdrop does NOT dismiss
//     (force-decision UX — UI-SPEC §line 250).
//   - Dismissal is scoped to the active session_id (NOT a boolean), so once
//     the user acts on session X (Återuppta or Avsluta), the overlay stays
//     hidden for the rest of the app launch even as they navigate Tabs <→
//     /workout/[id] freely. A genuinely new draft (different session.id —
//     e.g. after finishing X and starting Y) re-triggers the overlay because
//     dismissedForSessionId !== Y. App restart wipes state (fresh mount), so
//     cold-start recovery still surfaces the prompt. (UAT 2026-05-13 — the
//     prior useFocusEffect-reset design slammed the overlay up on every tab
//     blur/focus cycle, which was annoying mid-pass.)
//   - "Passet sparat ✓" success toast: renders on transition from
//     activeSession=non-null → activeSession=null (the only signal that a
//     Avsluta-flow completed — either from this screen's secondary button or
//     from /workout/[sessionId]'s Avsluta-overlay routing back here). Uses
//     Reanimated `Animated.View` with `entering={FadeIn.duration(200)}` +
//     `exiting={FadeOut.duration(200)}`. The 2-second visible window is
//     enforced by a `setTimeout(2000)` in `useEffect` (per must_haves line
//     48: `FadeOut.delay(2000)` would defer the START of the fade, not the
//     visible duration; setTimeout → setState → React triggers `exiting`).
//
// Toast implementation choice (RESEARCH Open Q#3 + must_haves):
//   PICKED: `useEffect`-watching-`activeSession`-transition pattern.
//   Why: TanStack-query value transition is the cleanest signal we already
//   have — the Avsluta optimistic onMutate (Plan 01) clears
//   sessionsKeys.active(), which propagates through useActiveSessionQuery
//   instantly. No extra Zustand store, no router-param hand-off (both
//   anti-patterns explicitly forbidden per CONTEXT.md D-25 and PATTERNS.md
//   §Toast — no-analog notes).
//
// References:
//   - 04-CONTEXT.md D-12, D-14
//   - 04-UI-SPEC.md §Planer tab + §Visuals plan-list-row + §Visuals FAB
//   - 05-CONTEXT.md D-21, D-24, D-25
//   - 05-UI-SPEC.md §lines 238–250 (draft-resume), §lines 267–276 (toast),
//     §lines 555–569 (Reanimated structure)
//   - 05-PATTERNS.md §inline-overlay-confirm
import { useState, useEffect, useRef } from "react";
import { useRouter, type Href } from "expo-router";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { usePlansQuery } from "@/lib/queries/plans";
import {
  useActiveSessionQuery,
  useFinishSession,
} from "@/lib/queries/sessions";
import { useSetsForSessionQuery } from "@/lib/queries/sets";

export default function PlansTab() {
  const router = useRouter();
  const { data: plans, isPending } = usePlansQuery();
  const scheme = useColorScheme();
  const accent = scheme === "dark" ? "#60A5FA" : "#2563EB";
  const muted = scheme === "dark" ? "#9CA3AF" : "#6B7280";

  // Phase 5 D-21 — draft-resume overlay state.
  const { data: activeSession, isPending: activeSessionPending } =
    useActiveSessionQuery();
  // useSetsForSessionQuery gates on `!!sessionId` — empty string yields a
  // disabled query (no fetch, data=undefined). setsCount falls back to 0 below.
  const { data: activeSets } = useSetsForSessionQuery(activeSession?.id ?? "");
  const [dismissedForSessionId, setDismissedForSessionId] = useState<
    string | null
  >(null);
  const [showToast, setShowToast] = useState(false);
  // UAT 2026-05-13 (3rd iteration): the overlay must ONLY surface a draft
  // that pre-dates this app launch ("cold-start recovery"). A session the
  // user just started themselves seconds ago is already represented by the
  // ActiveSessionBanner at the top — repeating the prompt as a force-decision
  // modal every time they navigate back to Planer is annoying, not helpful.
  //
  // Capture the active session id at the FIRST settled query result and store
  // in STATE (not useRef — a ref update doesn't trigger a re-render, so the
  // overlay would never appear even when the ref captures a session). Once
  // captured the value is sticky for this mount: subsequent activeSession
  // changes (user finishes X, starts Y) don't re-trigger capture because the
  // sentinel is no longer `undefined`.
  const [coldStartSessionId, setColdStartSessionId] = useState<
    string | null | undefined
  >(undefined);
  useEffect(() => {
    if (coldStartSessionId === undefined && !activeSessionPending) {
      setColdStartSessionId(activeSession?.id ?? null);
    }
  }, [activeSession, activeSessionPending, coldStartSessionId]);
  const isColdStartDraft =
    activeSession?.id != null && coldStartSessionId === activeSession.id;
  const draftDismissed =
    activeSession?.id != null && dismissedForSessionId === activeSession.id;
  const shouldShowDraftOverlay = isColdStartDraft && !draftDismissed;

  // WR-04 (05-REVIEW.md): useFinishSession is now mounted INSIDE the
  // DraftResumeOverlay subcomponent (defined below), which takes sessionId as
  // a required prop. This keeps scope.id as a guaranteed-static string for
  // the lifetime of the overlay mount and eliminates the prior `?? "noop"`
  // sentinel that violated Pitfall 3's static-scope-at-construction rule.

  // Toast trigger: detect transition from active=non-null → active=null
  // (Avsluta-flow completes from EITHER this screen's secondary OR the
  // /workout/[sessionId] Avsluta-overlay). The previous-value ref captures
  // the prior render's activeSession so we only fire on the actual edge,
  // not on every render where activeSession===null.
  const previousActiveRef = useRef<typeof activeSession | undefined>(undefined);
  useEffect(() => {
    // CR-02 (05-REVIEW.md): capture prev FIRST, update the ref unconditionally,
    // then decide whether to fire the toast. The previous design wrote to the
    // ref inside the firing branch AND outside it, which left a race where the
    // ref pointed at a stale snapshot if activeSession mutated between the
    // firing render and the cleanup-firing render. With this reordering, every
    // render updates the ref once, and the timer/cleanup pair is registered
    // only when an actual non-null→null transition is detected.
    const prev = previousActiveRef.current;
    previousActiveRef.current = activeSession;
    if (prev != null && activeSession == null) {
      setShowToast(true);
      const t = setTimeout(() => setShowToast(false), 2000);
      return () => clearTimeout(t);
    }
  }, [activeSession]);

  // Draft-resume body copy per UI-SPEC §lines 245–246. 0-set vs N-set variants.
  const setsCount = activeSets?.length ?? 0;
  const startedAt = activeSession?.started_at
    ? format(new Date(activeSession.started_at), "HH:mm")
    : "";
  const draftBody =
    setsCount > 0
      ? `Du har ett pågående pass från ${startedAt} med ${setsCount} set sparade.`
      : `Du startade ett pass ${startedAt} men har inte loggat något set än.`;

  // Loading state (≤500ms typical due to AsyncStorage cache hydration —
  // UI-SPEC §"Loading / cold-start").
  if (isPending) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  const isEmpty = !plans || plans.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      {!isEmpty && (
        <View className="px-4 pt-4 pb-2">
          <Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
            Mina planer
          </Text>
        </View>
      )}

      <FlatList
        data={plans ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 96,
          flexGrow: 1,
        }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center gap-6 px-4">
            <Ionicons name="barbell-outline" size={64} color={accent} />
            <View className="gap-2 items-center">
              <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                Inga planer än
              </Text>
              <Text className="text-base text-gray-500 dark:text-gray-400">
                Skapa din första plan.
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/plans/new" as Href)}
              accessibilityRole="button"
              accessibilityLabel="Skapa plan"
              className="rounded-lg bg-blue-600 dark:bg-blue-500 px-6 py-4 active:opacity-80"
            >
              <Text className="text-base font-semibold text-white">
                Skapa plan
              </Text>
            </Pressable>
          </View>
        }
        renderItem={({ item: plan }) => (
          <Pressable
            onPress={() => router.push(`/plans/${plan.id}` as Href)}
            accessibilityRole="button"
            accessibilityLabel={`Öppna plan ${plan.name}`}
            className="flex-row items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-4 active:opacity-80"
          >
            <View className="flex-1 mr-2">
              <Text
                className="text-base font-semibold text-gray-900 dark:text-gray-50"
                numberOfLines={1}
              >
                {plan.name}
              </Text>
              {plan.description ? (
                <Text
                  className="text-base text-gray-500 dark:text-gray-400"
                  numberOfLines={1}
                >
                  {plan.description}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={muted} />
          </Pressable>
        )}
      />

      {!isEmpty && (
        <Pressable
          onPress={() => router.push("/plans/new" as Href)}
          accessibilityRole="button"
          accessibilityLabel="Skapa ny plan"
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 dark:bg-blue-500 items-center justify-center shadow-lg active:opacity-80"
        >
          <Ionicons name="add" size={28} color="white" />
        </Pressable>
      )}

      {/* Phase 5 D-21 — Draft-resume overlay. Inline-overlay pattern per
          PATTERNS.md §inline-overlay-confirm (NOT Modal portal — Phase 4 D-08
          anti-pattern). Subcomponent extraction (WR-04 from 05-REVIEW.md):
          DraftResumeOverlay takes sessionId as a required prop so the
          useFinishSession scope.id is a stable static string per Pitfall 3. */}
      {activeSession && shouldShowDraftOverlay && (
        <DraftResumeOverlay
          sessionId={activeSession.id}
          bodyText={draftBody}
          onResume={() => {
            setDismissedForSessionId(activeSession.id);
            router.push(`/workout/${activeSession.id}` as Href);
          }}
          onDismiss={() => setDismissedForSessionId(activeSession.id)}
        />
      )}

      {/* Phase 5 D-24 — "Passet sparat ✓" success toast. Reanimated 4
          Animated.View with entering={FadeIn.duration(200)} +
          exiting={FadeOut.duration(200)}. The 2s visible window is gated by
          setTimeout(2000) in the useEffect transition watcher above (NOT
          FadeOut.delay(2000) — `delay` defers the start of the unmount fade,
          not the visible duration; see must_haves line 48). */}
      {showToast && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="absolute bottom-20 self-center bg-green-600 dark:bg-green-500 rounded-full px-6 py-3"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text className="text-base font-semibold text-white">
            Passet sparat ✓
          </Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// DraftResumeOverlay — extracted subcomponent (WR-04 from 05-REVIEW.md).
// Takes sessionId as a REQUIRED prop so useFinishSession's scope.id is a
// stable static string for the lifetime of the mount, satisfying Pitfall 3
// (scope.id MUST NOT change across re-renders). Mounts only when the parent
// has determined that a cold-start draft should be surfaced.
// ---------------------------------------------------------------------------
function DraftResumeOverlay({
  sessionId,
  bodyText,
  onResume,
  onDismiss,
}: {
  sessionId: string;
  bodyText: string;
  onResume: () => void;
  onDismiss: () => void;
}) {
  const finishSession = useFinishSession(sessionId);

  const handleAvslutaSession = () => {
    // mutate (NOT mutateAsync) per Phase 4 commit 5d953b6 UAT lesson — paused
    // mutations under networkMode: 'offlineFirst' never resolve mutateAsync.
    // The optimistic onMutate in setMutationDefaults['session','finish']
    // (Plan 01) clears sessionsKeys.active() so the banner + overlay unmount
    // immediately; the toast then fires via the useEffect transition watcher
    // in the parent.
    finishSession.mutate(
      { id: sessionId, finished_at: new Date().toISOString() },
      {
        onError: () => {
          // V1: silent — if the server eventually rejects, the active query
          // will refetch and the row re-appears as active on next focus.
        },
      },
    );
    onDismiss();
  };

  return (
    <Pressable
      className="absolute inset-0 bg-black/40"
      accessibilityElementsHidden={false}
      // Intentionally NO onPress — backdrop is decoratively pressable to
      // absorb taps but does not dismiss; force-decision UX per UI-SPEC.
    >
      <View
        className="absolute inset-x-4 top-[40%] bg-gray-100 dark:bg-gray-800 rounded-2xl p-6"
        style={{ gap: 24 }}
        onStartShouldSetResponder={() => true}
      >
        <View style={{ gap: 8 }}>
          <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Återuppta passet?
          </Text>
          <Text className="text-base text-gray-900 dark:text-gray-50">
            {bodyText}
          </Text>
        </View>
        <View className="flex-row gap-3">
          <Pressable
            onPress={handleAvslutaSession}
            className="flex-1 py-4 rounded-lg bg-red-600 dark:bg-red-500 items-center justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="Avsluta sessionen"
          >
            <Text className="text-base font-semibold text-white">
              Avsluta sessionen
            </Text>
          </Pressable>
          <Pressable
            onPress={onResume}
            className="flex-1 py-4 rounded-lg bg-blue-600 dark:bg-blue-500 items-center justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="Återuppta passet"
          >
            <Text className="text-base font-semibold text-white">
              Återuppta
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
