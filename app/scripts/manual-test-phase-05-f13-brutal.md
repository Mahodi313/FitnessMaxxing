# Phase 5 — F13 Brutal-Test Manual UAT

> Gates ROADMAP success criterion #6 (Phase 5 existential gate): "airplane mode + force-quit + battery-pull-simulering under 25-set-pass = alla 25 set överlever och synkar i rätt ordning vid återanslutning (idempotent via klient-genererade UUIDs + `scope.id` serial replay)."
>
> Run on a real iPhone via Expo Go after Plans 05-01, 05-02, and 05-03 are merged.

## Why this test cannot be automated

This is a **system test** combining native OS behavior (airplane-mode toggle, force-quit via app switcher, OS-level RAM reclamation), JS engine lifecycle, AsyncStorage durability, Supabase REST round-trips, and visual confirmation in Supabase Studio. **No off-the-shelf React Native test runner can simulate all of these.** Detox can airplane-mode and force-quit but cannot simulate a true battery-pull (it shuts the app via JS bridge, not `kill -9`). Maestro is similar.

The Wave 0 automated scripts (`test-offline-queue.ts`, `test-sync-ordering.ts`) prove the **contract layer**: that paused mutations serialize across persist/restart and that `scope.id` serializes replay. They cannot prove the **end-to-end system** because they don't exercise iOS-specific lifecycle (background → SIGKILL → reload). This brutal-test is the system-level acceptance gate; the Wave 0 scripts are the unit-/contract-level gates.

## Pre-flight automated gates

All of these MUST exit 0 BEFORE opening Expo Go on the test device. Run from `app/` cwd:

- [ ] `npx tsc --noEmit`
- [ ] `npx expo lint`
- [ ] `npm run test:rls` (assertion count ≥ 35)
- [ ] `npm run test:session-schemas`
- [ ] `npm run test:set-schemas`
- [ ] `npm run test:last-value-query`
- [ ] `npm run test:offline-queue`
- [ ] `npm run test:sync-ordering`
- [ ] `npm run test:upsert-idempotency`
- [ ] `npm run test:reorder-constraint`
- [ ] `npm run test:plan-schemas`
- [ ] `npm run test:exercise-schemas`
- [ ] `npm run test:plan-exercise-schemas`

Service-role audit gate (from repo root, MUST return empty):

- [ ] `git grep "service_role\|SERVICE_ROLE" -- "*.ts" "*.tsx" "*.js" "*.jsx" ":!.planning/" ":!app/scripts/" ":!app/.env.example" ":!CLAUDE.md"`

If any of the above fail, **STOP** and fix before proceeding to the manual test. The brutal-test is meaningful only when the contract layer is green.

## Preconditions

- [ ] Physical iPhone running Expo Go, connected to the dev server (LAN or tunnel).
- [ ] Test user account signed in (e.g. `f13-brutal-test-user@fitnessmaxxing.local` — create via Supabase Studio Authentication > Users if it doesn't exist; the `handle_new_user` trigger creates the `profiles` row automatically).
- [ ] At least one plan with **≥ 3 plan_exercises** configured for this user (a "Push Day" or similar with bench/squat/row). Create via the Planer tab if needed.
- [ ] Supabase Studio open in browser; SQL editor available; filter helper for `user_id` queries.
- [ ] Airplane-mode toggle accessible (iOS Control Center).
- [ ] Reachable WiFi to reconnect.
- [ ] Optional: iPhone screen recording enabled (Settings > Control Center > Screen Recording) for documentation.

## Phase 1 — Setup (online)

1. [ ] Confirm `<OfflineBanner />` is **NOT visible** (online state).
2. [ ] Confirm `<ActiveSessionBanner />` is **NOT visible** (no draft session).
3. [ ] Confirm no draft-resume overlay appears on the Planer tab.
4. [ ] In Supabase Studio, run:
   ```sql
   SELECT COUNT(*) AS s0 FROM workout_sessions WHERE user_id = '<TEST_USER_ID>';
   SELECT COUNT(*) AS e0 FROM exercise_sets WHERE session_id IN (
     SELECT id FROM workout_sessions WHERE user_id = '<TEST_USER_ID>'
   );
   ```
   Record `S0` (sessions baseline) and `E0` (sets baseline).

## Phase 2 — Go offline + start workout

5. [ ] **Toggle airplane mode ON** (Control Center → airplane icon).
6. [ ] Within 2s confirm `<OfflineBanner />` appears with copy `Du är offline — ändringar synkar när nätet är tillbaka.`
7. [ ] Navigate to the test plan (Planer → tap plan-row → plans/[id] screen).
8. [ ] Tap **"Starta pass"**. Confirm:
   - [ ] The screen routes to `/workout/<sessionId>` within 500ms (optimistic navigation — D-02).
   - [ ] The exercise-card list renders.
   - [ ] `<ActiveSessionBanner />` is **hidden** (we're on the workout screen — segments-check gates).
9. [ ] **Note the URL's `sessionId`** (long-press the URL bar or open Expo dev menu → copy the route). Call this `SESSION_ID`.

## Phase 3 — Log 9 sets (slow tempo, mixed exercises)

For each of the first 3 exercises, log 3 sets:

10. [ ] Exercise 1, Set 1: weight `100`, reps `8`. Tap **Klart**. Confirm:
    - [ ] New row appears above the input row within 200ms.
    - [ ] Set counter chip updates (`1 set` or `1/X set klart`).
    - [ ] F7 chip (`Förra: ...`) may or may not be present depending on prior history.
11. [ ] Exercise 1, Set 2: weight `102.5`, reps `7`. Klart.
12. [ ] Exercise 1, Set 3: weight `105`, reps `6`. Klart.
13. [ ] Exercise 2, Set 1: weight `60`, reps `10`. Klart.
14. [ ] Exercise 2, Set 2: weight `60`, reps `10`. Klart.
15. [ ] Exercise 2, Set 3: weight `62.5`, reps `9`. Klart.
16. [ ] Exercise 3, Set 1: weight `120`, reps `5`. Klart.
17. [ ] Exercise 3, Set 2: weight `120`, reps `5`. Klart.
18. [ ] Exercise 3, Set 3: weight `122.5`, reps `4`. Klart.
19. [ ] **Total so far: 9 sets across 3 exercises.**

## Phase 4 — Force-quit (battery-pull simulation)

20. [ ] From the workout screen with the keyboard NOT shown (tap outside any input first), **double-tap the home indicator** (or swipe up from bottom on Face ID iPhones) to bring up the iOS app switcher.
21. [ ] **Swipe Expo Go up** to force-close.
22. [ ] **Wait 5 seconds.** (Simulates the OS reclaiming the app's RAM — `kill -9` equivalent.)
23. [ ] Re-open Expo Go and load the project.

## Phase 5 — Verify offline cache survived force-quit

24. [ ] After splash dismisses, confirm:
    - [ ] User lands on `(tabs)/index.tsx` (Planer tab).
    - [ ] Sign-in screen MUST be skipped (session restored from LargeSecureStore — Phase 3 contract).
    - [ ] `<OfflineBanner />` is **visible** (still in airplane mode).
    - [ ] `<ActiveSessionBanner />` is **visible** with copy `Pågående pass · Tryck för att återgå` (or similar — UI-SPEC §line 282).
    - [ ] The **draft-resume overlay** renders on `(tabs)/index` within ~1s with copy:
       `Du har ett pågående pass från [HH:MM] med 9 set sparade.`
       This confirms the persister hydrated BOTH the session cache AND the sets cache (Pitfall 1 — module-load-order intact).
25. [ ] Tap **Återuppta**. Confirm:
    - [ ] Screen routes to `/workout/<SESSION_ID>` (**same ID as Phase 2 step 9**).
    - [ ] All 9 previously-logged sets are visible in the cards.

## Phase 6 — Log another 16 sets while still offline (reaches 25 total) + mid-flight force-quit

26. [ ] Continue logging across all 3 exercises until total = **25 sets**. Vary tempo: log some quickly, pause 30s between others, scroll between cards, dismiss and re-show the keyboard.
27. [ ] **After set 15 (so total = 24 sets), force-quit AGAIN** (repeat Phase 4 steps 20–23) — this re-tests durability mid-flight under a queue with ~6 pending set mutations.
28. [ ] Re-open. Verify on Planer tab: draft-resume overlay says `24 set sparade` (or whatever count matches the actual setpoint; per-exercise set counters in the cards should also match).
29. [ ] Tap **Återuppta**. Confirm cache hydrated with the 24 sets.
30. [ ] Log set 25 (any exercise, weight `130`, reps `3`). Confirm card counter increments to reflect 25 total.
31. [ ] **Total now: 25 sets across 3 exercises.**

## Phase 7 — Tap Avsluta while still offline (optional sub-scenario)

32. [ ] **OPTIONAL:** Tap **Avsluta** (header-right action). The Avsluta-overlay appears.
33. [ ] **OPTIONAL:** Confirm `25 set sparade. Avsluta passet?` text.
34. [ ] **OPTIONAL:** Tap **Avsluta** in the overlay. Confirm:
    - [ ] Router replaces to `/(app)/(tabs)/`.
    - [ ] `<ActiveSessionBanner />` and draft-resume overlay both unmount immediately (optimistic cache clear).
    - [ ] `Passet sparat ✓` toast appears at bottom-center on Planer tab for ~2 seconds.

Otherwise skip to Phase 8 with the session still active.

## Phase 8 — Reconnect

35. [ ] **Toggle airplane mode OFF** (Control Center → airplane icon).
36. [ ] Within 5s confirm `<OfflineBanner />` disappears.
37. [ ] Within ~10s, mutations begin replaying. (Monitor Expo Go's JS console via dev menu if you can — look for `[network] online: true` log line and absence of any error stack traces.)
38. [ ] Wait **~30 seconds** for replay to complete (25 set inserts + optional finish UPDATE serialize under the shared `scope.id`).

## Phase 9 — Verify in Supabase Studio

39. [ ] Open Supabase Studio → SQL editor. Run:
    ```sql
    SELECT id, started_at, finished_at FROM workout_sessions
    WHERE id = '<SESSION_ID>';
    ```
    Confirm:
    - [ ] Exactly **1 row** exists with `id = <SESSION_ID>` (the client-generated UUID from Phase 2).
    - [ ] `finished_at` is set (if Phase 7 ran) OR `finished_at IS NULL` (if Phase 7 was skipped).

40. [ ] Run:
    ```sql
    SELECT exercise_id, set_number, weight_kg, reps, completed_at, set_type
    FROM exercise_sets WHERE session_id = '<SESSION_ID>'
    ORDER BY exercise_id, set_number;
    ```
    Confirm:
    - [ ] Exactly **25 rows** returned.
    - [ ] `set_number` values are **contiguous per `exercise_id`** (1, 2, 3, …).
    - [ ] `weight_kg` and `reps` match what was tapped during Phase 3 + Phase 6 (spot-check at least the first set of each exercise and the final set 25).
    - [ ] All `set_type = 'working'`.
    - [ ] All `completed_at` are valid ISO timestamps within the test window.

41. [ ] Verify the total row count changed by exactly **+1 for `workout_sessions`** and **+25 for `exercise_sets`** since the `S0` / `E0` baseline. Re-run the Phase 1 step 4 SQL queries; the new counts MUST be `S0 + 1` and `E0 + 25` respectively.

## Phase 10 — Verify no FK errors or duplicates

42. [ ] In Supabase Studio → Database → Logs, scan the Postgres logs for the test window. Confirm:
    - [ ] **Zero** `23505` (unique_violation) errors.
    - [ ] **Zero** `23503` (foreign_key_violation) errors.
    - [ ] No 4xx/5xx HTTP errors on the PostgREST endpoints.
43. [ ] (Phase 6 territory if Historik is built) Verify the session row appears in Historik in the app. Defer to Phase 6 verification if Historik isn't shipped yet — this Phase 5 brutal-test cares only about DB state.

## Pass criteria

All MUST be true for sign-off:

- [ ] All **25 sets** present in Supabase with correct values.
- [ ] **No FK errors**, **no duplicate-PK errors** in Postgres logs.
- [ ] The `workout_sessions` row's UUID matches the **client-generated** one (URL captured in Phase 2 step 9 == DB id in Phase 9 step 39).
- [ ] `set_number` values are **contiguous per exercise** (1, 2, 3, …).
- [ ] (If Phase 7 ran) `finished_at` is the **latest** timestamp; all sets have **earlier** `completed_at`.

## Failure modes — what each anomaly indicates

If any of the above fails, escalate per the matrix:

| Symptom | Root cause to investigate |
|---|---|
| Missing sets in Supabase (count < 25) | Persister failed to serialize OR scope-replay dropped a mutation. Check `app/lib/query/persister.ts` AsyncStorage roundtrip + `app/lib/query/client.ts` setMutationDefaults for `['set','add']`. |
| Out-of-order `set_number` (e.g. `1, 2, 4` skipping 3) | Scope-replay broke FIFO order. Verify `app/lib/queries/sets.ts` uses constructor-time scope binding (`scope: { id: 'session:${sessionId}' }` — STATIC string, never function — Pitfall 3). |
| Duplicate rows with different `id`s | Optimistic-update fired without client UUID OR upsert used wrong `onConflict`. Verify `useAddSet` mutationFn calls `.upsert({...}, { onConflict: 'id', ignoreDuplicates: true })`. |
| FK errors (23503) in Postgres logs | `useStartSession` mutation replayed AFTER `useAddSet` mutations. Verify `scope.id` is shared as `session:<id>` for BOTH hooks (sessions.ts AND sets.ts). |
| Session row's `finished_at` set BEFORE all sets are in | Finish UPDATE landed before set INSERTs (scope-replay broken). Verify `useFinishSession` uses the same `session:<id>` scope so it queues at the END of the FIFO chain. |
| Unique-violation (23505) | Two replays of the same client-UUID without `ignoreDuplicates: true`. Verify upsert config. |
| `<ActiveSessionBanner />` contrast looks like near-white on physical iPhone | Phase 4 UAT-color-amendment precedent (commit cfc1dc8). Bump `bg-blue-100` → `bg-blue-200` and `border-blue-300` → `border-blue-400` in `app/components/active-session-banner.tsx`. Document as a UI-SPEC patch in `05-03-SUMMARY.md`. |
| Draft-resume overlay does NOT appear on cold-start with active session | useFocusEffect cleanup or persister hydration broken. Verify `(tabs)/index.tsx` calls `useActiveSessionQuery` AND the persister bootstrap runs before any `useQuery` registration (Pitfall 1 — module-load-order). |

## Optional sub-scenarios (run if time permits)

- [ ] **Captive-portal scenario:** Connect iPhone to a wifi where NetInfo says online but Supabase is unreachable (e.g. hotel captive portal, OR pause Supabase project briefly). Confirm queued mutations stay paused (no terminal error), then flush correctly when connectivity is restored.
- [ ] **Multi-unfinished-session race:** Manually create a 2nd `workout_sessions` row with `finished_at IS NULL` via Supabase Studio (same user) while the in-app session is also active. Confirm `useActiveSessionQuery` uses `ORDER BY started_at DESC LIMIT 1` so the most-recent draft surfaces in the banner + overlay. Clean up the manual row afterwards.

## Cleanup (optional)

- [ ] Delete the test session via Supabase Studio:
  ```sql
  DELETE FROM workout_sessions WHERE id = '<SESSION_ID>';
  -- exercise_sets cascade via FK ON DELETE CASCADE (0001_initial_schema.sql line 74)
  ```

## Sign-off

When all 10 phases above PASS, the F13 brutal-test gate is closed and Phase 5 success criterion #6 is MET.

- [ ] Pre-flight automated gates all PASS.
- [ ] Phase 1 (setup) PASS.
- [ ] Phase 2 (offline + start) PASS.
- [ ] Phase 3 (log 9 sets) PASS.
- [ ] Phase 4 (force-quit #1) PASS.
- [ ] Phase 5 (cache hydration verified) PASS.
- [ ] Phase 6 (log to 25 + force-quit #2) PASS.
- [ ] Phase 7 (Avsluta — optional) PASS / SKIPPED.
- [ ] Phase 8 (reconnect) PASS.
- [ ] Phase 9 (Studio verify — 25 contiguous rows, correct UUID) PASS.
- [ ] Phase 10 (no FK/unique errors in logs) PASS.

**Tester name:** ____________________________________________

**Date:** ____________________________________________

**Build commit hash (run `git rev-parse --short HEAD` from repo root):** ____________________________________________

**SESSION_ID observed (from Phase 2 step 9):** ____________________________________________

**Result:** [  ] PASS    [  ] FAIL — see notes below

**Notes / observations / any color amendments applied:**

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________

When PASS, mark Phase 5 Success Criterion #6 as MET in `05-VERIFICATION.md` (created by `/gsd-verify-work 5`). Then advance the phase via `/gsd-secure-phase 5` → `/gsd-verify-work 5` → `phase.complete`.
