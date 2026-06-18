---
phase: 15-bilingual-release-hardening
plan: 02
subsystem: navigation-ui
tags: [motion, forge-section-07, reanimated, tab-bar, D-07, D-08]
requires:
  - "app/app/(app)/(tabs)/_layout.tsx ForgeTabBar (Phase 12 Forge re-skin)"
  - "react-native-reanimated (useSharedValue/withSpring/useAnimatedStyle) — Reanimated 4.x baseline"
provides:
  - "Active tab-bar icon springs 0.92->1 on tab switch (Forge §07 motion-table D-07 closed)"
  - "ForgeTabButton child component isolating per-tab animation hooks (Rules-of-Hooks safe)"
affects:
  - "app/app/(app)/(tabs)/_layout.tsx"
tech-stack:
  added: []
  patterns:
    - "Per-item child component owns its own useSharedValue/useEffect/useAnimatedStyle so hooks are not called inside a .map() body (Pitfall 5)"
    - "Default Forge §07 spring curve { damping: 18, stiffness: 220 } copied verbatim from PrBanner.tsx:71"
key-files:
  created: []
  modified:
    - "app/app/(app)/(tabs)/_layout.tsx"
decisions:
  - "D-07: last open Forge §07 motion-table row (tab-icon scale) applied on the Reanimated UI thread via withSpring."
  - "D-08: log-a-set hot path untouched — (tabs)/index.tsx not modified; ≤3s budget re-verified in Plan 04 UAT."
  - "Open Q1: no tab-content crossfade added — expo-router default fade is sufficient, verified visually in Plan 04 UAT."
metrics:
  duration: ~3 min
  tasks_completed: 1
  files_modified: 1
  completed: 2026-06-16
---

# Phase 15 Plan 02: Tab-bar Icon Spring Summary

The single genuinely-missing Forge §07 motion-table row is now applied: the active tab's icon springs from scale 0.92→1 on tab switch, driven by a Reanimated UI-thread `withSpring` worklet living inside a new `ForgeTabButton` child component. The log-a-set hot path and the already-satisfied motion rows are untouched.

## What Was Built

`app/app/(app)/(tabs)/_layout.tsx`'s inline `state.routes.map(...)` body in the ForgeTabBar renderer was refactored into a `ForgeTabButton` child component (props: route/options, isActive, onPress, colors). Each tab item now owns its own animation hooks in its own component instance, satisfying the Rules of Hooks (15-RESEARCH Pitfall 5 — no hooks inside a `.map()` callback).

Inside `ForgeTabButton`:
- `const SPRING = { damping: 18, stiffness: 220 } as const` — the default Forge §07 curve, copied verbatim from `PrBanner.tsx:71`.
- `const scale = useSharedValue(isActive ? 1 : 0.92)`.
- `useEffect(() => { scale.value = withSpring(isActive ? 1 : 0.92, SPRING); }, [isActive])`.
- `const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))`.
- The existing `<Icon>` is wrapped in `<Animated.View style={iconStyle}>`.

## Tasks

### Task 1: Extract ForgeTabButton child and add the icon-scale spring worklet

- Refactored the inline tab renderer into a `ForgeTabButton` child component (defined at module scope, ~line 90), invoked from the ForgeTabBar `state.routes.map()` (~line 176) — per-tab hooks are now isolated per instance.
- Added the `withSpring(damping: 18, stiffness: 220)` icon-scale worklet on the Reanimated UI thread, wrapping `<Icon>` in `<Animated.View style={iconStyle}>` (line 116).
- PRESERVED the existing ForgeTabBar contract:
  - Pressed feedback via the `style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}` callback (line 114) — never `active:opacity-*`, never inline box-decoration (FIT-66 / MEMORY NativeWind className-not-style rule). Box styling stays in `className`.
  - `accessibilityRole="tab"`, `accessibilityState={{ selected: isActive }}`, `accessibilityLabel` preserved (lines 109–111).
  - Light/dark accent/text colors via `useColorScheme()` (SKIN-07 parity).
  - Navigation `emit`/`navigate` logic preserved (lines 165–171).
- Did NOT add a tab-content crossfade (Open Q1 — expo-router default fade is sufficient; visual check deferred to Plan 04 UAT).
- Did NOT touch `app/app/(app)/(tabs)/index.tsx` (off-limits per D-08).
- Did NOT re-implement the plan-row ScaleDecorator (already wired at `plans/[id].tsx:552`).
- Commit: `6061083` — `feat(15-02): spring the active tab-bar icon 0.92->1 on switch [FIT-125]`.

## Verification Results

- Acceptance markers present in `app/app/(app)/(tabs)/_layout.tsx`: `withSpring`, `SPRING = { damping: 18, stiffness: 220 }`, `ForgeTabButton`, `useAnimatedStyle`, `<Animated.View style={iconStyle}>` wrapping `<Icon>`.
- `git diff --name-only 2e85428..HEAD` shows ONLY `app/app/(app)/(tabs)/_layout.tsx` changed (85 insertions, 28 deletions) — `index.tsx` is unmodified (D-08 satisfied).
- `accessibilityRole`/`accessibilityState`/`accessibilityLabel` retained on each tab.
- `tsc --noEmit` / `expo lint`: NOT run inside the worktree (no `node_modules` present in the isolated worktree). The orchestrator's post-merge build/test gate compiles the merged tree against the real install — this is the authoritative type/lint check for this plan.

## Deviations from Plan

- **Process deviation (not code):** the executor's API socket closed immediately after the Task 1 `feat` commit landed but before it could write/commit this SUMMARY.md. The working tree was clean and the implementation commit was intact. The orchestrator spot-checked the worktree (commit present, all acceptance markers present, `index.tsx` untouched) and authored this SUMMARY.md from the plan + the committed diff to close the metadata gap. No code was changed during recovery.

## Decisions Made

- **D-07 closed:** tab-icon scale is the last Forge §07 motion-table row; it is applied on the UI thread.
- **D-08 honored:** the log-a-set hot path (`(tabs)/index.tsx`) is not modified; the ≤3s MOTN-01 budget is re-verified by `npm run test:f13-brutal` in Plan 04.
- **Open Q1:** no crossfade animation added; expo-router default is treated as sufficient and verified visually in the Plan 04 UAT.

## Notes / Follow-ups

- Tab-icon "feel" (premium 0.92→1 spring, no log-a-set lag) is confirmed on device in the **Plan 04 UAT** (SC4).
- This plan modified `app/app/(app)/(tabs)/_layout.tsx` only; per the worktree/parallel-executor contract, STATE.md and ROADMAP.md are owned by the orchestrator post-wave.

## Self-Check: PASSED

- FOUND: `.planning/phases/15-bilingual-release-hardening/15-02-SUMMARY.md`
- FOUND: commit `6061083` (Task 1 — tab-icon spring, `withSpring` damping:18/stiffness:220)
- FOUND: `ForgeTabButton` child + `<Animated.View style={iconStyle}>` wrapping `<Icon>` in `_layout.tsx`
- CONFIRMED: `app/app/(app)/(tabs)/index.tsx` unmodified (D-08)
