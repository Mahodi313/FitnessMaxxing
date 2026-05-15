// app/app/(app)/(tabs)/history.tsx
//
// Phase 6 Plan 06-01b: F9 client-tier vertical slice — Historik tab.
//
// Replaces the Phase 4 placeholder with a cursor-paginated FlatList of
// finished workout sessions consumed from useSessionsListInfiniteQuery
// (sessions.ts) against the get_session_summaries RPC deployed in Plan
// 06-01a (migration 0006). Each row: `Datum · Plan-namn · Set-count ·
// Total-volym` (06-CONTEXT.md D-01).
//
// Cursor pagination — page-size 20, cursor on started_at DESC, onEndReached
// with threshold 0.5 (06-CONTEXT.md D-03 + 06-RESEARCH §Pattern 1). The
// onEndReached callback guards `hasNextPage && !isFetchingNextPage` per
// Pitfall 3 — without the guard, fetchNextPage fires in a loop once the
// last page renders, bloating cache and battery.
//
// Pull-to-refresh via RefreshControl — refetch() reissues page 1 with
// cursor=null (06-CONTEXT.md D-03).
//
// Offline-friendly: the TanStack persister (Phase 4 D-07) hydrates the
// listInfinite cache slot from AsyncStorage at cold-start so the list is
// visible without a network round-trip (ROADMAP success #4).
//
// Empty state when 0 finished sessions exist: Ionicons time-outline + "Inga
// pass än" + "Starta ditt första pass från en plan." + "Gå till planer"
// CTA routing back to the planer tab (06-UI-SPEC §History empty-state).
//
// Plan-name fallback — when session.plan_name IS NULL (plan_id IS NULL via
// ON DELETE SET NULL cascade), render "— ingen plan" (06-CONTEXT.md D-08).
//
// Theme — useColorScheme() drives the accent color (Phase 4 D-18 / Plan
// 06-PATTERNS shared pattern): #60A5FA (blue-400) dark / #2563EB (blue-600)
// light. RefreshControl tintColor + ActivityIndicator + Ionicons all bind
// to this single source.
//
// Number formatting — formatNumber wraps Number.toLocaleString("sv-SE") so
// 3240 renders as "3 240" (non-breaking-space thousands separator —
// Swedish convention per 06-UI-SPEC).
//
// `as Href` on `/history/[sessionId]` — Plan 06-02 ships that route file;
// until it lands, app.json experiments.typedRoutes flags the path literal
// against an auto-generated router.d.ts that lacks the route. The cast is
// the same pattern used in (tabs)/index.tsx for cross-plan route literals
// (Phase 4 commit b87bddf). Once Plan 06-02 ships and the dev server
// regenerates router.d.ts the cast can be dropped (V1.1 cleanup
// breadcrumb).
//
// References:
//   - 06-PLAN.md Task 2 + acceptance criteria
//   - 06-UI-SPEC.md §History-list row + §History-list FlatList container
//     + §History empty-state
//   - 06-CONTEXT.md D-01, D-03, D-08
//   - 06-RESEARCH.md §Pattern 1, §Example 5, §Pitfall 3

import { useMemo } from "react";
import { useRouter, type Href } from "expo-router";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  useSessionsListInfiniteQuery,
  type SessionSummary,
} from "@/lib/queries/sessions";

// Swedish non-breaking-space thousands separator: 3240 → "3 240".
function formatNumber(n: number): string {
  return n.toLocaleString("sv-SE");
}

export default function HistoryTab() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const accent = isDark ? "#60A5FA" : "#2563EB";

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
    refetch,
    status,
  } = useSessionsListInfiniteQuery();

  // Flatten the InfiniteQuery `{ pages, pageParams }` envelope. Memo keyed on
  // `data?.pages` so the FlatList data prop stays referentially stable
  // between renders when no new page has arrived.
  const sessions = useMemo(
    () => data?.pages.flat() ?? [],
    [data?.pages],
  );
  const isEmpty = sessions.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      {!isEmpty && (
        <View className="px-4 pt-4 pb-2">
          <Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
            Historik
          </Text>
        </View>
      )}

      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 96,
          flexGrow: 1,
        }}
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
            <View className="py-4">
              <ActivityIndicator size="small" color={accent} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={accent}
          />
        }
        ListEmptyComponent={
          status === "pending" ? null : <HistoryEmptyState />
        }
        renderItem={({ item }) => <HistoryListRow session={item} />}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// HistoryListRow — single session row per 06-UI-SPEC §History-list row.
// Left col: date (primary) + plan-name (muted, D-08 fallback). Right col:
// set count + total volume. Tap routes to /history/[sessionId] (owned by
// Plan 06-02 — see `as Href` cast rationale in file header).
// ---------------------------------------------------------------------------
function HistoryListRow({ session }: { session: SessionSummary }) {
  const router = useRouter();
  const formattedDate = format(new Date(session.started_at), "d MMM yyyy", {
    locale: sv,
  });
  const planLabel = session.plan_name ?? "— ingen plan";

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/history/[sessionId]",
          params: { sessionId: session.id },
        } as unknown as Href)
      }
      accessibilityRole="button"
      accessibilityLabel={`Öppna pass från ${formattedDate}, ${planLabel}, ${session.set_count} set, ${formatNumber(session.total_volume_kg)} kg`}
      className="flex-row items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-4 active:opacity-80"
    >
      <View className="flex-1 mr-3">
        <Text
          className="text-base font-semibold text-gray-900 dark:text-gray-50"
          numberOfLines={1}
        >
          {formattedDate}
        </Text>
        <Text
          className="text-base text-gray-500 dark:text-gray-400"
          numberOfLines={1}
        >
          {planLabel}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400">
          {`${session.set_count} set`}
        </Text>
        <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400">
          {`${formatNumber(session.total_volume_kg)} kg`}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// HistoryEmptyState — rendered when 0 finished sessions exist per
// 06-UI-SPEC §History empty-state. The CTA routes back to the Planer tab
// ((tabs)/index.tsx — `/(tabs)/` resolves to the index route).
// ---------------------------------------------------------------------------
function HistoryEmptyState() {
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const accent = isDark ? "#60A5FA" : "#2563EB";

  return (
    <View className="flex-1 items-center justify-center gap-6 px-4">
      <Ionicons name="time-outline" size={64} color={accent} />
      <View className="gap-2 items-center">
        <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          Inga pass än
        </Text>
        <Text className="text-base text-gray-500 dark:text-gray-400 text-center">
          Starta ditt första pass från en plan.
        </Text>
      </View>
      <Pressable
        onPress={() => router.push("/(tabs)" as Href)}
        accessibilityRole="button"
        accessibilityLabel="Gå till planer"
        className="rounded-lg bg-blue-600 dark:bg-blue-500 px-6 py-4 active:opacity-80"
      >
        <Text className="text-base font-semibold text-white">
          Gå till planer
        </Text>
      </Pressable>
    </View>
  );
}
