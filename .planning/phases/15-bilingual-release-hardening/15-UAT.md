# Phase 15 — Release-Candidate Device UAT Matrix

> **Artifact:** D-05 screen×combo UAT matrix. One row per router screen, four combo
> columns (`sv-light` / `sv-dark` / `en-light` / `en-dark`), checked off on a real
> iPhone via Expo Go. This is the manual half of I18N-03 that static analysis
> (`test:i18n-coverage`) cannot reach, plus the runtime close-out of I18N-02 and the
> device-feel verification of SC4.

**Plan:** 15-04 · **Requirements:** I18N-03, I18N-02 · **Decisions:** D-05, D-06, D-02
**Combos:** `sv-light` · `sv-dark` · `en-light` · `en-dark`
**Hardware:** real iPhone, Expo Go (SDK 54) — no simulator substitute (color/feel verification)

---

## Pass Criteria (D-06)

A cell passes ONLY when, in that combo, the screen renders **complete** with:

1. **No truncated text** — no clipped/ellipsised copy, no button-label overflow, no
   tab-bar or single-line label wrap. Swedish runs longer than English — prioritise
   buttons, single-line labels, and the tab bar (RESEARCH §Common Pitfalls).
2. **No empty/fallback key** — no Swedish-in-English (or vice-versa) leak, no raw key
   string on screen. Watch the device LogBox for the dev-only red
   `[i18n] MISSING KEY: "<key>"` `console.error` from Plan 01's `missingKeyHandler`.
3. **No theme-contrast miss** — text and surfaces hold contrast in both light and dark;
   no near-white-on-white / near-black-on-black.

**Happy-path-only is NOT sufficient.** Each screen's hard-to-reach states (error, empty,
offline, PR celebration, rest timer — whichever apply) MUST be deliberately driven in each
combo before the row is signed off. A missing key most often hides in a state that the
happy path never renders.

A row is **clean** only when all four combo cells are checked AND every listed state for
that screen has been driven. File any genuine miss as a Linear bug
(`npm run linear:create -- --type bug --priority high --phase 15`) and close it before
sign-off (one fix per loop — established device-UAT-iteration pattern).

---

## Screen × Combo Matrix (12 screens)

> Screens enumerated from the router tree (RESEARCH §Code Examples). `_forge-gallery.tsx`
> (dev-only) and all `_layout.tsx` files are intentionally **excluded** — they are not
> user-facing screens.

| # | Route | Screen | States to drive (D-06) | sv-light | sv-dark | en-light | en-dark |
|---|-------|--------|------------------------|:--------:|:-------:|:--------:|:-------:|
| 1 | `(auth)/sign-in` | Sign in | error (bad credentials), empty (untouched form), offline (no network) | ☐ | ☐ | ☐ | ☐ |
| 2 | `(auth)/sign-up` | Sign up | error (validation / duplicate email), empty (untouched form), offline | ☐ | ☐ | ☐ | ☐ |
| 3 | `(app)/(tabs)/index` | Home / Plans | empty (no plans), active-session swap (banner), set-log + saved toast, offline banner | ☐ | ☐ | ☐ | ☐ |
| 4 | `(app)/(tabs)/history` | History list | empty (no sessions), saved toast, offline banner | ☐ | ☐ | ☐ | ☐ |
| 5 | `(app)/(tabs)/settings` | Settings | theme toggle, language override, units toggle, rest-timer enable + duration, sign-out | ☐ | ☐ | ☐ | ☐ |
| 6 | `(app)/plans/new` | New plan | error (validation), empty (untouched form), offline | ☐ | ☐ | ☐ | ☐ |
| 7 | `(app)/plans/[id]` | Plan detail | empty (no exercises), reorder (DraggableFlatList + ScaleDecorator), delete-confirm, offline | ☐ | ☐ | ☐ | ☐ |
| 8 | `(app)/plans/[id]/exercise-picker` | Exercise picker | empty (no filter match), filter pills, create-new, offline | ☐ | ☐ | ☐ | ☐ |
| 9 | `(app)/plans/[id]/exercise/[planExerciseId]/edit` | Plan-exercise edit | steppers (nullable targets), save, remove, offline | ☐ | ☐ | ☐ | ☐ |
| 10 | `(app)/workout/[sessionId]` | Active workout (hot path) | set-log, **PR celebration** (PR banner + trophy), **rest timer** (start / extend / skip + background ping), finish overlay, offline | ☐ | ☐ | ☐ | ☐ |
| 11 | `(app)/history/[sessionId]` | Session detail | breakdown, e1RM, PR trophy, delete-confirm, offline | ☐ | ☐ | ☐ | ☐ |
| 12 | `(app)/exercise/[exerciseId]/chart` | Exercise chart | empty (no data in range), range switch (30d/90d/All), draw-on-mount, offline | ☐ | ☐ | ☐ | ☐ |

**Hard-to-reach state coverage roll-up (D-06 — every state driven in every combo):**

| State | Screens where it must be driven | sv-light | sv-dark | en-light | en-dark |
|-------|----------------------------------|:--------:|:-------:|:--------:|:-------:|
| Error | sign-in, sign-up, plans/new | ☐ | ☐ | ☐ | ☐ |
| Empty | Home, History, plan detail, exercise-picker, chart | ☐ | ☐ | ☐ | ☐ |
| Offline | every screen (offline banner + paused writes) | ☐ | ☐ | ☐ | ☐ |
| PR celebration | active workout (PR banner + trophy swap) | ☐ | ☐ | ☐ | ☐ |
| Rest timer | active workout (start / extend / skip + background notification) | ☐ | ☐ | ☐ | ☐ |

---

## I18N-02 — Language-toggle runtime verification (D-02)

The device-locale-default + Settings-override resolver (`resolveLanguage` + the Phase-9
`LocaleBootstrap`) is unit-tested by `test:locale-resolve` (7 cases). This confirms the
**runtime** half on real hardware (D-11 mapping: Swedish device → `sv`, anything else → `en`).

- [ ] Set the **device** language to **Swedish** (Settings → General → Language & Region) → relaunch → app resolves **sv**.
- [ ] Set the **device** language to a **non-Swedish** language (e.g. English / German / Norwegian) → relaunch → app resolves **en** (the D-11 "anything else → en" branch).
- [ ] In-app **Settings → Language override → Svenska** → UI flips to Swedish live (no restart).
- [ ] In-app **Settings → Language override → English** → UI flips to English live (no restart).
- [ ] Settings override **wins** over the device locale (override set while device is on the other language → override language renders).

---

## SC4 — Motion + hot-path budget (tab-icon spring + ≤3s log-a-set)

- [ ] **Tab-icon spring (0.92 → 1):** switch between Planer / Historik / Inställningar tabs and confirm the active icon springs from 0.92 to 1 (Forge §07 curve: damping 18 / stiffness 220). The motion feels premium — a crisp settle, no jank, no overshoot wobble.
- [ ] **≤3s log-a-set budget (MOTN-01):** on `workout/[sessionId]`, log a set (enter weight + reps → Klart) and confirm the row commits in ≤3s from tap with no lag. The automated `test:f13-brutal` covers the budget gate; this confirms the on-device feel is unchanged by the tab-icon motion.
- [ ] **Hot path untouched (D-08):** logging a set during the same session shows no regression in responsiveness (no dropped frames, no stall on the write passage).

---

## Regression gate

> Automated half of SC3 (D-03 — the final release-regression gate). Run from the `app/`
> cwd on **2026-06-16** prior to the device sweep. Each command's exit code recorded below.

| # | Command (`cd app && …`) | Exit | Result |
|---|--------------------------|:----:|--------|
| 1 | `npm run test:i18n-coverage` | `0` | PASS — i18n coverage complete (34 files scanned, 205 flat keys + `exercise.`/`equip.` namespaces). No missing `t()` key, no bypassed JSX literal. |
| 2 | `npm run check:locale-parity` | `0` | PASS — sv/en key sets match (205 keys). |
| 3 | `npm run test:locale-resolve` | `0` | PASS — all 7 D-11 resolver cases (sv/en explicit + system device-locale → sv/en + fallback). |
| 4 | `npm run test:rls` | `0` | PASS — ALL cross-user assertions passed (Phase 2→13 batteries; access-control regression V4 intact). |
| 5 | `npm run test:f13-brutal` | `0` | NO-OP — "No workout_sessions found in the last 60 min. Nothing to verify." Per FIT-107, a count-only no-op/failure with no recent session is **environmental (fixture-window), NOT a regression** — the script imports nothing from `app/app/**`. Re-run after a fresh 25-set device fixture for a positive count assertion. |

**Result:** automated regression gate **green** (SC3 satisfied pending the device sweep). The
`test:f13-brutal` no-op is the known FIT-107 fixture-window condition, recorded as environmental
per project convention — not treated as a hard fail.

---

## Sign-off

- [ ] All 12 screen rows clean across all 4 combos (no truncation / fallback key / theme-contrast miss), including every listed hard-to-reach state.
- [ ] I18N-02 language-toggle (device locale + Settings override) confirmed on device.
- [ ] SC4 tab-icon spring feels premium + ≤3s log-a-set budget holds.
- [ ] Regression gate section (below Task 2) all green (modulo the FIT-107 f13-brutal fixture-window caveat).

**Approval:** pending device sweep (Task 3).
