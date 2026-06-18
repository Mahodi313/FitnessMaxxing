---
phase: 14-rest-timer-f19-research-flagged
plan: 03
subsystem: settings-ui
tags: [rest-timer, settings, permission-prompt, duration-picker, d-12, d-13, timer-04, forge-ui]

# Dependency graph
requires:
  - phase: 14-rest-timer-f19-research-flagged
    plan: 01
    provides: "fm:restTimerEnabled / fm:restSeconds typed corrupt-tolerant prefs + restDuration/restCustom/restNoPermission/on/off i18n keys"
  - phase: 14-rest-timer-f19-research-flagged
    plan: 02
    provides: "ensureNotificationPermission/getPermissionState granted|denied|blocked permission state machine (lib/notifications.ts)"
  - phase: 09-auth-settings-preferences
    plan: 02
    provides: "settings.tsx onNotificationsToggle set-state-then-persist shape + openUnitsSheet ActionSheetIOS picker idiom + SettingsRow/SettingsSection primitives"
provides:
  - "settings.tsx rest-timer enable Toggle (D-13 in-context permission prompt on enable; D-12 enables regardless of grant)"
  - "settings.tsx duration picker (presets 60/90/120/180/300s + Anpassad custom entry) persisting fm:restSeconds (TIMER-04)"
  - "settings.tsx restNoPermission muted helper (forge-text2, never danger) with blocked → Linking.openSettings affordance"
  - "formatRestLabel(sec) seconds→'2 min'/'1:30' row-value formatter + REST_PRESETS"
affects: [14-04-notification-scheduler]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Enable-toggle WITH in-context OS permission prompt: ensureNotificationPermission on enable, reflect granted|denied|blocked into row, persist enable regardless of grant (D-12/D-13)"
    - "Dual-control SettingsRow: enable Toggle (row.toggle) coexisting with a tappable duration disclosure hosted in the control slot (row-level onPress is suppressed when toggle is set)"
    - "Custom numeric entry via iOS Alert.prompt (number-pad) interpreted as minutes, clamped 1..60 + read-side catch-parse (defence-in-depth, T-14-08)"

key-files:
  created: []
  modified:
    - app/app/(app)/(tabs)/settings.tsx

key-decisions:
  - "Duration sub-control lives in the SettingsRow `control` slot (a Pressable value+chevron) so the enable Toggle and the duration disclosure coexist in one row — SettingsRow renders value/control/toggle/chevron in sequence, and the row-level onPress is suppressed when toggle is set, so a separate Pressable is the clean way to make the duration tappable"
  - "Custom entry interprets the numeric input as MINUTES (the picker speaks minutes), coerces to seconds, guards non-finite/<=0, and clamps to 1..60 min before persisting — defence-in-depth on top of the read-side z.coerce.number().int().positive().catch(120) (T-14-08)"
  - "restNoPermission helper rendered only when restTimerEnabled && permState !== 'granted'; muted forge-text2 (D-12 informational, never forge-danger); blocked → tappable Linking.openSettings (RESEARCH Pattern 4)"
  - "formatRestLabel: whole minutes → '{n} min', non-whole → M:SS — matches UI-SPEC §Copywriting row-value shape; 'min' is a bare token in both locales per the design specimen (no new i18n key)"

requirements-completed: [TIMER-04]

# Metrics
duration: ~8min
completed: 2026-06-15
---

# Phase 14 Plan 03: Rest-Timer Settings Control Summary

**The TIMER-04 Settings surface — a `clock` SettingsRow with an enable Toggle that fires the OS notification-permission prompt in-context on enable (D-13) yet always enables the in-app countdown regardless of grant (D-12), a tappable duration disclosure (value `På · 2 min` / `Av`) opening an ActionSheet of presets 60/90/120/180/300 + an `Anpassad` custom minutes entry that persists `fm:restSeconds`, and a muted `forge-text2` denied-permission helper (never danger red) that taps to iOS Settings when blocked — all composed on the existing Forge primitives with the master bell row left untouched.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-15T18:32Z (approx)
- **Completed:** 2026-06-15
- **Tasks:** 2 (both `type="auto"`; Task 2 carries a device-UAT `<human-check>` deferred to the phase gate)
- **Files modified:** 1 (settings.tsx)

## Accomplishments

- **Task 1 — state + mount-load** (`7577b41`): added `restTimerEnabled` (default OFF) + `restSeconds` (default 120) + `permState` (`PermissionState`, default "denied") state beside the existing notifications switches; hydrated all three on mount via `getPref("fm:restTimerEnabled")`, `getPref("fm:restSeconds")`, and `getPermissionState()` (D-11 — the row reflects real OS permission on load). Added the pure `formatRestLabel(sec)` row-value formatter (`'2 min'` / `'1:30'`) + the `REST_PRESETS` array, and imported `ensureNotificationPermission`/`getPermissionState`/`PermissionState` from `lib/notifications.ts` plus `Alert`/`Linking` from react-native.
- **Task 2 — row + picker + permission prompt + denied helper** (`40b8815`):
  - `onRestTimerToggle(next)` — on enable, `await ensureNotificationPermission()` (D-13 in-context ask), `setPermState(state)`, then ALWAYS `setRestTimerEnabled(true)` + `setPref("fm:restTimerEnabled", true)` regardless of grant (D-12 — the in-app countdown works when denied); on disable, persist OFF with no prompt.
  - `openRestDurationSheet()` clones `openUnitsSheet`'s ActionSheetIOS idiom: options `["1 min","1:30","2 min","3 min","5 min", restCustom, cancel]`, indices 0-4 → `REST_PRESETS` (60/90/120/180/300) → `applyRestSeconds`, index 5 → `openRestCustomEntry`.
  - `openRestCustomEntry()` — iOS `Alert.prompt` (`number-pad`) reading MINUTES, coercing to seconds, guarding non-finite/<=0, clamping 1..60 min before persisting (T-14-08 defence-in-depth).
  - The `restTimer` `SettingsRow`: `icon="clock"`, `label={t("restTimer")}`, enable `toggle`, and the duration disclosure (value `${t("on")} · ${formatRestLabel(restSeconds)}` / `t("off")` + a `chevronRight` icon) hosted as a `Pressable` in the `control` slot with a 44px hit-slop.
  - The denied helper — rendered only when `restTimerEnabled && permState !== "granted"`, `t("restNoPermission")` in muted `text-forge-text2`, never `forge-danger` (D-12); when `permState === "blocked"` the line is a `Pressable` → `Linking.openSettings()` (RESEARCH Pattern 4).
  - The existing `notifications` bell row is verbatim-unchanged (D-14 master gate — wiring only).

## Task Commits

1. **Task 1: rest-timer enable/duration/permission state + mount-load** — `7577b41` (feat)
2. **Task 2: restTimer row + duration picker + permission prompt + denied helper** — `40b8815` (feat)

**Plan metadata:** _(this SUMMARY + STATE/ROADMAP commit)_

## Files Created/Modified

- `app/app/(app)/(tabs)/settings.tsx` (modified) — rest-timer state + mount-load + handlers + row + duration picker + custom entry + denied helper; `Alert`/`Linking` + `lib/notifications` imports

## Deferred Checkpoint (Task 2 — device-UAT `<human-check>`)

**Status: PENDING device-UAT — NOT passed.** Task 2 carries a `<human-check>` that requires a physical iPhone (Expo Go SDK 54). All code is implemented and committed (`40b8815`); every automated check passes (tsc 0 for settings, expo lint exit 0, `test:rest-timer` 23/23, `test:rest-timer-store` 15/15). The on-device assertions, deferred to the phase gate:

1. Toggling the rest timer ON shows the iOS notification-permission prompt (D-13).
2. Denying still enables the timer AND shows the muted `restNoPermission` helper (D-12, not red).
3. The duration chevron opens the presets + `Anpassad` ActionSheet; the chosen value persists across an app restart (TIMER-04).

The orchestrator surfaces this device-UAT item at phase end. Do not mark TIMER-04's permission-prompt + persistence as fully verified until the on-device pass is recorded. This pairs naturally with 14-02's deferred TIMER-03 background-ping UAT.

## Decisions Made

None beyond the plan-specified decisions (D-08 presets+custom, D-11 reflect permission, D-12 enable-regardless + muted helper, D-13 in-context prompt, D-14 bell row untouched, TIMER-04 persist). The two implementation choices the plan left to planner-discretion — (a) custom entry via `Alert.prompt` (vs an inline stepper) and (b) the duration sub-control in the `control` slot — are documented in the frontmatter `key-decisions`.

## Deviations from Plan

None - plan executed exactly as written. The custom-entry mechanism (`Alert.prompt`) and the dual-control row composition were explicitly delegated to planner-discretion (D-08 / "minimal Alert.prompt-style numeric input or an inline stepper") and are not deviations.

## Issues Encountered

None. The SettingsRow primitive already renders `control` + `toggle` + `chevron` in sequence, so hosting the duration disclosure in the `control` slot beside the enable Toggle worked first try; tsc + lint clean on first run.

## Threat surface scan

No new trust boundaries beyond the plan's `<threat_model>`. T-14-08 (custom-duration → fm:restSeconds) is mitigated by the enable-time clamp (1..60 min) AND the read-side `z.coerce.number().int().positive().catch(120)` (14-01) — a zero/negative/huge/garbage value can never produce a runaway timer. T-14-09 (denied-permission helper) is accepted: generic informational copy in muted text, no sensitive data. T-14-07 (permission gate) is inherited from 14-02 — this plan only requests + reflects state, never bypasses the D-14 scheduling gate. No threat flags raised.

## Known Stubs

None. The Settings rest-timer control is a complete deliverable: enable, duration (presets + custom), permission prompt, and denied helper are all wired to real prefs + the real permission state machine. The auto-start consumer that READS `fm:restTimerEnabled`/`fm:restSeconds` on `Klart` + the countdown banner is owned by Plan 14-04 by design.

## User Setup Required

None at build time. OS notification permission is requested at runtime by this row's enable toggle (D-13), not a build-time setup step.

## Next Phase Readiness

- **14-04 (notification scheduler / auto-start banner)** reads `fm:restTimerEnabled` + `fm:restSeconds` (now user-configurable here) on the fire-and-forget `onKlart` path, and the D-14 gate (timer ON && master ON && permission granted) now has all three inputs surfaced: the rest-timer enable (this plan), the master bell (`fm:notifications`, unchanged), and the permission state (lib/notifications).
- Gates green: `tsc --noEmit` 0 (settings), `expo lint` exit 0, `test:rest-timer` 23/23, `test:rest-timer-store` 15/15.
- **Outstanding:** the Task 2 device-UAT `<human-check>` (D-13 prompt fires on enable; deny still enables + muted helper; duration persists across restart) — deferred to the phase gate, requires a physical iPhone.

## Self-Check: PASSED

settings.tsx contains the rest-timer state, handlers, row, duration picker, custom entry, and denied helper (verified on disk); both task commits are present in git history (`7577b41`, `40b8815`).

---
*Phase: 14-rest-timer-f19-research-flagged*
*Completed: 2026-06-15*
