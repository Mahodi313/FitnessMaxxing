# Phase 6: History & Read-Side Polish — Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 11 (3 new routes + 1 new query hook + 1 new test script + 1 new migration + 5 modified files)
**Analogs found:** 11 / 11 — every Phase 6 file has an in-repo precedent.

> Read-only verification. Closest analogs are inherited verbatim from Phases 1–5 (already merged). This map is consumed by `gsd-planner` to write per-plan PLAN.md action sections.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/app/(app)/history/[sessionId].tsx` | route (screen) | request-response (read-only) + event-driven delete | `app/app/(app)/workout/[sessionId].tsx` (card-per-exercise) + `app/app/(app)/plans/[id].tsx` (inline-overlay-destructive-confirm) | exact (composite — two analogs combine) |
| `app/app/(app)/exercise/[exerciseId]/chart.tsx` | route (screen) | request-response (read-only, render) | `app/app/(app)/plans/[id].tsx` (centralised header + `useColorScheme` theme + `useExercisesQuery + Map<id,name>` lookup) | role-match (no prior chart route; pulls only the header + theme + lookup patterns) |
| `app/app/(app)/(tabs)/history.tsx` (MODIFIED) | route (tab list) | request-response (cursor-paginated read) | `app/app/(app)/(tabs)/index.tsx` (FlatList + empty-state + theme) | exact (same FlatList + empty-state shape, only `useInfiniteQuery` is new) |
| `app/app/(app)/plans/[id].tsx` (MODIFIED) | route (existing) | event-driven (icon tap → router.push) | itself — extends existing `PlanExerciseRow` inline component | exact (in-file siblings already; add Pressable sibling to row-end) |
| `app/lib/queries/exercise-chart.ts` | query-hook | request-response (RPC + Zod-parse) | `app/lib/queries/last-value.ts` (Phase 5 2-step + `useAuthStore` + `staleTime` override) + `app/lib/queries/sessions.ts` (single `useQuery` shape) | exact (last-value is the closest pattern for "read-only aggregate query with Zod parse + RLS-scoped") |
| `app/lib/queries/sessions.ts` (MODIFIED — add `useSessionsListInfiniteQuery`) | query-hook | request-response (cursor pagination) | itself — same file, follow `useActiveSessionQuery` shape + add `useInfiniteQuery` per RESEARCH §Pattern 1 | role-match (no prior `useInfiniteQuery` in repo; copy file conventions + apply v5 cursor-paginate API) |
| `app/lib/queries/sessions.ts` (MODIFIED — add `useDeleteSession`) | mutation hook | event-driven (DELETE + cascade) | `app/lib/queries/plans.ts` `useArchivePlan` | exact (same shape: mutate-not-mutateAsync, scope-bound, optimistic via setMutationDefaults) |
| `app/lib/query/keys.ts` (MODIFIED) | factory | n/a (key strings) | itself — extend `sessionsKeys`, add `exerciseChartKeys` mirroring `lastValueKeys.byExercise(id)` pattern | exact |
| `app/lib/query/client.ts` (MODIFIED — add `['session','delete']` default) | mutation config (module-scope) | event-driven | `['plan','archive']` block in same file (lines 335–366) | exact (same shape: optimistic filter-out from list cache + invalidate; only difference is the list cache is `sessionsKeys.listInfinite()` which has `{ pages, pageParams }` envelope — pattern documented in 06-RESEARCH.md Pitfall 6) |
| `app/scripts/test-exercise-chart.ts` (NEW — Wave 0) | test (Node tsx harness) | request-response (integration) | `app/scripts/test-last-value-query.ts` (closest harness — RPC analog uses `.rpc()` instead of `.from()` but the seed/assert/cleanup shape is identical) | exact |
| `app/scripts/test-rls.ts` (MODIFIED — extend with Phase 6 assertions) | test extension | request-response (cross-user gate) | itself — copy "Phase 5 extension" block at lines 606–786 verbatim, swap mutation shape for `rpc('get_session_summaries')` + DELETE on `workout_sessions` | exact |
| `app/supabase/migrations/0006_phase6_chart_rpcs.sql` (NEW) | migration (Postgres function) | n/a (DB schema) | `0004_exercise_sets_set_number_trigger.sql` (closest — `security invoker` + `set search_path = ''` + revoke/grant pattern; differs by being a trigger function vs SQL-language returning-table function) | role-match |

---

## Pattern Assignments

### `app/app/(app)/history/[sessionId].tsx` (route, request-response + event-driven delete)

**Primary analog (layout/card-per-exercise):** `app/app/(app)/workout/[sessionId].tsx`
**Secondary analog (inline-overlay-destructive-confirm):** `app/app/(app)/plans/[id].tsx`

**Imports pattern** (copy from `workout/[sessionId].tsx` lines 44-82, drop write-side imports):
```typescript
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { format, differenceInMinutes } from "date-fns";
import { sv } from "date-fns/locale";
import { useSessionQuery, useDeleteSession } from "@/lib/queries/sessions";
import { useSetsForSessionQuery } from "@/lib/queries/sets";
import { useExercisesQuery } from "@/lib/queries/exercises";
import { usePlanQuery } from "@/lib/queries/plans";
```

**Stack header opt-in pattern** (copy from `workout/[sessionId].tsx` lines 181-199, swap label):
```typescript
<Stack.Screen
  options={{
    headerShown: true,
    title: format(new Date(session.started_at), "d MMM yyyy", { locale: sv }),
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
```

**Loading-gate pattern** (copy from `plans/[id].tsx` lines 291-301 — gate on `!session`, not `isPending`):
```typescript
if (!session) {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 items-center justify-center">
        <Text className="text-base text-gray-500 dark:text-gray-400">
          Laddar…
        </Text>
      </View>
    </SafeAreaView>
  );
}
```

**Exercise-name lookup pattern** (copy from `workout/[sessionId].tsx` lines 233-240 — commit `3bfaba8`):
```typescript
const { data: exercises } = useExercisesQuery();
const exerciseNameById = useMemo(() => {
  const m = new Map<string, string>();
  for (const e of exercises ?? []) m.set(e.id, e.name);
  return m;
}, [exercises]);
```

**Card-per-exercise + set-list pattern** (copy from `workout/[sessionId].tsx` lines 420-475 — read-only variant, drop the inline-set-input row and inline RHF):
```typescript
// For each exercise group (filter setsForSession by exercise_id, sort by set_number):
<View className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
  <Pressable
    onPress={() => router.push(`/exercise/${exerciseId}/chart` as Href)}
    accessibilityRole="button"
    accessibilityLabel={`Visa graf för ${exerciseName}`}
  >
    <View className="flex-row items-start justify-between mb-2">
      <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50" numberOfLines={1}>
        {exerciseName}
      </Text>
    </View>
  </Pressable>
  <View className="gap-2 mt-2">
    {setsForThisExercise.map((set) => (
      <View key={set.id} className="flex-row gap-2">
        <Text className="text-base text-gray-500 dark:text-gray-400">
          {`Set ${set.set_number}:`}
        </Text>
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
          {`${set.weight_kg} × ${set.reps}`}
        </Text>
      </View>
    ))}
  </View>
</View>
```

**Inline-overlay delete-confirm pattern** (copy from `plans/[id].tsx` lines 616-716 — substitute archive→delete copy + mutation):
```typescript
{showDeleteConfirm && (
  <Pressable
    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
             alignItems: "center", justifyContent: "center",
             backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 32, zIndex: 2000 }}
    onPress={() => setShowDeleteConfirm(false)}
  >
    <Pressable
      style={{ width: "100%", maxWidth: 400,
               backgroundColor: isDark ? "#111827" : "#FFFFFF",
               borderRadius: 12, padding: 24, gap: 12 }}
      onPress={(e) => e.stopPropagation()}
    >
      <Text style={{ fontSize: 18, fontWeight: "600",
                     color: isDark ? "#F9FAFB" : "#111827" }}>
        Ta bort detta pass?
      </Text>
      <Text style={{ fontSize: 16, color: isDark ? "#9CA3AF" : "#6B7280" }}>
        {`${setCount} set och ${totalVolume} kg total volym försvinner permanent. Det går inte att ångra.`}
      </Text>
      {/* Avbryt + Ta bort buttons — identical structure */}
    </Pressable>
  </Pressable>
)}
```

**`useFocusEffect` overlay reset pattern** (copy from `plans/[id].tsx` lines 168-173 — commit `af6930c`):
```typescript
useFocusEffect(
  useCallback(() => {
    setShowOverflowMenu(false);
    setShowDeleteConfirm(false);
  }, []),
);
```

**Mutation invocation pattern** (copy from `plans/[id].tsx` lines 260-270 — commit `5d953b6` mutate-not-mutateAsync):
```typescript
const deleteSession = useDeleteSession(session.id);
const onDeleteConfirm = () => {
  setShowDeleteConfirm(false);
  deleteSession.mutate(
    { id: session.id },
    { onError: () => setBannerError("Kunde inte ta bort passet. Försök igen.") },
  );
  router.replace("/(tabs)/history" as Href);
};
```

**Differences to apply (not covered by analogs):**
- Summary-header (`{set_count} set · {total_volume} kg · {duration} min`) above first card — NEW visual block; reuses the chip-shell styling from `workout/[sessionId].tsx` lines 432-441 (`bg-gray-200 dark:bg-gray-700 rounded-full px-3 py-1`).
- Duration via `differenceInMinutes(finished_at, started_at)` — date-fns import is new for this route (workout-route doesn't compute duration); `'—'` fallback when `finished_at == null` per D-10.
- Plan-name display via `usePlanQuery(plan_id)` join WITHOUT `archived_at IS NULL` filter (D-08) — the existing `usePlanQuery` in `plans.ts` lines 67-85 already returns archived plans (only `usePlansQuery` filters them out at list-level); reuse as-is.
- Card-header is a Pressable that routes to `/exercise/<exerciseId>/chart` (D-11) — workout route's card-header is NOT pressable.
- No `WorkoutBody` defensive-empty wrapper — history-detail's empty pass is rendered with `0 set · 0 kg · X min` per D-13.

---

### `app/app/(app)/exercise/[exerciseId]/chart.tsx` (route, request-response read-only)

**Primary analog (centralised header + theme):** `app/app/(app)/plans/[id].tsx` (header pattern from lines 305-323; `useColorScheme()` accent binding from lines 105-108)
**Secondary analog (`useExercisesQuery + Map<id,name>` for header title):** `app/app/(app)/plans/[id].tsx` lines 119-124
**Tertiary analog (theme-aware backdrop convention):** `app/app/(app)/workout/[sessionId].tsx` line 177 + commit `6b8c604` (Phase 5 D-23)

**Imports pattern:**
```typescript
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CartesianChart, Line, Scatter, useChartPressState } from "victory-native";
import { Circle, useFont } from "@shopify/react-native-skia";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { useExercisesQuery } from "@/lib/queries/exercises";
import { useExerciseChartQuery, type ChartMetric, type ChartWindow } from "@/lib/queries/exercise-chart";
```

**Theme-aware accent + axes binding** (copy from `plans/[id].tsx` lines 105-108, extend to chart-specific colors per UI-SPEC D-23):
```typescript
const scheme = useColorScheme();
const isDark = scheme === "dark";
const muted = isDark ? "#9CA3AF" : "#6B7280";
const accent = isDark ? "#60A5FA" : "#2563EB";    // Chart line color (D-23)
const axisColor = isDark ? "#9CA3AF" : "#6B7280"; // Same as muted
const gridColor = isDark ? "#374151" : "#E5E7EB";
```

**Exercise-name resolution + dynamic header title** (copy from `plans/[id].tsx` lines 119-124 + 305-323, swap to exerciseId param):
```typescript
const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
const { data: exercises } = useExercisesQuery();
const exerciseName = useMemo(() => {
  const map = new Map((exercises ?? []).map((e) => [e.id, e.name] as const));
  return map.get(exerciseId!) ?? "Övning";
}, [exercises, exerciseId]);

<Stack.Screen options={{ headerShown: true, title: exerciseName }} />
```

**Memoized chart-data array** (NEW pattern per D-21; copy from RESEARCH §Example 2):
```typescript
const chartQuery = useExerciseChartQuery(exerciseId!, metric, window);
const chartData = useMemo(
  () => (chartQuery.data ?? []).map((row) => ({
    x: new Date(row.day).getTime(),
    y: row.value,
  })),
  [chartQuery.data],
);
```

**Conditional render for graceful-degrade** (per D-17 — render EmptyState INSTEAD of empty chart frame):
```typescript
if (chartData.length === 0) return <ChartEmptyState message="Inga pass än för den här övningen." caption="Logga minst 2 set för att se trend." />;
// chartData.length === 1: render the chart anyway — Victory Native XL renders a single dot automatically
```

**Victory Native XL chart pattern** (NEW — copy from 06-RESEARCH.md §Pattern 2 verbatim; no in-repo analog exists):
```typescript
const font = useFont(null, 12);
const { state, isActive } = useChartPressState({ x: 0, y: { y: 0 } });

<View style={{ height: 240 }}>
  <CartesianChart
    data={chartData}
    xKey="x"
    yKeys={["y"]}
    chartPressState={state}
    domainPadding={{ left: 16, right: 16, top: 16, bottom: 16 }}
    axisOptions={{
      font,
      tickCount: 5,
      labelColor: axisColor,
      lineColor: gridColor,
      formatXLabel: (ms: number) => format(new Date(ms), "MMM d", { locale: sv }),
    }}
  >
    {({ points }) => (
      <>
        <Line points={points.y} color={accent} strokeWidth={2} curveType="natural" />
        <Scatter points={points.y} radius={4} color={accent} />
        {isActive && (
          <Circle cx={state.x.position} cy={state.y.y.position} r={6} color={accent} />
        )}
      </>
    )}
  </CartesianChart>
</View>
```

**"Senaste 10 passen" list-row pattern** (copy row-shape from `(tabs)/index.tsx` lines 238-263 — Pressable that routes back to `/history/<sessionId>`):
```typescript
<Pressable
  onPress={() => router.push(`/history/${row.session_id}` as Href)}
  accessibilityRole="button"
  className="flex-row items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-4 active:opacity-80"
>
  <View className="flex-1 mr-2">
    <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
      {format(new Date(row.completed_at), "d MMM yyyy", { locale: sv })}
    </Text>
    <Text className="text-base text-gray-500 dark:text-gray-400">
      {`${row.weight_kg} kg × ${row.reps} reps`}
    </Text>
  </View>
  <Ionicons name="chevron-forward" size={20} color={muted} />
</Pressable>
```

**Differences to apply:**
- Segmented control (metric-toggle + window-toggle) — NEW component (`app/components/segmented-control.tsx`); no in-repo analog. UI-SPEC §Visuals "Segmented Control" specifies the NativeWind shape: `<View className="flex-row rounded-lg bg-gray-100 dark:bg-gray-800 p-1">` + per-segment `<Pressable className={cn("flex-1 py-2 rounded-md", selected && "bg-white dark:bg-gray-700 shadow")}>`.
- Empty-state component — UI-SPEC suggests extraction to `app/components/empty-state.tsx`, but `(tabs)/index.tsx` lines 215-237 already inlines the pattern (Ionicons + heading + body + CTA); planner can choose inline-vs-component.
- No `useFocusEffect` overlay reset — this route has no destructive-confirm overlay (chart is pure read).
- Two state vars only: `metric` (default `'weight'`) and `window` (default `'3M'` per D-15).
- Tooltip via Skia render-prop child — see RESEARCH §Pattern 2; never an RN `<Text>` inside the canvas.

---

### `app/app/(app)/(tabs)/history.tsx` (route MODIFIED, request-response cursor-paginated read)

**Primary analog:** `app/app/(app)/(tabs)/index.tsx` (FlatList + empty-state + dark-mode + accent + Display heading)

**Imports pattern** (copy from `(tabs)/index.tsx` lines 79-92, swap plan imports for session imports):
```typescript
import { useMemo } from "react";
import { useRouter, type Href } from "expo-router";
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { useSessionsListInfiniteQuery } from "@/lib/queries/sessions";
```

**Screen heading + FlatList composition** (copy from `(tabs)/index.tsx` lines 196-265, replace with cursor-paginated wiring per RESEARCH §Example 5 + §Pattern 1):
```typescript
const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isRefetching, refetch, status } =
  useSessionsListInfiniteQuery();
const sessions = useMemo(() => data?.pages.flat() ?? [], [data?.pages]);
const isEmpty = sessions.length === 0;

return (
  <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
    {!isEmpty && (
      <View className="px-4 pt-4 pb-2">
        <Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">Historik</Text>
      </View>
    )}
    <FlatList
      data={sessions}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96, flexGrow: 1 }}
      ItemSeparatorComponent={() => <View className="h-2" />}
      onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator size="small" color={accent} /> : null}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={accent} />}
      ListEmptyComponent={status === "pending" ? null : <HistoryEmptyState />}
      renderItem={({ item }) => <HistoryListRow session={item} />}
    />
  </SafeAreaView>
);
```

**HistoryListRow shape** (copy plan-row from `(tabs)/index.tsx` lines 238-263, swap copy):
```typescript
<Pressable
  onPress={() => router.push(`/history/${session.id}` as Href)}
  accessibilityRole="button"
  accessibilityLabel={`Öppna pass från ${format(new Date(session.started_at), "d MMM yyyy", { locale: sv })}`}
  className="flex-row items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-4 active:opacity-80"
>
  <View className="flex-1 mr-2">
    <Text className="text-base font-semibold text-gray-900 dark:text-gray-50" numberOfLines={1}>
      {format(new Date(session.started_at), "d MMM yyyy", { locale: sv })}
    </Text>
    <Text className="text-base text-gray-500 dark:text-gray-400" numberOfLines={1}>
      {session.plan_name ?? "— ingen plan"}
    </Text>
  </View>
  <View className="items-end">
    <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400">{`${session.set_count} set`}</Text>
    <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400">{`${formatNumber(session.total_volume_kg)} kg`}</Text>
  </View>
</Pressable>
```

**Empty-state pattern** (copy from `(tabs)/index.tsx` lines 215-237, swap icon + copy):
```typescript
<View className="flex-1 items-center justify-center gap-6 px-4">
  <Ionicons name="time-outline" size={64} color={accent} />
  <View className="gap-2 items-center">
    <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Inga pass än</Text>
    <Text className="text-base text-gray-500 dark:text-gray-400">Starta ditt första pass från en plan.</Text>
  </View>
  <Pressable
    onPress={() => router.push("/(tabs)" as Href)}
    accessibilityRole="button"
    accessibilityLabel="Gå till planer"
    className="rounded-lg bg-blue-600 dark:bg-blue-500 px-6 py-4 active:opacity-80"
  >
    <Text className="text-base font-semibold text-white">Gå till planer</Text>
  </Pressable>
</View>
```

**Differences to apply:**
- `useInfiniteQuery` instead of `useQuery` — new pattern; planner imports from `@tanstack/react-query`. Page flatten via `useMemo(() => data?.pages.flat() ?? [], [data?.pages])`.
- `RefreshControl` + `ListFooterComponent={isFetchingNextPage ? <ActivityIndicator/> : null}` — neither appears in `(tabs)/index.tsx` (the plan-list is not paginated).
- `onEndReached` + `onEndReachedThreshold={0.5}` + `hasNextPage` guard (RESEARCH Pitfall 3).
- No FAB (history tab doesn't create rows from inside the tab — users start from `(tabs)/index.tsx` plans).
- `formatNumber` helper for the `3 240` non-breaking-space thousands separator (Swedish convention per UI-SPEC) — small local utility, no analog.

---

### `app/app/(app)/plans/[id].tsx` (MODIFIED — add chart-ikon per `plan_exercise` row)

**Primary analog:** itself — extend the inline `PlanExerciseRow` component (lines 737-803) by adding ONE more sibling Pressable to the existing `flex-row` row.

**Existing row composition** (lines 756-802 — read for the structure to extend):
```typescript
<View className={`flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-4 ${
  isActive ? "opacity-80" : ""
}`}>
  <Pressable onLongPress={drag} ... className="p-3"><Ionicons name="reorder-three-outline" .../></Pressable>
  <View className="flex-1 mx-2"> {/* exercise name + target chip */} </View>
  <Pressable onPress={onEdit} className="p-2"><Ionicons name="chevron-forward" .../></Pressable>
  <Pressable onPress={onRemove} className="p-2"><Ionicons name="close-outline" .../></Pressable>
</View>
```

**Pattern to apply — sibling chart-icon Pressable** (place BETWEEN the `<View className="flex-1 mx-2">` name-block and the existing edit-chevron Pressable; UI-SPEC §Visuals "Plan-detail chart-ikon" specifies icon `stats-chart` + accent color + p-3 hit-target):
```typescript
<Pressable
  onPress={() => router.push(`/exercise/${planExercise.exercise_id}/chart` as Href)}
  accessibilityRole="button"
  accessibilityLabel="Visa graf för övningen"
  className="p-3 active:opacity-80"
  hitSlop={4}
>
  <Ionicons name="stats-chart" size={22} color={accent} />
</Pressable>
```

**Differences to apply:**
- The `accent` color is already in scope at the outer `PlanDetailScreen` (line 108) but NOT inside `PlanExerciseRow` — pass it down as a prop (mirror the existing `muted` prop wiring on line 752) or destructure from `useColorScheme()` inside the row component.
- Plan_exercise rows live inside `DraggableFlatList`; the icon Pressable is a SIBLING of the drag-handle Pressable (NOT nested) so the tap doesn't bubble (06-RESEARCH.md Pitfall 8).
- `router` is already in scope at `PlanDetailScreen` (line 103) but NOT inside `PlanExerciseRow` — pass `onShowChart={() => router.push(...)}` as a prop, mirroring the existing `onEdit` + `onRemove` callbacks (line 522-533 in parent).

---

### `app/lib/queries/exercise-chart.ts` (NEW query-hook, request-response RPC)

**Primary analog:** `app/lib/queries/last-value.ts` (full file — closest read-side hook with Zod-parse + RLS-scoped + staleTime override)
**Secondary analog (RPC `.rpc()` shape):** none in-repo; copy from 06-RESEARCH.md §Pattern 4

**File-level conventions** (copy from `last-value.ts` lines 1-46 — comment header pattern):
- Comment block explaining the query shape + RLS gate + Zod parse boundary
- Reference to CONTEXT decisions, RESEARCH section, PITFALLS

**Imports pattern** (mirror `last-value.ts` lines 43-47):
```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { exerciseChartKeys } from "@/lib/query/keys";
import { subMonths, subYears } from "date-fns";
import { z } from "zod";
```

**Type + schema pattern** (NEW — no in-repo precedent for RPC response schema; copy RESEARCH §Pattern 4):
```typescript
export type ChartMetric = "weight" | "volume";
export type ChartWindow = "1M" | "3M" | "6M" | "1Y" | "All";

const ChartRowSchema = z.object({
  day: z.string(),            // ISO timestamp from date_trunc
  value: z.coerce.number(),   // numeric → JS number
});
export type ChartRow = z.infer<typeof ChartRowSchema>;
```

**Query hook pattern** (compose: `last-value.ts` lines 55-122 shape + RESEARCH §Pattern 4 `.rpc()` invocation + Zod-parse-array per Pitfall 8.13):
```typescript
function windowToSince(window: ChartWindow): string | null {
  const now = new Date();
  switch (window) {
    case "1M": return subMonths(now, 1).toISOString();
    case "3M": return subMonths(now, 3).toISOString();
    case "6M": return subMonths(now, 6).toISOString();
    case "1Y": return subYears(now, 1).toISOString();
    case "All": return null;
  }
}

export function useExerciseChartQuery(exerciseId: string, metric: ChartMetric, window: ChartWindow) {
  return useQuery<ChartRow[]>({
    queryKey: exerciseChartKeys.byExercise(exerciseId, metric, window),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_exercise_chart", {
        p_exercise_id: exerciseId,
        p_metric: metric,
        p_since: windowToSince(window),
      });
      if (error) throw error;
      return (data ?? []).map((row: unknown) => ChartRowSchema.parse(row));
    },
    enabled: !!exerciseId,
  });
}
```

**Differences to apply (vs last-value.ts):**
- Uses `.rpc('get_exercise_chart', ...)` instead of `.from('exercise_sets').select(...)` — server owns the aggregate. No 2-step pattern needed.
- `staleTime` inherits from QueryClient default (30s) — no override (chart data refreshes when user toggles metric/window, both of which are in the queryKey).
- Cache key includes `metric` + `window` (each toggle combo = its own cache slot per 06-CONTEXT.md `exerciseChartKeys.byExercise(id, metric, window)`).
- Zod parses every row in the array (Pitfall 8.13) — same boundary as `SetRowSchema.partial().parse(s)` in `last-value.ts` line 103.
- Optional `useSessionsListInfiniteQuery` for F9 (RESEARCH §Pattern 1) belongs in `sessions.ts` (extension), NOT in this file.

---

### `app/lib/queries/sessions.ts` — MODIFIED — add `useSessionsListInfiniteQuery` + `useDeleteSession`

**`useSessionsListInfiniteQuery` primary analog:** itself + RESEARCH §Pattern 1 (no in-repo `useInfiniteQuery` precedent)
**`useDeleteSession` primary analog:** `app/lib/queries/plans.ts` `useArchivePlan` (lines 126-131)

**`useSessionsListInfiniteQuery` pattern** (copy RESEARCH §Pattern 1 verbatim — file-level imports of `useInfiniteQuery` + `useAuthStore` already exist):
```typescript
const PAGE_SIZE = 20;

export type SessionSummary = {
  id: string;
  user_id: string;
  plan_id: string | null;
  started_at: string;
  finished_at: string | null;
  plan_name: string | null;
  set_count: number;
  total_volume_kg: number;
};

const SessionSummarySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  plan_id: z.string().uuid().nullable(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  plan_name: z.string().nullable(),
  set_count: z.coerce.number(),
  total_volume_kg: z.coerce.number(),
});

export function useSessionsListInfiniteQuery() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useInfiniteQuery({
    queryKey: sessionsKeys.listInfinite(),
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const { data, error } = await supabase.rpc("get_session_summaries", {
        p_cursor: pageParam,
        p_page_size: PAGE_SIZE,
      });
      if (error) throw error;
      return (data ?? []).map((row: unknown) => SessionSummarySchema.parse(row));
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: SessionSummary[]) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1]?.started_at ?? undefined;
    },
    enabled: !!userId,
  });
}
```

**`useDeleteSession` pattern** (copy from `plans.ts` `useArchivePlan` lines 126-131 verbatim, swap name + type):
```typescript
type SessionDeleteVars = { id: string };

export function useDeleteSession(sessionId?: string) {
  return useMutation<void, Error, SessionDeleteVars>({
    mutationKey: ["session", "delete"] as const,
    scope: sessionId ? { id: `session:${sessionId}` } : undefined,
  });
}
```

**Differences to apply:**
- New import: `useInfiniteQuery` from `@tanstack/react-query` (existing file only imports `useMutation` + `useQuery`).
- New import: `z` from `zod` (existing file does not validate at this level — but Pitfall 8.13 requires Zod-parse on the new RPC response which has columns not present in `sessionRowSchema`).
- The `SessionSummary` shape is a SUPERSET of `SessionRow` (adds `plan_name` + `set_count` + `total_volume_kg`) — declared inline here, not in `lib/schemas/sessions.ts` (per CONTEXT.md note: "lib/schemas/sessions.ts unchanged in Phase 6").
- Per Pitfall 8 in RESEARCH §A8: planner MUST also add `void queryClient.invalidateQueries({ queryKey: sessionsKeys.listInfinite() })` to the existing `['session','finish']` setMutationDefaults `onSettled` block in `client.ts` (line 697-704) so newly-finished sessions appear in history without waiting for staleTime.

---

### `app/lib/query/keys.ts` (MODIFIED — extend `sessionsKeys`, add `exerciseChartKeys`)

**Primary analog:** itself (lines 47-63 for the `sessionsKeys` + `lastValueKeys` shape).

**Existing `sessionsKeys`** (line 47-52 — extend with `listInfinite`):
```typescript
export const sessionsKeys = {
  all: ["sessions"] as const,
  list: () => [...sessionsKeys.all, "list"] as const,
  detail: (id: string) => [...sessionsKeys.all, "detail", id] as const,
  active: () => [...sessionsKeys.all, "active"] as const,
  // Phase 6 — F9 cursor-paginated infinite list.
  listInfinite: () => [...sessionsKeys.all, "list-infinite"] as const,
};
```

**New `exerciseChartKeys`** (mirror `lastValueKeys.byExercise(id)` pattern on lines 59-63, extend the param-tuple with metric + window):
```typescript
export const exerciseChartKeys = {
  all: ["exercise-chart"] as const,
  byExercise: (
    exerciseId: string,
    metric: "weight" | "volume",
    window: "1M" | "3M" | "6M" | "1Y" | "All",
  ) => [...exerciseChartKeys.all, "by-exercise", exerciseId, metric, window] as const,
};
```

**Differences to apply:**
- Pure additive — no removals or renames. Existing keys untouched.
- Each (exerciseId, metric, window) is a distinct cache slot — toggling metric or window produces a new key + new cache miss + new fetch.

---

### `app/lib/query/client.ts` (MODIFIED — add `['session','delete']` setMutationDefaults)

**Primary analog:** `['plan','archive']` block in same file (lines 335-366).

**Excerpt from `['plan','archive']` (lines 338-366) — the SHAPE to copy:**
```typescript
queryClient.setMutationDefaults(["plan", "archive"], {
  mutationFn: async (vars: PlanArchiveVars) => {
    const { data, error } = await supabase
      .from("workout_plans")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", vars.id)
      .select()
      .single();
    if (error) throw error;
    return PlanRowSchema.parse(data);
  },
  onMutate: async (vars: PlanArchiveVars) => {
    await queryClient.cancelQueries({ queryKey: plansKeys.list() });
    const previous = queryClient.getQueryData<PlanRow[]>(plansKeys.list());
    queryClient.setQueryData<PlanRow[]>(plansKeys.list(), (old = []) =>
      old.filter((r) => r.id !== vars.id),
    );
    return { previous };
  },
  onError: (_err, _vars, ctx) => {
    const c = ctx as { previous?: PlanRow[] } | undefined;
    if (c?.previous) queryClient.setQueryData(plansKeys.list(), c.previous);
  },
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: plansKeys.list() });
  },
  retry: 1,
});
```

**Pattern to apply for `['session','delete']`** (copy RESEARCH §Pattern 6 verbatim — the only structural difference from archive is the InfiniteQuery `{ pages, pageParams }` envelope per Pitfall 6):
```typescript
queryClient.setMutationDefaults(["session", "delete"], {
  mutationFn: async (vars: SessionDeleteVars) => {
    const { error } = await supabase
      .from("workout_sessions")
      .delete()
      .eq("id", vars.id);
    if (error) throw error;
    return undefined as void;
  },
  onMutate: async (vars: SessionDeleteVars) => {
    await queryClient.cancelQueries({ queryKey: sessionsKeys.listInfinite() });
    await queryClient.cancelQueries({ queryKey: sessionsKeys.detail(vars.id) });
    const previousList = queryClient.getQueryData<{
      pages: SessionSummary[][];
      pageParams: (string | null)[];
    }>(sessionsKeys.listInfinite());
    const previousDetail = queryClient.getQueryData(sessionsKeys.detail(vars.id));
    if (previousList) {
      queryClient.setQueryData(sessionsKeys.listInfinite(), {
        ...previousList,
        pages: previousList.pages.map((page) => page.filter((s) => s.id !== vars.id)),
      });
    }
    queryClient.setQueryData(sessionsKeys.detail(vars.id), undefined);
    return { previousList, previousDetail };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as { previousList?: unknown; previousDetail?: unknown } | undefined;
    if (c?.previousList) queryClient.setQueryData(sessionsKeys.listInfinite(), c.previousList);
    if (c?.previousDetail !== undefined) queryClient.setQueryData(sessionsKeys.detail(vars.id), c.previousDetail);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.listInfinite() });
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(vars.id) });
    void queryClient.invalidateQueries({ queryKey: setsKeys.list(vars.id) });
  },
  retry: 1,
});
```

**Differences to apply (vs `['plan','archive']`):**
- Mutation type is `void` (DELETE returns no row body) vs `PlanRow` (UPDATE returns row).
- List cache shape is `{ pages, pageParams }` envelope (`useInfiniteQuery`) vs flat `PlanRow[]` array — Pitfall 6 explicitly documents the common error. Must `.pages.map(page => page.filter(...))` not `.filter()` directly.
- Also invalidates `sessionsKeys.detail(id)` AND `setsKeys.list(id)` — `archive` only invalidates the list.
- Existing `['session','finish']` block (lines 653-706) ALSO needs `void queryClient.invalidateQueries({ queryKey: sessionsKeys.listInfinite() })` appended to its `onSettled` (per RESEARCH §A8 — Phase 6 plan must include this line-edit).

---

### `app/scripts/test-rls.ts` (MODIFIED — Phase 6 cross-user assertions)

**Primary analog:** itself — "Phase 5 extension" block at lines 606-786 (the prior-phase additive pattern is the verbatim template).

**Excerpt from Phase 5 extension (lines 630-694) — SHAPE to copy:**
```typescript
console.log(
  "[test-rls] Phase 5 extension — workout_sessions + exercise_sets new-shape cross-user gates…",
);

// ---- workout_sessions UPDATE finished_at cross-user (F8 finish path) ----
assertWriteBlocked(
  "Phase 5 extension: A cannot UPDATE finished_at on B's workout_session (F8 cross-user)",
  await clientA
    .from("workout_sessions")
    .update({ finished_at: new Date().toISOString() })
    .eq("id", sessB.id)
    .select(),
);
```

**Pattern to apply for Phase 6** (add NEW block after line 786 — same console.log + assertWriteBlocked + admin defense-in-depth):
```typescript
console.log(
  "[test-rls] Phase 6 extension — history-list RPC + delete-session cross-user gates…",
);

// ---- workout_sessions DELETE cross-user (F9 delete-pass path) ----
assertWriteBlocked(
  "Phase 6 extension: A cannot DELETE B's workout_session (F9 delete cross-user)",
  await clientA
    .from("workout_sessions")
    .delete()
    .eq("id", sessB.id)
    .select(),
);

// ---- get_session_summaries RPC cross-user (F9 list path) ----
// A's anon client calls get_session_summaries — RLS scopes server-side to A's
// sessions only; B's sessB.id must NOT appear in the response.
{
  const { data: summariesAsA, error: summariesErr } = await clientA.rpc(
    "get_session_summaries",
    { p_cursor: null, p_page_size: 100 },
  );
  if (summariesErr) {
    fail("Phase 6 extension: get_session_summaries RPC returned error for A", { error: summariesErr });
  } else if (summariesAsA?.some((s: { id: string }) => s.id === sessB.id)) {
    fail("Phase 6 extension: A's get_session_summaries leaked B's session", { sessBId: sessB.id });
  } else {
    pass("Phase 6 extension: A's get_session_summaries does not surface B's sessions");
  }
}

// ---- get_exercise_chart RPC cross-user (F10 chart path) ----
// A calls get_exercise_chart with B's exercise_id — RLS on exercise_sets +
// workout_sessions scopes via parent-FK EXISTS, so result is empty (not error).
{
  const { data: chartAsA, error: chartErr } = await clientA.rpc(
    "get_exercise_chart",
    { p_exercise_id: exB.id, p_metric: "weight", p_since: null },
  );
  if (chartErr) {
    fail("Phase 6 extension: get_exercise_chart RPC returned error for A on B's exercise", { error: chartErr });
  } else if (chartAsA && chartAsA.length > 0) {
    fail("Phase 6 extension: A's get_exercise_chart leaked B's exercise sets", { count: chartAsA.length });
  } else {
    pass("Phase 6 extension: A's get_exercise_chart on B's exercise returns empty (RLS-filtered)");
  }
}

// ---- Defense-in-depth: B's session survives A's delete attempt ----
console.log("[test-rls] Phase 6 extension — defense-in-depth: B's session survives…");
{
  const { data: sessBStillThere, error: sessBErr } = await admin
    .from("workout_sessions")
    .select("id")
    .eq("id", sessB.id)
    .maybeSingle();
  if (sessBErr || !sessBStillThere) {
    fail("Phase 6 extension: B's session was deleted by A's attempt", { error: sessBErr });
  } else {
    pass("Phase 6 extension: B's session survived A's DELETE attempt");
  }
}

// ---- Owner DELETE cascades to exercise_sets (FK on delete cascade) ----
// Seed a fresh session+set for User A, then delete the session as A and
// verify the set was cascaded away.
{
  const cascadeSessionId = randomUUID();
  {
    const { error } = await admin.from("workout_sessions").insert({
      id: cascadeSessionId, user_id: userA.id, plan_id: null,
      started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
    });
    if (error) throw new Error(`seed cascade session: ${error.message}`);
  }
  const cascadeSetId = randomUUID();
  {
    const { error } = await admin.from("exercise_sets").insert({
      id: cascadeSetId, session_id: cascadeSessionId, exercise_id: exA.id,
      set_number: 1, reps: 5, weight_kg: 100, set_type: "working",
    });
    if (error) throw new Error(`seed cascade set: ${error.message}`);
  }
  const { error: delErr } = await clientA.from("workout_sessions").delete().eq("id", cascadeSessionId);
  if (delErr) {
    fail("Phase 6 extension: A's own session DELETE failed", { error: delErr });
  } else {
    const { data: setStillThere } = await admin
      .from("exercise_sets")
      .select("id")
      .eq("id", cascadeSetId)
      .maybeSingle();
    if (setStillThere) {
      fail("Phase 6 extension: FK on delete cascade FAILED — set survived session delete", { cascadeSetId });
    } else {
      pass("Phase 6 extension: FK on delete cascade purged exercise_sets when session deleted");
    }
  }
}
```

**Differences to apply (vs Phase 5 extension):**
- Uses `clientA.rpc('...', { ... })` for the new RPC calls — Phase 5 block doesn't touch `.rpc()`. The `.select()` chain isn't applicable (RPC response is `{ data, error }` directly).
- Cross-user RPC test expects EMPTY data (not error) — per Assumption A6 in RESEARCH: PostgREST .rpc() bubbles RLS-denied rows as empty data, same as `.from().select()`.
- Seeds a fresh session+set for the cascade assertion (existing `sessB` + `setB` are owned by B; we need owner-controlled rows to verify the cascade works for the FIRST-PARTY path).
- Owner-delete is **not** `assertWriteBlocked` — it's `assertWriteSucceeds` then verify cascade. Uses the existing `pass`/`fail` helpers directly; doesn't need a new helper.

---

### `app/scripts/test-exercise-chart.ts` (NEW — Wave 0)

**Primary analog:** `app/scripts/test-last-value-query.ts` (full file — 600+ lines closest match: env guard + 3 clients + cleanup + seed-finished-session helper + 5 assertions with RPC-equivalent of the 2-step query).

**Header + env-guard + clients + cleanup pattern** (copy from `test-last-value-query.ts` lines 1-134 verbatim, swap prefix):
```typescript
// File: app/scripts/test-exercise-chart.ts
//
// Phase 6 Wave 0 — proves the F9 get_session_summaries + F10 get_exercise_chart
// RPC functions are correct AND that RLS scopes via SECURITY INVOKER.
//
// Asserts:
//   1. get_session_summaries(NULL, 20) returns User A's finished sessions DESC
//      sorted by started_at with set_count + total_volume_kg aggregated.
//   2. Cursor pagination terminates: seed 25, fetch (20, 5, 0).
//   3. get_session_summaries excludes finished_at IS NULL sessions (draft).
//   4. get_session_summaries left-joins plans WITHOUT archived_at filter (D-08).
//   5. get_exercise_chart('weight', 90 days ago) returns max(weight_kg) per day.
//   6. get_exercise_chart('volume') returns sum(weight_kg * reps) per day.
//   7. set_type filter — warmup sets excluded from chart aggregate.
//   8. Cross-user RLS — B's RPC call returns empty for A's data.
//
// Run via: cd app && npm run test:exercise-chart

const TEST_EMAIL_PREFIX = "chart-test-";
// ... rest of env-guard + 3 clients + cleanup unchanged from test-last-value-query.ts
```

**Seed helper pattern** (copy from `test-last-value-query.ts` lines 246-285 `seedFinishedSession`):
```typescript
async function seedFinishedSession(
  userId: string,
  exerciseId: string,
  setCount: number,
  weightStart: number,
  finishedOffsetMs: number,
): Promise<string> {
  // Same shape as test-last-value-query.ts — insert session, then N sets
  // with progressively higher weight_kg. Swap exerciseAId for parameterized.
}
```

**RPC invocation pattern** (NEW — no analog uses .rpc(); copy from 06-RESEARCH.md §Pattern 3 + 4):
```typescript
const { data, error } = await clientA.rpc("get_session_summaries", {
  p_cursor: null,
  p_page_size: 20,
});
if (error) throw error;
assertEq("Assertion 1: 5 finished sessions returned (most-recent first)", data?.length, 5);
```

**Differences to apply (vs test-last-value-query.ts):**
- Uses `.rpc()` not `.from().select(...)` — different call shape.
- Two RPC functions to cover (`get_session_summaries` + `get_exercise_chart`) — distinct seed shapes per assertion.
- Cursor-pagination test is new (Phase 5 didn't have one) — seed 25 sessions, fetch (page 1 by cursor=null → 20 rows, page 2 by cursor=row20.started_at → 5 rows, page 3 by cursor=row25.started_at → 0 rows).
- New npm script: `app/package.json` `"test:exercise-chart": "tsx --env-file=.env.local scripts/test-exercise-chart.ts"` (mirror existing `test:last-value-query` line).

---

### `app/supabase/migrations/0006_phase6_chart_rpcs.sql` (NEW)

**Primary analog:** `app/supabase/migrations/0004_exercise_sets_set_number_trigger.sql` (closest — `security invoker` + `set search_path = ''` + grant/revoke + comment header)
**Secondary analog (table-DDL shape):** `0001_initial_schema.sql` lines 60-90 + 100-145 (for the `idx_exercise_sets_exercise` index reference + RLS policy precedent — Phase 6 does NOT add new policies).

**Comment-header pattern** (copy from `0004_exercise_sets_set_number_trigger.sql` lines 1-30):
```sql
-- ============================================================================
-- Phase 6 — Migration 0006
--
-- Two RPC functions for read-side polish:
--   - get_session_summaries(cursor, page_size) for F9 cursor-paginated list
--   - get_exercise_chart(exercise_id, metric, since) for F10 chart aggregate
--
-- Both functions are SECURITY INVOKER (default — NO `security definer`) so
-- they respect RLS on workout_sessions + exercise_sets + workout_plans.
--
-- Defense-in-depth: `set search_path = ''` per CLAUDE.md security conventions
-- (Pitfall 7). All schema references inside function bodies are fully qualified.
--
-- Function identifiers are referenced by app/scripts/verify-deploy.ts
-- (pg_proc output).
-- ============================================================================
```

**Function pattern** (copy `0004` lines 32-56 STRUCTURE; replace plpgsql body with `language sql` returning-table per RESEARCH §Pattern 3 + 4):
```sql
create or replace function public.get_session_summaries(
  p_cursor timestamptz,
  p_page_size int default 20
)
returns table (
  id uuid,
  user_id uuid,
  plan_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  plan_name text,
  set_count bigint,
  total_volume_kg numeric
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    s.id, s.user_id, s.plan_id, s.started_at, s.finished_at,
    p.name as plan_name,
    coalesce(count(es.id), 0)::bigint as set_count,
    coalesce(sum(es.weight_kg * es.reps), 0) as total_volume_kg
  from public.workout_sessions s
  left join public.workout_plans p on p.id = s.plan_id
  left join public.exercise_sets es on es.session_id = s.id and es.set_type = 'working'
  where s.finished_at is not null
    and (p_cursor is null or s.started_at < p_cursor)
  group by s.id, p.name
  order by s.started_at desc
  limit p_page_size;
$$;

revoke all on function public.get_session_summaries(timestamptz, int) from public;
grant execute on function public.get_session_summaries(timestamptz, int) to authenticated;
```

**Second function** (same structure — get_exercise_chart per RESEARCH §Pattern 4):
```sql
create or replace function public.get_exercise_chart(
  p_exercise_id uuid,
  p_metric text,
  p_since timestamptz
)
returns table (
  day timestamptz,
  value numeric
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    date_trunc('day', es.completed_at) as day,
    case
      when p_metric = 'weight' then max(es.weight_kg)
      when p_metric = 'volume' then sum(es.weight_kg * es.reps)
    end as value
  from public.exercise_sets es
  inner join public.workout_sessions s
    on s.id = es.session_id
   and s.finished_at is not null
  where es.exercise_id = p_exercise_id
    and es.set_type = 'working'
    and (p_since is null or es.completed_at >= p_since)
  group by date_trunc('day', es.completed_at)
  order by date_trunc('day', es.completed_at) asc;
$$;

revoke all on function public.get_exercise_chart(uuid, text, timestamptz) from public;
grant execute on function public.get_exercise_chart(uuid, text, timestamptz) to authenticated;
```

**Differences to apply (vs migration 0004):**
- `language sql` returning-table function vs `language plpgsql` trigger function.
- TWO functions in one migration file (vs one trigger + one function in 0004) — naming the file `0006_phase6_chart_rpcs.sql` (plural).
- `stable` volatility marker (pure read) — 0004 doesn't have this because trigger functions are necessarily `volatile`.
- `revoke all from public + grant execute to authenticated` — 0004's trigger function doesn't need this (triggers fire as the inserting user automatically); RPC functions DO need explicit grant for the anon client to call them.
- Post-migration: `npm run gen:types` is REQUIRED so `Database['public']['Functions']['get_session_summaries']['Returns']` is emitted (Pitfall 4); commit `types/database.ts` in the same commit as the migration per CLAUDE.md "Database conventions".

---

## Shared Patterns

### Authentication / RLS scoping

**Source:** `app/lib/supabase.ts` (typed client) + `app/lib/auth-store.ts` (Zustand) + Phase 2 RLS policies in `0001_initial_schema.sql` (lines 110-144)

**Apply to:** All new resource hooks (`useExerciseChartQuery`, `useSessionsListInfiniteQuery`) and the `client.ts` `['session','delete']` mutationFn.

- Resource hooks call `supabase.rpc(...)` or `supabase.from(...).delete()` directly — RLS scoping is server-side (no client-side `user_id` filter needed for RPC, since `security invoker` + parameterized policies auto-scope).
- `useAuthStore((s) => s.session?.user.id)` is the canonical `useAuthStore` selector — copy from `sessions.ts` line 49 / `last-value.ts` line 59. Only needed when the queryFn needs to refuse to run for anonymous users (the `enabled: !!userId` gate).
- New RPC functions in `0006_phase6_chart_rpcs.sql` use `security invoker` — NOT `security definer`. Cite Phase 2 convention.

### Error handling

**Source:** `app/lib/queries/sessions.ts` line 60-63 (`if (error) throw error;` pattern), `app/app/(app)/plans/[id].tsx` lines 211-213 (`onError: () => setBannerError("Något gick fel. Försök igen.")` pattern).

**Apply to:** All Phase 6 queryFns + mutate() call-sites.

- QueryFn: `if (error) throw error;` after every Supabase call. TanStack converts to `query.error` automatically.
- Mutation call-site: `mutate(vars, { onError: () => setBannerError("Kunde inte X. Försök igen.") })` — Swedish inline error per Phase 3 D-15.
- Loading-state copy: `'Laddar…'` for queries; never blank screen. Copy from `plans/[id].tsx` line 296.

### Validation (Zod parse boundary)

**Source:** `app/lib/queries/sessions.ts` line 63 (`SessionRowSchema.parse(data)`), `app/lib/queries/last-value.ts` line 103 (`SetRowSchema.partial().parse(s)`)

**Apply to:** Every `.rpc()` response in Phase 6 — `SessionSummarySchema.parse(row)` for `get_session_summaries`, `ChartRowSchema.parse(row)` for `get_exercise_chart`.

- Pitfall 8.13 — generated types from `gen:types` are compile-time only; runtime parse is the actual guard.
- Schemas live with the query hook that uses them (`exercise-chart.ts` for `ChartRowSchema`, `sessions.ts` for `SessionSummarySchema`) — NOT in `lib/schemas/` (CONTEXT.md explicitly notes `lib/schemas/sessions.ts` is unchanged in Phase 6).

### Theme-aware colors (`useColorScheme()`)

**Source:** `app/app/(app)/plans/[id].tsx` lines 105-108 + `workout/[sessionId].tsx` line 177 (commit `6b8c604`).

**Apply to:** Both new routes (`history/[sessionId].tsx` + `exercise/[exerciseId]/chart.tsx`) and the chart's Skia primitives.

- Standard accent: `isDark ? "#60A5FA" : "#2563EB"` (blue-400 dark / blue-600 light) — D-23 chart-line color matches.
- Standard muted: `isDark ? "#9CA3AF" : "#6B7280"` (gray-400 dark / gray-500 light).
- Skia primitives (`<Line color={...}>`, `<Circle color={...}>`) consume hex strings — NativeWind classes do NOT work inside the Skia canvas; bind via `useColorScheme()` once at component top.

### `freezeOnBlur` + `useFocusEffect` overlay reset

**Source:** `app/app/(app)/plans/[id].tsx` lines 168-173 (commit `af6930c`).

**Apply to:** `history/[sessionId].tsx` (has overflow-menu + delete-confirm overlay state). The chart route has NO overlay state so this is not needed there.

```typescript
useFocusEffect(
  useCallback(() => {
    setShowOverflowMenu(false);
    setShowDeleteConfirm(false);
  }, []),
);
```

### `mutate-not-mutateAsync` convention

**Source:** `app/app/(app)/plans/[id].tsx` lines 206-213 (commit `5d953b6`).

**Apply to:** All `useDeleteSession.mutate(...)` call-sites in `history/[sessionId].tsx`.

- `mutate(vars, { onSuccess, onError })` — NEVER `await mutateAsync(...)`. Paused mutations under `networkMode: 'offlineFirst'` don't resolve `mutateAsync` (Phase 4 UAT regression).

### Inline-overlay-destructive-confirm

**Source:** `app/app/(app)/plans/[id].tsx` lines 616-716 (commit `e07029a`).

**Apply to:** `history/[sessionId].tsx` delete-pass-confirm.

- NEVER Modal portal — Phase 4 D-08 anti-pattern; layout silently collapses.
- Absolute-positioned `<Pressable>` backdrop + inner `<Pressable onPress={e => e.stopPropagation()}>` dialog.
- Explicit React Native style values for layout props (zIndex, backgroundColor); NativeWind retained for inner card content.

### `useExercisesQuery + Map<id, name>` exercise-name lookup

**Source:** `app/app/(app)/plans/[id].tsx` lines 119-124 (commit `3bfaba8`) + `workout/[sessionId].tsx` lines 233-240.

**Apply to:** `history/[sessionId].tsx` (card-header exercise name) + `exercise/[exerciseId]/chart.tsx` (Stack header title via `Stack.Screen options={{ title: exerciseName }}`).

```typescript
const { data: exercises } = useExercisesQuery();
const exerciseNameById = useMemo(() => {
  const m = new Map<string, string>();
  for (const e of exercises ?? []) m.set(e.id, e.name);
  return m;
}, [exercises]);
```

### Path-alias `@/*` + kebab-case file names

**Source:** Phase 1 D-11 / D-12.

**Apply to:** All Phase 6 imports + new file names.

- Imports: `import { useExerciseChartQuery } from "@/lib/queries/exercise-chart";`
- File names: `exercise-chart.ts`, `history/[sessionId].tsx`, `exercise/[exerciseId]/chart.tsx`, `test-exercise-chart.ts`.

---

## No Analog Found

No Phase 6 file is "no analog" — every file has at least a partial analog in the merged codebase. The only true new patterns are:

| Capability | Source for pattern | Reason no in-repo precedent |
|------------|---------------------|---------------------------|
| `useInfiniteQuery` cursor pagination | RESEARCH §Pattern 1 + Context7 `/tanstack/query/v5.90.3` | No prior cursor-paginated list in Phases 1–5 (plan-list is not paginated). |
| Victory Native XL `<CartesianChart>` + Skia primitives | RESEARCH §Pattern 2 | First chart in the app. |
| Postgres RPC function returning aggregated table | RESEARCH §Pattern 3 + 4 | Phase 2–5 used only `.from(...)` queries; this is the first migration that adds RPC functions. |
| Segmented control NativeWind component | UI-SPEC §Visuals "Segmented Control" | First reusable segmented control in V1. |

For these, the planner should copy the patterns from RESEARCH.md verbatim (already provided in 06-RESEARCH.md §§Pattern 1–4) — not search the codebase further.

---

## Metadata

**Analog search scope:**
- `app/app/(app)/**/*.tsx` (10 files — all read for layout/route/screen patterns)
- `app/lib/queries/*.ts` (6 files — all read for resource-hook conventions)
- `app/lib/query/*.ts` (4 files — `keys.ts` + `client.ts` directly relevant)
- `app/scripts/*.ts` (16 files — `test-rls.ts` + `test-last-value-query.ts` directly relevant)
- `app/supabase/migrations/*.sql` (5 files — `0001_initial_schema.sql` + `0004_exercise_sets_set_number_trigger.sql` directly relevant)
- `app/lib/schemas/*.ts` (6 files — confirmed `sessions.ts` is the schema to NOT modify per CONTEXT.md)

**Files scanned for analog matches:** 47

**Pattern extraction date:** 2026-05-15

---

## PATTERN MAPPING COMPLETE
