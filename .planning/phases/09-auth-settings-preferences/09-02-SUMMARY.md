---
phase: 09-auth-settings-preferences
plan: 02
subsystem: ui
tags: [settings, preferences, i18n, nativewind, segmented-control, toggle, actionsheet, forge]

# Dependency graph
requires:
  - phase: 09-01
    provides: "lib/prefs (fm:* wrappers), lib/i18n resolveLanguage, lib/units formatWeight, profiles.weekly_goal column + bilingual i18n keys"
  - phase: 08-forge-foundation
    provides: "Forge primitives (SettingsRow, SettingsSection, ForgeButton, Icon) + forge.* tokens"
provides:
  - "Full Forge Settings screen (Profile · Appearance · Workout · Notifications · Sign-out) in D-13 order"
  - "Three-state LocaleBootstrap (system/sv/en) that survives cold launch"
  - "Forge-reskinned SegmentedControl with a new `compact` inline variant"
  - "SettingsRow `subtitle` prop (stacked caption, locale-safe against truncation)"
  - "Forge-reskinned bottom tab bar"
affects: [phase-12-activity-ring, auth-screens, future-settings-surfaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ActionSheetIOS for 2-3 option pref pickers behind chevron disclosure rows"
    - "SegmentedControl `compact` variant: content-sized uniform pills for inline Settings rows"
    - "SettingsRow `subtitle`: vertical label/caption stack to avoid locale-driven row overflow"

key-files:
  created: []
  modified:
    - "app/app/(app)/(tabs)/settings.tsx — full Forge Settings screen (SET-01..09)"
    - "app/components/segmented-control.tsx — Forge re-skin + `compact` variant (theme control)"
    - "app/components/ui/SettingsRow.tsx — iOS-size toggle, `subtitle` prop"
    - "app/app/_layout.tsx — three-state LocaleBootstrap (resolveLanguage)"
    - "app/app/(app)/(tabs)/_layout.tsx — Forge token re-skin of the tab bar"
    - "app/locales/sv.json, app/locales/en.json — added `cancel` key"

key-decisions:
  - "D-03/D-10 OVERRIDDEN by device UAT: Units + Language render as chevron disclosure rows opening an iOS ActionSheet (not segmented controls) to match the FSettings mockup. Language still live-switches via i18n.changeLanguage on selection (D-12 preserved); storage stays canonical kg (D-02). Theme remains an inline (compact) segmented control per the mockup."
  - "Weekly-goal unit hint ('sessions/week') moved from an inline value to a stacked SettingsRow subtitle — fixes English label truncation ('Weekly g…')."
  - "Toggles bumped to iOS-standard 51×31 (knob 27 + drop-shadow); track bg via NativeWind className (style-callback bg rendered transparent)."
  - "Weekly-goal stepper: 46px circular accent-soft buttons; minus is a crisp View bar (not a text glyph)."
  - "Sign-out uses ForgeButton variant='destructive' (red label) per UI-SPEC destructive token + mockup."
  - "220.5 lb units preview removed (never in the mockup); formatWeight conversion remains proven by test-units.ts and surfaces in a later weight-display phase."

patterns-established:
  - "compact SegmentedControl: alignSelf-center, content-sized uniform-minWidth pills, inline optical padding/gap — for inline Settings rows."
  - "SettingsRow subtitle: locale-safe secondary caption stacked under the label."
  - "Pref pickers: chevron disclosure row + ActionSheetIOS, selection applies live then persists via setPref."

requirements-completed: [SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07, SET-08, SET-09, I18N-02]

# Metrics
duration: ~95min
completed: 2026-06-11
---

# Phase 9 Plan 02: Forge Settings Screen Summary

**A full Forge Settings screen with live language switching, unit/weekly-goal/haptics/notifications preferences, and a device-UAT-driven visual polish pass that re-aligned the units/language selectors to the original FSettings mockup.**

## Performance

- **Duration:** ~95 min (incl. multi-round device UAT)
- **Completed:** 2026-06-11
- **Tasks:** 2 build tasks + Task 3 device UAT (approved after iteration)
- **Files modified:** 6

## Accomplishments
- Composed the full Forge Settings screen in D-13 order: read-only Profile (SET-02), Appearance (theme + language), Workout (units + weekly goal), Notifications (haptics + notifications), red Sign-out (SET-09, verbatim `useAuthStore.signOut`).
- Live language switching with no restart (SET-05/I18N-02) + three-state LocaleBootstrap that survives cold launch.
- Weekly-goal stepper persists to `profiles.weekly_goal` via own-row RLS write (SET-04); units/haptics/notifications persist via `fm:*` prefs.
- Forge-reskinned the SegmentedControl (new `compact` variant) and the bottom tab bar.

## Task Commits

1. **Task 1: SegmentedControl Forge re-skin + three-state LocaleBootstrap** — `9d63fa3` (feat)
2. **Task 2: Compose full Forge Settings screen** — `936c6a7` (feat)
3. **Task 3: Device UAT** — approved after the polish iteration below.

### Device-UAT polish iteration (Task 3)
- `96baa61` stack segmented rows + Forge-reskin tab bar
- `c39748e` align Units/Language to mockup (chevron + ActionSheetIOS), theme inline
- `83446d9` compact inline theme control + toggle knob shadow
- `6b9806c` roomier theme pills + visible selected + **red sign-out**
- `99e248e` iOS-size 51×31 toggles + bigger circular stepper with bar-minus
- `0cdd34d` restore toggle track bg (className) + bigger theme pills
- `d37f9b1` separate theme pills (wider gap)
- `bbc15bf` weekly-goal unit as stacked subtitle (fixes EN truncation)

## Files Created/Modified
- `app/app/(app)/(tabs)/settings.tsx` — full Settings screen; chevron+ActionSheet for units/language; inline compact theme segmented; stepper; toggles; destructive sign-out.
- `app/components/segmented-control.tsx` — Forge tokens + `compact` variant (uniform pills, inline optical padding/gap).
- `app/components/ui/SettingsRow.tsx` — iOS-standard 51×31 toggle (className track bg + knob shadow); new `subtitle` prop.
- `app/app/_layout.tsx` — three-state LocaleBootstrap via `resolveLanguage`.
- `app/app/(app)/(tabs)/_layout.tsx` — color-only Forge re-skin of the tab bar.
- `app/locales/sv.json`, `app/locales/en.json` — `cancel` key for the ActionSheets.

## Deviations
- **D-03/D-10 overridden (user UAT decision):** Units + Language are chevron disclosure rows opening iOS ActionSheets, not segmented controls. Live language switching and canonical-kg storage preserved.
- **220.5 lb units preview removed** (not in mockup) — `formatWeight` conversion stays covered by `test-units.ts`.
- **Toggle bg via className, not style-callback** — the callback form rendered the track transparent (NativeWind gotcha).

## Self-Check: PASSED
- Gates green at finalization: `tsc --noEmit` clean, `expo lint` clean, `check:locale-parity` PASS (100 keys).
- Device UAT (light/dark, both locales) approved by the user.
- FIT-66 preserved throughout (no `active:*`/`shadow-*` classes; pressed feedback + shadows via style callbacks / inline objects).
