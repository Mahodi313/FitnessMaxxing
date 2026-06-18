---
phase: 12-history-detail-chart-home-dashboard
plan: 11
subsystem: ui
tags: [zustand, units, prefs, reactivity, expo-router, react-native, async-storage]

# Dependency graph
requires:
  - phase: 12-history-detail-chart-home-dashboard (12-10)
    provides: "Session-detail ExerciseCard → /exercise/[exerciseId]/chart cross-link (Pressable + route + chevron + a11y) — preserved unchanged while swapping its unit read"
  - phase: 09-auth-settings-preferences
    provides: "fm:units pref + getPref/setPref corrupt-tolerant wrappers (the durable source of truth this store mirrors)"
  - phase: 12-history-detail-chart-home-dashboard (12-02)
    provides: "toDisplayWeight/formatWeight/toDisplayVolume/formatVolume (D-20 display helpers that now re-run reactively)"
provides:
  - "useUnitStore — a reactive Zustand source of truth for the live display weight-unit (kg↔lbs)"
  - "UnitsBootstrap — boot hydration of useUnitStore from fm:units (ThemeBootstrap precedent)"
  - "Settings + all four read-side screens subscribe to one reactive unit source — kg↔lbs toggle re-renders every figure immediately (no restart)"
affects: [phase-13-pr-detection, any future read-side screen rendering weights/volume]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reactive display-pref store: plain Zustand create (no persist middleware) holding the live value; AsyncStorage (via setPref) stays the durable source; hydrate() at boot, setUnit() persists + flips subscribers"
    - "Settings write-through-store: the control reads the store selector and the onChange calls the store action (state + persist in one), mirroring the language control's live i18n.changeLanguage propagation"

key-files:
  created:
    - app/lib/units-store.ts
    - app/scripts/test-units-store.ts
  modified:
    - app/app/_layout.tsx
    - app/app/(app)/(tabs)/settings.tsx
    - app/app/(app)/(tabs)/history.tsx
    - app/app/(app)/(tabs)/index.tsx
    - app/app/(app)/history/[sessionId].tsx
    - app/app/(app)/exercise/[exerciseId]/chart.tsx
    - app/package.json

key-decisions:
  - "D-20: storage stays canonical kg; the store holds only the display UnitPref — format/convert helpers re-run reactively on every consumer when the unit flips"
  - "D-08: Zustand for cross-component reactive state (font-store/persistence-store precedent — plain create, no persist middleware; fm:units stays the AsyncStorage source of truth via setPref)"
  - "D-24: F13 untouched — display-pref store only; no mutation/queryKey/persister/exercise_sets behavior changes"

patterns-established:
  - "Reactive display-pref store hydrated at boot: hydrate(value) sets state only (came from storage), setUnit(value) sets state AND persists via setPref"
  - "UnitsBootstrap is NOT added to the splash-ready gate — the metric default renders fine pre-hydration; the correct unit flips in on the next tick"

requirements-completed: [SKIN-06]

# Metrics
duration: ~14min
completed: 2026-06-14
---

# Phase 12 Plan 11: Reactive Units Store (FIT-111) Summary

**A single reactive Zustand `useUnitStore` (hydrated at boot, written by Settings, read by all four read-side screens) so toggling kg↔lbs re-renders every History / Session-Detail / Chart / Home figure immediately — no app restart.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-14T06:34:00Z
- **Completed:** 2026-06-14T06:48:18Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified) + package.json

## Accomplishments

- **Root cause closed (FIT-111):** every consuming screen read `fm:units` with the same non-reactive idiom — a local `useState` seeded once by `useEffect(() => getPref("fm:units").then(setUnit))`. `getPref` reads AsyncStorage once with no subscription, so the display-conversion helpers only re-ran on remount; Settings' `setPref` write notified nobody. Introduced ONE reactive source of truth (`useUnitStore`) all consumers subscribe to.
- **`app/lib/units-store.ts`** — plain Zustand store (font-store.ts precedent, no persist middleware). Default `unit: "metric"` (matches `getPref`'s corrupt-tolerant default — no flash of the wrong unit pre-hydration). `hydrate(u)` sets state only (boot path); `setUnit(u)` sets state AND persists via `setPref("fm:units", u)` (Settings write path).
- **`UnitsBootstrap`** in `_layout.tsx` hydrates the store from `fm:units` at boot (ThemeBootstrap precedent); deliberately NOT added to the splash-ready gate.
- **Settings write-through-store:** the units row reads `useUnitStore((s) => s.unit)` and `onUnitsChange` calls `useUnitStore.getState().setUnit(value)` — live propagation, mirroring the language control's `i18n.changeLanguage`.
- **Four read-side consumers migrated** to the reactive selector (`history`, `index`/HomeHero, `[sessionId]`, `chart`); the local `useUnitPref` hook in `history.tsx` was deleted; no `getPref("fm:units")` remains in any of the four.
- **Contracts preserved:** chart.tsx `chartData` memo dep array still includes `units` (WR-01 — sourcing it from the store is exactly what makes the toggle redraw the line + y-axis live); the FIT-110 chart cross-link in `[sessionId].tsx` is untouched.
- **TDD coverage:** `test:units-store` (7 assertions) verifies the initial/hydrate/setUnit contract (AsyncStorage stubbed in the require cache for Node tsx).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the reactive units store + boot hydration** (TDD) - `7dd82c6` (feat) — store + UnitsBootstrap + 7-assertion test, all green on first run (tiny store with a fully-specified contract; RED proof folded into the assertion design — the persist assertions fail if `setUnit` skips `setPref`).
2. **Task 2: Route the Settings write through the store** - `bd07c43` (feat)
3. **Task 3: Migrate the four read-side consumers to the store** - `4936a73` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified

- `app/lib/units-store.ts` *(created)* — reactive Zustand store for the live `UnitPref`; `hydrate`/`setUnit` actions.
- `app/scripts/test-units-store.ts` *(created)* — Node-only contract test (`npm run test:units-store`), AsyncStorage stubbed via the require cache.
- `app/app/_layout.tsx` *(modified)* — `UnitsBootstrap` component + render; imports `useUnitStore`/`getPref`.
- `app/app/(app)/(tabs)/settings.tsx` *(modified)* — units row reads the store selector; `onUnitsChange` calls `setUnit`; mount-effect `getPref("fm:units")` seed removed.
- `app/app/(app)/(tabs)/history.tsx` *(modified)* — deleted `useUnitPref`; `unit` from store selector.
- `app/app/(app)/(tabs)/index.tsx` *(modified)* — HomeHero `unit` from store selector (removed local useState+useEffect+getPref block).
- `app/app/(app)/history/[sessionId].tsx` *(modified)* — `units` from store selector; FIT-110 cross-link untouched.
- `app/app/(app)/exercise/[exerciseId]/chart.tsx` *(modified)* — `units` from store selector; memo dep array (`units`) preserved (WR-01).
- `app/package.json` *(modified)* — `test:units-store` script.

## Decisions Made

None beyond the plan — D-20 / D-08 / D-24 followed exactly. The Phase-3 font-store/persistence-store Zustand precedent (plain `create`, no persist middleware) was mirrored verbatim; `fm:units` in AsyncStorage remains the durable source via `setPref`, with the store as the live in-memory mirror.

## Deviations from Plan

None - plan executed exactly as written.

The unused `getPref` import was dropped from each of the four read-side screens (and from settings' units read path) because `fm:units` was its only consumer there — this is exactly the cleanup the plan's Task 3 action specified, not a deviation. `UnitPref` type imports were kept where prop types still reference them (history L297/L493, [sessionId] L785, chart L657).

## Issues Encountered

- **Node-tsx test infra:** the store transitively imports `prefs.ts` → AsyncStorage (a native module that breaks under Node tsx — the same boundary documented for `lib/i18n.ts` in 09-01). Resolved by pre-seeding the require cache with an in-memory AsyncStorage stub (`{ __esModule: true, default: {...} }`) before requiring the store, so `setPref`'s write lands in an asseratable map. Also wrapped the test body in an `async main()` — top-level await is unsupported under tsx's cjs output. Both are test-harness concerns only; no production code affected.

## Verification

- `npx tsc --noEmit` — clean (all 3 tasks).
- `npx expo lint` — clean (no warnings/errors).
- `npm run test:units-store` — 7/7 passed.
- `npm run test:f13-brutal` — exit 0 via the no-recent-session no-op branch (FIT-107 fixture window, NOT a regression; this plan is read-side-only, D-24 isolation intact).
- FIT-110 chart cross-link in `[sessionId].tsx` confirmed present (`router.push('/exercise/${exerciseId}/chart')`).
- chart.tsx `chartData` memo dep array confirmed to still include `units`.
- No `getPref("fm:units")` remains in any of the four read-side consumers; `useUnitPref` deleted from history.tsx.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FIT-111 closed at the source level. Device re-test (phase UAT re-run) should confirm: toggle lbs in Settings → History volume card, Session-Detail stat grid + per-set list, and Chart hero/axis/Senaste-10 all convert to lb immediately (no restart); toggling back to kg converts back live.
- All three device-UAT gap plans (FIT-109/110/111) are now executed. Phase 12 is ready for phase-level closeout.

## Self-Check: PASSED

- FOUND: app/lib/units-store.ts
- FOUND: app/scripts/test-units-store.ts
- FOUND: .planning/phases/12-history-detail-chart-home-dashboard/12-11-SUMMARY.md
- FOUND commit 7dd82c6 (Task 1)
- FOUND commit bd07c43 (Task 2)
- FOUND commit 4936a73 (Task 3)

---
*Phase: 12-history-detail-chart-home-dashboard*
*Completed: 2026-06-14*
