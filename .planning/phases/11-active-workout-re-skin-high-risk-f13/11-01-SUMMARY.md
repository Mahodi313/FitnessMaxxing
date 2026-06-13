---
phase: 11
plan: 01
subsystem: active-workout-screen
tags: [re-skin, forge, i18n, f13-hot-path, ui]
requires:
  - "Forge tokens (tailwind.config.js forge.*) — Phase 8"
  - "Icon primitive + ForgeButton (components/ui) — Phase 8"
  - "formatElapsed ticker pattern (active-session-banner.tsx) — Phase 10"
  - "Frozen mutation layer (useAddSet/useUpdateSet/useRemoveSet/useFinishSession) — Phases 4/5"
provides:
  - "Re-skinned workout header + live timer + progress dots + logged-set table + empty/loading states"
  - "Complete phase locale key set (sv/en at parity) consumed by 11-02 and 11-03"
affects:
  - "app/app/(app)/workout/[sessionId].tsx"
  - "app/locales/sv.json"
  - "app/locales/en.json"
tech-stack:
  added: []
  patterns:
    - "In-content custom header owning safe-area top inset (headerShown:false) with live setInterval(1000) timer off session.started_at"
    - "Per-card progress-dot strip (done=accent / current=accentSoft+border / remaining=surface2) replacing v1 counter chip"
    - "Forge set-table grid row with set-number badge, kg unit suffix, always-on RPE (muted – when null)"
    - "Trailing ✕-delete Pressable replacing ReanimatedSwipeable (same removeSet.mutate payload)"
    - "NativeWind box-decoration-via-className rule applied to every Pressable (FIT-66 accent shadow in style())"
key-files:
  created: []
  modified:
    - "app/app/(app)/workout/[sessionId].tsx"
    - "app/locales/sv.json"
    - "app/locales/en.json"
decisions:
  - "D-01/D-02: kept all-exercises vertical scroll; replaced counter chip with per-card progress dots (no Övning 1/6, no Up next)"
  - "D-03/D-04/D-05: Forge set-table with set-number badge + kg suffix + always-on RPE; ✕-delete replaces swipe (no confirm)"
  - "D-06: trophy/PR markup omitted entirely; all sets render plain checkCircle success"
  - "D-07/D-09: live header timer + custom in-content Forge header, native header hidden"
  - "D-13/D-14: empty-state + loading copy Forge-skinned and i18n'd; full header/table i18n sweep"
  - "D-17: frozen write path untouched (mutate not mutateAsync; payloads byte-identical; keyboard wiring preserved)"
metrics:
  duration: "~7 min"
  tasks_completed: 2
  files_modified: 3
  commits: 2
  completed: 2026-06-13
---

# Phase 11 Plan 01: Active-Workout Structural Re-skin Summary

Re-skinned the active-workout hot-path screen's structural shell (custom Forge header with a live `started_at` timer, per-card progress dots, a structured logged-set table with ✕-delete and always-on RPE, and Forge-skinned/i18n'd empty + loading states) around the frozen offline-first write path, and landed the complete phase locale key set at sv/en parity for plans 11-02 and 11-03 to consume.

## What Was Built

**Task 1 — Phase locale keys + custom Forge header + live timer + i18n (D-07/D-09/D-14)**
- Added all new flat keys to `sv.json`/`en.json` (1:1 parity, `check:locale-parity` green at 160 keys): `kg`, `min`, `colWeight`/`colReps`/`colRpe`, `removeSet`, `finishBody`, `nothingToLog`, `nothingToLogBody`, `restoringWorkout`, `loading`, `finishError`; converted `previous` to the interpolated `"Förra: {{w}} × {{r}}"` / `"Previous: {{w}} × {{r}}"`.
- New `WorkoutHeader` component: 40px circular back button, centered accentSoft live-timer pill (6px accent dot + tabular MM:SS), accent "Avsluta" pill. Owns its safe-area top inset via `useSafeAreaInsets`.
- Copied `formatElapsed` from `active-session-banner.tsx` (module-private there) + a `setInterval(1000)` ticker keyed on `session.started_at`, cleared on unmount.
- All three `Stack.Screen` instances flipped to `headerShown: false`; hydration + loading gates re-skinned to Forge tokens with `t("restoringWorkout")` / `t("loading")`.

**Task 2 — Progress dots + Forge set-table + ✕-delete + empty-state (D-02/D-03/D-04/D-05/D-06/D-13)**
- `SetProgressDots`: flex strip of 6px bars (done=accent / current=accentSoft+accent border / remaining=surface2) + trailing `N / M` counter (tabular), replacing the v1 `counterChipText` chip.
- `LoggedSetRow` rebuilt as a Forge grid row (`32px # · 1fr weight(kg) · 1fr reps · 56px RPE · 36px action`): set-number badge (accent circle, accentText numeral), display-font numerals, `kg` unit suffix, RPE always rendered (muted `–` when null), per-card 10px uppercase column headers.
- `ReanimatedSwipeable` swipe-delete removed; trailing `<Icon name="close" />` ✕ Pressable (44px hit-slop, `accessibilityLabel={t("removeSet")}`) calls the unchanged `removeSet.mutate({ id, session_id })`. Tap-row still enters `EditableSetRow`.
- Success icon = plain `checkCircle` (forge-success); trophy omitted entirely (D-06).
- `WorkoutBody` empty-state re-skinned to a Forge surface2 icon tile (`Icon name="list"`) + `t("nothingToLog")` / `t("nothingToLogBody")` + `ForgeButton variant="primary"`.
- Input row + `EditableSetRow` retokened to Forge; RHF/keyboard wiring (`decimal-pad`/`number-pad`, `inputMode`, `returnKeyType`, `selectTextOnFocus`, `mode:"onSubmit"`, prefill) preserved byte-for-byte.

## Deviations from Plan

### Commit granularity (process note — not a code deviation)
The plan defines Task 1 and Task 2 as two atomic commits, but both modify regions of the same `workout/[sessionId].tsx` file with interdependent imports (`Icon`/`ForgeButton` added, `Ionicons`/`ReanimatedSwipeable`/`GestureHandlerRootView` removed). A clean per-task split would leave the working tree non-compiling at the Task 1 boundary. To keep every commit's tree green (tsc/lint), commits were split by **deliverable** instead:
- Commit `1bc9908` — Task 1's headline deliverable: the complete phase locale key set (`sv.json` + `en.json`), independently parity-verified.
- Commit `a7de54f` — the full `workout/[sessionId].tsx` re-skin (Task 1 header/timer/gates + Task 2 dots/table/empty/i18n).

Both commits carry `[FIT-95]`. No functional scope was dropped or added.

### Auto-fixed issues
- **[Rule 3 — Blocking] Import ordering + duplicate barrel import.** Initial placement of `formatElapsed` between import groups and a split `Icon`/`ForgeButton` import tripped `import/first` + `import/no-duplicates` lint warnings. Fixed by merging the barrel import (`import { ForgeButton, Icon } from "@/components/ui"`) and moving `formatElapsed` below all imports. Resolved within Task 2 verification; `expo lint` exits 0 with no warnings.
- **[Rule 3 — Blocking] Missing `useTranslation` in `ExerciseCard`.** `ExerciseCard` consumed `t()` for column headers/placeholders but lacked the hook. Added `const { t } = useTranslation();`. tsc green.

## Out of Scope (left for downstream plans — intentional)
- `AvslutaOverlay` still carries v1 `bg-gray-100`/`bg-blue-600` literals and Swedish strings (lines ~1193/1242). The finish-overlay re-skin + 3-cell stats row + MOTN-04 spring is **plan 11-02's** explicit domain (D-08). Not a stub — the overlay is fully functional; only its chrome awaits 11-02.
- Full D-10 input-row redesign (56px display-value-with-unit-label fields + 50px accent CTA) and the set-logged MOTN-01 motion/haptic are **plan 11-02**. This plan retokened the existing input-row chrome only and preserved all keyboard wiring.
- Draft-resume + saved-toast re-skin in `(tabs)/index.tsx` is **plan 11-03**.

## Known Stubs
None. The screen renders real data on every surface re-skinned here; no placeholder/empty hardcoded values were introduced.

## Threat Flags
None. No new network endpoint, auth path, query/mutation, or schema surface introduced — presentational re-skin only. Threat register T-11-01/02/03 dispositions (all `accept`) hold: ✕-delete calls the unchanged `removeSet.mutate`; the timer derives client-side from already-authorized `session.started_at`; the 1s interval is cleared on unmount.

## Verification
- `cd app && npm run check:locale-parity` → PASS (160 keys, sv/en identical).
- `cd app && npx tsc --noEmit` → exit 0.
- `cd app && npx expo lint` → exit 0 (0 errors, 0 warnings).
- Source audit: `addSet.mutate`, `updateSet.mutate`, `removeSet.mutate`, `finishSession.mutate` call sites unchanged (same payload shapes); single `<OfflineBanner />` instance present; `useFocusEffect` cleanup + `useLocalSearchParams` narrowing intact; `headerShown: false` ×3, no `title: "Pass"` / `headerShown: true` remain.
- No file deletions in either commit.

## Self-Check: PASSED
- FOUND: app/app/(app)/workout/[sessionId].tsx
- FOUND: app/locales/sv.json
- FOUND: app/locales/en.json
- FOUND commit: 1bc9908 (locale keys)
- FOUND commit: a7de54f (workout screen re-skin)
