---
phase: 05-active-workout-hot-path-f13-lives-or-dies
verified: 2026-05-13T20:33:14Z
status: human_needed
score: 6/6 must-haves verified (MH-6 partially verified — automated gates green; full end-to-end UAT recommended-but-not-blocking per user instruction)
overrides_applied: 0
re_verification: # First-pass verification — no previous VERIFICATION.md
  initial: true
human_verification:
  - test: "F13 Brutal-Test full end-to-end recipe on physical iPhone"
    expected: "All 25 sets land in Supabase in correct set_number order with no FK/PK violations after airplane mode + force-quit + battery-pull-simulering under 25-set workout per app/scripts/manual-test-phase-05-f13-brutal.md (10-phase recipe, 244 LOC)"
    why_human: "Cannot be automated. Requires native OS lifecycle (airplane-mode toggle, force-quit via app switcher, OS-level RAM reclamation) that no test runner can simulate. Detox can airplane-mode + force-quit but cannot simulate a true battery-pull (it shuts via JS bridge, not kill -9). Maestro is similar. The Wave 0 automated scripts (test-offline-queue.ts FIFO 25-set, test-sync-ordering.ts START→25×SET→FINISH FIFO replay against real Supabase) prove the contract layer; the brutal-test is the system-level acceptance gate per CONTEXT.md F13 acceptance test."
    note: "Per user instruction during verification request: MH-6 should be treated as partial verification — code-side automated gates pass (test-offline-queue Phase 5 ext + test-sync-ordering Phase 5 ext + test-rls 38 cross-user assertions all green), and the manual recipe ships and is available; the user already approved code-side after a UAT-driven happy-path test (start pass, log sets, F7 chip, Avsluta + toast, cold-start overlay all verified working). Full 25-set + airplane mode + force-quit recipe was NOT executed end-to-end (deferred per user) and is a recommended-but-not-blocking future run."
---

# Phase 5: Active Workout Hot Path (F13 lives or dies) Verification Report

**Phase Goal:** Användare kan starta ett pass, logga set i ≤3 sekunder per set, se senaste värdet per övning, och avsluta passet — varje set överlever även mest extrema offline-scenarier
**Verified:** 2026-05-13T20:33:14Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth                                                                                                                                                                                                                                                                                       | Status         | Evidence       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------- |
| 1   | Användare kan starta pass från en plan; `workout_sessions`-rad skapas direkt vid "Starta pass"-tryck (inte vid "Avsluta")                                                                                                                                                                  | ✓ VERIFIED     | `app/app/(app)/plans/[id].tsx:217-250` — `onStarta` handler calls `startSession.mutate({ id: newSessionId, user_id, plan_id, started_at: now })` then `router.push("/workout/<id>")`. `newSessionId` is lazy-init via `useState(() => randomUUID())` (line 145) for stable scope. Optimistic onMutate in `setMutationDefaults[['session','start']]` (client.ts:581) dual-writes `sessionsKeys.active()` + `sessionsKeys.detail()` so the workout screen has data immediately. `AvslutaOverlay.handleConfirm` (workout/[sessionId].tsx:813-827) does NOT create the row — it only updates `finished_at`. |
| 2   | Användare loggar ett set (vikt + reps) på ≤3 sekunder; per-set persistens via `useAddSet` med `mutationKey: ['set','add']` + `scope.id = "session:<id>"` (ingen "save on finish")                                                                                                          | ✓ VERIFIED     | `app/lib/queries/sets.ts:76-81` — `useAddSet(sessionId)` declares `mutationKey: ['set','add']` + `scope: { id: 'session:${sessionId}' }` (static string per Pitfall 3). `workout/[sessionId].tsx:355-394` — `onKlart` fires per-tap mutate (NOT mutateAsync) with optimistic onMutate from `setMutationDefaults[['set','add']]` (client.ts:713). No batch-at-finish path exists. Behavioral spot-check `test:set-schemas` (10 cases all PASS) gates the form-input boundary; `test:offline-queue` Phase 5 ext (25 `['set','add']` paused-mutation persist/restart) PASSED. Latency is set by optimistic onMutate (<100ms cache write per SUMMARY.md). |
| 3   | Användare ser set-position-aligned senaste värde ("Förra: set 1: 82.5kg × 8") vid loggning, inte bara senaste single-värdet                                                                                                                                                                | ✓ VERIFIED     | `app/lib/queries/last-value.ts:55-122` — Two-step PostgREST query: STEP 1 finds most-recent finished session via `workout_sessions!inner` RLS-scoped join + `.eq('workout_sessions.user_id', userId)` belt-and-braces; STEP 2 fetches all working sets from that session ordered by `set_number`. Returns `Record<setNumber, { weight_kg, reps, completed_at }>` (changed from `Map` per commit da6c2a7 for JSON persister round-trip). `workout/[sessionId].tsx:751-773` `LastValueChip` renders `'Förra: <weight> × <reps>'` ONLY when `lastValueMap?.[setNumber]` is truthy (D-19 returns null otherwise). Behavioral spot-check `test:last-value-query` 9 PASS lines: Assertion 1 most-recent-finished wins; Assertion 2 current-session exclusion; Assertion 3 working-set filter (warmup excluded); Assertion 4 cross-user RLS gate; Assertion 5 empty map for no-history exercise. |
| 4   | Användare kan avsluta passet → `finished_at` sätts → tillbaka till hem; ingen "Discard workout"-knapp finns                                                                                                                                                                                | ✓ VERIFIED     | `app/app/(app)/workout/[sessionId].tsx:163-176` — header-right Avsluta button opens overlay. `AvslutaOverlay` (lines 792-903): primary `<Pressable onPress={handleConfirm}>` is accent-blue (`bg-blue-600 dark:bg-blue-500` line 892) per D-23 + PITFALLS §6.6 (NOT red — finishing a pass is intended terminal state, not data loss). `handleConfirm` (line 813-827) calls `finishSession.mutate({ id, finished_at: now })` then `onFinish()` which calls `router.replace("/(app)/(tabs)")` (line 193). No "Discard workout" or destructive-red button exists in workout screen — the only red button in Phase 5 lives in `(tabs)/index.tsx:377-386` ("Avsluta sessionen" in draft-resume overlay, which is data-loss-adjacent orphan-close). Grep verified: no `Discard` / `Kasta` strings in workout screen. |
| 5   | Draft-session-recovery: kall-start visar "Återuppta passet?" om `workout_sessions WHERE finished_at IS NULL` finns                                                                                                                                                                          | ✓ VERIFIED     | `app/app/(app)/(tabs)/index.tsx:107-141` — `useActiveSessionQuery` (sessions.ts:48-67) queries `workout_sessions WHERE user_id=$userId AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1`. Cold-start sentinel via `useState<string\|null\|undefined>(undefined)` (line 129) — captured at first settled query result (line 132-136) per UAT fixes 35efe5e/e89bb55/b8d45f4: only true cross-launch drafts surface the overlay, not a session the user just started. `DraftResumeOverlay` subcomponent (lines 324-401, extracted per WR-04 fix) renders title "Återuppta passet?", primary "Återuppta" (accent-blue) → `router.push("/workout/<id>")`, secondary "Avsluta sessionen" (destructive-red) → `useFinishSession.mutate`. Backdrop is intentionally NON-dismissable (line 360-362 — "NO onPress" comment) per UI-SPEC §line 250 force-decision UX. `useActiveSessionQuery` filters by `.eq("user_id", userId)` + RLS double-gate (T-05-15). |
| 6   | F13 acceptance test passerar (manual UAT): airplane mode + force-quit + battery-pull-simulering under 25-set-pass = alla 25 set överlever och synkar i rätt ordning vid återanslutning (idempotent via klient-genererade UUIDs + `scope.id` serial replay)                                  | ⚠ PARTIAL      | **Automated contract gates ALL PASS** (`test:offline-queue` 25-set paused-mutation persist/restart green; `test:sync-ordering` START→25×SET→FINISH FIFO replay against real Supabase admin green — 25 sets in DB with contiguous `set_number` 1..25, `finished_at` after all sets, zero 23503 FK violations; `test:upsert-idempotency` from Phase 4 already proves `onConflict: 'id', ignoreDuplicates: true` honored). **Manual recipe** `app/scripts/manual-test-phase-05-f13-brutal.md` (244 LOC, 10 phases) ships and is available. **Per user instruction:** code-side automated gates pass; user-approved happy-path UAT (start, log sets, F7 chip works, Avsluta + toast, cold-start overlay) was performed in-session and verified working; full 25-set + airplane mode + force-quit recipe was NOT executed end-to-end (deferred per user — recommended-but-not-blocking future run). Treated as partial — see Human Verification Required section. |

**Score:** 6/6 must-haves verified (#6 partial — automated gates green, manual UAT recommended-but-not-blocking per user direction)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/lib/schemas/sessions.ts` | Zod 4 sessionFormSchema + sessionRowSchema | ✓ VERIFIED | 75 LOC; `notes ≤ 500 chars` enforced; both `sessionRowSchema` and `SessionRowSchema` PascalCase alias exported; consumed by `lib/queries/sessions.ts` for `.parse()` boundary. |
| `app/lib/schemas/sets.ts` | Zod 4 setFormSchema (D-15 strict) + setRowSchema | ✓ VERIFIED | 97 LOC; STRICT D-15: `weight_kg.min(0).max(500).multipleOf(0.25)`, `reps.int().min(1).max(60)`, `set_type` enum default 'working'. `SetFormInput` + `SetFormOutput` exports for RHF v7 3-generic shape. Used at form gate in workout screen + at Supabase response boundary in queries. |
| `app/lib/query/keys.ts` | sessionsKeys + setsKeys + lastValueKeys factories | ✓ VERIFIED | 64 LOC; `sessionsKeys.all/list/detail/active`, `setsKeys.all/list(sessionId)`, `lastValueKeys.all/byExercise(exerciseId)` all exported. Phase 4 factories untouched. |
| `app/lib/query/client.ts` | QueryClient + 13 setMutationDefaults (8 Phase 4 + 5 Phase 5) | ✓ VERIFIED | 1098 LOC; grep finds all 13 `setMutationDefaults([...])` calls at module top-level (lines 230-829). The 5 Phase 5 keys: `['session','start']` (581), `['session','finish']` (651), `['set','add']` (713), `['set','update']` (774), `['set','remove']` (829). `['session','finish'].onSettled` invalidates `lastValueKeys.all` per Open Q#2. |
| `app/lib/query/persister.ts` | createAsyncStoragePersister({ throttleTime: 500 }) + named export | ✓ VERIFIED | 57 LOC; line 47-50 `createAsyncStoragePersister({ storage: AsyncStorage, throttleTime: 500 })`; named export `asyncStoragePersister` available for AppState background-flush. |
| `app/lib/query/network.ts` | AppState background-flush + CR-01 fix | ✓ VERIFIED | 146 LOC; AppState listener (lines 86-102) calls `persistQueryClientSave({ queryClient, persister: asyncStoragePersister })` on `'background'`/`'inactive'`. CR-01 fix applied: globalThis sentinel `__fitnessmaxxing_appstate_bgflush_sub__` tears down prior subscription before Fast Refresh re-evaluation. Also retains Phase 4 focusManager + onlineManager.subscribe(resumePausedMutations) listeners. |
| `app/lib/queries/sessions.ts` | useActiveSessionQuery + useSessionQuery + useStart/FinishSession | ✓ VERIFIED | 132 LOC; `useActiveSessionQuery` (LIMIT 1 WHERE finished_at IS NULL ORDER BY started_at DESC, user_id-gated + RLS double-gate). `useSessionQuery` seeds via initialData from `sessionsKeys.active()`. `useStartSession(sessionId)` + `useFinishSession(sessionId)` only declare mutationKey + scope (Pitfall 8.1). |
| `app/lib/queries/sets.ts` | useSetsForSessionQuery + useAddSet/useUpdateSet/useRemoveSet | ✓ VERIFIED | 96 LOC; `useSetsForSessionQuery(sessionId)` ordered by `(exercise_id, set_number)` ascending; SetRowSchema.parse boundary. 3 mutation hooks declare only mutationKey + scope per Pitfall 8.1. |
| `app/lib/queries/last-value.ts` | useLastValueQuery(exerciseId, currentSessionId) → Record<setNumber, ...> | ✓ VERIFIED | 123 LOC; Two-step query with RLS-scoped `workout_sessions!inner` join + belt-and-braces `.eq("workout_sessions.user_id", userId)`. Returns `Record<number, LastValueEntry>` (not `Map`) per da6c2a7 fix (Map breaks JSON.stringify in persister). staleTime 15min per D-20. Cache key per-exercise-only (currentSessionId is a queryFn arg, not in queryKey). |
| `app/app/(app)/workout/[sessionId].tsx` | Workout screen with all 5 mutation hooks + F7 + Avsluta overlay | ✓ VERIFIED | 936 LOC. WorkoutScreen (top-level Stack, NOT modal) with Stack.Screen headerRight Avsluta. Second OfflineBanner mounted inside route (Open Q#4 fix). loggedSetCount derived from `useSetsForSessionQuery(session.id)` for AvslutaOverlay D-23 copy variants (BLOCKER-01 fix). WR-07 fix applied — runtime narrowing on `useLocalSearchParams.sessionId`. ExerciseCard renders header (name + target chip + counter chip with success-state green swap), logged set rows, always-visible inline set-input row with `keyboardType="decimal-pad"`, `placeholderTextColor="#9CA3AF"`, `selectTextOnFocus={true}`, `min-h-[56px]`. D-10 prefill (session prefill OR F7 set-position-aligned). LoggedSetRow tap-to-edit + swipe-left ReanimatedSwipeable delete. AvslutaOverlay inline-overlay-confirm (NOT Modal portal), accent-blue primary, copy variants `{N} set sparade…` vs `Inget set är loggat…`, on success `router.replace("/(app)/(tabs)")`. |
| `app/app/(app)/plans/[id].tsx` | Plan-detail extended with "Starta pass" CTA | ✓ VERIFIED | "Starta pass" Pressable at line 461; `useStartSession(newSessionId)` with lazy-init `useState(() => randomUUID())` line 145; `canStart = (planExercises?.length ?? 0) > 0` line 225; disabled state + helper text "Lägg till minst en övning först" line 465 (drawn from accessibilityLabel logic). mutate (NOT mutateAsync) + synchronous `router.push("/workout/<id>" as Href)` line 249. |
| `app/app/(app)/_layout.tsx` | (app) Stack extended with workout/[sessionId] route | ✓ VERIFIED | Lines 82-85 `<Stack.Screen name="workout/[sessionId]" options={{ headerShown: true, title: "Pass" }} />`. NOT modal per D-03; inherits centralized header styling. |
| `app/components/active-session-banner.tsx` | Persistent global banner | ✓ VERIFIED | 76 LOC; renders only when `useActiveSessionQuery().data` non-null AND `segments` does NOT include "workout" (line 49-50). Info-blue role (`bg-blue-100 dark:bg-blue-950`, `border-blue-300 dark:border-blue-800`, `text-blue-900 dark:text-blue-100`). Ionicons time + chevron-forward. Full-row Pressable with `accessibilityRole="button"`, `accessibilityLabel="Återgå till pågående pass"`, `accessibilityLiveRegion="polite"`. Tap routes to `/workout/<id>`. |
| `app/app/(app)/(tabs)/_layout.tsx` | (tabs) layout EXTENDED with banner mount | ✓ VERIFIED | Line 30 import + line 39 `<ActiveSessionBanner />` mounted between `<OfflineBanner />` and `<Tabs>` inside the same SafeAreaView edges={['top']}. |
| `app/app/(app)/(tabs)/index.tsx` | Planer list EXTENDED with draft-resume overlay + toast | ✓ VERIFIED | 402 LOC. Draft-resume overlay (lines 282-292) with cold-start sentinel (state, not ref — UAT fix b8d45f4) so only true cross-launch drafts surface (UAT fixes 35efe5e/e89bb55). `DraftResumeOverlay` subcomponent (lines 324-401, WR-04 fix) takes required `sessionId` prop for stable scope. Backdrop is intentionally non-dismissable (force-decision UX, line 360-362). "Passet sparat ✓" toast via Reanimated `FadeIn.duration(200)` + `FadeOut.duration(200)` + `setTimeout(2000)` in useEffect (NOT FadeOut.delay). CR-02 fix applied — `previousActiveRef` updated unconditionally BEFORE the firing-branch decision (lines 154-170). |
| `app/scripts/test-rls.ts` | Cross-user RLS extended for Phase 5 | ✓ VERIFIED | Run produces 38 PASS / 0 FAIL (≥ 35 required by CLAUDE.md gate). Phase 5 extension block adds 5 new mutation-payload-shape assertions (workout_sessions UPDATE finished_at; INSERT with B's user_id; UPDATE notes; exercise_sets INSERT into B's session; UPDATE weight_kg) + 3 defense-in-depth admin SELECTs confirming B's data integrity preserved and no rogue rows inserted. |
| `app/scripts/manual-test-phase-05-f13-brutal.md` | 10-phase brutal-test recipe | ✓ VERIFIED | 244 LOC (≥ 100 required); 10 phases verbatim from RESEARCH.md lines 912-1027; pre-flight enumerates 11 npm test scripts + tsc + lint + service-role audit grep; pass criteria + failure-mode matrix (7 symptom → root-cause rows) + sign-off block. |
| Wave 0 test scripts (5) | Per VALIDATION.md | ✓ VERIFIED | `test:session-schemas` 4 PASS; `test:set-schemas` 10 PASS; `test:offline-queue` 7 PASS (4 Phase 4 + 3 Phase 5); `test:sync-ordering` 10 PASS (5 Phase 4 + 5 Phase 5); `test:last-value-query` 9 PASS lines / 5 assertion blocks. All exit 0. |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `app/app/(app)/plans/[id].tsx` | `lib/queries/sessions.ts useStartSession` | tap "Starta pass" → `mutate({ id: randomUUID(), user_id, plan_id, started_at: now })` + `router.push("/workout/<newId>")` | ✓ WIRED | Line 147 `useStartSession(newSessionId)`; line 229 `startSession.mutate({...})`; line 249 `router.push("/workout/${newSessionId}" as Href)`. Lazy-init UUID at line 145 keeps scope stable. |
| `app/app/(app)/workout/[sessionId].tsx` | `lib/queries/sets.ts useAddSet` | tap Klart → `mutate({ id, session_id, exercise_id, set_number, weight_kg, reps, completed_at, set_type: 'working' }, { onSuccess: reset })` | ✓ WIRED | Line 353 `useAddSet(sessionId)`; line 365-393 mutate with all fields; optimistic onMutate registered in `setMutationDefaults[['set','add']]` (client.ts:713). |
| `app/app/(app)/workout/[sessionId].tsx` | `lib/queries/last-value.ts useLastValueQuery` | per `plan_exercises.exercise_id` pre-fetch on mount with staleTime 15min | ✓ WIRED | Line 296 `useLastValueQuery(planExercise.exercise_id, sessionId)` inside ExerciseCard; staleTime in last-value.ts:120 = 15 min. |
| `app/app/(app)/workout/[sessionId].tsx` | `lib/queries/sessions.ts useFinishSession` | tap Avsluta → `mutate({ id, finished_at: now }, { onSuccess: router.replace })` | ✓ WIRED | Line 803 `useFinishSession(sessionId)`; line 815-821 mutate with id + finished_at; synchronous `onFinish()` → router.replace at line 193. |
| `app/components/active-session-banner.tsx` | `lib/queries/sessions.ts useActiveSessionQuery` | subscriber renders only when data non-null AND pathname does NOT start with `/workout` | ✓ WIRED | Line 36 `useActiveSessionQuery()`; line 49-50 segments check + early return. Tap routes to `/workout/<id>` line 54. |
| `app/app/(app)/(tabs)/index.tsx` | `lib/queries/sessions.ts useActiveSessionQuery + useFinishSession` | draft-resume overlay shows when query hits; primary calls router.push, secondary calls useFinishSession.mutate | ✓ WIRED | Line 108-109 `useActiveSessionQuery`; `DraftResumeOverlay` subcomponent (lines 324-401) mounts `useFinishSession(sessionId)` with REQUIRED sessionId prop (WR-04 fix); secondary button calls `handleAvslutaSession` (line 337-354). |
| `app/app/(app)/(tabs)/_layout.tsx` | `app/components/active-session-banner.tsx` | mounts `<ActiveSessionBanner />` directly above `<Tabs>` inside SafeAreaView | ✓ WIRED | Line 30 import + line 39 mount between OfflineBanner and Tabs. |
| `app/scripts/test-rls.ts` | supabase REST API (clientA + clientB + admin) | asserts cross-user INSERT/UPDATE/DELETE on workout_sessions + exercise_sets is blocked | ✓ WIRED | Phase 5 extension at lines 605-778 (per SUMMARY.md); test run produces 38 PASS, including the 5 Phase 5 cross-user mutation-payload shapes + 3 defense-in-depth. |
| `app/lib/query/network.ts` | `app/lib/query/persister.ts` | imports `asyncStoragePersister` instance for AppState background-flush | ✓ WIRED | Line 50 `import { asyncStoragePersister } from "@/lib/query/persister"`; line 96-99 `persistQueryClientSave({ queryClient, persister: asyncStoragePersister })`. CR-01 fix applied via globalThis sentinel (line 86-102). |
| `app/lib/query/client.ts` | `app/lib/schemas/{sessions,sets}.ts` | imports `SessionRowSchema` + `SetRowSchema` for mutationFn `.parse()` boundary | ✓ WIRED | Grep confirms imports + `RowSchema.parse(data)` usage at every Supabase response boundary (Pitfall 8.13 — never cast). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `workout/[sessionId].tsx` WorkoutScreen | `session` | `useSessionQuery(sessionId)` → Supabase `workout_sessions WHERE id=$id`, parsed via `SessionRowSchema` (sessions.ts:81-101) | Yes — initialData seeds from `sessionsKeys.active()`; otherwise live PostgREST query | ✓ FLOWING |
| `workout/[sessionId].tsx` WorkoutBody | `planExercises` | `usePlanExercisesQuery(session.plan_id)` (Phase 4) | Yes — live Supabase query with schema parse | ✓ FLOWING |
| `workout/[sessionId].tsx` WorkoutBody | `setsData` | `useSetsForSessionQuery(session.id)` → Supabase `exercise_sets WHERE session_id=$id ORDER BY exercise_id, set_number`, `SetRowSchema.parse()` per row | Yes — RLS-gated live data + optimistic append via `setMutationDefaults[['set','add']].onMutate` | ✓ FLOWING |
| `workout/[sessionId].tsx` ExerciseCard | `lastValueMap` | `useLastValueQuery(exerciseId, sessionId)` → two-step PostgREST query | Yes — real cross-session data, staleTime 15min; `Record<number, LastValueEntry>` survives JSON persister round-trip | ✓ FLOWING |
| `workout/[sessionId].tsx` AvslutaOverlay | `loggedSetCount` | derived from `useSetsForSessionQuery(session.id).data?.length ?? 0` at WorkoutScreen, passed as prop | Yes — same TanStack cache as WorkoutBody (dedupe by queryKey); BLOCKER-01 fix verified | ✓ FLOWING |
| `(tabs)/index.tsx` PlansTab | `activeSession` | `useActiveSessionQuery` → Supabase `workout_sessions WHERE user_id AND finished_at IS NULL` | Yes — RLS-double-gated live query | ✓ FLOWING |
| `(tabs)/index.tsx` DraftResumeOverlay | `activeSets` | `useSetsForSessionQuery(activeSession?.id ?? "")` (disabled-query fallback when no active) | Yes — used to format `{N} set sparade` body copy | ✓ FLOWING |
| `(tabs)/index.tsx` Toast | `showToast` | `useEffect` watching `activeSession` non-null→null transition + `setTimeout(2000)` | Yes — real query-value-transition signal, CR-02 fix applied (unconditional ref update) | ✓ FLOWING |
| `components/active-session-banner.tsx` | `activeSession` | `useActiveSessionQuery` (same hook as tabs/index — deduped) | Yes — only renders when truthy AND not on `/workout/*` segment | ✓ FLOWING |
| `lib/queries/last-value.ts` LastValueChip prefill | `prev` (`weight_kg`, `reps`) | step-2 query results, parsed via `SetRowSchema.partial().parse()` (Pitfall 8.13) | Yes — D-19 returns null when no data, never empty stub | ✓ FLOWING |

No HOLLOW or DISCONNECTED artifacts found. All UI surfaces wire to real queries; no hardcoded empty values flow to user-visible output.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Session schemas accept/reject per D-15 | `cd app && npm run test:session-schemas` | All 4 schema cases passed | ✓ PASS |
| Set schemas accept/reject per D-15 (weight_kg multipleOf, reps int, set_type enum) | `cd app && npm run test:set-schemas` | All 10 schema cases passed (incl. weight 1255 reject, 82.501 reject, negative reject, reps 0/non-int/61 reject, invalid set_type reject) | ✓ PASS |
| 25 `['set','add']` paused-mutation persist/restart preserves mutationKey + scope.id (F13 paused-cache survival) | `cd app && npm run test:offline-queue` | 7 PASS (4 Phase 4 + 3 Phase 5 extension): "25 ['set','add'] mutations re-hydrated with intact scope.id (F13 paused-cache survival)" | ✓ PASS |
| START → 25 SET → FINISH FIFO replay against real Supabase admin: contiguous set_number, finished_at last, no FK violations | `cd app && npm run test:sync-ordering` | 10 PASS: "25 sets in DB with contiguous set_number 1..25"; "workout_session.finished_at set after all 25 sets landed"; "no 23503 FK violations during replay" | ✓ PASS |
| F7 last-value query: most-recent-finished wins; current-session excluded; warmup filtered; cross-user RLS gate (A3 closure) | `cd app && npm run test:last-value-query` | 9 PASS across 5 assertion blocks (incl. Assertion 4: User B sees empty Map for User A's exercise — RLS cross-user gate) | ✓ PASS |
| Cross-user RLS for workout_sessions + exercise_sets (Phase 5 mutation payload shapes) | `cd app && npm run test:rls` | 38 PASS / 0 FAIL (≥ 35 threshold met); includes 5 Phase 5 cross-user assertions + 3 defense-in-depth | ✓ PASS |
| TypeScript type check clean | `cd app && npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Lint clean | `cd app && npx expo lint` | 0 errors, 1 warning (unused `Href` import in workout/[sessionId].tsx:62 — non-blocking info-tier) | ✓ PASS (with note) |
| Service-role isolation audit gate per CLAUDE.md | `git grep "service_role\|SERVICE_ROLE" -- "*.ts" "*.tsx" "*.js" "*.jsx" ":!.planning/" ":!app/scripts/" ":!app/.env.example" ":!CLAUDE.md"` | empty (no leaks outside allowlist) | ✓ PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes are declared by this phase. Phase 5 uses Node-only `tsx` scripts under `app/scripts/test-*.ts` invoked through npm scripts — these are executed in the Behavioral Spot-Checks section above.

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| (none) | — | — | — |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| F5 | 05-01, 05-02, 05-03 | Användare kan starta ett pass från en plan; skapar `workout_sessions`-rad direkt vid "Starta pass" | ✓ SATISFIED | Starta-pass CTA on plans/[id].tsx + useStartSession optimistic create + draft-recovery on cold start (Truth #1 + #5) |
| F6 | 05-01, 05-02 | Användare kan logga set (vikt + reps); ≤3 sek; per-set persistens (inte "save on finish") | ✓ SATISFIED | useAddSet per-tap mutate + optimistic onMutate <100ms cache write; no batch-on-finish path; D-15 strict schemas (Truth #2) |
| F7 | 05-01, 05-02 | Set-position-aligned senaste värde ("Förra: set 1: 82.5kg × 8") | ✓ SATISFIED | useLastValueQuery returns Record<setNumber, ...>; LastValueChip set-position-aligned; D-19 hides when no data; test-last-value-query 9 PASS (Truth #3) |
| F8 | 05-01, 05-02 | Användare kan avsluta och spara pass; sätter `finished_at`; ingen "Discard workout" | ✓ SATISFIED | AvslutaOverlay accent-blue primary (NOT red); no Discard button; router.replace("/(app)/(tabs)") on success (Truth #4) |
| F13 | 05-01, 05-02, 05-03 | Pass kan loggas helt utan nät; alla set överlever airplane mode + force-quit + battery-pull | ⚠ PARTIAL | Contract layer (offline-queue 25-set + sync-ordering 27-mutation FIFO replay) automated tests pass; manual brutal-test recipe ships; full end-to-end UAT NOT executed end-to-end per user direction — see Human Verification Required |

No ORPHANED requirements — every requirement ID declared by ANY plan in Phase 5 is accounted for in this verification, and every requirement REQUIREMENTS.md maps to Phase 5 (F5/F6/F7/F8/F13) is covered.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/app/(app)/workout/[sessionId].tsx` | 62 | Unused import `Href` | ℹ Info | Single lint warning. `as Href` cast was used during Plan 02 development but later removed when types regenerated; the import itself was not pruned. Non-blocking; cleanup deferred to next polish pass. |

Zero TBD / FIXME / XXX markers in modified files. Zero TODO / HACK / "coming soon" / "not yet implemented" anti-patterns in any of: `app/lib/schemas/*`, `app/lib/query/*`, `app/lib/queries/*`, `app/app/(app)/**/*.tsx`, `app/components/active-session-banner.tsx`. All `placeholder=` matches in workout/[sessionId].tsx are legitimate `<TextInput placeholder="Vikt|Reps" />` UI text, NOT data stubs.

### Code Review Status (05-REVIEW.md)

| ID | Type | Status |
| -- | ---- | ------ |
| CR-01 (AppState listener leak in network.ts) | Critical | ✓ FIXED in commit 7991014 (globalThis sentinel + Fast-Refresh teardown) |
| CR-02 (Toast `previousActiveRef` overwrite race) | Critical | ✓ FIXED in commit 7991014 (unconditional ref update BEFORE firing decision) |
| WR-01 (trailing-slash drift in router.replace) | Warning | ✓ FIXED in commit 7991014 |
| WR-02 (expo-secure-store version drift) | Warning | ✓ FIXED in commit 7991014 (CLAUDE.md stack table updated) |
| WR-03 (vars as SetRow cast at optimistic cache write) | Warning | ✓ FIXED in commit 7991014 |
| WR-04 (`useFinishSession(... ?? "noop")` sentinel) | Warning | ✓ FIXED in commit 7991014 (DraftResumeOverlay subcomponent with required sessionId) |
| WR-05 (AvslutaOverlay backdrop dismissal divergence) | Warning | ✓ FIXED in commit 7991014 (inline comment clarifying intentional divergence) |
| WR-06 (Unused `_sessionId` param in EditableSetRow) | Warning | ✓ FIXED in commit 7991014 |
| WR-07 (`useLocalSearchParams` array-shape guard) | Warning | ✓ FIXED in commit 7991014 (runtime narrowing applied) |
| IN-01 through IN-06 | Info | Not blocking; informational nits per 05-REVIEW.md |

All BLOCKERs and WARNINGs from 05-REVIEW.md are closed. Only info-tier items remain.

### Human Verification Required

**1. F13 Brutal-Test full end-to-end recipe on physical iPhone**

**Test:** Execute the 10-phase manual UAT in `app/scripts/manual-test-phase-05-f13-brutal.md` end-to-end on a physical iPhone via Expo Go: pre-flight automated gates → airplane mode toggle → start 25-set workout → force-quit at 2 checkpoints (Phase 5 and Phase 7 of the recipe) → reconnect → verify in Supabase Studio that all 25 sets land with contiguous `set_number` 1..25, `finished_at` after all sets, zero FK violations, zero duplicate PKs.

**Expected:** All 25 sets land in Supabase in correct `set_number` order. No FK violations (23503). No duplicate-PK errors (23505). `finished_at` is set on the session after all sets. Tester signs off in the sign-off block at the bottom of the recipe.

**Why human:** Cannot be automated. Requires native OS lifecycle that no test runner can simulate:
- Airplane-mode toggle: scriptable in Detox, but Detox shuts the app via JS bridge — not a true SIGKILL.
- Force-quit via app switcher: simulates user behavior; battery-pull scenario requires a true `kill -9` not available to JS test runners.
- OS-level RAM reclamation: only happens on physical devices under memory pressure.

The Wave 0 automated scripts (`test:offline-queue` 25-set paused-mutation persist/restart; `test:sync-ordering` START → 25 SETs → FINISH FIFO replay against real Supabase admin) **prove the contract layer** — that paused mutations serialize across persist/restart and that `scope.id` serializes replay correctly. They cannot prove the **end-to-end system** because they don't exercise iOS-specific lifecycle (background → SIGKILL → reload). This brutal-test is the system-level acceptance gate per CONTEXT.md F13 acceptance criterion #6.

**Status note (per user instruction during this verification request):**
- Crash-fix verified (workout screen renders without TypeError — commit da6c2a7 Map→Record).
- Basic happy path verified by user in-session (start, log sets, F7 chip works, Avsluta + toast).
- Cold-start recovery overlay verified to only fire for true cross-launch drafts (commits 35efe5e, e89bb55, b8d45f4).
- Full 25-set + airplane mode + force-quit recipe was NOT executed end-to-end (deferred per user — they approved code-side after happy-path test).

The user has explicitly indicated this is **recommended-but-not-blocking** for phase advancement. The automated gates pass; the manual recipe ships and is available for future execution. Flagging here for completeness and so the gap is auditable.

### Gaps Summary

**No blocker-tier gaps.** All ROADMAP Success Criteria #1–#5 are observably true in the codebase. ROADMAP Success Criterion #6 (F13 acceptance test) is **partially verified**: the contract-layer automated tests (paused-cache survival, FIFO replay, idempotent upserts, RLS cross-user) all pass, and the manual brutal-test recipe ships at `app/scripts/manual-test-phase-05-f13-brutal.md`. Per user instruction in the verification request, full end-to-end physical-device UAT is recommended but not blocking for this phase's verification status. It is surfaced as a human-verification item rather than a gap so it is auditable and re-runnable.

All 5 Phase 5 requirement IDs (F5, F6, F7, F8, F13) are SATISFIED at the implementation level (F13 partial as noted). All key links wired. All artifacts pass all four verification levels (exists, substantive, wired, data-flowing). All 2 CRITICAL + 7 WARNING code review findings closed in commit 7991014. Service-role audit gate green. RLS cross-user regression at 38 PASS (≥ 35 threshold met). TypeScript + lint clean (1 info-tier unused-import warning, non-blocking).

---

_Verified: 2026-05-13T20:33:14Z_
_Verifier: Claude (gsd-verifier)_
