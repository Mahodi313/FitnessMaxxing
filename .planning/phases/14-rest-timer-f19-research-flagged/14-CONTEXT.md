# Phase 14: Rest Timer (F19) — RESEARCH-FLAGGED - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a **rest timer** that auto-starts after a logged set, shows a visible countdown during the workout, **survives backgrounding** by scheduling an OS local notification (reconciled from a stored timestamp — never a JS timer), and is configurable in Settings (gated by notification permission).

**Surfaces in scope (TIMER-01 … TIMER-05):**
- **Active-workout screen** (`app/app/(app)/workout/[sessionId].tsx`) — completing a working-set "Klart" auto-starts the rest countdown (TIMER-01); a visible countdown banner renders as a **floating top-overlay** that reconciles from a stored timestamp after backgrounding (TIMER-02); skip / +30s / logging the next set cancel-or-extend the rest and its scheduled notification (TIMER-05).
- **OS local notification** — fires when rest ends, including when the app is backgrounded (TIMER-03); cancelled/rescheduled on early skip, +30s, or next-set start (TIMER-05).
- **Settings** (`app/app/(app)/(tabs)/settings.tsx`, `restTimer` row at design `forge-screens.jsx:933`) — enable/disable the timer + choose the default rest duration; enabling triggers the OS notification-permission prompt (TIMER-04).

This phase **clarifies HOW** to build the rest timer. New capabilities belong in other phases.

**RESEARCH-FLAGGED** (ROADMAP line 278): the deep technical mechanics are **owned by the researcher/planner, not the user** — `expo-notifications` permission UX, Expo Go SDK 54 local-notification behavior, JS-suspension reconciliation, and time-drift. The decisions below are the **product/UX layer** that constrains that research.

**Out of scope (do NOT build here):**
- **Per-exercise rest-duration override** — a new capability beyond TIMER-04 ("a default rest duration"); needs a `plan_exercises` schema column + per-exercise UI + sync. **Deferred to its own future phase** (see `<deferred>`). Exercise notes may still contain free-text like "Vila 2 min" today (mock `forge-screens.jsx:1532`).
- **Pause/resume control** — considered, not selected; only skip + +30s ship.
- **Remote push notifications** — local notifications only (Expo Go SDK 54; REQUIREMENTS "Out of Scope" row).
- **F13 hot-path write internals** — mutation defaults, offline queue, persister scope-bindings, `exercise_sets` logging behavior untouched. `npm run test:f13-brutal` stays green (SKIN-08 standing constraint). The timer is a **fire-and-forget side-effect after `addSet.mutate`**, exactly like the PR banner (Phase 13 D-17).
- **Global i18n zero-missing-keys audit** — Phase 15 (this phase i18ns the strings it adds, sv+en at parity).

</domain>

<decisions>
## Implementation Decisions

### Countdown UI in the workout (TIMER-01, TIMER-02, TIMER-05)
- **D-01 (floating top-overlay — reuses the PR-banner position):** The visible countdown renders as a **floating, absolutely-positioned banner at the top**, reusing the existing PR-celebration overlay slot (`workout/[sessionId].tsx` ~line 462, the `position:"absolute"` banner stack). It **NEVER shifts** the set list, input row, or "Klart" button — same `D-09` geometry-protection rule as the PR banner. The design source has **no timer component** — this banner is NEW and must be designed in Forge tokens.
- **D-02 (controls = Hoppa över + +30s):** The banner shows the remaining time plus two controls: **[Hoppa över]** (ends rest immediately, cancels the scheduled notification — satisfies TIMER-05) and **[+30s]** (extends the rest, reschedules the notification to the new end time). No pause/resume in v1.
- **D-03 (next working set also cancels/restarts):** Logging the next working-set "Klart" while a rest is running **cancels the current rest + its notification and starts a fresh full-duration rest** (see D-06). So early-cancel (TIMER-05) is reachable three ways: Hoppa över, +30s-then-skip, or simply starting the next set.
- **D-04 (PR celebration wins the position, timer banner defers):** When a logged set is **both a PR and starts a rest**, the **PR banner plays its ~3–4s celebration FIRST**, then the rest-timer banner takes over the top position. The **timer starts logically immediately** (timestamp is set at log-time so the countdown/notification are accurate); only the *visual* banner is deferred behind the PR celebration. Fire-first-then-count.

### Auto-start & trigger (TIMER-01)
- **D-05 (auto-start on every working-set Klart):** When the rest timer is enabled in Settings, **every logged working set auto-starts** the rest at the default duration — zero extra taps ("log and rest"). The Settings toggle is the global on/off.
- **D-06 (working sets only):** Only `set_type = 'working'` sets auto-start a rest. Warmup / dropset / failure sets log without starting a rest (consistent with PR detection's working-only rule, Phase 13 D-03). User can always Hoppa över.
- **D-07 (latest set restarts the rest):** A new working set restarts the rest on a **fresh full default duration**, cancelling the previous rest + rescheduling the notification. "Latest set wins" — natural when correcting or adding a set.

### Rest-duration configuration (TIMER-04)
- **D-08 (Settings chevron → presets + custom):** The `restTimer` Settings row (mock `forge-screens.jsx:933`, "På · 2 min", chevron) opens a picker with **preset durations PLUS a custom-time option**. Presets are Claude's discretion (e.g. 60s / 90s / 2 min / 3 min / 5 min) plus an "Anpassad" custom entry.
- **D-09 (one global default — TIMER-04 as written):** v1 ships a **single global default rest duration** applied to all exercises. **Per-exercise override is explicitly deferred** (see `<deferred>`).
- **D-10 (default value = 2 min):** The out-of-box default is **120s (2 min)**, matching the mock's "På · 2 min". Persisted as a new `fm:restSeconds` pref (already anticipated in `app/lib/prefs.ts` comments) following the established `fm:*` typed-pref idiom.
- **D-11 (enable/disable in Settings, gated by permission):** The row carries both the **enable/disable** state and the duration; enabling triggers the permission flow (D-13).

### Permission & notification behavior (TIMER-03, TIMER-04, TIMER-05)
- **D-12 (timer needs permission for background notification; in-app works regardless):** Background notification (TIMER-03) requires OS notification permission. If permission is **denied, the in-app foreground countdown still works** — the user only loses the background "rest is over" notification, communicated clearly. The timer is useful even without permission.
- **D-13 (prompt fires when the timer is toggled ON in Settings):** The OS permission prompt appears **when the user enables the rest timer in Settings** — a calm, in-context moment where the choice is clear. NOT during onboarding (low grant rate) and NOT mid-workout (breaks the ≤3s hot path). Grant/deny status reflects back into the Settings row.
- **D-14 (general "Aviseringar" toggle = master gate):** The rest notification fires only if **rest-timer ON AND `fm:notifications` (SET-07 bell toggle) ON AND OS permission granted**. The general notifications toggle is an **app-wide master off-switch for all notifications** (future-proof as more notification types arrive). The **in-app countdown is unaffected** by the master toggle — only the OS notification is gated.
- **D-15 (notification content):** Simple **i18n text** ("Vilan är slut" / "Rest is over" — sv+en at parity), **sound + vibration** (vibration respects the `fm:haptics` pref), and **tapping the notification deep-links back into the active workout** (`workout/[sessionId]`). No exercise data baked into the notification (keeps the lock-screen simple + private).

### Claude's Discretion
- **Exact preset duration list** for the picker (D-08) — researcher/planner's call within the presets-plus-custom shape.
- **Custom-time input mechanism** (stepper, wheel, free numeric entry) for the "Anpassad" option (D-08).
- **Timestamp-reconciliation mechanism** (TIMER-02) — how the countdown re-derives remaining time from the stored start/end timestamp on foreground/return; drift handling. **RESEARCH-FLAGGED — research owns this.**
- **`expo-notifications` schedule/cancel/reschedule API specifics** and Expo Go SDK 54 behavior (TIMER-03/TIMER-05) — **RESEARCH-FLAGGED.**
- **Permission-status surfacing** in the Settings row (how denied/blocked state reads; deep-link to iOS Settings if blocked).
- **Banner enter/exit motion** for the countdown banner — follow the Forge §07 motion table + reduce-motion snap (Phase 12 D-18 / Phase 13 D-19 precedent).
- **`t()` key names** for the new timer strings (flat-key convention, Phase 8 D-10).
- **Exact behavior when a workout is finished/abandoned while a rest is running** (not asked) — sensible default: finishing the session cancels any pending rest + notification.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` → "Phase 14: Rest Timer (F19) — RESEARCH-FLAGGED" (line ~204) — goal + 4 success criteria. **Line ~278 research flag:** "expo-notifications permission UX + Expo Go SDK 54 local-notification behavior + JS-suspension reconciliation + time-drift."
- `.planning/REQUIREMENTS.md` → rows **TIMER-01 … TIMER-05** (lines 58–64) and **SET-07** (line 38, the device-local notifications toggle gated by OS permission). Also the **Out of Scope** row: "Local notifications only (Expo Go SDK 54); rest timer needs no remote push" (line 104).

### Design source of truth (read first)
- `app/design v2/Sources/design/forge-screens.jsx`:
  - **`forge-screens.jsx:933`** — the `restTimer` Settings row: `icon="clock"`, `label={t.restTimer}`, value "På · 2 min" / "On · 2 min", **chevron** (D-08/D-10/D-11).
  - **`forge-screens.jsx:935`** — the `notifications` Settings row: `icon="bell"`, `label={t.notifications}`, **toggle** (SET-07 master gate, D-14).
  - **`forge-screens.jsx:931`** — the `workoutPrefs` SettingsSection these rows live in.
  - **`forge-screens.jsx:1532`** — exercise-notes free-text example "Rest 2 min between sets" (why per-exercise rest is currently just a note, not structured — supports the D-09 defer).
  - **NO timer/countdown component exists in the design** — the D-01 banner is net-new; compose from Forge primitives.
- `app/design v2/Sources/design/lib.jsx` — `THEMES.forge` tokens + `Icon` paths (`clock`, `bell`) for the banner + Settings rows.
- `app/design v2/Sources/design/Forge Design Spec.html` → **§07 Motion** (line ~551) for banner enter/exit + reduce-motion snap; **§ haptics** (line ~660) for `impactMedium` / `notificationSuccess` mapping (vibration policy, D-15).

### Existing code to extend / re-use
- `app/app/(app)/workout/[sessionId].tsx` (1560 lines) — the hot-path active-workout screen. **`~line 462`**: the existing `position:"absolute"` floating banner overlay stack (PR-03) the rest-timer banner reuses/coexists with (D-01/D-04). **`onKlart` (~line 630) + `addSet.mutate` (~line 641)**: the working-set log site where auto-start hooks in **fire-and-forget after the mutate** (D-05, Phase 13 D-17 pattern). Set-type is logged as `'working'` here (D-06).
- `app/app/(app)/(tabs)/settings.tsx` — `restTimer` enable/disable + duration row and the `notifications` master toggle (`onNotificationsToggle` ~line 319, `fm:notifications` state ~line 214). Follow the existing `fm:theme`/`fm:notifications` read/write idiom for the new `fm:restSeconds` pref.
- `app/lib/prefs.ts` — the typed `fm:*` AsyncStorage pref wrapper (`getPref`/`setPref`, Zod-validated, schema-default fallback). **Line ~90 already anticipates a numeric `fm:restSeconds` key** — add it here (D-10) alongside `fm:notifications` (line 22 note: currently stored-only, no real OS permission yet — this phase wires the real permission, D-12/D-13).
- `app/components/ui/SettingsRow` (`SettingsRow`/`SettingsSection`) — compose the rest-timer row + picker entry (D-08).
- `app/lib/i18n.ts` + `app/locales/{sv,en}.json` — add timer strings (banner labels, Hoppa över, +30s, notification title/body) at sv+en parity (D-15).

### Conventions & constraints (locked — do not re-derive)
- `CLAUDE.md` → "Project / Constraints" — Core Value ("never lose a set"), **≤3s log budget** (the timer must never delay the set save — D-05 fire-and-forget), offline-first.
- `CLAUDE.md` → "Security conventions" — Phase 14 checklist context: notification permission is the new OS-permission surface; no service-role, no secrets; deep-link handling on notification tap (M4 anti-phishing — the tap target is an in-app route, not an external URL, D-15).
- `app/scripts/verify-f13-brutal-test.ts` — `npm run test:f13-brutal`. Must stay green after (timer is read-side + fire-and-forget; expect no regression). **Known amber: FIT-107** — count-only precondition (25-set fixture), environmental, not a regression (see [[reference_f13_brutal_fixture_window]]).

### Phase carry-forward (locked)
- `.planning/phases/13-pr-celebration-f18/13-CONTEXT.md` — **D-09** (floating overlay never shifts Klart — drives D-01), **D-17** (fire-and-forget after `addSet.mutate`, F13 sacred — drives D-05), **D-03** (working-sets-only — drives D-06), **D-18** (`fm:haptics`-gated haptic — drives D-15 vibration), **D-19** (reduce-motion snap — drives banner motion), **D-21** (full i18n for new strings — drives D-15).
- `.planning/phases/09-auth-settings-preferences/09-CONTEXT.md` — the `fm:*` typed-pref pattern, **D-07** (`fm:notifications` defaults OFF, stored-only, OS prompt deferred — this phase closes that deferral), `fm:haptics` pref (D-08 defaults ON).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **PR-banner overlay slot** (`workout/[sessionId].tsx:~462`) — the existing floating absolute banner stack the countdown banner reuses (D-01) and coexists with (D-04).
- **`app/lib/prefs.ts`** — typed `fm:*` pref wrapper with Zod validation; `fm:restSeconds` already anticipated in comments (D-10). `fm:notifications` (master gate, D-14) and `fm:haptics` (vibration gate, D-15) already exist.
- **`app/components/ui/SettingsRow`** — `SettingsRow`/`SettingsSection` primitives for the timer Settings row (D-08/D-11).
- **`app/lib/i18n.ts` + `app/locales/{sv,en}.json`** — i18n routing for all new strings (D-15).
- **Reanimated 4 + Skia (in stack)** — drive the countdown-banner motion (§07, reduce-motion aware).

### Established Patterns
- **`expo-notifications` is NOT yet installed** — confirmed absent from `app/package.json`. Installing + configuring it is NEW work for this phase (RESEARCH-FLAGGED). Install via `npx expo install expo-notifications` per the SDK-54 pinning rule.
- **`fm:notifications` was stored-only** (Phase 9 D-07 deferred the real OS permission) — this phase wires the actual permission request (D-12/D-13).
- **Fire-and-forget post-mutate side-effect** — Phase 11 D-12 / Phase 13 D-17 (motion + gated haptic, then PR detection, after `addSet.mutate`) is the exact pattern auto-start follows (D-05). The hot path must not wait on the timer.
- **Inline-overlay, never Modal portal** — Phase 11/12 D-22; the countdown banner is an in-tree floating overlay (D-01).
- **Timestamp-not-JS-timer reconciliation** — TIMER-02 mandates the countdown re-derive from a stored timestamp; the JS interval is display-only and must reconcile on foreground (RESEARCH-FLAGGED).

### Integration Points
- `package.json` ← `expo-notifications` (new dependency) + `app.json`/config-plugin notification setup (RESEARCH-FLAGGED).
- `app/lib/prefs.ts` ← new `fm:restSeconds` key + schema; `fm:notifications` now backs a real permission state (D-10/D-14).
- `workout/[sessionId].tsx` ← auto-start hook after `onKlart`/`addSet.mutate` (D-05/D-06/D-07); floating countdown banner in the overlay stack (D-01/D-02/D-04); notification schedule/cancel/reschedule tied to skip/+30s/next-set (D-02/D-03/TIMER-05).
- `(tabs)/settings.tsx` ← rest-timer enable/disable + duration picker + permission prompt on enable (D-08/D-11/D-13); master-toggle relationship to `fm:notifications` (D-14).
- A new notification service/util (e.g. `app/lib/rest-timer.ts` or `app/lib/notifications.ts`, name = planner's call) ← schedule/cancel/reschedule + timestamp reconciliation; pure-logic parts Node-importable + unit-testable (units.ts / e1rm.ts precedent).
- `app/locales/{sv,en}.json` ← banner labels, controls, notification title/body (D-15).
- **F13 risk: NONE for the hot path** — auto-start is fire-and-forget after the mutate; no mutation/queue/persister-for-logging touched. Verify `test:f13-brutal` green after (D-05).

</code_context>

<specifics>
## Specific Ideas

- **Log and rest, no extra taps.** When the timer is on, every working-set "Klart" just starts the rest — the user never reaches for a separate "start rest" button (D-05). Skip/+30s are there when they want control.
- **Fire first, then count.** A PR set is a celebration moment first; the rest banner waits its ~3–4s turn for the top spot, while the timer itself starts ticking accurately from the log timestamp the instant the set lands (D-04).
- **The countdown must never touch the budget.** Like the PR banner, the timer is delight layered on top of the ≤3s log path — floating, fire-and-forget, never shifting the "Klart" button (D-01/D-05).
- **Useful even if you say no to notifications.** Denying the OS prompt doesn't break the feature — the in-app countdown still runs; you just lose the background ping (D-12). Permission is asked at the calm moment you turn the timer on, not mid-set (D-13).
- **One master off-switch for noise.** The general "Aviseringar" toggle silences all notifications app-wide; the rest timer respects it but its in-app countdown doesn't (D-14).
- **Latest set wins.** Starting (or correcting) the next working set restarts the rest fresh — the timer always reflects your most recent set (D-07).

</specifics>

<deferred>
## Deferred Ideas

- **Per-exercise rest-duration override** — wanted by the user, but a new capability beyond TIMER-04 ("a default rest duration"). Needs a `plan_exercises` schema column + per-exercise UI + sync. **Its own future phase** — to add it, expand ROADMAP/REQUIREMENTS first (new requirement), don't fold into Phase 14. v1 ships one global default (D-09); exercise notes can hold free-text rest hints meanwhile.
- **Pause/resume control on the countdown** — considered (D-02), not selected; adds timestamp-reconciliation + notification-reschedule complexity. Revisit if skip/+30s prove insufficient.
- **Reduce-motion as an in-app Settings pref** — honors OS setting only; no requirement for an in-app toggle.
- **Richer notification content** (exercise name / next-set hint on the lock screen) — rejected for v1 to keep it simple + private (D-15). A future enhancement.
- **Remote push notifications** — out of scope (Expo Go SDK 54; local only).

### Reviewed Todos (not folded)
None — `todo.match-phase 14` reported no pending todos (STATE.md "Pending Todos: None").

</deferred>

---

*Phase: 14-Rest Timer (F19) — RESEARCH-FLAGGED*
*Context gathered: 2026-06-14*
