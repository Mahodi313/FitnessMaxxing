---
phase: 09
slug: auth-settings-preferences
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node `tsx` scripts (no jest/vitest) — matches existing `app/scripts/*.ts` gates |
| **Config file** | none — Wave 0 adds `test-units.ts` + `test-locale-resolve.ts` |
| **Quick run command** | `npm run tsc && npm run lint` |
| **Full suite command** | `npm run test:units && npm run test:locale-resolve && npm run test:rls && npm run check:locale-parity && npm run test:f13-brutal` |
| **Estimated runtime** | ~60–90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run tsc && npm run lint`
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | 0 | SET-03 | — | kg↔lbs nearest-0.5, canonical kg storage | unit | `npm run test:units` | ❌ W0 | ⬜ pending |
| TBD | — | 0 | I18N-02 | — | System→sv for Swedish locale else en | unit | `npm run test:locale-resolve` | ❌ W0 | ⬜ pending |
| TBD | — | 1 | SET-04 | T-09-* | weekly_goal own-row RLS, 1–7 CHECK | integration | `npm run test:rls` | ✅ | ⬜ pending |

*Planner fills concrete task IDs/plans/waves. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/scripts/test-units.ts` — kg↔display conversion + nearest-0.5 lb rounding (SET-03)
- [ ] `app/scripts/test-locale-resolve.ts` — `resolveLanguage()` System/sv/en resolution (I18N-02)
- [ ] `package.json` scripts `test:units` + `test:locale-resolve` wired

*Existing infrastructure (`test:rls`, `check:locale-parity`, `verify-deploy.ts`, `test:f13-brutal`, `tsc`, `lint`) covers the remaining automated checks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sign-in/sign-up match Forge in light + dark | SKIN-01 | Presentational parity vs reference | Open both screens in Expo Go, toggle theme, compare to `forge-screens.jsx` |
| Settings screen sections + controls render | SET-01,02,05,06,07,08,09 | Presentational / interaction | Open Settings, exercise each control, verify sign-out returns to auth |
| Live language switch updates text without restart | SET-05 / I18N-02 | Live UI re-render | Change language control, confirm visible labels update immediately |
| kg/lbs toggle changes every displayed weight | SET-03 | Visual on net-new Phase 9 surfaces | Toggle units, confirm displayed values convert; storage stays kg |
| Weekly goal stepper persists to `profiles.weekly_goal` | SET-04 | DB round-trip | Set goal, reload app, confirm value persists |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
