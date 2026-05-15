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

## Plan 06-03 TODO — F10 chart + Senaste 10 passen + entry-points

> Plan 06-03 fills in this section. Skeleton:

- [ ] Open Planer → tap a plan → tap the chart-icon (stats-chart) on a
      plan_exercise row → routes to `/exercise/<exerciseId>/chart`.
- [ ] Chart route loads — Stack header title = exercise name.
- [ ] Two segmented controls: metric (Vikt / Volym) defaulting to Vikt;
      window (1M / 3M / 6M / 1Y / All) defaulting to 3M per D-15.
- [ ] Chart renders via Victory Native XL `<CartesianChart>` — line +
      scatter + tooltip on press; theme-aware accent.
- [ ] Toggle metric: chart re-fetches; cache key includes (exerciseId,
      metric, window).
- [ ] Toggle window: same.
- [ ] Empty-state (D-17 two-state):
  - [ ] "Inga pass än för den här övningen" + caption "Logga minst 2 set
        för att se trend." — when ZERO data ever.
  - [ ] "Ingen data i valt tidsfönster — prova All" — when data exists
        but current window is empty.
- [ ] Senaste 10 passen list below chart: one row per source session,
      ordered DESC by `completed_at`, showing
      `${format(completed_at, "d MMM yyyy")}` + `${weight_kg} kg × ${reps} reps`.
- [ ] Tap a row → routes to `/history/<session_id>` (D-20).
- [ ] Cross-user attempt blocked (RLS — exercise-chart RPC returns empty for
      another user's exercise_id; UI surfaces empty-state).
- [ ] Single-point case (1 day of data): chart renders the dot
      automatically; no crash.
- [ ] Plans/[id] chart-icon Pressable does NOT bubble drag/edit/remove on
      siblings (06-RESEARCH.md Pitfall 8).

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
