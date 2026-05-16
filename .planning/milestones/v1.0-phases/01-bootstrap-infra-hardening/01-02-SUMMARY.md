---
phase: 01-bootstrap-infra-hardening
plan: 02
subsystem: ui
tags: [nativewind, tailwind, expo-router, dark-mode, status-bar, smoketest]

# Dependency graph
requires:
  - phase: 01-bootstrap-infra-hardening
    provides: locked stack with nativewind + tailwindcss@^3.4.17 installed (plan 01-01)
provides:
  - NativeWind 4 + Tailwind 3 config triple (babel.config.js, metro.config.js, tailwind.config.js)
  - darkMode:'class' convention established (F15)
  - global.css with Tailwind directives, imported at root layout
  - nativewind-env.d.ts TypeScript declaration for className prop
  - edge-to-edge smoke-test view (bg-white/dark:bg-gray-900, text-blue-500/dark:text-blue-300)
  - root layout pattern with StatusBar style=auto and headerShown=false
  - conventions for nav header and status bar captured in CLAUDE.md
affects:
  - 01-03
  - all subsequent phases that render UI

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Root layout imports ../global.css to activate NativeWind pipeline"
    - "darkMode:'class' — NativeWind reads useColorScheme() and applies dark class internally"
    - "StatusBar style=auto in root layout so icon color flips with system theme"
    - "screenOptions={{ headerShown: false }} on root Stack for smoke-test; real screens opt headers back in per-screen"

key-files:
  created:
    - app/babel.config.js
    - app/metro.config.js
    - app/tailwind.config.js
    - app/global.css
    - app/nativewind-env.d.ts
  modified:
    - app/app/_layout.tsx
    - app/app/index.tsx
    - CLAUDE.md

key-decisions:
  - "StatusBar style=auto (not 'light') in root layout — smoke-test has both bg-white and dark:bg-gray-900, so status bar icon color must flip with system theme"
  - "screenOptions={{ headerShown: false }} on root Stack — default expo-router header is a white iOS strip that broke edge-to-edge dark-mode coverage; future real screens will opt headers back in per-screen with theme-aware styling"
  - "Conventions captured in CLAUDE.md ## Conventions so future phases inherit them without rediscovery"
  - "No explicit Reanimated plugin in babel.config.js — Expo SDK 54 / babel-preset-expo wires worklets automatically; adding it manually causes Duplicate plugin/preset warning"

patterns-established:
  - "NativeWind pipeline activation: ../global.css import in _layout.tsx is load-bearing; omitting it makes className props no-op"
  - "Root layout shell: global.css import + Stack with screenOptions + StatusBar style=auto; Plan 03 wraps this with QueryClient/AppState/NetInfo providers"
  - "dark: variant convention: always pair bg-white/dark:bg-gray-900 and text-*-500/dark:text-*-300 for light/dark coverage"

requirements-completed: [F15]

# Metrics
duration: ~60min (includes human-verify iteration with two fix commits)
completed: 2026-05-08
---

# Phase 1, Plan 02: NativeWind 4 + Tailwind 3 + dark-mode smoke-test Summary

**NativeWind 4 + Tailwind 3 (`darkMode:'class'`) wired into Expo SDK 54; smoke-test view renders edge-to-edge on iPhone with system-theme-driven status bar and dark-mode colour flip verified live on physical device via Expo Go**

## Performance

- **Duration:** ~60 min (includes human-verify iteration with two inline fix commits + convention capture)
- **Started:** 2026-05-08
- **Completed:** 2026-05-08
- **Tasks:** 4 (3 auto + 1 human-verify checkpoint)
- **Files modified:** 8

## Accomplishments

- NativeWind 4 config triple (babel + metro + tailwind) created with `darkMode:'class'` and correct Tailwind v3 peer — no duplicate-plugin warnings at Metro start
- Smoke-test view confirmed on physical iPhone: `text-2xl text-blue-500` in light mode, `dark:text-blue-300 dark:bg-gray-900` in dark mode — NativeWind pipeline end-to-end proven
- Status bar icon colour flips with iOS system theme via `<StatusBar style="auto" />` (Fix-A, commit `c41374c`)
- Navigation header hidden via `screenOptions={{ headerShown: false }}` so smoke-test fills screen edge-to-edge in both themes (Fix-B, commit `04bdfaa`)
- Both deviations captured as conventions in `CLAUDE.md ## Conventions` (commit `33a42ef`) so future phases inherit without rediscovery

## Task Commits

Each task was committed atomically:

1. **Task 1: NativeWind config triple (babel + metro + tailwind + global.css + types)** - `1fb2d4b` (feat)
2. **Task 2: Smoke-test view + global.css import in root layout** - `c2fc0fb` (feat)
3. **Task 3: Lint + TypeScript check** - no file changes (verification only — both exit 0)
4. **Fix-A: Status bar adapts to system theme** - `c41374c` (fix)
5. **Fix-B: Hide navigation header for edge-to-edge coverage** - `04bdfaa` (fix)
6. **Conv: Capture nav-header + status-bar conventions in CLAUDE.md** - `33a42ef` (docs)
7. **Task 4: iPhone Expo Go QR-test + dark-mode toggle** - human-verify checkpoint; no code commit (user approved after Fix-A + Fix-B)

**Plan metadata:** (this SUMMARY commit — see below)

## Files Created/Modified

- `app/babel.config.js` - babel-preset-expo with jsxImportSource:nativewind + nativewind/babel preset; no explicit Reanimated plugin (SDK 54 wires worklets via preset automatically)
- `app/metro.config.js` - getDefaultConfig wrapped with withNativeWind; input: ./global.css
- `app/tailwind.config.js` - nativewind/preset, content glob for app/app/**, darkMode:'class'
- `app/global.css` - @tailwind base/components/utilities directives
- `app/nativewind-env.d.ts` - /// reference types="nativewind/types" for className prop on RN core components
- `app/app/_layout.tsx` - global.css import + Stack with screenOptions={{ headerShown: false }} + StatusBar style=auto from expo-status-bar
- `app/app/index.tsx` - smoke-test view: flex-1 centered, bg-white/dark:bg-gray-900, text-2xl text-blue-500/dark:text-blue-300
- `CLAUDE.md` - ## Conventions section populated with status-bar and nav-header rules

## Decisions Made

- **`StatusBar style="auto"` in root layout (not `"light"`):** The smoke-test view has both `bg-white` (light) and `dark:bg-gray-900` (dark). Status bar icon colour must flip with system theme — `style="auto"` delegates to iOS system, which is correct for a theme-adaptive app. A hardcoded `"light"` or `"dark"` would show wrong-colour icons in the opposite theme.

- **`screenOptions={{ headerShown: false }}` on root Stack:** The default expo-router `<Stack />` renders a white iOS navigation header strip at the top of the screen. In dark mode this creates a white bar against the dark `bg-gray-900` background — breaking edge-to-edge coverage and masking the status bar fix. `headerShown: false` removes it globally for the root Stack. Future real screens (Phase 4+) will opt headers back in per-screen, styled with theme-aware colours.

- **Conventions captured in CLAUDE.md:** Both fixes encode implicit platform knowledge. Without a written convention, every future screen author would rediscover the same issues independently. The convention entry in CLAUDE.md `## Conventions` makes the intent explicit and machine-readable for future plan execution.

- **No explicit Reanimated plugin in babel.config.js:** Expo SDK 54 with babel-preset-expo wires `react-native-worklets/plugin` automatically. Manually adding it (or `react-native-reanimated/plugin`) causes a "Duplicate plugin/preset detected" Metro warning that misleads diagnosis. Left absent per PITFALLS §3.1.

## Deviations from Plan

### Auto-fixed Issues (found during human-verify checkpoint, Task 4)

**1. [Rule 1 - Bug] Status bar style does not adapt to iOS system theme**
- **Found during:** Task 4 (iPhone Expo Go QR-test + dark-mode toggle) — user observed status bar icons stayed dark-on-dark in Dark Mode
- **Issue:** Default expo-router root layout does not include a `<StatusBar>` component; React Native defaults to the OS-level style, which on iOS does not automatically invert with system theme when the app is running
- **Fix:** Added `import { StatusBar } from "expo-status-bar"` and `<StatusBar style="auto" />` to `app/app/_layout.tsx` inside a React Fragment wrapping the Stack
- **Files modified:** `app/app/_layout.tsx`
- **Verification:** User confirmed on iPhone that status bar icons flip light/dark when toggling iOS system theme
- **Committed in:** `c41374c` (Fix-A)

**2. [Rule 1 - Bug] Default expo-router navigation header breaks edge-to-edge dark-mode coverage**
- **Found during:** Task 4 — user observed a white header strip persisting in Dark Mode at the top of the screen
- **Issue:** `<Stack />` from expo-router renders an iOS-style navigation header by default. In dark mode it remained white (default iOS header colour) against the dark gray smoke-test background, preventing full dark-mode coverage of the screen and visually contradicting the verified dark theme
- **Fix:** Added `screenOptions={{ headerShown: false }}` to the `<Stack />` in `app/app/_layout.tsx`; real screens in Phase 4+ will opt headers back in per-screen with theme-aware styling
- **Files modified:** `app/app/_layout.tsx`
- **Verification:** User confirmed on iPhone that the white header strip is gone and screen fills edge-to-edge in both light and dark mode
- **Committed in:** `04bdfaa` (Fix-B)

**3. [Rule 2 - Missing Critical] Conventions for nav-header and status-bar not captured**
- **Found during:** After Fix-A + Fix-B were applied
- **Issue:** The two fixes encode non-obvious platform knowledge. Without written conventions, future screen authors and plan executors would rediscover the same bugs independently
- **Fix:** Added explicit convention entries to `CLAUDE.md ## Conventions`: (a) always include `<StatusBar style="auto" />` in root layout, (b) root Stack uses `headerShown: false`; future screens opt headers back in per-screen
- **Files modified:** `CLAUDE.md`
- **Verification:** CLAUDE.md `## Conventions` section contains both rules
- **Committed in:** `33a42ef` (Conv)

---

**Total deviations:** 3 auto-fixed (2 bugs found on physical device during human-verify, 1 missing convention capture)
**Impact on plan:** All three fixes are correctness requirements for a dark-mode-capable app on iPhone. No scope creep — fixes are minimal and targeted to the smoke-test surface.

## Issues Encountered

- Status bar did not flip on first iPhone test in dark mode. Root cause was two compounding issues: (1) no `<StatusBar>` component in root layout at all, and (2) the default expo-router header was occupying the top of the screen and masking the area. Both diagnosed and fixed inline after user flagged via human-verify checkpoint. Second iPhone test passed all dark-mode criteria.

## User Setup Required

None — no external service configuration required. All changes are local config files; Expo Go on an iPhone with developer mode is the only prerequisite (established in Plan 01-01).

## Next Phase Readiness

NativeWind pipeline proven end-to-end on real iPhone hardware (light mode + dark mode + system-theme flip). The root layout pattern (`_layout.tsx` with `../global.css` import, `<Stack screenOptions={{ headerShown: false }} />`, `<StatusBar style="auto" />`) is the stable shell that Plan 01-03 will extend.

Plan 01-03 can layer the provider stack (QueryClient, AppState, NetInfo, Supabase) on top of `_layout.tsx` while preserving `<StatusBar style="auto" />` and `headerShown: false`. When Plan 01-03 wraps `<Stack />` inside provider components, the Fragment structure in `_layout.tsx` makes it straightforward: providers wrap the Stack, StatusBar stays as a sibling.

No blockers for Plan 01-03.

---
*Phase: 01-bootstrap-infra-hardening*
*Completed: 2026-05-08*
