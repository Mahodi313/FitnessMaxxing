// app/components/active-session-banner.tsx
//
// Phase 5 D-22: persistent banner indicating an active workout session.
// Visible across all (tabs) when useActiveSessionQuery returns non-null AND
// the user is NOT inside /workout/[sessionId] (route-check via useSegments).
// Tap routes to the active workout. NO close affordance (UI-SPEC line 287 —
// dismissing would hide the affordance to return to the in-progress session).
//
// Color role: Info-blue (UI-SPEC §Color line 133) — distinct from yellow
// OfflineBanner (warning) and accent-blue CTAs (primary actions). When both
// banners visible (offline mid-pass): OfflineBanner stacks above this one.
// Real-device-verification convention from Phase 4 commit cfc1dc8 applies —
// if light-mode bg-blue-100 reads as near-white on physical iPhone, bump to
// bg-blue-200 + border-blue-400 per the UAT-color-amendment convention and
// document in 05-03-SUMMARY.md.
//
// A11y: full-row Pressable with accessibilityRole="button",
// accessibilityLabel="Återgå till pågående pass", and
// accessibilityLiveRegion="polite" on the inner label so VoiceOver announces
// on mount.
//
// References:
//   - 05-CONTEXT.md D-22
//   - 05-UI-SPEC.md §Color line 133 (info-blue role) + §lines 281-287 (copy + a11y)
//   - 05-PATTERNS.md §active-session-banner.tsx

import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useColorScheme } from "nativewind";
import { useRouter, useSegments, type Href } from "expo-router";
import { useTranslation } from "react-i18next";

import { Icon } from "@/components/ui";
import { useActiveSessionQuery } from "@/lib/queries/sessions";
import { useSetsForSessionQuery } from "@/lib/queries/sets";
import { usePlanExercisesQuery } from "@/lib/queries/plan-exercises";

// mm:ss (or h:mm:ss past an hour) elapsed since `startedAt`.
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function ActiveSessionBanner() {
  const router = useRouter();
  const segments = useSegments();
  const { t } = useTranslation();
  const { data: activeSession } = useActiveSessionQuery();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  // Forge re-skin (Phase 10 device UAT 2026-06-12 — design spec §04): the banner
  // carries the single orange accent (accentSoft tint + live dot + accent
  // chevron), a live elapsed timer, the plan name, and exercise progress,
  // replacing the old V1 info-blue "Pågående pass / Tryck för att återgå".
  const accentColor = isDark ? "#FF5A1F" : "#E14E10";

  // Live elapsed timer — tick every second from started_at.
  const startedAt = activeSession?.started_at;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  // Progress: distinct exercises with ≥1 logged set / total plan exercises.
  // Both queries are gated (enabled: !!id) so they no-op without an active
  // session/plan; "" disables them on the null-session render.
  const { data: sets } = useSetsForSessionQuery(activeSession?.id ?? "");
  const { data: planExercises } = usePlanExercisesQuery(
    activeSession?.plan_id ?? "",
  );

  // Hide-on-workout-route logic (UI-SPEC §line 509): don't double-stack with
  // workout-screen header. The active workout screen already has its own
  // Avsluta header action; banner duplication wastes vertical space.
  // segments returns typed-route literals; expo-router's generated union for
  // the (tabs) scope does not include "workout" (it lives at the (app) layout
  // level), so we widen to string for the comparison. Runtime check is correct.
  const onWorkoutRoute = (segments as readonly string[]).some((s) => s === "workout");
  if (!activeSession || onWorkoutRoute) return null;

  const timer = startedAt
    ? formatElapsed(now - new Date(startedAt).getTime())
    : null;
  const title = timer
    ? `${t("activeSessionTitle")} · ${timer}`
    : t("activeSessionTitle");

  const total = planExercises?.length ?? 0;
  const done = sets ? new Set(sets.map((s) => s.exercise_id)).size : 0;
  const planName = activeSession.plan_name_snapshot ?? null;

  // Subtitle: plan name · done/total exercises · tap-to-return (each segment
  // null-safe so a plan-less or freshly-started session degrades gracefully).
  const subtitle = [
    planName,
    total > 0 ? `${Math.min(done, total)}/${total} ${t("exercises")}` : null,
    t("activeSessionTap"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={() => router.push(`/workout/${activeSession.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={t("activeSessionReturn")}
      className="flex-row items-center justify-between gap-2 mx-4 mt-2 px-4 py-3 rounded-forge-md border bg-forge-accentSoft-light dark:bg-forge-accentSoft border-forge-border-light dark:border-forge-border active:opacity-80"
    >
      <View className="flex-row items-center gap-3 flex-1">
        {/* Live dot */}
        <View className="w-2 h-2 rounded-full bg-forge-accent-light dark:bg-forge-accent" />
        <View className="flex-1">
          <Text
            className="text-[15px] font-semibold text-forge-accent-light dark:text-forge-accent"
            style={{ fontVariant: ["tabular-nums"] }}
            numberOfLines={1}
            accessibilityLiveRegion="polite"
          >
            {title}
          </Text>
          <Text
            className="text-[13px] text-forge-text2-light dark:text-forge-text2"
            style={{ fontVariant: ["tabular-nums"] }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      <Icon name="chevronRight" size={18} color={accentColor} strokeWidth={2.2} />
    </Pressable>
  );
}
