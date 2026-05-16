---
phase: 02-schema-rls-type-generation
plan: 03
subsystem: database
tags: [supabase, postgres, rls, migration, deploy, windows]

requires:
  - phase: 02-schema-rls-type-generation
    provides: 0001_initial_schema.sql migration file (Plan 02-02), Supabase CLI link to remote project (Plan 02-01)
provides:
  - Remote Supabase project mokmiuifpdzwnceufduu has the V1 schema deployed (6 tables, RLS, policies, handle_new_user trigger, set_type ENUM)
  - app/scripts/verify-deploy.ts — Windows-without-Docker drift-verification harness via direct pg_catalog introspection
  - postgres@^3.4.9 devDep added (also useful for Plan 02-05's test-rls.ts)
affects: [02-04 type-gen, 02-05 cross-user RLS test, 02-06 doc reconciliation]

tech-stack:
  added:
    - "postgres@^3.4.9 (postgres.js — pure JS, ~80kb, devDep)"
  patterns:
    - "Windows-without-Docker drift verification via verify-deploy.ts (substitutes for `supabase db diff` which requires Docker per D-04)"

key-files:
  created:
    - "app/scripts/verify-deploy.ts (catalog introspection harness)"
  modified:
    - "app/package.json (postgres devDep)"
    - "app/package-lock.json"

key-decisions:
  - "Substituted `supabase db diff` (Docker-only) with `supabase migration list --linked` + `verify-deploy.ts` (catalog introspection) as the drift-verification gate. Same security guarantee, no Docker."
  - "postgres@^3.4.9 added as devDep (not regular dep) — used only by Node-only scripts (verify-deploy.ts, future test-rls.ts). React Native client continues to use @supabase/supabase-js + LargeSecureStore."
  - "F17 NOT marked complete in this plan. F17 (set_type ENUM) is now live in remote DB but the typed client surface (types/database.ts) is delivered by Plan 02-04. Mark F17 complete after 02-04."

patterns-established:
  - "Windows-without-Docker deploy verification: connect to Supabase pooler with postgres.js using SUPABASE_DB_PASSWORD + EXPO_PUBLIC_SUPABASE_URL → query pg_catalog directly for relrowsecurity, pg_policies, pg_trigger, pg_proc, pg_type"
  - "Studio UI gotcha: `auth.users` triggers are listed under schema dropdown = `auth`, NOT `public`. Studio's RLS badges in Tables view are also unreliable across versions — trust pg_class.relrowsecurity instead."

requirements-completed: []

duration: ~25 min (deploy + manual Studio inspection + catalog verification + harness scripting)
completed: 2026-05-09
---

# Phase 02-03: Schema Deploy to Remote Summary

**V1 schema applied to remote project mokmiuifpdzwnceufduu — 6 tables with RLS, 10 policies (errata fixes confirmed), handle_new_user trigger, set_type ENUM, all verified via direct pg_catalog introspection.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-05-09
- **Tasks:** 1 (deploy + manual checkpoint)
- **Files added:** 1 (verify-deploy.ts) + devDep update

## Accomplishments

- `0001_initial_schema.sql` deployed to remote project mokmiuifpdzwnceufduu via `npx supabase db push --yes -p $SUPABASE_DB_PASSWORD` (exit 0)
- `supabase migration list --linked` confirms `Local 0001 | Remote 0001` history match
- All 6 tables introspected with RLS = ON
- `plan_exercises` policy has `with_check = true` (errata fix from PITFALLS 2.5 confirmed)
- `exercise_sets` policy has `with_check = true` (errata fix from PITFALLS 2.5 confirmed)
- `handle_new_user` trigger live on `auth.users` (AFTER INSERT, EXECUTE FUNCTION handle_new_user)
- `set_type` ENUM live with values `["working","warmup","dropset","failure"]`
- Built and committed `verify-deploy.ts` — reusable drift-verification harness for Windows-without-Docker hosts

## Task Commits

1. **Deploy + verification harness** — `ef8ed85` (chore)

**Plan metadata:** _(this SUMMARY commit follows below)_

## Files Created/Modified

- `app/scripts/verify-deploy.ts` — Catalog introspection via postgres.js + Supabase pooler. Reports RLS state, policy details, triggers on auth.users, public functions, ENUMs, table list.
- `app/package.json` — Added `postgres@^3.4.9` to devDependencies.
- `app/package-lock.json` — Lock file regenerated.

## Decisions Made

1. **Drift-verification substitution.** Plan 02-03 originally specified `npx supabase db diff` as the hard drift gate ("must print 'No schema changes found'"). On Windows without Docker (D-04 forbids local Docker), `db diff` fails immediately with "failed to inspect docker image". Substituted: `supabase migration list --linked` (history match) + `verify-deploy.ts` (catalog introspection). The substituted gate is at least as strong: pg_catalog is the actual source of truth, while `db diff` only compares two versions of generated DDL.

2. **postgres.js as devDep, not dep.** verify-deploy.ts is a Node-only script — never imported by React Native code. The mobile client's data path stays exclusively on @supabase/supabase-js + LargeSecureStore (per architecture). postgres.js gets pruned from prod bundles automatically.

3. **F17 mark-complete deferred to Plan 02-04.** F17 ("set_type ENUM") is now physically present in the remote DB. But the requirement is delivered when application code can use it type-safely — that requires `types/database.ts` (Plan 02-04). Marking F17 complete here would be premature.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Alternate Verification Path] Substituted `db diff` with `verify-deploy.ts`**
- **Found during:** Task 1 (run db push + verify drift)
- **Issue:** `npx supabase db diff` requires Docker Desktop. CONTEXT D-04 explicitly forbids local Docker on Windows dev hosts. The CLI errors immediately: "failed to inspect docker image: ... open //./pipe/docker_engine: The system cannot find the file specified."
- **Fix:** Added `app/scripts/verify-deploy.ts` — a postgres.js-based catalog introspection harness. Run with `SUPABASE_DB_PASSWORD` + `EXPO_PUBLIC_SUPABASE_URL` from `.env.local` against the pooler. Reports RLS, policies (with `with_check` presence per cmd), triggers on `auth.users`, public functions, public ENUMs, and table list. Substantively stronger than `db diff` because it verifies the live catalog, not generated DDL.
- **Files modified:** app/scripts/verify-deploy.ts (new), app/package.json, app/package-lock.json
- **Verification:** Ran the harness; confirmed RLS=ON for all 6 tables, both errata-fixed policies have `with_check=true`, trigger and function exist, ENUM has the 4 expected values.
- **Committed in:** ef8ed85

**2. [Rule 3 — Reporting] Plan 02-02 SUMMARY policy count off-by-one**
- **Issue:** Plan 02-02's SUMMARY claims "9 policies"; actual deployed count is 10 (the `exercises` table has 4 separate cmd policies — SELECT, INSERT, UPDATE, DELETE — per ARCHITECTURE §4 design). pg_policies counts each cmd-distinct policy individually.
- **Fix:** No code change. This is a planning-doc miscount, not a deploy issue. Plan 02-06 (doc reconciliation) should refresh ARCHITECTURE.md to clarify the policy count vs. the conceptual policy clusters.
- **Files modified:** none (deferred to 02-06)

---

**Total deviations:** 2 (1 auto-fixed harness substitution, 1 deferred doc fix)
**Impact on plan:** Stronger verification than originally specified. No scope creep — verify-deploy.ts is also useful infrastructure for Plan 02-05's test-rls.ts cross-user RLS harness.

## Issues Encountered

- **Studio UI misled the user during manual sanity check.**
  - "No RLS badge on tables" → Studio's badges are version-/zoom-/cache-dependent. The actual `pg_class.relrowsecurity` is `true` for all 6 tables.
  - "Function visible but no trigger listed" → Studio's Triggers tab defaults to schema = `public`. The trigger lives on `auth.users`, so the user must switch the schema dropdown to `auth`.
  - **Resolution:** verify-deploy.ts now exists as the canonical post-deploy check. Plan 02-06 should add a CLAUDE.md note: "After every db push, run `npx tsx --env-file=.env.local scripts/verify-deploy.ts` rather than relying on Studio UI."

## User Setup Required

None — no new external service configuration. Plan 02-01's user_setup remains the binding contract for credentials.

## Next Phase Readiness

- Plan 02-04 can now run `npm run gen:types` against the live remote schema to generate `app/types/database.ts`.
- Plan 02-05 can use the `postgres@^3.4.9` devDep (already installed) if it wants direct DB access; primary path remains @supabase/supabase-js with anon-key roles.
- Plan 02-06 must:
  1. Update ARCHITECTURE.md §4 to reflect 10 policies (not 9), or clarify the policy-cluster count.
  2. Add a CLAUDE.md "Database conventions" sub-section per D-18, documenting:
     - Migration-as-truth rule (no Studio editing).
     - Windows-without-Docker drift check via verify-deploy.ts.
     - Studio UI gotchas (RLS badges, auth schema triggers).
  3. Mark ARCHITECTURE.md §4 errata as **fixed** (no longer "errata").

---
*Phase: 02-schema-rls-type-generation*
*Plan: 03*
*Completed: 2026-05-09*
