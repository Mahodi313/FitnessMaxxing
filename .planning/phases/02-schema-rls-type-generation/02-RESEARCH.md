# Phase 2: Schema, RLS & Type Generation - Research

**Researched:** 2026-05-08
**Domain:** Supabase CLI workflow, PostgreSQL RLS authoring, TypeScript type generation, Node-side service-role isolation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Migration tooling & workflow**
- **D-01:** Use the Supabase CLI as the schema source of truth (`npx supabase init` → migration files in `app/supabase/migrations/` → `supabase db push`). Studio is read-only from Phase 2 forward — every schema change ships as a SQL file. Per PITFALLS 4.2.
- **D-02:** Initial schema lands as a single file: `app/supabase/migrations/0001_initial_schema.sql`. Future deltas (F18+, V1.1, V2) become numbered follow-up files. The "initial schema" is one atomic commit.
- **D-03:** Bind the repo to the existing Supabase project via `npx supabase link --project-ref <ref>`. The committed `app/supabase/config.toml` carries the project ref (non-sensitive — also visible in the Supabase URL). The same ref is duplicated into `app/.env.local` as `EXPO_PUBLIC_SUPABASE_PROJECT_ID` so npm scripts can read it without parsing TOML.
- **D-04:** `npm run gen:types` runs `npx supabase gen types typescript --project-id $EXPO_PUBLIC_SUPABASE_PROJECT_ID > app/types/database.ts` against the **remote** linked project. No local Docker stack required (deliberate — Windows dev). The generated `app/types/database.ts` is committed; CI/regressions catch drift.
- **D-05:** `app/lib/supabase.ts` swaps `createClient(...)` → `createClient<Database>(...)` once `app/types/database.ts` exists. This is the only client-side type-pipeline change in Phase 2.

**RLS verification**
- **D-06:** Cross-user RLS test ships as `app/scripts/test-rls.ts` — a **Node-only** TypeScript script (run via `npx tsx` or similar), NOT bundled into the Expo app. Uses the same `@supabase/supabase-js` client the app uses. Surfaced as `npm run test:rls`.
- **D-07:** The script reads `SUPABASE_SERVICE_ROLE_KEY` from `app/.env.local` (gitignored, dev-only) and uses `supabase.auth.admin.createUser({email, password, email_confirm: true})` to seed two test users idempotently (`rls-test-a@fitnessmaxxing.local` / `rls-test-b@fitnessmaxxing.local` or similar). The service-role key NEVER appears in any file under `app/lib/`, `app/app/`, or any other bundled path — enforced by `git grep "SERVICE_ROLE"` audit per PITFALLS 2.3.
- **D-08:** Tests run against the **same dev Supabase project** (no separate test project, no Docker). Test rows are namespaced (`name LIKE 'rls-test-%'`) and cleaned up at the start AND end of every run. Pragmatic for solo V1 budget = $0.
- **D-09:** Coverage = all 5 user-scoped tables: `profiles`, `exercises`, `workout_plans`, `plan_exercises` (via `workout_plans` parent check), `workout_sessions`, `exercise_sets` (via `workout_sessions` parent check). For each table, the script asserts as User A: (a) cannot SELECT User B's rows, (b) cannot INSERT a row owned by User B, (c) cannot UPDATE User B's rows, (d) cannot DELETE User B's rows. The `plan_exercises` and `exercise_sets` cases — exactly the PITFALLS 2.5 errata — must explicitly test that User A cannot insert a child row pointing at User B's parent.
- **D-10:** Test reports failures by exit code (0 = pass, 1 = any assertion failed) plus a per-assertion log line. No fancy framework — `console.assert`-style output is enough for a personal script.

**set_type enum + is_warmup**
- **D-11:** `set_type` is implemented as a Postgres ENUM type, not a CHECK constraint. SQL: `CREATE TYPE set_type AS ENUM ('working','warmup','dropset','failure');` then `set_type set_type NOT NULL DEFAULT 'working'` on `exercise_sets`. F17 ships as schema-only — no UI in V1.
- **D-12:** `is_warmup boolean default false` is **dropped** from `exercise_sets`. `set_type = 'warmup'` becomes the single source of truth. No dual-write, no generated column, no compatibility shim.
- **D-13:** ARCHITECTURE.md §5 queries (F7, F10) are rewritten in Phase 2's doc-update step to filter `set_type = 'working'`. Working sets are the canonical "what I lifted" — dropsets and failure sets are excluded from F7's last-value display.
- **D-14:** Phase 2 includes an edit pass on `ARCHITECTURE.md §4` and `§5` so the canonical decision register matches deployed reality. The errata note in `STATE.md` flips to "fixed".

**Profiles row trigger**
- **D-15:** The `handle_new_user` trigger ships in the same `0001_initial_schema.sql` migration file. Phase 2 owns it because it's schema-shaped (DB function + DB trigger), not Phase 3 client-side flow.
- **D-16:** Trigger body inserts only `id`: `INSERT INTO public.profiles (id) VALUES (NEW.id);`. `display_name` stays NULL until the user edits it (Settings UI is V1.1).
- **D-17:** Trigger function uses `SECURITY DEFINER` with `SET search_path = ''` per Supabase's official guidance, and references all objects with fully-qualified names (`public.profiles`).

**Migration-as-truth convention**
- **D-18:** Add a brief "Database conventions" sub-section to either `CLAUDE.md ## Conventions` or `PROJECT.md ## Constraints` capturing the migration-as-truth rules.

### Claude's Discretion

- Exact string format of test-user emails (e.g., `rls-test-a@fitnessmaxxing.local` vs `rls-a@test.fitnessmaxxing.local`) — pick something consistent and namespaced.
- Exact assertion-output format in `test-rls.ts` (table-shape vs flat lines).
- Exact wording / placement of the "Database conventions" sub-section (CLAUDE.md vs PROJECT.md vs both).
- Whether to add a header comment block to `0001_initial_schema.sql` summarizing the deploy contents.
- Whether to add idempotency safeguards (`if exists` / `if not exists`) inside the migration.
- Whether `test-rls.ts` runs in TS via `tsx`/`ts-node` or transpiles to JS first — pick whichever stays out of the Expo bundler's way.

### Deferred Ideas (OUT OF SCOPE)

- Zod schemas mirroring tables (`app/lib/schemas/*.ts`) — Phase 4+
- F18 PR-detection schema — V1.1
- F19 vilo-timer (no schema change) — V1.1
- `preferred_unit` UI / setting — V2
- Supabase Database Advisors lint as a CI gate — V1.1+
- Local Supabase Docker stack (`supabase start`) — V2 if needed
- Separate test Supabase project — V1.1 / V2
- pgTAP migration tests — V1.1+ if test count grows
- `set_type` enum value additions (`amrap`, `cluster`) — V1.1+
- Composite unique constraints (`UNIQUE(session_id, set_number)`) — Phase 5 if needed

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| F17 | Set-typ-kolumn i `exercise_sets` (working/warmup/dropset/failure). V1 levererar enum-kolumn med default 'working'. UI deferred till V1.1. | Schema design covered in §"Standard Stack" + §"Code Examples" → ENUM creation pattern; dropping `is_warmup` is verified safe because no production data exists. F17 is **schema-only** for Phase 2. |

**Phase architectural success criteria (from ROADMAP.md):**

| # | Criterion | Research Support |
|---|-----------|------------------|
| 1 | All 6 tables exist in Supabase with RLS enabled. | §"Code Examples" → Migration template with `enable row level security` on every table. |
| 2 | RLS policies have BOTH `using` AND `with check` on writable tables; every `auth.uid()` is wrapped as `(select auth.uid())`. | §"Common Pitfalls" 2.5 (errata fix) + 4.1 (perf wrap). §"Code Examples" shows the corrected SQL. |
| 3 | Cross-user fixture test proves User B cannot read or write User A's data (SELECT and INSERT/UPDATE blocked). | §"Validation Architecture" → REQ-RLS-01..05 maps each user-scoped table to an assertion in `test-rls.ts`. |
| 4 | `exercise_sets` has `set_type` ENUM column (working/warmup/dropset/failure) default 'working'. | §"Code Examples" → ENUM type + column SQL. F17 schema-only. |
| 5 | `npm run gen:types` produces `app/types/database.ts` matching the applied schema; TS compiles cleanly. | §"Standard Stack" → CLI version + flag. §"Code Examples" → npm script form. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

These directives are extracted from `CLAUDE.md` and treated with the same authority as locked decisions. The planner must verify every task respects them:

1. **Tech stack lock** — Expo + Supabase + TypeScript pinned in ARCHITECTURE.md decision register; cannot be swapped without explicit revision. Phase 2 adds zero new runtime stack.
2. **Data integrity** — "Får ALDRIG förlora ett loggat set." Phase 2 does not log sets, but the schema decisions made now (idempotent UUID PKs, FK-cascade rules, `set_type` enum) are the foundation that data-integrity later relies on. Migration must preserve `gen_random_uuid()` defaults and the existing FK-cascade rules in ARCHITECTURE.md §4 verbatim (PITFALLS 4.4).
3. **RLS obligatorisk på alla tabeller** — Every new table in Phase 2 ships with `enable row level security` AND at least one policy in the same migration file. PITFALLS 2.1 + 2.2.
4. **Service-role-key används ALDRIG i klient** — `SUPABASE_SERVICE_ROLE_KEY` must never appear in any file under `app/lib/`, `app/app/`, or any path bundled by Metro. PITFALLS 2.3.
5. **Secrets aldrig hårdkodade** — `app/scripts/test-rls.ts` reads from `process.env`, never inline. Same runtime-guard pattern as `app/lib/supabase.ts`.
6. **Sessions: expo-secure-store** — Not relevant to Phase 2 (no auth flow), but `app/lib/supabase.ts`'s LargeSecureStore wrapper must remain unchanged when adding `<Database>` type parameter.
7. **Validering: Zod för all extern data** — Out of scope for Phase 2 per CONTEXT.md (`lib/schemas/*.ts` → Phase 4+). Generated TS types are sufficient for Phase 2's "type the client" goal.
8. **iOS-only V1** — No iOS-specific work in Phase 2; database is platform-agnostic.
9. **Phase 1 Conventions block** — Navigation header / status bar conventions are not affected by Phase 2.

## Summary

Phase 2 is a **CLI-and-SQL phase**, not an app-code phase. Three workflows must be wired correctly: (1) the Supabase CLI workflow that turns a SQL file into deployed schema with RLS verified; (2) the type-generation pipeline that turns the deployed schema into `app/types/database.ts`; (3) the cross-user RLS proof that runs Node-only with the service-role key strictly isolated from the Expo bundle.

The single highest-risk surface is RLS-policy correctness — specifically the `with check` errata on the two child-table policies (`plan_exercises`, `exercise_sets`) and the perf-critical `(select auth.uid())` wrap. Both are in PITFALLS.md but easy to forget when transcribing schema. The Phase 2 cross-user test exists primarily to *prove* these are correct, not to test the obvious cases.

The second-highest-risk surface is service-role-key isolation. Node v24 ships built-in `--env-file=` support, and `tsx` forwards Node flags, so `node --env-file=.env.local --import tsx ...` (or simply `tsx --env-file=.env.local ...`) gives the cleanest path: the script reads the key from `process.env`, the key never lives in any module that Metro can resolve, and a `git grep` audit can guarantee zero leakage. No `dotenv` package is needed. [VERIFIED: `node --env-file=...` flag confirmed in `node --help` output v24.14.1; tsx 4.21 forwards Node flags per README]

The third surface is **Supabase CLI authentication for type generation against a remote project**. `supabase gen types typescript --project-id <ref>` requires `SUPABASE_ACCESS_TOKEN` (or a prior `supabase login`) — this is a personal access token, distinct from anon-key and service-role-key, and lives in your Supabase account settings. The planner must include a step (or doc note) for the user to obtain this and either run `supabase login` once or set `SUPABASE_ACCESS_TOKEN` in `app/.env.local` so `npm run gen:types` works without interactive prompts. [CITED: docs.supabase.com/cli/local-development#access-token]

**Primary recommendation:** Structure the plan as five sequential waves: (1) CLI bootstrap (`supabase init` + `supabase link`); (2) author migration SQL with header + ENUM + 6 tables + RLS + trigger; (3) `db push` + Studio sanity check; (4) gen:types pipeline + typed client + remove `phase1ConnectTest`; (5) `test-rls.ts` + npm script + green run + doc updates. Waves 2 and 5 are the load-bearing ones — wave 5 is the only thing that *proves* wave 2 was correct.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema definition (tables, ENUMs, indexes, FKs) | Database / Storage | — | DDL lives in PostgreSQL; migration file is the source of truth. |
| Row-level access control (RLS policies) | Database / Storage | — | RLS is enforced server-side in PostgREST; client cannot bypass. PITFALLS 2.3 hard-rule. |
| New-user → profile-row trigger | Database / Storage | — | `auth.users` insert event is server-side; trigger runs in Postgres with `SECURITY DEFINER`. Putting this client-side (in Phase 3 sign-up flow) would make it skippable + duplicate-prone. |
| Migration application (db push) | CLI / DevOps | — | Runs from developer machine against linked remote project. No app code involved. |
| TypeScript type generation | CLI / DevOps | Frontend (consumed) | Generated by CLI from remote schema; consumed in `app/lib/supabase.ts` via `createClient<Database>`. |
| Cross-user RLS verification | Node-side script | — | Service-role-key requirement forces Node-only execution. NEVER bundled. PITFALLS 2.3. |
| Typed Supabase client | Frontend / Client | — | `createClient<Database>(...)` lives in `app/lib/supabase.ts`. Only client-side change in Phase 2. |
| Doc updates (ARCHITECTURE.md §4/§5, STATE.md, conventions) | Repo / Docs | — | Documentation tier; not runtime. Phase 2 keeps decision register in sync with deployed reality. |

## Standard Stack

### Core (already installed; Phase 2 adds zero new runtime deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.105.4` (installed) | Supabase client used by both `app/lib/supabase.ts` and `app/scripts/test-rls.ts` | Already pinned by Phase 1; same client serves anon-key (app) and service-role-key (Node script) just by varying the second `createClient` argument. [VERIFIED: package.json line 22] |

### CLI tooling (invoked via `npx`, no install needed)

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Supabase CLI | `npx supabase@latest` (let npx resolve) | Migration management, type generation, link to remote project | Official Supabase CLI is the only sanctioned path for migration-as-truth (D-01, PITFALLS 4.2). [VERIFIED: Context7 `/supabase/cli`, source reputation HIGH] |

### Dev dependencies (Phase 2 adds one)

| Library | Version | Install command | Purpose | Why |
|---------|---------|-----------------|---------|-----|
| `tsx` | `^4.21.0` | `npm install --save-dev tsx` (run from `app/`) | Run `app/scripts/test-rls.ts` directly without a build step | tsx is the most maintained TS-runner; pure Node + esbuild, no native deps, no project-config munging. Ships with built-in support for forwarding Node CLI flags including `--env-file=`. Engines `node >=18.0.0` (we have v24). [VERIFIED: `npm view tsx` 2026-05-08] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tsx` | `ts-node` | ts-node is heavier (uses `typescript` directly, slower startup) and has a long-known ESM-interop gotcha that bites when importing `@supabase/supabase-js` 2.x (which ships ESM). tsx sidesteps this with esbuild. |
| `tsx` | Pre-compile to JS via `tsc`, run with `node` | Adds a build step + a JS artifact in repo. tsx removes that ceremony for one-off scripts. |
| `tsx` + `--env-file=.env.local` (Node v24 native) | `dotenv` package | `dotenv` adds a dep + an `import 'dotenv/config'` line. Node v24's native `--env-file=` flag does the same thing with zero install. [VERIFIED: `node --help` shows `--env-file=...` flag] |
| `npx supabase` per command | `npm install --save-dev supabase` | Pinning the CLI version in `package.json` would be more reproducible, but the CLI is large (a Go binary downloaded per platform) and rev'd frequently. `npx supabase@latest` keeps the repo lighter. Document the CLI version actually used in the migration commit message for traceability. |
| `supabase migration new ...` (CLI-generated timestamp prefix) | Hand-written `0001_initial_schema.sql` | Per D-02, hand-written `0001_*.sql`. Verified safe: the CLI's migration regex is `^([0-9]+)_(.*)\.sql$` — accepts any numeric prefix. `0001` sorts before any future timestamp-prefixed file (because timestamps are `YYYYMMDDHHmmss`, all start with `2`). [VERIFIED: github.com/supabase/cli `pkg/migration/file.go`]. Watch-out: future migrations created via `supabase migration new` will get timestamp prefixes; mixing the two styles is fine but visually inconsistent. |

**Installation (run from `app/` cwd):**
```bash
npm install --save-dev tsx
```

**Version verification (run from `app/` before authoring tasks):**
```bash
npm view tsx version          # expect ^4.21.x — verified 4.21.0 on 2026-05-08
npx supabase --version        # downloads and prints the CLI version actually used
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Developer Machine (Windows)                    │
│                                                                      │
│  ┌──────────────────────────┐      ┌──────────────────────────────┐ │
│  │ app/supabase/            │      │ app/scripts/test-rls.ts      │ │
│  │   config.toml            │      │   (Node + tsx)               │ │
│  │   migrations/            │      │   reads SUPABASE_*_KEY from  │ │
│  │     0001_initial_*.sql   │      │   process.env (--env-file)   │ │
│  └────────────┬─────────────┘      └──────────────┬───────────────┘ │
│               │                                    │                  │
│               │ npx supabase db push               │ supabase-js      │
│               │ (uses pg DB password,              │ admin.createUser │
│               │ NOT service-role)                  │ + anon-key auth  │
│               │                                    │                  │
│               ▼                                    ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ Supabase REMOTE project (linked via project-ref)              │    │
│  │                                                                │    │
│  │   PostgreSQL: 6 tables + 1 ENUM + RLS policies + trigger      │    │
│  │   PostgREST:  RLS enforcement + REST API                       │    │
│  │   Auth:       JWT issuance + auth.users                        │    │
│  └──────────────────────────────────────────────────────────────┘    │
│               │                                                        │
│               │ npx supabase gen types typescript --project-id         │
│               │ (uses SUPABASE_ACCESS_TOKEN, NOT service-role)         │
│               ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ app/types/database.ts  (committed, regenerated per migration) │    │
│  └──────────────────────────────────────────────────────────────┘    │
│               │                                                        │
│               │ import type { Database }                               │
│               ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ app/lib/supabase.ts                                           │    │
│  │   createClient<Database>(supabaseUrl, supabaseAnonKey, {...}) │    │
│  │   ↑ ONLY change in Phase 2 client side                        │    │
│  │   ✗ phase1ConnectTest() and its useEffect call REMOVED        │    │
│  └──────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**Three credential boundaries — never crossed:**
1. **Anon key** (`EXPO_PUBLIC_SUPABASE_ANON_KEY`) → Expo bundle, RLS-restricted, public per design
2. **Service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) → Node only, in `app/scripts/`, RLS-bypass
3. **Personal access token** (`SUPABASE_ACCESS_TOKEN` or `supabase login`) → CLI only, never in code

### Recommended Project Structure

After Phase 2:
```
app/
├── supabase/                              # NEW — CLI artifacts
│   ├── config.toml                        # committed; carries project_id (non-sensitive)
│   ├── migrations/
│   │   └── 0001_initial_schema.sql        # the one Phase 2 ships
│   └── .gitignore                         # CLI-generated; verify what it lists
├── scripts/                               # NEW — Node-only scripts
│   └── test-rls.ts                        # service-role-key consumer
├── types/                                 # NEW — generated artifacts
│   └── database.ts                        # committed; regenerated per migration
├── lib/
│   └── supabase.ts                        # MODIFIED: createClient<Database>, no phase1ConnectTest
├── app/
│   └── _layout.tsx                        # MODIFIED: useEffect for phase1ConnectTest removed
├── .env.local                             # MODIFIED: + 2 new keys (gitignored)
├── .env.example                           # MODIFIED: + 2 new placeholder lines
└── package.json                           # MODIFIED: + gen:types + test:rls scripts; + tsx devDep
```

### Pattern 1: Migration-as-Truth Workflow

**What:** The migration SQL file in `app/supabase/migrations/` is the canonical schema. Studio is read-only.

**When to use:** Every schema change Phase 2 onwards. Studio edits are forbidden.

**Example:**
```bash
# From app/ cwd, one-time bootstrap
cd app
npx supabase init                                   # creates supabase/ with config.toml
npx supabase link --project-ref <ref> -p <db-pwd>   # binds to remote; -p avoids prompt

# Author 0001_initial_schema.sql by hand (D-02 — not via `migration new`)

# Apply
npx supabase db push --yes                          # --yes suppresses confirmation prompt
# ...later, after schema changes:
echo "ALTER TABLE foo ..." > supabase/migrations/0002_*.sql
npx supabase db push --yes
```

[VERIFIED: Context7 `/supabase/cli`, `--yes` is global flag answering yes to all prompts; `db push` interactive confirm flag confirmed via Go source `cli/internal/db/push/push.go`]

### Pattern 2: Service-Role-Key Isolation via Node `--env-file`

**What:** Node v24's built-in `--env-file=` flag loads env vars from a file *into the Node process only*. tsx forwards Node flags. Result: service-role key reaches the script via `process.env` without any runtime import path that Metro could ever resolve.

**When to use:** Every Node-side script that needs a secret. Phase 2 has exactly one — `app/scripts/test-rls.ts`.

**Example:**
```jsonc
// app/package.json scripts (run from app/ cwd)
{
  "scripts": {
    "test:rls": "tsx --env-file=.env.local scripts/test-rls.ts"
  }
}
```

```typescript
// app/scripts/test-rls.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error('Missing env. Need SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY in app/.env.local');
}

// Same supabase-js library Metro bundles, but constructed Node-side with admin privileges:
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
// ...
```

[VERIFIED: `node --help` v24.14.1 lists `--env-file=...` flag; tsx README confirms Node CLI flags are forwarded; CITED: docs.supabase.com `auth.admin` requires service-role key]

### Pattern 3: Two-User Cross-Verification Test

**What:** Seed two users via service-role admin API. Get authenticated **anon-key** clients for each user (via `signInWithPassword`). Try the four CRUD operations as User A against User B's rows. Assert all are blocked.

**When to use:** Phase 2 success criterion #3, and any future schema phase that adds user-scoped tables.

**Example pattern:**
```typescript
// app/scripts/test-rls.ts (skeleton — not full)
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// 1. Cleanup: delete any leftover rls-test-* users via admin API + cascade purges public.* rows via FK ON DELETE CASCADE
async function cleanup() {
  const { data } = await admin.auth.admin.listUsers();
  for (const u of data.users.filter((u) => u.email?.includes('rls-test-'))) {
    await admin.auth.admin.deleteUser(u.id);
  }
}

await cleanup();

// 2. Seed
const userA = await admin.auth.admin.createUser({ email: 'rls-test-a@fitnessmaxxing.local', password: 'Test123!Test123!', email_confirm: true });
const userB = await admin.auth.admin.createUser({ email: 'rls-test-b@fitnessmaxxing.local', password: 'Test123!Test123!', email_confirm: true });

// 3. Anon clients per user
const clientA = createClient(url, anonKey, { auth: { persistSession: false } });
await clientA.auth.signInWithPassword({ email: 'rls-test-a@fitnessmaxxing.local', password: 'Test123!Test123!' });
const clientB = createClient(url, anonKey, { auth: { persistSession: false } });
await clientB.auth.signInWithPassword({ email: 'rls-test-b@fitnessmaxxing.local', password: 'Test123!Test123!' });

// 4. Seed B-owned rows via clientB (RLS-enforced — confirms own writes work too)
const { data: planB } = await clientB.from('workout_plans').insert({ name: 'rls-test-b-plan' }).select().single();
// ... seed exercises, plan_exercises, sessions, sets

// 5. As clientA, attempt each blocked operation. RLS-blocked SELECT returns empty array; INSERT/UPDATE/DELETE returns affected: 0 (or 401 for explicit insert with foreign user_id).
const failures: string[] = [];
const select = await clientA.from('workout_plans').select().eq('id', planB.id);
if (select.data && select.data.length > 0) failures.push('A could SELECT B plans');
// ... 19 more assertions

if (failures.length) { console.error(failures); process.exit(1); }
process.exit(0);
```

**Note on PITFALLS 2.5 errata coverage:** the load-bearing assertions are:
- `clientA.from('plan_exercises').insert({ plan_id: planB.id, exercise_id: <A's exercise>, order_index: 0 })` → must be REJECTED (without `with check` errata fix, this would have **succeeded** with the old policy)
- `clientA.from('exercise_sets').insert({ session_id: sessionB.id, exercise_id: <A's exercise>, set_number: 1, reps: 5, weight_kg: 100 })` → must be REJECTED (same errata)

[CITED: Context7 `/supabase/supabase-js` `auth.admin.createUser`]

### Pattern 4: `handle_new_user` Trigger (Supabase Canonical Form)

**What:** A PL/pgSQL function with `SECURITY DEFINER` and an empty `search_path`, plus an `AFTER INSERT` trigger on `auth.users`, ensures every new auth user gets a corresponding `public.profiles` row.

**When to use:** Phase 2 — schema-shape concern. Without it, the cross-user test would have to manually paper-insert profiles rows.

**Example (verbatim from Supabase docs, adapted to D-16 minimal body):**
```sql
-- The function: SECURITY DEFINER lets it bypass RLS to insert into public.profiles;
--               SET search_path = '' forces fully-qualified names everywhere, defending
--               against search-path injection (PG-specific privilege-escalation vector).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

-- The trigger: fires after every auth.users insert (sign-up, admin createUser, etc.)
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

[CITED: supabase.com/docs/guides/auth/managing-user-data — exact pattern with `SECURITY DEFINER set search_path = ''` and fully-qualified `public.profiles`]

### Anti-Patterns to Avoid

- **Generating types against a local Docker stack we don't run.** D-04 says remote-only. Don't add `--local` to the gen:types script — it requires `supabase start` Docker which we explicitly avoid.
- **`supabase db reset`** — destructive on remote. Never use against the dev project. (`db reset` is local-only by design, but a confused operator could supply `--linked`. Don't.)
- **Putting `SUPABASE_SERVICE_ROLE_KEY` in `EXPO_PUBLIC_*` namespace.** Metro bundles every `EXPO_PUBLIC_*` var into the JS bundle. PITFALLS 2.3 — root cause of the most-common Supabase data leak.
- **Trigger function without `SET search_path = ''`.** Allows a malicious unprivileged user to create `pg_temp.profiles` and have the SECURITY DEFINER trigger insert into it instead. [CITED: supabase.com docs warn explicitly]
- **`for all using (...)` without `with check (...)` on writable tables.** PITFALLS 2.5 — the exact errata Phase 2 fixes. Easy to forget when transcribing schema.
- **Editing `app/types/database.ts` by hand.** Generated artifact; hand-edits get clobbered next `gen:types` run. If a generated type is wrong, fix the schema and regenerate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading env vars in Node script | `dotenv` package + `import 'dotenv/config'` | Node v24 `--env-file=.env.local` flag (forwarded by tsx) | Built-in to Node ≥20, zero deps. [VERIFIED: `node --help`] |
| TypeScript types for Supabase responses | Hand-typed `interface Plan { ... }` | `npx supabase gen types typescript --project-id ...` → `app/types/database.ts` | Single source of truth = the deployed schema. Hand-typed drifts. PITFALLS 3.5. |
| User creation for tests | Manual SQL `INSERT INTO auth.users` | `supabase.auth.admin.createUser({ email_confirm: true })` | Direct INSERT skips Supabase auth-internal triggers (password hashing, audit log, identity table). admin API does it correctly. [CITED: Context7 `/supabase/supabase-js`] |
| User cleanup between test runs | `DELETE FROM auth.users WHERE ...` | `supabase.auth.admin.deleteUser(id)` for each | Same reason — admin API handles cascading cleanup of `auth.identities` and triggers FK cascades on `public.profiles`, `workout_plans`, etc. |
| RLS query plan caching | Custom session-level Postgres setting | Wrap every `auth.uid()` as `(select auth.uid())` in policies | Sole responsibility of the policy author. Costs nothing, pays off forever. PITFALLS 4.1. |
| Migration ordering | Sequential numeric prefixes you maintain by hand | CLI's regex accepts any numeric prefix; D-02 chooses `0001`, `0002`, ... by convention | The CLI doesn't care; humans care about readability. Decide once, document, move on. |
| `profiles` row creation on sign-up | Client-side `await supabase.from('profiles').insert(...)` after `signUp()` | DB trigger `handle_new_user` (D-15) | Trigger runs server-side, atomic with auth.users insert, can't be bypassed by buggy client code or by admin.createUser bypassing the client flow entirely. |

**Key insight:** The Supabase CLI does most of Phase 2's heavy lifting. The phase fails when developers hand-roll around it (Studio edits, manual user inserts, manual type interfaces). Stay on the CLI happy path; Phase 2 becomes mostly transcription.

## Runtime State Inventory

This is a schema-first phase, but it touches multiple systems beyond the migration SQL. Each category below is answered explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — Phase 1 only created a fictional `_phase1_smoke` table reference; the real database has no rows in any user tables yet (no users have ever signed up). The migration is "free" per CONTEXT.md domain note. | None. `is_warmup` column drop is safe because no production data exists. Document this in the migration header for V1.1+ readers. |
| **Live service config** | Supabase project Studio settings, RLS policy state in `pg_policies`, trigger state in `pg_trigger` — all are about to be set BY this phase, so "current state" is "empty / RLS unset on any new table". The Phase 1 connect-test referenced a non-existent table; that path is gone after `phase1ConnectTest` is removed. | (1) Verify in Studio after `db push` that RLS shows ENABLED on all 6 tables (PITFALLS 2.1 sanity check). (2) Verify the `0013_rls_disabled_in_public` Database Advisor advisor returns clean — manual one-time check, not a CI gate (out of scope per CONTEXT.md deferred). |
| **OS-registered state** | None. No Windows Task Scheduler, launchd, pm2, or systemd entries reference this project. | None. |
| **Secrets/env vars** | `app/.env.local` already holds `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Phase 1 D-07). Phase 2 adds two new keys: `SUPABASE_SERVICE_ROLE_KEY` (Node-only secret) and `EXPO_PUBLIC_SUPABASE_PROJECT_ID` (non-sensitive, used by `gen:types`). The user must also obtain `SUPABASE_ACCESS_TOKEN` (personal access token, not service-role) for the gen:types CLI invocation; this can either be set as a third `.env.local` line OR stored via `supabase login` (CLI persists to `~/.supabase/access-token`). | Plan must include: (1) updating `app/.env.example` with placeholder lines for both new keys; (2) explicit user-facing instructions for where to copy the real values from the Supabase dashboard (Project Settings → API for service-role; Project Settings → API → Project ID for the project ref; Account → Access Tokens for the personal access token); (3) decision: prefer `supabase login` (one-time, persistent) over a `SUPABASE_ACCESS_TOKEN` env line (extra secret to manage). Recommend `supabase login`. |
| **Build artifacts / installed packages** | Phase 1 Metro cache may have stale bundles referencing `phase1ConnectTest`. After Phase 2 deletes that export, `npx expo start --clear` is recommended to bust cache. tsx will be installed as a new devDep — no bundler-side impact (it never ships to the device). | (1) Run `npx expo start --clear` once after removing `phase1ConnectTest` to bust Metro cache. (2) Confirm `tsx` install does not pull in unexpected peer deps (tsx has zero peer deps — verified above). |

**Specific watch-out:** `app/supabase/.gitignore` is created by `supabase init` and typically lists `.branches`, `.temp/`, and the seed file's lockfile. Verify what's ignored; the planner should NOT add `config.toml` to gitignore (D-03 — it's committed, project ref is non-sensitive). Also verify `supabase/.env` (if generated) IS gitignored.

## Common Pitfalls

### Pitfall 1: RLS errata — `with check` missing on child-table policies (PITFALLS.md §2.5)

**What goes wrong:** ARCHITECTURE.md §4 in the repo root has policies for `plan_exercises` and `exercise_sets` that use `for all using (exists ...)` *without* `with check`. A user could insert a child row pointing at someone else's parent — silent data leak.

**Why it happens:** RLS clause semantics are non-obvious. `using` filters reads + which rows can be modified; `with check` validates the post-state of inserts/updates. Most Supabase quickstarts only show `using` because their examples are read-heavy.

**How to avoid:** Every `for all` and `for insert`/`for update` policy needs `with check`. The corrected SQL for `plan_exercises`:
```sql
create policy "Users can manage own plan exercises" on plan_exercises
  for all
  using (exists (select 1 from public.workout_plans where id = plan_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_plans where id = plan_id and user_id = (select auth.uid())));
```
Same predicate; both clauses present. The cross-user test (`test-rls.ts`) **must** include the case where User A tries to insert a `plan_exercises` row referencing User B's `workout_plans.id` — that's the exact errata regression check.

**Warning signs:**
- `for all using (...)` with no `with check` line.
- `test-rls.ts` doesn't have an "insert child pointing at foreign parent" assertion.
- A `git grep "for all using"` in the migration finds a policy without a corresponding `with check`.

### Pitfall 2: Raw `auth.uid()` instead of `(select auth.uid())` (PITFALLS.md §4.1)

**What goes wrong:** Naive RLS policies call `auth.uid()` directly. Postgres re-evaluates this per row, defeating query-plan caching and tanking performance once data grows.

**Why it happens:** Standard RLS pattern from older Supabase docs is fine for small-scale; doesn't surface the perf cost early.

**How to avoid:** Wrap **every** `auth.uid()` in `(select auth.uid())` inside policies. Postgres can then cache the result per query rather than per row. The wrap is identical for `using` and `with check`.

**Warning signs:**
- Migration SQL contains `auth.uid()` not preceded by `select`.
- A `grep -E "= auth\.uid\(\)" 0001_initial_schema.sql` finds matches.

### Pitfall 3: Service-role key in EXPO_PUBLIC_* (PITFALLS.md §2.3)

**What goes wrong:** Service-role bypasses RLS. If named `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, Metro bundles it into the JS bundle. Anyone can extract it from a downloaded `.ipa`. Database is publicly read/write.

**Why it happens:** Beginner copies anon-key naming pattern when adding the new key.

**How to avoid:**
- Key name MUST be `SUPABASE_SERVICE_ROLE_KEY` (no `EXPO_PUBLIC_` prefix).
- `app/lib/supabase.ts` reads ONLY `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never `process.env.SUPABASE_SERVICE_ROLE_KEY` from any file under `app/lib/`, `app/app/`, `app/components/`, or any other Metro-bundled path.
- Pre-commit / one-time audit: `git grep -nE "service[_-]?role|SERVICE_ROLE"` should match only `app/scripts/test-rls.ts`, `app/.env.example`, and docs.

**Warning signs:**
- A line in `app/.env.example` or `app/.env.local` starting with `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE`.
- Any file under `app/lib/`, `app/app/`, or `app/components/` referencing `SERVICE_ROLE`.

### Pitfall 4: Studio drift after `db push` (PITFALLS.md §4.2)

**What goes wrong:** Developer applies migration via CLI, then "fixes" something in Studio's table editor. Now the live DB doesn't match `0001_initial_schema.sql`. Type generation will reflect Studio's reality, but `0001_initial_schema.sql` is committed in git as the supposed source of truth — silent inconsistency.

**Why it happens:** Studio is faster for one-offs; the discipline is fragile.

**How to avoid:**
- After `db push`, run `npx supabase db diff` — should output empty. If anything appears, someone edited Studio.
- D-18 codifies "Studio is read-only" as a project rule; PROJECT.md/CLAUDE.md edit makes it durable.
- For Phase 2 specifically: do the Studio sanity check (RLS enabled on all 6 tables) by SELECT against `pg_policies` / `pg_tables` in the SQL editor — read-only.

**Warning signs:**
- `supabase db diff` outputs non-empty.
- Schema differences between `0001_initial_schema.sql` and the live DB.

### Pitfall 5: ENUM drop-and-recreate breaks future migrations

**What goes wrong:** ENUM values can be `ALTER TYPE ... ADD VALUE`-extended cleanly. But removing or renaming an ENUM value requires a multi-step dance (alter columns to text, drop type, recreate, alter back). If V1.1 wants to add a value, fine. If V2 wants to remove `failure`, the migration is much harder.

**Why it happens:** PostgreSQL ENUMs are append-only by design.

**How to avoid:**
- Choose Phase 2's four ENUM values carefully and document the rationale in the migration header. CONTEXT.md D-11 picks `('working','warmup','dropset','failure')` — this is solid for V1's known F17 scope.
- For future additions: just `ALTER TYPE set_type ADD VALUE 'amrap';` — easy.
- For future removals: alternative is to use a CHECK constraint instead of an ENUM. CONTEXT.md D-11 explicitly chose ENUM over CHECK; do not second-guess this in Phase 2.

**Warning signs:** N/A in Phase 2 — this is a "remember for V1.1+" pitfall.

### Pitfall 6: `gen:types` runs before migration is applied

**What goes wrong:** `npm run gen:types` is run while `db push` is still pending or has failed silently. Generated `database.ts` reflects the OLD (or empty) schema. `createClient<Database>` types compile against the wrong shape.

**Why it happens:** No ordering enforcement between scripts.

**How to avoid:**
- The plan must run `db push` → wait for success → THEN `gen:types`. Single sequential wave.
- Gen-types output starts with `// @ts-nocheck` and a `Database` type. After running, verify the output mentions all 6 expected tables; if any missing, the migration didn't apply or the wrong project-id was used.
- Sanity check: `grep -E "(profiles|exercises|workout_plans|plan_exercises|workout_sessions|exercise_sets)" app/types/database.ts | wc -l` should be ≥6.

### Pitfall 7: Trigger function without fully-qualified names

**What goes wrong:** Trigger uses `INSERT INTO profiles (...)` instead of `INSERT INTO public.profiles (...)`. Combined with `SET search_path = ''`, this fails at runtime with "relation 'profiles' does not exist" — but it fails when a user signs up, not at migration time. Discovered only when Phase 3 tries to register the first user.

**Why it happens:** PL/pgSQL convention from non-Supabase contexts often skips the schema prefix.

**How to avoid:** Every object reference in the trigger function body uses the full schema-qualified form: `public.profiles`, `public.workout_plans`, etc. The Supabase canonical pattern in §"Code Examples" uses this form verbatim. [CITED: supabase.com/docs/guides/auth/managing-user-data]

**Warning signs:**
- The trigger function body has bare table names.
- Manually running `SELECT public.handle_new_user()` (impossible, it's a trigger function — but) you can verify by `\df+ public.handle_new_user` in psql showing `search_path` is set.

### Pitfall 8: Service-role test client leaks auth state into anon-key tests

**What goes wrong:** `test-rls.ts` creates one Supabase client globally. Calling `admin.auth.signInWithPassword` to switch personas mutates the client's session storage. Subsequent `from(...)` calls get authorized as a different user than intended; assertions silently pass (or silently fail) for the wrong reason.

**Why it happens:** Single-client convenience.

**How to avoid:**
- Use **three separate `createClient` calls**: one with `serviceKey` (admin), one with `anonKey` for User A, one with `anonKey` for User B. Each in its own variable.
- Each anon client signs in to its own user; never `signOut` + `signInWithPassword` on the same client to switch users.
- `auth: { persistSession: false }` on all three so no on-disk leakage between runs.

**Warning signs:**
- The test script reuses one `supabase` variable for both users.
- Assertions pass when run individually but fail when run sequentially (or vice versa).

## Code Examples

### Migration file structure (skeleton — full SQL goes in plan)

```sql
-- File: app/supabase/migrations/0001_initial_schema.sql
--
-- Initial schema for FitnessMaxxing V1.
-- Mirrors ARCHITECTURE.md §4 with errata fixed:
--   1. with check on every writable policy (PITFALLS 2.5)
--   2. (select auth.uid()) wrapping in every policy (PITFALLS 4.1)
-- Plus F17 schema (set_type ENUM) and dropping is_warmup.
-- See .planning/phases/02-schema-rls-type-generation/02-CONTEXT.md for the full rationale.

-- ============================================================================
-- 1. ENUM types
-- ============================================================================
create type public.set_type as enum ('working', 'warmup', 'dropset', 'failure');

-- ============================================================================
-- 2. Tables (in FK-dependency order)
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_unit text default 'kg' check (preferred_unit in ('kg', 'lb')),
  created_at timestamptz default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- null = global
  name text not null,
  muscle_group text,
  equipment text,
  notes text,
  created_at timestamptz default now()
);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now(),
  archived_at timestamptz
);

create table public.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  order_index int not null,
  target_sets int,
  target_reps_min int,
  target_reps_max int,
  notes text,
  unique (plan_id, order_index)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number int not null,
  reps int not null,
  weight_kg numeric(6,2) not null,
  rpe numeric(3,1),
  set_type public.set_type not null default 'working',  -- F17 schema-only; replaces is_warmup
  completed_at timestamptz default now(),
  notes text
);

-- ============================================================================
-- 3. Indexes (per ARCHITECTURE.md §4)
-- ============================================================================
create index idx_exercise_sets_session on public.exercise_sets(session_id);
create index idx_exercise_sets_exercise on public.exercise_sets(exercise_id, completed_at desc);
create index idx_sessions_user on public.workout_sessions(user_id, started_at desc);
create index idx_plans_user on public.workout_plans(user_id) where archived_at is null;

-- ============================================================================
-- 4. Row Level Security — enable
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_sets enable row level security;

-- ============================================================================
-- 5. RLS policies — errata-fixed
-- ============================================================================
-- profiles: own row only
create policy "Users can view own profile" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "Users can update own profile" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- (no INSERT policy — handle_new_user trigger inserts via SECURITY DEFINER)

-- exercises: globals (user_id null) ELLER egna
create policy "Users can view global and own exercises" on public.exercises
  for select using (user_id is null or user_id = (select auth.uid()));
create policy "Users can insert own exercises" on public.exercises
  for insert with check (user_id = (select auth.uid()));
create policy "Users can update own exercises" on public.exercises
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users can delete own exercises" on public.exercises
  for delete using (user_id = (select auth.uid()));

-- workout_plans: own rows only
create policy "Users can manage own plans" on public.workout_plans
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- plan_exercises: via plan-ägaren — ERRATA FIX: with check added
create policy "Users can manage own plan exercises" on public.plan_exercises
  for all
  using (exists (select 1 from public.workout_plans where id = plan_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_plans where id = plan_id and user_id = (select auth.uid())));

-- workout_sessions: own rows only
create policy "Users can manage own sessions" on public.workout_sessions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- exercise_sets: via session-ägaren — ERRATA FIX: with check added
create policy "Users can manage own sets" on public.exercise_sets
  for all
  using (exists (select 1 from public.workout_sessions where id = session_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_sessions where id = session_id and user_id = (select auth.uid())));

-- ============================================================================
-- 6. handle_new_user trigger — auto-create profiles row on auth.users insert
-- ============================================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

[Source: synthesized from `ARCHITECTURE.md §4` (root) + PITFALLS 2.5 errata fix + PITFALLS 4.1 perf wrap + Supabase docs canonical trigger pattern]

### npm scripts in `app/package.json`

```jsonc
{
  "scripts": {
    // ... existing scripts (start, ios, android, web, lint, reset-project)
    "gen:types": "supabase gen types typescript --project-id $EXPO_PUBLIC_SUPABASE_PROJECT_ID > types/database.ts",
    "test:rls": "tsx --env-file=.env.local scripts/test-rls.ts"
  },
  "devDependencies": {
    "tsx": "^4.21.0"
    // ... existing
  }
}
```

**Cross-platform note:** `$EXPO_PUBLIC_SUPABASE_PROJECT_ID` works in Bash and Git Bash on Windows. PowerShell uses `$env:EXPO_PUBLIC_SUPABASE_PROJECT_ID`. Since this project's primary shell is PowerShell (per env), the planner has two options:
1. **Hard-code the project-id in the script:** `"gen:types": "supabase gen types typescript --project-id abcdefghij > types/database.ts"` — simplest, project-id is non-sensitive (D-03). Recommend this.
2. **Use cross-env:** add `cross-env` devDep and prefix; adds friction without much benefit.

Recommend option 1: hard-code the project-id literal in the npm script. The project-id IS the linked-project's `<ref>` and is already committed to `supabase/config.toml` (D-03). Duplicating it in `package.json` is fine and removes the env-var dance entirely. The `EXPO_PUBLIC_SUPABASE_PROJECT_ID` env var (D-03) can be kept for any *runtime* usage (none in V1), or dropped from `.env.example` if not needed. **Flag this as a planner decision.**

### `app/.env.example` additions

```bash
# Public env vars for the Expo client...
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key

# Node-only secret. NEVER prefix with EXPO_PUBLIC_ — Metro would bundle it into the
# JS bundle and the entire database becomes publicly read/write. Used solely by
# app/scripts/test-rls.ts to seed test users via the admin API.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-from-project-settings-api

# Project ref — duplicates the project-id stored in app/supabase/config.toml.
# Non-sensitive (it's also visible in EXPO_PUBLIC_SUPABASE_URL above).
# Kept here only if `npm run gen:types` references $EXPO_PUBLIC_SUPABASE_PROJECT_ID;
# planner may drop this if the project-id is hard-coded into the npm script instead.
EXPO_PUBLIC_SUPABASE_PROJECT_ID=your-project-ref
```

### `app/lib/supabase.ts` typed-client diff (D-05)

```typescript
// BEFORE (Phase 1 form)
import { createClient } from "@supabase/supabase-js";
// ...
export const supabase = createClient(supabaseUrl, supabaseAnonKey, { ... });

// AFTER (Phase 2)
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";   // generated by `npm run gen:types`
// ...
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, { ... });
```

Plus removal of `phase1ConnectTest` (lines 88–119 of current `app/lib/supabase.ts`) and its `useEffect` caller in `app/app/_layout.tsx` (lines 38–42 + the import on line 15).

[Source: Context7 `/supabase/supabase-js` `createClient<T>` signature — `T = any` default; passing the generated Database type makes every `from('exercise_sets')` chain fully typed]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `auth.uid()` raw in RLS policies | `(select auth.uid())` wrapped | Documented in Supabase RLS perf guide ~2023 | Per-row → per-query evaluation; orders-of-magnitude faster on large tables. PITFALLS 4.1 is the source. |
| `dotenv` package + `import 'dotenv/config'` | Node `--env-file=` flag (Node ≥20) | Node v20 (2023) | Zero deps, zero imports. Phase 2 uses this for `test:rls`. |
| Hand-typed `interface Plan { ... }` for Supabase tables | `supabase gen types typescript` | CLI 1.x ~2022 | Type drift eliminated by single source of truth. Phase 2 wires this. |
| Trigger function without `SET search_path = ''` | With `SET search_path = ''` + fully-qualified names | Supabase docs updated 2023+ | Defends against PG search-path-injection privilege escalation. CITED in §"Code Examples". |
| Studio table-editor for schema changes | CLI migration files | Always best-practice; PITFALLS 4.2 enforces | Reproducibility, disaster recovery, type-gen consistency. D-18 codifies. |

**Deprecated/outdated:**
- ARCHITECTURE.md (root) §4 has the documented errata that Phase 2 fixes. After Phase 2's `D-14` doc edit, the canonical schema in ARCHITECTURE.md will match deployed reality.
- ARCHITECTURE.md (root) §5 queries reference `is_warmup = false`; Phase 2 D-13 rewrites these to `set_type = 'working'`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Supabase remote project's database password is known to the user (needed for `supabase link -p <pwd>` and `supabase db push`). | Pattern 1 | If unknown, `db push` will prompt; the user must reset the DB password in Project Settings → Database. Plan should include a "verify DB password is recorded" step. |
| A2 | `SUPABASE_ACCESS_TOKEN` (personal access token, distinct from anon-key and service-role) is obtainable by the user from their Supabase account settings without restriction. | Summary | If the user's Supabase account is on a free tier with PAT restrictions, fall back to interactive `supabase login` (browser-based OAuth). Both paths work; PAT is just non-interactive. |
| A3 | `db push` against the dev project will not encounter version drift because the dev project has had no Studio edits since project creation (Phase 1 used a non-existent table for connect-test, no actual Studio writes). | Phase requirements | If there has been any Studio activity (e.g., user manually clicked "Apply" on the Supabase quickstart), `db push` will refuse with a remote/local history mismatch. Mitigation: `supabase db push --include-all` forces apply, but only run after `supabase db diff` confirms what would change. |
| A4 | `EXPO_PUBLIC_SUPABASE_URL` already in `.env.local` is in the form `https://<project-ref>.supabase.co` (Phase 1 D-07 set this). | Summary | If the URL is custom-domain'd (Supabase Pro feature), `<project-ref>` extraction by string-parse fails; user must specify project-ref directly. Solo V1 / free tier — not applicable. |
| A5 | The user's Supabase dev project is on the free tier and has no other tables in `public` schema beyond what Phase 1 / Phase 2 creates. | Phase requirements | If there are leftover sandbox tables, RLS lint may flag them; gen:types output will include them. Mitigation: planner can include a one-time `select tablename from pg_tables where schemaname = 'public'` Studio query as a first task to confirm clean slate. |

**Confirmation needed before planning:** A1 (DB password), A2 (PAT vs login), A3 (no prior Studio activity). The planner should include a "Wave 0 / preflight" task that has the user produce these so the planner doesn't ship blocking ambiguity into the executor's hands.

## Open Questions (RESOLVED)

1. **Should Phase 2 run `supabase db diff` after `db push` as a verification step, or is `npm run test:rls` exit-0 sufficient proof?**
   - What we know: `db diff` against linked project shows any schema differences. Empty output = local SQL matches remote.
   - What's unclear: D-08/D-10 only specify `test:rls` exit-0. CONTEXT.md doesn't explicitly require a `db diff` check.
   - **RESOLVED:** include `npx supabase db diff` as a one-time post-push sanity check (NOT a recurring CI gate per CONTEXT.md deferred items). Plan 03 implements this; expected output is "No schema changes found".

2. **Should `app/types/database.ts` be in `app/.gitignore`?**
   - What we know: D-04 says "committed". The same file is committed in many open-source Supabase projects.
   - What's unclear: Some teams gitignore it because they regenerate per CI run.
   - **RESOLVED:** commit `app/types/database.ts` (D-04 is explicit). Plan 04 commits the generated file alongside the migration; provides visible schema-change diffs and easier onboarding.

3. **Test users — clean up at start, end, or both?**
   - What we know: D-08 says "cleanup at start AND end of every run."
   - What's unclear: If the script crashes mid-run, end-cleanup never runs. Start-cleanup the next time fixes it; until then, dangling rows exist.
   - **RESOLVED:** cleanup at BOTH start and end. Start-cleanup makes the script crash-resilient; end-cleanup keeps the dev project tidy in the happy path. Plan 05 wraps end-cleanup in a `try/finally` block.

4. **Should `EXPO_PUBLIC_SUPABASE_PROJECT_ID` exist at all, or hard-code the project-id in the gen:types npm script?**
   - What we know: D-03 says it should exist as a duplicate of `supabase/config.toml`'s project_id. PowerShell env-var interpolation in npm scripts has cross-shell complications.
   - What's unclear: The actual benefit of the env-var indirection. The project-id is non-sensitive and changes never (Supabase project IDs are fixed for life).
   - **RESOLVED (with user confirmation 2026-05-08):** hard-code the literal project-id in the npm script. Drop `EXPO_PUBLIC_SUPABASE_PROJECT_ID` from `.env.example` and `.env.local`. Plan 01 implements; CONTEXT.md `<decisions>` D-03 was relaxed to move the env-var indirection to "Claude's Discretion" — the substantive D-04 intent ("remote linked project, not local Docker") is preserved.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tsx, npm scripts, gen:types pipe | ✓ | v24.14.1 | — |
| npm | Package installs, scripts | ✓ | 10.8.2 | — |
| `npx` | One-off Supabase CLI invocations | ✓ | bundled with npm | — |
| Supabase CLI (via `npx supabase`) | Init, link, db push, gen types | ✓ (npx-resolvable) | latest at run time (CLI is a Go binary downloaded by npx) | — |
| `tsx` (devDep, to install) | `npm run test:rls` | ✗ (will install in Phase 2) | install ^4.21.0 | — |
| Supabase remote dev project | All Phase 2 outputs | ✓ (Phase 1 D-07 confirmed connectivity) | — | — |
| `SUPABASE_DB_PASSWORD` / DB password | `supabase link`, `db push` | ? (user-side; not visible from research env) | — | If unknown, reset in Project Settings → Database |
| `SUPABASE_ACCESS_TOKEN` or `supabase login` | `gen:types` against remote | ? (user-side) | — | `supabase login` opens browser; works without env var |
| Supabase Studio (browser access) | Manual sanity check post-push | ✓ (any browser) | — | — |
| Docker | NOT needed (local stack out of scope per CONTEXT.md) | ✗ (intentional) | — | N/A — out of scope |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `tsx` (will install). DB password and access token are user-side — preflight task in plan should confirm these are in hand before authoring the migration.

## Validation Architecture

> Nyquist validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **None for unit/integration tests in V1.** Phase 2's "tests" are: (a) the `test-rls.ts` Node script (custom assertion harness; not a framework), (b) `npx tsc --noEmit` for type checking, (c) `npx supabase db diff` for schema-drift detection. |
| Config file | None to add. `app/tsconfig.json` already exists from Phase 1. |
| Quick run command | `cd app && npm run test:rls` (≤ 30s once seeded) |
| Full suite command | `cd app && npm run test:rls && npx tsc --noEmit && npx supabase db diff` (≤ 60s) |

**Justification for not introducing Jest/Vitest in Phase 2:** CONTEXT.md deferred ideas explicitly omit pgTAP and broader test frameworks for V1. The single Node script is sufficient because Phase 2's testable behaviors are all about the LIVE remote database, not pure functions. Adding Jest/Vitest scaffold is Phase 7 (V1 Polish) territory if anywhere in V1.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| F17 | `set_type` ENUM exists with values `('working','warmup','dropset','failure')` | Schema introspection | `npx supabase db diff` (empty after push) AND `grep "set_type" app/types/database.ts` | ❌ Wave 0 |
| F17 | `exercise_sets.set_type` column exists, type=`set_type`, default=`'working'`, NOT NULL | Schema introspection | Generated `app/types/database.ts` includes `set_type: 'working' \| 'warmup' \| 'dropset' \| 'failure'` | ❌ Wave 0 |
| F17 | `exercise_sets.is_warmup` column does NOT exist | Schema introspection | Negative grep on generated types: `! grep -q "is_warmup" app/types/database.ts` | ❌ Wave 0 |
| ROADMAP-S1 | All 6 tables exist with RLS enabled | Schema introspection | Generated types include all 6 table interfaces; `db diff` empty | ❌ Wave 0 |
| ROADMAP-S2 | All writable RLS policies have BOTH `using` AND `with check`; all `auth.uid()` are wrapped | Static SQL inspection + cross-user behavioral test | `grep -cE "with check" app/supabase/migrations/0001_initial_schema.sql` ≥ 6; `grep -cE "auth\.uid\(\)" app/supabase/migrations/0001_initial_schema.sql` = 0 (all wrapped); `grep -cE "\(select auth\.uid\(\)\)" app/supabase/migrations/0001_initial_schema.sql` ≥ 10 | ❌ Wave 0 (the migration file itself) |
| ROADMAP-S3 (RLS-01) | User A cannot SELECT User B's `profiles`/`exercises`/`workout_plans`/`plan_exercises`/`workout_sessions`/`exercise_sets` | Cross-user integration | `npm run test:rls` exit 0 (assertions log per table) | ❌ Wave 0 (`scripts/test-rls.ts`) |
| ROADMAP-S3 (RLS-02) | User A cannot INSERT into User B's namespace (any of 5 user-scoped tables) | Cross-user integration | `npm run test:rls` exit 0 — includes the load-bearing `plan_exercises`/`exercise_sets` child-row attempts pointing at foreign parent | ❌ Wave 0 |
| ROADMAP-S3 (RLS-03) | User A cannot UPDATE/DELETE User B's rows | Cross-user integration | `npm run test:rls` exit 0 | ❌ Wave 0 |
| ROADMAP-S3 (RLS-04) | `handle_new_user` trigger inserts a `profiles` row when a user is created via `auth.admin.createUser` | Behavioral verification (side effect of test-rls seeding) | After test-rls.ts seeds User A and User B, query `select count(*) from public.profiles where id in (userA.id, userB.id)` → 2. Run via service-role client. | ❌ Wave 0 |
| ROADMAP-S5 | `npm run gen:types` produces typed `app/types/database.ts`; `createClient<Database>(...)` compiles | Type check | `cd app && npx tsc --noEmit` exits 0 | ✓ tsconfig exists; gen:types script needs Wave 0 |

### Sampling Rate

- **Per task commit:** Whichever of `npm run test:rls`, `npx tsc --noEmit`, or `grep` checks is relevant to the task being committed. Most tasks touch only the SQL or only the script.
- **Per wave merge:** Run all three: `npm run test:rls && npx tsc --noEmit && npx supabase db diff`.
- **Phase gate:** All three green; manual Studio sanity check (RLS enabled on all 6 tables in dashboard's table view) green; `git grep "service_role\|SERVICE_ROLE"` returns only `app/scripts/test-rls.ts`, `app/.env.example`, and docs.

### Wave 0 Gaps

- [ ] `app/supabase/` directory tree — created by `npx supabase init` (Wave 1 task)
- [ ] `app/supabase/migrations/0001_initial_schema.sql` — authored manually (Wave 2 task)
- [ ] `app/types/database.ts` — generated by `npm run gen:types` (Wave 4 task)
- [ ] `app/scripts/test-rls.ts` — authored manually (Wave 5 task)
- [ ] `app/scripts/` directory — created when first script lands (Wave 5 task)
- [ ] `tsx` devDependency — `npm install --save-dev tsx` from `app/` cwd (Wave 5 prep task)
- [ ] `gen:types` and `test:rls` scripts in `app/package.json` (Waves 4 and 5 respectively)
- [ ] `app/.env.local` updated with `SUPABASE_SERVICE_ROLE_KEY` (and possibly `EXPO_PUBLIC_SUPABASE_PROJECT_ID` per Open Question 4) — user-driven step in Wave 0 / preflight
- [ ] `app/.env.example` updated with placeholder lines for the two new keys (Wave 0)

*(All of these are expected — Phase 2 is the phase where they appear. None block plan creation; all have clear ownership.)*

## Security Domain

> `security_enforcement: true` and `security_asvs_level: 1` in config.json. Phase 2 is high-relevance because RLS is the project's primary defensive control.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | indirect (uses Supabase Auth; no auth UI in Phase 2) | Supabase Auth (already wired in Phase 1) |
| V3 Session Management | no (Phase 3 territory) | LargeSecureStore (Phase 1) |
| V4 Access Control | **YES — primary Phase 2 concern** | **PostgreSQL Row Level Security**. Every user-scoped table has RLS enabled with policies that scope to `(select auth.uid())`. `with check` on every writable policy prevents post-state forgery. Cross-user test is the verification artifact. |
| V5 Input Validation | partial (schema-level only) | NOT NULL constraints, FK constraints, ENUM type for `set_type`, CHECK constraint on `preferred_unit`. Application-level Zod validation is Phase 4+ per CONTEXT.md. |
| V6 Cryptography | indirect (Postgres handles, not us) | `gen_random_uuid()` Postgres-native (uses `pgcrypto` underneath). `auth.users` password hashing handled by Supabase Auth. We do not hand-roll. |
| V14 Configuration | **YES — secret-management surface** | Service-role key in Node-side `.env.local` ONLY; never `EXPO_PUBLIC_*`-prefixed; `git grep` audit gate. Anon key is public per design (RLS is the control). |

### Known Threat Patterns for {Supabase + RN + RLS}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service-role key leaked into Expo bundle | Information disclosure / Elevation of privilege | Strict naming convention (no `EXPO_PUBLIC_` prefix on service-role); pre-commit `git grep` audit; Phase 2 places the key in `app/scripts/` only. PITFALLS 2.3. |
| RLS policy with `using` only, no `with check` | Tampering / Spoofing | Every writable policy in `0001_initial_schema.sql` has both clauses. `test-rls.ts` includes the foreign-parent insert assertion that proves the gap is closed. PITFALLS 2.5. |
| Anon key extracted from APK/IPA → targeted RLS probe | Information disclosure | RLS itself IS the control. Anon key is public per design. Cross-user test is the proof. PITFALLS 2.6. |
| Schema drift between migration file and live DB | Repudiation / Tampering | `supabase db diff` post-push; D-18 "Studio is read-only" rule; commit migration + types together. PITFALLS 4.2. |
| Trigger function search-path injection | Elevation of privilege | `SET search_path = ''` + fully-qualified `public.profiles`. CITED in §"Code Examples" — Supabase canonical pattern. |
| Test user data leaks (real users named `rls-test-*`) | Information disclosure (low) | Email TLD `.local` ensures these emails cannot be confused with real users; `name LIKE 'rls-test-%'` cleanup in `test-rls.ts`. CONTEXT.md D-08. |
| Replay attack via stolen service-role key | Elevation of privilege | If the `.env.local` is exfiltrated (e.g., laptop theft), the attacker has full database access. Mitigation: rotate service-role-key in Project Settings → API immediately; `app/.env.local` is gitignored so source-of-truth-on-disk is the only copy. Out-of-band acceptable for solo V1. |

**ASVS Level 1 verdict:** Phase 2 design satisfies V4 (Access Control) and V14 (Configuration) at L1. No blocking findings.

## Sources

### Primary (HIGH confidence)
- Context7 `/supabase/cli` — Migration commands, gen types flags (`--project-id`, `--linked`), init, link, db push (`--yes`, `--dry-run`, `--include-all`), migration file regex pattern. Verified 2026-05-08.
- Context7 `/supabase/supabase-js` (v2.58.0+) — `createClient<T>()` generic signature, `auth.admin.createUser` API, service-role key requirement.
- Supabase docs — [Managing User Data](https://supabase.com/docs/guides/auth/managing-user-data) — verbatim canonical `handle_new_user` trigger SQL with `SECURITY DEFINER set search_path = ''`.
- `npm view tsx` — version 4.21.0, engines `node >=18`, zero peer deps. Verified 2026-05-08.
- `node --help` v24.14.1 — `--env-file=...` flag built-in.
- Existing repo files (Phase 1 CONTEXT.md, ARCHITECTURE.md, PITFALLS.md, supabase.ts, _layout.tsx, package.json, .env.example, .gitignore) — read end-to-end for this research.

### Secondary (MEDIUM confidence)
- [Supabase RLS Performance Guide](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — referenced via PITFALLS 4.1 in repo; not re-fetched in this session.
- [Supabase Expo Tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native?auth-store=secure-store) — referenced via Phase 1 prior research.

### Tertiary (LOW confidence — explicitly flagged)
- None. All claims in this research are either VERIFIED via tool or CITED to a specific source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `tsx` and `@supabase/supabase-js` versions verified via npm registry; CLI commands verified via Context7.
- Architecture: HIGH — three-credential boundary diagram is straightforward; CONTEXT.md decisions cover all the open architecture choices.
- Pitfalls: HIGH — all eight pitfalls map directly to existing PITFALLS.md sections that were authored for this exact codebase.
- Validation: HIGH — `test-rls.ts` mechanism is the canonical pattern; type-gen + db diff are CLI-supplied.
- Security: HIGH — Phase 2's threat model is well-trodden Supabase ground; ASVS L1 trivially satisfied.

**Research date:** 2026-05-08
**Valid until:** 2026-06-07 (30 days; CLI changes are infrequent for the Phase 2 surface area)
