---
phase: 10-plans-exercises-re-skin
plan: 04
subsystem: plan-exercise-edit-modal
tags: [re-skin, forge, stepper, nullable-targets, i18n, modal, ghrv]

# Dependency graph
requires:
  - phase: 10-plans-exercises-re-skin
    plan: "01"
    provides: "useUpdatePlanExercise/useRemovePlanExercise hooks (scope.id='plan:<planId>') + nullable target_* + exercises.seed_key on ExerciseRow"
  - phase: 10-plans-exercises-re-skin
    plan: "02"
    provides: "exercise.<seed_key>.name bilingual locale namespace (hero name resolution) + ExerciseSeedBootstrap content"
  - phase: 08-forge-foundation
    provides: "ForgeButton (destructive variant + trash icon, FIT-66 style-fn) + Icon (spark/plus/trash) + components/ui barrel + forge.* tokens"
provides:
  - "Re-skinned plans/[id]/exercise/[planExerciseId]/edit.tsx → FExerciseEdit (target preview chip + FStepperInput sets/reps + notes + danger-ghost remove)"
  - "FStepperInput composed control (nullable numeric stepper, − to null at floor, + from null to start; tabular-nums; 120×64/32×32 optical)"
  - "Edit-screen locale keys: editTargets, saveTargets, targetSets, repsMin, repsMax, setsHelp, repsHelp, removeFromPlan, closeModal, planEyebrow (sv↔en parity, 119 keys)"
  - "notesPlaceholder repurposed to UI-SPEC copy (Tempo, vilotid, formfokus… / Tempo, rest, form cues…)"
affects: [plan-detail, exercise-picker, plan-exercise-targets]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FStepperInput: nullable numeric stepper composed from inline-style optical tokens; − decrements to null at floor (keeps targets fully optional, D-14), + increments from null to start"
    - "Live-state target preview chip (renders from current stepper state, not the cached row) so the chip tracks edits in real time, null-safe per-bound"
    - "Hero exercise-name resolution: seed_key → t('exercise.<seed_key>.name', defaultValue) else raw name (D-16 user content never auto-translated); null-safe via useExercisesQuery Map lookup (no new query)"
    - "Modal header pattern: Stäng (closeModal accent) + centered title + Spara mål (saveTargets accent bold) — scoped intent keys, never generic Avbryt/Spara"

key-files:
  created: []
  modified:
    - app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx
    - app/locales/sv.json
    - app/locales/en.json

key-decisions:
  - "D-13/D-14: targets fully optional — each stepper independently clearable to null (sets, reps_min, reps_max); the − tile at floor sets null"
  - "D-15: per-screen edit chrome keys added flat at sv↔en parity; reused existing reps/notes/optional/increment/decrement keys (no duplication)"
  - "D-16: notes stored raw (trim-empty → null); hero seed-name via t(), user names verbatim"
  - "Local useState steppers (not RHF) — the screen has no cross-field validation surface (nullable independent bounds), so RHF/zod ceremony was dropped in favor of plain state + useFocusEffect re-seed (SP-7)"

patterns-established:
  - "FStepperInput nullable-stepper idiom (− to null at floor / + from null) reusable by any future optional-numeric Forge control"
  - "Optical values as inline style={{}} numbers (NativeWind 4 / Tailwind 3 purge of off-scale arbitrary classes — Pitfall 3)"

requirements-completed: [SKIN-03, I18N-05]

# Metrics
duration: ~4min
completed: 2026-06-12
---

# Phase 10 Plan 04: Plan-Exercise Edit Modal Re-skin Summary

**Re-skins the plan-exercise target-edit modal to `FExerciseEdit` — a null-safe target preview chip, an `FStepperInput` for sets plus a reps Min/Max stepper pair (all fully optional, clearable to null per D-14), a raw-stored multiline notes box, and a danger-ghost remove-from-plan — saving via `useUpdatePlanExercise.mutate` (SP-2), with the edit-screen locale keys (D-15) added at sv↔en parity (119 keys).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-12T18:52:38Z
- **Completed:** 2026-06-12T18:56:05Z
- **Tasks:** 2
- **Files modified:** 3 (0 created, 3 modified)

## Accomplishments
- **Edit modal re-skinned to FExerciseEdit (Task 1)** — `edit.tsx` rebuilt: a custom `FStepperInput` (120×64 container radius 14 borderStrong; ± tiles 32×32 radius 8, − on surface2, + on accent) drives `target_sets` (single) and a `target_reps_min`/`target_reps_max` pair separated by a "–" glyph. Every stepper is independently clearable to null (the − tile at the floor sets null — targets fully optional, D-14). Tabular-nums on every stepper value (DSGN-03). A null-safe target preview chip (`4 × 6–8 reps`, accent text + `spark` icon on `accentSoft`) renders from the **live** stepper state so it tracks edits in real time, showing only the bounds present.
- **Header + chrome (Task 1)** — modal header uses `t('closeModal')` (Stäng, accent, modal-close affordance) + centered `t('editTargets')` title + `t('saveTargets')` (Spara mål, accent bold) — never generic Avbryt/Spara. Save fires `useUpdatePlanExercise(planId).mutate({ id, plan_id, target_*, notes }, { onError })` (`.mutate`, NOT mutateAsync — SP-2/Phase-4 airplane-mode regression). Remove is a danger-ghost `ForgeButton` (`trash` icon, `text-forge-danger`) → `useRemovePlanExercise.mutate` with no confirm (reversible by re-adding). Own `GestureHandlerRootView` wrapper + theme-aware backdrop + `useFocusEffect` re-seed of stepper/notes state on focus (SP-7/SP-8).
- **Notes + hero (Task 1)** — multiline notes box (minHeight 92, stored raw, trim-empty → null, D-16). Null-safe exercise-name hero resolves via `useExercisesQuery` Map lookup: seed rows render `t('exercise.<seed_key>.name')`, user rows render their raw name verbatim (D-16).
- **Edit locale keys (Task 2)** — `editTargets`, `saveTargets`, `targetSets`, `repsMin`, `repsMax`, `setsHelp`, `repsHelp`, `removeFromPlan`, `closeModal`, `planEyebrow` added to BOTH locale files at parity; `notesPlaceholder` repurposed to the UI-SPEC copy. Reused existing `reps`/`notes`/`optional`/`increment`/`decrement` (no duplication). No `cancel`/bare-`save` key introduced on this screen. `check:locale-parity` PASS at 119 keys.

## Task Commits

1. **Task 1: re-skin plan-exercise edit modal to FExerciseEdit** — `4756dc5` (feat) [FIT-91]
2. **Task 2: add edit-screen locale keys (sv + en, D-15)** — `42ff9bd` (feat) [FIT-91]

**Plan metadata:** _(final docs commit)_ [FIT-91]

## Files Created/Modified
- `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` (modified) — full Forge re-skin: `FStepperInput` steppers, target preview chip, notes box, danger-ghost remove, Stäng/Spara mål header, GHRV wrapper + `useFocusEffect` reset
- `app/locales/sv.json` (modified) — 10 new edit keys (sv) + `notesPlaceholder` repurpose
- `app/locales/en.json` (modified) — same keys (en); parity-equal at 119

## Decisions Made
- **Local `useState` steppers instead of RHF + zod.** The prior Phase-4 `edit.tsx` used RHF with `planExerciseFormSchema` and the three-arg `useForm` generic to thread the `z.coerce.number()` input/output split (STATE.md Phase 4 Plan 03). The Forge re-skin has no cross-field validation surface to render — the three target bounds are independent and fully nullable (D-14), and the stepper UI constrains input to integers ≥ floor or null by construction (T-10-14 mitigation is the stepper itself, not a zod refine on this screen). So the RHF/zodResolver ceremony (and its three-arg-generic footgun) was dropped in favor of plain `useState` + a `useFocusEffect` re-seed (SP-7). The mutation payload is still typed by the hook's `UpdateVars` (`number | null` bounds), so the wire boundary stays type-safe.
- **`notesPlaceholder` repurposed, not duplicated.** The key existed from Phase 5 (`Anteckningar (valfri)`) but is consumed by no other rendered screen (verified via grep — only this edit.tsx reads it). Per the Task 2 action, its value was updated to the UI-SPEC copy (`Tempo, vilotid, formfokus…` / `Tempo, rest, form cues…`) rather than adding a second placeholder key.
- **Hero name added (beyond the strict acceptance list) for visual fidelity to FExerciseEdit.** The reference screen leads with the exercise name hero. Resolved null-safe from the existing `useExercisesQuery` cache (no new query, no new dep), honoring D-16. The eyebrow uses `planEyebrow` (`PLAN`). This is additive polish that mirrors the design source; it does not affect the save/remove/stepper contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added null-safe exercise-name hero**
- **Found during:** Task 1
- **Issue:** The acceptance criteria enumerate steppers/chip/notes/remove/header but the FExerciseEdit reference (forge-screens.jsx 1438) leads with an exercise-name hero; omitting it would leave the modal contextless ("which exercise am I editing?").
- **Fix:** Resolved the name from the existing `useExercisesQuery` cache via a `.find` on `exercise_id`; seed rows via `t('exercise.<seed_key>.name', { defaultValue })`, user rows verbatim (D-16). Fully null-safe — renders nothing if the row/exercise is absent. Added `planEyebrow` key for the eyebrow.
- **Files modified:** `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx`, both locale files
- **Commit:** `4756dc5` (hero) + `42ff9bd` (`planEyebrow` key)

**2. [Rule 1 - Simplification] Dropped RHF/zodResolver in favor of local state**
- **Found during:** Task 1
- **Issue:** Carrying RHF + the three-arg `useForm` generic added no value on a screen with no rendered validation and fully-nullable independent bounds; the stepper UI is itself the input constraint (T-10-14).
- **Fix:** Local `useState` steppers + `useFocusEffect` re-seed (SP-7). Hook `UpdateVars` typing preserves the wire-boundary type-safety.
- **Files modified:** `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx`
- **Commit:** `4756dc5`

## Issues Encountered
None. All three gates (`tsc --noEmit`, `expo lint`, `check:locale-parity`) exit 0.

## Known Stubs
None. Every control is wired: steppers ↔ local state ↔ `useUpdatePlanExercise.mutate`; remove ↔ `useRemovePlanExercise.mutate`; notes ↔ payload; hero ↔ live exercise cache. No empty/placeholder data flows to UI.

## Threat Flags
None. No new network endpoint, auth path, or schema change beyond the plan's threat register. Edits/removes flow through the existing own-row RLS-gated `useUpdatePlanExercise`/`useRemovePlanExercise` hooks (T-10-13); target values are stepper-constrained integers-or-null (T-10-14); save uses `.mutate(payload, { onError })` (T-10-15 — no mutateAsync stall). No new dependencies (T-10-SC).

## User Setup Required
None — pure re-skin, no external service configuration. Device UAT (edit screen light+dark; steppers set/clear targets; remove-from-plan; sv↔en chrome flip) is deferred to phase-level UAT once plan-detail (Plan 05/06) routes into this modal.

## Next Phase Readiness
- The edit modal now exposes the schema's `target_*` + `notes` fields as a designed control set; plan-detail's row-tap → edit-targets navigation (Plan 05/06) lands here re-skinned.
- `FStepperInput` is available as a local composed control should any future optional-numeric Forge surface want it (not yet promoted to the barrel — single consumer).
- All gates green; no blockers.

## Self-Check: PASSED

- FOUND: `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx`
- FOUND: `.planning/phases/10-plans-exercises-re-skin/10-04-SUMMARY.md`
- FOUND: commit `4756dc5` (Task 1)
- FOUND: commit `42ff9bd` (Task 2)

---
*Phase: 10-plans-exercises-re-skin*
*Completed: 2026-06-12*
