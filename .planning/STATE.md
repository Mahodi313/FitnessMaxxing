---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 4 Plan 01 complete — offline-queue plumbing + Wave 0 harness (8/8 tests green)
last_updated: "2026-05-10T17:49:44.277Z"
last_activity: 2026-05-10 -- Phase 4 Plan 01 complete
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 17
  completed_plans: 14
  percent: 82
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07)

**Core value:** Logga ett set och omedelbart se vad jag tog senast på samma övning — utan att tappa data, någonsin.
**Current focus:** Phase 04 — Plan 01 complete; Plan 02 ((tabs) skeleton + plans/new + OfflineBanner) is next

## Current Position

Phase: 4
Plan: 02 (next)
Status: Plan 01 complete (offline-queue plumbing shipped); ready to execute Plan 02
Last activity: 2026-05-10 -- Phase 4 Plan 01 complete

Progress: [████████░░] 47%  (3/7 phases complete + 1/4 Phase 4 plans complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 14 (3 in Phase 1, 6 in Phase 2, 4 in Phase 3, 1 in Phase 4)
- Phases complete: 3 of 7
- Total execution time: ~3.5 active days (2026-05-07 → 2026-05-10)

**By Phase:**

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 1. Bootstrap & Infra Hardening | 3/3 | ✓ Complete | 2026-05-08 |
| 2. Schema, RLS & Type Generation | 6/6 | ✓ Complete (27/27 SECURED) | 2026-05-09 |
| 3. Auth & Persistent Session | 4/4 | ✓ Complete (UAT 9/11 pass; 2 gaps V1.1-deferred) | 2026-05-09 |
| 4. Plans, Exercises & Offline-Queue | 1/4 | ◐ In progress (Plan 01 complete — offline-queue plumbing) | — |
| 5. Active Workout Hot Path | 0/TBD | ○ Not started | — |
| 6. History & Read-Side Polish | 0/TBD | ○ Not started | — |
| 7. V1 Polish Cut | 0/TBD | ○ Not started | — |

**Plan 04-01 metrics (2026-05-10):** 5 tasks + 1 chore commit, ~20 min, 18 files created (4 query infra + 1 util + 3 schemas + 3 resource hooks + 7 test scripts), 3 files modified (_layout.tsx, auth-store.ts, package.json), 1 deleted (query-client.ts). 8/8 verification tests pass (test-rls + test-{plan,exercise,plan-exercise}-schemas + test-{reorder-constraint,upsert-idempotency,offline-queue,sync-ordering}).

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **2026-05-07**: F13 offline-stöd bumpat från Bör → Måste (driver offline-first från Phase 4)
- **2026-05-07**: F17 set-typ är schema-only i V1; UI deferred till V1.1
- **2026-05-07**: F15 dark mode = konvention från Phase 1; toggle-UI i Phase 7
- **2026-05-07**: Apple Sign-In (F14) deferred till V1.1 (App Store-blocker, inte personlig)
- **2026-05-09**: ARCHITECTURE.md §4 errata FIXED in Phase 2: `with check` added on `plan_exercises` and `exercise_sets`; `auth.uid()` wrapped as `(select auth.uid())` everywhere; `is_warmup` dropped, `set_type` ENUM added (F17 schema-only); verified live by `app/scripts/test-rls.ts` (22/22 assertions pass). See `.planning/phases/02-schema-rls-type-generation/02-02-SUMMARY.md` for the deployed migration.
- **2026-05-07**: ARCHITECTURE.md §7 ersatt av research/ARCHITECTURE.md §7 (offline-first ships i V1, inte V1.5)
- [Phase 02]: Hard-code project-ref into gen:types npm script (RESEARCH Open Q#4 → option 1) — Non-sensitive (also in EXPO_PUBLIC_SUPABASE_URL and config.toml); avoids PowerShell-vs-Bash env-var-interpolation footgun
- [Phase 02]: Set config.toml project_id field to remote ref (CLI 2.98 default is working-dir name) — Plan acceptance criteria require project_id to match PROJECT_REF; CLI link command stores binding in supabase/.temp/project-ref (gitignored), so editing config.toml's project_id makes the committed file self-documenting
- **2026-05-10 [Phase 04 Plan 01]**: TanStack v5 MutationScope.id is a STATIC string (verified via query-core/mutationCache.js scopeFor reading mutation.options.scope?.id with typeof === "string" gate). Per-call dynamic scope is NOT supported in v5; scope must be set at useMutation() instantiation. Resource hooks in lib/queries/*.ts accept a planId parameter and bake `scope: { id: 'plan:<planId>' }` into the hook. The Plan 04-01 originally specified function-scope in setMutationDefaults — corrected via auto-fix Rule 1 because function-shaped scope.id silently fails the typeof check and the mutation never enters the scope map (offline-queue serial-replay grouping breaks).
- **2026-05-10 [Phase 04 Plan 01]**: Wave 0 test scripts use networkMode: 'online' (not production's 'offlineFirst') for deterministic offline pause. With offlineFirst, mutations only pause on fetch failure; the test mutationFn does not throw, so it would succeed offline and break the persistence test. In production, Supabase fetch throws when offline so offlineFirst pause kicks in naturally. The persister contract under test (key + scope preservation across persist/restart) is mode-independent.
- **2026-05-10 [Phase 04 Plan 01]**: Wave 0 verification harness convention extends Phase 2 test-rls.ts pattern (Node-only header warning + pass/fail + try/finally cleanup + mainCompleted false-positive guard). 7 new scripts gate Pitfalls 8.1, 8.2, 8.10, 8.12, 8.13 + RESEARCH §3 (unique-constraint trap) + §5 (chained scope.id replay) regressions. All run via `npm run test:*`.

### Pending Todos

None yet.

### Blockers/Concerns

None yet — Phase 1 ready to plan.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260509-001 | Fix 5 priority items from 03-UI-REVIEW (a11y props + Lösen→Lösenord drift + RHF mode=onSubmit spec amendment + offline-error arm + banner ✕ close) | 2026-05-09 | 4af7462 | [260509-001-phase3-ui-fixes](./quick/260509-001-phase3-ui-fixes/) |

## Deferred Items

Items acknowledged for later:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Auth | F14 Apple Sign-In | V1.1 | 2026-05-07 |
| Auth | F1.1 Email-confirmation deep-link handler (Expo Linking + Supabase verifyOtp/exchangeCodeForSession) — carry-over from Phase 3 UAT 2026-05-09; closes UAT.md gap-1 + gap-2 | V1.1 (Phase 8) | 2026-05-09 |
| UI | F17 set-typ-toggling | V1.1 | 2026-05-07 |
| UI | F15 dark-mode-toggle (konvention finns från Phase 1) | V1 Phase 7 eller V1.1 | 2026-05-07 |
| Features | F18 PR-detection, F19 vilo-timer | V1.1 | 2026-05-07 |
| Platform | F20-F30 (App Store launch path) | V2 | 2026-05-07 |

## Session Continuity

Last session: 2026-05-10T17:49:44Z
Stopped at: Phase 4 Plan 01 complete (offline-queue plumbing + Wave 0 harness)
Resume file: .planning/phases/04-plans-exercises-offline-queue-plumbing/04-01-SUMMARY.md
Next: Execute Plan 04-02 (`(tabs)` skeleton with svenska labels + Planer empty-state CTA + plans/new + OfflineBanner consuming useOnlineStatus from @/lib/query/network; deletes Phase 3 (app)/index.tsx; sign-out moves to settings tab)
