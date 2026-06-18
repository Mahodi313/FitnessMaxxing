---
phase: 12-history-detail-chart-home-dashboard
plan: 05
subsystem: ui
tags: [react-native, expo-router, nativewind, skia, reanimated, react-query, i18n, dashboard, activity-ring]

# Dependency graph
requires:
  - phase: 12-history-detail-chart-home-dashboard (12-03)
    provides: animated ProgressRing (MOTN-02/D-18/D-19 overflow glow)
  - phase: 12-history-detail-chart-home-dashboard (12-04)
    provides: useDashboardSummaryQuery (offline-first 8-field aggregate; skeleton gate isPending && data===undefined; all-zero row = new-user)
  - phase: 12-history-detail-chart-home-dashboard (12-02)
    provides: formatVolume (D-20) + sv/en locale keys at parity (weekSessions/weeks/week/streak/thisWeekVolume/logFirstWorkout)
  - phase: 10-plans-exercises-re-skin (10-05)
    provides: Phase-10 Forge composition of the Planer tab (TOKENS hex map, plan list — kept unchanged)
  - phase: 09-auth-settings-preferences (09-01)
    provides: getPref('fm:units') typed corrupt-tolerant pref read
provides:
  - Forge activity-ring hero on the Home (Planer) tab above the unchanged plan list (DASH-01)
  - weeks-streak chip (D-07) + this-week-volume chip (D-20) in the hero (DASH-02)
  - active-session swap: ActiveSessionBanner renders in the hero slot when a session is live (D-02)
  - zeroed new-user hero + 'Logga ditt första pass' accent nudge (DASH-05/D-04)
  - offline-first hero hydration with empty-cache-only skeleton (D-03)
affects: [phase-12 history.tsx (shares useDashboardSummaryQuery + hero composition idiom), phase-12 closeout/verify, phase-13 e1RM]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-side hero consumes useDashboardSummaryQuery with skeleton gate `isPending && data === undefined`; all-zero row treated as new-user (not loading)"
    - "New-user detection via lifetime_sessions === 0 (so a returning user mid-week with 0 sessions this week does NOT get the 'first workout' nudge)"
    - "Static-View surface decoration: bg/border in className (NativeWind 4 naked-render rule); off-scale optical numbers (radius 24 / padding 20 / 16px margin) in the inline style OBJECT — the existing index.tsx header/tile idiom"

key-files:
  created: []
  modified:
    - "app/app/(app)/(tabs)/index.tsx — HomeHero + HeroSkeleton subcomponents + active-session swap above the Phase-10 plan list"

key-decisions:
  - "D-04 new-user nudge gated on lifetime_sessions===0, not sessions_this_week===0 — a returning user with 0 sessions this week sees the zeroed ring + chips, not the 'first workout' CTA"
  - "Used tsc --noEmit (project canonical) for the typecheck gate — the plan's `npm run typecheck` script does not exist (same as 12-03/12-04)"
  - "Hero built as a className-decorated static View (not ForgeCard) to hit the exact FHome optical values (radius 24 vs ForgeCard xl=28; margin 16) and match the existing file's inline-optical idiom"

patterns-established:
  - "Pattern: Home hero ↔ active-session swap is a single ternary in the parent render (`activeSession ? <ActiveSessionBanner/> : <HomeHero/>`) — the hero region hides while a session is live (D-02)"
  - "Pattern: fm:units read via useState + getPref effect (settings.tsx idiom) inside the hero; metric default until the async read settles"

requirements-completed: [DASH-01, DASH-02, DASH-05, MOTN-02, SKIN-06]

# Metrics
duration: ~15min
completed: 2026-06-13
---

# Phase 12 Plan 05: Home Activity-Ring Hero Summary

**Forge activity-ring hero on the Home (Planer) tab — animated 104px ProgressRing (sessions-this-week / weekly_goal, brand-gradient fill), weeks-streak + this-week-volume chips, active-session swap, zeroed new-user nudge, and offline-first empty-cache-only skeleton — above the unchanged Phase-10 plan list.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-13T17:30Z
- **Completed:** 2026-06-13T17:45Z
- **Tasks:** 2 (1 implementation + 1 regression gate)
- **Files modified:** 1

## Accomplishments
- Built `HomeHero`: animated `ProgressRing` (size 104 / stroke 11, `value = sessions/weekly_goal`, accent color + `[gradFrom, gradTo]` brand gradient — D-01), with the real count in the ring center overlay (tabular-nums, D-19 overflow handled inside the ring) and an "N / goal" big numeral on the right.
- Weeks-streak `ForgeChip` (flame icon) using `t('weeks')`/`t('week')` (singular at N=1 — **D-07 relabel, never `t('days')`**) + this-week-volume `ForgeChip` via `formatVolume(volume_this_week_kg, unit)` with the `fm:units` pref (D-20 — no raw kg literal).
- D-02 active-session swap: `activeSession ? <ActiveSessionBanner/> : <HomeHero/>` directly above the plan list — the hero hides while a session is live.
- D-04 zeroed new-user state: all-zero data renders the zeroed ring + chips; a genuinely new user (`lifetime_sessions === 0`) additionally gets the accent "Logga ditt första pass" `ForgeButton` nudge.
- D-03 offline-first: `HeroSkeleton` shows ONLY on `isPending && data === undefined` (truly-empty cache); a cached value — including an all-zero new-user row — renders instantly offline.
- Plan list, FAB, draft-resume overlay, and saved-toast all left untouched. No mutation defaults, query keys, persister scope, or `exercise_sets` behavior touched (D-24).

## Task Commits

1. **Task 1: Build the ring hero + chips, wire the dashboard hook + empty/skeleton states** - `dfd0f0f` (feat)
2. **Task 2: F13 regression gate** - no code change (read-only gate; see Issues Encountered)

**Plan metadata:** committed with this SUMMARY (docs)

## Files Created/Modified
- `app/app/(app)/(tabs)/index.tsx` - Added `HomeHero` + `HeroSkeleton` subcomponents and the active-session swap render above the plan list; added imports for `ProgressRing`, `ForgeChip`, `ActiveSessionBanner`, `useDashboardSummaryQuery`, `getPref`/`UnitPref`, `formatVolume`. Phase-10 plan list / FAB / draft-resume / toast unchanged.

## Decisions Made
- **New-user nudge gating (D-04 refinement):** the "Logga ditt första pass" CTA is gated on `lifetime_sessions === 0`, not `sessions_this_week === 0`. A returning user who simply hasn't trained this week sees the zeroed ring + streak/volume chips, but is NOT told to "log their first workout". The all-zero ring/chips still render for both — only the nudge is conditional. (The 12-04 hook contract exposes `lifetime_sessions`, making this distinction free.)
- **Hero as a static View, not ForgeCard:** to hit the exact FHome optical contract (radius 24, padding 20, 16px side margin) the hero is a className-decorated static `<View>` (bg/border in className per the NativeWind 4 rule; radius/padding/margin in the inline style object). `ForgeCard`'s `xl` radius is 28px and its margin is caller-supplied, so a direct View matches the mock more precisely and mirrors the existing header/tile idiom already in this file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm run typecheck` script does not exist**
- **Found during:** Task 1 (verification step)
- **Issue:** The plan's `<verify>` block calls `npm run typecheck`, but no such script exists in `package.json` (same situation noted in 12-03/12-04 SUMMARYs).
- **Fix:** Ran the project-canonical `npx tsc --noEmit` instead. Exit 0.
- **Files modified:** none (gate command only)
- **Verification:** `npx tsc --noEmit` → exit 0; `npm run lint` → 0 warnings/errors.
- **Committed in:** n/a (no code change)

**2. [Rule 3 - Blocking] `HeroSkeleton` tk-prop type too narrow**
- **Found during:** Task 1 (tsc gate)
- **Issue:** Typing the `tk` prop as `(typeof TOKENS)["light"]` rejected the dark-variant object (TS2719 — two structurally-identical-but-unrelated literal types).
- **Fix:** Widened the prop type to `(typeof TOKENS)["light"] | (typeof TOKENS)["dark"]` (the same union-widening pattern Phase-10 used for the picker's token bag).
- **Files modified:** `app/app/(app)/(tabs)/index.tsx`
- **Verification:** `npx tsc --noEmit` → exit 0.
- **Committed in:** `dfd0f0f` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking gate/typecheck). No scope creep.
**Impact on plan:** Both necessary to pass the typecheck gate; neither changed hero behavior.

## Issues Encountered

**`npm run test:f13-brutal` exits 1 — live-DB precondition, NOT a regression (Task 2 gate).**

- The brutal gate reads the **most-recent live `workout_session`** and asserts a 25-set brutal fixture. The most-recent session in the DB is a 3-set UAT session, so the **count** assertion fails (`expected 25 exercise_sets, found 3`).
- **Every set-integrity assertion PASSES**: contiguous `set_number` 1..N, all `set_type='working'`, valid `completed_at` timestamps, `finished_at >= max(completed_at)` (FIFO replay correct), no FK-out-of-order anomalies.
- This plan's change is **read-only and structurally isolated from the hot path**: the diff (`git diff HEAD~1 HEAD`) touches no `mutation` / `queryKey` / `persist` / `exercise_sets` / `networkMode` / `scope` code (the only "persist" hit is a comment), and `scripts/verify-f13-brutal-test.ts` **imports nothing from `app/app/**`** — it queries the live DB only. It is therefore impossible for the Home hero to affect this gate.
- **Resolution:** No revert (nothing in the hero caused it). Logged as **Linear FIT-107** (debt, medium) — the gate needs a fresh 25-set brutal device fixture run before it, or the script should scope to a tagged fixture session instead of "most-recent". The D-24 isolation contract (no hot-path code touched) is intact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- DASH-01 (ring), DASH-02 (weeks-streak), DASH-05 (zeroed empty state), MOTN-02 (animated fill) are live on Home; D-02 active swap, D-03 offline-first, D-20 unit conversion, D-07/D-21 i18n (incl. weeks relabel) all in place.
- `history.tsx` (12-06) reuses `useDashboardSummaryQuery` (lifetime eyebrow + volume-overview card) and the same Forge composition idiom — the hook + units + locale foundations consumed here are ready for it.
- **Blocker note:** F13 brutal gate is amber on a data precondition (FIT-107), not a code regression — phase closeout should re-run it after a fresh 25-set fixture, or accept FIT-107 as the documented follow-up.
- **Manual device UAT remaining** (per VALIDATION manual-only table): ring fill animation, overflow glow, reduce-motion snap, zeroed new-user state.

## Self-Check: PASSED

- FOUND: `.planning/phases/12-history-detail-chart-home-dashboard/12-05-SUMMARY.md`
- FOUND: `app/app/(app)/(tabs)/index.tsx`
- FOUND: commit `dfd0f0f` (Task 1)

---
*Phase: 12-history-detail-chart-home-dashboard*
*Completed: 2026-06-13*
