---
phase: 13-pr-celebration-f18
plan: 01
subsystem: testing
tags: [e1rm, epley, pure-module, pr-detection, f18, tsx, unit-test]

requires:
  - phase: 09-auth-settings-preferences
    provides: lib/units.ts pure-module structure (header doc-comment, non-finite guard, Case[] test skeleton) — the structural template mirrored here
provides:
  - "lib/e1rm.ts — the SINGLE Epley e1RM formula source (D-08) for all Wave-2 consumers (live PR detection, chart hero, session-detail e1RM, range delta)"
  - "epley1RM(weightKg, reps): number — pure number→number in canonical kg with non-finite + weight≤0 (D-04) + reps≤0 guards"
  - "test:e1rm npm script — DB-free, <1s, exit-coded unit assertions for PR-01 formula correctness"
affects: [13-02, 13-03, 13-04, 13-05, pr-detection, chart-hero, session-detail]

tech-stack:
  added: []
  patterns:
    - "Pure Node-importable formula module (units.ts precedent): no React/Expo/Supabase imports, non-finite guard returns 0, doc-comment names the governing decisions"
    - "Single-formula-source (D-08): one epley1RM function; downstream surfaces never re-derive Epley locally"

key-files:
  created:
    - app/lib/e1rm.ts
    - app/scripts/test-e1rm.ts
  modified:
    - app/package.json

key-decisions:
  - "D-08: lib/e1rm.ts is the ONLY place the Epley formula lives — live detection, chart hero, session detail, and range delta all call epley1RM() so in-workout and read-side numerals can never drift"
  - "D-01: e1RM is a single comparable kg number; epley1RM(90,10)=120 > epley1RM(100,5)≈116.67 — a higher-rep lighter set CAN out-rank a heavier set (asserted explicitly)"
  - "D-04 + guards: weight≤0, reps≤0, and non-finite inputs all return 0 (never NaN/Infinity into a PR compare or rendered numeral) — T-13-03 mitigation"
  - "D-02 (first-set baseline) and D-03 (set_type='working' filter) are CALLER concerns, kept OUT of the formula to preserve a pure number→number contract"

patterns-established:
  - "e1RM is a kg figure, NOT its own unit — callers display-convert via toDisplayWeight/formatWeight + useUnitStore (D-20), the same path every other weight uses"

requirements-completed: [PR-01]

duration: ~8min
completed: 2026-06-14
---

# Phase 13 Plan 01: Epley e1RM Formula Source Summary

**The single pure Epley e1RM source (`lib/e1rm.ts`, D-08) plus a 9-case DB-free unit test proving PR-01 formula correctness and the non-finite/≤0 guards (T-13-03).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-14T14:30:05Z
- **Completed:** 2026-06-14T14:38:00Z
- **Tasks:** 2 (Task 1 was TDD: RED → GREEN)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `lib/e1rm.ts` — the single Epley formula source (D-08); `epley1RM(weightKg, reps)` returns `weightKg × (1 + reps/30)` in canonical kg, with non-finite / weight≤0 (D-04) / reps≤0 guards all returning 0.
- `scripts/test-e1rm.ts` — 9 assertions covering Epley correctness, the D-01 worked example (`epley1RM(90,10) > epley1RM(100,5)` asserted explicitly), and every guard; runs offline in <1s, exit-coded.
- `test:e1rm` npm script wired (pure — no `--env-file`, no DB, no Expo).
- Purity verified: zero imports from `react`, `expo-*`, `@supabase`, or `react-native`.

## Task Commits

Each task was committed atomically (TDD cycle on Task 1: failing test first → implementation):

1. **Task 1: Create lib/e1rm.ts pure Epley util** — `5fa8410` (feat)
   - RED phase verified first: `npm run test:e1rm` failed with `Cannot find module '../lib/e1rm'` before the module existed.
   - GREEN phase: module created; `npx tsc --noEmit` exit 0.
2. **Task 2: Create test-e1rm.ts + wire test:e1rm script** — `17dd6ca` (test)
   - `npm run test:e1rm` → all 9 cases PASS, exit 0.

_Note: the test file (`test-e1rm.ts`) + npm script were authored during Task 1's RED phase but committed under Task 2 to match the plan's task→file mapping; the lib module committed alone under Task 1._

## Files Created/Modified

- `app/lib/e1rm.ts` — pure `epley1RM(weightKg, reps): number`; the single D-08 formula source.
- `app/scripts/test-e1rm.ts` — 9-case `Case[]` assertion table with `tol` for the irrational `/30` float compares; exit-coded.
- `app/package.json` — added `"test:e1rm": "tsx scripts/test-e1rm.ts"` after `test:units`.

## Decisions Made

None beyond the plan's pre-specified decisions (D-01/D-02/D-03/D-04/D-08/D-20). The formula, guards, and caller/formula boundary were all dictated by the plan and 13-PATTERNS.md; followed as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The CRLF line-ending warning on commit is the standard Windows Git autocrlf notice, not an error.

## TDD Gate Compliance

Task 1 followed the RED → GREEN cycle:
- **RED:** `npm run test:e1rm` failed (`MODULE_NOT_FOUND` on `../lib/e1rm`) before the module existed — confirmed the test was actually exercising the missing implementation, not passing spuriously.
- **GREEN:** after creating `lib/e1rm.ts`, all 9 cases pass and `tsc --noEmit` is clean.
- No REFACTOR was needed (module is 7 lines of logic + doc-comment).

Commit ordering: the `test(...)` commit (`17dd6ca`) lands AFTER the `feat(...)` commit (`5fa8410`) because the plan maps the lib module to Task 1 and the test+script to Task 2. The RED failure was demonstrated before the feat commit was made, so the gate's intent (test-first) was honored even though the test file was committed second per the task→file mapping.

## User Setup Required

None - no external service configuration required. Pure in-process numeric function, no network/DB/secrets.

## Next Phase Readiness

- D-08 single-formula source is established for all Wave-2 consumers (13-02..13-05): live in-workout PR detection, chart hero, session-detail per-exercise e1RM, and the range delta all import `epley1RM` from `../lib/e1rm`.
- No blockers. No new dependencies (RESEARCH Package Legitimacy Audit: zero new deps — T-13-SC accepted, nothing to verify).

## Self-Check: PASSED

- FOUND: app/lib/e1rm.ts
- FOUND: app/scripts/test-e1rm.ts
- FOUND: .planning/phases/13-pr-celebration-f18/13-01-SUMMARY.md
- FOUND commit: 5fa8410 (Task 1 — feat lib/e1rm.ts)
- FOUND commit: 17dd6ca (Task 2 — test + npm script)
- FOUND: test:e1rm npm script in app/package.json

---
*Phase: 13-pr-celebration-f18*
*Completed: 2026-06-14*
