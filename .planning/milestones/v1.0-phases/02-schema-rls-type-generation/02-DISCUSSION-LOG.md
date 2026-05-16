# Phase 2: Schema, RLS & Type Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 2-schema-rls-type-generation
**Areas discussed:** Migration workflow, RLS verification, set_type enum + is_warmup, Profiles row trigger

---

## Migration workflow (CLI vs Studio)

### Q1 — How do we apply schema changes to the Supabase project — both this initial migration and every future one?

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase CLI + db push | `supabase init` once, `supabase migration new <name>` → SQL file in `app/supabase/migrations/`, `supabase link --project-ref <ref>`, `supabase db push`. Studio read-only. PITFALLS 4.2 mandates this from day 1; type-gen against remote project, no Docker on Windows. | ✓ |
| Studio one-shot, then capture | Paste SQL into Studio, then `supabase db pull` to capture as migration retroactively. Faster bootstrap but introduces 'first migration is special' asymmetry; risks Studio drift. | |
| Studio only, no CLI | Hand-paste SQL into Studio for every change. PITFALLS 4.2 explicitly warns against this. Listed for completeness. | |

**User's choice:** Supabase CLI + db push
**Notes:** Migration-as-truth from Phase 2 onward. Studio is read-only.

### Q2 — How do we split the initial schema across migration files?

| Option | Description | Selected |
|--------|-------------|----------|
| One file: 0001_initial_schema.sql | All 6 tables + indexes + RLS + policies + set_type enum + handle_new_user trigger in one file. Atomic mental model. | ✓ |
| Split per concern | 0001_tables.sql, 0002_rls.sql, 0003_set_type.sql, 0004_profiles_trigger.sql. More diff-friendly; 4 files for the same atomic 'initial schema' is heavier than the value. | |
| You decide | Pick whichever feels cleanest given the SQL length. | |

**User's choice:** One file: 0001_initial_schema.sql
**Notes:** "Initial schema" lands as one atomic commit; future deltas (V1.1+) become numbered follow-up files.

### Q3 — Where does `npm run gen:types` pull the schema from?

| Option | Description | Selected |
|--------|-------------|----------|
| Remote linked project via --project-id | Reflects deployed reality; no Docker on Windows. | ✓ |
| Local Supabase via --local | Faster, offline; requires Docker on Windows = friction. | |
| --db-url against remote DB | Works but requires DB password (sensitive); friction. | |

**User's choice:** Remote linked project via --project-id
**Notes:** Source of truth = remote project. Project ID is non-sensitive (visible in URL).

### Q4 — Where does the project ID live so the CLI commands can find it?

| Option | Description | Selected |
|--------|-------------|----------|
| config.toml + .env.local | `npx supabase init` creates committed `config.toml`; ref also in `.env.local` as `EXPO_PUBLIC_SUPABASE_PROJECT_ID` for npm scripts. Both non-sensitive. | ✓ |
| config.toml only | Simpler but npm script needs to parse TOML or call `supabase status`. | |
| Hardcoded in npm script | Simplest; project ref isn't a secret. Slight cost: now in two places. | |

**User's choice:** config.toml + .env.local
**Notes:** Both files are non-sensitive. config.toml is canonical for CLI; `.env.local` is read by npm scripts.

---

## RLS verification

### Q1 — What format does the cross-user RLS test take?

| Option | Description | Selected |
|--------|-------------|----------|
| Node/TS script with two real signed-in clients | `app/scripts/test-rls.ts` using @supabase/supabase-js. Closest to runtime. Runnable as `npm run test:rls`. | ✓ |
| pgTAP-style SQL fixture | Pure SQL with role machinery. Faster but skips PostgREST/JWT layer where bugs hide. | |
| Manual + screenshot proof | One-time check, not re-runnable on every migration. | |

**User's choice:** Node/TS script with two real signed-in clients
**Notes:** Same client lib the app uses. Re-runnable on every migration.

### Q2 — Which Supabase project does the RLS test run against?

| Option | Description | Selected |
|--------|-------------|----------|
| Same dev project, dedicated test users | Two test users created idempotently; cleanup before + after run. Pragmatic for solo V1. | ✓ |
| Separate Supabase test project | Total isolation. Overkill for personal V1; extra project to maintain. | |
| Local Supabase via Docker | Best isolation but Windows + Docker friction; conflicts with type-gen choice. | |

**User's choice:** Same dev project, dedicated test users
**Notes:** Test rows namespaced (`rls-test-%`) and cleaned up at start + end of every run.

### Q3 — How are the two test users seeded?

| Option | Description | Selected |
|--------|-------------|----------|
| Service-role admin API in a Node-only script | Reads `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`; uses `supabase.auth.admin.createUser` with `email_confirm: true`. Service-role stays Node-side per PITFALLS 2.3. | ✓ |
| Sign-up flow + pre-confirmed users | Hit `signUp` with anon key, mark email_confirmed in Studio one-time. Manual confirm step is brittle. | |
| Pre-existing users — manual | User creates 2 test accounts manually in Studio. Off-loads seed work to humans. | |

**User's choice:** Service-role admin API in a Node-only script
**Notes:** Service-role key strictly Node-side; never imported by anything under `app/lib/` or `app/app/`.

### Q4 — What table coverage does the cross-user test assert?

| Option | Description | Selected |
|--------|-------------|----------|
| All 5 user-scoped tables | profiles, exercises, workout_plans, plan_exercises (via parent), workout_sessions, exercise_sets (via parent). Covers both top-level and nested policy shapes; catches the exact PITFALLS 2.5 errata. | ✓ |
| Just parent tables (plans + sessions) | Smaller surface; misses the case where the `plan_exercises`/`exercise_sets` policy itself is wrong. | |
| Smoke check only — one table | Cheap but doesn't actually verify the errata-fix. | |

**User's choice:** All 5 user-scoped tables
**Notes:** The plan_exercises and exercise_sets cases — exactly the PITFALLS 2.5 errata — must explicitly test that User A cannot insert a child row pointing at User B's parent.

---

## set_type enum + is_warmup

### Q1 — What shape does the F17 `set_type` column take in Postgres?

| Option | Description | Selected |
|--------|-------------|----------|
| CREATE TYPE … AS ENUM | `CREATE TYPE set_type AS ENUM (...)` then column. Generated TS = string-literal union; type-safe end-to-end. Adding values requires migration (fine for closed enum). | ✓ |
| text + CHECK constraint | More flexible. Generated TS is just `string`, losing union narrowing. Loses F17 'closed set' invariant in type system. | |
| smallint with mapping table | Most flexible/i18n-friendly. Massive overkill for 4 closed values. | |

**User's choice:** CREATE TYPE … AS ENUM
**Notes:** F17 ships as schema-only — UI deferred to V1.1.

### Q2 — `is_warmup` fate

| Option | Description | Selected |
|--------|-------------|----------|
| Drop is_warmup; set_type is the only source | DB has no data; migration is free (PROJECT.md). Single source of truth. ARCHITECTURE.md §5 queries refactor cleanly. | ✓ |
| Keep both — is_warmup stays as a derived shortcut | Dual-write or generated column. Adds wiring without enabling anything new. | |
| Keep is_warmup, defer set_type to Phase 5 or V1.1 | Contradicts ROADMAP success criterion #4 and PROJECT.md F17. | |

**User's choice:** Drop is_warmup; set_type is the only source
**Notes:** Rationale = "Schema-migration är gratis innan data finns, dyr efter." Per PROJECT.md.

### Q3 — Canonical query filter for F7 / F10

| Option | Description | Selected |
|--------|-------------|----------|
| `set_type = 'working'` only | F7 'senaste värdet' = senaste arbets-set; dropset/failure muddy F7's display. Strictest invariant. | ✓ |
| `set_type IN ('working','dropset','failure')` (everything except warmup) | Broader; matches some users' "real attempt" mental model but a dropset display can mislead. | |
| Defer the filter rewrite to Phase 5 | Phase 2 just lays the schema; ARCHITECTURE.md §5 stays as guidance. | |

**User's choice:** `set_type = 'working'` only
**Notes:** Working sets are canonical "what I lifted" — dropset/failure are followup data points.

### Q4 — Doc sync (update ARCHITECTURE.md or keep historical)

| Option | Description | Selected |
|--------|-------------|----------|
| Update ARCHITECTURE.md as part of Phase 2 | Edit §4 + §5 to match deployed reality. ARCHITECTURE.md is the canonical decision register downstream phases read. | ✓ |
| Leave ARCHITECTURE.md as historical; rely on migration files | Migration becomes new source of truth; ARCHITECTURE.md stays original with header note. Two sources of truth. | |
| You decide | Pick whichever has lower friction during execution. | |

**User's choice:** Update ARCHITECTURE.md as part of Phase 2
**Notes:** STATE.md errata note flips to "fixed". Doc + code stay in sync.

---

## Profiles row trigger

### Q1 — Where does the trigger live?

| Option | Description | Selected |
|--------|-------------|----------|
| Include in Phase 2 | Trigger is schema-shaped (DB function + DB trigger), Phase 2's domain. Without it, RLS test would have to manually paper-insert profile rows. RLS policy on profiles has something to filter against from day 1. | ✓ |
| Defer to Phase 3 | Tightly bounds Phase 2 but splits 'all schema in Phase 2' into 'most schema in Phase 2'. | |
| Skip the trigger — client inserts profile on first signup | Avoids trigger entirely. Race conditions if signUp succeeds but profile insert fails. | |

**User's choice:** Include in Phase 2
**Notes:** Trigger lives alongside the rest of the schema in 0001_initial_schema.sql.

### Q2 — Trigger body

| Option | Description | Selected |
|--------|-------------|----------|
| Just `id` | Smallest possible trigger. display_name stays NULL until user edits via Settings (V1.1+). preferred_unit uses column default 'kg'. | ✓ |
| id + display_name from email | Derive from email local-part. Most users don't want their email-prefix as display name. | |
| id + display_name from raw_user_meta_data | Read from `NEW.raw_user_meta_data->>'display_name'`. Cleanest UX but couples Phase 2 trigger to a Phase 3 contract. | |

**User's choice:** Just `id`
**Notes:** Smallest possible trigger; minimum coupling to Phase 3.

### Q3 — Trigger security model

| Option | Description | Selected |
|--------|-------------|----------|
| SECURITY DEFINER + `SET search_path = ''` | Standard Supabase pattern. Empty search_path forces fully-qualified names; defends against search-path injection. | ✓ |
| SECURITY DEFINER without search_path lockdown | Same minus the lockdown. Slightly increased attack surface. | |
| SECURITY INVOKER (default) | Runs as inserting role (`supabase_auth_admin`); requires explicit grants on `public.profiles`. More fiddly. | |

**User's choice:** SECURITY DEFINER + `SET search_path = ''`
**Notes:** Per Supabase's official guidance for trigger functions on auth.users.

---

## Claude's Discretion

- Exact string format of test-user emails (`rls-test-a@fitnessmaxxing.local` vs similar) — namespaced and consistent.
- Exact assertion-output format in `test-rls.ts` (table-shape vs flat lines) — readable in terminal is the only requirement.
- Exact wording / placement of the "Database conventions" sub-section (CLAUDE.md vs PROJECT.md vs both).
- Migration file header comment block summarizing what it deploys + linking to ARCHITECTURE.md §4 — recommended, exact wording is Claude's.
- Whether to add idempotency safeguards (`if exists` / `if not exists`) inside the migration.
- Whether `test-rls.ts` runs in TS via `tsx`/`ts-node` or transpiles to JS first — pick whichever stays out of the Expo bundler's way.

## Deferred Ideas

- Zod schemas mirroring tables — Phase 4+ (per-feature).
- F18 PR-detection schema — V1.1.
- F19 vilo-timer (no schema change) — V1.1.
- `preferred_unit` UI / Settings — V2 (PRD Out of Scope; Sverige-only V1 = kg).
- Supabase Database Advisors lint as a CI gate — V1.1+.
- Local Supabase Docker stack — re-evaluate at V2.
- Separate test Supabase project — re-evaluate at V1.1 / V2.
- pgTAP migration tests — reconsider if test count grows past ~20 cases.
- `set_type` enum value additions ('amrap', 'cluster', etc.) — V1.1+ if pattern emerges.
- Composite unique constraints (e.g., `UNIQUE(session_id, set_number)`) — re-evaluate in Phase 5.
