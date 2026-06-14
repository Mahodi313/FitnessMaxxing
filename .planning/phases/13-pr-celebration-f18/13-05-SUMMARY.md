---
phase: 13-pr-celebration-f18
plan: 05
subsystem: ui
tags: [pr-detection, e1rm, epley, react-query, nativewind, supabase-rpc, units, history, chart]

# Dependency graph
requires:
  - phase: 13-01
    provides: lib/e1rm.ts (epley1RM single source, D-08)
  - phase: 13-02
    provides: migration 0012 read-only PR RPCs (get_session_pr_flags, get_exercise_pr_history, get_exercise_sets_in_range)
  - phase: 13-03
    provides: query hooks (useSessionPrFlags, usePrHistoryQuery, useExerciseSetsInRangeQuery)
  - phase: 13-04
    provides: PrTrophy component + in-workout PR detection
  - phase: 12-11
    provides: useUnitStore reactive units (D-20)
provides:
  - History list session-row PR trophy from the chronological session-level aggregator (D-14/PR-04)
  - Session-detail per-exercise e1RM stat + PR-at-the-time trophy (D-15/PR-04)
  - Exercise chart hero swapped from current-best to estimated 1RM (max e1RM in range) + success-only range delta (D-16/PR-05)
affects: [phase-15-bilingual-release-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-side e1RM display always = epley1RM(kg) → toDisplayWeight/formatWeight via useUnitStore (D-08 + D-20)"
    - "Display numerals must be rounded at the format boundary (formatWeightValue) — metric passthrough was leaking 17-digit floats"
    - "PostgREST RPC optional args: send explicit null, never undefined (undefined is JSON-dropped → arg-count mismatch → PGRST202 404)"

key-files:
  created: []
  modified:
    - app/app/(app)/(tabs)/history.tsx
    - app/app/(app)/history/[sessionId].tsx
    - app/app/(app)/exercise/[exerciseId]/chart.tsx
    - app/lib/queries/exercise-sets-in-range.ts
    - app/lib/units.ts
    - app/app/(app)/workout/[sessionId].tsx

key-decisions:
  - "D-14 — history-list trophy sourced from ONE useSessionPrFlags(sessionIds) aggregator call (no per-exercise hook loop)"
  - "D-15 — session-detail per-exercise e1RM + PR-at-the-time trophy inside the existing Phase-12 hybrid card"
  - "D-16/PR-05 — chart hero = max(epley1RM) over range sets; delta = best-in-range − earliest-in-range, success-only"
  - "D-08 — every read-side e1RM via lib/e1rm.ts; no inline formula, no SQL display e1RM"
  - "D-20 — units reactive via useUnitStore; kg↔lbs toggle re-renders all PR numerals live"
  - "D-24 — no v1 factory mutation; read-side only, F13 write path untouched"
  - "PostgREST optional-arg fix: send p_since: null explicitly (undefined → PGRST202 404)"
  - "formatWeightValue rounding helper: integer as-is, else 1 decimal — fixes unrounded metric passthrough float"

patterns-established:
  - "Pattern 1: PostgREST RPC optional params take explicit null, not undefined (undefined gets dropped from the JSON body and PostgREST resolves to a non-existent overload → PGRST202 404)"
  - "Pattern 2: shared formatWeightValue(value) numeral helper in units.ts rounds at the display boundary (integer passthrough, else 1 decimal) so the metric path no longer leaks raw float precision"
  - "Pattern 3: active-workout PR trophies derived from persisted sets + baseline via running-max replay, not ephemeral useState — survives navigation"

requirements-completed: [PR-04, PR-05]

# Metrics
duration: ~50min (incl. 3 device-UAT fix loops)
completed: 2026-06-14
---

# Phase 13 Plan 05: Read-Side PR Surfaces Summary

**PR-at-the-time trophies on history rows + session detail, per-exercise e1RM stats, and the exercise chart hero swapped to estimated 1RM with a success-only range delta — every numeral via lib/e1rm.ts, reactive to the kg↔lbs unit toggle.**

## Performance

- **Duration:** ~50 min (Tasks 1–2 autonomous + three device-UAT fix loops)
- **Started:** 2026-06-14T17:46:22+02:00 (Task 1 commit)
- **Completed:** 2026-06-14T18:33:35+02:00 (last fix commit)
- **Tasks:** 2 implementation tasks + 1 device-UAT checkpoint (approved)
- **Files modified:** 6 (3 read-side screens + exercise-sets-in-range hook + units.ts + workout screen)

## Accomplishments

- **History list (D-14/PR-04):** a gradient trophy renders on session rows whose `session_id` has `has_pr = true`, sourced from ONE `useSessionPrFlags(sessionIds)` aggregator call over the visible session-id list (hooks-legal, no per-exercise loop). Trophies are PR-at-log-time and never migrate.
- **Session detail (D-15/PR-04):** each exercise card shows a per-exercise e1RM stat (`epley1RM` of the top working set, display-converted via `formatWeight`) and an 18px trophy on exercises that hit a PR-at-the-time in that session (`was_pr` set with `session_id === thisSessionId` from `usePrHistoryQuery`).
- **Exercise chart (D-16/PR-05):** the hero numeral swapped from `summary.current_best` to `max(epley1RM)` over the range sets, with the eyebrow key changed to `estimated1RM` and a success-only range-delta chip (best-in-range − earliest-in-range; negative/zero shows no chip, never red). Geometry untouched; the chart line/scatter draw-on-mount (MOTN-03) is unchanged.
- **Unit reactivity (D-20):** all three surfaces stay live on a kg↔lbs toggle via `useUnitStore`.

## Task Commits

1. **Task 1: History session-row trophy (D-14) + session-detail per-exercise e1RM + trophy (D-15)** — `eb3f140` (feat)
2. **Task 2: Chart hero swap → estimated 1RM + range delta (D-16/PR-05)** — `3d481db` (feat)

**Device-UAT fix loops (Task 3 checkpoint iteration):**

- **Fix loop A — chart e1RM hero blank on "Allt" range** — `b909da6` (fix)
- **Fix loop B — chart hero unrounded 17-digit float** — `b73eb8f` (fix)
- **UAT-surfaced 13-04 defect — active-workout trophy persistence** — `baf408e` (fix, tagged FIT-116)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified

- `app/app/(app)/(tabs)/history.tsx` — session-row `PrTrophy` gated on `useSessionPrFlags(sessionIds)[session.id]` (D-14)
- `app/app/(app)/history/[sessionId].tsx` — per-exercise e1RM via `epley1RM` + `formatWeight`, 18px trophy on PR-at-the-time exercises (D-15)
- `app/app/(app)/exercise/[exerciseId]/chart.tsx` — hero data swap to `max(epley1RM)` over `useExerciseSetsInRangeQuery`, `estimated1RM` eyebrow, success-only range delta (D-16); rounding via `formatWeightValue`
- `app/lib/queries/exercise-sets-in-range.ts` — send explicit `p_since: null` (was `undefined` → PGRST202 404 on the "Allt" range)
- `app/lib/units.ts` — new shared `formatWeightValue(value)` numeral helper (integer as-is, else 1 decimal)
- `app/app/(app)/workout/[sessionId].tsx` — PR trophies derived from persisted sets + baseline via running-max replay (FIT-116; D-02/D-05/D-12 preserved)

## Decisions Made

- **D-14** honored — history-list `has_pr` comes from the single `useSessionPrFlags` aggregator (the RPC `get_session_pr_flags` shipped in 13-02 exists precisely to avoid a rules-of-hooks-violating per-exercise loop).
- **D-15** honored — per-exercise e1RM + PR-at-the-time trophy seated inside the existing Phase-12 hybrid card; the per-exercise `usePrHistoryQuery` call is hooks-legal because the detail screen renders a fixed, known exercise set (one hook per stable child card, not a loop over sessions).
- **D-16/PR-05** honored — DATA swapped (current-best → estimated 1RM + range delta), GEOMETRY preserved; delta is success-only (Phase-12 D-12 carry-forward).
- **D-08** honored — every read-side e1RM numeral computed via `lib/e1rm.ts`; no inline `w*(1+r/30)`, no SQL display e1RM consumed.
- **D-20** honored — `useUnitStore` keeps all numerals reactive to the live unit toggle.
- **D-24** honored — read-side only; no v1 query factory / mutation / persister mutation; F13 write path untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Chart e1RM hero blank on the "Allt" range**
- **Found during:** Task 3 (device UAT, fix loop A)
- **Issue:** `useExerciseSetsInRangeQuery` for the "Allt" range passes `since = null`, and the hook sent `p_since: undefined`. PostgREST drops `undefined` keys from the JSON body, so the RPC call resolved to a non-existent overload (no default for `p_since`) → PGRST202 404 → the query threw → the hero rendered "–".
- **Fix:** Send `p_since: null` explicitly. Migration-free; verified against the live REST endpoint (`undefined` → 404, `null` → 200).
- **Files modified:** `app/lib/queries/exercise-sets-in-range.ts`
- **Verification:** Live REST call returns 200 with `null`; hero numeral renders on "Allt" range on device.
- **Committed in:** `b909da6`

**2. [Rule 1 - Bug] Chart hero numeral showed an unrounded 17-digit float**
- **Found during:** Task 3 (device UAT, fix loop B)
- **Issue:** The hero rendered `266.66666666666663` for a 200×10 working set because it used raw `String(toDisplayWeight())` while the metric path is a passthrough (no rounding).
- **Fix:** Added a shared `formatWeightValue` helper in `units.ts` (integer as-is, else 1 decimal) and routed the hero numeral through it. Session-detail was verified already-correct (it uses `formatWeight`, which already rounds).
- **Files modified:** `app/lib/units.ts`, `app/app/(app)/exercise/[exerciseId]/chart.tsx`
- **Verification:** On-device hero now shows a clean rounded numeral; tsc clean.
- **Committed in:** `b73eb8f`

**3. [Rule 1 - Bug] Active-workout PR trophies vanished on navigation (FIT-116, a 13-04-surface defect found during this UAT)**
- **Found during:** Task 3 (device UAT)
- **Issue:** In-workout PR trophies (from 13-04) were stored in ephemeral `useState` and were lost whenever the user navigated away and back, even though the underlying PR was real and persisted.
- **Fix:** Derive the trophy set from the persisted sets + the e1RM baseline via a running-max replay, so trophies are reconstructed deterministically from data instead of held in volatile component state. D-02 (first-set baseline excluded), D-05 (strict >), and D-12 (a later higher PR never removes an earlier trophy) preserved.
- **Files modified:** `app/app/(app)/workout/[sessionId].tsx`
- **Verification:** Trophies persist across navigation on device; behavior approved in UAT. Logged as Linear FIT-116 (cross-references 13-04).
- **Committed in:** `baf408e`

---

**Total deviations:** 3 auto-fixed (3 × Rule 1 bug). Deviation 3 is a 13-04-surface defect surfaced by this plan's UAT, not new 13-05 scope.
**Impact on plan:** All three are correctness fixes discovered on real-device UAT; none alter the planned behavior or geometry. The PostgREST-null and formatWeightValue patterns are reusable and documented. No scope creep.

## Issues Encountered

- **Device-UAT iteration:** the chart hero required two fix loops (All-range 404, then float rounding) before the user approved — consistent with the project's "UI phases need device-UAT iteration" convention (one fix per loop, read the source before guessing).
- **`npm run test:f13-brutal` amber:** the known FIT-107 count precondition (the brutal fixture asserts a 25-set most-recent session; the live session has fewer). All set-integrity assertions PASS; only the count fails. This plan is read-side only and imports nothing from the write path, so it is NOT a regression (documented in STATE.md Blockers).

## Verification

- `npx tsc --noEmit` — exit 0
- `expo lint` — clean
- Device UAT (Task 3) — **approved** on a real iPhone after three fix loops (history trophies, session-detail e1RM/trophy, chart e1RM hero + delta, unit reactivity, empty state, box-decoration intact)
- `npm run test:f13-brutal` — amber on the FIT-107 count precondition only (read-only, D-24/D-17 intact); not a regression

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PR-04 and PR-05 are live; Phase 13 (PR Celebration / F18) is feature-complete at 5/5 plans.
- Ready for phase-level closeout: `/gsd-secure-phase 13` (close T-13-* register) → `/gsd-verify-work 13` → `/gsd-code-review` → advance ROADMAP Phase 13 → Complete.
- FIT-116 (workout-trophy persistence) was fixed inline during this UAT; no open blocker carries into Phase 14.

## Self-Check: PASSED

- `13-05-SUMMARY.md` — FOUND
- Commit `eb3f140` (Task 1) — FOUND
- Commit `3d481db` (Task 2) — FOUND
- Commit `b909da6` (fix loop A) — FOUND
- Commit `b73eb8f` (fix loop B) — FOUND
- Commit `baf408e` (FIT-116) — FOUND
- Commit `11be088` (SUMMARY docs) — FOUND
- `npx tsc --noEmit` from `app/` — exit 0

---
*Phase: 13-pr-celebration-f18*
*Completed: 2026-06-14*
