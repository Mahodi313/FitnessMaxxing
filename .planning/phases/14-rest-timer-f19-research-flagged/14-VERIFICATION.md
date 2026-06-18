---
phase: 14-rest-timer-f19-research-flagged
verified: 2026-06-15T19:30:00Z
status: human_needed
score: 8/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Enable rest timer in Settings on a real iPhone (Expo Go SDK 54). Log a working-set Klart. Home-swipe out, wait for the rest period to elapse."
    expected: "The 'Vilan är slut' / 'Rest is over' local notification fires while the app is backgrounded (TIMER-03). A banner notification appears on the lock screen with generic text only (no exercise/weight — D-15)."
    why_human: "OS-level notification delivery while the JS thread is suspended cannot be tested from Node or a static grep. Requires a physical device with Expo Go running the signed-in app."

  - test: "After the backgrounded notification fires, TAP the notification. Then hot-reload the workout screen 2-3 times and tap the notification again."
    expected: "Tapping the notification deep-links directly to (app)/workout/[sessionId] for the SAME session (D-15). After hot-reloads, exactly ONE route push happens per tap — no listener stacking (Pitfall 7)."
    why_human: "Deep-link routing from an OS notification tap and Fast-Refresh listener teardown require on-device execution. The globalThis sentinel teardown can only be confirmed by observing at runtime."

  - test: "Enable the rest timer in Settings (toggle ON). Observe the iOS permission prompt. Deny it. Check the Settings row."
    expected: "The iOS notification-permission prompt fires when the toggle is turned ON (D-13, calm in-context moment). After denial, the timer is STILL enabled and a muted (non-red) 'restNoPermission' helper appears beneath the row (D-12). The helper is NOT shown in danger/error color."
    why_human: "OS permission prompt and its relationship to the in-app enable state must be observed on a real device. The muted-vs-danger color difference requires visual inspection."

  - test: "Open the duration picker (chevron on the restTimer row). Select '3 min'. Force-kill and reopen the app."
    expected: "The duration picker shows presets (1 min / 1:30 / 2 min / 3 min / 5 min) plus an 'Anpassad' custom entry. After selecting '3 min' and restarting the app, the Settings row reads 'Pa · 3 min' (the choice is persisted in fm:restSeconds via AsyncStorage, TIMER-04)."
    why_human: "ActionSheetIOS picker appearance and pref persistence across restart require on-device execution."

  - test: "Start a workout. Log a WORKING set with the timer enabled — assert the floating rest-countdown banner appears WITHOUT the set list, input row, or Klart button shifting (D-01 / TIMER-01). Then log a WARMUP set — assert no rest starts (D-06)."
    expected: "The banner is a floating absolute overlay. The set list, input row, and Klart button stay in exactly the same positions. No rest banner appears after a warmup/dropset/failure set."
    why_human: "Banner geometry (float vs. layout-shift) and the working-set-only filter require on-device visual inspection."

  - test: "While a rest is counting down, background the app for at least 30 seconds, then foreground it."
    expected: "The M:SS numeral shows the reconciled remaining time (e.g. if 90s was the total and 30s elapsed while backgrounded, it shows ~1:00 or less). The countdown was NOT frozen at the value when backgrounded (TIMER-02 AppState reconcile)."
    why_human: "JS thread suspension during backgrounding and AppState reconcile cannot be verified by static analysis. Requires a device where the JS thread genuinely sleeps."

  - test: "Log a set that is BOTH a personal record AND starts a rest (timer enabled). Observe the overlay sequence."
    expected: "The PR celebration banner plays first (~3-4 seconds). The rest-timer banner takes the top slot AFTER the PR banner exits (D-04). The countdown started at log-time regardless — the displayed remaining time is accurate, not off by 3-4 seconds."
    why_human: "The temporal ordering of overlay slots (PR-then-timer handoff) and the logical-start-vs-visual-mount distinction require on-device observation."

  - test: "Use iOS Accessibility Settings to enable Reduce Motion. Log a working set with the timer enabled."
    expected: "The rest-timer banner entry animation snaps (no translateY/scale transition) but the M:SS numeral still ticks down correctly (D-19). The banner is still fully visible and interactive."
    why_human: "iOS Reduce Motion only takes effect when the system setting is active. Cannot mock this in a Node test."
---

# Phase 14: Rest Timer (F19) Verification Report

**Phase Goal:** Add a rest timer that survives backgrounding by scheduling an OS notification, with Settings control.
**Verified:** 2026-06-15T19:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | rest-timer.ts is a pure Node-importable module exporting remainingMs, formatMSS, decideNotificationAction, shouldFireNotification, extendEndTs | VERIFIED | File at `app/lib/rest-timer.ts` — zero React/Expo/native imports; all 5 exports confirmed; `npm run test:rest-timer` exits 0, 23/23 cases pass |
| 2 | The countdown M:SS numeral is re-derived from the stored endTs every render, never a decrementing counter (TIMER-02) | VERIFIED | `grep -c remainingSeconds RestTimerBanner.tsx` returns 0; `formatMSS(remainingMs(endTs, Date.now()))` is the only value-derivation path; a display-only `setInterval(forceTick,1000)` bumps tick state only; AppState 'active' listener forces re-render on foreground |
| 3 | fm:restSeconds (default 120) and fm:restTimerEnabled (default OFF) are corrupt-tolerant typed prefs | VERIFIED | `app/lib/prefs.ts` lines 59-86: `restSecondsSchema = z.coerce.number().int().positive().catch(120)`, `restTimerEnabledSchema = z.enum(["true","false"]).catch("false").transform(...)`, both wired into PrefMap and SCHEMAS |
| 4 | Every new timer i18n key exists in both sv.json and en.json at parity (sv/en each at 202 keys) | VERIFIED | Node parity check run live: 202/202 keys each; all 10 keys (restSkip, restAdd30, restLabel, restDuration, restCustom, restNoPermission, restDoneTitle, restDoneBody, on, off) confirmed present in both locales |
| 5 | expo-notifications is installed at ~0.32.17 (SDK-54 line) and registered in app.json plugins | VERIFIED | `app/package.json` line 64: `"expo-notifications": "~0.32.17"`; `app/app.json` plugins array contains `"expo-notifications"` bare-string entry |
| 6 | The auto-start hook fires AFTER addSet.mutate, never awaited, never before — F13 sacred (TIMER-01 / D-05) | VERIFIED | `addSet.mutate` at line 674; `useRestTimerStore.getState().start(...)` at line 725 — confirmed 51 lines after the mutate; wrapped in `void getPref(...).then(...)` chain (never awaited); `npm run test:f13-brutal` exits 0 (no-recent-session no-op, FIT-107 window) |
| 7 | Only set_type='working' sets auto-start a rest (D-06) | VERIFIED | `onKlart` logs exactly `set_type: "working"` at line 683; no other call site calls `useRestTimerStore.getState().start()`; warmup/dropset/failure sets never reach `onKlart` |
| 8 | The Settings restTimer row shows enable/disable + duration, calls ensureNotificationPermission on enable, persists fm:restTimerEnabled even when denied (D-12/D-13) | VERIFIED | `settings.tsx` lines 371-378: `onRestTimerToggle` calls `ensureNotificationPermission()`, sets `permState`, then ALWAYS `setPref("fm:restTimerEnabled", true)` regardless of grant; `restNoPermission` helper rendered when `restTimerEnabled && permState !== "granted"` |
| 9 | A local notification fires when rest ends, including when backgrounded (TIMER-03) | UNCERTAIN — device-UAT required | `scheduleRestNotification` in `notifications.ts` uses `SchedulableTriggerInputTypes.DATE` trigger with `date: new Date(endTs)`; fail-soft wrapper; code is complete. CANNOT verify OS delivery without a physical device. |
| 10 | Tapping the notification deep-links into the correct workout session with no listener stacking (D-15 / Pitfall 7) | UNCERTAIN — device-UAT required | `_layout.tsx` validates `data.sessionId` is a non-empty string then calls `router.push('/(app)/workout/${sessionId})'`; globalThis sentinel `__fitnessmaxxing_notif_response_sub__` tears down and re-registers on Fast Refresh. `shouldShowAlert` grep returns 0 (current API used). Code is complete. CANNOT verify on-device tap routing without a physical device. |

**Score:** 8/10 (2 truths deferred to device-UAT)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/lib/rest-timer.ts` | Pure rest-timer math + decision predicates | VERIFIED | 91 lines, 5 exports, zero React/Expo imports, Pitfall-5 guards |
| `app/scripts/test-rest-timer.ts` | 23-case Node unit test | VERIFIED | `import from "../lib/rest-timer"` confirmed; `npm run test:rest-timer` → 23/23 pass |
| `app/lib/prefs.ts` | fm:restSeconds + fm:restTimerEnabled typed prefs | VERIFIED | Both keys in PrefMap and SCHEMAS with corrupt-tolerant schemas |
| `app/locales/sv.json` | Swedish timer strings | VERIFIED | 10 keys present; 202 total keys |
| `app/locales/en.json` | English timer strings at parity | VERIFIED | 10 keys present; 202 total keys; parity confirmed |
| `app/scripts/manual-test-phase-14-uat.md` | Device-UAT checklist with TIMER-03 | VERIFIED | File exists; contains TIMER-03, TIMER-02, TIMER-05, D-13, D-15, SET-07/D-14 sections |
| `app/lib/notifications.ts` | fail-soft expo-notifications wrapper + permission state machine | VERIFIED | 169 lines; exports scheduleRestNotification, cancelNotification, ensureNotificationPermission, getPermissionState, PermissionState; DATE trigger; sessionId-only data payload |
| `app/lib/rest-timer-store.ts` | Plain-create Zustand owner of endTs + notificationId | VERIFIED | 128 lines; plain `create<RestTimerState>` (no persist); start/extend/skip/finish; cancel-before-reschedule confirmed |
| `app/app/_layout.tsx` | setNotificationHandler + Fast-Refresh-guarded tap listener | VERIFIED | `setNotificationHandler` at module scope with `shouldShowBanner`/`shouldShowList` (not shouldShowAlert); globalThis sentinel teardown present |
| `app/components/ui/RestTimerBanner.tsx` | Floating countdown banner | VERIFIED | 267 lines; imports `remainingMs`/`formatMSS` from rest-timer.ts; `useRestTimerStore`; no `remainingSeconds` state; `fontVariant: ["tabular-nums"]`; bg/radius in className, shadow inline; `[Hoppa över]` = neutral ghost, `[+30s]` = accent-soft |
| `app/app/(app)/workout/[sessionId].tsx` | Auto-start hook + banner mount | VERIFIED | `useRestTimerStore.getState().start` at line 725 (after mutate at 674); RestTimerBanner mounted in existing absolute overlay slot at lines 520-521; finish() called at line 1546 |
| `app/app/(app)/(tabs)/settings.tsx` | restTimer row + duration picker + permission prompt | VERIFIED | `fm:restTimerEnabled` and `ensureNotificationPermission` both present; duration picker with presets 60/90/120/180/300 + Anpassad; `restNoPermission` muted helper |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/scripts/test-rest-timer.ts` | `app/lib/rest-timer.ts` | import of pure functions | WIRED | `from "../lib/rest-timer"` import confirmed |
| `app/package.json` | `app/scripts/test-rest-timer.ts` | test:rest-timer npm script | WIRED | `"test:rest-timer": "tsx scripts/test-rest-timer.ts"` confirmed |
| `app/lib/rest-timer-store.ts` | `app/lib/notifications.ts` | schedule/cancel calls inside actions | WIRED | `scheduleRestNotification`/`cancelNotification` imported and called in start/extend/skip/finish |
| `app/lib/rest-timer-store.ts` | `app/lib/rest-timer.ts` | extendEndTs / decideNotificationAction | WIRED | Both imported and used in extend/start/skip actions |
| `app/app/_layout.tsx` | `(app)/workout/[sessionId]` | router.push on validated notification tap | WIRED | `router.push('/(app)/workout/${sessionId}')` guarded by non-empty-string check; no Linking.openURL |
| `app/app/(app)/(tabs)/settings.tsx` | `app/lib/notifications.ts` | ensureNotificationPermission on enable | WIRED | `ensureNotificationPermission` imported at line 69; called in `onRestTimerToggle` on enable |
| `app/app/(app)/(tabs)/settings.tsx` | `app/lib/prefs.ts` | getPref/setPref for fm:restTimerEnabled + fm:restSeconds | WIRED | `fm:restSeconds` pattern confirmed in settings.tsx; both prefs loaded in mount effect and persisted in handlers |
| `app/components/ui/RestTimerBanner.tsx` | `app/lib/rest-timer.ts` | remainingMs/formatMSS for the display numeral | WIRED | `import { formatMSS, remainingMs } from "@/lib/rest-timer"` at line 62 |
| `app/components/ui/RestTimerBanner.tsx` | `app/lib/rest-timer-store.ts` | useRestTimerStore for endTs + skip/extend | WIRED | `import { useRestTimerStore } from "@/lib/rest-timer-store"` at line 63; endTs subscribed at line 98 |
| `app/app/(app)/workout/[sessionId].tsx` | `app/lib/rest-timer-store.ts` | getState().start after addSet.mutate | WIRED | `useRestTimerStore.getState().start` at line 725, confirmed after mutate at line 674 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `RestTimerBanner.tsx` | `endTs` (from store) | `useRestTimerStore((s) => s.endTs)` — set by `start()` which sets `Date.now() + durationMs` | Yes — derived from real clock at set-log time | FLOWING |
| `RestTimerBanner.tsx` | `figure` (M:SS numeral) | `formatMSS(remainingMs(endTs, Date.now()))` computed each render | Yes — live clock delta, no hardcoded value | FLOWING |
| `settings.tsx` | `restTimerEnabled`, `restSeconds`, `permState` | `getPref("fm:restTimerEnabled")`, `getPref("fm:restSeconds")`, `getPermissionState()` loaded on mount | Yes — reads from AsyncStorage and OS permission state | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 23 pure-logic cases for remainingMs / formatMSS / extendEndTs / shouldFireNotification / decideNotificationAction | `npm run test:rest-timer` | 23/23 PASS, exit 0 | PASS |
| 15 store state-machine cases including cancel-before-reschedule ordering | `npm run test:rest-timer-store` | 15/15 PASS, exit 0 | PASS |
| F13 hot-path integrity (addSet.mutate path untouched) | `npm run test:f13-brutal` | exit 0 (no session in last 60 min — FIT-107 environmental window, not a regression) | PASS |
| TypeScript compilation | `npx tsc --noEmit` | No output = 0 errors | PASS |
| Lint | `npx expo lint` | 0 errors, 0 warnings | PASS |
| expo-notifications at SDK-54 line | `node -e "const v=require('./package.json').dependencies['expo-notifications']; console.log(v)"` | `~0.32.17` — starts with `~0.32` | PASS |
| i18n sv/en parity (10 keys, equal count) | Node parity guard | 202/202 keys; all 10 timer keys present in both locales | PASS |
| shouldShowAlert absent from _layout.tsx | grep | 0 matches | PASS |
| remainingSeconds absent from RestTimerBanner.tsx | grep | 0 matches | PASS |
| service-role key absent from client-side code | `git grep "service_role\|SERVICE_ROLE" -- app/lib/ app/app/ app/components/` | 0 matches | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or applicable for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TIMER-01 | 14-01, 14-04 | Completing a set can auto-start a rest countdown | VERIFIED (code); device-UAT geometry pending | Fire-and-forget `getState().start()` at line 725 after mutate at line 674; working-set-only gating free from `set_type:"working"` |
| TIMER-02 | 14-01, 14-04 | Countdown stays correct after backgrounding (timestamp-reconciled) | VERIFIED (code); device-UAT reconcile pending | `formatMSS(remainingMs(endTs, Date.now()))` re-derived each render; AppState 'active' listener forces re-render; no decrementing counter state |
| TIMER-03 | 14-02 | Local notification fires when rest ends, even backgrounded | UNCERTAIN — device-UAT required | `scheduleRestNotification` uses DATE trigger; fail-soft wrapper; code complete. OS delivery unverifiable without device |
| TIMER-04 | 14-03 | Default rest duration and enable/disable configurable in Settings, gated by permission | VERIFIED (code); device-UAT permission prompt pending | Settings row with toggle, duration picker (60/90/120/180/300 + Anpassad), `ensureNotificationPermission` on enable, `restNoPermission` helper |
| TIMER-05 | 14-02, 14-04 | Dismissing or starting the next set cancels the scheduled notification | VERIFIED (code); device-UAT stale-ping test pending | `skip()` calls `cancelNotification`; `start()` calls `cancelNotification` before `scheduleRestNotification`; 15/15 store tests confirm ordering |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No blockers found |

No `TBD`, `FIXME`, or `XXX` markers in any Phase 14 modified files. The one `return null` in RestTimerBanner.tsx (line 148) is the correct guard for when no timer is running — not a stub.

### Human Verification Required

**All 8 device-UAT items below require a physical iPhone running Expo Go SDK 54. These were explicitly deferred by the executor because no physical device was available during the automated run. They are NOT passed and must be verified before the phase can be marked complete.**

---

#### 1. TIMER-03: Backgrounded notification fires

**Test:** Enable rest timer in Settings (grant permission), log a working-set Klart, home-swipe out, wait for the full rest duration to elapse.
**Expected:** The "Vilan är slut" / "Rest is over" local notification fires on the lock screen while the app is backgrounded. Notification content is generic i18n text only (no exercise name, weight, reps — D-15 lock-screen privacy).
**Why human:** OS-level notification delivery while the JS thread is suspended cannot be asserted from a Node test. Requires a device where the Expo Go runtime actually sleeps.

---

#### 2. D-15: Notification tap deep-links to correct session; Pitfall 7: no listener stacking

**Test:** After the backgrounded notification fires (test 1), TAP the notification. Then hot-reload the workout screen 2-3 times in Expo Go and tap again.
**Expected:** Tapping routes to `(app)/workout/[sessionId]` for the same session that triggered the rest. After hot-reloads, exactly ONE route push happens per tap (the `__fitnessmaxxing_notif_response_sub__` globalThis sentinel prevents stacking).
**Why human:** Notification tap routing and Fast-Refresh listener teardown require the native notification response event, which only fires on-device.

---

#### 3. D-13: Permission prompt fires on enable; D-12: denial still enables

**Test:** Reset Expo Go notification permission in iOS Settings. Toggle the rest timer ON in the app Settings screen.
**Expected:** The iOS notification-permission prompt fires (D-13 — calm in-context moment). If permission is denied, the timer row stays enabled and a muted (NOT red / NOT danger) "Notiser av — vilan räknas ändå ner i appen." helper appears beneath the row (D-12). If permission is blocked, the helper is a tappable link to iOS Settings.
**Why human:** iOS permission prompt requires a real device. The muted-vs-danger color distinction requires visual inspection.

---

#### 4. TIMER-04: Duration picker persists across restart

**Test:** Open the duration picker (chevron on the restTimer row). Select "3 min". Force-kill and reopen the app.
**Expected:** The action sheet shows presets (1 min / 1:30 / 2 min / 3 min / 5 min) plus "Anpassad". After selecting 3 min and restarting, the Settings row reads "Pa · 3 min" (fm:restSeconds persisted to AsyncStorage).
**Why human:** ActionSheetIOS appearance and AsyncStorage persistence across a real app restart require on-device execution.

---

#### 5. TIMER-01 + D-01: Banner geometry (float, not shift); D-06: warmup does not trigger

**Test:** Start a workout. Log a WORKING set with the timer enabled. Then log a WARMUP set.
**Expected:** After the working set: a floating rest-countdown banner appears at the top of the screen; the set list, input row, and Klart button stay in exactly the same positions (D-01 — no layout shift). After the warmup set: no rest banner appears (D-06 working-only gating).
**Why human:** Layout shift vs. floating overlay requires visual inspection of the actual rendered layout on a device. The banner geometry cannot be asserted by static analysis.

---

#### 6. TIMER-02: Background reconcile

**Test:** Start a rest countdown. Background the app for at least 30 seconds. Return to the foreground.
**Expected:** The M:SS numeral shows the reconciled remaining time (if 90s total and 30s elapsed while backgrounded, the display reads ~60s or less immediately on foreground, not the frozen value from when the app was backgrounded).
**Why human:** JS thread suspension during backgrounding and AppState reconcile require a device where the thread genuinely sleeps.

---

#### 7. D-04: PR-then-timer handoff; logical timer start vs. visual mount

**Test:** Log a set that earns a new personal best while the timer is enabled.
**Expected:** The PR celebration banner plays first (~3-4 seconds). The rest-timer banner takes the top slot after the PR banner exits. The displayed countdown reflects the time since the set was LOGGED (not since the PR banner cleared) — i.e., the endTs was set at log-time.
**Why human:** The temporal ordering of the PR and timer overlays, and the logical-start-vs-visual-mount distinction, can only be confirmed by watching the sequence play out on device.

---

#### 8. D-19: Reduce-motion snap with numeral still ticking

**Test:** Enable Reduce Motion in iOS Accessibility Settings. Log a working set with the timer enabled.
**Expected:** The rest-timer banner entry animation snaps (no translateY / scale spring transition). The M:SS numeral still ticks down correctly. The banner is fully visible and both controls are tappable.
**Why human:** iOS Reduce Motion is a system setting that only takes effect on a real device. `useReducedMotion()` returns `false` in all Node/simulator environments without the flag.

---

### Gaps Summary

No code-level gaps were found. All 10 PLAN must-have truths are implemented in the codebase:

- **Plan 14-01:** pure rest-timer.ts module, 23-case unit test, fm:restSeconds/fm:restTimerEnabled prefs, sv/en i18n parity, expo-notifications ~0.32.17 install, device-UAT checklist — all verified.
- **Plan 14-02:** fail-soft notifications.ts wrapper, plain-create Zustand rest-timer-store, _layout.tsx notification handler + tap deep-link — all verified. Device-UAT for TIMER-03 + D-15 tap route deferred.
- **Plan 14-03:** Settings restTimer row, duration picker (5 presets + Anpassad), ensureNotificationPermission on enable, D-12 enable-regardless-of-grant, restNoPermission muted helper — all verified. Device-UAT for permission prompt and duration persistence deferred.
- **Plan 14-04:** RestTimerBanner (tabular-nums, re-derived M:SS, AppState reconcile, spring+reduce-motion, 44px controls), auto-start fire-and-forget after addSet.mutate (line 725 > 674), D-04 PR-then-timer handoff, finish() on session-end — all verified. Device-UAT for geometry, reconcile, handoff, reduce-motion deferred.

The phase is CODE-COMPLETE. The 8 open items are all device-UAT behavioral checkpoints that require a physical iPhone. No implementation gaps were found.

---

_Verified: 2026-06-15T19:30:00Z_
_Verifier: Claude (gsd-verifier) — initial verification, no previous VERIFICATION.md_
