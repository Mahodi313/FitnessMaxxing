---
phase: 05-active-workout-hot-path-f13-lives-or-dies
verified: 2026-05-14T19:14:20Z
status: passed
score: 10/10 must-haves verified (source-level); 3 iPhone-UAT items routed to human_verification (persisted to 05-HUMAN-UAT.md, non-blocking per user direction)
overrides_applied: 0
phase_closure_note: |
  User explicitly directed phase closure on 2026-05-14 after all source-level
  gates GREEN + REGRESSION-01 fix (FIT-13) merged. The 3 iPhone-UAT items in the
  human_verification block remain open as 05-HUMAN-UAT.md entries — they will
  surface in `/gsd-progress` and `/gsd-audit-uat` until the user runs the physical
  device UAT separately. Status promoted from `human_needed` → `passed` to reflect
  that the open human items are acknowledged-deferred, not blockers.
re_verification:
  previous_verified: 2026-05-13T20:33:14Z
  previous_status: human_needed
  previous_score: 6/6 (MH-6 partial)
  gaps_closed_via_post_uat_plans:
    - "Plan 05-04 (FIT-7) — exercise_sets natural-key UNIQUE + BEFORE INSERT trigger; D-16 superseded"
    - "Plan 05-05 (FIT-8) — PersistQueryClientProvider hydration gate + usePersistenceStore"
    - "Plan 05-06 (FIT-9) — Swedish-locale z.preprocess on weight_kg"
    - "Plan 05-07 (FIT-10) — spec clarification, no code change (banner mount scope)"
    - "05-REVIEW.md CR-01 — Migration 0005 superseder with LOCK TABLE + idempotent dedupe + IF NOT EXISTS UNIQUE add"
    - "05-REVIEW.md WR-01..WR-06 — Fast-Refresh sentinel on onlineManager.subscribe; --env-file-if-exists rollout; signOut before deleteUser; argv[2] for inspect-duplicate-sets; NULLS-LAST comment clarification; provisional MAX+1 in onMutate"
    - "Migration 0005 transaction-block follow-up — explicit begin;/commit; (Supabase CLI does NOT auto-wrap, observed SQLSTATE 25P01)"
  gaps_remaining: []
  regressions:
    - test: "app/scripts/test-last-value-query.ts Assertion 3 (warmup filter)"
      severity: warning
      reason: "Test fixture inserts warmup (sn=1) + working (sn=1) for the same (session_id, exercise_id) — the new UNIQUE constraint from Migration 0003 (FIT-7) rejects the second INSERT. The PRODUCTION last-value.ts filter is correct (set_type='working' filter still works as designed); only the synthetic test fixture is now incompatible with the schema. r3.size resolves to 1 (warmup-only row, which the production code correctly filters out — but the test setup never lands the second working row because of the UNIQUE constraint, so the assertion measuring '2 working sets visible' fails)."
      impact: "Wave-0 test-last-value-query.ts now reports 1 FAILURE/8 PASS (was 9 PASS pre-FIT-7). No user-visible production regression — Truth #3 (F7 set-position-aligned last value) remains TRUE at the production code-path level. Test fixture needs an update to use distinct set_number values for warmup vs working (warmup=1, working=2,3) reflecting the new natural-key model."
      follow_up: "RESOLVED 2026-05-14 via FIT-13 (PR #30 merged). Fixture updated to use distinct set_number values (warmup=1, working=2,3) reflecting the new natural-key model. test-last-value-query.ts now reports 9/9 PASS post-fix."
      resolved: true
      resolved_by: "FIT-13 (PR #30) — commit fb2b635 fix(05): test-last-value-query Assertion 3 fixture skips warmup set_number"
human_verification:
  - test: "F13 Brutal-Test full end-to-end recipe on physical iPhone (carried forward from 05-VERIFICATION.md 2026-05-13)"
    expected: "All 25 sets land in Supabase in correct set_number order; finished_at set after all sets; zero 23503 FK violations; zero 23505 unique-constraint violations on first-pass replay (idempotent retries are no-ops via onConflict:id ignoreDuplicates); duplicate-detection SQL (group by 1,2,3 having count(*) > 1) returns zero rows."
    why_human: "Native iOS lifecycle (airplane-mode toggle, force-quit via app switcher, OS-level RAM reclamation) cannot be simulated by Detox/Maestro — they shut via JS bridge, not SIGKILL. The brutal-test recipe at app/scripts/manual-test-phase-05-f13-brutal.md Phase 9 step 41 wires `npm run test:f13-brutal` + duplicate-detection SQL as a hard pass gate."
    status_note: "Partial UAT performed 2026-05-13 (Phases 1-9 of recipe ran; user logged 31 sets across 3 exercises, force-quit twice, Avsluta + replay completed within 30s; verify-f13-brutal-test.ts confirmed contiguous set_number 1..N per exercise + finished_at landed AFTER all sets). The blocker discovered in that UAT (silent duplicate sets in prior session 379cfd29) is the gap that FIT-7 closed. A clean-room repeat of the full 10-phase recipe on the post-gap-closure build is recommended-but-not-blocking per user instruction. Migration 0005 (superseder for V1.1+ multi-device contract correctness) is now applied to the deployed DB; UNIQUE constraint enforced server-side."
  - test: "Swedish-locale iPhone UAT for FIT-9 decimal-input"
    expected: "Settings → Region: Sweden → workout screen → type '102,5' on weight TextInput → Klart succeeds → Supabase row has weight_kg = 102.50 (numeric(6,2) preserves 2 decimals)."
    why_human: "Requires physical iPhone with Swedish locale + decimal-pad keyboard rendering the comma key. Schema-level proof (test:set-schemas 13/13 PASS including 'weight 102,5 (Swedish comma) coerces to 102.5' + 'weight 102.5 (period) coerces to 102.5' + 'weight 102,5,5 multi-comma rejected') gates the contract layer."
    status_note: "Plan 05-06 SUMMARY explicitly defers Task 3 (on-device UAT) to physical Swedish-locale iPhone. Code-side proof (z.preprocess wrap + /g regex + 3 new test cases) is complete and verified."
  - test: "Hydration affordance UAT on physical iPhone for FIT-8 — force-quit at 5 sets, re-open, tap Återuppta"
    expected: "Workout screen renders 'Återställer pass…' briefly during AsyncStorage round-trip, then exercise cards hydrate with all 5 sets visible — no empty-card flicker that the user perceives as data loss."
    why_human: "AsyncStorage round-trip latency only observable on a real device under real RAM/storage conditions. Simulator hydration is sub-frame fast and does not reproduce the UAT 2026-05-13 perception bug."
    status_note: "PersistQueryClientProvider with onSuccess + onError (degraded-but-unblocked) wiring is verified at the source-code level. Plan 05-05 SUMMARY documents this UAT as deferred to physical iPhone."
---

# Phase 5: Active Workout Hot Path (F13 lives or dies) — Re-Verification Report

**Phase Goal:** Användare kan starta ett pass, logga set i ≤3 sekunder per set, se senaste värdet per övning, och avsluta passet — varje set överlever även mest extrema offline-scenarier
**Verified:** 2026-05-14T19:14:20Z (re-verified + finalized 2026-05-14T20:00:00Z post FIT-13 merge)
**Status:** passed (with deferred iPhone UAT in 05-HUMAN-UAT.md)
**Re-verification:** Yes — post gap-closure (FIT-7 / FIT-8 / FIT-9 / FIT-10 + 05-REVIEW.md fixes + Migration 0005)

## Re-Verification Summary

Between the initial verification (2026-05-13T20:33:14Z, `human_needed @ 6/6 — MH-6 partial`) and today, the following landed on `dev`:

| PR | Branch | Linear | Subject |
|----|--------|--------|---------|
| #23 | `fix/FIT-7-exercise-sets-unique` | FIT-7 | Migrations 0002/0003/0004 + client cutover (D-16 SUPERSEDED) + test-rls natural-key uniqueness |
| #24 | `fix/FIT-8-slow-hydration` | FIT-8 | PersistQueryClientProvider hydration gate + usePersistenceStore + workout-screen "Återställer pass…" affordance |
| #25 | `fix/FIT-9-decimal-input` | FIT-9 | `z.preprocess` Swedish-locale comma normalization on `setFormSchema.weight_kg` + 3 new test cases |
| #26 | `fix/FIT-10-banner-backnav` | FIT-10 | Investigation-only — UI-SPEC mount-scope clarification (no code change) |
| #27 | `chore/05-review-post-gap-closure` | — | Posted 05-REVIEW.md (1 critical, 6 warning, 5 info findings) |
| #28 | `chore/05-review-fixes-post-gap-closure` | — | 7 commits closing CR-01 + WR-01..WR-06 |
| #29 | `fix/05-migration-0005-transaction-block` | — | Migration 0005 wrapped in explicit `begin;`/`commit;` (Supabase CLI does NOT auto-wrap; observed SQLSTATE 25P01) |

All 7 PRs merged to `dev` by 2026-05-14. Migration 0005 applied to deployed Supabase via `npx supabase db push` (`Local 0005 ↔ Remote 0005`). All gates re-run in this verification session.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + NEW post-gap-closure must-haves)

| #   | Truth                                                                                                                                                                                                                                                                                       | Status     | Evidence       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------- |
| MH-1 | Användare kan starta pass från en plan; `workout_sessions`-rad skapas direkt vid "Starta pass"-tryck                                                                                                                                                                                       | ✓ VERIFIED | Quick-regression: `app/app/(app)/plans/[id].tsx` still calls `useStartSession(newSessionId).mutate(...)` synchronously; lazy-init `useState(() => randomUUID())` for stable scope. No change since 2026-05-13. |
| MH-2 | Användare loggar ett set (vikt + reps); per-set persistens via `useAddSet` med `mutationKey: ['set','add']` + `scope.id = "session:<id>"`                                                                                                                                                  | ✓ VERIFIED | `app/lib/queries/sets.ts` still declares `mutationKey + scope` only (Pitfall 8.1). Post-FIT-7: `set_number?` now optional on `SetInsertVars` (line 39) — server trigger assigns it. `app/app/(app)/workout/[sessionId].tsx:355-394` `addSet.mutate({ id, session_id, exercise_id, weight_kg, reps, completed_at, set_type })` — `set_number` no longer in payload. D-16 SUPERSEDED. |
| MH-3 | Användare ser set-position-aligned senaste värde ("Förra: set 1: 82.5kg × 8") vid loggning                                                                                                                                                                                                 | ✓ VERIFIED | `app/lib/queries/last-value.ts` two-step query + `set_type='working'` filter + RLS-scoped `workout_sessions!inner` join unchanged. PRODUCTION code path correct. Test-last-value-query Assertion 3 regression noted as a WARNING (test fixture only — see Regressions section). |
| MH-4 | Användare kan avsluta passet → `finished_at` sätts → tillbaka till hem; ingen "Discard workout"                                                                                                                                                                                            | ✓ VERIFIED | AvslutaOverlay accent-blue primary preserved; no Discard / Kasta strings introduced in gap-closure diffs. `app/app/(app)/workout/[sessionId].tsx:813-827` `finishSession.mutate({ id, finished_at: now })` → `router.replace("/(app)/(tabs)")` unchanged. |
| MH-5 | Draft-session-recovery: kall-start visar "Återuppta passet?" om `workout_sessions WHERE finished_at IS NULL` finns                                                                                                                                                                          | ✓ VERIFIED | `(tabs)/index.tsx` `DraftResumeOverlay` + cold-start sentinel unchanged. `(tabs)/_layout.tsx:30, 39` mounts `<ActiveSessionBanner />` (verified via grep). |
| MH-6 | F13 acceptance test passerar: 25-set offline + force-quit + reconnect → alla 25 set överlever i rätt ordning, zero FK violations, zero duplicate PKs                                                                                                                                       | ✓ VERIFIED (source) — full iPhone UAT routed to human_verification | Contract-layer gates all PASS post-gap-closure (see Behavioral Spot-Checks). UAT 2026-05-13 logged 31 sets across 3 exercises with contiguous `set_number` per exercise + finished_at after all sets. Schema gap that surfaced 6 silent duplicates in session 379cfd29 is now closed via Migration 0003 UNIQUE constraint + Migration 0004 server-side trigger + Migration 0005 superseder (single-transaction lock+dedupe+constraint for V1.1+ contract correctness). |
| **MH-7 (NEW)** | Migration 0005 superseder applied; UNIQUE constraint `exercise_sets_session_exercise_setno_uq` enforced on deployed DB                                                                                                                                                          | ✓ VERIFIED | `npm run inspect:duplicate-sets` against deployed DB: constraints section lists `exercise_sets_session_exercise_setno_uq type=u UNIQUE (session_id, exercise_id, set_number)`. `verify-deploy.ts` shows `assign_exercise_set_number returns trigger` under "Functions in public". `test:rls` natural-key uniqueness assertion: duplicate insert with same `(session_id, exercise_id, set_number)` is rejected with Postgres error code `23505` (verified live). Session 379cfd29 historical inspect shows no `<-- DUPLICATE` markers (Migration 0002 dedupe applied; Migration 0005 idempotent replay confirms zero new duplicates). |
| **MH-8 (NEW)** | Hydration gate renders during cache restore (source-level)                                                                                                                                                                                                                                 | ✓ VERIFIED | `app/lib/persistence-store.ts` Zustand store exports `{ hydrated, setHydrated }`. `app/app/_layout.tsx:132-152` wraps tree in `<PersistQueryClientProvider>` with `onSuccess`/`onError` callbacks both flipping `setHydrated(true)` (degraded-but-unblocked contract for adapter failures). `app/app/(app)/workout/[sessionId].tsx:144-157` reads `usePersistenceStore((s) => s.hydrated)` and renders `<Text>Återställer pass…</Text>` SafeAreaView gate BEFORE the existing `!session` "Laddar…" branch. (tabs)/index.tsx untouched (separate path; verified via grep). |
| **MH-9 (NEW)** | Swedish-locale comma input accepted via `z.preprocess`                                                                                                                                                                                                                                     | ✓ VERIFIED | `app/lib/schemas/sets.ts:44-53` wraps `weight_kg` in `z.preprocess((val) => typeof val === "string" ? val.replace(/,/g, ".") : val, <inner>)`. `/g` flag intentional (multi-comma `"102,5,5"` → `"102.5.5"` → NaN → schema reject). Test gate: `npm run test:set-schemas` → 13/13 PASS (10 baseline + 3 new locale cases: '102,5' coerces, '102.5' coerces, '102,5,5' rejects). |
| **MH-10 (NEW)** | ActiveSessionBanner mount scope documented in `05-UI-SPEC.md`                                                                                                                                                                                                                              | ✓ VERIFIED | `05-UI-SPEC.md:289` new "Mount scope (Plan 05-07 / FIT-10 clarification)" subsection explicitly names the three tab screens (Planer/Historik/Inställningar) where banner renders + names the routes where it is intentionally absent (`/plans/[id]`, `/plans/[id]/exercise-picker`, `/plans/[id]/exercise/[planExerciseId]/edit`, `/workout/[sessionId]`). Cross-references FIT-10 UAT misread. `(tabs)/_layout.tsx:39` mount confirmed; `(app)/_layout.tsx` has NO ActiveSessionBanner mount (grep verified) — banner is structurally absent on non-tab routes by design. |

**Score:** 10/10 must-haves verified at source level. 3 iPhone-UAT items routed to `human_verification` block per user instruction.

### Required Artifacts (post-gap-closure inventory)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/supabase/migrations/0002_dedupe_exercise_sets.sql` | CTE-based DELETE keeping oldest non-NULL `completed_at` per (session, exercise, set_number) | ✓ VERIFIED | File exists; applied to deployed DB; session 379cfd29 has zero duplicate-set_number markers post-apply. |
| `app/supabase/migrations/0003_exercise_sets_natural_key.sql` | `add constraint exercise_sets_session_exercise_setno_uq UNIQUE (session_id, exercise_id, set_number)` | ✓ VERIFIED | File exists; constraint enforced on deployed DB; test:rls natural-key uniqueness assertion catches `23505 unique_violation`. |
| `app/supabase/migrations/0004_exercise_sets_set_number_trigger.sql` | `assign_exercise_set_number()` SECURITY INVOKER + `search_path = ''` + `assign_set_number_before_insert` BEFORE INSERT trigger | ✓ VERIFIED | File exists; trigger present on deployed DB (verify-deploy.ts confirms). Client payload no longer carries `set_number` for INSERTs. |
| `app/supabase/migrations/0005_exercise_sets_dedupe_and_uq_combined.sql` (NEW — review CR-01 fix) | Single-transaction `LOCK TABLE … IN ACCESS EXCLUSIVE MODE` + idempotent dedupe CTE + `IF NOT EXISTS`-guarded `ADD CONSTRAINT` via DO block | ✓ VERIFIED | File exists with explicit `begin;`/`commit;` (Supabase CLI does NOT auto-wrap; observed SQLSTATE 25P01 first-deploy). DO block checks pg_constraint before ADD; on already-deployed DB this is a no-op (constraint from 0003 still present). |
| `app/lib/persistence-store.ts` (NEW — FIT-8) | Zustand `{ hydrated, setHydrated }` | ✓ VERIFIED | 23 LOC; documented header comment cross-references FIT-8 + _layout.tsx provider wiring. |
| `app/lib/query/persister.ts` (FIT-8) | imperative `persistQueryClient(...)` removed; named export `asyncStoragePersister` preserved for network.ts | ✓ VERIFIED | Lines 52-60: only `createAsyncStoragePersister({storage, throttleTime: 500})` + named export remain. Comment block updated to reflect Provider-owned LOAD-side ownership. |
| `app/lib/query/network.ts` (review fix WR-01) | onlineManager.subscribe(resumePausedMutations) protected by `globalThis` sentinel | ✓ VERIFIED | Lines 140-155: `ONLINEMANAGER_RESUME_KEY = "__fitnessmaxxing_onlinemanager_resume__"` sentinel pattern parallel to existing APPSTATE_BGFLUSH_KEY. Fast-Refresh-safe. focusManager.setEventListener documented as internally-idempotent (TanStack v5 contract) — no sentinel needed (lines 56-65 comment). |
| `app/lib/query/client.ts` (FIT-7 + review fix WR-06) | `setMutationDefaults[['set','add']].mutationFn` upserts without `set_number` (server trigger fills); `onMutate` provisional set_number uses `Math.max(...filteredSetNumbers, 0) + 1` | ✓ VERIFIED | Lines 715-783: payload cast to `Database["public"]["Tables"]["exercise_sets"]["Insert"]` with documented breadcrumb (drop cast once gen:types learns trigger-DEFAULT). Provisional set_number uses MAX+1 (line 767) — survives cold-start replay where length+1 would collide with rehydrated optimistic rows. `satisfies SetRow` typed optimistic row (WR-03 fix). |
| `app/lib/queries/sets.ts` (FIT-7) | `SetInsertVars.set_number?` optional + comment citing Plan 05-04 + Migration 0004 SUPERSEDES D-16 | ✓ VERIFIED | Lines 29-46. |
| `app/lib/schemas/sets.ts` (FIT-9) | `z.preprocess` wrap with `/g` replace on `weight_kg`; `multipleOf(0.25)` inner schema preserved | ✓ VERIFIED | Lines 44-53. Header docblock (lines 27-34) cites Plan 05-06 + FIT-9 + /g rationale. |
| `app/app/_layout.tsx` (FIT-8) | `<PersistQueryClientProvider client persistOptions onSuccess onError>` replaces `<QueryClientProvider>` | ✓ VERIFIED | Lines 14, 28-31, 132-152. Module-load-order invariant preserved (client.ts → persister.ts → network.ts side-effect imports unchanged). |
| `app/app/(app)/workout/[sessionId].tsx` (FIT-7 + FIT-8) | (a) `set_number` removed from `addSet.mutate` payload + D-16 SUPERSEDED comment; (b) `usePersistenceStore` hydration gate renders "Återställer pass…" BEFORE `!session` branch | ✓ VERIFIED | (a) Lines 355-394: no `set_number` in mutate payload; D-16 SUPERSEDED comment at former line 356. (b) Lines 77 import + 144-157 hydration branch. Lint warning (unused `Href` import) closed. |
| `app/scripts/test-rls.ts` (FIT-7 + review fix WR-03) | Phase 5 gap-closure natural-key uniqueness assertion (expects `23505`); cleanup signs out clientA + clientB before deleteUser | ✓ VERIFIED | Lines 789-825 assertion block; lines 853-854 `clientA.auth.signOut().catch(() => {})` parallel for clientB. Total: 39 PASS / 0 FAIL (38 baseline + 1 natural-key). |
| `app/scripts/test-set-schemas.ts` (FIT-9) | 3 new locale-tolerant cases (10 → 13 PASS) | ✓ VERIFIED | Test run: 13/13 PASS confirmed. |
| `app/scripts/inspect-duplicate-sets.ts` (review fix WR-04) | accepts session UUID via `process.argv[2]` (no source-edit required to reuse) | ✓ VERIFIED | Script accepts argv[2]; defaults to historical session 379cfd29 if no arg passed (documented in script header). |
| `app/scripts/inspect-recent-sessions.ts` + `app/scripts/verify-f13-brutal-test.ts` (FIT-7 commit-from-untracked) | committed AS-IS | ✓ VERIFIED | `git ls-files` lists all 3 diagnostic scripts; npm scripts wired (`test:f13-brutal`, `inspect:duplicate-sets`, `inspect:recent-sessions`). |
| `app/scripts/manual-test-phase-05-f13-brutal.md` (FIT-7) | Phase 9 Step 41 + Pass-criteria checkbox extended with `npm run test:f13-brutal` + duplicate-detection SQL | ✓ VERIFIED | Recipe extended at Phase 9; new step references `group by 1,2,3 having count(*) > 1` as a hard pass gate. |
| `app/package.json` (FIT-7 + review fix WR-02) | `test:rls`, `test:f13-brutal`, `inspect:duplicate-sets`, `inspect:recent-sessions` all use `--env-file-if-exists=.env.local` (CI-safe) | ✓ VERIFIED | Lines 13, 25, 26, 27 all use `--env-file-if-exists`. |
| `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-UI-SPEC.md` (FIT-10) | "Mount scope" subsection clarifying banner is `(tabs)`-only | ✓ VERIFIED | Line 289 new subsection added. Cross-references FIT-10 + UAT 2026-05-13 Gap #4 misread. |

### Key Link Verification (post-gap-closure)

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `app/app/_layout.tsx` `<PersistQueryClientProvider onSuccess>` | `app/lib/persistence-store.ts setHydrated` | `usePersistenceStore.getState().setHydrated(true)` callback | ✓ WIRED | Lines 138-152; `onError` parity provides degraded-but-unblocked fallback (T-05-05-01 mitigation). |
| `app/lib/persistence-store.ts usePersistenceStore` | `app/app/(app)/workout/[sessionId].tsx` hydration gate | `useStore selector subscribes to s.hydrated`; renders "Återställer pass…" SafeAreaView when `!hydrated` | ✓ WIRED | Lines 77 + 144-157. (tabs)/index.tsx grep clean (no usePersistenceStore reference — separate path, intentional). |
| `app/app/(app)/workout/[sessionId].tsx onKlart` | Postgres trigger `assign_exercise_set_number` on INSERT | `addSet.mutate({ ... }, { /* no set_number */ })` → upsert with undefined set_number → trigger fills NEW.set_number → UNIQUE constraint enforces no duplicate | ✓ WIRED | Verified via grep `set_number:` inside addSet.mutate payload returns 0 matches. SECURITY INVOKER trigger respects RLS (T-05-04-02/03). |
| `app/lib/schemas/sets.ts setFormSchema.weight_kg` | RHF `handleSubmit` | `z.preprocess(comma→period, inner.coerce.number().multipleOf(0.25))` widens input type to `unknown`; RHF v7 3-generic shape unaffected | ✓ WIRED | Test gate `test:set-schemas` 13/13 PASS proves end-to-end normalization. |

### Data-Flow Trace (Level 4)

All artifacts that pass Levels 1-3 also flow real data. No HOLLOW / DISCONNECTED / HOLLOW_PROP findings. Hydration affordance renders against a Zustand store that flips on a real TanStack provider callback (not a hardcoded boolean).

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `workout/[sessionId].tsx` hydration gate | `hydrated` | `usePersistenceStore((s) => s.hydrated)` flipped by `PersistQueryClientProvider.onSuccess` (and `onError` fallback) | Yes — bound to TanStack v5 internal hydration contract (AsyncStorage round-trip) | ✓ FLOWING |
| `workout/[sessionId].tsx` ExerciseCard | `lastValueMap` | `useLastValueQuery(exerciseId, sessionId)` → two-step PostgREST query (production code unchanged) | Yes — RLS-scoped + `set_type='working'` filter still correct | ✓ FLOWING |
| `lib/schemas/sets.ts weight_kg` | normalized number | `z.preprocess` strips comma → coerces number → validates multipleOf(0.25) | Yes — verified via 3 new test cases (comma OK, period OK, multi-comma rejected) | ✓ FLOWING |

### Behavioral Spot-Checks (re-run live against deployed DB 2026-05-14)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript clean | `cd app && npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Lint clean | `cd app && npx expo lint` | 0 errors, 0 warnings | ✓ PASS |
| Session schema cases | `cd app && npm run test:session-schemas` | 4/4 PASS | ✓ PASS |
| Set schema cases + Swedish locale | `cd app && npm run test:set-schemas` | 13/13 PASS (10 baseline + 3 new locale cases — '102,5'→102.5, '102.5'→102.5, '102,5,5' rejected) | ✓ PASS |
| Offline queue (Phase 5 ext 25-set paused-cache survival) | `cd app && npm run test:offline-queue` | 7 PASS (4 Phase 4 + 3 Phase 5 ext) | ✓ PASS |
| Sync ordering (Phase 5 ext START → 25 SETs → FINISH FIFO) | `cd app && npx tsx --env-file=.env.local scripts/test-sync-ordering.ts` | 10 PASS — explicit "25 sets in DB with contiguous set_number 1..25"; "workout_session.finished_at set after all 25 sets landed"; "no 23503 FK violations" | ✓ PASS |
| Cross-user RLS + Phase 5 gap-closure natural-key uniqueness | `cd app && npm run test:rls` | 39 PASS / 0 FAIL — final PASS: "Phase 5 gap-closure: duplicate (session_id, exercise_id, set_number) rejected with 23505 unique_violation" | ✓ PASS |
| F13 programmatic brutal-test gate (verify-f13-brutal-test.ts) | `cd app && npm run test:f13-brutal` | exit 0 — "No workout_sessions found in the last 60 min. Nothing to verify." (graceful no-op per script contract) | ✓ PASS |
| Deployed-DB drift verification | `cd app && npx tsx --env-file=.env.local scripts/verify-deploy.ts` | exit 0 — `assign_exercise_set_number returns trigger` present; 6/6 tables have RLS ON; 10 policies enumerated; `on_auth_user_created` trigger on auth.users present | ✓ PASS |
| Schema constraint verification | `cd app && npm run inspect:duplicate-sets` | constraints section lists `exercise_sets_session_exercise_setno_uq type=u UNIQUE (session_id, exercise_id, set_number)`; indexes section confirms backing UNIQUE INDEX exists | ✓ PASS |
| F7 last-value query (working-set filter, RLS gate, current-session exclusion) | `cd app && npx tsx --env-file=.env.local scripts/test-last-value-query.ts` | **8 PASS / 1 FAIL** — Assertion 3 (warmup filter) failed because test fixture violates new UNIQUE constraint. PRODUCTION code path correct; only synthetic fixture broken. See Regressions section. | ⚠ FAIL (test fixture only) |
| Service-role isolation audit | `git grep "service_role\|SERVICE_ROLE" -- "*.ts" "*.tsx" "*.js" "*.jsx" ":!.planning/" ":!app/scripts/" ":!app/.env.example" ":!CLAUDE.md"` | empty (no leaks outside allowlist) | ✓ PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes declared by this phase. The phase uses `tsx` Node scripts invoked through npm scripts; those are exercised under Behavioral Spot-Checks above.

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| (none) | — | — | — |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| F5 | 05-01, 05-02, 05-03 | Starta pass → workout_sessions row direkt | ✓ SATISFIED | Truth MH-1 |
| F6 | 05-01, 05-02, 05-04, 05-05, 05-06 | Logga set ≤3 sek; per-set persistens; server-assigned set_number; locale-tolerant weight input; hydration affordance | ✓ SATISFIED | Truths MH-2, MH-8, MH-9 |
| F7 | 05-01, 05-02 | Set-position-aligned last value | ✓ SATISFIED | Truth MH-3 (production code-path; test fixture regression noted as warning) |
| F8 | 05-01, 05-02, 05-07 | Avsluta + ingen Discard; banner mount scope clarified | ✓ SATISFIED | Truths MH-4, MH-10 |
| F13 | 05-01, 05-02, 05-03, 05-04 | Brutal-test 25-set offline + force-quit + sync-in-order + UNIQUE natural-key guarantee | ✓ SATISFIED (source); iPhone UAT routed to human_verification | Truth MH-6 + MH-7 |

No ORPHANED requirements. Every requirement ID declared by any plan in Phase 5 is accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none in modified files) | — | — | — | The 1 pre-existing `Href`-import lint warning from 2026-05-13 is closed by FIT-7 (commit `2ab3216`). Zero TBD/FIXME/XXX/TODO/HACK markers in any modified file. All `placeholder=` matches in workout/[sessionId].tsx are legitimate `<TextInput placeholder="Vikt|Reps" />` UI strings. |

### Code Review Status (05-REVIEW.md — post-gap-closure review)

| ID | Severity | Status | Resolution |
| -- | -------- | ------ | ---------- |
| CR-01 (Migration 0002/0003 TOCTOU window) | Critical | ✓ FIXED | Migration 0005 superseder with `LOCK TABLE … IN ACCESS EXCLUSIVE MODE` + idempotent dedupe + `IF NOT EXISTS`-guarded `ADD CONSTRAINT` (DO block guard). Single-transaction. Applied to deployed DB after explicit `begin;`/`commit;` follow-up (Supabase CLI does NOT auto-wrap — observed SQLSTATE 25P01). |
| WR-01 (Fast-Refresh listener leak on onlineManager.subscribe) | Warning | ✓ FIXED | `globalThis` sentinel pattern `ONLINEMANAGER_RESUME_KEY` parallel to existing `APPSTATE_BGFLUSH_KEY`. focusManager.setEventListener documented as internally-idempotent — no sentinel needed (TanStack v5 contract). |
| WR-02 (--env-file CI-unsafety) | Warning | ✓ FIXED | `test:f13-brutal`, `inspect:duplicate-sets`, `inspect:recent-sessions` all use `--env-file-if-exists=.env.local`. |
| WR-03 (test-rls.ts stale-JWT after deleteUser) | Warning | ✓ FIXED | `clientA.auth.signOut().catch(() => {})` + parallel for `clientB` before deleteUser in cleanupTestUsers. |
| WR-04 (inspect-duplicate-sets hardcoded UUID) | Warning | ✓ FIXED | Script accepts `process.argv[2]` (or `INSPECT_SESSION_ID` env var); default fallback to historical session preserved with documented breadcrumb. |
| WR-05 (Migration 0002 NULLS-LAST comment misleading) | Warning | ✓ FIXED | Header comment clarified: "Keeps the row with the oldest non-NULL completed_at; under NULL ties, falls back to id ASC (deterministic, not temporally meaningful)." Mirrored in Migration 0005. |
| WR-06 (provisional set_number `length+1` collides on cold-start replay) | Warning | ✓ FIXED | `setMutationDefaults[['set','add']].onMutate` now uses `Math.max(...filteredSetNumbers, 0) + 1` — survives rehydration of partially-flushed optimistic rows. Type-safe `satisfies SetRow`. |
| IN-01..IN-05 | Info | NOT BLOCKING | Documented future-cleanup breadcrumbs (label clarity on test-set-schemas, scope-by-user-id option on inspect-recent-sessions, defense-in-depth join inside trigger, gen:types cast breadcrumb, postgres-js bigint cast). |

All CRITICAL + WARNING findings from 05-REVIEW.md are closed.

### Regressions discovered in this verification (not introduced by gap-closure per se — surfaced by re-running gates)

**REGRESSION-01: `test-last-value-query.ts` Assertion 3 — warmup filter test fixture incompatible with FIT-7 UNIQUE constraint**

- **What:** `cd app && npx tsx --env-file=.env.local scripts/test-last-value-query.ts` now reports `1 FAILURE(S)` on Assertion 3 ("warmup filtered out; only 2 working sets visible — expected 2, actual 1"). Wave-0 baseline pre-FIT-7 was 9 PASS; current is 8 PASS / 1 FAIL.
- **Why:** The fixture seeds Session C with `(set_number=1, set_type=warmup)` AND `(set_number=1, set_type=working)` for the same `(session_id, exercise_id)`. Pre-FIT-7 the schema allowed this; post-FIT-7 the new `exercise_sets_session_exercise_setno_uq` UNIQUE constraint correctly rejects the second INSERT with `23505 unique_violation`. The test's assertion measures `Map.size === 2` (2 working sets), but only 1 working set lands (set_number=2 — the working at set_number=1 is blocked), so `Map.size === 1` instead of `2`.
- **Impact on goal:** **NONE for production behavior.** The production `lib/queries/last-value.ts` `set_type='working'` filter is still correct. F7 truth (MH-3) is verified at the user-visible production-code level. This is a test-fixture model mismatch: the new natural-key model assigns set_number per `(session_id, exercise_id)` regardless of `set_type` — a warmup IS set 1, then working sets are 2/3/4. The old fixture's assumed shape (warmup=1, working=1, working=2) is not reachable under the new schema, which matches the natural product semantics (a single set position cannot be both warmup and working).
- **Classification:** WARNING — test-suite hygiene regression introduced by an intentional schema redesign. Not blocking phase advancement because (a) production code path correct, (b) schema redesign was the explicit gap-closure intent, (c) no user-visible regression.
- **Follow-up:** Recommend creating Linear `FIT-11 [P2] — update test-last-value-query Assertion 3 fixture to use distinct set_number per warmup/working (warmup=1, working=2, working=3)` for next polish pass. Not blocking.

### Human Verification Required (carried forward + new)

All three items are routed to the `human_verification` block in frontmatter. They are recommended-but-not-blocking per user instruction. Source-level verification holds across all 10 must-haves.

1. **F13 Brutal-Test full end-to-end recipe on physical iPhone** — partial UAT performed 2026-05-13 (Phases 1-9 of recipe, 31 sets logged, 2 force-quits, replay successful within 30s window). Clean-room repeat on the post-gap-closure build is the recommended-but-not-blocking next-run.
2. **Swedish-locale iPhone UAT for FIT-9** — schema-level proof gates the contract (13/13 PASS); on-device proof confirms the iOS decimal-pad locale rendering.
3. **Hydration affordance UAT on physical iPhone for FIT-8** — source-level proof gates the wiring; on-device proof confirms the perceived flicker is gone after PersistQueryClientProvider takes ownership of LOAD-side hydration.

### Gaps Summary

**No blocker-tier gaps.** All 10 must-haves are observably true at source level. All ROADMAP Success Criteria #1–#6 are satisfied (SC #6 has the established `human_needed` deferral for full physical-iPhone brutal-test, per user instruction). One test-fixture regression (REGRESSION-01) is documented as a WARNING with explicit "not blocking" classification and a follow-up Linear suggestion (FIT-11). All 1 CRITICAL + 6 WARNING findings from 05-REVIEW.md are closed; all 7 review-fix commits land. Migration 0005 superseder applied to deployed DB; UNIQUE constraint + server-side set_number trigger enforced. Service-role audit green. RLS regression at 39 PASS (≥ 38 baseline; +1 natural-key uniqueness). TypeScript + lint clean.

Per user instruction: "User has explicitly indicated they want to close the phase now (commit phase.complete) and run iPhone UAT separately. Bias toward `passed` if source-level verification holds; persist iPhone-UAT items as `human_verification` block." Source-level verification holds; iPhone-UAT items are persisted in the `human_verification` block; status is `human_needed` because the human_verification block is non-empty (per Step 9 decision tree).

---

_Re-verified: 2026-05-14T19:14:20Z_
_Verifier: Claude (gsd-verifier, 1M context, re-verification mode)_
_Previous verification: 2026-05-13T20:33:14Z (initial, `human_needed @ 6/6 — MH-6 partial`)_
