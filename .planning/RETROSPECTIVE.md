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

## Milestone: v2.0 — Forge Redesign

**Shipped:** 2026-06-17
**Phases:** 8 (8-15) | **Plans:** 41 | **Tasks:** ~70 | **Commits:** 338 (9 days, 2026-06-09 → 2026-06-17)

### What Was Built

- A full UI rewrite to the "Forge" design system (premium, Apple-Fitness DNA, dark/light parity, orange accent) across every screen + the 3 session overlays, on `tailwind.config.js` tokens via the `forge-<token>-light` base + `dark:` sibling pattern.
- Self-hosted type system (Inter Display + Inter + JetBrains Mono) via expo-font with a splash gate; static→animated Skia ProgressRing + Sparkline (no new charting dependency); a Forge component library (Button/Field/Card/Stat/Chip/SettingsRow).
- A new Settings screen + preference layer: units (kg/lbs, canonical-kg storage + display conversion), weekly goal (`profiles.weekly_goal`), language, haptics/notifications toggles, theme; live language switching (no restart) via a three-state resolver.
- A Home activity-ring dashboard (sessions-this-week vs goal, streak, weekly volume + delta, sparkline) backed by RLS-scoped SECURITY-INVOKER read-side RPCs (migrations 0011/0012); animated ring fill + chart draw-on-mount.
- Offline-safe PR celebration: client-side Epley e1RM (`app/lib/e1rm.ts`), in-workout trophy + gradient-sweep banner, read-side PR surfacing; PR-at-log-time flagged via a strictly-prior SQL window frame. No persisted `is_pr` column.
- A rest timer that survives backgrounding by re-deriving from a stored `endTs` + a DATE-trigger local notification; fail-soft notifications wrapper + Zustand store with cancel-before-reschedule on every transition.
- Complete bilingual sv/en with a CI i18n-coverage gate (`check-i18n-coverage.ts`) + `__DEV__` missing-key handler → zero missing keys; a release-candidate device UAT across 12 screens × 4 language/theme combos, approved on real iPhone hardware.

### What Worked

- **Infrastructure-first sequencing.** Building tokens + fonts + i18n scaffold + component library in Phase 8 before touching any screen meant Phases 9–15 inherited dark-mode, locale, and components for free. Zero per-screen design-system rework.
- **F13 brutal-test as an unbroken regression gate through a UI rewrite.** Every re-skin phase (esp. the high-risk Phase 11 active-workout re-skin) ran `npm run test:f13-brutal` as a BLOCKING gate. The "never lose a set" guarantee survived a full UI rewrite untouched.
- **Inline-overlay UX carried from v1.0.** Reusing the "no Modal portals" pattern for finish/draft-resume/saved-toast/PR-banner/rest-banner kept the hot-path write surface and gesture/freezeOnBlur behavior coherent through five new overlays.
- **Pure-module + reactive-store discipline.** Pure Node-importable cores (`e1rm.ts`, `rest-timer.ts`, `resolve-language.ts`) gave DB-free unit tests; reactive Zustand stores (`units-store`, `rest-timer-store`, no persist) made live cross-screen pref changes work without restart.
- **Device UAT caught real regressions.** Phase 12's three gap-closure plans (FIT-109 stale ring, FIT-110 dropped chart cross-link, FIT-111 non-reactive units) and Phase 13's FIT-116 (ephemeral PR trophies) were all device-UAT discoveries, not code-review/verifier findings.

### What Was Inefficient

- **The NativeWind box-decoration-via-className gotcha cost two separate bugs.** Phase 10's "naked re-skin" (Pressable box styling in a `style()` callback renders naked under NativeWind 4) and Phase 15's rest-banner two-line wrap (FIT-128) share the exact same root cause. It was learned twice before becoming a documented rule. Should have been a plan-time PATTERNS landmine after the first occurrence.
- **REQUIREMENTS.md traceability drifted again.** SKIN-01 + SET-01..09 sat at "Pending" the entire milestone despite shipping in Phase 9; the table was last touched at initial definition (2026-06-09) and corrected only at archive. Same class of bug flagged in the v1.0 retro — the `phase.complete` auto-flip improvement still isn't in place.
- **Verification/UAT file statuses never flipped after the Phase 15 RC sweep.** The Phase 15 release-candidate device UAT (12×4 combos) functionally subsumed the `human_needed` device checks in 09/11/13/14, but those per-file statuses stayed `human_needed` — surfacing as 6 "open" artifacts at milestone close that had to be acknowledged-and-deferred. A closing sweep should reconcile subsumed per-phase verification files.
- **No second physical-iPhone pass for Phase 14.** TIMER-03 background-ping / tap-route / single-push checks (8 scenarios in `14-UAT.md`) were deferred for lack of a device session; covered functionally by the fail-soft design + the Phase 15 sweep, but left as formal debt.

### Patterns Established

- **Token-driven dark/light parity** (`forge-<token>-light` base + `dark:` sibling `forge-<token>` DEFAULT) — every screen inherits dark-mode without per-screen logic.
- **NativeWind box-decoration MUST live in `className`** — `style()` is for shadow/opacity only; NativeWind 4 drops box props (bg/border/radius/size) on Pressable.
- **Reactive Zustand store (no persist) for live cross-screen prefs** — `units-store` / `rest-timer-store`; a Settings change re-renders all consumers immediately.
- **Offline-safe derived features compute from local/persisted state + absolute timestamps** — never from network or JS intervals (PR detection; rest countdown).
- **RLS-scoped SECURITY-INVOKER read-side RPCs** with `search_path=''`, finished-only, `set_type='working'` for all dashboard/chart/PR aggregates; no cross-user aggregation.

### Key Lessons

1. **Infrastructure-first is the right shape for a re-skin.** One foundation phase amortized across seven later phases beat re-deriving tokens/i18n/components per screen.
2. **A strong regression gate lets you rewrite the UI fearlessly.** F13 brutal-test green-before-every-phase made the high-risk active-workout re-skin a non-event.
3. **A learned gotcha must become a plan-time landmine immediately, or it recurs.** The NativeWind className rule cost two bugs because it wasn't promoted to a pre-flight check after the first.
4. **Stale doc/verification state is still a class of bug.** Two milestones running, the same drift (requirements checkboxes + verification statuses) needed manual reconciliation at close. The `phase.complete` auto-flip is overdue.
5. **Device UAT remains irreplaceable** — every meaningful v2.0 regression was a device finding, not an automated-gate finding.

### Cost Observations

- Model mix: planning + execution predominantly Opus (config `model_profile: "quality"`, `executor_model`/`planner_model: "opus"`).
- Sessions: ~1+ GSD session per phase (8 phases; data-heavy Phase 12 spanned multiple sessions incl. 3 gap-closure plans).
- Notable: the 11-plan Phase 12 (read-side + dashboard + 3 UAT gap-closures) was the milestone's center of mass; the foundation phase (8) front-loaded cost that paid back across all later phases.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Plans | Key Change |
|-----------|----------|--------|-------|------------|
| v1.0      | ~7       | 7      | 33    | Initial GSD adoption + per-phase HUMAN-UAT for UI-heavy phases + FIFO scope contract established |
| v2.0      | ~10+     | 8      | 41    | Infrastructure-first re-skin; token-driven dark/light parity; reactive Zustand stores; CI i18n-coverage gate; F13 gate held through a full UI rewrite |

### Cumulative Quality

| Milestone | STRIDE threats SECURED | RLS assertions | F13 brutal-test status | Linear bugs at close |
|-----------|------------------------|----------------|------------------------|----------------------|
| v1.0      | 79 (across phases 2–7) | 30+ (extends every user-scoped-table phase) | green every phase | 0 (FIT-6 + FIT-5 closed in close-out) |
| v2.0      | per-phase threats_open: 0 (3 new migrations 0010/0011/0012, all RLS-paired) | extended for weekly_goal + seed_key + dashboard/PR RPCs (cross-user) | green every phase; amber at close on FIT-107 fixture precondition only (not a regression) | 0 open bugs; 6 deferred verification/UAT artifacts acknowledged (device-observation, RC-sweep-subsumed) |

### Top Lessons (Verified Across Milestones)

1. **Stale doc/verification state is a recurring class of bug.** Both v1.0 and v2.0 needed manual reconciliation of requirements checkboxes (and, in v2.0, per-phase verification statuses) at close. The `phase.complete` auto-flip improvement is now twice-justified.
2. **Device/HUMAN-UAT catches what automated gates miss — every milestone.** v1.0's keyboard-blocking bug and v2.0's FIT-109/110/111/116 were all device findings, not code-review/verifier/tsc findings.
3. **A strong always-green regression gate (F13 brutal-test) compounds in value.** It protected the offline-write path across both an MVP build (v1.0) and a full UI rewrite (v2.0) with zero regressions to the guarantee.
4. **Locked stack pins with rationale keep paying off** — v2.0 added react-i18next / expo-notifications / react-native-svg without disturbing the NativeWind-4↔Tailwind-3 / Skia-2↔React-19 pin web.
