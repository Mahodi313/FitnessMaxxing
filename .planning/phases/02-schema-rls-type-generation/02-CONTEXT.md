# Phase 2: Schema, RLS & Type Generation - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 applies the canonical 6-table schema from `ARCHITECTURE.md §4` (with three documented errata fixed) to the linked Supabase project, proves RLS isolates User A from User B with a re-runnable cross-user test, and brings generated TS types into the app via a `gen:types` script. After Phase 2, every later phase can `supabase.from(...)` against typed tables and trust that RLS keeps data private. The migration file becomes the source of truth for the schema; Studio is read-only from this point forward.

**In scope:**
- Initialize Supabase CLI in the repo (`app/supabase/`) with `npx supabase init`
- Link the repo to the existing Supabase project (`npx supabase link --project-ref <ref>`)
- Author one initial migration file: `app/supabase/migrations/0001_initial_schema.sql` containing — in this order — the six tables (profiles, exercises, workout_plans, plan_exercises, workout_sessions, exercise_sets), the indexes from ARCHITECTURE.md §4, the `set_type` ENUM type + column, the `enable row level security` statements, the corrected RLS policies (every writable policy has both `using` and `with check`; every `auth.uid()` is wrapped as `(select auth.uid())`), and the `handle_new_user` trigger that inserts a `profiles` row on `auth.users` insert
- Apply the migration with `npx supabase db push`
- Add `npm run gen:types` script that runs `npx supabase gen types typescript --project-id <ref> > app/types/database.ts`; commit the generated `app/types/database.ts`
- Type the supabase client: `createClient<Database>(...)` in `app/lib/supabase.ts`
- Author `app/scripts/test-rls.ts` (Node-only) that seeds two users via the service-role admin API and asserts cross-user blocking on all 5 user-scoped tables; surface as `npm run test:rls`
- Add `SUPABASE_SERVICE_ROLE_KEY` and `EXPO_PUBLIC_SUPABASE_PROJECT_ID` lines to `app/.env.example` (with placeholder values); add real values to `app/.env.local` (already gitignored)
- Update `ARCHITECTURE.md §4` (errata-fixed schema, set_type enum, no is_warmup, profiles trigger) and `§5` queries (filter `set_type = 'working'` instead of `is_warmup = false`) so the canonical decision register matches deployed reality
- Remove `phase1ConnectTest()` from `app/lib/supabase.ts` and its caller in `app/app/_layout.tsx` once real tables exist
- Add a brief migration-as-truth note to PROJECT.md or CLAUDE.md "## Conventions" so future schema changes don't drift through Studio

**Out of scope (belongs to later phases):**
- Auth UI, sign-in / sign-up screens, route grouping, session persistence verification → Phase 3
- Zod schemas mirroring the tables (`app/lib/schemas/*.ts`) → built per-feature in Phase 4+ (zod for "all extern data" per PROJECT.md, but the schemas themselves arrive when actually consumed)
- Supabase migration of new columns / additional tables for V1.1 features (F18 PR-detection, F19 vilo-timer) → V1.1
- Additional indexes beyond ARCHITECTURE.md §4 — only add if the F7/F10 query plans surface a problem; not pre-optimized in Phase 2
- Local Supabase Docker stack (`supabase start`) — explicitly avoided per type-gen and RLS-test decisions to keep Windows dev friction-free
- App-side use of generated types in feature code → Phase 4+ (Phase 2 only proves the type pipeline works by typing the client)
- A separate test Supabase project — solo V1 uses dev project with namespaced test users
- pgTAP, RLS performance benchmarking, Supabase Database Advisors lint as a CI gate — manual one-time check is fine for V1

</domain>

<decisions>
## Implementation Decisions

### Migration tooling & workflow
- **D-01:** Use the Supabase CLI as the schema source of truth (`npx supabase init` → migration files in `app/supabase/migrations/` → `supabase db push`). Studio is read-only from Phase 2 forward — every schema change ships as a SQL file. Per PITFALLS 4.2.
- **D-02:** Initial schema lands as a single file: `app/supabase/migrations/0001_initial_schema.sql`. Future deltas (F18+, V1.1, V2) become numbered follow-up files. The "initial schema" is one atomic commit.
- **D-03:** Bind the repo to the existing Supabase project via `npx supabase link --project-ref <ref>`. The committed `app/supabase/config.toml` carries the project ref (non-sensitive — also visible in the Supabase URL). *(Relaxed 2026-05-08 after RESEARCH OQ #4: how the npm script reads the project ref — env var vs hard-coded literal — is moved to "Claude's Discretion" below. The committed `config.toml` remains the source of truth for the link.)*
- **D-04:** `npm run gen:types` runs `npx supabase gen types typescript --project-id <project-ref> > app/types/database.ts` against the **remote** linked project. No local Docker stack required (deliberate — Windows dev). The generated `app/types/database.ts` is committed; CI/regressions catch drift. The exact form of `<project-ref>` (literal vs env-var indirection) is "Claude's Discretion".
- **D-05:** `app/lib/supabase.ts` swaps `createClient(...)` → `createClient<Database>(...)` once `app/types/database.ts` exists. This is the only client-side type-pipeline change in Phase 2.

### RLS verification
- **D-06:** Cross-user RLS test ships as `app/scripts/test-rls.ts` — a **Node-only** TypeScript script (run via `npx tsx` or similar), NOT bundled into the Expo app. Uses the same `@supabase/supabase-js` client the app uses. Surfaced as `npm run test:rls`.
- **D-07:** The script reads `SUPABASE_SERVICE_ROLE_KEY` from `app/.env.local` (gitignored, dev-only) and uses `supabase.auth.admin.createUser({email, password, email_confirm: true})` to seed two test users idempotently (`rls-test-a@fitnessmaxxing.local` / `rls-test-b@fitnessmaxxing.local` or similar). The service-role key NEVER appears in any file under `app/lib/`, `app/app/`, or any other bundled path — enforced by `git grep "SERVICE_ROLE"` audit per PITFALLS 2.3.
- **D-08:** Tests run against the **same dev Supabase project** (no separate test project, no Docker). Test rows are namespaced (`name LIKE 'rls-test-%'`) and cleaned up at the start AND end of every run. Pragmatic for solo V1 budget = $0.
- **D-09:** Coverage = all 5 user-scoped tables: `profiles`, `exercises`, `workout_plans`, `plan_exercises` (via `workout_plans` parent check), `workout_sessions`, `exercise_sets` (via `workout_sessions` parent check). For each table, the script asserts as User A: (a) cannot SELECT User B's rows (returns 0 rows), (b) cannot INSERT a row owned by User B (RLS rejection), (c) cannot UPDATE User B's rows (0 rows affected), (d) cannot DELETE User B's rows (0 rows affected). The `plan_exercises` and `exercise_sets` cases — which are exactly the PITFALLS 2.5 errata — must explicitly test that User A cannot insert a child row pointing at User B's parent.
- **D-10:** Test reports failures by exit code (0 = pass, 1 = any assertion failed) plus a per-assertion log line. No fancy framework — `console.assert`-style output is enough for a personal script. Phase 2 success criterion #3 is satisfied when `npm run test:rls` exits 0.

### set_type enum + is_warmup
- **D-11:** `set_type` is implemented as a Postgres ENUM type, not a CHECK constraint. SQL: `CREATE TYPE set_type AS ENUM ('working','warmup','dropset','failure');` then `set_type set_type NOT NULL DEFAULT 'working'` on `exercise_sets`. `supabase gen types` will emit this as a TS string-literal union, giving compile-time narrowing for free. F17 ships as schema-only — no UI in V1.
- **D-12:** `is_warmup boolean default false` is **dropped** from `exercise_sets` (DB has no data; migration is free per PROJECT.md). `set_type = 'warmup'` becomes the single source of truth for warmup classification. No dual-write, no generated column, no compatibility shim.
- **D-13:** ARCHITECTURE.md §5 queries (F7 "senaste värdet", F10 "max-vikt") are rewritten in Phase 2's doc-update step to filter `set_type = 'working'` (not `is_warmup = false`). Working sets are the canonical "what I lifted" — dropsets and failure sets are excluded from F7's last-value display because they would mislead.
- **D-14:** Phase 2 includes an edit pass on `ARCHITECTURE.md §4` and `§5` so the canonical decision register matches deployed reality: errata fixes (with check on every writable policy, wrapped auth.uid()), set_type enum, dropped is_warmup, profiles trigger, query rewrites. The errata note in `STATE.md` flips to "fixed". Doc and code stay in sync — downstream phases don't have to re-discover the gaps.

### Profiles row trigger
- **D-15:** The `handle_new_user` trigger ships in the same `0001_initial_schema.sql` migration file as the rest of the schema. Phase 2 owns it because it's schema-shaped (DB function + DB trigger), not Phase 3 client-side flow. Without it, even the cross-user RLS test would have to manually paper-insert `profiles` rows after seeding auth users.
- **D-16:** Trigger body inserts only `id`: `INSERT INTO public.profiles (id) VALUES (NEW.id);`. `display_name` stays NULL until the user edits it (Settings UI is V1.1 territory). `preferred_unit` falls back to its column default `'kg'`. Smallest possible trigger.
- **D-17:** Trigger function uses `SECURITY DEFINER` with `SET search_path = ''` per Supabase's official guidance, and references all objects with fully-qualified names (`public.profiles`). This defends against PostgreSQL search-path injection and is the documented Supabase trigger pattern.

### Migration-as-truth convention
- **D-18:** Add a brief "Database conventions" sub-section to either `CLAUDE.md ## Conventions` or `PROJECT.md ## Constraints` capturing: (a) all schema changes go through `app/supabase/migrations/` — Studio is read-only, (b) every migration that creates a table must `enable row level security` AND add at least one policy in the same file, (c) every writable policy has both `using` AND `with check`, (d) every `auth.uid()` reference is wrapped as `(select auth.uid())`, (e) `npm run gen:types` runs after every schema migration; the generated `app/types/database.ts` is committed in the same commit as the migration. This makes the rules durable for V1.1 / V2.

### Claude's Discretion
- **Project-ref reference style in `npm run gen:types`** (relaxed from D-03/D-04 after RESEARCH OQ #4 + user confirmation 2026-05-08): hard-code the literal project-ref in the npm script vs. read from `EXPO_PUBLIC_SUPABASE_PROJECT_ID`. Hard-coded literal sidesteps the PowerShell `$VAR`-vs-bash-`$VAR` interpolation footgun on Windows and there is no runtime use case for the env var elsewhere in V1. Plan 01 hard-codes; revisit if a runtime use case appears in V1.1+.
- Exact string format of test-user emails (e.g., `rls-test-a@fitnessmaxxing.local` vs `rls-a@test.fitnessmaxxing.local`) — pick something consistent and namespaced.
- Exact assertion-output format in `test-rls.ts` (table-shape vs flat lines) — readable in a terminal is the only requirement.
- Exact wording / placement of the "Database conventions" sub-section (CLAUDE.md vs PROJECT.md vs both) — wherever it fits without crowding existing content.
- Whether to also add `app/supabase/migrations/0001_initial_schema.sql` a header comment block summarizing what it deploys + linking to ARCHITECTURE.md §4 — recommended, but exact wording is yours.
- Whether to add an idempotency safeguard (`if exists` / `if not exists`) inside the migration. Supabase migration files don't typically need this (they run once), but it's harmless if you want it for re-runnability against a fresh project.
- Whether `test-rls.ts` runs in TS via `tsx`/`ts-node` or transpiles to JS first — pick whichever stays out of the Expo bundler's way.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 2 schema authority
- `ARCHITECTURE.md` §4 — Datamodell: 6 tables, indexes, RLS policies. Canonical schema source for Phase 2; **note the documented errata** (missing `with check` on `plan_exercises` + `exercise_sets`, raw `auth.uid()` not wrapped) that Phase 2 fixes
- `ARCHITECTURE.md` §5 — Nyckel-queries (F7 "senaste värdet", F10 "max-vikt") — these are updated in Phase 2 to filter `set_type = 'working'` instead of `is_warmup = false`
- `ARCHITECTURE.md` §6 — Autentisering (informs profiles trigger placement; auth flow itself is Phase 3)
- `ARCHITECTURE.md` §8 — Säkerhet (RLS as primary defense; service-role-key never in client)
- `ARCHITECTURE.md` §10 — Beslutsregister (Supabase + RLS lock — schema choices flow from here)
- `PRD.md` — F1 (auth, informs profiles trigger), F7 (last value query — filter rewrite), F10 (max graph — filter rewrite), F13 (offline — schema must support client-supplied UUIDs; `gen_random_uuid()` already a default per ARCHITECTURE.md), F17 (set-typ schema-only — drives the enum decision)

### Phase 2 implementation pitfalls (load-bearing)
- `.planning/research/PITFALLS.md` §2.1 — Forgetting `enable row level security` on a new table; migration template + lint check
- `.planning/research/PITFALLS.md` §2.2 — RLS enabled but no policies = "deny everything"; pair `enable row level security` with at least one policy in the same migration
- `.planning/research/PITFALLS.md` §2.3 — Service-role key sneaking into the client; rules for `test-rls.ts` placement (Node-side, not in `app/lib/`)
- `.planning/research/PITFALLS.md` §2.5 — RLS policy uses `using` but not `with check` (the explicit `plan_exercises` / `exercise_sets` errata Phase 2 fixes — has the corrected SQL)
- `.planning/research/PITFALLS.md` §2.6 — Hardcoded Supabase URL/key in source files (already addressed in Phase 1, re-verify when adding service-role key handling)
- `.planning/research/PITFALLS.md` §3.5 — TypeScript `any` everywhere because Supabase types aren't generated; `gen:types` script + `createClient<Database>(...)`
- `.planning/research/PITFALLS.md` §4.1 — RLS policies querying parent table with N+1 perf collapse; wrap `auth.uid()` as `(select auth.uid())` (the second documented errata)
- `.planning/research/PITFALLS.md` §4.2 — Migrations done in Supabase Studio without committing SQL; migration-as-truth rule (drives D-01, D-18)
- `.planning/research/PITFALLS.md` §4.4 — `ON DELETE CASCADE` chains accidentally erasing history; FK rules in ARCHITECTURE.md are correct as-is, do not change

### Phase 2 architecture context
- `.planning/research/ARCHITECTURE.md` line 158 — `app/types/database.ts` is the canonical type-gen output path
- `.planning/research/ARCHITECTURE.md` line 542 — "Generate types" install step references the exact `supabase gen types typescript --project-id ... > types/database.ts` command
- `.planning/research/ARCHITECTURE.md` line 96 — `lib/schemas/*.ts` (Zod) — Phase 2 does NOT pre-create these; per-feature in Phase 4+
- `.planning/research/SUMMARY.md` — High-level research roundup
- `.planning/research/PITFALLS.md` line 887, 897, 932, 936, 942, 944, 945 — Cross-cutting checklists for "every phase that touches schema" — Phase 2 ticks each item

### Project-level context
- `.planning/PROJECT.md` — Core value (data integrity = "får aldrig förlora ett set"), constraints (RLS obligatorisk, service-role aldrig i klient, Zod för extern data), key decisions (Supabase + RLS lock, F17 schema-only)
- `.planning/REQUIREMENTS.md` — F17 (set-typ schema-only — drives D-11/D-12), F1 (auth — drives the profiles trigger placement decision)
- `.planning/ROADMAP.md` Phase 2 — Success criteria #1–#5; phase ordering (Phase 3 depends on Phase 2 specifically because `profiles` must exist before sign-up)
- `.planning/STATE.md` — "ARCHITECTURE.md §4 errata: `with check` saknas på `plan_exercises` + `exercise_sets` — fixas i Phase 2" — this Phase 2 closes that errata explicitly
- `.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md` D-07 + `01-VERIFICATION.md` — Phase 1 supabase.ts + LargeSecureStore wiring; Phase 2 adds the `<Database>` type parameter to `createClient` and removes `phase1ConnectTest()`
- `CLAUDE.md ## Conventions` — Existing project conventions block where the new "Database conventions" sub-section may land (D-18)

### Stack reference
- `CLAUDE.md` Backend & Auth table — `@supabase/supabase-js@^2.105.3` already installed in Phase 1; no new package versions in Phase 2
- `CLAUDE.md` First-Time-User Gotchas → `@supabase/supabase-js 2.105` — sets up the LargeSecureStore expectations Phase 1 already wired

### Source-of-truth diff target
- `app/lib/supabase.ts` (current Phase 1 form) — Phase 2 swaps `createClient(...)` → `createClient<Database>(...)` and removes `phase1ConnectTest`
- `app/app/_layout.tsx` lines 38–42 — Phase 2 removes the `phase1ConnectTest()` `useEffect` invocation
- `app/.env.example` — Phase 2 adds placeholder lines for `SUPABASE_SERVICE_ROLE_KEY` and `EXPO_PUBLIC_SUPABASE_PROJECT_ID`
- `app/.env.local` — Phase 2 adds real values (NEVER committed)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`app/lib/supabase.ts`** — Phase 1's typed `createClient` call. Phase 2 turns it from `createClient(supabaseUrl, supabaseAnonKey, {...})` into `createClient<Database>(supabaseUrl, supabaseAnonKey, {...})` with `import type { Database } from '@/types/database'`. Everything else (`LargeSecureStore`, `AppState` listener, env-var runtime guard) stays unchanged.
- **`app/lib/supabase.ts` lines 88–119 (`phase1ConnectTest`)** — Removed in Phase 2 once `_phase1_smoke` is no longer the only fake table available. Real RLS test (`test-rls.ts`) supersedes its purpose.
- **`app/.env.local`** — Already exists, gitignored. Phase 2 adds two lines: `SUPABASE_SERVICE_ROLE_KEY=...` (Node-only secret, never read by `app/lib/`) and `EXPO_PUBLIC_SUPABASE_PROJECT_ID=...` (referenced by `npm run gen:types`).
- **`app/.env.example`** — Already exists. Phase 2 mirrors the new `.env.local` keys with placeholder values + a comment that `SUPABASE_SERVICE_ROLE_KEY` is Node-only.
- **`app/package.json`** — Phase 2 adds `gen:types` and `test:rls` to `scripts`. No new dependencies — `@supabase/supabase-js` is already there. May need a TS runner for Node scripts (e.g., `tsx` as devDependency) — Phase 2 chooses whether to add it.
- **`app/app/_layout.tsx` lines 38–42** — Phase 2 removes the `phase1ConnectTest()` invocation and its surrounding `useEffect`.
- **`ARCHITECTURE.md` §4 + §5** — The original schema + queries. Phase 2 edits these in place to reflect deployed reality.

### Established Patterns
- **Inner Expo project under `app/`-subdir.** Per Phase 1 D-01: all CLI work runs from `app/` cwd. Phase 2 commands: `cd app && npx supabase init`, `cd app && npx supabase link`, `cd app && npx supabase db push`, `cd app && npm run gen:types`, `cd app && npm run test:rls`. Plans must be explicit.
- **Path alias `@/*` → `./*`** Already in use; Phase 2 uses `@/types/database` and `@/lib/supabase`.
- **`expo-secure-store` for sessions; service-role NEVER in `app/lib/`.** Phase 1's LargeSecureStore wraps the anon-key client. Phase 2's service-role usage is strictly Node-side (`app/scripts/test-rls.ts`), reads from `process.env`, never imports anything under `app/lib/`.
- **Runtime env-var guard pattern.** `app/lib/supabase.ts` already throws if env vars are missing. Phase 2's `app/scripts/test-rls.ts` should mirror this for `SUPABASE_SERVICE_ROLE_KEY` — fail loud, not silent.
- **`gen_random_uuid()` defaults on every PK.** Required for F13 offline-first (client-supplied UUIDs work without schema change). Already correct in ARCHITECTURE.md §4 — Phase 2 preserves.

### Integration Points
- **New: `app/supabase/`** directory tree (`config.toml`, `migrations/0001_initial_schema.sql`, optional `seed.sql`). First Supabase CLI artifacts in the repo.
- **New: `app/types/`** directory. First file: `app/types/database.ts` (generated, committed).
- **New: `app/scripts/test-rls.ts`** (and possibly `app/scripts/` directory if it doesn't exist yet). First Node-only script in the project.
- **Modified: `app/package.json`** — adds `scripts.gen:types` + `scripts.test:rls` + possibly `devDependencies.tsx` (or equivalent TS runner).
- **Modified: `app/.env.example` + `app/.env.local`** — two new keys.
- **Modified: `app/lib/supabase.ts`** — typed client, connect-test removed.
- **Modified: `app/app/_layout.tsx`** — connect-test useEffect removed.
- **Modified: `ARCHITECTURE.md` §4 + §5** — schema & queries updated to deployed reality.
- **Modified: `STATE.md`** — errata note moves to "fixed".
- **Modified: `CLAUDE.md` (or `PROJECT.md`)** — new "Database conventions" sub-section per D-18.

</code_context>

<specifics>
## Specific Ideas

- **Migration file header.** `0001_initial_schema.sql` should open with a brief comment block: "Initial schema for FitnessMaxxing V1. Mirrors ARCHITECTURE.md §4 with errata fixed (with check on all writable policies; wrapped auth.uid()) and F17 schema (set_type enum). See .planning/phases/02-schema-rls-type-generation/02-CONTEXT.md for the discussion that produced this."
- **The errata fixes are the load-bearing changes.** Specifically: (a) `plan_exercises` policy gets `with check (exists (select 1 from workout_plans where id = plan_id and user_id = (select auth.uid())))` — the same predicate as `using`. (b) `exercise_sets` policy gets the analogous `with check` on the `workout_sessions` parent. (c) Every `auth.uid()` in every policy is `(select auth.uid())`.
- **Test-user namespacing.** Use a TLD that won't collide with real users: `.local` or `.test`. Cleanup query: `DELETE FROM auth.users WHERE email LIKE 'rls-test-%@%'` via service-role at start + end of `test-rls.ts`. Keep the cleanup defensive — even if tests crash mid-run, next run cleans up.
- **`gen:types` ordering.** The npm script must be runnable from `app/`-cwd; the output redirect `> app/types/database.ts` becomes `> ./types/database.ts` (or `> types/database.ts`) when run from `app/`. Just make sure the relative path resolves correctly; a `mkdir -p types` line first is harmless.
- **profiles trigger doesn't need a `with check` policy on inserts.** The trigger runs as `SECURITY DEFINER`, which bypasses RLS by design. The existing `Users can update own profile` policy (with `using` + `with check`) is enough for runtime updates.
- **Don't pre-create Zod schemas.** ARCHITECTURE.md mentions `lib/schemas/*.ts` but those are per-feature in Phase 4+. Phase 2 only needs typed Supabase queries — Zod boundaries land alongside the forms that use them.
- **Don't pre-add indexes beyond ARCHITECTURE.md §4.** F7 "senaste värdet" and F10 "max-vikt" both rely on `idx_exercise_sets_exercise(exercise_id, completed_at desc)` which is already in §4. Phase 5/6 measure first.

</specifics>

<deferred>
## Deferred Ideas

- **Zod schemas mirroring tables (`app/lib/schemas/*.ts`)** — Phase 4+ when forms first need them. Generated TS types from Phase 2 are enough to keep Supabase queries typed without Zod for V1 reads.
- **F18 PR-detection schema (computed columns or trigger)** — V1.1. Schema lives somewhere alongside the auto-PR detection logic when it's built.
- **F19 vilo-timer (no schema change)** — V1.1. No DB impact.
- **`preferred_unit` UI / setting** — V2 (per PRD Out of Scope: Sverige-only V1 = kg). Schema column already exists (default `'kg'`); UI deferred.
- **Supabase Database Advisors lint as a CI gate** — V1.1+ if Phase 2 lands cleanly. Manual one-time check at end of Phase 2 is sufficient.
- **Local Supabase Docker stack (`supabase start`)** — Not needed for V1 (deliberately avoided to keep Windows dev friction-free). May be re-evaluated for V2 if multi-environment deployment requires it.
- **Separate test Supabase project for cross-user RLS tests** — Re-evaluate at V1.1 / V2 when test data volume grows or CI runs against tests automatically.
- **pgTAP migration tests** — Pure-SQL test suite. Powerful, but pure-Node `test-rls.ts` is enough for V1's actual risk surface. Reconsider if test count grows past ~20 distinct cases.
- **`set_type` enum value additions (e.g., 'amrap', 'cluster')** — V1.1+ if user training pattern actually uses them. ENUM lets us `ALTER TYPE … ADD VALUE` cleanly.
- **Composite unique constraints (e.g., `UNIQUE(session_id, set_number)` on exercise_sets)** — Re-evaluate in Phase 5 if set ordering needs DB-side enforcement; current schema relies on application-side ordering.

### Reviewed Todos (not folded)
None — STATE.md "Pending Todos" was empty.

</deferred>

---

*Phase: 2-schema-rls-type-generation*
*Context gathered: 2026-05-08*
