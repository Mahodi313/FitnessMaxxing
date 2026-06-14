---
phase: 13
slug: pr-celebration-f18
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `13-RESEARCH.md` → Validation Architecture + Security Domain.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `tsx` runner over hand-written assertion scripts (NO jest/vitest in repo) — `npx tsx scripts/test-*.ts` |
| **Config file** | none — each test is a standalone `app/scripts/test-*.ts` with a `test:*` npm script |
| **Quick run command** | `npm run test:e1rm` (new — pure Epley formula, sub-second, no DB) |
| **Full suite command** | `npm run test:rls && npm run test:f13-brutal && npm run test:e1rm` |
| **Estimated runtime** | ~30–60 seconds (e1rm instant; rls + f13-brutal hit the live DB) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:e1rm` (instant — formula correctness)
- **After every plan wave:** Run `npm run test:rls && npm run test:f13-brutal` (cross-user DB isolation + hot-path regression)
- **Before `/gsd:verify-work`:** Full suite green + `npx tsx --env-file=.env.local scripts/verify-deploy.ts` clean + manual reduce-motion / haptic-gate / banner-geometry UAT
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Req | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| PR-01 | Epley e1RM correctness + D-04 `weight≤0`→0 guard + D-01 (90×10 ≈120 beats 100×5 ≈116.7) + D-02/D-03 caller guards | — | N/A (pure formula) | unit | `npm run test:e1rm` | ❌ W0 (`scripts/test-e1rm.ts`) | ⬜ pending |
| PR-01 | All-time-best reference RPC cross-user isolation | T-13-01 | RPC returns only caller's own working sets | integration | `npm run test:rls` | ✅ extend `scripts/test-rls.ts` | ⬜ pending |
| PR-04 | Chronological `get_exercise_pr_history` cross-user isolation + `was_pr` correctness on seeded progression fixture (baseline/PR edges) | T-13-01 | Caller-JWT-scoped rows; `was_pr` chronological | integration | `npm run test:rls` | ✅ extend `scripts/test-rls.ts` | ⬜ pending |
| PR-04/05 | New RPC(s) deploy as `security invoker` + `set search_path=''` | T-13-02 | INVOKER + empty search_path verified in `pg_proc` | deploy-gate | `npx tsx --env-file=.env.local scripts/verify-deploy.ts` | ✅ extend `phase13Functions` array | ⬜ pending |
| D-17 | Hot path unregressed after read-side additions | — | ≤3s log budget intact | regression | `npm run test:f13-brutal` | ✅ exists (known-amber FIT-107) | ⬜ pending |
| PR-02 | Trophy replaces green check on PR set rows (D-13) | — | N/A | manual UAT | device (Expo Go) | ❌ manual | ⬜ pending |
| PR-03 | Banner floats, never shifts the "Klart" button (D-09 geometry) | — | N/A | manual UAT | device (Expo Go) | ❌ manual | ⬜ pending |
| PR-03 / D-18 / D-19 | Haptic respects `fm:haptics`; reduce-motion snaps to final state | — | N/A | manual UAT | device (toggle OS reduce-motion + `fm:haptics`) | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/scripts/test-e1rm.ts` — covers PR-01 (Epley correctness; D-01 higher-rep-beats-heavier; D-02 first-set baseline; D-03 working-only; D-04 `weight≤0`→0) + `test:e1rm` npm script
- [ ] `app/scripts/test-rls.ts` — extend with cross-user assertions for `get_exercise_pr_history` + the best-reference RPC (CLAUDE.md "cross-user verification is a gate"); assert `was_pr` correctness on a seeded progression fixture
- [ ] `app/scripts/verify-deploy.ts` — add `phase13Functions` array (new RPC names) to the INVOKER + `search_path` `pg_proc` check (mirror existing `verify-deploy.ts` pattern)
- [ ] `app/types/database.ts` — regenerate via `npm run gen:types`, co-commit with `0012_*.sql`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trophy replaces check on PR set rows | PR-02 / D-13 | Visual in 36px column | Log a working set that beats prior best e1RM → set row shows gradient trophy, not green check; a normal row still shows check |
| Banner floats without shifting "Klart" | PR-03 / D-09 | Layout geometry / muscle-memory | Trigger a PR mid-workout → banner appears as floating overlay; set list, input row, and "Klart" button do NOT move |
| Banner sweep + scale entrance + auto-dismiss | PR-03 / D-10 | Animation feel (§07 spring) | PR banner scales 0.96→1 with gradient sweep, dwells ~3–4s, fades out without a tap |
| Haptic gated by `fm:haptics` | PR-03 / D-18 | OS haptic engine | Toggle `fm:haptics` off → no PR haptic; on → `notificationSuccess` fires |
| Reduce-motion snaps to final | D-19 | OS accessibility setting | Enable OS reduce-motion → banner + trophy render with no animation (snap), still readable |
| Offline PR detection over local cache | PR-01 | Airplane-mode device state | Airplane mode → log a PR → trophy + banner still fire from last-synced best-reference cache |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (or are listed Manual-Only)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`test-e1rm.ts`, `test-rls.ts` extension, `verify-deploy.ts` array, `gen:types`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
