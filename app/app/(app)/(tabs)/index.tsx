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
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Icon, Logo } from "@/components/ui";
import { usePlansQuery } from "@/lib/queries/plans";
import {
  useActiveSessionQuery,
  useFinishSession,
} from "@/lib/queries/sessions";
import { useSetsForSessionQuery } from "@/lib/queries/sets";

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
      ? `Du har ett pågående pass från ${startedAt} med ${setsCount} set sparade.`
      : `Du startade ett pass ${startedAt} men har inte loggat något set än.`;

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
            <Pressable
              onPress={() => router.push("/plans/new" as Href)}
              accessibilityRole="button"
              accessibilityLabel={t("createPlan")}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  height: 56,
                  paddingHorizontal: 24,
                  borderRadius: 16,
                  backgroundColor: tk.accent,
                },
                pressed ? { opacity: 0.85 } : null,
              ]}
            >
              <Text
                style={{
                  fontSize: 16,
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
        }
        renderItem={({ item: plan, index }) => {
          const featured = index === 0;
          return (
            <Pressable
              onPress={() => router.push(`/plans/${plan.id}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={`${t("myPlans")}: ${plan.name}`}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  paddingVertical: 16,
                  paddingHorizontal: 18,
                  borderRadius: 18,
                  backgroundColor: tk.surface,
                  borderWidth: 1,
                  borderColor: tk.border,
                },
                pressed ? { opacity: 0.85 } : null,
              ]}
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
          style={({ pressed }) => [
            {
              position: "absolute",
              bottom: 24,
              right: 24,
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: tk.accent,
              alignItems: "center",
              justifyContent: "center",
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
          onResume={() => {
            setDismissedForSessionId(activeSession.id);
            router.push(`/workout/${activeSession.id}` as Href);
          }}
          onDismiss={() => setDismissedForSessionId(activeSession.id)}
        />
      ) : null}

      {/* Phase 5 D-24 — "Passet sparat ✓" success toast. */}
      {showToast ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{
            position: "absolute",
            bottom: 92,
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 24,
            backgroundColor: tk.surface,
            borderWidth: 1,
            borderColor: tk.border,
          }}
        >
          <Icon name="check" size={16} color={tk.accent} strokeWidth={2.4} />
          <Text
            style={{ fontSize: 15, fontWeight: "600", color: tk.text }}
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
  onResume,
  onDismiss,
}: {
  sessionId: string;
  bodyText: string;
  onResume: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const tk = TOKENS[colorScheme === "dark" ? "dark" : "light"];
  const finishSession = useFinishSession(sessionId);

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
    <Pressable
      className="absolute inset-0"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      accessibilityElementsHidden={false}
      // Intentionally NO onPress — backdrop absorbs taps but does not dismiss;
      // force-decision UX per UI-SPEC.
    >
      <View
        onStartShouldSetResponder={() => true}
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: "40%",
          backgroundColor: tk.surface,
          borderWidth: 1,
          borderColor: tk.border,
          borderRadius: 20,
          padding: 24,
          gap: 24,
        }}
      >
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              letterSpacing: -0.5,
              color: tk.text,
            }}
          >
            {t("resumeSession")}
          </Text>
          <Text style={{ fontSize: 15, color: tk.text2, lineHeight: 21 }}>
            {bodyText}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={handleAvslutaSession}
            accessibilityRole="button"
            accessibilityLabel={t("finishSession")}
            style={({ pressed }) => [
              {
                flex: 1,
                height: 52,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tk.surface2,
                borderWidth: 1,
                borderColor: tk.border,
              },
              pressed ? { opacity: 0.85 } : null,
            ]}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: tk.text,
                letterSpacing: -0.2,
              }}
            >
              {t("finishSession")}
            </Text>
          </Pressable>
          <Pressable
            onPress={onResume}
            accessibilityRole="button"
            accessibilityLabel={t("resume")}
            style={({ pressed }) => [
              {
                flex: 1,
                height: 52,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tk.accent,
              },
              pressed ? { opacity: 0.85 } : null,
            ]}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: tk.accentText,
                letterSpacing: -0.2,
              }}
            >
              {t("resume")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
