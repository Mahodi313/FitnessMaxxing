---
phase: 14-rest-timer-f19-research-flagged
plan: 02
subsystem: rest-timer
tags: [rest-timer, expo-notifications, zustand, deep-link, fail-soft, tdd, m4-anti-phishing]

# Dependency graph
requires:
  - phase: 14-rest-timer-f19-research-flagged
    plan: 01
    provides: "lib/rest-timer.ts pure predicates (extendEndTs, decideNotificationAction) + expo-notifications ~0.32.17 install"
  - phase: 12-forge-redesign
    plan: 11
    provides: "lib/units-store.ts plain-create Zustand shape (no persist) cloned for rest-timer-store"
  - phase: 04-plans-exercises-offline-queue
    plan: 01
    provides: "lib/query/network.ts globalThis Fast-Refresh sentinel pattern (APPSTATE_BGFLUSH_KEY) cloned for the notification-response listener"
provides:
  - "app/lib/notifications.ts — fail-soft expo-notifications wrapper (scheduleRestNotification/cancelNotification/ensureNotificationPermission/getPermissionState) + granted|denied|blocked permission state machine"
  - "app/lib/rest-timer-store.ts — plain-create Zustand single owner of {endTs, notificationId} with start/extend/skip/finish; cancel-before-reschedule on every transition; callable via getState() from outside React"
  - "app/app/_layout.tsx — module-scope setNotificationHandler (current shouldShowBanner/shouldShowList fields) + Fast-Refresh-guarded notification-tap response listener routing a validated sessionId into (app)/workout/[sessionId] only (M4)"
  - "app/scripts/test-rest-timer-store.ts + test:rest-timer-store npm script (15 assertions, DB-free, require-cache expo-notifications stub)"
affects: [14-03-settings-toggle, 14-04-notification-scheduler]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-soft native I/O wrapper: every expo-notifications call returns null / warns-and-swallows so a failure never rejects into the fire-and-forget hot-path caller (D-12)"
    - "Cancel-before-reschedule store transitions: every endTs replacement cancels the stored notificationId FIRST, then schedules + stores the new id (Pitfall 6)"
    - "Require-cache native-module stub for Node tsx unit tests of a store that transitively imports a native module (test-units-store precedent extended to expo-notifications)"

key-files:
  created:
    - app/lib/notifications.ts
    - app/lib/rest-timer-store.ts
    - app/scripts/test-rest-timer-store.ts
  modified:
    - app/app/_layout.tsx
    - app/package.json

key-decisions:
  - "DATE-typed trigger (SchedulableTriggerInputTypes.DATE + new Date(endTs)) over TIME_INTERVAL — maps 1:1 to the stored absolute endTs (reschedule correctness) and sidesteps the sub-1s TIME_INTERVAL throw (Pitfall 4)"
  - "notification data payload carries ONLY {sessionId} — no exercise/weight/PII on the lock screen (D-15 / T-14-04)"
  - "store is a plain create (NO persist middleware) — timer state is transient OS-clock-backed, not a durable pref; durable pieces live in prefs.ts (units-store precedent)"
  - "notification tap validates sessionId is a non-empty string before router.push, routes only into the in-app (app)/workout/ group — never Linking.openURL of an external URL (M4 anti-phishing, T-14-03)"
  - "Fast-Refresh-guarded response listener via new globalThis sentinel __fitnessmaxxing_notif_response_sub__ — one listener, one route push per tap (Pitfall 7 / T-14-06)"

patterns-established:
  - "A store that transitively pulls a native module is unit-tested in Node tsx by pre-seeding the require cache with a recording stub of that native module before importing the store"

requirements-completed: [TIMER-03, TIMER-05]

# Metrics
duration: ~5min
completed: 2026-06-15
---

# Phase 14 Plan 02: Rest-Timer Native + State Spine Summary

**The fail-soft `expo-notifications` wrapper (`notifications.ts`), the plain-create Zustand single owner of `endTs`+`notificationId` (`rest-timer-store.ts`) that cancels-before-reschedules on every transition, and the `_layout.tsx` module-scope foreground handler + Fast-Refresh-guarded tap-response listener that deep-links a validated `sessionId` into the in-app workout route only — the native + state spine TIMER-03/TIMER-05 hang on, with a 15-case store unit test and the device-UAT tap route deferred to the phase gate.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-15T18:23:33Z
- **Completed:** 2026-06-15
- **Tasks:** 3 (Task 2 was TDD: RED → GREEN; Task 3 checkpoint:human-verify — implementation done, device-UAT deferred)
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- **Fail-soft notifications wrapper** (`app/lib/notifications.ts`, 169 lines): `scheduleRestNotification(endTs, content)` (DATE trigger, `sessionId`-only `data` payload, returns `null` on failure), `cancelNotification(id)` (no-op on null, warn-and-swallow), `getPermissionState()` (read-only) + `ensureNotificationPermission()` (in-context prompt, D-13) both mapping the OS permission to the `granted | denied | blocked` state machine. Every native I/O call is fail-soft (D-12) — a failure never rejects into the fire-and-forget caller; the in-app countdown keeps running. tsc 0, lint clean. Uses `SchedulableTriggerInputTypes.DATE` (not the deprecated bare trigger); `data` contains only `sessionId` (no exercise/weight/PII, T-14-04).
- **Zustand store** (`app/lib/rest-timer-store.ts`, 128 lines): a plain `create<RestTimerState>` (NO persist — units-store precedent) owning `{ endTs, notificationId }` + `start/extend/skip/finish`. Every transition that replaces the schedule cancels the stored id FIRST then reschedules + stores the new id (cancel-before-reschedule, Pitfall 6 / D-07). `skip()`/`finish()` cancel-and-clear. Consumes `extendEndTs` + `decideNotificationAction` (rest-timer.ts) and `scheduleRestNotification`/`cancelNotification` (notifications.ts) — no logic re-derived. Reachable via `getState()` from outside React for Plan 04's `onKlart` + the banner controls.
- **TDD store test** (`app/scripts/test-rest-timer-store.ts` + `test:rest-timer-store` script): 15 assertions covering the full state machine + cancel-before-reschedule ORDERING (asserts `cancel` precedes the next `schedule` in an ordered call-log), the `sessionId`-only payload, and the stored-id round-trip. RED (MODULE_NOT_FOUND) → GREEN (15/15) committed separately. The store transitively imports `expo-notifications` (breaks under Node tsx) — solved by pre-seeding the require cache with a recording stub (test-units-store precedent).
- **`_layout.tsx` wiring**: module-scope `setNotificationHandler` with the CURRENT `shouldShowBanner`/`shouldShowList` fields (grep for `shouldShowAlert` returns 0); a Fast-Refresh-guarded `addNotificationResponseReceivedListener` (new `__fitnessmaxxing_notif_response_sub__` globalThis sentinel cloned from network.ts) that VALIDATES `data.sessionId` is a non-empty string before `router.push('/(app)/workout/${sessionId}')` — routes only into the authenticated `(app)` group, never `Linking.openURL` of an external URL (M4 anti-phishing, T-14-03).

## Task Commits

1. **Task 1: fail-soft notifications.ts wrapper + permission state machine** — `233a1f3` (feat)
2. **Task 2 (TDD): rest-timer-store.ts Zustand owner**
   - RED: `b2052e1` (test) — failing store test (MODULE_NOT_FOUND), 15-case cancel-before-reschedule coverage + require-cache stub
   - GREEN: `85cb521` (feat) — store created, 15/15 cases pass
   - REFACTOR: none needed (implementation already minimal)
3. **Task 3: _layout.tsx notification handler + tap deep-link** — `90a28d3` (feat) — implementation done; device-UAT DEFERRED

**Plan metadata:** _(this SUMMARY + STATE/ROADMAP commit)_

## Files Created/Modified

- `app/lib/notifications.ts` (created) — fail-soft expo-notifications wrapper + permission state machine
- `app/lib/rest-timer-store.ts` (created) — plain-create Zustand owner of endTs + notificationId
- `app/scripts/test-rest-timer-store.ts` (created) — 15-case Node-only store unit test
- `app/app/_layout.tsx` (modified) — module-scope setNotificationHandler + Fast-Refresh-guarded tap-response listener
- `app/package.json` (modified) — test:rest-timer-store script

## Deferred Checkpoint (Task 3 — device-UAT)

**Status: PENDING device-UAT — NOT passed.** Task 3 is a `checkpoint:human-verify` (gate=blocking). All code is implemented and committed (`90a28d3`); the automated checks pass (tsc 0, `shouldShowAlert` grep = 0, lint clean). The human-verify gate is recorded here as DEFERRED because this run has no physical iPhone. The user must verify on a real device (Expo Go SDK 54) per the plan's `<how-to-verify>` — this likely runs alongside Plan 03 (permission grant) + Plan 04 (auto-start), which supply the enable + auto-start path:

1. From `app/`, `npx expo start`, open in Expo Go on a real iPhone.
2. Enable the rest timer (grant permission), log a working set, home-swipe out, wait for the rest to elapse.
3. Assert the "Vilan är slut" notification fires while backgrounded (TIMER-03).
4. TAP the notification → assert the app opens `(app)/workout/[sessionId]` for the SAME session (D-15 deep-link).
5. Hot-reload the screen 2–3× and tap once more → assert exactly ONE route push (no listener stacking, Pitfall 7).

The orchestrator surfaces this device-UAT item at phase end. Do not mark TIMER-03's background-delivery + D-15 tap-route as verified until the on-device pass is recorded.

## Decisions Made

None beyond the plan-specified decisions (DATE trigger, sessionId-only payload, plain-create store, M4 in-app-route-only tap, Fast-Refresh sentinel). Followed the plan as written.

## Deviations from Plan

**1. [Rule 3 — Blocking issue] `shouldShowAlert` literal in an explanatory comment tripped the grep-0 acceptance gate**
- **Found during:** Task 3
- **Issue:** The acceptance criterion "grep for shouldShowAlert returns 0" matched a doc comment that referenced the deprecated field by name to explain why it is avoided. The handler itself correctly uses `shouldShowBanner`/`shouldShowList`.
- **Fix:** Rephrased the comment ("the deprecated single-alert field") so the literal token no longer appears anywhere in the file — grep now returns 0 unambiguously.
- **Files modified:** `app/app/_layout.tsx`
- **Commit:** `90a28d3`

## Issues Encountered

None. The require-cache expo-notifications stub resolved the Node-tsx native-module boundary cleanly on the first run (test-units-store precedent); 15/15 store cases pass.

## Threat surface scan

No new trust boundaries beyond the plan's `<threat_model>`. T-14-03 (deep-link) mitigated by the non-empty-string `sessionId` validation + in-app-route-only `router.push` (no `Linking.openURL`). T-14-04 (lock-screen) mitigated by the `{sessionId}`-only `data` payload. T-14-05 (stale ping) mitigated by cancel-before-reschedule + skip/finish-clears-id. T-14-06 (duplicate listeners) mitigated by the globalThis sentinel teardown. T-14-07 (schedule-without-permission) is a CALLER-side D-14 gate (Plan 03/04) — the wrapper exposes `getPermissionState`/`ensureNotificationPermission` for it. No threat flags raised.

## Known Stubs

None. `notifications.ts`, `rest-timer-store.ts`, and the `_layout.tsx` wiring are complete deliverables. The consumers that drive them — Settings enable/permission (Plan 03) and the auto-start `onKlart` + countdown banner (Plan 04) — are owned by later plans by design (this is the native + state spine, Wave 2).

## User Setup Required

None at build time. OS notification permission is requested at runtime by Plan 03 (Settings enable, D-13), not a build-time setup step.

## Next Phase Readiness

- **14-03 (Settings toggle + duration picker)** imports `ensureNotificationPermission`/`getPermissionState` (the granted|denied|blocked machine) for the D-13 in-context prompt + D-11 row state.
- **14-04 (notification scheduler / auto-start banner)** imports `useRestTimerStore` (`getState().start(...)` fire-and-forget after `addSet.mutate`, D-05) + the banner controls call `.skip()`/`.extend()`; the foreground handler + tap deep-link are already live in `_layout.tsx`.
- Gates green: `test:rest-timer-store` (15/15), `test:rest-timer` (23/23), `tsc --noEmit` 0, `expo lint` 0, `shouldShowAlert` grep 0, `test:f13-brutal` exit 0 (no-recent-session no-op, FIT-107 window).
- **Outstanding:** the Task 3 device-UAT (TIMER-03 background ping + D-15 tap route + Pitfall-7 single push) — deferred to the phase gate, requires a physical iPhone.

## Self-Check: PASSED

All created files exist on disk and all task commits are present in git history (see below).

---
*Phase: 14-rest-timer-f19-research-flagged*
*Completed: 2026-06-15*
