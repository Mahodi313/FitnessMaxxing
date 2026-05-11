---
phase: 04-plans-exercises-offline-queue-plumbing
reviewed: 2026-05-10T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - app/app.json
  - app/app/(app)/(tabs)/_layout.tsx
  - app/app/(app)/(tabs)/history.tsx
  - app/app/(app)/(tabs)/index.tsx
  - app/app/(app)/(tabs)/settings.tsx
  - app/app/(app)/_layout.tsx
  - app/app/(app)/plans/[id].tsx
  - app/app/(app)/plans/[id]/exercise-picker.tsx
  - app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx
  - app/app/(app)/plans/new.tsx
  - app/app/_layout.tsx
  - app/components/offline-banner.tsx
  - app/lib/auth-store.ts
  - app/lib/queries/exercises.ts
  - app/lib/queries/plan-exercises.ts
  - app/lib/queries/plans.ts
  - app/lib/query/client.ts
  - app/lib/query/keys.ts
  - app/lib/query/network.ts
  - app/lib/query/persister.ts
  - app/lib/schemas/exercises.ts
  - app/lib/schemas/plan-exercises.ts
  - app/lib/schemas/plans.ts
  - app/lib/utils/uuid.ts
  - app/package.json
  - app/scripts/test-exercise-schemas.ts
  - app/scripts/test-offline-queue.ts
  - app/scripts/test-plan-exercise-schemas.ts
  - app/scripts/test-plan-schemas.ts
  - app/scripts/test-reorder-constraint.ts
  - app/scripts/test-rls.ts
  - app/scripts/test-sync-ordering.ts
  - app/scripts/test-upsert-idempotency.ts
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-10
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Phase 4 ships the plans/exercises slice plus the TanStack-v5 offline-queue plumbing. Project conventions held strongly:

- **Service-role isolation:** clean — `SUPABASE_SERVICE_ROLE_KEY` only appears under `app/scripts/*.ts` + `app/.env.example` (verified via grep).
- **Typed Supabase clients:** every `createClient(...)` call is typed `createClient<Database>(...)`.
- **`mutate` not `mutateAsync`:** every offline-touching call uses `mutate(payload, { onError })`. No `await mutateAsync` calls remain in source — only doc comments referencing the historical regression.
- **Modal-portal pattern:** `[id].tsx` correctly uses inline absolute-positioned overlays with explicit RN styles for the overflow menu and archive-confirm dialog (the canonical convention in this stack).
- **scope.id contract:** every `useMutation` wrapper uses a static string scope (`plan:${planId}`), never a function.
- **Zod-at-boundary:** every Supabase response is parsed via `*RowSchema.parse(...)` in queries and mutationFns; no bare casts on responses.

Two BLOCKER-class findings center on the reorder-during-online path:

1. **CR-01** — `useReorderPlanExercises` fires `updateMutation.mutate` N times in parallel for phase-1; phase-1 mutations land on Supabase concurrently. Postgres receives multiple `UPDATE plan_exercises SET order_index = -k WHERE id = $row` statements with no ordering guarantee — but each negative offset must be unique against the live `(plan_id, order_index)` partial index. If two of the negative-offset writes interleave with the original-position writes, the unique-constraint violation that the two-phase trick was designed to avoid can resurface. (See Pitfall §3 + RESEARCH §3.) The integration test in `test-reorder-constraint.ts` writes phase-1 rows SEQUENTIALLY, so it cannot detect this concurrency hazard.
2. **CR-02** — Offline-mode side-effect: when phase-1 mutations are paused, the reorder orchestrator awaits `Promise.all(phase1Promises)` which never resolves until the user returns online. Phase-2 only fires after every phase-1 promise resolves. While paused, `phase1Errored` stays `false` and phase-2 is never queued — meaning on reconnect, **only the phase-1 negative offsets replay**, never the phase-2 final positions. The DB ends up in an all-negative-order_index state until the user manually re-reorders. The two-phase replay contract documented in `client.ts` ("scope.id serializes phase-1 before phase-2") only works if phase-2 is actually queued at offline-time, which this implementation defers to "after phase-1 resolves" — a callback that never fires offline.

Six WARNING items cluster around stale closures (auth-store init race), accessibility regressions (banner double-Pressable on plans/new.tsx, banner without role on plans/[id].tsx error reset), and the dead `disabled={isSubmitting}` pattern on every form — `isSubmitting` from RHF only flips to true while the synchronous submit handler runs, but every Phase 4 handler is sync (uses `mutate` not `mutateAsync`), so `isSubmitting` never observably toggles and the disabled-state UX is effectively dead code.

## Critical Issues

### CR-01: Reorder phase-1 mutations fire concurrently — unique-constraint hazard

**File:** `app/lib/queries/plan-exercises.ts:144-162`
**Issue:** `phase1Promises` is built via `changed.map(...)` where each map iteration calls `updateMutation.mutate(...)` synchronously. All N `mutate()` calls execute in the same tick before any of the underlying Supabase requests complete; phase-1 thus issues N parallel UPDATEs to Postgres. The two-phase reorder algorithm's correctness depends on each phase-1 row landing in a *distinct* negative slot before any phase-2 final-position write happens — but it also implicitly assumes phase-1 writes do not race against each other. With concurrent execution, two phase-1 UPDATEs can attempt to write the same negative slot if the JS layer's slot computation is correct (it is) but the writes target rows whose original `order_index` had not been atomically vacated yet. While the unique partial index on `(plan_id, order_index)` blocks duplicates regardless, the test harness in `test-reorder-constraint.ts:136-146` writes phase-1 sequentially (`for ... await admin...update`) — so the harness cannot detect the production code path's concurrent behaviour. RESEARCH §3 calls out the unique-constraint trap; this implementation skirts it by accident only in the typical case.

**Fix:** Serialize phase-1 mutations OR use a Postgres RPC that performs the swap atomically.

```ts
// Option A — serialize phase-1 (simplest, matches test-reorder-constraint.ts):
for (let slot = 0; slot < changed.length; slot++) {
  const { row } = changed[slot];
  await new Promise<void>((resolve) => {
    updateMutation.mutate(
      { id: row.id, plan_id: planId, order_index: -(slot + 1) },
      { onError: () => { phase1Errored = true; resolve(); }, onSuccess: () => resolve() },
    );
  });
  if (phase1Errored) break;
}

// Option B — Postgres RPC reorder_plan_exercises(plan_id uuid, ids uuid[])
// that runs the two-phase swap inside a single transaction; client invokes
// once via supabase.rpc() and the unique-index trap is enforced at the DB.
```

### CR-02: Phase-2 reorder writes are dropped offline — DB stuck at negative offsets

**File:** `app/lib/queries/plan-exercises.ts:168-189`
**Issue:** Phase-2 `updateMutation.mutate(...)` calls are inside `void Promise.all(phase1Promises).then(() => {...})`. When offline, every phase-1 `mutate` call is paused: the supplied `onError`/`onSuccess` callbacks NEVER FIRE while paused (TanStack v5 paused-mutation contract — callbacks fire only on actual mutationFn execution). The phase-1 promises therefore never resolve, the `.then(...)` block never runs, and **phase-2 mutations are never enqueued at all**. On reconnect, `resumePausedMutations()` replays only the phase-1 negative-offset writes — the database lands in a state where every reordered row has `order_index = -(slot+1)`, which the next `usePlanExercisesQuery` refetch surfaces as a fully-negative-ordered list. The whole reorder operation is silently lost.

This is the inverse of the offline-first contract documented in client.ts header ("scope.id serializes phase-1 before phase-2 on replay"). Replay ordering only matters if phase-2 was queued before going offline — but this implementation queues phase-2 inside an async callback that runs only after phase-1 fully resolves, which by definition cannot happen offline.

This violates the V1 data-integrity constraint: "Får ALDRIG förlora ett loggat set" (never lose a logged set). While reordering is not a logged set, reorder-loss undermines the offline-first contract the user has been sold.

**Fix:** Queue phase-1 AND phase-2 mutations synchronously at call-time so both end up in the paused-mutation queue under shared scope.id; let the cache rollback logic key off `onSuccess`/`onError` per-mutation rather than orchestrating phase-2 in a JS callback that depends on phase-1 resolving.

```ts
// Queue both phases up-front; rely on scope.id 'plan:<planId>' to serialize
// replay. Phase-1 writes negative offsets, phase-2 writes finals. Both are
// in the queue at the moment of going offline, so resumePausedMutations
// replays both in registration order.
changed.forEach(({ row }, slot) => {
  updateMutation.mutate({ id: row.id, plan_id: planId, order_index: -(slot + 1) });
});
changed.forEach(({ row, newIndex }) => {
  updateMutation.mutate({ id: row.id, plan_id: planId, order_index: newIndex });
});
```

The rollback-on-phase-1-error path can be reinstated by checking `updateMutation.error` after both phases settle (online case) or by accepting that on-replay errors invalidate via `onSettled` and the next query refetch heals from server truth.

## Warnings

### WR-01: `disabled={isSubmitting}` is dead code on every Phase 4 form

**File:** `app/app/(app)/plans/new.tsx:244`, `app/app/(app)/plans/[id].tsx:388`, `app/app/(app)/plans/[id]/exercise-picker.tsx:282`, `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx:250`
**Issue:** `isSubmitting` from `react-hook-form`'s `formState` is only `true` while the function passed to `handleSubmit(...)` is synchronously executing. Every Phase 4 onSubmit callback is now SYNC (because they switched from `mutateAsync` to `mutate` per the offline contract). Therefore `isSubmitting` flickers `true` for one tick during the synchronous run and then immediately settles back to `false` before any render commits — `disabled={isSubmitting}` and the "Sparar…/Skapar…" string-swap never render to the user. A user can rapid-tap "Skapa plan" in airplane mode and queue N duplicate plan-creates (each with a fresh randomUUID, so upsert idempotency does not de-dupe — they're distinct rows).

**Fix:** Track local pending state explicitly:

```ts
const [pending, setPending] = useState(false);
const onSubmit = (input) => {
  if (pending) return;
  setPending(true);
  createPlan.mutate(
    { ... },
    {
      onError: () => { setPending(false); setBannerError("..."); },
      onSettled: () => setPending(false),
    }
  );
  router.replace(...); // navigate immediately; pending only matters for re-tap suppression
};
// ...
<Pressable disabled={pending} ...>
```

Or rely on `createPlan.isPending` (TanStack v5 useMutation return) for the same effect.

### WR-02: auth-store getSession init can clobber a valid session under late rejection

**File:** `app/lib/auth-store.ts:80-96`
**Issue:** The `getSession().then(...)` and `.catch(...)` arms both guard with `prev.status === "loading"`. But the listener at lines 64-69 calls `useAuthStore.setState({ session, status })` UNCONDITIONALLY (no read-modify-write). If `getSession()` resolves AFTER the listener has fired SIGNED_OUT (legitimate sign-out flow during sign-in race) and writes `{ session: null, status: "anonymous" }` — the .catch arm's guard correctly no-ops. But if `getSession()` resolves AFTER the listener fired SIGNED_IN with a fresh session, the .then arm with `prev.status === "loading"` no-ops correctly.

The actual race window: the `getSession()` promise rejects (corrupt LargeSecureStore decrypt) AFTER the listener fired INITIAL_SESSION with a valid session. Listener flipped status to "authenticated"; .catch arm reads `prev.status === "anonymous" || "authenticated"` and no-ops. So this is actually correct — the comment at lines 76-79 ("CR-01: both branches read-modify-write so they only take effect while status === 'loading'") is accurate.

But the listener at line 64-69 does NOT use the read-modify-write pattern. If `supabase.auth.signOut()` is called and the network call returns an `error` (line 49), the user-facing path force-clears via `set({ session: null, status: "anonymous" })` (line 52), and THEN if the listener fires SIGNED_OUT a moment later it would also call `setState({ session: null, status: "anonymous" })` — same value, idempotent. But if a TOKEN_REFRESHED event fires concurrently with signOut (unlikely but legal per auth-js), the listener would clobber the anonymous state with a fresh session. Defensible — just calling out the asymmetry.

**Fix:** Make the listener read-modify-write too, ignoring late events when `signOut()` has already flipped to `anonymous`:

```ts
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
    // Only honour if there's an active session in the store
    useAuthStore.setState((prev) =>
      prev.session ? { session, status: session ? "authenticated" : "anonymous" } : prev,
    );
    return;
  }
  useAuthStore.setState({
    session,
    status: session ? "authenticated" : "anonymous",
  });
});
```

### WR-03: `setQueryData(detailKey, undefined)` clears optimistic detail correctly but pattern is brittle

**File:** `app/lib/query/client.ts:213`
**Issue:** `queryClient.setQueryData(plansKeys.detail(vars.id), c?.previousDetail)` — when `c.previousDetail` is `undefined` (always true for a new plan), `setQueryData` is called with `undefined`. TanStack v5 treats this as "clear the cached data" but per the v5 docs the recommended way to remove cached data is `removeQueries` — `setQueryData(key, undefined)` works but is undocumented behaviour subject to change. The active `usePlanQuery(id)` would then see `data: undefined` and switch to `pending` (which `initialData: () => list?.find(...)` would re-seed only if the row still exists in the list cache; on rollback the list cache has been restored too, so the row is gone, so `initialData` returns undefined, so usePlanQuery refetches).

**Fix:**

```ts
if (c?.previousDetail) {
  queryClient.setQueryData(plansKeys.detail(vars.id), c.previousDetail);
} else {
  queryClient.removeQueries({ queryKey: plansKeys.detail(vars.id) });
}
```

### WR-04: bannerError Pressable wraps a Pressable — accessibility role conflict

**File:** `app/app/(app)/plans/new.tsx:130-156`
**Issue:** The error-banner block is structured as a `<Pressable accessibilityRole="button" accessibilityLabel={bannerError}>` wrapping a row that contains another inner `<Pressable accessibilityRole="button" accessibilityLabel="Stäng">`. VoiceOver/TalkBack announce nested buttons inconsistently — outer one absorbs taps on most of its area, inner one gets only the ✕ pixels. The whole banner being a button with the error text as label is also unusual: screen-reader users get "Något gick fel. Försök igen, knapp" rather than "Något gick fel. Försök igen, varning". This pattern is inconsistent with `plans/[id].tsx:287-308` and `exercise-picker.tsx:194-213` which use a `<View>` wrapper with `accessibilityLiveRegion` and only the ✕ as a button.

**Fix:** Match the `plans/[id].tsx` pattern — outer container is a non-interactive `<View>` with `accessibilityRole="alert"` and `accessibilityLiveRegion="polite"`, only the ✕ is a button.

```tsx
<View
  className="flex-row items-start justify-between gap-2"
  accessibilityRole="alert"
>
  <Text className="flex-1 text-base text-red-600 dark:text-red-400" accessibilityLiveRegion="polite">
    {bannerError}
  </Text>
  <Pressable onPress={() => setBannerError(null)} accessibilityRole="button" accessibilityLabel="Stäng" hitSlop={8} className="px-2 py-1">
    <Text className="text-base font-semibold text-red-600 dark:text-red-400">✕</Text>
  </Pressable>
</View>
```

### WR-05: bannerError container missing accessibilityRole="alert"

**File:** `app/app/(app)/plans/[id].tsx:287-308`, `app/app/(app)/plans/[id]/exercise-picker.tsx:194-213`
**Issue:** The error-banner outer `<View>` only sets `accessibilityLiveRegion="polite"` on the inner `<Text>`. Per CLAUDE.md security/quality conventions ("every alert region accessibilityLiveRegion") AND React Native a11y guidance, the container should also have `accessibilityRole="alert"` so VoiceOver groups the announcement and signals it as an alert. `OfflineBanner` does this correctly (line 47-48 `accessibilityRole="alert"` on the View). The error banners on plans/[id] and exercise-picker do not — the error text reads as plain body text on screen readers.

**Fix:**

```tsx
<View
  className="flex-row items-start justify-between gap-2"
  accessibilityRole="alert"
>
  ...
</View>
```

### WR-06: `as Href` casts hide unverified routes — typedRoutes contract bypassed

**File:** `app/app/(app)/(tabs)/index.tsx:103,116,144`, `app/app/(app)/plans/[id].tsx:405,450`, `app/app/(app)/plans/new.tsx:105`
**Issue:** Every route literal is wrapped `as Href` to bypass `experiments.typedRoutes: true` in app.json. The lengthy comment in `(tabs)/index.tsx:25-33` admits this is a "Rule 3 fix that defers type-validation until the dev server regenerates router.d.ts". Now that all four screens (`plans/new.tsx`, `plans/[id].tsx`, `plans/[id]/exercise-picker.tsx`, `plans/[id]/exercise/[planExerciseId]/edit.tsx`) exist, the typed-routes graph IS available — the `as Href` casts are obsolete and should be dropped to restore compile-time link safety.

**Fix:** Run `npx expo start --clear` once to force `.expo/types/router.d.ts` regeneration, then remove every `as Href` cast and let TypeScript validate the route literals at compile time.

```tsx
// Before
router.push(`/plans/${plan.id}` as Href);
// After
router.push(`/plans/${plan.id}`);
```

## Info

### IN-01: useReorderPlanExercises optimistic write is clobbered by update default's onMutate

**File:** `app/lib/queries/plan-exercises.ts:124-126` + `app/lib/query/client.ts:409-424`
**Issue:** The reorder hook's optimistic write at line 126 sets the cache to the final order with `order_index: idx`. Each subsequent `updateMutation.mutate(...)` for phase-1 runs the `['plan-exercise','update']` setMutationDefaults `onMutate` which patches the matching cache row with `{...r, ...vars}` — including `order_index: -(slot+1)`. After all phase-1 calls have run their onMutate, every changed row in the cache has a negative `order_index` field even though the array order remains the optimistic one. The UI binds to array position, not to `order_index`, so the visual ordering survives — but any consumer that reads `order_index` directly (e.g. an analytics overlay, a future feature) would see negative values briefly. Cache state is internally inconsistent for the duration of phase-1.

**Fix:** Either skip the update default's onMutate when the call originates from reorder (e.g. via a `meta` flag the reorder hook sets), or accept the inconsistency and document it. Cosmetic — current consumers do not bind to `order_index` field directly.

### IN-02: Test scripts use Date.now() in seeded user emails — clash risk on rapid reruns

**File:** `app/scripts/test-reorder-constraint.ts:76`, `app/scripts/test-sync-ordering.ts:73`
**Issue:** `const email = \`${TEST_EMAIL_PREFIX}${Date.now()}${TEST_EMAIL_DOMAIN}\``. If two test invocations run within the same millisecond (CI parallelism, unlikely but possible), the second `createUser` errors with email-already-exists. `test-rls.ts:54-55` uses static `userAEmail`/`userBEmail` which is fine because purgeTestUsers runs first. The two scripts using Date.now() purge by prefix at start AND end which compensates for collisions — but a non-zero exit from a previous run could leave a stale row that collides with the next Date.now() value.

**Fix:** Use `randomUUID()` in the email instead of timestamp:

```ts
const email = `${TEST_EMAIL_PREFIX}${randomUUID()}${TEST_EMAIL_DOMAIN}`;
```

### IN-03: ScrollView inside KeyboardAvoidingView inside SafeAreaView inside GestureHandlerRootView

**File:** `app/app/(app)/plans/[id]/exercise-picker.tsx:168-398`
**Issue:** Indentation/nesting at lines 168-396 mixes 6-space and 8-space indent inside the GestureHandlerRootView. Lines 177-396 are indented at 6 spaces but they're inside a node at 4 spaces depth. The closing tags at lines 397-399 don't quite line up. Cosmetic — Prettier should normalize on next save.

**Fix:** Run prettier on the file.

### IN-04: `void _planId` after destructure is unidiomatic; rest spread already drops it

**File:** `app/lib/query/client.ts:397-398`
**Issue:** `const { id, plan_id: _planId, ...rest } = vars; void _planId;` — the destructure already binds `_planId` to a variable that is intentionally unused; the `void _planId` suppresses the noUnusedLocals lint. Cleaner to use the rest-only filter:

```ts
const { id, plan_id, ...rest } = vars;
// or use a runtime filter that doesn't introduce an unused binding
```

Or configure ESLint to allow underscore-prefixed unused locals (already standard in `eslint-config-expo`).

**Fix:** Remove `void _planId` and silence via underscore prefix (already present) — most ESLint configs treat `_planId` as intentionally unused.

### IN-05: Settings tab assumes session is non-null but doesn't gate on it

**File:** `app/app/(app)/(tabs)/settings.tsx:24-25`
**Issue:** `const email = useAuthStore((s) => s.session?.user.email)` then `if (email && ...)` is fine, but the `signOut` action at line 25 is read from the store unconditionally. If a user is somehow on the settings tab without a session (parent layout's `<Redirect>` guard *should* prevent this, but defense-in-depth was an established Phase 3 convention per CLAUDE.md), the signOut action would still attempt `supabase.auth.signOut()` and clear an empty queryClient.

**Fix:** Gate render on `email` being defined too, or trust the parent layout guard. Cosmetic.

---

_Reviewed: 2026-05-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
