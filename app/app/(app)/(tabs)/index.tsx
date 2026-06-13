// app/app/(app)/(tabs)/index.tsx
//
// Phase 10 Plan 05 (SKIN-02 / I18N-05): Forge re-skin of the Planer tab
// → FHome's PLAN-LIST PORTION ONLY (forge-screens.jsx FHome, line 88).
//
// Boundary (10-UI-SPEC reconciliation lines 169-170): this is the plan-list
// portion of FHome — the activity-ring / week-sessions / streak / volume HERO
// is Phase 12 (DASH-01..05) and is intentionally NOT built here. The layout
// reference is FHome's header row (brand-mark tile + profile button), page
// title (t('myPlans')), section header (MINA PLANER + Ny plan link), and the
// plan-card list (featured-card gradient barbell tile on i===0 ONLY).
//
// ALL prior behavior is preserved, re-skinned to Forge:
//   - usePlansQuery (archived_at is null) — list + loading + empty states.
//   - Empty state: t('noPlans') + t('noPlansSub') + a Forge primary CTA. The
//     FAB is hidden when empty so it doesn't hover over the empty-state CTA
//     (Phase 4 UI-SPEC §Empty states).
//   - Populated plan-card list: card tap → plans/[id]; plan name + description
//     meta (description is the existing per-plan list datum — no per-plan
//     exercise-count query is issued from the list, avoiding an N+1; UI-SPEC
//     §reconciliation: "plain derived counts, no new aggregates").
//   - "Ny plan" section-header inline link + floating "+" FAB → plans/new.
//   - Active-session banner is rendered by (tabs)/_layout.tsx ABOVE the tabs
//     (Phase 4 carry-forward) — unchanged here.
//   - Phase 5 DraftResumeOverlay (cold-start draft-resume) + "Passet sparat"
//     success toast — preserved verbatim (only the surrounding chrome is
//     re-skinned; the overlay/toast logic is untouched offline-critical code).
//
// Chrome routes through live t() (SP-5) so the language toggle re-renders text
// instantly. User content (plan name/description) is rendered verbatim (D-16).
//
// Optical values (10-UI-SPEC §Spacing — NativeWind 4 / Tailwind 3 purges
// off-scale arbitrary classes, so these are inline style={{}} numbers,
// Pitfall 3): brand tile 32×32 radius 10; profile button 36×36 radius 18;
// plan card padding 16×18 radius 18; card icon tile 44×44 radius 12; list
// bottom padding 100 (clears the floating TabBar — FHome `0 0 100px`).
//
// References:
//   - app/design v2/Sources/design/forge-screens.jsx FHome (line 88)
//   - .planning/phases/10-plans-exercises-re-skin/10-UI-SPEC.md §Interaction Contract / §Color / reconciliation
//   - 10-PATTERNS.md SP-2/SP-5/SP-6 + new.tsx/index.tsx assignment
//   - app/app/(app)/(tabs)/settings.tsx (Phase 9 live-t() list re-skin idiom)
//   - 04-CONTEXT.md D-12/D-14 + 05-CONTEXT.md D-21/D-24/D-25 (draft-resume/toast)
import { useState, useEffect, useRef } from "react";
import { useRouter, type Href } from "expo-router";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useColorScheme } from "nativewind";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Icon, Logo, ForgeButton, ProgressRing, ForgeChip } from "@/components/ui";
import { ActiveSessionBanner } from "@/components/active-session-banner";
import { usePlansQuery } from "@/lib/queries/plans";
import {
  useActiveSessionQuery,
  useFinishSession,
} from "@/lib/queries/sessions";
import { useSetsForSessionQuery } from "@/lib/queries/sets";
import { useDashboardSummaryQuery } from "@/lib/queries/dashboard";
import { getPref, type UnitPref } from "@/lib/prefs";
import { formatVolume } from "@/lib/units";

// MOTN-04 — animated Pressable so the draft-resume backdrop opacity can ride
// the §07 spring (Reanimated drives a `style` array containing a shared-value
// opacity). Created once at module scope (createAnimatedComponent must not run
// per-render).
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Forge token hexes (light / dark) ────────────────────────────────────────
// Mirror the tailwind.config forge.* token pairs verbatim (10-UI-SPEC §Color),
// for the inline-style optical containers + Icon strokes (the same split the
// edit/picker modals + ForgeButton use). Class-driven surfaces still use the
// token classes.
const TOKENS = {
  light: {
    text: "#0A0A0A",
    text2: "#4D4D4D",
    text3: "#8B8B8B",
    surface: "#FFFFFF",
    surface2: "#F2F1EC",
    accent: "#E14E10",
    accentText: "#FFFFFF",
    success: "#1E9E45",
    border: "rgba(0,0,0,0.07)",
    gradFrom: "#FF7A2E",
    gradTo: "#FF3D5E",
  },
  dark: {
    text: "#FFFFFF",
    text2: "rgba(255,255,255,0.62)",
    text3: "rgba(255,255,255,0.38)",
    surface: "#0E0E10",
    surface2: "#18181B",
    accent: "#FF5A1F",
    accentText: "#FFFFFF",
    success: "#30D158",
    border: "rgba(255,255,255,0.08)",
    gradFrom: "#FF7A2E",
    gradTo: "#FF2D55",
  },
} as const;

export default function PlansTab() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: plans, isPending } = usePlansQuery();
  const { colorScheme } = useColorScheme();
  const tk = TOKENS[colorScheme === "dark" ? "dark" : "light"];

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
  // UAT 2026-05-13 (3rd iteration): the overlay must ONLY surface a draft that
  // pre-dates this app launch ("cold-start recovery"). Capture the active
  // session id at the FIRST settled query result and store in STATE (a ref
  // update doesn't re-render, so the overlay would never appear). Once captured
  // the value is sticky for the mount: a later session change doesn't recapture.
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

  // Toast trigger: detect transition from active=non-null → active=null
  // (Avsluta-flow completes from EITHER this screen's secondary OR the
  // /workout/[sessionId] Avsluta-overlay). The previous-value ref captures the
  // prior render's activeSession so we only fire on the actual edge.
  const previousActiveRef = useRef<typeof activeSession | undefined>(undefined);
  useEffect(() => {
    const prev = previousActiveRef.current;
    previousActiveRef.current = activeSession;
    if (prev != null && activeSession == null) {
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [activeSession]);

  // Draft-resume body copy. 0-set vs N-set variants (UI-SPEC §lines 245-246).
  const setsCount = activeSets?.length ?? 0;
  const startedAt = activeSession?.started_at
    ? format(new Date(activeSession.started_at), "HH:mm")
    : "";
  const draftBody =
    setsCount > 0
      ? t("draftBodyWithSets", { time: startedAt, count: setsCount })
      : t("draftBodyNoSets", { time: startedAt });

  // Loading state (≤500ms typical due to AsyncStorage cache hydration).
  if (isPending) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        className="flex-1 bg-forge-bg-light dark:bg-forge-bg"
      >
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tk.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const isEmpty = !plans || plans.length === 0;

  return (
    <SafeAreaView
      edges={["bottom"]}
      className="flex-1 bg-forge-bg-light dark:bg-forge-bg"
    >
      {/* Header row — brand-mark tile (gradient, white Logo) + profile button.
          The barbell on plan cards is a CONTENT icon; the brand gradient is
          reserved for this 32×32 mark tile (UI-SPEC §Color brand-gradient). */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* Brand-mark tile — true 135° gradient (gradFrom → gradTo), matching
              FHome's `linear-gradient(135deg, …)` brand fill. RN Views can't
              render CSS gradients, so this uses expo-linear-gradient with a
              top-left → bottom-right vector (≈135°). */}
          <LinearGradient
            colors={[tk.gradFrom, tk.gradTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Logo size={20} variant="white" />
          </LinearGradient>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              letterSpacing: 1.5,
              color: tk.text2,
              textTransform: "uppercase",
            }}
          >
            FitnessMaxxing
          </Text>
        </View>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: tk.surface,
            borderWidth: 1,
            borderColor: tk.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="user" size={16} color={tk.text2} />
        </View>
      </View>

      {/* Page title */}
      <Text
        style={{
          fontSize: 36,
          fontWeight: "700",
          letterSpacing: -1.2,
          marginHorizontal: 20,
          marginTop: 12,
          marginBottom: 8,
          color: tk.text,
        }}
      >
        {t("myPlans")}
      </Text>

      {/* Phase 12 DASH-01/02/05 + D-02 — activity-ring hero ABOVE the plan list.
          D-02: while a session is live the hero slot swaps to the (already-Forge)
          ActiveSessionBanner; the ring + volume framing hide until the session
          ends. The plan list below is unchanged Phase-10 code. */}
      {activeSession ? <ActiveSessionBanner /> : <HomeHero />}

      {/* Section header — MINA PLANER + Ny plan inline accent link */}
      {!isEmpty ? (
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
            {t("myPlans")}
          </Text>
          <Pressable
            onPress={() => router.push("/plans/new" as Href)}
            accessibilityRole="button"
            accessibilityLabel={t("newPlan")}
            hitSlop={8}
            style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
          >
            <Text
              style={{ fontSize: 13, fontWeight: "600", color: tk.accent }}
            >
              {t("newPlan")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={plans ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 100,
          flexGrow: 1,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center gap-6 px-4">
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
            <View className="gap-2 items-center">
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "700",
                  letterSpacing: -0.5,
                  color: tk.text,
                }}
              >
                {t("noPlans")}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  color: tk.text2,
                  textAlign: "center",
                }}
              >
                {t("noPlansSub")}
              </Text>
            </View>
            {/* Use the proven ForgeButton primitive (Phase 8) — box decoration
                via className, so the accent fill actually renders. A hand-rolled
                Pressable that carries all box styling in an inline style()
                callback renders naked under NativeWind 4 (device UAT 2026-06-12). */}
            {/* Wrapper centers the button — ForgeButton is `self-start` by
                default (not fullWidth), which would otherwise left-align it
                inside the centered empty-state column. */}
            <View className="flex-row">
              <ForgeButton
                label={t("createPlan")}
                icon="arrowRight"
                iconPosition="trailing"
                size="lg"
                onPress={() => router.push("/plans/new" as Href)}
              />
            </View>
          </View>
        }
        renderItem={({ item: plan, index }) => {
          const featured = index === 0;
          return (
            <Pressable
              onPress={() => router.push(`/plans/${plan.id}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={`${t("myPlans")}: ${plan.name}`}
              // Box decoration via className (NativeWind renders it); the style()
              // callback carries ONLY the pressed-opacity overlay. Putting the
              // surface/border/radius in the inline style() callback renders the
              // card naked under NativeWind 4 (device UAT 2026-06-12).
              className="flex-row items-center gap-3.5 py-4 px-[18px] rounded-[18px] border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border"
              style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
            >
              {/* Icon tile — featured (i===0) = brand-gradient barbell; others
                  = surface2 content tile. Barbell is a content icon (UI-SPEC).
                  The featured tile uses the same 135° gradient as the brand mark
                  (FHome line 179), not a flat orange. */}
              {featured ? (
                <LinearGradient
                  colors={[tk.gradFrom, tk.gradTo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <Icon name="barbell" size={20} color="#FFFFFF" strokeWidth={2} />
                </LinearGradient>
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    backgroundColor: tk.surface2,
                    borderWidth: 1,
                    borderColor: tk.border,
                  }}
                >
                  <Icon name="barbell" size={20} color={tk.text2} strokeWidth={2} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 17,
                    fontWeight: "600",
                    letterSpacing: -0.3,
                    color: tk.text,
                  }}
                >
                  {plan.name}
                </Text>
                {plan.description ? (
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 13, color: tk.text2, marginTop: 2 }}
                  >
                    {plan.description}
                  </Text>
                ) : null}
              </View>
              <Icon name="chevronRight" size={18} color={tk.text3} />
            </Pressable>
          );
        }}
      />

      {/* Floating "+" FAB — hidden when empty (the empty-state CTA stands in). */}
      {!isEmpty ? (
        <Pressable
          onPress={() => router.push("/plans/new" as Href)}
          accessibilityRole="button"
          accessibilityLabel={t("newPlan")}
          // Box decoration (position/size/radius/accent fill) via className so it
          // renders; the style() callback keeps only the accent shadow + pressed
          // overlay (the ForgeButton FIT-66 pattern).
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center bg-forge-accent-light dark:bg-forge-accent"
          style={({ pressed }) => [
            {
              shadowColor: "#FF5A1F",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.45,
              shadowRadius: 16,
            },
            pressed ? { opacity: 0.85 } : null,
          ]}
        >
          <Icon name="plus" size={26} color={tk.accentText} strokeWidth={2.4} />
        </Pressable>
      ) : null}

      {/* Phase 5 D-21 — Draft-resume overlay (inline-overlay pattern, NOT a
          Modal portal). DraftResumeOverlay takes sessionId as a required prop
          so useFinishSession scope.id is a stable static string (Pitfall 3). */}
      {activeSession && shouldShowDraftOverlay ? (
        <DraftResumeOverlay
          sessionId={activeSession.id}
          bodyText={draftBody}
          planName={activeSession.plan_name_snapshot ?? null}
          setsCount={setsCount}
          startedAt={startedAt}
          onResume={() => {
            setDismissedForSessionId(activeSession.id);
            router.push(`/workout/${activeSession.id}` as Href);
          }}
          onDismiss={() => setDismissedForSessionId(activeSession.id)}
        />
      ) : null}

      {/* Phase 5 D-24 / SKIN-05 — "Passet sparat ✓" success toast, re-skinned to
          FSavedToast (forge-screens.jsx L1933+): a forge-success pill with a
          white check inside a translucent white circle, bottom-centered above
          the tab bar (bottom:92 clears the floating TabBar — UAT-tuned, kept).
          Box styling (success bg + pill radius) in className per the NativeWind
          rule; inline style carries ONLY position + the success glow shadow.
          Edge-trigger logic (previousActiveRef watcher + 2s timer) is unchanged
          — chrome re-skin only. FadeIn/FadeOut kept (inline, no Modal). */}
      {showToast ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="absolute self-center flex-row items-center gap-2.5 px-[18px] py-3 rounded-full bg-forge-success-light dark:bg-forge-success"
          style={{
            bottom: 92,
            shadowColor: tk.success,
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.4,
            shadowRadius: 32,
          }}
        >
          <View
            className="w-[22px] h-[22px] rounded-full items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.22)" }}
          >
            <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} />
          </View>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              letterSpacing: -0.2,
              color: "#FFFFFF",
            }}
          >
            {t("sessionSaved")}
          </Text>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// DraftResumeOverlay — extracted subcomponent (WR-04 from 05-REVIEW.md).
// Takes sessionId as a REQUIRED prop so useFinishSession's scope.id is a
// stable static string for the lifetime of the mount (Pitfall 3). Re-skinned
// to Forge tokens; force-decision UX (backdrop does not dismiss) preserved.
// ---------------------------------------------------------------------------
function DraftResumeOverlay({
  sessionId,
  bodyText,
  planName,
  setsCount,
  startedAt,
  onResume,
  onDismiss,
}: {
  sessionId: string;
  bodyText: string;
  planName: string | null;
  setsCount: number;
  startedAt: string;
  onResume: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const tk = TOKENS[colorScheme === "dark" ? "dark" : "light"];
  const finishSession = useFinishSession(sessionId);

  // MOTN-04 / D-11 — §07 overlay spring (damping 18 / stiffness 220, ~240ms):
  // backdrop opacity 0→0.55 + card translateY 24→0. Inline-rendered (no Modal
  // portal — D-15). `progress` drives both; multiply for the backdrop alpha and
  // interpolate (24→0) for the card lift. Purely presentational, never gates the
  // force-decision logic below.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withSpring(1, { damping: 18, stiffness: 220 });
  }, [progress]);
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: 24 * (1 - progress.value) }],
  }));

  const handleAvslutaSession = () => {
    // .mutate (NOT mutateAsync) — paused mutations under offlineFirst never
    // resolve mutateAsync (Phase 4 commit 5d953b6 UAT). The optimistic onMutate
    // clears sessionsKeys.active() so the banner + overlay unmount immediately;
    // the toast then fires via the parent's transition watcher.
    finishSession.mutate(
      { id: sessionId, finished_at: new Date().toISOString() },
      { onError: () => {} },
    );
    onDismiss();
  };

  return (
    <Animated.View
      className="absolute inset-0"
      accessibilityElementsHidden={false}
    >
      {/* Backdrop — absorbs taps but does NOT dismiss (force-decision UX, the
          orphaned draft MUST be resolved). NO onPress, intentionally. */}
      <AnimatedPressable
        className="absolute inset-0"
        style={[{ backgroundColor: "rgba(0,0,0,0.55)" }, backdropStyle]}
      />
      <Animated.View
        onStartShouldSetResponder={() => true}
        // Box styling (bg/border/radius/padding) in className — NativeWind 4
        // renders it; the inline style() carries ONLY the spring transform +
        // shadow (the Phase 10 naked-re-skin rule).
        className="absolute left-4 right-4 rounded-forge-lg border p-6 bg-forge-surface-light dark:bg-forge-surface2 border-forge-borderStrong-light dark:border-forge-borderStrong"
        style={[
          {
            top: "30%",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 30 },
            shadowOpacity: 0.4,
            shadowRadius: 60,
          },
          cardStyle,
        ]}
      >
        {/* Pulsing-dot icon block (FDraftResumeOverlay L1850-1865) — accentSoft
            tile, glowing accent core dot + a faint accent ring. */}
        <View
          className="w-[52px] h-[52px] rounded-forge-md items-center justify-center mb-4 bg-forge-accentSoft-light dark:bg-forge-accentSoft border-[1.5px] border-forge-accent-light dark:border-forge-accent"
        >
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: tk.accent,
              shadowColor: tk.accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.9,
              shadowRadius: 8,
            }}
          />
          <View
            style={{
              position: "absolute",
              width: 26,
              height: 26,
              borderRadius: 13,
              borderWidth: 2,
              borderColor: tk.accent,
              opacity: 0.35,
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 26,
              fontWeight: "700",
              letterSpacing: -0.8,
              color: tk.text,
            }}
          >
            {t("resumeSession")}
          </Text>
          <Text style={{ fontSize: 15, color: tk.text2, lineHeight: 21 }}>
            {bodyText}
          </Text>
        </View>

        {/* Meta strip (FDraftResumeOverlay L1876-1901) — clock icon + plan name
            + "{time} · {N} set" + a "Live" pill. Rendered from the user's own
            already-authorized draft data (no new fetch — T-11-09 accept). */}
        <View
          className="flex-row items-center gap-3 my-5 px-3.5 py-3 rounded-forge-sm border bg-forge-bg-light dark:bg-forge-bg border-forge-border-light dark:border-forge-border"
        >
          <Icon name="clock" size={16} color={tk.text2} />
          <View style={{ flex: 1, minWidth: 0 }}>
            {planName ? (
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  letterSpacing: -0.1,
                  color: tk.text,
                }}
              >
                {planName}
              </Text>
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                color: tk.text3,
                marginTop: planName ? 1 : 0,
                fontVariant: ["tabular-nums"],
              }}
            >
              {startedAt ? `${startedAt} · ` : ""}
              {setsCount} {t("sets")}
            </Text>
          </View>
          <View
            className="flex-row items-center gap-1 px-2 py-1 rounded-[6px] bg-forge-accent-light dark:bg-forge-accent"
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: tk.accentText,
              }}
            >
              Live
            </Text>
          </View>
        </View>

        {/* Buttons (FDraftResumeOverlay L1903-1923) — primary accent "Återuppta"
            (play icon) ABOVE a DANGER GHOST "Avsluta sessionen" (D-16: the one
            place red is correct — closing an orphaned draft is data-loss-
            adjacent). ForgeButton variants carry box styling via className. */}
        <View style={{ gap: 10 }}>
          <ForgeButton
            label={t("resume")}
            icon="play"
            variant="primary"
            size="lg"
            fullWidth
            onPress={onResume}
          />
          <ForgeButton
            label={t("finishSession")}
            variant="destructive"
            size="lg"
            fullWidth
            onPress={handleAvslutaSession}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// HomeHero — Phase 12 DASH-01/02/05, MOTN-02, D-01/D-03/D-04/D-07/D-18/D-20.
//
// The Forge activity-ring hero (forge-screens.jsx FHome 125-158): an animated
// 104px ProgressRing (sessions-this-week / weekly_goal, accent + brand-gradient
// fill — D-01) on the left, and a label column on the right (uppercase eyebrow
// + big "N / goal" numeral + a chip row: weeks-streak ForgeChip with a flame
// icon + this-week-volume ForgeChip).
//
// Offline-first (D-03): useDashboardSummaryQuery inherits offlineFirst, so the
// persister hydrates this slot at cold-start for free. The skeleton shows ONLY
// on a truly-empty cache (isPending && data === undefined); a cached value
// renders instantly offline. An all-zero row is the new-user state (D-04), NOT
// "loading" — it renders the zeroed hero + an accent "Logga ditt första pass"
// nudge.
//
// Streak relabel (D-07): the chip says "{N} veckor streak" — t('weeks')/t('week')
// (singular at N=1), NEVER t('days'). Volume routes through formatVolume with the
// fm:units pref (D-20) — no raw kg literal. Numerals render tabular-nums.
//
// Box decoration (surface bg + border) lives in className per the NativeWind 4
// naked-render rule; off-scale optical numbers (radius 24, padding 20, 16px
// side margin — FHome 127-129) ride the static-View inline style object, the
// same idiom the header/empty-state tiles in this file already use.
// ---------------------------------------------------------------------------
function HomeHero() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const tk = TOKENS[colorScheme === "dark" ? "dark" : "light"];
  const { data, isPending } = useDashboardSummaryQuery();

  // D-20 — fm:units pref read via the settings.tsx useState+getPref idiom (no
  // raw kg literal; metric default until the async read settles).
  const [unit, setUnit] = useState<UnitPref>("metric");
  useEffect(() => {
    let mounted = true;
    void getPref("fm:units").then((u) => {
      if (mounted) setUnit(u);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // D-03 skeleton gate: ONLY on a truly-empty cache (first load, nothing
  // hydrated). A cached value — even an all-zero new-user row — renders.
  if (isPending && data === undefined) {
    return <HeroSkeleton tk={tk} />;
  }

  const sessions = data?.sessions_this_week ?? 0;
  const goal = data?.weekly_goal ?? 0;
  const streakWeeks = data?.streak_weeks ?? 0;
  const volumeKg = data?.volume_this_week_kg ?? 0;

  // D-04 — a brand-new account (0 finished sessions ever) is the zeroed-hero
  // state. lifetime_sessions distinguishes "never logged" from "0 this week but
  // active before"; either way the ring zeroes, but the nudge only shows for a
  // genuinely new user so a returning user mid-week isn't told to "log their
  // first workout".
  const isNewUser = (data?.lifetime_sessions ?? 0) === 0;

  // Ring fill fraction (D-18 overflow handled inside ProgressRing when > 1).
  const fill = goal > 0 ? sessions / goal : 0;

  // D-07 streak relabel — weeks, singular at N=1; NEVER days.
  const streakUnit = streakWeeks === 1 ? t("week") : t("weeks");

  return (
    <View
      // Box decoration (surface bg + border) via className (NativeWind 4 renders
      // it); optical radius/padding/margin via the static-View inline style.
      className="bg-forge-surface-light dark:bg-forge-surface border border-forge-border-light dark:border-forge-border"
      style={{
        marginHorizontal: 16,
        marginTop: 4,
        marginBottom: 20,
        borderRadius: 24,
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 18,
      }}
    >
      {/* Left — animated 104px ring (stroke 11), accent sweep + brand gradient
          (D-01). Center overlay ALWAYS shows the real count (D-19 inside the
          ring); we mirror "N" over "/ goal" per FHome 137-140. */}
      <ProgressRing
        size={104}
        stroke={11}
        value={fill}
        color={tk.accent}
        gradient={[tk.gradFrom, tk.gradTo]}
      >
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              letterSpacing: -0.5,
              color: tk.text,
              fontVariant: ["tabular-nums"],
            }}
          >
            {sessions}
          </Text>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "600",
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: tk.text3,
              fontVariant: ["tabular-nums"],
            }}
          >
            / {goal}
          </Text>
        </View>
      </ProgressRing>

      {/* Right — eyebrow + big "N / goal" numeral + chip row. */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 1,
            color: tk.text3,
            textTransform: "uppercase",
          }}
        >
          {t("weekSessions")}
        </Text>
        <Text
          style={{
            fontSize: 30,
            fontWeight: "700",
            letterSpacing: -1,
            color: tk.text,
            marginTop: 4,
            fontVariant: ["tabular-nums"],
          }}
        >
          {sessions}{" "}
          <Text style={{ color: tk.text3, fontSize: 18, fontWeight: "500" }}>
            / {goal}
          </Text>
        </Text>

        {isNewUser ? (
          // D-04 — zeroed-hero new-user nudge (accent CTA, UI-SPEC Color item 6).
          <View style={{ flexDirection: "row", marginTop: 12 }}>
            <ForgeButton
              label={t("logFirstWorkout")}
              icon="arrowRight"
              iconPosition="trailing"
              size="sm"
              // WR-03: route to plan creation — the same destination as the
              // plan-list empty-state CTA + "Ny plan" link + FAB in this file.
              // A brand-new user has no plan to start a workout from yet, so the
              // first step is creating one (matches the empty-state "Skapa plan"
              // flow). Was a no-op `() => {}`.
              onPress={() => router.push("/plans/new" as Href)}
            />
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            {/* Weeks-streak chip (D-07 — flame icon + weeks/week, NOT days). */}
            <ForgeChip icon="flame">
              <Text style={{ fontVariant: ["tabular-nums"] }}>{streakWeeks}</Text>
              {` ${streakUnit} ${t("streak")}`}
            </ForgeChip>
            {/* This-week-volume chip (D-20 — formatVolume w/ the fm:units pref). */}
            <ForgeChip>
              <Text style={{ fontVariant: ["tabular-nums"] }}>
                {formatVolume(volumeKg, unit)}
              </Text>
            </ForgeChip>
          </View>
        )}
      </View>
    </View>
  );
}

// HeroSkeleton — D-03 empty-cache placeholder. A neutral surface card matching
// the hero's footprint (radius 24 / padding 20 / 16px margin) with a muted ring
// stand-in + label bars, so the first cold load doesn't flash empty. Box bg/
// border via className; optical numbers inline (static View, NativeWind-safe).
function HeroSkeleton({
  tk,
}: {
  tk: (typeof TOKENS)["light"] | (typeof TOKENS)["dark"];
}) {
  return (
    <View
      className="bg-forge-surface-light dark:bg-forge-surface border border-forge-border-light dark:border-forge-border"
      style={{
        marginHorizontal: 16,
        marginTop: 4,
        marginBottom: 20,
        borderRadius: 24,
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 18,
      }}
    >
      <View
        style={{
          width: 104,
          height: 104,
          borderRadius: 52,
          borderWidth: 11,
          borderColor: tk.surface2,
        }}
      />
      <View style={{ flex: 1, gap: 10 }}>
        <View
          style={{
            height: 12,
            width: "55%",
            borderRadius: 6,
            backgroundColor: tk.surface2,
          }}
        />
        <View
          style={{
            height: 28,
            width: "40%",
            borderRadius: 8,
            backgroundColor: tk.surface2,
          }}
        />
        <View
          style={{
            height: 22,
            width: "70%",
            borderRadius: 8,
            backgroundColor: tk.surface2,
          }}
        />
      </View>
    </View>
  );
}
