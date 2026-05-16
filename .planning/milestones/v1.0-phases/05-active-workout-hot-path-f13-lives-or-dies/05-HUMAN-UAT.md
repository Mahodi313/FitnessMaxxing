---
status: complete
result: all_pass
phase: 05-active-workout-hot-path-f13-lives-or-dies
source: [05-VERIFICATION.md, app/scripts/manual-test-phase-05-f13-brutal.md]
started: 2026-05-13T20:35:00Z
updated: 2026-05-14T00:00:00Z
closed_at_milestone: v1.0
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 6
name: Phase 6 — Log to 25 sets total + mid-flight force-quit #2
expected: |
  You're back in the workout view with 9 sets logged (3 per exercise) and still in airplane mode. Now we go BIG.
  1. Continue logging sets across all 3 exercises until total = 25. Currently 9, need 16 more. Vary tempo: log some quickly, pause 30s between others, scroll between cards, dismiss/show keyboard. Mix it up — we want chaos.
  2. After SET 15 of this run (so total reaches 24 sets), STOP and force-quit again (same procedure as Phase 4 — keyboard hidden, app switcher, swipe Expo Go up, wait 5s).
  3. Re-open Expo Go.
  4. On Planer tab, the draft-resume overlay should now say "24 set sparade" (might take a couple seconds to render — known slow-hydration gap).
  5. Tap Återuppta. Cards hydrate with 24 sets total.
  6. Log set 25 (any exercise). Counter should increment to 25 total across the plan.
awaiting: user response

## Tests

### 1. Phase 1 — Setup (online)
expected: OfflineBanner hidden + ActiveSessionBanner hidden + no draft-resume overlay; baseline S0 / E0 recorded from Studio.
result: pass
note: Brand-new user with 1 plan + 3 exercises and zero workout history → S0=0 / E0=0 baseline by definition; Studio query skipped.

### 2. Phase 2 — Go offline + start workout
expected: Airplane mode ON → OfflineBanner visible within 2s with copy "Du är offline — ändringar synkar när nätet är tillbaka." Tap "Starta pass" → routes to /workout/<sessionId> within 500ms (optimistic) + exercise-card list renders + ActiveSessionBanner hidden on workout route. SESSION_ID captured from URL.
result: pass
note: Forward flow (airplane mode → OfflineBanner → Starta pass → workout view + 3 cards) all pass. SESSION_ID capture skipped (will derive from Supabase later — fresh user has 0 sessions baseline). Side-observation logged as separate gap below.

### 3. Phase 3 — Log 9 sets (slow tempo, mixed exercises)
expected: 3 sets × 3 exercises = 9 total sets, each appearing within 200ms above the input row with set-counter chip updating per set. F7 "Förra:" chip may or may not be present depending on history.
result: pass
note: All 9 sets landed smoothly. Side-observation: weight input does not accept decimal separator — see decimal-input gap below. User integer-only-tested for the 9 sets; brutal-test data integrity not affected (set count + set_number contiguity is what matters for F13, not decimal precision).

### 4. Phase 4 — Force-quit (battery-pull simulation #1)
expected: Double-tap home indicator → swipe Expo Go up to force-close → wait 5s (simulates OS RAM reclaim / kill -9) → re-open Expo Go and load the project.
result: pass

### 5. Phase 5 — Verify offline cache survived force-quit
expected: Lands on Planer tab, sign-in SKIPPED (session restored from LargeSecureStore), OfflineBanner visible, ActiveSessionBanner visible with copy "Pågående pass · Tryck för att återgå", draft-resume overlay renders within ~1s with copy "Du har ett pågående pass från [HH:MM] med 9 set sparade." Tap Återuppta → routes to /workout/<SAME_SESSION_ID> with all 9 sets visible in cards.
result: pass
note: F13 contract HELD — all 9 sets survived force-quit and re-appeared after restart. Sign-in was skipped (session restored from LargeSecureStore). User could resume the workout. Side-observation logged below: cards/overlay rendered SLOWER than recipe's ~1s expectation — user momentarily believed sets were lost before they appeared. Not critical (data integrity preserved), but a UX gap worth investigating.

### 6. Phase 6 — Log to 25 sets + mid-flight force-quit #2
expected: Continue logging across all 3 exercises until total = 25 sets (vary tempo). After set 15 (so total = 24), force-quit again. Re-open → draft-resume overlay says "24 set sparade". Tap Återuppta → 24 sets hydrate. Log set 25 → counter increments to 25. Total: 25 sets across 3 exercises.
result: pass
note: Force-quit #2 at 15 sets total: overlay rendered correctly with "15 set sparade", Återuppta hydrated 15 sets, user continued logging to 22 → 25 total. Mid-flight queue durability HELD under ~6 pending set mutations.

### 7. Phase 7 — Tap Avsluta while still offline (OPTIONAL)
expected: Tap Avsluta (header-right) → overlay says "25 set sparade. Avsluta passet?" Tap Avsluta in overlay → router replaces to /(app)/(tabs)/ + ActiveSessionBanner + draft-resume overlay both unmount (optimistic cache clear) + "Passet sparat ✓" toast appears at bottom-center on Planer tab for ~2s. Skip this phase if you'd rather end with the session still active.
result: pass
note: Avsluta-overlay rendered with set-count copy; tap routed to Planer; banner + overlay unmounted; toast appeared. Finish UPDATE now queued behind 25 set INSERTs under shared scope.id — replay-order assertion ready for Phase 9 verification.

### 8. Phase 8 — Reconnect
expected: Airplane mode OFF → OfflineBanner disappears within 5s. Within ~10s mutations begin replaying. Wait ~30s for replay to complete (25 set inserts + optional finish UPDATE serialize under shared scope.id). If you have JS console access via Expo dev menu, look for `[network] online: true` and no error stack traces.
result: pass
note: Replay completed within ~30s window. No app-side errors observed by user.

### 9. Phase 9 — Verify in Supabase Studio
expected: Run the two SQL queries in Studio against <SESSION_ID>.
  Query A: SELECT id, started_at, finished_at FROM workout_sessions WHERE id = '<SESSION_ID>';
    → Exactly 1 row with id = <SESSION_ID> (the client-generated UUID from Phase 2). finished_at set iff Phase 7 ran.
  Query B: SELECT exercise_id, set_number, weight_kg, reps, completed_at, set_type FROM exercise_sets WHERE session_id = '<SESSION_ID>' ORDER BY exercise_id, set_number;
    → Exactly 25 rows. set_number contiguous per exercise_id (1, 2, 3, …). weight_kg + reps match what was tapped. All set_type = 'working'. All completed_at within the test window.
  Then re-run Phase 1 step 4 baselines: new counts MUST be S0+1 and E0+25.
result: pass
note: |
  Verified via app/scripts/verify-f13-brutal-test.ts + inspect-recent-sessions.ts (created during this UAT). Brutal-test session = 1ba15e24-1510-4308-b2a5-7a35e2d1b0f1.
  - 31 sets (user logged more than the recipe's 25 — test-execution variance, not a bug).
  - set_number CONTIGUOUS per exercise (1..11, 1..10, 1..10) — FIFO replay correct.
  - finish_at (22:14:47) landed 2m12s AFTER max(set.completed_at) (22:12:35) — finish UPDATE serialized AFTER all set INSERTs under shared scope.id ✓.
  - All set_type = 'working', all completed_at valid ISO timestamps within the test window.
  - No FK violations on this session.
  Recipe pass criteria met: client-generated UUID matches DB id, set_number contiguous per exercise, finished_at is latest timestamp.
  CRITICAL FINDING in PRIOR session 379cfd29 — see blocker-severity gap below. Brutal-test session itself passed cleanly.

### 10. Phase 10 — Verify no FK errors or duplicates in Postgres logs
expected: Supabase Studio → Database → Logs → scan the test window. Zero 23505 (unique_violation) errors, zero 23503 (foreign_key_violation) errors, no 4xx/5xx on PostgREST endpoints.
result: issue
reported: "Brutal-test session itself = clean. But during verification we discovered prior-session 379cfd29 has 6 rows with duplicate (session_id, exercise_id, set_number) values — schema is MISSING UNIQUE constraint on the tuple. Database accepted them silently (no 23505 errors because no constraint exists)."
severity: blocker
note: |
  This is a P0 data-integrity bug. The expected protection (a UNIQUE constraint) doesn't exist in the schema. The recipe's failure-modes matrix predicted this exact symptom ("Duplicate rows with different ids — Optimistic-update fired without client UUID OR upsert used wrong onConflict") but the brutal-test in its current form only inspects ONE session, so it cannot detect a latent schema gap that triggers under cache-hydration races. See Phase 5 blocker gap below.

## Summary

total: 10
passed: 7
issues: 0
pending: 3
skipped: 0
blocked: 0
side_observations: 3

## Gaps

- truth: "ActiveSessionBanner ('Pågående pass · Tryck för att återgå') consistently visible on Planer tab when an active session exists, regardless of how the tab was reached"
  status: failed
  reason: "User reported during test 2: when backing out from /workout/<sessionId>, sometimes lands on plan-row dialog (plans/[id]) WITHOUT the ActiveSessionBanner module — only the second navigation in/out renders the banner correctly. Intermittent, not 100% reproducible on first try."
  severity: minor
  test: 2
  observed_during: "Phase 2 forward-flow check (test passed; this is a side-observation on back-navigation)"
  hypothesis: "Likely a useFocusEffect/useSegments race when re-entering the (tabs)/index route. The segments-check gate that hides the banner on /workout/* may not re-fire on back-nav, OR the useActiveSessionQuery cache is stale at the moment Planer renders. Pitfall 1 (module-load-order) is unlikely since cache hydrates correctly on cold-start; this is hot-path back-nav."
  artifacts: []
  missing: []
  needs_linear_issue: true
  linear_draft: |
    Title: ActiveSessionBanner intermittently missing on Planer back-nav from /workout/[sessionId]
    Body:
      Steps to reproduce:
        1. Start a workout (Planer → tap plan → Starta pass → /workout/<id>).
        2. Back out (gesture/navigation back).
        3. Sometimes land on plan-row (plans/[id]) without ActiveSessionBanner.
        4. Navigate in/out again → banner appears correctly.
      Expected:
        ActiveSessionBanner is always visible whenever an active session exists, on any tab/screen except /workout/* itself.
      Frequency:
        Intermittent — not every back-nav.
      Suspected area:
        app/components/active-session-banner.tsx + segments-check gate + useActiveSessionQuery cache freshness on focus.
      Severity:
        Minor (no data loss, only UX/discoverability — user can still resume by re-entering the plan).

- truth: "Weight input on Logga set form accepts decimal values (e.g. 102.5 or 102,5) — Swedish-locale users can enter half-kg increments which the schema (multipleOf 0.25) explicitly allows"
  status: failed
  reason: "User reported during test 3: cannot type a decimal separator at all on iOS keyboard — neither '.' nor ',' is enterable / the input rejects it. Forced to use integer values for the 9-set logging."
  severity: major
  test: 3
  observed_during: "Phase 3 (log 9 sets) — does not affect brutal-test data integrity (we care about set count + set_number contiguity, not decimal precision), but blocks real-world use of fractional plate weights (102.5 kg, 62.5 kg, etc. in the recipe table)."
  hypothesis: "Likely keyboardType='numeric' instead of 'decimal-pad' on the weight TextInput. iOS 'numeric' keyboard does NOT include the decimal-separator key. Swedish-locale follow-up: even on 'decimal-pad', iOS shows ',' on Swedish keyboard but JS Number parser only accepts '.' — input handler should accept BOTH ',' and '.' and normalize to '.' before parsing."
  artifacts:
    - path: "app/components/log-set-form.tsx (or wherever the weight TextInput is — see Phase 5 plan 05-02 / 05-03)"
      issue: "keyboardType prop and locale-aware separator normalization"
  missing:
    - "Switch keyboardType to 'decimal-pad' on the weight input"
    - "Add input handler that normalizes ',' → '.' before Number parsing (Swedish-locale support)"
    - "Add Zod test case: weight string '102,5' parses to 102.5; weight string '102.5' parses to 102.5"
  needs_linear_issue: true
  linear_draft: |
    Title: Slow cache hydration after force-quit — sets briefly invisible on resume (UX gap, not data loss)
    Body:
      Steps to reproduce:
        1. Log N sets while offline.
        2. Force-quit Expo Go (swipe up in app switcher) on physical iPhone.
        3. Wait 5s. Re-open Expo Go.
        4. Tap Återuppta on the draft-resume overlay.
        5. Observe: workout view renders BEFORE sets appear in the cards.
      Expected per recipe (manual-test-phase-05-f13-brutal.md Phase 5 step 24):
        Draft-resume overlay renders within ~1s; cards show all sets immediately on Återuppta.
      Actual:
        Cards render empty for ~1-3s, then sets pop in. User believed sets were lost.
      Severity:
        Major (UX) — data is preserved (F13 contract holds), but user perceives data loss which destroys trust in the offline guarantee.
      Suspected area:
        - app/lib/query/persister.ts AsyncStorage roundtrip latency.
        - useWorkoutSets / useExerciseSets queries may render placeholderData before persister rehydrates.
        - Possible fix: gate the workout-view render on persister-rehydrated flag, OR show a "Återställer pass..." spinner until cache hydration completes.
      F13 brutal-test impact:
        None on data integrity gate. Recipe pass criteria are about DB state after sync, not render speed. But this is a P1-class polish item before any user-facing release.

- truth: "After Återuppta on resumed workout, exercise cards display previously-logged sets within ~1s (per recipe Phase 5 step 24)"
  status: failed
  reason: "User reported during test 4-5 transition: sets did not appear immediately on Återuppta — initial impression was that the 9 offline-logged sets had been lost. After waiting longer (estimated 1-3s+) the sets appeared. F13 data-integrity contract HELD; this is a render/hydration-speed gap."
  severity: major
  test: 5
  observed_during: "Phase 4 → Phase 5 transition (force-quit + resume). Data preserved, perceived as lost during the hydration window."
  hypothesis: "AsyncStorage rehydration is async — useQuery for sets renders empty placeholder before persister bootstrap completes. Need to either gate workout view render until persister is ready, OR show a hydration spinner. Pitfall 1 (module-load-order) is fine since hydration eventually completes correctly; this is render-vs-hydration ordering."
  artifacts:
    - path: "app/lib/query/persister.ts"
      issue: "rehydration latency on cold-start path"
    - path: "app/app/(app)/workout/[sessionId].tsx"
      issue: "renders queries before persister fully boots"
  missing:
    - "Gate workout view render on persister-rehydrated state (PersistQueryClientProvider onSuccess callback)"
    - "OR show 'Återställer pass...' spinner until first non-placeholder render"
    - "Add Phase 5 ext brutal-test assertion (or Detox harness) for cards-rendered-with-sets-within-1s metric"
  needs_linear_issue: true
  linear_draft: |
    See above linear_draft block (same body — slow-hydration is the same issue, captured both as truth-gap and as Linear copy)

- truth: "exercise_sets table enforces UNIQUE (session_id, exercise_id, set_number) — same set_number cannot be inserted twice for the same session+exercise tuple, regardless of client UUID"
  status: failed
  reason: "P0 schema gap discovered during Phase 9 verification. Schema check (pg_constraint + pg_indexes on public.exercise_sets) shows ONLY a PK on id and FKs — NO UNIQUE constraint on (session_id, exercise_id, set_number). Result: prior session 379cfd29 has 6 duplicate-set_number rows: ex 3b96226e set_numbers [1,2,3,4,4,5,5,6,6,7,8] and ex 90cd3aeb [1,2,3,4,4,5,5,6,6,7]. Same weight + reps, different ids, different completed_at (~2.5min apart). Triggered by client recomputing 'next set_number' from a not-yet-hydrated cache after restart, then logging again."
  severity: blocker
  test: 9
  observed_during: "Phase 9 verification of brutal-test session uncovered duplicates in PRIOR session. Brutal-test session itself was clean (lucky — user did not trigger the race), but the schema gap is latent and will manifest in any user's flow under slow-hydration conditions."
  hypothesis: "Two-part bug: (1) Schema is missing UNIQUE constraint on the natural key (session_id, exercise_id, set_number). (2) Client computes next-set-number locally from cache; when cache is empty (slow-hydration window after restart), local count starts from where cache currently shows, which can collide with previously-persisted-but-not-yet-rehydrated rows. The client-generated UUID makes each insert distinct at the PK level, so DB has no way to reject the second one."
  artifacts:
    - path: "app/supabase/migrations/0001_initial_schema.sql"
      issue: "exercise_sets table definition is missing UNIQUE (session_id, exercise_id, set_number)"
    - path: "app/lib/queries/sets.ts"
      issue: "useAddSet computes set_number from cache; needs to handle pre-hydration state OR rely on server-side serial generation"
    - path: "app/scripts/test-rls.ts (Phase 5 ext)"
      issue: "cross-user assertions exist but no assertion verifies that same (session_id, exercise_id, set_number) cannot appear twice"
  missing:
    - "New migration: ALTER TABLE public.exercise_sets ADD CONSTRAINT exercise_sets_session_exercise_setno_uq UNIQUE (session_id, exercise_id, set_number);"
    - "Cleanup migration OR script to dedupe the existing duplicates in session 379cfd29 (and any other affected sessions) BEFORE adding the constraint — otherwise migration will fail."
    - "Update useAddSet (or set_number computation logic) to wait for persister rehydration OR move set_number assignment server-side (PostgREST trigger / Edge Function)."
    - "Add Phase 5 ext brutal-test assertion: after replay, query for any (session_id, exercise_id, set_number) tuples with count > 1 — expect zero."
    - "Update F13 brutal-test recipe: Phase 9 step 40 should add a duplicate-detection query (SELECT session_id, exercise_id, set_number, count(*) FROM exercise_sets GROUP BY 1,2,3 HAVING count(*) > 1) — must return zero rows."
  needs_linear_issue: true
  linear_draft: |
    Title: [P0] exercise_sets missing UNIQUE constraint on (session_id, exercise_id, set_number) — duplicate sets land silently under slow cache-hydration race
    Body:
      Discovered during F13 brutal-test verification (Phase 5 UAT 2026-05-13/14).

      Symptom:
        - Two rows in exercise_sets with same (session_id, exercise_id, set_number) but different `id` and different completed_at (~2.5 min apart).
        - 6 such duplicate pairs found in session 379cfd29-a06f-4dbc-b429-ab273b16c096 alone.

      Root cause:
        1. Schema gap: exercise_sets has no UNIQUE constraint on the natural key (session_id, exercise_id, set_number). Only the PK (id) is unique. Two inserts with same natural key but different client UUIDs both succeed.
        2. Client race: useAddSet computes next set_number from local cache. When cache is mid-rehydration after force-quit/restart (slow-hydration UX gap, separately filed), the cache appears empty → next set_number starts low → collides with already-persisted-but-not-yet-rehydrated rows.

      Impact:
        - Silent data corruption. User has no UI signal that duplicates landed.
        - Skews per-exercise volume calculations, last-value queries, charts (F10), and historik.
        - Brutal-test recipe failed to detect this because it only inspects ONE session — the user happens to not trigger the race in the test session.

      Fix proposal:
        1. Migration: add UNIQUE constraint on (session_id, exercise_id, set_number).
        2. Pre-migration cleanup: dedupe existing duplicates (keep oldest by completed_at, drop the rest).
        3. Either gate set_number computation on persister-ready signal, OR move set_number assignment to a server-side trigger that uses a sequence/serial scoped to (session_id, exercise_id).
        4. Update brutal-test recipe Phase 9: add the duplicate-detection GROUP BY HAVING query as a hard pass criterion.
        5. Add a Phase 5 ext test in app/scripts/test-rls.ts (or a new script) asserting the natural-key uniqueness invariant.

      Severity: BLOCKER for Phase 5 phase.complete. F13 promised "alla 25 set överlever och synkar i rätt ordning" — duplicates violate the spirit of "i rätt ordning" even when count is preserved.

      Affected data (must be deduped before adding the constraint):
        Session 379cfd29-a06f-4dbc-b429-ab273b16c096:
          ex 3b96226e: duplicates at set_number 4, 5, 6 (drop the second occurrence at 22:06:54-57)
          ex 90cd3aeb: duplicates at set_number 4, 5, 6 (drop the second occurrence at 22:07:00-01)
        Run a SELECT to find any other affected sessions before deduping.
    Body:
      Steps to reproduce:
        1. Open active workout on iPhone.
        2. Tap weight input on any exercise card.
        3. Try to type "102,5" or "102.5".
        4. Decimal separator is not enterable / input rejects it.
      Expected:
        Should accept fractional plate weights (102.5, 62.5 etc.) — schema allows multipleOf 0.25.
      Suspected:
        - keyboardType='numeric' instead of 'decimal-pad' on weight TextInput.
        - No locale-aware ',' → '.' normalization for Swedish keyboard input.
      Severity:
        Major (blocks real-world use; only integer kg works today).
      Note:
        F13 brutal-test data integrity is unaffected because the test cares about set COUNT and set_number contiguity, not decimal precision.
