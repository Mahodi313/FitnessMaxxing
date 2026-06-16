# Phase 14 — Manual UAT Checklist (Rest Timer, F19)

> Seeded by Plan 14-01 (the pure-logic + prefs + i18n + expo-notifications
> scaffold). The native-only behaviors below cannot be exercised by a Node
> `tsx` test — they require a real iPhone via Expo Go because they depend on
> OS notification scheduling, JS-thread suspension while backgrounded, and the
> notification permission prompt. Plans 14-02 (live banner + countdown),
> 14-03 (Settings toggle + duration picker), and 14-04 (notification scheduler
> + tap-routing) wire the screens that make each row testable; this file is the
> contract they verify against.
>
> Run on a real iPhone via Expo Go AFTER all four Phase 14 plans are merged.

## Pre-test setup

- [ ] Clean install of Expo Go on iPhone, connected to dev server (LAN or
      tunnel).
- [ ] Signed in as a test user (session restored from LargeSecureStore — see
      Phase 3 sign-in flow).
- [ ] At least one plan with ≥ 1 exercise exists, so a workout can be started
      and a set logged.
- [ ] Notification permission for Expo Go RESET (iOS Settings → Expo Go →
      Notifications, or a fresh install) so the first-prompt flow (TIMER-04 /
      D-13) can be observed cleanly.

## Pre-flight automated gates

All must exit 0 from `app/` cwd BEFORE opening Expo Go on the device:

- [ ] `npx tsc --noEmit`
- [ ] `npx expo lint`
- [ ] `npm run test:rest-timer` (all pure-logic cases PASS)
- [ ] i18n parity guard exits 0 (all 10 new timer keys present in BOTH
      `sv.json` and `en.json`; key counts equal)

Service-role audit gate (from repo root, MUST return no matches in client
source):

- [ ] `git grep "service_role\|SERVICE_ROLE" -- "app/lib/**" "app/app/**" "app/components/**"` is empty.

If any of the above fail, **STOP** and fix before running the manual flow.

## TIMER-03 — Backgrounded notification still pings

> The JS-suspension trap: while Expo Go is backgrounded the JS thread is
> suspended, so an in-app `setTimeout` would never fire. The notification must
> be SCHEDULED with the OS at rest-start (Plan 14-04) so it pings regardless.

- [ ] Start a workout; log a set with the rest timer ENABLED (master
      notifications ON + permission granted).
- [ ] Immediately background the app (Home gesture) before the timer elapses.
- [ ] Wait for the full rest duration with the app backgrounded.
- [ ] A local notification fires at rest-end (title "Vilan är slut" /
      "Rest is over") even though the app was never foregrounded.

## TIMER-02 — Background reconcile (≥ 30 s away)

> Remaining time is re-derived from the absolute `endTs` against `Date.now()`
> on resume — never a drifting decrementing counter (`remainingMs(endTs, now)`).

- [ ] Start a rest timer; note the remaining time.
- [ ] Background the app for at least 30 s (or lock the phone).
- [ ] Re-open the app — the countdown shows the CORRECT remaining time
      (start − elapsed), NOT the value it had when backgrounded; if rest
      elapsed while away, it reads 0:00 / dismissed (no negative, no drift).

## TIMER-05 — Skip / next-set cancels the scheduled notification

> Skip → cancel; advancing to the next set → reschedule. No stale ping.

- [ ] Start a rest timer, then tap **Hoppa över** / **Skip rest** (or log the
      next set) before it elapses.
- [ ] Background the app and wait past the ORIGINAL rest-end time.
- [ ] NO notification fires for the cancelled rest (the schedule was cancelled,
      not left to ping stale).
- [ ] Repeat tapping **+30 s** instead of skip: the notification fires at the
      EXTENDED time, not the original.

## TIMER-04 / D-13 — Permission prompt + deny-still-counts

- [ ] With permission not yet granted, enable the rest timer and trigger a
      rest — iOS shows the notification-permission prompt exactly once.
- [ ] DENY the prompt. The in-app countdown STILL runs to 0:00 and shows the
      "Notiser av — vilan räknas ändå ner i appen." / "Notifications off —
      rest still counts down in the app." hint.
- [ ] No notification fires (permission denied) but the in-app timer is
      unaffected.

## D-15 — Tap notification routes to the workout

- [ ] With permission granted, let a backgrounded rest timer fire its
      notification.
- [ ] Tap the notification — the app opens directly to the active workout
      screen (not the plans tab or a cold home screen).

## SET-07 / D-14 — Master-toggle gating matrix

> A notification may fire ONLY when timer-on AND master-notifications-on AND
> permission-granted (`shouldFireNotification`).

- [ ] Per-exercise timer ON + master notifications ON + permission granted →
      notification FIRES.
- [ ] Per-exercise timer ON + master notifications OFF → NO notification (the
      in-app countdown still runs).
- [ ] Per-exercise timer OFF → NO countdown and NO notification at all.
- [ ] Master notifications ON + permission DENIED → NO notification; in-app
      countdown still runs with the deny hint.
