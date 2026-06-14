---
phase: 13-pr-celebration-f18
plan: 04
subsystem: ui
tags: [pr-detection, skia, reanimated, nativewind, e1rm, offline-first, haptics, celebration]

# Dependency graph
requires:
  - phase: 13-01
    provides: lib/e1rm.ts pure Epley e1RM source (epley1RM, D-08)
  - phase: 13-03
    provides: useBestE1rmQuery offline-first best-reference Record<exerciseId,{weight_kg,reps}> (D-06/PR-01)
  - phase: 11-02
    provides: the onKlart fire-and-forget set-logged site + fm:haptics gate precedent
  - phase: 12-03
    provides: Skia/Reanimated animated-geometry precedent (Sparkline §07 spring + useReducedMotion + useDerivedValue)
provides:
  - Live, offline-safe client-side PR detection wired fire-and-forget after addSet.mutate (PR-01)
  - PrTrophy gradient-circle component swapping the set-row green check on PR sets (PR-02/D-13)
  - PrBanner floating Skia gradient-sweep celebration banner mounting per-PR-set (PR-03/D-09/D-10/D-11)
  - pbSetSuffix locale key at sv/en parity
affects: [13-05, Phase 15]

# Tech tracking
tech-stack:
  added: []  # zero new deps — rides installed Reanimated 4 + Skia (T-13-SC accepted)
  patterns:
    - "Fire-and-forget PR detection AFTER addSet.mutate (never awaited, never preceding) — same gate as the set-logged haptic (D-17/Pitfall 5)"
    - "Floating absolute-positioned banner overlay (no Modal portal) that never shifts the set list / input row / Klart button (D-09/D-22)"
    - "Per-PR-set banner descriptor stack + historically-honest prSetIds Set (a later higher PR never removes an earlier trophy, D-11/D-12)"
    - "Banner opaque Forge-surface base + outer/inner view split so the float shadow is not clipped while the gradient wash stays clipped to the 16px radius (UAT loop-1 fix)"

key-files:
  created:
    - app/components/ui/PrTrophy.tsx
    - app/components/ui/PrBanner.tsx
  modified:
    - app/app/(app)/workout/[sessionId].tsx
    - app/locales/sv.json
    - app/locales/en.json
    - app/components/ui/index.ts

key-decisions:
  - "D-09: banner is a floating absolute overlay — set list / input row / Klart never move"
  - "D-11/D-12: a fresh banner mounts per PR set; an earlier set's trophy persists when a later higher PR lands (historically honest)"
  - "D-17: detection + banner + haptic are fire-and-forget AFTER addSet.mutate, never awaited; addSet mutationFn/onMutate/queue/persister byte-untouched"
  - "D-18: PR notificationSuccess haptic gated through the SAME getPref('fm:haptics') as the set-logged haptic"
  - "D-19: useReducedMotion() snaps banner scale + sweep to final; banner still renders"
  - "D-20: banner numerals route through useUnitStore + formatWeight (kg-stored, display-converted)"
  - "D-07 strict >: an in-session set with lower e1RM than an earlier set is NOT a PR; D-02 first-set baseline shows no banner/trophy"

patterns-established:
  - "PR detection self-precedent: epley1RM(candidate) > max(allTimeBest via useBestE1rmQuery, in-session max via useSetsForSessionQuery), strict > and weight>0 and hasPriorReference"
  - "Banner surface = opaque base + low-alpha gradient wash + 1px accent30 border + 36px gradient trophy tile; box-decoration in className (Pitfall 6 / MEMORY), style() for shadow/opacity/transform only"

requirements-completed: [PR-01, PR-02, PR-03]

# Metrics
duration: ~25min (Tasks 1-2 autonomous + 1 device-UAT loop)
completed: 2026-06-14
---

# Phase 13 Plan 04: Live PR Detection + Celebration UI Summary

**Live offline-safe client-side PR detection (Epley e1RM over the cached best-reference + in-session sets) wired fire-and-forget after the set save, surfaced as a set-row gradient trophy (PR-02) and a floating Skia gradient-sweep celebration banner (PR-03) that never shifts the sacred log path.**

## Performance

- **Duration:** ~25 min (Tasks 1-2 autonomous + 1 device-UAT iteration loop)
- **Started:** 2026-06-14T16:59:12+02:00
- **Completed:** 2026-06-14T17:22:31+02:00
- **Tasks:** 2 autonomous + 1 checkpoint (device UAT approved)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- PR-01: live, offline-safe PR detection — `epley1RM(candidate)` compared against `max(allTimeBest from useBestE1rmQuery, in-session max from useSetsForSessionQuery)`, fire-and-forget AFTER `addSet.mutate`, strict `>` (D-05/D-07) with `weight_kg > 0` and first-set baseline exclusion (D-02/D-04)
- PR-02: `PrTrophy` gradient circle replaces the green `checkCircle` on PR set rows (D-13 — replaces, never stacks; the 36px glyph column holds exactly one glyph)
- PR-03: `PrBanner` floating gradient-sweep banner mounts per PR set (D-11), scale 0.96→1 + gradient sweep, ~3.5s dwell, auto-dismiss, reduce-motion snap (D-19), `notificationSuccess` haptic through the `fm:haptics` gate (D-18)
- Hot path provably intact: `addSet` mutationFn/onMutate/queue/persister byte-untouched (D-17); `npm run test:f13-brutal` green; banner never shifts the set list / input row / Klart (D-09)
- Device UAT approved on real iPhone (live e1RM detection, in-session sequence, offline, reduce-motion, haptic gate all verified)

## Task Commits

Each task was committed atomically:

1. **Task 1: PrTrophy + PrBanner components (Skia gradient sweep, reduce-motion aware)** — `cc86c63` (feat)
2. **Task 2: Wire fire-and-forget detection + banner + set-row trophy** — `a70bbf1` (feat)
3. **UAT loop-1 fix: opaque banner surface + float shadow** — `6f61c39` (fix)

**Plan metadata:** (this docs commit)

_Note: Task 3 was a `checkpoint:human-verify` device UAT — approved by user; one defect found + fixed in loop 1 (see Deviations)._

## Files Created/Modified
- `app/components/ui/PrTrophy.tsx` (created) - reusable gradient trophy circle, `size` prop (24px set-row default), white `trophy` glyph; box-decoration in className (Pitfall 6)
- `app/components/ui/PrBanner.tsx` (created) - floating Skia gradient-sweep celebration banner; `useReducedMotion` + `useDerivedValue` sweep mirroring Sparkline §07; opaque Forge-surface base + outer/inner shadow split (UAT loop-1); numerals via `useUnitStore`/`formatWeight`; auto-dismiss
- `app/app/(app)/workout/[sessionId].tsx` (modified) - `useBestE1rmQuery()` mount; fire-and-forget detection block AFTER `addSet.mutate`; `prSetIds` state for set-row trophy swap; per-PR-set banner descriptor stack; floating absolute overlay; `notificationSuccess` haptic through `fm:haptics`
- `app/locales/sv.json` + `app/locales/en.json` (modified) - ONE new key `pbSetSuffix: "· set {{n}}"` at parity
- `app/components/ui/index.ts` (modified) - barrel exports for PrTrophy + PrBanner

## Decisions Made
All plan decisions honored as specified:
- **D-09** floating absolute overlay — set list / input row / Klart never move (verified on device, the critical geometry check)
- **D-11/D-12** per-PR-set banner + historically-honest persistent trophy — confirmed on device via the in-session `120×10 → 122×10` sequence each spawning a fresh banner + trophy while the earlier trophy stayed
- **D-17** fire-and-forget budget — detection block sits below the mutate call beside the existing haptic; the write path is byte-untouched; `test:f13-brutal` green
- **D-18** haptic gate — PR `notificationSuccess` rides the same `getPref('fm:haptics')` gate as the set-logged haptic
- **D-19** reduce-motion — banner + trophy snap to final, still readable
- **D-20** unit reactivity — banner numerals route through `useUnitStore` + `formatWeight` (kg-stored, display-converted)
- **D-07 strict >** — confirmed on device: the later `124×5` set (lower e1RM than the prior `122×10` PR) correctly did NOT fire a banner/trophy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Banner surface was transparent — underlying card title bled through (device UAT loop 1)**
- **Found during:** Task 3 (device UAT, loop 1)
- **Issue:** The banner surface was only a 15% Skia gradient wash with no opaque base, so the underlying set-list card title was visible through the banner — it read as a translucent ghost rather than a floating surface.
- **Fix:** Gave the banner an opaque Forge-surface base + a float shadow. Used an outer/inner view split so the shadow renders un-clipped while the gradient wash stays clipped to the 16px corner radius (clipping the wash to the radius would otherwise also clip the shadow).
- **Files modified:** app/components/ui/PrBanner.tsx
- **Verification:** User re-verified on real iPhone — banner now reads as a clean opaque floating surface; approved.
- **Committed in:** `6f61c39`

---

**Total deviations:** 1 auto-fixed (1 bug, surfaced by device UAT)
**Impact on plan:** The fix is a visual-correctness change confined to the banner component; detection logic, geometry contract (D-09), and the hot path are untouched. No scope creep.

## Issues Encountered
None beyond the UAT loop-1 banner-transparency defect documented above (found + fixed within the device-UAT checkpoint).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PR-01/PR-02/PR-03 live and device-verified. Plan 13-05 (read-side surfacing: history session trophy + session-detail e1RM/trophy + chart estimated-1RM hero) is the last plan in Phase 13; PR-04/PR-05 were already delivered by Plans 13-02/13-03 query/RPC layer, so 13-05 is the read-side UI surfacing of that data.
- `PrTrophy` is reusable (accepts a `size` prop) — 13-05's read-side surfaces (history row / session detail) can consume it directly.

## Self-Check: PASSED

---
*Phase: 13-pr-celebration-f18*
*Completed: 2026-06-14*
