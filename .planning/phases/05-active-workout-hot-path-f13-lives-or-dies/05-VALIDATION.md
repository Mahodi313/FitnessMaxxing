---
phase: 5
slug: active-workout-hot-path-f13-lives-or-dies
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source-of-truth: `05-RESEARCH.md` § Validation Architecture (filled in by gsd-planner during planning).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual UAT + tsx-script verification (inherited from Phase 4 — no jest/vitest install in V1; see RESEARCH.md "Validation Architecture") |
| **Config file** | none — Wave 0 may add `app/scripts/verify-phase-05.ts` per RESEARCH file list |
| **Quick run command** | `cd app && npx tsx --env-file=.env.local scripts/verify-deploy.ts` (schema/RLS drift) |
| **Full suite command** | `cd app && npm run test:rls && npx tsx --env-file=.env.local scripts/verify-phase-05.ts` (TBD by planner) |
| **Estimated runtime** | ~15–30 seconds for the script gate; ~10–15 minutes for the F13 brutal-test manual UAT |

---

## Sampling Rate

- **After every task commit:** Run quick command above (only when SQL/RLS or auth-touching code is modified)
- **After every plan wave:** Run full suite (planner sets the exact command in PLAN.md `<verification>`)
- **Before `/gsd-verify-work`:** Full suite + F13 brutal-test manual UAT MUST pass
- **Max feedback latency:** 30 seconds for automated; manual F13 test gated to phase verification only

---

## Per-Task Verification Map

*Filled in by the planner during planning. Every task ID gets one row here once `*-PLAN.md` files exist. Re-running `/gsd-plan-phase 5` after planning, or running `/gsd-validate-phase 5`, refreshes this section.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD     | TBD  | TBD  | TBD         | TBD        | TBD             | TBD       | TBD               | ❌ W0       | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Per RESEARCH.md § Validation Architecture, Phase 5 has three Wave 0 surfaces (planner finalizes):

- [ ] `app/scripts/verify-phase-05.ts` — script-level gate covering: (a) idempotent set-insert behaviour against a real session, (b) FIFO replay of paused mutations on reconnect, (c) draft-session-recovery query returns the in-progress session
- [ ] Extension to `app/scripts/test-rls.ts` — cross-user CRUD assertions for `workout_sessions` + `exercise_sets` (per CLAUDE.md "Cross-user verification is a gate")
- [ ] `app/scripts/manual-test-phase-05-f13-brutal.md` — the 10-phase manual recipe from RESEARCH.md (airplane mode + force-quit at 2 checkpoints + battery-pull simulation + 25-set workout + reconnect + Supabase Studio verification)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| F13 brutal-test (25 sets survive airplane + force-quit + battery-pull) | F13, success-criterion 6 | Detox/Maestro cannot fully simulate iOS background-eviction + battery pull on a physical device; this is the existential phase test | `app/scripts/manual-test-phase-05-f13-brutal.md` (Wave 0 deliverable above) |
| Per-set persistence ≤3 s perceived (button-press → "loggat"-state) | F6, success-criterion 2 | Subjective UX latency; needs physical device timing | Manual stopwatch test, ≥10 reps, document p50/p95 |
| Draft-session-recovery overlay on cold-start | F13, success-criterion 5 | Requires actual cold-launch of the iOS process | Force-quit mid-workout, open app from springboard, verify overlay appears |
| Avsluta-pass confirmation flow (no Discard option) | success-criterion 4 | UI-flow inspection | Tap Avsluta, verify no Discard CTA exists, confirm → home |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s for automated tasks
- [ ] F13 brutal-test recipe shipped as `app/scripts/manual-test-phase-05-f13-brutal.md`
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills the Per-Task Verification Map

**Approval:** pending
