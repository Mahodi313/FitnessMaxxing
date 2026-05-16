# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-05-16
**Phases:** 7 | **Plans:** 33 | **Tasks:** 80 | **Commits:** 413 (9 days)

### What Was Built

- A personal iOS gym tracker (Expo Go on iPhone) that lets the user create training plans, log sets during a workout, and immediately see the last value on the same exercise. ≤3s/set verified by F13 brutal-test; never loses a set through airplane mode + force-quit + battery-pull.
- Full offline-first architecture: TanStack Query 5 mutation queue with `resumePausedMutations` on reconnect, FIFO `scope.id` per resource (`session:${id}` / `plan:${id}`) for serial replay across chained offline edits, client-generated UUIDs for FK-safe ordering.
- Complete read-side: paginated workout history list, per-session detail view with set-rows + RPE suffix + notes block, per-exercise progression chart (max-weight + total-volume) via Victory Native XL on Skia 2.
- Polish: F11 inline RPE input, F12 session notes (capture + view+edit with FIFO offline-replay), F15 3-mode theme toggle (System/Ljust/Mörkt) with AsyncStorage persistence + ThemeBootstrap mounted before SplashScreenController to prevent FOUC.
- Discipline-grade infra: 6-table Postgres schema with errata-fixed RLS deployed to Supabase remote, 79 STRIDE threats verified across phases 2–7, cross-user RLS regression test extended every phase that touches user-scoped tables, F13 brutal-test as ongoing regression gate, per-phase HUMAN-UAT.md on real iPhone for UI-heavy phases.

### What Worked

- **GSD per-phase loop with verifier + secure-phase + UAT gates.** Discuss → plan → execute → code-review → secure-phase → verify-work → HUMAN-UAT (UI phases only). No phase advanced until verification passed and `threats_open: 0`. Caught regressions cheaply (FIT-7 dedupe issue surfaced at Phase 5 HUMAN-UAT before being inherited by Phase 6).
- **Plan-time threat modeling.** Every PLAN.md included a `<threat_model>` block with STRIDE register + mitigation pattern. Phase 7 secure-phase short-circuited (threats_open: 0 + register_authored_at_plan_time: true) → no auditor agent needed. Saved several hours per phase.
- **F13 brutal-test as regression gate.** Phase 5 wrote `npm run test:f13-brutal` to verify "a logged set must never be lost"; subsequent phases ran it as a pre-flight gate. Caught zero post-Phase-5 regressions because the gate was always green before each new phase started.
- **`scope.id` FIFO contract.** Same pattern (`session:${id}` shared across `useFinishSession` / `useDeleteSession` / `useUpdateSessionNotes`; `plan:${id}` shared across `useUpdatePlan` / `useArchivePlan` / `useRemovePlanExercise` / `useReorderPlanExercises`) made T-07-03 + comparable plan-side races impossible-by-construction. One pattern, three resource families, zero orphan-row defects in UAT.
- **Locked stack with explicit pin rationale (CLAUDE.md TL;DR).** Knowing exactly why each pin existed (NativeWind 4 needs Tailwind 3, Skia 2 needs React 19, expo-secure-store has 2048-byte limit so LargeSecureStore wraps it with AES) prevented several "let's just upgrade and see" detours.
- **HUMAN-UAT.md scripts on real iPhone for UI-heavy phases.** Phase 4 UAT caught the mutate-vs-mutateAsync offline freeze; Phase 5 UAT caught FIT-7 through FIT-13 (5 separate gap-closure plans); Phase 7 UAT caught the iOS keyboard-blocking AvslutaOverlay regression in real time. None of these would have been caught by tsc/lint/RLS gates alone.
- **Per-phase Linear sub-issue mirroring + auto-tagged commits.** `[FIT-NN]` in every commit + auto-PR per phase-branch + Linear auto-close on PR-merge meant the issue tracker stayed in sync with no manual work. 33 plan sub-issues + 7 epics auto-closed across v1.0.

### What Was Inefficient

- **UAT-discovered keyboard-avoidance bug took 3 hotfix iterations.** Phase 7 UAT caught that `KeyboardAvoidingView` doesn't lift cards inside absolute-positioned backdrops on iOS 26. Iter-1 (`flex-end` + `paddingBottom: 32`) was insufficient; iter-2 (`Keyboard.addListener` measurement) lifted but slammed the card to the bottom when keyboard was closed; iter-3 (conditional `justifyContent` based on `keyboardHeight`) was the right shape. Plan-time research could have surfaced this — KAV's flakiness with absolute backdrops is a well-known RN gotcha.
- **REQUIREMENTS.md and ROADMAP.md checkbox state drifted from disk reality.** At v1.0 close, F1, F9, F10, F11, F12, F15 were marked `[ ]` despite being shipped. Phase 6 ROADMAP checkbox was `[ ]` despite being complete. Pre-close audit caught all 6 stale flags. Future: incorporate per-phase checkbox flips into the `phase.complete` SDK call instead of relying on manual updates.
- **Audit-open script flagged some artifacts as "open" that were actually fully resolved** (FIT-5 debug session, stale quick-task `260509-001-phase3-ui-fixes`). Each required a small chore commit at milestone close (`status: fix_applied → resolved`, file moved to `resolved/`, etc.). Future: when finishing a phase, also mark associated debug + quick artifacts in the same commit.
- **Worktree mode produced flaky merge behavior on Windows.** Phase 7 execute-phase orchestrator used `Agent(isolation="worktree")` for each plan; for waves 1+4 the commits auto-merged to the phase branch, for waves 2+3 they remained dangling and required manual `git merge --ff-only <hash>` after `git checkout --` on leaked files. Saved memory: `feedback_worktree_leaks.md` documents the pattern. Future: either fix the worktree-merge consistency or drop worktree isolation on Windows.
- **CLAUDE.md service-role-audit allowlist was strict to the letter and broader in practice.** Phase 7 secure-phase noted that `app/scripts/test-exercise-chart.ts`, `app/scripts/test-last-value-query.ts`, `app/scripts/manual-test-phase-06-uat.md`, and `app/README.md` all matched the audit grep but are Node-only (not Metro-bundled). The original CLAUDE.md allowlist was Phase-2-era and never updated as Phase 3–6 added new Node scripts. Documented as observation in 07-SECURITY.md; CLAUDE.md should be updated to allow `app/scripts/**/*.ts` and `app/README.md`.

### Patterns Established

- **`scope.id` FIFO mutation contract per resource** (used in `sessions.ts`, `plans.ts`, `plan-exercises.ts`). Canonical anti-orphan pattern for offline-first apps.
- **Inline-overlay UX (NOT Modal portals).** PATTERNS landmine #3. Every confirm/destructive/edit overlay renders inline inside its host screen so freezeOnBlur cleanup + gesture-handler integration stay coherent. Used in 5+ places by v1.0.
- **Direct iOS keyboard measurement with conditional centered/lifted layout.** When a multi-line `TextInput` lives inside an absolute-positioned backdrop:
  ```tsx
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", e => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);
  // Backdrop:
  justifyContent: keyboardHeight > 0 ? "flex-end" : "center",
  paddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : 0,
  ```
  Inner Pressable: `onPress={() => Keyboard.dismiss()}`. Used in AvslutaOverlay + EditNotesOverlay.
- **RHF v7 `values` + `resetOptions: { keepDirtyValues: true }` for cache-synced forms** (FIT-6 fix). Replaces the broken `defaultValues + useEffect-with-reset` pattern that overwrites in-progress user input on cache refetch.
- **Migration-as-truth + `verify-deploy.ts`.** No Studio editing; numbered SQL migrations only; post-push verification via direct `pg_catalog` introspection. Windows-without-Docker substitute for `supabase db diff`.
- **Per-phase HUMAN-UAT.md script for UI-heavy phases** with NON-OPTIONAL hardware-verify rows (e.g. Phase 7 §3.10 T-07-03 FIFO offline race — W-1 fix that prevents skipping the only step that exercises the production-critical path).

### Key Lessons

1. **Plan-time threat modeling pays compound interest.** Every phase that authored a `<threat_model>` block at plan-time enabled the `secure-phase` short-circuit at close-time. Phase 7 dispositioned 20 threats with zero auditor-agent invocations.
2. **HUMAN-UAT scripts catch real-hardware regressions that no automated gate sees.** The Phase 7 keyboard-blocking bug was a UAT-discovery, not a code-review or verifier finding. Without the script, it would have shipped to soak.
3. **`scope.id` FIFO is the right primitive for offline-first chained mutations.** Used three times across v1.0; saved every time. Don't try to design ordering at the application layer — let TanStack v5's `mutationCache` do it.
4. **Stale checkbox state is a class of bug, not a one-off.** REQUIREMENTS.md, ROADMAP.md, debug/, and quick/ all drifted at v1.0 close. Worth investing in `phase.complete` SDK improvements that auto-flip these.
5. **Locked stack pins with rationale > "let's see what's new".** Knowing exactly why every pin exists (NativeWind 4 ↔ Tailwind 3 hard peer; Skia 2 ↔ React 19 hard requirement; expo-secure-store 2048-byte limit ↔ LargeSecureStore wrapper) prevented several detours.
6. **Personal-use V1 is a real shipping mode.** Not every project needs App Store. Validating the core value with a single-user soak before deciding the App Store path is the right tradeoff for hobby projects + ones with strong privacy posture.

### Cost Observations

- Model mix: predominantly Opus 4.7 for planning + Sonnet for execution (per `.planning/config.json` `executor_model: "sonnet"`, `verifier_model: "sonnet"`).
- Sessions: ~1 GSD session per phase (7 sessions for v1.0; some phases broke into multiple sessions when UAT surfaced gaps requiring follow-up plans).
- Notable: per-phase `discuss → plan → execute → review → secure → verify → UAT` loop is denser than expected (~3-5 hours per phase wall-clock for the AI side; equal or more for human UAT on UI-heavy phases). The investment paid off in zero post-phase regressions to the database layer or offline-queue invariants.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Plans | Key Change |
|-----------|----------|--------|-------|------------|
| v1.0      | ~7       | 7      | 33    | Initial GSD adoption + per-phase HUMAN-UAT for UI-heavy phases + FIFO scope contract established |

### Cumulative Quality

| Milestone | STRIDE threats SECURED | RLS assertions | F13 brutal-test status | Linear bugs at close |
|-----------|------------------------|----------------|------------------------|----------------------|
| v1.0      | 79 (across phases 2–7) | 30+ (extends every user-scoped-table phase) | green every phase | 0 (FIT-6 + FIT-5 closed in close-out) |

### Top Lessons (Verified Across Milestones)

1. *(Pending V1.1 to verify cross-milestone)* — initial v1.0 lessons captured above; will be verified when V1.1 ships.
