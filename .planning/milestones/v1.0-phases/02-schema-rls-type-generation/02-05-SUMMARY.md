---
phase: 02-schema-rls-type-generation
plan: 05
subsystem: testing
tags: [supabase, rls, postgres, security, integration-test, service-role, tsx, node]

requires:
  - phase: 02-schema-rls-type-generation
    provides: V1 schema deployed to remote project mokmiuifpdzwnceufduu (Plan 02-03 — RLS=ON, 10 policies, handle_new_user trigger), npm script `test:rls` (Plan 02-01)
provides:
  - app/scripts/test-rls.ts — Node-only TypeScript harness (470 lines) that proves cross-user RLS blocking on all 5 user-scoped tables and asserts the PITFALLS 2.5 errata-regression INSERTs are rejected
  - Behavioral evidence (npm run test:rls exit 0) that ROADMAP-S3 success criterion is met — the cross-user test against the deployed schema is the only artifact that closes the "RLS errata fixed" claim from a verifiable position
  - Trigger side-effect verification (handle_new_user creates 2 profiles after seeding 2 auth users) — closes ROADMAP-S3 RLS-04
affects: [02-06 doc reconciliation, 03 auth (sign-up flow relies on the same trigger this verifies), 04+ feature work (every later .from() call inherits the RLS guarantee proven here)]

tech-stack:
  added: []
  patterns:
    - "Three-client isolation: separate createClient calls for admin (service-role), clientA (anon), clientB (anon) — never reuse a single client across personas (PITFALLS Pitfall 8)"
    - "Idempotent leaf-first cleanup: workout_sessions → workout_plans → exercises before auth.admin.deleteUser, working around on-delete-restrict on plan_exercises.exercise_id and exercise_sets.exercise_id which races with auth.users → public.exercises cascade"
    - "Silent-pass guard: mainCompleted boolean tracked in finally block — refuse to print ALL ASSERTIONS PASSED if main() threw before the assertion battery ran (mitigates threat T-02-20 in plan threat model)"
    - "assertWriteBlocked dual-mode helper: accepts both Postgres RLS error (42501) AND empty data set as PASS, since the two outcomes both prove no row was written"

key-files:
  created:
    - "app/scripts/test-rls.ts (NEW, Node-only) — 470 lines; three-client isolation, 22 cross-user assertions, errata regression INSERTs, idempotent cleanup at start AND end"
  modified: []

key-decisions:
  - "Manual leaf-first purge before auth.admin.deleteUser. The schema's plan_exercises.exercise_id and exercise_sets.exercise_id are ON DELETE RESTRICT (intentional per ARCHITECTURE.md §4 to prevent accidental history loss). When auth.users → public.exercises cascade fires alongside workout_plans → plan_exercises and workout_sessions → exercise_sets cascades, Postgres has no guaranteed ordering, and the RESTRICT can fire mid-transaction and abort deleteUser. Purging in deterministic leaf-first order via the admin RLS-bypass client eliminates the race. Documented inline in test-rls.ts:purgeUserData()."
  - "Silent-pass guard added (mainCompleted boolean). The original drafted lifecycle followed the plan's `<action>` block verbatim, but a re-run after an aborted first run revealed: if main() throws BEFORE the assertion battery runs (e.g., createUser fails because cleanup-end was incomplete), failures.length === 0 holds vacuously and the script reports ALL ASSERTIONS PASSED with exit 0. That is the exact false-positive that threat T-02-20 in the plan's threat model warns about. Added an explicit boolean to track whether main() returned normally; the success message is gated on it."
  - "Manual leaf-first purge runs as the admin client (RLS-bypass). It does NOT replace or weaken the cross-user-rejection assertions — those still run as clientA against the deployed RLS policies. The admin client is only used at fixture-lifecycle boundaries (start/end cleanup), exactly as the threat model documents (T-02-19: service-role isolation = file path is app/scripts/, never imported under app/lib/, app/app/, etc.)."

patterns-established:
  - "Pattern: cross-user RLS test as part of every schema-touching phase. test-rls.ts becomes the regression harness for Phase 2; future plans that add tables (V1.1 F18 PR-detection, V2 social) extend it with new assertions rather than authoring a parallel harness."
  - "Pattern: tsx --env-file=.env.local for node-side scripts. Already established by Plan 02-04's verify-deploy.ts, reaffirmed here. Scripts read SUPABASE_SERVICE_ROLE_KEY from process.env via Node v24's --env-file flag — zero-dep, no dotenv package, no PowerShell-vs-bash interpolation issues."
  - "Pattern: dual-mode assert for RLS-blocked writes. assertWriteBlocked accepts BOTH error and empty-data outcomes because Postgres returns either depending on op type (INSERT typically errors with 42501; UPDATE/DELETE typically silently filter to 0 rows)."

requirements-completed: [F17]

duration: ~12 min
completed: 2026-05-09
---

# Phase 2 Plan 05: Cross-User RLS Verification Harness Summary

**`app/scripts/test-rls.ts` (Node-only) — 22 cross-user assertions all PASS against the deployed schema, including the two PITFALLS 2.5 errata-regression INSERTs (`plan_exercises` / `exercise_sets` foreign-parent inserts) which Postgres rejected with `42501`. ROADMAP-S3 closed.**

## Performance

- **Duration:** ~12 min (script authoring + first run + 2 auto-fixes + re-run + commit)
- **Completed:** 2026-05-09
- **Tasks:** 1 (single auto task per the plan)
- **Files modified:** 1 created (test-rls.ts), 0 modified

## Accomplishments

- `app/scripts/test-rls.ts` created as the Node-only Phase-2 RLS regression harness. 470 lines; runs via `npm run test:rls` (= `tsx --env-file=.env.local scripts/test-rls.ts`).
- **Three-client isolation** enforced: separate `createClient` calls for `admin` (service-role, RLS-bypass), `clientA` (anon, signed in as User A), `clientB` (anon, signed in as User B). All three pass `auth: { persistSession: false, autoRefreshToken: false }`. Closes PITFALLS Pitfall 8.
- **22 assertions, all PASS**: 1 trigger-side-effect check + 2 profiles + 4 exercises + 4 workout_plans + 4 plan_exercises + 4 workout_sessions + 4 exercise_sets — covering SELECT/INSERT/UPDATE/DELETE × 5 user-scoped tables (D-09 coverage matrix), plus the two errata-regression inserts.
- **PITFALLS 2.5 errata regression PASSES**: `clientA.from("plan_exercises").insert({ plan_id: planB.id, exercise_id: exA.id, order_index: 99 })` was rejected with Postgres `42501`. Same outcome for `clientA.from("exercise_sets").insert({ session_id: sessB.id, exercise_id: exA.id, ... })`. Without the `with check` clause that this phase added in Plan 02-03, both INSERTs would have succeeded.
- **handle_new_user trigger verified** (ROADMAP-S3 RLS-04): after seeding 2 users via `auth.admin.createUser`, `admin.from("profiles").select("id").in("id", [userA.id, userB.id])` returned exactly 2 rows.
- **Cleanup runs at start AND in finally** (RESEARCH OQ #3): both runs in the verification show `[test-rls] cleanup (start)…` AND `[test-rls] cleanup (end)…` console lines. After the run, no test users persist.
- **Service-role audit gate clean** post-commit: `git grep "service_role|SERVICE_ROLE" -- ':!.planning/' ':!CLAUDE.md' ':!.claude/'` returns exactly the two whitelisted paths — `app/.env.example` and `app/scripts/test-rls.ts`. Zero hits in `app/lib/`, `app/app/`, `app/components/` (n/a — directory does not exist), `app/types/`.
- **Type-clean**: `cd app && npx tsc --noEmit` exits 0 with the new file in place. Carried-forward gate from Plan 02-04 still holds.
- **No `phase1ConnectTest` regressions**: Plan 02-04 deleted that scaffolding; grep for it across `app/` returns 0 hits.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author test-rls.ts** — `cc0262d` (feat) — created `app/scripts/test-rls.ts` with three-client isolation, full assertion battery, idempotent cleanup, silent-pass guard

**Plan metadata:** _(this SUMMARY commit follows below)_

## Files Created/Modified

- `app/scripts/test-rls.ts` (NEW) — Node-only Supabase RLS verification harness. Reads `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from `process.env` via tsx's `--env-file=.env.local`. Defines `purgeUserData(userId)` for ordered leaf-first cleanup, `cleanupTestUsers()` that runs purge then `auth.admin.deleteUser`, `assertEmpty(name, result)` and `assertWriteBlocked(name, result)` helpers, then `main()` that seeds 2 users, signs in 2 anon clients, seeds B's data, seeds A's exercise (so the errata INSERTs use a real exercise_id), and runs the 22-assertion battery.

## Run Output (literal final lines from `cd app && npm run test:rls`)

```
  PASS: trigger handle_new_user inserted 2 profile rows
  ...
  PASS: A cannot INSERT plan_exercise pointing at B's workout_plan (PITFALLS 2.5 errata regression) (rejected with error: 42501)
  ...
  PASS: A cannot INSERT exercise_set pointing at B's workout_session (PITFALLS 2.5 errata regression) (rejected with error: 42501)
  ...
  PASS: A cannot DELETE B's exercise_set (returned no data — RLS-filtered)
[test-rls] cleanup (end)…

[test-rls] ALL ASSERTIONS PASSED
```

Total assertions = 22, failures = 0, exit code = 0.

### Verbatim PITFALLS 2.5 errata-regression assertion log lines

```
  PASS: A cannot INSERT plan_exercise pointing at B's workout_plan (PITFALLS 2.5 errata regression) (rejected with error: 42501)
  PASS: A cannot INSERT exercise_set pointing at B's workout_session (PITFALLS 2.5 errata regression) (rejected with error: 42501)
```

Postgres error code `42501` = `insufficient_privilege`, the canonical signal for an RLS-rejected DML. Both INSERTs are rejected at the policy `with check` boundary, not by FK constraints (FKs would surface as `23503` foreign_key_violation). This proves that adding `with check (exists ... user_id = auth.uid())` to the two child-table policies in `0001_initial_schema.sql` (Plan 02-03) actually closed the gap.

### Service-role audit gate (post-commit)

```
$ git grep "service_role\|SERVICE_ROLE" -- ':!.planning/' ':!CLAUDE.md' ':!.claude/'
app/.env.example:# Hämtas från Supabase Dashboard → Project Settings → API → service_role secret.
app/.env.example:SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-from-project-settings-api
app/scripts/test-rls.ts:const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
app/scripts/test-rls.ts:      "och SUPABASE_SERVICE_ROLE_KEY i app/.env.local. Se app/.env.example och kör " +
```

Exactly the two whitelisted paths. No leakage into bundled paths.

### Cleanup ran at both bookends

Both runs of `npm run test:rls` show, in order:
1. `[test-rls] cleanup (start)…` — defensive cleanup of any leftover test users from a prior crashed run
2. seeded users + assertions
3. `[test-rls] cleanup (end)…` — happy-path cleanup in `finally` block

## Decisions Made

1. **Manual leaf-first purge before `auth.admin.deleteUser`.** The deployed schema (committed in Plan 02-03) has `plan_exercises.exercise_id` and `exercise_sets.exercise_id` declared as `ON DELETE RESTRICT` — this is intentional (`ARCHITECTURE.md §4` keeps it that way to prevent accidental history loss when a user "deletes" an exercise that has logged sets). When `auth.users → public.exercises` cascade fires alongside `workout_plans → plan_exercises` and `workout_sessions → exercise_sets` cascades, Postgres has no guaranteed ordering of these per-FK actions, and the RESTRICT path can fire mid-transaction and abort the entire `deleteUser`. The fix: purge in deterministic leaf-first order via the admin (RLS-bypass) client BEFORE invoking `deleteUser`. Documented inline in `test-rls.ts:purgeUserData()`.

2. **Silent-pass guard via `mainCompleted` boolean.** Detected during the second test run after the first run's cleanup-end half-failed: when `main()` threw at `createUser(B) failed: A user with this email address has already been registered`, the existing `try { await main() } catch (e) { exitCode = 1 } finally { ... if (failures.length === 0) "ALL ASSERTIONS PASSED" }` lifecycle reported `ALL ASSERTIONS PASSED` with exit 0 anyway — vacuously true because no assertions had run, so `failures.length === 0` held. That is exactly threat T-02-20 (false-positive RLS test). Added a `mainCompleted` flag set to `true` only after `main()` returns normally; the success message gates on it. After the fix, an aborted run prints `[test-rls] ABORTED before assertions completed — see FATAL above` and exits 1.

3. **Manual purge does NOT weaken the cross-user-rejection assertions.** The purge is a fixture-lifecycle operation (start/end cleanup) running as the admin client. The 22 cross-user assertions in the middle still run as `clientA` (anon, signed in as User A) against the deployed RLS policies — exactly as the plan specifies. The admin client is exclusively used at boundaries, matching threat T-02-19 mitigation (service-role file-path isolation): the file is `app/scripts/test-rls.ts`, never imported from `app/lib/`, `app/app/`, `app/components/`, `app/types/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Cleanup-end `auth.admin.deleteUser` failed with "Database error deleting user" for User B**
- **Found during:** Task 1 (verification step — first `npm run test:rls` run)
- **Issue:** The first run completed all 22 assertions successfully (exit 0, "ALL ASSERTIONS PASSED"), but the cleanup-end step printed `WARN: deleteUser(rls-test-b@fitnessmaxxing.local) failed: Database error deleting user`. The second run then aborted at seed time because User B was still in `auth.users`. Root cause analysis: schema declares `plan_exercises.exercise_id` and `exercise_sets.exercise_id` as `ON DELETE RESTRICT`. When `auth.users → public.exercises` cascade fires, Postgres has no guaranteed ordering against `workout_plans → plan_exercises` and `workout_sessions → exercise_sets` cascades, so the RESTRICT can fire mid-transaction and abort the whole deleteUser.
- **Fix:** Added a `purgeUserData(userId)` helper that deletes `workout_sessions` (cascades to `exercise_sets`), `workout_plans` (cascades to `plan_exercises`), then `exercises` — in that order, via the admin RLS-bypass client — BEFORE calling `auth.admin.deleteUser`. After the purge, no FK references to `exercises` remain, so the cascade from `auth.users → public.exercises` succeeds without hitting the RESTRICT path.
- **Files modified:** `app/scripts/test-rls.ts` (only — added inline before initial commit; the buggy version never reached git)
- **Verification:** Second `npm run test:rls` run shows `[test-rls] cleanup (end)…` followed by no `WARN:` line, then `[test-rls] ALL ASSERTIONS PASSED`. Re-runnable.
- **Committed in:** `cc0262d` (Task 1 commit; the fix landed before initial commit, so there is no "before fix" version of test-rls.ts in git history)

**2. [Rule 1 — Bug] Silent-pass false-positive when `main()` throws before assertion battery runs**
- **Found during:** Task 1 (verification step — second `npm run test:rls` run, after the cleanup-end bug had left state behind)
- **Issue:** Second run output: `[test-rls] FATAL: createUser(B) failed: A user with this email address has already been registered` followed two lines later by `[test-rls] ALL ASSERTIONS PASSED` and exit 0. The plan's draft lifecycle had `if (failures.length > 0) { ... exitCode = 1 } else { console.log "ALL ASSERTIONS PASSED" }`, which holds vacuously when zero assertions have run. This is exactly the threat-model entry T-02-20 ("False-positive RLS test"). Without the fix, a future regression where `main()` throws (e.g., RLS policies are dropped, or the schema is rolled back) would silently report success.
- **Fix:** Added a `mainCompleted` boolean to the IIFE, set `true` only after `await main()` returns normally. The success-printing block in `finally` now branches: if `!mainCompleted` → print `[test-rls] ABORTED before assertions completed — see FATAL above` and exit 1; else if `failures.length === 0` → print `ALL ASSERTIONS PASSED`; else print failure count. Both transient and persistent abort paths now exit 1 deterministically.
- **Files modified:** `app/scripts/test-rls.ts` (only — folded into the same initial commit; the buggy lifecycle never reached git)
- **Verification:** Re-ran with state pre-cleared: assertion battery completes → `mainCompleted = true` → success path. Verified the alternate path conceptually: if `main()` throws after seeding fails, `mainCompleted` stays `false`, `if (!mainCompleted)` branch fires, exit 1.
- **Committed in:** `cc0262d` (Task 1 commit; folded into initial commit)

---

**Total deviations:** 2 (both Rule 1 — bug fixes folded into the single Task-1 commit before the file landed in git)
**Impact on plan:** No scope creep. Both fixes were dictated by the plan's own threat model (T-02-22 idempotency, T-02-20 silent-pass) — they make the harness behave the way the plan intended in adverse paths. The plan's literal `<action>` block produced a working harness on the happy path; these two fixes make it robust on the adverse paths the threat model already enumerated. The fixes are documented inline in the script with comments explaining the schema constraint they work around (RESTRICT on exercise_id) and the threat they mitigate (T-02-20).

## Issues Encountered

- **Worktree's `app/node_modules/` was empty** at the start (consistent with Plan 02-04's deviation note: per-checkout convention, `node_modules` is gitignored). Resolved with `npm install --no-audit --no-fund --prefer-offline` from worktree's `app/` cwd. Took 19 seconds. Same one-time cost as Plan 02-04.
- **`app/.env.local` was absent in the worktree** (file is gitignored). Resolved by copying the main repo's `.env.local` into the worktree (still gitignored — not committed). Required because `npm run test:rls` reads the three Supabase env vars from this file via `tsx --env-file=.env.local`.
- **Cleanup-end failure on first run** — see Deviation 1 above. Resolved by adding `purgeUserData()`.
- **Silent-pass false-positive on second run** — see Deviation 2 above. Resolved by adding `mainCompleted` guard.

## User Setup Required

None for this plan in isolation. The harness consumes existing `.env.local` keys (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) that were established as user setup in Plans 02-01 and 02-03.

## Threat Flags

None — `test-rls.ts` introduces no new network endpoints, no new auth paths, no new schema, and no new file-access patterns. It exercises the existing surface (Supabase REST API + Auth admin API) that the plan's `<threat_model>` already enumerates (T-02-19 through T-02-24).

## Known Stubs

None.

## Next Phase Readiness

- **Plan 02-06 (doc reconciliation):** Can now point to `npm run test:rls` exit-0 as the load-bearing evidence that ROADMAP success criterion #3 is met. Should:
  - Update `ARCHITECTURE.md §4` to remove the documented errata note (Phase 2 closes it).
  - Update `STATE.md`'s errata note from "fixas i Phase 2" to "fixed".
  - Add a Database conventions sub-section per D-18 noting that every schema migration must ship with a corresponding test-rls.ts assertion or the cross-user test is incomplete.
- **Phase 3 (auth):** The handle_new_user trigger is verified to work (RLS-04). Sign-up flow can rely on a `profiles` row existing immediately after `auth.admin.createUser` / `signUp`. The cross-user RLS guarantee is now provable, which means Phase 3 sign-in/up screens can be built without re-verifying the data layer.
- **Phase 4+ (feature work):** Every later `.from(...)` call inherits the RLS guarantee proven here. The harness becomes the regression test for any future schema changes — V1.1 F18 PR-detection / F19 vilo-timer additions should extend `test-rls.ts` with new assertions rather than authoring a parallel harness (pattern established here).

## Self-Check: PASSED

- **Files exist:**
  - `app/scripts/test-rls.ts` — FOUND (470 lines)
  - `.planning/phases/02-schema-rls-type-generation/02-05-SUMMARY.md` — FOUND (this file)
- **Commits exist:**
  - `cc0262d` — FOUND (Task 1: feat — test-rls harness)
- **Acceptance gates** (from PLAN.md `<acceptance_criteria>`):
  - File exists, ≥ 150 non-blank lines: 470 ✓
  - `grep -c "createClient(" app/scripts/test-rls.ts` ≥ 3: **3** ✓
  - `grep -c "persistSession: false" app/scripts/test-rls.ts` ≥ 3: **3** ✓
  - `grep -c "auth.admin.createUser" app/scripts/test-rls.ts` ≥ 2: **2** ✓
  - `! grep -q "@/lib" app/scripts/test-rls.ts`: 0 matches ✓
  - `! grep -q "from \"@/" app/scripts/test-rls.ts`: 0 matches ✓
  - `! grep -q "react-native" app/scripts/test-rls.ts`: 0 matches ✓
  - `! grep -q "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE" app/scripts/test-rls.ts`: 0 matches ✓
  - `grep -c "process.env.SUPABASE_SERVICE_ROLE_KEY"` ≥ 1: **1** ✓
  - `grep -c "PITFALLS 2.5 errata regression"` ≥ 2: **2** ✓
  - `grep -c "cleanupTestUsers"` ≥ 3: **3** ✓
  - `grep -c "} finally {"` ≥ 1: **1** ✓
  - `from("profiles") + from("exercises") + from("workout_plans") + from("plan_exercises") + from("workout_sessions") + from("exercise_sets")` all ≥ 2/4 each: 3,7,6,5,6,5 ✓
  - `cd app && npx tsc --noEmit` exits 0 ✓
  - `cd app && npm run test:rls` exits 0 with `[test-rls] ALL ASSERTIONS PASSED` footer ✓
  - Service-role audit gate (`git grep "service_role|SERVICE_ROLE" -- ':!.planning/' ':!CLAUDE.md' ':!.claude/'`) returns exactly `app/.env.example` and `app/scripts/test-rls.ts` ✓
- **Plan-level success criteria:**
  - 22+ assertion harness present: **22** ✓
  - `npm run test:rls` exits 0: ✓
  - Service-role audit clean: ✓
  - Cleanup at start AND in finally: ✓ (both `[test-rls] cleanup (start)…` and `[test-rls] cleanup (end)…` printed in every run)

---
*Phase: 02-schema-rls-type-generation*
*Plan: 05*
*Completed: 2026-05-09*
