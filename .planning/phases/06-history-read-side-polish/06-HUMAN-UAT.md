---
status: partial
phase: 06-history-read-side-polish
source: [06-VERIFICATION.md]
started: 2026-05-15T00:00:00Z
updated: 2026-05-15T00:00:00Z
---

## Current Test

[awaiting human testing on iPhone via Expo Go]

## Tests

### 1. Skia tooltip renders on tap-and-hold (BLOCKER-1 device confirm)
expected: Tap-and-hold a data point on `/exercise/<id>/chart` → see RoundedRect tooltip with value-line (`82.5 kg` for Max vikt, `3 240 kg` for Total volym) + date-line (`14 maj 2026`) above the pressed point; rect clamped to chartBounds at edges; highlight Circle follows the press; lift finger → tooltip + circle disappear.
result: [pending]

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
