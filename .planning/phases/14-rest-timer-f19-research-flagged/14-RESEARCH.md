# Phase 14: Rest Timer (F19) - Research

**Researched:** 2026-06-14
**Domain:** Local OS notifications (`expo-notifications`) in Expo Go SDK 54 (iOS), timestamp-reconciled countdown state, permission UX
**Confidence:** HIGH (the notification mechanics are first-party Expo + verified against official docs; the reconciliation pattern is a well-established RN idiom already mirrored by this repo's AppState/focusManager wiring)

## Summary

Phase 14 adds a rest timer that auto-starts after a working set, shows a floating countdown banner, fires a local OS notification when rest ends (even backgrounded), and is configurable in Settings. The product/UX layer is fully locked in `14-CONTEXT.md` (D-01…D-15) and `14-UI-SPEC.md`. This research owns only the **technical mechanics**: `expo-notifications` on Expo Go SDK 54, permission flow, schedule/cancel/reschedule, timestamp-not-JS-timer reconciliation, notification-tap deep-link, and testability.

**The single most load-bearing finding:** **Local scheduled notifications WORK in Expo Go on iOS for SDK 54.** Expo removed only *remote push* from Expo Go in SDK 53+. `scheduleNotificationAsync`, `cancelScheduledNotificationAsync`, permission APIs, `setNotificationHandler`, and `addNotificationResponseReceivedListener` all function in Expo Go on iOS. **No development build is required for this phase.** [CITED: docs.expo.dev/versions/latest/sdk/notifications] [VERIFIED: WebSearch cross-confirmed]

The second load-bearing finding: the countdown must store an **absolute end-timestamp (ms epoch)** and re-derive `remaining = endTs - Date.now()` on every render tick AND on AppState→`active`. The JS `setInterval` is display-only; it is throttled/suspended while backgrounded and must never be trusted for correctness (TIMER-02). This is the exact pattern this repo already uses for `focusManager <- AppState` in `lib/query/network.ts`.

**Primary recommendation:** Create a single Zustand store `app/lib/rest-timer-store.ts` owning `{ endTs, durationMs, notificationId, exerciseId }` + actions (`start`, `extend`, `skip`, `reconcile`), plus a pure Node-importable `app/lib/rest-timer.ts` for the math (remaining-ms, M:SS format, reschedule decision). Notification I/O lives in a thin native-bound `app/lib/notifications.ts`. Wire `setNotificationHandler` + `addNotificationResponseReceivedListener` once at `_layout.tsx` module scope (Fast-Refresh-guarded, like the existing AppState blocks). Install via `npx expo install expo-notifications` (NOT `npm install`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Countdown display (1s tick, M:SS) | Browser/Client (RN component) | — | Pure UI; reads derived remaining-ms from store |
| Authoritative timer state (endTs, notificationId) | Client (Zustand store) | — | Single owner; survives component unmount/remount; no server involvement |
| Remaining-time + reschedule math | Client (pure module `rest-timer.ts`) | — | Node-importable, unit-testable, no React/native binding |
| OS notification schedule/cancel | Native (expo-notifications) | Client store (holds the id) | Native module bound; only callable on device |
| Permission request/check | Native (expo-notifications) | Settings screen (surfaces state) | iOS-mediated; in-context prompt on toggle (D-13) |
| AppState foreground reconcile | Client (AppState listener) | Store (`reconcile` action) | RN lifecycle event; re-derives from stored endTs |
| Notification-tap routing | Native listener → expo-router | `_layout.tsx` (mounts listener) | Native delivers the response; router owns navigation |
| Pref persistence (`fm:restSeconds`, gates) | Client (`prefs.ts` / AsyncStorage) | — | Established `fm:*` idiom |

## User Constraints (from CONTEXT.md)

### Locked Decisions
Copied verbatim from `14-CONTEXT.md ## Implementation Decisions`:

- **D-01 (floating top-overlay):** Countdown renders as a floating, absolutely-positioned banner reusing the PR-celebration overlay slot (`workout/[sessionId].tsx` ~line 462). NEVER shifts the set list, input row, or "Klart" button (same D-09 geometry-protection rule). The design source has NO timer component — this banner is NEW, composed from Forge tokens.
- **D-02 (controls = Hoppa över + +30s):** Banner shows remaining time + **[Hoppa över]** (ends rest immediately, cancels scheduled notification — TIMER-05) and **[+30s]** (extends rest, reschedules notification). No pause/resume in v1.
- **D-03 (next working set also cancels/restarts):** Logging the next working-set "Klart" while a rest runs cancels the current rest + its notification and starts a fresh full-duration rest. Early-cancel reachable three ways: Hoppa över, +30s-then-skip, or starting the next set.
- **D-04 (PR celebration wins position, timer banner defers):** When a set is both a PR and starts a rest, the PR banner plays its ~3–4s celebration FIRST, then the timer banner takes over the top position. The timer starts logically immediately (timestamp set at log-time); only the visual banner is deferred. Fire-first-then-count.
- **D-05 (auto-start on every working-set Klart):** When the timer is enabled, every logged working set auto-starts the rest at the default duration — zero extra taps. The Settings toggle is the global on/off.
- **D-06 (working sets only):** Only `set_type = 'working'` sets auto-start a rest. Warmup/dropset/failure log without starting a rest.
- **D-07 (latest set restarts the rest):** A new working set restarts the rest on a fresh full default duration, cancelling the previous rest + rescheduling. "Latest set wins."
- **D-08 (Settings chevron → presets + custom):** `restTimer` row opens a picker with preset durations PLUS a custom-time option. Presets are Claude's discretion (e.g. 60s/90s/2min/3min/5min) plus "Anpassad".
- **D-09 (one global default):** v1 ships a single global default rest duration. Per-exercise override explicitly deferred.
- **D-10 (default value = 2 min):** Out-of-box default is 120s. Persisted as a new `fm:restSeconds` pref following the `fm:*` typed-pref idiom.
- **D-11 (enable/disable in Settings, gated by permission):** The row carries both enable/disable state and duration; enabling triggers the permission flow (D-13).
- **D-12 (timer needs permission for background notification; in-app works regardless):** Background notification (TIMER-03) requires OS permission. If denied, the in-app foreground countdown still works — the user only loses the background "rest is over" notification. The timer is useful even without permission.
- **D-13 (prompt fires when timer toggled ON in Settings):** The OS permission prompt appears when the user enables the rest timer in Settings — a calm, in-context moment. NOT during onboarding, NOT mid-workout. Grant/deny status reflects back into the Settings row.
- **D-14 (general "Aviseringar" toggle = master gate):** Rest notification fires only if rest-timer ON AND `fm:notifications` (SET-07) ON AND OS permission granted. The general toggle is an app-wide master off-switch. The in-app countdown is unaffected by the master toggle — only the OS notification is gated.
- **D-15 (notification content):** Simple i18n text ("Vilan är slut"/"Rest is over", sv+en parity), sound + vibration (vibration respects `fm:haptics`), and tapping deep-links back into the active workout (`workout/[sessionId]`). No exercise data baked into the notification.

### Claude's Discretion
- Exact preset duration list for the picker (D-08).
- Custom-time input mechanism (stepper, wheel, free numeric) for "Anpassad" (D-08).
- Timestamp-reconciliation mechanism (TIMER-02) — **RESEARCH OWNS THIS** (see Pattern 2 below).
- `expo-notifications` schedule/cancel/reschedule API specifics + Expo Go SDK 54 behavior (TIMER-03/TIMER-05) — **RESEARCH OWNS THIS** (see Standard Stack + Pattern 1).
- Permission-status surfacing in the Settings row; deep-link to iOS Settings if blocked.
- Banner enter/exit motion (Forge §07 + reduce-motion snap).
- `t()` key names for new timer strings.
- Behavior when a workout is finished/abandoned while a rest runs — sensible default: finishing cancels any pending rest + notification.

### Deferred Ideas (OUT OF SCOPE)
- **Per-exercise rest-duration override** — its own future phase; needs `plan_exercises` schema column + per-exercise UI + sync. Do NOT fold into Phase 14.
- **Pause/resume control** on the countdown — considered, not selected.
- **Reduce-motion as an in-app Settings pref** — honor OS setting only.
- **Richer notification content** (exercise name / next-set hint on lock screen) — rejected for v1.
- **Remote push notifications** — out of scope (Expo Go SDK 54; local only).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIMER-01 | Completing a set ("Klart") can auto-start a rest countdown | Auto-start hook fires-and-forget AFTER `addSet.mutate` at `onKlart` (`[sessionId].tsx:641`), gated on `set_type='working'` (D-06) + timer-enabled pref. Store `start(durationMs, exerciseId)` sets `endTs = Date.now() + durationMs` and schedules the notification. See Pattern 1 + Pattern 3. |
| TIMER-02 | Countdown visible and continues correctly after backgrounding (reconciled from a stored timestamp, not a JS timer) | Absolute `endTs` in the store; 1s `setInterval` is display-only; AppState→`active` calls `reconcile()` which re-derives `remaining = endTs - Date.now()`. See Pattern 2. |
| TIMER-03 | Local notification fires when rest ends, including backgrounded | `scheduleNotificationAsync` with a `TIME_INTERVAL` (or `DATE`) trigger, gated by D-14 (timer ON + `fm:notifications` ON + permission granted). Confirmed to work in Expo Go SDK 54 iOS. See Standard Stack + Pattern 1. |
| TIMER-04 | Configure default rest duration + enable/disable in Settings | New numeric `fm:restSeconds` pref (default 120, D-10) via the `prefs.ts` idiom; enable/disable backed by timer-enabled pref; picker = presets + custom (D-08). Permission prompt on enable (D-13). See `prefs.ts` extension below. |
| TIMER-05 | Dismissing or starting next set early cancels the scheduled rest notification | `cancelScheduledNotificationAsync(notificationId)` on skip (D-02), and cancel-then-reschedule on +30s (D-02) / next-set (D-03/D-07). Store holds the live `notificationId`. See Pattern 1 + Pattern 4. |
| SET-07 (context) | Notifications toggle (device-local pref, gated by OS permission) | `fm:notifications` already exists (stored-only, Phase 9 D-07). This phase wires the real OS permission and makes it the D-14 master gate. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **SDK-54 version pinning:** Install Expo modules via `npx expo install`, NEVER `npm install` — `expo install` reads the installed SDK and pins the matching version. This is mandatory for `expo-notifications`. [CITED: CLAUDE.md Technology Stack]
- **≤3s log hot path:** The timer is a fire-and-forget side-effect AFTER `addSet.mutate` (D-05, Phase 13 D-17 pattern). It must NEVER be awaited before or inside the mutate, and must not delay the set save.
- **F13 sacred:** No touching mutation defaults / offline queue / persister / `exercise_sets` logging internals. `npm run test:f13-brutal` must stay green (known amber FIT-107 is environmental, not a regression).
- **No service-role key, no secrets:** The notification tap target is an in-app route (`workout/[sessionId]`), NOT an external URL (M4 anti-phishing).
- **`fm:*` typed-pref idiom:** New `fm:restSeconds` (numeric) added to `prefs.ts` via Zod `.catch(default).parse()` — total over `unknown`, never throws. `String(value)` serializer already future-proofed for a numeric pref (`prefs.ts:90` comment).
- **i18n sv+en parity:** All new strings flat-keyed (Phase 8 D-10), sv+en at parity (D-15).
- **Security conventions:** Notification permission is the new OS-permission surface. ASVS V2/V14 considerations below.
- **GSD workflow:** Edits go through a GSD command; phase-branch-first before first commit.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-notifications` | `~0.32.17` (SDK 54 line — `npx expo install` resolves) | Schedule/cancel local notifications, permission flow, foreground handler, response listener | First-party Expo module; the only supported local-notification API in Expo Go SDK 54. [VERIFIED: npm registry — `npm view expo-notifications dist-tags` shows `sdk-54: 0.32.17`, maintainers are the Expo team, repo `github.com/expo/expo`] |

**Critical:** `npm view expo-notifications version` returns `56.0.17` (`latest` = SDK 56). DO NOT install `@latest` — it targets SDK 56 and will break SDK 54. The `sdk-54` dist-tag is `0.32.17`. `npx expo install expo-notifications` resolves the SDK-54-correct version automatically. [VERIFIED: `npm view expo-notifications dist-tags`, 2026-06-14]

### Supporting (already in stack — no new install)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-router` | `~6.0.23` | `router.push("/(app)/workout/[sessionId]")` on notification tap | Deep-link routing (D-15) |
| `react-native` `Linking` | (RN 0.81.5 built-in) | `Linking.openSettings()` to deep-link to iOS app settings when permission is **blocked** (denied + must go to Settings) | D-13 blocked-state surfacing |
| `zustand` | `^5.0.13` | Timer state store (`endTs`, `notificationId`) | Pattern 2 state owner |
| `expo-haptics` | `~15.0.8` | (already used) vibration policy on the in-app rest-end moment, `fm:haptics`-gated | D-15 vibration |
| `react-native-reanimated` | `~4.1.1` | Banner enter/exit motion (Forge §07) | UI-SPEC motion |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-notifications` for the background ping | A pure in-app `setInterval` only | REJECTED — backgrounded JS is suspended; no ping fires when the app is not foregrounded. TIMER-03 explicitly requires the backgrounded notification. expo-notifications is mandatory. |
| Zustand store for timer state | A `useRef`+`useState` hook colocated in `[sessionId].tsx` | A hook works but loses state if the banner unmounts and complicates the AppState reconcile + the `_layout.tsx`-level notification-tap reconcile. A store is the cleaner single owner (matches `units-store`/`persistence-store` precedent). **Recommend store.** |
| `TIME_INTERVAL` trigger | `DATE` trigger (`date: new Date(endTs)`) | Both work in Expo Go. `DATE` maps 1:1 to the stored `endTs` (no drift between "now" and the seconds computation) — **recommend `DATE`** for reschedule correctness; compute `seconds` only if a relative trigger reads cleaner. Either is acceptable (planner's call). |
| `react-native-open-notification-settings` (3rd-party) | `Linking.openSettings()` (built-in) | REJECTED 3rd-party — built-in `Linking.openSettings()` opens the iOS app settings page with zero new dependency and no registry-vetting burden. |

**Installation:**
```bash
cd app
npx expo install expo-notifications
```

**Version verification (run at plan time to confirm currency):**
```bash
npx expo install expo-notifications --check   # confirms the SDK-54-pinned version
npm view expo-notifications dist-tags         # confirm sdk-54 tag
```

## Package Legitimacy Audit

slopcheck was not installable in this research session (no network pip in sandbox), so legitimacy was verified manually via npm registry inspection. `expo-notifications` is a **first-party Expo module** — the strongest possible provenance.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `expo-notifications` | npm | ~6 yrs (since SDK ~36) | millions/wk (Expo core) | github.com/expo/expo (monorepo) | n/a (unavailable) | **Approved** — first-party Expo, maintainers `ide`/`brentvatne`/`evanbacon`/`expoadmin`, pinned via `npx expo install` |

**Postinstall note:** `expo-notifications@0.32.17` declares a `postinstall` script. This is **expected and benign** for first-party Expo modules (it runs `expo-modules-autolinking` registration) — it is NOT a slopsquat exfiltration vector. Provenance (Expo monorepo + Expo-team maintainers) clears it. No action needed.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable; however `expo-notifications` is a first-party Expo SDK module installed via `npx expo install` (which pins the SDK-matched version from Expo's own resolution), so the install path itself is the verification. The planner may still gate the install behind a `checkpoint:human-verify` if desired, but the provenance is unusually strong.*

## Architecture Patterns

### System Architecture Diagram

```
                          WORKING SET "Klart" (onKlart, [sessionId].tsx:630)
                                        │
                          addSet.mutate(...)  ◄── F13 hot path, ≤3s, UNTOUCHED
                                        │
                  ┌─────────────────────┴──────────────────────┐
                  │   fire-and-forget AFTER mutate (D-05)       │
                  │   (NOT awaited, NOT before mutate)          │
                  └─────────────────────┬──────────────────────┘
                                        │ set_type === 'working' (D-06)
                                        │ AND timerEnabled pref
                                        ▼
                       restTimerStore.start(durationMs, exerciseId)
                                        │
              ┌─────────────────────────┼─────────────────────────────┐
              ▼                         ▼                             ▼
   set endTs = now + dur      notifications.schedule(...)      mount banner (D-01)
   (authoritative)            ─ gated by D-14:                  floating overlay,
              │                 timerON && fm:notifications     never shifts Klart
              │                 && permission===granted              │
              │                returns notificationId               │
              │                store.notificationId = id            │
              ▼                                                      ▼
   ┌──────────────────┐                                  1s setInterval (display only)
   │ DISPLAY PIPELINE │  remaining = endTs - Date.now()  ──► M:SS via rest-timer.ts
   └──────────────────┘                                       (pure, tabular-nums)
              ▲
              │ reconcile() re-derives from endTs
   AppState 'active' ───────────────────────────────────► (TIMER-02: never trust interval)


   CONTROLS:
     [Hoppa över] ─► store.skip()   ─► cancelScheduledNotificationAsync(id); clear endTs; banner exits
     [+30s]       ─► store.extend() ─► endTs += 30000; cancel old id; reschedule; store new id
     next set     ─► store.start()  ─► cancel old id; fresh endTs; reschedule (D-03/D-07)
     rest hits 0  ─► (foreground) banner exits; (background) OS notification already fired


   NOTIFICATION TAP (background) ─► addNotificationResponseReceivedListener (_layout.tsx)
              │   data.sessionId  ─► router.push(`/(app)/workout/${sessionId}`)  (D-15)
              ▼
   setNotificationHandler (_layout.tsx): foreground behavior
       shouldShowBanner: true, shouldPlaySound: per fm:notifications, shouldSetBadge: false
```

### Recommended Project Structure
```
app/lib/
├── rest-timer.ts          # PURE: remaining-ms math, M:SS format, reschedule decision (Node-importable, unit-tested)
├── rest-timer-store.ts    # Zustand: { endTs, durationMs, notificationId, exerciseId } + start/extend/skip/reconcile/finish
├── notifications.ts       # NATIVE-BOUND thin wrapper: schedule/cancel + permission helpers (expo-notifications)
└── prefs.ts               # EXTEND: add fm:restSeconds (numeric) + fm:restTimerEnabled (boolean)

app/scripts/
└── test-rest-timer.ts     # Node-only unit test for rest-timer.ts (mirrors test-units.ts skeleton)

app/app/
├── _layout.tsx            # EXTEND: setNotificationHandler + addNotificationResponseReceivedListener (module scope, Fast-Refresh-guarded)
├── (app)/workout/[sessionId].tsx   # EXTEND: auto-start hook after onKlart; floating countdown banner in overlay stack
└── (app)/(tabs)/settings.tsx       # EXTEND: restTimer row + duration picker + permission prompt on enable
```

### Pattern 1: expo-notifications schedule / cancel / reschedule
**What:** Schedule a local notification, capture its identifier, cancel/reschedule it.
**When to use:** On rest start (schedule), skip (cancel), +30s / next-set (cancel + reschedule).
**Example:**
```typescript
// Source: docs.expo.dev/versions/latest/sdk/notifications [CITED]
import * as Notifications from "expo-notifications";

// SCHEDULE — returns the identifier (store it!)
const notificationId = await Notifications.scheduleNotificationAsync({
  content: {
    title: t("restDoneTitle"),   // "Vilan är slut" / "Rest is over" (D-15)
    body: t("restDoneBody"),     // "Dags för nästa set." / "Time for your next set."
    sound: true,                  // D-15 sound; vibration via fm:haptics policy
    data: { sessionId },          // D-15 deep-link payload — in-app route only, no exercise data
  },
  // DATE trigger maps 1:1 to the stored endTs — recommended for reschedule correctness:
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: new Date(endTs),
  },
  // ── OR the TIME_INTERVAL equivalent (also works in Expo Go):
  // trigger: {
  //   type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
  //   seconds: Math.max(1, Math.round((endTs - Date.now()) / 1000)),
  //   repeats: false,
  // },
});

// CANCEL — on skip (TIMER-05) / before reschedule
await Notifications.cancelScheduledNotificationAsync(notificationId);

// RESCHEDULE (+30s / next-set) = cancel old, schedule new, replace stored id
```
**Notes:**
- The handler must respond within 3 s; `setNotificationHandler` is set once at app scope.
- `TIME_INTERVAL` seconds must be ≥1; guard `Math.max(1, …)` so a sub-1s remaining never throws.

### Pattern 2: Timestamp-not-JS-timer reconciliation (TIMER-02 — RESEARCH OWNS THIS)
**What:** Authoritative absolute `endTs` (ms epoch); display driven by a 1s interval; re-derive remaining from `endTs` on every tick and on foreground.
**Why a JS timer alone is wrong:** When the app backgrounds, the JS event loop is suspended/throttled by iOS — a `setInterval` does NOT keep accurate time and may not fire at all. On return, a naive "decrement a counter" timer is now wrong by the full background duration. Storing `endTs` and recomputing `endTs - Date.now()` is drift-immune: the OS clock is the source of truth.
**When to use:** Always, for the countdown display.
**Example:**
```typescript
// PURE math (rest-timer.ts) — Node-importable, unit-testable
export function remainingMs(endTs: number, now: number): number {
  return Math.max(0, endTs - now);   // clamp at 0; never negative
}
export function formatMSS(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);     // ceil so "0:01" shows until truly 0
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;  // tabular-nums in the banner (DSGN-03)
}

// Store (rest-timer-store.ts) — single owner of endTs + notificationId
// reconcile() is a no-op on state; the component recomputes remaining from endTs.
// The store exposes endTs; the banner reads it and ticks via its own 1s interval:
useEffect(() => {
  if (!endTs) return;
  const id = setInterval(() => setTick((n) => n + 1), 1000);  // display heartbeat only
  return () => clearInterval(id);
}, [endTs]);
const remaining = remainingMs(endTs ?? 0, Date.now());        // recomputed each render

// AppState reconcile — the SAME idiom as lib/query/network.ts focusManager block:
useEffect(() => {
  const sub = AppState.addEventListener("change", (s) => {
    if (s === "active") forceTick();   // re-render → remaining recomputed from endTs
  });
  return () => sub.remove();
}, []);
```
**Across JS suspension:** While backgrounded, the interval may not fire — that's fine, the display isn't visible. On `active`, one forced re-render recomputes `remaining` correctly from `endTs`. If `endTs <= Date.now()` on return, the rest already ended (the OS notification fired); the banner exits.
**Cleanest owner:** a **Zustand store** for `endTs`/`notificationId` (survives the banner unmounting and is reachable from `_layout.tsx`'s notification-tap reconcile), plus a small display hook in the banner for the tick. Matches `units-store`/`persistence-store` precedent. [VERIFIED: codebase grep — `lib/query/network.ts` AppState/focusManager idiom]

### Pattern 3: Fire-and-forget auto-start after `addSet.mutate` (D-05, F13-safe)
**What:** Auto-start hooks in AFTER the optimistic mutate, never awaited, mirroring the existing PR detection + haptic block.
**When to use:** TIMER-01 auto-start.
**Example:**
```typescript
// In onKlart (app/app/(app)/workout/[sessionId].tsx ~line 670+), AFTER addSet.mutate(...)
// — same placement as the existing fm:haptics + PR-detection fire-and-forget blocks.
// set_type is 'working' here (D-06); auto-start only fires for working sets.
void getPref("fm:restTimerEnabled").then((enabled) => {
  if (!enabled) return;
  void getPref("fm:restSeconds").then((sec) => {
    // start sets endTs = Date.now() + sec*1000, schedules notification (gated D-14), mounts banner
    restTimerStore.getState().start(sec * 1000, planExercise.exercise_id);
  });
});
```
**Critical:** This block is placed AFTER `addSet.mutate` and is never awaited — identical to the existing `void getPref("fm:haptics").then(...)` block at `[sessionId].tsx:676`. The ≤3s budget and `test:f13-brutal` are untouched.

### Pattern 4: Permission flow + blocked-state deep-link (D-12/D-13)
**What:** Request permission in-context on enable; surface granted/denied/blocked; deep-link to iOS Settings if blocked.
**When to use:** Settings restTimer enable toggle.
**Example:**
```typescript
// Source: docs.expo.dev/versions/latest/sdk/notifications [CITED]
import * as Notifications from "expo-notifications";
import { Linking } from "react-native";

async function ensureNotificationPermission(): Promise<"granted" | "denied" | "blocked"> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  // iOS: canAskAgain === false means the user previously denied → must go to Settings ("blocked")
  if (!current.canAskAgain) return "blocked";
  const req = await Notifications.requestPermissionsAsync();
  if (req.granted) return "granted";
  return req.canAskAgain ? "denied" : "blocked";
}

// On enable (D-13): prompt; reflect state into the row.
// If "blocked", show the D-12 helper line + a "Open Settings" affordance:
Linking.openSettings();   // built-in RN — opens the iOS app settings page (no 3rd-party dep)
```
**iOS permission states:** `granted` (notifications fire), `denied` but `canAskAgain: true` (prompt again next time — "undetermined"-like), `denied` + `canAskAgain: false` (blocked — must open Settings), `ios.status === PROVISIONAL` (quiet delivery, no prompt — treat as granted-ish but D-13 prefers an explicit prompt). `getPermissionsAsync()` returns `{ granted, canAskAgain, status, ios: { status } }`. [CITED: docs.expo.dev/versions/latest/sdk/notifications]
**D-12 graceful degradation:** if not granted, the in-app countdown still runs; only `scheduleNotificationAsync` is skipped (gated). Show `restNoPermission` helper in muted `forge-text2` (UI-SPEC).

### Pattern 5: Notification handler + tap deep-link (D-15) at `_layout.tsx`
**What:** Set the foreground display behavior once, and route on tap.
**When to use:** App-scope wiring, exactly like the existing AppState/focusManager module-scope blocks.
**Example:**
```typescript
// app/app/_layout.tsx — module scope (like the existing lib/query/network.ts blocks)
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,     // new iOS field — replaces shouldShowAlert
    shouldShowList: true,
    shouldPlaySound: true,      // D-15 sound (subject to D-14 gating at schedule time)
    shouldSetBadge: false,
  }),
});

// Tap → deep-link. Fast-Refresh-guard with a globalThis sentinel like APPSTATE_BGFLUSH_KEY.
const sub = Notifications.addNotificationResponseReceivedListener((response) => {
  const data = response.notification.request.content.data as { sessionId?: string };
  if (data?.sessionId) router.push(`/(app)/workout/${data.sessionId}`);  // D-15 in-app route
});
// store sub on globalThis; remove the prior one on re-eval (mirror network.ts sentinel pattern)
```
**Note:** `shouldShowBanner`/`shouldShowList` are the **current** field names; `shouldShowAlert` is deprecated in recent expo-notifications. [CITED: docs.expo.dev/versions/latest/sdk/notifications]

### prefs.ts extension (D-10/D-11)
Add two keys following the existing `prefs.ts` idiom (the `String(value)` serializer at line 90 already anticipates a numeric pref):
```typescript
// fm:restSeconds — numeric, default 120 (D-10). z.coerce.number for the stored string,
// .catch(120) keeps it throw-free over null/garbage (T-09-01 lineage).
const restSecondsSchema = z.coerce.number().int().positive().catch(120);
// fm:restTimerEnabled — boolean, default OFF (mirror fm:notifications enum-catch idiom)
const restTimerEnabledSchema = z.enum(["true","false"]).catch("false").transform((s) => s === "true");
```
Add both to `PrefMap` + `SCHEMAS`. `fm:restSeconds: number`, `fm:restTimerEnabled: boolean`.

### Anti-Patterns to Avoid
- **Decrementing-counter timer:** storing `remainingSeconds` and decrementing it each tick. Breaks on background (TIMER-02). Store `endTs` instead.
- **Awaiting the timer before/inside the mutate:** breaks the ≤3s budget + F13. Fire-and-forget AFTER (D-05).
- **`npm install expo-notifications`:** installs SDK-56 `latest`. Use `npx expo install`.
- **Modal portal for the banner:** Phase 11/12 D-22 — inline floating overlay only (D-01).
- **Baking exercise data into the notification:** D-15 keeps it private; only `{ sessionId }` in `data`.
- **Trusting Studio/3rd-party libs for the Settings deep-link:** use built-in `Linking.openSettings()`.
- **`shouldShowAlert` in the handler:** deprecated; use `shouldShowBanner`/`shouldShowList`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Background "rest is over" ping | A JS `setInterval` that fires a callback while backgrounded | `expo-notifications` `scheduleNotificationAsync` | Backgrounded JS is suspended — the interval never fires; only an OS-scheduled local notification survives backgrounding (TIMER-03) |
| iOS notification settings navigation | A custom `Linking.openURL("app-settings:")` string or a 3rd-party module | `Linking.openSettings()` (built-in RN) | Built-in, dependency-free, opens the iOS app settings page reliably |
| Permission state machine | Hand-rolled "have I asked before?" flag in AsyncStorage | `getPermissionsAsync().canAskAgain` + `.status` | iOS owns this state; `canAskAgain: false` is the authoritative "blocked" signal |
| Time-drift correction | Periodic "resync" hacks | Recompute `endTs - Date.now()` every render | The OS wall clock is already the source of truth |
| Notification id tracking | Scanning `getAllScheduledNotificationsAsync()` to find the rest one | Store the returned `notificationId` in the Zustand store | The schedule call returns the id directly; store it |

**Key insight:** Every "timer that survives backgrounding" problem in RN reduces to "store an absolute timestamp + schedule an OS notification." Both halves are off-the-shelf; the only custom code is the pure M:SS/remaining math and the reschedule-decision logic — which is exactly what belongs in the unit-testable `rest-timer.ts`.

## Runtime State Inventory

> Phase 14 is **greenfield** for the timer (no rename/refactor of existing strings or stored data). This section is included only to confirm no hidden runtime state is disturbed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `fm:notifications` already exists in AsyncStorage (stored-only since Phase 9 D-07). New: `fm:restSeconds`, `fm:restTimerEnabled`. No existing data renamed. | Add new keys (code edit); no migration of existing data |
| Live service config | None — no external services. Notifications are device-local. | None |
| OS-registered state | **iOS notification permission** is newly requested this phase (Phase 9 deferred it). Scheduled notifications are OS-registered transiently (cancelled on skip/finish). | Wire permission flow (D-13); cancel pending on session finish (discretion default) |
| Secrets/env vars | None — no secrets, no service-role, no env vars for the timer. | None |
| Build artifacts | `expo-notifications` adds a native module — **requires a Metro restart** after install (and a fresh Expo Go reload). No prebuild needed (Expo Go SDK 54). | Restart `expo start` after `npx expo install` |

**Nothing found requiring data migration:** confirmed — all timer state is new AsyncStorage keys + transient OS notifications.

## Common Pitfalls

### Pitfall 1: Installing the wrong expo-notifications version
**What goes wrong:** `npm install expo-notifications` pulls `latest` (56.x = SDK 56) into an SDK 54 project — native crash or build mismatch.
**Why it happens:** `latest` tracks the newest SDK, not yours.
**How to avoid:** `npx expo install expo-notifications`; verify with `npx expo install --check`.
**Warning signs:** version `56.x` in package.json; "incompatible SDK" warnings on `expo start`.

### Pitfall 2: Trusting the JS interval across background (TIMER-02 failure)
**What goes wrong:** Countdown is wrong (often frozen at the value it had when backgrounded) after returning.
**Why it happens:** iOS suspends/throttles the JS event loop in the background; `setInterval` doesn't keep wall-clock time.
**How to avoid:** Store `endTs`; recompute `remaining = endTs - Date.now()` each render + on AppState `active`.
**Warning signs:** countdown jumps or freezes after a home-swipe; the notification fires but the banner shows stale time.

### Pitfall 3: Notification fires but no permission was actually granted
**What goes wrong:** `scheduleNotificationAsync` resolves successfully even with permission denied; the notification silently never appears, leaving the dev thinking it's broken.
**Why it happens:** Scheduling doesn't require permission; *delivery* does.
**How to avoid:** Gate scheduling on `getPermissionsAsync().granted` (D-14) and surface the denied state (D-12).
**Warning signs:** no notification on a device where permission was never granted; the schedule call returns an id anyway.

### Pitfall 4: Sub-1-second TIME_INTERVAL throws
**What goes wrong:** Rescheduling with a tiny remaining time (e.g. +30s pressed at 0:00) computes `seconds: 0` → throws.
**Why it happens:** `TIME_INTERVAL` requires `seconds >= 1`.
**How to avoid:** `Math.max(1, …)` (or use the `DATE` trigger, which sidesteps this).
**Warning signs:** unhandled rejection on +30s near zero.

### Pitfall 5: Banner shifts the "Klart" button (D-01 geometry violation)
**What goes wrong:** The countdown banner is laid out in the flex flow and pushes the set list / Klart down — breaking the ≤3s tap geometry + the locked D-01/D-09 rule.
**Why it happens:** Rendering the banner inline instead of `position:"absolute"` in the overlay stack.
**How to avoid:** Mount inside the existing `position:"absolute"` overlay (`[sessionId].tsx:462`), `pointerEvents="box-none"` so the controls are tappable but the list underneath isn't blocked.
**Warning signs:** the set list jumps when a rest starts.

### Pitfall 6: Stale notification after skip/reschedule
**What goes wrong:** A skipped or extended rest still fires the old notification.
**Why it happens:** The previous `notificationId` wasn't cancelled before scheduling the new one.
**How to avoid:** Always `cancelScheduledNotificationAsync(oldId)` before scheduling a replacement; clear the stored id on skip.
**Warning signs:** two "Rest is over" pings; a ping after the user already started the next set.

### Pitfall 7: Duplicate listeners under Fast Refresh
**What goes wrong:** `addNotificationResponseReceivedListener` / handler stack up on every hot reload → multiple navigations on one tap.
**Why it happens:** Module-scope side-effects re-run on Fast Refresh.
**How to avoid:** Use the same `globalThis` sentinel + teardown pattern as `APPSTATE_BGFLUSH_KEY` in `lib/query/network.ts`.
**Warning signs:** N route pushes after N hot reloads.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `shouldShowAlert` in `handleNotification` | `shouldShowBanner` + `shouldShowList` | expo-notifications ~0.29+ | Use the new fields; `shouldShowAlert` is deprecated |
| Push notifications testable in Expo Go | Push removed from Expo Go (local still works) | SDK 53 | Local-only is exactly Phase 14's scope — no dev build needed |
| Bare `{ seconds: N }` trigger | `{ type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: N }` (typed trigger) | expo-notifications ~0.27+ | Use the typed `SchedulableTriggerInputTypes` enum |

**Deprecated/outdated:**
- `shouldShowAlert`: replaced by `shouldShowBanner`/`shouldShowList`.
- Untyped trigger objects: use `SchedulableTriggerInputTypes`.
- Any guidance that says "use a dev build for local notifications": false for Expo Go SDK 54 iOS — local works.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `DATE` trigger is as reliable as `TIME_INTERVAL` in Expo Go SDK 54 iOS for short (≤5 min) local notifications | Standard Stack / Pattern 1 | LOW — both are documented; if `DATE` misbehaves, fall back to `TIME_INTERVAL` with `Math.max(1,…)`. Verify on-device in Wave 0. |
| A2 | `getPermissionsAsync().canAskAgain === false` is the reliable "blocked" signal on iOS in Expo Go | Pattern 4 | LOW — documented behavior; confirm the exact field on-device (a UAT step). |
| A3 | The `expo-notifications` `postinstall` is the benign autolinking script (not vetted by slopcheck this session) | Package Legitimacy Audit | VERY LOW — first-party Expo module; provenance clears it. |
| A4 | A foreground notification with `shouldPlaySound` respects the iOS ringer/Focus state acceptably for the in-app rest-end moment | Pattern 5 | LOW — cosmetic; the in-app banner is the primary foreground signal anyway (D-15). |

**These are all device-UAT-resolvable** — none block planning; the planner should add a Wave-0/UAT verification step for A1 and A2.

## Open Questions

1. **DATE vs TIME_INTERVAL trigger choice**
   - What we know: both work in Expo Go SDK 54 iOS for local notifications.
   - What's unclear: which gives cleaner reschedule semantics in practice for this app.
   - Recommendation: default to `DATE` (1:1 with `endTs`); the planner may pick either — verify on-device in the first UAT loop.

2. **Exact preset duration list + custom-input mechanism (D-08, Claude's discretion)**
   - What we know: presets + "Anpassad" custom entry, default 120s.
   - Recommendation: presets `60 / 90 / 120 / 180 / 300` seconds + an "Anpassad" numeric entry (a simple numeric stepper or a wheel via `ActionSheetIOS`-style picker is consistent with the existing units/language `ActionSheetIOS` idiom in `settings.tsx`). Planner finalizes.

3. **Session-finish/abandon while rest running**
   - What we know: CONTEXT discretion default = finishing cancels any pending rest + notification.
   - Recommendation: call `restTimerStore.getState().finish()` (which cancels the notification + clears `endTs`) in the session-finish flow. No prompt.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Expo SDK 54 toolchain | All | ✓ | `expo ~54.0.33` (package.json) | — |
| `expo-notifications` | TIMER-03/05 | ✗ (to install) | `~0.32.17` via `npx expo install` | none — mandatory for the background ping |
| Expo Go (iOS) | On-device testing | ✓ (dev workflow) | SDK 54 | — (local notifications confirmed supported) |
| `react-native` `Linking` | Blocked-permission deep-link | ✓ (built-in) | RN 0.81.5 | — |
| `zustand` | Timer store | ✓ | `^5.0.13` | — |
| `node`/`tsx` | Unit tests | ✓ | `tsx ^4.21.0` | — |

**Missing dependencies with no fallback:** `expo-notifications` (must `npx expo install`; it is the only path to a backgrounded ping). All other pieces are already in the stack.

## Validation Architecture

Test framework: Node-only `tsx` scripts (the repo's established `test:*` idiom — see `test:units`, `test:e1rm`). There is no Jest/RN-testing-library harness; pure logic is unit-tested via `tsx`, native/notification behavior is device-UAT (notification delivery cannot be asserted in CI).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `tsx` Node scripts (Case[]-table + loop + exit-code skeleton, mirrors `scripts/test-units.ts`) |
| Config file | none — each test is a standalone `npm run test:*` script in `app/package.json` |
| Quick run command | `npm run test:rest-timer` (NEW — to be added in Wave 0) |
| Full suite command | the existing `test:*` scripts incl. `npm run test:f13-brutal` (must stay green) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIMER-01 | Working-set Klart auto-starts rest (gated working-only + enabled) | unit (decision logic) + manual (UAT on-device) | `npm run test:rest-timer` (decision: working+enabled → start) | ❌ Wave 0 |
| TIMER-02 | Countdown reconciles from stored timestamp after background | unit (`remainingMs`/`formatMSS` math) + **manual UAT** (home-swipe ≥30s, return, assert correct) | `npm run test:rest-timer` (math) | ❌ Wave 0 |
| TIMER-03 | Local notification fires when rest ends, backgrounded | **manual UAT only** (notification delivery is native, un-assertable in CI) | n/a — device UAT | n/a |
| TIMER-04 | Configure duration + enable/disable in Settings | unit (`fm:restSeconds`/`fm:restTimerEnabled` schema round-trip + default 120/OFF + corrupt→default) + manual (picker UAT) | extend `npm run test:rest-timer` (or a prefs test) | ❌ Wave 0 |
| TIMER-05 | Skip / next-set cancels the scheduled notification | unit (reschedule-decision: skip→cancel, +30s→cancel+reschedule, next-set→cancel+reschedule) + **manual UAT** (assert no stale ping) | `npm run test:rest-timer` (decision) | ❌ Wave 0 |
| SET-07 (gate) | Notification fires only if timerON && fm:notifications && permission granted (D-14) | unit (pure gating predicate) + manual (toggle matrix UAT) | `npm run test:rest-timer` (gate predicate) | ❌ Wave 0 |
| F13 guard | Hot path + offline queue untouched | regression | `npm run test:f13-brutal` (existing) | ✅ |

**What is pure-logic (unit-testable in `rest-timer.ts`):** `remainingMs(endTs, now)`, `formatMSS(ms)`, the reschedule-decision (`decideNotificationAction(event)` → `'schedule'|'cancel'|'reschedule'`), the D-14 gating predicate (`shouldFireNotification(timerOn, masterOn, permissionGranted)`), and the new-end-on-extend math (`endTs + 30000`). All Node-importable.
**What is native-bound (UAT only):** actual notification delivery (TIMER-03), permission prompt UX (D-13), background reconcile correctness on a real device (TIMER-02), notification-tap deep-link routing (D-15).

### Sampling Rate
- **Per task commit:** `npm run test:rest-timer` (the pure-logic gate; <1s).
- **Per wave merge:** full `test:*` suite incl. `npm run test:f13-brutal`.
- **Phase gate:** full suite green + a device-UAT pass covering TIMER-02 (background reconcile), TIMER-03 (background ping), TIMER-05 (cancel/no-stale), D-13 (permission prompt), D-15 (tap → workout route) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `app/scripts/test-rest-timer.ts` — covers TIMER-01/02/04/05 + SET-07 gate (pure-logic Case[] table, mirrors `test-units.ts`)
- [ ] `app/package.json` script: `"test:rest-timer": "tsx scripts/test-rest-timer.ts"`
- [ ] `app/lib/rest-timer.ts` — the pure module the test imports (must exist before the test)
- [ ] Device-UAT checklist (manual-test markdown, mirroring `scripts/manual-test-phase-06-uat.md`) for TIMER-02/03 + D-13/D-15 (un-assertable in CI)

*(No framework install needed — `tsx` is already in devDependencies.)*

## Security Domain

`security_enforcement: true`, ASVS L1 (config.json). The new attack surface is the OS notification-permission grant and the notification-tap deep-link.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth change; session already managed (LargeSecureStore) |
| V3 Session Management | no | Unchanged |
| V4 Access Control | no | No new data access; timer state is device-local AsyncStorage, no Supabase rows |
| V5 Input Validation | yes | `fm:restSeconds` validated via Zod `.catch(120).parse()` (total over `unknown`, T-09-01 lineage); notification `data.sessionId` validated/guarded before routing |
| V6 Cryptography | no | No secrets; no crypto needed for local timer state |
| V8 Data Protection | yes | D-15: NO exercise data in the notification payload (lock-screen privacy); only `{ sessionId }` |
| V14 Configuration | yes | `npx expo install` pins the SDK-matched version; no service-role; no env vars |

### Known Threat Patterns for {Expo iOS local notifications}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious deep-link via crafted notification (M4 anti-phishing) | Spoofing/Tampering | Tap target is an **in-app expo-router route** (`/(app)/workout/${sessionId}`), NEVER `Linking.openURL` of an external URL. Validate `data.sessionId` is a non-empty string before `router.push`; route only into the authenticated `(app)` group. (CLAUDE.md M4) |
| Sensitive data on the lock screen | Information disclosure | D-15: notification body is generic i18n text; no exercise/weight/PII in `content` or `data` beyond the sessionId routing token |
| Corrupt/tampered `fm:restSeconds` causing a huge/zero timer | Tampering/DoS | Zod `z.coerce.number().int().positive().catch(120)` — throw-free, clamps garbage to the 120s default |
| Stale notification firing after context change | (reliability, not security) | Cancel-before-reschedule (Pitfall 6); finish-cancels-on-session-end |

**No service-role, no secrets, no new RLS surface** — the timer is entirely device-local. F13 hot-path + offline-queue untouched (verified-by-design: fire-and-forget after mutate). `npm run test:f13-brutal` must remain green.

## Sources

### Primary (HIGH confidence)
- [Expo Notifications SDK reference](https://docs.expo.dev/versions/latest/sdk/notifications/) — `setNotificationHandler` (`shouldShowBanner`/`shouldShowList`), `scheduleNotificationAsync` (`SchedulableTriggerInputTypes.DATE`/`.TIME_INTERVAL`), `cancelScheduledNotificationAsync`, `getPermissionsAsync`/`requestPermissionsAsync` (`canAskAgain`/`status`), `addNotificationResponseReceivedListener`, "Local notifications remain available in Expo Go" [CITED]
- `npm view expo-notifications dist-tags` (2026-06-14) — `sdk-54: 0.32.17`, `latest: 56.0.17`; maintainers = Expo team; repo = `github.com/expo/expo` [VERIFIED: npm registry]
- Codebase: `app/lib/query/network.ts` (AppState/focusManager + globalThis Fast-Refresh sentinel idiom — the reconcile + listener-teardown precedent); `app/lib/prefs.ts` (`fm:*` typed-pref idiom, numeric-serializer comment line 90); `app/app/(app)/workout/[sessionId].tsx:630-678` (onKlart fire-and-forget-after-mutate placement); `app/scripts/test-units.ts` (Node-only unit-test skeleton) [VERIFIED: codebase grep]

### Secondary (MEDIUM confidence)
- [WebSearch — Expo Go SDK 53 push removed, local notifications still work](https://docs.expo.dev/versions/latest/sdk/notifications/) cross-confirmed by multiple results (Courier guide, expo/expo issues) — push removed from Expo Go SDK 53+, **local notifications remain** [VERIFIED: WebSearch cross-confirmed against official docs]
- [WebSearch — iOS Settings deep-link](https://medium.com/toprakio/react-native-how-to-open-app-settings-page-d30d918a7f55) — built-in `Linking.openSettings()` opens the iOS app settings page; 3rd-party libs unnecessary [MEDIUM]

### Tertiary (LOW confidence)
- DATE-vs-TIME_INTERVAL on-device reliability nuance (A1) — verify in Wave 0 UAT.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — first-party Expo module, version verified on npm, install path pinned by `npx expo install`.
- Architecture (reconciliation + fire-and-forget + listener wiring): HIGH — directly mirrors existing repo idioms (`network.ts` AppState/sentinel, `[sessionId].tsx` post-mutate blocks).
- Expo Go SDK 54 local-notification support: HIGH — official docs + WebSearch cross-confirmation; the key risk (push removal) is explicitly NOT in scope (local-only).
- Pitfalls: HIGH for the documented ones (version, background-timer, permission-gating); MEDIUM for trigger-type nuance (A1, UAT-resolvable).

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (stable; re-verify the `sdk-54` dist-tag if the project bumps Expo SDK)

## RESEARCH COMPLETE

**Phase:** 14 - Rest Timer (F19) — RESEARCH-FLAGGED
**Confidence:** HIGH

### Key Findings
- **Local scheduled notifications WORK in Expo Go on iOS for SDK 54** — Expo removed only *remote push* in SDK 53+. No dev build needed. This de-risks the entire phase.
- Install via `npx expo install expo-notifications` → resolves the SDK-54 line `~0.32.17`. `npm view` `latest` is `56.0.17` (SDK 56) — must NOT be installed.
- TIMER-02 reconciliation = store absolute `endTs` (ms epoch), 1s interval is display-only, re-derive `endTs - Date.now()` on render + AppState `active`. The exact pattern this repo already uses in `lib/query/network.ts`.
- Cleanest state owner = a Zustand store (`endTs` + `notificationId`) + a pure Node-importable `rest-timer.ts` for the math (M:SS, remaining, reschedule decision) — unit-testable via the existing `tsx` `test:*` idiom.
- Notification tap deep-link = `addNotificationResponseReceivedListener` at `_layout.tsx` module scope (Fast-Refresh-guarded), routing `data.sessionId` into the in-app `(app)/workout/[sessionId]` route — never an external URL (M4).

### File Created
`.planning/phases/14-rest-timer-f19-research-flagged/14-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | First-party Expo, version verified on npm, install pinned by `npx expo install` |
| Architecture | HIGH | Mirrors existing repo idioms (network.ts AppState/sentinel, post-mutate fire-and-forget) |
| Pitfalls | HIGH | Version/background/permission pitfalls documented; trigger-type nuance is UAT-resolvable |

### Open Questions
- DATE vs TIME_INTERVAL trigger (recommend DATE; UAT-verify) — does not block planning.
- Preset duration list + custom-input mechanism (D-08 discretion) — recommend 60/90/120/180/300 + "Anpassad" via the existing ActionSheetIOS idiom.
- Session-finish-while-resting → `finish()` cancels pending notification (discretion default).

### Ready for Planning
Research complete. The planner can create PLAN.md files: Wave 0 (install expo-notifications, `rest-timer.ts` pure module + `test-rest-timer.ts`, `prefs.ts` extension), then the store, notification wrapper, `_layout.tsx` wiring, the Settings row/picker/permission flow, and the floating countdown banner in the workout overlay.
