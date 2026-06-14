---
phase: 12-history-detail-chart-home-dashboard
plan: 06
subsystem: ui
tags: [forge-reskin, history, dashboard-card, sparkline, units, i18n, nativewind, offline-first]

# Dependency graph
requires:
  - phase: 12-02
    provides: formatVolume/toDisplayVolume (D-20) + full phase-12 sv/en locale key set (lifetimeEyebrow, thisWeekVolume, volumeDeltaPct, volumeTrendEmpty, historyTitle, noHistory, noPlan, sessionDeleted)
  - phase: 12-03
    provides: animated Sparkline (left→right draw-in, D-18)
  - phase: 12-04
    provides: useDashboardSummaryQuery (weekly_volume_series + volume_this/prior_week_kg + lifetime_sessions/hours), offline-first by inheritance
  - phase: 06
    provides: useSessionsListInfiniteQuery + SessionSummary + cursor pagination + post-delete toast plumbing
provides:
  - History tab re-skinned to FHistory — lifetime eyebrow + weekly-volume overview card (DASH-03/DASH-04 satisfied here) + Forge session rows
affects: [12-history-phase-verification, dash-03, dash-04, skin-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DASH-03/DASH-04 mock-literal split (D-05): the volume delta + sparkline live on History (NOT Home) — the verifier checks History for both"
    - "Volume-card delta chip is forge-success-only: a drop shows NO chip (not a red one) — success framing per UI-SPEC §Color"
    - "Row duration derived client-side from finished_at − started_at (SessionSummary has no duration column) → 'Z min' meta cell"
    - "FlatList ListHeaderComponent hosts the eyebrow + title + volume card so they scroll with the list and inherit pull-to-refresh; header hidden on the no-sessions-ever empty state"

key-files:
  created: []
  modified:
    - app/app/(app)/(tabs)/history.tsx

key-decisions:
  - "Delta chip success-only: hasDelta && deltaPct >= 0 gates the chip; a negative week shows no chip rather than introducing a red — matches UI-SPEC (success delta) and D-13's no-extra-red posture on read-side screens"
  - "Volume-card empty copy gates on lifetime_sessions > 0 && series.length >= 2 (Sparkline needs ≥2 points) — a brand-new user sees t('volumeTrendEmpty'), not a NaN/empty canvas"
  - "successSoft chip background is an inline theme-derived hex (no forge-successSoft token exists in tailwind.config) — mirrors the design's rgba(48,209,88,0.15) dark / rgba(30,158,69,0.12) light"

requirements-completed: [SKIN-06, DASH-03, DASH-04, DASH-05]

# Metrics
duration: ~18min
completed: 2026-06-13
---

# Phase 12 Plan 06: History Re-skin (FHistory) Summary

**History re-skinned to FHistory: a lifetime-stats eyebrow (D-09), a weekly-volume overview card carrying the big volume numeral + a forge-success delta chip + an animated accent Sparkline (D-05 — this is how DASH-03/DASH-04 are satisfied, on History not Home), and Forge session rows with a DD/MON date badge + 'X set · Y kg · Z min' meta (D-16); the PR trophy is omitted (D-13) and all v1 infinite-list/refresh/toast plumbing is byte-preserved.**

## Performance
- **Duration:** ~18 min
- **Completed:** 2026-06-13
- **Tasks:** 2 (1 re-skin + 1 F13 gate)
- **Files modified:** 1

## Accomplishments
- **Lifetime eyebrow (D-09):** uppercase micro-label `t('lifetimeEyebrow', { n: lifetime_sessions, h: round(lifetime_hours) })` above the title.
- **Weekly-volume overview card (D-05 → DASH-03/DASH-04):** `t('thisWeekVolume')` eyebrow + big `formatVolume(volume_this_week_kg, unit)` numeral + a forge-success delta chip (`Icon arrowUp` + `t('volumeDeltaPct', { n })`, client-computed `(this−prior)/prior`, prior===0 guarded) + an animated `Sparkline` fed `weekly_volume_series` mapped through `toDisplayVolume` with the accent stroke hex from TOKENS. Empty copy `t('volumeTrendEmpty')` for new users.
- **Forge session rows (D-16):** surface card radius 16 / gap 14 — 44px surface2 date-badge (DD over MON via date-fns, locale-aware) + plan name (fallback `t('noPlan')`) + meta `"{set_count} set · {formatVolume} · {duration} min"` + trailing `chevronRight`. **PR trophy OMITTED (D-13)** — no `Icon name="trophy"` rendered.
- **Units (D-20):** every kg/volume figure routes through `formatVolume`; no raw `kg` string literal in the render. `fm:units` read via the settings.tsx `useState + getPref` idiom (extracted to a local `useUnitPref` hook).
- **i18n (D-21):** all chrome strings t()-keyed (live re-render on language toggle); plan name rendered verbatim. Date locale switches sv↔enUS off `i18n.language`.
- **Re-skin chrome:** greys (`bg-white dark:bg-gray-900` / `bg-gray-100 dark:bg-gray-800` / `text-blue-*`) replaced with `forge-*` tokens; box decoration in className (NativeWind 4 naked-render rule), optical numbers inline.
- **v1 plumbing byte-preserved:** `data?.pages.flat()` memo, `onEndReached` guard (`hasNextPage && !isFetchingNextPage`), `RefreshControl`, post-delete toast read-and-clear + 2.2s timer + unmount cleanup ref (WR-02), plan-name fallback.

## Task Commits
1. **Task 1: Re-skin History — eyebrow + volume card + Forge rows** — `362ff6c` (feat)
2. **Task 2: F13 regression gate** — no code change (gate-only task; run recorded below)

## Files Created/Modified
- `app/app/(app)/(tabs)/history.tsx` (modified) — full FHistory re-skin; `HistoryHeader` (eyebrow + title + volume card fed by `useDashboardSummaryQuery`), `HistoryListRow` (date badge + meta, no trophy), `HistoryEmptyState` (Forge tokens), `MetaDot` separator, `useUnitPref` hook.

## Decisions Made
- **Delta chip is success-only** — `hasDelta && deltaPct >= 0` gates it; a down-week shows no chip rather than a red one. Matches UI-SPEC (success delta framing) and keeps the no-extra-red posture D-13 establishes for read-side screens.
- **Volume-card empty state** gates on `lifetime_sessions > 0 && series.length >= 2` — the Sparkline guard needs ≥2 points; a brand-new user gets `t('volumeTrendEmpty')` instead of an empty canvas.
- **successSoft chip bg via inline theme hex** — no `forge-successSoft` token exists in `tailwind.config.js`; mirrored the design source's `rgba(48,209,88,0.15)` dark / `rgba(30,158,69,0.12)` light directly on the chip's inline style (the chip is a plain RN View, not Skia, so an inline hex is correct).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm run typecheck` script does not exist → used `tsc --noEmit`**
- **Found during:** Task 1 verification.
- **Issue:** The plan `<automated>` block calls `npm run typecheck`, but `package.json` has no `typecheck` script (only `lint`). Same gap noted in 12-03/04/05.
- **Fix:** Ran the project-canonical `npx tsc --noEmit` (exit 0).
- **Files modified:** none.

**2. [Rule 3 - Blocking] Row meta needs a duration figure but SessionSummary has no duration column**
- **Found during:** Task 1 (D-16 meta "X set · Y kg · Z min").
- **Issue:** The list hook's `SessionSummary` exposes `set_count` + `total_volume_kg` but no duration. The FHistory row meta requires a minutes figure.
- **Fix:** Derived `durationMin` client-side from `finished_at − started_at` (rounded to whole minutes, clamped ≥0; finished-only list RPC guarantees `finished_at`). No query/RPC change — purely a render-time derivation.
- **Files modified:** app/app/(app)/(tabs)/history.tsx.
- **Committed in:** `362ff6c`.

**Total deviations:** 2 auto-fixed (both Rule 3 — tooling/contract gaps). No scope creep; no architectural change.

## F13 Gate (Task 2) — known FIT-107 fixture precondition (NOT a regression)
`npm run test:f13-brutal` exited 1 on the **set-COUNT assertion only** (`expected 25 exercise_sets, found 3`). The most-recent live session is a real 3-set device session, not a manually-logged 25-set brutal fixture. **Every** set-integrity assertion PASSED:
- PASS: set_numbers contiguous 1..N
- PASS: all sets `set_type = 'working'`
- PASS: all sets valid `completed_at`
- PASS: `finished_at >= max(completed_at)` (FIFO replay correct)
- PASS: all `completed_at >= started_at` (no FK-out-of-order)

This is the documented FIT-107 fixture-recency issue (60-min window, expects a 25-set device fixture). The History re-skin is **read-only** (imports nothing from `app/app/**` mutation paths; touches no mutation defaults, query keys, persister scope, or `exercise_sets` logging — D-24 / T-12-14 intact). Per the plan's `f13_note`, a count-only failure is an environmental precondition, not a code regression — recorded and continued, not treated as a blocker.

## Threat-Model Notes
- **T-12-13 (Information Disclosure — History aggregates):** mitigated by inheritance — `useDashboardSummaryQuery` is Zod-parsed and the RPC is SECURITY INVOKER (12-01); no client cross-user aggregation. Display-only here.
- **T-12-14 (Tampering/DoS — F13 hot path):** mitigated — read-only re-skin; D-24 isolation verified (no mutation/query-key/persister/exercise_sets touched). Task 2 gate ran; only the fixture-count precondition failed (FIT-107).
- **T-12-SC (npm installs):** no packages installed.

## D-24 Compliance (F13 isolation)
`history.tsx` is a render-only tab screen. The diff adds `useDashboardSummaryQuery` (an existing read-only hook), `formatVolume`/`toDisplayVolume`, `Sparkline`, `Icon`, and `getPref` imports — no mutation hook, no query-key factory, no persister wiring, no `exercise_sets` write path. The preserved `useSessionsListInfiniteQuery` call site is byte-unchanged.

## Next Steps
- Wave-3 screen 12-08 remains before phase closeout.
- Device UAT (per VALIDATION): sparkline draw-in on mount + unit-toggle correctness on the volume numeral and row meta.

## Self-Check: PASSED
- FOUND: app/app/(app)/(tabs)/history.tsx
- FOUND commit 362ff6c (Task 1)
- Verify greps PASS: useDashboardSummaryQuery, Sparkline, weekly_volume_series present; no text-blue-600; no trophy markup (`name="trophy"`); no raw kg literal.
- tsc --noEmit exit 0; expo lint exit 0.
- test:f13-brutal ran (count-only FIT-107 precondition fail, all integrity PASS — not a regression per f13_note).

---
*Phase: 12-history-detail-chart-home-dashboard*
*Completed: 2026-06-13*
