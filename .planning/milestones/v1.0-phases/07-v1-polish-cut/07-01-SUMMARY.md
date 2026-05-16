---
phase: 07
plan: 01
subsystem: theme
tags: [theme, dark-mode, nativewind, asyncstorage, settings, splash-gate, useColorScheme-migration]
requires: []
provides:
  - F15-tema-toggle-UI-in-settings
  - ThemeBootstrap-splash-gate-AsyncStorage-read
  - dynamic-StatusBar-style
  - useColorScheme-nativewind-migration-10-files
affects:
  - app/app/_layout.tsx
  - app/app/(app)/(tabs)/settings.tsx
  - app/app/(app)/_layout.tsx
  - app/app/(app)/(tabs)/_layout.tsx
  - app/app/(app)/(tabs)/index.tsx
  - app/app/(app)/(tabs)/history.tsx
  - app/app/(app)/plans/[id].tsx
  - app/app/(app)/plans/[id]/exercise-picker.tsx
  - app/app/(app)/history/[sessionId].tsx
  - app/app/(app)/exercise/[exerciseId]/chart.tsx
  - app/components/active-session-banner.tsx
tech-stack:
  added: []
  patterns:
    - NativeWind useColorScheme (setColorScheme + colorScheme destructure) as single source of theme truth
    - ThemeBootstrap component pattern mirroring SplashScreenController (effect-before-splash-hide)
    - Zod z.enum().catch('system').parse() for untrusted AsyncStorage reads
key-files:
  created: []
  modified:
    - app/app/_layout.tsx
    - app/app/(app)/(tabs)/settings.tsx
    - app/app/(app)/_layout.tsx
    - app/app/(app)/(tabs)/_layout.tsx
    - app/app/(app)/(tabs)/index.tsx
    - app/app/(app)/(tabs)/history.tsx
    - app/app/(app)/plans/[id].tsx
    - app/app/(app)/plans/[id]/exercise-picker.tsx
    - app/app/(app)/history/[sessionId].tsx
    - app/app/(app)/exercise/[exerciseId]/chart.tsx
    - app/components/active-session-banner.tsx
decisions:
  - D-T1: NativeWind useColorScheme() from nativewind is single source of truth; setColorScheme('system'|'light'|'dark') flips root dark class
  - D-T2: ThemeBootstrap mounted BEFORE SplashScreenController inside PersistQueryClientProvider; fires AsyncStorage read in parallel with auth-status splash gate (does not block hiding)
  - D-T3: StatusBar style changed from static "auto" to dynamic isDark ? "light" : "dark" for all 9 (user-mode x iOS-mode) combinations
  - D-T4: Migration of all 10 files confirmed via grep audit (PRE_COUNT=10); committed atomically
metrics:
  duration: ~35 minutes
  completed: 2026-05-16
  tasks_completed: 3
  tasks_total: 3
  files_modified: 11
linear_issue: FIT-69
---

# Phase 7 Plan 01: F15 Tema-toggle + useColorScheme Migration Summary

NativeWind-powered manual theme toggle (System/Ljust/Mörkt) wired to Settings tab with AsyncStorage persistence, splash-gate ThemeBootstrap, and dynamic StatusBar — plus atomic 10-file useColorScheme import migration from react-native to nativewind.

## What Was Built

### Task 1: Atomic useColorScheme Migration (10 files)

**PRE_COUNT = 10** — confirmed via `grep -rlEn "from ['"]react-native['"]" app/app app/components | xargs grep -lE "useColorScheme"`. Matches CONTEXT.md D-T4 expected count exactly (no variance).

**Migration commit:** 009c194

Files migrated as Form A (solo import rename):
1. `app/app/_layout.tsx`
2. `app/app/(app)/_layout.tsx`
3. `app/app/(app)/(tabs)/_layout.tsx`

Files migrated as Form B (remove from RN multi-import, add nativewind import line):
4. `app/app/(app)/(tabs)/index.tsx`
5. `app/app/(app)/(tabs)/history.tsx` — TWO call-sites updated (lines 82 + 275 in HistoryTab and HistoryEmptyState)
6. `app/app/(app)/plans/[id].tsx`
7. `app/app/(app)/plans/[id]/exercise-picker.tsx`
8. `app/app/(app)/history/[sessionId].tsx`
9. `app/app/(app)/exercise/[exerciseId]/chart.tsx`
10. `app/components/active-session-banner.tsx`

All call-sites updated from `const scheme = useColorScheme()` + `scheme === "dark"` to `const { colorScheme } = useColorScheme()` + `colorScheme === "dark"`.

Post-migration gates all passed:
- Gate A: 0 react-native useColorScheme imports remain
- Gate B: 10 files now import useColorScheme from nativewind (= PRE_COUNT)
- Gate C: 0 leftover non-destructured call-sites
- Gate D: 10 files with destructured `const { colorScheme }` form

### Task 2: Tema-sektion in settings.tsx

**Commit:** d731b03

Replaced the `"Mer kommer i Phase 7."` placeholder Text with:
- `<Text>Tema</Text>` heading with `text-base font-semibold text-gray-900 dark:text-gray-50`
- `<SegmentedControl<"system" | "light" | "dark">>` with options [System, Ljust, Mörkt]
- `useColorScheme` imported from `"nativewind"` (post-Task 1)
- `useState<"system" | "light" | "dark">("system")` for local control state
- `useEffect` reads `AsyncStorage.getItem("fm:theme")` on mount → Zod enum-catch parse → `setStored` + `setColorScheme` (T-07-01 mitigation)
- `onChange` order: `setStored` → `setColorScheme` → `AsyncStorage.setItem.catch(console.warn)` (T-07-05 accepted)

### Task 3: ThemeBootstrap + dynamic StatusBar in app/_layout.tsx

**Commit:** 5bba558

- Added `ThemeBootstrap` function component (structurally mirrors `SplashScreenController`):
  - Reads `AsyncStorage("fm:theme")` in a `useEffect`
  - Parses with `z.enum(["system", "light", "dark"]).catch("system")`
  - Calls `setColorScheme(parsed)` — NativeWind flips root `dark` class
  - IO error → `console.warn("[theme] AsyncStorage read failed — defaulting to system")` (T-07-01)
- Mounted as `<ThemeBootstrap />` BEFORE `<SplashScreenController />` inside `<PersistQueryClientProvider>` — fires AsyncStorage read as early as possible; does NOT block splash hiding (T-07-06)
- Replaced `<StatusBar style="auto" />` with `<StatusBar style={isDark ? "light" : "dark"} />` where `isDark` comes from NativeWind `useColorScheme().colorScheme` (D-T3)

## ThemeBootstrap Ordering Decision

`<ThemeBootstrap />` is mounted BEFORE `<SplashScreenController />`. Rationale: the theme read should fire in parallel as early as possible during the splash window. Since `SplashScreenController` gates on `status !== "loading"` (auth state), and `ThemeBootstrap` has no gate (fires immediately on mount), placing ThemeBootstrap first ensures the AsyncStorage read begins before auth resolution. ThemeBootstrap never delays splash hiding — if AsyncStorage hangs, `setColorScheme` simply never fires and NativeWind defaults to `'system'` mode (T-07-06 accepted disposition).

## Manual iPhone Verification

Deferred to Plan 07-05 UAT per plan `<output>` specification. The 5-step verification script (tap Mörkt → dark mode immediate, kill+reopen → Mörkt persists, System → follows iOS, corruption resilience, StatusBar icon color) will be exercised in 07-05.

## Deviations from Plan

None — plan executed exactly as written.

PRE_COUNT confirmed at 10 (matching CONTEXT.md D-T4). No additional files were discovered beyond the 10 in the plan. No architecture changes were required.

## Known Stubs

None — the placeholder `"Mer kommer i Phase 7."` was fully replaced. All three tasks deliver complete, wired functionality.

## Threat Flags

No new security-relevant surface introduced beyond what the threat model in 07-01-PLAN.md already accounts for. All four threats (T-07-01 through T-07-07) are dispositioned:
- T-07-01 mitigated: Zod enum-catch on AsyncStorage reads in both ThemeBootstrap and settings.tsx
- T-07-05 accepted: write failures silently logged via console.warn
- T-07-06 accepted: ThemeBootstrap does not gate splash; worst case is system-mode default
- T-07-07 accepted: no analytics/telemetry in V1

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 009c194 | refactor(07-01): atomic useColorScheme migration react-native → nativewind (10 files) |
| Task 2 | d731b03 | feat(07-01): add Tema-sektion to settings.tsx with SegmentedControl + AsyncStorage |
| Task 3 | 5bba558 | feat(07-01): ThemeBootstrap + dynamic StatusBar in app/_layout.tsx |

## Self-Check

Files exist:
- app/app/(app)/(tabs)/settings.tsx: FOUND
- app/app/_layout.tsx: FOUND
- All 10 migration files: FOUND

Commits exist: 009c194, d731b03, 5bba558

## Self-Check: PASSED
