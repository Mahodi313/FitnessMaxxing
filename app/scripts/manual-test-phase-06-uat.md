# Phase 6 — Manual UAT Checklist (History List + Detail + Chart)

> Seeded by Plan 06-01a. Plans 06-01b (history list slice), 06-02
> (session-detail + delete flow), and 06-03 (F10 chart + Senaste 10 passen +
> entry-points) extend the relevant sections in-place.
>
> Run on a real iPhone via Expo Go after all four Phase 6 plans are merged.

## Pre-test setup

- [ ] Clean install of Expo Go on iPhone, connected to dev server (LAN or
      tunnel).
- [ ] Signed in as a test user (auth-store has a session — see Phase 3 sign-in
      flow). Note the user's `id` from Supabase Studio → Authentication →
      Users → your row → copy `id`.
- [ ] At least **3 finished workouts** logged across multiple plans —
      including at least one against an **archived plan** (UI must still show
      the plan name per D-08) and at least one **empty 0-set session**
      (created via "Starta pass" + immediately "Avsluta pass" — UI must still
      render the row gracefully per D-13).
- [ ] Supabase Studio open in browser; SQL editor available.
- [ ] Airplane-mode toggle accessible (iOS Control Center).

## Pre-flight automated gates

All must exit 0 from `app/` cwd BEFORE opening Expo Go on the device:

- [ ] `npx tsc --noEmit`
- [ ] `npx expo lint`
- [ ] `npm run test:rls` (assertion count ≥ 34 — Phase 6 extension adds 5)
- [ ] `npm run test:exercise-chart` (Wave 0 — all 13 assertions PASS)
- [ ] `npm run test:last-value-query`
- [ ] `npm run test:offline-queue`
- [ ] `npm run test:sync-ordering`
- [ ] `npx tsx --env-file=.env.local scripts/verify-deploy.ts` (Phase 6 RPC
      verification block reports all three functions as SECURITY INVOKER +
      search_path set)

Service-role audit gate (from repo root, MUST return no matches in client
source):

- [ ] `git grep "service_role\|SERVICE_ROLE" -- "app/lib/**" "app/app/**" "app/components/**"` is empty.

If any of the above fail, **STOP** and fix before running the manual flow.

## F9 History-list offline hydration (ROADMAP success #4)

> Plan 06-01b fills in the detailed steps. Skeleton:

- [ ] Open Historik tab while ONLINE — list renders in DESC order by
      `started_at`; each row shows date + plan name (or `— ingen plan`) +
      `set_count set` + `total_volume_kg kg`.
- [ ] Pull-to-refresh works.
- [ ] Enable airplane mode (Control Center → airplane icon).
- [ ] Force-quit Expo Go via app switcher; wait 5s; re-open.
- [ ] Sign-in screen is skipped (session restored from LargeSecureStore).
- [ ] Historik tab loads — the same rows are visible (cache hydrated from
      AsyncStorage). `<OfflineBanner />` is visible.
- [ ] Tap a row — session-detail screen loads from cache (Plan 06-02 wires).
- [ ] Disable airplane mode; banner disappears within 2s.

## F9 History-list cursor pagination (ROADMAP success #1)

> Plan 06-01b fills in the detailed steps. Skeleton:

- [ ] Pre-seed (via test fixtures or Studio): ≥ 25 finished sessions for the
      test user across distinct days.
- [ ] Open Historik tab — first page of 20 rows renders.
- [ ] Scroll to the bottom — a footer `ActivityIndicator` appears briefly;
      next 5 rows load.
- [ ] Scroll past the last row — no infinite-fetch loop (page 3 returns 0
      rows, `getNextPageParam` returns undefined).
- [ ] Network tab in Studio / app logs: exactly 2 RPC calls fired
      (`get_session_summaries` with `p_cursor=null` and `p_cursor=<page1.last.started_at>`).

## F9 Session-detail open + read (ROADMAP success #2)

> Plan 06-02 wires this. Pre-condition: ≥ 3 finished sessions exist (seed
> via dev account if soak data not present, including the empty 0-set
> session from Pre-test setup).

- [ ] Open Historik tab → tap any row → expect navigation to
      `/history/<id>`.
- [ ] Verify Stack header shows the formatted date (e.g. `14 maj 2026`)
      with swedish locale.
- [ ] Verify summary-header chip row renders three chips: `${set_count}
      set`, `${formatNumber(total_volume_kg)} kg`, `${duration} min`.
- [ ] Verify each exercise-card shows: exercise name + chip row
      (`${set_count} set` + `${max_weight} kg`) + N set-rows in order
      (`Set 1: 82.5 × 8`, `Set 2: 82.5 × 8`, …).
- [ ] Verify the card-header right-edge has the `stats-chart` Ionicon in
      accent color (cross-link affordance to F10 chart route — D-11/D-25).
- [ ] Verify empty-pass (0 sets but `finished_at IS NOT NULL` — D-13)
      renders `0 set · 0 kg · X min` summary and shows zero exercise-cards.
- [ ] Verify back-button returns to Historik tab.
- [ ] Verify loading state surfaces `Laddar…` Body Muted when cache is
      cold (rare path — usually initialData from the list cache seeds the
      detail synchronously per D-12).
- [ ] Verify error state surfaces `Något gick fel. Försök igen.` when
      `useSessionQuery` returns error (deep-link to RLS-denied id).

## F9 Delete-pass online flow (D-07)

> Plan 06-02 wires this. Pre-condition: at least one disposable test
> session you are willing to delete.

- [ ] From session-detail → tap header-right `…` icon → overflow menu
      appears at top-right.
- [ ] Verify menu item `Ta bort pass` renders in red destructive color.
- [ ] Tap `Ta bort pass` → overflow menu closes + delete-confirm overlay
      appears.
- [ ] Verify confirmation body shows exact count + volume:
      `${count} set och ${formatNumber(volume)} kg total volym försvinner
      permanent. Det går inte att ångra.`
- [ ] Tap `Avbryt` → overlay dismisses, screen still on session-detail.
- [ ] Re-tap `…` → `Ta bort pass` → tap on scrim (outside the dialog) →
      overlay dismisses (parity with plans/[id] archive-confirm UX).
- [ ] Re-tap `…` → `Ta bort pass` → `Ta bort` → expect:
  - Optimistic remove from list cache (the row disappears from Historik
    before the network roundtrip completes — Pitfall 6 envelope mapping).
  - `router.replace` lands the user on the Historik tab.
  - `Passet borttaget` toast renders bottom-center on accent-blue
    background (`bg-blue-600` light / `bg-blue-500` dark) for ~2s before
    fading out.
- [ ] Verify in Supabase Studio: the `workout_sessions` row is gone +
      all associated `exercise_sets` rows are gone via the FK on-delete
      cascade.
- [ ] Verify history-list does NOT show the deleted session even after
      pull-to-refresh.

## F9 Delete-pass OFFLINE flow (networkMode:'offlineFirst' + Phase 4 queue replay)

> Plan 06-02 wires this. Pre-condition: at least two disposable test
> sessions.

- [ ] Online → tap delete on a test session → verify deletion lands in
      Supabase Studio.
- [ ] On a different test session: enable Airplane Mode → tap delete →
      verify optimistic remove from list + `Passet borttaget` toast both
      appear immediately (mutation is paused under
      networkMode:'offlineFirst' but the UI is synchronous).
- [ ] Force-quit Expo Go via app switcher → reopen offline → verify
      session is still gone from Historik (cache restored from
      AsyncStorage via TanStack persister).
- [ ] Toggle Airplane Mode off → wait ~10s for `resumePausedMutations`
      to fire (NetInfo + AppState wiring from Plan 04-01) → check
      Supabase Studio: the deleted session is also gone server-side
      (mutation replayed).
- [ ] Verify the FK on-delete cascade purged the orphan
      `exercise_sets` rows server-side after the offline replay.

## F9 freezeOnBlur overlay-reset (Pitfall 7 regression test)

> Plan 06-02 wires this via `useFocusEffect` cleanup. Pitfall 7 in
> 06-RESEARCH.md documents the failure mode (freezeOnBlur retains React
> state across navigation, so an open overlay re-appears on re-focus).

- [ ] Open a session-detail → tap `…` → confirm overflow menu visible.
- [ ] Swipe back to Historik → swipe forward (or tap row again) to return
      to session-detail → expect overflow menu is NOT visible
      (useFocusEffect cleanup ran on blur).
- [ ] Same with delete-confirm overlay: open `…` → `Ta bort pass` →
      delete-confirm overlay visible → swipe back → swipe forward →
      expect overlay is NOT visible.

## F9 Cross-link to chart (D-11 + D-25)

> Plan 06-02 wires the Pressable; Plan 06-03 ships the destination route.

- [ ] From session-detail → tap an exercise-card header (the exercise name
      area with the stats-chart icon) → expect navigation to
      `/exercise/<id>/chart`.
- [ ] **Before Plan 06-03 ships:** the tap is wired (the path literal
      compiles via the `as Href` cast) but the dev server resolves to a
      404 because the route file does not exist yet — this is expected
      and resolves when Plan 06-03's `chart.tsx` commit lands.

## F9 Cross-user RLS gate (visual confirm; assertion already covered)

> The `app/scripts/test-rls.ts` Phase 6 extension shipped in Plan 06-01a
> already asserts cross-user DELETE is blocked (T-06-03 + T-06-12). The
> UAT step below is a visual smoke check — it does NOT replace the
> automated assertion.

- [ ] If you have a second Supabase account, sign in as User B in a
      separate browser to Supabase Studio. Confirm User A's
      `workout_sessions.id` is NOT visible from User B's anon client.
- [ ] Optional: paste User A's session-id into a deep link
      (`fitnessmaxxing://history/<a-id>`) while signed in as User B →
      session-detail screen surfaces `Något gick fel. Försök igen.`
      because `useSessionQuery` returns no data under RLS.

## F10 Chart route entry-points (D-24, D-25, D-26)

> Plan 06-03 ships the `/exercise/[exerciseId]/chart` route file and the
> chart-icon affordance on `plans/[id].tsx` between the edit and remove
> Pressables (UI-SPEC §Visuals JSX lines 671-684; WARN-5 deviation
> documented in 06-03 chart.tsx file header). Plan 06-02's session-detail
> card-header cross-link (D-25) becomes a live link once Plan 06-03 lands.

- [ ] From `plans/[id]` — tap the chart-icon (stats-chart, accent color)
      between the edit and remove icons on any plan_exercise row → expect
      navigation to `/exercise/<exerciseId>/chart`.
- [ ] From `history/[sessionId]` — tap an exercise-card header → expect
      same navigation (D-25 cross-link resolves; the `as Href` cast in
      Plan 06-02's session-detail file is now redundant when the dev server
      regenerates `router.d.ts`).
- [ ] Verify Stack header title shows `exercise.name` (e.g. `Bänkpress`).
      Fallback `Övning` only renders if the exercise was deleted or the
      exercises cache hasn't hydrated (cold deep-link path).
- [ ] Manual finger-test on iPhone: the chart-icon hit-target is ≥ 44pt
      (UI-SPEC line 286 — `hitSlop={6}` + `p-3` padding = 46pt effective).
      Tapping the chart-icon does NOT trigger the drag/edit/remove sibling
      affordances (06-RESEARCH Pitfall 8 — sibling-Pressable independence).

## F10 Metric + Window toggles (D-14, D-15)

> Plan 06-03's chart-route uses two `<SegmentedControl>` instances: one for
> metric (Max vikt / Total volym), one for window (1M / 3M / 6M / 1Y / All).

- [ ] Open the chart route for the first time → expect `Max vikt` segment
      selected (D-14 default) AND `3M` segment selected (D-15 default).
- [ ] Tap `Total volym` → the chart line redraws with new y-values; the
      segmented-control highlights the new tile via the white/gray-700
      shadow.
- [ ] Tap `1M` → chart shrinks (fewer x-axis ticks). Tap `All` → chart
      expands (more x-axis ticks; year may appear on year-boundary ticks).
      Tap `3M` → cache-hit, no loading spinner.
- [ ] Re-tap `Max vikt` + `3M` → cache-hit, instant render.

## F10 Memoization verified (ROADMAP success #3 + D-21 + WARN-7)

> The useMemo dep array over `chartQuery.data` is EXACTLY
> `[chartQuery.data]` — metric/window already live in the queryKey so
> they would only cause redundant recomputes.

- [ ] Open the chart route → tap the metric toggle 5× rapidly (back and
      forth between Max vikt and Total volym).
- [ ] Verify the chart line transitions smoothly between metrics with no
      full re-mount flicker (the canvas does NOT flash empty between
      transitions).
- [ ] If the line re-mounts on every tap (visible "blink" or animation
      restart) → FAIL: the dep array is probably wrong; check that
      `[chartQuery.data]` is the EXACT array in chart.tsx.

## F10 Graceful degrade — two-state empty-state (D-17, BLOCKER-3)

> Two-state empty rendering: window-empty vs all-time-empty. A second
> `useExerciseChartQuery(id, metric, 'All')` query disambiguates the cases.

- [ ] Pick an exercise with 0 logged sets — navigate to its chart →
      verify ALL-TIME-EMPTY state: `Ionicons stats-chart-outline` icon +
      heading `Inga pass än för den här övningen` + body
      `Logga minst 2 set för att se trend.`
- [ ] Seed (via Studio or app) 2 working sets for that exercise on a date
      6 months ago (outside the 3M window). Re-open the chart → expect
      WINDOW-EMPTY state: heading `Inga pass i detta intervall` + body
      `Byt till All för att se hela historiken.`
- [ ] Tap the `All` window segment → expect the chart to render the 2
      data points (the disambiguation worked).
- [ ] Pick an exercise with ≥ 2 working sets in the 3M window → verify
      the full line chart renders with axes + dots + line.
- [ ] Pick an exercise with EXACTLY 1 data point in the window → verify
      the single dot renders + a caption appears under the canvas:
      `Logga ett pass till för att se trend.`

## F10 Tap-and-hold Skia tooltip (D-19, BLOCKER-1, Pitfall 2)

> Plan 06-03's chart.tsx renders a FULL Skia tooltip callout
> (RoundedRect + two SkiaText nodes) via the ChartPressCallout sub-
> component — NOT a placeholder highlight.

- [ ] Open a chart with ≥ 3 data points → tap-and-hold on a data point →
      expect BOTH the highlight Circle AND the rounded-rect tooltip
      callout to appear at/near the tapped point.
- [ ] Verify tooltip content:
  - Top line shows `${weight} kg` for Max vikt (e.g. `82.5 kg`).
  - Top line shows formatted-number kg for Total volym (e.g.
    `3 240 kg`).
  - Bottom line shows the date in Swedish format (e.g. `14 maj 2026`).
- [ ] Drag the finger across the chart → both tooltip and highlight
      follow the nearest data point.
- [ ] Verify the tooltip rect stays INSIDE the chart canvas at the left
      and right edges (`chartBounds` clamping prevents off-canvas clip).
- [ ] Lift the finger → tooltip and highlight disappear within ~1 frame.

## F10 Theme awareness (D-23 + Phase 1 F15)

- [ ] In light mode → chart line is `#2563EB` (blue-600); tooltip
      background `#FFFFFF`; axis labels `#6B7280` (gray-500).
- [ ] iOS Settings → Display → Dark → return to app → chart line is
      `#60A5FA` (blue-400); tooltip background `#1F2937` (gray-800); axis
      labels `#9CA3AF` (gray-400). All theme bindings come from one
      `useColorScheme()` call at the top of the chart component (D-23).

## F10 Senaste 10 passen list — tappable rows with reps preservation (D-20, BLOCKER-2)

> Plan 06-03 wires `useExerciseTopSetsQuery` against the
> `get_exercise_top_sets` RPC Plan 06-01a deployed. The chart-aggregated
> RPC cannot deliver reps per source session; the top-sets RPC closes
> the gap (BLOCKER-2 dual-RPC design).

- [ ] Below the chart on an exercise with ≥ 1 day of data → expect a
      section header `Senaste 10 passen` + a list of up to 10 rows.
- [ ] Each row primary line shows the formatted date (e.g.
      `14 maj 2026`); secondary line shows
      `${weight_kg} kg × ${reps}` (e.g. `82.5 kg × 8`). Reps are
      preserved as int through the `TopSetRowSchema.parse` boundary.
- [ ] **Tap any row → expect navigation to /history/<that-session-id>**
      — the source session opens with all sets visible (Plan 06-02 owns
      the destination route).
- [ ] Verify the `Senaste 10 passen` section is OMITTED entirely when
      either of the chart-empty-state paths is active (window-empty OR
      all-time-empty).
- [ ] Cross-user RLS attempt: while signed in as User A, paste User B's
      `exercise_id` into the deep link `fitnessmaxxing://exercise/<b-id>/chart`
      → expect ALL-TIME-EMPTY state (RPC returns 0 rows under RLS;
      Senaste 10 section is omitted).

## Cleanup

- [ ] Optional: in Studio, delete the test sessions/sets created above (or
      keep them as fixtures for the next UAT pass).

## Sign-off

- [ ] Pre-flight automated gates: all PASS.
- [ ] F9 offline hydration: PASS.
- [ ] F9 cursor pagination: PASS.
- [ ] Plan 06-02 session-detail + delete: PASS (after Plan 06-02 ships).
- [ ] Plan 06-03 chart + Senaste 10 passen + entry-points: PASS (after
      Plan 06-03 ships).

Tester signature + date: __________________________________
