---
phase: 10-plans-exercises-re-skin
plan: 03
subsystem: exercise-picker
tags: [re-skin, forge, filter-pills, muscle-group-dropdown, bilingual, i18n, modal, ghrv, and-combine]

# Dependency graph
requires:
  - phase: 10-plans-exercises-re-skin
    plan: "01"
    provides: "exercises.seed_key on ExerciseRow + exerciseFormSchema.muscle_group D-01 enum + useCreateExercise(planId) seed_key widening"
  - phase: 10-plans-exercises-re-skin
    plan: "02"
    provides: "resolveMuscleGroupKey + MuscleGroupKey (5 D-01 keys + other); mgAll..mgOther / equip.* / exercise.<seed_key>.name locale namespaces; seeded library so the picker is never empty"
  - phase: 08-forge-foundation
    provides: "components/ui barrel (Icon + ForgeButton/Field/Chip) + forge.* tokens; Icon names barbell/scale/plus/check/chevronDown/close"
  - phase: 04-plans-exercises-offline-queue
    provides: "useExercisesQuery + useAddExerciseToPlan(planId) + usePlanExercisesQuery; chained create→add FK-safe scope contract; GestureHandlerRootView modal wrapper idiom"
provides:
  - "Re-skinned exercise-picker.tsx → FExercisePicker (browse) + FExercisePickerNew (create) with single-select muscle-group filter pills (D-04), AND-combined translated-name search (D-05), bilingual rows, mg dropdown (D-01), free-text equipment (D-02), add-now-set-later (D-14)"
  - "Picker chrome + error/empty locale keys (sv+en): searchExercise, createExercise(+Sub), muscleGroup, equipment, selectMuscleGroup, equipmentPlaceholder, createAndAdd, back, errorGeneric(+Sub), errorNotSignedIn, noExercisesMatch — parity 132 keys"
affects: [plan-detail, exercise-edit, plan-exercise-targets]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Widened token-bag type alias Tk = Record<keyof TOKENS.light, string> so a tk prop accepts BOTH light + dark variants (literal typeof TOKENS.light makes the dark hexes non-assignable — the gotcha that bit when extracting tk-consuming subcomponents the edit.tsx never needed)"
    - "Two-state single modal screen: browse (FExercisePicker) ↔ create (FExercisePickerNew) toggled by local showCreateForm; header dismiss flips Stäng↔← Tillbaka by state"
    - "Inline-overlay muscle-group dropdown (no portal Modal — Phase 4 lesson): button + expandable in-flow selector over the 5 D-01 keys; stores the KEY, displays via t(mg<Key>)"
    - "displayName(e) = seed_key ? t('exercise.<seed_key>.name') : e.name reused by BOTH the search filter (search matches the TRANSLATED name, D-05) and the row label"
    - "Inline magnifier SVG (no named search icon) matching FExercisePicker + Phase 9 search-field precedent"

key-files:
  created: []
  modified:
    - app/app/(app)/plans/[id]/exercise-picker.tsx
    - app/locales/sv.json
    - app/locales/en.json

key-decisions:
  - "D-04: single-select pill row — tapping the active group pill OR Alla clears to null (activeGroup=null = everything); active pill = accent fill + accentText, inactive = surface + border + text2"
  - "D-05: filtered memo AND-combines (!activeGroup || resolveMuscleGroupKey(e.muscle_group)===activeGroup) && (!q || displayName(e).toLowerCase().includes(q)) — search matches the displayed (translated) name"
  - "D-01/D-16: mg dropdown emits one of the 5 schema keys into muscle_group; user name/equipment/notes stored raw, seed_key omitted (NULL) on create → raw render"
  - "Tasks 1 + 2 committed as one atomic file rewrite (both browse + create states coexist in one file) gated by the same tsc+lint pass — splitting the holistic rewrite into a half-broken intermediate commit was rejected as riskier than an honest combined commit"

patterns-established:
  - "Local composed controls (FilterPill, MuscleGroupDropdown, ForgeFieldRow, FieldBlock, FieldError) live in-file, take a widened Tk token bag — reusable shape for any future picker-style screen"
  - "Optical values as inline style={{}} numbers (search 48, pill 6×12 r18, CTA dashed r14, row tile 36×36 r10, add-button 30×30 r15, mg dropdown 56, notes minHeight 92) — NativeWind 4/Tailwind 3 purge (Pitfall 3)"

requirements-completed: [SKIN-03, I18N-05]

# Metrics
duration: ~4min
completed: 2026-06-12
---

# Phase 10 Plan 03: Exercise Picker Re-skin Summary

**Re-skins the exercise picker to `FExercisePicker` (browse) + `FExercisePickerNew` (create): a modal header (Stäng dismiss + centered title), a 48-tall search field with an inline magnifier, a single-select muscle-group filter-pill row (D-04: Alla + 5 D-01 keys) that AND-combines with the translated-name search (D-05), a dashed create-new CTA, a bilingual exercise list, and an inline create-new form with a muscle-group dropdown (D-01), free-text equipment (D-02), and notes — submitting via the preserved FK-safe chained `useCreateExercise(planId)→useAddExerciseToPlan(planId)` scope (SP-2 `.mutate`). Picker chrome + error/empty locale keys added at sv↔en parity (132 keys); all gates green.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-12T19:00:19Z
- **Completed:** 2026-06-12T19:04:23Z
- **Tasks:** 3
- **Files modified:** 3 (0 created, 3 modified)

## Accomplishments
- **Browse re-skin (Task 1)** — `exercise-picker.tsx` browse state rebuilt to `FExercisePicker`: a modal header with a `t('closeModal')` (Stäng, accent) dismiss + centered `t('addExercise')` title; a 48-tall search field with an inline magnifier SVG (no named `search` icon, per UI-SPEC); a horizontally-scrollable single-select filter-pill row (`mgAll` default + the 5 `MUSCLE_GROUP_KEYS` pills, labels via `t(mg<Key>)`) where tapping the active pill OR Alla clears to `null`; a dashed accent create-new CTA; and a bilingual exercise list. The `filtered` memo AND-combines `activeGroup` (via `resolveMuscleGroupKey`) with the displayed (translated) `displayName(e)` search (D-05). Rows render `displayName` + `mg label · equipment` (seed rows translate `equip.*`; user rows raw). Each row's `+` (accentSoft bg + accent border, 30×30, ≥44 hit area) inserts a `plan_exercises` row with null targets and dismisses (add-now-set-later, D-14). Error/empty copy routes through `t('errorGeneric')`/`t('errorNotSignedIn')`/`t('noExercisesMatch')`.
- **Create-new re-skin (Task 2)** — the inline `FExercisePickerNew` form (reached via the create CTA; `t('back')` = ← Tillbaka returns to browse): name `ForgeFieldRow` (barbell icon, stored raw, D-16); a **muscle-group dropdown** (`MuscleGroupDropdown` — inline-overlay button + expandable selector over the 5 D-01 keys, `accessibilityRole="button"` + current value label, stores the KEY, displays via `t(mg<Key>)`); a free-text equipment `ForgeFieldRow` (scale icon, stored as written, D-02); and a multiline notes box (`minHeight 92`, raw, D-16). Submit fires `createExercise.mutate(payload, { onError })` then `addExerciseToPlan.mutate(...)` under the **preserved** shared `scope.id='plan:<planId>'` (FK-safe offline replay) with `.mutate` not `mutateAsync` (SP-2). New exercises omit `seed_key` (NULL → raw render).
- **Picker locale keys (Task 3)** — `searchExercise`, `createExercise`, `createExerciseSub`, `muscleGroup`, `equipment`, `selectMuscleGroup`, `equipmentPlaceholder`, `createAndAdd`, `back`, `errorGeneric`, `errorGenericSub`, `errorNotSignedIn`, `noExercisesMatch` added to BOTH locale files with the exact UI-SPEC sv/en copy. Reused existing `closeModal`/`addExercise`/`name`/`notes`/`optional`/`mg*`/`equip.*`/`exercise.*`. No `cancel`/bare-`save` key added. `check:locale-parity` PASS at 132 keys.

## Task Commits

1. **Task 3: picker chrome + error/empty locale keys (sv + en, D-15)** — `cf84fb1` (feat) [FIT-90] — *committed first so the picker could reference the new keys*
2. **Tasks 1 + 2: re-skin picker to FExercisePicker/New (browse + create)** — `54def1c` (feat) [FIT-90]

**Plan metadata:** _(final docs commit)_ [FIT-90]

## Files Created/Modified
- `app/app/(app)/plans/[id]/exercise-picker.tsx` (modified) — full Forge re-skin: browse (search + filter pills + bilingual list) + create (mg dropdown + free-text equipment + notes); local composed controls (FilterPill, MuscleGroupDropdown, ForgeFieldRow, FieldBlock, FieldError); GHRV wrapper preserved
- `app/locales/sv.json` (modified) — 13 new picker chrome + error/empty keys (sv)
- `app/locales/en.json` (modified) — same keys (en); parity-equal at 132

## Decisions Made
- **Widened the token-bag type alias (`Tk = Record<keyof TOKENS.light, string>`).** The edit.tsx (Plan 04) used `TOKENS[scheme]` only *inside* its own component, so its literal `typeof TOKENS.light` never had to be assignable to a prop. The picker extracts five `tk`-consuming subcomponents (FilterPill, MuscleGroupDropdown, ForgeFieldRow, FieldBlock, FieldError), so a literal alias made the **dark** variant non-assignable (each hex infers a distinct string-literal type — `"#FFFFFF"` ≠ `"#0A0A0A"`). Widening the prop type to `Record<keyof TOKENS.light, string>` resolves it without weakening the literal `TOKENS` const itself. This is a re-skin convention any future multi-subcomponent screen that passes a `tk` prop must follow.
- **Tasks 1 + 2 committed as one atomic file rewrite.** Both the browse and create states live in the single `exercise-picker.tsx` file and are toggled by `showCreateForm`. The plan lists them as separate tasks, but splitting one holistic rewrite into a deliberately half-broken intermediate commit (browse compiles but create still references deleted scaffolding, or vice-versa) would violate the atomic-commit contract worse than an honest combined commit. Both tasks were verified by the same `tsc --noEmit` + `npm run lint` gate before committing. Task 3 (locales) is genuinely independent and was committed first so the picker could reference its keys at typecheck time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened the `Tk` token-bag type so subcomponents accept both themes**
- **Found during:** Task 1 (first `tsc --noEmit`)
- **Issue:** `type Tk = (typeof TOKENS)["light"]` (copied from the edit.tsx token shape) inferred each hex as a string LITERAL, so passing `TOKENS.dark` to a `tk` prop produced `TS2322: Type '"#FFFFFF"' is not assignable to type '"#0A0A0A"'` at every subcomponent call site (8 errors). The edit.tsx never hit this because it consumed `tk` only inside its own component, never as a prop.
- **Fix:** Widened the alias to `type Tk = Record<keyof (typeof TOKENS)["light"], string>` — the values become plain `string`, so both theme variants are assignable. The `TOKENS` const stays `as const` (the literal-narrow hexes are still available at the use-site).
- **Files modified:** `app/app/(app)/plans/[id]/exercise-picker.tsx`
- **Commit:** `54def1c`

**2. [Rule 1 - Lint cleanup] Consolidated three `@/lib/schemas/exercises` imports into one**
- **Found during:** Task 1/2 (first `npm run lint`)
- **Issue:** The rewrite imported `exerciseFormSchema`/`ExerciseFormInput`, `MUSCLE_GROUP_KEYS`, and `type ExerciseRow` in three separate `import` statements from the same module → 2 `import/no-duplicates` warnings (non-blocking, but the gate target is clean).
- **Fix:** Merged into a single import statement.
- **Files modified:** `app/app/(app)/plans/[id]/exercise-picker.tsx`
- **Commit:** `54def1c`

## Issues Encountered
None blocking. Both auto-fixes above were resolved within the same task before committing; `tsc --noEmit` + `npm run lint` exit 0 (zero errors, zero warnings), `check:locale-parity` PASS (132 keys), and the `test:muscle-group` cross-check stays green (16/16).

## Known Stubs
None. Every control is wired: filter pills ↔ `activeGroup` state ↔ `filtered` memo; search ↔ `searchQuery` ↔ `filtered`; row `+` ↔ `useAddExerciseToPlan.mutate`; create form ↔ RHF + `useCreateExercise.mutate`→`useAddExerciseToPlan.mutate`; mg dropdown ↔ `muscle_group` form field. The seeded library (Plan 02) means the list is never empty on first run. No empty/placeholder data flows to UI.

## Threat Flags
None. No new network endpoint, auth path, or schema change beyond the plan's threat register. Off-list `muscle_group` is blocked by the dropdown emitting only the 5 D-01 keys + `exerciseFormSchema` (T-10-10); reads/adds run under existing own-row RLS via `useExercisesQuery`/`useCreateExercise`/`useAddExerciseToPlan` (T-10-11); all mutations use `.mutate(payload, { onError })`, never `mutateAsync` (T-10-12). No new dependencies (T-10-SC) — `react-native-svg` (inline magnifier) was already in the stack.

## User Setup Required
None — pure re-skin over existing hooks + the Plan 02 seed/taxonomy. Device UAT (picker light+dark; filter pills single-select + clear; search AND-combine; create-new dropdown; sv↔en flip translating seed names/equipment + mg labels) is deferred to phase-level UAT once plan-detail (Plans 05/06) routes into the picker.

## Next Phase Readiness
- Plan 05/06 (plan-detail re-skin) can route into this picker — the chained create→add scope contract and the GHRV modal wrapper are preserved unchanged.
- The local `MuscleGroupDropdown` + `FilterPill` + `ForgeFieldRow` controls are available as in-file composed shapes should another exercise-CRUD surface want them.
- All gates green; no blockers.

## Self-Check: PASSED

- FOUND: `app/app/(app)/plans/[id]/exercise-picker.tsx`
- FOUND: `.planning/phases/10-plans-exercises-re-skin/10-03-SUMMARY.md`
- FOUND: commit `cf84fb1` (Task 3 — locale keys)
- FOUND: commit `54def1c` (Tasks 1+2 — picker re-skin)

---
*Phase: 10-plans-exercises-re-skin*
*Completed: 2026-06-12*
