---
phase: 05-active-workout-hot-path-f13-lives-or-dies
plan: 03
subsystem: ui
tags: [phase-5, active-session-banner, draft-recovery, toast, test-rls, manual-uat, F5, F8, F13]

# Dependency graph
requires:
  - phase: 05-01-schemas-plumbing-wave0
    provides: setMutationDefaults block for ['session','start' | 'finish'] + ['set','add' | 'update' | 'remove'] + persister throttleTime: 500 + AppState background-flush + onlineManager.subscribe(resumePausedMutations)
  - phase: 05-02-workout-screen-starta-logga-avsluta
    provides: useActiveSessionQuery / useFinishSession / useSetsForSessionQuery / workout/[sessionId] screen / Avsluta-overlay
  - phase: 04-mvp-vertical-slice
    provides: (tabs)/_layout.tsx OfflineBanner slot, (tabs)/index.tsx Planer list, plans/[id].tsx inline-overlay-confirm + useFocusEffect-reset patterns, test-rls.ts harness (29 assertions), manual-test-phase-04-airplane-mode.md template
  - phase: 02-schema-rls-type-generation
    provides: workout_sessions + exercise_sets RLS policies with (select auth.uid()) wrapped predicate + with check
provides:
  - "ActiveSessionBanner global presence across (tabs); tap routes to /workout/<id>"
  - "Draft-resume overlay on (tabs)/index for cold-start recovery (F5 / F8)"
  - "Passet sparat ✓ success toast via Reanimated transition-watcher"
  - "test-rls.ts Phase 5 extension: 38 cross-user assertions (was 29)"
  - "F13 manual brutal-test recipe (244 LOC, 10 phases, sign-off block)"
affects: [06-history-charts, 07-polish-f12-notes-dark-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global presence banner with route-conditional hide (segments.some)"
    - "TanStack-query value-transition watcher for one-shot toast (no Zustand store)"
    - "useFocusEffect cleanup → reset overlay-dismissed state on re-focus (Pitfall 5)"
    - "Force-decision UX for data-loss-adjacent states (backdrop does NOT dismiss)"
    - "test-rls.ts extension pattern: new mutation-payload-shape assertions + defense-in-depth admin SELECT + rogue-insert count check"
    - "Manual UAT recipe pattern: pre-flight automated gates + 10 phases + failure-mode matrix + sign-off block"

key-files:
  created:
    - app/components/active-session-banner.tsx (Task 1, Wave A)
    - app/scripts/manual-test-phase-05-f13-brutal.md
  modified:
    - app/app/(app)/(tabs)/_layout.tsx (Task 1, Wave A — banner mount slot)
    - app/app/(app)/(tabs)/index.tsx (Task 2 — draft-resume overlay + toast)
    - app/scripts/test-rls.ts (Task 3 — Phase 5 extension)

key-decisions:
  - "Toast trigger: TanStack-query value-transition watcher via useRef previous-value pattern. Avoids Zustand pending-mutations store (CONTEXT.md D-25 — explicitly forbidden) and router-param hand-off (brittle)."
  - "Toast visibility window: setTimeout(2000) in useEffect; NOT FadeOut.delay(2000). The latter defers the START of the unmount fade, not the visible duration (must_haves line 48)."
  - "Draft-resume secondary button is destructive-red (UI-SPEC §line 248) — distinct from workout-screen Avsluta which is accent-blue. Rationale: orphan-disposal is data-loss-adjacent."
  - "Backdrop is decoratively pressable (absorbs taps) but does NOT call setDraftDismissed (force-decision UX, UI-SPEC §line 250)."
  - "useFinishSession scope fallback: `?? \"noop\"` when activeSession is undefined satisfies the STATIC-string contract (Pitfall 3) without queueing anything (handleAvslutaSession guards before .mutate())."
  - "test-rls.ts Phase 5 extension restates the new MUTATION PAYLOAD SHAPES (started_at, finished_at, completed_at, set_type, weight_kg) rather than just the columns; the Phase 2 block covers generic shapes."

patterns-established:
  - "useFocusEffect cleanup → reset dismissed state pattern, mirrors plans/[id].tsx lines 168-173"
  - "Reanimated 4 entering=FadeIn + exiting=FadeOut + external setTimeout for visible-duration gating"
  - "test-rls.ts Phase N extension shape: new-payload-shape assertWriteBlocked + admin defense-in-depth + rogue-row count check"

requirements-completed: [F5, F8, F13]

# Metrics
duration: ~85min (cumulative across two executor agents)
completed: 2026-05-13
status: "checkpoint:human-verify pending — Task 5 awaits physical-device UAT"
---

# Phase 5 Plan 03: Banner + Draft-Recovery + F13 Brutal-Test Summary

**ActiveSessionBanner across (tabs), draft-resume overlay on (tabs)/index, "Passet sparat ✓" Reanimated toast, test-rls.ts cross-user assertions for the new Phase 5 mutation payload shapes (38 total, was 29), and the 244-LOC F13 brutal-test recipe — automated gates green; physical-device UAT awaits.**

## Performance

- **Duration:** ~85 min cumulative (Wave-A executor agent: Task 1 + type-fix; this agent: Tasks 2/3/4)
- **Started:** Wave-A agent landed Task 1 at commit `4e1f528`; this agent resumed from `0138229`
- **Completed:** 2026-05-13T18:30:39Z (Tasks 2/3/4 — checkpoint reached on Task 5)
- **Tasks:** 4 of 5 (Task 5 is `checkpoint:human-verify` — awaits user UAT on physical iPhone)
- **Files modified:** 4 (+ 1 created)

## Accomplishments

- **ActiveSessionBanner (Wave-A — Task 1):** persistent info-blue banner across all (tabs) when `useActiveSessionQuery` returns non-null AND user is NOT inside `/workout/[sessionId]` (segments-check); tap routes to `/workout/<id>`; no close affordance (UI-SPEC §line 287). Color follows Phase 4 commit cfc1dc8 convention (bg-blue-100 / dark:bg-blue-950 with border-blue-300 / dark:border-blue-800 + text-blue-900 / dark:text-blue-100). Mounted in `(tabs)/_layout.tsx` between OfflineBanner and Tabs.
- **Draft-resume overlay (Task 2):** cold-start recovery prompt on `(tabs)/index.tsx`. Title `Återuppta passet?`, body switches between 0-set and N-set copy via `date-fns format(startedAt, 'HH:mm')` and `useSetsForSessionQuery().data?.length`. Primary `Återuppta` (accent-blue) routes to workout screen; secondary `Avsluta sessionen` (destructive-red) calls `useFinishSession.mutate({ id, finished_at: now() })`. Backdrop does NOT dismiss (force-decision UX). `useFocusEffect` cleanup resets `draftDismissed` so overlay re-appears on re-focus (Pitfall 5).
- **"Passet sparat ✓" toast (Task 2):** Reanimated 4 `Animated.View` with `entering={FadeIn.duration(200)}` + `exiting={FadeOut.duration(200)}`. Triggered by `useEffect`-watching-`useActiveSessionQuery` value transition from non-null → null (the only signal the Avsluta-flow completed — from EITHER `(tabs)/index` secondary button OR `/workout/[sessionId]` Avsluta-overlay). 2-second visible window via `setTimeout(2000)` in the same `useEffect` — NOT `FadeOut.delay(2000)`, which would defer the start of the unmount fade rather than the visible duration (must_haves line 48).
- **test-rls.ts Phase 5 extension (Task 3):** appended a `Phase 5 extension:` block with 5 new cross-user write attempts targeting the EXACT mutation payload shapes Phase 5 introduces (`finished_at` UPDATE, `started_at`+`plan_id`+client-UUID INSERT, `notes` UPDATE for T-05-15, `completed_at`+`set_type` INSERT, `weight_kg` UPDATE) plus 3 defense-in-depth admin SELECT assertions. Assertion count grew from 29 to 38 (≥ 35 done-criterion). Closes CLAUDE.md "Cross-user verification is a gate" for Phase 5; covers T-05-01 / T-05-02 / T-05-03 / T-05-15.
- **F13 brutal-test recipe (Task 4):** `app/scripts/manual-test-phase-05-f13-brutal.md` (244 LOC). 10 phases verbatim from `05-RESEARCH.md` lines 912–1027 per PATTERNS.md (single-source-of-truth — future updates land in one place). Pre-flight enumerates 11 npm test scripts + tsc + lint + service-role audit grep. Pass criteria, failure-mode matrix (7 symptom → root-cause rows), optional sub-scenarios, sign-off block with tester/date/commit/SESSION_ID slots.

## Task Commits

Tasks committed atomically:

1. **Task 1 (Wave-A executor):** `4e1f528` (feat) — ActiveSessionBanner + (tabs)/_layout mount
   - Type-fix follow-up: `0138229` (fix) — widen `segments.some` comparison to string (segments union doesn't include "workout" at the (tabs) scope; runtime check is correct)
2. **Task 2:** `1212baf` (feat) — draft-resume overlay + Passet sparat toast on (tabs)/index
3. **Task 3:** `acd7658` (test) — test-rls.ts Phase 5 extension
4. **Task 4:** `6800ccc` (docs) — F13 brutal-test manual UAT recipe
5. **Task 5:** PENDING — `checkpoint:human-verify` (blocking gate; awaits user UAT on physical iPhone)

**Plan metadata commit:** appended after SUMMARY.md is committed (see final commit).

## Files Created/Modified

- `app/components/active-session-banner.tsx` (created, Wave-A) — info-blue persistent banner with `useActiveSessionQuery` subscriber + route-conditional hide.
- `app/app/(app)/(tabs)/_layout.tsx` (modified, Wave-A) — `<ActiveSessionBanner />` mounted between `<OfflineBanner />` and `<Tabs>`.
- `app/app/(app)/(tabs)/index.tsx` (modified, Task 2) — Phase 4 Planer list extended with draft-resume overlay JSX + Reanimated toast + useFocusEffect cleanup + useFinishSession binding.
- `app/scripts/test-rls.ts` (modified, Task 3) — appended Phase 5 extension block (lines 605–778); added `import { randomUUID } from "node:crypto"` (already-established convention in `test-upsert-idempotency.ts`, `test-sync-ordering.ts`).
- `app/scripts/manual-test-phase-05-f13-brutal.md` (created, Task 4) — 244-LOC manual UAT checklist.

## Decisions Made

See `key-decisions` frontmatter. The most consequential:

1. **Toast trigger pattern (must_haves line 48 ratified):** TanStack-query value-transition watcher with `useRef` previous-value capture. Cleaner than the alternatives (Zustand pending-mutations store is forbidden by CONTEXT.md D-25; router-param hand-off is brittle). The optimistic onMutate in `setMutationDefaults['session','finish']` (Plan 01) clears `sessionsKeys.active()` immediately, which propagates through `useActiveSessionQuery` instantly — a clean edge to detect.

2. **`FadeOut.duration(200)` + external `setTimeout(2000)` (NOT `FadeOut.delay(2000)`):** `delay` defers the START of the fade-out animation, not the visible duration before the fade starts. Pattern: `setShowToast(true)` → render with `FadeIn` → after 2000ms via setTimeout → `setShowToast(false)` → Reanimated fires `FadeOut.duration(200)`. Total visible window ≈ 2200ms.

3. **`useFinishSession(activeSession?.id ?? "noop")` fallback:** Satisfies the STATIC-string scope contract (Pitfall 3) at every render even when `activeSession` is undefined. The `handleAvslutaSession` guards before calling `.mutate()`, so the noop scope never queues anything.

4. **test-rls.ts extension shape:** Restates the Phase 5 MUTATION PAYLOAD SHAPES (with `started_at`, `finished_at`, `completed_at`, `set_type`, `weight_kg`) rather than just the columns. The Phase 2 block already covers generic shapes; this catches a hypothetical regression where a policy is tightened to only check certain payload patterns. Plus admin defense-in-depth SELECT + rogue-row count check to catch the false-pass where RLS empty-filters the `.select()` suffix.

## Deviations from Plan

None — plan executed exactly as written for Tasks 2/3/4.

The Wave-A executor agent crashed mid-flight on Task 1 with an API Internal Server Error, but the Task 1 commit landed cleanly before the crash. A small type-fix follow-up (`0138229`) was needed because `segments` returns a typed-route literal union for the (tabs) scope that does NOT include `"workout"` (which lives at the (app) layer). The fix widens the comparison via `(segments as readonly string[]).some(s => s === "workout")` — runtime semantics unchanged. This is documented in `app/components/active-session-banner.tsx` lines 47–48.

No Rule 1/2/3 auto-fixes occurred during Tasks 2/3/4. No Rule 4 architectural questions arose.

## Issues Encountered

- **`node_modules` missing in worktree at agent startup:** Ran `npm install` (~2 min) before tsc/lint/test:rls would resolve. This is expected for fresh worktree checkouts; the install only needs to run once per worktree.
- **`.env.local` missing in worktree at agent startup:** Copied from the main repo (`C:/Users/Mahod/Desktop/Projects/FitnessMaxxing/app/.env.local`) to enable `npm run test:rls` (which requires `SUPABASE_SERVICE_ROLE_KEY`). The file is gitignored so it doesn't ride with the worktree commit.

Both issues are environment-setup artifacts; neither affects the shipped code.

## Threat Flags

None — Tasks 2/3/4 introduce no surfaces outside the threat register. The Plan 03 frontmatter `threat_model` enumerates T-05-01, T-05-02, T-05-03, T-05-09, T-05-10, T-05-13, T-05-15, T-05-16; all dispositions hold:

- T-05-01 (exercise_sets parent-FK cross-user INSERT): mitigated — Task 3 asserts.
- T-05-02 (workout_sessions cross-user INSERT with B's user_id): mitigated — Task 3 asserts.
- T-05-03 (exercise_sets cross-user SELECT): already mitigated in Phase 2 block; Task 3 keeps coverage.
- T-05-09 (AsyncStorage plaintext for sets queue): accepted — weight_kg + reps are NOT PII per V1 threat model.
- T-05-10 (service-role-key isolation): mitigated — `app/scripts/test-rls.ts` is on the CLAUDE.md allowlist; service-role grep audit gate confirmed empty outside the allowlist.
- T-05-13 (force-quit-within-throttle window): mitigated by Plan 01's throttleTime: 500 + AppState flush; **Task 5 UAT is the existential validation gate.**
- T-05-15 (cross-user disclosure via notes): mitigated — Task 3 asserts.
- T-05-16 (draft-resume Avsluta misclick): accepted — destructive-red styling + force-decision-no-backdrop-dismiss UX; recoverable because the session row + sets remain visible in Historik (Phase 6).

## Known Stubs

None — no hardcoded empty values, no "TODO" placeholders, no components with stub data sources. All UI surfaces wire to real queries (`useActiveSessionQuery`, `useSetsForSessionQuery`, `useFinishSession`).

## Automated gate status (precondition for Task 5)

All gates GREEN as of `6800ccc`:

- `cd app && npx tsc --noEmit` → exit 0
- `cd app && npx expo lint` → exit 0
- `cd app && npm run test:rls` → ALL ASSERTIONS PASSED (38 PASS, 0 FAIL)
- `git grep "service_role|SERVICE_ROLE" -- "*.ts" "*.tsx" "*.js" "*.jsx" ":!.planning/" ":!app/scripts/" ":!app/.env.example" ":!CLAUDE.md"` → empty

The remaining `npm run test:offline-queue / test:sync-ordering / test:upsert-idempotency / test:reorder-constraint / test:session-schemas / test:set-schemas / test:last-value-query / test:plan-schemas / test:exercise-schemas / test:plan-exercise-schemas` scripts ship as part of Plan 01 / Plan 02 / Phase 4. The brutal-test recipe (Task 4) lists them in its pre-flight; the user should run them ALL before opening Expo Go for the iPhone UAT.

## TDD Gate Compliance

This plan declared `type: execute` (not `type: tdd`). Tasks 1–3 carry `tdd="true"` in their task-level frontmatter for behavior-test alignment with the must_haves contract, but the canonical RED-then-GREEN gate sequence is not strictly applicable at the plan level for execute-type plans. All assertions in `test-rls.ts` were added in the same commit as the behavior they assert (Task 3), and the UI-behavior contract for Tasks 1/2 is verified by tsc + lint + manual UAT (Task 5).

## Task 5 — Pending checkpoint

Task 5 is `type="checkpoint:human-verify"` with `gate="blocking"`. It cannot be self-completed by an executor agent because the F13 brutal-test exercises iOS-specific lifecycle (airplane mode, force-quit via app switcher, OS-level RAM reclamation) that no test runner can simulate.

**Resume signal expected from user:**
- `approved` if all 25 sets land in Supabase with correct ordering and no FK/dupes after running `app/scripts/manual-test-phase-05-f13-brutal.md` on a physical iPhone, OR
- a detailed failure report (which step, what Studio showed, any console errors) if the brutal-test fails. The failure-mode matrix in the brutal-test recipe maps each anomaly to a specific code surface to investigate.

If a color amendment to `ActiveSessionBanner` is needed (Phase 4 commit cfc1dc8 precedent: `bg-blue-100` → `bg-blue-200`, `border-blue-300` → `border-blue-400`), the user notes it in the sign-off block; a follow-up commit can land the amendment without re-opening the whole plan.

## Next Phase Readiness

When Task 5 passes:
- F5 + F6 + F7 + F8 + F13 all closed end-to-end.
- ROADMAP Phase 5 success criteria 1–5 already MET via Plans 01 + 02 + 03 Tasks 1–4; criterion #6 (F13 brutal-test) closes on Task 5 approval.
- Advance to `/gsd-secure-phase 5` (audits T-05-* threat register against implementation; writes `05-SECURITY.md` with `threats_open: 0`).
- Then `/gsd-verify-work 5` (writes `05-VERIFICATION.md` with all 6 success criteria marked MET).
- Then `phase.complete`.

## Self-Check: PASSED

All claimed files exist on disk; all claimed commits exist in git history.

| Asset | Status |
|---|---|
| `app/components/active-session-banner.tsx` | FOUND |
| `app/app/(app)/(tabs)/_layout.tsx` | FOUND |
| `app/app/(app)/(tabs)/index.tsx` | FOUND |
| `app/scripts/test-rls.ts` | FOUND |
| `app/scripts/manual-test-phase-05-f13-brutal.md` | FOUND |
| `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-03-SUMMARY.md` | FOUND |
| commit `4e1f528` (Task 1 feat) | FOUND |
| commit `0138229` (Task 1 type-fix follow-up) | FOUND |
| commit `1212baf` (Task 2) | FOUND |
| commit `acd7658` (Task 3) | FOUND |
| commit `6800ccc` (Task 4) | FOUND |

---
*Phase: 05-active-workout-hot-path-f13-lives-or-dies*
*Plan: 03*
*Status: Tasks 1–4 complete; Task 5 awaits physical-device UAT*
*Completed: 2026-05-13 (Tasks 1–4)*
