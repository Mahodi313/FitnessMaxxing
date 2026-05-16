---
phase: 06-history-read-side-polish
plan: 01b
type: execute
wave: 2
depends_on:
  - "06-01a"
files_modified:
  - app/lib/query/keys.ts
  - app/lib/query/client.ts
  - app/lib/queries/sessions.ts
  - app/app/(app)/(tabs)/history.tsx
autonomous: true
requirements:
  - F9
tags:
  - phase-6
  - history
  - infinite-query
  - tanstack-v5
  - mvp

must_haves:
  truths:
    - "User opens the Historik tab and sees a cursor-paginated list of finished workout-sessions; each row shows `Datum · Plan-namn · Set-count · Total-volym` (ROADMAP success #1 + D-01)"
    - "Cursor pagination terminates: a page returning fewer than 20 rows causes getNextPageParam to return undefined so hasNextPage = false; cursor on started_at DESC with page-size 20 per D-03 (RESEARCH Pitfall 3)"
    - "useSessionsListInfiniteQuery Zod-parses every RPC row via SessionSummarySchema (RESEARCH Pitfall 4 + 8.13)"
    - "Existing ['session','finish'] setMutationDefaults onSettled invalidates sessionsKeys.listInfinite() in ADDITION to existing invalidations so finishing a workout makes the new session appear in history without waiting for 30s staleTime (RESEARCH A8 executor-trap fix)"
    - "(tabs)/history.tsx renders a flat (no section grouping per D-02) cursor-paginated FlatList with pull-to-refresh + onEndReachedThreshold 0.5 + hasNextPage guard; the Phase 4 placeholder content is removed"
    - "History list is offline-friendly: TanStack persister (Phase 4) hydrates sessionsKeys.listInfinite() from AsyncStorage on cold start without network (ROADMAP success #4)"
    - "When 0 finished sessions exist, the empty-state Ionicons time-outline + 'Inga pass än' + 'Starta ditt första pass från en plan.' + 'Gå till planer' CTA renders instead of the FlatList (UI-SPEC §History empty-state)"
    - "No new client-bundled dependency added (Phase 6 must NOT add new deps). Informational — D-04 defers filter/search to V1.1 (covered by absence; no filter/search UI is implemented)"
  artifacts:
    - path: "app/lib/queries/sessions.ts"
      provides: "useSessionsListInfiniteQuery() exported; SessionSummary type + SessionSummarySchema declared inline (Pitfall 8.13); existing exports untouched"
      exports: ["useSessionsListInfiniteQuery", "SessionSummary"]
    - path: "app/lib/query/keys.ts"
      provides: "sessionsKeys extended with listInfinite()"
      contains: "listInfinite"
    - path: "app/lib/query/client.ts"
      provides: "['session','finish'] onSettled appends sessionsKeys.listInfinite() invalidation (A8 executor-trap fix)"
      contains: "sessionsKeys.listInfinite()"
    - path: "app/app/(app)/(tabs)/history.tsx"
      provides: "Cursor-paginated FlatList + pull-to-refresh + empty-state + Display heading 'Historik'; placeholder removed"
      contains: "useSessionsListInfiniteQuery"
      min_lines: 120
  key_links:
    - from: "app/app/(app)/(tabs)/history.tsx"
      to: "app/lib/queries/sessions.ts useSessionsListInfiniteQuery"
      via: "import + hook call inside FlatList wiring"
      pattern: "useSessionsListInfiniteQuery"
    - from: "app/lib/queries/sessions.ts useSessionsListInfiniteQuery queryFn"
      to: "Supabase rpc get_session_summaries"
      via: "supabase.rpc('get_session_summaries', { p_cursor, p_page_size }) + SessionSummarySchema.parse"
      pattern: "supabase\\.rpc\\(\"get_session_summaries\""
    - from: "app/lib/query/client.ts existing ['session','finish'] onSettled block"
      to: "sessionsKeys.listInfinite() cache invalidation"
      via: "additional void queryClient.invalidateQueries call appended to existing onSettled"
      pattern: "invalidateQueries.*listInfinite"
---

<objective>
F9 client-tier vertical slice consuming the Plan 06-01a RPC. After this plan ships: the Historik tab shows the user's finished workout-sessions in a cursor-paginated list that works offline via the existing TanStack persister + AsyncStorage cache. The A8 executor-trap is closed (`['session','finish']` onSettled adds `sessionsKeys.listInfinite()` invalidation) so finishing a session immediately surfaces it in history.

Purpose: Close F9 end-to-end on the user-visible slice. Plan 06-01a deployed the RPC; this plan wires the query hook + cache-key + cache-invalidation + the screen JSX. The two are split because Plan 06-01a's surface is database + Wave 0 fixtures (heavy Node/SQL context cost), and this plan's surface is React Native + TanStack v5 (heavy client context cost) — splitting prevents quality degradation on the screen rewrite.

Output: One extended keys.ts + one extended sessions.ts (adds useSessionsListInfiniteQuery + Zod schema + type) + one extended client.ts (A8 single-line fix) + one rewritten (tabs)/history.tsx.
</objective>

<execution_context>
@C:/Users/Mahod/Desktop/Projects/FitnessMaxxing/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Mahod/Desktop/Projects/FitnessMaxxing/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/06-history-read-side-polish/06-CONTEXT.md
@.planning/phases/06-history-read-side-polish/06-RESEARCH.md
@.planning/phases/06-history-read-side-polish/06-UI-SPEC.md
@.planning/phases/06-history-read-side-polish/06-PATTERNS.md
@.planning/phases/06-history-read-side-polish/06-01a-PLAN.md
@CLAUDE.md

<interfaces>
<!-- Plan 06-01a shipped (Wave 1): -->
- Supabase RPC `get_session_summaries(p_cursor timestamptz, p_page_size int default 20)` returns 8 columns per row (id, user_id, plan_id, started_at, finished_at, plan_name, set_count, total_volume_kg); RLS-scoped via SECURITY INVOKER
- `Database['public']['Functions']['get_session_summaries']['Returns']` is available in app/types/database.ts
- `npm run test:exercise-chart` proves the RPC behaves correctly (5 F9 assertions A–E green)

<!-- From the current codebase (pre-Plan-01b): -->
From app/lib/query/keys.ts:
- export const sessionsKeys = { all, list(), detail(id), active() }    // Plan 01b adds listInfinite()
- export const setsKeys = { ..., list(sessionId), ... }                 // unchanged
- export const exercisesKeys, plansKeys, planExercisesKeys, lastValueKeys // unchanged

From app/lib/query/client.ts (existing setMutationDefaults topology — DO NOT MODIFY blocks 1–13):
- Block 10 ['session','finish'] lives at line ~653; its onSettled currently invalidates sessionsKeys.active() + sessionsKeys.detail(vars.id) + lastValueKeys.all (verified by file-read 2026-05-15)

From app/lib/queries/sessions.ts:
- export function useActiveSessionQuery()
- export function useSessionQuery(id)         // detail with initialData seed from list cache
- export function useStartSession()           // mutation
- export function useFinishSession(sessionId) // mutation
- Imports: `useAuthStore` from "@/lib/auth-store"; `supabase` from "@/lib/supabase"; existing `SessionRowSchema` from `@/lib/schemas/sessions`

From app/lib/queries/last-value.ts (analog file for the Zod-parse + useAuthStore pattern):
- File-header comment block (lines 1-46)
- Zod schema `SetRowSchema.partial().parse(s)` inside .map() — Phase 6 reuses for SessionSummarySchema.parse

From app/lib/supabase.ts:
- export const supabase: SupabaseClient<Database>    // typed client (Phase 2 D-05)

From app/app/(app)/(tabs)/index.tsx (primary screen analog):
- FlatList + empty-state + Display heading + useColorScheme-bound accent pattern
- SafeAreaView from "react-native-safe-area-context"
- Phase 4 D-18 accent binding pattern

From app/app/(app)/(tabs)/history.tsx (current placeholder — to be replaced):
- Single placeholder Text inside SafeAreaView; tabs-skeleton intact

From RESEARCH §Pattern 1 (lines ~340-414): verbatim implementation of useSessionsListInfiniteQuery + Example 5 (lines 1035-1080): pull-to-refresh + infinite-scroll FlatList wiring.
</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Supabase RPC `.rpc("get_session_summaries")` | Already mitigated at the DB tier (Plan 06-01a SECURITY INVOKER + RLS); client just calls + Zod-parses |
| AsyncStorage persisted listInfinite cache → reactive UI | TanStack persister hydrates on cold-start; UUIDs are non-PII per T-06-07 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-01 | Information disclosure | get_session_summaries client call | mitigate | DB-tier RLS (Plan 06-01a) + Zod-parse in queryFn rejects unexpected shapes |
| T-06-05 | Tampering | p_cursor parameter | mitigate | TypeScript types pageParam as `string | null`; Postgres parses timestamptz or rejects |
| T-06-07 | Information disclosure | persisted listInfinite cache in AsyncStorage | accept | UUIDs non-semantic; LargeSecureStore protects the auth blob; no PII leaks via persisted cursor strings |
| T-06-08 | Information disclosure | stale cache shown after user-switch | mitigate | Phase 3 sign-out's `queryClient.clear()` already wipes listInfinite cache (no Plan 01b code change) |
</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Extend keys.ts with listInfinite() + sessions.ts with useSessionsListInfiniteQuery + Zod schema + A8 fix in client.ts</name>
  <files>app/lib/query/keys.ts, app/lib/queries/sessions.ts, app/lib/query/client.ts</files>
  <read_first>
    - app/lib/query/keys.ts FULL FILE (current sessionsKeys + lastValueKeys pattern — extension is purely additive)
    - app/lib/queries/sessions.ts FULL FILE (existing exports; new exports appended at the bottom)
    - app/lib/queries/last-value.ts FULL FILE (analog for Zod-parse-array + useAuthStore selector + comment-header)
    - app/lib/query/client.ts lines 646-706 (the ['session','finish'] setMutationDefaults block — Task 1 appends ONE line to its onSettled)
    - .planning/phases/06-history-read-side-polish/06-RESEARCH.md §Pattern 1 (useSessionsListInfiniteQuery verbatim implementation including initialPageParam + getNextPageParam + enabled gate)
    - .planning/phases/06-history-read-side-polish/06-RESEARCH.md §Assumption A8 (the executor-trap explaining why ['session','finish'] onSettled MUST also invalidate sessionsKeys.listInfinite())
    - .planning/phases/06-history-read-side-polish/06-PATTERNS.md "app/lib/queries/sessions.ts — MODIFIED" section
    - .planning/phases/06-history-read-side-polish/06-CONTEXT.md D-03 (cursor pagination semantics: page-size 20, cursor on started_at DESC, getNextPageParam returns undefined when lastPage.length < 20)
  </read_first>
  <action>
    Three additive edits across three files:

    (1) `app/lib/query/keys.ts` — extend the existing `sessionsKeys` factory by adding ONE method: `listInfinite: () => [...sessionsKeys.all, "list-infinite"] as const`. Place it as the last property in the existing object. No other key changes. The `exerciseChartKeys` factory belongs to Plan 06-03; DO NOT add it here.

    (2) `app/lib/queries/sessions.ts` — append at end of file (after existing exports):

       - Import addition: extend the existing `@tanstack/react-query` import to include `useInfiniteQuery` (existing line imports `useMutation, useQuery`)
       - Import addition: add `import { z } from "zod";` if no Zod import is present (last-value.ts has the precedent for inline schema)
       - `const PAGE_SIZE = 20;` (module constant matching D-03)
       - `export type SessionSummary` — type alias per RESEARCH §Pattern 1 verbatim (id, user_id, plan_id, started_at, finished_at, plan_name, set_count, total_volume_kg)
       - `const SessionSummarySchema = z.object({ ... })` — Zod schema matching the SessionSummary shape; use `z.string().uuid()` for id/user_id, `.nullable()` on plan_id/finished_at/plan_name, `z.coerce.number()` for set_count + total_volume_kg (Pitfall 8.13 — Postgres numeric returns as string)
       - `export function useSessionsListInfiniteQuery()` per RESEARCH §Pattern 1 verbatim: useAuthStore selector for `userId`, `useInfiniteQuery` object-arg API, `queryKey: sessionsKeys.listInfinite()`, queryFn calls `supabase.rpc("get_session_summaries", { p_cursor: pageParam, p_page_size: PAGE_SIZE })`, throws on error, parses each row via `SessionSummarySchema.parse`, `initialPageParam: null as string | null`, `getNextPageParam: (lastPage) => lastPage.length < PAGE_SIZE ? undefined : lastPage[lastPage.length - 1]?.started_at ?? undefined`, `enabled: !!userId`. Inherits networkMode: 'offlineFirst' from QueryClient defaults.

    (3) `app/lib/query/client.ts` — locate the existing `['session','finish']` `setMutationDefaults` block (verified at lines ~653-706 by file-read 2026-05-15; its onSettled at lines 697-704 currently invalidates `sessionsKeys.active()` + `sessionsKeys.detail(vars.id)` + `lastValueKeys.all`). APPEND ONE LINE inside the onSettled body:

       ```
       void queryClient.invalidateQueries({ queryKey: sessionsKeys.listInfinite() });
       ```

       Add an inline comment above the new line: `// Phase 6 A8: finishing a session must surface it in history without waiting for staleTime.` Do NOT modify any other block in client.ts.

    Do NOT add `exerciseChartKeys`, do NOT add `setMutationDefaults` for `['session','delete']` here (that is Plan 06-02's responsibility). Stay strictly within F9 scope.
  </action>
  <verify>
    <automated>cd app && npx tsc --noEmit && grep -c "sessionsKeys.listInfinite()" app/lib/query/client.ts | awk -F: '{ exit ($NF >= 1) ? 0 : 1 }' && grep -c "useSessionsListInfiniteQuery" app/lib/queries/sessions.ts | awk -F: '{ exit ($NF >= 1) ? 0 : 1 }'</automated>
  </verify>
  <acceptance_criteria>
    - `cd app && npx tsc --noEmit` exits 0
    - `app/lib/query/keys.ts` contains literal `listInfinite:` (grep)
    - `app/lib/queries/sessions.ts` contains literal `useSessionsListInfiniteQuery` (grep — exported function)
    - `app/lib/queries/sessions.ts` contains literal `useInfiniteQuery` (grep — import + usage)
    - `app/lib/queries/sessions.ts` contains literal `SessionSummarySchema.parse` (grep — Zod-parse boundary)
    - `app/lib/queries/sessions.ts` contains literal `p_cursor: pageParam` AND `p_page_size: PAGE_SIZE` (RPC invocation)
    - `app/lib/queries/sessions.ts` contains literal `getNextPageParam` AND `< PAGE_SIZE` (termination condition)
    - `app/lib/query/client.ts` contains literal `sessionsKeys.listInfinite()` (counts ≥ 1)
    - The A8 fix is in the existing `['session','finish']` block (verify via `grep -B2 "sessionsKeys.listInfinite()" app/lib/query/client.ts` shows context near `Phase 6 A8` or `session.*finish` comment)
  </acceptance_criteria>
  <done>
    F9 query wiring complete. The history tab can now consume `useSessionsListInfiniteQuery()`. Finishing a session correctly invalidates the listInfinite key (A8 closed).
  </done>
</task>

<task type="auto">
  <name>Task 2: Rewrite (tabs)/history.tsx — cursor-paginated FlatList + empty-state + Display heading</name>
  <files>app/app/(app)/(tabs)/history.tsx</files>
  <read_first>
    - app/app/(app)/(tabs)/history.tsx FULL FILE (current placeholder — to be replaced)
    - app/app/(app)/(tabs)/index.tsx FULL FILE (primary analog — FlatList + empty-state + Display heading + accent-aware theme)
    - app/components/active-session-banner.tsx (confirm banner remains visible above the new FlatList — no change here)
    - .planning/phases/06-history-read-side-polish/06-UI-SPEC.md §"History-list row" + §"History-list FlatList container" + §"History empty-state" (verbatim JSX shapes including class strings)
    - .planning/phases/06-history-read-side-polish/06-RESEARCH.md §Example 5 (Pull-to-refresh + infinite-scroll FlatList wiring) + §Pitfall 3 (hasNextPage guard on onEndReached)
    - .planning/phases/06-history-read-side-polish/06-CONTEXT.md D-01 (rad-shape `Datum · Plan-namn · Set-count · Total-volym`), D-03 (cursor pagination + pull-to-refresh), D-13 (empty pass shows `0 set · 0 kg`)
  </read_first>
  <action>
    Replace the entire body of `app/app/(app)/(tabs)/history.tsx` with the cursor-paginated implementation per UI-SPEC verbatim.

    Top-of-file imports: `useMemo` from react; `useRouter, type Href` from expo-router; `View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl, useColorScheme` from react-native; `SafeAreaView` from react-native-safe-area-context; `Ionicons` from @expo/vector-icons; `format` from date-fns; `sv` from date-fns/locale; `useSessionsListInfiniteQuery` from "@/lib/queries/sessions".

    Local `formatNumber(n: number)` helper: returns `n.toLocaleString("sv-SE")` so `3240` renders as `3 240` (non-breaking-space).

    `HistoryListRow` component (inline or local function) per UI-SPEC §History-list row verbatim: Pressable wraps `flex-row items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-4 active:opacity-80`. Left View `flex-1 mr-3`: primary Text `text-base font-semibold text-gray-900 dark:text-gray-50` showing `format(new Date(session.started_at), "d MMM yyyy", { locale: sv })`; secondary Text `text-base text-gray-500 dark:text-gray-400` showing `session.plan_name ?? "— ingen plan"` (D-08 fallback). Right View `items-end`: two Texts `text-sm font-semibold text-gray-500 dark:text-gray-400` rendering `${set_count} set` then `${formatNumber(total_volume_kg)} kg`. accessibilityRole="button"; accessibilityLabel templated per UI-SPEC. onPress: `router.push({ pathname: "/history/[sessionId]", params: { sessionId: session.id } } as Href)` — note the `/history/[sessionId]` route file does NOT exist yet (Plan 06-02 ships it); use `as Href` cast per Phase 4 cross-plan-route convention so tsc stays green until Plan 06-02 lands.

    `HistoryEmptyState` (inline) per UI-SPEC §History empty-state: Centered Ionicons `time-outline` size 64 in accent color, Heading "Inga pass än", Body "Starta ditt första pass från en plan.", primary CTA Pressable routing to `/(tabs)` (planer tab) with label "Gå till planer".

    Top-level component returns `SafeAreaView className="flex-1 bg-white dark:bg-gray-900"`:
    - Use `useSessionsListInfiniteQuery()` hook destructured per RESEARCH §Example 5 (data, fetchNextPage, hasNextPage, isFetchingNextPage, isRefetching, refetch, status)
    - `const sessions = useMemo(() => data?.pages.flat() ?? [], [data?.pages])`
    - When sessions.length > 0: render Display heading `<Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">Historik</Text>` inside `<View className="px-4 pt-4 pb-2">` (UI-SPEC verbatim)
    - FlatList with all props per UI-SPEC + RESEARCH §Example 5: data, keyExtractor, contentContainerStyle, ItemSeparatorComponent (`<View className="h-2" />`), onEndReached with `hasNextPage && !isFetchingNextPage` guard (Pitfall 3), onEndReachedThreshold 0.5, ListFooterComponent (ActivityIndicator while fetchingNextPage), refreshControl with RefreshControl bound to isRefetching + refetch, ListEmptyComponent renders HistoryEmptyState when status !== "pending"

    Use `useColorScheme()` to bind the accent color hex (`isDark ? "#60A5FA" : "#2563EB"`) for Ionicons + RefreshControl tintColor + ActivityIndicator color.

    Delete the existing Phase 4 placeholder content entirely. No tabs-skeleton change. Keep the file's default export as the screen component. No new dependencies; no shadcn; pure react-native + NativeWind + @expo/vector-icons + date-fns + the new query hook.
  </action>
  <verify>
    <automated>cd app && npx tsc --noEmit && npx expo lint</automated>
  </verify>
  <acceptance_criteria>
    - `cd app && npx tsc --noEmit` exits 0
    - `cd app && npx expo lint` exits 0 (warnings allowed but no errors)
    - `app/app/(app)/(tabs)/history.tsx` contains literal `useSessionsListInfiniteQuery` (import + usage)
    - File contains literal `data?.pages.flat()` or equivalent flatten expression
    - File contains literal `hasNextPage` AND `isFetchingNextPage` (Pitfall 3 guard)
    - File contains literal `onEndReachedThreshold={0.5}` (D-03 verbatim)
    - File contains literal `refreshControl` AND `RefreshControl` (pull-to-refresh)
    - File contains the Display heading `Historik` (grep)
    - File contains the empty-state copy `Inga pass än` (grep — UI-SPEC verbatim)
    - File contains literal `"— ingen plan"` (D-08 fallback rendering)
    - File contains literal `locale: sv` (Swedish locale for date formatting)
    - File contains literal `as Href` on the `/history/[sessionId]` route literal
    - File does NOT import any new client-bundled dependency not already in app/package.json (verify by reviewing imports)
    - No `console.log` left in the final file
  </acceptance_criteria>
  <done>
    User opens the Historik tab and sees a cursor-paginated list of finished workouts (or the empty-state if none). Pull-to-refresh works; scrolling to the bottom fetches the next page. The list is visible offline on cold-start via the persister cache from Phase 4 (no Phase 6 wiring needed; ROADMAP success #4 closes automatically).
  </done>
</task>

</tasks>

<verification>
- After both tasks land: `cd app && npx tsc --noEmit && npm run test:rls && npm run test:exercise-chart && npx expo lint` exits 0
- Manual smoke test on iPhone via Expo Go: open Historik tab → list renders OR empty-state if 0 sessions; pull-to-refresh works; scroll to bottom fetches next page; airplane mode + force-quit + reopen → list is hydrated from AsyncStorage
- Service-role audit gate unchanged
- Threat register: T-06-01 (DB-tier mitigated by Plan 06-01a), T-06-05/07/08 — all mitigated or accepted per `<threat_model>`
- A8 executor-trap closed: finishing a workout invalidates `sessionsKeys.listInfinite()` so the new session appears in history without a 30s staleTime wait
</verification>

<success_criteria>
- ROADMAP success #1 (cursor-paginated list sorted by started_at desc) MET
- ROADMAP success #4 (history list works offline via TanStack persister cache) MET (inherited from Phase 4 persister)
- A8 fix committed (one line added to existing `['session','finish']` onSettled in client.ts)
- No new client-bundled dependency added
- Plan 06-02 + Plan 06-03 can now route to `(tabs)/history` from their post-delete + back-button flows
</success_criteria>

<output>
After completion, create `.planning/phases/06-history-read-side-polish/06-01b-SUMMARY.md`. Record:
- Files modified (count + paths)
- Hook signature + Zod-schema shape
- A8 fix location in client.ts
- Any deviations
- Recommended next step: Plan 06-02 (session-detail + delete)
</output>
