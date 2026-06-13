---
phase: 12-history-detail-chart-home-dashboard
plan: 07
subsystem: read-side-ui
tags: [re-skin, session-detail, forge, i18n, units, offline-critical]
requires:
  - "12-02 (formatVolume/toDisplayVolume + phase-12 i18n key set)"
  - "Phase 6 session-detail offline-critical overlay/delete/notes logic"
  - "Phase 8 Forge tokens + Icon component"
  - "Phase 11 D-09 custom-header precedent (workout screen)"
provides:
  - "FSessionDetail re-skin (SKIN-06): custom Forge header + 3-stat grid + accentSoft notes + hybrid exercise cards"
  - "editNote i18n key at sv/en parity"
affects:
  - "app/app/(app)/history/[sessionId].tsx"
tech-stack:
  added: []
  patterns:
    - "Custom in-content Forge header (headerShown:false + 40px circular back/ellipsis) — D-17"
    - "fm:units read into local state (settings.tsx useState+getPref idiom) for D-20 display conversion"
    - "Inline-overlay (never Modal portal) chrome re-skinned over byte-preserved logic"
key-files:
  created: []
  modified:
    - "app/app/(app)/history/[sessionId].tsx"
    - "app/locales/sv.json"
    - "app/locales/en.json"
decisions: [D-13, D-15, D-17, D-20, D-21, D-22, D-24]
metrics:
  duration: ~18 min
  tasks: 2
  files: 3
  completed: 2026-06-13
---

# Phase 12 Plan 07: Session Detail Re-skin (FSessionDetail) Summary

FSessionDetail re-skin (SKIN-06) — a chrome-only Forge re-skin over the byte-preserved offline-critical overlay/delete/notes logic: a custom in-content header (circular back + ellipsis-hosted delete), a unit-converted 3-stat grid, an accentSoft notes block, and the D-15 hybrid exercise-breakdown cards (Forge frame + max-weight stat + kept expanded per-set list), with the PB trophy omitted (D-13) and every weight figure routed through the units helpers (D-20).

## What Was Built

**Task 1 — Re-skin (commit d7711f3):**
- **D-17 custom header:** `Stack.Screen options={{ headerShown: false }}` + an in-content Forge header owning its safe-area top inset — 40px circular back (`chevronLeft`) + 40px circular ellipsis (`ellipsis`, hosts the existing overflow → delete flow). Both icon-only controls carry `accessibilityLabel` via `t('back')` / `t('moreOptions')`, `accessibilityRole="button"`, and a 44px hit target (FLAG-1). Replaces the old `headerRight` ellipsis.
- **Eyebrow + title:** plan-name snapshot (`plan_name_snapshot`, Phase 10 D-11), uppercase, no-plan fallback → display date title (32px, `font-display-bold`).
- **3-stat grid card:** Set / kg·volym / min cells (1fr·1fr·1fr with dividers), tabular-nums. The volume cell renders `toDisplayVolume(...)` (no suffix) + a unit-aware micro-label (`kg`/`lb` · volym), so the figure converts with the unit pref (D-20). Set-count and duration are plain integers.
- **Notes block:** `accentSoft` card + accent border-25% + accent `pencil` icon (FSessionDetail 701-715). The F12 note is rendered verbatim, never translated; empty → `t('addNote')` affordance. Whole block is the edit-notes trigger.
- **D-15 hybrid ExerciseCard:** Forge `surface` frame + exercise name + right-aligned max-weight stat (`formatWeight`, D-20) AND the kept expanded per-set list (`{w} × {r}` + RPE per set), greys re-skinned to `forge-*` tokens.
- **Delete-confirm:** confirm button colored `forge-danger` (`#D70015 → #FF453A`) with white label (Color table). Overflow menu delete-action text also uses the danger hex.
- **i18n:** all hardcoded Swedish moved to `t()` keys (back, moreOptions, sets, volume, min, maxWeight, exercisesHeader, deleteSession, deleteSessionQ, cannotUndo, delete, cancel, set, rpe, loading, addNote, errorGeneric/Sub, save, notes, notesPlaceholder, closeModal). Added the one missing key `editNote` ("Redigera anteckning" / "Edit note") at sv/en parity.

**Task 2 — F13 regression gate:**
- Confirmed the re-skin preserved `mutate`-not-`mutateAsync` and touched no mutation defaults / persister scope / `exercise_sets` logging (D-22/D-24). The only `setMutationDefaults`/`networkMode`/`exercise_sets` references in the file are documentation comments describing the preserved offline behavior — no hot-path code changed.
- `npm run test:f13-brutal` exits 0 (no-op: no live session in the last 60 min; the harness gate passes cleanly).

## Offline-critical Logic Preserved Verbatim (D-22)

- Keyboard-height lift (`Keyboard.addListener` show/hide) + `paddingBottom = keyboardHeight + 16` on the edit-notes overlay.
- `useFocusEffect` overlay-state reset on blur (freezeOnBlur ghost-overlay guard).
- `mutate`-not-`mutateAsync` for delete + edit-notes.
- Inline-overlay pattern (NEVER a Modal portal) for overflow menu / delete-confirm / edit-notes; tap-on-scrim dismiss; `setTimeout(...50)` before the stacked confirm.
- Post-delete `router.replace({ pathname: "/(tabs)/history", params: { toast: "deleted" } })` (toast lives on the list screen, WR-01).
- Loading gate on `!session` (NOT `isPending`) + `initialData` seeding via `useSessionQuery`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Eyebrow field name `plan_name` → `plan_name_snapshot`**
- **Found during:** Task 1
- **Issue:** The plan/UI-SPEC referred to a "plan snapshot" eyebrow; `SessionRow` has no `plan_name` field — the snapshot column is `plan_name_snapshot` (Phase 10 D-11).
- **Fix:** Used `session.plan_name_snapshot ?? t("noPlan")` for the eyebrow.
- **Files modified:** app/app/(app)/history/[sessionId].tsx
- **Commit:** d7711f3

**2. [Rule 2 - Missing copy] Added `editNote` i18n key**
- **Found during:** Task 1
- **Issue:** The edit-notes overlay title had no dedicated key (v1 hardcoded "Redigera anteckning"); reusing `notes` ("Anteckningar") as a title is semantically wrong.
- **Fix:** Added `editNote` ("Redigera anteckning" / "Edit note") to sv.json + en.json at parity.
- **Files modified:** app/locales/sv.json, app/locales/en.json
- **Commit:** d7711f3

### Design adaptations (within plan scope)

- **3-stat volume cell renders the converted numeral without a unit suffix** (the suffix lives in the micro-label, matching the FSessionDetail mock "4 820" + "kg · volym"). The micro-label is built dynamically (`{kg|lb} · {t('volume')}`) rather than using the suffix-baked `volumeStatLabel` key, so imperial reads "lb · volym" correctly (D-20). No raw `kg` literal remains in the file (verified by grep gate).
- **No chart cross-link on the breakdown card.** The v1 ExerciseCard header was a Pressable cross-link to the chart route. The Phase-12 FSessionDetail mock breakdown card is informational only (no chart affordance); the chart is reached from its own screen in the Phase-12 IA. Dropped the cross-link to match the approved mock — no logic regression (the chart route still ships in 12-06).

## Threat Surface

No new security-relevant surface. Both threat-register items handled:
- **T-12-15** (delete-confirm tampering): the offline-safe `mutate(...)` + inline-overlay confirm logic is byte-preserved; confirmation still required before the irreversible delete.
- **T-12-16** (F13 hot path): chrome-only re-skin; `test:f13-brutal` green; `mutate`-not-`mutateAsync` preserved.

## Verification

- `npx tsc --noEmit` — clean (no project `typecheck` script; `tsc --noEmit` is the project canonical per 12-03/12-04).
- `npm run lint` (expo lint) — clean, 0 warnings.
- `npm run test:f13-brutal` — exits 0.
- Grep gates: `headerShown: false` present; `accessibilityLabel` present (14); `forge-danger` present (7); `mutate(` present (2), `mutateAsync` only in comments; no `<Modal` import/component; no raw `kg` literal; `trophy` only in comments (omitted, D-13).
- Manual device UAT (overflow→delete flow, edit-notes keyboard-lift, unit toggle) deferred to phase-level VALIDATION per the UI-device-UAT convention.

## Self-Check: PASSED

- FOUND: app/app/(app)/history/[sessionId].tsx
- FOUND: app/locales/sv.json
- FOUND: app/locales/en.json
- FOUND commit: d7711f3
