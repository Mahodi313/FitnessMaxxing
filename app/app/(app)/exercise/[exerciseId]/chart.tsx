// app/app/(app)/exercise/[exerciseId]/chart.tsx
//
// Phase 6 F10: per-exercise progressionsgraf vertical slice.
//
// Layout: MetricToggle (Max vikt / Total volym) → memoized <CartesianChart>
// with Skia tooltip callout on tap-and-hold → WindowToggle (1M / 3M / 6M /
// 1Y / All, default 3M) → "Senaste 10 passen" list of tappable rows routing
// back to /history/<source-session-id>.
//
// BLOCKER closures locked by 06-03-PLAN.md must_haves:
//   - BLOCKER-1: full Skia tooltip callout per UI-SPEC §ChartPressCallout
//     (lines 555-574) — RoundedRect + two SkiaText nodes (value + date) with
//     chartBounds clamping. NOT a placeholder highlight.
//   - BLOCKER-2: Senaste 10 rows show `${weight_kg} kg × ${reps}` (reps
//     preserved as int through the TopSetRowSchema.parse boundary) AND each
//     row routes to /history/<session_id>. Dual-RPC design — chart RPC
//     aggregates by day and cannot deliver per-source-session reps; the
//     top-sets RPC closes the gap (D-20).
//   - BLOCKER-3: two-state empty-state via a SECOND useExerciseChartQuery
//     call with window='All' so we can disambiguate "no data ever" from
//     "no data in this window" (UI-SPEC line 258 — A2 confirmed cost is low).
//
// Memoization contract (D-21 + WARN-7): the useMemo dep array over
// chartQuery.data is EXACTLY [chartQuery.data] — metric/window already live
// in the queryKey so adding them to the dep would only cause a redundant
// recompute. Victory Native XL re-mounts the chart if data prop identity
// changes per render, so a stable referen ce is load-bearing.
//
// Deviation (WARN-5): UI-SPEC line 287 prose says the chart-icon on plan-
// detail is "rightmost". UI-SPEC §Visuals JSX lines 671-684 shows it
// BETWEEN edit and remove. The plan ships the JSX-locked position (Task 4);
// the prose-fix is paperwork tracked via Linear (06-03-PLAN.md notes the
// follow-up; will be filed if/when the prose patch is approved by the user).
//
// References:
//   - 06-CONTEXT.md D-14..D-23, D-25..D-27
//   - 06-RESEARCH.md §Pattern 2 + Pitfalls 1, 2, 9
//   - 06-UI-SPEC.md §Chart screen container + §ChartPressCallout
//   - 06-PATTERNS.md "app/app/(app)/exercise/[exerciseId]/chart.tsx"

import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  CartesianChart,
  Line,
  Scatter,
  useChartPressState,
} from "victory-native";
import {
  Circle,
  RoundedRect,
  Text as SkiaText,
  useFont,
} from "@shopify/react-native-skia";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";

import { useExercisesQuery } from "@/lib/queries/exercises";
import {
  useExerciseChartQuery,
  useExerciseTopSetsQuery,
  type ChartMetric,
  type ChartWindow,
} from "@/lib/queries/exercise-chart";
import { SegmentedControl } from "@/components/segmented-control";

const METRIC_OPTIONS: readonly { label: string; value: ChartMetric }[] = [
  { label: "Max vikt", value: "weight" },
  { label: "Total volym", value: "volume" },
];

const WINDOW_OPTIONS: readonly { label: string; value: ChartWindow }[] = [
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "1Y", value: "1Y" },
  { label: "All", value: "All" },
];

const formatNumber = (n: number) => n.toLocaleString("sv-SE");

export default function ExerciseChartScreen() {
  const router = useRouter();
  // useLocalSearchParams' generic is a TYPE ASSERTION, not a runtime guard
  // (parity with history/[sessionId].tsx — workout/[sessionId].tsx WR-07).
  // A malformed deep-link can land here with exerciseId as a string array
  // which would poison the queryKey and produce an invalid Postgres UUID at
  // the RPC boundary. Narrow explicitly; the `enabled: !!exerciseId` gate
  // on the hooks below stops the queries from firing with undefined.
  const rawParams = useLocalSearchParams<{ exerciseId: string }>();
  const exerciseId =
    typeof rawParams.exerciseId === "string" ? rawParams.exerciseId : undefined;
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  // Theme bindings (D-23): hex strings because Skia primitives consume
  // hex directly — NativeWind classes don't apply inside the Skia canvas.
  const muted = isDark ? "#9CA3AF" : "#6B7280";
  const accent = isDark ? "#60A5FA" : "#2563EB";
  const axisColor = muted;
  const gridColor = isDark ? "#374151" : "#E5E7EB";
  const tooltipBg = isDark ? "#1F2937" : "#FFFFFF";

  // Local state — D-14 default Max vikt; D-15 default 3M.
  const [metric, setMetric] = useState<ChartMetric>("weight");
  const [chartWindow, setChartWindow] = useState<ChartWindow>("3M");

  // Exercise-name resolution for Stack header title (Phase 4 commit 3bfaba8
  // + D-27). Fallback to "Övning" if the exercise row hasn't hydrated (e.g.
  // cold deep-link with empty exercises cache).
  const exercisesQuery = useExercisesQuery();
  const exerciseName = useMemo(() => {
    if (!exerciseId) return "Övning";
    const map = new Map(
      (exercisesQuery.data ?? []).map((e) => [e.id, e.name] as const),
    );
    return map.get(exerciseId) ?? "Övning";
  }, [exercisesQuery.data, exerciseId]);

  // Two queries (BLOCKER-3 — disambiguate window-empty vs all-time-empty):
  //   chartQuery       → active window, drives the rendered <CartesianChart>
  //   allTimeChartQuery → window='All' fallback for the empty-state branch
  // The second query is cache-shared so future All-window selections are
  // instant; it costs one fetch per (exerciseId, metric) tuple on cold cache.
  // The `?? ""` placeholder is harmless because `enabled: !!exerciseId`
  // inside each hook short-circuits the fetch when narrowing failed.
  const chartQuery = useExerciseChartQuery(exerciseId ?? "", metric, chartWindow);
  const allTimeChartQuery = useExerciseChartQuery(exerciseId ?? "", metric, "All");
  const topSetsQuery = useExerciseTopSetsQuery(exerciseId ?? "", chartWindow, 10);

  // D-21 memoization contract — dep array is EXACTLY [chartQuery.data]; do
  // not add metric/window deps since they are in the queryKey.
  const chartData = useMemo(
    () =>
      (chartQuery.data ?? []).map((row) => ({
        x: new Date(row.day).getTime(),
        y: row.value,
      })),
    [chartQuery.data],
  );

  // Pre-format tooltip strings on the JS thread (WR-03 fix). The previous
  // implementation called `Number.prototype.toLocaleString` and `date-fns
  // .format()` inside `useDerivedValue` worklets — neither is a worklet, so
  // under Reanimated 4 those calls either threw "Tried to synchronously call
  // a non-worklet function on the UI thread" or silently fell back to JS-
  // thread evaluation. Pre-formatting into parallel arrays here, then having
  // the worklets index by `pressState.matchedIndex.value`, keeps the press-
  // tracking on the UI thread without referencing any non-worklet JS.
  // Dep array follows the D-21 contract: chartQuery.data is the data
  // identity; metric is already in the queryKey so chartQuery.data is a
  // fresh reference when metric changes, but the formatter branch on metric
  // ('volume' vs 'weight') means we still must list metric explicitly.
  const tooltipValueTexts = useMemo(
    () =>
      (chartQuery.data ?? []).map((row) =>
        metric === "volume"
          ? `${formatNumber(row.value)} kg`
          : `${row.value} kg`,
      ),
    [chartQuery.data, metric],
  );
  const tooltipDateTexts = useMemo(
    () =>
      (chartQuery.data ?? []).map((row) =>
        format(new Date(row.day), "d MMM yyyy", { locale: sv }),
      ),
    [chartQuery.data],
  );

  // Skia font for axis labels + tooltip text. useFont(null, 12) returns a
  // system-font Skia font synchronously (RESEARCH A4 — fallback acceptable).
  const font = useFont(null, 12);

  // useChartPressState init shape MUST mirror yKeys=['y'] so state.y.y.position
  // is defined (RESEARCH Pitfall 2). Init shape literal: { x: 0, y: { y: 0 } }
  const { state: pressState, isActive } = useChartPressState({ x: 0, y: { y: 0 } });

  // FIT-67 bug-fix (2026-05-15): UI-thread tooltip text was always empty
  // (rectangle rendered, text did not) because the `useDerivedValue` worklet
  // captured `tooltipValueTexts` / `tooltipDateTexts` from the first render
  // (when `chartQuery.data` was still undefined → memo returned `[]`).
  // Reanimated 4 + Worklets 0.5 does not reliably re-capture JS-thread
  // closure variables across renders for `useDerivedValue` — re-execution
  // is driven by SharedValue reads, not by closure-variable reference
  // changes. Pattern: mirror the JS-thread arrays into SharedValues via
  // useEffect, then have the worklets read `.value` (which IS reactive).
  const valueTextsSV = useSharedValue<string[]>(tooltipValueTexts);
  const dateTextsSV = useSharedValue<string[]>(tooltipDateTexts);
  useEffect(() => {
    valueTextsSV.value = tooltipValueTexts;
  }, [tooltipValueTexts, valueTextsSV]);
  useEffect(() => {
    dateTextsSV.value = tooltipDateTexts;
  }, [tooltipDateTexts, dateTextsSV]);

  // Tooltip text via useDerivedValue (Reanimated worklet — runs on UI thread
  // to follow the press gesture smoothly). Worklet ONLY indexes into the
  // SharedValue-mirrored arrays; no non-worklet JS is invoked here. Reads
  // are reactive via `valueTextsSV.value` so JS-thread data updates flow
  // to the UI thread without re-creating the worklet.
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

  const formatYAxisLabel = (n: number) =>
    metric === "volume" ? formatNumber(n) : `${n}`;

  const sparseCaption = chartData.length === 1;
  const showWindowEmpty =
    chartData.length === 0 && (allTimeChartQuery.data?.length ?? 0) >= 1;
  const showAllTimeEmpty =
    chartData.length === 0 && (allTimeChartQuery.data?.length ?? 0) === 0;
  const showTopSetsList = chartData.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <Stack.Screen options={{ headerShown: true, title: exerciseName }} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 96,
        }}
      >
        <View className="gap-4">
          <SegmentedControl<ChartMetric>
            options={METRIC_OPTIONS}
            value={metric}
            onChange={setMetric}
            accessibilityLabel="Mätvärde"
          />

          <View className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
            {showWindowEmpty ? (
              <View className="items-center justify-center gap-2 px-4 py-12">
                <Ionicons
                  name="stats-chart-outline"
                  size={64}
                  color={accent}
                />
                <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50 text-center">
                  Inga pass i detta intervall
                </Text>
                <Text className="text-base text-gray-500 dark:text-gray-400 text-center">
                  Byt till All för att se hela historiken.
                </Text>
              </View>
            ) : showAllTimeEmpty ? (
              <View className="items-center justify-center gap-2 px-4 py-12">
                <Ionicons
                  name="stats-chart-outline"
                  size={64}
                  color={accent}
                />
                <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50 text-center">
                  Inga pass än för den här övningen
                </Text>
                <Text className="text-base text-gray-500 dark:text-gray-400 text-center">
                  Logga minst 2 set för att se trend.
                </Text>
              </View>
            ) : (
              <>
                <View style={{ height: 240 }}>
                  <CartesianChart
                    data={chartData}
                    xKey="x"
                    yKeys={["y"]}
                    chartPressState={pressState}
                    domainPadding={{
                      left: 16,
                      right: 16,
                      top: 16,
                      bottom: 16,
                    }}
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
                        <Line
                          points={points.y}
                          color={accent}
                          strokeWidth={2}
                          curveType="natural"
                        />
                        <Scatter
                          points={points.y}
                          radius={4}
                          color={accent}
                        />
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
                  <Text className="text-base text-gray-500 dark:text-gray-400 text-center mt-2">
                    Logga ett pass till för att se trend.
                  </Text>
                ) : null}
              </>
            )}
          </View>

          <SegmentedControl<ChartWindow>
            options={WINDOW_OPTIONS}
            value={chartWindow}
            onChange={setChartWindow}
            accessibilityLabel="Tidsfönster"
          />

          {showTopSetsList ? (
            <View className="mt-2 gap-2">
              <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                Senaste 10 passen
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
                    accessibilityLabel={`Öppna pass ${formattedDate}`}
                    className="flex-row items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 mb-2 active:opacity-80"
                  >
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
                        {formattedDate}
                      </Text>
                      <Text className="text-base text-gray-500 dark:text-gray-400">
                        {`${row.weight_kg} kg × ${row.reps}`}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={muted}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// ChartPressCallout — BLOCKER-1 fix.
//
// Renders the full Skia tooltip (RoundedRect + two SkiaText lines) per UI-
// SPEC lines 555-574. Position math:
//   - rect centered ~60pt above the pressed point (x - 60 → x + 60 wide,
//     y - 60 → y - 10 tall)
//   - text inset 8pt from the rect's left + offset down 24pt + 42pt
//   - chartBounds clamping so the rect never clips off the canvas edge
//
// All position + text props are SharedValue-driven via useDerivedValue so
// the tooltip follows the press gesture on the UI thread.
//
// Hooks live at the function top level (not inside conditionals) per the
// rules-of-hooks contract.
// ---------------------------------------------------------------------------

type ChartPressCalloutProps = {
  pressState: ReturnType<
    typeof useChartPressState<{ x: number; y: { y: number } }>
  >["state"];
  chartBounds: { left: number; right: number; top: number; bottom: number };
  font: ReturnType<typeof useFont>;
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
