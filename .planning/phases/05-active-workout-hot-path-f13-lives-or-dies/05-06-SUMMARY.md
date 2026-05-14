---
phase: 05-active-workout-hot-path-f13-lives-or-dies
plan: 06
subsystem: ui
tags: [zod, schema, locale, swedish, fit-9, f6]

requires:
  - phase: 05-active-workout-hot-path-f13-lives-or-dies/02
    provides: setFormSchema + workout/[sessionId].tsx TextInput call site (D-11 decimal-pad)
provides:
  - Locale-tolerant weight input: ',' and '.' both accepted; multi-comma rejected
  - 3 new test-set-schemas cases (10 → 13 PASS)
affects: phase-06 (historik renders weight values), future locale-aware form fields

tech-stack:
  added: []
  patterns:
    - "z.preprocess as the locale-normalization boundary in Zod 4: regex
      .replace(/,/g, '.') before z.coerce.number(). Multi-comma strings
      become invalid numbers and are rejected. RHF v7 3-generic signature
      already absorbs the widened z.input type ('unknown')."

key-files:
  created:
    - .planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-06-SUMMARY.md
  modified:
    - app/lib/schemas/sets.ts
    - app/scripts/test-set-schemas.ts

key-decisions:
  - "Schema-only fix; keyboardType='decimal-pad' (D-11) was already correct.
    No change to workout/[sessionId].tsx."
  - "Empty-string handling DELIBERATELY out of scope. Pre-existing behavior
    (`weight_kg: ''` → 0 → accepted) is unchanged. Plan-checker flagged the
    'truths' wording; planner clarified scope in the objective block."
  - "Regex /g flag is intentional: rejects multi-comma inputs ('102,5,5') by
    producing invalid numbers downstream — defense-in-depth at the parse layer."

patterns-established:
  - "Pattern: Locale-tolerant numeric input at the Zod boundary. Apply to any
    future field that accepts decimal input from a region-localized keyboard."

requirements-completed: [F6]

duration: ~15 min
completed: 2026-05-14
---

# Phase 5 Plan 6: Swedish-locale decimal separator Summary

**`z.preprocess` on `setFormSchema.weight_kg` normalizes ',' → '.' before `z.coerce.number()` fires. Swedish-locale iPhones can now log fractional weights (e.g., 102,5 kg) without the silent capability regression observed in F13 brutal-test UAT 2026-05-13.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 of 3 (Task 3 is on-device manual UAT — deferred to physical iPhone)
- **Files modified:** 2
- **Files created:** 1 (this SUMMARY)

## Accomplishments

### Task 1 — Linear verify + D-11 sanity check (investigation, no commit)

- Confirmed `FIT-9` open under HIGH priority via `npm run linear:issues`.
- Confirmed `keyboardType="decimal-pad"` (2 matches) in `workout/[sessionId].tsx` — D-11/D-09 conventions honored. The first sub-hypothesis ("missing decimal-pad keyboard") is REFUTED. Root cause is schema-side comma parsing.

### Task 2 — z.preprocess wrapper + 3 new test cases (commit `f230548`)

- **`app/lib/schemas/sets.ts`** — wrapped `setFormSchema.weight_kg` in `z.preprocess((val) => typeof val === "string" ? val.replace(/,/g, ".") : val, <inner>)`. Inner schema is the existing chain unchanged (min/max/multipleOf with Swedish error messages). File header docblock gained a new bullet documenting the locale-tolerance addition and the regex /g rationale.
- **`app/scripts/test-set-schemas.ts`** — appended 3 new cases. The existing 10 are unmodified. Final count: **13 PASS**.

### Task 3 — On-device UAT (DEFERRED to physical iPhone)

The schema-level fix is structurally complete. Task 3 requires:
- Physical Swedish-locale iPhone (Settings → Region: Sweden)
- Type "102,5" + reps + Klart on the workout screen
- Verify the Supabase row's `weight_kg` column reads 102.50

The Task 3 acceptance criteria are documented in `05-06-PLAN.md`. Verification deferred because (a) it requires user's physical device, (b) the schema gates (Task 2) prove the contract layer is correct, and (c) the contingency in plan Task 3 Step 6 has not fired (no automated-test discrepancy that suggests the diagnosis is wrong).

## Verification

End-to-end gate (from `app/` cwd):

| # | Gate | Result |
|---|------|--------|
| 1 | `npx tsc --noEmit` | exit 0 ✓ |
| 2 | `npx expo lint` | 0 errors, 1 pre-existing Href warning (resolved by FIT-7 — sibling PR) |
| 3 | `npm run test:set-schemas` | **13/13 PASS** ✓ (10 baseline + 3 new) |
| 4 | `npx tsx --env-file=.env.local scripts/test-rls.ts` | 38 PASS ✓ (no regression) |
| 5 | Grep `z.preprocess` in `app/lib/schemas/sets.ts` | 1 match ✓ |
| 6 | Grep `replace(/,/g` in `app/lib/schemas/sets.ts` | 1 match ✓ |
| 7 | Grep `'102,5'` in `app/scripts/test-set-schemas.ts` | 2 matches ✓ (one happy case, one multi-comma reject) |
| 8 | Grep `Swedish\|comma` in test-set-schemas.ts | 2+ matches ✓ |
| 9 | No empty-string test case asserts rejection | confirmed ✓ (scope guardrail) |

## must_haves cross-check

All 5 must_haves.truths from `05-06-PLAN.md`:

1. ✓ "Swedish-locale user can type '102,5' and the form submits 102.5" — confirmed by the new test case "happy: weight '102,5' (Swedish comma) coerces to 102.5".
2. ✓ "Period separator also works" — confirmed by the new test case "happy: weight '102.5' (period) coerces to 102.5".
3. ✓ "Schema rejection cases preserved" — confirmed by all 7 existing reject-cases still PASS (negative weight, 1255, 82.501 non-multipleOf, reps 0, reps 5.5, reps 61, invalid set_type) + new multi-comma reject case.
4. ✓ "≥13 PASS" — exactly 13.
5. **Deferred:** on-device Swedish-locale iPhone UAT — Task 3.

## Deviations from Plan

None. Task 2 executed exactly as written; Task 3 is conditional (gated on physical iPhone). No auto-fixes required.

## Branch / merge ordering

- This plan ships on `fix/FIT-9-decimal-input` branched from `dev`.
- No file overlap with FIT-7 (`fix/FIT-7-exercise-sets-unique`) or FIT-8 (`fix/FIT-8-slow-hydration`):
  - FIT-7 edits `setFormSchema`? **No** — FIT-7 edits `SetInsertVars` (different type in the same file). The diff regions in `sets.ts` are: FIT-7 lines 29-40 (SetInsertVars); FIT-9 lines 35-44 (setFormSchema.weight_kg). Non-overlapping.
  - FIT-8 edits `sets.ts`? **No** — FIT-8 touches `_layout.tsx`, `persister.ts`, `persistence-store.ts`, `workout/[sessionId].tsx`. No overlap.
- The 1 lint warning (`Href` unused) on this branch is the same one that FIT-7 fixes; it disappears the moment FIT-7 merges to dev.

## Linear

- **Issue:** [FIT-9 — Weight input on Logga set form does not accept decimal values (Swedish locale)](https://linear.app/fitnessmaxxing/issue/FIT-9/weight-input-on-logga-set-form-does-not-accept-decimal-values-swedish)
- **Status:** ready to close (PR pending push + merge to dev; manual UAT deferred to physical iPhone)
- **Branch:** `fix/FIT-9-decimal-input`

## Self-Check: PASSED

- ✓ Schema-only fix; D-11 / D-09 / D-15 conventions preserved
- ✓ 13/13 test-set-schemas PASS
- ✓ No regression on test:rls (38 PASS baseline)
- ✓ Empty-string handling out of scope per planner clarification
- ✓ Task 3 on-device UAT documented as deferred (gated on physical iPhone)

## Next

Ready for **Plan 05-07** (FIT-10) on `fix/FIT-10-banner-backnav` branch — investigation-first plan for intermittent ActiveSessionBanner render failure on back-nav.
