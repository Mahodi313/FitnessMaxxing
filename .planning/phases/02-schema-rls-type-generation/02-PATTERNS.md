# Phase 2: Schema, RLS & Type Generation - Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 11 (4 new, 7 modified)
**Analogs found:** 7 / 11 (3 modified files have direct in-repo analogs = themselves; 4 new files are firsts of their kind in this repo and reference RESEARCH.md §"Code Examples" instead)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/supabase/config.toml` (NEW) | Supabase CLI config (TOML) | n/a (CLI artifact) | none in repo — first Supabase CLI config | RESEARCH-only (§"Standard Stack" + §"Recommended Project Structure") |
| `app/supabase/migrations/0001_initial_schema.sql` (NEW) | DDL migration (PostgreSQL SQL) | schema-definition / one-shot | none in repo — first migration; canonical reference is `ARCHITECTURE.md §4` (root) with PITFALLS 2.5 + 4.1 errata fixes | RESEARCH-only (§"Code Examples" → "Migration file structure") |
| `app/types/database.ts` (NEW, generated) | Generated TS type module | type-definition / read-only consumer artifact | none in repo — first generated artifact | CLI-generated (no analog needed; do NOT hand-edit) |
| `app/scripts/test-rls.ts` (NEW) | Node-only integration test script | request-response (admin API + anon clients) | partial: `app/lib/supabase.ts` for `createClient` shape + env-guard pattern; full skeleton lives in RESEARCH §"Code Examples" → Pattern 3 | partial-match (analog gives client-construction pattern; behavior is RESEARCH skeleton) |
| `app/lib/supabase.ts` (MODIFIED) | Supabase client (typed) | request-response | itself (Phase 1 form) — Phase 2 swaps `createClient` → `createClient<Database>` and removes `phase1ConnectTest` | exact (in-place modification) |
| `app/app/_layout.tsx` (MODIFIED) | RN root layout (Expo Router) | provider/layout | itself — Phase 2 removes the `phase1ConnectTest` `useEffect` + import | exact (in-place modification, deletion-only) |
| `app/.env.example` (MODIFIED) | Env-var template | static config doc | itself — Phase 2 appends two new keys with comments | exact (in-place additions) |
| `app/.env.local` (MODIFIED, gitignored) | Local env values | static config (secrets) | itself (gitignored, not tracked) — Phase 2 appends real values | exact (user-side append) |
| `app/package.json` (MODIFIED) | npm manifest | n/a | itself — Phase 2 adds `gen:types` + `test:rls` scripts and `tsx` devDep | exact (in-place additions) |
| `ARCHITECTURE.md` §4 + §5 (MODIFIED, repo root) | Decision register / canonical schema doc | docs | itself — Phase 2 edits in place to reflect deployed reality | exact (doc edit) |
| `STATE.md` (MODIFIED, repo root) | Phase state tracker | docs | itself — Phase 2 flips errata note to "fixed" | exact (doc edit) |
| `CLAUDE.md` or `PROJECT.md` (MODIFIED) | Project conventions doc | docs | `CLAUDE.md ## Conventions` block (Phase 1 convention pattern) | role-match (new sub-section follows existing convention-block style) |

## Pattern Assignments

### `app/supabase/migrations/0001_initial_schema.sql` (DDL migration, schema-definition)

**Analog:** None in repo. Canonical reference is RESEARCH.md §"Code Examples" → "Migration file structure (skeleton — full SQL goes in plan)" (lines 533–687 of `02-RESEARCH.md`), plus `ARCHITECTURE.md §4` (root) with errata fixes from PITFALLS 2.5 + 4.1.

**Header pattern** (per CONTEXT.md `<specifics>` and RESEARCH §"Code Examples"):
```sql
-- File: app/supabase/migrations/0001_initial_schema.sql
--
-- Initial schema for FitnessMaxxing V1.
-- Mirrors ARCHITECTURE.md §4 with errata fixed:
--   1. with check on every writable policy (PITFALLS 2.5)
--   2. (select auth.uid()) wrapping in every policy (PITFALLS 4.1)
-- Plus F17 schema (set_type ENUM) and dropping is_warmup.
-- See .planning/phases/02-schema-rls-type-generation/02-CONTEXT.md for the full rationale.
```

**ENUM pattern** (D-11):
```sql
create type public.set_type as enum ('working', 'warmup', 'dropset', 'failure');
-- ...
set_type public.set_type not null default 'working',  -- F17 schema-only; replaces is_warmup
```

**RLS-enable pattern** (one line per table; required by PITFALLS 2.1):
```sql
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_sets enable row level security;
```

**Errata-fixed RLS policy pattern — child table** (PITFALLS 2.5; load-bearing for `plan_exercises` and `exercise_sets`):
```sql
-- BOTH using AND with check; both reference the parent via (select auth.uid()) wrap (PITFALLS 4.1)
create policy "Users can manage own plan exercises" on public.plan_exercises
  for all
  using (exists (select 1 from public.workout_plans where id = plan_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_plans where id = plan_id and user_id = (select auth.uid())));

create policy "Users can manage own sets" on public.exercise_sets
  for all
  using (exists (select 1 from public.workout_sessions where id = session_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_sessions where id = session_id and user_id = (select auth.uid())));
```

**Owner-table RLS policy pattern** (`for all` with both clauses):
```sql
create policy "Users can manage own plans" on public.workout_plans
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
```

**Profiles trigger pattern** (D-15/D-16/D-17 — Supabase canonical, RESEARCH §"Pattern 4"):
```sql
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

**Full skeleton:** Use RESEARCH.md §"Code Examples" → "Migration file structure" (lines 533–687) verbatim for table DDL, indexes, RLS policies, and trigger. The skeleton already incorporates errata fixes; the plan can copy it whole.

---

### `app/scripts/test-rls.ts` (Node-only test script, request-response)

**Analog (partial — for `createClient` shape and env-guard):** `app/lib/supabase.ts`

**Env-guard pattern** (mirror from `app/lib/supabase.ts` lines 15–24, but for service-role-key — Node-side only):
```typescript
// Source pattern in app/lib/supabase.ts:
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Skapa app/.env.local med " +
      "EXPO_PUBLIC_SUPABASE_URL och EXPO_PUBLIC_SUPABASE_ANON_KEY (se app/.env.example).",
  );
}

// test-rls.ts adapts this pattern, additionally requiring SUPABASE_SERVICE_ROLE_KEY:
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error('Missing env. Need SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY in app/.env.local');
}
```

**Three-client isolation pattern** (PITFALLS 2.3 + RESEARCH §"Pitfall 8"):
```typescript
import { createClient } from '@supabase/supabase-js';

// Admin (service-role, bypasses RLS) — for seeding/cleanup only
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// User A and User B clients — anon-key, RLS-enforced
const clientA = createClient(url, anonKey, { auth: { persistSession: false } });
const clientB = createClient(url, anonKey, { auth: { persistSession: false } });
// Each anon client signs in to its own user; never reuse one client across users (PITFALLS Pitfall 8)
```

**Test skeleton:** RESEARCH.md §"Code Examples" Pattern 3 (lines 296–339 of `02-RESEARCH.md`) provides the full cleanup → seed → cross-user-CRUD-attempts → exit-code structure. Copy and extend per D-09 coverage matrix (4 ops × 5 tables = 20 assertions, plus the two errata-specific foreign-parent INSERT assertions).

**Critical pattern: `auth: { persistSession: false }` on every client** — prevents the on-disk session leak between runs (RESEARCH §"Pitfall 8").

**No `app/lib/` import allowed** — `test-rls.ts` constructs its own `createClient` calls. Importing `@/lib/supabase` would pull `expo-secure-store` and other React Native deps that fail in Node. Verified by D-07: "service-role key NEVER appears in any file under `app/lib/`".

---

### `app/lib/supabase.ts` (MODIFIED — typed Supabase client)

**Analog:** Itself (Phase 1 form). This is an in-place modification.

**Current Phase 1 form** (lines 12, 72–79 of `app/lib/supabase.ts`):
```typescript
import { createClient } from "@supabase/supabase-js";
// ...
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN har ingen URL-bar
  },
});
```

**Phase 2 form** (only two changes — rest of file unchanged):
```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database"; // NEW: generated by `npm run gen:types`
// ...
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

**Deletions** (lines 88–119 — the entire `phase1ConnectTest` JSDoc + function body):
```typescript
// DELETE this entire block:
/**
 * Phase 1 connect-test (D-07). ...
 */
export async function phase1ConnectTest() {
  try {
    const { data, error, status } = await supabase
      .from("_phase1_smoke")
      .select("*")
      .limit(0);
    // eslint-disable-next-line no-console
    console.log("[phase1-connect-test]", { ... });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[phase1-connect-test] FAILED", e);
  }
}
```

**Untouched** (must NOT be modified): `LargeSecureStore` class, env-guard at lines 16–24, `AppState.addEventListener` at lines 82–86, `react-native-get-random-values` first-import at line 8, the auth options object's contents.

---

### `app/app/_layout.tsx` (MODIFIED — remove connect-test)

**Analog:** Itself. Deletion-only edit.

**Current form** (lines 14–15, 37–43):
```typescript
import { queryClient } from "@/lib/query-client";
import { phase1ConnectTest } from "@/lib/supabase"; // line 15 — DELETE

export default function RootLayout() {
  useEffect(() => {                    // lines 38–42 — DELETE the entire useEffect
    if (__DEV__) {
      phase1ConnectTest();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
```

**Phase 2 form** (after edits — `useEffect` import on line 2 may also become unused; remove if so):
```typescript
import "../global.css";
// `useEffect` import removed if unused after this edit
import { AppState, Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

import { queryClient } from "@/lib/query-client";
// `phase1ConnectTest` import removed

// ... module-level focusManager + onlineManager listeners unchanged ...

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
```

**Untouched** (must NOT be modified): the two module-level listeners (`focusManager.setEventListener` at lines 19–24, `onlineManager.setEventListener` at lines 26–35) — they belong to TanStack Query Recipe §B and are not Phase-2 scoped.

---

### `app/.env.example` (MODIFIED — add two keys with comments)

**Analog:** Itself. The Phase 1 file (lines 1–6) sets the comment-block style:
```bash
# Public env vars for the Expo client. EXPO_PUBLIC_-prefixet krävs för att Metro
# ska bunta värdet till klienten. Anon-nyckeln är publik per design — RLS skyddar
# data. Service-role-nyckeln (om du någonsin har en) får ALDRIG hamna här.
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

**Phase 2 additions** (mirror the comment-block style — Swedish leading sentence, hard rules called out per PITFALLS 2.3):
```bash
# Node-only secret. NEVER prefix with EXPO_PUBLIC_ — Metro skulle annars bunta
# nyckeln in i JS-bundeln och hela databasen blir publikt läs-/skrivbar. Används
# enbart av app/scripts/test-rls.ts för att seeda testanvändare via admin-API.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-from-project-settings-api

# Project ref — duplicerar project-id som ligger i app/supabase/config.toml.
# Icke-känsligt (samma värde syns i EXPO_PUBLIC_SUPABASE_URL ovan).
# Behövs bara om npm run gen:types refererar $EXPO_PUBLIC_SUPABASE_PROJECT_ID;
# planeraren kan välja att hard-coda project-id i npm-skriptet istället.
EXPO_PUBLIC_SUPABASE_PROJECT_ID=your-project-ref
```

**Note for planner:** RESEARCH.md §"Open Questions" #4 recommends hard-coding the project-id literal in the npm script and dropping `EXPO_PUBLIC_SUPABASE_PROJECT_ID` from `.env.example`. Decision goes to planner — both options documented.

---

### `app/package.json` (MODIFIED — add scripts + tsx devDep)

**Analog:** Itself. Existing `scripts` block (lines 5–12) sets the style:
```json
"scripts": {
  "start": "expo start",
  "reset-project": "node ./scripts/reset-project.js",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "lint": "expo lint"
}
```

**Phase 2 additions** (per RESEARCH §"Code Examples" + Open Question #4):
```json
"scripts": {
  "start": "expo start",
  "reset-project": "node ./scripts/reset-project.js",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "lint": "expo lint",
  "gen:types": "supabase gen types typescript --project-id <hard-coded-ref> > types/database.ts",
  "test:rls": "tsx --env-file=.env.local scripts/test-rls.ts"
}
```

**devDependencies addition** (line 65 area, alphabetically among existing devDeps):
```json
"devDependencies": {
  // ... existing entries ...
  "tsx": "^4.21.0"
  // ... existing entries continue ...
}
```

**Install command** (run from `app/` cwd):
```bash
npm install --save-dev tsx
```

**Cross-platform note:** `--env-file=.env.local` is forwarded by tsx to Node v24 native. PowerShell-friendly. No `cross-env` or `dotenv` needed.

---

### `app/supabase/config.toml` (NEW, CLI-generated)

**Analog:** None — first Supabase CLI artifact in repo.

**Generation:** `cd app && npx supabase init` creates this file with the project_id field populated. After `npx supabase link --project-ref <ref> -p <db-pwd>`, the project ref is bound.

**Commit policy** (per D-03): committed; project ref is non-sensitive (also visible in `EXPO_PUBLIC_SUPABASE_URL`). Do NOT add to `.gitignore`.

**Companion artifact:** `app/supabase/.gitignore` is auto-generated by `supabase init`. RESEARCH §"Runtime State Inventory" specifies: verify it lists `.branches/` and `.temp/` and (if generated) `supabase/.env` — but `config.toml` itself must remain tracked.

---

### `app/types/database.ts` (NEW, CLI-generated)

**Analog:** None — first generated artifact in repo.

**Generation command:**
```bash
cd app
npm run gen:types  # → npx supabase gen types typescript --project-id <ref> > types/database.ts
```

**Commit policy** (D-04): committed alongside the migration. CI/regressions catch drift.

**Hand-edit policy:** Anti-pattern per RESEARCH §"Anti-Patterns". If a generated type is wrong, fix the schema (a new migration) and regenerate.

**Consumed by:** `app/lib/supabase.ts` via `import type { Database } from "@/types/database"` and `createClient<Database>(...)`.

**Sanity check** (RESEARCH §"Pitfall 6"): generated output must mention all 6 expected tables:
```bash
grep -E "(profiles|exercises|workout_plans|plan_exercises|workout_sessions|exercise_sets)" app/types/database.ts | wc -l
# expect ≥ 6
```

---

### `ARCHITECTURE.md` (MODIFIED — §4 + §5 doc edit)

**Analog:** Itself. Repo-root canonical decision register; existing prose style.

**§4 changes** (per D-14):
- Drop `is_warmup boolean default false` line from `exercise_sets`
- Add `set_type set_type NOT NULL DEFAULT 'working'` line + ENUM definition note
- Update `plan_exercises` policy SQL to include `with check (...)` (errata fix)
- Update `exercise_sets` policy SQL to include `with check (...)` (errata fix)
- Wrap every `auth.uid()` reference as `(select auth.uid())` in policy SQL
- Add `handle_new_user` trigger SQL block

**§5 changes** (per D-13):
- Rewrite F7 "senaste värdet" query: `where is_warmup = false` → `where set_type = 'working'`
- Rewrite F10 "max-vikt" query: same filter rewrite

---

### `STATE.md` (MODIFIED — flip errata note to "fixed")

**Analog:** Itself. Repo-root file.

**Change:** Replace the existing line `"ARCHITECTURE.md §4 errata: with check saknas på plan_exercises + exercise_sets — fixas i Phase 2"` with a "fixed in Phase 2" note. Exact wording per planner discretion.

---

### `CLAUDE.md` or `PROJECT.md` (MODIFIED — Database conventions sub-section)

**Analog:** Existing `CLAUDE.md ## Conventions` block (Phase 1 navigation/header conventions sub-section sets the style — heading + bullet rules + "why" rationale per bullet).

**Phase 2 additions** (per D-18 — choose CLAUDE.md `## Conventions` OR PROJECT.md `## Constraints`):
```markdown
### Database conventions (established Phase 2)

- All schema changes ship as numbered SQL files in `app/supabase/migrations/` — Supabase Studio is read-only from Phase 2 forward.
- Every migration that creates a table MUST `enable row level security` AND add at least one policy in the same file.
- Every writable RLS policy MUST have BOTH `using` AND `with check`.
- Every `auth.uid()` reference inside an RLS policy MUST be wrapped as `(select auth.uid())` for query-plan caching.
- `npm run gen:types` runs after every schema migration; the generated `app/types/database.ts` is committed in the same commit as the migration that produced it.
- `SUPABASE_SERVICE_ROLE_KEY` lives in `app/.env.local` only; never prefixed with `EXPO_PUBLIC_`; never imported from any path under `app/lib/`, `app/app/`, or any other Metro-bundled path.
```

---

## Shared Patterns

### Runtime env-var guard

**Source:** `app/lib/supabase.ts` lines 16–24

**Apply to:** `app/scripts/test-rls.ts` (with adapted required-keys list including `SUPABASE_SERVICE_ROLE_KEY`)

**Pattern** (Phase 1 baseline):
```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Skapa app/.env.local med " +
      "EXPO_PUBLIC_SUPABASE_URL och EXPO_PUBLIC_SUPABASE_ANON_KEY (se app/.env.example).",
  );
}
```
**Why:** Per PITFALLS §2.6 — fail loud, not silent. Phase 2 extends pattern Node-side but must NOT change client-side guard.

### `createClient` factory shape

**Source:** `app/lib/supabase.ts` line 72

**Apply to:** `app/scripts/test-rls.ts` (three calls — admin + clientA + clientB)

**Pattern (anon-key, RN session-persistent):**
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

**Adapted for Node-only test script** (no LargeSecureStore, no persisted session):
```typescript
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const clientA = createClient(url, anonKey, { auth: { persistSession: false } });
const clientB = createClient(url, anonKey, { auth: { persistSession: false } });
```

### Path alias `@/*` → `./*`

**Source:** Already established in Phase 1 — used by `app/app/_layout.tsx` (`@/lib/query-client`, `@/lib/supabase`)

**Apply to:** `app/lib/supabase.ts`'s new import — `import type { Database } from "@/types/database"`. Do NOT use relative paths (`../types/database`) when alias exists.

### Inner-project cwd convention

**Source:** Phase 1 D-01 — all CLI work runs from `app/` cwd

**Apply to:** Every CLI invocation in Phase 2 plans:
```bash
cd app && npx supabase init
cd app && npx supabase link --project-ref <ref> -p <db-pwd>
cd app && npx supabase db push --yes
cd app && npm run gen:types
cd app && npm run test:rls
```

**Why:** `app/package.json` is the manifest; `app/supabase/` (CLI artifacts) and `app/types/` (generated) live next to it. Running CLI from repo root would either fail or produce artifacts in wrong location.

### Service-role-key isolation rule

**Source:** PITFALLS §2.3 (cross-cutting)

**Apply to:** `app/scripts/test-rls.ts` ONLY. Verification command (manual one-time at Phase 2 close):
```bash
git grep -nE "service[_-]?role|SERVICE_ROLE"
# expected matches ONLY:
#   app/scripts/test-rls.ts
#   app/.env.example
#   docs/planning files (.planning/, ARCHITECTURE.md, etc.)
# any match under app/lib/, app/app/, app/components/ = FAIL
```

### Comment-block bilingual style for env files

**Source:** `app/.env.example` lines 1–3 (Swedish comment header)

**Apply to:** `app/.env.example` new key additions — preserve Swedish-comment + English-key style for consistency.

## No Analog Found (RESEARCH-only patterns)

Files with no in-repo analog. Planner uses RESEARCH.md §"Code Examples" as the canonical pattern source.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/supabase/migrations/0001_initial_schema.sql` | DDL migration | schema-definition | First migration in repo. RESEARCH §"Code Examples" → "Migration file structure" provides the full skeleton (lines 533–687 of `02-RESEARCH.md`). |
| `app/supabase/config.toml` | CLI config | n/a | Auto-generated by `npx supabase init`. |
| `app/types/database.ts` | Generated types | type-definition | Auto-generated by `npm run gen:types`. Hand-editing is anti-pattern. |
| `app/scripts/test-rls.ts` | Node test | request-response | First Node-only script. Skeleton in RESEARCH §"Code Examples" → Pattern 3 (lines 296–339); env-guard pattern from `app/lib/supabase.ts`. |

## Metadata

**Analog search scope:** `app/lib/`, `app/app/`, `app/scripts/` (empty), `app/types/` (empty), `app/supabase/` (empty), `app/.env.example`, `app/package.json`, repo root (`ARCHITECTURE.md`, `STATE.md`, `CLAUDE.md`, `PROJECT.md`)

**Files scanned:** 8 in-repo (lib/supabase.ts, lib/query-client.ts, app/_layout.tsx, .env.example, package.json + 3 directory checks confirming new dirs do not yet exist)

**Pattern extraction date:** 2026-05-08
