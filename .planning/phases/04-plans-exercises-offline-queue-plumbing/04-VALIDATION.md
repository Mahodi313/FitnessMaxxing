---
phase: 4
slug: plans-exercises-offline-queue-plumbing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `04-RESEARCH.md` §10 (Validation Architecture). The planner is responsible for
> populating the per-task verification map and Wave 0 requirements during planning.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TBD by planner — extend existing `npx tsx --env-file=.env.local scripts/*.ts` convention (see `app/scripts/test-rls.ts`, `app/scripts/verify-deploy.ts`) for offline-queue + sync tests; defer Jest/Vitest install unless planner determines it's needed for slice-level tests. |
| **Config file** | `app/tsconfig.json` (strict, already present) — no test framework config required if extending `tsx`-script convention |
| **Quick run command** | `cd app && npx tsx --env-file=.env.local scripts/<test-name>.ts` (per-script) |
| **Full suite command** | `cd app && npm run test:rls && npx tsx scripts/test-offline-queue.ts && npx tsx scripts/test-sync-ordering.ts` (planner: define exact set in PLAN files) |
| **Estimated runtime** | ~30–60 seconds (network-dependent — Supabase round-trips) |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` verify command (per-task — typically `npm run typecheck` + the slice-specific tsx script)
- **After every plan wave:** Run `npm run typecheck && npm run lint && npm run test:rls`
- **Before `/gsd-verify-work`:** Full suite must be green AND the airplane-mode integration test (Manual #1 below) must be signed off
- **Max feedback latency:** 60 seconds (per-task)

---

## Per-Task Verification Map

> The planner MUST fill this table during planning. Each task in `04-XX-PLAN.md` files needs one row.
> Populate `Test Type` from {unit, integration, manual, smoke}, `Automated Command` from the script
> path, and `Threat Ref` from the per-plan `<threat_model>` block (T-04-NN IDs).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | F2/F3/F4 | T-04-NN | (planner fills) | (planner fills) | (planner fills) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The following infrastructure must exist before Wave 1 tasks can be verified. Planner: assign
each to a `wave: 0` task in the relevant plan.

- [ ] `app/scripts/test-offline-queue.ts` — proves persisted mutations survive an app force-quit (uses MMKV/AsyncStorage persister contract — fake the persister state, restart, assert flush)
- [ ] `app/scripts/test-sync-ordering.ts` — proves FK-dependent rows (workout_plans → plan_exercises) sync without `23503 foreign_key_violation` when client-supplied UUIDs are used
- [ ] `app/scripts/test-idempotency.ts` — proves `upsert(..., { onConflict: 'id', ignoreDuplicates: true })` is safe to replay without dubbletter (insert twice, assert single row)
- [ ] `app/scripts/test-reorder-two-phase.ts` — proves the two-phase reorder pattern avoids `23505 unique_violation` on `unique (plan_id, order_index)` (RESEARCH §5)
- [ ] `app/scripts/test-rls.ts` — extend with cross-user assertions for any new query/insert paths added during this phase (CLAUDE.md DB convention — non-negotiable)

If the planner adds new schema (research says none expected, but if a `pending_mutations` table or
similar is introduced):
- [ ] Migration file at `app/supabase/migrations/0002_*.sql` with paired RLS policies (CLAUDE.md DB convention)
- [ ] `app/scripts/verify-deploy.ts` re-run to confirm deployed schema matches migration source

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **Airplane-mode end-to-end** | F4 / Success Criterion #4 | Requires real iPhone in iOS airplane mode, force-quit gesture, OS-level network state. No simulator alternative for the force-quit + cold-start path. | 1. Open app on iPhone, sign in. 2. Enable airplane mode (Control Center). 3. Create plan "Test Plan", add 3 exercises. 4. Force-quit app (swipe up). 5. Reopen app — verify plan + exercises still visible. 6. Disable airplane mode. 7. Wait 5s — verify all rows landed in Supabase Studio (no FK errors, no duplicates in `workout_plans` / `plan_exercises`). |
| **Offline banner toggle** | F4 / Success Criterion #5 | Requires real OS NetInfo state changes; mocked NetInfo doesn't exercise the banner timing race. | 1. Open app online — verify no banner. 2. Enable airplane mode — verify banner appears within 2s. 3. Disable airplane mode — verify banner disappears within 2s. |
| **Drag-to-reorder feel** | F2 / Success Criterion #3 | Requires touch interaction on real device; haptic feedback and animation feel are subjective. | Long-press an exercise in plan-detail; drag to a new position; release. Verify (a) no jank, (b) order persists after pull-to-refresh, (c) order persists after force-quit + reopen. |
| **Optimistic update rollback** | F2/F3 (no explicit SC, but D-08/D-09 imply) | Requires inducing a server-side error (e.g., temporarily revoke RLS access in Studio) — destructive, must be done manually. | Disable RLS policy temporarily → attempt to create plan → verify (a) UI shows the row immediately (optimistic), (b) UI rolls back when server returns 401/403, (c) toast/error UI appears. Re-enable RLS. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (offline-queue, sync-ordering, idempotency, reorder, rls)
- [ ] No watch-mode flags (per `tsx`-script convention — scripts run once and exit)
- [ ] Feedback latency < 60s
- [ ] Manual airplane-mode test signed off before phase completion
- [ ] `nyquist_compliant: true` set in frontmatter when planner populates per-task map

**Approval:** pending — planner will mark `nyquist_compliant: true` after filling the per-task map
