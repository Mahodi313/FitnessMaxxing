---
status: testing
phase: 06-history-read-side-polish
source: [06-VERIFICATION.md]
started: 2026-05-15T00:00:00Z
updated: 2026-05-15T00:00:00Z
---

## Current Test

number: 1
name: Skia tooltip renders on tap-and-hold (BLOCKER-1 device confirm)
expected: |
  Tap-and-hold a data point on `/exercise/<id>/chart` → see RoundedRect tooltip
  with value-line (`82.5 kg` for Max vikt, `3 240 kg` for Total volym) +
  date-line (`14 maj 2026`) above the pressed point; rect clamped to chartBounds
  at edges; highlight Circle follows the press; lift finger → tooltip + circle
  disappear.
awaiting: user response

## Tests

### 1. Skia tooltip renders on tap-and-hold (BLOCKER-1 device confirm)
expected: Tap-and-hold a data point on `/exercise/<id>/chart` → see RoundedRect tooltip with value-line (`82.5 kg` for Max vikt, `3 240 kg` for Total volym) + date-line (`14 maj 2026`) above the pressed point; rect clamped to chartBounds at edges; highlight Circle follows the press; lift finger → tooltip + circle disappear.
result: [pending]
note: "Initial run blocked by FIT-66 (SegmentedControl crash on tid-intervall press). Fix shipped in 6d50486; user confirmed crash gone — retesting tooltip."

### 2. Offline cache hydration (ROADMAP success #4)
expected: (a) Open Historik tab online → list populates from network. (b) Enable Airplane Mode → force-quit Expo Go → reopen → list still visible (hydrated from AsyncStorage via PersistQueryClientProvider). OfflineBanner shows.
result: [pending]

### 3. Delete-pass offline replay
expected: (a) Airplane Mode → tap delete on a test session → optimistic remove + `Passet borttaget` toast appear immediately. (b) Force-quit → reopen offline → list still excludes the session. (c) Disable Airplane Mode → wait ~10s for `resumePausedMutations` → Supabase Studio shows the session row gone (FK cascade also purged its `exercise_sets`).
result: [pending]

### 4. Cursor pagination + pull-to-refresh feel
expected: Scroll to the bottom of Historik with ≥20 finished sessions → next page fetches at threshold 0.5; pull-down → list refetches from cursor=null; rapid scroll does not trigger duplicate fetches (Pitfall 3 `hasNextPage` guard).
result: [pending]

### 5. Theme awareness (F15 convention) on chart
expected: Light mode: chart line + Skia accent = `#2563EB` (blue-600), tooltip bg `#FFFFFF`, axis labels gray-500. iOS Settings → Display → Dark → return to app: chart line = `#60A5FA` (blue-400), tooltip bg `#1F2937` (gray-800), axis labels gray-400.
result: [pending]

### 6. freezeOnBlur overlay-reset on session detail
expected: Open `/history/<id>` → tap `...` (overflow) → swipe back → swipe forward to detail → overflow menu is NOT visible. Same flow for delete-confirm overlay. (Pitfall 7 regression test.)
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

- truth: "Skia tooltip renders on tap-and-hold on `/exercise/<id>/chart`"
  status: resolved
  reason: "User reported: ERROR Couldn't find a navigation context — fires inside SegmentedControl options.map via react-native-css-interop printUpgradeWarning recursing through NavigationStateContext.js. Reproduced when opening the chart screen and pressing tid-intervall (WindowToggle)."
  severity: blocker
  test: 1
  linear: FIT-66
  resolved_in: "6d50486 — fix(06-03): SegmentedControl crash on chart screen"
  root_cause: "react-native-css-interop@0.2.3 emits an upgrade warning for one of SegmentedControl's NativeWind classes (`shadow-sm` on the selected segment, `active:opacity-80` on every segment). The warning printer (printUpgradeWarning → stringify → 24+ String.replace recursion) walks the React fiber tree to attribute the warning, hitting NavigationStateContext's defaultValue sentinel and throwing the navigation-context error before the SegmentedControl can mount."
  artifacts:
    - path: "app/components/segmented-control.tsx"
      issue: "Used NativeWind `shadow-sm` + `active:opacity-80` whose css-interop processing triggered the printUpgradeWarning recursion"
  fix:
    - "Replaced `shadow-sm` className with explicit iOS shadow style props (RN scope = iOS-only V1)"
    - "Replaced `active:opacity-80` className with Pressable's `style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}` native callback"
  verified: "User confirmed `pass` 2026-05-15 — crash no longer reproduces; tid-intervall + metric-toggle now interact cleanly. Tooltip behavior (Test 1's actual content) re-tested below."
