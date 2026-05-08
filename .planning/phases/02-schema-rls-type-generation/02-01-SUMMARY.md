---
phase: 02-schema-rls-type-generation
plan: 01
subsystem: infra
tags: [supabase, supabase-cli, tsx, npm-scripts, env-vars, secrets-hygiene]

# Dependency graph
requires:
  - phase: 01-bootstrap-and-infra-hardening
    provides: "app/.env.local with EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY; gitignore convention from Phase 1 D-07"
provides:
  - "app/supabase/config.toml committed (project-ref bound to remote project mokmiuifpdzwnceufduu)"
  - "app/supabase/.gitignore (auto-generated; verified: does NOT ignore config.toml)"
  - "tsx@^4.21.0 devDep installed in app/"
  - "gen:types npm script with hard-coded project-ref (Open Q#4 → option 1)"
  - "test:rls npm script using `tsx --env-file=.env.local`"
  - "app/.env.example placeholders + warning comments for SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_PASSWORD (Node-only secrets, no EXPO_PUBLIC_ prefix)"
  - "app/.env.local populated with real SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_PASSWORD (gitignored, user-side)"
  - "Persistent supabase login session (PAT in ~/.supabase/access-token); `supabase projects list` works non-interactively"
affects: [02-02 schema authoring, 02-03 db push, 02-04 type generation, 02-05 cross-user RLS test]

# Tech tracking
tech-stack:
  added:
    - "tsx@^4.21.0 (devDep — runs TS without build step for test:rls)"
    - "Supabase CLI 2.98.2 wired into app/ (config.toml + linked project)"
  patterns:
    - "Hard-coded project-ref in npm scripts (instead of env-var indirection) — avoids PowerShell vs Bash interpolation footgun (RESEARCH Open Q#4)"
    - "Node-only secrets MUST never carry EXPO_PUBLIC_ prefix — explicit Swedish warning comments in .env.example document the rule (PITFALLS 2.3)"
    - "config.toml committed (D-03); .temp/ + .branches/ + .env*.local gitignored by CLI default (verified)"

key-files:
  created:
    - "app/supabase/config.toml"
    - "app/supabase/.gitignore"
    - ".planning/phases/02-schema-rls-type-generation/02-01-SUMMARY.md"
  modified:
    - "app/.env.example"
    - "app/package.json"
    - "app/package-lock.json"
    - "app/.env.local (gitignored — populated by user with real secrets)"

key-decisions:
  - "Hard-code project-ref `mokmiuifpdzwnceufduu` literally into gen:types script (RESEARCH Open Q#4 → option 1) — non-sensitive (also visible in EXPO_PUBLIC_SUPABASE_URL and config.toml), avoids PowerShell shell-interpolation vs Bash differences"
  - "Set config.toml `project_id = \"mokmiuifpdzwnceufduu\"` to match remote ref (CLI default after `init` is the working-directory name `\"app\"`; matching the ref makes the file self-documenting per artifact contract)"
  - "Document BOTH SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_PASSWORD in .env.example (orchestrator success criteria required both); plan body only mentioned SERVICE_ROLE_KEY — auto-added DB_PASSWORD per Rule 2"

patterns-established:
  - "Pattern 1: `cd app && npx supabase <cmd>` is the canonical CLI invocation (D-01 inner-project convention from Phase 1)"
  - "Pattern 2: Node-only secrets use bare names (no prefix); Expo-bundled secrets use `EXPO_PUBLIC_` prefix; .env.example carries placeholders with security comments for both classes"
  - "Pattern 3: `tsx --env-file=.env.local` is the standard runner for one-off Node scripts that need Supabase secrets — avoids importing dotenv as a dep"

requirements-completed: [F17]

# Metrics
duration: 3min
completed: 2026-05-08
---

# Phase 2 Plan 01: Supabase CLI Bootstrap & Credential Surface Summary

**Supabase CLI 2.98.2 initialized inside `app/`, linked to remote project `mokmiuifpdzwnceufduu`, tsx@4.21 installed, gen:types + test:rls npm scripts wired with hard-coded project-ref, .env.example documents Node-only secrets with no-EXPO_PUBLIC warning comments**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-08T21:43:31Z
- **Completed:** 2026-05-08T21:46:16Z
- **Tasks:** 3 (Task 1 preflight pre-confirmed by orchestrator; Tasks 2–3 executed)
- **Files modified:** 5 tracked + 1 gitignored (.env.local)

## Accomplishments

- `app/supabase/config.toml` exists, is committed (D-03), and carries `project_id = "mokmiuifpdzwnceufduu"`
- `app/supabase/.gitignore` (CLI-generated) verified: does NOT ignore config.toml; ignores `.temp/`, `.branches/`, `.env*.local` (clean)
- `tsx@^4.21.0` added to `app/package.json` devDependencies (zero peer-dep warnings)
- `gen:types` npm script: `npx supabase gen types typescript --project-id mokmiuifpdzwnceufduu > types/database.ts` (hard-coded ref per Open Q#4)
- `test:rls` npm script: `tsx --env-file=.env.local scripts/test-rls.ts` (target file lands in Plan 05)
- `app/.env.example` appended with two Node-only secret placeholders (SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD), each with a Swedish bilingual warning comment forbidding `EXPO_PUBLIC_` prefix (PITFALLS §2.3)
- `app/.env.local` (gitignored) carries real values; `git check-ignore` confirms tracking exclusion
- `npx supabase projects list` returns linked project entry without prompting (proves persistent login session)

## Task Commits

Each task was committed atomically:

1. **Task 1: Preflight (credentials + login + empty schema)** — pre-confirmed by orchestrator before spawn (no commit; gathering only)
2. **Task 2: Initialize Supabase CLI artifacts and link to remote project** — `9560636` (chore)
3. **Task 3: Update .env.example, install tsx, add gen:types + test:rls npm scripts** — `ee4765e` (chore)

**Plan metadata:** to be added by final commit (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md).

## Files Created/Modified

- `app/supabase/config.toml` — Supabase CLI binding to the remote project (project_id set to the remote ref)
- `app/supabase/.gitignore` — Auto-generated by `supabase init`; verified to ignore `.temp/`, `.branches/`, `.env*.local` and to NOT ignore `config.toml`
- `app/.env.example` — Added two new Node-only secret placeholders (SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD) each with a Swedish-style "NEVER EXPO_PUBLIC_" warning comment
- `app/package.json` — Added `gen:types` and `test:rls` npm scripts; added `tsx@^4.21.0` to devDependencies
- `app/package-lock.json` — Updated for tsx + transitive deps (3 new packages)
- `app/.env.local` — Populated with real `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_PASSWORD` (file is gitignored — user-side; verified via `git check-ignore`)

## Decisions Made

- **Hard-code project-ref into gen:types** (RESEARCH Open Q#4 → option 1): The literal `mokmiuifpdzwnceufduu` is embedded in the npm script. Non-sensitive (also in `EXPO_PUBLIC_SUPABASE_URL` and `config.toml`), and removes the PowerShell-vs-Bash env-var-interpolation footgun that an `${EXPO_PUBLIC_SUPABASE_PROJECT_ID}` indirection would create.
- **Update `config.toml` `project_id` field to the remote ref** (rather than CLI default `"app"`): Plan acceptance criteria require `project_id` to match PROJECT_REF. CLI 2.98 keeps the linked-ref binding in `supabase/.temp/project-ref` (which is gitignored), so editing `project_id` in `config.toml` is what makes the committed file self-documenting per artifact contract.
- **Decline VS Code/IntelliJ Deno settings** during `supabase init`: Project is a React Native / TypeScript codebase — Deno settings would pollute editor configs.
- **Add `SUPABASE_DB_PASSWORD` to .env.example** (in addition to plan-body's SERVICE_ROLE_KEY): Orchestrator success criteria required both; documenting DB_PASSWORD now (with its own Swedish warning comment) gives Plan 03 a clean precedent for `supabase db push`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `SUPABASE_DB_PASSWORD` placeholder to `app/.env.example`**
- **Found during:** Task 3 Step A
- **Issue:** Plan body Step A only documents `SUPABASE_SERVICE_ROLE_KEY`, but the orchestrator-supplied `<success_criteria>` and the plan's `must_haves.truths` (preflight #2 in Task 1) require `SUPABASE_DB_PASSWORD` to be in hand. With no placeholder in `.env.example`, a future operator setting up a fresh dev machine would have no documentation of the key's existence or its no-EXPO_PUBLIC_ rule.
- **Fix:** Added a second placeholder block with the same Swedish-style warning comment style (`# Node-only secret. NEVER prefix with EXPO_PUBLIC_…`).
- **Files modified:** `app/.env.example`
- **Verification:** `grep -c "^SUPABASE_DB_PASSWORD=" app/.env.example` → 1; `grep -c "EXPO_PUBLIC_SUPABASE_DB_PASSWORD" app/.env.example` → 0
- **Committed in:** `ee4765e` (Task 3 commit)

**2. [Rule 3 - Blocking] Updated `config.toml` `project_id` from CLI default to remote ref**
- **Found during:** Task 2 step 3 verification
- **Issue:** `npx supabase init` writes `project_id = "app"` (working-directory name), and `npx supabase link --project-ref <ref>` does NOT modify that field — it stores the linked ref in `supabase/.temp/project-ref` instead (gitignored). Plan acceptance criterion AC2 ("`project_id` value in config.toml is non-empty AND matches the PROJECT_REF from Task 1") would have failed.
- **Fix:** Edited `config.toml` to set `project_id = "mokmiuifpdzwnceufduu"`. CLI 2.98 docs note this field is a local-instance label that may be overridden — overriding it to match the remote ref makes the committed config.toml self-documenting per artifact contract `contains: "project_id"`.
- **Files modified:** `app/supabase/config.toml`
- **Verification:** `grep "^project_id" app/supabase/config.toml` → `project_id = "mokmiuifpdzwnceufduu"`; remote-link sanity check via `npx supabase projects list` shows the project as `LINKED`.
- **Committed in:** `9560636` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both auto-fixes were essential to satisfy plan acceptance criteria and orchestrator success criteria. No scope creep — both stay strictly inside Plan 01's boundary (credential/secrets/CLI surface).

## Issues Encountered

- The Supabase CLI 2.98 stores the linked-project ref in `supabase/.temp/project-ref` (a gitignored path), not in `config.toml`'s `project_id` field. Plan body assumed older CLI behavior. Resolved via Rule 3 deviation above (set `project_id` to match remote ref so the committed file carries the binding).
- `npm install --save-dev tsx@^4.21.0` reports 4 moderate-severity vulnerabilities in transitive deps (audit suggests `npm audit fix --force`). These exist in pre-existing `app/` deps from Phase 1 and are NOT introduced by tsx. Out of scope for Plan 01 (logged for future tracking; tsx itself has zero direct deps that flag).

## Service-role-key audit grep (post-Plan-01 baseline)

```
$ git grep -l "service_role\|SERVICE_ROLE" -- ':!.planning/' ':!CLAUDE.md'
.claude/get-shit-done/templates/codebase/integrations.md
.claude/get-shit-done/templates/user-setup.md
app/.env.example
```

The two `.claude/get-shit-done/templates/` matches are upstream GSD CLI template files (not project source). The only project-source match is `app/.env.example` — the new placeholder line and its warning comment, which is the expected, documented, intentional surface.

No `app/lib/`, `app/app/`, `app/components/`, or `app/scripts/` mentions exist. (`app/scripts/test-rls.ts` arrives in Plan 05.)

## User Setup Required

Already satisfied at orchestrator-spawn time. Specifically:
- `app/.env.local` already contains real values for `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, and `EXPO_PUBLIC_SUPABASE_URL` (verified).
- `npx supabase login` has run successfully (PAT persisted; `supabase projects list` works non-interactively).
- Remote project's public schema confirmed empty by user.

For Plan 02 onward: no additional user setup needed at this layer — the CLI is linked, secrets are in place, and migrations can be authored locally and pushed via `npx supabase db push` from `app/`.

## Self-Check: PASSED

Verification:

| Item | Expected | Result |
|------|----------|--------|
| `app/supabase/config.toml` exists | yes | yes (file confirmed via Read tool) |
| Commit `9560636` exists | yes | yes (verified via `git rev-parse --short HEAD` directly after commit) |
| `app/package.json` has `gen:types` | yes | yes (`grep -c '"gen:types"'` → 1) |
| `app/package.json` has `test:rls` | yes | yes (`grep -c '"test:rls"'` → 1) |
| `app/package.json` has `tsx` devDep | yes | yes (`grep -E '"tsx"'` matches) |
| `app/.env.example` has `SUPABASE_SERVICE_ROLE_KEY=` | 1 | 1 |
| `app/.env.example` has `SUPABASE_DB_PASSWORD=` | 1 | 1 |
| `app/.env.example` has `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE` | 0 | 0 |
| `git check-ignore app/.env.local` | `.env.local` | `.env.local` |
| `npx supabase projects list` works | yes | yes (linked project shown without prompts) |
| Commit `ee4765e` exists | yes | yes |

## Next Phase Readiness

- **Plan 02 (schema authoring):** Ready. The CLI is initialized, the `app/supabase/migrations/` directory will be created on first `supabase migration new`. No further setup needed.
- **Plan 03 (`supabase db push`):** Ready. `SUPABASE_DB_PASSWORD` is in `.env.local`; remote project public schema confirmed empty by user.
- **Plan 04 (type generation):** Ready. `npm run gen:types` will resolve `supabase` via `npx`; `~/.supabase/access-token` is persisted.
- **Plan 05 (cross-user RLS test):** Ready. `tsx@4.21` installed; `test:rls` script wired; `SUPABASE_SERVICE_ROLE_KEY` is in `.env.local`. `app/scripts/test-rls.ts` itself arrives in that plan.

No blockers, no concerns.

---
*Phase: 02-schema-rls-type-generation*
*Completed: 2026-05-08*
