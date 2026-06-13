// app/app/(app)/(tabs)/history.tsx
//
// Phase 12 Plan 12-06 (SKIN-06 + DASH-03/DASH-04): Forge re-skin of the
// Historik tab → FHistory (forge-screens.jsx 550-642). Three additions ABOVE
// the preserved infinite list, all fed by useDashboardSummaryQuery():
//
//   1. Lifetime eyebrow (D-09) — "{N} pass · {H} timmar" (uppercase micro).
//   2. Weekly-volume overview card (D-05 — THIS is how DASH-03/DASH-04 are
//      satisfied, on History, NOT Home): "Veckans volym" eyebrow + big volume
//      numeral (formatVolume w/ the fm:units pref) + a forge-success delta chip
//      ("+{N}%" vs prior week, up-arrow icon) + an animated Sparkline fed the
//      weekly_volume_series mapped through toDisplayVolume (accent stroke).
//   3. Forge session rows (D-16) — surface card radius 16, gap 14: a 44px
//      surface2 date-badge (DD over MON) + plan name + meta "X set · Y kg ·
//      Z min" + a trailing chevronRight. The PR trophy is OMITTED (D-13).
//
// The original v1 list plumbing is preserved VERBATIM (only the chrome is
// re-skinned):
//   - InfiniteQuery memo `data?.pages.flat()` (referentially-stable FlatList
//     data prop).
//   - onEndReached guard `hasNextPage && !isFetchingNextPage` (Pitfall 3 —
//     infinite-refetch loop guard).
//   - RefreshControl pull-to-refresh.
//   - Post-delete toast read-and-clear (params.toast === "deleted" → 2.2s timer
//     → router.setParams clear) + the unmount cleanup ref (WR-02).
//   - Plan-name fallback (session.plan_name ?? t('noPlan')).
//
// Units (D-20): every kg/volume figure routes through formatVolume — no raw
// `kg` string literal in the rendered output. The fm:units pref is read via the
// settings.tsx useState+getPref idiom (metric default until the async read
// settles).
//
// i18n (D-21): all chrome strings are t()-keyed (live re-render on toggle); user
// content (plan name) renders verbatim (D-16). All keys already exist at sv/en
// parity from Plan 12-02.
//
// Skia color rule (UI-SPEC §Color): NativeWind dark: classes do NOT apply inside
// a Skia canvas, so the Sparkline takes a theme-derived accent hex from TOKENS
// (the same split index.tsx uses), not a className.
//
// NativeWind 4 (Phase 10 naked-render rule): box decoration (surface bg + border)
// lives in className; off-scale optical numbers (radius 16/20, padding, 44px
// badge) ride the inline style object on a static View — the idiom index.tsx /
// session-detail already use.
//
// F13 isolation (D-24): a read-only re-skin — no mutation defaults, query keys,
// persister scope, or exercise_sets logging is touched. Task 2 gates it.
//
// References:
//   - 12-06-PLAN.md Task 1 + acceptance criteria
//   - 12-UI-SPEC.md §07 (Layout Contract → History list) + Copywriting + Color
//   - 12-PATTERNS.md §history.tsx + §index.tsx (TOKENS / composition idiom)
//   - app/design v2/Sources/design/forge-screens.jsx FHistory 550-642 (OMIT
//     row trophy 627-635 per D-13)
//   - app/lib/queries/dashboard.ts (useDashboardSummaryQuery) + app/lib/units.ts

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useColorScheme } from "nativewind";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { sv, enUS } from "date-fns/locale";
import {
  useSessionsListInfiniteQuery,
  type SessionSummary,
} from "@/lib/queries/sessions";
import { useDashboardSummaryQuery } from "@/lib/queries/dashboard";
import { Icon, Sparkline } from "@/components/ui";
import { getPref, type UnitPref } from "@/lib/prefs";
import { formatVolume, toDisplayVolume } from "@/lib/units";

// ── Forge token hexes (light / dark) ────────────────────────────────────────
// Mirror the tailwind.config forge.* token pairs verbatim (UI-SPEC §Color), for
// the inline-style optical containers + the Skia Sparkline stroke (the same
// split index.tsx / session-detail use). Class-driven surfaces still use the
// token classes.
const TOKENS = {
  light: {
    text: "#0A0A0A",
    text2: "#4D4D4D",
    text3: "#8B8B8B",
    surface: "#FFFFFF",
    surface2: "#F2F1EC",
    surface3: "#E8E7E1",
    accent: "#E14E10",
    success: "#1E9E45",
    successSoft: "rgba(30,158,69,0.12)",
    border: "rgba(0,0,0,0.07)",
  },
  dark: {
    text: "#FFFFFF",
    text2: "rgba(255,255,255,0.62)",
    text3: "rgba(255,255,255,0.38)",
    surface: "#0E0E10",
    surface2: "#18181B",
    surface3: "#222226",
    accent: "#FF5A1F",
    success: "#30D158",
    successSoft: "rgba(48,209,88,0.15)",
    border: "rgba(255,255,255,0.08)",
  },
} as const;

// Shared fm:units read — the settings.tsx useState+getPref idiom (D-20). Metric
// default until the async read settles; no raw kg literal anywhere downstream.
function useUnitPref(): UnitPref {
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
  return unit;
}

export default function HistoryTab() {
  const { colorScheme } = useColorScheme();
  const tk = TOKENS[colorScheme === "dark" ? "dark" : "light"];
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const unit = useUnitPref();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
    refetch,
    status,
  } = useSessionsListInfiniteQuery();

  // WR-01: post-delete toast surfaces here, not on the detail screen.
  // history/[sessionId].tsx fires router.replace with `?toast=deleted`
  // after a successful delete; we read the param on mount, show the toast
  // for 2.2s, then clear the param via router.setParams so a re-mount
  // (e.g. tab-switch back to Historik) does not re-show it.
  //
  // WR-02: the dismiss timer id is held in a ref and cleared on unmount
  // (or before reassigning) so the timer cannot fire after the screen
  // tears down — React would otherwise log "Can't perform a React state
  // update on an unmounted component" if the tab is replaced or the app
  // is signed-out inside the 2.2s window.
  const params = useLocalSearchParams<{ toast?: string }>();
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (params.toast === "deleted") {
      setShowToast(true);
      // Clear the URL param immediately so navigating back into the tab
      // does not re-fire the toast.
      router.setParams({ toast: undefined });
      // Clear any in-flight timer before scheduling a fresh one (rare
      // case: two delete flows queue before the first toast finishes).
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setShowToast(false);
        toastTimerRef.current = null;
      }, 2200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toast]);
  // Cleanup the dismiss timer on unmount so a teardown mid-2.2s window
  // cannot fire setShowToast on a torn-down fiber.
  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    [],
  );

  // Flatten the InfiniteQuery `{ pages, pageParams }` envelope. Memo keyed on
  // `data?.pages` so the FlatList data prop stays referentially stable
  // between renders when no new page has arrived.
  const sessions = useMemo(() => data?.pages.flat() ?? [], [data?.pages]);
  const isEmpty = sessions.length === 0;

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-forge-bg-light dark:bg-forge-bg"
    >
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{
          paddingBottom: 100,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          // Lifetime eyebrow (D-09) + screen title + weekly-volume card (D-05).
          // Hidden entirely on the empty (no-sessions-ever) state so the
          // empty-state column owns the full screen.
          isEmpty && status !== "pending" ? null : (
            <HistoryHeader tk={tk} unit={unit} />
          )
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        onEndReached={() => {
          // Pitfall 3 — guard against infinite refetch loop once last page
          // renders. hasNextPage flips false when getNextPageParam returns
          // undefined (lastPage.length < PAGE_SIZE).
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color={tk.accent} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={tk.accent}
          />
        }
        ListEmptyComponent={
          status === "pending" ? null : <HistoryEmptyState tk={tk} />
        }
        renderItem={({ item }) => (
          <View className="px-4">
            <HistoryListRow session={item} tk={tk} unit={unit} lang={i18n.language} />
          </View>
        )}
      />

      {/* Post-delete toast (UI-SPEC §Post-delete toast) — Reanimated
          FadeIn/FadeOut on Animated.View; neutral surface pill (delete is
          neutral, not celebratory; success-green is reserved for "Passet
          sparat ✓"). Surfaced here, not on the detail screen, because
          router.replace synchronously blurs the detail screen and a toast
          mounted there would never be visible (WR-01 in 06-REVIEW.md). Box
          styling in className; inline style carries only position + shadow. */}
      {showToast && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(300)}
          className="absolute self-center flex-row items-center px-6 py-3 rounded-full border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border"
          style={{
            bottom: 92,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
          }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              letterSpacing: -0.2,
              color: tk.text,
            }}
          >
            {t("sessionDeleted")}
          </Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// HistoryHeader — lifetime eyebrow (D-09) + screen title + weekly-volume
// overview card (D-05 → DASH-03/DASH-04). All three fed by
// useDashboardSummaryQuery(); rendered as the FlatList ListHeaderComponent so
// it scrolls with the list and inherits pull-to-refresh.
// ---------------------------------------------------------------------------
function HistoryHeader({
  tk,
  unit,
}: {
  tk: (typeof TOKENS)["light"] | (typeof TOKENS)["dark"];
  unit: UnitPref;
}) {
  const { t } = useTranslation();
  const { data } = useDashboardSummaryQuery();

  const lifetimeSessions = data?.lifetime_sessions ?? 0;
  const lifetimeHours = data?.lifetime_hours ?? 0;
  const volumeThisWeek = data?.volume_this_week_kg ?? 0;
  const volumePriorWeek = data?.volume_prior_week_kg ?? 0;
  const series = data?.weekly_volume_series ?? [];

  // Delta % vs prior week (D-05). Guard prior===0 (no baseline → no chip).
  const hasDelta = volumePriorWeek > 0;
  const deltaPct = hasDelta
    ? Math.round(((volumeThisWeek - volumePriorWeek) / volumePriorWeek) * 100)
    : 0;

  // Sparkline series → display-unit values (D-20). Skia takes a plain number[].
  const sparkData = series.map((p) => toDisplayVolume(p.volume_kg, unit));

  // Volume-card empty copy — a brand-new user with no finished sessions yet has
  // no trend to show (D-05 empty state).
  const hasVolumeData = lifetimeSessions > 0 && sparkData.length >= 2;

  return (
    <View>
      {/* Lifetime eyebrow (D-09) — uppercase micro-label "{N} pass · {H} timmar". */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: tk.text3,
            fontVariant: ["tabular-nums"],
          }}
        >
          {t("lifetimeEyebrow", {
            n: lifetimeSessions,
            h: Math.round(lifetimeHours),
          })}
        </Text>
      </View>

      {/* Screen title — display 36px (FHistory 560). */}
      <Text
        style={{
          fontSize: 36,
          fontWeight: "700",
          letterSpacing: -1.2,
          marginHorizontal: 20,
          marginTop: 4,
          marginBottom: 16,
          color: tk.text,
        }}
      >
        {t("historyTitle")}
      </Text>

      {/* Volume-overview card (D-05 → DASH-03/DASH-04). Box bg/border via
          className; optical radius/padding via inline style (NativeWind rule). */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
        <View
          className="bg-forge-surface-light dark:bg-forge-surface border border-forge-border-light dark:border-forge-border"
          style={{ borderRadius: 20, padding: 20, paddingTop: 18 }}
        >
          {hasVolumeData ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  {/* Card eyebrow */}
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: tk.text3,
                    }}
                  >
                    {t("thisWeekVolume")}
                  </Text>
                  {/* Big volume numeral (D-20 — formatVolume, no raw kg literal). */}
                  <Text
                    style={{
                      fontSize: 32,
                      fontWeight: "700",
                      letterSpacing: -1,
                      color: tk.text,
                      marginTop: 4,
                      fontVariant: ["tabular-nums"],
                    }}
                    numberOfLines={1}
                  >
                    {formatVolume(volumeThisWeek, unit)}
                  </Text>
                </View>

                {/* Success delta chip (D-05) — forge-success, up-arrow icon.
                    Only when prior week has a baseline AND the delta is non-
                    negative (a "+{N}%" success framing; a drop shows no chip
                    rather than a red one — success-only per UI-SPEC). */}
                {hasDelta && deltaPct >= 0 ? (
                  <View
                    className="flex-row items-center gap-[3px] rounded-lg"
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      backgroundColor: tk.successSoft,
                    }}
                  >
                    <Icon
                      name="arrowUp"
                      size={11}
                      color={tk.success}
                      strokeWidth={2.5}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: tk.success,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {t("volumeDeltaPct", { n: deltaPct })}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Animated Sparkline (D-08/D-18) — accent stroke, draws in on
                  mount. Fed the display-unit weekly series (D-20). */}
              <View style={{ marginTop: 12 }}>
                <Sparkline
                  data={sparkData}
                  width={320}
                  height={56}
                  color={tk.accent}
                  strokeWidth={2.5}
                />
              </View>
            </>
          ) : (
            // Volume-card empty copy (D-05) — no finished sessions yet.
            <View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: tk.text3,
                }}
              >
                {t("thisWeekVolume")}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  color: tk.text2,
                  marginTop: 8,
                  lineHeight: 21,
                }}
              >
                {t("volumeTrendEmpty")}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// HistoryListRow — Forge session row (D-16, FHistory 597-638). 44px surface2
// date-badge (DD over MON) + plan name + meta "X set · Y kg · Z min" +
// trailing chevronRight. The PR trophy (627-635) is OMITTED (D-13). Tap routes
// to /history/[sessionId].
// ---------------------------------------------------------------------------
function HistoryListRow({
  session,
  tk,
  unit,
  lang,
}: {
  session: SessionSummary;
  tk: (typeof TOKENS)["light"] | (typeof TOKENS)["dark"];
  unit: UnitPref;
  lang: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = lang.startsWith("en") ? enUS : sv;

  const started = new Date(session.started_at);
  // Date badge — DD over MON (date-fns; locale-aware month abbreviation).
  const dayNum = format(started, "d", { locale });
  const monthAbbr = format(started, "MMM", { locale });
  // Full date for the a11y label.
  const fullDate = format(started, "d MMM yyyy", { locale });

  const planLabel = session.plan_name ?? t("noPlan");

  // Duration (min) derived from finished_at − started_at. An unfinished or
  // missing finish stamp yields 0 (defensive; finished sessions always carry
  // finished_at via the list RPC's finished-only filter).
  const durationMin = session.finished_at
    ? Math.max(
        0,
        Math.round(
          (new Date(session.finished_at).getTime() - started.getTime()) / 60000,
        ),
      )
    : 0;

  const volumeLabel = formatVolume(session.total_volume_kg, unit);

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/history/[sessionId]",
          params: { sessionId: session.id },
        } as unknown as Href)
      }
      accessibilityRole="button"
      accessibilityLabel={`${fullDate}, ${planLabel}, ${session.set_count} ${t("sets")}, ${volumeLabel}, ${durationMin} ${t("min")}`}
      // Box decoration (surface bg + border + radius) via className (NativeWind
      // renders it); the inline style() callback carries ONLY pressed opacity.
      className="flex-row items-center rounded-2xl border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border"
      style={({ pressed }) => [
        { paddingHorizontal: 16, paddingVertical: 14, gap: 16 },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      {/* 44px date-badge — DD over MON (surface2 tile). */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          flexShrink: 0,
          // UAT 2026-06-13: surface2 (#18181B) on the surface (#0E0E10) row reads
          // as merged on-device OLED. surface3 (#222226) gives the date tile a
          // visible step so it reads as a distinct box, not run-on text.
          backgroundColor: tk.surface3,
          borderWidth: 1,
          borderColor: tk.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            letterSpacing: -0.3,
            lineHeight: 16,
            color: tk.text,
            fontVariant: ["tabular-nums"],
          }}
        >
          {dayNum}
        </Text>
        <Text
          style={{
            fontSize: 9,
            fontWeight: "600",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            marginTop: 2,
            color: tk.text3,
          }}
        >
          {monthAbbr}
        </Text>
      </View>

      {/* Plan name + meta "X set · Y kg · Z min" (D-16). */}
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
          {planLabel}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 3,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: tk.text2,
              fontVariant: ["tabular-nums"],
            }}
          >
            {`${session.set_count} ${t("sets")}`}
          </Text>
          <MetaDot tk={tk} />
          <Text
            style={{
              fontSize: 12,
              color: tk.text2,
              fontVariant: ["tabular-nums"],
            }}
          >
            {volumeLabel}
          </Text>
          <MetaDot tk={tk} />
          <Text
            style={{
              fontSize: 12,
              color: tk.text2,
              fontVariant: ["tabular-nums"],
            }}
          >
            {`${durationMin} ${t("min")}`}
          </Text>
        </View>
      </View>

      {/* OMIT trophy (D-13). Trailing chevron only. */}
      <Icon name="chevronRight" size={16} color={tk.text3} />
    </Pressable>
  );
}

// MetaDot — 3px round separator between meta cells (FHistory 621/623).
function MetaDot({
  tk,
}: {
  tk: (typeof TOKENS)["light"] | (typeof TOKENS)["dark"];
}) {
  return (
    <View
      style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: tk.text3 }}
    />
  );
}

// ---------------------------------------------------------------------------
// HistoryEmptyState — rendered when 0 finished sessions exist per
// UI-SPEC §History empty-state. The CTA routes back to the Planer tab
// ((tabs)/index.tsx — `/(tabs)/` resolves to the index route). Re-skinned to
// Forge tokens; box decoration on the CTA via className (NativeWind rule).
// ---------------------------------------------------------------------------
function HistoryEmptyState({
  tk,
}: {
  tk: (typeof TOKENS)["light"] | (typeof TOKENS)["dark"];
}) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
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
        <Icon name="clock" size={28} color={tk.text2} strokeWidth={2} />
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
          {t("noHistory")}
        </Text>
        <Text style={{ fontSize: 15, color: tk.text2, textAlign: "center" }}>
          {t("noHistorySub")}
        </Text>
      </View>
      <Pressable
        onPress={() => router.push("/(tabs)" as Href)}
        accessibilityRole="button"
        accessibilityLabel={t("goToPlans")}
        // Box decoration (accent fill + radius) via className so it renders;
        // the style() callback keeps only the pressed overlay (NativeWind rule).
        className="rounded-2xl px-6 py-4 bg-forge-accent-light dark:bg-forge-accent"
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: "700",
            letterSpacing: -0.2,
            color: "#FFFFFF",
          }}
        >
          {t("goToPlans")}
        </Text>
      </Pressable>
    </View>
  );
}
