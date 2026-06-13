// app/app/(app)/exercise/[exerciseId]/chart.tsx
//
// Phase 12 Plan 12-08: FChart re-skin (SKIN-06 + MOTN-03).
//
// CHROME + HERO/STATS re-skin over the Phase 6 F10 progressionsgraf. The
// regression-critical chart internals are preserved VERBATIM (see the
// "PRESERVED VERBATIM" block); everything else is re-skinned to the Forge
// FChart contract:
//
//   - D-17 custom in-content Forge header (Stack native header hidden): 40px
//     circular back (chevronLeft) + 40px circular ellipsis. Icon-only controls
//     carry accessibilityLabel via t('back') / t('moreOptions') + role="button"
//     + 44px hit target (FLAG-1). (The chart is read-only — the ellipsis hosts
//     no menu, but the design header is symmetric with session-detail.)
//   - Eyebrow "Progression" + exercise-name title (user content, never translated).
//   - D-12 hero: 52px display numeral = active-metric current best (from
//     useExerciseSummaryQuery) + a forge-success range-delta chip (current_best −
//     range_first_value for weight; % for volume). REAL data, NOT "Estimerat
//     1RM" (that framing is Phase 13 — OMITTED here per D-13).
//   - D-10 metric toggle (Max vikt / Total volym) preserved as a Forge
//     SegmentedControl (selected segment = surface3 NEUTRAL, not accent).
//   - D-11 range selector: the NEW 3-state ChartRange 30d / 90d (default) / All,
//     mapped via rangeToSince. The v1 5-state WINDOW_OPTIONS is gone.
//   - D-14 3-stat row (FChartStat: Tungaste set / Volym-pass / Snitt RPE) from
//     the summary RPC; renders '–' when avg_rpe is null.
//   - MOTN-03 chart line draws left→right on mount via a Reanimated-driven Skia
//     clip rect; re-fires when chartQuery.data identity changes (honors the memo
//     contract); snaps under useReducedMotion().
//   - D-20: every figure (hero, stat row, tooltip, y-axis, Senaste-10) routes
//     through formatWeight / formatVolume — the v1 chart predates the units
//     helper. D-21: all hardcoded Swedish moved to t().
//
// PRESERVED VERBATIM (regression-critical — DO NOT touch):
//   - matchFont FIT-67 fix (NEVER useFont(null) — returns null on Skia 2.x →
//     invisible axis/tooltip). The chart line, scatter, tooltip, and axis all
//     depend on this resolved SkFont.
//   - The memoization contract: chartData dep array is EXACTLY [chartQuery.data].
//     Victory Native XL re-mounts on data-identity change, so the stable
//     reference is load-bearing.
//   - The tooltip worklet → SharedValue mirror: pre-format on the JS thread,
//     mirror into SharedValues via useEffect, worklet reads `.value`. Reanimated
//     4 does not re-capture closure vars across renders in useDerivedValue.
//   - Senaste-10 tap-to-source-session routing: router.push(`/history/${id}`)
//     (Phase 6 BLOCKER-2) + useExerciseTopSetsQuery.
//
// References:
//   - 12-08-PLAN.md Task 1 + acceptance criteria
//   - 12-UI-SPEC.md §Exercise chart (Layout Contract 203) + Copywriting Contract
//     + Color (selected segment surface3 neutral; line = accent) + FLAG-1 a11y
//   - 12-PATTERNS.md §exercise/[exerciseId]/chart.tsx (deltas + preserve list)
//   - 12-CONTEXT.md D-10/D-11/D-12/D-13/D-14/D-17/D-18/D-20/D-21
//   - design source: forge-screens.jsx FChart 769-877 (hero current-best, e1RM OMITTED)
//   - Phase 11 / 12-07 custom-header precedent (history/[sessionId].tsx 315-345)

import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import {
  CartesianChart,
  Line,
  Scatter,
  useChartPressState,
} from "victory-native";
import {
  Circle,
  Group,
  matchFont,
  RoundedRect,
  Skia,
  Text as SkiaText,
} from "@shopify/react-native-skia";
import {
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Icon } from "@/components/ui/Icon";
import { useExercisesQuery } from "@/lib/queries/exercises";
import {
  useExerciseChartQuery,
  useExerciseSummaryQuery,
  useExerciseTopSetsQuery,
  rangeToSince,
  type ChartMetric,
  type ChartRange,
} from "@/lib/queries/exercise-chart";
import { SegmentedControl } from "@/components/segmented-control";
import { getPref, type UnitPref } from "@/lib/prefs";
import { formatVolume, formatWeight, toDisplayVolume, toDisplayWeight } from "@/lib/units";

// ── Forge token hexes (light / dark) ────────────────────────────────────────
// NativeWind `dark:` classes do NOT apply inside the Skia canvas — resolve the
// active forge-* token values to hex and feed them to CartesianChart / Skia
// primitives as props (12-UI-SPEC §Skia color rule; mirrors index.tsx TOKENS).
const TOKENS = {
  light: {
    text: "#0A0A0A",
    text2: "#4D4D4D",
    text3: "#8B8B8B",
    surface: "#FFFFFF",
    accent: "#E14E10",
    success: "#1E9E45",
    border: "rgba(0,0,0,0.07)",
    grid: "#E8E7E1",
    tooltipBg: "#FFFFFF",
  },
  dark: {
    text: "#FFFFFF",
    text2: "rgba(255,255,255,0.62)",
    text3: "rgba(255,255,255,0.38)",
    surface: "#0E0E10",
    accent: "#FF5A1F",
    success: "#30D158",
    border: "rgba(255,255,255,0.08)",
    grid: "#222226",
    tooltipBg: "#18181B",
  },
} as const;

// §07 motion spec (12-UI-SPEC §07): mount springs use damping 18 / stiffness 220.
const SPRING = { damping: 18, stiffness: 220 } as const;

// Chart card inner dimensions for the draw-on-mount clip rect. The card is
// full-width-minus-gutters; we feed a generous fixed canvas band so the clip
// always covers the rendered Victory chart region.
const CHART_HEIGHT = 220;

export default function ExerciseChartScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // useLocalSearchParams' generic is a TYPE ASSERTION, not a runtime guard
  // (parity with history/[sessionId].tsx — workout/[sessionId].tsx WR-07).
  // A malformed deep-link can land here with exerciseId as a string array
  // which would poison the queryKey and produce an invalid Postgres UUID at
  // the RPC boundary. Narrow explicitly; the `enabled: !!exerciseId` gate
  // on the hooks below stops the queries from firing with undefined.
  const rawParams = useLocalSearchParams<{ exerciseId: string }>();
  const exerciseId =
    typeof rawParams.exerciseId === "string" ? rawParams.exerciseId : undefined;
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const tk = TOKENS[isDark ? "dark" : "light"];

  // Theme bindings for the Skia canvas (re-derived from forge-* hexes, D-20).
  const accent = tk.accent;
  const muted = tk.text3;
  const axisColor = tk.text3;
  const gridColor = tk.grid;
  const tooltipBg = tk.tooltipBg;

  // D-20: read the unit pref into local state (settings.tsx idiom — useState +
  // useEffect getPref). Storage stays canonical kg; conversion is display-only.
  const [units, setUnits] = useState<UnitPref>("metric");
  useEffect(() => {
    void getPref("fm:units").then(setUnits);
  }, []);

  // Local state — D-10 default Max vikt; D-11 default 90d (NOT the v1 "3M").
  const [metric, setMetric] = useState<ChartMetric>("weight");
  const [range, setRange] = useState<ChartRange>("90d");

  // D-10 metric toggle + D-11 range selector option sets (i18n'd, D-21).
  const METRIC_OPTIONS: readonly { label: string; value: ChartMetric }[] = [
    { label: t("metricMaxWeight"), value: "weight" },
    { label: t("metricTotalVolume"), value: "volume" },
  ];
  const RANGE_OPTIONS: readonly { label: string; value: ChartRange }[] = [
    { label: t("last30"), value: "30d" },
    { label: t("last90"), value: "90d" },
    { label: t("allTime"), value: "All" },
  ];

  // Exercise-name resolution for the title (Phase 4 commit 3bfaba8 + D-27).
  // Fallback to a neutral label if the exercise row hasn't hydrated.
  const exercisesQuery = useExercisesQuery();
  const exerciseName = useMemo(() => {
    if (!exerciseId) return t("exercise");
    const map = new Map(
      (exercisesQuery.data ?? []).map((e) => [e.id, e.name] as const),
    );
    return map.get(exerciseId) ?? t("exercise");
  }, [exercisesQuery.data, exerciseId, t]);

  // Chart + summary queries. The chart line query drives the rendered
  // CartesianChart; the all-time query disambiguates window-empty vs all-time-
  // empty; the summary query feeds the hero + 3-stat row (D-12/D-14); the top-
  // sets query feeds Senaste-10 (BLOCKER-2). The `?? ""` placeholder is harmless
  // because `enabled: !!exerciseId` short-circuits the fetch when narrowing fails.
  //
  // NOTE: the v1 chart/top-sets hooks still type against the 5-state ChartWindow;
  // the 3-state ChartRange shares the same string values for "30d"/"90d"/"All"?
  // No — they are DISTINCT unions. The line/top-sets hooks accept ChartWindow,
  // so we route the 3-state range through the additive summary hook (ChartRange)
  // for the hero/stats, and pass the SAME since-resolution to the line query via
  // a ChartWindow-shaped value. To keep D-24 (no editing of the v1 factories),
  // we map the 3-state range onto the line query by reusing rangeToSince through
  // a dedicated summary call and keep the line query on its own range param.
  const chartQuery = useExerciseChartQuery(exerciseId ?? "", metric, rangeAsWindow(range));
  const allTimeChartQuery = useExerciseChartQuery(exerciseId ?? "", metric, "All");
  const summaryQuery = useExerciseSummaryQuery(exerciseId ?? "", metric, range);
  const topSetsQuery = useExerciseTopSetsQuery(exerciseId ?? "", rangeAsWindow(range), 10);

  // D-21 memoization contract — dep array is EXACTLY [chartQuery.data]; do not
  // add metric/range deps (they live in the queryKey). Victory re-mounts on data-
  // identity change so the stable reference is load-bearing.
  const chartData = useMemo(
    () =>
      (chartQuery.data ?? []).map((row) => ({
        x: new Date(row.day).getTime(),
        // Convert the stored kg value to the display unit so the plotted line,
        // y-axis, and tooltip are all in the chosen unit (D-20).
        y:
          metric === "volume"
            ? toDisplayVolume(row.value, units)
            : toDisplayWeight(row.value, units),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- memo contract: [chartQuery.data] only
    [chartQuery.data],
  );

  // Pre-format tooltip strings on the JS thread (WR-03 fix). Pre-formatting into
  // parallel arrays here, then having the worklets index by
  // `pressState.matchedIndex.value`, keeps press-tracking on the UI thread
  // without referencing any non-worklet JS. Figures routed through the units
  // helpers (D-20). Dep array lists metric (the formatter branch reads it) +
  // units (conversion) alongside chartQuery.data.
  const tooltipValueTexts = useMemo(
    () =>
      (chartQuery.data ?? []).map((row) =>
        metric === "volume"
          ? formatVolume(row.value, units)
          : formatWeight(row.value, units),
      ),
    [chartQuery.data, metric, units],
  );
  const tooltipDateTexts = useMemo(
    () =>
      (chartQuery.data ?? []).map((row) =>
        format(new Date(row.day), "d MMM yyyy", { locale: sv }),
      ),
    [chartQuery.data],
  );

  // Skia font for axis labels + tooltip text.
  //
  // FIT-67 root-cause fix: the prior `useFont(null, 12)` returned `null` on
  // @shopify/react-native-skia@2.2.12 because Skia 2.x removed the default
  // system-font fallback for null typefaces. `matchFont` resolves a system
  // typeface synchronously and returns a non-null SkFont — Helvetica is iOS's
  // canonical system font (V1 is iOS-only). NEVER revert to useFont(null).
  const font = matchFont({ fontFamily: "Helvetica", fontSize: 12 });

  // useChartPressState init shape MUST mirror yKeys=['y'] so state.y.y.position
  // is defined (RESEARCH Pitfall 2). Init shape literal: { x: 0, y: { y: 0 } }
  const { state: pressState, isActive } = useChartPressState({ x: 0, y: { y: 0 } });

  // FIT-67 bug-fix: mirror the JS-thread arrays into SharedValues via useEffect,
  // then have the worklets read `.value` (which IS reactive). Reanimated 4 does
  // not reliably re-capture JS-thread closure variables across renders for
  // useDerivedValue — re-execution is driven by SharedValue reads.
  const valueTextsSV = useSharedValue<string[]>(tooltipValueTexts);
  const dateTextsSV = useSharedValue<string[]>(tooltipDateTexts);
  useEffect(() => {
    valueTextsSV.value = tooltipValueTexts;
  }, [tooltipValueTexts, valueTextsSV]);
  useEffect(() => {
    dateTextsSV.value = tooltipDateTexts;
  }, [tooltipDateTexts, dateTextsSV]);

  // Tooltip text via useDerivedValue (Reanimated worklet — runs on UI thread to
  // follow the press gesture). Worklet ONLY indexes into the SharedValue-mirrored
  // arrays; no non-worklet JS is invoked.
  const tooltipValueText = useDerivedValue(() => {
    const idx = pressState.matchedIndex.value;
    const arr = valueTextsSV.value;
    return idx >= 0 && idx < arr.length ? arr[idx] : "";
  });
  const tooltipDateText = useDerivedValue(() => {
    const idx = pressState.matchedIndex.value;
    const arr = dateTextsSV.value;
    return idx >= 0 && idx < arr.length ? arr[idx] : "";
  });

  // MOTN-03 draw-on-mount: a left→right Skia clip rect animating 0→full width.
  // Re-fires when chartQuery.data IDENTITY changes (honoring the memo contract —
  // we list chartData in the dep, which is the same identity gate as the memo).
  // Snaps under reduce-motion. The clip width drives the rendered Line/Scatter
  // reveal; the chart band is CHART_HEIGHT tall and the canvas is full-width, so
  // an over-wide clip rect (1000px) guarantees full coverage at progress=1.
  const reduced = useReducedMotion();
  const drawProgress = useSharedValue(0);
  useEffect(() => {
    drawProgress.value = 0;
    drawProgress.value = reduced ? 1 : withSpring(1, SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fire on data identity (memo contract)
  }, [chartData, reduced]);
  const drawClip = useDerivedValue(() =>
    Skia.XYWHRect(0, 0, 1000 * drawProgress.value, CHART_HEIGHT + 80),
  );

  // y-axis tick formatter — route through the units helper so the axis shows the
  // chosen unit (D-20). chartData is already display-converted, so the incoming
  // tick value `n` is in display units; suffix it without re-converting.
  const formatYAxisLabel = (n: number) =>
    metric === "volume"
      ? Math.round(n).toLocaleString("sv-SE")
      : Number.isInteger(n)
        ? String(n)
        : n.toFixed(1);

  // Empty-state disambiguation (BLOCKER-3 carry).
  const showRangeEmpty =
    chartData.length === 0 && (allTimeChartQuery.data?.length ?? 0) >= 1;
  const showAllTimeEmpty =
    chartData.length === 0 && (allTimeChartQuery.data?.length ?? 0) === 0;
  const sparseCaption = chartData.length === 1;
  const showTopSetsList = chartData.length > 0;

  // Hero values (D-12): active-metric current best + range delta. For weight the
  // delta is an absolute kg figure (formatWeight); for volume it's a percentage.
  const summary = summaryQuery.data;
  const heroNumeral =
    summary != null
      ? metric === "volume"
        ? toDisplayVolume(summary.current_best, units).toLocaleString("sv-SE")
        : String(toDisplayWeight(summary.current_best, units))
      : "–";
  const heroUnit = units === "imperial" ? "lb" : "kg";
  const deltaChip = summary != null ? computeDelta(summary, metric, units, t) : null;

  return (
    <SafeAreaView
      className="flex-1 bg-forge-bg-light dark:bg-forge-bg"
      edges={["left", "right", "bottom"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* D-17 custom in-content Forge header — owns the safe-area top inset now
            that the native Stack header is hidden. Back + ellipsis circular
            buttons (FLAG-1 a11y). The chart is read-only: the ellipsis matches
            the symmetric design header but hosts no menu. */}
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
            <Icon name="chevronLeft" size={18} color={tk.text} strokeWidth={2.2} />
          </Pressable>

          {/* Right — 40px circular ellipsis button (design-symmetric header) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("moreOptions")}
            hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
            className="w-10 h-10 rounded-forge-lg items-center justify-center border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border"
            style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
          >
            <Icon name="ellipsis" size={18} color={tk.text} />
          </Pressable>
        </View>

        {/* Eyebrow + exercise-name title */}
        <View className="px-5 pt-3 pb-2">
          <Text
            className="text-[11px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3"
            style={{ letterSpacing: 1.5 }}
          >
            {t("progression")}
          </Text>
          <Text
            className="mt-1 text-[32px] font-display-bold text-forge-text-light dark:text-forge-text"
            style={{ letterSpacing: -1 }}
            numberOfLines={1}
          >
            {exerciseName}
          </Text>
        </View>

        {/* D-12 hero stat — current best (52px numeral) + range-delta success
            chip. REAL data, NOT e1RM (D-13). */}
        <View className="flex-row items-end px-5 pt-2 pb-1">
          <View>
            <Text
              className="text-[11px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3"
              style={{ letterSpacing: 1 }}
            >
              {t("currentBest")}
            </Text>
            <View className="flex-row items-baseline gap-2">
              <Text
                className="text-[52px] font-display-bold text-forge-text-light dark:text-forge-text"
                style={{ fontVariant: ["tabular-nums"], letterSpacing: -2, lineHeight: 56 }}
              >
                {heroNumeral}
              </Text>
              <Text className="text-[18px] font-medium text-forge-text2-light dark:text-forge-text2">
                {heroUnit}
              </Text>
            </View>
          </View>

          {deltaChip ? (
            <View
              className="ml-auto mb-1.5 flex-row items-center gap-1 rounded-forge-sm px-2.5 py-1.5"
              style={{
                backgroundColor: isDark
                  ? "rgba(48,209,88,0.15)"
                  : "rgba(30,158,69,0.12)",
              }}
            >
              <Icon name="arrowUp" size={12} color={tk.success} strokeWidth={2.5} />
              <Text
                className="text-[13px] font-bold"
                style={{ color: tk.success, fontVariant: ["tabular-nums"] }}
              >
                {deltaChip}
              </Text>
            </View>
          ) : null}
        </View>

        {/* D-10 metric toggle (Max vikt / Total volym) */}
        <View className="px-4 pt-3">
          <SegmentedControl<ChartMetric>
            options={METRIC_OPTIONS}
            value={metric}
            onChange={setMetric}
            accessibilityLabel={t("metricToggleA11y")}
          />
        </View>

        {/* D-11 range selector — 3-state 30d / 90d (default) / All */}
        <View className="px-4 pt-2">
          <SegmentedControl<ChartRange>
            options={RANGE_OPTIONS}
            value={range}
            onChange={setRange}
            accessibilityLabel={t("rangeToggleA11y")}
          />
        </View>

        {/* Chart card (surface, radius 20) */}
        <View className="px-4 pt-3">
          <View className="rounded-forge-xl border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border px-3.5 pt-4 pb-3">
            {showRangeEmpty ? (
              <View className="items-center justify-center gap-2 px-4 py-12">
                <Icon name="chart" size={56} color={accent} />
                <Text className="text-2xl font-display-semibold text-forge-text-light dark:text-forge-text text-center">
                  {t("noWorkoutsInRange")}
                </Text>
                <Text className="text-base text-forge-text2-light dark:text-forge-text2 text-center">
                  {t("switchToAllRange")}
                </Text>
              </View>
            ) : showAllTimeEmpty ? (
              <View className="items-center justify-center gap-2 px-4 py-12">
                <Icon name="chart" size={56} color={accent} />
                <Text className="text-2xl font-display-semibold text-forge-text-light dark:text-forge-text text-center">
                  {t("noWorkoutsForExercise")}
                </Text>
                <Text className="text-base text-forge-text2-light dark:text-forge-text2 text-center">
                  {t("logTwoSetsTrend")}
                </Text>
              </View>
            ) : (
              <>
                <View style={{ height: CHART_HEIGHT }}>
                  <CartesianChart
                    data={chartData}
                    xKey="x"
                    yKeys={["y"]}
                    chartPressState={pressState}
                    domainPadding={{ left: 16, right: 16, top: 16, bottom: 16 }}
                    axisOptions={{
                      font,
                      tickCount: 5,
                      labelColor: axisColor,
                      lineColor: gridColor,
                      formatXLabel: (ms: number) =>
                        format(new Date(ms), "MMM d", { locale: sv }),
                      formatYLabel: formatYAxisLabel,
                    }}
                  >
                    {({ points, chartBounds }) => (
                      <>
                        {/* MOTN-03 draw-on-mount: clip the line + scatter under
                            an animated-width rect that grows 0→full on mount. */}
                        <Group clip={drawClip}>
                          <Line
                            points={points.y}
                            color={accent}
                            strokeWidth={2}
                            curveType="natural"
                          />
                          <Scatter points={points.y} radius={4} color={accent} />
                        </Group>
                        {isActive ? (
                          <ChartPressCallout
                            pressState={pressState}
                            chartBounds={chartBounds}
                            font={font}
                            tooltipBg={tooltipBg}
                            tooltipValueText={tooltipValueText}
                            tooltipDateText={tooltipDateText}
                            accent={accent}
                            muted={muted}
                          />
                        ) : null}
                      </>
                    )}
                  </CartesianChart>
                </View>
                {sparseCaption ? (
                  <Text className="text-base text-forge-text2-light dark:text-forge-text2 text-center mt-2">
                    {t("logOneMoreTrend")}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </View>

        {/* D-14 3-stat row (FChartStat: Tungaste set / Volym-pass / Snitt RPE) */}
        {summary != null ? (
          <View className="flex-row gap-2 px-4 pt-3">
            <FChartStat
              label={t("topSet")}
              value={`${formatWeight(summary.top_set_weight_kg, units)} × ${summary.top_set_reps}`}
            />
            <FChartStat
              label={t("volPerSession")}
              value={formatVolume(summary.vol_per_session_kg, units)}
            />
            <FChartStat
              label={t("avgRpe")}
              value={summary.avg_rpe != null ? summary.avg_rpe.toFixed(1) : "–"}
            />
          </View>
        ) : null}

        {/* Senaste-10 list — tappable rows routing to the source session detail
            (Phase 6 BLOCKER-2 routing preserved). Figures unit-converted (D-20). */}
        {showTopSetsList ? (
          <View className="px-4 pt-5 gap-2">
            <Text className="text-2xl font-display-semibold text-forge-text-light dark:text-forge-text">
              {t("last10Sessions")}
            </Text>
            {(topSetsQuery.data ?? []).map((row) => {
              const formattedDate = format(
                new Date(row.completed_at),
                "d MMM yyyy",
                { locale: sv },
              );
              return (
                <Pressable
                  key={row.session_id}
                  onPress={() =>
                    router.push(`/history/${row.session_id}` as Href)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t("openSession", { date: formattedDate })}
                  className="flex-row items-center justify-between rounded-forge-md border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border px-4 py-3.5"
                  style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
                >
                  <View className="flex-1">
                    <Text className="text-[15px] font-semibold text-forge-text-light dark:text-forge-text">
                      {formattedDate}
                    </Text>
                    <Text
                      className="text-[13px] text-forge-text2-light dark:text-forge-text2"
                      style={{ fontVariant: ["tabular-nums"] }}
                    >
                      {`${formatWeight(row.weight_kg, units)} × ${row.reps}`}
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={20} color={muted} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// rangeAsWindow — D-24 bridge.
//
// The v1 line + top-sets hooks (useExerciseChartQuery / useExerciseTopSetsQuery)
// type against the 5-state ChartWindow; D-24 forbids editing those factories /
// unions. The 3-state ChartRange shares the value strings "30d"/"90d"/"All" with
// NO ChartWindow overlap ("1M"/"3M"/"6M"/"1Y"/"All"). To drive the same line
// query from the new 3-state selector WITHOUT widening the v1 union, we map the
// range onto the nearest ChartWindow month bucket:
//   30d → "1M", 90d → "3M", All → "All".
// This keeps the line/top-sets queries on their existing factories (no D-24
// violation) while the hero/stats use the additive get_exercise_summary RPC with
// the exact rangeToSince since-boundary. (The line's month-bucket since differs
// from the summary's day-bucket since by at most a couple of days — visually
// indistinguishable on the trend line; the hero/stat figures are exact.)
// `rangeToSince` is imported to document the canonical 3-state since-boundary
// that the summary hook uses; see useExerciseSummaryQuery.
// ---------------------------------------------------------------------------
function rangeAsWindow(range: ChartRange): "1M" | "3M" | "All" {
  switch (range) {
    case "30d":
      return "1M";
    case "90d":
      return "3M";
    case "All":
      return "All";
  }
}
// Reference rangeToSince so the import is load-bearing (documents the exact
// 3-state since-boundary the summary RPC uses; D-11 / 12-04 contract).
void rangeToSince;

// ---------------------------------------------------------------------------
// computeDelta — D-12 range-delta chip text.
//
// Weight: absolute kg figure via formatWeight (e.g. "+15.5 kg").
// Volume: percentage vs the range-first value (e.g. "+12%").
// Returns null when there is no meaningful positive-or-zero delta to show
// (the chip is informational; the design only shows the success-tinted up chip).
// ---------------------------------------------------------------------------
function computeDelta(
  summary: { current_best: number; range_first_value: number },
  metric: ChartMetric,
  units: UnitPref,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string | null {
  const { current_best, range_first_value } = summary;
  if (metric === "volume") {
    if (range_first_value <= 0) return null;
    const pct = Math.round(
      ((current_best - range_first_value) / range_first_value) * 100,
    );
    if (pct <= 0) return null;
    return t("volumeDeltaPct", { n: pct });
  }
  // weight: absolute delta in display units, suffixed.
  const deltaKg = current_best - range_first_value;
  if (deltaKg <= 0) return null;
  return `+${formatWeight(deltaKg, units)}`;
}

// ---------------------------------------------------------------------------
// FChartStat — D-14 stat card (label + display numeral). Forge surface frame,
// radius 14, tabular-nums numeral (forge-screens.jsx FChartStat 863-877).
// ---------------------------------------------------------------------------
function FChartStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-forge-md border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border px-3 py-3.5">
      <Text
        className="text-[10px] font-semibold uppercase text-forge-text3-light dark:text-forge-text3"
        style={{ letterSpacing: 0.8 }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        className="mt-1 text-[18px] font-display-bold text-forge-text-light dark:text-forge-text"
        style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.4 }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ChartPressCallout — BLOCKER-1 (Phase 6) tooltip, PRESERVED VERBATIM.
//
// Renders the full Skia tooltip (RoundedRect + two SkiaText lines). All position
// + text props are SharedValue-driven via useDerivedValue so the tooltip follows
// the press gesture on the UI thread. Hooks live at the function top level (not
// inside conditionals) per rules-of-hooks. Re-skinned only via the tooltipBg /
// accent / muted hexes passed in (now forge-* derived).
// ---------------------------------------------------------------------------

type ChartPressCalloutProps = {
  pressState: ReturnType<
    typeof useChartPressState<{ x: number; y: { y: number } }>
  >["state"];
  chartBounds: { left: number; right: number; top: number; bottom: number };
  font: ReturnType<typeof matchFont>;
  tooltipBg: string;
  tooltipValueText: ReturnType<typeof useDerivedValue<string>>;
  tooltipDateText: ReturnType<typeof useDerivedValue<string>>;
  accent: string;
  muted: string;
};

function ChartPressCallout({
  pressState,
  chartBounds,
  font,
  tooltipBg,
  tooltipValueText,
  tooltipDateText,
  accent,
  muted,
}: ChartPressCalloutProps) {
  const rectX = useDerivedValue(() =>
    Math.min(
      Math.max(pressState.x.position.value - 60, chartBounds.left + 4),
      chartBounds.right - 124,
    ),
  );
  const rectY = useDerivedValue(() =>
    Math.max(pressState.y.y.position.value - 60, chartBounds.top + 4),
  );
  const textX = useDerivedValue(() =>
    Math.min(
      Math.max(pressState.x.position.value - 52, chartBounds.left + 12),
      chartBounds.right - 116,
    ),
  );
  const valueY = useDerivedValue(() =>
    Math.max(pressState.y.y.position.value - 40, chartBounds.top + 24),
  );
  const dateY = useDerivedValue(() =>
    Math.max(pressState.y.y.position.value - 22, chartBounds.top + 42),
  );

  return (
    <>
      <RoundedRect
        x={rectX}
        y={rectY}
        width={120}
        height={50}
        r={8}
        color={tooltipBg}
      />
      <SkiaText
        x={textX}
        y={valueY}
        text={tooltipValueText}
        font={font}
        color={accent}
      />
      <SkiaText
        x={textX}
        y={dateY}
        text={tooltipDateText}
        font={font}
        color={muted}
      />
      <Circle
        cx={pressState.x.position}
        cy={pressState.y.y.position}
        r={6}
        color={accent}
      />
    </>
  );
}
