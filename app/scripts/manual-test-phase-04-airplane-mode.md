# Phase 4 — Manual Airplane-Mode Acceptance Test

> Gates ROADMAP success criteria #4 (airplane-mode end-to-end) and #5 (offline-banner state).
> Run on a real iPhone via Expo Go after Plans 01–04 are merged.

## Pre-test setup

- [ ] Expo Go open on iPhone, connected to the dev server (LAN or tunnel).
- [ ] Signed in as a test user (auth-store has a session — see Phase 3 sign-in flow).
- [ ] Planer tab is empty OR you have noted which plans pre-existed (so you can spot the new ones in Studio later).
- [ ] Browser open to Supabase Studio → Tables view (workout_plans / exercises / plan_exercises) — keep this tab pinned for step 5.
- [ ] Note the current state: count of rows in `workout_plans` WHERE user_id = your_user_id AND archived_at IS NULL.
- [ ] Note your test user's `id` (Studio → Authentication → Users → your row → copy id) — needed for SQL filtering.

## Step 1 — Pre-flight automated gates

Run from `app/` cwd; all must exit 0:

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm run test:rls`
- [ ] `npm run test:plan-schemas`
- [ ] `npm run test:exercise-schemas`
- [ ] `npm run test:plan-exercise-schemas`
- [ ] `npm run test:reorder-constraint`
- [ ] `npm run test:upsert-idempotency`
- [ ] `npm run test:offline-queue`
- [ ] `npm run test:sync-ordering`

If any fail, STOP and fix before proceeding to manual.

## Step 2 — Smoke-test the negative-index assumption (RESEARCH Assumption A1)

In Supabase Studio SQL editor (replace `<some-existing-pe-id>` with a real `plan_exercises.id` from your test data — pick any one; create one via the app first if your DB is empty):

- [ ] Run: `SELECT id, plan_id, order_index FROM plan_exercises WHERE id = '<some-existing-pe-id>';` — note the current `order_index`.
- [ ] Run: `UPDATE plan_exercises SET order_index = -1 WHERE id = '<some-existing-pe-id>';`
- [ ] Verify it succeeds (no error).
- [ ] Restore: `UPDATE plan_exercises SET order_index = <original> WHERE id = '<some-existing-pe-id>';`

If this fails, the two-phase reorder algorithm in Plan 01's `useReorderPlanExercises` will not work and Plan 04 must escalate to a Supabase RPC alternative (RESEARCH §3 option 2). DO NOT continue if this step fails.

## Step 3 — Airplane mode + create + drag

- [ ] Enable airplane mode (Control Center → airplane icon).
- [ ] **Verify offline banner appears within 2 seconds:** `Du är offline — ändringar synkar när nätet är tillbaka.` (Success Criterion #5 — first half).
- [ ] On Planer tab, tap "Skapa ny plan" (FAB) or empty-state CTA → fill name `Test Plan A` → tap `Skapa plan`.
  - [ ] Optimistic update: row appears in list immediately.
  - [ ] Routes to plan-detail screen.
- [ ] In plan-detail, tap `Lägg till övning` → in the picker, tap `+ Skapa ny övning` → fill name `Bänkpress`, muscle_group `Bröst`, equipment `Skivstång` → tap `Skapa & lägg till`.
  - [ ] Optimistic: returns to plan-detail with the new exercise visible in the list.
- [ ] Repeat: add 2 more exercises (`Pull-ups` and `Marklyft`) via the picker — use `+ Skapa ny övning` for each.
- [ ] Drag the third exercise (`Marklyft`) up to position 1 (above `Bänkpress`).
  - [ ] Order in the UI: `Marklyft`, `Bänkpress`, `Pull-ups` (optimistic).

## Step 4 — Force-quit the app

- [ ] Swipe up to bring up the app switcher; swipe Expo Go up to force-quit.
- [ ] Wait 5 seconds.
- [ ] Re-open Expo Go (still in airplane mode).
- [ ] Sign-in screen MUST be skipped (session restored from LargeSecureStore).
- [ ] Planer tab loads — `Test Plan A` MUST still be visible (cache hydrated from AsyncStorage).
- [ ] Tap `Test Plan A` — plan-detail loads — all 3 exercises MUST still be visible in the dragged order (`Marklyft`, `Bänkpress`, `Pull-ups`).
- [ ] OfflineBanner is still visible (still in airplane mode).

## Step 5 — Reconnect and verify

- [ ] Disable airplane mode (Control Center → airplane icon).
- [ ] **Verify offline banner disappears within 2 seconds** (Success Criterion #5 — second half).
- [ ] Wait 10–15 seconds for the queued mutations to flush.
- [ ] In Supabase Studio Tables view, verify:
  - [ ] `workout_plans`: 1 new row with name `Test Plan A`, your user_id, archived_at IS NULL.
  - [ ] `exercises`: 3 new rows (`Bänkpress`, `Pull-ups`, `Marklyft`) all with your user_id.
  - [ ] `plan_exercises`: 3 new rows linked to `Test Plan A` plan_id, each linked to the correct exercise_id.
  - [ ] **No duplicate rows** in any table for Test Plan A or its exercises (queue idempotency).
  - [ ] **No FK violation errors** in Supabase Logs (Studio → Logs → Postgres).
  - [ ] **`order_index` values match the dragged order:** `Marklyft` row has the smallest order_index, `Pull-ups` has the largest.

If all checks pass, **Success Criterion #4 is met.**

## Step 6 — Captive-portal scenario (RESEARCH Assumption A3)

This step verifies that NetInfo-online + Supabase-unreachable doesn't drop queued mutations.

- [ ] Connect iPhone to a wifi network that has no internet route to Supabase (options: a hotel/captive portal that blocks until login; a wifi network where you've blocked supabase.com in the router; OR temporarily pause your Supabase project from the dashboard).
- [ ] In airplane-mode-then-back-online state from Step 5, create one more plan via the Planer tab → CTA → form (name: `Test Plan B`).
- [ ] Verify:
  - [ ] OfflineBanner does NOT show (NetInfo says online).
  - [ ] The plan appears optimistically in the list.
  - [ ] The mutation is paused (not flushed; not in error state) — verify by waiting 30s then checking Studio: row should NOT appear yet.
- [ ] Switch to a working network or restore Supabase connectivity.
- [ ] Within 10–15s, the mutation flushes — verify the new plan appears in Studio.

If the mutation entered terminal error state (the row vanishes from the UI without ever appearing in Studio), the `networkMode: 'offlineFirst'` + `retry: 1` configuration in Plan 01's `lib/query/client.ts` needs adjustment. File a follow-up against Plan 01.

## Cleanup

- [ ] In Supabase Studio, delete `Test Plan A` and `Test Plan B` and their plan_exercises (or run `DELETE FROM workout_plans WHERE name IN ('Test Plan A', 'Test Plan B') AND user_id = '<your-user-id>';` — CASCADE handles plan_exercises).
- [ ] Optionally delete the 3 test exercises (`Bänkpress`, `Pull-ups`, `Marklyft`) if you don't want them in your library: `DELETE FROM exercises WHERE name IN ('Bänkpress', 'Pull-ups', 'Marklyft') AND user_id = '<your-user-id>';`

## Sign-off

- [ ] Step 1 (automated gates) all PASS.
- [ ] Step 2 (negative-index smoke test) PASS.
- [ ] Step 3 (airplane + create + drag) all PASS.
- [ ] Step 4 (force-quit + cache hydration) all PASS.
- [ ] Step 5 (reconnect + Studio verify + no duplicates + no FK errors + correct order) all PASS.
- [ ] Step 6 (captive-portal mitigation) PASS.

When all 6 steps PASS, mark Phase 4 Success Criterion #4 + #5 as MET in `04-VERIFICATION.md` (created by `/gsd-verify-work 4`).

Tester signature + date: __________________________________
