---
phase: 10-plans-exercises-re-skin
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - app/app/(app)/(tabs)/_layout.tsx
  - app/app/(app)/(tabs)/index.tsx
  - app/app/(app)/_layout.tsx
  - app/app/(app)/plans/[id].tsx
  - app/app/(app)/plans/[id]/exercise-picker.tsx
  - app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx
  - app/app/(app)/plans/new.tsx
  - app/lib/muscle-group.ts
  - app/lib/queries/exercises.ts
  - app/lib/queries/plans.ts
  - app/lib/queries/sessions.ts
  - app/lib/query/client.ts
  - app/lib/schemas/exercises.ts
  - app/lib/schemas/sessions.ts
  - app/lib/seed/exercises.ts
  - app/locales/en.json
  - app/locales/sv.json
  - app/package.json
  - app/scripts/test-exercise-schemas.ts
  - app/scripts/test-muscle-group.ts
  - app/scripts/test-rls.ts
  - app/scripts/verify-deploy.ts
  - app/supabase/migrations/0010_seed_key_and_session_plan_snapshot.sql
  - app/types/database.ts
findings:
  critical: 1
  warning: 11
  info: 7
  total: 19
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-06-12
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 10 (Plans & Exercises Re-skin) was reviewed at standard depth: all four re-skinned screens, the new muscle-group taxonomy + bilingual seed pipeline, the hard-delete mutation path, migration 0010, the extended RLS/verify scripts, and the locale files.

The strong parts: migration 0010 preserves the `security invoker` + `set search_path = ''` + revoke/grant posture exactly; test-rls.ts gained correct Phase-10 cross-user assertions for `seed_key`; verify-deploy.ts locks the FK `ON DELETE SET NULL` regression; the Forge token hexes in the screens match `tailwind.config.js` verbatim (including the light/dark `gradTo` split); all referenced `Icon` names, `Logo variant="white"`, and `ForgeButton variant="destructive"` exist; `resolveMuscleGroupKey` is total and tested.

However, the review found one critical defect — the first-run seed uses **globally shared hardcoded UUID primary keys**, which silently and permanently breaks seeding for any second user (a scenario the code explicitly claims to support) — plus a cluster of warnings around the new hard-delete path (double `router.back()`, missing cache cleanup), the edit modal (focus-effect wipes live edits, no Zod boundary), unreachable error feedback in the picker, a hardcoded-Swedish i18n regression inside an i18n phase, and an idempotency contract (`upsert` + `.single()`) that does not actually behave as a no-op on replay.

## Critical Issues

### CR-01: Hardcoded global seed UUIDs make first-run seeding silently fail for every user after the first

**File:** `app/lib/seed/exercises.ts:45-69`, `app/app/(app)/_layout.tsx:77-116`, `app/lib/query/client.ts:475-506`
**Issue:** Every `SEED_EXERCISES` row carries a fixed UUID (e.g. `5e0d0001-0000-4000-8000-000000000001`) used as the **global primary key** of `public.exercises`. The first user to run `ExerciseSeedBootstrap` inserts 18 rows owning those PKs. For any second user (the comment at `_layout.tsx:64-65` explicitly promises "a second user on the same device still gets seeded" via the per-user flag `fm:exercises_seeded:<userId>`), each `['exercise','create']` upsert hits a PK conflict with the first user's rows:
1. `.upsert(vars, { onConflict: 'id', ignoreDuplicates: true })` skips the insert (ON CONFLICT DO NOTHING fires regardless of RLS visibility),
2. `.select().single()` then errors with PGRST116 (0 rows),
3. the per-row `onError` swallows it,
4. the seeded flag is still flipped to `"true"` (see WR-11),
5. RLS hides user 1's rows from user 2.

Net result: user 2 gets **zero starter exercises, permanently, with no error surfaced and no retry path**. The "idempotent deterministic UUIDs" rationale (T-10-07) only holds per-user; the IDs are not per-user.
**Fix:** Make the seed IDs deterministic **per user**, e.g. derive a UUIDv5 from `${userId}:${seed_key}` (a small pure name-based-UUID helper avoids new deps), or drop client-supplied PKs and upsert on a per-user natural key after adding `UNIQUE (user_id, seed_key)`:
```ts
// lib/seed: id derived per user
const id = uuidV5(`${userId}:${ex.seed_key}`, SEED_NAMESPACE);
createExercise.mutate({ id, user_id: userId, ... });
```
Either variant keeps re-runs idempotent for the same user while never colliding across users. Add a 2-user seed assertion to `test-rls.ts` (both users can SELECT their own 18 seed rows) so this cannot regress.

## Warnings

### WR-01: Double `router.back()` in the hard-delete confirm handler

**File:** `app/app/(app)/plans/[id].tsx:268-281`
**Issue:** `onDeleteConfirm` calls `router.back()` **unconditionally** right after `deletePlan.mutate(...)` AND passes `onSuccess: () => router.back()` to the same mutate call. The two adjacent comments contradict each other ("Navigate back ... on success" vs "Navigate immediately"). When the server responds before the popped screen finishes unmounting (fast network — the mutate-level `onSuccess` fires as long as the component is still mounted, which it is during the ~300 ms pop transition), the stack pops twice: once off the detail screen and once more off the plans list, producing an unhandled `GO_BACK` or, worse, popping whatever screen the user has since navigated into. The archive handler (`onArchiveConfirm`, line 241-249) correctly navigates exactly once.
**Fix:** Remove the `onSuccess` navigation; keep only the immediate optimistic `router.back()`:
```ts
deletePlan.mutate(
  { id: plan.id },
  { onError: () => setBannerError(t("errorGeneric")) },
);
router.back();
```

### WR-02: Draft-resume body copy is hardcoded Swedish — i18n regression inside an I18N phase

**File:** `app/app/(app)/(tabs)/index.tsx:154-157`
**Issue:** `draftBody` is built from hardcoded Swedish template literals (`Du har ett pågående pass från ${startedAt} med ${setsCount} set sparade.` / `Du startade ett pass ${startedAt} men har inte loggat något set än.`) while every other string on the screen routes through `t()` (the phase requirement I18N-05/SP-5). English-locale users see mixed-language UI in the draft-resume overlay. Neither string exists in `sv.json`/`en.json`, so `check:locale-parity` cannot catch it.
**Fix:** Add interpolated keys to both locale files and use `t()`:
```ts
const draftBody = setsCount > 0
  ? t("draftResumeWithSets", { time: startedAt, n: setsCount })
  : t("draftResumeNoSets", { time: startedAt });
```

### WR-03: Edit modal's `useFocusEffect` re-seeds on every cache update, wiping in-progress edits

**File:** `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx:287-295`
**Issue:** The callback passed to `useFocusEffect` depends on `planExercises`. `useFocusEffect` re-runs whenever the callback identity changes *while the screen is focused* — not only on focus transitions. Any background refetch of `planExercisesKeys.list(planId)` (e.g. the `onSettled` invalidate from a prior mutation resolving, or a reconnect refetch — the query is stale after 30 s) replaces the array reference, recreates the callback, and re-runs the effect, resetting `sets`/`repsMin`/`repsMax`/`notes` to the cached row and silently discarding whatever the user has tapped/typed since opening the modal. The comment claims "re-seed on focus", but the implementation re-seeds on data change.
**Fix:** Seed only on actual focus, reading the freshest cache imperatively so the dep array stays stable:
```ts
useFocusEffect(
  useCallback(() => {
    const rows = queryClient.getQueryData<PlanExerciseRow[]>(
      planExercisesKeys.list(planId!),
    );
    const row = rows?.find((px) => px.id === planExerciseId);
    setSets(row?.target_sets ?? null);
    // ...
  }, [planId, planExerciseId]),
);
```

### WR-04: Edit modal bypasses the Zod form boundary — reversed reps range and >500-char notes persist

**File:** `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx:273-335, 610-626`
**Issue:** Unlike `new.tsx` and the picker's create form (RHF + `zodResolver`), the target-edit modal writes raw local state straight into `updatePlanExercise.mutate`. Consequences: (a) `repsMin > repsMax` saves without complaint (the preview chip happily renders "10–5 reps"); (b) the notes `TextInput` has no `maxLength` and no schema check, so >500-char notes persist — migration 0001 has **no CHECK constraints** on `plan_exercises` targets/notes, so nothing stops it server-side either. CLAUDE.md mandates "Zod för all extern data (... formulär)" at every form boundary.
**Fix:** Validate in `onSave` before mutating: clamp/swap or reject `repsMin > repsMax` (e.g. surface inline error or auto-swap), and reuse the 500-char notes rule (`z.string().max(500)` or `maxLength={500}` on the input).

### WR-05: `['plan','delete']` leaves `plansKeys.detail(id)` and `planExercisesKeys.list(id)` caches stale

**File:** `app/lib/query/client.ts:436-467`
**Issue:** The new hard-delete default optimistically filters `plansKeys.list()` and invalidates `list()` + `sessionsKeys.listInfinite()` — but never clears or invalidates `plansKeys.detail(vars.id)` or `planExercisesKeys.list(vars.id)`. Both caches survive for `gcTime` = 24 h holding a plan that no longer exists (its `plan_exercises` rows were cascade-deleted server-side). The detail screen's loading gate is `!plan`, so any re-entry to the deleted plan's route (frozen screen via `freezeOnBlur`, persisted cache rehydration after restart, or stale navigation state) renders the deleted plan as if alive. The sibling `['session','delete']` default (lines 1056-1128) clears its detail slot and invalidates the orphaned child cache — the new plan-delete path skipped both.
**Fix:** In `onMutate`, `queryClient.setQueryData(plansKeys.detail(vars.id), undefined)` (snapshot first for rollback); in `onSettled`, also invalidate `plansKeys.detail(vars.id)` and `planExercisesKeys.list(vars.id)`.

### WR-06: `useCreatePlan` scope fallback documented but not implemented — offline create-plan → add-exercise replay order is unguaranteed

**File:** `app/lib/queries/plans.ts:110-120`, `app/app/(app)/plans/new.tsx:100,129-138`
**Issue:** The comment states the no-planId call site "falls back to a generic 'plan:create' scope", but the code passes `scope: undefined`. `new.tsx` calls `useCreatePlan()` with no opts (the plan id is generated per-submit, so it cannot be baked at hook construction). An offline flow of create-plan → navigate to detail → add exercises queues an **unscoped** `['plan','create']` and **scoped** (`plan:<id>`) `['plan-exercise','add']` mutations. On reconnect, unscoped mutations replay in parallel with scoped chains, so the add can hit the server before the plan insert commits → FK 23503 → `retry: 1` → if the retry also races, the add errors, rolls back optimistically, and the user's added exercise silently disappears. This is exactly the RESEARCH §5 FK-safety scenario the picker chain guards against, left open for the plan-create parent.
**Fix:** Either implement the documented fallback as a real shared scope and have `new.tsx` route the add chain through it, or restructure `new.tsx` to lazy-init the plan id (`useState(() => randomUUID())`) and pass `useCreatePlan({ planId: id })` so the create shares `plan:<id>` scope with subsequent child adds. At minimum, fix the comment so it stops describing behavior that does not exist.

### WR-07: "Idempotent" create-replay is not a no-op — `upsert + ignoreDuplicates + .single()` errors on the already-committed path

**File:** `app/lib/query/client.ts:281-289, 475-484, 513-522, 684-692, 833-855`
**Issue:** Every CREATE default claims "replay against an already-committed row is a no-op (Pitfall 8.10)". In reality, when the row already exists, `ON CONFLICT DO NOTHING` returns zero rows and `.select().single()` throws PGRST116, so the replayed mutation **fails** (after `retry: 1`), triggering the optimistic rollback (a committed row flickers out of the cache until `onSettled` invalidation refetches it) and, where call sites attach error UI, a spurious error. This is also the mechanism that turns CR-01 into a silent failure.
**Fix:** Treat the duplicate path as success — e.g. use `.select().maybeSingle()` and on `data == null` fetch the committed row by id (or return the optimistic vars), or catch PGRST116 explicitly and resolve instead of throwing.

### WR-08: Picker failure feedback is unreachable — `setBannerError` fires after the modal is dismissed

**File:** `app/app/(app)/plans/[id]/exercise-picker.tsx:206-215, 229-259`
**Issue:** `onCreateAndAdd` attaches `onError: () => setBannerError(t("errorGeneric"))` to the create mutate, then synchronously calls `router.back()` — the modal pops and unmounts before any server error can arrive, so the banner can never render (dead error path). The chained `addExerciseToPlan.mutate` has **no** onError at all, and `onPickExisting` likewise fires-and-dismisses with none. A genuine server-side rejection (not an offline pause) rolls the optimistic row back with zero user feedback: the exercise the user just added quietly vanishes from the plan.
**Fix:** Either remove the dead `onError` and document that surfacing is owned by a global mechanism (matching `edit.tsx`'s explicit comment), or actually surface failures from a component that outlives the modal (e.g. plan-detail banner driven by mutation state / a global error toast).

### WR-09: Remove ✕ button (destructive, no confirm) is accessibility-labeled "Redigera mål"

**File:** `app/app/(app)/plans/[id].tsx:932-1051` (rows 955-959, 975-980, 1034-1043)
**Issue:** `PlanExerciseRow` receives a single `dragLabel` prop (`t("editTargets")` = "Redigera mål") and applies it as `accessibilityLabel` to **three different controls**: the row pressable (opens edit — plausible), the grip drag-handle (wrong — it reorders), and the remove ✕ button (wrong and dangerous — a VoiceOver user activating an element announced as "Edit targets" removes the exercise from the plan with no confirmation).
**Fix:** Pass distinct labels: row → `t("editTargets")`, grip → a new reorder key, remove → `t("removeFromPlan")` (key already exists).

### WR-10: Plan-detail empty exercise list shows "Inga planer än" (wrong locale key)

**File:** `app/app/(app)/plans/[id].tsx:549-591` (line 583)
**Issue:** The `ListEmptyComponent` for the plan's *exercise* list renders `t("noPlans")` ("Inga planer än" / "No plans yet") as its heading — copied from the plans-list empty state. The user is looking at a plan that exists; the message claims no plans exist. The subtitle `t("addExercise")` renders the button-style imperative "Lägg till övning" as body copy, which also reads oddly.
**Fix:** Add dedicated keys (e.g. `noExercisesInPlan` / `noExercisesInPlanSub`) to both locale files and use them here.

### WR-11: Seed flag is flipped unconditionally after enqueue — the documented hard-failure retry path does not exist

**File:** `app/app/(app)/_layout.tsx:96-107`
**Issue:** The per-row `onError` comment claims "a later launch (flag still unset on a hard failure path) retries", but `AsyncStorage.setItem(flag, "true")` runs unconditionally right after the enqueue loop, regardless of mutation outcomes. Any persistent failure (RLS rejection after a sign-out race, the CR-01 PK collision, a permanent server error) leaves the flag set with zero seed rows and no retry ever. The flag should reflect *confirmed* seeding, not *attempted* seeding.
**Fix:** Flip the flag from a completion signal — e.g. count `onSuccess` callbacks (treating the WR-07-fixed duplicate path as success) and set the flag only when all 18 settle successfully; or verify via a cheap `select count` before flagging.

## Info

### IN-01: Forge TOKENS hex bag copy-pasted across five screens

**File:** `app/app/(app)/(tabs)/index.tsx:71-96`, `app/app/(app)/plans/[id].tsx:87-112`, `app/app/(app)/plans/[id]/exercise-picker.tsx:91-120`, `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx:89-116`, `app/app/(app)/plans/new.tsx:70-91`, plus `(tabs)/_layout.tsx:71-72`
**Issue:** Five near-identical `TOKENS` objects (each a slightly different subset) plus two loose hexes in the tab bar all claim to "mirror tailwind.config verbatim". They currently do, but six copies of the palette is a drift bomb — one future token tweak must be replicated everywhere by hand.
**Fix:** Export one `FORGE_TOKENS` (and a `useForgeTokens()` helper wrapping `useColorScheme`) from `app/lib/` or `components/ui/` and import it.

### IN-02: Two divergent exported `MuscleGroupKey` types share one name

**File:** `app/lib/muscle-group.ts:23-29` vs `app/lib/schemas/exercises.ts:23-30`
**Issue:** `lib/muscle-group.ts` exports a 6-member `MuscleGroupKey` (incl. `"other"`); `lib/schemas/exercises.ts` exports a 5-member type with the same name. The picker imports both modules and bridges them with a cast (`value as MuscleGroupKey | null`, exercise-picker.tsx:418). Same-name divergent types invite a future wrong-import bug.
**Fix:** Define the 5 strict form keys once, derive the resolver type as `FormKey | "other"`, and re-export from one place.

### IN-03: `handleReorder` double-casts through `unknown`

**File:** `app/app/(app)/plans/[id].tsx:183-186, 305-306`
**Issue:** `newOrder as unknown as PlanExerciseRowDb[]` defeats type-checking; `PlanExerciseRowShape` lacks `plan_id`, so correctness silently depends on the runtime objects actually being the full cached rows (they are, today, because `data` is also a cast of `planExercises`). If the row shape ever became a real projection, reorder would break with no compile error.
**Fix:** Type the list as `PlanExerciseRow` (the full cached row) and narrow only at render-time, removing both casts.

### IN-04: Optimistic rows for `['exercise','create']` / `['plan','create']` cast Partial → Row instead of building complete rows

**File:** `app/lib/query/client.ts:291-313, 489-496`
**Issue:** The WR-03 (05-REVIEW) "explicit-nulls `satisfies`" pattern was applied to sessions/sets but not to the plan/exercise creates this phase touched: `vars as ExerciseRow` leaves `seed_key`/`notes`/`equipment`/`created_at` `undefined` (not `null`) in the cache during the offline window — a shape that would fail `ExerciseRowSchema.parse`. Current consumers only truthy-check those fields, so no runtime break today.
**Fix:** Build `optimisticRow = { ...explicit nulls... } satisfies ExerciseRow` as done for `['session','start']`.

### IN-05: Picker create stores empty strings where edit stores null

**File:** `app/app/(app)/plans/[id]/exercise-picker.tsx:240-249`
**Issue:** `equipment: input.equipment ?? null` / `notes: input.notes ?? null` — the RHF defaults are `""`, which is not nullish, so untouched fields persist as `""` rather than `NULL`. `edit.tsx:324` normalizes (`notes.trim() === "" ? null : notes`). `displayEquipment` truthy-checks so rendering is unaffected, but the DB accumulates two representations of "empty".
**Fix:** Normalize: `equipment: input.equipment?.trim() ? input.equipment : null` (same for notes).

### IN-06: `exerciseNameKey` ignores its parameter and renders lowercase "övningar" as a name placeholder

**File:** `app/app/(app)/plans/[id].tsx:1056-1065`
**Issue:** The function name suggests seed-key-based resolution, but it `void`s `exerciseId` and returns `t("exercises")` — the lowercase stat label ("övningar"/"exercises") — as the exercise row's *title* when the exercises cache is cold. The promised "resolve ... via the exercise.<key>.name locale map" in its doc comment is not implemented.
**Fix:** Rename to reflect reality (e.g. `placeholderExerciseName`) or add a proper placeholder key (e.g. "Laddar övning…"), and drop the misleading doc comment.

### IN-07: Exercise list sorted by canonical English name, displayed in Swedish

**File:** `app/lib/queries/exercises.ts:26-33`, `app/app/(app)/plans/[id]/exercise-picker.tsx:167-171`
**Issue:** The query orders by raw `name` (canonical English for seed rows), but the picker displays the translated name. In sv locale, "Bänkpress" sorts under B-as-in-"Bench press", "Knäböj" under S-as-in-"Squat" — the list looks unsorted to Swedish users.
**Fix:** Sort the `filtered` memo client-side by `displayName(e).localeCompare(...)`.

---

_Reviewed: 2026-06-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
