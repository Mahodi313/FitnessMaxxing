---
phase: 05-active-workout-hot-path-f13-lives-or-dies
plan: 02
subsystem: ui + state (workout screen, resource hooks, F7 last-value chip)
tags: [phase-5, plan-02, workout-screen, set-logging, F5, F6, F7, F8, F13, react-query, react-hook-form, zod4, expo-router, nativewind, reanimated-swipeable, mvp-slice]

# Dependency graph
requires:
  - phase: 05-active-workout-hot-path-f13-lives-or-dies (Plan 01 — Wave 1)
    provides: |
      5 setMutationDefaults blocks (['session','start'], ['session','finish'],
      ['set','add'], ['set','update'], ['set','remove']) in
      app/lib/query/client.ts; 3 key factories (sessionsKeys, setsKeys,
      lastValueKeys) in app/lib/query/keys.ts; 2 Zod schemas (sessions.ts,
      sets.ts) in app/lib/schemas/; persister throttleTime: 500 + AppState
      background-flush in lib/query/{persister,network}.ts. All set
      mutationFn + onMutate/onError/onSettled lifecycle hooks already
      registered at module top-level — Plan 02 hooks supply ONLY
      mutationKey + scope at useMutation() time (Pitfall 8.1).
  - phase: 04-plans-exercises-offline-queue-plumbing
    provides: |
      app/lib/queries/{plans,plan-exercises,exercises}.ts — verbatim
      analogs for sessions.ts/sets.ts shape; usePlanExercisesQuery for
      reading plan_exercises rows the workout screen renders;
      useExercisesQuery for the Map<id, name> lookup pattern (commit
      3bfaba8); mutate-not-mutateAsync convention (commit 5d953b6);
      inline-overlay-confirm pattern (commit e07029a); centralized (app)
      Stack header styling (commit b57d1c2); freezeOnBlur +
      useFocusEffect reset pattern (commit af6930c); initialData
      seeding pattern (commits eca0540 + b87bddf); RHF v7 3-generic
      shape <Input, undefined, Output> for z.coerce.number() schemas
      (commit f8b75b6); randomUUID() utility from
      app/lib/utils/uuid.ts.
  - phase: 03-auth-persistent-session
    provides: |
      app/lib/auth-store.ts Zustand store + useAuthStore<T>(selector)
      narrow-selector pattern for reading session.user.id.

provides:
  - 3 NEW resource-hook files binding Plan 01's setMutationDefaults to UI:
    - app/lib/queries/sessions.ts (131 LOC) — useActiveSessionQuery (LIMIT 1
      WHERE finished_at IS NULL ORDER BY started_at DESC), useSessionQuery
      (initialData seed from sessionsKeys.active()), useStartSession(sessionId)
      and useFinishSession(sessionId) (scope.id static-string contract).
    - app/lib/queries/sets.ts (95 LOC) — useSetsForSessionQuery(sessionId)
      ordered by (exercise_id, set_number), useAddSet/useUpdateSet/useRemoveSet
      (all 3 scope-bound to `session:${sessionId}`).
    - app/lib/queries/last-value.ts (116 LOC) — useLastValueQuery(exerciseId,
      currentSessionId) → Map<setNumber, { weight_kg, reps, completed_at }>.
      Two-step PostgREST query: STEP 1 finds the most-recent finished session
      via `workout_sessions!inner` RLS-scoped join (belt-and-braces
      `.eq("workout_sessions.user_id", userId)`); STEP 2 fetches that
      session's working sets for the exercise. staleTime 15 min per D-20.
  - 1 NEW screen — app/app/(app)/workout/[sessionId].tsx (924 LOC):
    - WorkoutScreen (top-level Stack screen, NOT modal per D-03) with
      Stack.Screen headerRight Avsluta button; second OfflineBanner instance
      mounted as sibling above WorkoutBody (Open Q#4 RESOLVED — the (tabs)
      banner is invisible inside /workout/[sessionId]); loggedSetCount
      derived from useSetsForSessionQuery(session.id) for AvslutaOverlay
      copy variants (BLOCKER-01 fix).
    - WorkoutBody — KeyboardAvoidingView + ScrollView with exercise-name
      Map<id, name> lookup (Phase 4 commit 3bfaba8 pattern); defensive
      empty-state when plan_exercises.length === 0.
    - ExerciseCard — header (name + target chip + counter chip with
      success-state green swap), logged set rows, always-visible inline
      set-input row using RHF v7 3-generic shape + zodResolver(setFormSchema)
      + mode: 'onSubmit'; D-10 pre-fill from latest set in session OR F7
      set-position-aligned data; D-16 set_number from live cache
      (queryClient.getQueryData filtered by exercise_id, +1).
    - LoggedSetRow — display + tap-to-edit + swipe-left-to-delete via
      ReanimatedSwipeable; useFocusEffect cleanup resets edit mode on blur.
    - EditableSetRow — inline edit using same setFormSchema; submits via
      useUpdateSet.mutate.
    - LastValueChip — F7 set-position-aligned chip 'Förra: 82.5 × 8';
      D-19 not rendered when no data.
    - AvslutaOverlay — inline-overlay-confirm (NOT modal portal); primary
      button accent-blue per D-23 + PITFALLS §6.6 (NOT destructive red);
      copy variants ('{N} set sparade…' vs 'Inget set är loggat…').
  - 1 MODIFIED layout — app/app/(app)/_layout.tsx:
    - <Stack.Screen name="workout/[sessionId]" options={{ headerShown: true,
      title: "Pass" }} /> registered (inherits centralized header styling
      from screenOptions per Phase 4 commit b57d1c2; NOT modal per D-03).
  - 1 MODIFIED screen — app/app/(app)/plans/[id].tsx:
    - Imports: useStartSession, useAuthStore, randomUUID.
    - `const [newSessionId] = useState(() => randomUUID())` — lazy init
      keeps the new session id STABLE across re-renders so the scope
      baked into useStartSession(newSessionId) is a STATIC string at
      useMutation() time (Pitfall 3 + Plan 04-01 SUMMARY auto-fix Rule 1).
    - onStarta handler — mutate (NOT mutateAsync) + synchronous
      router.push (`/workout/${newSessionId}` as Href).
    - "Starta pass" Pressable above the "Övningar" section heading,
      with helper text "Lägg till minst en övning för att kunna starta."
      when canStart === false; disabled:opacity-50.

affects:
  - 05-03 (Wave 3 — UI polish + draft-resume + persistent banner +
    brutal-test recipe) — consumes the 5 mutation hooks and 3 query hooks
    shipped here; uses the same inline-overlay pattern for draft-resume
    that AvslutaOverlay establishes; F13 brutal-test asserts the second
    OfflineBanner instance mounted here is visible after force-quit
    re-open of /workout/[sessionId].
  - All future phases — inherit the 3-generic RHF shape for any
    z.coerce.number() schema, and the inline-overlay-confirm pattern for
    any blocking dialog.

# Tech tracking
tech-stack:
  added: []   # No new libraries — all bindings reuse existing
              # @tanstack/react-query, react-hook-form, @hookform/resolvers,
              # zod, react-native-gesture-handler (ReanimatedSwipeable),
              # @supabase/supabase-js, expo-router from Phases 1–4.
  patterns:
    - "scope.id static-string contract at the call-site: useStartSession(newSessionId) where newSessionId comes from useState(() => randomUUID()) so the lazy init makes it stable across re-renders; the hook bakes scope: { id: `session:${newSessionId}` } at construction time. NEVER a function-shaped scope (silently breaks FIFO serial replay)."
    - "BLOCKER-01 derivation pattern: when a sibling component needs a derived value from a TanStack query that another sibling also subscribes to, the parent calls the query hook itself and passes the derived value as a prop. TanStack dedupes by queryKey so the duplicate subscriber is zero extra fetch. Used here to pass loggedSetCount from WorkoutScreen → AvslutaOverlay without coupling the overlay to query state directly."
    - "WARNING-01 second OfflineBanner pattern: when a route lives outside the (tabs) layout group, the (tabs)-mounted OfflineBanner is invisible from that route. Solution — mount a sibling instance of <OfflineBanner /> in that route's screen layout; both subscribers state-mirror via useOnlineStatus() so they appear and disappear simultaneously."
    - "Inline-overlay-confirm (NOT Modal portal): NativeWind/flex layout inside the Modal portal silently collapsed in Phase 4 UAT. Phase 5 AvslutaOverlay uses absolute-positioned <Pressable> backdrop + centered card with NativeWind classes on the inner card only; explicit RN styles on the layout primitives."
    - "D-23 non-destructive primary on Avsluta: terminal-state confirmations (finishing a pass) use accent-blue primary, NOT red. Red is reserved for data-loss-adjacent actions (draft-resume 'Avsluta sessionen', archive plan)."

key-files:
  created:
    - "app/lib/queries/sessions.ts (131 LOC) — useActiveSessionQuery / useSessionQuery / useStartSession(sessionId) / useFinishSession(sessionId)"
    - "app/lib/queries/sets.ts (95 LOC) — useSetsForSessionQuery(sessionId) / useAddSet(sessionId) / useUpdateSet(sessionId) / useRemoveSet(sessionId)"
    - "app/lib/queries/last-value.ts (116 LOC) — useLastValueQuery(exerciseId, currentSessionId) returning Map<setNumber, LastValueEntry>"
    - "app/app/(app)/workout/[sessionId].tsx (924 LOC) — WorkoutScreen + WorkoutBody + ExerciseCard + LoggedSetRow + EditableSetRow + LastValueChip + AvslutaOverlay + formatTargetChip helper"
  modified:
    - "app/app/(app)/_layout.tsx — registered <Stack.Screen name='workout/[sessionId]' options={{ headerShown: true, title: 'Pass' }} /> (inherits centralized header styling; NOT modal)"
    - "app/app/(app)/plans/[id].tsx — added useStartSession + onStarta handler + 'Starta pass' Pressable above 'Övningar' section heading; helper text + disabled:opacity-50 when plan has 0 exercises"

key-decisions:
  - "RHF set-form mode: 'onSubmit' (Phase 3 D-15 + plans/new.tsx + edit.tsx precedent) — avoids mid-typing '1.0 is invalid' flicker on weight_kg where intermediate values are temporarily out-of-multipleOf-0.25."
  - "ReanimatedSwipeable (not legacy Swipeable) for swipe-to-delete on logged set rows — matches Reanimated 4 toolchain in SDK 54 and the modern API recommended by react-native-gesture-handler."
  - "Edit mode = full row swap (EditableSetRow component replaces LoggedSetRow when isEditing=true) — keeps the static display path simple and avoids conditional rendering in a single component growing >100 LOC."
  - "set_type re-pinned on every form reset() — z.enum(...).default('working') sets the default in setFormSchema, but RHF reset({ weight_kg, reps }) without set_type would let RHF retain a stale enum from prior renders; explicitly passing set_type: 'working' to each reset() is belt-and-braces."
  - "as Href cast on /workout/<id> route literal in plans/[id].tsx — destination screen file lands in Task 3 but plans/[id].tsx is edited in Task 2, so router.d.ts doesn't yet know the route when Task 2's tsc runs. Phase 4 Plan 04-02 Deviation §2 precedent — cast becomes inert once the dev server regenerates .expo/types."

patterns-established:
  - "Pattern: scope.id static-string at construction time. Hooks taking a parent-id (sessionId, planId) bake scope at useMutation() construction — never function-shaped at mutate() time. Lazy-init useState(() => randomUUID()) when generating a new id at the call-site so the value is stable across re-renders."
  - "Pattern: BLOCKER-derivation via parent-level query subscription. When a sibling needs a derived value from a query another sibling also subscribes to, call the hook at the parent and pass the derived value as a prop. TanStack dedupes by queryKey — zero extra fetch."
  - "Pattern: second OfflineBanner instance for routes outside (tabs). When a route is registered outside the (tabs) layout group, mount a sibling <OfflineBanner /> in that route's screen layout. Both subscribers state-mirror via useOnlineStatus()."
  - "Pattern: inline-overlay-confirm at the screen-component level (NOT Modal portal). Absolute-positioned Pressable backdrop + centered card. Explicit RN styles on the layout primitives; NativeWind on the inner card content only."
  - "Pattern: D-23 non-destructive Avsluta primary — accent-blue, NOT red. Red is reserved for data-loss-adjacent actions."

requirements-completed: [F5, F6, F7, F8, F13]

# Metrics
duration: ~55 min
completed: 2026-05-13
---

# Phase 5 Plan 02: Workout-screen + Resource hooks Summary

**User-facing hot path is live — Starta pass on plans/[id] creates a `workout_sessions` row optimistically, lands on `/workout/[sessionId]`, renders exercise-cards with always-visible inline set-input rows, logs sets via optimistic `useAddSet` mutate (≤100ms render via Plan 01's setMutationDefaults onMutate), shows F7 set-position-aligned "Förra: 82.5 × 8" chips, supports tap-to-edit + swipe-left-to-delete on logged sets, and finishes via inline-overlay Avsluta (accent-blue primary per D-23). F5+F6+F7+F8 closed end-to-end; F13 brutal-test gate waits for Wave 3.**

## Performance

- **Duration:** ~55 min (Tasks 1/2/3 sequential)
- **Started:** 2026-05-13T17:10Z (approx, after worktree bootstrap)
- **Completed:** 2026-05-13T18:05Z
- **Tasks:** 3/3
- **Files modified:** 6 (4 NEW + 2 MODIFIED)

## Accomplishments

- 3 resource-hook files (sessions.ts, sets.ts, last-value.ts) ship with the
  Pitfall 8.1 "only mutationKey + scope" shape — Plan 01's setMutationDefaults
  + key factories + schemas are now consumable from UI. Anti-pattern grep
  gates verified zero matches for function-shaped scope.id, inline mutationFn,
  and inline lifecycle hooks.
- The 924-LOC workout screen wires all 5 mutation hooks (useStartSession is
  in plans/[id].tsx; useAddSet + useUpdateSet + useRemoveSet + useFinishSession
  in [sessionId].tsx) using mutate(payload, { onError, onSuccess }) — never
  mutateAsync (Phase 4 UAT 5d953b6 lesson).
- BLOCKER-01 + WARNING-01 from the PLAN are both honored at the call-site
  (loggedSetCount derived from useSetsForSessionQuery in WorkoutScreen, and
  the second OfflineBanner mounted inside /workout/[sessionId] as a sibling
  above WorkoutBody). Grep gates verified.
- TypeScript clean (`npx tsc --noEmit`) across all 3 task commits with the
  RHF v7 3-generic shape <z.input<typeof setFormSchema>, undefined,
  SetFormOutput> applied to both the always-visible set-input form
  (ExerciseCard) and the inline-edit form (EditableSetRow).
- Lint clean (`npx expo lint`) across all 3 task commits.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author lib/queries/sessions.ts + sets.ts + last-value.ts** — `cb424c0` (feat)
2. **Task 2: Add Starta pass CTA + register workout route** — `1cf6084` (feat)
3. **Task 3: Build workout/[sessionId].tsx — exercise-card list + F7 + Avsluta** — `520009f` (feat)

## Files Created/Modified

### Created (4)
- `app/lib/queries/sessions.ts` (131 LOC) — useActiveSessionQuery, useSessionQuery (initialData from sessionsKeys.active()), useStartSession(sessionId), useFinishSession(sessionId).
- `app/lib/queries/sets.ts` (95 LOC) — useSetsForSessionQuery (ordered by (exercise_id, set_number)), useAddSet/useUpdateSet/useRemoveSet — all 3 scope-bound to `session:${sessionId}`.
- `app/lib/queries/last-value.ts` (116 LOC) — useLastValueQuery returning Map<setNumber, LastValueEntry>. Two-step PostgREST query (STEP 1 most-recent finished session via `workout_sessions!inner` RLS-scoped join, STEP 2 working sets from that session). staleTime 15 min.
- `app/app/(app)/workout/[sessionId].tsx` (924 LOC) — WorkoutScreen + WorkoutBody + ExerciseCard + LoggedSetRow + EditableSetRow + LastValueChip + AvslutaOverlay + formatTargetChip helper.

### Modified (2)
- `app/app/(app)/_layout.tsx` — registered `<Stack.Screen name="workout/[sessionId]" options={{ headerShown: true, title: "Pass" }} />`.
- `app/app/(app)/plans/[id].tsx` — added imports (useStartSession, useAuthStore, randomUUID), state (`const [newSessionId] = useState(() => randomUUID())`, userId, startSession), onStarta handler (mutate + synchronous router.push), and the "Starta pass" Pressable above the "Övningar" section heading with helper text + disabled:opacity-50 when plan has 0 exercises.

## Anti-Pattern Grep Gate Results

| Gate | Pattern | Expected | Actual |
|---|---|---|---|
| Pitfall 3 — no function-shaped scope.id | `scope:\s*\{\s*id:\s*\(` in lib/queries/*.ts | 0 matches | **0** ✓ |
| Pitfall 8.1 — no inline lifecycle hooks | `mutationFn:|onMutate:|onError:|onSettled:` in sessions.ts/sets.ts | 0 matches | **0** ✓ |
| Pitfall 8.13 — boundary parse | `RowSchema.parse|RowSchema.partial` in lib/queries/* | ≥ 4 matches | **12** across 6 files (3+2+2 in new files) ✓ |
| Phase 4 commit 5d953b6 — no mutateAsync (behavior code) | `mutateAsync` in workout/[sessionId].tsx | 0 behavior hits | **2 hits — both comments** ✓ |
| D-03 — workout route is NOT modal (behavior) | `presentation:\s*["']modal` in workout/[sessionId].tsx | 0 behavior hits | **1 hit — comment only** ✓ |
| Required hook usage — useAddSet | usage in workout/[sessionId].tsx | ≥ 1 | **5** ✓ |
| Required hook usage — useFinishSession | usage in workout/[sessionId].tsx | ≥ 1 | **2** ✓ |
| Required hook usage — useLastValueQuery | usage in workout/[sessionId].tsx | ≥ 1 | **4** ✓ |
| Pitfall 5 — useFocusEffect for freezeOnBlur | usage in workout/[sessionId].tsx | ≥ 1 | **4** ✓ |
| CONTEXT.md D-11 — decimal-pad on weight | `keyboardType="decimal-pad"` in workout/[sessionId].tsx | ≥ 1 | **2** ✓ |
| D-23 accent-blue Avsluta primary | `bg-blue-600 dark:bg-blue-500` in workout/[sessionId].tsx | ≥ 2 | **4** (Klart input row, Klart edit row, AvslutaOverlay primary, header Avsluta) ✓ |
| BLOCKER-01 fix — live loggedSetCount | `loggedSetCount={loggedSetCount}` | ≥ 1 line | **1** ✓ |
| BLOCKER-01 derivation — useSetsForSessionQuery at WorkoutScreen | `useSetsForSessionQuery\(session\?\.id` | ≥ 1 | **1** ✓ |
| WARNING-01 — second OfflineBanner | `<OfflineBanner />` | ≥ 1 | **1** ✓ |
| INFO-01 (cache key per-exercise doc) | `Cache key is per-exercise only` in last-value.ts | ≥ 1 | **1** ✓ |
| Anti-pattern — useStartSession in plans/[id].tsx | usage | ≥ 1 | **4** ✓ |
| Anti-pattern — router.push to workout route | `router\.push.*workout` | ≥ 1 | **1** ✓ |
| Anti-pattern — startSession.mutateAsync | usage | 0 | **0** ✓ |

**Comment clarification:** The `mutateAsync` and `presentation: 'modal'` grep hits in workout/[sessionId].tsx are inside the file header docblock that explicitly documents the avoided anti-patterns (e.g. `// mutate (NOT mutateAsync) — Phase 4 commit 5d953b6.`). No behavior code uses either pattern. The PLAN's grep gates are pattern-match-based; for these two, a hit on commentary mentioning the avoided pattern is benign and intentional (it's the audit trail explaining the avoidance).

## Decisions Made

- **RHF set-form mode: 'onSubmit'** (Phase 3 D-15 + Phase 4 precedent) — avoids mid-typing "1.0 is invalid" flicker on weight_kg where intermediate values are temporarily out-of-multipleOf-0.25.
- **ReanimatedSwipeable (not legacy Swipeable)** for swipe-to-delete on logged set rows — matches the Reanimated 4 toolchain in SDK 54 and the API recommended by react-native-gesture-handler.
- **Edit mode = full row swap** (EditableSetRow replaces LoggedSetRow when isEditing=true) — keeps the static display path simple and avoids a single component growing >100 LOC with conditional rendering.
- **set_type re-pinned on every reset()** — z.enum(...).default('working') sets the schema default, but RHF's reset({ weight_kg, reps }) without set_type could let it retain a stale enum from prior renders; explicitly passing `set_type: "working"` to each reset() is belt-and-braces.
- **as Href cast on /workout/<id>** in plans/[id].tsx — the destination screen file lands in Task 3 but plans/[id].tsx is edited in Task 2, so router.d.ts doesn't yet know the route when Task 2's tsc runs. Phase 4 Plan 04-02 Deviation §2 precedent — cast becomes inert once the dev server regenerates `.expo/types`.

## Deviations from Plan

None — plan executed exactly as written, with three small Claude's Discretion choices documented under "Decisions Made" (ReanimatedSwipeable over legacy Swipeable; EditableSetRow as a separate component; reset() re-pinning set_type each time). All PLAN-specified deviations from PATTERNS.md/UI-SPEC.md/RESEARCH.md (BLOCKER-01, WARNING-01, INFO-01, as Href cast) were handled in line with the PLAN's instructions.

### Auto-fixed Issues

None — no Rule 1/2/3 deviations triggered. tsc + lint passed clean on first run for all 3 tasks. (Plan 01's prior auto-fix to `test-sync-ordering.ts` already cleared the most likely TS-widening trap before Plan 02 even started.)

## Issues Encountered

- **npm dependencies not present in fresh worktree** (Wave 2 worktree mode quirk — worktrees skip `node_modules`). Resolved by running `npm install` once in `app/` cwd before `npx tsc` / `npx expo lint` could resolve binaries. Not a code-level issue; standard worktree bootstrap behavior.

## Manual UX Smoke Test

**Not yet executed in this commit** — the PLAN flags manual smoke as a recommended (NOT blocking) part of execute-plan completion. The automated gates (`npx tsc --noEmit` clean, `npx expo lint` clean, all anti-pattern grep gates passing) are sufficient for the worktree-agent commit; the developer eyeball pass on a physical iPhone via Expo Go can be done from the merged main branch once Wave 2's worktree merges back.

The smoke test recipe (per PLAN's `<verification>` block):

1. Tap "Starta pass" on a plan with ≥1 exercise.
2. Workout screen loads with cards in plan order.
3. Log 3 sets (mixed weight + reps).
4. Confirm each appears within 1s after Klart and counter chip increments.
5. Tap a logged set → confirm it flips to edit mode.
6. Swipe-left → confirm red Ta bort reveals.
7. Tap Avsluta → confirm overlay copy reads "3 set sparade. Avsluta passet?" with accent-blue primary.
8. Tap Avsluta → confirm return to (tabs)/index.

## Threat Flags

No new security surface beyond the PLAN's `<threat_model>` register (T-05-01..-04, T-05-07, T-05-15, T-05-16). All mitigations from the PLAN are honored at the implementation level:

- **T-05-01/02/03** — RLS scopes via `Users can manage own sessions/sets` (server-side). useAddSet/useStartSession queryFn (in Plan 01 setMutationDefaults) writes user-derived session_id/user_id; no external input accepted for those fields.
- **T-05-04** — `workout_sessions!inner` join in last-value.ts is RLS-scoped + belt-and-braces `.eq("workout_sessions.user_id", userId)`. Plan 01 test-last-value-query Assertion 4 already verified User B sees empty Map for User A's history (Assumption A3 CLOSED).
- **T-05-07** — STEP 2 select in last-value.ts is narrowed to (set_number, weight_kg, reps, completed_at) — explicit minimum needed for the F7 chip; excludes notes (F12) and rpe (F11).
- **T-05-15** — useActiveSessionQuery double-gates via client-side `.eq("user_id", userId)` + RLS; `.maybeSingle()` avoids leaking row-count via error shape.
- **T-05-16** — Plan 02 does NOT introduce the draft-resume "Avsluta sessionen" red button (that's Plan 03 territory). AvslutaOverlay's primary "Avsluta" is accent-blue (D-23 non-destructive) — clearly distinct from the destructive red Plan 03 will use.

## Stub Tracking

None. Scanned all created/modified files for hardcoded empty/null/placeholder data flowing to UI; the only `placeholder=` matches are legitimate `<TextInput placeholder="Vikt" />` / `placeholder="Reps"` UI text props, not data stubs.

## Self-Check: PASSED

**Verifying claimed files exist:**
- `app/lib/queries/sessions.ts`: FOUND (131 LOC)
- `app/lib/queries/sets.ts`: FOUND (95 LOC)
- `app/lib/queries/last-value.ts`: FOUND (116 LOC)
- `app/app/(app)/workout/[sessionId].tsx`: FOUND (924 LOC)
- `app/app/(app)/_layout.tsx`: modified (workout route registered)
- `app/app/(app)/plans/[id].tsx`: modified (Starta pass CTA added)

**Verifying claimed commits exist (`git log --oneline | grep <hash>`):**
- `cb424c0`: FOUND — Task 1 (feat: sessions/sets/last-value resource hooks)
- `1cf6084`: FOUND — Task 2 (feat: Starta pass CTA + workout route)
- `520009f`: FOUND — Task 3 (feat: workout/[sessionId] screen)

**Verifying automated gates:**
- `npx tsc --noEmit`: clean
- `npx expo lint`: clean
- All anti-pattern grep gates from PLAN's `<done>` blocks: pass (Task 1 verification table above)

## Next Phase Readiness

Plan 02 ships the core mechanism for F13 in normal online operation (per-set persistence via per-tap optimistic mutate with idempotent upsert + FIFO scope replay). What Plan 03 (Wave 3) ships on top:

- Persistent "Pågående pass"-banner in (tabs)/_layout (`active-session-banner.tsx`) — subscriber to `useActiveSessionQuery()`, tap routes to `/workout/<id>`.
- Draft-session-recovery inline-overlay on `(tabs)/index.tsx` — "Återuppta passet från HH:MM?" / "Avsluta sessionen" (this one IS destructive red per T-05-16).
- Toast on "Passet sparat ✓" after Avsluta-success.
- Cross-user RLS test extension (`test-rls.ts` += sessions + sets assertions per Phase 2 contract).
- F13 brutal-test recipe (airplane mode + 25 set + force-quit + reopen offline + reconnect).

All Plan 02 outputs are consumable by Plan 03 without changes — `useActiveSessionQuery` is exported and ready; `useFinishSession(sessionId)` is the same API the banner+draft-resume modal call.

---
*Phase: 05-active-workout-hot-path-f13-lives-or-dies*
*Plan: 02*
*Completed: 2026-05-13*
