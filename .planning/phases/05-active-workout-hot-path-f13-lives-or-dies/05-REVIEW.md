---
phase: 05-active-workout-hot-path-f13-lives-or-dies
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - app/app/(app)/(tabs)/_layout.tsx
  - app/app/(app)/(tabs)/index.tsx
  - app/app/(app)/_layout.tsx
  - app/app/(app)/plans/[id].tsx
  - app/app/(app)/workout/[sessionId].tsx
  - app/app/(auth)/_layout.tsx
  - app/components/active-session-banner.tsx
  - app/lib/queries/last-value.ts
  - app/lib/queries/sessions.ts
  - app/lib/queries/sets.ts
  - app/lib/query/client.ts
  - app/lib/query/keys.ts
  - app/lib/query/network.ts
  - app/lib/query/persister.ts
  - app/lib/schemas/sessions.ts
  - app/lib/schemas/sets.ts
  - app/package.json
  - app/scripts/manual-test-phase-05-f13-brutal.md
  - app/scripts/test-last-value-query.ts
  - app/scripts/test-offline-queue.ts
  - app/scripts/test-rls.ts
  - app/scripts/test-session-schemas.ts
  - app/scripts/test-set-schemas.ts
  - app/scripts/test-sync-ordering.ts
findings:
  critical: 2
  warning: 7
  info: 6
  total: 15
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-13
**Depth:** standard
**Files Reviewed:** 23 (24 listed in config; `app/scripts/test-rls.ts` was reviewed but Phase 5 only added an extension to it)
**Status:** issues_found

## Summary

Phase 5 ships the active-workout hot path (F5/F6/F7/F8/F13) with the offline-first guarantees Phase 4 set up. The architecture is sound and most of the load-bearing invariants (scope.id static at construction time, optimistic dual-writes to `sessionsKeys.active()` + `sessionsKeys.detail(id)`, Zod-parse-at-boundary for all Supabase reads, RLS cross-user gates extended in `test-rls.ts` for the F5/F6/F8 payload shapes, two-belt persister durability via throttle 500ms + AppState background-flush) hold up under scrutiny.

However, two BLOCKERs surface:

1. **`AppState.addEventListener` in `lib/query/network.ts` is never unsubscribed** — the AppState background-flush subscription leaks for the lifetime of the JS runtime. While `network.ts` is module-load-once so this won't compound, the second AppState listener (the `focusManager` one) IS unsubscribed via the returned `sub.remove()` callback — the asymmetry is a real bug because Fast Refresh during development re-evaluates the module, stacking subscriptions and double-firing the persister flush on every background event. This becomes a correctness issue when paired with the next finding.
2. **`(tabs)/index.tsx` toast `useEffect` mutates `previousActiveRef.current = activeSession` BEFORE the cleanup function runs**, but ALSO inside the cleanup-returning branch — the cleanup `clearTimeout` is only registered on the rising edge, and the ref-update inside that branch silently swallows the next transition. Concretely: if the user starts session Y while the toast for finishing session X is still visible, `previousActiveRef.current = activeSession` (which is now Y) blocks the next non-null→null detection. This is a F8 "Passet sparat" toast suppression bug under the (admittedly rare) double-finish workflow.

Five additional WARNINGs cover: a typed-route trailing-slash drift in `workout/[sessionId].tsx` router.replace, an `expo-secure-store` version mismatch against the documented SDK 54 line, the optimistic cache write that bypasses `SetRowSchema.parse` and casts `vars as SetRow` (loses the Zod boundary guarantee Pitfall 8.13 was written to enforce), a missing `enabled: !!sessionId` on `useFinishSession` mutate guard (the `?? "noop"` fallback queues a no-op scope), the AvslutaOverlay backdrop-tap dismissal that conflicts with the force-decision UX the draft-resume overlay implements, an unused `_sessionId` parameter in `EditableSetRow`, and a missing `useLocalSearchParams` array-shape guard on `sessionId`.

Info-tier items round out with sub-optimal naming, dead/unreachable branches, and inconsistencies in scope.id contract documentation between hook construction sites.

## Critical Issues

### CR-01: AppState listener leak in `network.ts` — Fast Refresh stacks subscriptions; AppState background-flush fires N times after N reloads

**File:** `app/lib/query/network.ts:77-84`
**Issue:** The `AppState.addEventListener("change", ...)` call for the Phase 5 D-25 background-flush is fire-and-forget — its returned `EventSubscription` is never captured, so neither the symmetry-pair `sub.remove()` nor a module-teardown is possible. The focus-manager listener directly above (lines 56-61) IS captured via `const sub = AppState.addEventListener(...)` and returns `sub.remove` to the focusManager — so the project clearly knows the pattern.

Under Expo Fast Refresh, `network.ts` is re-evaluated whenever it (or any of its imports — `client.ts`, `persister.ts`, `supabase.ts`) is edited, which stacks a second background-flush subscription on top of the first. After three reloads, every AppState transition to `background` fires `persistQueryClientSave` three times. Since `persistQueryClientSave` performs a full dehydrate + AsyncStorage write, this triples the work during the most latency-sensitive moment (the user is swiping the app away mid-set-log) — which directly contradicts the Phase 5 D-25 hot-path durability gate the listener is meant to harden.

In production builds Fast Refresh is off, so this manifests only in dev. But the same pattern means a future refactor that ever calls `network.ts` more than once would silently double-persist forever with no diagnostic.

**Fix:**
```typescript
// app/lib/query/network.ts — capture the subscription so it can be removed,
// matching the focusManager pattern directly above.
const appStateBackgroundSub = AppState.addEventListener("change", (s) => {
  if (Platform.OS !== "web" && (s === "background" || s === "inactive")) {
    void persistQueryClientSave({
      queryClient,
      persister: asyncStoragePersister,
    });
  }
});

// In a future refactor, expose a teardown for this module:
export function teardownNetworkListeners() {
  appStateBackgroundSub.remove();
  // (also tear down NetInfo + focusManager subs symmetrically)
}
```

For Fast Refresh durability specifically, gate the subscription behind a `globalThis` flag so re-evaluation doesn't stack:
```typescript
const SUB_KEY = "__fitnessmaxxing_appstate_bgflush_sub__";
// @ts-expect-error - module-level singleton flag
if (globalThis[SUB_KEY]) globalThis[SUB_KEY].remove();
const appStateBackgroundSub = AppState.addEventListener(/* ... */);
// @ts-expect-error
globalThis[SUB_KEY] = appStateBackgroundSub;
```

### CR-02: Toast suppression bug — `previousActiveRef` overwrite inside cleanup-returning branch swallows next finish transition

**File:** `app/app/(app)/(tabs)/index.tsx:159-168`
**Issue:** The toast trigger effect detects the `active=non-null → active=null` edge correctly, but inside the early-return branch it ALSO writes `previousActiveRef.current = activeSession` (line 164) before returning the cleanup. The intent appears to be "stamp the ref so we don't re-fire on next render", but the same write happens on the fall-through path (line 167) on every render — making the line 164 write redundant AND harmful.

Concrete failure trace (F8 double-finish): user finishes session X → effect runs with `prev=X, current=null` → toast fires → ref updated to null → cleanup registered. User starts session Y within 2s → effect runs with `prev=null, current=Y` → falls through to line 167, ref becomes Y. User finishes Y immediately (UAT scenario "abort and restart workout") → effect runs with `prev=Y, current=null` → toast SHOULD fire again. It does. Fine.

But: if the user TAPS Avsluta on Y while X's 2s toast timer is STILL ACTIVE (i.e., the 2-second window from the X toast hasn't elapsed), the cleanup from X's effect run runs (clears X's timer), then Y's branch enters with `prev != null && current==null` → fires another toast — but the SHARED `setTimeout(2000)` resets the `showToast=false` clock from scratch. End user sees a single, longer "Passet sparat" toast. Visually acceptable.

The actual bug: there's nothing PREVENTING the line 164 write from also running on a NON-fire render. Consider this race: `prev=X, current=X` (no transition) → effect runs because deps `[activeSession]` registered a new query result snapshot of equal `.id` but new object identity from cache invalidation (Supabase refetch). The `previousActiveRef.current != null && activeSession == null` check fails (current is still X). Effect falls through to line 167. Fine.

BUT: in React's StrictMode (Expo dev sometimes opts in), the effect runs TWICE on mount. First pass: `prev=undefined, current=X` (initial). The check `prev != null` is false. Fall through. `prev = X`. Cleanup not registered. Second pass: cleanup-from-first-pass runs (none registered, so no-op). Effect re-runs with `prev=undefined` again (the second pass uses the value at the time of effect-creation, not the current ref). Falls through. `prev = X`.

This means under StrictMode the toast trigger logic is correct only because `previousActiveRef.current` is `useRef`-mutable. But the cleanup-return path at line 165 captures `t` in closure — and after the cleanup runs once (timer cleared), the toast.current stays `true`. The branch at line 161 fires `setShowToast(true)` again on the next render, but the cleanup-return from THAT render (a second timer) is now active. Two timers running. Not catastrophic — `setShowToast(false)` is idempotent — but a sign the state machine is brittle.

The real bug is more subtle: **line 164's `previousActiveRef.current = activeSession` runs BEFORE the cleanup returns**, meaning subsequent renders where `activeSession` mutates BETWEEN this fire-render and cleanup-firing-render leave the ref pointing at the firing-render snapshot. If a third party (a query invalidation, a refetch) flips `activeSession` from null back to a fresh non-null Y in the same React frame, the cleanup-from-current effect still hasn't run, and the next effect call sees `prev != null` (because line 164 stamped it null) — so the user-fired toast for finishing X never re-arms correctly when Y is created and finished in rapid succession.

**Fix:** Remove the redundant ref-write inside the firing branch; let line 167's single write handle every render uniformly:
```typescript
useEffect(() => {
  const prev = previousActiveRef.current;
  previousActiveRef.current = activeSession; // always update first
  if (prev != null && activeSession == null) {
    setShowToast(true);
    const t = setTimeout(() => setShowToast(false), 2000);
    return () => clearTimeout(t);
  }
}, [activeSession]);
```

The reordered effect captures `prev` at the top, updates the ref unconditionally, then decides whether to fire the toast based on the captured `prev`. Cleanup is registered only when a timer is actually scheduled. No double-register, no swallowed transition.

## Warnings

### WR-01: Trailing-slash drift in `router.replace("/(app)/(tabs)/" as Href)` — bypasses typed-routes via `as Href` cast

**File:** `app/app/(app)/workout/[sessionId].tsx:186`
**Issue:** The Avsluta-finish flow routes via `router.replace("/(app)/(tabs)/" as Href)`. The (auth) layout fix (commit 35efe5e) explicitly settled the typed-route as `/(app)/(tabs)` (no trailing slash) — see `app/app/(auth)/_layout.tsx:21`. The trailing slash + `as Href` cast bypasses Expo Router 6's typed-routes check, which means future router.d.ts regeneration will not catch a drift here. At runtime Expo Router normalises trailing slashes, so this works today, but the inconsistency means a future grep for "the canonical home route" returns two different forms.

**Fix:**
```typescript
// app/app/(app)/workout/[sessionId].tsx:186
router.replace("/(app)/(tabs)"); // drop trailing slash, drop `as Href` cast
```

If the cast is needed because router.d.ts hasn't regenerated for this build, run `npx expo start` once to force regeneration, then drop the cast as the comment at line 31-33 of `(tabs)/index.tsx` says future cleanup should do.

### WR-02: `expo-secure-store@~15.0.8` drifted from CLAUDE.md-documented `~14.0.1` for SDK 54

**File:** `app/package.json:49`
**Issue:** CLAUDE.md technology-stack table explicitly pins `expo-secure-store: ~14.0.1` against SDK 54, with a callout that 55.x is the SDK 55 (next) line and `npx expo install` should pin the right version. The current dependency declaration is `"expo-secure-store": "~15.0.8"`.

This may be a stack-doc update lag (SDK 54 minor revision shifted the expo-secure-store baseline to 15.x), but if it's a drift from `npm install` instead of `npx expo install`, the LargeSecureStore Supabase auth wrapper may have native-module ABI incompatibilities on a physical device. M3 (broken authentication) is the OWASP MASVS L1 control this dependency underpins.

`@shopify/react-native-skia` is similarly drifted: CLAUDE.md says `2.6.2`, package.json says `2.2.12`. Both should be cross-checked against the actual SDK 54 expected versions via `npx expo install --check`.

**Fix:** Run `npx expo install --check` from `app/` and pin to whichever is correct. If CLAUDE.md is stale, also update the stack table to match.

### WR-03: Optimistic cache writes cast `vars as SetRow` — bypass the Zod boundary CLAUDE.md mandates

**File:** `app/lib/query/client.ts:720, 726-727 (and pattern-mirror sites for sessions, plans, plan-exercises)`
**Issue:** Every optimistic `onMutate` block uses `queryClient.setQueryData<SetRow[]>(setsKeys.list(vars.session_id), (old = []) => [...old, vars as SetRow])`. The `vars as SetRow` cast forces the partial `SetInsertVars` shape into the canonical row shape, but SetInsertVars has `completed_at` as OPTIONAL whereas SetRow has it as `string | null` (non-optional). When the input lacks `completed_at`, the cache holds a row with `completed_at: undefined`, which is NOT what `SetRowSchema.parse` would produce — Zod nullable defaults differently.

This is the exact false-pass risk CLAUDE.md §"M7 — Client code quality" calls out: untyped casts at the cache boundary mean the runtime contract diverges from the schema contract. The mutationFn's `.upsert(...).select().single()` round-trips through `SetRowSchema.parse(data)` on success — so the cache eventually reconciles. But during the offline window (which can be hours), the consumer screens consume a SetRow with `undefined` fields not allowed by the schema.

Consumer impact in this phase: `LastValueChip` (workout/[sessionId].tsx:756-758) reads `lastValueMap?.[setNumber]` which expects `weight_kg`/`reps` fields. F7's lastValueMap is server-only data so this is safe. But `useSetsForSessionQuery` consumers (the optimistic-appended cache) call `set.weight_kg` and `set.reps` directly — and the upsert vars MUST include both (TypeScript enforces this via `SetInsertVars`). So no immediate consumer breaks. The risk surfaces if a future consumer reads `set.completed_at` from the optimistic cache and gets `undefined` instead of `null` or an ISO string.

**Fix:** Either narrow the cache type to `Partial<SetRow>` to make the optionality explicit, or build the optimistic row explicitly with `null`-filled defaults:
```typescript
queryClient.setQueryData<SetRow[]>(setsKeys.list(vars.session_id), (old = []) => [
  ...old,
  {
    id: vars.id,
    session_id: vars.session_id,
    exercise_id: vars.exercise_id,
    set_number: vars.set_number,
    weight_kg: vars.weight_kg,
    reps: vars.reps,
    set_type: vars.set_type ?? "working",
    completed_at: vars.completed_at ?? new Date().toISOString(),
    rpe: vars.rpe ?? null,
    notes: vars.notes ?? null,
  } satisfies SetRow,
]);
```

The `satisfies SetRow` keeps TypeScript honest without a cast. Apply the same pattern to `setMutationDefaults['session','start']` and any other `vars as Row` optimistic write.

### WR-04: `useFinishSession(activeSession?.id ?? "noop")` in `(tabs)/index.tsx` queues a `session:noop`-scoped no-op when activeSession is null

**File:** `app/app/(app)/(tabs)/index.tsx:152`
**Issue:** The hook constructor binds `scope: { id: 'session:noop' }` when `activeSession?.id` is undefined. The comment at lines 142-151 says "the noop scope never actually queues anything" because `handleAvslutaSession` guards via `if (!activeSession) return;`. That's true at the callsite level, but the hook returns a usable `mutate` function — if any future refactor (or a stray re-render race) ever calls `finishSession.mutate(...)` while activeSession is null, the mutation enters the cache under `session:noop` scope and replays on reconnect with arbitrary vars.

The accepted-here pattern in the comment is "one-shot per draft, optimistic clears active immediately". Phase 5's contract is "scope.id is a static string per Pitfall 3" — using `"noop"` satisfies the type system but not the spirit of the contract, because two different sessions sequentially could both flow through the same `session:noop`-scoped hook instance if the cache flips active→null→fresh-active in one frame.

**Fix:** Change the hook signature in `app/lib/queries/sessions.ts` to require sessionId (no default), and guard the (tabs)/index.tsx call site to only mount the hook when activeSession is non-null:
```typescript
// app/lib/queries/sessions.ts
export function useFinishSession(sessionId: string) {  // required, not optional
  return useMutation<SessionRow, Error, SessionFinishVars>({
    mutationKey: ["session", "finish"] as const,
    scope: { id: `session:${sessionId}` },
  });
}
```

In (tabs)/index.tsx, the draft-resume overlay only renders when `shouldShowDraftOverlay && activeSession`. Lift the Avsluta UI into its own subcomponent that takes `sessionId: string` as a required prop:
```tsx
{shouldShowDraftOverlay && activeSession && (
  <DraftResumeOverlay
    sessionId={activeSession.id}
    startedAt={activeSession.started_at}
    setsCount={setsCount}
    onResume={() => router.push(`/workout/${activeSession.id}` as Href)}
    onDismiss={() => setDismissedForSessionId(activeSession.id)}
  />
)}
```

Inside `DraftResumeOverlay`, call `useFinishSession(sessionId)` — `sessionId` is now a guaranteed string captured at mount, the hook gets a static scope, and no `"noop"` sentinel exists.

### WR-05: AvslutaOverlay backdrop-tap dismisses — inconsistent with draft-resume overlay's force-decision UX

**File:** `app/app/(app)/workout/[sessionId].tsx:826-841`
**Issue:** The `<Pressable>` backdrop in AvslutaOverlay has `onPress={onCancel}` (line 839). Tapping outside the dialog dismisses it. But the draft-resume overlay in `(tabs)/index.tsx:307-312` deliberately does NOT register `onPress` on its backdrop — per UI-SPEC §line 250 "force-decision UX, backdrop does NOT dismiss". The two overlays are visually identical inline-overlay-confirm patterns; their dismissal behavior diverges.

Adversarial scenario: user is logging set 25, accidentally taps Avsluta in the header. The Avsluta dialog appears. User wants to cancel and continue. Tapping anywhere outside dismisses — correct expected behavior. So actually backdrop-dismiss IS the right UX for Avsluta-during-workout, because the user can always re-tap Avsluta if they meant to finish. The DRAFT-RESUME overlay is force-decision because either "Återuppta" or "Avsluta sessionen" is required (the orphan session is data-loss-adjacent if left undecided).

The issue isn't that one dismisses and one doesn't — it's that the divergence isn't documented in either overlay's prose, so a future engineer copying one pattern to a new screen will pick the wrong dismissal behavior. Either: (a) add an inline comment to AvslutaOverlay explaining why this overlay dismisses while the draft-resume one doesn't, OR (b) standardize both to force-decision per CLAUDE.md's "destructive confirmation" convention.

**Fix:** Add a comment to AvslutaOverlay clarifying the intentional divergence:
```typescript
// AvslutaOverlay: backdrop-tap dismisses (onPress={onCancel}). This DIVERGES
// from the draft-resume overlay in (tabs)/index.tsx (which uses force-decision
// UX). Rationale: Avsluta-during-workout is recoverable — the user can re-tap
// Avsluta in the header — whereas the draft-resume overlay surfaces an orphan
// session that MUST be either resumed or explicitly closed, so backdrop-dismiss
// would leave the user in an ambiguous state. UI-SPEC §line 250 (force-decision)
// vs §line 558 (Avsluta-during-workout, dismissible).
```

### WR-06: Unused `_sessionId` parameter in `EditableSetRow` — destructured but never referenced

**File:** `app/app/(app)/workout/[sessionId].tsx:645, 649`
**Issue:** `EditableSetRow` destructures `sessionId: _sessionId` from props but never uses it in the function body. The parent `LoggedSetRow` (line 583) passes `sessionId={sessionId}` to `EditableSetRow`. The actual UPDATE mutation happens in `LoggedSetRow`'s `onDone` callback (line 586-591), not inside `EditableSetRow`. The prop and the destructure are inert.

ESLint's `@typescript-eslint/no-unused-vars` should catch this with the underscore-prefix convention exempting it — but the prop is still on the public function signature, advertising an API contract that's never honoured. A future engineer reading EditableSetRow's signature will assume it owns the mutation, then refactor and break the data flow.

**Fix:** Remove `sessionId` from `EditableSetRow`'s prop signature entirely (it doesn't need it), and from the `LoggedSetRow` call site (line 583).

### WR-07: `useLocalSearchParams<{ sessionId: string }>()` claims string but params may also be string[]

**File:** `app/app/(app)/workout/[sessionId].tsx:107`
**Issue:** Expo Router's `useLocalSearchParams` runtime type is `Record<string, string | string[]>` — a route param can be `string[]` for catch-all routes (`[...slug].tsx`) or under URL-array notation. The generic argument `<{ sessionId: string }>` is a type assertion, not a runtime narrowing. The downstream usage `useSessionQuery(sessionId ?? "")` (line 121) treats it as `string | undefined`, but if `sessionId` is ever `string[]` (theoretically possible if a malformed deep-link arrives), TanStack receives an array as the query key — different cache entry, query likely fails, no diagnostic.

In practice `[sessionId].tsx` is a single-segment dynamic route so the runtime value is always `string | undefined`. The risk is theoretical for V1. But the same screen guards against `useLocalSearchParams` returning undefined (`session?.id ?? ""` on line 128), so the codebase already acknowledges the type isn't reliable.

**Fix:** Add a runtime guard:
```typescript
const params = useLocalSearchParams<{ sessionId: string }>();
const sessionId = typeof params.sessionId === "string" ? params.sessionId : undefined;
if (!sessionId) {
  return <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">{/* invalid-route fallback */}</SafeAreaView>;
}
```

This collapses the type-narrowing and the !session loading gate into one early-return.

## Info

### IN-01: `LastValueChip` re-subscribes to `useLastValueQuery` unnecessarily — already pre-fetched in `ExerciseCard`

**File:** `app/app/(app)/workout/[sessionId].tsx:289-292, 756`
**Issue:** `ExerciseCard` calls `useLastValueQuery(planExercise.exercise_id, sessionId)` at line 289, then renders `<LastValueChip exerciseId={planExercise.exercise_id} sessionId={sessionId} />` which calls `useLastValueQuery` AGAIN at line 756. TanStack dedupes by queryKey so this is zero extra fetch, but the second `useQuery` subscription is gratuitous — the parent already has `lastValueMap` in scope and could pass `lastValueMap?.[setNumber]` as a prop.

Sub-optimal but not buggy. The comment at lines 11-12 of workout/[sessionId].tsx already calls out the dedupe pattern for `useSetsForSessionQuery` — the same justification applies here, just with a slightly more grating cost (each ExerciseCard mount adds a useQuery subscription per card, and useLastValueQuery is per-exercise, so a 10-exercise plan creates 20 subscriptions where 10 would suffice).

**Fix:** Pass `prev` as a prop to `LastValueChip`:
```tsx
<LastValueChip prev={lastValueMap?.[currentSetNumber]} />
```
And drop the second `useLastValueQuery` call.

### IN-02: `coldStartSessionId` triple-state (`undefined` → `null` → `string`) confuses cold-start sentinel semantics

**File:** `app/app/(app)/(tabs)/index.tsx:129-138`
**Issue:** `coldStartSessionId` is initialized to `undefined` and transitions to `null` (no active session at cold-start) or `string` (active session id at cold-start). The sentinel logic at line 133 `if (coldStartSessionId === undefined && !activeSessionPending)` is correct but the type `string | null | undefined` makes the read sites (line 138) opaque.

A clearer state machine: a single boolean `coldStartCaptured` plus the captured session id:
```typescript
const [coldStartActiveId, setColdStartActiveId] = useState<string | null>(null);
const [coldStartCaptured, setColdStartCaptured] = useState(false);
useEffect(() => {
  if (!coldStartCaptured && !activeSessionPending) {
    setColdStartActiveId(activeSession?.id ?? null);
    setColdStartCaptured(true);
  }
}, [activeSession, activeSessionPending, coldStartCaptured]);
const isColdStartDraft = activeSession?.id != null && coldStartActiveId === activeSession.id;
```

Functionally equivalent, but two booleans + a string beats one tri-state.

### IN-03: `(tabs)/index.tsx` import of `useFinishSession` while the action is "Avsluta sessionen" (close orphan) — naming mismatch

**File:** `app/app/(app)/(tabs)/index.tsx:96`
**Issue:** `useFinishSession` is named for the F8 happy-path finish action. The draft-resume overlay's "Avsluta sessionen" button uses the SAME hook to close an orphaned session (UAT 2026-05-13 fix). Functionally identical (UPDATE finished_at = now()), but the semantic mismatch — finishing a pass = positive UX, closing an orphan = damage-control — means a reader has to trace the mutationKey to confirm it's the same write. Adding a thin wrapper `useCloseOrphanSession = useFinishSession` would make the intent explicit at the call site.

Minor; not a correctness issue. Documenting the dual-use in the hook's JSDoc would suffice.

### IN-04: `setMutationDefaults['plan-exercise','reorder']` is a no-op default but `useReorderPlanExercises` is referenced only from one screen

**File:** `app/lib/query/client.ts:545-554`
**Issue:** The reorder default is registered as a no-op "so a stray useMutation({ mutationKey: ['plan-exercise','reorder'] }) wouldn't crash" — but the orchestrator is the only consumer, and the orchestrator builds N x `['plan-exercise','update']` mutations. The no-op default is dead code: nothing replays a `['plan-exercise','reorder']` mutation on hydration because the orchestrator never registers one in the cache. The defensive comment is technically correct but the entire mutationKey can be deleted.

Not bugged; just bloat.

### IN-05: Comment claim about React StrictMode in CR-02 ref-stamping — verify whether Expo SDK 54 enables StrictMode by default

**File:** `app/app/(app)/(tabs)/index.tsx:159-168` (cross-referenced from CR-02)
**Issue:** CR-02's StrictMode analysis is informational. Expo SDK 54 templates do not enable React StrictMode by default in production, but `app/app/_layout.tsx` may opt in. If StrictMode is on, every useEffect double-fires on mount in dev — the previousActiveRef logic survives this but is harder to reason about.

If StrictMode is intentionally on, document the assumption in the toast-trigger effect comment.

### IN-06: `manual-test-phase-05-f13-brutal.md` Phase 7 step 35 ("Tap Avsluta while still offline") is OPTIONAL, but Phase 9 step 39 asserts `finished_at` based on whether Phase 7 ran — branching test paths

**File:** `app/scripts/manual-test-phase-05-f13-brutal.md:124, 145-147`
**Issue:** The brutal-test document branches: Phase 7 is "OPTIONAL", Phase 9 step 39 says "`finished_at` is set (if Phase 7 ran) OR `finished_at IS NULL` (if Phase 7 was skipped)". This is fine for a manual UAT but makes the test under-specified — a tester who runs Phase 7 once and then re-runs the brutal-test without resetting state will see leftover `finished_at` from the prior run. Phase 1 step 4 baseline (`S0`, `E0`) records counts but doesn't note "ensure no pre-existing draft sessions exist" — a defensive precondition is missing.

Not a code defect — documentation tightening. Suggest adding a Phase 0 explicit cleanup:
```sql
-- Phase 0: Pre-test state reset (run BEFORE Phase 1)
DELETE FROM workout_sessions WHERE user_id = '<TEST_USER_ID>' AND finished_at IS NULL;
```

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
