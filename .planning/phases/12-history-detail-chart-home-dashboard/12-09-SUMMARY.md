---
phase: 12-history-detail-chart-home-dashboard
plan: 09
subsystem: query-cache
gap_closure: true
linear: FIT-109
tags: [cache-invalidation, dashboard, session-finish, gap-closure]
requires:
  - "app/lib/query/keys.ts (dashboardKeys factory — Phase 12-04)"
  - "get_dashboard_summary RPC (Phase 12-01, migration 0011)"
provides:
  - "['session','finish'] onSettled invalidates dashboardKeys.all → Home hero + History card refetch on finish"
affects:
  - "app/app/(app)/(tabs)/index.tsx HomeHero (refetches via useDashboardSummaryQuery)"
  - "app/app/(app)/(tabs)/history.tsx HistoryHeader (same shared slot, D-03)"
tech-stack:
  added: []
  patterns:
    - "Broad-prefix invalidate (dashboardKeys.all) joins the existing onSettled side-effect chain, matching the lastValueKeys.all convention"
key-files:
  created: []
  modified:
    - "app/lib/query/client.ts (import dashboardKeys; +1 invalidate in finish onSettled)"
decisions:
  - "D-03: dashboard query is the shared offline-first slot for Home hero + History card + lifetime eyebrow — one invalidate refreshes all three"
  - "D-24: F13 hot path untouched — invalidate is a fire-and-forget side effect in the EXISTING onSettled, adds no await to the finish write"
metrics:
  duration: ~6 min
  tasks: 2
  files: 1
  completed: 2026-06-14
---

# Phase 12 Plan 09: Invalidate dashboard on session finish (FIT-109) Summary

Finishing a workout session now invalidates `dashboardKeys.all` inside the existing `['session','finish']` `onSettled`, so the Home activity ring + sessions-this-week count and the History weekly-volume card + lifetime eyebrow refresh on the next online tick — without waiting for a remount/refocus or a new session start.

## What Was Built

**FIT-109 (major) root cause:** The `['session','finish']` mutation's `onSettled` invalidated `sessionsKeys.active()`, `sessionsKeys.detail(id)`, `lastValueKeys.all`, and `sessionsKeys.listInfinite()` — but never `dashboardKeys`. The `get_dashboard_summary` aggregate (sessions-this-week, streak, weekly volume, sparkline series, lifetime stats) kept its stale cache until an unrelated refetch trigger fired. Starting a new session re-mounted/refocused surfaces that happened to refetch, which is why the count only "caught up" on the second session.

**Fix (Task 1 — `app/lib/query/client.ts`):**
- Added `dashboardKeys` to the existing key-factory import group from `@/lib/query/keys` (the same statement importing `sessionsKeys`, `lastValueKeys`, `setsKeys`, etc.).
- Added one fire-and-forget `void queryClient.invalidateQueries({ queryKey: dashboardKeys.all })` inside the EXISTING `onSettled`, placed AFTER the `listInfinite` invalidate so the side-effect read-order stays: active → detail → last-value → listInfinite → dashboard.
- Used `dashboardKeys.all` (broad `["dashboard"]` prefix), NOT `dashboardKeys.summary()`, matching the `lastValueKeys.all` broad-prefix convention in the same block so the invalidate stays robust if more dashboard slots are added later.
- One-line FIT-109/D-03 comment above the new invalidate.
- `mutationFn`, `onMutate`, `onError`, `retry`, and `scope` are byte-unchanged. No `await` added to the finish write path (D-24 / SKIN-08: F13 ≤3s log/finish budget preserved — the invalidate fires post-write, where the other invalidates already live).

**Verification (Task 2 — F13 hot-path gate):**
- `npm run test:f13-brutal` → **exit 0, clean** via the no-recent-session no-op branch ("No workout_sessions found in the last 60 min. Nothing to verify."). This is the FIT-107 environmental window — no 25-set fixture session exists in the last 60 min — and is the plan's accepted "clean exit 0" branch, NOT a regression. No new failing assertion was introduced by the finish-path change.

## Verification Results

- `grep -v '^//' lib/query/client.ts | grep -c "dashboardKeys.all"` === **1** (single non-comment invalidate).
- `npx tsc --noEmit` → **clean** (TSC_OK).
- `npx expo lint` → **exit 0**, no warnings.
- `npm run test:f13-brutal` → **exit 0** (no-op no-recent-session branch; FIT-107 fixture window).
- Device re-test (finish a session → Home ring count increments by 1 immediately without starting a new session) is deferred to the phase UAT re-run per the plan.

## Deviations from Plan

None — plan executed exactly as written. Task 2 is verification-only (no file changes), so it produced no commit, as expected.

## Known Stubs

None.

## D-24 / Hot-Path Compliance

F13 hot path untouched: the finish `mutationFn`/`onMutate`/`onError`/`retry`/`scope` are byte-unchanged. The added work is a single non-blocking `void queryClient.invalidateQueries(...)` inside the existing `onSettled`, which fires after the write settles — no `await` was added to the finish write path. Offline-first: the invalidate is a no-op until reconnect (no `networkMode` override on the dashboard query).

## Self-Check: PASSED

- FOUND: app/lib/query/client.ts (modified — import + invalidate present, non-comment count = 1)
- FOUND: .planning/phases/12-history-detail-chart-home-dashboard/12-09-SUMMARY.md
- Commit dbfe8b8 (Task 1) verified in git log.
