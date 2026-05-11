---
phase: 4
slug: plans-exercises-offline-queue-plumbing
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-10
updated: 2026-05-11
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `04-RESEARCH.md` §10 (Validation Architecture) and back-filled
> from each plan's `<verify><automated>` block per task. The map below is the
> runtime contract `gsd-execute-phase` and `/gsd-verify-work` consult for
> sampling continuity, feedback latency, and Wave 0 completeness.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Existing `npx tsx --env-file=.env.local scripts/*.ts` convention extended (see `app/scripts/test-rls.ts`, `app/scripts/test-auth-schemas.ts`). No new framework introduced — schema tests run via plain `tsx`, integration tests use `--env-file`. |
| **Config file** | `app/tsconfig.json` (strict, already present) — no test framework config required |
| **Quick run command** | `cd app && npm run <test-name>` (per-script — see Per-Task Verification Map below) |
| **Full Wave 0 suite** | `cd app && npm run test:rls && npm run test:plan-schemas && npm run test:exercise-schemas && npm run test:plan-exercise-schemas && npm run test:reorder-constraint && npm run test:upsert-idempotency && npm run test:offline-queue && npm run test:sync-ordering` |
| **Estimated runtime** | ~60–90 seconds full Wave 0 suite (network-dependent — Supabase round-trips dominate `test:rls`, `test:reorder-constraint`, `test:upsert-idempotency`, `test:sync-ordering`) |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` verify command (per-task — typically `npm run typecheck` + the slice-specific tsx script or grep gate).
- **After every plan wave:** Run `npx tsc --noEmit && npm run lint && npm run test:rls`.
- **Before `/gsd-verify-work`:** Full Wave 0 suite must be green AND the airplane-mode integration test (Manual #1 below) must be signed off.
- **Max feedback latency:** 60 seconds per task (per-task `<automated>` block).

---

## Per-Task Verification Map

> Each row corresponds to one `<task>` in the four PLAN.md files. The
> `Automated Command` column lifts the `<verify><automated>` block verbatim
> (line-broken for readability where commands are long). `File Exists` reads
> ✅ where the script/file already exists in the repo at planning time, and
> ❌ W0 where Wave 0 (Plan 01 Tasks 2–5) is responsible for creating it.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | F2/F3/F4 | T-04-01, T-04-03, T-04-09, T-04-10, T-04-12 | Lib/query split + 8 setMutationDefaults + Zod schemas + resource hooks; module-load order load-bearing | integration | `cd app && npx tsc --noEmit && npm run lint && grep -c "setMutationDefaults" lib/query/client.ts \| awk '{ if ($1 >= 8) ... }' && grep -q "resumePausedMutations" lib/query/network.ts && grep -q "useSyncExternalStore" lib/query/network.ts && grep -q "expo-crypto" lib/utils/uuid.ts && grep -q "ignoreDuplicates: true" lib/query/client.ts && grep -q "networkMode: 'offlineFirst'" lib/query/client.ts && grep -L "mutationFn" lib/queries/*.ts && test ! -f lib/query-client.ts && grep -q "@/lib/query/client" lib/auth-store.ts && ! grep -q "@/lib/query-client" lib/auth-store.ts && ! grep -rn "from ['\"]@/lib/query-client['\"]" app/ lib/ 2>/dev/null && echo "ALL_CHECKS_PASS"` | ❌ W0 | ✅ green |
| 04-01-02 | 01 | 1 | F2/F3/F4 | T-04-03 | Wave 0 — Zod schema parse tests for plans/exercises/plan-exercises (form-input boundary) | unit | `cd app && npm run test:plan-schemas && npm run test:exercise-schemas && npm run test:plan-exercise-schemas` | ❌ W0 | ✅ green |
| 04-01-03 | 01 | 1 | F2/F3/F4 | T-04-08, T-04-10 | Wave 0 — DB integration: two-phase reorder respects unique (plan_id, order_index); upsert idempotency on replay | integration | `cd app && npm run test:reorder-constraint && npm run test:upsert-idempotency` | ❌ W0 | ✅ green |
| 04-01-04 | 01 | 1 | F2/F3/F4 | T-04-12 | Wave 0 — persister contract: paused mutation re-hydrates with intact mutationKey + meta.scope.id; resumePausedMutations fires on resume (Pitfall 8.2 + 8.12 automated gate) | integration | `cd app && npm run test:offline-queue` | ❌ W0 | ✅ green |
| 04-01-05 | 01 | 1 | F2/F3/F4 | T-04-08, T-04-10 | Wave 0 — chained createExercise + addExerciseToPlan replay in FK-safe order via shared scope.id; second replay is idempotent | integration | `cd app && npm run test:sync-ordering` | ❌ W0 | ✅ green |
| 04-02-01 | 02 | 2 | F2 | T-04-01, T-04-05, T-04-11 | (tabs) skeleton + OfflineBanner mount + (app)/index.tsx deletion; Swedish copy contract per UI-SPEC | smoke | `cd app && npx tsc --noEmit && npm run lint && test -f app/(app)/(tabs)/_layout.tsx && test -f app/(app)/(tabs)/index.tsx && test -f app/(app)/(tabs)/history.tsx && test -f app/(app)/(tabs)/settings.tsx && test -f components/offline-banner.tsx && test ! -f app/(app)/index.tsx && grep -q "OfflineBanner" app/(app)/(tabs)/_layout.tsx && grep -q "useOnlineStatus" components/offline-banner.tsx && grep -q "Du är offline — ändringar synkar när nätet är tillbaka" components/offline-banner.tsx && grep -q "Logga ut" app/(app)/(tabs)/settings.tsx && grep -q "Historik kommer i Phase 6" app/(app)/(tabs)/history.tsx && grep -q "barbell" app/(app)/(tabs)/_layout.tsx && grep -q "Planer" app/(app)/(tabs)/_layout.tsx && grep -q "Historik" app/(app)/(tabs)/_layout.tsx && grep -q "Inställningar" app/(app)/(tabs)/_layout.tsx && echo "ALL_CHECKS_PASS"` | ✅ (after Task 1 of plan 02) | ✅ green |
| 04-02-02 | 02 | 2 | F2 | T-04-01 | Planer list — empty-state, populated list, FAB; Swedish copy verbatim from UI-SPEC | smoke | `cd app && npx tsc --noEmit && npm run lint && grep -q "usePlansQuery" app/(app)/(tabs)/index.tsx && grep -q "Mina planer" app/(app)/(tabs)/index.tsx && grep -q "Inga planer än" app/(app)/(tabs)/index.tsx && grep -q "Skapa din första plan" app/(app)/(tabs)/index.tsx && grep -q "Skapa ny plan" app/(app)/(tabs)/index.tsx && grep -q "router.push.*'/plans/new'" app/(app)/(tabs)/index.tsx && grep -q "router.push.*plan.id" app/(app)/(tabs)/index.tsx && grep -q "barbell-outline" app/(app)/(tabs)/index.tsx && grep -q "absolute bottom-6 right-6" app/(app)/(tabs)/index.tsx && echo "ALL_CHECKS_PASS"` | ✅ (after Task 2 of plan 02) | ✅ green |
| 04-02-03 | 02 | 2 | F2 | T-04-03, T-04-11 | plans/new.tsx form — RHF + zodResolver + useCreatePlan + randomUUID; Swedish copy verbatim | smoke | `cd app && npx tsc --noEmit && npm run lint && test -f app/(app)/plans/new.tsx && grep -q "useCreatePlan" app/(app)/plans/new.tsx && grep -q "randomUUID" app/(app)/plans/new.tsx && grep -q "zodResolver(plansSchema)" app/(app)/plans/new.tsx && grep -q "mode: 'onSubmit'" app/(app)/plans/new.tsx && grep -q "Skapa plan" app/(app)/plans/new.tsx && grep -q "Skapar plan" app/(app)/plans/new.tsx && grep -q "t.ex. Push, Pull, Ben" app/(app)/plans/new.tsx && grep -q "(valfritt)" app/(app)/plans/new.tsx && grep -q "Valfritt — beskriv vad planen är till för" app/(app)/plans/new.tsx && grep -q "headerShown: true" app/(app)/plans/new.tsx && grep -q "title: 'Ny plan'" app/(app)/plans/new.tsx && echo "ALL_CHECKS_PASS"` | ✅ (after Task 3 of plan 02) | ✅ green |
| 04-03-01 | 03 | 3 | F2/F4 | T-04-01, T-04-03, T-04-11 | plan-detail screen — usePlanQuery + useUpdatePlan + useArchivePlan + plan_exercises FlatList + "Lägg till övning" CTA + archive overflow menu | smoke | `cd app && npx tsc --noEmit && npm run lint` (plus per-task grep gates as per the plan's `<verify><automated>` block — see 04-03-PLAN.md line 523) | ✅ (after Task 1 of plan 03) | ✅ green |
| 04-03-02 | 03 | 3 | F3/F4 | T-04-01, T-04-03, T-04-08 | exercise-picker modal — search existing + inline create-and-add with chained scope.id (FK ordering proven by 04-01-05 sync-ordering test) | smoke | `cd app && npx tsc --noEmit && npm run lint` (plus per-task grep gates per 04-03-PLAN.md line 835) | ✅ (after Task 2 of plan 03) | ✅ green |
| 04-03-03 | 03 | 3 | F2 | T-04-01, T-04-03 | plan_exercise targets edit modal — RHF + zodResolver(planExercisesSchema) + useUpdatePlanExercise | smoke | `cd app && npx tsc --noEmit && npm run lint` (plus per-task grep gates per 04-03-PLAN.md line 1032) | ✅ (after Task 3 of plan 03) | ✅ green |
| 04-04-01 | 04 | 4 | F4 | T-04-08 | DraggableFlatList integration on plan-detail; PlanExerciseRow extended with leading drag-handle; onDragEnd → useReorderPlanExercises (Plan 01's two-phase orchestrator) | smoke | `cd app && npx tsc --noEmit && npm run lint && grep -q "DraggableFlatList" app/(app)/plans/[id].tsx && grep -q "useReorderPlanExercises" app/(app)/plans/[id].tsx && grep -q "ScaleDecorator" app/(app)/plans/[id].tsx && grep -q "onDragEnd" app/(app)/plans/[id].tsx && grep -q "reorder-three-outline" app/(app)/plans/[id].tsx && grep -q "Drag för att ändra ordning" app/(app)/plans/[id].tsx && grep -q "onLongPress={drag}" app/(app)/plans/[id].tsx && ! grep -q "import.*FlatList.*from 'react-native'" app/(app)/plans/[id].tsx && echo "ALL_CHECKS_PASS"` | ✅ (after Task 1 of plan 04) | ✅ green |
| 04-04-02 | 04 | 4 | F2/F3/F4 | T-04-01 | test-rls.ts extended with cross-user gates for Phase 4 mutation paths (workout_plans archive + plan_exercises CRUD + exercises write) | integration | `cd app && npm run test:rls && grep -q "Phase 4 extension" scripts/test-rls.ts && grep -q "workout_plans archive" scripts/test-rls.ts && grep -q "plan_exercises insert" scripts/test-rls.ts && grep -q "plan_exercises update" scripts/test-rls.ts && grep -q "plan_exercises delete" scripts/test-rls.ts && grep -q "exercises insert" scripts/test-rls.ts` | ✅ (Phase 2 file, extended in Task 2 of plan 04) | ✅ green |
| 04-04-03 | 04 | 4 | F4 | T-04-09 | Manual airplane-mode acceptance checklist authored — 6 sections, banner copy verbatim, sign-off block | smoke | `test -f app/scripts/manual-test-phase-04-airplane-mode.md && grep -q "Pre-test setup" app/scripts/manual-test-phase-04-airplane-mode.md && grep -q "negative-index" app/scripts/manual-test-phase-04-airplane-mode.md && grep -q "Force-quit" app/scripts/manual-test-phase-04-airplane-mode.md && grep -q "Captive-portal" app/scripts/manual-test-phase-04-airplane-mode.md && grep -q "Du är offline — ändringar synkar när nätet är tillbaka" app/scripts/manual-test-phase-04-airplane-mode.md && grep -q "order_index" app/scripts/manual-test-phase-04-airplane-mode.md && grep -q "No duplicate rows" app/scripts/manual-test-phase-04-airplane-mode.md && grep -q "Sign-off" app/scripts/manual-test-phase-04-airplane-mode.md` | ❌ W0-equivalent (created in Task 3 of plan 04) | ✅ green |
| 04-04-04 | 04 | 4 | F4 | T-04-08, T-04-09 | Manual checkpoint — human runs the airplane-mode checklist on a real iPhone; signs off success criteria #4 + #5 | manual | `[manual] Run app/scripts/manual-test-phase-04-airplane-mode.md end-to-end on iPhone; reply "approved" or describe failures` | n/a (human action) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Per-row truncation note:** Plan 03's per-task grep gates are listed in shorthand because each block is ~600-1500 chars of grep+test commands. The actual `<verify><automated>` blocks live verbatim in `04-03-PLAN.md` at lines 523 (Task 1), 835 (Task 2), 1032 (Task 3). `gsd-execute-phase` reads from the plan files directly — this map's purpose is the wave/threat/requirement cross-reference, not full command duplication.

---

## Wave 0 Requirements

The following infrastructure must exist before downstream waves can be verified.
All five Wave 0 scripts are owned by Plan 01 (Tasks 2–5).

- [x] `app/scripts/test-plan-schemas.ts` — Zod plansSchema parse cases (Plan 01 Task 2 — Zod 4 idiom analog of test-auth-schemas.ts).
- [x] `app/scripts/test-exercise-schemas.ts` — Zod exercisesSchema parse cases (Plan 01 Task 2).
- [x] `app/scripts/test-plan-exercise-schemas.ts` — Zod planExercisesSchema parse cases including cross-field `.refine` (Plan 01 Task 2).
- [x] `app/scripts/test-reorder-constraint.ts` — proves the two-phase reorder pattern avoids `23505 unique_violation` on `unique (plan_id, order_index)` (Plan 01 Task 3 — RESEARCH §3 + §5).
- [x] `app/scripts/test-upsert-idempotency.ts` — proves `upsert(..., { onConflict: 'id', ignoreDuplicates: true })` is safe to replay without dubbletter (Plan 01 Task 3).
- [x] `app/scripts/test-offline-queue.ts` — proves the persister contract: paused mutations re-hydrate with intact `mutationKey` + `meta.scope.id` after a simulated cold-start, and `resumePausedMutations()` fires the mutationFn on resume (Plan 01 Task 4 — Issue #1 follow-up; Pitfall 8.2 + 8.12 automated regression gate).
- [x] `app/scripts/test-sync-ordering.ts` — proves chained `createExercise` + `addExerciseToPlan` replay in FK-safe order via shared `scope.id` (no `23503 foreign_key_violation`); second replay is idempotent (Plan 01 Task 5 — Issue #1 follow-up).
- [x] `app/scripts/test-rls.ts` — Phase 2 file extended in Plan 04 Task 2 with cross-user assertions for Phase 4 mutation paths (workout_plans archive + plan_exercises CRUD + exercises write — CLAUDE.md DB convention non-negotiable).

> No new schema migrations are introduced in Phase 4 (RESEARCH §7 confirmed Phase 2 schema covers all Phase 4 needs). If a future revision introduces a `pending_mutations` table or similar, an additional migration + RLS-policy-pair + `verify-deploy.ts` re-run would be required per CLAUDE.md DB convention — but that is out-of-scope for Phase 4.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **Airplane-mode end-to-end** | F4 / Success Criterion #4 | Requires real iPhone in iOS airplane mode, force-quit gesture, OS-level network state. No simulator alternative for the force-quit + cold-start path. | See `app/scripts/manual-test-phase-04-airplane-mode.md` (created in Plan 04 Task 3) — 6 sections, ~10–15 minutes wall-clock including Studio verification. |
| **Offline banner toggle** | F4 / Success Criterion #5 | Requires real OS NetInfo state changes; mocked NetInfo doesn't exercise the banner timing race. | Covered by Step 3 (banner appears within 2s of airplane-mode-on) and Step 5 (banner disappears within 2s of airplane-mode-off) of the airplane-mode checklist. |
| **Drag-to-reorder feel** | F4 / Success Criterion #3 | Requires touch interaction on real device; haptic feedback and animation feel are subjective. | Covered by Step 3 of the airplane-mode checklist (long-press an exercise, drag, release; verify no jank, order persists). |
| **Optimistic update rollback** | F2/F3 (no explicit SC, but D-08/D-09 imply) | Requires inducing a server-side error (e.g., temporarily revoke RLS access in Studio) — destructive, must be done manually. | Optional spot-check during airplane-mode test debrief: temporarily flip an RLS policy in Studio, attempt a mutation online, verify UI rollback + error UI. NOT a phase-completion gate. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (15 tasks across 4 plans — see Per-Task Verification Map above).
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (Task 04-04-04 is the only `manual` row, and it is the final phase-completion checkpoint — not a sampling gap).
- [x] Wave 0 covers all MISSING references (offline-queue, sync-ordering, idempotency, reorder-constraint, three schema parses, plus the test-rls.ts extension) — 8 items, 8 covered.
- [x] No watch-mode flags (per `tsx`-script convention — scripts run once and exit).
- [x] Feedback latency < 60s per task.
- [x] Manual airplane-mode test signed off before phase completion — user `approved` 2026-05-10 (see 04-04-SUMMARY.md "Manual UAT — All 6 Steps PASS" + 04-VERIFICATION.md SC-4).
- [x] `nyquist_compliant: true` set in frontmatter — Per-Task Verification Map populated.
- [x] `wave_0_complete: true` set in frontmatter — all Wave 0 scripts (Plan 01 Tasks 2–5) are scoped as concrete tasks with `<automated>` verify.

**Approval:** validated — Phase 4 is Nyquist-compliant. All 15 tasks have automated verify (14 of 15) or signed-off manual checkpoint (1 of 15 — 04-04-04). Cross-referenced against 04-VERIFICATION.md (5/5 SC verified 2026-05-10).

---

## Validation Audit 2026-05-11

| Metric | Count |
|--------|-------|
| Total tasks in scope | 15 |
| Rows in Per-Task Verification Map | 15 (no orphans, no missing) |
| Wave 0 scripts required | 8 |
| Wave 0 scripts on disk | 8 (test-plan-schemas, test-exercise-schemas, test-plan-exercise-schemas, test-reorder-constraint, test-upsert-idempotency, test-offline-queue, test-sync-ordering, test-rls extended) |
| Behavioral spot-checks PASS (per 04-VERIFICATION.md) | 11/11 (tsc, lint, 7×test:*, RLS, mutateAsync grep, service-role grep) |
| Gaps found | 0 |
| Resolved | 0 (none required) |
| Escalated to manual-only | 0 (1 manual checkpoint pre-existing — 04-04-04, signed off `approved`) |
| Auditor agent spawned | No (no gaps to fill) |

**Audit notes:** This was a retroactive audit of a completed phase. The VALIDATION.md was authored at planning time (2026-05-10) with all status cells `⬜ pending`; execution closed 2026-05-10T23:45Z per 04-VERIFICATION.md. Audit confirmed every automated verify block referenced in the map either (a) was executed live by `gsd-verifier` and exited green, or (b) maps to a per-task `<verify><automated>` block in the underlying PLAN that the executor ran successfully (per the 04-0N-SUMMARY.md acceptance tables). Status cells flipped from ⬜ → ✅. No test files generated; the implementation already provides full Nyquist coverage.
