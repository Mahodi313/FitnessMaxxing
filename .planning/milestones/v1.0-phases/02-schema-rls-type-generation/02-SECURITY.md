---
phase: 02
slug: schema-rls-type-generation
status: secured
threats_open: 0
threats_closed: 27
asvs_level: 1
audit_date: 2026-05-09
audit_mode: verify-mitigations-exist
---

# SECURITY.md — Phase 02 (schema-rls-type-generation)

**Phase:** 02 — schema-rls-type-generation
**ASVS Level:** L1
**Block Policy:** high (block on HIGH severity gaps in new findings)
**Audit Date:** 2026-05-09
**Audit Mode:** VERIFY MITIGATIONS EXIST (register pre-authored at plan time)

## Verdict

**SECURED.** All 27 declared threats verified CLOSED. No OPEN_THREATS. No
unregistered_flags (both SUMMARY files with `## Threat Flags` sections explicitly
record "None"). Phase ships under L1 V4 (Access Control) + V14 (Configuration).

## Verification Methodology

Each threat from the 6 PLAN.md threat registers (T-02-01..T-02-27) was verified
against its declared `disposition` and `mitigation_pattern`:

- `mitigate` → grep for the documented pattern in cited implementation files; CLOSED only when match is present at the right location.
- `accept` → confirm rationale documented in plan threat-model and that no surface-area exists requiring SECURITY.md accepted-risks log entry.
- `transfer` → confirm transfer documentation present (CLI / OS user account ownership for `supabase login` token).

Implementation files were read-only; no patches written. Two prior phase audits
(`02-VERIFICATION.md`, `02-REVIEW.md` 0 blockers / 4 warnings) cross-referenced;
the load-bearing dynamic gates (22/22 RLS assertions PASS, post-WR-03 typed-client
threading) are taken as evidence per the prompt's "already known mitigation evidence"
allowlist.

## Per-Threat Verification Table

### Plan 01 — CLI bootstrap, credentials, npm scripts

| ID | Cat | Component | Disp | Status | Evidence |
|----|-----|-----------|------|--------|----------|
| T-02-01 | I/E | `SUPABASE_SERVICE_ROLE_KEY` placeholder in `.env.example` | mitigate | CLOSED | `app/.env.example:11` declares key WITHOUT `EXPO_PUBLIC_` prefix; Swedish warning comment at lines 7–10 explicitly forbids the prefix. Audit grep `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE` returns 0 matches in tracked source paths. |
| T-02-02 | I/E | `app/.env.local` real service-role value | mitigate | CLOSED | `git check-ignore app/.env.local` prints `app/.env.local` (gitignored from Phase 1, D-07); not present in any committed file. |
| T-02-03 | T | `app/supabase/config.toml` project_id binding | accept | CLOSED | `app/supabase/config.toml:5` (`project_id = "mokmiuifpdzwnceufduu"`) — non-sensitive (also in `EXPO_PUBLIC_SUPABASE_URL`); D-03 documents the acceptance. File is tracked (`git ls-files` confirms). |
| T-02-04 | I | gen:types script with literal project-ref | accept | CLOSED | `app/package.json:12` hard-codes literal `--project-id mokmiuifpdzwnceufduu` per Open Question #4; non-sensitive per D-03. |
| T-02-05 | E | `~/.supabase/access-token` from `npx supabase login` | transfer | CLOSED | Token lifecycle owned by Supabase CLI / OS user account; out of scope for ASVS L1. Rotation path documented in plan threat-model: `supabase logout` + revoke from Dashboard. |

### Plan 02 — Migration authoring (RLS, ENUM, trigger)

| ID | Cat | Component | Disp | Status | Evidence |
|----|-----|-----------|------|--------|----------|
| T-02-06 | T | RLS policy on `plan_exercises` (errata) | mitigate | CLOSED | `app/supabase/migrations/0001_initial_schema.sql:131-134` — policy "Users can manage own plan exercises" has BOTH `using (exists ...)` AND `with check (exists ...)` clauses with identical predicate. T-02-20-protected behavioral check: errata-regression INSERT rejected with PG `42501` (verified live in 02-05-SUMMARY.md). |
| T-02-07 | T | RLS policy on `exercise_sets` (errata) | mitigate | CLOSED | `0001_initial_schema.sql:141-144` — policy "Users can manage own sets" has both `using` and `with check` referencing `public.workout_sessions ... user_id = (select auth.uid())`. Plan 05 errata-regression INSERT rejected with PG `42501`. |
| T-02-08 | I | Wrapped `(select auth.uid())` for query-plan caching | mitigate | CLOSED | `0001_initial_schema.sql` lines 111, 113, 118, 120, 122, 124, 128, 133–134, 138, 143–144 — every `auth.uid()` is wrapped. Prior verification (02-VERIFICATION.md S2) confirms post-comment-filter unwrapped count = 0. |
| T-02-09 | E | `handle_new_user` trigger search-path injection | mitigate | CLOSED | `0001_initial_schema.sql:152-161` — `create function public.handle_new_user() ... language plpgsql security definer set search_path = ''`; insert uses fully-qualified `public.profiles`. Pattern matches PITFALLS Pitfall 7 / Supabase canonical recipe. |
| T-02-10 | T | RLS-enabled-no-policy footgun | mitigate | CLOSED | `0001_initial_schema.sql:96-101` enables RLS on all 6 tables; `0001_initial_schema.sql:110-144` ships at least one policy per table (profiles: select+update; exercises: 4 CRUD; workout_plans: for all; plan_exercises: for all; workout_sessions: for all; exercise_sets: for all). Plan 05 trigger-side-effect assertion confirms profiles is reachable to its owner. |
| T-02-11 | I | `is_warmup` left while code migrates to `set_type` | mitigate | CLOSED | Grep for `is_warmup` in `0001_initial_schema.sql` returns 0 matches; grep in `app/types/database.ts` returns 0 matches; F17 ENUM `set_type` declared at line 19 with `('working', 'warmup', 'dropset', 'failure')` and column at line 80 (`set_type public.set_type not null default 'working'`). No dual-write window. |

### Plan 03 — db push deploy

| ID | Cat | Component | Disp | Status | Evidence |
|----|-----|-----------|------|--------|----------|
| T-02-12 | T | Studio drift between push and next migration | mitigate | CLOSED | 02-VERIFICATION.md S1 confirms `pg_class.relrowsecurity = ON` for all 6 tables via `verify-deploy.ts` introspection; D-18 codified as durable rule in `CLAUDE.md:148` (`### Database conventions (established Phase 2)` — Studio is read-only). |
| T-02-13 | R | Migration applied without committed source | accept | CLOSED | Migration file `app/supabase/migrations/0001_initial_schema.sql` is committed (git ls-files confirms). CLI records migration in remote `supabase_migrations.schema_migrations`. Audit trail = git log + remote table. Documented acceptance in plan threat model. |
| T-02-14 | E | DB password leakage via shell history | accept | CLOSED | Password entered at interactive CLI prompt (Plan 01 Task 2 Step 2), not as command-line arg → PowerShell history does not capture it. Acceptance documented in plan threat model. |
| T-02-15 | T | `supabase db reset --linked` accidental destructive run | mitigate | CLOSED | Plan 03 uses ONLY `db push` and `db diff` (non-destructive). Grep for `db reset` in committed implementation paths returns 0. Anti-pattern enumerated in RESEARCH §"Anti-Patterns". |

### Plan 04 — Type-gen + typed client + phase1ConnectTest removal

| ID | Cat | Component | Disp | Status | Evidence |
|----|-----|-----------|------|--------|----------|
| T-02-16 | T | Hand-edits to generated `database.ts` | mitigate | CLOSED | `app/types/database.ts:243` `set_type: "working" \| "warmup" \| "dropset" \| "failure"` matches deployed ENUM exactly; `:371` `set_type: ["working", "warmup", "dropset", "failure"]` Constants array matches. No manual drift. Discipline rule codified in `CLAUDE.md` Database conventions sub-section. |
| T-02-17 | I | `phase1ConnectTest` referenced non-existent table | accept | CLOSED | Phase-1 hygiene; `phase1ConnectTest` removed. Grep for `phase1ConnectTest` across `app/` returns 0 matches (verified). |
| T-02-18 | T | Type-pipeline drift (gen vs migration source) | mitigate | CLOSED | `app/types/database.ts` mentions all 6 tables; includes `set_type` ENUM literal union (line 243) AND Constants array (line 371); does NOT mention `is_warmup`. Plan 03 db diff = "No schema changes found" → types generated from same remote schema → consistent by construction. |

### Plan 05 — Cross-user RLS test harness

| ID | Cat | Component | Disp | Status | Evidence |
|----|-----|-----------|------|--------|----------|
| T-02-19 | I/E | Service-role key in `test-rls.ts` | mitigate | CLOSED | File path `app/scripts/test-rls.ts:36` reads `process.env.SUPABASE_SERVICE_ROLE_KEY` (no `EXPO_PUBLIC_` prefix). Audit grep `service_role|SERVICE_ROLE` excluding `.planning/`, `CLAUDE.md`, `.claude/` returns exactly two paths: `app/.env.example` and `app/scripts/test-rls.ts`. ZERO matches in `app/lib/`, `app/app/`, `app/components/`, `app/types/`. |
| T-02-20 | T | False-positive RLS test (silent pass) | mitigate | CLOSED | `app/scripts/test-rls.ts:440` declares `mainCompleted` boolean; `:443` set to `true` only after `await main()` returns; `:456-461` finally block refuses success message and exits 1 if `!mainCompleted`. This is the Plan 05 deviation #2 fix that explicitly cites T-02-20 by ID. Behavioral evidence: 22/22 assertions ran end-to-end (per 02-05-SUMMARY.md). |
| T-02-21 | I | Test users colliding with real users | mitigate | CLOSED | `app/scripts/test-rls.ts:51` uses TLD `.local` (RFC 6761 reserved); `:50` prefix `rls-test-`; cleanup at `:154` filters `email.startsWith(TEST_EMAIL_PREFIX)`. |
| T-02-22 | I | Test users persisting after script crash | mitigate | CLOSED | `app/scripts/test-rls.ts:174` calls `cleanupTestUsers()` defensive at start; `:447-454` calls it again in `finally` block; `purgeUserData()` at `:134-145` handles ON DELETE RESTRICT cascade ordering. |
| T-02-23 | E | tsx loading `.env.local` exposes service-role into `process.env` | accept | CLOSED | Process env scoped to local Node process; not visible to Metro/Expo bundler/committed files. `--env-file=.env.local` is Node v24 native (no dotenv dep). Acceptance documented in plan threat model. |
| T-02-24 | T | RLS-blocked writes returning empty data (silent pass) | mitigate | CLOSED | `app/scripts/test-rls.ts:103-118` `assertWriteBlocked` accepts BOTH error AND empty-data outcomes (Postgres returns either depending on op). Combined with T-02-20 mainCompleted guard, cannot pass vacuously. Errata-regression INSERTs explicitly probe Phase-1-allowed cases — would fail loudly if RLS were broken. |

### Plan 06 — Doc reconciliation (process-level threats)

| ID | Cat | Component | Disp | Status | Evidence |
|----|-----|-----------|------|--------|----------|
| T-02-25 | T (process) | Future migration drifts from PITFALLS rules | mitigate | CLOSED | `CLAUDE.md:148` `### Database conventions (established Phase 2)` sub-section codifies migration-as-truth, RLS pairs-with-policy, using+with-check, wrapped `auth.uid()`, gen:types discipline, service-role isolation, cross-user verification gate — auto-loaded into every Claude session. 6 PITFALLS citations (≥4 acceptance gate). |
| T-02-26 | R (historical) | Future planner re-discovers PITFALLS 2.5 errata | mitigate | CLOSED | `.planning/STATE.md:75` Decisions-log entry flipped from `fixas i Phase 2` to `errata FIXED in Phase 2` with traceability link to `02-02-SUMMARY.md`. |
| T-02-27 | T (process) | ARCHITECTURE.md shows OLD policy SQL while migration ships NEW | mitigate | CLOSED | `ARCHITECTURE.md` (root) §4 + §5 transcribe deployed migration verbatim — 28 grep matches across `set_type / with check / is_warmup / select auth.uid / handle_new_user / security definer`. `is_warmup` count = 0; `(select auth.uid())` count = 14; `with check` count = 10; `handle_new_user` count = 5. |

## Audit Gate Snapshot (Phase 2 Invariants)

| Gate | Result | Evidence |
|------|--------|----------|
| Service-role audit (excluding `.planning/`, `CLAUDE.md`, `.claude/`) | CLEAN | Exactly two whitelisted tracked paths: `app/.env.example`, `app/scripts/test-rls.ts`. Zero in bundled paths. |
| `phase1ConnectTest` removed | CLEAN | Grep across `app/` returns 0 matches. |
| `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE` (forbidden prefix) | CLEAN | 0 matches in committed source paths; only mentioned in planning docs as forbidden pattern. |
| `is_warmup` removed | CLEAN | 0 matches in `0001_initial_schema.sql`, `app/types/database.ts`, `ARCHITECTURE.md`. |
| `app/.env.local` gitignored | CLEAN | `git check-ignore app/.env.local` returns the path. |
| `app/supabase/config.toml` tracked | CLEAN | `git ls-files` confirms (D-03). |
| 22/22 RLS assertions live | CLEAN | 02-05-SUMMARY.md confirms post-merge, post-WR-03 run. |

## Unregistered Flags

**None.** Both SUMMARY files containing a `## Threat Flags` section
(`02-05-SUMMARY.md`, `02-06-SUMMARY.md`) explicitly record "None" with rationale.

The other four plan SUMMARY files (01, 02, 03, 04) do not contain a `## Threat Flags`
section. Per the audit prompt these threats are pre-mapped to the register; no
unregistered surface was introduced by implementation.

## Cross-Reference: 02-REVIEW.md Warnings

The phase code-reviewer surfaced 4 warnings (0 blockers). None of them maps to an
OPEN threat in this register. WR-03 (typed-client threading in `test-rls.ts`) was
fixed in commit 3b444ba prior to this audit and is reflected in the implementation
read above (`SupabaseClient<Database>` declarations at `test-rls.ts:61, 65, 69`;
`createClient<Database>` at the same lines).

## Accepted Risks Log

The following dispositions are `accept` and require no patch — rationale documented
in plan threat-model for each:

- **T-02-03** project_id non-sensitivity (D-03)
- **T-02-04** literal project-ref in npm script (Open Question #4 → option 1)
- **T-02-13** migration applied without committed source (it IS committed; CLI records on remote)
- **T-02-14** DB password via interactive prompt (no shell history capture)
- **T-02-17** `phase1ConnectTest` removal as hygiene event
- **T-02-23** `process.env` scope of service-role under tsx `--env-file`

## Transferred Risks Log

- **T-02-05** `~/.supabase/access-token` lifecycle → Supabase CLI / OS user account.
  Out of Phase 2 ASVS L1 scope. Compromise mitigation = `supabase logout` + Dashboard revoke.

## ASVS L1 Verdict

| Control | Result |
|---------|--------|
| V4 — Access Control | PASS — 22/22 cross-user RLS assertions live; errata-regression INSERTs rejected with PG `42501`. |
| V14 — Configuration | PASS — Service-role audit clean; `.env.local` gitignored; placeholder-only in `.env.example`; `EXPO_PUBLIC_` prefix gating enforced. |

**Phase 02 ships under ASVS L1 with all 27 declared threats CLOSED.**
