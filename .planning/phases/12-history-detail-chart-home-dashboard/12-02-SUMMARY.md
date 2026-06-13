---
phase: 12-history-detail-chart-home-dashboard
plan: 02
subsystem: ui
tags: [i18n, units, conversion, locale, react-native, expo]

# Dependency graph
requires:
  - phase: 09-auth-settings-preferences
    provides: lib/units.ts (toDisplayWeight/formatWeight) + lib/prefs.ts (getPref fm:units)
  - phase: 08-forge-foundation
    provides: flat 1:1 locale key convention (D-10), check-locale-parity gate
provides:
  - "toDisplayVolume(kg, unit) — tonnage conversion, NO 0.5-lb rounding (D-20)"
  - "formatVolume(kg, unit) — sv-SE NBSP-grouped + kg/lb suffix"
  - "Full phase-12 sv+en locale key set at parity (180 keys), incl. weeks/week streak relabel (D-07)"
  - "back relabeled to no-arrow a11y form + moreOptions key (UI-SPEC FLAG-1)"
affects: [12-03, 12-04, 12-05, 12-06, 12-07, 12-08, history.tsx, sessionId.tsx, chart.tsx, home-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Volume conversion routes through units.ts (no inline math in screens)"
    - "Tonnage sums convert WITHOUT half-rounding (weights-only roundHalf stays scoped)"
    - "All phase-12 screen strings exist as flat t() keys before any screen re-skin"

key-files:
  created: []
  modified:
    - app/lib/units.ts
    - app/scripts/test-units.ts
    - app/locales/sv.json
    - app/locales/en.json

key-decisions:
  - "D-20: toDisplayVolume divides by KG_PER_LB with NO roundHalf — 0.5-lb plate granularity is meaningless on a multi-thousand-kg tonnage sum"
  - "formatVolume rounds the converted value to a whole unit before sv-SE grouping (fractional pounds on a tonnage sum are noise)"
  - "D-21: every phase-12 screen string added as a flat sv+en key sourced from the UI-SPEC Copywriting Contract"
  - "D-07: streak chip relabeled to weeks/week keys; existing days/day keys preserved (used elsewhere)"
  - "back key relabeled from '← Tillbaka'/'← Back' to 'Tillbaka'/'Back' (no arrow) per UI-SPEC FLAG-1 a11y mandate"

patterns-established:
  - "Tonnage display conversion: toDisplayVolume/formatVolume mirror the weight-helper shape but skip roundHalf"
  - "New contract keys added rather than mutating overloaded existing keys (thisWeekVolume vs weekVolume, rangeAll vs allTime) to avoid cross-screen drift"

requirements-completed: [SKIN-06, DASH-03]

# Metrics
duration: ~18min
completed: 2026-06-13
---

# Phase 12 Plan 02: Shared Client Dependencies (Volume Helpers + i18n Sweep) Summary

**Added `toDisplayVolume`/`formatVolume` to units.ts (D-20, no 0.5-lb rounding) and the complete phase-12 sv+en locale key set at 180-key parity, including the dagar→veckor streak relabel (D-07) and the no-arrow a11y `back` + `moreOptions` keys (FLAG-1).**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-13T17:00Z
- **Completed:** 2026-06-13
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `toDisplayVolume(kg, unit)`: imperial = `kg / KG_PER_LB` with NO `roundHalf`, metric passthrough, non-finite guard returns 0. Weights helpers (`toDisplayWeight`/`formatWeight`/`roundHalf`) untouched.
- `formatVolume(kg, unit)`: locale-grouped (`toLocaleString("sv-SE")` NBSP separator) + `kg`/`lb` suffix, e.g. `"28 720 kg"`.
- Extended `scripts/test-units.ts` with 9 new volume cases (float-tolerance comparison for the irrational imperial division) — RED→GREEN; all 22 cases pass.
- Added all phase-12 i18n keys (sv+en parity) from the UI-SPEC Copywriting Contract: `weeks`/`week` (streak relabel), `moreOptions`, `logFirstWorkout`, `lifetimeEyebrow`, `thisWeekVolume`, `volumeDeltaPct`, `volumeTrendEmpty`, `setsStatLabel`, `volumeStatLabel`, `exercisesHeader`, `deleteSessionQ`, `cannotUndo`, `metricMaxWeight`, `metricTotalVolume`, `rangeAll`, `volPerSession`, `last10Sessions`, `loadErrorPull`.
- Parity gate PASS at 180 keys; existing `days`/`day` preserved.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing volume helper cases** - `720341f` (test)
2. **Task 1 (GREEN): toDisplayVolume + formatVolume** - `fc18990` (feat)
3. **Task 2: phase-12 i18n keys at sv/en parity** - `edc86dd` (feat)

_Task 1 was TDD (test → feat)._

## Files Created/Modified

- `app/lib/units.ts` - Added `toDisplayVolume` + `formatVolume` (additive, pure); weights helpers untouched.
- `app/scripts/test-units.ts` - Added 9 volume cases + float-tolerance comparison; mirrors existing Case[]-table skeleton.
- `app/locales/sv.json` - Added `weeks`/`week` + 18 phase-12 keys; `back` relabeled to no-arrow form.
- `app/locales/en.json` - Same key set at parity.

## Decisions Made

- **No half-rounding on volume (D-20):** `roundHalf` is a weights-only plate-granularity convention; applying it to a tonnage sum is meaningless. `toDisplayVolume` divides cleanly; `formatVolume` rounds to whole units only at the display boundary.
- **New keys over mutated keys:** Added `thisWeekVolume` (vs reusing `weekVolume` "Weekly volume") and `rangeAll` (vs reusing `allTime` "All time") so the Copywriting Contract's exact en strings ship without changing the meaning of keys consumed by other screens.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Relabeled `back` from "← Tillbaka"/"← Back" to "Tillbaka"/"Back"**
- **Found during:** Task 2 (i18n keys)
- **Issue:** The plan + UI-SPEC FLAG-1 mandate `back` = "Tillbaka"/"Back" (no arrow) for the icon-only circular back button's `accessibilityLabel`. The existing key carried a "←" glyph prefix — a VoiceOver label reading "left-arrow Tillbaka" is poor a11y, and the FLAG-1 contract is authoritative.
- **Fix:** Changed the `back` value in both locales to the no-arrow form. Two pre-existing visible-text usages (`workout/[sessionId].tsx:389` ForgeButton label, `plans/[id]/exercise-picker.tsx:305` Text) now render "Tillbaka"/"Back" without the arrow — a benign cosmetic change; both remain correct, readable labels.
- **Files modified:** app/locales/sv.json, app/locales/en.json
- **Verification:** tsc --noEmit exit 0; parity gate PASS; `back` values confirmed via tsx probe.
- **Committed in:** edc86dd (Task 2 commit)

**2. [Rule 3 - Blocking] Plan verify commands referenced non-existent script names**
- **Found during:** Both tasks
- **Issue:** Plan referenced `npm run typecheck` (no such script) and `npm run check-locale-parity` (actual: `check:locale-parity`).
- **Fix:** Used `npx tsc --noEmit` for typecheck and the correct `npm run check:locale-parity` script name. No file changes — verification-path only.
- **Verification:** tsc exit 0; parity PASS at 180 keys.
- **Committed in:** N/A (no code change)

---

**Total deviations:** 2 (1 Rule 1 a11y fix, 1 Rule 3 verify-path correction)
**Impact on plan:** Both necessary for correctness/a11y. The `back` relabel touches two out-of-scope screens' visible text cosmetically (arrow dropped) but is mandated by FLAG-1 and improves screen-reader output. No scope creep.

## Issues Encountered

- The irrational imperial volume division can't be compared with `Object.is`; added an optional `tol` (absolute tolerance) field to the test `Case` type and a `matches()` helper. Resolved cleanly.

## User Setup Required

None - pure client utility + static locale data; no external service configuration.

## Next Phase Readiness

- Wave-3 screen re-skins (12-05/06/07/08) can now import `toDisplayVolume`/`formatVolume` from `app/lib/units.ts` and `t('...')` every contract key with zero invention.
- Home hero (12-04) has `logFirstWorkout` + `weeks`/`week` streak keys ready.
- D-20 (volume conversion), D-21 (i18n sweep), D-07 (streak relabel keys) foundations all in place.

## Known Stubs

None — both helpers are fully implemented and tested; all keys carry real translations.

## Self-Check: PASSED

- FOUND: 12-02-SUMMARY.md
- FOUND: commits 720341f (test), fc18990 (feat), edc86dd (feat)
- FOUND: app/lib/units.ts, app/locales/sv.json, app/locales/en.json

---
*Phase: 12-history-detail-chart-home-dashboard*
*Completed: 2026-06-13*
