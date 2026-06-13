---
phase: 12
slug: history-detail-chart-home-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | tsc + eslint (Expo) + project node scripts (verify-deploy, test-rls, test:f13-brutal) |
| **Config file** | `app/tsconfig.json`, `app/.eslintrc` (eslint-config-expo) |
| **Quick run command** | `npm run typecheck` (from `app/`) |
| **Full suite command** | `npm run typecheck && npm run lint && npm run test:rls && npm run test:f13-brutal` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` (quick)
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green; `verify-deploy.ts` confirms deployed RPC state
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner fills) | — | — | DASH-05 | T-12-* | New RPCs are `security invoker` + RLS-scoped; no cross-user leakage | integration | `npm run test:rls` | ❌ W0 | ⬜ pending |
| (planner fills) | — | — | DASH-01..04 | — | Dashboard aggregates render real per-user data | manual/UAT | device UAT | ❌ W0 | ⬜ pending |
| (planner fills) | — | — | SKIN-06 | — | Re-skinned screens compile + lint clean | unit | `npm run typecheck && npm run lint` | ✅ | ⬜ pending |
| (planner fills) | — | — | MOTN-02/03 | — | Animations honor reduce-motion; chart line draws on mount | manual/UAT | device UAT | ❌ W0 | ⬜ pending |
| (planner fills) | — | — | SKIN-08 (F13) | — | Hot path untouched | integration | `npm run test:f13-brutal` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Note: gsd-planner refines this map from final PLAN.md task IDs during/after planning.*

---

## Wave 0 Requirements

- [ ] `app/scripts/test-rls.ts` — extend with cross-user assertions for each new RPC (`get_dashboard_summary`, `get_exercise_summary`)
- [ ] `app/scripts/verify-deploy.ts` — add new RPC function names to the pg_proc check
- [ ] `npm run gen:types` — regenerate `app/types/database.ts` after migration `0011_*`

*Existing tsc/eslint/test:f13-brutal infrastructure covers the re-skin + hot-path constraints.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Activity-ring fill 0→value on mount; overflow glow at >100% | MOTN-02 / DASH-01 / D-19 | Visual animation, Skia canvas | Open Planer tab on device; observe ring animate; log >goal sessions, observe overflow treatment |
| Chart line draws left→right on mount; sparkline draws in | MOTN-03 / DASH-04 | Visual animation | Open exercise chart + History volume card; observe draw-on-mount |
| Reduce-motion snaps to final values | MOTN-02/03 / D-18 | OS-level setting | Enable iOS Reduce Motion; reopen screens; confirm instant final state |
| Re-skinned screens match Forge mocks | SKIN-06 | Visual fidelity vs `forge-screens.jsx` | Device UAT against FHistory/FSessionDetail/FChart/FHome |
| Empty-state (0 finished sessions) zeroed hero + nudge | DASH-05 / D-04 | Requires brand-new-user data state | Fresh account / empty cache; confirm zeroed hero + "Logga ditt första pass" |
| lbs unit converts every figure (per-set, top-set, volume, axes) | SKIN-06 / D-20 | Cross-screen display correctness | Toggle lbs in Settings; verify no mixed-unit screen |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (test-rls, verify-deploy, gen:types)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
