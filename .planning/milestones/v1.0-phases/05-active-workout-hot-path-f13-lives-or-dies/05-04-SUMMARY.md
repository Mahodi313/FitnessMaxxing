---
phase: 05-active-workout-hot-path-f13-lives-or-dies
plan: 04
subsystem: database
tags: [supabase, postgres, migrations, trigger, unique-constraint, rls, f13, fit-7]

requires:
  - phase: 02-schema-rls-type-generation
    provides: exercise_sets DDL + RLS "Users can manage own sets" policy
  - phase: 05-active-workout-hot-path-f13-lives-or-dies/01
    provides: setMutationDefaults[['set','add']] block — extended here
  - phase: 05-active-workout-hot-path-f13-lives-or-dies/02
    provides: useAddSet resource hook in lib/queries/sets.ts — extended here
  - phase: 05-active-workout-hot-path-f13-lives-or-dies/03
    provides: workout/[sessionId].tsx onKlart handler — modified here
provides:
  - Three numbered migrations on the deployed DB closing the D-16 race
  - Server-owned set_number (BEFORE INSERT trigger) + DB-enforced
    natural-key uniqueness (UNIQUE constraint)
  - Client payload contract: useAddSet omits set_number; optimistic UI
    keeps a provisional cache value
  - npm run test:f13-brutal programmatic gate wired into the manual-test
    recipe Phase 9 step 41
  - Cross-user natural-key uniqueness assertion in test-rls.ts (39 PASS)
affects: phase-05-05, phase-05-06, phase-06, future schema migrations

tech-stack:
  added: []
  patterns:
    - "Server-owned natural-key columns via BEFORE INSERT trigger
      (SECURITY INVOKER + search_path = '') paired with a UNIQUE
      constraint as the data-integrity gate — race-resistant by
      construction"
    - "Localized Database[\"public\"][\"Tables\"][...][\"Insert\"] cast
      at the upsert call site when a trigger DEFAULT isn't surfaced by
      gen:types — documented breadcrumb instead of editing the
      generated types"
    - "tsx --env-file-if-exists=.env.local in npm scripts: CI-safe
      (Actions injects env via env: blocks) and local-friendly
      (loads .env.local when present)"

key-files:
  created:
    - app/supabase/migrations/0002_dedupe_exercise_sets.sql
    - app/supabase/migrations/0003_exercise_sets_natural_key.sql
    - app/supabase/migrations/0004_exercise_sets_set_number_trigger.sql
    - .planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-04-SUMMARY.md
  tracked-from-untracked:
    - app/scripts/inspect-duplicate-sets.ts
    - app/scripts/inspect-recent-sessions.ts
    - app/scripts/verify-f13-brutal-test.ts
  modified:
    - app/lib/queries/sets.ts
    - app/lib/query/client.ts
    - app/app/(app)/workout/[sessionId].tsx
    - app/scripts/test-rls.ts
    - app/scripts/manual-test-phase-05-f13-brutal.md
    - app/package.json

key-decisions:
  - "D-16 SUPERSEDED: client-side count+1 with accepted race → server-
    side trigger + UNIQUE constraint. Authoritative record:
    05-04-PLAN.md `deviates_from` block."
  - "Trigger is SECURITY INVOKER (not DEFINER) so the MAX(set_number)
    SELECT respects 'Users can manage own sets' RLS — no cross-user
    leak via timing/value."
  - "`set search_path = ''` on INVOKER function for defense-in-depth
    (Pitfall 7 carries over even when DEFINER isn't used)."
  - "Concurrent INSERT race accepted: second concurrent INSERT hits
    23505 → PostgREST 409 → existing client retry path
    (retry:1 + onConflict:'id' + ignoreDuplicates:true) replays
    idempotently because id is client-generated."
  - "Generated types/database.ts not edited; gen:types produced no
    semantic diff (Supabase doesn't surface trigger DEFAULTs). Client
    SetInsertVars becomes the source of truth for `set_number?`;
    upsert call site holds a localized Insert-type cast with a
    breadcrumb to drop once gen:types learns trigger surfacing."

patterns-established:
  - "Pattern: BEFORE INSERT trigger + UNIQUE constraint as a paired
    data-integrity unit — schema gap closure when client-side race is
    detected post-launch."
  - "Pattern: --env-file-if-exists=.env.local in npm scripts that
    connect to the deployed DB (vs. the older --env-file form which
    errors in CI when the dotfile is absent)."
  - "Pattern: localized Insert-type cast with documented breadcrumb at
    the supabase upsert call site when gen:types lags behind a
    trigger DEFAULT."

requirements-completed: [F13]

duration: ~75 min
completed: 2026-05-14
---

# Phase 5 Plan 4: Dedupe + UNIQUE + set_number trigger Summary

**Closed the P0 schema gap that allowed 6 silent duplicate rows in session 379cfd29 during F13 UAT (2026-05-13). Server-side trigger + natural-key UNIQUE constraint now own correctness regardless of client UUID or cache-hydration race; D-16 SUPERSEDED. "Får aldrig förlora ett set" extends to "får aldrig duplicera ett set heller".**

## Performance

- **Duration:** ~75 min (Tasks 1-4 + verification + summary)
- **Started:** 2026-05-14T(session start)
- **Completed:** 2026-05-14T(session end)
- **Tasks:** 4 of 4
- **Files modified:** 7
- **Files created:** 4 (3 migrations + this SUMMARY)
- **Files tracked-from-untracked:** 3 diagnostic scripts

## Accomplishments

### Task 1 — Linear verification + diagnostic-script commit (commit `2dfc588`)

Verified `FIT-7` open under Urgent priority via `npm run linear:issues`. Committed three previously-untracked diagnostic scripts AS-IS (no content change) — they were authored during the 2026-05-13 UAT:

- `app/scripts/inspect-duplicate-sets.ts` — dumps duplicate-set_number rows + pg_constraint/pg_indexes for `exercise_sets`.
- `app/scripts/inspect-recent-sessions.ts` — dumps last 60 min of `workout_sessions` + per-exercise set_number sequences.
- `app/scripts/verify-f13-brutal-test.ts` — programmatic gate for the brutal-test recipe.

Wired three npm scripts: `test:f13-brutal`, `inspect:duplicate-sets`, `inspect:recent-sessions` — all use `--env-file=.env.local` because `postgres()` reads `SUPABASE_DB_PASSWORD` from `process.env` directly.

### Task 2 — Migrations 0002, 0003, 0004 (commit `04bfb0f`)

Authored and applied three numbered migrations:

| File | What it does |
|------|--------------|
| `0002_dedupe_exercise_sets.sql` | CTE `row_number()` partitioned by `(session_id, exercise_id, set_number)` ordered `completed_at asc nulls last, id asc` — DELETEs all rows where `rn > 1`. Keeps the OLDEST row per tuple. |
| `0003_exercise_sets_natural_key.sql` | `ALTER TABLE … ADD CONSTRAINT exercise_sets_session_exercise_setno_uq UNIQUE (session_id, exercise_id, set_number)`. |
| `0004_exercise_sets_set_number_trigger.sql` | `CREATE FUNCTION public.assign_exercise_set_number()` (plpgsql, SECURITY INVOKER, `search_path = ''`) + `CREATE TRIGGER assign_set_number_before_insert BEFORE INSERT ON public.exercise_sets`. Body fills `NEW.set_number := MAX(set_number)+1 per (session, exercise)` only when caller passes NULL. |

`npx supabase db push` succeeded (user-executed). `npm run gen:types` regenerated `types/database.ts` with **no semantic diff** — Supabase doesn't surface trigger DEFAULTs, so the Insert type still requires `set_number: number`. Handled in Task 3 via a localized cast.

Verified live against the deployed DB:

- `npm run inspect:duplicate-sets` → output for session 379cfd29 shows no `<-- DUPLICATE` markers; constraints section lists `exercise_sets_session_exercise_setno_uq type=u UNIQUE (session_id, exercise_id, set_number)`.
- `npx tsx --env-file=.env.local scripts/verify-deploy.ts` → "Functions in public" section lists `assign_exercise_set_number returns trigger`.

### Task 3 — Client cutover (commit `2ab3216`)

- `app/lib/queries/sets.ts` — `SetInsertVars.set_number?` made optional; doc comment cites Plan 05-04 and Migration 0004 (SUPERSEDES D-16).
- `app/lib/query/client.ts` — mirror `SetInsertVars` local type also made optional. `setMutationDefaults[['set','add']]` mutationFn casts the payload to `Database["public"]["Tables"]["exercise_sets"]["Insert"]` with a breadcrumb comment ("drop the cast once gen:types learns trigger-DEFAULT surfacing"). `onMutate` computes a **provisional** `set_number` from the cached `SetRow[]` for the optimistic row only — same `length + 1` algorithm as the former client-side D-16 code, scoped to the optimistic row and reconciled via the existing `onSettled` invalidate. `vars.set_number` is honored if provided (preserves test-rls.ts cross-user assertions + replays of pre-migration paused mutations).
- `app/app/(app)/workout/[sessionId].tsx` — `onKlart` drops the `queryClient.getQueryData` + filter + length+1 computation; `mutate` payload no longer includes `set_number`; the D-16 comment is replaced with `// D-16 SUPERSEDED by Plan 05-04: server-side trigger assigns set_number; client omits it on payload. Optimistic UI uses provisional value computed in setMutationDefaults onMutate.` Removed now-unused imports: `type Href` (the info-tier nit from `05-VERIFICATION.md`), `queryClient`, and `setsKeys`.

Gates after Task 3: `npx tsc --noEmit` exit 0; `npx expo lint` exit 0 (zero warnings); `npm run test:set-schemas` 10/10 PASS.

### Task 4 — test-rls extension + manual-test recipe Step 41 (commit `830106e`)

- `app/scripts/test-rls.ts` — appended a "Phase 5 gap-closure (FIT-7) — natural-key UNIQUE constraint on exercise_sets" block after the existing defense-in-depth section. One assertion: User B INSERTs a SECOND `exercise_set` with the same `(session_id=sessB.id, exercise_id=exB.id, set_number=1)` natural-key tuple already in fixture `setB`; expects Postgres error code `23505`. **Final PASS count: 39** (38 baseline per `05-VERIFICATION.md` line 105 + 1 new). The seed already proves the FIRST INSERT with that tuple succeeds (lines 267-278); no cleanup needed — `cleanupTestUsers()` cascades the row away via the workout_sessions FK.
- `app/scripts/manual-test-phase-05-f13-brutal.md` — Phase 9 gains a new programmatic-gate step (renumbered: new 41 = programmatic gate; old 41 = 42; old Phase 10 42/43 = 43/44). The new step calls `npm run test:f13-brutal` plus a `GROUP BY HAVING count(*) > 1` duplicate-detection SQL pattern. Pass-criteria checklist gains a new top-bullet wiring the gap-closure gate. Phase 10 step content unchanged per plan instruction.
- `app/package.json` drift fix: `test:rls` script now uses `--env-file-if-exists=.env.local` (test-rls.ts header comment line 17 already documented this expectation). CI-safe: Node's `-if-exists` variant warns + continues when the dotfile is absent in CI.

## Verification

End-to-end gate (from `app/` cwd), all GREEN ✓:

| # | Gate | Result |
|---|------|--------|
| 1 | `npx tsc --noEmit` | exit 0 |
| 2 | `npx expo lint` | exit 0 (zero warnings) |
| 3 | `npm run test:set-schemas` | 10/10 PASS |
| 4 | `npm run test:rls` | 39 PASS, ALL ASSERTIONS PASSED |
| 5 | `npm run test:f13-brutal` | exit 0 (no recent session — graceful no-op per script contract; user runs against a fresh brutal-test session for the full gate) |
| 6 | `npm run inspect:duplicate-sets` | session 379cfd29 has no `<-- DUPLICATE` markers; constraints section lists `exercise_sets_session_exercise_setno_uq type=u` |
| 7 | `npx tsx --env-file=.env.local scripts/verify-deploy.ts` | `assign_exercise_set_number returns trigger` present in Functions in public |
| 8 | Service-role audit: `git grep "service_role\|SERVICE_ROLE" -- "*.ts" "*.tsx" "*.js" "*.jsx" ":!.planning/" ":!app/scripts/" ":!app/.env.example" ":!CLAUDE.md"` | empty ✓ |

## must_haves cross-check

All 7 must_haves.truths from `05-04-PLAN.md` frontmatter are observably true:

1. ✓ Postgres rejects duplicate `(session_id, exercise_id, set_number)` INSERT with 23505 — verified by the new test-rls.ts assertion.
2. ✓ 6 duplicate rows in session 379cfd29 deleted; no other affected sessions retain duplicates — verified by `inspect:duplicate-sets`.
3. ✓ `useAddSet` payload no longer carries client-computed `set_number` — verified by Grep on `workout/[sessionId].tsx` (returns zero matches inside the `addSet.mutate` payload).
4. ✓ Optimistic onMutate cache row renders a provisional `set_number` from the local cache (`previous`); reconciled by onSettled invalidate.
5. ✓ `npm run test:rls` reports 39 PASS (38 baseline + 1 new natural-key uniqueness).
6. ✓ `verify-deploy.ts` confirms `assign_exercise_set_number` trigger function present; UNIQUE constraint confirmed via `inspect:duplicate-sets`.
7. ✓ `npx expo lint` reports zero warnings; the unused `Href` import at workout/[sessionId].tsx:62 is removed.

## Deviations from Plan

Three auto-fixed deviations (none required STOP):

- **[Rule 2 — Missing critical] SetInsertVars duplicated in lib/query/client.ts** — Found during: Task 3. The plan only called out `app/lib/queries/sets.ts` for the SetInsertVars edit, but client.ts has a parallel local type (line 147) consumed by `setMutationDefaults`. Fixed: made `set_number?` optional in both definitions. Verified via tsc. Commit: `2ab3216`.
- **[Rule 1 — Bug] Supabase Insert type still requires set_number** — Found during: Task 3 (first tsc run). Plan anticipated this in its acceptance criteria ("If gen:types does NOT detect the trigger and leaves `set_number: number` as required in the Insert type, that is acceptable for V1 because Plan Task 3 below makes the client type the source of truth"). Fixed: imported `type Database from "@/types/database"` and added a localized `as Database["public"]["Tables"]["exercise_sets"]["Insert"]` cast at the upsert call site with a breadcrumb comment to drop the cast once gen:types learns trigger-DEFAULT surfacing. Files modified: `app/lib/query/client.ts`. Commit: `2ab3216`.
- **[Rule 1 — Bug] Now-unused imports after client cutover** — Found during: Task 3. Removing the in-component `queryClient.getQueryData(setsKeys.list(...))` call orphaned the `queryClient` and `setsKeys` imports (they had only that one reference each). Plan called for removing the unused `Href` import only, but the same lint-warning class applies to the other two. Fixed: removed all three imports. Verified via `npx expo lint` (zero warnings). Commit: `2ab3216`.
- **[Rule 2 — Missing critical] test:rls npm script lacked --env-file** — Found during: Task 4 verification. `test-rls.ts` header line 17 documented the expected `tsx --env-file=.env.local` invocation, but `app/package.json` line 13 was `"test:rls": "tsx scripts/test-rls.ts"` — pre-existing docs/script drift since Phase 2. Fixed: switched to `--env-file-if-exists=.env.local` (CI-safe — GitHub Actions injects env via `env:` blocks; Node `-if-exists` warns + continues when the dotfile is absent in CI). Commit: `830106e`.

**Total deviations:** 4 auto-fixed (Rule 1 × 2 — bugs; Rule 2 × 2 — missing critical). **Impact:** Zero behavioral change vs. plan intent; all four are mechanical follow-ons whose absence would have left `tsc` / `lint` / `npm run test:rls` red.

## Second-order observations

- **gen:types diff:** none (semantic). Generated TS types do not surface Postgres trigger DEFAULTs or UNIQUE constraints, so `types/database.ts` is unchanged. The localized Insert-type cast at the upsert call site is the explicit recognition of this gap with a breadcrumb to drop once Supabase tooling catches up.
- **Other latent duplicates:** session 379cfd29 was the only session in the deployed DB with duplicate-set_number rows. Migration 0002's CTE pattern is generic and would have closed any other affected session — none were observed in `inspect:duplicate-sets` output post-migration.
- **CI consideration:** `test:rls` now works locally with `npm run test:rls` AND continues to work in CI where `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` are injected via the workflow's `env:` block (verified via `.github/workflows/{phase-branch,dev,main}.yml`).
- **Concurrent INSERT race:** the trigger does not advisory-lock or use `SELECT … FOR UPDATE`; the UNIQUE constraint is the sole correctness gate. The existing client retry path (`retry: 1` + `onConflict: 'id'` + `ignoreDuplicates: true`) handles 23505 idempotently because the row id is client-generated UUID and stable across retries. V1.1 may add an advisory-lock pattern if soak shows frequent surfaces.

## Linear

- **Issue:** [FIT-7 — [P0] exercise_sets missing UNIQUE constraint on (session_id, exercise_id, set_number) — duplicate sets land silently under slow cache-hydration race](https://linear.app/fitnessmaxxing/issue/FIT-7/p0-exercise-sets-missing-unique-constraint-on-session-id-exercise-id)
- **Status:** ready to close (PR pending merge to dev)
- **Branch:** `fix/FIT-7-exercise-sets-unique`

## Self-Check: PASSED

- ✓ All 4 tasks executed and committed atomically (commits `2dfc588`, `04bfb0f`, `2ab3216`, `830106e`)
- ✓ All 7 must_haves.truths observably true
- ✓ All 8 plan `<verification>` gates GREEN
- ✓ D-16 supersession documented in plan frontmatter `deviates_from`
- ✓ Linear issue FIT-7 traceable from commit messages + this summary

## Next

Ready for **Plan 05-05** (FIT-8) on `fix/FIT-8-slow-hydration` branch — workout-screen rehydration gate + "Återställer pass…" affordance. Plan 05-05 depends on this plan because both share `app/app/_layout.tsx` and the hydration-readiness contract.
