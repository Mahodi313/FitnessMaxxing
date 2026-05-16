---
phase: 6
slug: history-read-side-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `06-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Custom Node-script harness via `tsx --env-file=.env.local` (Phase 2 convention; matches existing `test:*` npm scripts — NOT Jest/Vitest) |
| **Config file** | none — each script is self-contained at `app/scripts/test-*.ts` |
| **Quick run command** | `cd app && npm run test:rls` |
| **Full suite command** | `cd app && npm run test:rls && npm run test:session-schemas && npm run test:set-schemas && npm run test:last-value-query && npm run test:exercise-chart` |
| **Estimated runtime** | ~30 s quick / ~90 s full on local network |

---

## Sampling Rate

- **After every task commit:** `cd app && npm run test:rls` (cross-user gate — always cheap)
- **After every chart-touching task commit:** `cd app && npm run test:exercise-chart` (≤30s wall time)
- **After every plan wave:** Full suite command above + airplane-mode UAT smoke pass on iPhone
- **Before `/gsd-verify-work 6`:** Full suite green + manual UAT signed off in `06-HUMAN-UAT.md`
- **Max feedback latency:** ~30 s for quick path; ~90 s for full

---

## Per-Task Verification Map

> Filled by `gsd-planner` against the actual PLAN.md task IDs. The mapping below is the Req→Test fan-out from RESEARCH.md § Validation Architecture and is the source the planner MUST translate into per-task `<automated>` blocks.

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| F9 | RPC `get_session_summaries` returns finished sessions DESC with set_count + total_volume_kg + plan_name | Integration (RPC against deployed Supabase) | `npm run test:exercise-chart` | ❌ Wave 0 |
| F9 | User B's RPC call returns zero rows for User A's sessions (RLS-scoped) | Integration cross-user | `npm run test:rls` (EXTEND) | ❌ Wave 0 |
| F9 | DELETE session as User B against User A returns 0-rows-affected (RLS write-block) | Integration cross-user | `npm run test:rls` (EXTEND) | ❌ Wave 0 |
| F9 | DELETE session cascades to exercise_sets via FK on delete cascade | Integration | `npm run test:rls` (EXTEND) | ❌ Wave 0 |
| F9 | Pagination terminates when last page < 20 rows (`getNextPageParam → undefined`) | Integration | `npm run test:exercise-chart` — seed 25, paginate to empty | ❌ Wave 0 |
| F9 | Offline cache hydration shows history-list without nät on cold start | Manual UAT | iPhone airplane-mode test | manual (Wave 0 — `manual-test-phase-06-uat.md`) |
| F10 | RPC `get_exercise_chart` returns day-aggregate max(weight_kg) over a time window | Integration | `npm run test:exercise-chart` | ❌ Wave 0 |
| F10 | RPC returns day-aggregate sum(weight_kg * reps) for `metric='volume'` | Integration | `npm run test:exercise-chart` | ❌ Wave 0 |
| F10 | RPC filters `set_type = 'working'` (warmup/dropset/failure excluded) | Integration | `npm run test:exercise-chart` | ❌ Wave 0 |
| F10 | RPC respects RLS (User B can't see User A's exercise data via chart RPC) | Integration cross-user | `npm run test:rls` (EXTEND) | ❌ Wave 0 |
| F10 | `<CartesianChart data={...}>` does NOT re-mount on parent re-render (memoization contract) | Manual UAT | Real-device — tap metric-toggle, observe no stutter | manual |
| F10 | Empty-state renders when `chartData.length === 0` | Manual UAT | Real-device — exercise w/0 sets | manual |
| F10 | Single-point state renders single dot + caption | Manual UAT | Real-device — log 1 set, navigate to chart | manual |
| F10 | `useChartPressState` tooltip appears on tap-and-hold | Manual UAT | Real-device — tap-and-hold a data point | manual |

---

## Wave 0 Requirements

- [ ] `app/scripts/test-exercise-chart.ts` — NEW; covers F9 (`get_session_summaries`) + F10 (`get_exercise_chart`) integration assertions: cross-user RLS, pagination termination, set_type filter, metric values, 0/1/2+ data-point edges
- [ ] `app/scripts/test-rls.ts` — EXTEND with: (a) cross-user history-list via RPC empty for B against A, (b) cross-user delete-session 0-rows-affected, (c) FK cascade on delete-session purges `exercise_sets`, (d) cross-user chart-query empty for B against A's exercise
- [ ] `app/package.json` — add `test:exercise-chart` npm script
- [ ] `app/scripts/manual-test-phase-06-uat.md` — Phase 6 UAT checklist for offline hydration + chart rendering + delete-pass flow (mirrors Phase 4 + 5 manual-test markdowns)
- [ ] No new test-framework install needed — `tsx` + `@supabase/supabase-js` already in devDependencies

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Offline cache hydration | F9 | Real iOS network stack + AsyncStorage + TanStack persister timing can't be reproduced in Node | Airplane-mode → force-quit → reopen — list visible immediately |
| Chart memoization (no re-mount) | F10 | Animation stutter only observable on device; React DevTools-mount-count assertion impractical via tsx harness | Tap metric-toggle 5×, observe line transition smoothly with no full re-mount flash |
| Empty / 1-pt / multi-pt chart rendering | F10 | Pixel rendering of Skia surface | iPhone UAT — three exercises seeded with 0 / 1 / N sets respectively |
| `useChartPressState` tooltip on tap-and-hold | F10 | Gesture system is iOS-native; can't exercise from Node | Real-device — tap-and-hold any data point, verify tooltip bubble appears with weight + date |
| Delete-pass inline-overlay UX + `router.replace` flow | F9 | Navigation stack + reanimated transition need real device | UAT — open `/history/<id>`, tap "..." → "Ta bort", confirm, verify back at history list with toast |
| Plan-detail chart-icon hit-target ≥44pt | F10 (D-24) | Tap-target measurement on physical screen | UAT — open plan-detail, tap chart icon on each row, verify reachable without missed taps |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are flagged for manual UAT in plan
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ Wave 0 references above
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s (quick) / < 90 s (full)
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 lands

**Approval:** pending
