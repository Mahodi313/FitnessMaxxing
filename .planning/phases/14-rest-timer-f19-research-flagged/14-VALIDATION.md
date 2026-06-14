---
phase: 14
slug: rest-timer-f19-research-flagged
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `14-RESEARCH.md` → "Validation Architecture". Notification *delivery* (TIMER-03)
> and on-device background reconcile (TIMER-02) are device-UAT-only — un-assertable in CI.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `tsx` Node scripts (Case[]-table + loop + exit-code skeleton, mirrors `app/scripts/test-units.ts` / `test-e1rm.ts`) |
| **Config file** | none — each test is a standalone `npm run test:*` script in `app/package.json` |
| **Quick run command** | `npm run test:rest-timer` (NEW — added in Wave 0) |
| **Full suite command** | existing `test:*` scripts incl. `npm run test:f13-brutal` (must stay green) |
| **Estimated runtime** | ~1 second (pure-logic gate) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:rest-timer` (pure-logic gate; <1s)
- **After every plan wave:** Run the full `test:*` suite incl. `npm run test:f13-brutal`
- **Before `/gsd:verify-work`:** Full suite green **plus** a device-UAT pass covering TIMER-02 (background reconcile), TIMER-03 (background ping), TIMER-05 (cancel / no-stale ping), D-13 (permission prompt), D-15 (tap → workout route)
- **Max feedback latency:** ~1 second (unit) / device-UAT at phase gate

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-W0-01 | W0 | 0 | TIMER-01/02/04/05 + SET-07 | — | Pure-logic test stub red until logic lands | unit | `npm run test:rest-timer` | ❌ W0 | ⬜ pending |
| 14-xx-01 | logic | 1 | TIMER-02 | — | `remainingMs(endTs, now)` re-derives from stored timestamp, never JS interval | unit | `npm run test:rest-timer` | ❌ W0 | ⬜ pending |
| 14-xx-02 | logic | 1 | TIMER-02 | — | `formatMSS(ms)` renders fixed-width `M:SS` (tabular) | unit | `npm run test:rest-timer` | ❌ W0 | ⬜ pending |
| 14-xx-03 | logic | 1 | TIMER-05 | T-14 (notif leak) | `decideNotificationAction(event)` → skip=cancel, +30s=cancel+reschedule, next-set=cancel+reschedule | unit | `npm run test:rest-timer` | ❌ W0 | ⬜ pending |
| 14-xx-04 | logic | 1 | SET-07 / D-14 | — | `shouldFireNotification(timerOn, masterOn, permGranted)` true only when all three hold | unit | `npm run test:rest-timer` | ❌ W0 | ⬜ pending |
| 14-xx-05 | prefs | 1 | TIMER-04 | — | `fm:restSeconds` / `fm:restTimerEnabled` round-trip; default 120 / OFF; corrupt→default | unit | `npm run test:rest-timer` | ❌ W0 | ⬜ pending |
| 14-xx-06 | hotpath | 2 | F13 guard | — | Auto-start is fire-and-forget; hot path + offline queue untouched | regression | `npm run test:f13-brutal` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Concrete Task IDs are assigned by the planner; this map fixes the test TYPE and command per requirement.*

---

## Wave 0 Requirements

- [ ] `app/lib/rest-timer.ts` — pure module the test imports (must exist before the test): `remainingMs`, `formatMSS`, `decideNotificationAction`, `shouldFireNotification`, extend-end math
- [ ] `app/scripts/test-rest-timer.ts` — Case[] table covering TIMER-01/02/04/05 + SET-07 gate (mirrors `scripts/test-units.ts`)
- [ ] `app/package.json` script: `"test:rest-timer": "tsx scripts/test-rest-timer.ts"`
- [ ] Device-UAT checklist markdown (mirrors `scripts/manual-test-phase-06-uat.md`) for TIMER-02/03 + D-13/D-15

*`tsx` is already in devDependencies — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Local notification fires when rest ends while backgrounded | TIMER-03 | Notification delivery is native; un-assertable in CI | Enable timer (grant permission), log a working set, home-swipe out, wait for rest to elapse → assert "Vilan är slut" notification fires |
| Countdown correct after backgrounding | TIMER-02 | Background reconcile needs a real device + real suspension | Start rest, background ≥30s, foreground → assert remaining time = endTs − now (not frozen, not drifted) |
| Skip / next-set cancels the scheduled ping | TIMER-05 | Verifies no stale OS notification after cancel | Start rest, background, then (a) skip or (b) log next set → assert NO ping fires at the original end time |
| Permission prompt in Settings | TIMER-04 / D-13 | OS prompt UX is native | Toggle timer ON in Settings → assert iOS permission prompt; deny → assert in-app countdown still works + denied helper text |
| Notification tap deep-links to active workout | D-15 | Native notification-response routing | Tap the fired notification → assert app opens `(app)/workout/[sessionId]` for the correct session |
| D-14 gating matrix (master toggle) | SET-07 / D-14 | OS-level fire gating | Toggle `fm:notifications` OFF with timer ON → assert in-app countdown runs but NO OS notification |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`rest-timer.ts`, `test-rest-timer.ts`, npm script, UAT checklist)
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
