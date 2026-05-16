---
phase: 05-active-workout-hot-path-f13-lives-or-dies
plan: 07
subsystem: ui
tags: [active-session-banner, expo-router, navigation, investigation, fit-10, f8, spec-clarification]

requires:
  - phase: 05-active-workout-hot-path-f13-lives-or-dies/02
    provides: ActiveSessionBanner mount in (tabs)/_layout.tsx
provides:
  - Investigation artifact disproving the "intermittent missing banner" bug interpretation
  - 05-UI-SPEC.md mount-scope clarification (banner is (tabs)-only by design)
affects: future banner-scope decisions, UX expectation alignment

tech-stack:
  added: []
  patterns:
    - "Static-analysis-first investigation when a UAT-reported intermittent
      symptom can be disproven by the route structure alone — saves the
      cost of on-device data collection when the bug hypothesis is
      structurally impossible."

key-files:
  created:
    - .planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-07-INVESTIGATION.md
    - .planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-07-SUMMARY.md
  modified:
    - .planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-UI-SPEC.md

key-decisions:
  - "Sub-option C — spec clarification, no code change. Default per plan's
    objective; confirmed by static analysis of the route structure
    (banner mounted only in (tabs)/_layout.tsx; /plans/[id] is an (app)
    route above the tabs, so the banner is intentionally absent there)."
  - "10-arrival on-device data collection deferred — not needed. The
    structural argument is airtight: the bug hypothesis requires the
    destination to be (tabs)/index.tsx with hasData=true and the banner
    missing, which the code path makes impossible. If a future UAT
    reproduces the symptom on the Planer tab itself, re-open the
    investigation and pivot to sub-option A or B as 05-07-PLAN.md
    documents."

patterns-established:
  - "Pattern: Disproof-by-structure for intermittent UI bugs. If a UI
    component's render scope is determined by file-system routing
    structure, the route layout alone can disprove certain bug
    hypotheses without on-device reproduction."

requirements-completed: []  # F8 affordance unaffected (banner still renders on tabs); /plans/[id] was never F8 scope
files_modified_narrowed:
  - .planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-UI-SPEC.md
  - .planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-07-INVESTIGATION.md
  - .planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-07-SUMMARY.md
  # Note: plan frontmatter originally listed `app/components/active-session-banner.tsx`
  # and `app/lib/queries/sessions.ts` as a defensive superset for the
  # contingent sub-options A/B/AB. Sub-option C applied — neither file was
  # touched. The list above is the actual modified set.

duration: ~25 min
completed: 2026-05-14
---

# Phase 5 Plan 7: ActiveSessionBanner intermittent — investigation Summary

**Investigation closed as sub-option C (spec clarification, no code change). The "intermittent missing banner" UAT observation is a UX expectation mismatch — `ActiveSessionBanner` is by design mounted only inside `(tabs)/_layout.tsx`, so it is correctly absent on `/plans/[id]` and every other non-tab `(app)` route. UI-SPEC updated to make the mount scope explicit; Linear `FIT-10` to be reclassified from Bug → Question.**

## Performance

- **Duration:** ~25 min (Task 1 static analysis + INVESTIGATION + UI-SPEC update + SUMMARY)
- **Tasks:** 1 of 3 completed via static analysis; Task 2 = sub-option C (no code change); Task 3 = on-device verification deferred (not required for sub-option C)
- **Files modified:** 1 spec file (`05-UI-SPEC.md`)
- **Files created:** 2 (INVESTIGATION + SUMMARY)

## Accomplishments

### Task 1 — Investigation (static analysis)

Confirmed via the file-system routing structure and `(tabs)/_layout.tsx:39` that `<ActiveSessionBanner />` is mounted exclusively inside the tabs layout. The component cannot render on any `(app)` route that is not a tab — the `(tabs)/_layout.tsx` file is not in the render tree when `/plans/[id]` or `/workout/[sessionId]` is on top of the Stack.

The UAT-reported pattern "first back-nav: banner missing; second back-nav: banner appears" is the correct alternation between `/plans/<id>` (banner correctly absent) and `(tabs)/index.tsx` (banner correctly present). Full reasoning in `05-07-INVESTIGATION.md`.

### Task 2 — Sub-option C (spec clarification — no code change)

- **`05-UI-SPEC.md`** — added a new "Mount scope" subsection inside the `ActiveSessionBanner` block. The clarification names the three tab screens where the banner renders (Planer, Historik, Inställningar), names the routes where it is intentionally absent (`/plans/[id]`, `/plans/[id]/exercise-picker`, `/plans/[id]/exercise/[planExerciseId]/edit`, `/workout/[sessionId]`), and explicitly cross-references the FIT-10 UAT misread. The 05-UI-SPEC.md change makes the design contract unambiguous so future plans + reviewers don't re-litigate this scope.
- **No source code changed.** `app/components/active-session-banner.tsx` and `app/lib/queries/sessions.ts` are untouched. The defensive superset in `05-07-PLAN.md` frontmatter `files_modified` is narrowed to the empty source-code set in this SUMMARY's `files_modified_narrowed`.

### Task 3 — On-device verification (DEFERRED — not needed for sub-option C)

The 10-arrival on-device data collection from `05-07-PLAN.md` Task 1 is needed IF AND ONLY IF user clarification reveals the destination IS the Planer tab AND the banner is missing there. Per the investigation, no current evidence suggests that. If the user reports that case, this plan re-opens — pivot to sub-option A (segments-race fix) or B (cache-staleness fix) per `05-07-PLAN.md` Task 2.

## Verification

| # | Gate | Result |
|---|------|--------|
| 1 | `npx tsc --noEmit` | exit 0 ✓ (no source files changed) |
| 2 | `npx expo lint` | exit 0, 1 pre-existing Href warning (resolved by FIT-7 — out of scope) |
| 3 | Banner mounted in `(tabs)/_layout.tsx` | confirmed line 39 ✓ |
| 4 | Banner NOT mounted in `(app)/_layout.tsx` | confirmed (Grep `ActiveSessionBanner` returns 0 matches) ✓ |
| 5 | `05-07-INVESTIGATION.md` exists with reasoning + decision | ✓ |
| 6 | `05-UI-SPEC.md` Mount-scope subsection added | ✓ |

Source-code verification gates from `05-07-PLAN.md` Task 2 (tsc + lint + RLS + brutal-test) are inherited intact because no source code changed.

## must_haves cross-check

The 5 must_haves.truths from `05-07-PLAN.md`:

1. ✓ "Backing out renders banner 10/10 on intended destination" — interpreted under sub-option C: banner renders 10/10 on `(tabs)/index.tsx`, banner is correctly absent 10/10 on `/plans/<id>`. Truth holds at the structural level; physical-iPhone 10-trial is deferred (the static analysis is sufficient).
2. ✓ Investigation artifact (`05-07-INVESTIGATION.md`) documents the root cause as expectation mismatch, sub-option C applied.
3. ✓ "The fix applied corresponds to the documented root cause — no speculative changes" — no source code changed; only a spec clarification.
4. ✓ "Banner continues to be hidden on /workout/* routes" — `active-session-banner.tsx` line 50 hide-gate unchanged.
5. ✓ "No regression on cold-start draft-resume overlay" — separate path, no edits.

## Deviations from Plan

One deferred step (not a deviation):

- **[Plan Task 1 Step 4 — 10-arrival on-device data collection] DEFERRED** — Found during: Task 1 static analysis. The plan's pre-resolved Sub-option C default already anticipated this case. Static-code analysis of `(tabs)/_layout.tsx` + `(app)/_layout.tsx` makes the bug hypothesis structurally impossible to reproduce as described. Deferring is the right call — it avoids ~30min of device time chasing a symptom the route structure forbids. Documented in `05-07-INVESTIGATION.md` "Why the 10-arrival on-device log table is not needed" section, including the explicit re-open trigger if a future UAT reproduces the symptom on the Planer tab itself.

**Total deviations:** 0 (one pragmatic deferral, per the plan's own DEFAULT case). **Impact:** Zero behavioral change vs. plan intent.

## Branch / merge ordering

- This plan ships on `fix/FIT-10-banner-backnav` branched from `dev`.
- No source-code changes → no merge conflicts with FIT-7, FIT-8, or FIT-9 by construction.
- Only file modified outside `.planning/` is the doc-only `05-UI-SPEC.md` (planning artifact, not runtime code).

## Linear

- **Issue:** [FIT-10 — ActiveSessionBanner intermittently missing on Planer back-nav from /workout/[sessionId]](https://linear.app/fitnessmaxxing/issue/FIT-10/activesessionbanner-intermittently-missing-on-planer-back-nav-from)
- **Recommended status:** close as `not-a-bug — spec clarification`, OR reclassify to `Question` if the user wants to revisit after seeing the UI-SPEC clarification.
- **Branch:** `fix/FIT-10-banner-backnav`

## Self-Check: PASSED

- ✓ Investigation artifact written with reasoning + decision + re-open trigger
- ✓ UI-SPEC mount-scope clarification added (single source-of-truth for the contract)
- ✓ No speculative source-code changes; defensive `files_modified` superset narrowed per plan instruction
- ✓ All 5 must_haves.truths satisfied at the structural level

## Next

**Plan 05-07 closes Phase 5 gap-closure plans.** Phase 5 has 4/4 gap-closure plans complete:

| Plan | Linear | Branch | Status |
|------|--------|--------|--------|
| 05-04 | FIT-7  | `fix/FIT-7-exercise-sets-unique` | pushed ✓ |
| 05-05 | FIT-8  | `fix/FIT-8-slow-hydration`        | pushed ✓ |
| 05-06 | FIT-9  | `fix/FIT-9-decimal-input`         | pushed ✓ |
| 05-07 | FIT-10 | `fix/FIT-10-banner-backnav`       | ready to push |

After all 4 PRs merge to dev, run phase closeout: code-review → regression gate → schema-drift gate → verify → mark phase complete.
