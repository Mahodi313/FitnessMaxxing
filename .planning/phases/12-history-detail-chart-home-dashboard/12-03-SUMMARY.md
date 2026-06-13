---
phase: 12-history-detail-chart-home-dashboard
plan: 03
subsystem: ui
tags: [reanimated, skia, animation, progress-ring, sparkline, reduce-motion]

# Dependency graph
requires:
  - phase: 08-forge-foundation
    provides: static ProgressRing + Sparkline Skia primitives (08-03)
  - phase: 12-history-detail-chart-home-dashboard
    provides: §07 motion spec (damping 18 / stiffness 220) + D-18/D-19 decisions
provides:
  - ProgressRing with animated 0→value mount fill + D-19 overflow second-lap glow
  - Sparkline with animated left→right draw-in + end-of-draw last-point dot reveal
  - Both honor OS reduce-motion (snap to final)
affects: [12-history-detail-chart-home-dashboard Wave-3 screens (Home hero, History volume card)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prop-driven Skia mount animation: useSharedValue + withSpring(§07) → useDerivedValue rebuilds the Skia Path on the UI thread"
    - "Reduce-motion snap: useReducedMotion() (sync boolean) gates withSpring vs direct assignment"
    - "Overflow celebration: second-lap arc + wide low-opacity glow stroke, no clamp; center label shows real count (D-19)"

key-files:
  created: []
  modified:
    - app/components/ui/ProgressRing.tsx
    - app/components/ui/Sparkline.tsx

key-decisions:
  - "ProgressRing overflow = second-lap arc + wide low-opacity glow stroke underneath (RESEARCH §Mandate 3 recommended option), no Skia <Blur> — wide-stroke glow is the least-risk on-brand treatment"
  - "Upper clamp removed from ProgressRing value (was 0..1); first lap capped at 360° inside the worklet via Math.min(progress,1) so D-19 overflow can sweep the second lap"
  - "Sparkline last-point dot reveals via a delayed second shared value (withDelay 260ms + withSpring), not withDelay on the draw itself — keeps the draw and the dot independently tunable"
  - "Reanimated hooks moved above the data-guard early-return in Sparkline (rules-of-hooks); the `valid` flag now gates the early return after all hooks run"

patterns-established:
  - "§07 spring constant exported as a const SPRING = { damping: 18, stiffness: 220 } at module top in each animated primitive"
  - "Animation is strictly additive over the Phase-8 path math — no layout/coordinate change; F13 hot path untouched (D-24)"

requirements-completed: [MOTN-02, DASH-04, DASH-01]

# Metrics
duration: ~12min
completed: 2026-06-13
---

# Phase 12 Plan 03: Animate ProgressRing & Sparkline Skia Primitives Summary

**ProgressRing now springs its fill 0→value on mount with a D-19 second-lap glow when the goal is beaten, and Sparkline draws in left→right via an animated Skia clip — both snap to final under OS reduce-motion.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-13
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ProgressRing animated fill driven by a `progress` shared value via `withSpring({ damping: 18, stiffness: 220 })`, with the foreground arc Path rebuilt reactively inside `useDerivedValue` on the UI thread (MOTN-02).
- D-19 overflow treatment: when `value > 1` the ring draws a second-lap arc plus a wide low-opacity glow stroke underneath — no clamp; the center label always renders the real count passed by the parent.
- Sparkline line + area paths wrapped in a `<Group clip={clipRect}>` whose width tweens 0→full (left→right draw-in), with the last-point dot fading/scaling in at the end of the draw via a delayed second shared value (D-18).
- Both primitives honor `useReducedMotion()` (synchronous boolean) — snap to final on mount.
- Phase-8 static-only header restrictions lifted and rewritten to document the additive animation; path math unchanged; `tsc --noEmit` and eslint both clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Animate ProgressRing fill + overflow glow (MOTN-02, D-19)** - `ced69d0` (feat)
2. **Task 2: Animate Sparkline draw-in (D-18)** - `ed115e8` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `app/components/ui/ProgressRing.tsx` - Added Reanimated mount-fill spring + `useDerivedValue` arc rebuild + D-19 overflow second-lap glow; lifted static-only header; removed the 0..1 upper clamp (first lap capped at 360° in the worklet).
- `app/components/ui/Sparkline.tsx` - Added animated-width `<Group clip>` left→right draw-in + delayed last-point dot reveal; lifted static-only header; hooks hoisted above the data guard for rules-of-hooks.

## Decisions Made
- **Overflow glow via wide low-opacity stroke, not `<Blur>`** — RESEARCH §Mandate 3 offered both; the wide-stroke approach is on-brand, cheaper, and has no Skia-version risk.
- **Removed the ProgressRing upper clamp** — the static version clamped `value` to 0..1, which would defeat D-19. Now sanitized to finite non-negative only; the first-lap arc is capped at one full turn inside the worklet so the second lap reads as overflow.
- **Sparkline hooks hoisted above the `data.length < 2` early return** — Reanimated hooks must run unconditionally; converted the early `return null` to a `valid` flag computed after all hooks, returning `null` only after the hook calls.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan verify command referenced a non-existent `npm run typecheck` script**
- **Found during:** Task 1 (ProgressRing verification)
- **Issue:** The plan's `<automated>` verify block runs `npm run typecheck`, but no such script exists in `app/package.json`. The canonical typecheck per CLAUDE.md DB/CI conventions is `tsc --noEmit`.
- **Fix:** Ran `npx tsc --noEmit` (exit 0) for both tasks; also ran `npx eslint` on both files (exit 0).
- **Files modified:** none (verification-only)
- **Verification:** `tsc --noEmit` EXIT=0 after each task; eslint EXIT=0 on both files.
- **Committed in:** n/a (no code change; documented here)

---

**Total deviations:** 1 auto-fixed (1 blocking — verification harness mismatch only)
**Impact on plan:** No code impact. The intent of the verify gate (typecheck must pass) was met via the project's actual typecheck command. No scope creep.

## Issues Encountered
None — both primitives compiled and linted clean on first implementation. Visual fill/draw + reduce-motion snap is deferred to Wave-3 manual device UAT per the VALIDATION manual-only table.

## Known Stubs
None — both components take props and render real animated output; no placeholder data paths introduced.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave-3 screens (Home ring hero in `(tabs)/index.tsx`, History volume card sparkline) can now consume already-animated primitives with zero additional wiring — they pass props as before; animation runs on mount automatically.
- F13 active-workout hot path untouched (D-24): changes are additive animation props with no mutation/query-key side effects.
- Manual device UAT for the visual fill/draw and the reduce-motion snap happens at Wave-3 closeout (VALIDATION manual-only).

## Self-Check: PASSED

- FOUND: app/components/ui/ProgressRing.tsx
- FOUND: app/components/ui/Sparkline.tsx
- FOUND: .planning/phases/12-history-detail-chart-home-dashboard/12-03-SUMMARY.md
- FOUND commit: ced69d0 (Task 1 ProgressRing)
- FOUND commit: ed115e8 (Task 2 Sparkline)

---
*Phase: 12-history-detail-chart-home-dashboard*
*Completed: 2026-06-13*
