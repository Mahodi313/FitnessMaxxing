---
status: partial
phase: 05-active-workout-hot-path-f13-lives-or-dies
source: [05-VERIFICATION.md]
started: 2026-05-13T20:35:00Z
updated: 2026-05-13T20:35:00Z
---

## Current Test

[awaiting human testing — F13 brutal-test full recipe deferred per user instruction at phase close]

## Tests

### 1. F13 Brutal-Test full end-to-end recipe on physical iPhone
expected: All 25 sets land in Supabase in correct set_number order with no FK/PK violations after airplane mode + force-quit + battery-pull-simulering under 25-set workout per app/scripts/manual-test-phase-05-f13-brutal.md (10-phase recipe, 244 LOC).
result: [pending]
why_human: Cannot be automated. Requires native OS lifecycle (airplane-mode toggle, force-quit via app switcher, OS-level RAM reclamation) that no test runner can simulate. Detox can airplane-mode + force-quit but cannot simulate a true battery-pull (it shuts via JS bridge, not kill -9). Maestro is similar. The Wave 0 automated scripts (test-offline-queue.ts FIFO 25-set, test-sync-ordering.ts START→25×SET→FINISH FIFO replay against real Supabase) prove the contract layer; the brutal-test is the system-level acceptance gate per CONTEXT.md F13 acceptance test.
note: Per user instruction during verification request — MH-6 was treated as partial: automated gates pass (test-offline-queue Phase 5 ext + test-sync-ordering Phase 5 ext + test-rls 38 cross-user assertions all green), manual recipe ships, code-side approved after happy-path UAT in-session (start pass, log sets, F7 chip, Avsluta + toast, cold-start overlay all verified working). Full 25-set + airplane mode + force-quit recipe was NOT executed end-to-end.

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
