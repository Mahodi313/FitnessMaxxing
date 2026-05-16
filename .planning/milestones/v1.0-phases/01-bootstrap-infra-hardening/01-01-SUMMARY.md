---
phase: 01-bootstrap-infra-hardening
plan: 01
subsystem: infra
tags: [expo, nativewind, tailwind, supabase, react-native, zustand, tanstack-query, zod, react-hook-form, victory-native, skia]

# Dependency graph
requires: []
provides:
  - Expo scaffold reset (demo files deleted, minimal index + layout in place)
  - Full CLAUDE.md TL;DR locked stack installed in app/package.json
  - expo-doctor 17/17 checks passing (0 errors)
  - expo lint clean on post-reset code
  - tailwindcss pinned to v3 (critical NativeWind 4 peer-dep requirement satisfied)
affects: [01-02, 01-03, all subsequent phases]

# Tech tracking
tech-stack:
  added:
    - nativewind@^4.2.3
    - tailwindcss@^3.4.19 (v3 line — Expo resolved from ^3.4.17 pin)
    - prettier-plugin-tailwindcss@^0.5.14
    - "@tanstack/react-query@^5.100.9"
    - "@tanstack/query-async-storage-persister@^5.100.9"
    - "@tanstack/react-query-persist-client@^5.100.9"
    - zustand@^5.0.13
    - react-hook-form@^7.75.0
    - "@hookform/resolvers@^5.2.2"
    - zod@^4.4.3
    - date-fns@^4.1.0
    - "@supabase/supabase-js@^2.105.4"
    - expo-secure-store@~15.0.8 (Expo resolved; CLAUDE.md noted ~14.0.1 but Expo SDK 54 compat table canonical)
    - "@react-native-async-storage/async-storage@2.2.0"
    - aes-js@^3.1.2
    - react-native-get-random-values@~1.11.0
    - "@react-native-community/netinfo@11.4.1"
    - "@shopify/react-native-skia@2.2.12" (Expo resolved; CLAUDE.md noted 2.6.2 but Expo SDK 54 compat table canonical)
    - victory-native@^41.20.2
  patterns:
    - "Native-affected packages installed via npx expo install; pure-JS packages via npm install"
    - "package-lock.json committed for reproducible npm ci"

key-files:
  created:
    - app/app/index.tsx (reset-default minimal screen)
    - app/app/_layout.tsx (reset-default Stack root)
  modified:
    - app/package.json (full locked stack added)
    - app/package-lock.json (updated for all new pins)
    - app/app.json (updated by expo install)

key-decisions:
  - "expo-secure-store resolved to ~15.0.8 by npx expo install (not ~14.0.1 from CLAUDE.md TL;DR) — Expo SDK 54 compat table is canonical per CLAUDE.md guidance"
  - "@shopify/react-native-skia resolved to 2.2.12 by npx expo install (not 2.6.2 from CLAUDE.md TL;DR) — same rationale"
  - "tailwindcss resolved to ^3.4.19 (still v3 line — critical NativeWind 4 peer-dep satisfied)"
  - "npm run reset-project answered n — demo files deleted directly, no app-example/ directory created (per D-02)"
  - "NativeWind config files (babel/metro/global.css/tailwind.config) deferred to Plan 02 as per scope"

patterns-established:
  - "Pattern: Use npx expo install for any package that touches native modules; npm install for pure-JS"
  - "Pattern: CLAUDE.md TL;DR version hints are starting points; npx expo install overrides with SDK-verified versions — accept Expo's resolutions"

requirements-completed: [F15]

# Metrics
duration: ~45min
completed: 2026-05-08
---

# Phase 1, Plan 01: Reset scaffold och installera locked-stacken Summary

**Reset Expo demo scaffold (deleted tabs/components/hooks/constants/scripts) and installed full CLAUDE.md TL;DR locked stack via expo install + npm install per package type; expo-doctor 17/17 clean and expo lint exit 0**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-08T (prior agent session)
- **Completed:** 2026-05-08
- **Tasks:** 4 (3 auto + 1 human-verify checkpoint)
- **Files modified:** 4 (app/package.json, app/package-lock.json, app/app/index.tsx, app/app/_layout.tsx)

## Accomplishments

- Expo scaffold reset: deleted `(tabs)/`, `components/`, `hooks/`, `constants/`, `scripts/`, and `app-example/` did not appear (answered `n` to reset-project prompt)
- Installed entire CLAUDE.md TL;DR locked stack across all 9 installation steps (NativeWind, TanStack Query, Zustand, RHF+Zod, date-fns, Supabase+LargeSecureStore prerequisites, NetInfo, query persisters, Skia+Victory)
- expo-doctor 17/17 checks passed (0 errors); expo lint exit 0 on minimal post-reset code
- Human-verify checkpoint approved: package.json visual inspection confirmed tailwindcss is v3, no service_role leakage, no app-example/ directory

## Task Commits

Each task was committed atomically:

1. **Task 1: Kör reset-project och verifiera att demo är borta** - `7df0213` (chore)
2. **Task 2: Installera locked-stacken (steg 1-9 per STACK.md)** - `c7c95af` (feat)
3. **Task 3: Verifiera med expo-doctor + lint** - no file changes (expo-doctor 17/17 OK; lint exit 0)
4. **Task 4: Mänsklig verifiering — package.json + filsystem** - human-verify checkpoint; USER APPROVED

**Plan metadata:** (this commit — docs(01-01): plan summary)

## Files Created/Modified

- `app/app/index.tsx` - Reset-default minimal screen (`<Text>Edit app/index.tsx to edit this screen.</Text>`); will be replaced in Plan 02
- `app/app/_layout.tsx` - Reset-default `<Stack/>` root (no ThemeProvider); will be replaced in Plan 03
- `app/package.json` - Full locked stack added across dependencies and devDependencies
- `app/package-lock.json` - Updated lockfile for all new pins; committed for reproducible `npm ci`
- `app/app.json` - Updated by expo install toolchain

### Deleted by reset-project.js (expected)

- `app/app/(tabs)/` — demo tab screens
- `app/components/` — demo components (ParallaxScrollView, ThemedText, ThemedView, etc.)
- `app/hooks/` — demo hooks (useColorScheme, useThemeColor)
- `app/constants/` — demo constants (Colors)
- `app/scripts/` — reset-project.js deleted itself (expected; script is single-use)

## Decisions Made

- **expo-secure-store version override:** CLAUDE.md TL;DR listed `~14.0.1` but `npx expo install expo-secure-store` resolved `~15.0.8`. Accepted — Expo's SDK 54 compat table is canonical per CLAUDE.md guidance ("You MUST install via `npx expo install`"). This is not a deviation; it is expected behavior.
- **@shopify/react-native-skia version override:** CLAUDE.md TL;DR listed `2.6.2` but `npx expo install @shopify/react-native-skia` resolved `2.2.12`. Same rationale — accepted.
- **tailwindcss resolved to ^3.4.19:** Still on v3 line (critical NativeWind 4 peer-dep satisfied). The minor bump from `^3.4.17` to `^3.4.19` is within the v3 semver range and safe.
- **NativeWind config deferred:** babel.config.js, metro.config.js, global.css, tailwind.config.js are Plan 02 scope. Not wired in this plan.
- **LargeSecureStore prerequisites installed:** aes-js, react-native-get-random-values, and @react-native-async-storage/async-storage installed now alongside expo-secure-store. These are needed for the encryption wrapper that handles Supabase JWT sessions exceeding the 2048-byte SecureStore limit.

## Deviations from Plan

None — plan executed exactly as written. Version pins resolved by `npx expo install` per CLAUDE.md guidance are expected behavior, not deviations. The Expo SDK 54 compat table overriding CLAUDE.md TL;DR hints for native-affected packages (expo-secure-store, react-native-skia) is the correct outcome documented in CLAUDE.md itself.

## Issues Encountered

None. expo-doctor reported 0 errors. expo lint exited 0. All 9 installation steps completed without npm errors.

Ignorable peer-dep warnings (per CLAUDE.md):
- `victory-native@41.x` declares `@shopify/react-native-skia: ">=1.2.3"` but we installed `2.2.12` — npm warned, accepted (community-confirmed working as of May 2026)

## User Setup Required

None — no external service configuration required in this plan. Supabase credentials are Plan 03 scope.

## Next Phase Readiness

Ready for Plan 01-02 (NativeWind config + dark-mode smoketest). All locked-stack packages are installed and present in `app/package.json`, but NativeWind config files are not yet wired:

- `babel.config.js` — needs NativeWind babel plugin
- `metro.config.js` — needs NativeWind metro wrapper
- `global.css` — needs `@tailwind` directives
- `tailwind.config.js` — needs content paths for `app/` directory

These are all Plan 02 scope. Plan 01 only installs packages; Plan 02 wires the NativeWind pipeline and runs an iPhone Expo Go smoke-test.

Blocker for Plan 03: Supabase project credentials (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) not yet configured — that is Plan 03 scope.

---
*Phase: 01-bootstrap-infra-hardening*
*Completed: 2026-05-08*
