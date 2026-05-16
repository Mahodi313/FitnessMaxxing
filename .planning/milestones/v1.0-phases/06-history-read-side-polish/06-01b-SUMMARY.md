---
phase: 06-history-read-side-polish
plan: 01b
subsystem: ui
tags: [react-native, tanstack-query, tanstack-v5, useInfiniteQuery, expo-router, nativewind, zod, history, cursor-pagination, flatlist, phase-6]

# Dependency graph
requires:
  - phase: 06-history-read-side-polish (Plan 06-01a)
    provides: get_session_summaries RPC (cursor pagination, working-set canonical filter, RLS via SECURITY INVOKER) + Database['public']['Functions']['get_session_summaries']['Returns'] type
  - phase: 04-plans-exercises-offline-queue-plumbing
    provides: TanStack persister + AsyncStorage (offline cache hydration), sessionsKeys factory, networkMode:'offlineFirst', useColorScheme accent convention (D-18)
  - phase: 05-active-workout-hot-path-f13-lives-or-dies
    provides: ['session','finish'] setMutationDefaults block (extended by A8 fix), useAuthStore selector pattern, lib/queries/sessions.ts existing exports
provides:
  - useSessionsListInfiniteQuery hook (cursor-paginated F9 history-list, Zod-parsed SessionSummary rows, PAGE_SIZE 20, started_at DESC)
  - sessionsKeys.listInfinite() cache slot in keys.ts factory
  - Phase 6 A8 fix — ['session','finish'] onSettled invalidates sessionsKeys.listInfinite() so newly-finished sessions surface in history without 30s staleTime wait
  - Historik tab rewrite: cursor-paginated FlatList + pull-to-refresh + onEndReached infinite scroll + empty-state CTA + Display heading
affects: [06-02 (session detail will route from history rows + share the listInfinite cache slot for delete-pass optimistic update), 06-03 (chart-vy is reached via card-header on history detail, no direct dependency on this plan)]

# Tech tracking
tech-stack:
  added: []  # No new client-bundled dependency (Phase 6 rule per 06-CONTEXT.md)
  patterns:
    - "useInfiniteQuery v5 cursor-pagination — initialPageParam: null + getNextPageParam returning undefined when lastPage.length < PAGE_SIZE; queryFn receives { pageParam } and forwards to .rpc()"
    - "Inline Zod schema co-located with hook — SessionSummarySchema declared next to useSessionsListInfiniteQuery (NOT in lib/schemas/); coerces Postgres numeric/bigint string-on-wire to JS number"
    - "FlatList infinite-scroll guard — onEndReached body MUST gate fetchNextPage on `hasNextPage && !isFetchingNextPage` to avoid Pitfall 3's refetch loop"
    - "data?.pages.flat() memoization — flatten pages once per data.pages change, NOT per render; keeps FlatList data prop referentially stable"

key-files:
  created:
    - "(none — this plan only modifies existing files)"
  modified:
    - app/lib/query/keys.ts
    - app/lib/queries/sessions.ts
    - app/lib/query/client.ts
    - app/app/(app)/(tabs)/history.tsx

key-decisions:
  - "Type-cast `pageParam as unknown as string` at the RPC call boundary — Supabase type-gen treats timestamptz parameters as required non-nullable strings, but the SQL body has `(p_cursor is null or ...)` guards. The cast is scoped to the queryFn boundary (mirrors Plan 06-01a's same cast in test-rls.ts + test-exercise-chart.ts) and is documented inline as a known-Supabase-type-gen-limitation workaround."
  - "Empty-state rendered via ListEmptyComponent gated on `status !== 'pending'` (per RESEARCH §Example 5) so the empty-state doesn't flash during the initial query load before cache hydration completes."
  - "Top-level `const router = useRouter()` was removed during lint-clean (router is only used inside HistoryListRow + HistoryEmptyState which each call useRouter independently). The shared accent variable stays at the top-level because RefreshControl tintColor + ActivityIndicator color need it."

patterns-established:
  - "Pattern: useInfiniteQuery cursor-paginate hook — useAuthStore.enabled gate + queryKey from factory + queryFn destructures pageParam + Zod-parses array + initialPageParam typed `string | null` + getNextPageParam returns undefined at end. Replicable across future paginated read-side hooks (chart top-sets list, future filter/search results)."
  - "Pattern: A8 executor-trap fix — when a new query cache slot is added (sessionsKeys.listInfinite), ALL existing mutationDefaults that affect the underlying entity must invalidate it on onSettled. Audit gate: grep for sessionsKeys.list() in client.ts + verify every match has a sibling sessionsKeys.listInfinite() invalidate."
  - "Pattern: Cross-plan route literal cast `as Href` — when a screen references a route file owned by a future plan in the same phase wave, cast the path literal to `Href` so typedRoutes-validation defers until the dev server regenerates router.d.ts. Same pattern used in (tabs)/index.tsx for `/plans/new` + `/plans/[id]` (Phase 4)."

requirements-completed: [F9]

# Metrics
duration: ~30 min
completed: 2026-05-15
---

# Phase 6 Plan 01b: F9 Historik tab vertical slice Summary

**Historik tab rewritten as a cursor-paginated FlatList consuming the get_session_summaries RPC via useSessionsListInfiniteQuery; A8 executor-trap closed so newly-finished sessions appear in history without staleTime wait.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-15T18:15Z (approx)
- **Completed:** 2026-05-15T18:46Z
- **Tasks:** 2 (both autonomous)
- **Files modified:** 4

## Accomplishments

- `useSessionsListInfiniteQuery()` exported from `app/lib/queries/sessions.ts` with inline `SessionSummary` type + `SessionSummarySchema` Zod schema. Cursor pagination terminates correctly: `getNextPageParam` returns `undefined` when `lastPage.length < PAGE_SIZE` so `hasNextPage` flips false at end-of-list (Pitfall 3). RPC parameters typed `{ p_cursor: string | null (cast), p_page_size: 20 }`; inherits `networkMode: 'offlineFirst'` from QueryClient defaults so TanStack persister hydrates the listInfinite cache slot from AsyncStorage at cold-start (ROADMAP success #4).
- `sessionsKeys.listInfinite()` cache-key added to the existing `sessionsKeys` factory in `keys.ts` (purely additive — no removals or renames).
- A8 fix landed in `client.ts`: the existing `['session','finish']` setMutationDefaults `onSettled` block (lines ~697–704) now invalidates `sessionsKeys.listInfinite()` in addition to the prior `sessionsKeys.active()` + `sessionsKeys.detail(vars.id)` + `lastValueKeys.all` invalidations. Finishing a workout makes the new session appear in Historik without waiting for 30s staleTime.
- `(tabs)/history.tsx` rewritten end-to-end: 240 lines, 3 inline components (HistoryTab + HistoryListRow + HistoryEmptyState). Display heading "Historik" renders only when `sessions.length > 0`; otherwise the empty-state (Ionicons `time-outline` + "Inga pass än" + "Starta ditt första pass från en plan." + "Gå till planer" CTA routing back to `/(tabs)`) renders via `ListEmptyComponent`. Row shape: `Datum (svenska "d MMM yyyy" via date-fns/locale/sv) · Plan-namn fallback "— ingen plan" (D-08) · X set · Y kg` with Swedish thousands-separator via `Number.toLocaleString("sv-SE")`. Pull-to-refresh via `RefreshControl` bound to `isRefetching` + `refetch`. `onEndReached` guarded by `hasNextPage && !isFetchingNextPage` per Pitfall 3.
- All verification gates green: `npx tsc --noEmit` (0 errors), `npx expo lint` (0 errors, 0 warnings after Task 2 clean-up), `npm run test:rls` (45 assertions PASS — Phase 6 client wiring doesn't touch RLS but the smoke test stays green), `npm run test:exercise-chart` (13 Wave 0 assertions still PASS — Plan 06-01a RPC behaviour unchanged).

## Task Commits

Each task committed atomically (worktree-mode — orchestrator owns the final SUMMARY commit):

1. **Task 1: Extend keys.ts + sessions.ts + A8 fix in client.ts** — `693b259` (feat)
2. **Task 2: Rewrite (tabs)/history.tsx with cursor-paginated FlatList + empty-state** — `a926693` (feat)

Both commits tagged `[FIT-63]` per Linear sub-issue manifest (`.planning/phases/06-history-read-side-polish/.linear-sync.json`).

## Files Created/Modified

### Modified

- `app/lib/query/keys.ts` — added `listInfinite()` method to existing `sessionsKeys` factory; explanatory comment cites Pitfall 6 (the `{ pages, pageParams }` envelope is why the cache slot is distinct from `list()`).
- `app/lib/queries/sessions.ts` — added `useInfiniteQuery` + `z` imports; appended `PAGE_SIZE` module constant, `SessionSummary` type, `SessionSummarySchema` Zod schema, `useSessionsListInfiniteQuery()` hook (40-line block) after `useFinishSession`. Existing exports untouched.
- `app/lib/query/client.ts` — appended `void queryClient.invalidateQueries({ queryKey: sessionsKeys.listInfinite() })` to the existing `['session','finish']` setMutationDefaults `onSettled` body (block 10, lines ~697–706). Inline comment cites 06-RESEARCH §A8. No other block in the file modified.
- `app/app/(app)/(tabs)/history.tsx` — replaced Phase 4 placeholder (24 lines) with the full F9 surface (240 lines): HistoryTab + HistoryListRow + HistoryEmptyState; imports `useSessionsListInfiniteQuery` + `SessionSummary` from `@/lib/queries/sessions`; uses `format` + `sv` from date-fns; Ionicons for empty-state icon; useColorScheme-bound accent for RefreshControl tint + ActivityIndicator color.

## Decisions Made

- **Type-cast `pageParam as unknown as string` at RPC call boundary** — Supabase's generated `Database['public']['Functions']['get_session_summaries']['Args']` types `p_cursor` as required non-nullable `string` even though the SQL body in migration 0006 handles NULL correctly via `(p_cursor is null or s.started_at < p_cursor)`. The cast is scoped to the queryFn (NOT exported) and mirrors the same documented limitation that Plan 06-01a worked around in `test-rls.ts` + `test-exercise-chart.ts` (see 06-01a-SUMMARY.md Deviations §1). Single inline comment links the rationale.
- **Inline `SessionSummary` + `SessionSummarySchema` in `sessions.ts` (NOT in `lib/schemas/sessions.ts`)** — 06-CONTEXT.md `<canonical_refs>` explicitly notes `lib/schemas/sessions.ts` is unchanged in Phase 6. SessionSummary is a SUPERSET of `SessionRow` (adds `plan_name` + `set_count` + `total_volume_kg` — fields that exist only in the RPC return, not on the base `workout_sessions` row). Co-locating the schema with the hook that consumes it matches the precedent in `last-value.ts` (which inlines `SetRowSchema.partial()` usage without exporting a separate schema).
- **`status === "pending"` guard on `ListEmptyComponent`** — RESEARCH §Example 5 recommends this to avoid an empty-state flash during the initial query load before cache hydration completes. Adopted verbatim.
- **`router` not top-level in HistoryTab** — `useRouter()` only needed inside HistoryListRow (push to `/history/[sessionId]`) and HistoryEmptyState (push to `/(tabs)`); each child component calls `useRouter()` independently. Lint cleanup driven by `@typescript-eslint/no-unused-vars` after the initial implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree bootstrap — missing .env.local + node_modules**
- **Found during:** Start of plan execution (running `npm run linear:plan-id` to look up FIT-63)
- **Issue:** Worktree spawns inherit only committed files. `.env.local` (gitignored) and `app/node_modules` were absent so any npm script that calls `tsx --env-file=app/.env.local` failed with `node: app/.env.local: not found`, and the verification gates (`npx tsc`, `npx expo lint`, `npm run test:rls`, `npm run test:exercise-chart`) had no resolved dependencies.
- **Fix:** Copied `.env.local` from the main worktree (`cp /c/Users/Mahod/Desktop/Projects/FitnessMaxxing/app/.env.local <worktree>/app/.env.local`) and ran `npm install --no-audit --no-fund` in `app/` in the background while applying the Task 1 edits.
- **Files modified:** None tracked (`.env.local` is gitignored; `node_modules/` is gitignored).
- **Verification:** `npm run linear:plan-id -- --phase 6 --plan 01b` returned `FIT-63`; all subsequent verification gates ran green.
- **Committed in:** Not committed (per-worktree bootstrap, not a plan deliverable). Already documented as worktree-mode bootstrap in 06-01a-SUMMARY.md "Issues Encountered" — same pattern.

**2. [Rule 1 - Bug] Unused `router` variable at top-level of HistoryTab**
- **Found during:** Task 2 verification (`npx expo lint`)
- **Issue:** Initial implementation declared `const router = useRouter()` at the top of HistoryTab even though the tap-to-route logic lives inside HistoryListRow + HistoryEmptyState (each declares its own `router` via `useRouter()`). ESLint `@typescript-eslint/no-unused-vars` flagged the dead declaration as a warning.
- **Fix:** Removed the unused top-level `useRouter()` call. The child components still call `useRouter()` independently which is the canonical React Hooks pattern (no shared router instance is meaningful at the parent scope here).
- **Files modified:** `app/app/(app)/(tabs)/history.tsx`
- **Verification:** `npx expo lint` re-run: 0 errors, 0 warnings. `npx tsc --noEmit` re-run: 0 errors.
- **Committed in:** `a926693` (Task 2 commit — the fix was applied before staging, no separate commit needed).

---

**Total deviations:** 2 auto-fixed (1 blocking — worktree bootstrap; 1 bug — lint cleanup)
**Impact on plan:** Both auto-fixes are correctness-and-tooling necessities, not scope creep. The bootstrap is a known worktree-mode artifact (already documented in 06-01a-SUMMARY); the lint cleanup is a 1-line removal that surfaced from the verification gate.

## Issues Encountered

- **None beyond the worktree bootstrap noted in Deviations §1.** No regressions on prior-phase assertions — `test:rls` still 45/45 PASS, `test:exercise-chart` still 13/13 PASS. No regressions on tsc/lint — both 0-errors. The A8 fix is a single additional invalidateQueries call, contained inside the existing block — no module-load-order risk.

## User Setup Required

None — no external service configuration required. All wiring is client-side TypeScript + React Native; the RPC it consumes was already deployed in Plan 06-01a.

## Self-Check: PASSED

Verified deliverables on disk and in git:

- `app/lib/query/keys.ts` — MODIFIED (69 lines; contains `listInfinite:` literal); grep `listInfinite:` = 1 match
- `app/lib/queries/sessions.ts` — MODIFIED (223 lines; contains `useSessionsListInfiniteQuery`, `useInfiniteQuery`, `SessionSummarySchema.parse`, `p_cursor: pageParam`, `p_page_size: PAGE_SIZE`, `getNextPageParam`, `< PAGE_SIZE`); grep `useSessionsListInfiniteQuery` = 1 export + 0 self-refs (counted across file = 1 match per acceptance test)
- `app/lib/query/client.ts` — MODIFIED (906 lines; contains `sessionsKeys.listInfinite()` exactly once, inside the existing `['session','finish']` onSettled block with the inline `Phase 6 A8` comment); grep `sessionsKeys.listInfinite()` = 1 match
- `app/app/(app)/(tabs)/history.tsx` — REWRITTEN (240 lines; contains `useSessionsListInfiniteQuery`, `data?.pages.flat()`, `hasNextPage`, `isFetchingNextPage`, `onEndReachedThreshold={0.5}`, `RefreshControl`, `Historik`, `Inga pass än`, `— ingen plan`, `locale: sv`, `as Href` on `/history/[sessionId]`); no `console.log` left
- Commits FOUND in `git log --oneline`: `693b259`, `a926693`
- Service-role audit: no service-role import in any modified file (queries.ts + client.ts + tab screen all use the typed anon `supabase` client only)
- Verification gates: `npx tsc --noEmit` exits 0; `npx expo lint` exits 0 (0 errors, 0 warnings); `npm run test:rls` ALL ASSERTIONS PASSED (45); `npm run test:exercise-chart` ALL ASSERTIONS PASSED (13)

## Next Phase Readiness

- **Plan 06-02** can now route to `/history/[sessionId]` from any List row in `(tabs)/history.tsx` once it ships the route file. The `as Href` cast in HistoryListRow (line ~169) becomes droppable as soon as Plan 06-02's route file lands and the dev server regenerates `router.d.ts`. Plan 06-02's `useDeleteSession` setMutationDefaults block should follow the optimistic update pattern documented in 06-RESEARCH Pitfall 6: write to `{ pages, pageParams }` envelope, NOT a flat array — the cache slot is now `sessionsKeys.listInfinite()` and the F9 plan establishes that shape.
- **Plan 06-03** has no direct dependency on this plan (chart route is reached via session-detail card-header in Plan 06-02, not directly from (tabs)/history). 06-03 inherits the same `useColorScheme()` accent convention used here and in Plan 06-PATTERNS.
- **F9 closes end-to-end on user-visible slice.** Combined with Plan 06-01a's DB-tier RPC + Wave 0 harness, F9 is now ROADMAP success #1 complete (cursor-paginated list, sorted started_at DESC, working-set aggregates) AND ROADMAP success #4 complete (offline via persister cache — inherited from Phase 4 D-07 without new wiring). When Plan 06-02 ships its `(tabs)/history` → `/history/[sessionId]` route, F9 closes 100%; until then, the placeholder route 404 is acceptable (same pattern as Phase 4 plan-row taps before Plan 04-03 landed — UAT precedent).
- **A8 closed.** The `['session','finish']` onSettled handler now invalidates `sessionsKeys.listInfinite()` so finishing a workout makes the new session appear in Historik without waiting for the 30s staleTime. Tested implicitly by the test:rls + test:exercise-chart green-light (the smoke tests don't drive React but they confirm the RPC + invalidation key are stable).

---
*Phase: 06-history-read-side-polish*
*Plan: 01b*
*Completed: 2026-05-15*
