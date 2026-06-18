---
phase: 14-rest-timer-f19-research-flagged
plan: 01
subsystem: testing
tags: [rest-timer, expo-notifications, prefs, i18n, zod, tdd, pure-module]

# Dependency graph
requires:
  - phase: 13-pr-celebration-f18
    provides: "lib/e1rm.ts pure-module structure (header + Pitfall-5 guard idiom) cloned for rest-timer.ts"
  - phase: 09-auth-settings-preferences
    provides: "lib/prefs.ts typed corrupt-tolerant fm:* read/write wrappers extended here"
provides:
  - "app/lib/rest-timer.ts — pure Node-importable rest-timer math + decision predicates (remainingMs, formatMSS, extendEndTs, shouldFireNotification, decideNotificationAction)"
  - "app/scripts/test-rest-timer.ts + test:rest-timer npm script (23 Case[] assertions, DB-free, <1s)"
  - "fm:restSeconds (default 120) + fm:restTimerEnabled (default OFF) typed prefs"
  - "10 rest-timer i18n keys at sv/en parity (202 keys each)"
  - "expo-notifications ~0.32.17 installed (SDK-54 line) + registered in app.json plugins"
  - "app/scripts/manual-test-phase-14-uat.md — 6 native-only device-UAT rows"
affects: [14-02-banner-countdown, 14-03-settings-toggle, 14-04-notification-scheduler]

# Tech tracking
tech-stack:
  added: [expo-notifications@~0.32.17]
  patterns:
    - "Pure-module-first Wave-0 scaffold: testable logic + predicates extracted to a React/Expo-free module before any screen consumes them (e1rm.ts/units.ts lineage)"
    - "TIMER-02 re-derive-from-absolute-endTs (no decrementing counter — survives JS-thread suspension)"
    - "D-14 all-three notification gate centralized as a single predicate"

key-files:
  created:
    - app/lib/rest-timer.ts
    - app/scripts/test-rest-timer.ts
    - app/scripts/manual-test-phase-14-uat.md
  modified:
    - app/lib/prefs.ts
    - app/locales/sv.json
    - app/locales/en.json
    - app/package.json
    - app/app.json

key-decisions:
  - "remainingMs/formatMSS re-derive from absolute endTs against now (TIMER-02) — never a drifting counter; non-finite → 0/0:00 (Pitfall-5)"
  - "formatMSS uses Math.ceil so 1ms still shows 0:01 (a timer never reads 0:00 while time is genuinely left)"
  - "fm:restTimerEnabled defaults OFF (opt-in master rest-timer toggle); fm:restSeconds defaults 120 (D-10)"
  - "decideNotificationAction: skip→cancel, extend/nextSet→reschedule (TIMER-05/D-03/D-07) — old schedule never left to fire stale"

patterns-established:
  - "Pure logic + decision predicates land in a Node-importable module in Wave 0 so parallel Wave-3 screens import instead of re-deriving"
  - "New fm:* prefs use the established z.coerce/.catch enum-catch corrupt-tolerance idiom (throw-free over unknown)"

requirements-completed: [TIMER-01, TIMER-02, TIMER-04, TIMER-05]

# Metrics
duration: ~14min
completed: 2026-06-15
---

# Phase 14 Plan 01: Rest-Timer Test Scaffold Summary

**Pure Node-importable rest-timer math + decision predicates (remainingMs/formatMSS/extendEndTs/shouldFireNotification/decideNotificationAction) with a 23-case unit test, two corrupt-tolerant fm:rest* prefs, 10 sv/en-parity i18n keys, expo-notifications ~0.32.17, and a 6-row device-UAT checklist — the Wave-0 scaffold every later Phase-14 plan builds on.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-15T18:15:15Z
- **Completed:** 2026-06-15
- **Tasks:** 3 (Task 2 was TDD: RED → GREEN)
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- **Pure rest-timer module** (`app/lib/rest-timer.ts`): five exports with the exact `<interfaces>` signatures, Pitfall-5 non-finite guards, TIMER-02 derive-from-endTs, D-02 +30s, D-14 all-three gate. 0 React/Expo/native imports — verified Node-importable under `tsx`.
- **TDD unit test + script**: `test-rest-timer.ts` (23 Case[] assertions covering every behavior bullet) + `test:rest-timer` npm script. RED (MODULE_NOT_FOUND) → GREEN (23/23 pass) committed separately.
- **Two corrupt-tolerant prefs**: `fm:restSeconds` (`z.coerce.number().int().positive().catch(120)`, T-14-01) + `fm:restTimerEnabled` (enum-catch→false, T-14-02) wired into `PrefMap` + `SCHEMAS`. Round-trip smoke proved garbage/zero/negative/null all fall back to defaults without throwing.
- **i18n at parity**: 10 new flat keys (`restSkip`/`restAdd30`/`restLabel`/`restDuration`/`restCustom`/`restNoPermission`/`restDoneTitle`/`restDoneBody`/`on`/`off`) in both `sv.json` and `en.json`; counts equal at 202 each; existing `cancel` reused (no duplicate).
- **expo-notifications** installed via `npx expo install` → resolved SDK-54 line `~0.32.17` (avoided the npm-latest SDK-56 trap, RESEARCH §Pitfall 1); registered as a bare-string app.json plugin (no prebuild config for Expo Go).
- **Device-UAT checklist** (`manual-test-phase-14-uat.md`): one section per 14-VALIDATION §Manual-Only Verification — TIMER-03 (backgrounded ping), TIMER-02 (background reconcile), TIMER-05 (skip/next-set cancels), TIMER-04/D-13 (permission prompt + deny-still-counts), D-15 (tap → workout route), SET-07/D-14 (master-toggle gating matrix).

## Task Commits

1. **Task 1: Install expo-notifications + register app.json plugin** — `d501333` (feat)
2. **Task 2 (TDD): pure rest-timer.ts + Case[] test + npm script**
   - RED: `3e96d4c` (test) — failing test, module not yet created
   - GREEN: `76540d5` (feat) — module created, 23/23 cases pass
   - REFACTOR: none needed (implementation already minimal)
3. **Task 3: fm:rest* prefs + timer i18n at parity + device-UAT checklist** — `e6a76f0` (feat)

**Plan metadata:** _(this SUMMARY + STATE/ROADMAP commit)_

## Files Created/Modified

- `app/lib/rest-timer.ts` (created) — pure rest-timer math + decision predicates
- `app/scripts/test-rest-timer.ts` (created) — 23-case Node-only unit test
- `app/scripts/manual-test-phase-14-uat.md` (created) — native-only device-UAT checklist
- `app/lib/prefs.ts` (modified) — fm:restSeconds + fm:restTimerEnabled schemas/PrefMap/SCHEMAS
- `app/locales/sv.json` (modified) — 10 Swedish timer keys
- `app/locales/en.json` (modified) — 10 English timer keys at parity
- `app/package.json` (modified) — expo-notifications dep + test:rest-timer script
- `app/app.json` (modified) — expo-notifications plugin entry

## Decisions Made

None beyond the plan-specified decisions (TIMER-02 derive-from-endTs, D-02 +30s, D-14 gate, D-10 default 120, OFF default for the master toggle). Followed the plan as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- An inline `tsx -e "..."` prefs round-trip smoke produced no output (esbuild eval quirk with imports + process.exit). Re-ran the same assertions from a `.mjs` file inside the `app/` cwd so `node_modules` resolved — all 8 corrupt-tolerance cases PASS. The temp file was removed; no untracked artifact remains. Not a code defect — only a one-off verification-harness quirk.

## Threat surface scan

No new trust boundaries beyond the plan's `<threat_model>`. T-14-01 (`fm:restSeconds`) and T-14-02 (`fm:restTimerEnabled`) are mitigated by the catch-parse schemas as planned; T-14-SC (expo-notifications postinstall) accepted per RESEARCH §Package Legitimacy (first-party Expo module, `npx expo install` SDK-pinned). No threat flags raised.

## Known Stubs

None. The pure module + prefs + i18n + UAT checklist are complete deliverables; the screens that consume them are owned by Plans 14-02/03/04 by design (Wave-0 scaffold).

## User Setup Required

None - no external service configuration required. (OS notification permission is requested at runtime by Plan 14-04, not a build-time setup step.)

## Next Phase Readiness

- **14-02 (banner/countdown)** imports `remainingMs`/`formatMSS`/`extendEndTs` + the i18n keys — zero invention needed.
- **14-03 (Settings toggle + duration picker)** consumes `fm:restSeconds`/`fm:restTimerEnabled` + `restDuration`/`restCustom`/`on`/`off` keys.
- **14-04 (notification scheduler)** consumes `shouldFireNotification`/`decideNotificationAction` + `restDoneTitle`/`restDoneBody` + the installed `expo-notifications` + app.json plugin.
- Gates green: `test:rest-timer` (23/23), i18n parity (202/202), `tsc --noEmit` 0, `expo lint` 0.

## Self-Check: PASSED

All created files exist on disk (rest-timer.ts, test-rest-timer.ts, manual-test-phase-14-uat.md, 14-01-SUMMARY.md) and all four task commits are present in git history (d501333, 3e96d4c, 76540d5, e6a76f0).

---
*Phase: 14-rest-timer-f19-research-flagged*
*Completed: 2026-06-15*
