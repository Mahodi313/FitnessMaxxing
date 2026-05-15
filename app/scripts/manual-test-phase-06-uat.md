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

## Plan 06-02 TODO — session-detail + delete flow

> Plan 06-02 fills in this section. Skeleton:

- [ ] Tap a finished session in Historik → session-detail screen loads.
- [ ] Summary chip-header shows `${set_count} set · ${total_volume_kg} kg ·
      ${duration} min` (duration = `differenceInMinutes(finished_at,
      started_at)`; `'—'` when finished_at is null per D-10).
- [ ] Card-per-exercise list renders; tapping a card-header routes to
      `/exercise/<exerciseId>/chart` (Plan 06-03 chart route).
- [ ] Overflow menu (ellipsis-horizontal) opens → "Ta bort pass" → inline
      overlay confirm `Ta bort detta pass?` with summary copy.
- [ ] Cancel: dismisses overlay.
- [ ] Confirm: optimistic delete (row gone from list), navigate back to
      Historik, FK on-delete-cascade purges exercise_sets server-side.
- [ ] Airplane-mode delete + force-quit: queued mutation replays on
      reconnect; row stays gone in Historik AND Studio.
- [ ] Cross-user attempt blocked (test-rls.ts Phase 6 extension covers; UAT
      visually confirms a wrong user_id never appears).

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
