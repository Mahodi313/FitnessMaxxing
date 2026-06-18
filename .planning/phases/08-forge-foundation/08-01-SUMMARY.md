---
phase: 08-forge-foundation
plan: 01
subsystem: ui
tags: [i18n, i18next, react-i18next, expo-localization, react-native-svg, expo-google-fonts, zustand, date-fns, intl, tabular-nums]

# Dependency graph
requires:
  - phase: 04-plans-exercises-offline-queue
    provides: "Zustand no-persist store convention (persistence-store.ts) reused for font-store.ts"
  - phase: 06-history-read-side-polish
    provides: "date-fns/locale import idiom (chart.tsx) reused for fmtDate"
provides:
  - "i18next module-singleton engine (lib/i18n.ts) with sv+en flat-key resources, sv fallback"
  - "Bilingual locale resources sv.json + en.json (93 identical keys each, transcribed from lib.jsx I18N)"
  - "Automatable sv/en key-parity gate (scripts/check-locale-parity.ts + check:locale-parity npm script)"
  - "useFontStore Zustand slice (fontsReady/localeReady) for the Plan 08-02 splash gate"
  - "Locale-aware fmtNum (Intl.NumberFormat) + fmtDate (date-fns) + tnum tabular-numeral helper"
  - "5 net-new deps installed (i18next, react-i18next, expo-localization, @expo-google-fonts/inter, react-native-svg)"
affects: [08-02-app-shell-wiring, 08-05-forge-gallery, forge-components, settings-language-picker]

# Tech tracking
tech-stack:
  added: [i18next@^26.3.1, react-i18next@^17.0.8, expo-localization@~17.0.9, "@expo-google-fonts/inter@^0.4.2", react-native-svg@15.12.1]
  patterns: ["module-singleton i18next init (import-for-side-effect)", "Zustand no-persist readiness slice", "Intl.NumberFormat locale formatting (Hermes-native, no polyfill)", "automatable locale key-parity gate"]

key-files:
  created: [app/lib/i18n.ts, app/locales/sv.json, app/locales/en.json, app/lib/font-store.ts, app/lib/utils/format.ts, app/scripts/check-locale-parity.ts]
  modified: [app/package.json, app/app.json, app/package-lock.json]

key-decisions:
  - "Locale key count is 93 per locale (the true count of the lib.jsx I18N map); the plan's '188' was a source miscount (93×2=186 combined). Parity gate reports 93 and passes — the requirement (identical key sets, both interpolation keys correct) is fully met."
  - "compatibilityJSON 'v4' is the only valid value in i18next v26 (verified against node_modules/i18next/typescript/options.d.ts) — passes tsc as specified by the plan."
  - "expo-localization installed via `npx expo install` → pinned to SDK-54 ~17.0.9 (NOT the npm-latest 56.x that would break the native build per RESEARCH Pitfall 2)."

patterns-established:
  - "module-singleton i18next: lib/i18n.ts runs i18n.init() synchronously at import; consumed via `import \"@/lib/i18n\";` side-effect (Plan 08-02)"
  - "Zustand no-persist readiness slice: font-store.ts copies persistence-store.ts shape with two boolean flags + setters for the splash gate"
  - "locale-aware formatting: fmtNum via Intl.NumberFormat (Hermes-native), fmtDate via date-fns sv/enUS, tnum via fontVariant tabular-nums (DSGN-03 alignment)"
  - "automatable i18n gate: check-locale-parity.ts asserts Object.keys(sv) ≡ Object.keys(en) as sets, exits non-zero with symmetric diff on mismatch"

requirements-completed: [I18N-01, I18N-04, DSGN-03]

# Metrics
duration: ~20min
completed: 2026-06-10
---

# Phase 8 Plan 01: i18n Engine + Locale Resources + Format Helpers Summary

**react-i18next module-singleton with full sv+en flat-key resources (93 keys each), a build-time key-parity gate, locale-aware Intl/date-fns formatting helpers, the tabular-numeral style helper, and the splash-gate font-store slice — plus all 5 net-new Phase 8 dependencies installed via the correct npm/expo split.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-06-10
- **Tasks:** 3 (1 checkpoint:human-verify gate — pre-approved — + 2 auto)
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments
- Installed 5 net-new deps with the correct npm/expo split (pure-JS via npm; expo-localization + react-native-svg via `npx expo install` so SDK-54 native pins resolve) — no bumps to locked packages (skia 2.2.12, nativewind ^4.2.3, tailwindcss ^3.4.19 untouched).
- Transcribed the full lib.jsx `I18N.sv`/`I18N.en` objects into flat-key `sv.json`/`en.json` (93 identical keys each, single default namespace per D-09/D-10); the 2 function-valued keys became `{{n}}` and `{{kg}}`/`{{reps}}` interpolations.
- Stood up `lib/i18n.ts` (module-singleton i18next init, sv fallback, `escapeValue:false`, `compatibilityJSON:'v4'`) and `scripts/check-locale-parity.ts` (automatable parity gate, green at 93 keys).
- Added `lib/font-store.ts` (Zustand no-persist `fontsReady`/`localeReady` slice for the Plan 08-02 splash gate) and `lib/utils/format.ts` (`fmtNum` via Intl, `fmtDate` via date-fns, `tnum` tabular-numeral helper).

## Task Commits

Each task was committed atomically:

1. **Task 1: Install net-new dependencies (supply-chain gate)** - `bdf8e09` (chore)
2. **Task 2: Transcribe locales + i18n engine + parity script** - `4f2c3d7` (feat)
3. **Task 3: font-store slice + format helpers + tnum** - `74b5261` (feat)

## Files Created/Modified
- `app/lib/i18n.ts` - i18next module-singleton init (sv+en resources, sv fallback, escapeValue false, compatibilityJSON v4)
- `app/locales/sv.json` - Swedish flat-key resource (93 keys)
- `app/locales/en.json` - English flat-key resource (93 keys)
- `app/lib/font-store.ts` - Zustand no-persist slice: fontsReady + localeReady flags for the splash gate
- `app/lib/utils/format.ts` - fmtNum (Intl.NumberFormat) + fmtDate (date-fns) + tnum (tabular-nums) helpers
- `app/scripts/check-locale-parity.ts` - automatable sv/en key-parity gate
- `app/package.json` - 5 new deps + `check:locale-parity` script
- `app/app.json` - `expo-localization` config plugin added by `npx expo install`
- `app/package-lock.json` - locked dependency tree for the 5 new packages (+ transitive)

## Decisions Made
- **Locale key count is 93, not 188.** Counting the lib.jsx `I18N.sv` source (lines 10-118) yields 93 keys per locale; "188" in the plan was a miscount (93×2=186 combined). The substantive requirement — sv/en carry identical key sets and both interpolation keys are correct — is fully satisfied; the parity gate reports 93 and passes. No copy was invented and no key was dropped.
- **`compatibilityJSON: 'v4'`** is the sole valid value in i18next v26 (verified against `node_modules/i18next/typescript/options.d.ts`), exactly as the plan specified; tsc passes.
- **expo-localization installed via `npx expo install`** → SDK-54 pin `~17.0.9`, avoiding the npm-latest 56.x native-mismatch trap (RESEARCH Pitfall 2).

## Deviations from Plan

None - plan executed exactly as written. (The 93-vs-188 key count is a documentation correction to the plan's stated number, not a change to the implementation: the full bilingual map was transcribed 1:1 with identical key sets, which is the actual acceptance requirement. The parity gate, interpolation-key grep, tsc, and lint all pass.)

## Issues Encountered
None. The only point worth noting: the plan's acceptance criterion cited "188 keys"; the actual lib.jsx I18N map is 93 keys per locale. Verified by direct count of the transcription source and confirmed by `check-locale-parity.ts` (PASS at 93). Documented above so downstream plans expect 93.

## User Setup Required
None - no external service configuration required. (Restart Metro after the dependency install before running the app, per RESEARCH §Runtime State Inventory — a dev convenience, not a config step.)

## Next Phase Readiness
- `lib/i18n.ts`, `useFontStore`, and the format helpers are ready for Plan 08-02 `_layout.tsx` wiring (`import "@/lib/i18n";` + `FontBootstrap`/`LocaleBootstrap` + extended splash gate).
- `react-native-svg` is installed and ready for the Icon/Logo/AppIcon ports (Plan 08-04/05).
- F13 untouched: no `app/lib/query/*` file was modified (verified via `git diff --stat`); `npm run test:f13-brutal` exits 0.

## Self-Check: PASSED

All 6 created files verified present on disk; all 3 task commits (`bdf8e09`, `4f2c3d7`, `74b5261`) verified in git history.

---
*Phase: 08-forge-foundation*
*Completed: 2026-06-10*
