---
phase: 10-plans-exercises-re-skin
plan: 06
subsystem: plan-detail-hard-delete
tags: [re-skin, forge, plan-detail, hard-delete, snapshot, i18n, inline-overlay, destructive-confirm]

# Dependency graph
requires:
  - phase: 10-plans-exercises-re-skin
    plan: "01"
    provides: "useDeletePlan(planId) hook + ['plan','delete'] optimistic default; plan_name_snapshot column + ['session','start'] optimisticRow"
  - phase: 10-plans-exercises-re-skin
    plan: "04"
    provides: "FExercise* re-skin idiom (TOKENS light/dark token-bag + inline-optical style; inline-overlay SP-7)"
  - phase: 10-plans-exercises-re-skin
    plan: "05"
    provides: "plan-detail-shared locale keys (planEyebrow/exercisesStat/lastStat/avgTime); FHome/FNewPlan re-skin precedent"
  - phase: 08-forge-foundation
    provides: "Icon (chevronLeft/ellipsis/play/grip/barbell/chevronRight) + components/ui barrel + forge.* tokens"
provides:
  - "Re-skinned plans/[id].tsx → FPlanDetail: nav row (back + overflow ellipsis), PLAN eyebrow + title block, accent Starta pass CTA (64 tall, play icon), quick-stats row, ÖVNINGAR section + add-exercise accent link, Forge exercise rows (grip + index tile + name + null-safe target chip + chevron)"
  - "plan_name_snapshot = plan.name wired onto startSession.mutate (D-11)"
  - "Hard-delete path (D-10/D-11): danger overflow row → inline-overlay confirm dialog (deletePlanQ/deletePlanBody, danger delete + neutral keepPlan) → useDeletePlan.mutate + router.back()"
  - "sessions.ts SessionInsertVars surfaces plan_name_snapshot (Plan-01 wiring gap closed)"
  - "4 new locale keys at sv↔en parity (141 keys): deletePlanQ, deletePlanBody, delete, keepPlan"
affects: [history-tab, phase-11-active-workout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared TokenBag union type ((typeof TOKENS)['light'] | ['dark']) so subcomponents accept both literal-typed theme bags — the same widened-type idiom Plan 03 used for its Tk bag"
    - "Hard-delete dialog cloned byte-for-pattern from the same-file archive-confirm inline overlay (SP-7); danger primary is the ONLY colored action, neutral keepPlan secondary (no literal Avbryt)"
    - "Snapshot-on-start: plan_name_snapshot = plan.name threaded through startSession.mutate so deleted-plan history reads the former name via get_session_summaries coalesce"

key-files:
  created: []
  modified:
    - app/app/(app)/plans/[id].tsx
    - app/lib/queries/sessions.ts
    - app/locales/sv.json
    - app/locales/en.json

key-decisions:
  - "D-09: ALL existing plan-detail behavior preserved through the re-skin — DraggableFlatList reorder, per-row remove, soft archive (no confirm, neutral), lazy useState(randomUUID) session id, loading gate !plan, Starta pass navigation"
  - "D-10: hard-delete reachable from the overflow menu (danger 'Ta bort' row below 'Arkivera plan') gated by an inline-overlay confirm dialog (SP-7, never a portal Modal)"
  - "D-11: hard-delete preserves history — useDeletePlan + FK ON DELETE SET NULL + plan_name_snapshot wired on session-start; dialog body states history is unaffected"
  - "D-13: target chip '4 × 6–8 reps' renders NULL-SAFE from plan_exercises.target_* (only present bounds; mono tnum)"
  - "D-15: deletePlanQ/deletePlanBody/delete/keepPlan added at sv↔en parity; no cancel/bare-save introduced for the destructive dialog"

patterns-established:
  - "Forge plan-detail is the FPlanDetail reference: nav row + eyebrow title + accent CTA + quick-stats + section header + surface exercise rows"
  - "Destructive-confirm dialog = inline-overlay clone with danger primary + neutral secondary (the danger color is the only accent in the dialog)"

requirements-completed: [SKIN-02, I18N-05]

# Metrics
duration: ~6min
completed: 2026-06-12
---

# Phase 10 Plan 06: Plan-Detail Re-skin + Hard-Delete Summary

**Re-skins `plans/[id].tsx` to `FPlanDetail` (nav row, PLAN eyebrow + title, accent Starta-pass CTA, quick-stats, ÖVNINGAR section + add-exercise link, Forge exercise rows with grip handle / index tile / null-safe target chip), preserving ALL existing behavior (D-09: reorder, per-row remove, soft archive, lazy session id, loading gate); wires `plan_name_snapshot = plan.name` onto session-start (D-11); and adds the hard-delete path (D-10/D-11) — a danger overflow row opening an inline-overlay confirm dialog (danger `Ta bort` + neutral `Behåll plan`, history-unaffected body) that fires `useDeletePlan.mutate` + `router.back()`. 4 destructive-dialog locale keys added at sv↔en parity (141 keys). tsc + lint + locale-parity + test:rls all green.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-12T19:16:37Z
- **Completed:** 2026-06-12T19:22:26Z
- **Tasks:** 3
- **Files modified:** 4 (0 created, 4 modified)

## Accomplishments
- **Plan-detail re-skin (Task 1)** — `plans/[id].tsx` rebuilt to `FPlanDetail`: a 40×40 back-chevron + 40×40 overflow-ellipsis nav row, a `PLAN` eyebrow + 36px plan name + description sub, an accent `Starta pass` CTA (64 tall, `play` icon, accent shadow, disabled when zero exercises with the `needExercise` helper), a quick-stats row (`Övningar` = live count, `Senast`/`Snitt-tid` = `—` placeholders since no new aggregates are issued — UI-SPEC reconciliation), an `ÖVNINGAR` section header with a `+ Lägg till övning` accent link → picker, and Forge exercise rows (`grip` long-press drag-handle, index tile, name, NULL-safe `4 × 6–8 reps` target chip in mono tnum, per-row `✕` remove, `chevronRight` → edit-targets). **All prior behavior preserved (D-09):** `DraggableFlatList` + `useReorderPlanExercises`, per-row `useRemovePlanExercise`, soft `useArchivePlan` (NO confirm — neutral, reversible), the lazy `useState(() => randomUUID())` session id, and the `!plan` loading gate.
- **Snapshot-on-start (Task 1)** — `onStarta` now adds `plan_name_snapshot: plan.name` to the `startSession.mutate({...})` payload (D-11 / RESEARCH 163-171). `.mutate` NOT `mutateAsync` (SP-2). This persists the plan name onto the session so a later hard-delete leaves history readable via `coalesce(p.name, s.plan_name_snapshot)`.
- **Hard-delete path (Task 2)** — `useDeletePlan(plan.id)` imported (static scope, SP-3). A `showDeleteConfirm` state was added (reset in the `useFocusEffect` cleanup alongside the overflow/archive flags). The overflow popover gained a danger `Ta bort` row below `Arkivera plan`. The confirm dialog was **cloned from the same-file archive-confirm inline overlay** (SP-7 — absolute-positioned `<Pressable>` scrim + inner card, NEVER a portal Modal): title `deletePlanQ`, body `deletePlanBody` (history unaffected), **danger primary `delete` + neutral `keepPlan`** (the danger color is the only accent; no literal `Avbryt`). Confirm fires `useDeletePlan.mutate({ id }, { onError, onSuccess: router.back })` + an immediate `router.back()`; the optimistic onMutate filters `plansKeys.list` + invalidates `sessionsKeys.listInfinite`, and FK `ON DELETE SET NULL` + the snapshot keep logged history intact.
- **Locale keys (Task 3)** — `deletePlanQ` (Ta bort planen?/Delete plan?), `deletePlanBody` (Planen och dess övningar tas bort. Din loggade träningshistorik påverkas inte./The plan and its exercises will be removed. Your logged workout history is not affected.), `delete` (Ta bort/Delete), `keepPlan` (Behåll plan/Keep plan) added to BOTH locale files at parity. Reused existing `archivePlan`/`planEyebrow`/`exercisesStat`/`lastStat`/`avgTime`/`startSession`/`addExercise`/`cancel`. `check:locale-parity` PASS at 141 keys.

## Task Commits

1. **Task 1: re-skin plan-detail to FPlanDetail + wire plan_name_snapshot** — `3fe220d` (feat) [FIT-93]
2. **Task 2: add hard-delete overflow action + inline-overlay confirm dialog** — `b4b73c0` (feat) [FIT-93]
3. **Task 3: plan-detail destructive-dialog locale keys (sv + en, D-15)** — `3e7cbd8` (feat) [FIT-93]

**Plan metadata:** _(final docs commit)_ [FIT-93]

## Files Created/Modified
- `app/app/(app)/plans/[id].tsx` (modified) — FPlanDetail re-skin (Task 1) + hard-delete overflow row + confirm dialog (Task 2); all D-09 behavior preserved; snapshot wired
- `app/lib/queries/sessions.ts` (modified) — `plan_name_snapshot?: string | null` added to `SessionInsertVars` (Rule 3 — see Deviations)
- `app/locales/sv.json` (modified) — 4 destructive-dialog keys (sv)
- `app/locales/en.json` (modified) — same keys (en); parity-equal at 141

## Decisions Made
- **Shared `TokenBag` union type for subcomponents.** The `TOKENS.light`/`TOKENS.dark` objects are `as const`, so their literal types are mutually unassignable; passing `tk` into `ForgeStatInline`/`PlanExerciseRow` typed as `(typeof TOKENS)['light']` rejected the dark bag. Resolved with `type TokenBag = (typeof TOKENS)['light'] | (typeof TOKENS)['dark']` — the same widened-type idiom Plan 03 used for its `Tk` token bag.
- **`numStyle` typed as a mutable tuple.** RN's `fontVariant` expects a mutable `string[]`; `as const` made the array `readonly` and tripped the `StyleProp<TextStyle>` overload. Typed it `{ fontVariant: ["tabular-nums"] }` (mutable) so the mono-tnum style applies to the index tile + target chip + quick-stat value.
- **Quick-stats `Senast`/`Snitt-tid` render `—`.** UI-SPEC reconciliation forbids new aggregates from the detail screen; only `Övningar` (the live `planExercises.length`) is a plain derived count. `Senast`/`Snitt-tid` would each require a per-plan session aggregate (an N+1 / new RPC) that the reconciliation defers — rendered as `—` placeholders, the same discipline Plan 05 used for the plan-card meta.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Added `plan_name_snapshot` to `sessions.ts` SessionInsertVars**
- **Found during:** Task 1
- **Issue:** Plan 01's SUMMARY claimed `plan_name_snapshot` was threaded through `SessionInsertVars`, but there are TWO `SessionInsertVars` types: the one in `lib/query/client.ts` (which DOES carry `plan_name_snapshot` and reads it in the `['session','start']` optimisticRow + insert) and the local one in `lib/queries/sessions.ts` that types the `useStartSession` hook's `.mutate(...)` — that one was NOT updated. Adding `plan_name_snapshot: plan.name` to the `startSession.mutate` payload tripped `TS2353: 'plan_name_snapshot' does not exist in type 'SessionInsertVars'`.
- **Fix:** Added `plan_name_snapshot?: string | null;` to the `SessionInsertVars` in `lib/queries/sessions.ts` — this is the exact wiring Plan 01 intended (the client.ts default already consumes the field; only the hook's vars type was missing it). Optional + nullable so existing call sites (none pass it) stay valid.
- **Files modified:** `app/lib/queries/sessions.ts`
- **Commit:** `3fe220d`

## Issues Encountered

**`npm run test:f13-brutal` FAILS on a data precondition, not a code regression.** The harness `scripts/verify-f13-brutal-test.ts` verifies a **manually-seeded brutal-test session of exactly 25 exercise_sets created on-device within the last 60 minutes** (the airplane-mode UAT artifact from Phase 5). No such session was seeded in this executor run, so it found the most-recent session (0 sets, from the RLS test's own activity) and failed the `expected 25 exercise_sets, found 0` count assertion. **Every other assertion that could run passed** (set_type='working', valid completed_at, finish-UPDATE-after-set-INSERTs FIFO ordering, no out-of-order FK anomalies). This plan touched **no schema, query, or offline-replay code** — it is a pure re-skin over the Plan-01 hook + a snapshot field on an existing mutation payload — so the F13 brutal-test gate cannot regress from these changes. The gate is satisfiable only after a manual device brutal-test seed (a Phase-level UAT step, not an executor capability). `check:locale-parity` (the gate this plan owns) and `test:rls` (the cross-user regression detector) both PASS.

## Known Stubs
- **`Senast` / `Snitt-tid` quick-stats render `—`** (placeholder). This is an intentional UI-SPEC reconciliation boundary (no new aggregates from the detail screen — a per-plan "last trained" / "avg duration" would be an N+1 or a new RPC). `Övningar` is wired to the live `planExercises.length`. Documented above under Decisions; resolved if/when Phase 12's dashboard aggregates land. Not blocking the plan's goal (the re-skin + hard-delete + snapshot all function).
- **`exerciseNameKey` fallback** returns `t('exercises')` only when the exercises cache is cold (never a raw uuid). In practice the picker route mounts `useExercisesQuery` so the cache is hot; the fallback is a defensive placeholder, not a stub that flows real empty data.

## Threat Flags
None. No new network endpoint, auth path, or schema change beyond the plan's threat register. Hard-delete runs under own-row RLS (`for all using (user_id = (select auth.uid()))`, T-10-19); FK SET NULL only nulls the owner's sessions and preserves `plan_name_snapshot` (T-10-20); the snapshot is the user's own plan name (T-10-21 accepted); both hard-delete and Starta-pass use `.mutate(payload, { onError })` not mutateAsync (T-10-22); no new dependencies (T-10-SC).

## User Setup Required
None — pure re-skin over existing hooks + an existing mutation field. Device UAT (plan detail light+dark; reorder/remove/archive preserved; Starta pass navigates; hard-delete dialog danger/neutral; delete a plan with logged sessions → history still lists them with the snapshot name; flip sv↔en chrome) is deferred to phase-level UAT. The `test:f13-brutal` gate requires a manual on-device 25-set brutal-test seed (Phase-5 UAT artifact) before it can re-affirm green.

## Next Phase Readiness
- Plan-detail is now the final SKIN-02 surface: FPlanDetail chrome + the new hard-delete capability. Phase 11 (active workout) consumes the `Starta pass` navigation (destination route) and the `plan_name_snapshot` already written onto the session at start.
- The destructive-confirm inline-overlay pattern (danger primary + neutral secondary) is the reusable template for any future Forge destructive dialog.
- All gates this plan owns are green: `tsc --noEmit`, `expo lint`, `check:locale-parity` (141 keys), `test:rls`. The `test:f13-brutal` gate is data-precondition-gated (manual seed) and untouched by this plan's changes.

## Self-Check: PASSED

- FOUND: `app/app/(app)/plans/[id].tsx`
- FOUND: `app/lib/queries/sessions.ts`
- FOUND: `app/locales/sv.json` + `app/locales/en.json`
- FOUND: `.planning/phases/10-plans-exercises-re-skin/10-06-SUMMARY.md`
- FOUND: commit `3fe220d` (Task 1)
- FOUND: commit `b4b73c0` (Task 2)
- FOUND: commit `3e7cbd8` (Task 3)

---
*Phase: 10-plans-exercises-re-skin*
*Completed: 2026-06-12*
</content>
